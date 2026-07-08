// ============================================================
// SYSTEM: Auto Copy & Delete Processor
// ============================================================
// Chức năng: 
//   - Đọc bảng cấu hình động tại Spreadsheet trung tâm
//   - Tự động chạy Copy-Paste 123 & Xóa hàng theo điều kiện
//   - Lịch chạy: 22:00 hàng ngày ( Myanmar Time )
// ============================================================

const CONFIG_SS_ID = "19RBlwehMC6BLoueaTEzsJHMx4puB0CTE5i5x79-uI6c";
const CONFIG_TAB_NAME = "Auto_Copy_Config";

// Bộ nhớ đệm (Cache) để tránh mở một file nhiều lần, giúp script chạy nhanh gấp 5-10 lần
const ssCache_ = {};
function getSpreadsheetCached_(id) {
  if (!id) return null;
  if (!ssCache_[id]) {
    ssCache_[id] = SpreadsheetApp.openById(id);
  }
  return ssCache_[id];
}

/**
 * Tạo tab cấu hình mẫu nếu chưa tồn tại
 * Chạy thủ công 1 lần để khởi tạo bảng cấu hình
 */
function initConfigTab() {
  try {
    const ss = getSpreadsheetCached_(CONFIG_SS_ID);
    let sheet = ss.getSheetByName(CONFIG_TAB_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG_TAB_NAME);
      const headers = [
        "Link dữ liệu nguồn (A)",
        "Tên sheet cần copy (B) [Ví dụ: Sheet1!A:AA]",
        "Cột điều kiện (C) [Ví dụ: A]",
        "Tên tìm kiếm điều kiện (D) [Ví dụ: New]",
        "Link cần dán (E)",
        "Sheet cần dán (F) [Ví dụ: Sheet2!A:H]",
        "Link cần xóa (G)",
        "Cột điều kiện xóa (H) [Ví dụ: Sheet2!A]",
        "Tên tìm kiếm điều kiện để xóa (I) [Ví dụ: Site OK]"
      ];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, 9).setFontWeight("bold")
           .setBackground("#D9E1F2").setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
      
      // Định dạng độ rộng cột
      for (let i = 1; i <= 9; i++) {
        sheet.setColumnWidth(i, 200);
      }
      SpreadsheetApp.flush();
      Logger.log("✅ Đã tạo tab cấu hình '" + CONFIG_TAB_NAME + "' thành công.");
    } else {
      Logger.log("ℹ️ Tab cấu hình '" + CONFIG_TAB_NAME + "' đã tồn tại.");
    }
  } catch (e) {
    Logger.log("❌ Lỗi khi khởi tạo tab cấu hình: " + e.message);
  }
}

/**
 * Hàm xử lý chính: Quét cấu hình và thực thi Copy-Paste + Xóa dòng
 */
