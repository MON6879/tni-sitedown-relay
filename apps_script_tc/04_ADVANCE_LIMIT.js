// ============================================================
// FILE: 04_ADVANCE_LIMIT.gs
// MÔ TẢ: Tính hạn mức tạm ứng tự động theo lịch sử clear
// Logic: Lấy tháng liền kề trước → nếu không có → tháng xa hơn
// ============================================================

// ════════════════════════════════════════════════════════════
// CẬP NHẬT HẠN MỨC CHO TẤT CẢ TEAM
// Menu: QLTC → Lệnh Tạm ứng → Cập nhật hạn mức tạm ứng
// ════════════════════════════════════════════════════════════
function updateAdvanceLimits() {
  if (!isTptc()) {
    SpreadsheetApp.getUi().alert('⛔ Chỉ TPTC mới có quyền cập nhật hạn mức.');
    return;
  }

  const sh = getSheet(SHEET.ADVANCE_LIMIT);

  // Đọc số tháng tham chiếu từ ô B2
  const refMonths = Number(sh.getRange(2, 2).getValue()) || DEFAULT_LIMIT_REF_MONTHS;

  // Cập nhật thời gian
  sh.getRange(2, 7).setValue(tsDate());
  sh.getRange(2, 5).setValue(getMonthYear());

  ROLES.TEAM_LEADERS.forEach((team, i) => {
    const row = 4 + i;
    const result = _calcTeamLimit(team.name, refMonths);

    // Ghi vào sheet
    sh.getRange(row, 4).setValue(result.refMonth);          // Tháng tham chiếu
    sh.getRange(row, 5).setValue(result.clearAmount);       // Clear TCT duyệt tháng TK
    sh.getRange(row, 6).setValue(result.totalAdvanced);     // Đã ứng kỳ này
    sh.getRange(row, 7).setValue(result.totalCleared);      // Đã clear kỳ này
    sh.getRange(row, 8).setValue(result.outstanding);       // Tồn ứng
    sh.getRange(row, 9).setValue(result.canAdvanceMore);    // Còn được ứng thêm
    sh.getRange(row, 10).setValue(result.note);             // Ghi chú

    // Format số
    [5,6,7,8,9].forEach(c =>
      sh.getRange(row, c).setNumberFormat('#,##0')
    );

    // Màu cảnh báo
    const limitCell = sh.getRange(row, 9);
    if (result.canAdvanceMore <= 0) {
      limitCell.setBackground(CLR.DIFF).setFontColor(CLR.REJECT);
      sh.getRange(row,10).setValue('⚠️ Đã đạt/vượt hạn mức');
    } else if (result.canAdvanceMore < result.clearAmount * 0.2) {
      limitCell.setBackground(CLR.PENDING).setFontColor(CLR.WARN);
    } else {
      limitCell.setBackground(CLR.CLEARED).setFontColor(CLR.OK);
    }
  });

  SpreadsheetApp.getUi().alert(
    `✅ Đã cập nhật hạn mức tạm ứng cho ${ROLES.TEAM_LEADERS.length} team.\n` +
    `Tháng tham chiếu: ${refMonths} tháng trước.`
  );
}

// ════════════════════════════════════════════════════════════
// TÍNH HẠN MỨC CHO 1 TEAM
// ════════════════════════════════════════════════════════════
function _calcTeamLimit(teamName, refMonths) {
  const currentMonth = getMonthYear();

  // 1. Tìm tổng clear TCT duyệt theo tháng tham chiếu
  const clearAmount = _getClearAmountForRef(teamName, refMonths);

  // 2. Tính đã tạm ứng kỳ này (từ LENH_TAM_UNG, tháng hiện tại)
  const totalAdvanced = _getTotalAdvancedThisMonth(teamName, currentMonth);

  // 3. Tính đã clear kỳ này (từ CHUNG_TU, tháng hiện tại, trạng thái Đã clear)
  const totalCleared = _getTotalClearedThisMonth(teamName, currentMonth);

  // 4. Tồn ứng = Đã ứng - Đã clear kỳ này
  const outstanding = totalAdvanced - totalCleared;

  // 5. Còn được ứng thêm = Hạn mức - Tồn ứng
  const canAdvanceMore = Math.max(0, clearAmount - outstanding);

  // 6. Tháng tham chiếu thực tế (tháng có dữ liệu)
  const actualRefMonth = _findActualRefMonth(teamName);

  return {
    refMonth      : actualRefMonth,
    clearAmount   : clearAmount,
    totalAdvanced : totalAdvanced,
    totalCleared  : totalCleared,
    outstanding   : outstanding,
    canAdvanceMore: canAdvanceMore,
    note          : clearAmount === 0 ? 'Chưa có lịch sử clear' : ''
  };
}

