// ============================================================
// TNI Site Down Auto-Notification — v4 CLEAN
// Last updated: 24/07/2026
// ============================================================
//
// FLOW HỆ THỐNG:
//
//   Bot công ty (auto_nocpro_bot) update mỗi :00 và :30 Myanmar
//        ↓
//   GitHub cron chạy UTC :00 và :30 (= Myanmar :30 và :00)
//        ↓
//   botlookup_relay.py gửi /down_tni@auto_nocpro_bot vào "Botlookup"
//        ↓ đợi 20 giây
//   Đọc tin bot phản hồi → POST lên store_site_down (GAS này)
//        ↓
//   Tin 1 (checkColC): Timestamp A1 thay đổi? → Gửi Col C đến T1/T2/T3/T4/CONTROL
//                      Timestamp giống cũ?     → Bỏ qua (không gửi lại)
//   Tin 2 (checkAW7):  AW7 timestamp thay đổi? → Gửi SUMMARY (AW7:AZ15)
//
// QUAN TRỌNG:
//   - Relay chạy 2 lần/giờ (UTC :00 và :30) — KHÔNG spam BOT LOOKUP
//   - Dedup theo TIMESTAMP (TS_KEY_A1): chỉ gửi khi data thực sự thay đổi
//   - KHÔNG có time-gate 25ph — timestamp cũ = không gửi dù đã lâu
//
// Setup: Chạy setupSdTrigger() 1 lần từ Apps Script Editor
// ============================================================
const SD_BOT_TOKEN = PropertiesService.getScriptProperties().getProperty("SD_BOT_TOKEN") || "";

