// ============================================================
// TNI Site Down Auto-Notification — v4 CLEAN
// ============================================================
// Chỉ làm 2 việc:
//   Tin 1: Poll Telegram → phát hiện báo cáo site down → ghi Col A → gửi Col C
//   Tin 2: AW7 timestamp thay đổi → gửi SUMMARY (AW7:AZ15) vào tất cả groups
//
// Trigger: checkAndSend() mỗi 5 phút (24/7 — không giới hạn giờ)
// Setup:   Chạy setupSdTrigger() 1 lần từ Apps Script Editor
// ============================================================
// ── Bot token (set trong Script Properties: SD_BOT_TOKEN) ──
const SD_BOT_TOKEN = PropertiesService.getScriptProperties().getProperty("SD_BOT_TOKEN") || "";
// ── Group Chat IDs ──────────────────────────────────────────
// T1-T4 đã migrate sang supergroup (Channel) — trong Bot API cần prefix "-100"
const SD_GROUPS = {
  T1:      "-1004215695747",  // TNI TEAM 1 (Dawei)
  T2:      "-1004480845549",  // TNI TEAM 2 (Myeik + Team5)
  T3:      "-1004369170658",  // TNI TEAM 3 (Bokpyin)
  T4:      "-1004293741999",  // TNI TEAM 4 (Kawthoung)
  CONTROL: "-5251698940",     // TNI TECHNICA DEP CONTROL SITE (Chat thường)
};
// ── Cá nhân nhận Tin 2 (DM) ────────────────────────────────
const SD_PERSONAL_IDS = [
  "6859790680",   // Ha Duc Phong
];
// ── Sheet ───────────────────────────────────────────────────
const SD_SHEET_ID  = "1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow";
const SD_SHEET_GID = "0";
// ── PropertiesService keys ──────────────────────────────────
const TS_KEY_A1      = "SD_LAST_TS_A1";    // dedup Tin 1
const TS_KEY_AW7     = "SD_LAST_TS_AW7";   // dedup Tin 2
const LAST_UPDATE_KEY = "SD_LAST_UPDATE_ID"; // offset Telegram polling
// ── AW:AZ column mapping (0-based, AW=T1, AX=T2, AY=T3, AZ=T4) ──
const AWAZ_COL = { T1: 0, T2: 1, T3: 2, T4: 3 };
// ── AW:AZ row labels (rows 7–11 = 5 metrics) ────────────────
const AWAZ_LABELS = [
  { emoji: "⚡", name: "Site down"   },
  { emoji: "🔴", name: "Cell down"   },
  { emoji: "⚙️", name: "DG Abnormal" },
  { emoji: "⏱️", name: "DG Run>16H"  },
  { emoji: "🔗", name: "Link down"   },
];
// ── Team colors ─────────────────────────────────────────────
const TEAM_COLORS = { T1: "🔵", T2: "🟡", T3: "🟢", T4: "🔴" };
// ============================================================
// WEB APP — doPost() nhận data từ botlookup_relay.py
// Deploy: Extensions → Deploy → New deployment → Web App
//   Execute as: Me | Who has access: Anyone
// Actions:
//   store_site_down  → ghi text vào Col A (từng dòng = 1 ô)
//   get_note_b2b5    → đọc B2:B5 (Note gửi bằng @Phongha79)
//   save_note_msgids → lưu message IDs của Note vào Properties
//   get_note_msgids  → đọc message IDs đã lưu
// ============================================================
function doPost(e) {
  try {
    const data   = JSON.parse(e.postData.contents);
    const action = data.action || "";
    if (action === "store_site_down") {
      // Ghi text từ botlookup_relay vào Col A (mỗi dòng = 1 ô)
      const text  = (data.text || "").trim();
      const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
      const sheet = getSheetByGid(ss, SD_SHEET_GID);
      if (!sheet) return _json({ ok: false, msg: "Sheet not found" });
      // Xóa Col A cũ
      const lastRow = Math.max(sheet.getLastRow(), 1);
      sheet.getRange(1, 1, lastRow, 1).clearContent();
      // Ghi từng dòng vào Col A (A1, A2, A3, ...)
      const lines = text.split("\n");
      if (lines.length > 0) {
        const values = lines.map(l => [l]);
        sheet.getRange(1, 1, values.length, 1).setValues(values);
      }
      Logger.log("[doPost] store_site_down — " + lines.length + " dòng ghi vào Col A");
      // Reset dedup key Tin 1 để checkAndSend() gửi ngay khi trigger tiếp theo
      PropertiesService.getScriptProperties().deleteProperty(TS_KEY_A1);
      SpreadsheetApp.flush();
      Utilities.sleep(10000); // Chờ công thức Cột C và AW7:AZ15 cập nhật hoàn toàn
      var checkResult = { sent_tin1: false, sent_tin2: false };
      try {
        var r = checkAndSend(true);
        if (r && typeof r === "object") {
          checkResult = r;
        }
        Logger.log("[doPost] checkAndSend() xong. Result: " + JSON.stringify(checkResult));
      } catch(callErr) {
        Logger.log("[doPost] ⚠️ checkAndSend() lỗi: " + callErr.message);
      }
      return _json({ 
        ok: true, 
        lines: lines.length,
        sent_tin1: !!checkResult.sent_tin1,
        sent_tin2: !!checkResult.sent_tin2
      });
    }
    if (action === "get_note_b2b5") {
      const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
      const sheet = getSheetByGid(ss, SD_SHEET_GID);
      if (!sheet) return _json({ ok: false, msg: "Sheet not found" });
      const vals = sheet.getRange("B2:B5").getValues();
      const note = vals.map(r => (r[0] || "").toString().trim()).filter(v => v).join("\n");
      return ContentService.createTextOutput(note).setMimeType(ContentService.MimeType.TEXT);
    }
    if (action === "save_note_msgids") {
      const msgids = data.msgids || {};
      PropertiesService.getScriptProperties().setProperty("SD_NOTE_MSGIDS", JSON.stringify(msgids));
      return _json({ ok: true });
    }
    if (action === "get_note_msgids") {
      const raw    = PropertiesService.getScriptProperties().getProperty("SD_NOTE_MSGIDS") || "{}";
      const msgids = JSON.parse(raw);
      return _json({ ok: true, msgids: msgids });
    }
    return _json({ ok: false, msg: "Unknown action: " + action });
  } catch (err) {
    return _json({ ok: false, msg: err.message });
  }
}
function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) || "";
    if (action === "get_note_b2b5") {
      const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
      const sheet = getSheetByGid(ss, SD_SHEET_GID);
      if (!sheet) return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
      const vals = sheet.getRange("B2:B5").getValues();
      const note = vals.map(r => (r[0] || "").toString().trim()).filter(v => v).join("\n");
      return ContentService.createTextOutput(note).setMimeType(ContentService.MimeType.TEXT);
    }
    if (action === "get_note_msgids") {
      const raw    = PropertiesService.getScriptProperties().getProperty("SD_NOTE_MSGIDS") || "{}";
      const msgids = JSON.parse(raw);
      return _json({ ok: true, msgids: msgids });
    }
    return _json({ ok: false, msg: "Unknown GET action: " + action });
  } catch (err) {
    return _json({ ok: false, msg: err.message });
  }
}
function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
// ============================================================
// ENTRY POINT — trigger 1 phút, chỉ chạy đúng phút :01 và :31
// Lịch: 03:01 → 03:31 → 04:01 → 04:31 → ... → 21:01 → 21:31
// ============================================================
function checkAndSend(isWebhookCall) {
  const now    = new Date();
  const mytime = Utilities.formatDate(now, "Asia/Rangoon", "H:mm");
  const hour   = parseInt(Utilities.formatDate(now, "Asia/Rangoon", "H"), 10);
  const minute = parseInt(Utilities.formatDate(now, "Asia/Rangoon", "m"), 10);
  // ── Kiểm tra thời gian nếu không phải là Webhook call ──
  const props = PropertiesService.getScriptProperties();
  if (isWebhookCall !== true) {
    if (minute !== 8 && minute !== 38) return { sent_tin1: false, sent_tin2: false };
    if (hour < 3 || hour > 22) return { sent_tin1: false, sent_tin2: false };
    if (hour === 3 && minute < 38) return { sent_tin1: false, sent_tin2: false };   // 03:38 là sớm nhất
    if (hour === 22 && minute > 8) return { sent_tin1: false, sent_tin2: false };  // 22:08 là muộn nhất
    // ── Chống chạy 2 lần trong cùng phút (chỉ áp dụng cho time trigger) ──
    const doneKey = "SD_DONE_" + Utilities.formatDate(now, "Asia/Rangoon", "yyyyMMddHHmm");
    if (props.getProperty(doneKey)) {
      Logger.log("⏭️ " + mytime + " Myanmar — đã chạy rồi, bỏ qua.");
      return { sent_tin1: false, sent_tin2: false };
    }
    props.setProperty(doneKey, "1");
  }
  Logger.log("✅ checkAndSend — " + mytime + " Myanmar" + (isWebhookCall === true ? " (Webhook)" : ""));
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log("⏭️ Lock bận — bỏ qua");
    return { sent_tin1: false, sent_tin2: false };
  }
  try {
    const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
    const sheet = getSheetByGid(ss, SD_SHEET_GID);
    if (!sheet) { Logger.log("❌ Không tìm thấy sheet GID=" + SD_SHEET_GID); return { sent_tin1: false, sent_tin2: false }; }
    // Bước 1: Dispatch botlookup_relay → gửi lệnh lấy data từ BOT LOOKUP
    //   botlookup_relay.py sẽ: gửi /down_tni → đọc kết quả → ghi Col A + Note B2:B5
    if (isWebhookCall !== true) {
      triggerBotlookupRelay();
    }
    // Bước 2: Kiểm tra và gửi (data được botlookup_relay ghi từ lần trước)
    const sentTin1 = checkColC(sheet);   // Tin 1: A1 thay đổi → gửi Col C vào T1/T2/T3/T4 + CONTROL
    const sentTin2 = checkAwAz(sheet);   // Tin 2: AW7 thay đổi → gửi SUMMARY vào T1/T2/T3/T4 + CONTROL
    return { sent_tin1: sentTin1, sent_tin2: sentTin2 };
  } catch(e) {
    Logger.log("❌ checkAndSend error: " + e.message);
    return { sent_tin1: false, sent_tin2: false };
  } finally {
    lock.releaseLock();
  }
}
// ============================================================
// DISPATCH botlookup_relay → GitHub Actions
// botlookup_relay.py sẽ:
//   1. Gửi /down_tni@auto_nocpro_bot vào BOT LOOKUP group
//   2. Đọc kết quả từ Auto Report NocPro bot
//   3. Ghi dữ liệu vào Col A của sheet
//   4. Gửi Note B2:B5 bằng tài khoản @Phongha79
// Kết quả sẽ có sau ~2–3 phút → trigger tiếp theo sẽ gửi Tin 1
// ============================================================
function triggerBotlookupRelay() {
  const pat   = PropertiesService.getScriptProperties().getProperty("GITHUB_PAT") || "";
  const owner = "phonghdpxd-cmd";
  const repo  = "TNI-SITE-DOWN";
  if (!pat) { Logger.log("[Relay] ⚠️ GITHUB_PAT chưa set — bỏ qua dispatch"); return; }
  try {
    const url  = "https://api.github.com/repos/" + owner + "/" + repo + "/actions/workflows/botlookup_relay.yml/dispatches";
    const resp = UrlFetchApp.fetch(url, {
      method:  "post",
      headers: {
        "Authorization": "token " + pat,
        "Accept":        "application/vnd.github.v3+json",
      },
      contentType:        "application/json",
      payload:            JSON.stringify({ ref: "main", inputs: { skip_delay: "1" } }),
      muteHttpExceptions: true,
    });
    const code = resp.getResponseCode();
    if (code === 204) {
      Logger.log("[Relay] ✅ Dispatched botlookup_relay → GitHub Actions");
    } else {
      Logger.log("[Relay] ⚠️ HTTP " + code + ": " + resp.getContentText().substring(0, 200));
    }
  } catch(e) {
    Logger.log("[Relay] ❌ " + e.message);
  }
}
// ============================================================
// BƯỚC 1: POLL TELEGRAM — lấy tin mới từ CONTROL group
// ============================================================
function fetchTelegramUpdates(sheet) {
  if (!SD_BOT_TOKEN) { Logger.log("[Poll] ❌ SD_BOT_TOKEN chưa set"); return false; }
  const props       = PropertiesService.getScriptProperties();
  const lastId      = parseInt(props.getProperty(LAST_UPDATE_KEY) || "0");
  const offsetToUse = lastId === 0 ? 0 : lastId + 1;
  const url         = "https://api.telegram.org/bot" + SD_BOT_TOKEN
                    + "/getUpdates?offset=" + offsetToUse
                    + "&limit=100&allowed_updates=message,channel_post";
  let data;
  try {
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    data = JSON.parse(resp.getContentText());
  } catch(e) {
    Logger.log("[Poll] ❌ getUpdates lỗi: " + e.message);
    return false;
  }
  if (!data.ok) {
    Logger.log("[Poll] ❌ Telegram: " + data.description);
    return false;
  }
  const updates = data.result || [];
  if (updates.length === 0) { Logger.log("[Poll] Không có tin mới"); return false; }
  let maxId         = lastId;
  let latestReport  = null;
  for (const upd of updates) {
    if (upd.update_id > maxId) maxId = upd.update_id;
    const msg = upd.message || upd.channel_post;
    if (!msg) continue;
    const chatId = msg.chat.id.toString();
    if (chatId !== SD_GROUPS.CONTROL) continue;
    const text = (msg.text || msg.caption || "").trim();
    if (!isSiteDownReport(text)) continue;
    latestReport = text;
    Logger.log("[Poll] ✅ Phát hiện báo cáo: " + text.substring(0, 60));
  }
  props.setProperty(LAST_UPDATE_KEY, maxId.toString());
  Logger.log("[Poll] Xử lý " + updates.length + " updates, maxId=" + maxId);
  if (latestReport) {
    writeToColumnA(sheet, latestReport);
    // Xóa dedup key → ép Tin 1 gửi ngay dù A1 key có thể giống cũ
    props.deleteProperty(TS_KEY_A1);
    SpreadsheetApp.flush();
    Utilities.sleep(3000);  // chờ công thức Col C cập nhật
    return true;
  }
  return false;
}
// ── Kiểm tra có phải báo cáo site down không ────────────────
function isSiteDownReport(text) {
  if (!text) return false;
  if (text.startsWith("📋")) return false;  // bỏ qua báo cáo bot
  return /site down/i.test(text)
      && (/tanintharyi/i.test(text) || /\bTNI\b/.test(text) || /TNI\d{4}/.test(text))
      && /\d{2}\/\d{2}\/\d{4}/i.test(text);
}
// ── Ghi nội dung báo cáo vào Col A (xóa cũ, ghi mới) ───────
function writeToColumnA(sheet, text) {
  const lines     = text.split("\n");
  const lastRow   = sheet.getLastRow();
  if (lastRow > 0) sheet.getRange(1, 1, lastRow, 1).clearContent();
  const writeData = lines.map(l => [l]);
  if (writeData.length > 0) sheet.getRange(1, 1, writeData.length, 1).setValues(writeData);
  Logger.log("📝 Đã ghi " + writeData.length + " dòng vào Col A");
}
// ============================================================
// TIN 1 — Col C: danh sách site chi tiết
// Gửi khi A1 thay đổi
// ============================================================
function checkColC(sheet) {
  const raw = sheet.getRange("A1").getValue().toString().trim();
  if (!raw) { Logger.log("[Tin1] A1 rỗng — bỏ qua"); return false; }
  const ts1     = parseA1Timestamp(sheet);
  const storeKey = ts1 ? (ts1 + "|" + raw.substring(0, 60)) : raw.substring(0, 200);
  const props   = PropertiesService.getScriptProperties();
  const lastKey = props.getProperty(TS_KEY_A1) || "";
  if (storeKey === lastKey) {
    Logger.log("[Tin1] A1 không đổi (" + storeKey.substring(0, 40) + ") — bỏ qua");
    return false;
  }
  Logger.log("[Tin1] 🆕 A1 thay đổi → gửi Col C...");
  const colCRaw = readColCRaw(sheet);
  if (!colCRaw) { Logger.log("[Tin1] Col C trống — bỏ qua"); return false; }
  // ① CONTROL: toàn bộ Col C (có tô màu team, bỏ dòng tổng hợp Team X: cho đỡ dài)
  const controlId = SD_GROUPS["CONTROL"];
  if (controlId) {
    try {
      const linesControl = colCRaw.split("\n").filter(l => {
        const trimmed = l.trim();
        if (/^\s*Team\s*\d+/i.test(trimmed)) return false;
        if (/^\s*\.{3,}\s*$/.test(trimmed)) return false; // Lọc bỏ dòng chỉ có dấu chấm ...
        return true;
      });
      const colored = colorizeTeams(linesControl.join("\n"));
      sendOrEditTelegramPre(controlId, colored, "TIN1_CONTROL", "[Tin1][CONTROL]");
    } catch (controlErr) {
      Logger.log("[Tin1][CONTROL] ❌ Lỗi gửi: " + controlErr.message);
    }
  }
  // ② Mỗi Team: header chung + site của team đó
  const lines = colCRaw.split("\n");
  const teams = ["T1", "T2", "T3", "T4"];
  for (const team of teams) {
    try {
      const chatId = SD_GROUPS[team];
      if (!chatId) continue;
      const teamNum = team.replace("T", "");
      // Regex khớp cả T1, T1 S1, T1 Su1, T1 S*
      const sitePat    = new RegExp("\\|\\s*T" + teamNum + "(?:\\s+S\\w*)?\\s*\\|", "i");
      const summaryPat = new RegExp("^\\s*Team\\s*" + teamNum, "i");
      const headerLines = lines.filter(l => {
        if (!l.trim()) return false;
        if (/^\d+:/.test(l)) return false;
        if (/^Team\s*\d+\s*:/i.test(l)) return summaryPat.test(l);
        return true;
      });
      const siteLines = lines.filter(l => sitePat.test(l));
      const content = siteLines.length > 0
        ? [...headerLines, "...", ...siteLines].join("\n")
        : [...headerLines, "No site down"].join("\n");
      sendOrEditTelegramPre(chatId, colorizeTeams(content), "TIN1_" + team, "[Tin1][" + team + "]");
    } catch (teamErr) {
      Logger.log("[Tin1][" + team + "] ❌ Lỗi gửi: " + teamErr.message);
    }
  }
  props.setProperty(TS_KEY_A1, storeKey);
  Logger.log("[Tin1] ✅ Xong — key: " + storeKey.substring(0, 60));
  return true;
}
// ── Đọc toàn bộ nội dung Col C (raw text) ───────────────────
function readColCRaw(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return "";
  const data = sheet.getRange(1, 3, lastRow, 1).getValues().flat();
  return data
    .map(c => (c || "").toString().trim())
    .filter(l => l.length > 0)
    .join("\n");
}
// ── Tô màu team codes ────────────────────────────────────────
function colorizeTeams(text) {
  return (text || "").replace(/\|\s*(T[1-4])(\s+S\w*)?\s*\|/gi, (match, team, sub) => {
    const emoji = TEAM_COLORS[team.toUpperCase()] || "";
    return "| " + emoji + team + (sub || "") + " |";
  });
}
// ============================================================
// TIN 2 — AW:AZ SUMMARY
// Gửi khi AW7 timestamp thay đổi
// ============================================================
function checkAwAz(sheet) {
  const ts = parseAW7Timestamp(sheet);
  if (!ts) { Logger.log("[Tin2] Không có timestamp trong AW7"); return false; }
  const props  = PropertiesService.getScriptProperties();
  const lastTs = props.getProperty(TS_KEY_AW7) || "";
  if (ts === lastTs) { Logger.log("[Tin2] AW7 không đổi (" + ts + ") — bỏ qua"); return false; }
  Logger.log("[Tin2] 🆕 " + ts + " → gửi summary...");
  const awaz  = readAwAz(sheet);
  const teams = ["T1", "T2", "T3", "T4"];
  // Gửi từng team
  for (const team of teams) {
    try {
      const chatId = SD_GROUPS[team];
      if (!chatId) continue;
      const colIdx = AWAZ_COL[team];
      if (colIdx === undefined) continue;
      const msg = buildAwAzTeamMessage(team, ts, awaz, colIdx);
      sendOrEditTelegram(chatId, msg, "TIN2_" + team, "[Tin2][" + team + "]");
    } catch (teamErr) {
      Logger.log("[Tin2][" + team + "] ❌ Lỗi gửi: " + teamErr.message);
    }
  }
  // Gửi CONTROL
  const controlId = SD_GROUPS["CONTROL"];
  if (controlId) {
    try {
      const msg = buildAwAzControlMessage(ts, awaz);
      sendOrEditTelegram(controlId, msg, "TIN2_CONTROL", "[Tin2][CONTROL]");
    } catch(e) {
      Logger.log("[Tin2][CONTROL] ❌ " + e.message);
    }
  }
  // Gửi DM cá nhân
  for (const pid of SD_PERSONAL_IDS) {
    try {
      sendOrEditTelegram(pid, buildAwAzControlMessage(ts, awaz), "TIN2_P_" + pid, "[Tin2][DM]");
    } catch(e) {
      Logger.log("[Tin2][DM] ❌ " + e.message);
    }
    Utilities.sleep(300);
  }
  props.setProperty(TS_KEY_AW7, ts);
  Logger.log("[Tin2] ✅ Xong — ts: " + ts);
  return true;
}
// ── Đọc AW7:AZ15 (9 rows × 4 cols) ─────────────────────────
function readAwAz(sheet) {
  return sheet.getRange(7, 49, 9, 4).getValues();  // AW=col49
}
// ── Parse timestamp từ AW7 (flexible regex) ─────────────────
function parseAW7Timestamp(sheet) {
  const raw = sheet.getRange("AW7").getValue().toString();
  // Ưu tiên: "Site down: DD/MM/YYYY HH:MM"
  const m1 = raw.match(/Site\s*down[^:]*:\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/i);
  if (m1) return m1[1].trim();
  // Fallback: bất kỳ DD/MM/YYYY HH:MM trong cell
  const m2 = raw.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/);
  if (m2) return m2[1].trim();
  return null;
}
// ── Parse timestamp từ A1 (để làm dedup key) ────────────────
function parseA1Timestamp(sheet) {
  const raw = sheet.getRange("A1").getValue().toString();
  // Ưu tiên HH:MM:SS
  const m1 = raw.match(/(\d{2}\/\d{2}\/\d{4}[\s\-T]+\d{2}:\d{2}:\d{2})/);
  if (m1) return m1[1].replace(/[\-T]/g, " ").trim();
  // Fallback HH:MM
  const m2 = raw.match(/(\d{2}\/\d{2}\/\d{4}[\s\-T]+\d{2}:\d{2})/);
  return m2 ? m2[1].replace(/[\-T]/g, " ").trim() : null;
}
// ── Build Tin 2 cho từng Team ────────────────────────────────
function buildAwAzTeamMessage(teamKey, ts, awaz, colIdx) {
  const label    = "Team " + teamKey.replace("T", "");
  const numRows  = awaz.length;
  const lines    = [];
  lines.push("📊 <b>SUMMARY — " + label + "</b>");
  lines.push("📅 " + escHtml(ts));
  lines.push("━".repeat(26));
  let hasData = false;
  for (let r = 0; r < numRows; r++) {
    const txt = ((awaz[r] || [])[colIdx] || "").toString().trim();
    if (!txt || txt === "0") continue;
    const clean = escHtml(txt.replace(/[*_`]/g, ""));
    if (r < AWAZ_LABELS.length) {
      lines.push(AWAZ_LABELS[r].emoji + " <b>" + AWAZ_LABELS[r].name + ":</b> " + clean);
    } else {
      const lm = txt.match(/^([^:]+):/);
      const lb = lm ? lm[1].replace(/[*_`]/g, "").trim() : "Row " + (r + 1);
      lines.push("📌 <b>" + escHtml(lb) + ":</b> " + clean);
    }
    hasData = true;
  }
  if (!hasData) lines.push("✅ No incident");
  return lines.join("\n");
}
// ── Build Tin 2 tổng hợp cho CONTROL ────────────────────────
function buildAwAzControlMessage(ts, awaz) {
  const teamDefs = [
    { key: "T1", label: "Team 1 Dawei",     emoji: "🔵", col: 0 },
    { key: "T2", label: "Team 2 Myeik",     emoji: "🟡", col: 1 },
    { key: "T3", label: "Team 3 Bokpyin",   emoji: "🟢", col: 2 },
    { key: "T4", label: "Team 4 Kawthoung", emoji: "🔴", col: 3 },
  ];
  const numRows = awaz.length;
  const lines   = [];
  lines.push("📊 <b>SUMMARY — ALL TEAMS</b>");
  lines.push("📅 " + escHtml(ts));
  lines.push("━".repeat(26));
  for (const t of teamDefs) {
    lines.push("");
    lines.push(t.emoji + " <b>" + t.label + "</b>");
    lines.push("─".repeat(20));
    let hasData = false;
    for (let r = 0; r < numRows; r++) {
      const txt = ((awaz[r] || [])[t.col] || "").toString().trim();
      if (!txt || txt === "0") continue;
      const clean = escHtml(txt.replace(/[*_`]/g, ""));
      if (r < AWAZ_LABELS.length) {
        lines.push(AWAZ_LABELS[r].emoji + " <b>" + AWAZ_LABELS[r].name + ":</b> " + clean);
      } else {
        const lm = txt.match(/^([^:]+):/);
        const lb = lm ? lm[1].replace(/[*_`]/g, "").trim() : "Row " + (r + 1);
        lines.push("📌 <b>" + escHtml(lb) + ":</b> " + clean);
      }
      hasData = true;
    }
    if (!hasData) lines.push("✅ No incident");
  }
  return lines.join("\n");
}
// ============================================================
// SEND HELPERS — delete old → send new
// ============================================================
function sendOrEditTelegram(chatId, text, msgKey, tag) {
  deleteOldMessages_(chatId, msgKey);
  const newIds = sendTelegramCollectIds_(chatId, text, tag);
  if (newIds.length > 0) saveMsgIds_(msgKey, newIds);
}
function sendOrEditTelegramPre(chatId, plainContent, msgKey, tag) {
  deleteOldMessages_(chatId, msgKey);
  const newIds = sendTelegramPreCollectIds_(chatId, plainContent, tag);
  if (newIds.length > 0) saveMsgIds_(msgKey, newIds);
}
function sendTelegramCollectIds_(chatId, text, tag) {
  const url    = "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/sendMessage";
  const chunks = splitMessage(text, 4000);
  const ids    = [];
  chunks.forEach((chunk, i) => {
    try {
      const resp = UrlFetchApp.fetch(url, {
        method:             "post",
        contentType:        "application/json",
        payload:            JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: "HTML" }),
        muteHttpExceptions: true,
      });
      const res = JSON.parse(resp.getContentText());
      if (res.ok && res.result && res.result.message_id) ids.push(res.result.message_id);
      Logger.log((tag || "") + (res.ok ? " ✅→" : " ❌→") + chatId
        + (chunks.length > 1 ? " [" + (i+1) + "/" + chunks.length + "]" : "")
        + (!res.ok ? " | " + res.description : ""));
    } catch(e) { Logger.log((tag || "") + " ❌ " + e.message); }
  });
  return ids;
}
function sendTelegramPreCollectIds_(chatId, plainContent, tag) {
  const url     = "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/sendMessage";
  const escaped = escHtml(plainContent);
  const chunks  = splitMessage(escaped, 3800);  // để lại room cho <pre></pre>
  const ids     = [];
  chunks.forEach((chunk, i) => {
    try {
      const resp = UrlFetchApp.fetch(url, {
        method:             "post",
        contentType:        "application/json",
        payload:            JSON.stringify({ chat_id: chatId, text: "<pre>" + chunk + "</pre>", parse_mode: "HTML" }),
        muteHttpExceptions: true,
      });
      const res = JSON.parse(resp.getContentText());
      if (res.ok && res.result && res.result.message_id) ids.push(res.result.message_id);
      Logger.log((tag || "") + (res.ok ? " ✅→" : " ❌→") + chatId
        + (chunks.length > 1 ? " [" + (i+1) + "/" + chunks.length + "]" : "")
        + (!res.ok ? " | " + res.description : ""));
    } catch(e) { Logger.log((tag || "") + " ❌ " + e.message); }
    if (i < chunks.length - 1) Utilities.sleep(300);
  });
  return ids;
}
// ── Message ID persistence ───────────────────────────────────
function saveMsgIds_(msgKey, messageIds) {
  PropertiesService.getScriptProperties()
    .setProperty("SD_MSGID_" + msgKey, JSON.stringify(messageIds));
}
function getSavedMsgIds_(msgKey) {
  const val = PropertiesService.getScriptProperties()
    .getProperty("SD_MSGID_" + msgKey) || "";
  if (!val) return [];
  try {
    const arr = JSON.parse(val);
    if (Array.isArray(arr)) return arr;
  } catch(e) {}
  // fallback: format cũ có "|date"
  const idx = val.lastIndexOf("|");
  if (idx > 0) {
    try { const arr2 = JSON.parse(val.substring(0, idx)); if (Array.isArray(arr2)) return arr2; }
    catch(e2) {}
  }
  return [];
}
function clearMsgIds_(msgKey) {
  PropertiesService.getScriptProperties().deleteProperty("SD_MSGID_" + msgKey);
}
function deleteTelegramMsgBot_(chatId, messageId) {
  try {
    const resp = UrlFetchApp.fetch(
      "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/deleteMessage", {
        method:             "post",
        contentType:        "application/json",
        payload:            JSON.stringify({ chat_id: chatId, message_id: messageId }),
        muteHttpExceptions: true,
      }
    );
    const res = JSON.parse(resp.getContentText());
    Logger.log("[delete] " + (res.ok ? "🗑️" : "⚠️") + " msg=" + messageId + " → " + chatId
      + (!res.ok ? " | " + res.description : ""));
    return res.ok === true;
  } catch(e) { Logger.log("[delete] ❌ " + e.message); return false; }
}
function deleteOldMessages_(chatId, msgKey) {
  const oldIds = getSavedMsgIds_(msgKey);
  for (let i = 0; i < oldIds.length; i++) {
    deleteTelegramMsgBot_(chatId, oldIds[i]);
    if (i < oldIds.length - 1) Utilities.sleep(200);
  }
  if (oldIds.length > 0) clearMsgIds_(msgKey);
}
// ============================================================
// UTILITIES
// ============================================================
function escHtml(str) {
  return (str || "").toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function splitMessage(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const chunks = [], lines = text.split("\n");
  let cur = "";
  for (const line of lines) {
    if ((cur + "\n" + line).length > maxLen) {
      if (cur) chunks.push(cur.trim());
      cur = line;
    } else {
      cur = cur ? cur + "\n" + line : line;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}
function getSheetByGid(ss, gid) {
  for (const s of ss.getSheets()) {
    if (s.getSheetId().toString() === gid.toString()) return s;
  }
  return null;
}
// ============================================================
// SETUP — Chạy 1 lần từ Apps Script Editor
// ============================================================
/**
 * Cài trigger checkAndSend() mỗi 1 phút.
 * Trigger chạy mỗi phút nhưng chỉ làm việc thực sự khi
 * đồng hồ Myanmar đúng phút :08 hoặc :38 — không trễ.
 * Lịch: 03:38 → 04:08 → ... → 22:08 Myanmar.
 */
function setupSdTrigger() {
  // Xóa trigger cũ cùng tên
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "checkAndSend")
    .forEach(t => ScriptApp.deleteTrigger(t));
  // Tạo mới — mỗi 1 phút (check đúng :08 và :38)
  ScriptApp.newTrigger("checkAndSend").timeBased().everyMinutes(1).create();
  Logger.log("✅ Trigger checkAndSend() mỗi 1 phút đã cài.");
  Logger.log("   Chỉ thực sự chạy lúc :08 và :38 mỗi giờ (03:38–22:08 Myanmar). Không trễ.");
}
/** Xóa webhook (bắt buộc trước khi dùng polling) */
function deleteWebhook() {
  const resp = UrlFetchApp.fetch(
    "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/deleteWebhook"
  );
  Logger.log("deleteWebhook → " + resp.getContentText());
}
/** Kiểm tra webhook hiện tại */
function checkWebhook() {
  const resp = UrlFetchApp.fetch(
    "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/getWebhookInfo"
  );
  const info = JSON.parse(resp.getContentText());
  const r    = info.result || {};
  Logger.log("📡 URL: " + (r.url || "(trống — OK cho polling)"));
  Logger.log("⏳ Pending: " + (r.pending_update_count || 0));
  Logger.log("❌ Last error: " + (r.last_error_message || "không có"));
}
// ============================================================
// TEST — Ép gửi ngay (bỏ qua dedup timestamp)
// ============================================================
function testSendNow() {
  // Bypass minute check — gọi thẳng logic không qua checkAndSend()
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(TS_KEY_A1);
  props.deleteProperty(TS_KEY_AW7);
  Logger.log("🧪 testSendNow — ép gửi Tin 1 + Tin 2 (bypass minute check)...");
  const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
  const sheet = getSheetByGid(ss, SD_SHEET_GID);
  if (!sheet) { Logger.log("❌ Không tìm thấy sheet"); return; }
  fetchTelegramUpdates(sheet);
  checkColC(sheet);
  checkAwAz(sheet);
  Logger.log("🧪 testSendNow — xong.");
}
function testTin1Only() {
  PropertiesService.getScriptProperties().deleteProperty(TS_KEY_A1);
  Logger.log("🧪 Ép gửi Tin 1...");
  const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
  const sheet = getSheetByGid(ss, SD_SHEET_GID);
  if (sheet) checkColC(sheet);
}
function testTin2Only() {
  PropertiesService.getScriptProperties().deleteProperty(TS_KEY_AW7);
  Logger.log("🧪 Ép gửi Tin 2 (SUMMARY)...");
  const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
  const sheet = getSheetByGid(ss, SD_SHEET_GID);
  if (sheet) checkAwAz(sheet);
}
function resetSiteDownProperties() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(TS_KEY_A1);
  props.deleteProperty(TS_KEY_AW7);
  Logger.log("✅ resetSiteDownProperties: Đã xóa bộ nhớ đệm A1 và AW7.");
}
function testFullFlow() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(TS_KEY_A1);
  props.deleteProperty(TS_KEY_AW7);
  Logger.log("🧪 testFullFlow — ép trigger GitHub Actions + gửi tin...");
  triggerBotlookupRelay();
}