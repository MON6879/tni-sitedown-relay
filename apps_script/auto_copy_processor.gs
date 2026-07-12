// ============================================================
// SYSTEM: Auto Copy & Delete Processor
// ============================================================
// Chức năng: 
//   - Đọc bảng cấu hình động tại Spreadsheet trung tâm
//   - Tự động chạy Copy-Paste 123 & Xóa hàng theo điều kiện
//   - Lịch chạy: Chạy tự động mỗi 15 phút (trong khung giờ làm việc)
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
 * HÀM CHẠY THỬ NGHIỆM THỦ CÔNG (Bỏ qua cổng thời gian)
 * Anh có thể chọn và chạy hàm này từ Apps Script Editor bất kỳ lúc nào để test hệ thống copy.
 */
function runAutoCopyProcessorManual() {
  Logger.log("🧪 Đang bắt đầu chạy thử nghiệm thủ công (Bỏ qua giới hạn khung giờ)...");
  runAutoCopyProcessor(true);
}

/**
 * Hàm hỗ trợ reset nhanh trạng thái copy của Team 3 để kiểm tra copy lại
 */
function runResetTeam3CopiedNotes() {
  resetCopiedNotes("1Z2E4gSGXpYbjexfZJGNDglACYB9Zn46VXuiO2GGSGqQ", "3. see to Task", "A");
}

/**
 * Hàm tự động reset Note trên tất cả các sheet nguồn có trong bảng cấu hình
 */
function runResetAllCopiedNotes() {
  Logger.log("🔄 Bắt đầu reset ghi chú (Note) trên tất cả các sheet nguồn...");
  try {
    const configSS = getSpreadsheetCached_(CONFIG_SS_ID);
    const sheetConfig = configSS.getSheetByName(CONFIG_TAB_NAME);
    const lastRow = sheetConfig.getLastRow();
    if (lastRow < 2) {
      Logger.log("ℹ️ Bảng cấu hình trống.");
      return;
    }
    const configRows = sheetConfig.getRange(2, 1, lastRow - 1, 4).getValues();
    for (let i = 0; i < configRows.length; i++) {
      const sourceLink = String(configRows[i][0] || "").trim();
      const sourceSheet = String(configRows[i][1] || "").trim();
      const sourceColCond = String(configRows[i][2] || "").trim();
      if (sourceLink && sourceSheet && sourceColCond) {
        try {
          const srcSSId = extractSsId_(sourceLink);
          const srcInfo = parseSheetAndRange_(sourceSheet);
          const condRangeInfo = parseColAndStartRow_(sourceColCond);
          resetCopiedNotes(srcSSId, srcInfo.sheetName, condRangeInfo.colLetter);
        } catch (e) {
          Logger.log("  ⚠️ Bỏ qua dòng cấu hình #" + (i+2) + ": " + e.message);
        }
      }
    }
    Logger.log("✅ Đã hoàn thành reset tất cả ghi chú nguồn.");
  } catch (err) {
    Logger.log("❌ Lỗi khi chạy Reset All: " + err.message);
  }
}

/**
 * Hàm kiểm tra nhanh nội dung các ô A3, A4 để phân tích lỗi công thức
 */
function runDebugTeam3Cells() {
  try {
    const ss = SpreadsheetApp.openById("1Z2E4gSGXpYbjexfZJGNDglACYB9Zn46VXuiO2GGSGqQ");
    const sh = ss.getSheetByName("3.1 Update Assign");
    if (!sh) {
      Logger.log("❌ Không tìm thấy sheet '3.1 Update Assign'");
      return;
    }
    Logger.log("🔍 [Debug Team 3]");
    Logger.log("A3 Value: " + sh.getRange("A3").getValue());
    Logger.log("A3 Formula: " + sh.getRange("A3").getFormula());
    Logger.log("A4 Value: " + sh.getRange("A4").getValue());
    Logger.log("A4 Formula: " + sh.getRange("A4").getFormula());
    Logger.log("G4 Value: " + sh.getRange("G4").getValue());
  } catch (e) {
    Logger.log("❌ Lỗi debug: " + e.message);
  }
}

