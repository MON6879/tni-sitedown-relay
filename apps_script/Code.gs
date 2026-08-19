// ============================================================
// 🏛️ TNI OPERATIONS BACKEND HUB — ROOT ROUTER
// Ghế Quản Trị: Ghế GAS-OPS-1 (17 Files)
// Ghế Ngoại Giao: Ghế EXT-OPS-HUB
// ============================================================

function doGet(e) {
  try {
    return doGetCollector_(e);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    // 1. Nếu là Telegram Webhook Update (Bot 10 Construction hoặc Bot khác)
    if (e && e.postData && e.postData.contents) {
      try {
        const raw = JSON.parse(e.postData.contents);
        if (raw.update_id !== undefined && !raw.action) {
          if (typeof processTelegramUpdate === "function") {
            processTelegramUpdate(raw);
          }
          return ContentService.createTextOutput(JSON.stringify({ ok: true, status: "processed" }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      } catch (exJson) {}
    }

    // 2. Chuyển tiếp tới Collector Hub (Daily, Refuel, MDG, Cable, BI Plan Dep, etc.)
    return doPostCollector_(e);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