// ── Webhook mode — loại bỏ GitHub queue hoàn toàn ──────────
// SD_BOTLOOKUP_CHAT_ID: set trong Script Properties (numeric ID của nhóm BOT LOOKUP)
// SD_AUTO_NOCPRO_BOT:   tên bot cần lắng nghe
const SD_BOTLOOKUP_CHAT_ID = PropertiesService.getScriptProperties().getProperty("SD_BOTLOOKUP_CHAT_ID") || "";
const SD_AUTO_NOCPRO_BOT   = "auto_nocpro_bot";

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
// ⚠️ KHÔNG hardcode ID cá nhân — đọc từ Script Properties "SD_PERSONAL_IDS"
// Format: "ID1,ID2,ID3" (cách nhau bởi dấu phẩy)
// Ví dụ: set property SD_PERSONAL_IDS = "6859790680"
const SD_PERSONAL_IDS = (PropertiesService.getScriptProperties().getProperty("SD_PERSONAL_IDS") || "")
  .split(",").map(s => s.trim()).filter(s => s.length > 0);

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
const TEAM_COLORS = { T1: "🔴", T2: "🔵", T3: "🟢", T4: "🟡" };



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
    const data = JSON.parse(e.postData.contents);

    // ── Telegram Webhook update (update_id có mặt, không có action) ──
    if (data.update_id !== undefined && !data.action) {
      return handleTelegramWebhook_(data);
    }

    // ── Relay POST từ botlookup_relay.py (có action field) ──
    const action = data.action || "";

    if (action === "store_site_down") {
      // Ghi text từ botlookup_relay vào Col A (mỗi dòng = 1 ô)
      const text  = (data.text || "").trim();
      const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
      const sheet = getSheetByGid(ss, SD_SHEET_GID);
      if (!sheet) return _json({ ok: false, msg: "Sheet not found" });

      // ── Luôn ghi dữ liệu mới vào Col A ──
      const props   = PropertiesService.getScriptProperties();
      const relayTs = data.relay_ts || 0;   // Unix ms từ botlookup_relay

      // Xóa toàn bộ Col A cũ (đảm bảo không còn rác từ các lần ghi trước)
      const maxRow = Math.max(sheet.getLastRow(), 500);
      sheet.getRange(1, 1, maxRow, 1).clearContent();

      // Ghi từng dòng vào Col A (A1, A2, A3, ...) — ép kiểu chuỗi an toàn không bị lỗi công thức
      const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length > 0) {
        const values = lines.map(l => {
          const str = String(l);
          return (/^[=\+\-@]/.test(str)) ? "'" + str : str;
        });
        sheet.getRange(1, 1, values.length, 1).setValues(values.map(v => [v]));
      }
      Logger.log("[doPost] store_site_down — " + lines.length + " dòng ghi sạch vào Col A | relay_ts=" + relayTs
        + (lines[0] ? " | A1: " + lines[0].substring(0, 50) : ""));

      // ── Giữ TS_KEY_A1 để checkColC() so sánh timestamp ──
      // Nếu data timestamp A1 không đổi (đã gửi lúc :25) → :35 sẽ BỎ QUA không gửi trùng
      if (relayTs > 0) props.setProperty("SD_LAST_RELAY_TS", relayTs.toString());


      SpreadsheetApp.flush(); // flush 1 — commit ghi Col A
      Utilities.sleep(2000);  // 2s safety — đủ Col C formula (QUERY/FILTER) tính xong
      SpreadsheetApp.flush(); // flush 2 — đảm bảo Col C đã cập nhật trước khi đọc

      var checkResult = { sent_tin1: false, sent_tin2: false };
      try {
        var r = checkAndSend(true);
        if (r && typeof r === "object") checkResult = r;
        Logger.log("[doPost] checkAndSend() xong. Result: " + JSON.stringify(checkResult));
      } catch(callErr) {
        Logger.log("[doPost] ⚠️ checkAndSend() lỗi: " + callErr.message);
      }

      return _json({ 
        ok: true, 
        lines: lines.length,
        relay_ts: relayTs,
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
// ENTRY POINT — trigger 1 phút, từ 4:00 đến 22:10 Myanmar
// ✅ Dispatch relay đúng phút :05 và :35 Myanmar
//    → relay chạy ~3 phút → tin đến ĐÚNG :08 và :38 Myanmar
// 37 lần/ngày × 2 phút = 74 phút/ngày
// Cuối tháng → public repo → miễn phí vô giới hạn
// ============================================================
function checkAndSend(isWebhookCall) {
  const now    = new Date();
  const mytime = Utilities.formatDate(now, "Asia/Rangoon", "H:mm");
  const hour   = parseInt(Utilities.formatDate(now, "Asia/Rangoon", "H"), 10);
  const minute = parseInt(Utilities.formatDate(now, "Asia/Rangoon", "m"), 10);

  const props = PropertiesService.getScriptProperties();

  if (isWebhookCall !== true) {
    // ── Khung giờ hoạt động: 4:00 đến 22:10 Myanmar ──────────
    if (hour < 4 || hour > 22) return { sent_tin1: false, sent_tin2: false };
    if (hour === 22 && minute > 10) return { sent_tin1: false, sent_tin2: false };

    // ── Chống chạy 2 lần trong cùng phút ─────────────────────
    const thisMinute = Utilities.formatDate(now, "Asia/Rangoon", "yyyyMMddHHmm");
    const lastDoneMinute = props.getProperty("SD_LAST_DONE_MINUTE") || "";
    if (thisMinute === lastDoneMinute) {
      Logger.log("⏭️ " + mytime + " — đã chạy phút này rồi.");
      return { sent_tin1: false, sent_tin2: false };
    }
    props.setProperty("SD_LAST_DONE_MINUTE", thisMinute);

    // ── Smart progressive relay dispatch (tối đa 3 lần/chu kỳ 30 phút) ──
    // 1. Nếu ĐÃ GỬI tin trong 20 phút qua → Đã xong chu kỳ, bỏ qua dispatch
    // 2. Nếu ĐÃ ÉP 3 LẦN trong chu kỳ này → Dừng ép, chờ chu kỳ sau
    // 3. Nếu VỪA DISPATCH < 3 phút → Đang chờ GitHub relay, chưa dispatch tiếp
    // 4. Chưa gửi & < 3 lần & > 3 phút từ lần trước → ÉP GITHUB CHẠY (Lần 1, 2, hoặc 3)
    if (minute % 5 === 0 && minute !== 0 && minute !== 30) {
      const cycleSlot = Utilities.formatDate(now, "Asia/Rangoon", "yyyyMMddHH") + (minute < 30 ? "_00" : "_30");
      const lastSlot  = props.getProperty("SD_DISPATCH_SLOT") || "";

      let count = parseInt(props.getProperty("SD_DISPATCH_COUNT") || "0", 10);
      if (cycleSlot !== lastSlot) {
        count = 0;
        props.setProperty("SD_DISPATCH_SLOT", cycleSlot);
        props.setProperty("SD_DISPATCH_COUNT", "0");
      }

      const lastSentSlot   = props.getProperty("SD_LAST_SENT_SLOT") || "";
      const lastDispatchTs = parseInt(props.getProperty("SD_LAST_DISPATCH_TS") || "0", 10);
      const minSinceDisp   = (Date.now() - lastDispatchTs) / 60000;

      if (lastSentSlot === cycleSlot) {
        Logger.log("✔️ Chu kỳ " + cycleSlot + " đã gửi tin xong → bỏ qua dispatch");
      } else if (count >= 3) {
        Logger.log("🛑 Đã ép GitHub 3/3 lần trong chu kỳ " + cycleSlot + " mà chưa nhận tin → Dừng ép, chờ chu kỳ sau");
      } else if (lastDispatchTs > 0 && minSinceDisp < 3) {
        Logger.log("⏳ Vừa dispatch " + minSinceDisp.toFixed(1) + " phút trước → Đang chờ GitHub relay");
      } else {
        Logger.log("⏰ " + mytime + " Myanmar → Ép GitHub dispatch relay (Lần " + (count + 1) + "/3, minDisp=" + minSinceDisp.toFixed(1) + "m)");
        triggerBotlookupRelay();
        props.setProperty("SD_DISPATCH_COUNT", (count + 1).toString());
      }
    }

  }



  Logger.log("🔄 checkAndSend — " + mytime + (isWebhookCall === true ? " (Webhook)" : " (Trigger)"));

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log("⏭️ Lock bận — bỏ qua");
    return { sent_tin1: false, sent_tin2: false };
  }
  try {
    const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
    const sheet = getSheetByGid(ss, SD_SHEET_GID);
    if (!sheet) { Logger.log("❌ Không tìm thấy sheet GID=" + SD_SHEET_GID); return { sent_tin1: false, sent_tin2: false }; }

    const sentTin1 = checkColC(sheet);   // Tin 1: Col A → Col C → gửi nhóm
    const sentTin2 = checkAwAz(sheet, sentTin1);   // Tin 2: AW7 → gửi SUMMARY (force nếu sentTin1=true)

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
  const props = PropertiesService.getScriptProperties();
  const pat   = props.getProperty("GITHUB_PAT") || "";
  const owner = "MON6879";                  // ✅ Repo hiện tại (đã migrate từ phonghdpxd-cmd/TNI-SITE-DOWN)
  const repo  = "tni-sitedown-relay";
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
      props.setProperty("SD_LAST_DISPATCH_TS", Date.now().toString());
      Logger.log("[Relay] ✅ Dispatched botlookup_relay → GitHub Actions");
    } else {
      Logger.log("[Relay] ⚠️ HTTP " + code + ": " + resp.getContentText().substring(0, 200));
    }
  } catch(e) {
    Logger.log("[Relay] ❌ " + e.message);
  }
}


