#!/usr/bin/env python3
"""
pick_issue.py

Discovers open GitHub issues across a repo or the entire organization,
filters out:
  1. Issues that are blocked (by open dependencies, GitHub blocked-by links, or body text)
  2. Issues currently being handled by active sessions in T3 Code
Then applies Matt Pocock's `ask-matt` router to categorize the selected issue,
summarize its scope, and recommend the exact skills and commands to proceed.
"""

import argparse
import json
import os
import re
import sqlite3
import subprocess
import sys
from typing import Any, Dict, List, Optional, Set, Tuple

T3_SQLITE_PATH = os.path.expanduser("~/.t3/userdata/statev2.sqlite")


def run_command(cmd: List[str]) -> Tuple[int, str, str]:
    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
        return proc.returncode, proc.stdout.strip(), proc.stderr.strip()
    except Exception as e:
        return 1, "", str(e)


def get_current_repo() -> Optional[str]:
    code, stdout, _ = run_command(["git", "config", "--get", "remote.origin.url"])
    if code != 0 or not stdout:
        return None
    url = stdout.strip()
    m = re.search(r"github\.com[:/]([\w.-]+/[\w.-]+?)(?:\.git)?$", url)
    if m:
        return m.group(1)
    return None


def get_org_repos(org: str) -> List[str]:
    code, stdout, stderr = run_command([
        "gh", "repo", "list", org, "--limit", "100", "--json", "nameWithOwner"
    ])
    if code != 0:
        return []
    try:
        items = json.loads(stdout)
        return [item["nameWithOwner"] for item in items if "nameWithOwner" in item]
    except Exception:
        return []


