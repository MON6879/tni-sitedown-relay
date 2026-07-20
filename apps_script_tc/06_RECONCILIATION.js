// ============================================================
// FILE: 06_RECONCILIATION.gs
// MÔ TẢ: Import & đối chiếu dữ liệu từ TCT
// Đọc file "Công Nợ": Sheet BOD (sổ cái Nợ/Có) & Detail Team-Dep
// ============================================================

// ════════════════════════════════════════════════════════════
// IMPORT SỔ CÁI TCT (Sheet BOD: Nợ/Có)
// ════════════════════════════════════════════════════════════
function importTctJournal() {
  if (!isTptc()) {
    SpreadsheetApp.getUi().alert('⛔ Chỉ TPTC mới có quyền import.');
    return;
  }

  try {
    const tctSS = SpreadsheetApp.openById(TCT_SS_ID);
    const srcSh = tctSS.getSheetByName(TCT_BOD_TAB);
    if (!srcSh) {
      SpreadsheetApp.getUi().alert(`❌ Không tìm thấy sheet "${TCT_BOD_TAB}" trong file TCT.`);
      return;
    }

    const srcData = srcSh.getDataRange().getValues();
    const destSh  = getSheet(SHEET.TCT_JOURNAL);

    // Xóa data cũ (giữ header)
    const lastDest = destSh.getLastRow();
    if (lastDest > 1) destSh.getRange(2, 1, lastDest - 1, destSh.getLastColumn()).clearContent();

    // Tìm header row trong file TCT (thường là row 1 hoặc có merge)
    // Dựa trên cấu trúc: Ngày ghi sổ | Số hiệu CT | Ngày CT | Diễn giải | TK | Nợ | Có
    let dataStartRow = 0;
    for (let i = 0; i < srcData.length; i++) {
      const row = srcData[i];
      // Tìm dòng có dữ liệu thực (có ngày hoặc số CT)
      if (row[0] instanceof Date || (typeof row[0] === 'string' && row[0].match(/\d{2}\/\d{2}/))) {
        dataStartRow = i;
        break;
      }
    }

    let insertRow = 2;
    let count = 0;

    for (let i = dataStartRow; i < srcData.length; i++) {
      const r = srcData[i];
      // Bỏ qua dòng trống
      if (!r[0] && !r[4] && !r[7] && !r[9]) continue;

      const ngayGhiSo = r[0] instanceof Date
        ? Utilities.formatDate(r[0], SETTINGS.TZ, 'dd/MM/yyyy')
        : (r[0] || '');

      const ngayCT = r[2] instanceof Date
        ? Utilities.formatDate(r[2], SETTINGS.TZ, 'dd/MM/yyyy')
        : (r[2] || '');

      const dienGiai = [r[3], r[4], r[5]].filter(Boolean).join(' ').trim(); // Merge 3 cột diễn giải
      const tkDoiUng = r[6] || '';
      const soNo     = Number(r[7]) || Number(r[8]) || 0;   // Nợ (tạm ứng)
      const soCo     = Number(r[9]) || Number(r[10]) || 0;  // Có (clear)
      const ghiChu   = r[11] || '';

      // Tự nhận diện team từ diễn giải
      const teamDetected = _detectTeamFromText(dienGiai);

      // Tính tháng
      const thang = ngayCT ? _extractMonthYear(ngayCT) : '';

      destSh.getRange(insertRow, 1, 1, 12).setValues([[
        count + 1,
        ngayGhiSo,
        r[1] || '',     // Số hiệu CT
        ngayCT,
        dienGiai,
        teamDetected,
        tkDoiUng,
        soNo,
        soCo,
        ghiChu,
        '',             // Trạng thái đối chiếu
        thang,
      ]]);

      // Format số
      destSh.getRange(insertRow, 8).setNumberFormat('#,##0');
      destSh.getRange(insertRow, 9).setNumberFormat('#,##0');

      // Màu: Nợ (ứng) = cam, Có (clear) = xanh
      if (soNo > 0) destSh.getRange(insertRow, 8).setBackground('#FFF3E0').setFontColor('#E65100');
      if (soCo > 0) destSh.getRange(insertRow, 9).setBackground('#E8F5E9').setFontColor('#2E7D32');

      insertRow++;
      count++;
    }

    SpreadsheetApp.getUi().alert(
      `✅ Import sổ cái TCT hoàn tất!\n` +
      `Đã nhập: ${count} dòng giao dịch.\n\n` +
      `📌 Kiểm tra cột "Team (tự nhận diện)" — có thể cần chỉnh thủ công nếu sai.`
    );

    // Chạy reconciliation luôn
    runReconciliation();

  } catch(e) {
    SpreadsheetApp.getUi().alert(`❌ Lỗi import: ${e.message}`);
    console.error(e);
  }
}