// ============================================================
// [DU PHONG] fetchTelegramUpdates() - chi dung khi can polling tay

// KHONG duoc goi trong checkAndSend() - relay (botlookup_relay.py) lo ghi Col A qua doPost()
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
    
    // Kích hoạt botlookup lấy dữ liệu ngay lập tức (bỏ qua cron)
    triggerBotlookupRelay();

    SpreadsheetApp.flush(); // ép Col C cập nhật ngay
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
  const storeKey = parseA1Timestamp(sheet);
  if (!storeKey) { Logger.log("[Tin1] Không có timestamp hợp lệ trong A1"); return false; }

  const props   = PropertiesService.getScriptProperties();
  const lastKey = props.getProperty(TS_KEY_A1) || "";

  // ── Dedup: chỉ gửi khi timestamp A1 THAY ĐỔI thực sự ────────────
  // Nếu data vẫn là 06:30 (không có gì thay đổi) → không gửi lại
  if (storeKey && storeKey === lastKey) {
    Logger.log("[Tin1] Timestamp không đổi (" + storeKey.substring(0,40) + ") → bỏ qua");
    return false;
  }

  Logger.log("[Tin1] 🆕 Timestamp đổi: " + lastKey.substring(0,20) + " → " + (storeKey||"").substring(0,20));

  const lastRow = sheet.getLastRow();
  if (lastRow < 1) { Logger.log("[Tin1] Sheet trống — bỏ qua"); return false; }

  // Đọc toàn bộ Cột C — colC[0]=C1, colC[3]=C4, colC[9]=C10, ...
  const colC = sheet.getRange(1, 3, lastRow, 1).getValues().flat().map(v => (v || "").toString().trim());

  // Helper: nhận biết dòng tổng hợp Team dù có hay không có emoji prefix
  // "Team 2: Total..." hoặc "🟡 Team 2: Total..." (sau colorizeTeams)
  function isTeamSummaryLine(l) {
    return /Team\s+[1-4]\s*:\s*Total\s+Site\s+down/i.test(l);
  }

  // ① CONTROL: C1+C2+C3 GIỮ NGUYÊN raw (không thêm icon) + toàn bộ C10: site lines
  const controlId = SD_GROUPS["CONTROL"];
  if (controlId) {
    try {
      // Header C1,C2,C3 — lấy theo index, KHÔNG addKeywordIcons
      const header = [colC[0]||"", colC[1]||"", colC[2]||""].filter(l => l.length > 0);
      // Sites: toàn bộ C10+, bỏ dòng rỗng/"..."/Team summary
      const allSites = colC.slice(9).filter(l => l.length > 0 && l !== "..." && !isTeamSummaryLine(l));
      const msg = [...header, ...allSites].join("\n");
      if (msg.trim()) {
        // CONTROL: header RAW + site list với team color (colorizeTeams), KHÔNG addKeywordIcons
        sendOrEditTelegramPre(controlId, colorizeTeams(msg), "TIN1_CONTROL", "[Tin1][CONTROL]");
        Logger.log("[Tin1][CONTROL] ✅ header=" + header.length + " | sites=" + allSites.length);
      }
    } catch (e) {
      Logger.log("[Tin1][CONTROL] ❌ " + e.message);
    }
  }

  // ② Team summary: lấy C4(3)/C5(4)/C6(5)/C7(6) by index, fallback scan C10+ nếu rỗng
  const teamCells = {
    T1: colC[3] || "",   // C4
    T2: colC[4] || "",   // C5
    T3: colC[5] || "",   // C6
    T4: colC[6] || ""    // C7
  };
  const teams = ["T1", "T2", "T3", "T4"];
  const allC10 = colC.slice(9).filter(l => l.length > 0 && l !== "...");

  // Nếu C4-C7 rỗng (format sheet thay đổi), tìm summary trong C10+
  for (const team of teams) {
    if (!teamCells[team]) {
      const n = team[1];
      const found = allC10.find(l => new RegExp("Team\\s+" + n + "\\s*:\\s*Total\\s+Site\\s+down", "i").test(l));
      if (found) teamCells[team] = found;
    }
  }

  // ③ Phân loại site lines (loại Team summary) theo từng team
  const siteOnly = allC10.filter(l => !isTeamSummaryLine(l));
  const teamSites = { T1: [], T2: [], T3: [], T4: [] };

  for (const line of siteOnly) {
    const fields = line.split("|");
    if (fields.length < 2) continue;
    const teamField = fields[1].trim().toUpperCase();
    for (const team of teams) {
      const tn  = team.slice(1);
      const idx = teamField.indexOf("T" + tn);
      if (idx < 0) continue;
      const afterChar = teamField[idx + 1 + tn.length];
      if (!afterChar || !/\d/.test(afterChar)) {
        teamSites[team].push(line);
        break;
      }
    }
  }

  // ④ Gửi từng Team: Cx summary (addKeywordIcons đầy đủ) + site list của team đó
  for (const team of teams) {
    try {
      const chatId = SD_GROUPS[team];
      if (!chatId) continue;
      if (String(chatId).trim() === String(controlId).trim()) {
        Logger.log("[Tin1][" + team + "] ⚠️ chatId trùng CONTROL → bỏ qua");
        continue;
      }
      const summary = teamCells[team];   // C4/C5/C6/C7
      const sites   = teamSites[team];   // C10+ filtered by team

      if (!summary && sites.length === 0) {
        Logger.log("[Tin1][" + team + "] Không có summary lẫn site → bỏ qua.");
        continue;
      }

      // summary Cx: addKeywordIcons đầy đủ (🔴 Team, 🔥 Dont Forget, 🔴 Cell down, ⚙️ DG, ❌ DG Run>16H, 🔗 Link down, 🕒 Duty)
      // site lines: colorizeTeams tô màu T1/T2/T3/T4
      const parts = [];
      if (summary) parts.push(addKeywordIcons(colorizeTeams(summary), team));
      for (const s of sites) parts.push(colorizeTeams(s));

      sendOrEditTelegramPre(chatId, parts.join("\n"), "TIN1_" + team, "[Tin1][" + team + "]");
      Logger.log("[Tin1][" + team + "] ✅ summary=" + (summary?"có":"không") + " | sites=" + sites.length);
    } catch (e) {
      Logger.log("[Tin1][" + team + "] ❌ " + e.message);
    }
  }

  props.setProperty(TS_KEY_A1, storeKey);
  const now = new Date();
  props.setProperty("SD_LAST_SEND_TS", now.getTime().toString()); // ✅ lưu thời điểm gửi
  const sentSlot = Utilities.formatDate(now, "Asia/Rangoon", "yyyyMMddHH") + (now.getMinutes() < 30 ? "_00" : "_30");
  props.setProperty("SD_LAST_SENT_SLOT", sentSlot);
  Logger.log("[Tin1] ✅ Xong — key: " + storeKey.substring(0, 60) + " | slot: " + sentSlot);
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