function runAutoCopyProcessor() {
  Logger.log("🚀 Bắt đầu tiến trình Auto Copy & Delete...");
  let ssConfig;
  try {
    ssConfig = getSpreadsheetCached_(CONFIG_SS_ID);
  } catch (e) {
    Logger.log("❌ Không thể mở Spreadsheet cấu hình với ID: " + CONFIG_SS_ID + ". Lỗi: " + e.message);
    return;
  }

  const sheetConfig = ssConfig.getSheetByName(CONFIG_TAB_NAME);
  if (!sheetConfig) {
    Logger.log("❌ Không tìm thấy tab cấu hình: " + CONFIG_TAB_NAME + ". Hãy chạy initConfigTab() trước.");
    return;
  }

  const lastRow = sheetConfig.getLastRow();
  if (lastRow < 2) {
    Logger.log("ℹ️ Bảng cấu hình trống (không có dòng dữ liệu nào).");
    return;
  }

  const configRows = sheetConfig.getRange(2, 1, lastRow - 1, 10).getValues();
  Logger.log("Found " + configRows.length + " dòng cấu hình cần xử lý.");

  for (let i = 0; i < configRows.length; i++) {
    const rowIdx = i + 2;
    const row = configRows[i];
    
    const sourceLink    = String(row[0] || "").trim();
    const sourceSheet   = String(row[1] || "").trim();
    const sourceColCond = String(row[2] || "").trim();
    const sourceValCond = String(row[3] || "").trim();
    const targetLink    = String(row[4] || "").trim();
    const targetSheet   = String(row[5] || "").trim();
    const deleteLink    = String(row[6] || "").trim();
    const deleteColCond = String(row[7] || "").trim();
    const deleteValCond = String(row[8] || "").trim();
    const sortConfig    = String(row[9] || "").trim();

    Logger.log("--------------------------------------------------");
    Logger.log("Dòng cấu hình #" + rowIdx + ":");

    // ========================================================
    // PHẦN 1: COPY - PASTE 123 (Nếu có đủ cấu hình)
    // ========================================================
    if (sourceLink && sourceSheet && sourceColCond && sourceValCond && targetSheet) {
      try {
        const srcSSId = extractSsId_(sourceLink);
        const srcSS = getSpreadsheetCached_(srcSSId);
        const srcInfo = parseSheetAndRange_(sourceSheet);
        const srcSh = srcSS.getSheetByName(srcInfo.sheetName);

        if (!srcSh) {
          Logger.log("  ❌ Lỗi: Không tìm thấy sheet nguồn: '" + srcInfo.sheetName + "'");
        } else {
          const tgtSSId = targetLink ? extractSsId_(targetLink) : srcSSId;
          const tgtSS = getSpreadsheetCached_(tgtSSId);
          const tgtInfo = parseSheetAndRange_(targetSheet);
          const tgtSh = tgtSS.getSheetByName(tgtInfo.sheetName);


          if (!tgtSh) {
            Logger.log("  ❌ Lỗi: Không tìm thấy sheet đích: '" + tgtInfo.sheetName + "'");
          } else {
            const srcLastRow = srcSh.getLastRow();
            if (srcLastRow >= 1) {
              let condColNum = colLetterToNum_(sourceColCond);
              // Đảm bảo cột điều kiện nằm trong giới hạn của sheet nguồn
              condColNum = Math.min(condColNum, srcSh.getMaxColumns());
              
              const condData = srcSh.getRange(1, condColNum, srcLastRow, 1).getValues();
              
              // Xác định khoảng cột cần copy
              let startCol = 1;
              let endCol = 27; // mặc định A:AA
              if (srcInfo.rangeStr) {
                const rangeCols = parseRangeCols_(srcInfo.rangeStr);
                startCol = rangeCols.start;
                endCol = rangeCols.end;
              }
              // Đảm bảo cột copy nằm trong giới hạn của sheet nguồn
              const srcMaxCols = srcSh.getMaxColumns();
              startCol = Math.min(startCol, srcMaxCols);
              endCol = Math.min(endCol, srcMaxCols);
              const numCols = endCol - startCol + 1;

              // Xác định cột dán ở sheet đích
              let targetStartCol = 1;
              if (tgtInfo.rangeStr) {
                const targetCols = parseRangeCols_(tgtInfo.rangeStr);
                targetStartCol = targetCols.start;
              }

              // Đảm bảo sheet đích đủ cột để dán, nếu thiếu thì tự động chèn thêm cột
              const tgtMaxCols = tgtSh.getMaxColumns();
              const neededTgtCols = targetStartCol + numCols - 1;
              if (neededTgtCols > tgtMaxCols) {
                tgtSh.insertColumnsAfter(tgtMaxCols, neededTgtCols - tgtMaxCols);
                Logger.log("  ➕ Đã tự động chèn thêm " + (neededTgtCols - tgtMaxCols) + " cột cho sheet đích.");
              }

              let copiedCount = 0;
              for (let r = 0; r < condData.length; r++) {
                if (String(condData[r][0]).trim() === sourceValCond) {
                  const srcRowNum = r + 1;
                  const rowValues = srcSh.getRange(srcRowNum, startCol, 1, numCols).getValues();
                  
                  // Tìm dòng trống tiếp theo dựa theo cột dán đích
                  const tgtNextRow = findNextEmptyRowInCol_(tgtSh, targetStartCol);
                  
                  // Ghi dữ liệu dạng Paste 123 (values only)
                  tgtSh.getRange(tgtNextRow, targetStartCol, 1, numCols).setValues(rowValues);
                  copiedCount++;
                  Logger.log("  ✅ Đã copy dòng " + srcRowNum + " sang sheet đích dòng " + tgtNextRow);
                }
              }
              Logger.log("  📊 Hoàn thành copy: " + copiedCount + " dòng.");
              
              // Tự động sắp xếp (Sort A:Z) sheet đích sau khi hoàn thành nếu được cấu hình
              if (sortConfig) {
                sortSheetByConfig_(tgtSS, sortConfig);
              }
            }
          }
        }
      } catch (err) {
        Logger.log("  ❌ Lỗi xử lý Copy-Paste dòng #" + rowIdx + ": " + err.message);
      }
    }

    // ========================================================
    // PHẦN 2: XÓA HÀNG ĐỘC LẬP (Nếu có đủ cấu hình)
    // ========================================================
    if (deleteLink && deleteColCond && deleteValCond) {
      try {
        const delSSId = extractSsId_(deleteLink);
        const delSS = getSpreadsheetCached_(delSSId);
        const delInfo = parseSheetAndRange_(deleteColCond);
        const delSh = delSS.getSheetByName(delInfo.sheetName);

        if (!delSh) {
          Logger.log("  ❌ Lỗi: Không tìm thấy sheet xóa: '" + delInfo.sheetName + "'");
        } else {
          const delColLetter = delInfo.rangeStr || "A";
          const delColNum = colLetterToNum_(delColLetter);
          const delLastRow = delSh.getLastRow();

          if (delLastRow >= 1) {
            const delData = delSh.getRange(1, delColNum, delLastRow, 1).getValues();
            let deletedCount = 0;
            
            // Quét từ dưới lên để tránh lệch index dòng khi xóa
            for (let r = delLastRow - 1; r >= 0; r--) {
              if (String(delData[r][0]).trim() === deleteValCond) {
                delSh.deleteRow(r + 1);
                deletedCount++;
              }
            }
            Logger.log("  🗑️ Hoàn thành xóa: Đã xóa " + deletedCount + " dòng có '" + deleteValCond + "' ở cột " + delColLetter);
          }
        }
      } catch (err) {
        Logger.log("  ❌ Lỗi xử lý Xóa dòng #" + rowIdx + ": " + err.message);
      }
    }
  }
  Logger.log("🏁 Hoàn thành toàn bộ tiến trình Auto Copy & Delete.");
}

