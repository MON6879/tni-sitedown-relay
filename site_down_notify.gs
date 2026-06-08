// ============================================================
// TNI Site Down Auto-Notification — v3 (Full Auto)
// ============================================================
// Flow:
//   1. Ai gửi báo cáo site down vào Group CONTROL SITE
//   2. Bot nhận → webhook gọi doPost()
//   3. Apps Script ghi vào Cột A của Sheet
//   4. checkAndSend() chạy ngay:
//      - Tin 1: Cột C → từng Team (site list chi tiết)
//      - Tin 2: AW4:AZ8 → từng Team + Control (summary)
// ============================================================

// ── Bot ─────────────────────────────────────────────────────
const SD_BOT_TOKEN = "8647102342:AAGwI95-xeyFfJZusOOrIPVBER-z6taZHZI";

// ── Group Chat IDs ───────────────────────────────────────────
const SD_GROUPS = {
  T1:      "-5180992881",   // TNI TEAM 1
  T2:      "-5188855349",   // TNI TEAM 2 (T2 + T5)
  T3:      "-5183480727",   // TNI TEAM 3
  T4:      "-5238696719",   // TNI TEAM 4
  CONTROL: "-5251698940",   // TNI TECHNICA DEP CONTROL SITE
};

// ── Sheet ────────────────────────────────────────────────────
const SD_SHEET_ID  = "1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow";
const SD_SHEET_GID = "0";

// ── Timestamp keys (PropertiesService) ──────────────────────
// Tin 1 dùng A1 timestamp, Tin 2 dùng AW4 timestamp — độc lập nhau.
const TS_KEY_A1  = "SD_LAST_TS_A1";   // Tin 1: Col A → Col C per-team
const TS_KEY_AW4 = "SD_LAST_TS_AW4";  // Tin 2: AW4:AZ8 summary

// ── AW:AZ column index (0-based) ────────────────────────────
const AWAZ_COL = { T1: 0, T2: 1, T3: 2, T4: 3 };

// ── Row labels trong AW4:AZ8 ────────────────────────────────
const AWAZ_LABELS = [
  { emoji: "⚡", name: "Site down"   },
  { emoji: "🔴", name: "Cell down"   },
  { emoji: "⚙️", name: "DG Abnormal" },
  { emoji: "⏱️", name: "DG Run>16H"  },
  { emoji: "🔗", name: "Link down"   },
];


// ============================================================
// WEBHOOK ENTRY POINT — Telegram gọi khi có tin nhắn mới
// ============================================================
function doPost(e) {
  try {
    const update = JSON.parse(e.postData.contents);
    const msg    = update.message || update.channel_post;
    if (!msg) return okJson({ status: "no_message" });

    const chatId = msg.chat.id.toString();
    const text   = (msg.text || msg.caption || "").trim();

    Logger.log("📨 Nhận tin từ chat: " + chatId + " | " + text.substring(0, 80));

    // ── Chỉ xử lý tin từ Group CONTROL ──────────────────────
    if (chatId !== SD_GROUPS.CONTROL) {
      Logger.log("⏭️ Bỏ qua — không phải group CONTROL (" + chatId + ")");
      return okJson({ status: "ignored" });
    }

    // ── Kiểm tra có phải báo cáo site down không ────────────
    if (!isSiteDownReport(text)) {
      Logger.log("⏭️ Tin nhắn không phải báo cáo site down — bỏ qua");
      return okJson({ status: "not_report" });
    }

    Logger.log("✅ Phát hiện báo cáo site down mới — xử lý...");

    // ── Ghi vào Cột A của Sheet ──────────────────────────────
    const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
    const sheet = getSheetByGid(ss, SD_SHEET_GID);
    if (!sheet) return okJson({ status: "sheet_not_found" });

    writeToColumnA(sheet, text);
    Logger.log("📝 Đã ghi vào Cột A");

    // ── Chờ Sheet tính toán xong rồi gửi ────────────────────
    SpreadsheetApp.flush();
    Utilities.sleep(3000); // Chờ 3 giây cho công thức cập nhật

    // ── Kích hoạt gửi tin ────────────────────────────────────
    checkAndSend();

    return okJson({ status: "ok" });

  } catch (err) {
    Logger.log("❌ doPost error: " + err.message);
    return okJson({ status: "error", message: err.message });
  }
}


