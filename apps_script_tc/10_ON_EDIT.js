// ============================================================
// FILE: 10_ON_EDIT.gs
// MÔ TẢ: Xử lý sự kiện chỉnh sửa + yêu cầu tạm ứng từ Team
// LƯU Ý: Tạm ứng từ Team hoặc phòng ban đều phải qua TPTC duyệt trước
// ============================================================

// ════════════════════════════════════════════════════════════
// EVENT: onEdit — Xử lý tự động khi người dùng chỉnh sửa
// ════════════════════════════════════════════════════════════
function onEditHandler(e) {
  if (!e || !e.range) return;

  const sh   = e.source.getActiveSheet();
  const name = sh.getName();
  const col  = e.range.getColumn();
  const row  = e.range.getRow();

  try {
    // Chứng từ: khi TPTC nhập số TCT duyệt (cột 11)
    if (name === SHEET.SETTLEMENT && col === 11 && row > 2) {
      _onSettlementTctUpdate(sh, row, e.value);
    }

    // Lệnh tạm ứng: khi BOD thay đổi trạng thái (cột 13)
    if (name === SHEET.ADVANCE_REQUEST && col === 13 && row > 2) {
      _onAdvanceStatusChange(sh, row, e.value);
    }

    // Hạn mức: khi thay đổi ô tháng tham chiếu (B2)
    if (name === SHEET.ADVANCE_LIMIT && col === 2 && row === 2) {
      updateAdvanceLimits();
    }

    // Yêu cầu tạm ứng từ Team: khi Team gửi yêu cầu (TEAM_REQUEST sheet)
    if (name === SHEET.TEAM_REQUEST && col === 8 && row > 2) {
      _onTeamRequestSubmit(sh, row);
    }

  } catch(err) {
    console.error('onEditHandler error:', err.message);
  }
}

/**
 * Khi TPTC điền số TCT duyệt vào cột K của CHUNG_TU
 */
function _onSettlementTctUpdate(sh, row, newValue) {
  const deXuat = Number(sh.getRange(row, 8).getValue()) || 0;
  const tctDuyet = Number(newValue) || 0;

  if (isNaN(tctDuyet) || tctDuyet < 0) return;

  const chenhLech = deXuat - tctDuyet;
  sh.getRange(row, 12).setValue(chenhLech).setNumberFormat('#,##0');

  if (chenhLech === 0 && tctDuyet > 0) {
    sh.getRange(row, 14).setValue('Đã clear');
    sh.getRange(row, 1, 1, 19).setBackground(CLR.CLEARED);
  } else if (tctDuyet > 0) {
    sh.getRange(row, 14).setValue('TCT đã phản hồi');
    sh.getRange(row, 1, 1, 19).setBackground(CLR.DIFF);

    // Cảnh báo nếu chênh lệch > 10%
    const pct = deXuat > 0 ? (chenhLech / deXuat) * 100 : 0;
    if (pct > 10) {
      const team = sh.getRange(row, 4).getValue();
      sendTelegramMsg(TELEGRAM_CHAT_IDS.GROUP,
        `⚠️ <b>CHÊNH LỆCH > 10%</b>\n` +
        `Team: ${team}\n` +
        `Đề xuất: ${fmtVND(deXuat)} đ\n` +
        `TCT duyệt: ${fmtVND(tctDuyet)} đ\n` +
        `Chênh lệch: ${fmtVND(chenhLech)} đ (${pct.toFixed(1)}%)`
      );
    }
  }
  // Cập nhật hạn mức sau khi có clear mới
  SpreadsheetApp.getActive().toast('Đang cập nhật hạn mức...', '⏳', 3);
  updateAdvanceLimits();
}

/**
 * Khi trạng thái lệnh tạm ứng thay đổi
 */
function _onAdvanceStatusChange(sh, row, newStatus) {
  const stt    = sh.getRange(row, 1).getValue();
  const team   = sh.getRange(row, 4).getValue();
  const leader = sh.getRange(row, 5).getValue();
  const soTien = sh.getRange(row, 7).getValue();

  if (newStatus === 'BOD đã chuyển tiền') {
    sh.getRange(row, 1, 1, 16).setBackground(CLR.CLEARED);
    sendTelegramMsg(TELEGRAM_CHAT_IDS.TPTC,
      `✅ <b>BOD ĐÃ CHUYỂN TIỀN</b>\n` +
      `Lệnh: ${stt}\nTeam: ${team} — ${leader}\n` +
      `Số tiền: ${fmtVND(soTien)} đ`
    );
  } else if (newStatus === 'Hủy') {
    sh.getRange(row, 1, 1, 16).setBackground(CLR.SECTION);
  }
}

/**
 * Khi Team submit yêu cầu tạm ứng
 */
