// ============================================================
// FILE: 01_SETUP.gs
// MÔ TẢ: Khởi tạo toàn bộ cấu trúc Google Spreadsheet
// Chạy 1 lần duy nhất để tạo hệ thống
// ============================================================

/**
 * HÀM CHÍNH: Chạy để tạo toàn bộ hệ thống
 * Menu: QLTC → ⚙️ Quản trị → Khởi tạo hệ thống
 */
function setupSystem() {
  const ss = getSS();
  const ui = SpreadsheetApp.getUi();

  const confirm = ui.alert(
    '⚙️ Khởi tạo Hệ thống',
    'Thao tác này sẽ tạo/reset toàn bộ các sheet cần thiết.\nBạn có chắc muốn tiếp tục?',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  ui.alert('Đang khởi tạo... Vui lòng chờ');

  try {
    _setupConfigSheet(ss);
    _setupSettlementSheet(ss);
    _setupTctJournalSheet(ss);
    _setupTctDetailSheet(ss);
    _setupAdvanceLimitSheet(ss);
    _setupAdvanceRequestSheet(ss);
    _setupTransferLogSheet(ss);
    _setupBodCashflowSheet(ss);
    _setupDashTptcSheet(ss);
    _setupDashBodSheet(ss);
    _setupTeamDashboards(ss);
    _cleanupDefaultSheets(ss);

    ui.alert('✅ Khởi tạo hoàn tất!\n\nHệ thống đã sẵn sàng sử dụng.\nVui lòng cập nhật email trong sheet CONFIG.');
  } catch(e) {
    ui.alert('❌ Lỗi: ' + e.message);
    console.error(e);
  }
}

// ════════════════════════════════════════════════════════════
// 1. SHEET: CONFIG
// ════════════════════════════════════════════════════════════
function _setupConfigSheet(ss) {
  let sh = ss.getSheetByName(SHEET.CONFIG) || ss.insertSheet(SHEET.CONFIG);
  sh.clear();
  sh.setTabColor('#1565C0');

  const data = [
    ['⚙️ CẤU HÌNH HỆ THỐNG QLTC CHI NHÁNH','','','','',''],
    ['Cập nhật lần cuối:', tsNow(), '', 'PHIÊN BẢN:', '1.0', ''],
    ['','','','','',''],

    ['─── THÔNG TIN NHÂN SỰ ───','','','','',''],
    ['VAI TRÒ','HỌ TÊN','EMAIL','TELEGRAM CHAT ID','GHI CHÚ',''],
    ['TPTC','(Nhập tên)','tptc@company.com','','Trưởng phòng Tài chính',''],
    ['BOD','(Nhập tên)','bod@company.com','','Giám đốc chi nhánh',''],
    ['','','','','',''],

    ['─── DANH SÁCH 8 TEAM ───','','','','',''],
    ['TEAM ID','TÊN TEAM','ĐỘI TRƯỞNG','EMAIL ĐỘI TRƯỞNG','TELEGRAM CHAT ID','GHI CHÚ'],
    ['T01','Team 1','(Nhập tên)','team01@company.com','',''],
    ['T02','Team 2','(Nhập tên)','team02@company.com','',''],
    ['T03','Team 3','(Nhập tên)','team03@company.com','',''],
    ['T04','Team 4','(Nhập tên)','team04@company.com','',''],
    ['T05','Team 2 SUB','(Nhập tên)','team05@company.com','',''],
    ['T06','Staff Solution','(Nhập tên)','team06@company.com','',''],
    ['T07','Staff Construction','(Nhập tên)','team07@company.com','',''],
    ['T08','M&E','(Nhập tên)','team08@company.com','',''],
    ['','','','','',''],

    ['─── TELEGRAM BOT ───','','','','',''],
    ['BOT TOKEN','(Nhập token)','','GROUP CHAT ID','(Nhập ID)',''],
    ['','','','','',''],

    ['─── CÀI ĐẶT HỆ THỐNG ───','','','','',''],
    ['Tháng tham chiếu hạn mức mặc định','1','(1, 2 hoặc 3 tháng trước)','','',''],
    ['Ngưỡng cảnh báo chênh lệch (%)','10','% so với proposal','','',''],
    ['','','','','',''],

    ['─── GOOGLE SHEET IDs ───','','','','',''],
    ['File BOD (Giám đốc)','1DPOHu9q79F1QQvB-CjU3IdWNz6W-_OKvE-ge_Ox9Vd0','','','',''],
    ['File Công Nợ TCT','1BVFyn1-lmKvHpecgSr0zK9yF4ffVVUtBOqEAiiH3xK0','','','',''],
  ];

  sh.getRange(1, 1, data.length, 6).setValues(data);

  // Format tiêu đề
  sh.getRange(1,1,1,6).merge().setBackground('#1565C0').setFontColor('#FFFFFF')
    .setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');

  // Format sub-headers
  [4,9,19,22,26].forEach(r => {
    sh.getRange(r,1,1,6).merge().setBackground('#42A5F5').setFontColor('#FFFFFF')
      .setFontWeight('bold');
  });

  // Header rows
  [5,10].forEach(r => {
    sh.getRange(r,1,1,6).setBackground('#E3F2FD').setFontWeight('bold');
  });

  sh.setColumnWidths([1,2,3,4,5,6].map(()=>180));
  sh.setColumnWidth(1,120);
  ss.setActiveSheet(sh);
}

// ════════════════════════════════════════════════════════════
// 2. SHEET: CHỨNG TỪ (TPTC nhập liệu từ chứng từ giấy của Team)
// ════════════════════════════════════════════════════════════
function _setupSettlementSheet(ss) {
  let sh = ss.getSheetByName(SHEET.SETTLEMENT) || ss.insertSheet(SHEET.SETTLEMENT);
  sh.clear();
  sh.setTabColor('#2E7D32');
  sh.setFrozenRows(2);

  const headers1 = [
    'STT','THÔNG TIN CHỨNG TỪ','','','','',
    'ĐỀ XUẤT CHI NHÁNH','TCT XÁC NHẬN','',
    'XỬ LÝ','','','',''
  ];
  const headers2 = [
    '#','Ngày CT','Tháng','Team','Đội trưởng','Loại chi phí','Mô tả',
    'Số tiền đề xuất','Loại phí','TK Kế toán',
    'Số tiền TCT duyệt','Chênh lệch','Lý do cắt',
    'Trạng thái','TPTC xác nhận','Ngày gửi TCT','Ghi chú','Ngày nhập','Người nhập'
  ];

  sh.getRange(1,1,1,headers2.length).setValues([headers1]);
  sh.getRange(2,1,1,headers2.length).setValues([headers2]);

  // Merge header row 1
  sh.getRange(1,1,1,1);
  [[1,1],[2,7],[8,10],[11,19]].forEach(([s,e]) => {
    if(e > s) sh.getRange(1,s,1,(e-s+1)).merge();
  });

  // Format header row 1
  sh.getRange(1,1,1,headers2.length)
    .setBackground(CLR.HEADER).setFontColor(CLR.HEADER_FG)
    .setFontWeight('bold').setHorizontalAlignment('center');

  // Format header row 2
  sh.getRange(2,1,1,headers2.length)
    .setBackground('#1976D2').setFontColor('#FFFFFF')
    .setFontWeight('bold').setHorizontalAlignment('center')
    .setWrap(true);

  // Column widths
  const widths = [40,90,70,120,130,160,200,130,100,80,130,100,180,140,130,110,180,120,130];
  widths.forEach((w,i) => sh.setColumnWidth(i+1, w));

  // Data validation từ row 3
  const range3 = (col, note) => sh.getRange(3, col, 1000, 1);

  // Team dropdown
  sh.getRange(3,4,1000,1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(getTeamNames(), true).build()
  );
  // Loại chi phí dropdown
  sh.getRange(3,6,1000,1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(EXPENSE_CATEGORIES, true).build()
  );
  // Loại phí dropdown
  sh.getRange(3,9,1000,1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(FEE_TYPES, true).build()
  );
  // TK kế toán dropdown
  sh.getRange(3,10,1000,1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(ACCOUNTS, true).build()
  );
  // Trạng thái dropdown
  sh.getRange(3,14,1000,1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(STATUS_SETTLEMENT, true).build()
  );

  // Formula cột Tháng (col 3) = getMonthYear từ ngày CT (col 2)
  // Formula cột Chênh lệch (col 12) = col8 - col11
  // Sẽ dùng Apps Script để fill khi thêm dòng mới
}

// ════════════════════════════════════════════════════════════
// 3. SHEET: TCT_SO_CAI (Import từ TCT BOD - Sổ Nợ/Có)
// ════════════════════════════════════════════════════════════
function _setupTctJournalSheet(ss) {
  let sh = ss.getSheetByName(SHEET.TCT_JOURNAL) || ss.insertSheet(SHEET.TCT_JOURNAL);
  sh.clear();
  sh.setTabColor('#E65100');
  sh.setFrozenRows(2);

  const headers = [
    '#','Ngày ghi sổ','Số hiệu CT','Ngày CT',
    'Diễn giải','Team (tự nhận diện)',
    'TK đối ứng','Số tiền Nợ (Tạm ứng)','Số tiền Có (Clear)',
    'Ghi chú','Trạng thái đối chiếu','Tháng'
  ];

  sh.getRange(1,1,1,headers.length).setValues([headers]);
  sh.getRange(1,1,1,headers.length)
    .setBackground('#E65100').setFontColor('#FFFFFF')
    .setFontWeight('bold').setHorizontalAlignment('center').setWrap(true);
  sh.setFrozenRows(1);

  const widths = [40,100,100,100,280,130,100,150,150,180,150,80];
  widths.forEach((w,i) => sh.setColumnWidth(i+1, w));

  sh.getRange(1,1,1,headers.length).setNote(
    'Sheet này import dữ liệu từ file TCT (sheet BOD).\nDùng menu QLTC → Import TCT → Import Sổ cái TCT'
  );
}

// ════════════════════════════════════════════════════════════
// 4. SHEET: TCT_CHI_TIET (Import từ TCT Detail Team-Dep)
// ════════════════════════════════════════════════════════════
function _setupTctDetailSheet(ss) {
  let sh = ss.getSheetByName(SHEET.TCT_DETAIL) || ss.insertSheet(SHEET.TCT_DETAIL);
  sh.clear();
  sh.setTabColor('#F57F17');
  sh.setFrozenRows(1);

  const headers = [
    '#','Tháng','Team','No (TCT)','Mô tả chi phí',
    'Proposal (Chi nhánh)','Approve (TCT)','Difference','Lý do cắt',
    'Type of Fee','Account','Trạng thái','Ghi chú hệ thống'
  ];

  sh.getRange(1,1,1,headers.length).setValues([headers]);
  sh.getRange(1,1,1,headers.length)
    .setBackground('#F57F17').setFontColor('#FFFFFF')
    .setFontWeight('bold').setHorizontalAlignment('center').setWrap(true);

  const widths = [40,80,130,70,250,150,150,130,250,120,80,140,200];
  widths.forEach((w,i) => sh.setColumnWidth(i+1, w));
}

// ════════════════════════════════════════════════════════════
// 5. SHEET: HAN_MUC (Hạn mức tạm ứng tự động)
// ════════════════════════════════════════════════════════════
function _setupAdvanceLimitSheet(ss) {
  let sh = ss.getSheetByName(SHEET.ADVANCE_LIMIT) || ss.insertSheet(SHEET.ADVANCE_LIMIT);
  sh.clear();
  sh.setTabColor('#6A1B9A');
  sh.setFrozenRows(3);

  // Row 1: Tiêu đề
  sh.getRange(1,1,1,10).merge()
    .setValue('📊 BẢNG HẠN MỨC TẠM ỨNG — TỰ ĐỘNG TÍNH')
    .setBackground('#6A1B9A').setFontColor('#FFFFFF')
    .setFontSize(13).setFontWeight('bold').setHorizontalAlignment('center');

  // Row 2: Cài đặt tháng tham chiếu
  sh.getRange(2,1).setValue('Tháng tham chiếu:');
  sh.getRange(2,2).setValue(1).setBackground('#FFF3E0').setFontWeight('bold');
  sh.getRange(2,3).setValue('(Chọn 1, 2, hoặc 3 — TPTC có thể thay đổi)');
  sh.getRange(2,2).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['1','2','3'], true).build()
  );
  sh.getRange(2,4).setValue('Tháng hiện tại:');
  sh.getRange(2,5).setValue(getMonthYear()).setFontWeight('bold');
  sh.getRange(2,6).setValue('Cập nhật:');
  sh.getRange(2,7).setValue(tsDate());

  // Row 3: Headers
  const headers = [
    'TEAM','TÊN TEAM','ĐỘI TRƯỞNG',
    'Tháng tham chiếu','Tổng clear TCT duyệt (tháng TK)',
    'Đã tạm ứng kỳ này','Đã clear kỳ này','Tồn ứng',
    'CÒN ĐƯỢC ỨNG THÊM','GHI CHÚ'
  ];
  sh.getRange(3,1,1,headers.length).setValues([headers])
    .setBackground('#4A148C').setFontColor('#FFFFFF')
    .setFontWeight('bold').setHorizontalAlignment('center').setWrap(true);

  // Data rows (8 teams)
  ROLES.TEAM_LEADERS.forEach((t, i) => {
    const row = 4 + i;
    sh.getRange(row,1).setValue(t.id);
    sh.getRange(row,2).setValue(t.name);
    sh.getRange(row,3).setValue(t.leader);
    // Các cột số liệu sẽ được VLOOKUP/cập nhật bởi script
  });

  const widths = [60,160,150,130,200,170,170,150,190,200];
  widths.forEach((w,i) => sh.setColumnWidth(i+1, w));

  sh.setRowHeight(3, 50);
}

