// ============================================================
// TNI DAILY REPORTS SCHEDULER & TASK SENDER
// ============================================================
// Deployed in: Main Apps Script project (alongside apps_script_collector.gs)
// Trigger:     Run relayDailyReports() every 30 minutes (or every 10 minutes)
// ============================================================

const SCHEDULER_GROUPS = {
  T1:      "-1004215695747",  // TNI TEAM 1 (Dawei)
  T2:      "-1004480845549",  // TNI TEAM 2 (Myeik + Team5)
  T3:      "-1004369170658",  // TNI TEAM 3 (Bokpyin)
  T4:      "-1004293741999",  // TNI TEAM 4 (Kawthoung)
  CONTROL: "-5251698940",     // TNI TECHNICA DEP CONTROL SITE
};

const SCHEDULER_TASK_SHEET_ID  = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8";
const SCHEDULER_TASK_SHEET_GID = 133591305;

function relayDailyReports() {
  Logger.log("[relayDailyReports] Bắt đầu quét lịch gửi báo cáo...");

  // Đọc giờ Myanmar
  const myanmarHour = parseInt(Utilities.formatDate(new Date(), "Asia/Rangoon", "H"), 10);
  const myanmarMin  = parseInt(Utilities.formatDate(new Date(), "Asia/Rangoon", "m"), 10);

  // 1. 06:55–07:25 Myanmar → dispatch plan_morning (07:00)
  const isPlanMrnTime = (myanmarHour === 6 && myanmarMin >= 55) || (myanmarHour === 7 && myanmarMin <= 25);
  if (isPlanMrnTime) {
    runOnceToday("DAILY_PLAN_MRN_DATE_", function() {
      return triggerDailyWorkflow("plan_morning");
    });
  }

  // 2. 15:55–16:25 Myanmar → gửi Task Remain & dispatch plan_eod, bod_assign, daily_task (16:00)
  const isEodReportTime = (myanmarHour === 15 && myanmarMin >= 55) || (myanmarHour === 16 && myanmarMin <= 25);
  if (isEodReportTime) {
    runOnceToday("DAILY_PLAN_EOD_DATE_", function() {
      return triggerDailyWorkflow("plan_eod");
    });
    runOnceToday("DAILY_BOD_ASSIGN_DATE_", function() {
      return triggerDailyWorkflow("bod_assign");
    });
    runOnceToday("DAILY_TASK_DATE_", function() {
      return triggerDailyWorkflow("daily_task");
    });
    runOnceToday("TASK_REMAIN_DATE_", function() {
      sendSchedulerTaskRemain();
      return true;
    });
  }

  // 4. 20:25–20:55 Myanmar → dispatch daily_read_report (20:30)
  const isReadReportTime = (myanmarHour === 20 && myanmarMin >= 25 && myanmarMin <= 55);
  if (isReadReportTime) {
    runOnceToday("DAILY_READ_REPORT_DATE_", function() {
      return triggerDailyWorkflow("read_report");
    });
  }

  // 5. 20:55–21:25 Myanmar → dispatch plan_update (21:00)
  const isPlanUpdTime = (myanmarHour === 20 && myanmarMin >= 55) || (myanmarHour === 21 && myanmarMin <= 25);
  if (isPlanUpdTime) {
    runOnceToday("DAILY_PLAN_UPD_DATE_", function() {
      return triggerDailyWorkflow("plan_update");
    });
  }
}

function runOnceToday(prefixKey, callback) {
  const todayKey = prefixKey + Utilities.formatDate(new Date(), "Asia/Rangoon", "yyyyMMdd");
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty(todayKey)) {
    const success = callback();
    if (success) {
      props.setProperty(todayKey, "done");
      Logger.log("✅ Đã thực hiện thành công tác vụ: " + prefixKey);
    }
  } else {
    Logger.log("ℹ️ Tác vụ " + prefixKey + " đã chạy hôm nay rồi — bỏ qua");
  }
}

// Dispatch GitHub Actions workflow trong repo tni-bot
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

