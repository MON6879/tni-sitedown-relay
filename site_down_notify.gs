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

// ── Cá nhân nhận báo cáo tổng hợp (DM trực tiếp) ────────────
// TNI = Ha Duc Phong _070756_TNI (@Phongha79)
const SD_PERSONAL_IDS = [
  "6859790680",   // TNI (Ha Duc Phong) — nhận FULL báo cáo giống CONTROL
];

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
// POLLING — Trigger 5 phút tự lấy tin từ Telegram (thay webhook)
// Không cần Web App deployment, không bị lỗi 302
// ============================================================
const LAST_UPDATE_KEY = "SD_LAST_UPDATE_ID";

function fetchTelegramUpdates(sheet) {
  const props        = PropertiesService.getScriptProperties();
  const lastId       = parseInt(props.getProperty(LAST_UPDATE_KEY) || "0");
  const offsetToUse  = lastId === 0 ? 0 : lastId + 1;
  const url          = "https://api.telegram.org/bot" + SD_BOT_TOKEN
                     + "/getUpdates?offset=" + offsetToUse
                     + "&limit=100&allowed_updates=message,channel_post";

  Logger.log("[Poll] lastId=" + lastId + " → offset=" + offsetToUse);

  let data;
  try {
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const raw  = resp.getContentText();
    Logger.log("[Poll] raw (200): " + raw.substring(0, 200));
    data = JSON.parse(raw);
  } catch (e) {
    Logger.log("[Poll] ❌ getUpdates lỗi: " + e.message);
    return false;
  }

  if (!data.ok) {
    Logger.log("[Poll] ❌ Telegram lỗi: " + data.description);
    return false;
  }

  const updates = data.result || [];
  if (updates.length === 0) {
    Logger.log("[Poll] Không có tin mới");
    return false;
  }

  let maxId       = lastId;
  let latestReport = null;

  for (const upd of updates) {
    if (upd.update_id > maxId) maxId = upd.update_id;

    const msg    = upd.message || upd.channel_post;
    if (!msg) continue;

    const chatId = msg.chat.id.toString();
    if (chatId !== SD_GROUPS.CONTROL) continue;

    const text = (msg.text || msg.caption || "").trim();
    if (!isSiteDownReport(text)) continue;

    latestReport = text;   // lấy báo cáo mới nhất
    Logger.log("[Poll] ✅ Phát hiện báo cáo site down — " + text.substring(0, 60));
  }

  // Đánh dấu đã xử lý tất cả updates
  props.setProperty(LAST_UPDATE_KEY, maxId.toString());
  Logger.log("[Poll] Đã xử lý " + updates.length + " updates, lastId=" + maxId);

  if (latestReport) {
    writeToColumnA(sheet, latestReport);
    Logger.log("[Poll] 📝 Đã ghi báo cáo mới vào Cột A");
    // Xóa key cũ → checkColC() sẽ luôn gửi dù timestamp A1 giống cũ
    PropertiesService.getScriptProperties().deleteProperty(TS_KEY_A1);
    SpreadsheetApp.flush();
    Utilities.sleep(3000);  // chờ công thức Col C cập nhật
    return true;   // có báo cáo mới
  }
  return false;
}


// ============================================================
// doPost — Giữ lại để tương thích nếu webhook hoạt động sau này
// ============================================================
function doPostSiteDown(e) {
  try {
    const update = JSON.parse(e.postData.contents);
    const msg    = update.message || update.channel_post;
    if (!msg) return okJson({ status: "no_message" });
    const chatId = msg.chat.id.toString();
    const text   = (msg.text || msg.caption || "").trim();
    if (chatId !== SD_GROUPS.CONTROL || !isSiteDownReport(text))
      return okJson({ status: "ignored" });
    const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
    const sheet = getSheetByGid(ss, SD_SHEET_GID);
    if (sheet) { writeToColumnA(sheet, text); SpreadsheetApp.flush(); Utilities.sleep(3000); checkAndSend(); }
    return okJson({ status: "ok" });
  } catch (err) {
    Logger.log("\u274c doPost error: " + err.message);
    return okJson({ status: "error", message: err.message });
  }
}