// ════════════════════════════════════════════════════════════
// IMPORT CHI TIẾT CLEAR TCT (Sheet Detail Team - Dep)
// ════════════════════════════════════════════════════════════
function importTctDetail() {
  if (!isTptc()) return;

  try {
    const tctSS = SpreadsheetApp.openById(TCT_SS_ID);
    const srcSh = tctSS.getSheetByName(TCT_DETAIL_TAB);
    if (!srcSh) {
      SpreadsheetApp.getUi().alert(`❌ Không tìm thấy sheet "${TCT_DETAIL_TAB}"`);
      return;
    }

    const srcData = srcSh.getDataRange().getValues();
    const destSh  = getSheet(SHEET.TCT_DETAIL);

    // Xóa data cũ
    const lastDest = destSh.getLastRow();
    if (lastDest > 1) destSh.getRange(2, 1, lastDest - 1, 13).clearContent();

    // Hỏi tháng của dữ liệu đang import
    const ui = SpreadsheetApp.getUi();
    const res = ui.prompt(
      'Nhập tháng dữ liệu',
      'Nhập tháng/năm của dữ liệu TCT Detail (ví dụ: 04/2026):',
      ui.ButtonSet.OK_CANCEL
    );
    if (res.getSelectedButton() !== ui.Button.OK) return;
    const thangImport = res.getResponseText().trim() || getMonthsAgo(1);

    // Tìm hàng header trong file TCT
    // Cấu trúc: No | Description | PROPOSAL | APPROVE | DIFFERENCE | NOTE | TYPE OF FEE | ACCOUNT
    let dataStart = 1;
    for (let i = 0; i < Math.min(srcData.length, 10); i++) {
      const r = srcData[i];
      if (String(r[0]).toLowerCase().includes('no') ||
          String(r[1]).toLowerCase().includes('description')) {
        dataStart = i + 1;
        break;
      }
    }

    let insertRow = 2;
    let count = 0;
    let currentTeam = '';

    for (let i = dataStart; i < srcData.length; i++) {
      const r = srcData[i];
      if (!r[1] && !r[2]) continue; // Bỏ dòng trống

      // Phát hiện dòng tên team (thường là dòng có text và không có số)
      const isTeamHeader = !r[2] && r[1] && isNaN(Number(r[0]));
      if (isTeamHeader) {
        currentTeam = _detectTeamFromText(String(r[1]));
        continue;
      }

      const no         = r[0] || '';
      const desc       = r[1] || '';
      const proposal   = Number(r[2]) || 0;
      const approve    = Number(r[3]) || 0;
      const difference = Number(r[4]) || (proposal - approve);
      const note       = r[5] || '';
      const feeType    = r[6] || '';
      const account    = r[7] || '';

      const status = approve === proposal ? 'Đã clear đủ'
                   : approve < proposal   ? 'TCT cắt giảm'
                   : 'TCT tăng thêm';

      destSh.getRange(insertRow, 1, 1, 13).setValues([[
        count + 1,
        thangImport,
        currentTeam || _detectTeamFromText(desc),
        no,
        desc,
        proposal,
        approve,
        difference,
        note,
        feeType,
        account,
        status,
        '',
      ]]);

      // Format số
      [6,7,8].forEach(c => destSh.getRange(insertRow, c).setNumberFormat('#,##0'));

      // Highlight chênh lệch
      if (difference > 0) {
        destSh.getRange(insertRow, 8).setBackground(CLR.DIFF).setFontColor(CLR.REJECT);
        destSh.getRange(insertRow, 9).setBackground(CLR.DIFF);
      } else {
        destSh.getRange(insertRow, 1, 1, 13).setBackground(CLR.CLEARED);
      }

      // Cập nhật chứng từ tương ứng trong CHUNG_TU nếu match
      _updateSettlementFromTct(currentTeam, thangImport, desc, approve, note);

      insertRow++;
      count++;
    }

    SpreadsheetApp.getUi().alert(
      `✅ Import chi tiết TCT hoàn tất!\n` +
      `Tháng: ${thangImport} | Đã nhập: ${count} dòng\n\n` +
      `Các chứng từ trong CHUNG_TU đã được cập nhật tự động.`
    );

  } catch(e) {
    SpreadsheetApp.getUi().alert(`❌ Lỗi: ${e.message}`);
    console.error(e);
  }
}

