var DISPATCH_REPO = "MON6879/tni-sitedown-relay";
var DISPATCH_API_BASE = "https://api.github.com/repos/" + DISPATCH_REPO + "/actions/workflows/";

/**
 * Trigger chạy mỗi 5 phút bởi GAS
 * 1. Dispatch Train 5-Min (Toa 0 keepalive + các báo cáo theo check_time)
 * 2. Đồng thời kiểm tra: nếu rơi vào nhịp :06 hoặc :36 MMT (:04-:08 hoặc :34-:38) → Dispatch luôn Botlookup Relay
 */
function dispatchTrain5Min() {
  // 1. Dispatch Train 5-Min
  _dispatchGH("train_5min.yml", "Train5Min");

  // 2. Tự động kiểm tra mốc :06 & :36 MMT cho Botlookup Relay (Chống trôi lệch nhịp)
  var mmt = _getDispatchMMT();
  var hhmm = mmt.h * 100 + mmt.m;
  if (hhmm >= 330 && hhmm <= 2215) {
    var m = mmt.m;
    // Khớp nhịp :06 hoặc :36 (cửa sổ :04-:08 hoặc :34-:38)
    if ((m >= 4 && m <= 8) || (m >= 34 && m <= 38)) {
      Logger.log("⏰ Nhịp " + _pad(mmt.h) + ":" + _pad(mmt.m) + " MMT → Tự động kích hoạt Botlookup Relay");
      _dispatchGH("botlookup_relay.yml", "BotlookupRelay_AutoWindow");
    }
  }
}

/**
 * Trigger độc lập 30 phút cho Botlookup Relay
 */
function dispatchBotlookupRelay() {
  var mmt = _getDispatchMMT();
  var hhmm = mmt.h * 100 + mmt.m;
  if (hhmm < 330 || hhmm > 2215) return;
  _dispatchGH("botlookup_relay.yml", "BotlookupRelay_30Min");
}

/**
 * Hàm điều phối gọi GitHub REST API
 */
function _dispatchGH(workflowFile, label, inputs) {
  var props = PropertiesService.getScriptProperties();
  var token = (
    props.getProperty("GITHUB_PAT") ||
    props.getProperty("GITHUB_TOKEN") ||
    props.getProperty("GH_PAT") ||
    props.getProperty("GH_TOKEN") || ""
  ).trim();

  if (!token) {
    Logger.log("[" + label + "] ❌ Missing GITHUB_PAT");
    return;
  }

  var url = DISPATCH_API_BASE + workflowFile + "/dispatches";
  var payload = { "ref": "main" };
  if (inputs) payload["inputs"] = inputs;

  try {
    var resp = UrlFetchApp.fetch(url, {
      method: "post",
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json"
      },
      payload: JSON.stringify(payload),
      contentType: "application/json",
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    Logger.log("[" + label + "] " + (code === 204 ? "✅ HTTP 204 OK" : "⚠️ HTTP " + code));
  } catch (err) {
    Logger.log("[" + label + "] ❌ Lỗi dispatch: " + err.message);
  }
}

/**
 * Tạo 2 triggers tự động trên GAS
 */
function setupGitHubDispatchTriggers() {
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    var fn = existing[i].getHandlerFunction();
    if (fn === "dispatchTrain5Min" || fn === "dispatchBotlookupRelay") {
      ScriptApp.deleteTrigger(existing[i]);
    }
  }
  ScriptApp.newTrigger("dispatchTrain5Min").timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger("dispatchBotlookupRelay").timeBased().everyMinutes(30).create();
  Logger.log("✅ Đã thiết lập 2 Trigger GAS: Train (mỗi 5 phút) + Botlookup (mỗi 30 phút)");
}

/**
 * Helper tính giờ Myanmar (UTC+6:30)
 */
function _getDispatchMMT() {
  var now = new Date();
  var utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  var mmtTotalMin = (utcMin + 390) % 1440;
  return { h: Math.floor(mmtTotalMin / 60), m: mmtTotalMin % 60 };
}

function _pad(n) {
  return n < 10 ? "0" + n : "" + n;
}