/**
 * Hàm xử lý chính: Quét cấu hình và thực thi Copy-Paste + Xóa dòng
 * @param {boolean} bypassTimeGate - Nếu là true, bỏ qua kiểm tra khung giờ làm việc
 */
function runAutoCopyProcessor(bypassTimeGate) {
  if (bypassTimeGate !== true && !isWithinCopyActiveWindows_()) {
    Logger.log("😴 Ngoài khung giờ hoạt động Copy (08:00-12:00 & 14:00-22:00 Myanmar) — Dừng tiến trình.");
    return;
  }
  Logger.log("🚀 Bắt đầu tiến trình Auto Copy & Delete...");
  const errorRows = []; // Thu thập các dòng lỗi để tổng hợp báo cáo
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

  // Đọc dữ liệu từ cột A đến J (cột 1 đến 10)
  const configRows = sheetConfig.getRange(2, 1, lastRow - 1, 10).getValues();
  Logger.log("Tìm thấy " + configRows.length + " dòng cấu hình cần xử lý.");

  for (let i = 0; i < configRows.length; i++) {
    const rowIdx = i + 2;
    const row = configRows[i];
    
    // .getValues() đã tự động đọc giá trị cuối cùng được tính toán bởi công thức Excel/Sheets
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
    // PHẦN 1: XÓA HÀNG Ở SHEET KHÁC (theo cấu hình cột G, H, I)
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
          const delRangeInfo = parseColAndStartRow_(delColLetter);
          const delColNum = colLetterToNum_(delRangeInfo.colLetter);
          const delStartRow = delRangeInfo.startRow;
          const delLastRow = delSh.getLastRow();

          if (delLastRow >= delStartRow) {
            const numRowsToRead = delLastRow - delStartRow + 1;
            const delData = delSh.getRange(delStartRow, delColNum, numRowsToRead, 1).getValues();
            let deletedCount = 0;
            // Duyệt từ dưới lên để xóa toàn bộ hàng (giúp tránh lệch chỉ số dòng khi xóa)
            // Lệnh deleteRow() xóa cả hàng trực tiếp nên miễn nhiễm hoàn toàn với quy tắc Validation,
            // đồng thời bảo toàn công thức ARRAYFORMULA ở dòng tiêu đề (do chỉ xóa dòng >= delStartRow)
            for (let r = numRowsToRead - 1; r >= 0; r--) {
              if (String(delData[r][0]).trim() === deleteValCond) {
                const rowNum = r + delStartRow;
                try {
                  delSh.deleteRow(rowNum);
                  deletedCount++;
                } catch (delErr) {
                  Logger.log("  ⚠️ Lỗi khi xóa dòng " + rowNum + ": " + delErr.message);
                }
              }
            }
            Logger.log("  🗑️ Đã xóa thành công: " + deletedCount + " dòng có '" + deleteValCond + "' tại '" + delInfo.sheetName + "' cột " + delColLetter);
          }
        }
      } catch (err) {
        Logger.log("  ❌ Lỗi xử lý Xóa dòng #" + rowIdx + ": " + err.message);
      }
    }

    // ========================================================
    // PHẦN 2: COPY - PASTE 123 (Nếu có đủ cấu hình)
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
            
            // Lấy dòng bắt đầu quét điều kiện của cột điều kiện và dải ô nguồn
            const condRangeInfo = parseColAndStartRow_(sourceColCond);
            let condColNum = colLetterToNum_(condRangeInfo.colLetter);
            // Đảm bảo cột điều kiện nằm trong giới hạn của sheet nguồn
            condColNum = Math.min(condColNum, srcSh.getMaxColumns());
            
            // Xác định dòng bắt đầu thực tế (lấy max giữa dòng khai báo ở Sheet nguồn và cột điều kiện)
            let srcStartRow = 1;
            if (srcInfo.rangeStr) {
              const srcRangeInfo = parseColAndStartRow_(srcInfo.rangeStr);
              srcStartRow = srcRangeInfo.startRow;
            }
            const finalStartRow = Math.max(srcStartRow, condRangeInfo.startRow);

            if (srcLastRow >= finalStartRow) {
              const numCondRows = srcLastRow - finalStartRow + 1;
              const condData = srcSh.getRange(finalStartRow, condColNum, numCondRows, 1).getValues();
              
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

              // Xác định cột dán ở sheet đích và dòng dán bắt đầu
              let targetStartCol = 1;
              let targetStartRow = 1;
              if (tgtInfo.rangeStr) {
                const tgtRangeInfo = parseColAndStartRow_(tgtInfo.rangeStr);
                targetStartCol = colLetterToNum_(tgtRangeInfo.colLetter);
                targetStartRow = tgtRangeInfo.startRow;
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
                  const srcRowNum = r + finalStartRow;
                  
                  // Kiểm tra xem dòng này đã được copy trước đó chưa (qua Cell Note)
                  const condCell = srcSh.getRange(srcRowNum, condColNum);
                  const existingNote = condCell.getNote() || "";
                  if (existingNote.indexOf("✅ Auto-Copied:") !== -1) {
                    continue; // Đã copy trước đó — bỏ qua
                  }
                  
                  let rowValues;
                  let hasCircularError = false;
                  
                  // Đọc giá trị dòng nguồn — bắt lỗi vòng lặp (Circular Reference)
                  try {
                    rowValues = srcSh.getRange(srcRowNum, startCol, 1, numCols).getValues();
                    // Nếu ô nào chứa lỗi Error (VD: #REF!, #CIRC!), đánh dấu đỏ và ghi log
                    const flatVals = rowValues[0];
                    for (let v = 0; v < flatVals.length; v++) {
                      const vStr = String(flatVals[v]);
                      if (vStr.indexOf("#REF") !== -1 || vStr.indexOf("#CIRC") !== -1 || vStr.indexOf("Error") !== -1) {
                        hasCircularError = true;
                        break;
                      }
                    }
                  } catch (readErr) {
                    hasCircularError = true;
                    rowValues = null;
                    Logger.log("  ⚠️ Lỗi đọc dữ liệu dòng " + srcRowNum + " (có thể do Circular Reference): " + readErr.message);
                  }
                  
                  if (hasCircularError) {
                    // Bôi đỏ toàn bộ dòng lỗi trong sheet nguồn
                    srcSh.getRange(srcRowNum, 1, 1, srcSh.getLastColumn()).setBackground("#FF5252");
                    const errMsg = "⚠️ Lỗi vòng lặp/công thức tại sheet '" + srcInfo.sheetName + "' dòng " + srcRowNum + " (Cấu hình dòng #" + rowIdx + ")";
                    errorRows.push(errMsg);
                    Logger.log("  ❌ " + errMsg);
                    continue;
                  }
                  
                  // Tìm dòng trống tiếp theo dựa theo cột dán đích
                  const tgtNextRow = findNextEmptyRowInCol_(tgtSh, targetStartCol, targetStartRow);
                  
                  // Ghi dữ liệu dạng Paste 123 (values only — giữ nguyên công thức nguồn)
                  tgtSh.getRange(tgtNextRow, targetStartCol, 1, numCols).setValues(rowValues);
                  copiedCount++;
                  Logger.log("  ✅ Đã copy dòng " + srcRowNum + " sang sheet đích dòng " + tgtNextRow);
                  
                  // Đánh dấu dòng đã xử lý bằng Cell Note (KHÔNG ghi đè công thức)
                  const noteText = "✅ Auto-Copied: " + Utilities.formatDate(new Date(), "Asia/Rangoon", "dd/MM/yyyy HH:mm") + " Myanmar";
                  condCell.setNote(noteText);
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

  } // end for configRows

  Logger.log("🏁 Hoàn thành toàn bộ tiến trình Auto Copy & Delete.");

  // Gửi báo cáo tổng hợp lỗi nếu có
  if (errorRows.length > 0) {
    const summaryMsg = "⚠️ AUTO COPY BÁO CÁO LỖI\n" +
      "━━━━━━━━━━━━━━━━━━━━\n" +
      errorRows.join("\n") +
      "\n━━━━━━━━━━━━━━━━━━━━\n" +
      "🔧 Các dòng trên đã được bôi đỏ trong sheet nguồn. Vui lòng kiểm tra và chỉnh sửa.";
    Logger.log("📨 Tổng hợp lỗi:\n" + summaryMsg);
    // Ghi lỗi vào Script Properties để có thể truy xuất sau
    const props = PropertiesService.getScriptProperties();
    props.setProperty("LAST_COPY_ERRORS", summaryMsg);
    props.setProperty("LAST_COPY_ERROR_TIME", new Date().toISOString());
  }
}