// ════════════════════════════════════════════════════════════
// 6. SHEET: LENH_TAM_UNG (Lệnh tạm ứng)
// ════════════════════════════════════════════════════════════
function _setupAdvanceRequestSheet(ss) {
  let sh = ss.getSheetByName(SHEET.ADVANCE_REQUEST) || ss.insertSheet(SHEET.ADVANCE_REQUEST);
  sh.clear();
  sh.setTabColor('#00695C');
  sh.setFrozenRows(2);

  const h1 = ['THÔNG TIN LỆNH','','','','','NHU CẦU & HẠN MỨC','','BOD XÁC NHẬN','','','',''];
  const h2 = [
    '#','Ngày lập','Tháng','Team','Đội trưởng','Lý do tạm ứng',
    'Số tiền đề xuất','Hạn mức còn lại','Có vượt hạn?',
    'BOD duyệt','Ngày BOD chuyển','Số tiền thực chuyển',
    'Trạng thái','Ghi chú TPTC','Ghi chú BOD','Người lập'
  ];

  sh.getRange(1,1,1,h2.length).setValues([h1]);
  sh.getRange(2,1,1,h2.length).setValues([h2]);

  sh.getRange(1,1,1,h2.length)
    .setBackground('#00695C').setFontColor('#FFFFFF')
    .setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(2,1,1,h2.length)
    .setBackground('#00897B').setFontColor('#FFFFFF')
    .setFontWeight('bold').setHorizontalAlignment('center').setWrap(true);

  // Merge row 1
  [[1,5],[6,8],[9,16]].forEach(([s,e]) => {
    sh.getRange(1,s,1,(e-s+1)).merge();
  });

  // Dropdown Team
  sh.getRange(3,4,1000,1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(getTeamNames(), true).build()
  );
  // Dropdown Trạng thái
  sh.getRange(3,13,1000,1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(STATUS_ADVANCE, true).build()
  );

  const widths = [40,100,80,130,150,200,150,150,100,100,120,160,150,200,200,130];
  widths.forEach((w,i) => sh.setColumnWidth(i+1, w));
  sh.setRowHeights(1,2,45);
}