/**
 * Lấy tổng clear TCT duyệt:
 * - Nếu refMonths = 1: lấy tháng liền kề trước
 * - Nếu refMonths = 2: lấy trung bình 2 tháng trước
 * - Nếu refMonths = 3: lấy trung bình 3 tháng trước
 * Nếu tháng liền kề không có → lùi dần đến tháng có dữ liệu
 */
function _getClearAmountForRef(teamName, refMonths) {
  // Thử lấy theo refMonths tháng gần nhất
  let total = 0;
  let found = 0;

  for (let n = 1; n <= refMonths; n++) {
    const thang = getMonthsAgo(n);
    const amt = _getApprovedClearByTeamMonth(teamName, thang);
    if (amt > 0) {
      total += amt;
      found++;
    }
  }

  // Nếu không có dữ liệu trong khoảng → tìm tháng gần nhất có dữ liệu
  if (found === 0) {
    for (let n = refMonths + 1; n <= 12; n++) {
      const thang = getMonthsAgo(n);
      const amt = _getApprovedClearByTeamMonth(teamName, thang);
      if (amt > 0) {
        return amt; // Lấy tháng gần nhất có dữ liệu
      }
    }
    return 0; // Hoàn toàn không có lịch sử
  }

  return found > 0 ? Math.round(total / found) : 0;
}

/**
 * Lấy tổng TCT duyệt (cột 11 trong CHUNG_TU) cho team & tháng
 * (từ sheet CHUNG_TU, status = Đã clear)
 */
function _getApprovedClearByTeamMonth(teamName, thang) {
  const sh = getSheet(SHEET.SETTLEMENT);
  const lastRow = sh.getLastRow();
  if (lastRow <= 2) return 0;

  const data = sh.getRange(3, 1, lastRow - 2, 15).getValues();
  return data
    .filter(r => r[3] === teamName && r[2] === thang && r[13] === 'Đã clear')
    .reduce((s, r) => s + (Number(r[10]) || 0), 0);
}

/**
 * Lấy tổng tiền đã lập lệnh tạm ứng trong tháng hiện tại
 */
function _getTotalAdvancedThisMonth(teamName, currentMonth) {
  const sh = getSheet(SHEET.ADVANCE_REQUEST);
  const lastRow = sh.getLastRow();
  if (lastRow <= 2) return 0;

  const data = sh.getRange(3, 1, lastRow - 2, 16).getValues();
  return data
    .filter(r =>
      r[3] === teamName &&
      r[2] === currentMonth &&
      !['Hủy'].includes(r[12])
    )
    .reduce((s, r) => s + (Number(r[11]) || Number(r[9]) || 0), 0);
}

/**
 * Lấy tổng đã clear trong tháng hiện tại
 */
function _getTotalClearedThisMonth(teamName, currentMonth) {
  const sh = getSheet(SHEET.SETTLEMENT);
  const lastRow = sh.getLastRow();
  if (lastRow <= 2) return 0;

  const data = sh.getRange(3, 1, lastRow - 2, 15).getValues();
  return data
    .filter(r => r[3] === teamName && r[2] === currentMonth && r[13] === 'Đã clear')
    .reduce((s, r) => s + (Number(r[10]) || 0), 0);
}

/**
 * Tìm tháng gần nhất có dữ liệu clear cho team
 */
function _findActualRefMonth(teamName) {
  for (let n = 1; n <= 12; n++) {
    const thang = getMonthsAgo(n);
    const amt = _getApprovedClearByTeamMonth(teamName, thang);
    if (amt > 0) return thang;
  }
  return 'Chưa có dữ liệu';
}

// ════════════════════════════════════════════════════════════
// LẤY THÔNG TIN HẠN MỨC THEO TEAM (cho Dashboard & lệnh ứng)
// ════════════════════════════════════════════════════════════
function getTeamLimitInfo(teamName) {
  const sh = getSheet(SHEET.ADVANCE_LIMIT);
  const lastRow = sh.getLastRow();
  if (lastRow <= 3) return null;

  const data = sh.getRange(4, 1, lastRow - 3, 10).getValues();
  const row = data.find(r => r[1] === teamName);
  if (!row) return null;

  return {
    teamId          : row[0],
    teamName        : row[1],
    leader          : row[2],
    refMonth        : row[3],
    clearAmount     : row[4],
    totalAdvanced   : row[5],
    totalCleared    : row[6],
    outstanding     : row[7],
    canAdvanceMore  : row[8],
    note            : row[9],
  };
}