// ============================================================
// KIỂM TRA có phải báo cáo site down không
// ============================================================
function isSiteDownReport(text) {
  return /site down/i.test(text) &&
         /tanintharyi/i.test(text) &&
         /\d{2}\/\d{2}\/\d{4}/i.test(text);
}


// ============================================================
// GHI DỮ LIỆU VÀO CỘT A (xóa cũ, ghi mới từng dòng)
// ============================================================
function writeToColumnA(sheet, text) {
  // Tách text thành từng dòng
  const lines = text.split("\n");

  // Xóa dữ liệu cũ trong Cột A
  const lastRow = sheet.getLastRow();
  if (lastRow > 0) {
    sheet.getRange(1, 1, lastRow, 1).clearContent();
  }

  // Ghi từng dòng vào Cột A (A1, A2, A3...)
  const writeData = lines.map(line => [line]);
  if (writeData.length > 0) {
    sheet.getRange(1, 1, writeData.length, 1).setValues(writeData);
  }

  Logger.log("📝 Đã ghi " + writeData.length + " dòng vào Cột A");
}


// ============================================================
// ENTRY POINT — Trigger 5 phút gọi hàm này
// (cũng được gọi từ doPost sau khi ghi Cột A)
// ============================================================
function checkAndSend() {
  // Chống gửi 2 lần khi trigger 5phút và doPost cùng chạy
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) {
    Logger.log("⏭️ checkAndSend: đang có execution khác chạy — bỏ qua");
    return;
  }
  try {
    const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
    const sheet = getSheetByGid(ss, SD_SHEET_GID);
    if (!sheet) { Logger.log("❌ Không tìm thấy sheet"); return; }

    // Hai luồng độc lập nhau — mỗi luồng tự kiểm tra timestamp riêng
    checkColC(sheet);   // Tin 1: A1 timestamp → Col C per-team + CONTROL
    checkAwAz(sheet);   // Tin 2: AW4 timestamp → AW:AZ summary per-team

  } finally {
    lock.releaseLock();
  }
}


// ============================================================
// TIN 1 — Cột C: site list chi tiết
// Trigger: A1 timestamp thay đổi
// Gửi:
//   - Per-team (format đẹp) → từng nhóm Team
//   - Toàn bộ Col C (nguyên văn) → nhóm CONTROL
// ============================================================
function checkColC(sheet) {
  const raw = sheet.getRange("A1").getValue().toString().trim();
  if (!raw) { Logger.log("[Tin1] A1 rỗng — bỏ qua"); return; }

  // Dùng toàn bộ nội dung A1 để phát hiện thay đổi
  // (không chỉ so timestamp — tránh bỏ sót khi same-minute update)
  const props   = PropertiesService.getScriptProperties();
  const lastKey = props.getProperty(TS_KEY_A1) || "";
  if (raw === lastKey) { Logger.log("[Tin1] A1 không đổi — bỏ qua"); return; }

  // Lấy timestamp để hiển thị trong tin nhắn
  const ts = parseA1Timestamp(sheet) || raw.substring(0, 60);
  Logger.log("[Tin1] 🆕 A1 thay đổi → ts=" + ts + " → gửi site list...");

  const colCData = readColC(sheet);
  const teams    = ["T1", "T2", "T3", "T4"];

  // ① Gửi tin per-team (format đẹp) → từng nhóm Team
  for (const team of teams) {
    const chatId = SD_GROUPS[team];
    if (!chatId) continue;
    const msg = buildColCMessage(team, ts, colCData[team] || []);
    sendTelegram(chatId, msg, "[Tin1][" + team + "]");
  }

  // ② Gửi toàn bộ Col C (nguyên văn, không đổi gì) → nhóm CONTROL
  const controlId = SD_GROUPS["CONTROL"];
  if (controlId) {
    const rawColC = readColCRaw(sheet);
    if (rawColC) {
      sendTelegramPlain(controlId, rawColC, "[Tin1][CONTROL-RAW]");
    } else {
      // Fallback nếu raw rỗng: dùng format tổng hợp
      const msg = buildColCControlMessage(ts, colCData);
      sendTelegramPlain(controlId, msg, "[Tin1][CONTROL-FMT]");
    }
  }

  props.setProperty(TS_KEY_A1, raw);  // lưu toàn bộ A1, không chỉ timestamp
  Logger.log("[Tin1] ✅ Xong — lưu timestamp: " + ts);
}


