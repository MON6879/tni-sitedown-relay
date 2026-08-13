# Backup Context v515 - Workflow Dispatch Force Execution Rule Verification

> **Timestamp:** 13/08/2026 12:14 MMT  
> **Version:** v515  
> **Target:** Verify workflow_dispatch manual execution equivalence to Run Workflow button click  

---

## 🎯 System Fixes & Improvements (v515)

1. **Workflow Dispatch Equivalence Verification**:
   - Analyzed `api/trigger_workflow.py` and GitHub Actions REST API `dispatches` endpoint.
   - Calling `POST https://api.github.com/repos/phonghdpxd-cmd/tni-bot/actions/workflows/train_5min.yml/dispatches` with PAT Token is **100% IDENTICAL to pressing the "Run workflow" button** in GitHub UI.
   - Bypasses all scheduled cron runner queue delays and executes immediately within 1-3 seconds.

2. **Force Execution Flag Added**:
   - Added `FORCE_RUN: '1'` and `--force` argument to `.github/workflows/train_5min.yml` and `botlookup_relay.yml` when triggered via `workflow_dispatch`.
   - When manually dispatched, Site Down Relay executes instantly without checking minute window restrictions.
