// ============================================================
// FILE: 09_DASHBOARD.gs
// MÔ TẢ: Cập nhật Dashboard cho TPTC, BOD và 8 Team
// ============================================================

// ════════════════════════════════════════════════════════════
// DASHBOARD TPTC
// ════════════════════════════════════════════════════════════
function refreshDashTptc() {
  const sh = getSheet(SHEET.DASH_TPTC);
  sh.clear();
  sh.setTabColor('#BF360C');

  const thang = getMonthYear();

  // ── Tiêu đề ──
  sh.getRange(1,1,1,10).merge()
    .setValue(`📊 DASHBOARD TRƯỞNG PHÒNG TÀI CHÍNH — Tháng ${thang}`)
    .setBackground('#BF360C').setFontColor('#FFFFFF')
    .setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');

  sh.getRange(2,1).setValue(`🕐 Cập nhật: ${tsNow()}`).setFontStyle('italic');

  let currentRow = 4;

  // ── SECTION 1: Tổng quan chứng từ ──
  currentRow = _writeSectionHeader(sh, currentRow, '📄 TỔNG QUAN CHỨNG TỪ THÁNG NÀY', '#E64A19');

  const settSh = getSheet(SHEET.SETTLEMENT);
  const settLastRow = settSh.getLastRow();
  let settData = [];
  if (settLastRow > 2) {
    settData = settSh.getRange(3,1,settLastRow-2,19).getValues()
      .filter(r => r[2] === thang);
  }

  const s_choKT  = settData.filter(r => r[13]==='Chờ kiểm tra').length;
  const s_xacNhan= settData.filter(r => r[13]==='TPTC đã xác nhận').length;
  const s_guiTCT = settData.filter(r => r[13]==='Đã gửi TCT').length;
  const s_tctPH  = settData.filter(r => r[13]==='TCT đã phản hồi').length;
  const s_clear  = settData.filter(r => r[13]==='Đã clear').length;
  const totalProp= settData.reduce((s,r)=>s+(Number(r[7])||0),0);
  const totalAppr= settData.reduce((s,r)=>s+(Number(r[10])||0),0);

  const settSummary = [
    ['Chờ TPTC kiểm tra',   s_choKT,  'chứng từ',  'Đã xác nhận',        s_xacNhan, 'chứng từ'],
    ['Đã gửi TCT',          s_guiTCT, 'chứng từ',  'TCT đã phản hồi',    s_tctPH,   'chứng từ'],
    ['Đã clear hoàn tất',   s_clear,  'chứng từ',  '','',''],
    ['Tổng đề xuất',   fmtVND(totalProp), 'đ', 'TCT duyệt', fmtVND(totalAppr), 'đ'],
    ['Chênh lệch',     fmtVND(totalProp-totalAppr), 'đ', '', '', ''],
  ];

  sh.getRange(currentRow, 1, settSummary.length, 6).setValues(settSummary);
  [0,1,2,3].forEach(i => {
    if (i < settSummary.length) {
      sh.getRange(currentRow+i, 1).setFontWeight('bold');
      sh.getRange(currentRow+i, 4).setFontWeight('bold');
      sh.getRange(currentRow+i, 2).setHorizontalAlignment('right');
      sh.getRange(currentRow+i, 5).setHorizontalAlignment('right');
    }
  });
  if (totalProp - totalAppr > 0) {
    sh.getRange(currentRow+4, 2).setFontColor(CLR.REJECT).setFontWeight('bold');
  }
  currentRow += settSummary.length + 2;

  // ── SECTION 2: Hạn mức từng Team ──
  currentRow = _writeSectionHeader(sh, currentRow, '💸 HẠN MỨC TẠM ỨNG TỪNG TEAM', '#1565C0');

  const limitHeader = ['TEAM','Hạn mức (tháng TK)','Đã ứng','Đã clear','Tồn ứng','Còn ứng thêm','Trạng thái'];
  sh.getRange(currentRow, 1, 1, 7).setValues([limitHeader])
    .setBackground('#1976D2').setFontColor('#FFFFFF').setFontWeight('bold');
  currentRow++;

  ROLES.TEAM_LEADERS.forEach(team => {
    const info = getTeamLimitInfo(team.name);
    const hanMuc    = info ? info.clearAmount    : 0;
    const daUng     = info ? info.totalAdvanced  : 0;
    const daClear   = info ? info.totalCleared   : 0;
    const tonUng    = info ? info.outstanding    : 0;
    const conUng    = info ? info.canAdvanceMore : 0;
    const trangThai = conUng <= 0 ? '🔴 Hết hạn mức'
                    : conUng < hanMuc*0.2 ? '🟡 Gần hết'
                    : '🟢 Còn hạn mức';

    sh.getRange(currentRow, 1, 1, 7).setValues([[
      team.name, fmtVND(hanMuc), fmtVND(daUng),
      fmtVND(daClear), fmtVND(tonUng), fmtVND(conUng), trangThai
    ]]);

    sh.getRange(currentRow, 1, 1, 7)
      .setBackground(currentRow % 2 === 0 ? CLR.ALT_ROW : '#FFFFFF');

    // Màu cột hạn mức còn lại
    const bgCell = conUng <= 0 ? CLR.DIFF
                 : conUng < hanMuc*0.2 ? CLR.PENDING
                 : CLR.CLEARED;
    sh.getRange(currentRow, 6).setBackground(bgCell).setFontWeight('bold');

    currentRow++;
  });
  currentRow += 2;

  // ── SECTION 3: Lệnh tạm ứng chờ xử lý ──
  currentRow = _writeSectionHeader(sh, currentRow, '⏳ LỆNH TẠM ỨNG CHỜ XỬ LÝ', '#4527A0');

  const advSh = getSheet(SHEET.ADVANCE_REQUEST);
  const advLastRow = advSh.getLastRow();
  if (advLastRow > 2) {
    const advData = advSh.getRange(3,1,advLastRow-2,16).getValues()
      .filter(r => r[12] === 'Chờ BOD duyệt');

    if (advData.length > 0) {
      const advHeader = ['Mã lệnh','Team','Số tiền','Hạn mức còn','Cảnh báo','Trạng thái'];
      sh.getRange(currentRow,1,1,6).setValues([advHeader])
        .setBackground('#512DA8').setFontColor('#FFFFFF').setFontWeight('bold');
      currentRow++;

      advData.forEach(r => {
        sh.getRange(currentRow,1,1,6).setValues([[
          r[0], r[3], fmtVND(r[6]), fmtVND(r[7]), r[8], r[12]
        ]]);
        if (String(r[8]).includes('Vượt')) {
          sh.getRange(currentRow,1,1,6).setBackground(CLR.DIFF);
        }
        currentRow++;
      });
    } else {
      sh.getRange(currentRow,1).setValue('✅ Không có lệnh nào đang chờ BOD duyệt');
      currentRow++;
    }
  }
  currentRow += 2;

  // ── SECTION 4: Đối chiếu TCT gần nhất ──
  currentRow = _writeSectionHeader(sh, currentRow, '🔄 ĐỐI CHIẾU TCT — TÓM TẮT', '#00695C');

  const tctSh = getSheet(SHEET.TCT_DETAIL);
  const tctLastRow = tctSh.getLastRow();
  if (tctLastRow > 1) {
    const tctData = tctSh.getRange(2,1,tctLastRow-1,13).getValues();
    const totalTCTProp = tctData.reduce((s,r)=>s+(Number(r[5])||0),0);
    const totalTCTAppr = tctData.reduce((s,r)=>s+(Number(r[6])||0),0);
    const totalDiff    = tctData.reduce((s,r)=>s+(Number(r[7])||0),0);
    const diffItems    = tctData.filter(r=>Number(r[7])>0).length;

    sh.getRange(currentRow,1,4,4).setValues([
      ['Tổng đề xuất chi nhánh:', fmtVND(totalTCTProp), 'đ',''],
      ['TCT duyệt:',              fmtVND(totalTCTAppr), 'đ',''],
      ['Chênh lệch bị cắt:',      fmtVND(totalDiff),    'đ', `(${diffItems} khoản)`],
      ['Tỉ lệ cắt giảm:',
        totalTCTProp>0 ? ((totalDiff/totalTCTProp)*100).toFixed(1)+'%' : '0%','',''],
    ]);
    if (totalDiff > 0) {
      sh.getRange(currentRow+2,2).setFontColor(CLR.REJECT).setFontWeight('bold');
    }
    currentRow += 6;
  }

  // Format chung
  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(2, 160);
  sh.setColumnWidth(3, 160);
  sh.setColumnWidth(4, 160);
  sh.setColumnWidth(5, 160);
  sh.setColumnWidth(6, 160);
  sh.setColumnWidth(7, 160);
}