// ============================================================
// TIN 2 — AW:AZ: summary (Site/Cell/DG/Link)
// Trigger: AW4 timestamp thay đổi
// ============================================================
function checkAwAz(sheet) {
  const ts = parseAW4Timestamp(sheet);
  if (!ts) { Logger.log("[Tin2] Không có timestamp trong AW4"); return; }

  const props  = PropertiesService.getScriptProperties();
  const lastTs = props.getProperty(TS_KEY_AW4) || "";
  if (ts === lastTs) { Logger.log("[Tin2] AW4 không đổi (" + ts + ") — bỏ qua"); return; }

  Logger.log("[Tin2] 🆕 " + ts + " → gửi summary...");

  const awaz  = readAwAz(sheet);
  const teams = ["T1", "T2", "T3", "T4"];

  // Gửi từng team
  for (const team of teams) {
    const chatId = SD_GROUPS[team];
    if (!chatId) continue;
    const msg = buildAwAzTeamMessage(team, ts, awaz, AWAZ_COL[team]);
    sendTelegram(chatId, msg, "[Tin2][" + team + "]");
  }

  // Gửi Tin 2 tổng hợp vào Control (plain text để tránh lỗi ký tự)
  const controlId = SD_GROUPS["CONTROL"];
  if (controlId) {
    try {
      const msg = buildAwAzControlMessage(ts, awaz);
      sendTelegramPlain(controlId, msg, "[Tin2][CONTROL]");
    } catch(e) {
      Logger.log("[Tin2][CONTROL] ❌ Lỗi: " + e.message);
    }
  }

  props.setProperty(TS_KEY_AW4, ts);
  Logger.log("[Tin2] ✅ Xong — lưu timestamp: " + ts);
}


// ============================================================
// PARSE TIMESTAMP từ A1
// "Site down ... in Tanintharyi Region - 08/06/2026 11:00:00"
// NOTE: Bỏ anchor $ — tìm date ở BẤT KỲ đâu trong chuỗi, không yêu cầu ở cuối
// (phòng trường hợp có * hoặc ký tự markdown sau ngày giờ)
// ============================================================
function parseA1Timestamp(sheet) {
  const raw = sheet.getRange("A1").getValue().toString();
  Logger.log("[A1 raw] " + raw.substring(0, 120));
  // Ưu tiên HH:MM:SS
  const m1 = raw.match(/(\d{2}\/\d{2}\/\d{4}[\s\-T]+\d{2}:\d{2}:\d{2})/);
  if (m1) return m1[1].replace(/[\-T]/g, " ").trim();
  // Fallback HH:MM
  const m2 = raw.match(/(\d{2}\/\d{2}\/\d{4}[\s\-T]+\d{2}:\d{2})/);
  return m2 ? m2[1].replace(/[\-T]/g, " ").trim() : null;
}


// ============================================================
// PARSE TIMESTAMP từ AW4
// "*Site down: 08/06/2026 10:20 = 12*"
// ============================================================
function parseAW4Timestamp(sheet) {
  const raw = sheet.getRange("AW4").getValue().toString();
  const m   = raw.match(/Site down:\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/i);
  return m ? m[1].trim() : null;
}


// ============================================================
// ĐỌC CỘT C RAW — Trả về toàn bộ nội dung cột C (nguyên văn)
// Dùng để gửi nguyên xi cho nhóm CONTROL (không format lại)
// ============================================================
function readColCRaw(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return "";
  const data = sheet.getRange(1, 3, lastRow, 1).getValues().flat();
  const lines = data
    .map(cell => (cell || "").toString().trim())
    .filter(line => line.length > 0);
  return lines.join("\n");
}


