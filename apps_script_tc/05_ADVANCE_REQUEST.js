// ============================================================
// FILE: 05_ADVANCE_REQUEST.gs
// MÔ TẢ: Lập & quản lý lệnh tạm ứng (TPTC → BOD)
// ============================================================

// ════════════════════════════════════════════════════════════
// TẠO LỆNH TẠM ỨNG MỚI (TPTC)
// ════════════════════════════════════════════════════════════
function createAdvanceRequest() {
  if (!isTptc()) {
    SpreadsheetApp.getUi().alert('⛔ Chỉ TPTC mới có quyền lập lệnh tạm ứng.');
    return;
  }

  const html = HtmlService.createHtmlOutputFromFile('form_advance')
    .setWidth(680).setHeight(600)
    .setTitle('Lập Lệnh Tạm ứng');
  SpreadsheetApp.getUi().showModalDialog(html, '💸 Lập Lệnh Tạm ứng Mới');
}

/**
 * Lấy thông tin hạn mức cho 1 team (gọi từ HTML form)
 */
function getAdvanceLimitForTeam(teamName) {
  // Cập nhật hạn mức trước khi trả về
  const info = getTeamLimitInfo(teamName);
  if (!info) {
    // Tính realtime nếu chưa có trong sheet
    const refMonths = Number(getSheet(SHEET.ADVANCE_LIMIT).getRange(2,2).getValue()) || 1;
    return _calcTeamLimit(teamName, refMonths);
  }
  return info;
}

/**
 * Lưu lệnh tạm ứng (gọi từ HTML form)
 */