def get_active_t3_threads(custom_threads: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    threads = []
    if custom_threads:
        for t in custom_threads:
            threads.append({"title": t, "status": "running"})
        return threads

    if os.path.exists(T3_SQLITE_PATH):
        try:
            conn = sqlite3.connect(f"file:{T3_SQLITE_PATH}?mode=ro", uri=True)
            cursor = conn.cursor()
            query = """
            SELECT r.thread_id, t.title, r.status, r.requested_at
            FROM orchestration_v2_projection_runs r
            JOIN orchestration_v2_projection_threads t ON r.thread_id = t.thread_id
            WHERE r.completed_at IS NULL AND r.status IN ('running', 'starting', 'queued', 'waiting')
            ORDER BY r.requested_at DESC
            """
            for row in cursor.execute(query):
                threads.append({
                    "thread_id": row[0],
                    "title": row[1],
                    "status": row[2],
                    "requested_at": row[3],
                })
            conn.close()
        except Exception:
            pass

    return threads


def check_is_handled_by_t3(
    repo: str, issue_num: int, issue_title: str, active_threads: List[Dict[str, Any]]
) -> Tuple[bool, Optional[str]]:
    repo_basename = repo.split("/")[-1]
    title_words = [
        w.lower()
        for w in re.findall(r"[a-zA-Z]{4,}", issue_title)
        if w.lower() not in {"issue", "core", "test", "spec", "update", "with", "from", "that"}
    ]

    for t in active_threads:
        t_title = t.get("title", "")
        t_lower = t_title.lower()

        # Match exact issue number references, e.g. "Issue 12", "issue #12", "#12"
        issue_pat = rf"(?:issue\s*#?|#){issue_num}\b"
        if re.search(issue_pat, t_lower):
            if repo_basename.lower() in t_lower or f"#{issue_num}" in t_title or f"Issue {issue_num}" in t_title:
                return True, t_title

        # Match word similarity for specific feature titles
        matched_words = sum(1 for w in title_words if w in t_lower)
        if len(title_words) >= 3 and matched_words >= 3:
            return True, t_title
        elif len(title_words) in {1, 2} and matched_words == len(title_words):
            return True, t_title

    return False, None


def get_issue_details(repo: str, issue_num: int) -> Dict[str, Any]:
    code, stdout, _ = run_command([
        "gh", "issue", "view", str(issue_num), "--repo", repo
    ])
    details = {"raw": stdout if code == 0 else "", "blocked_by": [], "blocking": []}
    if code != 0:
        return details

    for line in stdout.splitlines():
        if line.startswith("blocked-by:"):
            refs = line.replace("blocked-by:", "").strip().split(",")
            details["blocked_by"] = [r.strip() for r in refs if r.strip()]
        elif line.startswith("blocking:"):
            refs = line.replace("blocking:", "").strip().split(",")
            details["blocking"] = [r.strip() for r in refs if r.strip()]

    return details


def is_issue_open(issue_ref: str, current_repo: str, cache: Dict[str, bool]) -> bool:
    """Returns True if the referenced issue is OPEN, False if CLOSED or non-existent."""
    if issue_ref in cache:
        return cache[issue_ref]

    target_repo = current_repo
    target_num = None

    if "#" in issue_ref:
        parts = issue_ref.split("#")
        if parts[0]:
            target_repo = parts[0]
        target_num = parts[1]
    elif issue_ref.startswith("http"):
        m = re.search(r"github\.com/([\w.-]+/[\w.-]+)/issues/(\d+)", issue_ref)
        if m:
            target_repo = m.group(1)
            target_num = m.group(2)
    elif issue_ref.isdigit():
        target_num = issue_ref

    if not target_num:
        cache[issue_ref] = False
        return False

    code, stdout, _ = run_command([
        "gh", "issue", "view", target_num, "--repo", target_repo, "--json", "state"
    ])
    if code == 0:
        try:
            data = json.loads(stdout)
            is_open = (data.get("state") == "OPEN")
            cache[issue_ref] = is_open
            return is_open
        except Exception:
            pass

    cache[issue_ref] = False
    return False


def check_is_blocked(
    repo: str, issue: Dict[str, Any], details: Dict[str, Any], status_cache: Dict[str, bool]
) -> Tuple[bool, List[str]]:
    blocking_causes = []

    # 1. Labels
    labels = [l.get("name", "").lower() for l in issue.get("labels", [])]
    if "blocked" in labels:
        blocking_causes.append("Labeled as 'blocked'")

    # 2. Native blocked-by metadata
    for ref in details.get("blocked_by", []):
        if is_issue_open(ref, repo, status_cache):
            blocking_causes.append(f"Blocked by open issue {ref}")

    # 3. Text patterns in body
    body = issue.get("body") or ""
    patterns = [
        r"(?i)blocked\s+by\s+(?:the\s+[\w\s-]+\s+issue\s+)?\(?#(\d+)\)?",
        r"(?i)blocked\s+by\s+(https://github\.com/[\w.-]+/[\w.-]+/issues/\d+)",
        r"(?i)blocked\s+by\s+([\w.-]+/[\w.-]+#\d+)",
    ]
    for pat in patterns:
        for match in re.finditer(pat, body):
            ref = match.group(1)
            if is_issue_open(ref, repo, status_cache):
                msg = f"Body states blocked by open issue {ref}"
                if msg not in blocking_causes:
                    blocking_causes.append(msg)

    return len(blocking_causes) > 0, blocking_causes


def route_ask_matt(issue: Dict[str, Any], details: Dict[str, Any]) -> Dict[str, Any]:
    title = issue.get("title", "")
    body = issue.get("body", "")
    labels = [l.get("name", "").lower() for l in issue.get("labels", [])]
    t_lower = title.lower()

    # Rule 1: Bug or regression
    if "bug" in labels or "fix" in t_lower or "diagnos" in t_lower or "regression" in t_lower:
        return {
            "flow": "On-ramp: Bug Fixing",
            "primary_skill": "/diagnosing-bugs",
            "skills_chain": ["/diagnosing-bugs", "/tdd", "/retro"],
            "rationale": "Issue describes a bug or regression. Build a tight feedback loop reproduction first before modifying code.",
            "first_step": "Run `/diagnosing-bugs` to reproduce with one failing test command, fix via `/tdd`, and run `/retro`.",
        }

    # Rule 2: Greenfield / Foggy epic
    if "epic" in labels or "roadmap" in t_lower or "greenfield" in t_lower:
        return {
            "flow": "On-ramp: Greenfield / High Uncertainty",
            "primary_skill": "/wayfinder",
            "skills_chain": ["/wayfinder", "/to-spec", "/to-tickets", "/implement"],
            "rationale": "High cognitive fog and multi-session architectural unknowns. Need decision tickets before deliverables.",
            "first_step": "Run `/wayfinder` to chart a map of decision tickets on the issue tracker.",
        }

    # Rule 3: Architecture improvement & refactoring
    if "refactor" in t_lower or "architecture" in t_lower or "cleanup" in t_lower or "modular" in t_lower:
        return {
            "flow": "Codebase Health: Architecture Deepening",
            "primary_skill": "/improve-codebase-architecture",
            "skills_chain": ["/improve-codebase-architecture", "/codebase-design", "/tdd", "/code-review"],
            "rationale": "Codebase upkeep and modular boundary deepening. Find seams, design interfaces, and implement clean abstractions.",
            "first_step": "Run `/improve-codebase-architecture` followed by `/codebase-design`.",
        }

    # Rule 4: Ready for implementation (Groomed / Acceptance seeds present)
    has_acceptance = "acceptance seeds" in body.lower() or "acceptance criteria" in body.lower() or "- [ ]" in body
    is_ready_label = "ready-for-agent" in labels

    if is_ready_label or (has_acceptance and "open questions" not in body.lower()):
        return {
            "flow": "Main Flow: Ready Implementation",
            "primary_skill": "/implement",
            "skills_chain": ["/implement", "/tdd", "/code-review", "/pr"],
            "rationale": "Scope and acceptance seeds are fully defined. Work is unblocked and ready for immediate test-driven coding.",
            "first_step": "Open a fresh session in the target repo and run `/implement` (drives `/tdd`, `/code-review`, `/pr`).",
        }

    # Rule 5: Needs grooming / sharpening idea
    return {
        "flow": "Main Flow: Idea Sharpening & Requirements",
        "primary_skill": "/grill-with-docs",
        "skills_chain": ["/grill-with-docs", "/to-spec", "/to-tickets", "/implement"],
        "rationale": "Issue has open questions or needs requirements sharpening. Conduct a stateful interview to update GLOSSARY.md and ADRs.",
        "first_step": "Run `/grill-with-docs` to interview and settle open architectural/business questions.",
    }


def summarize_issue(issue: Dict[str, Any]) -> str:
    body = issue.get("body", "")
    lines = body.splitlines()

    goal_lines = []
    scope_lines = []
    in_goal = False
    in_scope = False

    for line in lines:
        line_clean = line.strip()
        if re.match(r"^##+\s+Goal", line_clean, re.I):
            in_goal = True
            in_scope = False
            continue
        elif re.match(r"^##+\s+Scope", line_clean, re.I):
            in_goal = False
            in_scope = True
            continue
        elif re.match(r"^##+\s+", line_clean):
            in_goal = False
            in_scope = False
            continue

        if in_goal and line_clean:
            goal_lines.append(line_clean)
        elif in_scope and line_clean:
            scope_lines.append(line_clean)

    summary = ""
    if goal_lines:
        summary += "Goal: " + " ".join(goal_lines[:2]) + "\n"
    if scope_lines:
        summary += "Key Scope:\n  " + "\n  ".join(scope_lines[:4])

    if not summary:
        non_empty = [l.strip() for l in lines if l.strip() and not l.startswith(">") and not l.startswith("#")]
        summary = " ".join(non_empty[:3])

    return summary.strip()


def pick_issue(
    repos: List[str],
    active_threads: List[Dict[str, Any]],
    output_json: bool = False,
) -> None:
    all_candidates = []
    status_cache: Dict[str, bool] = {}

    for repo in repos:
        code, stdout, stderr = run_command([
            "gh", "issue", "list", "--repo", repo, "--state", "open", "--limit", "50",
            "--json", "number,title,labels,body,url,createdAt,updatedAt"
        ])
        if code != 0:
            continue
        try:
            issues = json.loads(stdout)
        except Exception:
            continue

        for issue in issues:
            num = issue["number"]
            title = issue["title"]

            # 1. Check if handled by active T3 session
            is_handled, thread_title = check_is_handled_by_t3(repo, num, title, active_threads)

            # 2. Check blockers
            details = get_issue_details(repo, num)
            is_blocked, reasons = check_is_blocked(repo, issue, details, status_cache)

            route = route_ask_matt(issue, details)

            candidate = {
                "repo": repo,
                "number": num,
                "title": title,
                "url": issue.get("url"),
                "labels": [l.get("name") for l in issue.get("labels", [])],
                "created_at": issue.get("createdAt"),
                "is_handled": is_handled,
                "handled_by": thread_title,
                "is_blocked": is_blocked,
                "blocked_reasons": reasons,
                "blocking": details.get("blocking", []),
                "ask_matt": route,
                "summary": summarize_issue(issue),
            }
            all_candidates.append(candidate)

    # Filter unblocked and not handled
    ready_candidates = [
        c for c in all_candidates
        if not c["is_blocked"] and not c["is_handled"]
    ]

    # Prioritize:
    # 1. Issues that unblock others (descending by number of blocking issues)
    # 2. Issues labeled 'ready-for-agent'
    # 3. Oldest first (FIFO)
    ready_candidates.sort(
        key=lambda c: (
            -len(c["blocking"]),
            0 if "ready-for-agent" in c["labels"] else 1,
            c["created_at"] or "",
        )
    )

    if output_json:
        result = {
            "picked": ready_candidates[0] if ready_candidates else None,
            "ready_candidates": ready_candidates,
            "total_open": len(all_candidates),
            "blocked_count": sum(1 for c in all_candidates if c["is_blocked"]),
            "handled_count": sum(1 for c in all_candidates if c["is_handled"]),
        }
        print(json.dumps(result, indent=2))
        return

    # Text UI Output
    print("=" * 70)
    print("🎯 Trajectonomics Lab Issue Picker")
    print("=" * 70)
    print(f"Scanned {len(repos)} repositories: {', '.join(repos)}")
    print(f"Active T3 Code threads monitored: {len(active_threads)}")
    print(f"Total open issues: {len(all_candidates)}")
    print(f"Blocked issues: {sum(1 for c in all_candidates if c['is_blocked'])}")
    print(f"Actively handled in T3 Code: {sum(1 for c in all_candidates if c['is_handled'])}")
    print(f"Ready candidates: {len(ready_candidates)}")
    print("=" * 70)

    if not ready_candidates:
        print("\n⚠️  No unblocked, unhandled issues found to pick!")
        if all_candidates:
            print("\nStatus of current open issues:")
            for c in all_candidates:
                status_str = []
                if c["is_handled"]:
                    status_str.append(f"HANDLED by '{c['handled_by']}'")
                if c["is_blocked"]:
                    status_str.append(f"BLOCKED: {'; '.join(c['blocked_reasons'])}")
                print(f"- {c['repo']}#{c['number']}: {c['title']} [{', '.join(status_str)}]")
        return

    picked = ready_candidates[0]
    print("\n🌟 Recommended Next Issue to Work On:")
    print(f"  Repository: {picked['repo']}")
    print(f"  Issue:      #{picked['number']} - {picked['title']}")
    print(f"  URL:        {picked['url']}")
    if picked["labels"]:
        print(f"  Labels:     {', '.join(picked['labels'])}")
    if picked["blocking"]:
        print(f"  Unblocks:   {', '.join(picked['blocking'])} (High leverage!)")

    print("\n📋 Executive Summary:")
    for line in picked["summary"].splitlines():
        print(f"  {line}")

    matt = picked["ask_matt"]
    print("\n🧭 Ask-Matt Recommendation:")
    print(f"  Recommended Flow:   {matt['flow']}")
    print(f"  Primary Skill:      {matt['primary_skill']}")
    print(f"  Skills Sequence:    {' → '.join(matt['skills_chain'])}")
    print(f"  Rationale:          {matt['rationale']}")
    print(f"\n🚀 Next Steps & Commands:")
    print(f"  {matt['first_step']}")
    print(f"  Repo directory:     /home/prame/Project/Excited.live-org/{picked['repo'].split('/')[-1]}")
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(description="Pick the next unblocked, unhandled GitHub issue")
    parser.add_argument("--repo", help="Target repository (e.g. trajectonomics-lab/ledger-core)")
    parser.add_argument("--org", default="trajectonomics-lab", help="Target organization (default: trajectonomics-lab)")
    parser.add_argument("--all-org", action="store_true", help="Scan all repositories in the organization")
    parser.add_argument("--active-threads", nargs="*", help="List of active thread titles to consider handled")
    parser.add_argument("--json", action="store_true", help="Output results in JSON format")

    args = parser.parse_args()

    repos = []
    if args.repo:
        repos = [args.repo]
    elif args.all_org:
        repos = get_org_repos(args.org)
    else:
        current = get_current_repo()
        if current and args.org in current:
            repos = [current]
        else:
            repos = get_org_repos(args.org)
            if not repos:
                repos = [
                    f"{args.org}/tax-core",
                    f"{args.org}/sim-core",
                    f"{args.org}/ledger-core",
                    f"{args.org}/cli",
                ]

    active_threads = get_active_t3_threads(args.active_threads)
    pick_issue(repos, active_threads, output_json=args.json)


if __name__ == "__main__":
    main()
