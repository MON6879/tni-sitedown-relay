// ============================================================
// FILE: 08_IMPORT_BOD.gs
// MÔ TẢ: Đồng bộ dữ liệu từ file Giám đốc (BOD Cash Flow)
// Nguồn: "Sum Kioem Soat Tioen 2026" - Sheet Input
// ============================================================

// ════════════════════════════════════════════════════════════
// ĐỒNG BỘ DỮ LIỆU TỪ FILE BOD
// Menu: QLTC → Chuyển tiền (BOD) → Đồng bộ dữ liệu từ file BOD
// ════════════════════════════════════════════════════════════
function syncBodCashflow() {
  if (!isTptc() && !isBod()) {
    SpreadsheetApp.getUi().alert('⛔ Chỉ TPTC hoặc BOD mới có quyền đồng bộ.');
    return;
  }

  try {
    const bodSS = SpreadsheetApp.openById(BOD_SS_ID);
    const srcSh = bodSS.getSheetByName(BOD_TAB_NAME);
    if (!srcSh) {
      SpreadsheetApp.getUi().alert(`❌ Không tìm thấy sheet "${BOD_TAB_NAME}" trong file BOD.`);
      return;
    }

    const srcData = srcSh.getDataRange().getValues();
    const destSh  = getSheet(SHEET.BOD_CASHFLOW);

    // Xóa data cũ (giữ header row 1)
    const lastDest = destSh.getLastRow();
    if (lastDest > 1) {
      destSh.getRange(2, 1, lastDest - 1, 11).clearContent()
             .setBackground('#FFFFFF');
    }

    // Tìm hàng data (bỏ qua header)
    // Cấu trúc BOD file: Timestamp | Date | Team/Person | Content | Chi | Nhận | Type | Note
    let dataStart = 1;
    for (let i = 0; i < Math.min(srcData.length, 5); i++) {
      const r = srcData[i];
      // Header row thường có "Timestamp" hoặc "Date"
      if (String(r[0]).toLowerCase().includes('timestamp') ||
          r[0] instanceof Date) {
        dataStart = i + (String(r[0]).toLowerCase().includes('timestamp') ? 1 : 0);
        break;
      }
    }

    let insertRow = 2;
    let countThu = 0, countChi = 0;
    let totalThu = 0, totalChi = 0;

    for (let i = dataStart; i < srcData.length; i++) {
      const r = srcData[i];
      if (!r[1] && !r[2]) continue; // Bỏ dòng trống

      // Parse timestamp/date
      const ts = r[0] instanceof Date
        ? Utilities.formatDate(r[0], SETTINGS.TZ, 'dd/MM/yyyy HH:mm')
        : String(r[0] || '');

      const ngayGD = r[1] instanceof Date
        ? Utilities.formatDate(r[1], SETTINGS.TZ, 'dd/MM/yyyy')
        : String(r[1] || '');

      const team      = String(r[2] || '');
      const content   = String(r[3] || '');
      const soTienChi = Number(r[4]) || 0;
      const soTienNhan= Number(r[5]) || 0;
      const loaiTT    = String(r[6] || 'Normal');
      const ghiChu    = String(r[7] || '');

      // Xác định loại giao dịch
      const loaiGD = soTienChi > 0 && soTienNhan === 0 ? 'Chi'
                   : soTienNhan > 0 && soTienChi === 0 ? 'Thu'
                   : 'Thu & Chi';

      // Tính tháng
      const thang = ngayGD ? _getMonthYearFromStr(ngayGD) : '';

      destSh.getRange(insertRow, 1, 1, 11).setValues([[
        i - dataStart + 1,  // STT
        ts,                 // Timestamp
        ngayGD,             // Ngày GD
        team,               // Team / Phòng ban
        content,            // Nội dung
        loaiGD,             // Loại GD
        soTienChi,          // Số tiền Chi
        soTienNhan,         // Số tiền Nhận
        loaiTT,             // Loại thanh toán
        ghiChu,             // Ghi chú
        thang,              // Tháng
      ]]);

      // Format số
      destSh.getRange(insertRow, 7).setNumberFormat('#,##0');
      destSh.getRange(insertRow, 8).setNumberFormat('#,##0');

      // Màu sắc theo loại GD
      if (soTienChi > 0) {
        destSh.getRange(insertRow, 7).setBackground('#FFF3E0').setFontColor('#E65100');
        countChi++;
        totalChi += soTienChi;
      }
      if (soTienNhan > 0) {
        destSh.getRange(insertRow, 8).setBackground('#E8F5E9').setFontColor('#2E7D32');
        countThu++;
        totalThu += soTienNhan;
      }

      insertRow++;
    }

    SpreadsheetApp.getUi().alert(
      `✅ Đồng bộ file BOD hoàn tất!\n\n` +
      `📤 Giao dịch Chi: ${countChi} | Tổng: ${fmtVND(totalChi)} đ\n` +
      `📥 Giao dịch Thu: ${countThu} | Tổng: ${fmtVND(totalThu)} đ\n` +
      `📊 Tổng dòng: ${insertRow - 2}`
    );

  } catch(e) {
    SpreadsheetApp.getUi().alert(`❌ Lỗi: ${e.message}`);
    console.error(e);
  }
}