// ════════════════════════════════════════════════════════════
// DASHBOARD BOD
// ════════════════════════════════════════════════════════════
function refreshDashBod() {
  const sh = getSheet(SHEET.DASH_BOD);
  sh.clear();
  sh.setTabColor('#880E4F');

  const thang = getMonthYear();

  sh.getRange(1,1,1,8).merge()
    .setValue(`📊 DASHBOARD GIÁM ĐỐC (BOD) — Tháng ${thang}`)
    .setBackground('#880E4F').setFontColor('#FFFFFF')
    .setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(2,1).setValue(`🕐 Cập nhật: ${tsNow()}`).setFontStyle('italic');

  let currentRow = 4;

  // ── Dòng tiền tổng hợp từ file BOD ──
  currentRow = _writeSectionHeader(sh, currentRow, '💰 DÒNG TIỀN THÁNG NÀY', '#6A1B9A');

  const cashSummary = getBodMonthlySummary(thang);
  if (cashSummary.length > 0) {
    sh.getRange(currentRow,1,1,5).setValues([['Team','Thu','Chi','Cân đối','']])
      .setBackground('#7B1FA2').setFontColor('#FFFFFF').setFontWeight('bold');
    currentRow++;

    let totThu=0, totChi=0;
    cashSummary.forEach(s => {
      sh.getRange(currentRow,1,1,4).setValues([[
        s.team, fmtVND(s.thu), fmtVND(s.chi), fmtVND(s.net)
      ]]);
      sh.getRange(currentRow,4).setFontColor(s.net>=0 ? CLR.OK : CLR.REJECT)
        .setFontWeight('bold');
      totThu+=s.thu; totChi+=s.chi;
      currentRow++;
    });

    sh.getRange(currentRow,1,1,4).setValues([['TỔNG',fmtVND(totThu),fmtVND(totChi),fmtVND(totThu-totChi)]])
      .setFontWeight('bold').setBackground('#E1BEE7');
    sh.getRange(currentRow,4).setFontColor(totThu-totChi>=0 ? CLR.OK : CLR.REJECT);
    currentRow += 3;
  } else {
    sh.getRange(currentRow,1).setValue('Chưa có dữ liệu — Đồng bộ file BOD trước');
    currentRow += 2;
  }

  // ── Lệnh tạm ứng cần BOD xử lý ──
  currentRow = _writeSectionHeader(sh, currentRow, '💳 LỆNH TẠM ỨNG CẦN XỬ LÝ', '#1565C0');

  const pending = getPendingAdvances();
  if (pending.length > 0) {
    sh.getRange(currentRow,1,1,6).setValues([['Mã lệnh','Team','Đội trưởng','Số tiền đề xuất','Hạn mức còn','Cảnh báo']])
      .setBackground('#1976D2').setFontColor('#FFFFFF').setFontWeight('bold');
    currentRow++;
    pending.forEach(p => {
      sh.getRange(currentRow,1,1,6).setValues([[
        p.stt, p.team, p.doiTruong, fmtVND(p.soTien), fmtVND(p.hanMuc), p.vuotHanMuc
      ]]);
      if (String(p.vuotHanMuc).includes('Vượt')) {
        sh.getRange(currentRow,1,1,6).setBackground(CLR.DIFF);
      }
      currentRow++;
    });
  } else {
    sh.getRange(currentRow,1).setValue('✅ Không có lệnh nào cần xử lý');
    currentRow++;
  }
  currentRow += 2;

  // ── Lịch sử chuyển tiền tháng này ──
  currentRow = _writeSectionHeader(sh, currentRow, '📋 LỊCH SỬ CHUYỂN TIỀN THÁNG NÀY', '#2E7D32');

  const transSh = getSheet(SHEET.TRANSFER_LOG);
  const transLastRow = transSh.getLastRow();
  if (transLastRow > 1) {
    const transData = transSh.getRange(2,1,transLastRow-1,13).getValues()
      .filter(r => r[2] === thang);

    if (transData.length > 0) {
      sh.getRange(currentRow,1,1,6).setValues([['Ngày','Team','Mã lệnh','Số tiền','Phương thức','Ref']])
        .setBackground('#388E3C').setFontColor('#FFFFFF').setFontWeight('bold');
      currentRow++;
      const totalTransferred = transData.reduce((s,r)=>s+(Number(r[7])||0),0);
      transData.forEach(r => {
        sh.getRange(currentRow,1,1,6).setValues([[
          r[1], r[4], r[3], fmtVND(r[7]), r[8], r[9]
        ]]);
        currentRow++;
      });
      sh.getRange(currentRow,1,1,4).setValues([['TỔNG ĐÃ CHUYỂN','','',fmtVND(totalTransferred)]])
        .setFontWeight('bold').setBackground(CLR.CLEARED);
      currentRow += 2;
    }
  }

  sh.setColumnWidth(1, 200); sh.setColumnWidth(2, 160);
  sh.setColumnWidth(3, 160); sh.setColumnWidth(4, 160);
  sh.setColumnWidth(5, 160); sh.setColumnWidth(6, 160);
}