// ============================================================
// KIỂM TRA có phải báo cáo site down không
// ============================================================
function isSiteDownReport(text) {
  return /site down/i.test(text) &&
         (/tanintharyi/i.test(text) || /\bTNI\b/.test(text) || /TNI\d{4}/.test(text)) &&
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
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) {
    Logger.log("⏭️ checkAndSend: đang có execution khác — bỏ qua");
    return;
  }
  try {
    const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
    const sheet = getSheetByGid(ss, SD_SHEET_GID);
    if (!sheet) { Logger.log("❌ Không tìm thấy sheet"); return; }

    // ── BƯỚC 1: Poll Telegram lấy báo cáo mới → ghi Cột A ──
    fetchTelegramUpdates(sheet);

    // ── BƯỚC 2: Kiểm tra và gửi tin ─────────────────────────
    checkColC(sheet);   // Tin 1: A1 thay đổi → Col C per-team + CONTROL
    checkAwAz(sheet);   // Tin 2: AW4 thay đổi → AW:AZ summary per-team

  } finally {
    lock.releaseLock();
  }
}


// ============================================================
// RELAY — Trigger mỗi 30 phút
// Bước 1: Gọi GitHub API dispatch botlookup_relay.yml
//         → botlookup_relay.py chạy → lấy data bot → gọi GAS → ghi Cột A
// Bước 2: checkAndSend() để gửi nếu Cột A đã có data
// ============================================================
function relayBotlookupToTNI() {
  Logger.log("[relayBotlookupToTNI] Bắt đầu trigger 30p");

  // Bước 1: Dispatch GitHub Actions workflow
  const dispatched = triggerBotlookupRelay();
  if (dispatched) {
    Logger.log("[relayBotlookupToTNI] ✅ GitHub Actions đã dispatch — botlookup_relay.py sẽ gọi GAS sau ~2-3p");
  } else {
    Logger.log("[relayBotlookupToTNI] ⚠️ Không dispatch được GitHub Actions (thiếu GITHUB_PAT?)");
  }

  // Bước 2: Chạy checkAndSend để gửi nếu Cột A đã có data
  checkAndSend();

  // Bước 3: Nếu đang trong giờ 17 Myanmar → dispatch check_read_status (1 lần/ngày)
  const myanmarHour = parseInt(Utilities.formatDate(new Date(), "Asia/Rangoon", "H"), 10);
  if (myanmarHour === 17) {
    const todayKey = "READ_CHECK_DATE_" + Utilities.formatDate(new Date(), "Asia/Rangoon", "yyyyMMdd");
    const props    = PropertiesService.getScriptProperties();
    if (!props.getProperty(todayKey)) {
      const ok = triggerReadStatusCheck();
      if (ok) {
        props.setProperty(todayKey, "done");
        Logger.log("[relayBotlookupToTNI] ✅ Dispatch check_read_status lúc 17:xx Myanmar");
      }
    } else {
      Logger.log("[relayBotlookupToTNI] ℹ️ check_read_status đã chạy hôm nay rồi — bỏ qua");
    }
  }
}


// ============================================================
// HELPER — Dispatch GitHub Actions workflow check_read_status.yml
// Chạy 1 lần/ngày lúc 17:xx Myanmar → báo cáo ai đọc Note
// ============================================================
function triggerReadStatusCheck() {
  try {
    const pat = PropertiesService.getScriptProperties().getProperty("GITHUB_PAT") || "";
    if (!pat) {
      Logger.log("[triggerReadStatusCheck] ⚠️ GITHUB_PAT chưa set");
      return false;
    }
    const url = "https://api.github.com/repos/phonghdpxd-cmd/tni-bot/actions/workflows/check_read_status.yml/dispatches";
    const resp = UrlFetchApp.fetch(url, {
      method: "post",
      headers: {
        "Authorization": "Bearer " + pat,
        "Accept":        "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type":  "application/json"
      },
      payload: JSON.stringify({ ref: "main" }),
      muteHttpExceptions: true
    });
    const code = resp.getResponseCode();
    Logger.log("[triggerReadStatusCheck] GitHub API response: " + code);
    return code === 204;
  } catch(e) {
    Logger.log("[triggerReadStatusCheck] ❌ Lỗi: " + e.message);
    return false;
  }
}


