// ============================================================
// FILE: 03_SETTLEMENT.gs
// MÔ TẢ: Quản lý chứng từ quyết toán (TPTC nhập liệu)
// ============================================================

// ════════════════════════════════════════════════════════════
// THÊM CHỨNG TỪ MỚI (Dialog form)
// ════════════════════════════════════════════════════════════
function addSettlementRecord() {
  if (!isTptc()) {
    SpreadsheetApp.getUi().alert('⛔ Chỉ Trưởng phòng Tài chính mới có quyền nhập chứng từ.');
    return;
  }

  const html = HtmlService.createHtmlOutputFromFile('form_settlement')
    .setWidth(700).setHeight(650)
    .setTitle('Nhập Chứng Từ Quyết Toán');
  SpreadsheetApp.getUi().showModalDialog(html, '📄 Thêm Chứng Từ Mới');
}

/**
 * Gọi từ HTML form — lưu chứng từ vào sheet
 */
function saveSettlement(data) {
  try {
    const sh = getSheet(SHEET.SETTLEMENT);
    const lastRow = Math.max(sh.getLastRow(), 2);
    const newRow = lastRow + 1;

    // Tính STT
    const stt = lastRow - 1;

    // Tính tháng từ ngày CT
    const ngayCt = new Date(data.ngayCt);
    const thang = getMonthYear(ngayCt);

    // Tìm tên đội trưởng từ team
    const team = ROLES.TEAM_LEADERS.find(t => t.name === data.team);
    const doiTruong = team ? team.leader : '';

    const rowData = [
      stt,                          // A: STT
      Utilities.formatDate(ngayCt, SETTINGS.TZ, 'dd/MM/yyyy'), // B: Ngày CT
      thang,                        // C: Tháng
      data.team,                    // D: Team
      doiTruong,                    // E: Đội trưởng
      data.loaiChiPhi,              // F: Loại chi phí
      data.moTa,                    // G: Mô tả
      Number(data.soTienDeXuat),    // H: Số tiền đề xuất
      data.loaiFee || '',           // I: Loại phí
      data.taiKhoan || '',          // J: TK kế toán
      '',                           // K: Số tiền TCT duyệt (để trống chờ TCT)
      '',                           // L: Chênh lệch (auto khi K có giá trị)
      '',                           // M: Lý do cắt
      'Chờ kiểm tra',              // N: Trạng thái
      '',                           // O: TPTC xác nhận
      '',                           // P: Ngày gửi TCT
      data.ghiChu || '',            // Q: Ghi chú
      tsNow(),                      // R: Ngày nhập
      Session.getActiveUser().getEmail(), // S: Người nhập
    ];

    sh.getRange(newRow, 1, 1, rowData.length).setValues([rowData]);

    // Format số tiền
    sh.getRange(newRow, 8).setNumberFormat('#,##0');
    sh.getRange(newRow, 11).setNumberFormat('#,##0');
    sh.getRange(newRow, 12).setNumberFormat('#,##0');

    // Màu nền dòng mới
    sh.getRange(newRow, 1, 1, rowData.length)
      .setBackground(newRow % 2 === 0 ? CLR.ALT_ROW : '#FFFFFF');

    return { success: true, row: newRow, stt: stt };
  } catch(e) {
    console.error('saveSettlement error:', e);
    return { success: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════
// XÁC NHẬN CHỨNG TỪ (TPTC confirm đã kiểm tra)
// ════════════════════════════════════════════════════════════
function confirmSettlement() {
  if (!isTptc()) return;

  const sh = getSheet(SHEET.SETTLEMENT);
  const selection = sh.getActiveRange();
  const rows = [];

  for (let r = selection.getRow(); r <= selection.getLastRow(); r++) {
    if (r <= 2) continue; // Bỏ header
    const status = sh.getRange(r, 14).getValue();
    if (status === 'Chờ kiểm tra') {
      sh.getRange(r, 14).setValue('TPTC đã xác nhận');
      sh.getRange(r, 15).setValue(Session.getActiveUser().getEmail());
      sh.getRange(r, 1, 1, 19).setBackground(CLR.APPROVED);
      rows.push(r);
    }
  }

  SpreadsheetApp.getUi().alert(
    rows.length > 0
      ? `✅ Đã xác nhận ${rows.length} chứng từ (dòng: ${rows.join(', ')})`
      : '⚠️ Không có dòng nào ở trạng thái "Chờ kiểm tra" trong vùng chọn'
  );
}

// ════════════════════════════════════════════════════════════
// ĐÁNH DẤU ĐÃ GỬI TCT
// ════════════════════════════════════════════════════════════
function markSentToTct() {
  if (!isTptc()) return;

  const sh = getSheet(SHEET.SETTLEMENT);
  const selection = sh.getActiveRange();
  let count = 0;

  for (let r = selection.getRow(); r <= selection.getLastRow(); r++) {
    if (r <= 2) continue;
    const status = sh.getRange(r, 14).getValue();
    if (status === 'TPTC đã xác nhận') {
      sh.getRange(r, 14).setValue('Đã gửi TCT');
      sh.getRange(r, 16).setValue(tsDate());
      sh.getRange(r, 1, 1, 19).setBackground(CLR.PENDING);
      count++;
    }
  }

  SpreadsheetApp.getUi().alert(
    count > 0
      ? `📤 Đã đánh dấu gửi TCT: ${count} chứng từ`
      : '⚠️ Không có dòng nào ở trạng thái "TPTC đã xác nhận"'
  );
}

// ════════════════════════════════════════════════════════════
// XEM CHỨNG TỪ CHỜ XỬ LÝ
// ════════════════════════════════════════════════════════════
function viewPendingSettlements() {
  const sh = getSheet(SHEET.SETTLEMENT);
  const lastRow = sh.getLastRow();
  if (lastRow <= 2) {
    SpreadsheetApp.getUi().alert('📋 Chưa có chứng từ nào trong hệ thống.');
    return;
  }

  const data = sh.getRange(3, 1, lastRow - 2, 19).getValues();
  const pending = data.filter(row =>
    ['Chờ kiểm tra', 'TPTC đã xác nhận', 'Đã gửi TCT'].includes(row[13])
  );

  SpreadsheetApp.getUi().alert(
    `📋 CHỨNG TỪ CHỜ XỬ LÝ\n\n` +
    `Chờ kiểm tra: ${pending.filter(r=>r[13]==='Chờ kiểm tra').length}\n` +
    `TPTC đã xác nhận: ${pending.filter(r=>r[13]==='TPTC đã xác nhận').length}\n` +
    `Đã gửi TCT (chờ phản hồi): ${pending.filter(r=>r[13]==='Đã gửi TCT').length}\n\n` +
    `Tổng chờ: ${pending.length} chứng từ`
  );
}

// ════════════════════════════════════════════════════════════
// CẬP NHẬT KẾT QUẢ TCT (sau khi TCT phản hồi)
// Dùng khi TPTC nhập số TCT duyệt vào cột K
// ════════════════════════════════════════════════════════════
function onSettlementEdit(e) {
  const sh = e.source.getActiveSheet();
  if (sh.getName() !== SHEET.SETTLEMENT) return;

  const col = e.range.getColumn();
  const row = e.range.getRow();
  if (row <= 2) return;

  // Nếu TPTC nhập số TCT duyệt (cột 11) → tự tính chênh lệch (cột 12)
  if (col === 11) {
    const deXuat = sh.getRange(row, 8).getValue();
    const tctDuyet = e.range.getValue();
    const chenhLech = Number(deXuat) - Number(tctDuyet);
    sh.getRange(row, 12).setValue(chenhLech);
    sh.getRange(row, 14).setValue('TCT đã phản hồi');

    // Highlight nếu có chênh lệch
    if (chenhLech > 0) {
      sh.getRange(row, 1, 1, 19).setBackground(CLR.DIFF);
      // Cảnh báo nếu chênh lệch > 10%
      const pct = (chenhLech / deXuat) * 100;
      if (pct > 10) {
        sendTelegramMsg(
          TELEGRAM_CHAT_IDS.GROUP,
          `⚠️ CHÊNH LỆCH CHỨNG TỪ\n` +
          `Dòng ${row} — Team: ${sh.getRange(row,4).getValue()}\n` +
          `Đề xuất: ${fmtVND(deXuat)} đ\n` +
          `TCT duyệt: ${fmtVND(tctDuyet)} đ\n` +
          `Chênh lệch: ${fmtVND(chenhLech)} đ (${pct.toFixed(1)}%)`
        );
      }
    } else {
      sh.getRange(row, 1, 1, 19).setBackground(CLR.CLEARED);
      sh.getRange(row, 14).setValue('Đã clear');
    }
  }
}

// ════════════════════════════════════════════════════════════
// LẤY DỮ LIỆU CHỨNG TỪ THEO TEAM & THÁNG (cho Dashboard)
// ════════════════════════════════════════════════════════════
function getSettlementByTeamMonth(teamName, thang) {
  const sh = getSheet(SHEET.SETTLEMENT);
  const lastRow = sh.getLastRow();
  if (lastRow <= 2) return [];

  const data = sh.getRange(3, 1, lastRow - 2, 19).getValues();
  return data.filter(row => row[3] === teamName && row[2] === thang);
}

/**
 * Tính tổng đã ứng và đã clear cho 1 team trong 1 tháng cụ thể
 */
function getTeamMonthlySummary(teamName, thang) {
  const rows = getSettlementByTeamMonth(teamName, thang);
  const totalProposal = rows.reduce((s, r) => s + (Number(r[7]) || 0), 0);
  const totalApproved = rows.reduce((s, r) => s + (Number(r[10]) || 0), 0);
  const cleared = rows.filter(r => r[13] === 'Đã clear').length;
  return {
    totalProposal,
    totalApproved,
    cleared,
    total: rows.length
  };
}