/**
 * Thiết lập lịch chạy tự động vào lúc 22:00 hàng ngày (giờ Myanmar)
 */
function setupAutoCopyTrigger() {
  // Xóa các trigger cũ cùng tên để tránh trùng lặp
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === "runAutoCopyProcessor") {
      ScriptApp.deleteTrigger(t);
    }
  }

  // Tạo trigger mới chạy hàng ngày từ 22:00 đến 23:00
  // Note: Google Apps Script chỉ cho phép thiết lập trigger theo khoảng 1 giờ
  ScriptApp.newTrigger("runAutoCopyProcessor")
           .timeBased()
           .everyDays(1)
           .atHour(22)
           .inTimezone("Asia/Rangoon") // Đặt múi giờ Myanmar
           .create();
  
  Logger.log("⏰ Đã thiết lập trigger chạy tự động lúc 22:00 hàng ngày (giờ Myanmar).");
}


// ============================================================
// HELPERS
// ============================================================

function extractSsId_(link) {
  if (!link) return "";
  const match = link.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : link;
}

function parseSheetAndRange_(sheetStr) {
  if (!sheetStr) return { sheetName: "", rangeStr: "" };
  const idx = sheetStr.indexOf("!");
  if (idx === -1) return { sheetName: sheetStr, rangeStr: "" };
  return {
    sheetName: sheetStr.substring(0, idx).replace(/'/g, ""),
    rangeStr: sheetStr.substring(idx + 1)
  };
}

function colLetterToNum_(letter) {
  if (!letter) return 1;
  letter = String(letter).trim();
  // Nếu chứa dấu chấm than ! (VD: "Sheet1!A:A"), chỉ lấy phần range sau !
  if (letter.indexOf("!") !== -1) {
    letter = letter.split("!")[1].trim();
  }
  // Nếu chứa dấu hai chấm (VD: "A:A" hoặc "A:AA"), chỉ lấy phần cột đầu tiên
  if (letter.indexOf(":") !== -1) {
    letter = letter.split(":")[0].trim();
  }
  // Nếu là số hoặc chuỗi số (VD: 1 hoặc "1")
  if (!isNaN(letter) && letter !== "") {
    return parseInt(letter, 10);
  }
  letter = letter.toUpperCase().replace(/[^A-Z]/g, "");
  let column = 0;
  for (let i = 0; i < letter.length; i++) {
    column = column * 26 + (letter.charCodeAt(i) - 64);
  }
  return column || 1;
}

function parseRangeCols_(rangeStr) {
  if (!rangeStr) return { start: 1, end: 27 };
  const parts = rangeStr.split(":");
  const start = colLetterToNum_(parts[0]);
  const end = parts.length > 1 ? colLetterToNum_(parts[1]) : start;
  return { start: start, end: end };
}

function findNextEmptyRowInCol_(sheet, columnIdx) {
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) return 1;
  const values = sheet.getRange(1, columnIdx, lastRow, 1).getValues();
  for (let i = lastRow - 1; i >= 0; i--) {
    const val = values[i][0];
    if (val !== "" && val !== null && val !== undefined) {
      return i + 2;
    }
  }
  return 1;
}