// ============================================================
// HELPER — Dispatch GitHub Actions workflow botlookup_relay.yml
// Yêu cầu: Script Property "GITHUB_PAT" = Personal Access Token
//   có scope: repo + workflow
// Cách tạo PAT: github.com/settings/tokens → Generate new token (classic)
//   → chọn scope "repo" và "workflow"
// Cách lưu: GAS Editor → Project Settings → Script Properties
//   → thêm key "GITHUB_PAT" = token value
// ============================================================
function triggerBotlookupRelay() {
  try {
    const pat = PropertiesService.getScriptProperties().getProperty("GITHUB_PAT") || "";
    if (!pat) {
      Logger.log("[triggerBotlookupRelay] ⚠️ GITHUB_PAT chưa set trong Script Properties");
      return false;
    }

    const owner    = "phonghdpxd-cmd";
    const repo     = "tni-bot";
    const workflow = "botlookup_relay.yml";
    const url      = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`;

    const resp = UrlFetchApp.fetch(url, {
      method: "post",
      headers: {
        "Authorization": "Bearer " + pat,
        "Accept":        "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type":  "application/json"
      },
      payload: JSON.stringify({ ref: "main", inputs: { skip_delay: "1" } }),
      muteHttpExceptions: true
    });

    const code = resp.getResponseCode();
    Logger.log("[triggerBotlookupRelay] GitHub API response: " + code);
    return code === 204;   // 204 No Content = thành công
  } catch(e) {
    Logger.log("[triggerBotlookupRelay] ❌ Lỗi: " + e.message);
    return false;
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

  const props   = PropertiesService.getScriptProperties();
  const lastKey = props.getProperty(TS_KEY_A1) || "";
  if (raw === lastKey) { Logger.log("[Tin1] A1 không đổi — bỏ qua"); return; }

  Logger.log("[Tin1] 🆕 A1 thay đổi → gửi Col C...");

  const colCRaw = readColCRaw(sheet);
  if (!colCRaw) { Logger.log("[Tin1] Col C trống — bỏ qua"); return; }

  const lines = colCRaw.split("\n");

  // ① CONTROL: nhận TOÀN BỘ Col C (có tô màu team)
  const controlId = SD_GROUPS["CONTROL"];
  if (controlId) {
    const coloredRaw = colorizeTeams(colCRaw);
    sendTelegram(controlId, "<pre>" + escHtml(coloredRaw) + "</pre>", "[Tin1][CONTROL]");
  }

  // ② Mỗi Team: header chung + summary team đó + site của team đó
  const sitePattern = {
    T1: /\|\s*T1\s*\|/i,
    T2: /\|\s*T[25]\s*\|/i,   // T2 + T5 gộp
    T3: /\|\s*T3\s*\|/i,
    T4: /\|\s*T4\s*\|/i,
  };
  const summaryPattern = {
    T1: /^Team\s*1\s*:/i,
    T2: /^Team\s*[25]\s*:/i,
    T3: /^Team\s*3\s*:/i,
    T4: /^Team\s*4\s*:/i,
  };

  for (const team of ["T1", "T2", "T3", "T4"]) {
    const chatId = SD_GROUPS[team];
    if (!chatId) continue;

    // Lấy header chung (không phải site, không phải "Team X:" của team khác)
    const headerLines = lines.filter(line => {
      if (!line.trim()) return false;
      if (/^\d+:/.test(line)) return false;                     // site line → bỏ
      if (/^Team\s*\d+\s*:/i.test(line)) {
        return summaryPattern[team].test(line);                  // chỉ giữ summary của team này
      }
      return true;                                               // header chung → giữ
    });

    // Lấy site lines của team này
    const siteLines = lines.filter(line => sitePattern[team].test(line));

    const teamContent = siteLines.length > 0
      ? [...headerLines, "...", ...siteLines].join("\n")
      : [...headerLines, "Không có site down"].join("\n");

    // Tô màu team code trong tin nhắn
    const coloredContent = colorizeTeams(teamContent);
    sendTelegram(chatId, "<pre>" + escHtml(coloredContent) + "</pre>", "[Tin1][" + team + "]");
  }

  // ③ TNI cá nhân → KHÔNG nhận Tin1 (site list), chỉ nhận Tin2 (summary)

  props.setProperty(TS_KEY_A1, raw);
  Logger.log("[Tin1] ✅ Xong");
  // NOTE: sendNoteB2B5 đã chuyển sang gửi từ @Phongha79 (Telethon) trong botlookup_relay.py
  //       để hỗ trợ theo dõi ai đã đọc (GetMessageReadParticipantsRequest)
}




// ============================================================
// NOTE — Gửi nội dung B2:B5 từ SD Sheet đến TẤT CẢ groups
// Gửi SAU tin tổng hợp (checkColC)
// B2:B5 = ghi chú tay cho Team leaders & Staff
// ============================================================
function sendNoteB2B5(sheet) {
  try {
    const values = sheet.getRange("B2:B5").getValues();
    const noteLines = values
      .map(row => row[0].toString().trim())
      .filter(line => line.length > 0);

    if (noteLines.length === 0) {
      Logger.log("[Note B2:B5] Không có nội dung — bỏ qua");
      return;
    }

    const noteText = noteLines.join("\n");
    Logger.log("[Note B2:B5] Gửi note: " + noteText.substring(0, 100));

    // Gửi đến TẤT CẢ groups: CONTROL + T1/T2/T3/T4
    for (const [key, chatId] of Object.entries(SD_GROUPS)) {
      sendTelegram(chatId, noteText, "[Note][" + key + "]");
    }
    Logger.log("[Note B2:B5] ✅ Đã gửi đến " + Object.keys(SD_GROUPS).length + " groups");
  } catch(e) {
    Logger.log("[Note B2:B5] ❌ Lỗi: " + e.message);
  }
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

  // Gửi Tin 2 tổng hợp vào Control (HTML + emoji)
  const controlId2 = SD_GROUPS["CONTROL"];
  if (controlId2) {
    try {
      const msg = buildAwAzControlMessage(ts, awaz);
      sendTelegram(controlId2, msg, "[Tin2][CONTROL]");
    } catch(e) {
      Logger.log("[Tin2][CONTROL] ❌ Lỗi: " + e.message);
    }
  }

  // Gửi Tin 2 cho cá nhân (TNI) — giống CONTROL, nhận qua DM
  for (const pid of SD_PERSONAL_IDS) {
    try {
      const msgPersonal = buildAwAzControlMessage(ts, awaz);
      sendTelegram(pid, msgPersonal, "[Tin2][TNI]");
    } catch(e) {
      Logger.log("[Tin2][TNI] ❌ Lỗi: " + e.message);
    }
    Utilities.sleep(300);
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
// BUILD Tin 1 — Cột C cho từng Team (bảng monospace)
// ============================================================
function buildColCMessage(teamKey, ts, sites) {
  const label = teamKey === "T2" ? "Team 2 (T2+T5)" : teamKey.replace("T", "Team ");

  if (sites.length === 0) {
    return label + " | " + ts + "\nKhông có site down";
  }

  // Tính độ rộng cột OWNER rộng nhất
  const pad  = (s, n) => String(s || "").padEnd(n);
  const padL = (s, n) => String(s || "").padStart(n);

  let maxOwner = 5;
  sites.forEach(s => {
    if ((s.owner || "").length > maxOwner) maxOwner = s.owner.length;
  });

  // Mỗi site 1 dòng: STATION | TIME h | OWNER | POWER
  const rows = sites.map(s => {
    const dur = parseFloat(s.duration || "0").toFixed(2);
    return pad(s.tniCode, 7) + " | " +
           padL(dur, 7) + " h | " +
           pad(s.owner, maxOwner) + " | " +
           (s.power || "");
  });

  // Header ngắn gọn + bảng
  const headerLine = label + " | " + ts + " | " + sites.length + " sites";
  return headerLine + "\n<pre>" + escHtml(rows.join("\n")) + "</pre>";
}





// Escape HTML — tránh lỗi ký tự < > & trong dữ liệu
function escHtml(str) {
  return (str || "").toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


// ============================================================
// TÔ MÀU TEAM CODES — thêm emoji màu trước T1/T2/T3/T4/T5
// 🔵 T1 | 🟡 T2 | 🟢 T3 | 🔴 T4 | 🟠 T5
// Hoạt động cả trong <pre> block (emoji hiển thị bình thường)
// ============================================================
const TEAM_COLORS = {
  T1: "🔵", T2: "🟡", T3: "🟢", T4: "🔴", T5: "🟠"
};

function colorizeTeams(text) {
  // Thay | T1 | → | 🔵T1 | trong các dòng site (dạng: số: TNIxxxx | Tx | ...)
  return (text || "").replace(/\|\s*(T[1-5])\s*\|/gi, function(match, team) {
    const emoji = TEAM_COLORS[team.toUpperCase()] || "";
    return "| " + emoji + team + " |";
  });
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
// BUILD Tin 2 — AW:AZ tổng hợp cho Control (4 team, có emoji + format đẹp)
// ============================================================
function buildAwAzControlMessage(ts, awaz) {
  const teamLabels = [
    { key: "T1", label: "Team 1",          emoji: "🔵" },
    { key: "T2", label: "Team 2 (T2+T5)",  emoji: "🟡" },
    { key: "T3", label: "Team 3",          emoji: "🟢" },
    { key: "T4", label: "Team 4",          emoji: "🔴" },
  ];
  const lines = [];
  lines.push("📊 <b>SUMMARY TỔNG HỢP — TẤT CẢ TEAM</b>");
  lines.push("📅 " + escHtml(ts));
  lines.push("━".repeat(26));

  for (let col = 0; col < 4; col++) {
    const t = teamLabels[col];
    lines.push("");
    lines.push(t.emoji + " <b>" + t.label + "</b>");
    lines.push("─".repeat(20));
    let hasData = false;
    for (let r = 0; r < 5; r++) {
      const txt = ((awaz[r] || [])[col] || "").toString().trim();
      if (!txt || txt === "0") continue;
      const clean = escHtml(txt.replace(/[*_`]/g, ""));
      lines.push(AWAZ_LABELS[r].emoji + " <b>" + AWAZ_LABELS[r].name + ":</b> " + clean);
      hasData = true;
    }
    if (!hasData) lines.push("✅ Không có sự cố");
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
  setWebhookDirect("https://script.google.com/macros/s/AKfycbyoRM8LVCebLzz8cRjjbfS9OUNQWyQ_o2xVg24lO9aFT6M-B_eazKUTxpquI6TEyVahZw/exec");
}


