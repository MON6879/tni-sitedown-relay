// ============================================================
// daily_report_trigger.gs
// Trigger GitHub Actions "Reports 1,2,3,4" dung gio Myanmar
// Flow: GAS Timer (16:00 Myanmar) → GitHub API workflow_dispatch
//       → GitHub Actions chay ngay (khong bi delay cron)
//
// Setup (1 lan duy nhat):
//   1. Tao GitHub PAT tai: github.com → Settings → Developer Settings
//      → Personal access tokens → Fine-grained tokens
//      → Permissions: Actions = Read and write, cho repo tni-bot
//   2. Trong GAS Editor: Extensions → Script Properties → Add:
//      Key=GITHUB_TOKEN  Value=<PAT cua ban>
//   3. Chay ham setupDailyReportTrigger() 1 lan (se tu dong tao trigger)
// ============================================================

const DRT_GH_REPO    = 'phonghdpxd-cmd/tni-bot';
const DRT_GH_WF_FILE = 'daily_reports.yml';
const DRT_GH_BRANCH  = 'main';
const DRT_GH_REPORT  = 'Reports 1, 2, 3, 4 - Daily Task & Backlog';



// ── Ham ho tro: luu GITHUB_TOKEN vao Script Properties (goi qua API) ──
function setGitHubTokenProp_(token) {
  if (!token) return 'error: empty token';
  PropertiesService.getScriptProperties().setProperty('GITHUB_TOKEN', token);
  return 'ok';
}


// ── Ham chinh: goi GitHub API de trigger workflow_dispatch ──
function triggerDailyReport_() {
  const props = PropertiesService.getScriptProperties();
  const token = (
    props.getProperty('GITHUB_TOKEN') ||
    props.getProperty('GITHUB_PAT') ||
    props.getProperty('GH_PAT') || ''
  ).trim();

  if (!token) {
    Logger.log('❌ GITHUB_TOKEN / GITHUB_PAT chua duoc set trong Script Properties!');
    Logger.log('   → Extensions → Script Properties → Add: GITHUB_TOKEN = <PAT>');
    return false;
  }

  // Danh sách workflow file ưu tiên thử nghiệm
  const wfFiles = ['daily_reports.yml', 'telegram_send.yml'];
  let triggered = false;

  for (let i = 0; i < wfFiles.length; i++) {
    const wfFile = wfFiles[i];
    const url = `https://api.github.com/repos/${DRT_GH_REPO}/actions/workflows/${wfFile}/dispatches`;

    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      contentType: 'application/json',
      payload: JSON.stringify({
        ref: DRT_GH_BRANCH,
        inputs: {
          report_type: DRT_GH_REPORT,
          skip_delay: '1',
        },
      }),
      muteHttpExceptions: true,
    };

    try {
      const resp = UrlFetchApp.fetch(url, options);
      const code = resp.getResponseCode();
      const now  = Utilities.formatDate(new Date(), 'Asia/Yangon', 'dd/MM/yyyy HH:mm');
      
      if (code === 204) {
        Logger.log(`✅ [${now}] Trigger ${wfFile} (${DRT_GH_REPORT}) thanh cong!`);
        triggered = true;
        break;
      } else {
        Logger.log(`⚠️ [${now}] GitHub API (${wfFile}): HTTP ${code}`);
        Logger.log(resp.getContentText().substring(0, 300));
      }
    } catch (e) {
      Logger.log('❌ Loi UrlFetchApp (' + wfFile + '): ' + e.message);
    }
  }

  return triggered;
}

// ── Tao trigger chay luc 16:00 Myanmar moi ngay ──
// Goi ham nay 1 lan trong GAS Editor (Run → setupDailyReportTrigger)
function setupDailyReportTrigger() {
  // Xoa trigger cu neu co
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'triggerDailyReport_')
    .forEach(t => ScriptApp.deleteTrigger(t));

  // Tao trigger moi: 16:10 Myanmar (Asia/Yangon) moi ngay
  // GAS dung timezone cua project (Asia/Yangon) → atHour(16) nearMinute(10) = 16:10 Myanmar
  ScriptApp.newTrigger('triggerDailyReport_')
    .timeBased()
    .atHour(16)
    .nearMinute(10)
    .everyDays(1)
    .create();

  Logger.log('✅ Trigger da tao: triggerDailyReport_ luc 16:10 Myanmar moi ngay');

  // Kiem tra token
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) {
    Logger.log('⚠️ CHUA co GITHUB_TOKEN! Vao Extensions → Script Properties → Add row:');
    Logger.log('   Key: GITHUB_TOKEN');
    Logger.log('   Value: <PAT cua ban tu github.com/settings/tokens>');
  } else {
    Logger.log('✅ GITHUB_TOKEN da co san — sẵn sang!');
  }
}

