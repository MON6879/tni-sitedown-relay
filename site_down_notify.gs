// ============================================================
// TNI Site Down Auto-Notification — v3 (Full Auto)
// ============================================================
// Flow:
//   1. Ai gửi báo cáo site down vào Group CONTROL SITE
//   2. Bot nhận → webhook gọi doPost()
//   3. Apps Script ghi vào Cột A của Sheet
//   4. checkAndSend() chạy ngay:
//      - Tin 1: Cột C → từng Team (site list chi tiết)
//      - Tin 2: AW7:AZ15 → từng Team + Control (summary)
// ============================================================

// ── Bot ─────────────────────────────────────────────────────
const SD_BOT_TOKEN = PropertiesService.getScriptProperties().getProperty("SD_BOT_TOKEN") || "";

// ── Group Chat IDs ───────────────────────────────────────────
const SD_GROUPS = {
  T1:      "-5180992881",   // TNI TEAM 1
  T2:      "-5188855349",   // TNI TEAM 2 (T2 + T2 S*)
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
// Tin 1 dùng A1 timestamp, Tin 2 dùng AW7 timestamp — độc lập nhau.
const TS_KEY_A1  = "SD_LAST_TS_A1";   // Tin 1: Col A → Col C per-team
const TS_KEY_AW7 = "SD_LAST_TS_AW7";  // Tin 2: AW7:AZ15 summary

// ── AW:AZ column index (0-based) ────────────────────────────
const AWAZ_COL = { T1: 0, T2: 1, T3: 2, T4: 3 };

// ── Row labels trong AW7:AZ15 ───────────────────────────────
// Rows: Site down, Cell down, DG Abnormal, DG Run>16H, Link down + future rows
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

    // Ignore bot messages and report messages to prevent self-triggering
    if (text.startsWith("📋") || (msg.from && msg.from.is_bot)) {
      return okJson({ status: "ignored_bot_or_report" });
    }

    const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
    const sheet = getSheetByGid(ss, SD_SHEET_GID);
    if (!sheet) return okJson({ status: "error", message: "Sheet GID not found" });

    const config = loadTeamConfig(sheet);
    const controlId = config.groups.CONTROL || "-5251698940";

    if (chatId !== controlId || !isSiteDownReport(text))
      return okJson({ status: "ignored" });

    writeToColumnA(sheet, text);
    SpreadsheetApp.flush();
    Utilities.sleep(3000);
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
  if (!text) return false;
  if (text.startsWith("📋")) return false; // Bỏ qua tất cả báo cáo bắt đầu bằng 📋
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
  // Đọc giờ Myanmar để giới hạn thời gian hoạt động (03:30 - 21:30)
  const now = new Date();
  const hour = parseInt(Utilities.formatDate(now, "Asia/Rangoon", "H"), 10);
  const minute = parseInt(Utilities.formatDate(now, "Asia/Rangoon", "m"), 10);
  const currentMinutes = hour * 60 + minute;

  const activeStart = 3 * 60 + 30; // 03:30 -> 210 phút
  const activeEnd = 22 * 60 + 10;  // 22:10 -> 1330 phút

  if (currentMinutes < activeStart || currentMinutes > activeEnd) {
    Logger.log("😴 Ngoài khung giờ hoạt động checkAndSend (03:30-22:10 Myanmar) — Bỏ qua.");
    return { sent_tin1: false, sent_tin2: false };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) {
    Logger.log("⏭️ checkAndSend: đang có execution khác — bỏ qua");
    return { sent_tin1: false, sent_tin2: false };
  }
  try {
    const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
    const sheet = getSheetByGid(ss, SD_SHEET_GID);
    if (!sheet) { Logger.log("❌ Không tìm thấy sheet"); return { sent_tin1: false, sent_tin2: false }; }

    const config = loadTeamConfig(sheet);

    // ── BƯỚC 1: Poll Telegram lấy báo cáo mới → ghi Cột A ──
    fetchTelegramUpdates(sheet);

    // ── BƯỚC 2: Kiểm tra và gửi tin ─────────────────────────
    const sentTin1 = checkColC(sheet, config);   // Tin 1: A1 thay đổi → Col C per-team + CONTROL
    const sentTin2 = checkAwAz(sheet, config);   // Tin 2: AW7 thay đổi → AW:AZ summary per-team

    return { sent_tin1: sentTin1, sent_tin2: sentTin2 };
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

  // Đọc giờ Myanmar
  const myanmarHour = parseInt(Utilities.formatDate(new Date(), "Asia/Rangoon", "H"), 10);
  const myanmarMin  = parseInt(Utilities.formatDate(new Date(), "Asia/Rangoon", "m"), 10);
  const currentMinutes = myanmarHour * 60 + myanmarMin;

  // Khung giờ hoạt động: 04:00 đến 22:10 Myanmar Time
  const activeStart = 4 * 60;
  const activeEnd = 22 * 60 + 10;

  if (currentMinutes >= activeStart && currentMinutes <= activeEnd) {
    // Bước 1: Dispatch GitHub Actions workflow
    const dispatched = triggerBotlookupRelay();
    if (dispatched) {
      Logger.log("[relayBotlookupToTNI] ✅ GitHub Actions đã dispatch — botlookup_relay.py sẽ gọi GAS sau ~2-3p");
    } else {
      Logger.log("[relayBotlookupToTNI] ⚠️ Không dispatch được GitHub Actions (thiếu GITHUB_PAT?)");
    }
  } else {
    Logger.log("[relayBotlookupToTNI] 🌙 Ngoài khung giờ hoạt động (04:00-22:10 Myanmar) — Bỏ qua dispatch GitHub Actions");
  }

  // Bước 2: Chạy checkAndSend để gửi nếu Cột A đã có data
  checkAndSend();

  // Bước 3: 20:00–20:30 Myanmar (~20:01) → dispatch check_read_status (1 lần/ngày)
  // ĐÃ TẮT: Theo yêu cầu của User (Xóa tin hình 1 không cần)
  /*
  const isReadTime  = (myanmarHour === 20 && myanmarMin <= 30);
  if (isReadTime) {
    const todayKey = "READ_CHECK_DATE_" + Utilities.formatDate(new Date(), "Asia/Rangoon", "yyyyMMdd");
    const props    = PropertiesService.getScriptProperties();
    if (!props.getProperty(todayKey)) {
      const ok = triggerReadStatusCheck();
      if (ok) {
        props.setProperty(todayKey, "done");
        Logger.log("[relayBotlookupToTNI] ✅ Dispatch check_read_status lúc 20:xx Myanmar");
      }
    } else {
      Logger.log("[relayBotlookupToTNI] ℹ️ check_read_status đã chạy hôm nay rồi — bỏ qua");
    }
  }
  */

  // Bước 3b: 16:55–17:25 Myanmar → dispatch daily_bod_assign.yml (1 lần/ngày lúc 17:00)
  const isBodAssignTime = (myanmarHour === 16 && myanmarMin >= 55) || (myanmarHour === 17 && myanmarMin <= 25);
  if (isBodAssignTime) {
    const bodAssignKey = "DAILY_BOD_ASSIGN_DATE_" + Utilities.formatDate(new Date(), "Asia/Rangoon", "yyyyMMdd");
    const props6       = PropertiesService.getScriptProperties();
    if (!props6.getProperty(bodAssignKey)) {
      const okBod = triggerDailyBodAssign();
      if (okBod) {
        props6.setProperty(bodAssignKey, "done");
        Logger.log("[relayBotlookupToTNI] ✅ Dispatch daily_bod_assign.yml lúc 17:00 Myanmar");
      }
    } else {
      Logger.log("[relayBotlookupToTNI] ℹ️ daily_bod_assign.yml đã dispatch hôm nay rồi — bỏ qua");
    }
  }

  // Bước 4: 17:25–17:55 Myanmar → gửi Task Remain (1 lần/ngày)
  const isTaskTime = (myanmarHour === 17 && myanmarMin >= 25 && myanmarMin <= 55);
  if (isTaskTime) {
    const taskKey = "TASK_REMAIN_DATE_" + Utilities.formatDate(new Date(), "Asia/Rangoon", "yyyyMMdd");
    const props2  = PropertiesService.getScriptProperties();
    if (!props2.getProperty(taskKey)) {
      sendTaskRemain();
      props2.setProperty(taskKey, "done");
      Logger.log("[relayBotlookupToTNI] ✅ sendTaskRemain đã gửi lúc 17:xx Myanmar");
    } else {
      Logger.log("[relayBotlookupToTNI] ℹ️ sendTaskRemain đã chạy hôm nay rồi — bỏ qua");
    }
  }

  // Bước 5: 17:25–17:55 Myanmar → dispatch daily_task.yml (1 lần/ngày)
  if (isTaskTime) {
    const dailyKey = "DAILY_TASK_DATE_" + Utilities.formatDate(new Date(), "Asia/Rangoon", "yyyyMMdd");
    const props3   = PropertiesService.getScriptProperties();
    if (!props3.getProperty(dailyKey)) {
      const okDaily = triggerDailyTask();
      if (okDaily) {
        props3.setProperty(dailyKey, "done");
        Logger.log("[relayBotlookupToTNI] ✅ Dispatch daily_task.yml lúc 17:xx Myanmar");
      }
    } else {
      Logger.log("[relayBotlookupToTNI] ℹ️ daily_task.yml đã dispatch hôm nay rồi — bỏ qua");
    }
  }

  // Bước 6: 20:25–20:55 Myanmar → dispatch daily_read_report.yml (1 lần/ngày lúc 20:30)
  const isReadReportTime = (myanmarHour === 20 && myanmarMin >= 25 && myanmarMin <= 55);
  if (isReadReportTime) {
    const readReportKey = "DAILY_READ_REPORT_DATE_" + Utilities.formatDate(new Date(), "Asia/Rangoon", "yyyyMMdd");
    const props4        = PropertiesService.getScriptProperties();
    if (!props4.getProperty(readReportKey)) {
      const okRead = triggerDailyReadReport();
      if (okRead) {
        props4.setProperty(readReportKey, "done");
        Logger.log("[relayBotlookupToTNI] ✅ Dispatch daily_read_report.yml lúc 20:xx Myanmar");
      }
    } else {
      Logger.log("[relayBotlookupToTNI] ℹ️ daily_read_report.yml đã dispatch hôm nay rồi — bỏ qua");
    }
  }

  // Bước 7a: 16:55–17:25 Myanmar → dispatch plan_eod (1 lần/ngày lúc 17:00)
  const isPlanEodTime = (myanmarHour === 16 && myanmarMin >= 55) || (myanmarHour === 17 && myanmarMin <= 25);
  if (isPlanEodTime) {
    const planEodKey = "DAILY_PLAN_EOD_DATE_" + Utilities.formatDate(new Date(), "Asia/Rangoon", "yyyyMMdd");
    const propsEod   = PropertiesService.getScriptProperties();
    if (!propsEod.getProperty(planEodKey)) {
      const okPlanEod = triggerDailyWorkflow("plan_eod");
      if (okPlanEod) {
        propsEod.setProperty(planEodKey, "done");
        Logger.log("[relayBotlookupToTNI] ✅ Dispatch plan_eod lúc 17:00 Myanmar");
      }
    } else {
      Logger.log("[relayBotlookupToTNI] ℹ️ plan_eod đã dispatch hôm nay rồi — bỏ qua");
    }
  }

  // Bước 7b: 20:55–21:25 Myanmar → dispatch plan_update (1 lần/ngày lúc 21:00)
  const isPlanUpdTime = (myanmarHour === 20 && myanmarMin >= 55) || (myanmarHour === 21 && myanmarMin <= 25);
  if (isPlanUpdTime) {
    const planUpdKey = "DAILY_PLAN_UPD_DATE_" + Utilities.formatDate(new Date(), "Asia/Rangoon", "yyyyMMdd");
    const propsUpd   = PropertiesService.getScriptProperties();
    if (!propsUpd.getProperty(planUpdKey)) {
      const okPlanUpd = triggerDailyWorkflow("plan_update");
      if (okPlanUpd) {
        propsUpd.setProperty(planUpdKey, "done");
        Logger.log("[relayBotlookupToTNI] ✅ Dispatch plan_update lúc 21:00 Myanmar");
      }
    } else {
      Logger.log("[relayBotlookupToTNI] ℹ️ plan_update đã dispatch hôm nay rồi — bỏ qua");
    }
  }

  // Bước 7c: 06:55–07:25 Myanmar → dispatch plan_morning (1 lần/ngày lúc 07:00)
  const isPlanMrnTime = (myanmarHour === 6 && myanmarMin >= 55) || (myanmarHour === 7 && myanmarMin <= 25);
  if (isPlanMrnTime) {
    const planMrnKey = "DAILY_PLAN_MRN_DATE_" + Utilities.formatDate(new Date(), "Asia/Rangoon", "yyyyMMdd");
    const propsMrn   = PropertiesService.getScriptProperties();
    if (!propsMrn.getProperty(planMrnKey)) {
      const okPlanMrn = triggerDailyWorkflow("plan_morning");
      if (okPlanMrn) {
        propsMrn.setProperty(planMrnKey, "done");
        Logger.log("[relayBotlookupToTNI] ✅ Dispatch plan_morning lúc 07:00 Myanmar");
      }
    } else {
      Logger.log("[relayBotlookupToTNI] ℹ️ plan_morning đã dispatch hôm nay rồi — bỏ qua");
    }
  }
}



// ============================================================
// TASK REMAIN — Gửi từng task riêng lẻ đến từng Team lúc 17:30
// Sheet: Task Remain (GID 133591305)
// Col A: Team | Col D: Nội dung task | Col E: Telegram ID cá nhân
// ============================================================
const TASK_SHEET_ID  = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8";
const TASK_SHEET_GID = 133591305;

// Map tên team trong cột A → Chat ID group
const TASK_TEAM_MAP = {
  "team 1": "-5180992881",
  "team 2": "-5188855349",
  "team 3": "-5183480727",
  "team 4": "-5238696719",
  "t1":     "-5180992881",
  "t2":     "-5188855349",
  "t3":     "-5183480727",
  "t4":     "-5238696719",
};

function sendTaskRemain() {
  try {
    const ssSiteDown = SpreadsheetApp.openById(SD_SHEET_ID);
    const config = loadTeamConfig(ssSiteDown.getSheets()[0]);
    const taskTeamMap = getTaskTeamMap(config);

    const ss = SpreadsheetApp.openById(TASK_SHEET_ID);

    // Tìm sheet theo GID
    const sheets    = ss.getSheets();
    const taskSheet = sheets.find(s => s.getSheetId() === TASK_SHEET_GID);
    if (!taskSheet) {
      Logger.log("[TaskRemain] ❌ Không tìm thấy sheet GID " + TASK_SHEET_GID);
      return;
    }

    // Đọc dữ liệu từ hàng 4 đến 61, cột A:E
    const data = taskSheet.getRange("A4:E61").getValues();

    // Nhóm task theo chatId
    const teamTasks = {};   // { chatId: [ {content, teleId, teamRaw} ] }

    for (const row of data) {
      const teamRaw = row[0].toString().trim();
      const content = row[3].toString().trim();   // Cột D (index 3)
      const teleId  = row[4].toString().trim();   // Cột E (index 4)

      if (!teamRaw || !content) continue;

      const chatId = taskTeamMap[teamRaw.toLowerCase()];
      if (!chatId) {
        Logger.log("[TaskRemain] ⚠️ Không tìm thấy group cho team: " + teamRaw);
        continue;
      }

      if (!teamTasks[chatId]) teamTasks[chatId] = [];
      teamTasks[chatId].push({ content, teleId, teamRaw });
    }

    // Tìm team key từ chatId (để dùng làm msgKey)
    var chatIdToTeam = {};
    for (var tk in taskTeamMap) {
      chatIdToTeam[taskTeamMap[tk]] = tk.toUpperCase();
    }

    // Xóa tin cũ → Gửi từng task riêng lẻ → Lưu msg_ids mới
    for (const [chatId, tasks] of Object.entries(teamTasks)) {
      var teamKey = chatIdToTeam[chatId] || chatId;
      var msgKey = "TASKREMAIN_" + teamKey;

      // Xóa tất cả tin Task cũ trong group này
      deleteOldMessages_(chatId, msgKey);

      // Gửi từng task + thu thập msg_ids
      var allNewIds = [];
      Logger.log("[TaskRemain] Gửi " + tasks.length + " task đến group " + chatId);
      for (const task of tasks) {
        var ids = sendTelegramCollectIds_(chatId, task.content, "[Task][" + task.teamRaw + "]");
        allNewIds = allNewIds.concat(ids);
        Utilities.sleep(800);   // tránh rate limit
      }

      // Lưu tất cả msg_ids mới
      if (allNewIds.length > 0) {
        saveMsgIds_(msgKey, allNewIds);
      }
    }

    // Gửi DM cá nhân nếu có Telegram ID ở cột E
    for (const [chatId, tasks] of Object.entries(teamTasks)) {
      for (const task of tasks) {
        if (!task.teleId) continue;
        const uid = task.teleId.startsWith("@")
          ? task.teleId
          : task.teleId.replace(/\D/g, "");
        if (!uid) continue;
        sendTelegram(uid, "📋 Task của bạn:\n\n" + task.content, "[Task][DM]");
        Utilities.sleep(500);
      }
    }

    Logger.log("[TaskRemain] ✅ Đã gửi xong Task Remain");
  } catch(e) {
    Logger.log("[TaskRemain] ❌ Lỗi: " + e.message);
  }
}


// ============================================================
// HELPER — Dispatch GitHub Actions workflow check_read_status.yml
// Chạy 1 lần/ngày lúc 17:xx Myanmar → báo cáo ai đọc Note
// ============================================================
function triggerDailyWorkflow(reportType, extraInputs) {
  try {
    const pat = PropertiesService.getScriptProperties().getProperty("GITHUB_PAT") || "";
    if (!pat) {
      Logger.log("[triggerDailyWorkflow] ⚠️ GITHUB_PAT chưa set");
      return false;
    }
    const url = "https://api.github.com/repos/phonghdpxd-cmd/tni-bot/actions/workflows/daily_reports.yml/dispatches";
    const inputs = { report_type: reportType };
    if (extraInputs) {
      Object.assign(inputs, extraInputs);
    }

    const resp = UrlFetchApp.fetch(url, {
      method: "post",
      headers: {
        "Authorization": "Bearer " + pat,
        "Accept":        "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type":  "application/json"
      },
      payload: JSON.stringify({
        ref: "main",
        inputs: inputs
      }),
      muteHttpExceptions: true
    });
    const code = resp.getResponseCode();
    Logger.log("[triggerDailyWorkflow] " + reportType + " GitHub API response: " + code);
    return code === 204;
  } catch(e) {
    Logger.log("[triggerDailyWorkflow] ❌ Lỗi: " + e.message);
    return false;
  }
}

function triggerReadStatusCheck() {
  return triggerDailyWorkflow("check_read_status");
}

// ── Dispatch daily_task.yml (daily_task) — báo cáo 17:30 Myanmar
function triggerDailyTask() {
  return triggerDailyWorkflow("daily_task");
}

// ── Dispatch daily_read_report.yml (read_report) lúc 20:30 Myanmar
function triggerDailyReadReport() {
  return triggerDailyWorkflow("read_report");
}

// ── Dispatch daily_plan_report.py — 3 modes
function triggerDailyPlanEod() {
  return triggerDailyWorkflow("plan_eod");
}
function triggerDailyPlanUpdate() {
  return triggerDailyWorkflow("plan_update");
}
function triggerDailyPlanMorning() {
  return triggerDailyWorkflow("plan_morning");
}

// ── Dispatch daily_bod_assign.yml (bod_assign) lúc 17:00 Myanmar
function triggerDailyBodAssign() {
  return triggerDailyWorkflow("bod_assign");
}

// ── Dispatch botlookup_relay.yml (botlookup_relay) từ GAS
function triggerBotlookupRelay() {
  return triggerDailyWorkflow("botlookup_relay", { skip_delay: "1" });
}



// ============================================================
// TIN 1 — Cột C: site list chi tiết
// Trigger: A1 timestamp thay đổi
// Gửi:
//   - Per-team (format đẹp) → từng nhóm Team
//   - Toàn bộ Col C (nguyên văn) → nhóm CONTROL
// ============================================================
function checkColC(sheet, config) {
  if (!config) { config = loadTeamConfig(sheet); }
  const raw = sheet.getRange("A1").getValue().toString().trim();
  if (!raw) { Logger.log("[Tin1] A1 rỗng — bỏ qua"); return false; }

  // Dùng timestamp + 60 ký tự đầu làm key (tránh vượt giới hạn 9KB của PropertiesService)
  // Ưu tiên parse timestamp từ A1; nếu không được thì lấy 200 ký tự đầu
  const ts1   = parseA1Timestamp(sheet);
  const storeKey = ts1 ? (ts1 + "|" + raw.substring(0, 60)) : raw.substring(0, 200);

  const props   = PropertiesService.getScriptProperties();
  const lastKey = props.getProperty(TS_KEY_A1) || "";
  if (storeKey === lastKey) { Logger.log("[Tin1] A1 không đổi (" + storeKey.substring(0,40) + ") — bỏ qua"); return false; }

  Logger.log("[Tin1] 🆕 A1 thay đổi (" + storeKey.substring(0,40) + ") → gửi Col C...");

  const colCRaw = readColCRaw(sheet);
  if (!colCRaw) { Logger.log("[Tin1] Col C trống — bỏ qua"); return false; }

  const lines = colCRaw.split("\n");

  // ① CONTROL: nhận TOÀN BỘ Col C (có tô màu team)
  const controlId = config.groups["CONTROL"] || SD_GROUPS["CONTROL"];
  if (controlId) {
    try {
      const coloredRaw = colorizeTeams(colCRaw, config);
      // Fix: split nội dung TRƯỚC khi bọc <pre></pre>
      // Tránh lỗi Telegram "Unclosed tag" khi split cắt giữa <pre>...</pre>
      // Edit-in-place: edit tin cũ trong ngày, gửi mới nếu chưa có hoặc tin dài
      sendOrEditTelegramPre(controlId, coloredRaw, "TIN1_CONTROL", "[Tin1][CONTROL]");
    } catch (controlErr) {
      Logger.log("[Tin1][CONTROL] ❌ Lỗi gửi: " + controlErr.message);
    }
  }

  // ② Mỗi Team: header chung + summary team đó + site của team đó
  const sitePattern = {};
  const summaryPattern = {};
  const teams = Object.keys(config.groups).filter(t => t !== "CONTROL");

  for (const team of teams) {
    const subTeamsForParent = Object.keys(config.subTeams).filter(code => config.subTeams[code] === team);
    const codesToMatch = [team].concat(subTeamsForParent);
    const escapedCodes = codesToMatch.map(code => code.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    sitePattern[team] = new RegExp("\\|\\s*(" + escapedCodes.join("|") + ")\\s*\\|", "i");

    const label = config.teamLabels[team] || team;
    const escapedLabel = label.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '\\s*');
    const numPart = team.replace(/\D/g, "");
    const optNumPattern = numPart ? "|Team\\s*" + numPart : "";
    summaryPattern[team] = new RegExp("^(" + escapedLabel + optNumPattern + ")\\s*:", "i");
  }

  for (const team of teams) {
    try {
      const chatId = config.groups[team];
      if (!chatId) continue;

      // Lấy header chung (không phải site, không phải "Team X:" của team khác)
      const headerLines = lines.filter(line => {
        if (!line.trim()) return false;
        if (/^\d+:/.test(line)) return false;                     // site line → bỏ
        if (/^Team\s*\d+\s*:/i.test(line)) {
          return summaryPattern[team] && summaryPattern[team].test(line); // chỉ giữ summary của team này
        }
        return true;                                               // header chung → giữ
      });

      // Lấy site lines của team này
      const siteLines = lines.filter(line => sitePattern[team] && sitePattern[team].test(line));

      const teamContent = siteLines.length > 0
        ? [...headerLines, "...", ...siteLines].join("\n")
        : [...headerLines, "Không có site down"].join("\n");

      // Tô màu team code trong tin nhắn
      const coloredContent = colorizeTeams(teamContent, config);
      // Edit-in-place: edit tin cũ trong ngày, gửi mới nếu chưa có hoặc tin dài
      sendOrEditTelegramPre(chatId, coloredContent, "TIN1_" + team, "[Tin1][" + team + "]");
    } catch (teamErr) {
      Logger.log("[Tin1][" + team + "] ❌ Lỗi gửi: " + teamErr.message);
    }
  }

  // ③ TNI cá nhân → KHÔNG nhận Tin1 (site list), chỉ nhận Tin2 (summary)

  props.setProperty(TS_KEY_A1, storeKey);  // lưu key ngắn, không lưu toàn bộ A1
  Logger.log("[Tin1] ✅ Xong — lưu key: " + storeKey.substring(0, 60));
  // NOTE: sendNoteB2B5 đã chuyển sang gửi từ @Phongha79 (Telethon) trong botlookup_relay.py
  //       để hỗ trợ theo dõi ai đã đọc (GetMessageReadParticipantsRequest)
  return true;
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
// Trigger: AW7 timestamp thay đổi
// ============================================================
function checkAwAz(sheet, config) {
  if (!config) { config = loadTeamConfig(sheet); }
  const ts = parseAW7Timestamp(sheet);
  if (!ts) { Logger.log("[Tin2] Không có timestamp trong AW7"); return false; }

  // Chỉ so sánh timestamp AW7 — KHÔNG dùng hash nội dung AW7:AZ15
  // Lý do: hash quá nhạy, trigger gửi lại khi Col C cập nhật (botlookup mới)
  // nhưng AW7 timestamp chưa đổi → gửi SUMMARY với data cũ (lỗi 06:43 04:25)
  // Logic đúng: SUMMARY chỉ gửi khi AW7 có timestamp MỚI (cập nhật từ hệ thống)
  const props  = PropertiesService.getScriptProperties();
  const lastTs = props.getProperty(TS_KEY_AW7) || "";
  if (ts === lastTs) { Logger.log("[Tin2] AW7 không đổi (" + ts + ") — bỏ qua"); return false; }

  Logger.log("[Tin2] 🆕 " + ts + " → gửi summary...");

  const awaz  = readAwAz(sheet, config);
  const teams = Object.keys(config.groups).filter(t => t !== "CONTROL");

  // Gửi từng team
  for (const team of teams) {
    try {
      const chatId = config.groups[team];
      if (!chatId) continue;
      const colIdx = config.awazCol[team];
      if (colIdx === undefined || colIdx === null || colIdx === "") continue;
      const msg = buildAwAzTeamMessage(team, ts, awaz, colIdx, config);
      sendOrEditTelegram(chatId, msg, "TIN2_" + team, "[Tin2][" + team + "]");
    } catch(teamErr) {
      Logger.log("[Tin2][" + team + "] ❌ Lỗi gửi: " + teamErr.message);
    }
  }

  // Gửi Tin 2 tổng hợp vào Control (HTML + emoji)
  const controlId2 = config.groups["CONTROL"] || SD_GROUPS["CONTROL"];
  if (controlId2) {
    try {
      const msg = buildAwAzControlMessage(ts, awaz, config);
      sendOrEditTelegram(controlId2, msg, "TIN2_CONTROL", "[Tin2][CONTROL]");
    } catch(e) {
      Logger.log("[Tin2][CONTROL] ❌ Lỗi: " + e.message);
    }
  }

  // Gửi Tin 2 cho cá nhân (TNI) — giống CONTROL, nhận qua DM
  for (const pid of SD_PERSONAL_IDS) {
    try {
      const msgPersonal = buildAwAzControlMessage(ts, awaz, config);
      sendOrEditTelegram(pid, msgPersonal, "TIN2_P_" + pid, "[Tin2][TNI]");
    } catch(e) {
      Logger.log("[Tin2][TNI] ❌ Lỗi: " + e.message);
    }
    Utilities.sleep(300);
  }

  props.setProperty(TS_KEY_AW7, ts);  // lưu chỉ timestamp AW7
  Logger.log("[Tin2] ✅ Xong — lưu timestamp: " + ts);
  return true;
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
// PARSE TIMESTAMP từ AW7
// "*Site down: 08/07/2026 09:48 = 13*"
// ============================================================
function parseAW7Timestamp(sheet) {
  const raw = sheet.getRange("AW7").getValue().toString();
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
// ĐỌC CỘT C — Tách site theo team (T* S* gộp vào team gốc)
// T1, T1 S1, T1 S2... → Team 1 | T2, T2 S1, T2 Su1... → Team 2
// ============================================================
function readColC(sheet, config) {
  if (!config) { config = loadTeamConfig(sheet); }
  const result  = {};
  const teams = Object.keys(config.groups).filter(t => t !== "CONTROL");
  for (const team of teams) {
    result[team] = [];
  }

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
      /^\d+:\s*(TNI\w+)\s*\|\s*(T\d(?:\s+S\w*)?)\s*\|\s*([\d.]+)\s*\|\s*(\w[\w_]*)\s*\|\s*([\w+]+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*\d+\s*\|?\s*(.*)/i
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

    const teamRawUpper = teamRaw.toUpperCase().trim();
    let baseTeam = teamRawUpper;
    
    // Check if it matches any sub-team mapping in config
    if (config.subTeams[teamRawUpper]) {
      baseTeam = config.subTeams[teamRawUpper];
    } else {
      // Fallback: strip sub-team suffix
      baseTeam = teamRawUpper.replace(/\s+S\w*$/i, "");
    }
    
    if (result[baseTeam]) {
      result[baseTeam].push(obj);
    }
  }
  return result;
}


// ============================================================
// ĐỌC AW7:AZ15 — 9 rows × 4 cols (skip header row 6)
// ============================================================
function readAwAz(sheet, config) {
  if (!config) { config = loadTeamConfig(sheet); }
  let maxColIdx = 3;
  for (const team of Object.keys(config.awazCol)) {
    if (config.awazCol[team] > maxColIdx) {
      maxColIdx = config.awazCol[team];
    }
  }
  const numCols = maxColIdx + 1;
  return sheet.getRange(7, 49, 9, numCols).getValues(); // AW7=row7, AW=col49
}


// ============================================================
// BUILD Tin 1 — Cột C cho từng Team (bảng monospace)
// ============================================================
function buildColCMessage(teamKey, ts, sites) {
  const label = teamKey.replace("T", "Team ");

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
// TÔ MÀU TEAM CODES — thêm emoji màu trước T1/T2/T3/T4
// 🔵 T1 | 🟡 T2 | 🟢 T3 | 🔴 T4
// Hoạt động cả trong <pre> block (emoji hiển thị bình thường)
// ============================================================
const TEAM_COLORS = {
  T1: "🔵", T2: "🟡", T3: "🟢", T4: "🔴"
};

function colorizeTeams(text, config) {
  if (!config) {
    return (text || "").replace(/\|\s*(T[1-4])(?:\s+S\w*)?\s*\|/gi, function(match, team) {
      const emoji = TEAM_COLORS[team.toUpperCase()] || "";
      return "| " + emoji + team + " |";
    });
  }
  let result = text || "";
  const allCodes = Object.keys(config.subTeams).concat(Object.keys(config.groups));
  // Sort by length descending to match longer strings first
  allCodes.sort((a, b) => b.length - a.length);
  
  allCodes.forEach(code => {
    if (code === "CONTROL") return;
    const parent = config.subTeams[code] || code;
    const emoji = config.colors[parent] || "";
    const escapedCode = code.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp("\\|\\s*(" + escapedCode + ")\\s*\\|", "gi");
    result = result.replace(regex, "| " + emoji + "$1 |");
  });
  return result;
}

// ============================================================
// BUILD Tin 2 — AW:AZ cho từng Team (HTML format)
// ============================================================
function buildAwAzTeamMessage(teamKey, ts, awaz, colIdx, config) {
  const label = config ? (config.teamLabels[teamKey] || teamKey.replace("T", "Team ")) : teamKey.replace("T", "Team ");
  const lines = [];
  lines.push("📊 <b>SUMMARY — " + label + "</b>");
  lines.push("📅 " + escHtml(ts));
  lines.push("━".repeat(26));

  let hasData = false;
  const numRows = awaz.length; // 9 rows (AW7:AZ15)
  for (let r = 0; r < numRows; r++) {
    const txt = ((awaz[r] || [])[colIdx] || "").toString().trim();
    if (!txt || txt === "0") continue;
    // Xóa markdown * _ ` rồi wrap HTML
    const clean = escHtml(txt.replace(/[*_`]/g, ""));
    // Dùng label cố định nếu có, nếu không thì trích label từ cell
    if (r < AWAZ_LABELS.length) {
      lines.push(AWAZ_LABELS[r].emoji + " <b>" + AWAZ_LABELS[r].name + ":</b> " + clean);
    } else {
      // Row mới ngoài 5 label cố định — trích label từ nội dung cell
      const labelMatch = txt.match(/^([^:]+):/); 
      const cellLabel = labelMatch ? labelMatch[1].replace(/[*_`]/g, "").trim() : "Row " + (r + 1);
      lines.push("📌 <b>" + escHtml(cellLabel) + ":</b> " + clean);
    }
    hasData = true;
  }
  if (!hasData) lines.push("✅ Không có sự cố");
  return lines.join("\n");
}


// ============================================================
// BUILD Tin 1 — Cột C tổng hợp cho Control (tất cả team)
// ============================================================
function buildColCControlMessage(ts, colCData, config) {
  const teamLabels = config ? config.teamLabels : {
    T1: "Team 1",
    T2: "Team 2",
    T3: "Team 3",
    T4: "Team 4",
  };
  const teams = config ? Object.keys(config.groups).filter(t => t !== "CONTROL") : ["T1", "T2", "T3", "T4"];
  const lines = [];
  lines.push("SITE DOWN TONG HOP - TAT CA TEAM");
  lines.push("Ngay: " + ts);
  lines.push("");

  for (const team of teams) {
    const sites = colCData[team] || [];
    const label = teamLabels[team] || team;
    lines.push("=== " + label + " (" + sites.length + " sites) ===");
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
function buildAwAzControlMessage(ts, awaz, config) {
  if (!config) {
    const teamLabels = [
      { key: "T1", label: "Team 1",  emoji: "🔵" },
      { key: "T2", label: "Team 2",  emoji: "🟡" },
      { key: "T3", label: "Team 3",  emoji: "🟢" },
      { key: "T4", label: "Team 4",  emoji: "🔴" },
    ];
    const lines = [];
    lines.push("📊 <b>SUMMARY TỔNG HỢP — TẤT CẢ TEAM</b>");
    lines.push("📅 " + escHtml(ts));
    lines.push("━".repeat(26));

    const numRows = awaz.length; // 9 rows (AW7:AZ15)
    for (let col = 0; col < 4; col++) {
      const t = teamLabels[col];
      lines.push("");
      lines.push(t.emoji + " <b>" + t.label + "</b>");
      lines.push("─".repeat(20));
      let hasData = false;
      for (let r = 0; r < numRows; r++) {
        const txt = ((awaz[r] || [])[col] || "").toString().trim();
        if (!txt || txt === "0") continue;
        const clean = escHtml(txt.replace(/[*_`]/g, ""));
        if (r < AWAZ_LABELS.length) {
          lines.push(AWAZ_LABELS[r].emoji + " <b>" + AWAZ_LABELS[r].name + ":</b> " + clean);
        } else {
          const labelMatch = txt.match(/^([^:]+):/);
          const cellLabel = labelMatch ? labelMatch[1].replace(/[*_`]/g, "").trim() : "Row " + (r + 1);
          lines.push("📌 <b>" + escHtml(cellLabel) + ":</b> " + clean);
        }
        hasData = true;
      }
      if (!hasData) lines.push("✅ Không có sự cố");
    }
    return lines.join("\n");
  }

  const teams = Object.keys(config.groups).filter(t => t !== "CONTROL");
  teams.sort((a, b) => (config.awazCol[a] || 0) - (config.awazCol[b] || 0));

  const lines = [];
  lines.push("📊 <b>SUMMARY TỔNG HỢP — TẤT CẢ TEAM</b>");
  lines.push("📅 " + escHtml(ts));
  lines.push("━".repeat(26));

  const numRows = awaz.length; // 9 rows (AW7:AZ15)
  for (const team of teams) {
    const col = config.awazCol[team];
    if (col === undefined || col === null || col === "") continue;
    const label = config.teamLabels[team] || team.replace("T", "Team ");
    const emoji = config.colors[team] || "🔵";

    lines.push("");
    lines.push(emoji + " <b>" + label + "</b>");
    lines.push("─".repeat(20));
    let hasData = false;
    for (let r = 0; r < numRows; r++) {
      const txt = ((awaz[r] || [])[col] || "").toString().trim();
      if (!txt || txt === "0") continue;
      const clean = escHtml(txt.replace(/[*_`]/g, ""));
      if (r < AWAZ_LABELS.length) {
        lines.push(AWAZ_LABELS[r].emoji + " <b>" + AWAZ_LABELS[r].name + ":</b> " + clean);
      } else {
        const labelMatch = txt.match(/^([^:]+):/);
        const cellLabel = labelMatch ? labelMatch[1].replace(/[*_`]/g, "").trim() : "Row " + (r + 1);
        lines.push("📌 <b>" + escHtml(cellLabel) + ":</b> " + clean);
      }
      hasData = true;
    }
    if (!hasData) lines.push("✅ Không có sự cố");
  }
  return lines.join("\n");
}



// ============================================================
// DELETE-OLD → SEND-NEW: Helpers
// Mỗi lần có data mới → xóa tin cũ trong group → gửi tin mới
// Lưu message_ids vào PropertiesService để xóa lần sau
// ============================================================

/** Lưu danh sách message_ids cho một key */
function saveMsgIds_(msgKey, messageIds) {
  var key = "SD_MSGID_" + msgKey;
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(messageIds));
  Logger.log("[save] 💾 " + msgKey + " = " + JSON.stringify(messageIds));
}

/** Lấy danh sách message_ids đã lưu — để xóa tin cũ */
function getSavedMsgIds_(msgKey) {
  var key = "SD_MSGID_" + msgKey;
  var val = PropertiesService.getScriptProperties().getProperty(key) || "";
  if (!val) { Logger.log("[get] " + msgKey + " → trống"); return []; }
  
  // Thử parse JSON thuần trước (format mới)
  try { 
    var arr = JSON.parse(val);
    if (Array.isArray(arr)) {
      Logger.log("[get] 📋 " + msgKey + " → " + JSON.stringify(arr));
      return arr;
    }
  } catch(e) {}
  
  // Fallback: format cũ có "|date" → cắt bỏ date
  var pipeIdx = val.lastIndexOf("|");
  if (pipeIdx > 0) {
    try { 
      var arr2 = JSON.parse(val.substring(0, pipeIdx));
      if (Array.isArray(arr2)) {
        Logger.log("[get] 📋 " + msgKey + " (old format) → " + JSON.stringify(arr2));
        return arr2;
      }
    } catch(e2) {}
  }
  
  Logger.log("[get] ⚠️ " + msgKey + " parse lỗi: " + val);
  return [];
}

/** Xóa message_ids đã lưu */
function clearMsgIds_(msgKey) {
  PropertiesService.getScriptProperties().deleteProperty("SD_MSGID_" + msgKey);
}

/** Gọi Telegram deleteMessage — xóa 1 tin trong group */
function deleteTelegramMsgBot_(chatId, messageId) {
  var url = "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/deleteMessage";
  try {
    var resp = UrlFetchApp.fetch(url, {
      method:             "post",
      contentType:        "application/json",
      payload:            JSON.stringify({ chat_id: chatId, message_id: messageId }),
      muteHttpExceptions: true,
    });
    var res = JSON.parse(resp.getContentText());
    if (res.ok) {
      Logger.log("[delete] 🗑️ msg_id=" + messageId + " → " + chatId);
    } else {
      Logger.log("[delete] ⚠️ msg_id=" + messageId + ": " + (res.description || ""));
    }
    return res.ok === true;
  } catch (e) {
    Logger.log("[delete] ❌ " + e.message);
    return false;
  }
}

/** Xóa TẤT CẢ tin cũ đã lưu cho một key */
function deleteOldMessages_(chatId, msgKey) {
  var oldIds = getSavedMsgIds_(msgKey);
  for (var i = 0; i < oldIds.length; i++) {
    deleteTelegramMsgBot_(chatId, oldIds[i]);
    if (i < oldIds.length - 1) Utilities.sleep(200);
  }
  if (oldIds.length > 0) clearMsgIds_(msgKey);
}

/** Gửi tin Telegram (HTML) + trả về array message_ids */
function sendTelegramCollectIds_(chatId, text, tag) {
  var url    = "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/sendMessage";
  var chunks = splitMessage(text, 4000);
  var ids    = [];
  chunks.forEach(function(chunk, i) {
    try {
      var resp = UrlFetchApp.fetch(url, {
        method:             "post",
        contentType:        "application/json",
        payload:            JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: "HTML" }),
        muteHttpExceptions: true,
      });
      var res = JSON.parse(resp.getContentText());
      if (res.ok && res.result && res.result.message_id) {
        ids.push(res.result.message_id);
      }
      Logger.log((tag||"") + (res.ok ? " ✅ OK→" : " ❌ ERR→") + chatId +
        (chunks.length > 1 ? " [" + (i+1) + "/" + chunks.length + "]" : "") +
        (!res.ok ? " | " + res.description : ""));
    } catch (e) {
      Logger.log((tag||"") + " ❌ " + e.message);
    }
  });
  return ids;
}

/** Gửi tin Telegram <pre> + trả về array message_ids */
function sendTelegramPreCollectIds_(chatId, plainContent, tag) {
  var url      = "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/sendMessage";
  var maxInner = 3800;
  var escaped  = escHtml(plainContent);
  var chunks   = splitMessage(escaped, maxInner);
  var ids      = [];
  chunks.forEach(function(chunk, i) {
    var wrappedChunk = "<pre>" + chunk + "</pre>";
    try {
      var resp = UrlFetchApp.fetch(url, {
        method:             "post",
        contentType:        "application/json",
        payload:            JSON.stringify({ chat_id: chatId, text: wrappedChunk, parse_mode: "HTML" }),
        muteHttpExceptions: true,
      });
      var res = JSON.parse(resp.getContentText());
      if (res.ok && res.result && res.result.message_id) {
        ids.push(res.result.message_id);
      }
      Logger.log((tag||"") + (res.ok ? " ✅ OK→" : " ❌ ERR→") + chatId +
        (chunks.length > 1 ? " [" + (i+1) + "/" + chunks.length + "]" : "") +
        (!res.ok ? " | " + res.description : ""));
    } catch (e) {
      Logger.log((tag||"") + " ❌ " + e.message);
    }
    if (i < chunks.length - 1) Utilities.sleep(300);
  });
  return ids;
}


// ============================================================
// DELETE-OLD → SEND-NEW WRAPPERS
// Gọi từ checkColC / checkAwAz
// ============================================================

/**
 * Xóa tin cũ → gửi tin mới (HTML mode)
 * @param {string} chatId  - Telegram chat ID
 * @param {string} text    - Nội dung HTML
 * @param {string} msgKey  - Key duy nhất (VD: "TIN1_CONTROL", "TIN2_T1")
 * @param {string} tag     - Log tag
 */
function sendOrEditTelegram(chatId, text, msgKey, tag) {
  // 1. Xóa tin cũ
  deleteOldMessages_(chatId, msgKey);

  // 2. Gửi mới + lưu message_ids
  var newIds = sendTelegramCollectIds_(chatId, text, tag);
  if (newIds.length > 0) {
    saveMsgIds_(msgKey, newIds);
  }
}

/**
 * Xóa tin cũ → gửi tin mới (<pre> mode)
 * @param {string} chatId       - Telegram chat ID
 * @param {string} plainContent - Nội dung plain text (sẽ được escape + bọc <pre>)
 * @param {string} msgKey       - Key duy nhất
 * @param {string} tag          - Log tag
 */
function sendOrEditTelegramPre(chatId, plainContent, msgKey, tag) {
  // 1. Xóa tin cũ
  deleteOldMessages_(chatId, msgKey);

  // 2. Gửi mới + lưu message_ids
  var newIds = sendTelegramPreCollectIds_(chatId, plainContent, tag);
  if (newIds.length > 0) {
    saveMsgIds_(msgKey, newIds);
  }
}


// ============================================================
// NOTE MESSAGE_IDS — Lưu/đọc message_ids của Note gửi bởi @Phongha79
// botlookup_relay.py sẽ gọi GAS để lưu/đọc, rồi xóa Note cũ qua Telethon
// ============================================================

/** Lưu Note message_ids — gọi từ botlookup_relay.py */
/*
function handleSaveNoteMsgIds(body) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty("SD_NOTE_MSGIDS", JSON.stringify(body.msgids || {}));
  Logger.log("[Note] 💾 Saved Note msgids: " + JSON.stringify(body.msgids));
  return json({ status: "ok" });
}

function handleGetNoteMsgIds() {
  var props = PropertiesService.getScriptProperties();
  var raw   = props.getProperty("SD_NOTE_MSGIDS") || "{}";
  try {
    return json({ status: "ok", msgids: JSON.parse(raw) });
  } catch(e) {
    return json({ status: "ok", msgids: {} });
  }
}

function handleSaveMsgIds(body) {
  var key    = (body.key || "").toString().trim();
  var msgids = body.msgids || [];
  if (!key) return json({ status: "error", message: "Missing key" });

  var props = PropertiesService.getScriptProperties();
  props.setProperty("SD_MSGID_" + key, JSON.stringify(msgids));
  Logger.log("[MsgIds] 💾 Saved " + key + " = " + JSON.stringify(msgids));
  return json({ status: "ok", key: key, count: msgids.length });
}

function handleGetMsgIds(body) {
  var key = "";
  if (body && body.key) key = body.key.toString().trim();

  if (!key) return json({ status: "error", message: "Missing key" });

  var props = PropertiesService.getScriptProperties();
  var raw   = props.getProperty("SD_MSGID_" + key) || "[]";
  try {
    return json({ status: "ok", key: key, msgids: JSON.parse(raw) });
  } catch(e) {
    return json({ status: "ok", key: key, msgids: [] });
  }
}
*/

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
// GỬI TELEGRAM với <pre> block — split TRƯỚC khi bọc tag
// Fix lỗi Telegram "Unclosed tag" khi tin dài > 4000 ký tự:
//   splitMessage("<pre>...very long...</pre>") cắt giữa → mất tag đóng/mở
//   → Telegram reject 400 Bad Request cho CONTROL (toàn bộ 4 teams)
//   Teams ngắn hơn → không cần split → không bị lỗi → vì vậy Team có nhận, Control không
// Giải pháp: split nội dung TRONG pre (plain text), rồi bọc từng chunk bằng <pre></pre>
// ============================================================
function sendTelegramPre(chatId, plainContent, tag) {
  const url        = "https://api.telegram.org/bot" + SD_BOT_TOKEN + "/sendMessage";
  const maxInner   = 3800;  // để lại chỗ cho <pre></pre> và overhead
  const escaped    = escHtml(plainContent);
  const chunks     = splitMessage(escaped, maxInner);  // split nội dung đã escape
  chunks.forEach((chunk, i) => {
    const wrappedChunk = "<pre>" + chunk + "</pre>";   // mỗi chunk có tag đầy đủ
    try {
      const resp = UrlFetchApp.fetch(url, {
        method:             "post",
        contentType:        "application/json",
        payload:            JSON.stringify({ chat_id: chatId, text: wrappedChunk, parse_mode: "HTML" }),
        muteHttpExceptions: true,
      });
      const res = JSON.parse(resp.getContentText());
      Logger.log((tag||"") + (res.ok ? " ✅ OK→" : " ❌ ERR→") + chatId +
        (chunks.length > 1 ? " [" + (i+1) + "/" + chunks.length + "]" : "") +
        (!res.ok ? " | " + res.description : ""));
    } catch (e) {
      Logger.log((tag||"") + " ❌ " + e.message);
    }
    if (i < chunks.length - 1) Utilities.sleep(300);
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
  // 1. Trigger checkAndSend mỗi 5 phút
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "checkAndSend")
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("checkAndSend").timeBased().everyMinutes(5).create();

  // 2. Trigger relayBotlookupToTNI mỗi 30 phút — ĐÃ TẮT (Chuyển sang chạy bằng GitHub Actions)
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "relayBotlookupToTNI")
    .forEach(t => ScriptApp.deleteTrigger(t));
  // ScriptApp.newTrigger("relayBotlookupToTNI").timeBased().everyMinutes(30).create();

  Logger.log("✅ Triggers đã cài: checkAndSend() mỗi 5 phút (relayBotlookupToTNI đã chuyển sang GitHub Actions)");
}


// ============================================================
// TEST FUNCTIONS
// ============================================================

// Ép gửi cả 2 tin (bỏ qua timestamp)
function testSendNow() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(TS_KEY_A1);
  props.deleteProperty(TS_KEY_AW7);
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
  PropertiesService.getScriptProperties().deleteProperty(TS_KEY_AW7);
  checkAwAz(sheet);
}

// Xem timestamp đang lưu
function showTimestamps() {
  const p = PropertiesService.getScriptProperties();
  Logger.log("📌 Tin1 (A1)  last sent: " + (p.getProperty(TS_KEY_A1)  || "(chưa có)"));
  Logger.log("📌 Tin2 (AW7) last sent: " + (p.getProperty(TS_KEY_AW7) || "(chưa có)"));
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

  // Kiểm tra AW7
  const aw7 = sheet.getRange("AW7").getValue().toString();
  Logger.log("🔍 AW7 raw (100 chữ): " + aw7.substring(0, 100));
  const tsAw7 = parseAW7Timestamp(sheet);
  Logger.log("⏱️ parseAW7Timestamp: " + (tsAw7 || "(null)"));
  const storedAw7 = p.getProperty(TS_KEY_AW7) || "(chưa có)";
  Logger.log("💾 TS_KEY_AW7 stored: " + storedAw7);
  Logger.log("❓ Sẽ gửi Tin2? " + (tsAw7 && tsAw7 !== storedAw7 ? "✅ Có" : "❌ Không"));
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

function saveMyTokens() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty("SD_BOT_TOKEN", "8647102342:AAGwI95-xeyFfJZusOOrIPVBER-z6taZHZI");
  props.setProperty("SEND_BOT_TOKEN", "8897800070:AAHcG2eHlPsE0KpZAGjcFTe7ndn8gjpQi-A");
  Logger.log("✅ Đã lưu thành công SD_BOT_TOKEN và SEND_BOT_TOKEN!");
}


// ============================================================
// DYNAMIC TEAM CONFIGURATION LOADER
// Reads mapping from "TeamConfig" sheet tab. Creates it if missing.
// ============================================================
function loadTeamConfig(sheet) {
  const ss = sheet.getParent();
  let cfgSheet = ss.getSheetByName("TeamConfig");
  if (!cfgSheet) {
    // Tự động tạo nếu thiếu
    cfgSheet = ss.insertSheet("TeamConfig");
    const defaultData = [
      ["Team Code", "Parent Team", "Telegram Chat ID", "Team Label", "Emoji", "AWAZ Column Index"],
      ["T1", "T1", "-5180992881", "Team 1", "🔵", "0"],
      ["T2", "T2", "-5188855349", "Team 2", "🟡", "1"],
      ["T3", "T3", "-5183480727", "Team 3", "🟢", "2"],
      ["T4", "T4", "-5238696719", "Team 4", "🔴", "3"],
      ["CONTROL", "CONTROL", "-5251698940", "CONTROL", "📊", ""],
      ["T1 S1", "T1", "-5180992881", "Team 1", "🔵", ""],
      ["T2 S1", "T2", "-5188855349", "Team 2", "🟡", ""],
      ["T2 Su1", "T2", "-5188855349", "Team 2", "🟡", ""]
    ];
    cfgSheet.getRange(1, 1, defaultData.length, defaultData[0].length).setValues(defaultData);
    cfgSheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#4472C4").setFontColor("#FFFFFF");
    cfgSheet.setColumnWidth(1, 120);
    cfgSheet.setColumnWidth(2, 120);
    cfgSheet.setColumnWidth(3, 160);
    cfgSheet.setColumnWidth(4, 150);
    cfgSheet.setColumnWidth(5, 80);
    cfgSheet.setColumnWidth(6, 150);
  }
  
  const config = {
    groups: {
      T1: "-5180992881",
      T2: "-5188855349",
      T3: "-5183480727",
      T4: "-5238696719",
      CONTROL: "-5251698940"
    },
    colors: {
      T1: "🔵", T2: "🟡", T3: "🟢", T4: "🔴"
    },
    awazCol: {
      T1: 0, T2: 1, T3: 2, T4: 3
    },
    teamLabels: {
      T1: "Team 1", T2: "Team 2", T3: "Team 3", T4: "Team 4"
    },
    subTeams: {}
  };
  
  try {
    const rows = cfgSheet.getDataRange().getValues();
    if (rows.length > 1) {
      const newGroups = {};
      const newColors = {};
      const newAwazCol = {};
      const newTeamLabels = {};
      const newSubTeams = {};
      
      for (let i = 1; i < rows.length; i++) {
        const [code, parent, chatId, label, emoji, colIdx] = rows[i].map(v => String(v === null || v === undefined ? "" : v).trim());
        if (!code || !parent) continue;
        
        const codeUpper = code.toUpperCase();
        const parentUpper = parent.toUpperCase();
        
        if (codeUpper === parentUpper) {
          if (chatId) newGroups[parentUpper] = chatId;
          if (emoji) newColors[parentUpper] = emoji;
          if (colIdx !== "") newAwazCol[parentUpper] = parseInt(colIdx);
          if (label) newTeamLabels[parentUpper] = label;
        } else {
          newSubTeams[codeUpper] = parentUpper;
        }
      }
      
      if (Object.keys(newGroups).length > 0) {
        config.groups = newGroups;
        config.colors = newColors;
        config.awazCol = newAwazCol;
        config.teamLabels = newTeamLabels;
        config.subTeams = newSubTeams;
      }
    }
  } catch(e) {
    Logger.log("⚠️ Lỗi loadTeamConfig (sử dụng cấu hình mặc định): " + e.message);
  }
  return config;
}

function getTaskTeamMap(config) {
  const map = {};
  for (const team of Object.keys(config.groups)) {
    if (team === "CONTROL") continue;
    const cid = config.groups[team];
    const label = config.teamLabels[team] || team;
    
    map[label.toLowerCase()] = cid;
    map[team.toLowerCase()] = cid;
    
    for (const sub of Object.keys(config.subTeams)) {
      if (config.subTeams[sub] === team) {
        map[sub.toLowerCase()] = cid;
        const subClean = sub.replace(/T(\d+)\s+S(\w+)/i, "team $1 s$2");
        map[subClean.toLowerCase()] = cid;
      }
    }
  }
  return map;
}