// ════════════════════════════════════════════════════════════
// CHẠY ĐỐI CHIẾU TỰ ĐỘNG
// ════════════════════════════════════════════════════════════
function runReconciliation() {
  const sh = getSheet(SHEET.TCT_JOURNAL);
  const lastRow = sh.getLastRow();
  if (lastRow <= 1) return;

  const data = sh.getRange(2, 1, lastRow - 1, 12).getValues();
  let diffCount = 0;

  data.forEach((r, i) => {
    const row = i + 2;
    const soNo = Number(r[7]) || 0;
    const soCo = Number(r[8]) || 0;

    // Tìm lệnh tạm ứng tương ứng
    if (soNo > 0) {
      const matched = _findMatchingAdvance(r[4], r[5], soNo);
      if (matched) {
        sh.getRange(row, 11).setValue('✅ Khớp với lệnh ' + matched);
        sh.getRange(row, 1, 1, 12).setBackground(CLR.CLEARED);
      } else {
        sh.getRange(row, 11).setValue('⚠️ Chưa khớp lệnh ứng');
        sh.getRange(row, 1, 1, 12).setBackground(CLR.PENDING);
        diffCount++;
      }
    }
  });

  if (diffCount > 0) {
    sendTelegramMsg(
      TELEGRAM_CHAT_IDS.GROUP,
      `⚠️ ĐỐI CHIẾU TCT\n` +
      `Tìm thấy ${diffCount} giao dịch chưa khớp với lệnh tạm ứng.\n` +
      `Vui lòng kiểm tra sheet TCT_SO_CAI.`
    );
  }
}

// ════════════════════════════════════════════════════════════
// XEM BÁO CÁO CHÊNH LỆCH
// ════════════════════════════════════════════════════════════
function viewDiffReport() {
  const sh = getSheet(SHEET.TCT_DETAIL);
  const lastRow = sh.getLastRow();
  if (lastRow <= 1) {
    SpreadsheetApp.getUi().alert('Chưa có dữ liệu chi tiết TCT. Hãy import trước.');
    return;
  }

  const data = sh.getRange(2, 1, lastRow - 1, 13).getValues();
  const diffs = data.filter(r => Number(r[7]) > 0);

  const totalDiff = diffs.reduce((s, r) => s + (Number(r[7]) || 0), 0);
  const totalProp = data.reduce((s, r) => s + (Number(r[5]) || 0), 0);
  const totalAppr = data.reduce((s, r) => s + (Number(r[6]) || 0), 0);

  // Nhóm theo team
  const byTeam = {};
  diffs.forEach(r => {
    const t = r[2] || 'Chưa xác định';
    if (!byTeam[t]) byTeam[t] = 0;
    byTeam[t] += Number(r[7]) || 0;
  });

  let msg = `📊 BÁO CÁO CHÊNH LỆCH TCT\n\n`;
  msg += `Tổng đề xuất: ${fmtVND(totalProp)} đ\n`;
  msg += `TCT duyệt: ${fmtVND(totalAppr)} đ\n`;
  msg += `Tổng chênh lệch: ${fmtVND(totalDiff)} đ\n\n`;
  msg += `THEO TEAM:\n`;
  Object.entries(byTeam).forEach(([team, diff]) => {
    msg += `• ${team}: ${fmtVND(diff)} đ\n`;
  });

  SpreadsheetApp.getUi().alert(msg);
}