function _onTeamRequestSubmit(sh, row) {
  const team   = sh.getRange(row, 3).getValue();
  const soTien = sh.getRange(row, 5).getValue();
  const lyDo   = sh.getRange(row, 6).getValue();

  // Thông báo TPTC
  sendTelegramMsg(TELEGRAM_CHAT_IDS.TPTC,
    `📩 <b>YÊU CẦU TẠM ỨNG MỚI</b>\n` +
    `Team: ${team}\n` +
    `Số tiền yêu cầu: ${fmtVND(soTien)} đ\n` +
    `Lý do: ${lyDo}\n\n` +
    `⏳ Đang chờ TPTC xem xét & duyệt.`
  );

  sh.getRange(row, 8).setValue('Chờ TPTC duyệt');
  sh.getRange(row, 1, 1, 9).setBackground(CLR.PENDING);
}

// ════════════════════════════════════════════════════════════
// LUỒNG YÊU CẦU TẠM ỨNG TỪ TEAM (Đội trưởng gửi → TPTC duyệt)
// LƯU Ý: Chỉ sau khi TPTC duyệt mới lập lệnh chính thức gửi BOD
// ════════════════════════════════════════════════════════════

// Đảm bảo thêm TEAM_REQUEST vào SHEET config
// Thêm vào 00_CONFIG.gs: TEAM_REQUEST: 'YEU_CAU_TAM_UNG'

/**
 * Setup sheet YEU_CAU_TAM_UNG
 * (Đội trưởng submit yêu cầu → TPTC xem xét → tạo lệnh chính thức)
 */
function setupTeamRequestSheet(ss) {
  const sheetName = 'YEU_CAU_TAM_UNG';
  let sh = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  sh.clear();
  sh.setTabColor('#F9A825');
  sh.setFrozenRows(2);

  const h1 = ['TỪ TEAM','','','','','TPTC XÉT DUYỆT','','',''];
  const h2 = [
    '#','Ngày gửi','Team','Đội trưởng',
    'Số tiền yêu cầu','Lý do / Mục đích chi',
    'Trạng thái TPTC','TPTC nhận xét','Ngày TPTC duyệt','Lệnh AU#'
  ];

  sh.getRange(1,1,1,h2.length).setValues([h1]);
  sh.getRange(2,1,1,h2.length).setValues([h2]);

  sh.getRange(1,1,1,h2.length)
    .setBackground('#F9A825').setFontColor('#FFFFFF')
    .setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(2,1,1,h2.length)
    .setBackground('#FBC02D').setFontColor('#212121')
    .setFontWeight('bold').setHorizontalAlignment('center').setWrap(true);

  [[1,5],[6,10]].forEach(([s,e]) => sh.getRange(1,s,1,(e-s+1)).merge());

  // Dropdown Team
  sh.getRange(3,3,1000,1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(getTeamNames(),true).build()
  );

  // Dropdown trạng thái TPTC
  sh.getRange(3,7,1000,1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList([
        'Chờ TPTC duyệt',
        'TPTC đã duyệt — Đã lập lệnh',
        'TPTC từ chối',
        'Yêu cầu bổ sung thông tin'
      ],true).build()
  );

  const widths = [40,100,130,150,150,250,180,200,130,120];
  widths.forEach((w,i) => sh.setColumnWidth(i+1, w));
  sh.setRowHeights(1,2,45);

  sh.getRange(1,1).setNote(
    '📌 QUY TRÌNH:\n' +
    '1. Đội trưởng điền thông tin yêu cầu (cột A-F)\n' +
    '2. TPTC xem xét → Điền cột G, H, I\n' +
    '3. Nếu duyệt → TPTC vào menu QLTC → Lập lệnh tạm ứng chính thức\n' +
    '4. Lệnh AU# được ghi vào cột J\n' +
    '5. BOD nhận lệnh → Chuyển tiền'
  );
}