// ════════════════════════════════════════════════════════════
// 7. SHEET: CHUYEN_TIEN_BOD (Log chuyển tiền của BOD)
// ════════════════════════════════════════════════════════════
function _setupTransferLogSheet(ss) {
  let sh = ss.getSheetByName(SHEET.TRANSFER_LOG) || ss.insertSheet(SHEET.TRANSFER_LOG);
  sh.clear();
  sh.setTabColor('#1A237E');
  sh.setFrozenRows(1);

  const headers = [
    '#','Ngày chuyển','Tháng','Lệnh ứng #','Team','Đội trưởng',
    'Số tiền lệnh','Số tiền thực chuyển','Phương thức',
    'Ref / Mã GD','Ghi chú BOD','Xác nhận TPTC','Ngày TPTC xác nhận'
  ];

  sh.getRange(1,1,1,headers.length).setValues([headers])
    .setBackground('#1A237E').setFontColor('#FFFFFF')
    .setFontWeight('bold').setHorizontalAlignment('center').setWrap(true);

  sh.getRange(2,9,1000,1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(PAYMENT_TYPES, true).build()
  );

  const widths = [40,100,80,100,130,150,150,170,110,150,200,140,160];
  widths.forEach((w,i) => sh.setColumnWidth(i+1, w));
  sh.setRowHeight(1,50);
}