// ════════════════════════════════════════════════════════════
// SO SÁNH CHI TIẾT: EXPENSES & MDG THEO THÁNG × TEAM
// Tạo sheet tổng hợp nhóm chi phí key theo từng tháng
// Menu: QLTC → Đối chiếu TCT → So sánh Expenses & MDG theo tháng
// ════════════════════════════════════════════════════════════
function buildExpenseMdgCompare() {
  if (!isTptc()) {
    SpreadsheetApp.getUi().alert('⛔ Chỉ TPTC mới có quyền.');
    return;
  }

  const tctSh = getSheet(SHEET.TCT_DETAIL);
  const lastRow = tctSh.getLastRow();
  if (lastRow <= 1) {
    SpreadsheetApp.getUi().alert('❌ Chưa có dữ liệu TCT chi tiết. Hãy import trước.');
    return;
  }

  // Đọc toàn bộ dữ liệu TCT_CHI_TIET
  // Cols: 0=#, 1=Tháng, 2=Team, 3=No, 4=Mô tả, 5=Proposal, 6=Approve, 7=Diff, 8=Note, 9=TypeFee, 10=Account
  const rawData = tctSh.getRange(2, 1, lastRow - 1, 13).getValues()
    .filter(r => r[1] && r[2]); // Bỏ dòng không có tháng hoặc team

  // Nhóm chi phí cần tách
  const KEY_GROUPS = {
    'Expenses'  : ['Expenses','Admin','Stationery','Drinking Water','Electric Bill',
                   'Office Security','SSB','Cleaner','Viễn thông'],
    'MDG'       : ['MDG','MDG Office','MDG Office Fuel'],
    'EPC'       : ['EPC'],
    'Support'   : ['Support','Support / Living Cost','Guest Reception','Donate'],
    'Fuel'      : ['Fuel Car','Fuel','Refuel'],
    'Rent'      : ['Rent Office','Rent House','Rent Car'],
    'Nhân sự'   : ['Toien Salry','Salary','Driver OT','SSB'],
    'Khác'      : [], // Tất cả còn lại
  };

  // Phân loại từng dòng vào nhóm
  function classifyType(typeOfFee, desc) {
    const t = String(typeOfFee || desc || '').toLowerCase();
    for (const [group, keywords] of Object.entries(KEY_GROUPS)) {
      if (group === 'Khác') continue;
      if (keywords.some(k => t.includes(k.toLowerCase()))) return group;
    }
    return 'Khác';
  }

  // Thu thập các tháng và team duy nhất
  const months  = [...new Set(rawData.map(r => r[1]))].sort();
  const teams   = [...new Set(rawData.map(r => r[2]))].filter(Boolean).sort();
  const groups  = Object.keys(KEY_GROUPS);

  // Tạo/reset sheet SO_SANH_CHI_TIET
  const SS_NAME = 'SO_SANH_EXPENSES_MDG';
  let rsh = getSS().getSheetByName(SS_NAME);
  if (rsh) getSS().deleteSheet(rsh);
  rsh = getSS().insertSheet(SS_NAME);
  rsh.setTabColor('#01579B');

  // ── TIÊU ĐỀ ──
  const totalCols = 1 + months.length * 3; // 1 cột tên + (3 cột/tháng: Proposal|Approve|Diff)
  rsh.getRange(1, 1, 1, Math.min(totalCols + 2, 26)).merge()
    .setValue('📊 SO SÁNH CHI TIẾT EXPENSES & MDG THEO THÁNG × TEAM')
    .setBackground('#01579B').setFontColor('#FFFFFF')
    .setFontSize(13).setFontWeight('bold').setHorizontalAlignment('center');
  rsh.getRange(2, 1).setValue(`Cập nhật: ${tsNow()} | Nguồn: ${SHEET.TCT_DETAIL}`).setFontStyle('italic');

  let currentRow = 4;

  // ── VÒNG LẶP TỪNG TEAM ──
  teams.forEach(teamName => {
    // Header Team
    rsh.getRange(currentRow, 1, 1, Math.min(totalCols, 26)).merge()
      .setValue(`🏷️ ${teamName}`)
      .setBackground('#0277BD').setFontColor('#FFFFFF')
      .setFontWeight('bold').setFontSize(11);
    currentRow++;

    // Header cột tháng
    rsh.getRange(currentRow, 1).setValue('Loại chi phí').setFontWeight('bold')
      .setBackground('#B3E5FC');
    months.forEach((m, mi) => {
      const col = 2 + mi * 3;
      rsh.getRange(currentRow, col, 1, 3).merge()
        .setValue(m).setBackground('#E1F5FE')
        .setFontWeight('bold').setHorizontalAlignment('center');
    });
    currentRow++;

    // Sub-header Proposal | Approve | Diff
    rsh.getRange(currentRow, 1).setValue('').setBackground('#E1F5FE');
    months.forEach((m, mi) => {
      const col = 2 + mi * 3;
      rsh.getRange(currentRow, col    ).setValue('Proposal').setBackground('#E1F5FE').setFontWeight('bold').setHorizontalAlignment('center');
      rsh.getRange(currentRow, col + 1).setValue('Approve') .setBackground('#E8F5E9').setFontWeight('bold').setHorizontalAlignment('center');
      rsh.getRange(currentRow, col + 2).setValue('Diff (↓)').setBackground('#FFEBEE').setFontWeight('bold').setHorizontalAlignment('center');
    });
    currentRow++;

    // Dữ liệu từng nhóm chi phí
    const teamData = rawData.filter(r => r[2] === teamName);
    let teamTotProposal = {};
    let teamTotApprove  = {};
    let teamTotDiff     = {};
    months.forEach(m => { teamTotProposal[m]=0; teamTotApprove[m]=0; teamTotDiff[m]=0; });

    groups.forEach(group => {
      const groupData = teamData.filter(r => classifyType(r[9], r[4]) === group);
      if (groupData.length === 0 && group !== 'Expenses' && group !== 'MDG') return;

      // Tính tổng theo tháng cho nhóm này
      const byMonth = {};
      months.forEach(m => byMonth[m] = { prop: 0, appr: 0, diff: 0 });

      groupData.forEach(r => {
        const m = r[1];
        if (!byMonth[m]) return;
        byMonth[m].prop += Number(r[5]) || 0;
        byMonth[m].appr += Number(r[6]) || 0;
        byMonth[m].diff += Number(r[7]) || 0;
      });

      // Màu nền theo nhóm
      const groupColor = group === 'Expenses' ? '#FFF9C4'   // Vàng nhạt
                       : group === 'MDG'       ? '#FCE4EC'   // Hồng nhạt
                       : group === 'EPC'       ? '#F3E5F5'   // Tím nhạt
                       : group === 'Support'   ? '#E8F5E9'   // Xanh nhạt
                       : group === 'Fuel'      ? '#FFF3E0'   // Cam nhạt
                       : '#FAFAFA';

      // Ghi dòng nhóm
      rsh.getRange(currentRow, 1).setValue(group)
        .setBackground(groupColor).setFontWeight('bold');

      months.forEach((m, mi) => {
        const col  = 2 + mi * 3;
        const data = byMonth[m];
        const hasDiff = data.diff > 0;

        rsh.getRange(currentRow, col    ).setValue(data.prop || 0).setNumberFormat('#,##0')
          .setBackground(groupColor).setHorizontalAlignment('right');
        rsh.getRange(currentRow, col + 1).setValue(data.appr || 0).setNumberFormat('#,##0')
          .setBackground(groupColor).setHorizontalAlignment('right');

        const diffCell = rsh.getRange(currentRow, col + 2);
        diffCell.setValue(data.diff || 0).setNumberFormat('#,##0').setHorizontalAlignment('right');
        if (hasDiff) {
          diffCell.setBackground('#FFCDD2').setFontColor('#C62828').setFontWeight('bold');
        } else {
          diffCell.setBackground(data.appr > 0 ? '#C8E6C9' : groupColor)
            .setFontColor(data.appr > 0 ? '#1B5E20' : '#757575');
        }

        // Cộng vào tổng team
        teamTotProposal[m] += data.prop;
        teamTotApprove[m]  += data.appr;
        teamTotDiff[m]     += data.diff;
      });

      currentRow++;
    });

    // Dòng TỔNG TEAM
    rsh.getRange(currentRow, 1).setValue(`TỔNG ${teamName}`)
      .setBackground('#01579B').setFontColor('#FFFFFF').setFontWeight('bold');

    months.forEach((m, mi) => {
      const col = 2 + mi * 3;
      rsh.getRange(currentRow, col    ).setValue(teamTotProposal[m]).setNumberFormat('#,##0')
        .setBackground('#01579B').setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('right');
      rsh.getRange(currentRow, col + 1).setValue(teamTotApprove[m]).setNumberFormat('#,##0')
        .setBackground('#01579B').setFontColor('#FFFFFF').setFontWeight('bold').setHorizontalAlignment('right');
      const totDiffCell = rsh.getRange(currentRow, col + 2);
      totDiffCell.setValue(teamTotDiff[m]).setNumberFormat('#,##0')
        .setFontWeight('bold').setHorizontalAlignment('right');
      if (teamTotDiff[m] > 0) {
        totDiffCell.setBackground('#D32F2F').setFontColor('#FFFFFF');
      } else {
        totDiffCell.setBackground('#2E7D32').setFontColor('#FFFFFF');
      }
    });

    currentRow += 3; // Khoảng cách giữa các team
  });

  // ── TỔNG TẤT CẢ TEAM theo tháng ──
  rsh.getRange(currentRow, 1, 1, Math.min(totalCols, 26)).merge()
    .setValue('📊 TỔNG HỢP TẤT CẢ TEAM')
    .setBackground('#1A237E').setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontSize(11);
  currentRow++;

  rsh.getRange(currentRow, 1).setValue('').setBackground('#E8EAF6');
  months.forEach((m, mi) => {
    const col = 2 + mi * 3;
    rsh.getRange(currentRow, col, 1, 3).merge().setValue(m)
      .setBackground('#C5CAE9').setFontWeight('bold').setHorizontalAlignment('center');
  });
  currentRow++;

  rsh.getRange(currentRow, 1).setValue('');
  months.forEach((m, mi) => {
    const col = 2 + mi * 3;
    rsh.getRange(currentRow, col    ).setValue('Proposal').setBackground('#E8EAF6').setFontWeight('bold').setHorizontalAlignment('center');
    rsh.getRange(currentRow, col + 1).setValue('Approve') .setBackground('#C8E6C9').setFontWeight('bold').setHorizontalAlignment('center');
    rsh.getRange(currentRow, col + 2).setValue('Diff (↓)').setBackground('#FFCDD2').setFontWeight('bold').setHorizontalAlignment('center');
  });
  currentRow++;

  groups.forEach(group => {
    const gData = rawData.filter(r => classifyType(r[9], r[4]) === group);
    if (gData.length === 0 && group !== 'Expenses' && group !== 'MDG') return;

    rsh.getRange(currentRow, 1).setValue(group).setFontWeight('bold')
      .setBackground(group === 'Expenses' ? '#FFF9C4' : group === 'MDG' ? '#FCE4EC' : '#FAFAFA');

    months.forEach((m, mi) => {
      const col  = 2 + mi * 3;
      const mData = gData.filter(r => r[1] === m);
      const prop = mData.reduce((s,r) => s+(Number(r[5])||0), 0);
      const appr = mData.reduce((s,r) => s+(Number(r[6])||0), 0);
      const diff = mData.reduce((s,r) => s+(Number(r[7])||0), 0);

      rsh.getRange(currentRow, col    ).setValue(prop).setNumberFormat('#,##0').setHorizontalAlignment('right');
      rsh.getRange(currentRow, col + 1).setValue(appr).setNumberFormat('#,##0').setHorizontalAlignment('right')
        .setBackground(appr > 0 ? '#C8E6C9' : '');
      const dc = rsh.getRange(currentRow, col + 2);
      dc.setValue(diff).setNumberFormat('#,##0').setHorizontalAlignment('right');
      if (diff > 0) dc.setBackground('#FFCDD2').setFontColor('#C62828').setFontWeight('bold');
    });
    currentRow++;
  });

  // Format column widths
  rsh.setColumnWidth(1, 140); // Tên nhóm
  months.forEach((m, mi) => {
    const col = 2 + mi * 3;
    rsh.setColumnWidth(col,     120); // Proposal
    rsh.setColumnWidth(col + 1, 120); // Approve
    rsh.setColumnWidth(col + 2, 100); // Diff
  });

  rsh.setFrozenColumns(1);
  rsh.setFrozenRows(3);

  // Chuyển sang sheet vừa tạo
  getSS().setActiveSheet(rsh);

  SpreadsheetApp.getUi().alert(
    `✅ Đã tạo báo cáo so sánh!\n\n` +
    `📊 Sheet: ${SS_NAME}\n` +
    `• ${teams.length} team × ${months.length} tháng\n` +
    `• Phân nhóm: Expenses, MDG, EPC, Support, Fuel, Rent, Nhân sự, Khác\n` +
    `• Cột đỏ = chênh lệch bị TCT cắt giảm\n` +
    `• Cột xanh = TCT duyệt đủ`
  );
}

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════