/**
 * Lấy tổng Thu/Chi từ BOD theo team & tháng (cho Dashboard)
 */
function getBodSummaryByTeamMonth(teamName, thang) {
  const sh = getSheet(SHEET.BOD_CASHFLOW);
  const lastRow = sh.getLastRow();
  if (lastRow <= 1) return { thu: 0, chi: 0 };

  const data = sh.getRange(2, 1, lastRow-1, 11).getValues();
  const filtered = data.filter(r =>
    String(r[3]).includes(teamName) && r[10] === thang
  );

  return {
    thu : filtered.reduce((s,r) => s + (Number(r[7])||0), 0),
    chi : filtered.reduce((s,r) => s + (Number(r[6])||0), 0),
    rows: filtered.length,
  };
}

/**
 * Tổng hợp dòng tiền BOD theo tháng (cho Dashboard BOD)
 */
function getBodMonthlySummary(thang) {
  const sh = getSheet(SHEET.BOD_CASHFLOW);
  const lastRow = sh.getLastRow();
  if (lastRow <= 1) return [];

  const data = sh.getRange(2, 1, lastRow-1, 11).getValues();
  const filtered = thang
    ? data.filter(r => r[10] === thang)
    : data;

  const byTeam = {};
  filtered.forEach(r => {
    const team = r[3] || 'Khác';
    if (!byTeam[team]) byTeam[team] = { thu:0, chi:0 };
    byTeam[team].thu += Number(r[7]) || 0;
    byTeam[team].chi += Number(r[6]) || 0;
  });

  return Object.entries(byTeam).map(([team, val]) => ({
    team,
    thu    : val.thu,
    chi    : val.chi,
    net    : val.thu - val.chi,
  }));
}

function _getMonthYearFromStr(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('/');
  if (parts.length >= 3) return `${parts[1]}/${parts[2]}`;
  if (parts.length === 2) return `${parts[0]}/${parts[1]}`;
  return '';
}

// ════════════════════════════════════════════════════════════
// XEM DÒI TIỀN TỔNG HỢP
// ════════════════════════════════════════════════════════════
function viewCashflowSummary() {
  const thang = getMonthYear();
  const summary = getBodMonthlySummary(thang);

  if (summary.length === 0) {
    SpreadsheetApp.getUi().alert('Chưa có dữ liệu dòng tiền. Hãy đồng bộ file BOD trước.');
    return;
  }

  let msg = `💰 DÒNG TIỀN THÁNG ${thang}\n\n`;
  let totalThu = 0, totalChi = 0;

  summary.forEach(s => {
    msg += `📌 ${s.team}\n`;
    msg += `   Thu: ${fmtVND(s.thu)} | Chi: ${fmtVND(s.chi)} | Net: ${fmtVND(s.net)}\n`;
    totalThu += s.thu;
    totalChi += s.chi;
  });

  msg += `\n─────────────────\n`;
  msg += `TỔNG THU: ${fmtVND(totalThu)} đ\n`;
  msg += `TỔNG CHI: ${fmtVND(totalChi)} đ\n`;
  msg += `CÂN ĐỐI:  ${fmtVND(totalThu - totalChi)} đ`;

  SpreadsheetApp.getUi().alert(msg);
}