// ════════════════════════════════════════════════════════════
// TPTC DUYỆT YÊU CẦU TỪ TEAM → TẠO LỆNH CHÍNH THỨC
// ════════════════════════════════════════════════════════════
function approveTeamRequestAndCreateAdvance() {
  if (!isTptc()) {
    SpreadsheetApp.getUi().alert('⛔ Chỉ TPTC mới có quyền duyệt yêu cầu.');
    return;
  }

  const sh = getSS().getSheetByName('YEU_CAU_TAM_UNG');
  if (!sh) {
    SpreadsheetApp.getUi().alert('❌ Sheet YEU_CAU_TAM_UNG chưa được tạo.');
    return;
  }

  const selection = sh.getActiveRange();
  const row = selection.getRow();
  if (row <= 2) return;

  const team    = sh.getRange(row, 3).getValue();
  const soTien  = sh.getRange(row, 5).getValue();
  const lyDo    = sh.getRange(row, 6).getValue();
  const status  = sh.getRange(row, 7).getValue();

  if (status !== 'Chờ TPTC duyệt') {
    SpreadsheetApp.getUi().alert('⚠️ Yêu cầu này không ở trạng thái "Chờ TPTC duyệt".');
    return;
  }

  // Lấy hạn mức để kiểm tra
  const limit = getTeamLimitInfo(team);
  const hanMuc = limit ? limit.canAdvanceMore : 0;

  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    '✅ Duyệt Yêu Cầu Tạm Ứng',
    `Team: ${team}\nSố tiền: ${fmtVND(soTien)} đ\nHạn mức còn: ${fmtVND(hanMuc)} đ\n\n` +
    `${Number(soTien) > hanMuc ? '⚠️ VƯỢT HẠN MỨC!\n' : ''}` +
    `Xác nhận duyệt và tạo lệnh chính thức gửi BOD?`,
    ui.ButtonSet.YES_NO
  );

  if (confirm !== ui.Button.YES) return;

  // Tạo lệnh tạm ứng chính thức
  const result = saveAdvanceRequest({
    team          : team,
    soTienDeXuat  : soTien,
    lyDo          : lyDo,
    ghiChuTptc    : 'Duyệt từ yêu cầu Team (dòng ' + row + ')',
  });

  if (result.success) {
    // Cập nhật status trong sheet YEU_CAU_TAM_UNG
    sh.getRange(row, 7).setValue('TPTC đã duyệt — Đã lập lệnh');
    sh.getRange(row, 9).setValue(tsDate());
    sh.getRange(row, 10).setValue(result.stt);
    sh.getRange(row, 1, 1, 10).setBackground(CLR.APPROVED);

    ui.alert(
      `✅ Đã duyệt và tạo lệnh tạm ứng!\n\n` +
      `Mã lệnh: ${result.stt}\n` +
      `${result.vuotHanMuc ? '⚠️ Lưu ý: Vượt hạn mức — BOD cần xem xét đặc biệt' : ''}\n\n` +
      `BOD đã nhận thông báo qua Telegram.`
    );
  } else {
    ui.alert('❌ Lỗi tạo lệnh: ' + result.error);
  }
}

// ════════════════════════════════════════════════════════════
// DỮ LIỆU MẪU (để test hệ thống)
// ════════════════════════════════════════════════════════════
function insertSampleData() {
  if (!isTptc()) return;

  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    '⚠️ Chèn dữ liệu mẫu',
    'Sẽ thêm dữ liệu mẫu vào các sheet để kiểm tra hệ thống. Tiếp tục?',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  // Mẫu chứng từ
  const settSh = getSheet(SHEET.SETTLEMENT);
  const sampleSett = [
    [1,'15/04/2026','04/2026','Team 1','Đội trưởng T1','Fuel Car','Fuel for site visit Apr W1',5000000,'Fuel Car','1111','4800000',200000,'Cắt theo norm','Đã clear','tptc@company.com','20/04/2026','',tsNow(),'tptc@company.com'],
    [2,'16/04/2026','04/2026','Team 2','Đội trưởng T2','Expenses','Office supplies Apr',2000000,'Admin','1111','','','','Đã gửi TCT','','20/04/2026','',tsNow(),'tptc@company.com'],
    [3,'17/04/2026','04/2026','Team 3','Đội trưởng T3','Support / Living Cost','Living support Apr team',8000000,'Support','1111','','','','TPTC đã xác nhận','tptc@company.com','','',tsNow(),'tptc@company.com'],
    [4,'18/04/2026','04/2026','Team 1','Đội trưởng T1','Guest Reception','Client dinner Apr',3000000,'Relationship','1111','','','','Chờ kiểm tra','','','',tsNow(),'tptc@company.com'],
  ];
  settSh.getRange(3,1,sampleSett.length,19).setValues(sampleSett);

  // Mẫu lệnh tạm ứng
  const advSh = getSheet(SHEET.ADVANCE_REQUEST);
  const sampleAdv = [
    ['AU-202604-001','01/04/2026','04/2026','Team 1','Đội trưởng T1','Chi phí vận hành tháng 4',15000000,18000000,'✅ Trong hạn mức','BOD đã duyệt','05/04/2026',15000000,'BOD đã chuyển tiền','Duyệt đủ','OK','tptc@company.com'],
    ['AU-202604-002','02/04/2026','04/2026','Team 2','Đội trưởng T2','Chi phí site tháng 4',12000000,10000000,'🟡 Gần hạn mức','','','','Chờ BOD duyệt','','','tptc@company.com'],
    ['AU-202605-001','01/05/2026','05/2026','Team 3','Đội trưởng T3','Tạm ứng tháng 5',20000000,15000000,'⚠️ Vượt hạn mức','','','','Chờ BOD duyệt','Vượt hạn mức, cần BOD xem xét','','tptc@company.com'],
  ];
  advSh.getRange(3,1,sampleAdv.length,16).setValues(sampleAdv);

  // Cập nhật hạn mức
  updateAdvanceLimits();

  ui.alert('✅ Đã chèn dữ liệu mẫu!\n\nBây giờ anh có thể:\n• Vào menu QLTC → Cập nhật Dashboard\n• Kiểm tra hạn mức ở sheet HAN_MUC\n• Xem dashboard từng role');
}