// ════════════════════════════════════════════════════════════
// 8. SHEET: DONG_TIEN_BOD (Import từ file Giám đốc)
// ════════════════════════════════════════════════════════════
function _setupBodCashflowSheet(ss) {
  let sh = ss.getSheetByName(SHEET.BOD_CASHFLOW) || ss.insertSheet(SHEET.BOD_CASHFLOW);
  sh.clear();
  sh.setTabColor('#37474F');
  sh.setFrozenRows(1);

  const headers = [
    '#','Timestamp','Ngày GD','Team / Phòng ban','Nội dung','Loại GD',
    'Số tiền Chi','Số tiền Nhận','Loại thanh toán','Ghi chú','Tháng'
  ];

  sh.getRange(1,1,1,headers.length).setValues([headers])
    .setBackground('#37474F').setFontColor('#FFFFFF')
    .setFontWeight('bold').setHorizontalAlignment('center').setWrap(true);

  sh.getRange(1,1,1,headers.length).setNote(
    'Dữ liệu import từ file BOD "Sum Kioem Soat Tioen 2026".\nDùng menu QLTC → Import BOD → Đồng bộ dữ liệu BOD'
  );

  const widths = [40,130,100,160,230,120,130,130,130,200,80];
  widths.forEach((w,i) => sh.setColumnWidth(i+1, w));
  sh.setRowHeight(1,45);
}