// ── Xoa trigger (neu can) ──
function deleteDailyReportTrigger() {
  const triggers = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'triggerDailyReport_');
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log(`🗑️ Da xoa ${triggers.length} trigger(s)`);
}

// ── Webhook HTTP Endpoint Handler (Bảo mật 16:00 Trigger) ──
// Được gọi từ main router doGet / doPost trong apps_script_collector.gs cuando action === "trigger_16h"

function handleWebhookRequest_(e) {
  e = e || {};
  const params = e.parameter || {};
  const action = (params.action || '').trim();
  const reqSecret = (params.secret || '').trim();
  const reportType = (params.type || params.report_type || '').trim();

  const props = PropertiesService.getScriptProperties();
  const configuredSecret = (props.getProperty('WEBHOOK_SECRET') || 'TNI_REPORTS_SECURE_KEY_2026').trim();

  // 1. Kiểm tra action hợp lệ
  const validActions = ['trigger_16h', 'trigger_report', 'relay_all'];
  if (validActions.indexOf(action) === -1) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'Invalid action parameter. Supported: ' + validActions.join(', ')
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // 2. Bảo mật: Kiểm tra Secret Token
  if (!reqSecret || reqSecret !== configuredSecret) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'forbidden',
      message: '403 Forbidden: Invalid or missing secret token'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // 3. Chống Spam / Rate limiting: Giới hạn tối thiểu 1 phút giữa 2 lần trigger qua Webhook
  const lastTrigger = parseInt(props.getProperty('LAST_WEBHOOK_TRIGGER_TS') || '0', 10);
  const nowMs = Date.now();
  if (nowMs - lastTrigger < 60000) { // 1 phút = 60,000 ms
    return ContentService.createTextOutput(JSON.stringify({
      status: 'rate_limited',
      message: 'Triggered recently within 1 minute. Request ignored to prevent duplicate sending.'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Cập nhật timestamp lần trigger này
  props.setProperty('LAST_WEBHOOK_TRIGGER_TS', String(nowMs));

  // 4. Kích hoạt gửi báo cáo tương ứng
  let success = false;
  let runMessage = '';
  const nowStr = Utilities.formatDate(new Date(), 'Asia/Yangon', 'dd/MM/yyyy HH:mm:ss');

  if (action === 'trigger_16h') {
    success = triggerDailyReport_();
    runMessage = `[${nowStr}] Trigger Reports 1, 2, 3, 4 dispatch sent to GitHub Actions!`;
  } else if (action === 'trigger_report') {
    const targetType = reportType || DRT_GH_REPORT;
    if (typeof triggerDailyWorkflow === 'function') {
      success = triggerDailyWorkflow(targetType);
      runMessage = `[${nowStr}] Trigger report "${targetType}" dispatched to GitHub Actions!`;
    } else {
      success = triggerDailyReport_();
      runMessage = `[${nowStr}] Trigger default report dispatched to GitHub Actions!`;
    }
  } else if (action === 'relay_all') {
    if (typeof relayDailyReports === 'function') {
      relayDailyReports();
      success = true;
      runMessage = `[${nowStr}] Executed relayDailyReports() for all scheduled daily reports!`;
    } else {
      runMessage = `[${nowStr}] relayDailyReports function not found`;
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: success ? 'success' : 'error',
    message: runMessage,
    timestamp: nowStr
  })).setMimeType(ContentService.MimeType.JSON);
}

// ── Test ngay: goi thu ham trigger (khong can doi 16:00) ──
function testTriggerNow() {
  Logger.log('🧪 Test trigger ngay...');
  triggerDailyReport_();
}