// ── Tô màu team codes & thêm icon tổng hợp team ─────────────
function colorizeTeams(text) {
  if (!text) return "";
  let s = text.replace(/\|\s*(T[1-4])(\s+S\w*)?\s*\|/gi, (match, team, sub) => {
    const emoji = TEAM_COLORS[team.toUpperCase()] || "";
    return "| " + emoji + team + (sub || "") + " |";
  });

  // Thêm emoji cho dòng tổng hợp Team (C4, C5, C6, C7)
  s = s.replace(/^(?:[🔴🔵🟢🟡]\s*)?(Team\s+([1-4])):/gmi, (match, fullTeam, num) => {
    const teamKey = "T" + num;
    const emoji = TEAM_COLORS[teamKey] || "";
    return emoji + " " + fullTeam + ":";
  });

  return s;
}

// ── Helper format timestamp ngắn cho header ────────────
function formatTsHeader(ts) {
  if (!ts) return "";
  const match = ts.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/);
  if (match) return match[1];
  return ts.length > 30 ? ts.substring(0, 30) : ts;
}

// ── Thêm icon vào các từ khóa trong Tin 1 (mỗi icon xuống hàng mới chuẩn Picture 2) ────
function addKeywordIcons(text, teamKey) {
  if (!text) return "";
  let s = text;

  // 1. Team Header Emoji Prefix (🔴 T1, 🔵 T2, 🟢 T3, 🟡 T4)
  const teamColors = { T1: "🔴", T2: "🔵", T3: "🟢", T4: "🟡" };
  const teamEmoji = teamColors[teamKey] || (teamColors["T" + ((text.match(/Team\s+([1-4])/i) || [])[1] || "")] || "");

  s = s.replace(/^(?:[🔴🔵🟢🟡]\s*)?(Team\s+([1-4]))\s*:/gmi, function(match, fullTeam, num) {
    const k = "T" + num;
    return (teamColors[k] || "🔴") + " " + fullTeam + ":";
  });

  if (teamEmoji && !/^[🔴🔵🟢🟡]/.test(s) && /^Team\s+[1-4]:/i.test(s)) {
    s = teamEmoji + " " + s;
  }

  // 2. Dont Forget warning line (xuống dòng riêng)
  s = s.replace(/(Dont\s+Forget[^\n<]*?<+>?)/gi, "\n🔥 $1");

  // 3. Cell down line (xóa các ký tự thừa < > | phía trước và xuống dòng)
  s = s.replace(/(?:<|\s|>|\|)*(Cell down:)/gi, "\n🔴 $1");

  // 4. DG Abnormal line
  s = s.replace(/(?:<|\s|>|\|)*(DG Abnormal:)/gi, "\n⚙️ $1");

  // 5. DG Run>16H line (❌ nếu có số trạm > 0, ✅ nếu = 0)
  s = s.replace(/(?:<|\s|>|\|)*(DG Run>16H:)\s*([^\n\|]*)/gi, function(match, keyword, dataStr) {
     let c = dataStr.replace(/[*_]/g, "").trim();
     let icon = (c && c !== "0" && c !== "-" && c.toLowerCase() !== "none") ? "❌" : "✅";
     return "\n" + icon + " " + keyword + " " + dataStr;
  });

  // 6. Link down line
  s = s.replace(/(?:<|\s|>|\|)*(Link down:)/gi, "\n🔗 $1");

  // 7. Duty line
  s = s.replace(/(?:<|\s|>|\|)*(Duty:)/gi, "\n🕒 $1");

  // Tách dòng & làm sạch khoảng trắng thừa
  const lines = s.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  return lines.join("\n");
}



