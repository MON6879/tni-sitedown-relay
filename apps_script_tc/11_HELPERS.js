// ============================================================
// FILE: 11_HELPERS.gs
// MÔ TẢ: Hàm hỗ trợ cho HTML Forms (gọi từ client-side JS)
// ============================================================

/**
 * Trả về dữ liệu dropdown cho form_settlement & form_advance
 */
function getFormDropdownData() {
  return {
    teams      : getTeamNames(),
    categories : EXPENSE_CATEGORIES,
    feeTypes   : FEE_TYPES,
    accounts   : ACCOUNTS,
    payTypes   : PAYMENT_TYPES,
  };
}

/**
 * Cập nhật thông tin đội trưởng khi chọn team (cho form)
 */
function getLeaderByTeam(teamName) {
  const team = ROLES.TEAM_LEADERS.find(t => t.name === teamName);
  return team ? team.leader : '';
}

// ════════════════════════════════════════════════════════════
// TRIGGER: onEdit toàn hệ thống
// ════════════════════════════════════════════════════════════
function onEdit(e) {
  onEditHandler(e);
}

// ════════════════════════════════════════════════════════════
// CẬP NHẬT SHEET CONFIG (đọc lại từ CONFIG sheet)
// Cho phép TPTC sửa email/tên team trực tiếp trên sheet
// ════════════════════════════════════════════════════════════
function reloadConfigFromSheet() {
  const sh = getSheet(SHEET.CONFIG);
  if (!sh) return;

  const data = sh.getDataRange().getValues();

  // Đọc email TPTC (row 6, col 3 = index [5][2])
  // Đọc email BOD  (row 7, col 3 = index [6][2])
  // Đọc 8 teams từ row 11-18

  // NOTE: Vì GAS không cho phép reassign const,
  // cần thay email trong 00_CONFIG.gs thủ công sau khi nhập vào CONFIG sheet
  // Hàm này chỉ hiển thị giá trị hiện tại để kiểm tra

  let msg = '📋 CẤU HÌNH HIỆN TẠI:\n\n';
  msg += `TPTC email: ${ROLES.TPTC}\n`;
  msg += `BOD email:  ${ROLES.BOD}\n\n`;
  msg += 'TEAMS:\n';
  ROLES.TEAM_LEADERS.forEach(t => {
    msg += `${t.id} | ${t.name} | ${t.leader} | ${t.email}\n`;
  });

  SpreadsheetApp.getUi().alert(msg);
}

// ════════════════════════════════════════════════════════════
// REPORT: Xuất báo cáo tháng ra sheet mới
// ════════════════════════════════════════════════════════════
function exportMonthlyReport() {
  const ui = SpreadsheetApp.getUi();
  const thang = getMonthYear();

  const res = ui.prompt(
    '📊 Xuất báo cáo tháng',
    `Xuất báo cáo tháng (mặc định: ${thang}):`,
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() !== ui.Button.OK) return;

  const targetMonth = res.getResponseText().trim() || thang;
  const reportName  = `BC_${targetMonth.replace('/','_')}`;

  // Tạo sheet báo cáo
  let rsh = getSS().getSheetByName(reportName);
  if (rsh) getSS().deleteSheet(rsh);
  rsh = getSS().insertSheet(reportName);
  rsh.setTabColor('#37474F');

  // Header
  rsh.getRange(1,1,1,8).merge()
    .setValue(`📊 BÁO CÁO THÁNG ${targetMonth}`)
    .setBackground('#37474F').setFontColor('#FFFFFF')
    .setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
  rsh.getRange(2,1).setValue(`Xuất lúc: ${tsNow()} | Người xuất: ${Session.getActiveUser().getEmail()}`);

  let row = 4;

  // Bảng hạn mức & tạm ứng
  rsh.getRange(row,1,1,8).merge()
    .setValue('TẠM ỨNG & HẠN MỨC').setBackground('#1565C0')
    .setFontColor('#FFFFFF').setFontWeight('bold');
  row++;

  rsh.getRange(row,1,1,8).setValues([[
    'Team','Hạn mức','Đã ứng','Đã clear','Tồn ứng','Còn ứng','Tháng TK',''
  ]]).setBackground('#1976D2').setFontColor('#FFFFFF').setFontWeight('bold');
  row++;

  let totAdv=0, totClr=0;
  ROLES.TEAM_LEADERS.forEach(team => {
    const info = getTeamLimitInfo(team.name);
    rsh.getRange(row,1,1,7).setValues([[
      team.name,
      info ? info.clearAmount : 0,
      info ? info.totalAdvanced : 0,
      info ? info.totalCleared : 0,
      info ? info.outstanding : 0,
      info ? info.canAdvanceMore : 0,
      info ? info.refMonth : '—',
    ]]);
    [2,3,4,5,6].forEach(c =>
      rsh.getRange(row,c).setNumberFormat('#,##0')
    );
    totAdv += info ? (info.totalAdvanced||0) : 0;
    totClr += info ? (info.totalCleared||0) : 0;
    row++;
  });

  rsh.getRange(row,1,1,7).setValues([['TỔNG',0,totAdv,totClr,totAdv-totClr,0,'']])
    .setFontWeight('bold').setBackground('#E3F2FD');
  rsh.getRange(row,3).setValue(totAdv).setNumberFormat('#,##0');
  rsh.getRange(row,4).setValue(totClr).setNumberFormat('#,##0');
  rsh.getRange(row,5).setValue(totAdv-totClr).setNumberFormat('#,##0');
  row += 3;

  // Đối chiếu TCT
  rsh.getRange(row,1,1,8).merge()
    .setValue('ĐỐI CHIẾU TCT').setBackground('#E65100')
    .setFontColor('#FFFFFF').setFontWeight('bold');
  row++;

  const tctSh = getSheet(SHEET.TCT_DETAIL);
  const tctLast = tctSh.getLastRow();
  if (tctLast > 1) {
    const tctData = tctSh.getRange(2,1,tctLast-1,13).getValues()
      .filter(r => r[1] === targetMonth);

    rsh.getRange(row,1,1,7).setValues([[
      'Team','Mô tả','Proposal','Approve','Difference','Lý do cắt','Type'
    ]]).setBackground('#F57F17').setFontColor('#FFFFFF').setFontWeight('bold');
    row++;

    tctData.forEach(r => {
      rsh.getRange(row,1,1,7).setValues([[
        r[2],r[4],r[5],r[6],r[7],r[8],r[9]
      ]]);
      [3,4,5].forEach(c => rsh.getRange(row,c).setNumberFormat('#,##0'));
      if (Number(r[7]) > 0) rsh.getRange(row,5).setBackground('#FFEBEE');
      row++;
    });
  }

  rsh.setColumnWidth(1,180); rsh.setColumnWidth(2,140);
  rsh.setColumnWidth(3,130); rsh.setColumnWidth(4,130);
  rsh.setColumnWidth(5,130); rsh.setColumnWidth(6,200);
  rsh.setColumnWidth(7,120);

  ui.alert(`✅ Đã xuất báo cáo tháng ${targetMonth}!\nSheet: ${reportName}`);
  getSS().setActiveSheet(rsh);
}