/**
 * Thiết lập lịch chạy tự động mỗi 15 phút (chỉ chạy trong khung giờ làm việc)
 */
function setupAutoCopyEvery15MinutesTrigger() {
  // Xóa các trigger cũ cùng tên để tránh trùng lặp
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === "runAutoCopyProcessor") {
      ScriptApp.deleteTrigger(t);
    }
  }

  // Tạo trigger mới chạy mỗi 15 phút
  ScriptApp.newTrigger("runAutoCopyProcessor")
           .timeBased()
           .everyMinutes(15)
           .create();
  
  Logger.log("⏰ Đã thiết lập trigger chạy tự động mỗi 15 phút cho tác vụ Copy.");
}

/**
 * Xem báo cáo lỗi lần chạy Auto Copy cuối cùng
 * Chạy thủ công từ Apps Script Editor để xem có lỗi gì không
 */
function getLastCopyErrors() {
  const props = PropertiesService.getScriptProperties();
  const errors = props.getProperty("LAST_COPY_ERRORS");
  const errorTime = props.getProperty("LAST_COPY_ERROR_TIME");
  if (errors) {
    Logger.log("🕐 Thời điểm lỗi: " + (errorTime || "N/A"));
    Logger.log(errors);
  } else {
    Logger.log("✅ Không có lỗi nào từ lần chạy cuối cùng.");
  }
}