function saveAdvanceRequest(data) {
  try {
    const sh = getSheet(SHEET.ADVANCE_REQUEST);
    const lastRow = Math.max(sh.getLastRow(), 2);
    const newRow = lastRow + 1;
    const stt = `AU-${Utilities.formatDate(new Date(), SETTINGS.TZ, 'yyyyMM')}-${String(lastRow-1).padStart(3,'0')}`;

    const team = ROLES.TEAM_LEADERS.find(t => t.name === data.team);
    const doiTruong = team ? team.leader : '';

    // Kiểm tra hạn mức
    const limit = getTeamLimitInfo(data.team);
    const hanMucConLai = limit ? limit.canAdvanceMore : 0;
    const vuotHanMuc = Number(data.soTienDeXuat) > hanMucConLai;

    const rowData = [
      stt,                                    // A: #
      tsDate(),                               // B: Ngày lập
      getMonthYear(),                         // C: Tháng
      data.team,                              // D: Team
      doiTruong,                              // E: Đội trưởng
      data.lyDo || '',                        // F: Lý do
      Number(data.soTienDeXuat),             // G: Số tiền đề xuất
      hanMucConLai,                           // H: Hạn mức còn lại
      vuotHanMuc ? '⚠️ Vượt hạn mức' : '✅ Trong hạn mức', // I: Cảnh báo
      '',                                     // J: BOD duyệt
      '',                                     // K: Ngày BOD chuyển
      '',                                     // L: Số tiền thực chuyển
      'Chờ BOD duyệt',                       // M: Trạng thái
      data.ghiChuTptc || '',                  // N: Ghi chú TPTC
      '',                                     // O: Ghi chú BOD
      Session.getActiveUser().getEmail(),     // P: Người lập
    ];

    sh.getRange(newRow, 1, 1, rowData.length).setValues([rowData]);

    // Format số
    [7,8,12].forEach(c => sh.getRange(newRow, c).setNumberFormat('#,##0'));

    // Màu theo hạn mức
    sh.getRange(newRow, 1, 1, rowData.length)
      .setBackground(vuotHanMuc ? CLR.DIFF : CLR.APPROVED);

    // Thông báo BOD qua Telegram
    const msg =
      `💸 LỆNH TẠM ỨNG MỚI\n` +
      `Mã lệnh: ${stt}\n` +
      `Team: ${data.team} — ${doiTruong}\n` +
      `Số tiền: ${fmtVND(data.soTienDeXuat)} đ\n` +
      `Hạn mức còn lại: ${fmtVND(hanMucConLai)} đ\n` +
      `${vuotHanMuc ? '⚠️ VƯỢT HẠN MỨC — Cần BOD xem xét đặc biệt' : '✅ Trong hạn mức'}\n` +
      `Lý do: ${data.lyDo}\n` +
      `Ngày: ${tsDate()}`;

    sendTelegramMsg(TELEGRAM_CHAT_IDS.BOD, msg);

    return { success: true, stt: stt, vuotHanMuc: vuotHanMuc };
  } catch(e) {
    console.error('saveAdvanceRequest error:', e);
    return { success: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════
// BOD: XÁC NHẬN CHUYỂN TIỀN
// ════════════════════════════════════════════════════════════
function confirmTransfer() {
  if (!isBod()) {
    SpreadsheetApp.getUi().alert('⛔ Chỉ Giám đốc (BOD) mới có quyền xác nhận chuyển tiền.');
    return;
  }

  const html = HtmlService.createHtmlOutputFromFile('form_transfer')
    .setWidth(600).setHeight(500)
    .setTitle('Xác nhận Chuyển tiền');
  SpreadsheetApp.getUi().showModalDialog(html, '💳 Xác nhận Chuyển tiền Tạm ứng');
}

/**
 * Lấy danh sách lệnh chờ BOD duyệt (gọi từ HTML form)
 */
function getPendingAdvances() {
  const sh = getSheet(SHEET.ADVANCE_REQUEST);
  const lastRow = sh.getLastRow();
  if (lastRow <= 2) return [];

  const data = sh.getRange(3, 1, lastRow - 2, 16).getValues();
  return data
    .filter(r => r[12] === 'Chờ BOD duyệt')
    .map((r, i) => ({
      row       : i + 3,
      stt       : r[0],
      ngay      : r[1],
      thang     : r[2],
      team      : r[3],
      doiTruong : r[4],
      lyDo      : r[5],
      soTien    : r[6],
      hanMuc    : r[7],
      vuotHanMuc: r[8],
    }));
}

/**
 * BOD xác nhận đã chuyển tiền (gọi từ HTML form)
 */
function saveBodTransfer(data) {
  try {
    const sh = getSheet(SHEET.ADVANCE_REQUEST);
    const row = Number(data.row);

    // Cập nhật lệnh ứng
    sh.getRange(row, 10).setValue('BOD đã duyệt');
    sh.getRange(row, 11).setValue(data.ngayChuyenTien);
    sh.getRange(row, 12).setValue(Number(data.soTienThucChuyen));
    sh.getRange(row, 13).setValue('BOD đã chuyển tiền');
    sh.getRange(row, 15).setValue(data.ghiChu || '');
    sh.getRange(row, 1, 1, 16).setBackground(CLR.CLEARED);

    const stt    = sh.getRange(row, 1).getValue();
    const team   = sh.getRange(row, 4).getValue();
    const leader = sh.getRange(row, 5).getValue();
    const soTien = Number(data.soTienThucChuyen);

    // Ghi vào TRANSFER_LOG
    _addTransferLog(stt, team, leader, sh.getRange(row,7).getValue(), soTien, data);

    // Thông báo TPTC
    sendTelegramMsg(
      TELEGRAM_CHAT_IDS.TPTC,
      `✅ BOD ĐÃ CHUYỂN TIỀN\n` +
      `Lệnh: ${stt}\n` +
      `Team: ${team} — ${leader}\n` +
      `Số tiền: ${fmtVND(soTien)} đ\n` +
      `Ngày: ${data.ngayChuyenTien}\n` +
      `Phương thức: ${data.phuongThuc}\n` +
      `Ref: ${data.ref || 'N/A'}\n` +
      `Ghi chú: ${data.ghiChu || 'Không'}`
    );

    return { success: true };
  } catch(e) {
    console.error('saveBodTransfer error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Thêm vào TRANSFER_LOG
 */
function _addTransferLog(stt, team, leader, soTienLenh, soTienThuc, data) {
  const sh = getSheet(SHEET.TRANSFER_LOG);
  const newRow = Math.max(sh.getLastRow(), 1) + 1;
  const idx = newRow - 1;

  sh.getRange(newRow, 1, 1, 13).setValues([[
    idx,
    data.ngayChuyenTien,
    getMonthYear(),
    stt,
    team,
    leader,
    soTienLenh,
    soTienThuc,
    data.phuongThuc || 'Normal',
    data.ref || '',
    data.ghiChu || '',
    '',                        // Xác nhận TPTC (để trống, TPTC tự điền)
    '',                        // Ngày TPTC xác nhận
  ]]);

  [7,8].forEach(c => sh.getRange(newRow, c).setNumberFormat('#,##0'));
  sh.getRange(newRow, 1, 1, 13).setBackground(CLR.APPROVED);
}

// ════════════════════════════════════════════════════════════
// XEM LỆNH CHỜ
// ════════════════════════════════════════════════════════════
function viewPendingAdvances() {
  const sh = getSheet(SHEET.ADVANCE_REQUEST);
  const lastRow = sh.getLastRow();
  if (lastRow <= 2) {
    SpreadsheetApp.getUi().alert('📋 Chưa có lệnh tạm ứng nào.');
    return;
  }

  const data = sh.getRange(3, 1, lastRow-2, 16).getValues();
  const pending = data.filter(r => r[12] === 'Chờ BOD duyệt');
  const overLimit = pending.filter(r => String(r[8]).includes('Vượt'));

  let msg = `💸 LỆNH TẠM ỨNG CHỜ BOD DUYỆT\n\n`;
  msg += `Tổng chờ duyệt: ${pending.length}\n`;
  msg += `Trong đó vượt hạn mức: ${overLimit.length}\n\n`;

  pending.slice(0, 10).forEach(r => {
    msg += `• ${r[0]} | ${r[3]} | ${fmtVND(r[6])} đ | ${r[8]}\n`;
  });

  if (pending.length > 10) msg += `\n... và ${pending.length - 10} lệnh khác`;

  SpreadsheetApp.getUi().alert(msg);
}

function viewPendingTransfers() {
  viewPendingAdvances();
}
