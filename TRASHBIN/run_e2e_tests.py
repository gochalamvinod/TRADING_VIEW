#!/usr/bin/env python3
"""
Unified 4-Tier Automated Test Suite Runner
MetaTrader 5 Backend & TradingView Advanced Charts
"""

import sys
import os
import io
import time
import argparse
import pytest
from datetime import datetime, timezone

# Ensure stdout handles unicode if possible
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.dirname(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# ANSI Color Codes for terminal formatting
class Colors:
    HEADER = "\033[95m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BOLD = "\033[1m"
    UNDERLINE = "\033[4m"
    RESET = "\033[0m"


TIER_CONFIG = {
    1: {
        "name": "Tier 1: Feature Coverage (F1-F13)",
        "file": "tests/test_tier1_feature_coverage.py",
        "min_tests": 65,
        "description": "Direct isolated requirement & feature verification (5 tests x 13 features)"
    },
    2: {
        "name": "Tier 2: Boundary Value & Negative Cases",
        "file": "tests/test_tier2_boundary_corner.py",
        "min_tests": 65,
        "description": "Limits, bad parameters, missing params, malformed Pine code, and anomalies"
    },
    3: {
        "name": "Tier 3: Pairwise Cross-Feature Interactions",
        "file": "tests/test_tier3_cross_feature.py",
        "min_tests": 15,
        "description": "Combinatorial interactions between symbols, resolutions, storage, and runtime"
    },
    4: {
        "name": "Tier 4: End-to-End Real-World Workloads",
        "file": "tests/test_tier4_workloads.py",
        "min_tests": 7,
        "description": "Full multi-step user workflows (Scalper, Swing, Custom Indicator, Dashboard)"
    },
    6: {
        "name": "Tier 6: R1-R4 Comprehensive Verification",
        "file": "tests/test_tier6_r1_to_r4.py",
        "min_tests": 20,
        "description": "Custom sec/ticks, HFT latency <10ms, WS push, MT5 trade API & IPC concurrency"
    },
    7: {
        "name": "Tier 7: HFT Clock Sync, Countdown & Zero-Overhead Suite",
        "file": "tests/test_hft_clock_countdown_suite.py",
        "min_tests": 20,
        "description": "Sub-1ms clock sync, smooth monotonic countdown, <500µs trade gateway & async inspection"
    },
    8: {
        "name": "Tier 8: Live P&L Parity & Adversarial Suite",
        "file": "tests/test_pl_sync_adversarial.py",
        "min_tests": 38,
        "description": "Cross-surface P&L parity, Security Info completeness, DOM dynamic pinning & -ve/+ve grading"
    }
}


class TierResultCollector:
    """Pytest plugin to accurately collect test statistics."""
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.skipped = 0
        self.errors = 0
        self.reports = []

    def pytest_runtest_logreport(self, report):
        if report.when == "call":
            if report.passed:
                self.passed += 1
            elif report.failed:
                self.failed += 1
                self.reports.append(report)
            elif report.skipped:
                self.skipped += 1
        elif report.failed and report.when in ("setup", "teardown"):
            self.errors += 1
            self.reports.append(report)


def print_banner():
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ")
    print(f"\n{Colors.BOLD}{Colors.CYAN}" + "=" * 80 + f"{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}   MetaTrader 5 Backend & TradingView Advanced Charts -- Test Suite Runner{Colors.RESET}")
    print(f"{Colors.CYAN}   Unified 4-Tier Automated Test Verification Harness{Colors.RESET}")
    print(f"{Colors.CYAN}   Timestamp: {now_str}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}" + "=" * 80 + f"{Colors.RESET}\n", flush=True)


def run_tier(tier_num: int, verbose: bool = False):
    config = TIER_CONFIG[tier_num]
    test_file = os.path.join(PROJECT_ROOT, config["file"])

    print(f"{Colors.BOLD}{Colors.BLUE}[>] Running {config['name']}{Colors.RESET}")
    print(f"  {Colors.YELLOW}{config['description']}{Colors.RESET}")
    print(f"  Target File: {config['file']}", flush=True)

    if not os.path.exists(test_file):
        print(f"  {Colors.RED}[x] Error: Test file {config['file']} not found!{Colors.RESET}\n", flush=True)
        return {"passed": 0, "failed": 1, "errors": 0, "skipped": 0, "total": 0, "duration": 0.0, "exit_code": 1}

    collector = TierResultCollector()
    pytest_args = [
        test_file,
        "-v" if verbose else "-q",
        "--tb=short"
    ]

    t0 = time.perf_counter()
    exit_code = pytest.main(pytest_args, plugins=[collector])
    duration = time.perf_counter() - t0

    total = collector.passed + collector.failed + collector.errors + collector.skipped
    status_icon = f"{Colors.GREEN}[PASS]{Colors.RESET}" if exit_code == 0 else f"{Colors.RED}[FAIL]{Colors.RESET}"
    print(f"  Status: {status_icon} | Total: {total} | Passed: {collector.passed} | Failed: {collector.failed} | Errors: {collector.errors} | Time: {duration:.2f}s\n", flush=True)

    return {
        "passed": collector.passed,
        "failed": collector.failed,
        "errors": collector.errors,
        "skipped": collector.skipped,
        "total": total,
        "duration": duration,
        "exit_code": exit_code
    }


def main():
    parser = argparse.ArgumentParser(description="Run Unified Multi-Tier Automated Test Suite")
    parser.add_argument("--tier", type=int, choices=[1, 2, 3, 4, 6, 7, 8], help="Run specific tier only")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose pytest output")
    args = parser.parse_args()

    print_banner()

    tiers_to_run = [args.tier] if args.tier else [1, 2, 3, 4, 6, 7, 8]
    results = {}
    overall_start = time.perf_counter()

    for t in tiers_to_run:
        results[t] = run_tier(t, verbose=args.verbose)

    overall_duration = time.perf_counter() - overall_start

    # Final Summary Table
    print(f"{Colors.BOLD}{Colors.CYAN}" + "=" * 80 + f"{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}                           FINAL TEST SUITE SUMMARY{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}" + "=" * 80 + f"{Colors.RESET}")
    print(f"{'Tier':<10} | {'Description':<32} | {'Target':<6} | {'Run':<5} | {'Pass':<5} | {'Fail':<5} | {'Time':<7}")
    print("-" * 80)

    total_run = 0
    total_passed = 0
    total_failed = 0
    any_failures = False

    for t in [1, 2, 3, 4, 6, 7, 8]:
        if t in results:
            r = results[t]
            cfg = TIER_CONFIG[t]
            t_name = f"Tier {t}"
            t_desc = cfg["name"][:32]
            target = cfg["min_tests"]
            run_cnt = r["total"]
            p_cnt = r["passed"]
            f_cnt = r["failed"] + r["errors"]
            t_time = f"{r['duration']:.2f}s"

            total_run += run_cnt
            total_passed += p_cnt
            total_failed += f_cnt
            if r["exit_code"] != 0:
                any_failures = True

            color = Colors.GREEN if r["exit_code"] == 0 else Colors.RED
            print(f"{color}{t_name:<10} | {t_desc:<32} | {target:<6} | {run_cnt:<5} | {p_cnt:<5} | {f_cnt:<5} | {t_time:<7}{Colors.RESET}")

    print("-" * 80)
    summary_color = Colors.GREEN if not any_failures else Colors.RED
    print(f"{summary_color}{Colors.BOLD}{'TOTAL':<10} | {'All Tiers Combined':<32} | {'>=240':<6} | {total_run:<5} | {total_passed:<5} | {total_failed:<5} | {overall_duration:.2f}s{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}" + "=" * 80 + f"{Colors.RESET}\n", flush=True)

    if not any_failures and total_run >= 240:
        print(f"{Colors.BOLD}{Colors.GREEN}[+] ALL TEST SUITES PASSED CLEANLY! Ready for Milestones Verification.{Colors.RESET}\n")
        return 0
    elif not any_failures:
        print(f"{Colors.BOLD}{Colors.YELLOW}[!] Tests passed, but total executed ({total_run}) is less than minimum requirement (240).{Colors.RESET}\n")
        return 0
    else:
        print(f"{Colors.BOLD}{Colors.RED}[x] Failures detected in test suite execution. Check details above.{Colors.RESET}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
