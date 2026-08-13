# Backup Context v502 - Smart 2-Stage Retry & Automatic Bot Recovery Mechanism

> **Timestamp:** 13/08/2026 07:58 MMT  
> **Version:** v502  
> **Target:** Eliminate data loss due to slow/delayed company bot (@auto_nocpro_bot) replies using 2-Stage Smart Retry  

---

## 🎯 System Fixes & Improvements (v502)

1. **Root Cause Diagnosis**:
   - On August 11th and during delayed periods, company bot `@auto_nocpro_bot` took longer than 15s to reply (or was temporarily down).
   - In older versions, script timed out after 15s before `@auto_nocpro_bot` returned output, resulting in empty data and skipped Sheet insertion.

2. **Smart 2-Stage Retry Mechanism**:
   - Stage 1: Waits `25s` for immediate reply.
   - Stage 2 (Smart Retry): If no reply yet after Stage 1, waits an extra `10s` and re-scans `BOT LOOKUP` chat history.
   - Captures late responses up to 35s, posts to `store_site_down` on Apps Script, writes to Sheet Row 1, and relays to all 4 Team groups.