/**
 * Tự nhận diện team từ text diễn giải
 */
function _detectTeamFromText(text) {
  if (!text) return '';
  const t = String(text).toLowerCase();
  const teams = ROLES.TEAM_LEADERS;

  for (const team of teams) {
    if (t.includes(team.name.toLowerCase())) return team.name;
    if (t.includes(team.id.toLowerCase())) return team.name;
  }

  // Pattern nhận diện phổ biến
  if (t.includes('team 1') || t.includes('t01')) return 'Team 1';
  if (t.includes('team 2 sub') || t.includes('t2 sub')) return 'Team 2 SUB';
  if (t.includes('team 2') || t.includes('t02')) return 'Team 2';
  if (t.includes('team 3') || t.includes('t03')) return 'Team 3';
  if (t.includes('team 4') || t.includes('t04')) return 'Team 4';
  if (t.includes('solution') || t.includes('ss')) return 'Staff Solution';
  if (t.includes('construction') || t.includes('sc')) return 'Staff Construction';
  if (t.includes('m&e') || t.includes('me ')) return 'M&E';

  return '';
}

function _extractMonthYear(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('/');
  if (parts.length >= 2) return `${parts[1]}/${parts[2] || parts[1]}`;
  return '';
}

function _findMatchingAdvance(dienGiai, team, amount) {
  const sh = getSheet(SHEET.ADVANCE_REQUEST);
  const lastRow = sh.getLastRow();
  if (lastRow <= 2) return null;

  const data = sh.getRange(3, 1, lastRow-2, 16).getValues();
  const match = data.find(r =>
    r[3] === team &&
    Math.abs(Number(r[6]) - amount) < 1000  // Sai số < 1000
  );
  return match ? match[0] : null;
}

