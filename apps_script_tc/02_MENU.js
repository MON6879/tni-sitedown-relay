// ============================================================
// FILE: 02_MENU.gs
// MÔ TẢ: Custom Menu trong Google Spreadsheet
// ============================================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const role = getCurrentUserRole();

  const menu = ui.createMenu('📋 QLTC Chi Nhánh');

  // ── Menu chung cho tất cả ──
  menu.addItem('🔄 Làm mới Dashboard của tôi', 'refreshMyDashboard');
  menu.addSeparator();

  // ── Menu TPTC ──
  if (role === 'TPTC' || role === 'UNKNOWN') {
    menu.addSubMenu(
      ui.createMenu('📄 Chứng từ (TPTC)')
        .addItem('➕ Thêm chứng từ mới', 'addSettlementRecord')
        .addItem('✅ Xác nhận chứng từ đã kiểm tra', 'confirmSettlement')
        .addItem('📤 Đánh dấu đã gửi TCT', 'markSentToTct')
        .addItem('🔍 Xem chứng từ chờ xử lý', 'viewPendingSettlements')
    );

    menu.addSubMenu(
      ui.createMenu('💸 Lệnh Tạm ứng (TPTC)')
        .addItem('➕ Lập lệnh tạm ứng mới', 'createAdvanceRequest')
        .addItem('📊 Cập nhật hạn mức tạm ứng', 'updateAdvanceLimits')
        .addItem('👁️ Xem lệnh chờ BOD duyệt', 'viewPendingAdvances')
    );

    menu.addSubMenu(
      ui.createMenu('🔄 Đối chiếu TCT (TPTC)')
        .addItem('📥 Import sổ cái TCT (BOD sheet)', 'importTctJournal')
        .addItem('📥 Import chi tiết clear TCT', 'importTctDetail')
        .addItem('⚡ Chạy đối chiếu tự động', 'runReconciliation')
        .addItem('📊 Xem báo cáo chênh lệch', 'viewDiffReport')
        .addSeparator()
        .addItem('📋 So sánh Expenses & MDG theo tháng', 'buildExpenseMdgCompare')
    );

    menu.addSubMenu(
      ui.createMenu('📊 Dashboard (TPTC)')
        .addItem('🔄 Cập nhật Dashboard TPTC', 'refreshDashTptc')
        .addItem('📧 Gửi báo cáo qua Email', 'sendEmailReport')
    );
  }

  // ── Menu BOD ──
  if (role === 'BOD' || role === 'UNKNOWN') {
    menu.addSubMenu(
      ui.createMenu('💳 Chuyển tiền (BOD)')
        .addItem('✅ Xác nhận & Ghi nhận chuyển tiền', 'confirmTransfer')
        .addItem('📋 Xem lệnh ứng cần xử lý', 'viewPendingTransfers')
        .addItem('📥 Đồng bộ dữ liệu từ file BOD', 'syncBodCashflow')
    );

    menu.addSubMenu(
      ui.createMenu('📊 Dashboard (BOD)')
        .addItem('🔄 Cập nhật Dashboard BOD', 'refreshDashBod')
        .addItem('📊 Xem dòng tiền tổng hợp', 'viewCashflowSummary')
    );
  }

  // ── Menu chung TPTC + BOD ──
  if (role !== 'TEAM') {
    menu.addSeparator();
    menu.addSubMenu(
      ui.createMenu('📲 Thông báo Telegram')
        .addItem('📤 Gửi thông báo test', 'sendTestTelegram')
        .addItem('📊 Gửi báo cáo hàng tuần', 'sendWeeklyReport')
        .addItem('⚠️ Gửi cảnh báo chênh lệch', 'sendDiffAlert')
    );
  }

  // ── Menu Quản trị (chỉ TPTC) ──
  if (role === 'TPTC' || role === 'UNKNOWN') {
    menu.addSeparator();
    menu.addSubMenu(
      ui.createMenu('⚙️ Quản trị')
        .addItem('🚀 Khởi tạo hệ thống (Chạy 1 lần)', 'setupSystem')
        .addItem('🔄 Reset dữ liệu mẫu', 'insertSampleData')
        .addItem('📋 Kiểm tra cấu hình', 'checkConfig')
        .addItem('🔑 Hướng dẫn tạo Telegram Bot', 'showTelegramGuide')
    );
  }

  menu.addToUi();
}

// ════════════════════════════════════════════════════════════
// REFRESH: Dashboard theo role
// ════════════════════════════════════════════════════════════
function refreshMyDashboard() {
  const role = getCurrentUserRole();
  if (role === 'TPTC')       refreshDashTptc();
  else if (role === 'BOD')   refreshDashBod();
  else if (role === 'TEAM')  refreshTeamDashboard();
  else SpreadsheetApp.getUi().alert('⚠️ Email chưa được cấu hình trong hệ thống.');
}

// ════════════════════════════════════════════════════════════
// HELPER: Check config
// ════════════════════════════════════════════════════════════
function checkConfig() {
  const ui = SpreadsheetApp.getUi();
  const email = Session.getActiveUser().getEmail();
  const role = getCurrentUserRole();

  let msg = `📋 THÔNG TIN ĐĂNG NHẬP\n`;
  msg += `Email: ${email}\n`;
  msg += `Vai trò: ${role}\n\n`;
  msg += `📁 GOOGLE SHEET IDs\n`;
  msg += `BOD File ID: ${BOD_SS_ID}\n`;
  msg += `TCT File ID: ${TCT_SS_ID}\n\n`;
  msg += `🤖 TELEGRAM\n`;
  msg += `Bot Token: ${TELEGRAM_BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE' ? '❌ Chưa cấu hình' : '✅ Đã cấu hình'}\n`;

  ui.alert('⚙️ Kiểm tra Cấu hình', msg, ui.ButtonSet.OK);
}

// ════════════════════════════════════════════════════════════
// HELPER: Telegram guide
// ════════════════════════════════════════════════════════════
function showTelegramGuide() {
  const ui = SpreadsheetApp.getUi();
  const msg =
    `📲 HƯỚNG DẪN TẠO TELEGRAM BOT\n\n` +
    `1. Mở Telegram → Tìm @BotFather\n` +
    `2. Gõ /newbot → Đặt tên bot\n` +
    `3. Copy TOKEN nhận được\n` +
    `4. Dán vào TELEGRAM_BOT_TOKEN trong 00_CONFIG.gs\n\n` +
    `LẤY CHAT ID:\n` +
    `1. Thêm bot vào group/chat\n` +
    `2. Gửi 1 tin nhắn bất kỳ\n` +
    `3. Truy cập: https://api.telegram.org/bot[TOKEN]/getUpdates\n` +
    `4. Tìm "chat":{"id": ...} → Copy số đó\n` +
    `5. Dán vào TELEGRAM_CHAT_IDS trong 00_CONFIG.gs`;

  ui.alert('🤖 Hướng dẫn Telegram Bot', msg, ui.ButtonSet.OK);
}