/**
 * Hàm tự động sắp xếp sheet từ A:Z dựa theo cột chỉ định trong config
 * VD: sortConfig = "2.1 Your Data solution!D" -> Sắp xếp cột D của tab "2.1 Your Data solution"
 */
function sortSheetByConfig_(ss, sortConfig) {
  if (!ss || !sortConfig) return;
  try {
    const info = parseSheetAndRange_(sortConfig);
    const sheet = ss.getSheetByName(info.sheetName);
    if (!sheet) {
      Logger.log("  ❌ Lỗi sort: Không tìm thấy sheet '" + info.sheetName + "'");
      return;
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const frozenRows = sheet.getFrozenRows();
    const defaultStartRow = frozenRows > 0 ? frozenRows + 1 : 2; // Bỏ qua tiêu đề header

    // Phân tách cấu hình sort thông minh để lấy cột và dòng bắt đầu
    const sortInfo = parseSortConfigRange_(info.rangeStr, defaultStartRow);
    const startRow = sortInfo.startRow;
    const colLetter = sortInfo.colLetter;
    const colIdx = colLetterToNum_(colLetter);

    // Tìm dòng thực sự cuối cùng có chứa dữ liệu ở cột sort để tránh sort các dòng trống lên đầu
    let actualLastRow = startRow;
    const colValues = sheet.getRange(1, colIdx, lastRow, 1).getValues();
    for (let r = lastRow - 1; r >= 0; r--) {
      const val = String(colValues[r][0]).trim();
      if (val !== "" && val !== "null" && val !== "undefined" && val !== "-") {
        actualLastRow = r + 1;
        break;
      }
    }

    // Nếu không tìm thấy ở cột sort, quét dự phòng ở cột 1 (thường là cột ID/No luôn có dữ liệu)
    if (actualLastRow === startRow && colIdx !== 1) {
      const col1Values = sheet.getRange(1, 1, lastRow, 1).getValues();
      for (let r = lastRow - 1; r >= 0; r--) {
        const val = String(col1Values[r][0]).trim();
        if (val !== "" && val !== "null" && val !== "undefined" && val !== "-") {
          actualLastRow = r + 1;
          break;
        }
      }
    }

    if (actualLastRow <= startRow) {
      Logger.log("  ℹ️ Sheet '" + info.sheetName + "' không có dữ liệu thực tế nào để sắp xếp.");
      return;
    }

    // Lấy vùng dữ liệu thực tế cần sắp xếp (loại trừ các dòng hoàn toàn trống ở dưới)
    const range = sheet.getRange(startRow, 1, actualLastRow - startRow + 1, lastCol);
    const data = range.getValues();
    const backgrounds = range.getBackgrounds();
    const fontWeights = range.getFontWeights();

    // Gộp dữ liệu và định dạng để sắp xếp đi kèm với nhau
    const rows = [];
    for (let r = 0; r < data.length; r++) {
      rows.push({
        values: data[r],
        bg: backgrounds[r],
        fw: fontWeights[r]
      });
    }

    // Sắp xếp mảng trong JS để đẩy ô rỗng hoặc chứa "-" xuống cuối cùng của bảng
    rows.sort(function(a, b) {
      const valA = a.values[colIdx - 1];
      const valB = b.values[colIdx - 1];

      // Đánh giá xem ô có trống không (ô rỗng, null, undefined hoặc chứa dấu gạch ngang "-")
      const isAEmpty = (valA === "" || valA === null || valA === undefined || String(valA).trim() === "-");
      const isBEmpty = (valB === "" || valB === null || valB === undefined || String(valB).trim() === "-");

      if (isAEmpty && isBEmpty) return 0;
      if (isAEmpty) return 1;  // Đẩy dòng A trống xuống dưới cùng
      if (isBEmpty) return -1; // Đẩy dòng B trống xuống dưới cùng

      // So sánh dữ liệu dạng ngày tháng hoặc chuỗi/số
      if (valA < valB) return -1;
      if (valA > valB) return 1;
      return 0;
    });

    // Tách mảng đã sắp xếp ra để ghi đè lại sheet
    const sortedValues = rows.map(r => r.values);
    const sortedBackgrounds = rows.map(r => r.bg);
    const sortedFontWeights = rows.map(r => r.fw);

    range.setValues(sortedValues);
    range.setBackgrounds(sortedBackgrounds);
    range.setFontWeights(sortedFontWeights);

    Logger.log("  📶 Đã tự động sắp xếp (Sort A:Z) sheet '" + info.sheetName + "' theo cột " + colLetter + " (Từ dòng " + startRow + " đến dòng " + actualLastRow + " - đã đẩy ô trống & '-' xuống cuối)");
  } catch (err) {
    Logger.log("  ❌ Lỗi khi tự động sắp xếp sheet: " + err.message);
  }
}

/**
 * Phân tách thông minh chuỗi cấu hình sort (VD: "G4:G" hoặc "G4" hoặc "G")
 * Trả về ký tự cột và dòng bắt đầu sort
 */
function parseSortConfigRange_(rangeStr, defaultStartRow) {
  if (!rangeStr) return { colLetter: "A", startRow: defaultStartRow };
  
  let colLetter = "A";
  let startRow = defaultStartRow;
  
  // Lấy phần trước dấu hai chấm nếu có (VD: "G4:G" -> "G4")
  let firstPart = rangeStr.indexOf(":") !== -1 ? rangeStr.split(":")[0] : rangeStr;
  firstPart = firstPart.trim();
  
  // Trích xuất số dòng bắt đầu (VD: "G4" -> 4)
  const rowMatch = firstPart.match(/\d+/);
  if (rowMatch) {
    startRow = parseInt(rowMatch[0], 10);
  }
  
  // Trích xuất chữ cái cột (VD: "G4" -> "G")
  const colMatch = firstPart.match(/[a-zA-Z]+/);
  if (colMatch) {
    colLetter = colMatch[0];
  }
  
  return { colLetter: colLetter, startRow: startRow };
}

