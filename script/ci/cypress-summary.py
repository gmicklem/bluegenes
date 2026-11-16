#!/usr/bin/env python3
"""Totals of a Cypress run from its JUnit files, as Markdown for a job summary.

    python3 -I script/ci/cypress-summary.py cypress/results "Title" >> "$GITHUB_STEP_SUMMARY"

Reads every *.xml in the directory (cypress.config.js writes one per spec,
cypress/results/output-<hash>.xml) and counts the <testcase> elements: failed
(a <failure> or <error> child), skipped (<skipped>) and passed (the rest). Prints
a totals table, one row per spec file, and the failed tests with the first line
of their error. Exits 1 when there are no test cases at all (a run that never
started must not look green in the summary); the pass/fail verdict itself is the
Cypress step's.
"""
import glob
import os
import sys
import xml.etree.ElementTree as ET


def spec_of(root):
    # mocha-junit-reporter puts the spec path on the root suite ("Root Suite", file=...)
    for suite in root.iter("testsuite"):
        if suite.get("file"):
            return suite.get("file")
    return "?"


def main(results_dir, title):
    rows, failed_names = [], []
    total = {"tests": 0, "passed": 0, "failed": 0, "skipped": 0}
    for path in sorted(glob.glob(os.path.join(results_dir, "*.xml"))):
        root = ET.parse(path).getroot()
        n = {"tests": 0, "passed": 0, "failed": 0, "skipped": 0}
        for case in root.iter("testcase"):
            n["tests"] += 1
            bad = case.find("failure")
            if bad is None:
                bad = case.find("error")
            if bad is not None:
                n["failed"] += 1
                message = (bad.get("message") or bad.text or "").strip().splitlines()
                message = message[0][:300] if message else ""
                failed_names.append(f"{spec_of(root)}: {case.get('name')}" + (f" -- {message}" if message else ""))
            elif case.find("skipped") is not None:
                n["skipped"] += 1
            else:
                n["passed"] += 1
        rows.append((spec_of(root), n))
        for k in total:
            total[k] += n[k]

    print(f"### {title}\n")
    print("| tests | passed | failed | skipped | spec files |")
    print("|---:|---:|---:|---:|---:|")
    print(f"| {total['tests']} | {total['passed']} | {total['failed']} | {total['skipped']} | {len(rows)} |\n")
    if failed_names:
        print("Failed:\n")
        for name in failed_names:
            print(f"- {name}")
        print()
    if rows:
        print("<details><summary>Per spec</summary>\n")
        print("| spec | passed | failed | skipped |")
        print("|---|---:|---:|---:|")
        for spec, n in sorted(rows):
            print(f"| `{spec}` | {n['passed']} | {n['failed']} | {n['skipped']} |")
        print("\n</details>\n")
    if total["tests"] == 0:
        print(f"No test results in `{results_dir}`.\n")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "Cypress"))