// Gửi Task Remain trực tiếp qua Telegram Bot API
function sendSchedulerTaskRemain() {
  try {
    const props = PropertiesService.getScriptProperties();
    const botToken = props.getProperty("SEND_BOT_TOKEN") || "";
    if (!botToken) {
      Logger.log("[TaskRemain] ⚠️ SEND_BOT_TOKEN chưa set");
      return;
    }

    const ss = SpreadsheetApp.openById(SCHEDULER_TASK_SHEET_ID);
    const sheets = ss.getSheets();
    const taskSheet = sheets.find(s => s.getSheetId() === SCHEDULER_TASK_SHEET_GID);
    if (!taskSheet) {
      Logger.log("[TaskRemain] ❌ Không tìm thấy sheet GID " + SCHEDULER_TASK_SHEET_GID);
      return;
    }

    // Đọc dữ liệu từ hàng 4 đến 61, cột A:E
    const data = taskSheet.getRange("A4:E61").getValues();
    const teamTasks = {};   // { chatId: [ {content, teleId, teamRaw} ] }

    // Map tên team trong cột A → Chat ID group
    const taskTeamMap = {
      "team 1": SCHEDULER_GROUPS.T1,
      "team 2": SCHEDULER_GROUPS.T2,
      "team 5": SCHEDULER_GROUPS.T2, // Team 5 gộp chung Team 2
      "team 3": SCHEDULER_GROUPS.T3,
      "team 4": SCHEDULER_GROUPS.T4,
    };

    for (const row of data) {
      const teamRaw = row[0].toString().trim();
      const content = row[3].toString().trim();   // Cột D
      const teleId  = row[4].toString().trim();   // Cột E

      if (!teamRaw || !content) continue;

      const chatId = taskTeamMap[teamRaw.toLowerCase()];
      if (!chatId) {
        Logger.log("[TaskRemain] ⚠️ Không tìm thấy group cho team: " + teamRaw);
        continue;
      }

      if (!teamTasks[chatId]) teamTasks[chatId] = [];
      teamTasks[chatId].push({ content, teleId, teamRaw });
    }

    // Xóa tin cũ → Gửi từng task riêng lẻ → Lưu msg_ids mới
    for (const [chatId, tasks] of Object.entries(teamTasks)) {
      var teamKey = "";
      for (var tk in SCHEDULER_GROUPS) {
        if (SCHEDULER_GROUPS[tk] === chatId) {
          teamKey = tk;
          break;
        }
      }
      var msgKey = "TASKREMAIN_" + (teamKey || chatId);

      // Xóa tất cả tin Task cũ trong group này
      deleteSchedulerOldMessages_(botToken, chatId, msgKey);

      // Gửi từng task
      var allNewIds = [];
      Logger.log("[TaskRemain] Gửi " + tasks.length + " task đến group " + chatId);
      for (const task of tasks) {
        var ids = sendSchedulerTelegramCollectIds_(botToken, chatId, task.content, "[Task][" + task.teamRaw + "]");
        allNewIds = allNewIds.concat(ids);
        Utilities.sleep(800);
      }

      if (allNewIds.length > 0) {
        saveSchedulerMsgIds_(msgKey, allNewIds);
      }
    }

    // Gửi DM cá nhân
    for (const [chatId, tasks] of Object.entries(teamTasks)) {
      for (const task of tasks) {
        if (!task.teleId) continue;
        const uid = task.teleId.startsWith("@") ? task.teleId : task.teleId.replace(/\D/g, "");
        if (!uid) continue;
        sendSchedulerTelegram_(botToken, uid, "📋 Task của bạn:\n\n" + task.content);
        Utilities.sleep(500);
      }
    }

    Logger.log("[TaskRemain] ✅ Đã gửi xong Task Remain");
  } catch(e) {
    Logger.log("[TaskRemain] ❌ Lỗi: " + e.message);
  }
}

// Helper gửi Telegram
function sendSchedulerTelegram_(botToken, chatId, text) {
  try {
    const url = "https://api.telegram.org/bot" + botToken + "/sendMessage";
    UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ chat_id: chatId, text: text }),
      muteHttpExceptions: true
    });
  } catch(e) {}
}

// Helper gửi Telegram và lấy message IDs
function sendSchedulerTelegramCollectIds_(botToken, chatId, text, label) {
  const ids = [];
  try {
    const url = "https://api.telegram.org/bot" + botToken + "/sendMessage";
    const resp = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ chat_id: chatId, text: text }),
      muteHttpExceptions: true
    });
    const res = JSON.parse(resp.getContentText());
    if (res.ok && res.result && res.result.message_id) {
      ids.push(res.result.message_id);
    }
  } catch(e) {
    Logger.log("⚠️ Lỗi gửi tin " + label + ": " + e.message);
  }
  return ids;
}

// Xóa tin nhắn cũ lưu trong Properties
function deleteSchedulerOldMessages_(botToken, chatId, key) {
  try {
    const props = PropertiesService.getScriptProperties();
    const raw = props.getProperty("MSGIDS_" + key) || "[]";
    const ids = JSON.parse(raw);
    if (ids && ids.length > 0) {
      for (const id of ids) {
        UrlFetchApp.fetch("https://api.telegram.org/bot" + botToken + "/deleteMessage", {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify({ chat_id: chatId, message_id: id }),
          muteHttpExceptions: true
        });
      }
    }
  } catch(e) {}
}

// Lưu message IDs
function saveSchedulerMsgIds_(key, ids) {
  try {
    PropertiesService.getScriptProperties().setProperty("MSGIDS_" + key, JSON.stringify(ids));
  } catch(e) {}
}

// ── Các hàm chạy thủ công để test / gửi nhanh báo cáo ───────────
function runManual_plan_morning()   { triggerDailyWorkflow("plan_morning"); }
function runManual_plan_eod()       { triggerDailyWorkflow("plan_eod"); }
function runManual_plan_update()    { triggerDailyWorkflow("plan_update"); }
function runManual_bod_assign()     { triggerDailyWorkflow("bod_assign"); }
function runManual_read_report()    { triggerDailyWorkflow("read_report"); }
function runManual_daily_task()     { triggerDailyWorkflow("daily_task"); }
function runManual_sendTaskRemain() { sendSchedulerTaskRemain(); }
