// ============================================================
// SYSTEM: Input ICT Shifting & Updating
// ============================================================
// Spreadsheet: https://docs.google.com/spreadsheets/d/1P4KGJzZhoCWqD9NpOffrD60dO2-QB1yPOg5v6zP7TH0/edit#gid=0
// Sheet GID:   0 (Input ICT)
// ============================================================

const ICT_SS_ID = "1P4KGJzZhoCWqD9NpOffrD60dO2-QB1yPOg5v6zP7TH0";
const ICT_TAB_NAME = "Input ICT";

/**
 * Thực hiện dịch chuyển tịnh tiến các cột dữ liệu lịch sử trước khi ghi dữ liệu mới:
 * 1. Copy Y:AU (cũ) dán giá trị vào AW:BS
 * 2. Copy A:W (cũ) dán giá trị vào Y:AU
 */
function shiftICTColumns() {
  try {
    const ss = SpreadsheetApp.openById(ICT_SS_ID);
    const sh = ss.getSheetByName(ICT_TAB_NAME) || ss.getSheets()[0];
    const lastRow = sh.getLastRow();
    
    if (lastRow < 1) {
      Logger.log("ℹ️ Sheet trống, không cần dịch chuyển tịnh tiến.");
      return;
    }
    
    Logger.log("🔄 Bắt đầu dịch chuyển tịnh tiến cột dữ liệu ICT...");
    
    // 1. Copy Y:AU (Cột 25-47, tổng cộng 23 cột) dán giá trị vào AW:BS (Cột 49-71, tổng cộng 23 cột)
    const rangeY_AU = sh.getRange(1, 25, lastRow, 23);
    const rangeAW_BS = sh.getRange(1, 49, lastRow, 23);
    rangeY_AU.copyTo(rangeAW_BS, SpreadsheetApp.CopyPasteType.PASTE_VALUES, false);
    Logger.log("✅ Đã tịnh tiến Y:AU sang AW:BS");
    
    // 2. Copy A:W (Cột 1-23, tổng cộng 23 cột) dán giá trị vào Y:AU (Cột 25-47, tổng cộng 23 cột)
    const rangeA_W = sh.getRange(1, 1, lastRow, 23);
    const rangeY_AU_new = sh.getRange(1, 25, lastRow, 23);
    rangeA_W.copyTo(rangeY_AU_new, SpreadsheetApp.CopyPasteType.PASTE_VALUES, false);
    Logger.log("✅ Đã tịnh tiến A:W sang Y:AU");
    
    SpreadsheetApp.flush();
  } catch (err) {
    Logger.log("❌ Lỗi tịnh tiến cột ICT: " + err.message);
    throw err;
  }
}

/**
 * Hàm trung gian để ghi dữ liệu mới (gọi từ tiến trình cào hệ thống của bạn):
 * Tự động dịch chuyển dữ liệu cũ sang phải trước, sau đó ghi đè dữ liệu mới vào A:V và ghi giờ vào W1.
 * 
 * @param {Array<Array>} newDataA_V - Mảng dữ liệu mới 2 chiều tương ứng cột A:V
 */
function updateICTNewCycle(newDataA_V) {
  try {
    const ss = SpreadsheetApp.openById(ICT_SS_ID);
    const sh = ss.getSheetByName(ICT_TAB_NAME) || ss.getSheets()[0];
    
    // 1. Chạy dịch chuyển tịnh tiến cột trước
    shiftICTColumns();
    
    // 2. Xóa dữ liệu cũ ở vùng A:W để ghi đè sạch sẽ (tránh sót hàng thừa nếu dữ liệu mới ngắn hơn)
    const lastRow = sh.getLastRow();
    if (lastRow > 0) {
      sh.getRange(1, 1, lastRow, 23).clearContent();
    }
    
    // 3. Dán dữ liệu mới vào cột A:V (Cột 1-22)
    if (newDataA_V && newDataA_V.length > 0) {
      sh.getRange(1, 1, newDataA_V.length, 22).setValues(newDataA_V);
      Logger.log("✅ Đã dán dữ liệu mới vào cột A:V (" + newDataA_V.length + " dòng)");
    }
    
    // 4. Ghi mốc thời gian chạy vào ô W1
    const nowMyanmar = Utilities.formatDate(new Date(), "Asia/Yangon", "dd/MM/yyyy HH:mm");
    sh.getRange("W1").setValue(nowMyanmar);
    Logger.log("✅ Đã ghi mốc thời gian kích hoạt vào W1: " + nowMyanmar);
    
    SpreadsheetApp.flush();
  } catch (err) {
    Logger.log("❌ Lỗi cập nhật chu kỳ mới ICT: " + err.message);
    throw err;
  }
}
