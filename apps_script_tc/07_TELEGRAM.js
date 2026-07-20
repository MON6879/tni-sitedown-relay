// ============================================================
// FILE: 07_TELEGRAM.gs
// MÔ TẢ: Gửi thông báo qua Telegram Bot API
// ============================================================

// ════════════════════════════════════════════════════════════
// HÀM GỬI TIN NHẮN CƠ BẢN
// ════════════════════════════════════════════════════════════
function sendTelegramMsg(chatId, text) {
  if (!chatId || chatId.startsWith('CHAT_ID')) {
    console.warn('Telegram chatId chưa cấu hình:', chatId);
    return false;
  }
  if (TELEGRAM_BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
    console.warn('Telegram bot token chưa cấu hình');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const payload = {
      chat_id    : String(chatId),
      text       : text,
      parse_mode : 'HTML',
    };

    const options = {
      method      : 'post',
      contentType : 'application/json',
      payload     : JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    const resp = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(resp.getContentText());

    if (!json.ok) {
      console.error('Telegram API lỗi:', json.description);
      return false;
    }
    return true;
  } catch(e) {
    console.error('sendTelegramMsg error:', e.message);
    return false;
  }
}

// ════════════════════════════════════════════════════════════
// GỬI TEST
// ════════════════════════════════════════════════════════════
function sendTestTelegram() {
  const ui = SpreadsheetApp.getUi();
  const msg =
    `🤖 <b>TEST THÔNG BÁO HỆ THỐNG QLTC</b>\n\n` +
    `✅ Kết nối Telegram thành công!\n` +
    `📅 Thời gian: ${tsNow()}\n` +
    `👤 Người gửi: ${Session.getActiveUser().getEmail()}\n` +
    `📊 Hệ thống: QLTC Chi Nhánh v1.0`;

  const results = [];
  Object.entries(TELEGRAM_CHAT_IDS).forEach(([key, chatId]) => {
    const ok = sendTelegramMsg(chatId, msg);
    results.push(`${key}: ${ok ? '✅' : '❌'}`);
  });

  ui.alert('📲 Kết quả gửi test:\n\n' + results.join('\n'));
}

// ════════════════════════════════════════════════════════════
// GỬI BÁO CÁO HÀNG TUẦN
// ════════════════════════════════════════════════════════════
function sendWeeklyReport() {
  const thang = getMonthYear();

  // Tổng hợp từng team
  let teamLines = '';
  let totalAdv = 0, totalClr = 0;

  ROLES.TEAM_LEADERS.forEach(team => {
    const info = getTeamLimitInfo(team.name);
    if (info) {
      totalAdv += info.totalAdvanced || 0;
      totalClr += info.totalCleared || 0;
      const remain = info.canAdvanceMore || 0;
      const emoji = remain <= 0 ? '🔴' : remain < (info.clearAmount * 0.2) ? '🟡' : '🟢';
      teamLines += `${emoji} ${team.name}: Tồn ứng ${fmtVND(info.outstanding)} | Còn ứng ${fmtVND(remain)}\n`;
    }
  });

  // Đếm chứng từ chờ
  const settSh = getSheet(SHEET.SETTLEMENT);
  const settData = settSh.getLastRow() > 2
    ? settSh.getRange(3, 1, settSh.getLastRow()-2, 15).getValues()
    : [];
  const pendingCount = settData.filter(r => r[13] === 'Chờ kiểm tra').length;
  const sentCount    = settData.filter(r => r[13] === 'Đã gửi TCT').length;

  const msg =
    `📊 <b>BÁO CÁO TUẦN — ${thang}</b>\n` +
    `📅 Cập nhật: ${tsDate()}\n\n` +
    `<b>TÌNH TRẠNG TẠM ỨNG:</b>\n${teamLines}\n` +
    `💸 Tổng đã ứng tháng này: ${fmtVND(totalAdv)} đ\n` +
    `✅ Tổng đã clear: ${fmtVND(totalClr)} đ\n\n` +
    `<b>CHỨNG TỪ:</b>\n` +
    `⏳ Chờ kiểm tra: ${pendingCount}\n` +
    `📤 Đã gửi TCT chờ phản hồi: ${sentCount}`;

  sendTelegramMsg(TELEGRAM_CHAT_IDS.GROUP, msg);
  sendTelegramMsg(TELEGRAM_CHAT_IDS.TPTC, msg);
  sendTelegramMsg(TELEGRAM_CHAT_IDS.BOD, msg);

  SpreadsheetApp.getUi().alert('✅ Đã gửi báo cáo tuần qua Telegram!');
}

// ════════════════════════════════════════════════════════════
// GỬI CẢNH BÁO CHÊNH LỆCH
// ════════════════════════════════════════════════════════════
function sendDiffAlert() {
  const sh = getSheet(SHEET.TCT_DETAIL);
  const lastRow = sh.getLastRow();
  if (lastRow <= 1) {
    SpreadsheetApp.getUi().alert('Chưa có dữ liệu chi tiết TCT để cảnh báo.');
    return;
  }

  const data = sh.getRange(2, 1, lastRow-1, 13).getValues();
  const diffs = data.filter(r => Number(r[7]) > 0);

  if (diffs.length === 0) {
    SpreadsheetApp.getUi().alert('✅ Không có chênh lệch nào.');
    return;
  }

  const totalDiff = diffs.reduce((s,r) => s + Number(r[7]), 0);

  let lines = diffs.slice(0, 10).map(r =>
    `• ${r[2]} | ${r[4].substring(0,30)} | -${fmtVND(r[7])} đ`
  ).join('\n');
  if (diffs.length > 10) lines += `\n... và ${diffs.length-10} khoản khác`;

  const msg =
    `⚠️ <b>CẢNH BÁO CHÊNH LỆCH TCT</b>\n\n` +
    `Tổng chênh lệch: <b>${fmtVND(totalDiff)} đ</b>\n` +
    `Số khoản bị cắt: ${diffs.length}\n\n` +
    `<b>Chi tiết:</b>\n${lines}`;

  sendTelegramMsg(TELEGRAM_CHAT_IDS.GROUP, msg);
  sendTelegramMsg(TELEGRAM_CHAT_IDS.TPTC, msg);
  sendTelegramMsg(TELEGRAM_CHAT_IDS.BOD, msg);

  SpreadsheetApp.getUi().alert('✅ Đã gửi cảnh báo chênh lệch qua Telegram!');
}

// ════════════════════════════════════════════════════════════
// TRIGGER: Gửi báo cáo tự động (cài đặt qua installTriggers)
// ════════════════════════════════════════════════════════════
function installTriggers() {
  // Xóa trigger cũ
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // Báo cáo hàng tuần (Thứ 2, 8:00 sáng)
  ScriptApp.newTrigger('sendWeeklyReport')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8)
    .create();

  // onEdit trigger
  ScriptApp.newTrigger('onEditHandler')
    .forSpreadsheet(getSS())
    .onEdit()
    .create();

  SpreadsheetApp.getUi().alert(
    '✅ Đã cài đặt triggers:\n' +
    '• Báo cáo hàng tuần: Thứ 2, 8:00 sáng\n' +
    '• onEdit: Tự động khi chỉnh sửa'
  );
}