// ============================================================
// ĐỌC CỘT C — Tách site theo team (T5 gộp vào T2)
// ============================================================
function readColC(sheet) {
  const result  = { T1: [], T2: [], T3: [], T4: [] };
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return result;

  const data = sheet.getRange(1, 3, lastRow, 1).getValues().flat();
  for (const cell of data) {
    const text = (cell || "").toString().trim();
    if (!text) continue;
    if (/^Team\s+\d+:/i.test(text))    continue;
    if (/^Total Site down/i.test(text)) continue;
    if (/^TNI Site down/i.test(text))   continue;

    const m = text.match(
      /^\d+:\s*(TNI\w+)\s*\|\s*(T\d)\s*\|\s*([\d.]+)\s*\|\s*(\w[\w_]*)\s*\|\s*([\w+]+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*\d+\s*\|?\s*(.*)/i
    );
    if (!m) continue;

    const [, tniCode, teamRaw, duration, owner, power, township, ftName, eatRaw] = m;
    const obj = {
      tniCode,
      duration: parseFloat(duration),
      owner,
      power,
      township: township.trim(),
      ftName:   ftName.trim(),
      eat:      eatRaw.replace(/^EAT:\s*/i, "").trim(),
    };

    const team = teamRaw.toUpperCase();
    if      (team === "T1")                    result.T1.push(obj);
    else if (team === "T2" || team === "T5")   result.T2.push(obj);
    else if (team === "T3")                    result.T3.push(obj);
    else if (team === "T4")                    result.T4.push(obj);
  }
  return result;
}


// ============================================================
// ĐỌC AW4:AZ8 — 5 rows × 4 cols
// ============================================================
function readAwAz(sheet) {
  return sheet.getRange(4, 49, 5, 4).getValues(); // AW=col49
}


// ============================================================
// BUILD Tin 1 — Cột C cho từng Team
// ============================================================
function buildColCMessage(teamKey, ts, sites) {
  const label = teamKey === "T2" ? "Team 2 (T2+T5)" : teamKey.replace("T", "Team ");
  const lines = [];
  lines.push("📋 <b>SITE DOWN — " + label + "</b>");
  lines.push("📅 " + escHtml(ts) + "  |  Tổng: <b>" + sites.length + "</b> sites");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (sites.length === 0) {
    lines.push("✅ Không có site down");
  } else {
    const nums = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
    sites.forEach((s, i) => {
      const num = i < nums.length ? nums[i] : (i + 1) + ".";
      lines.push("");
      lines.push(num + " <b>" + escHtml(s.tniCode) + "</b> │ " + escHtml(s.duration) + "h │ " + escHtml(s.owner) + " │ " + escHtml(s.power));
      lines.push("   📍 " + escHtml(s.township) + "  👤 " + escHtml(s.ftName));
      if (s.eat) lines.push("   💬 <i>" + escHtml(s.eat) + "</i>");
    });
  }
  return lines.join("\n");
}




// Escape HTML — tránh lỗi ký tự < > & trong dữ liệu
function escHtml(str) {
  return (str || "").toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ============================================================
// BUILD Tin 2 — AW:AZ cho từng Team (HTML format)
// ============================================================
function buildAwAzTeamMessage(teamKey, ts, awaz, colIdx) {
  const label = teamKey === "T2" ? "Team 2 (T2+T5)" : teamKey.replace("T", "Team ");
  const lines = [];
  lines.push("📊 <b>SUMMARY — " + label + "</b>");
  lines.push("📅 " + escHtml(ts));
  lines.push("━".repeat(26));

  let hasData = false;
  for (let r = 0; r < 5; r++) {
    const txt = ((awaz[r] || [])[colIdx] || "").toString().trim();
    if (!txt || txt === "0") continue;
    // Xóa markdown * _ ` rồi wrap HTML
    const clean = escHtml(txt.replace(/[*_`]/g, ""));
    lines.push(AWAZ_LABELS[r].emoji + " <b>" + AWAZ_LABELS[r].name + ":</b> " + clean);
    hasData = true;
  }
  if (!hasData) lines.push("✅ Không có sự cố");
  return lines.join("\n");
}


// ============================================================
// BUILD Tin 1 — Cột C tổng hợp cho Control (tất cả team)
// ============================================================
function buildColCControlMessage(ts, colCData) {
  const teamLabels = {
    T1: "Team 1",
    T2: "Team 2 (T2+T5)",
    T3: "Team 3",
    T4: "Team 4",
  };
  const lines = [];
  lines.push("SITE DOWN TONG HOP - TAT CA TEAM");
  lines.push("Ngay: " + ts);
  lines.push("");

  for (const team of ["T1", "T2", "T3", "T4"]) {
    const sites = colCData[team] || [];
    lines.push("=== " + teamLabels[team] + " (" + sites.length + " sites) ===");
    if (sites.length === 0) {
      lines.push("  Khong co site down");
    } else {
      sites.forEach((s, i) => {
        lines.push((i+1) + ". " + s.tniCode + " | " + s.duration + "h | " + s.owner + " | " + s.power);
        lines.push("   " + s.township + " - " + s.ftName);
        if (s.eat) lines.push("   >> " + s.eat);
      });
    }
    lines.push("");
  }
  return lines.join("\n");
}


// ============================================================
// BUILD Tin 2 — AW:AZ tổng hợp cho Control (4 team, plain text)
// ============================================================
function buildAwAzControlMessage(ts, awaz) {
  const teamLabels = ["Team 1", "Team 2 (T2+T5)", "Team 3", "Team 4"];
  const lines = [];
  lines.push("SUMMARY TONG HOP - TAT CA TEAM");
  lines.push("Thoi gian: " + ts);

  for (let col = 0; col < 4; col++) {
    lines.push("");
    lines.push("--- " + teamLabels[col] + " ---");
    let hasData = false;
    for (let r = 0; r < 5; r++) {
      const txt = ((awaz[r] || [])[col] || "").toString().trim();
      if (!txt || txt === "0") continue;
      // Xóa ký tự markdown (* _ `) để tránh lỗi
      const clean = txt.replace(/[*_`]/g, "");
      lines.push(AWAZ_LABELS[r].name + ": " + clean);
      hasData = true;
    }
    if (!hasData) lines.push("Khong co su co");
  }
  return lines.join("\n");
}


// ============================================================
// GỬI TELEGRAM (tự chia nếu > 4000 ký tự)
// ============================================================
function sendTelegram(chatId, text, tag) {
  const url    = "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/sendMessage";
  const chunks = splitMessage(text, 4000);
  chunks.forEach((chunk, i) => {
    try {
      const resp   = UrlFetchApp.fetch(url, {
        method:             "post",
        contentType:        "application/json",
        // Dùng HTML thay Markdown — tránh lỗi ký tự _ trong tên (OCK_MYTEL, PAT_POWER...)
        payload:            JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: "HTML" }),
        muteHttpExceptions: true,
      });
      const res = JSON.parse(resp.getContentText());
      Logger.log((tag||"") + (res.ok ? " ✅ OK→" : " ❌ ERR→") + chatId +
        (chunks.length > 1 ? " [" + (i+1) + "/" + chunks.length + "]" : "") +
        (!res.ok ? " | " + res.description : ""));
    } catch (e) {
      Logger.log((tag||"") + " ❌ " + e.message);
    }
  });
}


// ============================================================
// GỬI TELEGRAM plain text — KHÔNG Markdown (dùng cho Control)
// Tránh lỗi ký tự đặc biệt * _ ` trong data thực tế
// ============================================================
function sendTelegramPlain(chatId, text, tag) {
  const url    = "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/sendMessage";
  const chunks = splitMessage(text, 4000);
  chunks.forEach((chunk, i) => {
    try {
      const resp = UrlFetchApp.fetch(url, {
        method:             "post",
        contentType:        "application/json",
        payload:            JSON.stringify({ chat_id: chatId, text: chunk }),
        muteHttpExceptions: true,
      });
      const res = JSON.parse(resp.getContentText());
      Logger.log((tag||"")
        + (res.ok ? " ✅ OK→" : " ❌ ERR→") + chatId
        + (chunks.length > 1 ? " [" + (i+1) + "/" + chunks.length + "]" : "")
        + (!res.ok ? " | " + res.description : ""));
    } catch (e) {
      Logger.log((tag||"") + " ❌ " + e.message);
    }
  });
}


// ============================================================
// CHIA TIN NHẮN DÀI
// ============================================================
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


// ============================================================
// HELPER — Lấy sheet theo GID
// ============================================================
function getSheetByGid(ss, gid) {
  for (const s of ss.getSheets()) {
    if (s.getSheetId().toString() === gid.toString()) return s;
  }
  return null;
}


// ============================================================
// RESPONSE HELPER
// ============================================================
function okJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ============================================================
// KIỂM TRA WEBHOOK HIỆN TẠI
// Chạy hàm này để xem webhook đang trỏ đến URL nào
// ============================================================
function checkWebhook() {
  const resp = UrlFetchApp.fetch(
    "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/getWebhookInfo"
  );
  const info = JSON.parse(resp.getContentText());
  if (!info.ok) { Logger.log("❌ Bot lỗi: " + info.description); return; }
  const r = info.result;
  Logger.log("=== WEBHOOK STATUS ===");
  Logger.log("📡 URL: " + (r.url || "(chưa set — webhook trống!)"));
  Logger.log("⏳ Pending updates: " + (r.pending_update_count || 0));
  Logger.log("❌ Last error: " + (r.last_error_message || "không có"));
  Logger.log("📅 Last error date: " + (r.last_error_date ? new Date(r.last_error_date*1000).toLocaleString() : "—"));
  if (!r.url) {
    Logger.log("\n⚠️ WEBHOOK CHƯA ĐƯỢC SET!");
    Logger.log("👉 Bước 1: Deploy script → Deploy > New deployment > Web app");
    Logger.log("👉 Bước 2: Copy URL (dạng .../exec)");
    Logger.log("👉 Bước 3: Chạy setWebhookDirect('<URL vừa copy>')");
  }
}


// ============================================================
// SET WEBHOOK TRỰC TIẾP (không cần PropertiesService)
// Ví dụ: setWebhookDirect("https://script.google.com/macros/s/ABC.../exec")
// ============================================================
function setWebhookDirect(webAppUrl) {
  if (!webAppUrl) {
    // Thử lấy từ Properties
    webAppUrl = PropertiesService.getScriptProperties().getProperty("WEBAPP_URL") || "";
  }
  if (!webAppUrl) {
    Logger.log("❌ Cần truyền URL vào: setWebhookDirect('https://script.google.com/...')");
    return;
  }
  const resp = UrlFetchApp.fetch(
    "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/setWebhook", {
    method:      "post",
    contentType: "application/json",
    payload:     JSON.stringify({ url: webAppUrl, allowed_updates: ["message","channel_post"] }),
  });
  const res = JSON.parse(resp.getContentText());
  Logger.log(res.ok
    ? "✅ Webhook đã set: " + webAppUrl
    : "❌ Lỗi: " + res.description);
  // Lưu lại để dùng sau
  if (res.ok) PropertiesService.getScriptProperties().setProperty("WEBAPP_URL", webAppUrl);
}


// ============================================================
// SETUP WEBHOOK — (legacy) Dùng URL từ PropertiesService
// ============================================================
function setWebhook() {
  const WEBAPP_URL = PropertiesService.getScriptProperties().getProperty("WEBAPP_URL") || "";
  if (!WEBAPP_URL) {
    Logger.log("❌ Chưa có WEBAPP_URL — dùng setWebhookDirect('<URL>') thay thế");
    return;
  }
  setWebhookDirect(WEBAPP_URL);
}

// Xóa webhook (để test thủ công bằng getUpdates)
function deleteWebhook() {
  const resp = UrlFetchApp.fetch(
    "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/deleteWebhook"
  );
  Logger.log("deleteWebhook → " + resp.getContentText());
}

// Kiểm tra webhook hiện tại
function getWebhookInfo() {
  const resp = UrlFetchApp.fetch(
    "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/getWebhookInfo"
  );
  Logger.log("webhookInfo → " + resp.getContentText());
}


// ============================================================
// SETUP TRIGGER — Chạy 1 lần để cài lịch 5 phút (backup)
// ============================================================
function setupSdTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "checkAndSend")
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("checkAndSend").timeBased().everyMinutes(5).create();
  Logger.log("✅ Trigger đã cài: checkAndSend() mỗi 5 phút");
}


// ============================================================
// TEST FUNCTIONS
// ============================================================

// Ép gửi cả 2 tin (bỏ qua timestamp)
function testSendNow() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(TS_KEY_A1);
  props.deleteProperty(TS_KEY_AW4);
  Logger.log("🧪 Xóa timestamp → ép gửi cả 2 tin...");
  checkAndSend();
}

// Test chỉ Tin 1 (Cột C) — ép gửi ngay
function testTin1Only() {
  const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
  const sheet = getSheetByGid(ss, SD_SHEET_GID);

  // Flush để đảm bảo công thức Col C đã tính xong
  SpreadsheetApp.flush();
  Utilities.sleep(2000);

  // Xóa stored key → ép detect là mới
  PropertiesService.getScriptProperties().deleteProperty(TS_KEY_A1);
  checkColC(sheet);
  Logger.log("🧪 testTin1Only: xong — kiểm tra Telegram");
}


// ============================================================
// PING TEST — Gửi tin thử vào CONTROL để kiểm tra bot hoạt động
// Nếu nhận được tin “🤖 Bot hoạt động” thì bot đúng, lỗi ở chỗ khác
// ============================================================
function testPingBot() {
  const controlId = SD_GROUPS["CONTROL"];
  Logger.log("🤖 Gửi ping đến: " + controlId);
  const url  = "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/sendMessage";
  const resp = UrlFetchApp.fetch(url, {
    method:             "post",
    contentType:        "application/json",
    payload:            JSON.stringify({
      chat_id: controlId,
      text:    "🤖 <b>Bot hoạt động bình thường</b>\n⏰ " + new Date().toLocaleString(),
      parse_mode: "HTML"
    }),
    muteHttpExceptions: true,
  });
  const res = JSON.parse(resp.getContentText());
  Logger.log(res.ok ? "✅ Ping OK" : "❌ Ping FAIL: " + res.description);
}

// Test chỉ Tin 2 (AW:AZ)
function testTin2Only() {
  const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
  const sheet = getSheetByGid(ss, SD_SHEET_GID);
  PropertiesService.getScriptProperties().deleteProperty(TS_KEY_AW4);
  checkAwAz(sheet);
}

// Xem timestamp đang lưu
function showTimestamps() {
  const p = PropertiesService.getScriptProperties();
  Logger.log("📌 Tin1 (A1)  last sent: " + (p.getProperty(TS_KEY_A1)  || "(chưa có)"));
  Logger.log("📌 Tin2 (AW4) last sent: " + (p.getProperty(TS_KEY_AW4) || "(chưa có)"));
}


// ============================================================
// DEBUG — Kiểm tra A1 đang chứa gì + timestamp parse được gì
// Chạy hàm này trong Apps Script Editor để debug
// ============================================================
function testDebugA1() {
  const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
  const sheet = getSheetByGid(ss, SD_SHEET_GID);
  if (!sheet) { Logger.log("❌ Không tìm thấy sheet"); return; }

  const raw = sheet.getRange("A1").getValue().toString();
  Logger.log("🔍 A1 raw (120 chữ): " + raw.substring(0, 120));
  Logger.log("🔍 A1 length: " + raw.length);

  const ts = parseA1Timestamp(sheet);
  Logger.log("⏱️ parseA1Timestamp: " + (ts || "(null — không match regex!)"));

  const p = PropertiesService.getScriptProperties();
  const stored = p.getProperty(TS_KEY_A1) || "(chưa có)";
  Logger.log("💾 TS_KEY_A1 stored: " + stored.substring(0, 120));
  Logger.log("❓ Sẽ gửi Tin1? " + (raw.trim() !== stored.trim() ? "✅ Có (A1 đã thay đổi)" : "❌ Không (A1 giống stored)"));

  // Kiểm tra AW4
  const aw4 = sheet.getRange("AW4").getValue().toString();
  Logger.log("🔍 AW4 raw (100 chữ): " + aw4.substring(0, 100));
  const tsAw4 = parseAW4Timestamp(sheet);
  Logger.log("⏱️ parseAW4Timestamp: " + (tsAw4 || "(null)"));
  const storedAw4 = p.getProperty(TS_KEY_AW4) || "(chưa có)";
  Logger.log("💾 TS_KEY_AW4 stored: " + storedAw4);
  Logger.log("❓ Sẽ gửi Tin2? " + (tsAw4 && tsAw4 !== storedAw4 ? "✅ Có" : "❌ Không"));
}


// ============================================================
// DAT WEBHOOK - Chay ham nay 1 lan de ket noi Telegram -> Script
// Web App URL da duoc dien san, chi can Run la xong
// ============================================================
function mySetWebhook() {
  setWebhookDirect("https://script.google.com/macros/s/AKfycbymHq-f8StoSUfs_t5CtDhg1mVG6TUAo4IVIz4Nu4pahiR9yfJq1zeFPsRF7JCjyGmzxA/exec");
}
