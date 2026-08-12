# Backup Context v475 - 5-Seat Exact Col D Matrix & Fixed 10-Member Non-Cutting Chunking

> **Timestamp:** 13/08/2026 04:49 MMT  
> **Version:** v475  
> **Target:** Preserve 100% exact Col D content from Google Sheet (no chopping/parsing), implement 5-Seat matrix, and chunk messages strictly after every 10 complete member blocks without cutting any person in half  

---

## 🎯 Architectural Principles & Implementation (v475)

1. **Safety of Deleting `A62:E200` in Google Sheet**:
   - Confirmed 100% safe.
   - Rows 1-56 contain all team metrics and target percentages. Rows 62-200 are empty/legacy. Deleting A62:E200 reduces sheet weight without affecting BI Portal or Python execution.

2. **100% Unmodified Col D Content (Top-to-Bottom)**:
   - Completely disabled regex n-line metric chopping (`parse_emp_metrics`).
   - Every staff member's Col D content is output 100% verbatim from top to bottom as written in Google Sheet `Team All Find` (`Sum all WO Team`, GID `133591305`).

3. **5-Seat Report Matrix**:
   - **Seat 1**: Team 1 Dawei Group (`📋 4. Report — Daily EOD Task & Stats — Team 1 Dawei`)
   - **Seat 2**: Team 2 Myeik Group (`📋 4. Report — Daily EOD Task & Stats — Team 2 Myeik`)
   - **Seat 3**: Team 3 Bokpyin Group (`📋 4. Report — Daily EOD Task & Stats — Team 3 Bokpyin`)
   - **Seat 4**: Team 4 Kawthoung Group (`📋 4. Report — Daily EOD Task & Stats — Team 4 Kawthoung`)
   - **Seat 5**: Control Site Group (`📋 4. Report — Daily EOD Task & Stats — Control Site Summary`)
   - **Standalone Seat 3.1**: Asset 3.1 (`📦 3.1 Report — Asset progress for material`) with 8-color square emojis (`🟦🟨🟩🟧🟥🟫🟪⬜`).

4. **Fixed Member Chunking (10 Members / Message, Never Cut Mid-Person)**:
   - Chunk boundary is set to **10 complete member blocks** (`MEMBERS_PER_CHUNK = 10`) or max 3,000 chars.
   - Message parts are cleanly numbered: `(Phần 1/2)`, `(Phần 2/2)`.
   - Never splits mid-person/mid-sentence; always splits cleanly after the member divider (`────────────────────`).