// ============================================================
// DEBUG POLLING — Xem raw getUpdates Telegram trả về gì
// ============================================================
function testGetUpdatesRaw() {
  const props  = PropertiesService.getScriptProperties();
  const lastId = parseInt(props.getProperty("SD_LAST_UPDATE_ID") || "0");
  // offset=0 để lấy TẤT CẢ updates còn trong queue
  const url    = "https://api.telegram.org/bot" + SD_BOT_TOKEN
               + "/getUpdates?offset=0&limit=10&allowed_updates=message,channel_post";
  const resp   = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const raw    = resp.getContentText();
  Logger.log("[RAW] lastId stored = " + lastId);
  Logger.log("[RAW] getUpdates response (500 chars):");
  Logger.log(raw.substring(0, 500));

  const data = JSON.parse(raw);
  if (!data.ok) { Logger.log("Telegram error: " + data.description); return; }
  Logger.log("[RAW] Total updates: " + data.result.length);
  data.result.forEach((u, i) => {
    const msg = u.message || u.channel_post;
    const chatId = msg ? msg.chat.id.toString() : "(no msg)";
    const txt = msg ? (msg.text || msg.caption || "").substring(0, 80) : "";
    Logger.log("#" + i + " update_id=" + u.update_id + " | chat=" + chatId + " | " + txt);
  });
  Logger.log("CONTROL group ID cần match: " + SD_GROUPS.CONTROL);
}