// ============================================================
// TIN 2 — SUMMARY (AW7:AZ15)
// Gửi khi AW7 timestamp (ngày/giờ) thay đổi
// ============================================================
function checkAwAz(sheet, force) {
  let rawTs = sheet.getRange("AW7").getValue().toString().trim();
  if (!rawTs) {
    rawTs = parseA1Timestamp(sheet) || "";
  }
  if (!rawTs) { Logger.log("[Tin2] Timestamp rỗng — bỏ qua"); return false; }

  // Lấy riêng mốc Ngày/Giờ (ví dụ: "22/07/2026 15:16") để làm key so sánh ổn định
  const tsKey = formatTsHeader(rawTs);

  const props  = PropertiesService.getScriptProperties();
  const lastTs = props.getProperty(TS_KEY_AW7) || "";
  if (!force && tsKey && tsKey === lastTs) { Logger.log("[Tin2] AW7 không đổi (" + tsKey + ") — bỏ qua"); return false; }
  Logger.log("[Tin2] 🆕 " + tsKey + " (force=" + !!force + ") → gửi summary...");

  const awaz  = readAwAz(sheet);
  const teams = ["T1", "T2", "T3", "T4"];

  // Gửi từng team
  for (const team of teams) {
    try {
      const chatId = SD_GROUPS[team];
      if (!chatId) continue;
      const colIdx = AWAZ_COL[team];
      if (colIdx === undefined) continue;
      const msg = buildAwAzTeamMessage(team, tsKey, awaz, colIdx);  // ✅ tsKey (không phải ts)
      sendOrEditTelegram(chatId, msg, "TIN2_" + team, "[Tin2][" + team + "]");
    } catch (teamErr) {
      Logger.log("[Tin2][" + team + "] ❌ Lỗi gửi: " + teamErr.message);
    }
  }

  // Gửi CONTROL
  const controlId = SD_GROUPS["CONTROL"];
  if (controlId) {
    try {
      const msg = buildAwAzControlMessage(tsKey, awaz);  // ✅ tsKey
      sendOrEditTelegram(controlId, msg, "TIN2_CONTROL", "[Tin2][CONTROL]");
    } catch(e) {
      Logger.log("[Tin2][CONTROL] ❌ " + e.message);
    }
  }

  // Gửi DM cá nhân
  for (const pid of SD_PERSONAL_IDS) {
    try {
      sendOrEditTelegram(pid, buildAwAzControlMessage(tsKey, awaz), "TIN2_P_" + pid, "[Tin2][DM]");  // ✅ tsKey
    } catch(e) {
      Logger.log("[Tin2][DM] ❌ " + e.message);
    }
    Utilities.sleep(300);
  }

  props.setProperty(TS_KEY_AW7, tsKey);
  Logger.log("[Tin2] ✅ Xong — tsKey: " + tsKey);
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
  // Tìm date pattern trong A1:A20 (không chỉ A1 — timestamp có thể không ở dòng đầu)
  const maxRow = Math.min(sheet.getLastRow(), 20);
  if (maxRow < 1) return null;
  const vals = sheet.getRange(1, 1, maxRow, 1).getValues().flat();

  for (const cellVal of vals) {
    const raw = (cellVal || "").toString();
    // Ưu tiên: DD/MM/YYYY HH:MM:SS
    const m1 = raw.match(/(\d{2}\/\d{2}\/\d{4}[\s\-T]+\d{2}:\d{2}:\d{2})/);
    if (m1) return m1[1].replace(/[\-T]/g, " ").trim();
    // Fallback: DD/MM/YYYY HH:MM
    const m2 = raw.match(/(\d{2}\/\d{2}\/\d{4}[\s\-T]+\d{2}:\d{2})/);
    if (m2) return m2[1].replace(/[\-T]/g, " ").trim();
  }

  // Fallback cuối: nếu không có timestamp nào trong 20 dòng đầu
  // Dùng fingerprint = 150 ký tự đầu của dòng đầu tiên có nội dung
  // → Tin 1 gửi khi data thay đổi, time-gate (25ph) ngăn spam
  for (const cellVal of vals) {
    const raw = (cellVal || "").toString().trim();
    if (raw.length > 5) {
      Logger.log("[parseA1Ts] Không có timestamp — dùng fingerprint từ: " + raw.substring(0, 40));
      return "FP:" + raw.substring(0, 150);
    }
  }
  return null;  // Sheet trống hoàn toàn
}