// ════════════════════════════════════════════════════════════
// DASHBOARD TEAM (8 sheet riêng)
// ════════════════════════════════════════════════════════════
function refreshTeamDashboard() {
  const team = getTeamByEmail();
  if (!team) {
    SpreadsheetApp.getUi().alert('⚠️ Email của bạn chưa được cấu hình trong hệ thống.');
    return;
  }
  _updateOneTeamDash(team);
  SpreadsheetApp.getUi().alert(`✅ Đã cập nhật Dashboard cho ${team.name}`);
}

function refreshAllTeamDashboards() {
  ROLES.TEAM_LEADERS.forEach(team => _updateOneTeamDash(team));
}

function _updateOneTeamDash(team) {
  const sheetName = getTeamDashName(team.id);
  let sh = getSheet(sheetName);
  if (!sh) sh = getSS().insertSheet(sheetName);
  sh.clear();
  sh.setTabColor('#33691E');

  const thang = getMonthYear();

  // ── Tiêu đề ──
  sh.getRange(1,1,1,6).merge()
    .setValue(`🏷️ ${team.name} — ${team.leader} | Tháng ${thang}`)
    .setBackground('#33691E').setFontColor('#FFFFFF')
    .setFontSize(13).setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(2,1).setValue(`🕐 Cập nhật: ${tsNow()}`).setFontStyle('italic');

  // ── Bộ chọn tháng tham chiếu ──
  sh.getRange(3,1).setValue('Tháng tham chiếu hạn mức:');
  sh.getRange(3,2).setValue(1).setBackground('#F1F8E9').setFontWeight('bold');
  sh.getRange(3,2).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['1','2','3'],true).build()
  );
  sh.getRange(3,3).setValue('← Chọn 1, 2 hoặc 3 tháng trước').setFontStyle('italic');

  let currentRow = 5;

  // ── Hạn mức & tồn ứng ──
  const info = getTeamLimitInfo(team.name);
  const hanMuc   = info ? info.clearAmount    : 0;
  const daUng    = info ? info.totalAdvanced  : 0;
  const daClear  = info ? info.totalCleared   : 0;
  const tonUng   = info ? info.outstanding    : 0;
  const conUng   = info ? info.canAdvanceMore : 0;
  const refMonth = info ? info.refMonth       : 'Chưa có';

  // Box tóm tắt
  const summaryRows = [
    ['📋 THÔNG TIN TẠM ỨNG THÁNG NÀY', '', '', '', '', ''],
    ['Tháng tham chiếu hạn mức:', refMonth, '', '', '', ''],
    ['Hạn mức tối đa:', fmtVND(hanMuc)+' đ', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['Đã tạm ứng kỳ này:', fmtVND(daUng)+' đ', '', '', '', ''],
    ['Đã clear được duyệt (TCT):', fmtVND(daClear)+' đ', '', '', '', ''],
    ['Còn tồn ứng chưa clear:', fmtVND(tonUng)+' đ', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['⭐ CÒN ĐƯỢC TẠM ỨNG THÊM:', fmtVND(conUng)+' đ', '', '', '', ''],
  ];

  sh.getRange(currentRow, 1, summaryRows.length, 6).setValues(summaryRows);

  // Format section header
  sh.getRange(currentRow,1,1,6).merge()
    .setBackground('#33691E').setFontColor('#FFFFFF').setFontWeight('bold');

  // Format các dòng số
  [currentRow+1, currentRow+2].forEach(r =>
    sh.getRange(r,1).setFontWeight('bold')
  );
  [currentRow+4, currentRow+5, currentRow+6].forEach(r =>
    sh.getRange(r,1).setFontWeight('bold')
  );

  // Box hạn mức còn lại — nổi bật
  const limitRow = currentRow + 8;
  sh.getRange(limitRow,1,1,6).merge()
    .setBackground(
      conUng <= 0 ? CLR.DIFF :
      conUng < hanMuc*0.2 ? CLR.PENDING : CLR.CLEARED
    )
    .setFontColor(conUng <= 0 ? CLR.REJECT : CLR.OK)
    .setFontSize(12).setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setValue(
      conUng <= 0 ? '🔴 ĐÃ HẾT HẠN MỨC TẠM ỨNG' :
      `🟢 CÒN ĐƯỢC ỨNG: ${fmtVND(conUng)} đ`
    );

  currentRow = limitRow + 2;

  // ══════════════════════════════════════════════
  // BẢNG LỊCH SỬ TỪNG THÁNG (6 tháng gần nhất)
  // Đội trưởng thấy rõ tháng nào còn tồn ứng
  // ══════════════════════════════════════════════
  currentRow = _writeSectionHeader(sh, currentRow,
    '📅 LỊCH SỬ TẠM ỨNG & CLEAR THEO THÁNG (6 tháng gần nhất)', '#4A148C');

  // Header bảng lịch sử
  const histHeaders = [
    'THÁNG', 'Đã tạm ứng', 'Đề xuất clear\n(chi nhánh)',
    'TCT duyệt', 'Chênh lệch\nbị cắt', 'Tồn ứng\nchưa clear', 'Trạng thái'
  ];
  sh.getRange(currentRow, 1, 1, 7).setValues([histHeaders])
    .setBackground('#6A1B9A').setFontColor('#FFFFFF')
    .setFontWeight('bold').setHorizontalAlignment('center').setWrap(true);
  sh.setRowHeight(currentRow, 48);
  currentRow++;

  const history = _getTeamMonthlyHistory(team.name, 6);
  let hasOutstanding = false;

  history.forEach(h => {
    const tonUngThang = h.advanced - h.approved;
    const isCurrentMonth = h.month === thang;
    const hasIssue = tonUngThang > 0 && !isCurrentMonth; // Tồn từ tháng trước

    const trangThai =
      h.advanced === 0 ? '—'
      : h.approved >= h.advanced ? '✅ Đã clear hết'
      : h.cleared === 0 && !isCurrentMonth ? '🔴 Chưa clear'
      : isCurrentMonth ? '🔄 Đang xử lý'
      : '🟡 Còn tồn ứng';

    sh.getRange(currentRow, 1, 1, 7).setValues([[
      h.month,
      h.advanced > 0 ? fmtVND(h.advanced) + ' đ' : '—',
      h.proposal > 0 ? fmtVND(h.proposal) + ' đ' : '—',
      h.approved > 0 ? fmtVND(h.approved) + ' đ' : '—',
      h.diff > 0     ? fmtVND(h.diff)     + ' đ' : '—',
      tonUngThang > 0 ? fmtVND(tonUngThang) + ' đ' : '✅ 0',
      trangThai,
    ]]);

    // Format số: căn phải cột 2-6
    [2,3,4,5,6].forEach(c =>
      sh.getRange(currentRow, c).setHorizontalAlignment('right')
    );
    sh.getRange(currentRow, 1).setFontWeight(isCurrentMonth ? 'bold' : 'normal');

    // Màu nền theo trạng thái
    let rowBg = '#FFFFFF';
    if (isCurrentMonth)        rowBg = '#E8F5E9';  // Xanh nhạt = tháng hiện tại
    else if (tonUngThang > 0)  rowBg = '#FFEBEE';  // Đỏ nhạt = còn tồn ứng cũ
    else if (h.advanced === 0) rowBg = '#F5F5F5';  // Xám = không có giao dịch
    sh.getRange(currentRow, 1, 1, 7).setBackground(rowBg);

    // Tô đỏ cột tồn ứng nếu > 0 và không phải tháng hiện tại
    if (tonUngThang > 0 && !isCurrentMonth) {
      sh.getRange(currentRow, 6)
        .setBackground(CLR.DIFF).setFontColor(CLR.REJECT).setFontWeight('bold');
      hasOutstanding = true;
    } else if (tonUngThang <= 0 && h.advanced > 0) {
      sh.getRange(currentRow, 6)
        .setBackground(CLR.CLEARED).setFontColor(CLR.OK).setFontWeight('bold');
    }

    // Tô đỏ cột chênh lệch nếu > 0
    if (h.diff > 0) {
      sh.getRange(currentRow, 5).setFontColor(CLR.REJECT);
    }

    currentRow++;
  });

  // Dòng TỔNG ở cuối bảng lịch sử
  const totAdv  = history.reduce((s,h) => s + h.advanced,  0);
  const totProp = history.reduce((s,h) => s + h.proposal,  0);
  const totAppr = history.reduce((s,h) => s + h.approved,  0);
  const totDiff = history.reduce((s,h) => s + h.diff,      0);
  const totTon  = totAdv - totAppr;

  sh.getRange(currentRow, 1, 1, 7).setValues([[
    'TỔNG 6 THÁNG',
    fmtVND(totAdv)  + ' đ',
    fmtVND(totProp) + ' đ',
    fmtVND(totAppr) + ' đ',
    totDiff > 0 ? fmtVND(totDiff) + ' đ' : '—',
    totTon  > 0 ? fmtVND(totTon)  + ' đ' : '✅ 0',
    totTon  > 0 ? '⚠️ Còn tồn ứng' : '✅ Clear hết',
  ]]).setFontWeight('bold').setBackground('#EDE7F6');
  sh.getRange(currentRow, 2, 1, 5).setHorizontalAlignment('right');
  if (totTon > 0) {
    sh.getRange(currentRow, 6).setBackground(CLR.DIFF).setFontColor(CLR.REJECT);
  }
  currentRow += 2;

  // Cảnh báo nổi bật nếu có tháng cũ chưa clear
  if (hasOutstanding) {
    sh.getRange(currentRow, 1, 1, 7).merge()
      .setValue('⚠️ CÓ THÁNG CŨ CÒN TỒN ỨNG CHƯA CLEAR — Vui lòng nộp chứng từ sớm!')
      .setBackground('#D32F2F').setFontColor('#FFFFFF')
      .setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');
    currentRow += 2;
  }

  // ══════════════════════════════════════════════
  // CHỨNG TỪ THÁNG HIỆN TẠI (chi tiết)
  // ══════════════════════════════════════════════
  const settRows = getSettlementByTeamMonth(team.name, thang);
  currentRow = _writeSectionHeader(sh, currentRow,
    `📝 CHỨNG TỪ CHI TIẾT THÁNG ${thang}`, '#1565C0');

  if (settRows.length > 0) {
    sh.getRange(currentRow,1,1,7).setValues([[
      'Ngày CT','Loại chi phí','Mô tả','Đề xuất','TCT duyệt','Chênh lệch','Trạng thái'
    ]]).setBackground('#1976D2').setFontColor('#FFFFFF').setFontWeight('bold');
    currentRow++;

    settRows.forEach(r => {
      const deXuat  = Number(r[7])  || 0;
      const tctDuyet= Number(r[10]) || 0;
      const diff    = tctDuyet > 0 ? deXuat - tctDuyet : 0;

      sh.getRange(currentRow,1,1,7).setValues([[
        r[1],
        r[5],
        String(r[6]).substring(0, 45),
        fmtVND(deXuat)   + ' đ',
        tctDuyet > 0 ? fmtVND(tctDuyet) + ' đ' : '— chờ TCT',
        diff > 0     ? fmtVND(diff)     + ' đ' : '—',
        r[13],
      ]]);
      [4,5,6].forEach(c => sh.getRange(currentRow,c).setHorizontalAlignment('right'));

      const bg = r[13]==='Đã clear'          ? CLR.CLEARED
               : r[13]==='Từ chối'           ? CLR.DIFF
               : r[13]==='TCT đã phản hồi'   ? CLR.PENDING
               : CLR.ALT_ROW;
      sh.getRange(currentRow,1,1,7).setBackground(bg);
      if (diff > 0) sh.getRange(currentRow,6).setFontColor(CLR.REJECT);
      currentRow++;
    });

    // Dòng tổng chứng từ tháng này
    const sumProp = settRows.reduce((s,r) => s+(Number(r[7])||0),0);
    const sumAppr = settRows.reduce((s,r) => s+(Number(r[10])||0),0);
    sh.getRange(currentRow,1,1,7).setValues([[
      `Tổng (${settRows.length} CT)`, '', '',
      fmtVND(sumProp)+' đ',
      sumAppr > 0 ? fmtVND(sumAppr)+' đ' : '—',
      sumAppr > 0 ? fmtVND(sumProp-sumAppr)+' đ' : '—',
      `Clear: ${settRows.filter(r=>r[13]==='Đã clear').length}/${settRows.length}`,
    ]]).setFontWeight('bold').setBackground('#E3F2FD');
    currentRow++;

  } else {
    sh.getRange(currentRow,1).setValue('Chưa có chứng từ nào tháng này.');
    currentRow++;
  }

  // Column widths
  const colWidths = [80, 160, 210, 130, 130, 120, 155];
  colWidths.forEach((w, i) => sh.setColumnWidth(i+1, w));
  sh.setRowHeight(1, 40);
}

// ════════════════════════════════════════════════════════════
// HELPER: Lịch sử Ứng & Clear từng tháng cho 1 Team
// Trả về mảng N tháng gần nhất (mới nhất trước)
// ════════════════════════════════════════════════════════════
function _getTeamMonthlyHistory(teamName, numMonths) {
  const result = [];

  for (let n = numMonths - 1; n >= 0; n--) {
    const thang = getMonthsAgo(n); // n=0 = tháng hiện tại

    // 1. Tổng đã tạm ứng (từ LENH_TAM_UNG)
    const advanced = _getTotalAdvancedThisMonth(teamName, thang);

    // 2. Tổng đề xuất clear từ chi nhánh (proposal, từ CHUNG_TU)
    const proposal = _getTeamProposalByMonth(teamName, thang);

    // 3. Tổng TCT duyệt (approved, từ CHUNG_TU status=Đã clear)
    const approved = _getApprovedClearByTeamMonth(teamName, thang);

    // 4. Số chứng từ đã clear
    const cleared = _getTeamClearedCount(teamName, thang);

    // 5. Chênh lệch bị cắt
    const diff = Math.max(0, proposal - approved);

    result.push({ month: thang, advanced, proposal, approved, diff, cleared });
  }

  return result;
}

/**
 * Tổng số tiền đề xuất (tất cả chứng từ kể cả chưa clear)
 */
function _getTeamProposalByMonth(teamName, thang) {
  const sh = getSheet(SHEET.SETTLEMENT);
  const lastRow = sh.getLastRow();
  if (lastRow <= 2) return 0;
  const data = sh.getRange(3, 1, lastRow - 2, 9).getValues();
  return data
    .filter(r => r[3] === teamName && r[2] === thang)
    .reduce((s, r) => s + (Number(r[7]) || 0), 0);
}

/**
 * Đếm số chứng từ đã clear trong tháng
 */
function _getTeamClearedCount(teamName, thang) {
  const sh = getSheet(SHEET.SETTLEMENT);
  const lastRow = sh.getLastRow();
  if (lastRow <= 2) return 0;
  const data = sh.getRange(3, 1, lastRow - 2, 15).getValues();
  return data.filter(r =>
    r[3] === teamName && r[2] === thang && r[13] === 'Đã clear'
  ).length;
}

// ════════════════════════════════════════════════════════════
// HELPER: Viết section header
// ════════════════════════════════════════════════════════════
function _writeSectionHeader(sh, row, title, color) {
  const maxCol = 8;
  sh.getRange(row,1,1,maxCol).merge()
    .setValue(title)
    .setBackground(color).setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontSize(11);
  return row + 1;
}