/**
 * Reset toàn bộ Cell Note "✅ Auto-Copied" trên sheet nguồn để cho phép copy lại
 * Hữu ích khi bạn muốn chạy lại toàn bộ từ đầu
 */
function resetCopiedNotes(sheetId, sheetName, condColLetter) {
  try {
    const ss = SpreadsheetApp.openById(sheetId || CONFIG_SS_ID);
    const sh = ss.getSheetByName(sheetName);
    if (!sh) { Logger.log("❌ Không tìm thấy sheet: " + sheetName); return; }
    const colNum = colLetterToNum_(condColLetter || "A");
    const lastRow = sh.getLastRow();
    if (lastRow < 1) return;
    for (let r = 1; r <= lastRow; r++) {
      const cell = sh.getRange(r, colNum);
      const note = cell.getNote() || "";
      if (note.indexOf("✅ Auto-Copied:") !== -1) {
        cell.clearNote();
      }
    }
    Logger.log("✅ Đã xóa toàn bộ Auto-Copied Note trên sheet '" + sheetName + "' cột " + condColLetter);
  } catch (e) {
    Logger.log("❌ Lỗi reset notes: " + e.message);
  }
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
  sheetStr = String(sheetStr).trim();
  const idx = sheetStr.indexOf("!");
  if (idx === -1) return { sheetName: sheetStr.replace(/['"]/g, "").trim(), rangeStr: "" };
  return {
    sheetName: sheetStr.substring(0, idx).replace(/['"]/g, "").trim(),
    rangeStr: sheetStr.substring(idx + 1).trim()
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
  if (parts.length < 2) return { start: 1, end: 27 };
  return {
    start: colLetterToNum_(parts[0]),
    end: colLetterToNum_(parts[1])
  };
}

function findNextEmptyRowInCol_(sheet, columnIdx, startRow) {
  startRow = startRow || 1;
  const lastRow = sheet.getLastRow();
  if (lastRow < startRow) return startRow;
  const numRowsToRead = lastRow - startRow + 1;
  const values = sheet.getRange(startRow, columnIdx, numRowsToRead, 1).getValues();
  for (let i = numRowsToRead - 1; i >= 0; i--) {
    const val = values[i][0];
    if (val !== "" && val !== null && val !== undefined) {
      return i + startRow + 1;
    }
  }
  return startRow;
}

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
    const defaultStartRow = frozenRows > 0 ? frozenRows + 1 : 2;

    const sortInfo = parseSortConfigRange_(info.rangeStr, defaultStartRow);
    const startRow = sortInfo.startRow;
    const colLetter = sortInfo.colLetter;
    const colIdx = colLetterToNum_(colLetter);

    let actualLastRow = startRow;
    const colValues = sheet.getRange(1, colIdx, lastRow, 1).getValues();
    for (let r = lastRow - 1; r >= 0; r--) {
      const val = String(colValues[r][0]).trim();
      if (val !== "" && val !== "null" && val !== "undefined" && val !== "-") {
        actualLastRow = r + 1;
        break;
      }
    }

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

    const range = sheet.getRange(startRow, 1, actualLastRow - startRow + 1, lastCol);
    const data        = range.getValues();
    const formulas    = range.getFormulas();
    const backgrounds = range.getBackgrounds();
    const fontWeights = range.getFontWeights();

    const rows = [];
    for (let r = 0; r < data.length; r++) {
      rows.push({
        values:   data[r],
        formulas: formulas[r],
        bg:       backgrounds[r],
        fw:       fontWeights[r]
      });
    }

    rows.sort(function(a, b) {
      const valA = a.values[colIdx - 1];
      const valB = b.values[colIdx - 1];

      const isAEmpty = (valA === "" || valA === null || valA === undefined || String(valA).trim() === "-");
      const isBEmpty = (valB === "" || valB === null || valB === undefined || String(valB).trim() === "-");

      if (isAEmpty && isBEmpty) return 0;
      if (isAEmpty) return 1;
      if (isBEmpty) return -1;

      if (valA < valB) return -1;
      if (valA > valB) return 1;
      return 0;
    });

    const sortedValues     = rows.map(r => r.values);
    const sortedFormulas   = rows.map(r => r.formulas);
    const sortedBackgrounds = rows.map(r => r.bg);
    const sortedFontWeights = rows.map(r => r.fw);

    // Quét các dòng phía trên dòng startRow để xem cột nào chứa công thức mảng (ARRAYFORMULA ở dòng tiêu đề)
    const formulaCols = {};
    if (startRow > 1 && lastCol > 0) {
      try {
        const upperFormulas = sheet.getRange(1, 1, startRow - 1, lastCol).getFormulas();
        for (let c = 0; c < lastCol; c++) {
          for (let rUpper = 0; rUpper < upperFormulas.length; rUpper++) {
            if (upperFormulas[rUpper][c] !== "") {
              formulaCols[c] = true;
              break;
            }
          }
        }
      } catch (eFormula) {
        Logger.log("  ⚠️ Cảnh báo đọc công thức hàng trên khi sort: " + eFormula.message);
      }
    }

    // Ghi đè dữ liệu sau khi sort theo từng cột (bảo vệ cột có ARRAYFORMULA)
    const numRows = sortedValues.length;
    for (let c = 0; c < lastCol; c++) {
      const colRange = sheet.getRange(startRow, c + 1, numRows, 1);
      
      // Sắp xếp định dạng nền và font chữ (không ảnh hưởng đến công thức mảng)
      const colBackgrounds = sortedBackgrounds.map(row => [row[c]]);
      const colFontWeights = sortedFontWeights.map(row => [row[c]]);
      try {
        colRange.setBackgrounds(colBackgrounds);
        colRange.setFontWeights(colFontWeights);
      } catch (eFormat) {
        // Bỏ qua lỗi định dạng nếu có
      }

      if (formulaCols[c]) {
        // Cột này được kiểm soát bởi ARRAYFORMULA phía trên -> KHÔNG ghi đè giá trị hoặc công thức để tránh lỗi #REF!
        continue;
      }

      const colValues = sortedValues.map(row => [row[c]]);
      const colFormulas = sortedFormulas.map(row => [row[c]]);
      try {
        colRange.setValues(colValues);
      } catch (valErr) {
        // Nếu bị lỗi Validation ở cột này (ví dụ cột có Dropdown nghiêm ngặt), ta thử ghi từng ô
        for (let r = 0; r < numRows; r++) {
          const cell = sheet.getRange(startRow + r, c + 1);
          try {
            cell.setValue(colValues[r][0]);
          } catch (cellValErr) {
            try {
              cell.setValue("");
            } catch (cellValErr2) {
              // Bỏ qua ô bị Validation chặn không cho sửa
            }
          }
        }
      }

      try {
        colRange.setFormulas(colFormulas);
      } catch (formErr) {
        // Bỏ qua lỗi công thức nếu cột này không cho phép ghi đè
      }
    }

    Logger.log("  📶 Đã tự động sắp xếp (Sort A:Z) sheet '" + info.sheetName + "' theo cột " + colLetter + " (Từ dòng " + startRow + " đến dòng " + actualLastRow + ")");
  } catch (err) {
    Logger.log("  ❌ Lỗi khi tự động sắp xếp sheet: " + err.message);
  }
}

function parseSortConfigRange_(rangeStr, defaultStartRow) {
  if (!rangeStr) return { colLetter: "A", startRow: defaultStartRow };
  let colLetter = "A";
  let startRow = defaultStartRow;
  let firstPart = rangeStr.indexOf(":") !== -1 ? rangeStr.split(":")[0] : rangeStr;
  firstPart = firstPart.trim();
  const rowMatch = firstPart.match(/\d+/);
  if (rowMatch) {
    startRow = parseInt(rowMatch[0], 10);
  }
  const colMatch = firstPart.match(/[a-zA-Z]+/);
  if (colMatch) {
    colLetter = colMatch[0];
  }
  return { colLetter: colLetter, startRow: startRow };
}

function isWithinCopyActiveWindows_() {
  const now = new Date();
  const hour = parseInt(Utilities.formatDate(now, "Asia/Rangoon", "H"), 10);
  const minute = parseInt(Utilities.formatDate(now, "Asia/Rangoon", "m"), 10);
  
  // Khung 1: 08:00 - 12:00
  if (hour >= 8 && hour < 12) return true;
  if (hour === 12 && minute === 0) return true;
  
  // Khung 2: 14:00 - 22:00
  if (hour >= 14 && hour < 22) return true;
  if (hour === 22 && minute === 0) return true;
  
  return false;
}

function parseColAndStartRow_(rangeStr) {
  if (!rangeStr) return { colLetter: "A", startRow: 1 };
  
  let colLetter = "A";
  let startRow = 1;
  
  // Loại bỏ phần tên sheet phía trước dấu chấm than ! nếu có (VD: "3.1 Update Assign!A4:A" -> "A4:A")
  let rangeOnly = rangeStr;
  if (rangeStr.indexOf("!") !== -1) {
    rangeOnly = rangeStr.split("!")[1].trim();
  }
  
  // Lấy phần trước dấu hai chấm nếu có (VD: "A4:A" -> "A4")
  let firstPart = rangeOnly.indexOf(":") !== -1 ? rangeOnly.split(":")[0] : rangeOnly;
  firstPart = firstPart.trim();
  
  // Trích xuất số dòng bắt đầu (VD: "A4" -> 4)
  const rowMatch = firstPart.match(/\d+/);
  if (rowMatch) {
    startRow = parseInt(rowMatch[0], 10);
  }
  
  // Trích xuất chữ cái cột (VD: "A4" -> "A")
  const colMatch = firstPart.match(/[a-zA-Z]+/);
  if (colMatch) {
    colLetter = colMatch[0];
  }
  
  return { colLetter: colLetter, startRow: startRow };
}