// ── Helper clean duplicate label in Summary cells ───────────
function cleanSummaryCell(val) {
  if (!val) return "";
  let clean = val.toString().replace(/[*_`]/g, "").trim();
  // Strip duplicate prefix if text in cell already starts with label name
  clean = clean.replace(/^(Site\s+down|Cell\s+down|DG\s+Abnormal|DG\s+Run\s*>?\s*16H?|Link\s+down)\s*:\s*/i, "").trim();
  return clean;
}


// ── Build Tin 2 cho từng Team ────────────────────────────────
function buildAwAzTeamMessage(teamKey, ts, awaz, colIdx) {
  const teamNum   = teamKey.replace("T", "");
  const teamEmoji = TEAM_COLORS[teamKey] || "🏷";
  const label     = "Team " + teamNum;
  const numRows   = awaz.length;
  const lines     = [];
  lines.push("📊 <b>SUMMARY — " + teamEmoji + " " + label + "</b>");
  lines.push("📅 " + escHtml(ts));
  lines.push("━".repeat(26));

  let hasData = false;
  for (let r = 0; r < numRows; r++) {
    const txt = ((awaz[r] || [])[colIdx] || "").toString().trim();
    if (!txt || txt === "0") continue;
    const clean = cleanSummaryCell(txt);
    if (!clean || clean === "0") continue;

    if (r < AWAZ_LABELS.length) {
      lines.push("");
      lines.push(AWAZ_LABELS[r].emoji + " <b>" + AWAZ_LABELS[r].name + ":</b>");
      lines.push(escHtml(clean));
    } else {
      const lm = clean.match(/^([^:]+):/);
      const lb = lm ? lm[1].trim() : "Row " + (r + 1);
      const val = lm ? clean.substring(lm[0].length).trim() : clean;
      lines.push("");
      lines.push("📌 <b>" + escHtml(lb) + ":</b>");
      lines.push(escHtml(val));
    }
    hasData = true;
  }
  if (!hasData) lines.push("✅ No incident");
  return lines.join("\n");
}


// ── Build Tin 2 tổng hợp cho CONTROL ────────────────────────
function buildAwAzControlMessage(ts, awaz) {
  // NGHIỆP VỤ: T3 Bokpyin hiện KHÔNG gửi vào CONTROL vì nhóm CONTROL
  // chỉ theo dõi T1/T2/T4. Khi cần thêm T3, bỏ comment dòng bên dưới.
  const teamDefs = [
    { key: "T1", label: "Team 1 Dawei",     emoji: "🔵", col: 0 },
    { key: "T2", label: "Team 2 Myeik",     emoji: "🟡", col: 1 },
    // { key: "T3", label: "Team 3 Bokpyin",   emoji: "🟢", col: 2 }, // bỏ comment nếu cần gửi T3 → CONTROL
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
      const clean = cleanSummaryCell(txt);
      if (!clean || clean === "0") continue;

      if (r < AWAZ_LABELS.length) {
        lines.push("");
        lines.push(AWAZ_LABELS[r].emoji + " <b>" + AWAZ_LABELS[r].name + ":</b>");
        lines.push(escHtml(clean));
      } else {
        const lm = clean.match(/^([^:]+):/);
        const lb = lm ? lm[1].trim() : "Row " + (r + 1);
        const val = lm ? clean.substring(lm[0].length).trim() : clean;
        lines.push("");
        lines.push("📌 <b>" + escHtml(lb) + ":</b>");
        lines.push(escHtml(val));
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

// splitMessage định nghĩa một lần duy nhất — xem phần UTILITIES bên dưới

function sendOrEditTelegram(chatId, text, msgKey, tag) {
  // ① Xóa tin nhắn cũ có cùng tiêu đề
  deleteOldMessages_(chatId, msgKey);
  Utilities.sleep(300);

  // ② Gửi tin nhắn mới và lưu ID
  const props  = PropertiesService.getScriptProperties();
  const idKey  = "SD_MSGID_" + msgKey;
  const newIds = sendTelegramCollectIds_(chatId, text, tag);
  props.setProperty(idKey, JSON.stringify(newIds));
}

function sendOrEditTelegramPre(chatId, plainContent, msgKey, tag) {
  // ① Xóa tin nhắn cũ có cùng tiêu đề
  deleteOldMessages_(chatId, msgKey);
  Utilities.sleep(300);

  // ② Gửi tin nhắn mới (Pre box) và lưu ID
  const props  = PropertiesService.getScriptProperties();
  const idKey  = "SD_MSGID_" + msgKey;
  const newIds = sendTelegramPreCollectIds_(chatId, plainContent, tag);
  props.setProperty(idKey, JSON.stringify(newIds));
}

// ── Edit tin nhắn Telegram (không cần admin, chỉ cần bot là tác giả) ──────────────
function editTelegramMsg_(chatId, messageId, text, parseMode, tag) {
  try {
    const resp = UrlFetchApp.fetch(
      "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/editMessageText", {
        method:             "post",
        contentType:        "application/json",
        payload:            JSON.stringify({
          chat_id:    chatId,
          message_id: messageId,
          text:       text,
          parse_mode: parseMode || "HTML",
        }),
        muteHttpExceptions: true,
      }
    );
    const res = JSON.parse(resp.getContentText());
    Logger.log((tag||"")+" [edit] "+(res.ok?"✏️":"⚠️")+" msg="+messageId+" → "+chatId
      +(!res.ok?" | "+res.description:""));
    // "message is not modified" = nội dung y chang → coi như edit thành công, không cần gửi lại
    return res.ok === true
        || (!!res.description && res.description.indexOf("message is not modified") >= 0);
  } catch(e) {
    Logger.log((tag||"")+" [edit] ❌ "+e.message);
    return false;
  }
}

function sendTelegramCollectIds_(chatId, text, tag) {
  if (!SD_BOT_TOKEN) { Logger.log((tag||"")+" ❌ SD_BOT_TOKEN chưa set trong Script Properties!"); return []; }
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
  if (!SD_BOT_TOKEN) { Logger.log((tag||"")+" ❌ SD_BOT_TOKEN chưa set trong Script Properties!"); return []; }
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

// Gửi ảnh: chỉ lưu ID mới, THAY THẾ hoàn toàn củ (không dồn thêm)
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
    // Trả về true nếu xóa thành công HOẶC tin nhắn đã bị xóa trước đó rồi (không tìm thấy)
    return res.ok === true || (res.description && res.description.indexOf("message to delete not found") >= 0);
  } catch(e) { Logger.log("[delete] ❌ " + e.message); return false; }
}

function deleteOldMessages_(chatId, msgKey) {
  const oldIds = getSavedMsgIds_(msgKey);
  // Thử xóa tất cả — kết quả không quan trọng, luôn xóa key sau
  for (let i = 0; i < oldIds.length; i++) {
    deleteTelegramMsgBot_(chatId, oldIds[i]);
    if (i < oldIds.length - 1) Utilities.sleep(100);
  }
  // Luôn xóa key để không tích dồn IDs lỗi
  PropertiesService.getScriptProperties().deleteProperty("SD_MSGID_" + msgKey);
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

// deleteWebhook() và checkWebhook() ở phần TELEGRAM WEBHOOK MODE bên dưới


// ============================================================
// TEST — Ép gửi ngay (bỏ qua dedup timestamp)
// ============================================================
function testSendNow() {
  // Xóa TOÀN BỘ dedup → ép gửi lại ngay lập tức
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(TS_KEY_A1);
  props.deleteProperty(TS_KEY_AW7);
  props.deleteProperty("SD_LAST_TEXT_HASH");
  props.deleteProperty("SD_LAST_SEND_TS");
  Logger.log("🧪 testSendNow — ép gửi Tin 1 + Tin 2 từ Col A hiện có...");
  // LƯU Ý: fetchTelegramUpdates() đã bỏ — relay (botlookup_relay.py) ghi Col A qua doPost()
  // Chỉ cần đọc Col A hiện có rồi gửi
  const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
  const sheet = getSheetByGid(ss, SD_SHEET_GID);
  if (!sheet) { Logger.log("❌ Không tìm thấy sheet"); return; }
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

// ============================================================
// CLEANUP: Xóa SD_DONE_* tích lũy + cập nhật GITHUB_PAT mới
// Chạy 1 lần khi Script Properties bị đầy (>50 properties)
// ============================================================
function cleanupAndFixPAT() {
  const NEW_PAT = "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";
  const props   = PropertiesService.getScriptProperties();
  const all     = props.getProperties();
  let deleted   = 0;

  for (const key in all) {
    if (key.startsWith("SD_DONE_")) {
      props.deleteProperty(key);
      deleted++;
    }
  }

  props.setProperty("GITHUB_PAT", NEW_PAT);

  Logger.log("🧹 Đã xóa " + deleted + " SD_DONE_* properties");
  Logger.log("✅ GITHUB_PAT đã cập nhật");
  Logger.log("📊 Còn lại: " + Object.keys(props.getProperties()).length + " properties");
}


function testFullFlow() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(TS_KEY_A1);
  props.deleteProperty(TS_KEY_AW7);
  Logger.log("🧪 testFullFlow — ép trigger GitHub Actions + gửi tin...");
  triggerBotlookupRelay();
}


// ============================================================
// TELEGRAM WEBHOOK MODE — Loai bo GitHub queue hoan toan
// ============================================================
// Luong MOI (khong can GitHub, khong can may tinh):
//   auto_nocpro_bot post vao BOT LOOKUP tu dong ~30ph/lan
//   Telegram push webhook den GAS doPost handleTelegramWebhook_()
//   Tich luy text 15s processWebhookBuffer_()
//   Ghi Col A checkAndSend(true) Tin T1/T2/T3/T4/CONTROL
//   Delay: ~17 giay (thay vi 28 phut qua GitHub!)
//
// Setup 1 lan:
//   B1. Them bot "5T TNI_SITE_DOWN_CELL_ALARM" vao nhom BOT LOOKUP
//   B2. BotFather mybots Bot Settings Group Privacy Disable
//   B3. Script Properties: SD_BOTLOOKUP_CHAT_ID = numeric ID cua BOT LOOKUP
//       (Lay ID: forward 1 tin tu BOT LOOKUP len @getidsbot)
//   B4. GAS Editor: chay setupWebhook() 1 lan
//   B5. Deploy lai GAS webapp (New version)
// ============================================================

function handleTelegramWebhook_(update) {
  try {
    var msg = update.message || update.channel_post;
    if (!msg || !msg.text) return _json({ok: true});

    var chatId       = String((msg.chat && msg.chat.id) || "");
    var fromUsername = ((msg.from && msg.from.username) || "").toLowerCase();
    var text         = (msg.text || "").trim();

    Logger.log("[WH] chat=" + chatId + " @" + fromUsername + " " + text.length + "c");

    if (SD_BOTLOOKUP_CHAT_ID) {
      var expId = SD_BOTLOOKUP_CHAT_ID.replace(/^-?100/, "").replace(/^-/, "");
      var actId = chatId.replace(/^-?100/, "").replace(/^-/, "");
      if (actId !== expId) { Logger.log("[WH] Sai nhom -> skip"); return _json({ok: true}); }
    }
    if (fromUsername !== SD_AUTO_NOCPRO_BOT) {
      Logger.log("[WH] Khong phai @auto_nocpro_bot -> skip");
      return _json({ok: true});
    }
    if (text.length < 20) return _json({ok: true});

    var props = PropertiesService.getScriptProperties();
    var buf   = props.getProperty("SD_WH_BUF") || "";
    props.setProperty("SD_WH_BUF", buf ? buf + "\n" + text : text);
    props.setProperty("SD_WH_TS",  Date.now().toString());
    Logger.log("[WH] Buffer " + (buf.length + text.length) + " ky tu");

    var already = ScriptApp.getProjectTriggers()
      .some(function(t) { return t.getHandlerFunction() === "processWebhookBuffer_"; });
    if (!already) {
      ScriptApp.newTrigger("processWebhookBuffer_").timeBased().after(15000).create();
      Logger.log("[WH] Trigger xu ly sau 15s");
    }
    return _json({ok: true});
  } catch(ex) {
    Logger.log("[WH] ERR: " + ex.message);
    return _json({ok: true});
  }
}

function processWebhookBuffer_() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === "processWebhookBuffer_"; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });

  var props = PropertiesService.getScriptProperties();
  var text  = props.getProperty("SD_WH_BUF") || "";
  props.deleteProperty("SD_WH_BUF");
  props.deleteProperty("SD_WH_TS");

  if (!text || text.length < 30) { Logger.log("[ProcBuf] Rong -> skip"); return; }
  Logger.log("[ProcBuf] " + text.length + " ky tu -> ghi Col A");

  var ss    = SpreadsheetApp.openById(SD_SHEET_ID);
  var sheet = getSheetByGid(ss, SD_SHEET_GID);
  if (!sheet) { Logger.log("[ProcBuf] Sheet not found"); return; }

  var maxRow = Math.max(sheet.getLastRow(), 500);
  sheet.getRange(1, 1, maxRow, 1).clearContent();
  var lines = text.split("\n").map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
  if (lines.length > 0) {
    sheet.getRange(1, 1, lines.length, 1).setValues(lines.map(function(l) {
      var str = String(l);
      return [(/^[=\+\-@]/.test(str)) ? "'" + str : str];
    }));
  }

  props.deleteProperty(TS_KEY_A1);
  SpreadsheetApp.flush();
  Utilities.sleep(2000);
  SpreadsheetApp.flush();

  Logger.log("[ProcBuf] " + lines.length + " dong -> checkAndSend");
  checkAndSend(true);
}

function sendDownTniCommand_() {
  if (!SD_BOTLOOKUP_CHAT_ID) { Logger.log("[Cmd] SD_BOTLOOKUP_CHAT_ID chua set"); return; }
  try {
    var resp = UrlFetchApp.fetch(
      "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/sendMessage",
      {
        method: "post", contentType: "application/json",
        payload: JSON.stringify({ chat_id: SD_BOTLOOKUP_CHAT_ID, text: "/down_tni@auto_nocpro_bot" }),
        muteHttpExceptions: true
      }
    );
    var r = JSON.parse(resp.getContentText());
    Logger.log("[Cmd] " + (r.ok ? "OK" : "FAIL") + " /down_tni -> BOT LOOKUP");
  } catch(ex) { Logger.log("[Cmd] ERR: " + ex.message); }
}

function setupWebhook() {
  var gasUrl = ScriptApp.getService().getUrl();
  var resp = UrlFetchApp.fetch(
    "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/setWebhook",
    {
      method: "post", contentType: "application/json",
      payload: JSON.stringify({
        url: gasUrl,
        allowed_updates: ["message", "channel_post"],
        drop_pending_updates: true,
        max_connections: 40
      }),
      muteHttpExceptions: true
    }
  );
  var r = JSON.parse(resp.getContentText());
  Logger.log("[setupWebhook] " + JSON.stringify(r) + " | URL: " + gasUrl);
  if (r.ok) Logger.log("Webhook dang ky thanh cong!");
  else Logger.log("Loi: " + r.description);
}

function deleteWebhook() {
  var resp = UrlFetchApp.fetch(
    "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/deleteWebhook",
    { method: "post", muteHttpExceptions: true }
  );
  Logger.log("[deleteWebhook] " + resp.getContentText());
}

function getWebhookInfo() {
  var resp = UrlFetchApp.fetch(
    "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/getWebhookInfo",
    { muteHttpExceptions: true }
  );
  Logger.log("[getWebhookInfo] " + resp.getContentText());
}
