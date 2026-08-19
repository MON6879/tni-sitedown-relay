// ============================================================
// DAILY CROSS CHECK WO REPORT (ĐÃ DỪNG VĨNH VIỄN)
// ============================================================
// Trạng thái: ĐÃ DỪNG HOÀN TOÀN theo yêu cầu người dùng.
// ============================================================

function setupCrossCheckWOTrigger() {
  // Xóa toàn bộ trigger liên quan đến báo cáo này để không bao giờ gửi nữa
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "sendCrossCheckWOReport")
    .forEach(t => ScriptApp.deleteTrigger(t));
  Logger.log("🛑 Đã xóa toàn bộ trigger của sendCrossCheckWOReport. Báo cáo này đã dừng gửi vĩnh viễn.");
}

function removeCrossCheckWOTrigger() {
  setupCrossCheckWOTrigger();
}

function sendCrossCheckWOReport() {
  Logger.log("🛑 Báo cáo Cross Check WO đã bị dừng vĩnh viễn theo yêu cầu.");
  // Tự động xóa trigger nếu còn sót lại
  try {
    ScriptApp.getProjectTriggers()
      .filter(t => t.getHandlerFunction() === "sendCrossCheckWOReport")
      .forEach(t => ScriptApp.deleteTrigger(t));
  } catch (e) {}
  return;
}

