var DISPATCH_REPO = "MON6879/tni-sitedown-relay";
var DISPATCH_API_BASE = "https://api.github.com/repos/" + DISPATCH_REPO + "/actions/workflows/";

function dispatchTrain5Min() {
  _dispatchGH("train_5min.yml", "Train5Min", {
    "report_type": "Reports 1, 2, 3, 4 - Daily Task & Backlog",
    "skip_delay": "1"
  });
}

function dispatchBotlookupRelay() {
  var mmt = _getDispatchMMT();
  var hhmm = mmt.h * 100 + mmt.m;
  if (hhmm < 330 || hhmm > 2215) return;
  _dispatchGH("botlookup_relay.yml", "BotlookupRelay");
}

function _dispatchGH(workflowFile, label, inputs) {
  var token = PropertiesService.getScriptProperties().getProperty("GITHUB_PAT");
  if (!token) { Logger.log("❌ Missing GITHUB_PAT"); return; }
  var url = DISPATCH_API_BASE + workflowFile + "/dispatches";
  var payload = { "ref": "main" };
  if (inputs) payload["inputs"] = inputs;
  try {
    var resp = UrlFetchApp.fetch(url, {
      method: "post",
      headers: { "Authorization": "Bearer " + token, "Accept": "application/vnd.github+json" },
      payload: JSON.stringify(payload),
      contentType: "application/json",
      muteHttpExceptions: true
    });
    Logger.log("[" + label + "] " + (resp.getResponseCode() === 204 ? "✅" : "⚠️") + " HTTP " + resp.getResponseCode());
  } catch (err) { Logger.log("[" + label + "] ❌ " + err.message); }
}

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
  Logger.log("✅ Created 2 triggers: Train (5min) + Botlookup (30min)");
}

function _getDispatchMMT() {
  var now = new Date();
  var utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  var mmtTotalMin = (utcMin + 390) % 1440;
  return { h: Math.floor(mmtTotalMin / 60), m: mmtTotalMin % 60 };
}