// ════════════════════════════════════════════════════════════
// 9 & 10. DASHBOARD TPTC & BOD — xem file 09_DASHBOARD.gs
// ════════════════════════════════════════════════════════════
function _setupDashTptcSheet(ss) {
  let sh = ss.getSheetByName(SHEET.DASH_TPTC) || ss.insertSheet(SHEET.DASH_TPTC);
  sh.clear();
  sh.setTabColor('#BF360C');
  _buildDashboardPlaceholder(sh, '📊 DASHBOARD — TRƯỞNG PHÒNG TÀI CHÍNH', '#BF360C');
}

function _setupDashBodSheet(ss) {
  let sh = ss.getSheetByName(SHEET.DASH_BOD) || ss.insertSheet(SHEET.DASH_BOD);
  sh.clear();
  sh.setTabColor('#880E4F');
  _buildDashboardPlaceholder(sh, '📊 DASHBOARD — GIÁM ĐỐC (BOD)', '#880E4F');
}

// ════════════════════════════════════════════════════════════
// 11. 8 TEAM DASHBOARDS
// ════════════════════════════════════════════════════════════
function _setupTeamDashboards(ss) {
  ROLES.TEAM_LEADERS.forEach(team => {
    const sheetName = getTeamDashName(team.id);
    let sh = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    sh.clear();
    sh.setTabColor('#33691E');
    _buildTeamDashboard(sh, team);
  });
}