/**
 * Cập nhật CHUNG_TU sau khi TCT phản hồi
 */
function _updateSettlementFromTct(teamName, thang, desc, approveAmt, note) {
  if (!teamName || !thang) return;

  const sh = getSheet(SHEET.SETTLEMENT);
  const lastRow = sh.getLastRow();
  if (lastRow <= 2) return;

  const data = sh.getRange(3, 1, lastRow-2, 19).getValues();
  data.forEach((r, i) => {
    if (r[3] === teamName && r[2] === thang && r[13] === 'Đã gửi TCT') {
      // Match theo mô tả (fuzzy)
      const descMatch = _fuzzyMatch(String(r[6]), desc);
      if (descMatch > 0.6) {
        const row = i + 3;
        sh.getRange(row, 11).setValue(approveAmt);
        sh.getRange(row, 13).setValue(note);
        sh.getRange(row, 14).setValue(approveAmt > 0 ? 'TCT đã phản hồi' : 'Từ chối');
        if (approveAmt === Number(r[7])) {
          sh.getRange(row, 14).setValue('Đã clear');
          sh.getRange(row, 1, 1, 19).setBackground(CLR.CLEARED);
        }
      }
    }
  });
}

/**
 * So khớp chuỗi đơn giản (tỉ lệ từ chung)
 */
function _fuzzyMatch(s1, s2) {
  if (!s1 || !s2) return 0;
  const w1 = s1.toLowerCase().split(/\s+/);
  const w2 = s2.toLowerCase().split(/\s+/);
  const common = w1.filter(w => w2.includes(w)).length;
  return common / Math.max(w1.length, w2.length);
}