function _buildTeamDashboard(sh, team) {
  sh.getRange(1,1,1,6).merge()
    .setValue(`🏷️ DASHBOARD — ${team.name} | ${team.leader}`)
    .setBackground('#33691E').setFontColor('#FFFFFF')
    .setFontSize(13).setFontWeight('bold').setHorizontalAlignment('center');

  // Tháng tham chiếu selector
  sh.getRange(2,1).setValue('Xem tháng tham chiếu:');
  sh.getRange(2,2).setValue(1).setBackground('#F1F8E9').setFontWeight('bold');
  sh.getRange(2,2).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['1','2','3'], true).build()
  );
  sh.getRange(2,3).setValue('(1 = tháng trước, 2 = 2 tháng trước, 3 = 3 tháng trước)');

  // Bảng tóm tắt
  const summaryData = [
    ['','','','','',''],
    ['📋 TÓM TẮT KỲ NÀY','','','','',''],
    ['Tháng hiện tại:', getMonthYear(), '','','',''],
    ['Đã tạm ứng:', '0', 'đ','','',''],
    ['Đã clear được duyệt:', '0', 'đ','','',''],
    ['Còn tồn ứng:', '0', 'đ','','',''],
    ['','','','','',''],
    ['📊 HẠN MỨC TẠM ỨNG','','','','',''],
    ['Tháng tham chiếu:', getMonthsAgo(1),'','','',''],
    ['Clear TCT duyệt (tháng TK):', '0','đ','','',''],
    ['CÒN ĐƯỢC ỨNG THÊM:', '0','đ','','',''],
    ['','','','','',''],
    ['📝 LỊCH SỬ TẠM ỨNG & CLEAR','','','','',''],
  ];

  sh.getRange(3,1,summaryData.length,6).setValues(summaryData);

  // Format section headers
  [4,10,15].forEach(r => {
    sh.getRange(r,1,1,6).merge()
      .setBackground('#33691E').setFontColor('#FFFFFF').setFontWeight('bold');
  });

  // History table header
  const histRow = 16;
  sh.getRange(histRow,1,1,6).setValues([['Tháng','Đã ứng','Đã clear','Tồn ứng','Hạn mức','Trạng thái']])
    .setBackground('#558B2F').setFontColor('#FFFFFF').setFontWeight('bold');

  sh.setColumnWidths([1,2,3,4,5,6].map(()=>160));
  sh.setColumnWidth(1, 180);
}

function _buildDashboardPlaceholder(sh, title, color) {
  sh.getRange(1,1,1,8).merge()
    .setValue(title)
    .setBackground(color).setFontColor('#FFFFFF')
    .setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');

  sh.getRange(2,1).setValue('⚡ Dashboard sẽ được cập nhật tự động khi chạy menu QLTC → Cập nhật Dashboard');
  sh.setColumnWidth(1, 300);
}

// ════════════════════════════════════════════════════════════
// HELPER: Xóa Sheet mặc định "Sheet1" nếu còn
// ════════════════════════════════════════════════════════════
function _cleanupDefaultSheets(ss) {
  ['Sheet1','Trang tính1','Sheet'].forEach(name => {
    const sh = ss.getSheetByName(name);
    if (sh && ss.getSheets().length > 1) {
      try { ss.deleteSheet(sh); } catch(e) {}
    }
  });
}
