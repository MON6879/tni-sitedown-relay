// ============================================================================
// 🚂 CHUYẾN TÀU 3: BÁO CÁO & GIÁM SÁT HẸN GIỜ (SCHEDULED AUTOMATION LINE)
// 🚨 TOA TÀU: TOA SITE DOWN RELAY (DÃY GHẾ SD-RELAY & SD-ALERT)
// ════════════════════════════════════════════════════════════════════════════
// MASTER BULLETPROOF EDITION — v7.2 (DUAL INDEPENDENT STREAMS & ISOLATED DELETION)
// Phân bổ dãy ghế hạt nhân:
//   • Ghế SD-RELAY-1: Dispatch & Ingestion Manager (Trigger 1 phút, Smart Dispatch)
//   • Ghế SD-RELAY-2: Luồng 1 (5 TNI) — Xóa đúng 5 TNI cũ, gửi 5 TNI mới (có chấm màu Team)
//   • Ghế SD-RELAY-3: Luồng 2 (Summary) — Xóa đúng Summary cũ, gửi Summary mới (chỉ số sạch)
//   • Ghế SD-RELAY-4: Bộ Đệm & Xóa Cách Ly Độc Lập (Zero Overlapping Deletion)
//   • Ghế SD-ALERT  : Cảnh Báo Lỗi Trực Tuyến (Zero-Silent-Failure Alert Seat)
// ════════════════════════════════════════════════════════════════════════════

// ── 1. CẤU HÌNH TOKEN & TELEGRAM CHAT IDS ───────────────────────────────────
function getBotToken_() {
  return PropertiesService.getScriptProperties().getProperty("SD_BOT_TOKEN") || "";
}

// Group Chat IDs (Supergroups / Channels bắt buộc prefix -100)
const SD_GROUPS = {
  T1:      "-1004215695747",  // 🟠 TNI TEAM 1 PLAN - ALARM (Dawei)
  T2:      "-1004480845549",  // 🔵 TNI TEAM 2 PLAN - ALARM (Myeik + Team5)
  T3:      "-1004369170658",  // 🟢 TNI TEAM 3 PLAN - ALARM (Bokpyin)
  T4:      "-1004293741999",  // 🟡 TNI TEAM 4 PLAN - ALARM (Kawthoung)
  CONTROL: "-5251698940",     // 🏢 TNI TECHNICAL DEP CONTROL SITE
};

const TEAM_COLORS = { T1: "🟠", T2: "🔵", T3: "🟢", T4: "🟡" };

// Danh sách cá nhân nhận Tin 2 (DM) & nhận Cảnh Báo Lỗi từ Ghế SD-ALERT
function getPersonalIds_() {
  const fromProp = PropertiesService.getScriptProperties().getProperty("SD_PERSONAL_IDS") || "";
  if (fromProp) {
    return fromProp.split(",").map(s => s.trim()).filter(s => s.length > 0);
  }
  return ["6859790680"]; // Ha Duc Phong (Admin Default)
}

// ── 2. GOOGLE SHEET METADATA & DEDUP KEYS ────────────────────────────────────
const SD_SHEET_ID   = "1FvDhIwq8HxKfS2MqrwZMapIEsv7dwafaAVVnK0lpXow";
const SD_SHEET_GID  = "0";

// Chìa khóa chống trùng độc lập cho 2 luồng
const TS_KEY_A1     = "SD_KEY_A1_INDEPENDENT_V7";
const TS_KEY_AW7    = "SD_KEY_AW7_INDEPENDENT_V7";

// Cột Summary AW:AZ (AW=0:T1, AX=1:T2, AY=2:T3, AZ=3:T4)
const AWAZ_COL = { T1: 0, T2: 1, T3: 2, T4: 3 };

const AWAZ_LABELS = [
  { emoji: "⚡", name: "Site down"   },
  { emoji: "🔴", name: "Cell down"   },
  { emoji: "⚙️", name: "DG Abnormal" },
  { emoji: "⏱️", name: "DG Run>16H"  },
  { emoji: "🔗", name: "Link down"   },
];


// ============================================================================
// 🚨 GHẾ SD-ALERT: CẢNH BÁO LỖI HỆ THỐNG TRỰC TIẾP VỀ TELEGRAM DM (ZERO-SILENT-FAILURE)
// ============================================================================
function sendSystemAlert_(component, errorMsg, errorDetails) {
  const now = Utilities.formatDate(new Date(), "Asia/Rangoon", "dd/MM/yyyy HH:mm:ss");
  const alertText = [
    "🚨 <b>[SITE DOWN SYSTEM ALERT]</b>",
    "⏰ <b>Time:</b> " + now + " (MMT)",
    "📍 <b>Component:</b> " + escHtml(component),
    "❌ <b>Error:</b> <code>" + escHtml(errorMsg) + "</code>",
    errorDetails ? "📝 <b>Details:</b> <pre>" + escHtml(errorDetails).substring(0, 500) + "</pre>" : "",
    "⚠️ <i>Please check GAS logs and network connectivity!</i>"
  ].filter(l => l.length > 0).join("\n");

  Logger.log("🚨 [ALERT][" + component + "] " + errorMsg);

  const token = getBotToken_();
  if (!token) return;

  const adminIds = getPersonalIds_();
  for (const adminId of adminIds) {
    try {
      UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ chat_id: adminId, text: alertText, parse_mode: "HTML" }),
        muteHttpExceptions: true
      });
    } catch(e) {}
  }
}


// ============================================================================
// 🚂 GHẾ SD-RELAY-1: WEB APP — doPost() & doGet() (INGESTION WIRE)
// ============================================================================
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.tryLock(8000);
    if (!e || !e.postData || !e.postData.contents) {
      return _json({ ok: false, msg: "Empty post body" });
    }

    const data = JSON.parse(e.postData.contents);

    // Bỏ qua telegram webhook update thô
    if (data.update_id !== undefined && !data.action) {
      return _json({ ok: true, msg: "Raw webhook ignored" });
    }

    const action = data.action || "";

    // ── GHI DỮ LIỆU CỘT A TỪ RELAY PYTHON ──
    if (action === "store_site_down") {
      const text  = (data.text || "").trim();
      const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
      const sheet = getSheetByGid(ss, SD_SHEET_GID);
      if (!sheet) {
        sendSystemAlert_("doPost:store_site_down", "Sheet GID=0 not found!");
        return _json({ ok: false, msg: "Sheet not found" });
      }

      const props   = PropertiesService.getScriptProperties();
      const relayTs = data.relay_ts || 0;

      // Xóa toàn bộ Col A cũ để không dính rác
      const maxRow = Math.max(sheet.getLastRow(), 500);
      sheet.getRange(1, 1, maxRow, 1).clearContent();

      // Ghi dữ liệu Col A và escape công thức =+-@
      const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length > 0) {
        const values = lines.map(l => {
          const str = String(l);
          return (/^[=\+\-@]/.test(str)) ? "'" + str : str;
        });
        sheet.getRange(1, 1, values.length, 1).setValues(values.map(v => [v]));
      }

      Logger.log("[doPost] store_site_down — Đã ghi " + lines.length + " dòng vào Col A | relay_ts=" + relayTs);

      // Xóa dedup A1 để ép Luồng 1 phát tin mới ngay
      props.deleteProperty(TS_KEY_A1);
      if (relayTs > 0) props.setProperty("SD_LAST_RELAY_TS", relayTs.toString());

      // 2 bước flush chuẩn bảo đảm công thức Col C tính toán xong 100%
      SpreadsheetApp.flush();
      Utilities.sleep(1500);
      SpreadsheetApp.flush();

      // Thực thi gửi tin ngay lập tức
      var checkResult = { sent_tin1: false, sent_tin2: false };
      try {
        checkResult = checkAndSend(true);
      } catch(errRun) {
        sendSystemAlert_("doPost:checkAndSend", errRun.message, errRun.stack);
      }

      return _json({
        ok: true,
        lines: lines.length,
        relay_ts: relayTs,
        sent_tin1: !!checkResult.sent_tin1,
        sent_tin2: !!checkResult.sent_tin2
      });
    }

    if (action === "get_note_b2b5") {
      const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
      const sheet = getSheetByGid(ss, SD_SHEET_GID);
      if (!sheet) return _json({ ok: false, msg: "Sheet not found" });
      const vals = sheet.getRange("B2:B5").getValues();
      const note = vals.map(r => (r[0] || "").toString().trim()).filter(v => v).join("\n");
      return ContentService.createTextOutput(note).setMimeType(ContentService.MimeType.TEXT);
    }

    if (action === "save_note_msgids") {
      const msgids = data.msgids || {};
      PropertiesService.getScriptProperties().setProperty("SD_NOTE_MSGIDS", JSON.stringify(msgids));
      return _json({ ok: true });
    }

    if (action === "get_note_msgids") {
      const raw    = PropertiesService.getScriptProperties().getProperty("SD_NOTE_MSGIDS") || "{}";
      const msgids = JSON.parse(raw);
      return _json({ ok: true, msgids: msgids });
    }

    return _json({ ok: false, msg: "Unknown action: " + action });

  } catch (err) {
    sendSystemAlert_("doPost", err.message, err.stack);
    return _json({ ok: false, msg: err.message });
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "";

    if (action === "get_note_b2b5") {
      const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
      const sheet = getSheetByGid(ss, SD_SHEET_GID);
      if (!sheet) return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
      const vals = sheet.getRange("B2:B5").getValues();
      const note = vals.map(r => (r[0] || "").toString().trim()).filter(v => v).join("\n");
      return ContentService.createTextOutput(note).setMimeType(ContentService.MimeType.TEXT);
    }

    if (action === "get_note_msgids") {
      const raw    = PropertiesService.getScriptProperties().getProperty("SD_NOTE_MSGIDS") || "{}";
      const msgids = JSON.parse(raw);
      return _json({ ok: true, msgids: msgids });
    }

    return _json({ ok: false, msg: "Unknown GET action: " + action });
  } catch (err) {
    return _json({ ok: false, msg: err.message });
  }
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


// ============================================================================
// 🚂 GHẾ SD-RELAY-1: MAIN DISPATCH & TRIGGER SCHEDULER (checkAndSend)
// ============================================================================
function checkAndSend(isWebhookCall) {
  const now    = new Date();
  const mytime = Utilities.formatDate(now, "Asia/Rangoon", "H:mm");
  const hour   = parseInt(Utilities.formatDate(now, "Asia/Rangoon", "H"), 10);
  const minute = parseInt(Utilities.formatDate(now, "Asia/Rangoon", "m"), 10);

  const props = PropertiesService.getScriptProperties();

  // ── 1. Reset đệm độc lập vào đầu ngày 03:30 AM ───────────────────────────
  const todayStr = Utilities.formatDate(now, "Asia/Rangoon", "yyyyMMdd");
  const lastDay  = props.getProperty("SD_LAST_RUN_DATE") || "";
  if (todayStr !== lastDay) {
    props.setProperty("SD_LAST_RUN_DATE", todayStr);
    props.deleteProperty(TS_KEY_A1);
    props.deleteProperty(TS_KEY_AW7);
    Logger.log("🌅 NGÀY MỚI (" + todayStr + ") — Đã reset chìa khóa A1 & AW7!");
  }

  // ── 2. Kiểm tra khung giờ hoạt động (05:00 — 20:00 Myanmar) ───────────────
  if (isWebhookCall !== true) {
    if (hour < 5 || hour >= 20) {
      return { sent_tin1: false, sent_tin2: false };
    }

    // Chống chạy 2 lần trong cùng 1 phút
    const thisMinute = Utilities.formatDate(now, "Asia/Rangoon", "yyyyMMddHHmm");
    const lastDoneMinute = props.getProperty("SD_LAST_DONE_MINUTE") || "";
    if (thisMinute === lastDoneMinute) {
      return { sent_tin1: false, sent_tin2: false };
    }
    props.setProperty("SD_LAST_DONE_MINUTE", thisMinute);

    // ── Smart Progressive Dispatch GitHub Actions (:05, :10, :15 hoặc :35, :40, :45) ──
    if (minute % 5 === 0 && minute !== 0 && minute !== 30) {
      const cycleSlot = Utilities.formatDate(now, "Asia/Rangoon", "yyyyMMddHH") + (minute < 30 ? "_00" : "_30");
      const lastSlot  = props.getProperty("SD_DISPATCH_SLOT") || "";

      let count = parseInt(props.getProperty("SD_DISPATCH_COUNT") || "0", 10);
      if (cycleSlot !== lastSlot) {
        count = 0;
        props.setProperty("SD_DISPATCH_SLOT", cycleSlot);
        props.setProperty("SD_DISPATCH_COUNT", "0");
      }

      const lastSentSlot   = props.getProperty("SD_LAST_SENT_SLOT") || "";
      const lastDispatchTs = parseInt(props.getProperty("SD_LAST_DISPATCH_TS") || "0", 10);
      const minSinceDisp   = (Date.now() - lastDispatchTs) / 60000;

      if (lastSentSlot === cycleSlot) {
        // Chu kỳ này đã gửi tin thành công
      } else if (count >= 3) {
        Logger.log("🛑 Đã ép GitHub 3/3 lần trong chu kỳ " + cycleSlot + " mà chưa có data.");
      } else if (lastDispatchTs > 0 && minSinceDisp < 3) {
        Logger.log("⏳ Vừa dispatch " + minSinceDisp.toFixed(1) + " phút trước → đang đợi.");
      } else {
        Logger.log("⏰ " + mytime + " MMT → Ép GitHub dispatch relay (Lần " + (count + 1) + "/3)");
        triggerBotlookupRelay();
        props.setProperty("SD_DISPATCH_COUNT", (count + 1).toString());
      }
    }
  }

  Logger.log("🔄 checkAndSend — " + mytime + (isWebhookCall ? " (Webhook)" : " (Trigger)"));

  // Khóa Concurrency Lock
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(6000)) {
    Logger.log("⏭️ Lock bận — bỏ qua tránh tranh chấp");
    return { sent_tin1: false, sent_tin2: false };
  }

  try {
    const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
    const sheet = getSheetByGid(ss, SD_SHEET_GID);
    if (!sheet) {
      sendSystemAlert_("checkAndSend", "Sheet GID=0 not found!");
      return { sent_tin1: false, sent_tin2: false };
    }

    var r1 = false;
    var r2 = false;

    // 🔹 GHẾ SD-RELAY-2: LUỒNG 1 (5 TNI — CỘT C / A1)
    // Xóa đúng 5 TNI cũ, gửi 5 TNI mới (có chấm màu Team)
    try {
      r1 = processSiteDownColC(sheet);
    } catch(e1) {
      sendSystemAlert_("Luồng 1 (5 TNI Col C)", e1.message, e1.stack);
    }

    // 🔹 GHẾ SD-RELAY-3: LUỒNG 2 (SUMMARY — AW7:AZ15)
    // Xóa đúng Summary cũ, gửi Summary mới (chỉ số sạch)
    // Nếu r1 = true (5 TNI vừa gửi mới), ép Summary gửi ngay dưới đáy chat
    try {
      r2 = processSummaryAwAz(sheet, r1 === true);
    } catch(e2) {
      sendSystemAlert_("Luồng 2 (AW7 Summary)", e2.message, e2.stack);
    }

    Logger.log("📊 Kết quả hoàn tất: 5TNI=" + r1 + ", Summary=" + r2);
    return { sent_tin1: r1, sent_tin2: r2 };
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}


// ============================================================================
// 🚂 GHẾ SD-RELAY-2: LUỒNG 1 (5 TNI) — XỬ LÝ A1 & CỘT C (CÓ CHẤM MÀU TEAM)
// ============================================================================
function colorizeSiteLine(line) {
  if (!line) return "";
  // Tự động thay | T1 | hoặc | T1 S1 | thành | 🟠T1 | hoặc | 🟠T1 S1 |
  return line.replace(/\|\s*(T[1-4])(\s+S\w*)?\s*\|/gi, function(match, team, sub) {
    const upperTeam = team.toUpperCase();
    const emoji = TEAM_COLORS[upperTeam] || "";
    return "| " + emoji + upperTeam + (sub || "") + " |";
  });
}

function processSiteDownColC(sheet) {
  const storeKey = parseA1Timestamp(sheet);
  if (!storeKey) {
    Logger.log("[Luồng 5 TNI] Không tìm thấy timestamp hợp lệ trong A1");
    return false;
  }

  const props   = PropertiesService.getScriptProperties();
  const lastKey = props.getProperty(TS_KEY_A1) || "";

  if (storeKey === lastKey) {
    Logger.log("[Luồng 5 TNI] Timestamp A1 không đổi (" + storeKey.substring(0, 30) + ") → Bỏ qua");
    return false;
  }

  Logger.log("[Luồng 5 TNI] 🆕 Timestamp A1 đổi: " + storeKey + " → Đang gửi tin 5 TNI...");

  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return false;

  const colC = sheet.getRange(1, 3, lastRow, 1).getValues().flat().map(v => (v || "").toString().trim());

  function isTeamSummaryLine(l) {
    return /Team\s*0?[1-4][\s\—\-]*:\s*Total\s+Site\s+down/i.test(l);
  }

  var sendSuccessAny = false;

  // ── 1. Gửi nhóm CONTROL (Header C1-C3 + Toàn bộ trạm C10+ có chấm màu Team) ──
  const controlId = SD_GROUPS["CONTROL"];
  if (controlId) {
    try {
      const header = [colC[0]||"", colC[1]||"", colC[2]||""].filter(l => l.length > 0);
      const rawSites = colC.slice(9).filter(l => l.length > 0 && l !== "..." && !isTeamSummaryLine(l));

      const msgLines = [
        ...header.map(h => escHtml(h)),
        "",
        ...rawSites.map(s => escHtml(colorizeSiteLine(s)))
      ];

      const msg = msgLines.join("\n").trim();
      if (msg) {
        const ok = sendAndReplaceTelegram(controlId, msg, "TIN1_CONTROL", "[5TNI][CONTROL]");
        if (ok) sendSuccessAny = true;
      }
    } catch (e) {
      Logger.log("[Luồng 5 TNI][CONTROL] ❌ " + e.message);
    }
  }

  // ── 2. Phân loại site theo 4 Teams (T1-T4) ──
  const teamCells = { T1: colC[3]||"", T2: colC[4]||"", T3: colC[5]||"", T4: colC[6]||"" };
  const teams = ["T1", "T2", "T3", "T4"];
  const allC10 = colC.slice(9).filter(l => l.length > 0 && l !== "...");

  for (const team of teams) {
    if (!teamCells[team]) {
      const n = team[1];
      const found = allC10.find(l => new RegExp("Team\\s+" + n + "\\s*:\\s*Total\\s+Site\\s+down", "i").test(l));
      if (found) teamCells[team] = found;
    }
  }

  const siteOnly  = allC10.filter(l => !isTeamSummaryLine(l));
  const teamSites = { T1: [], T2: [], T3: [], T4: [] };

  for (const line of siteOnly) {
    const fields = line.split("|");
    if (fields.length < 2) continue;
    const teamField = fields[1].trim().toUpperCase();
    for (const team of teams) {
      const tn  = team.slice(1);
      const idx = teamField.indexOf("T" + tn);
      if (idx < 0) continue;
      const afterChar = teamField[idx + 1 + tn.length];
      if (!afterChar || !/\d/.test(afterChar)) {
        teamSites[team].push(line);
        break;
      }
    }
  }

  // ── 3. Gửi sang 4 nhóm Team (Header Summary + Danh sách Site có chấm màu Team) ──
  for (const team of teams) {
    try {
      const chatId = SD_GROUPS[team];
      if (!chatId || String(chatId).trim() === String(controlId).trim()) continue;
      const summary = teamCells[team];
      const sites   = teamSites[team];

      const parts = [];
      if (summary) {
        parts.push(formatTeamHeaderHtml(summary, team));
      }
      if (sites && sites.length > 0) {
        parts.push("");
        // Định dạng chấm màu Team cho danh sách trạm (| 🟠T1 |, | 🔵T2 |, | 🟢T3 |, | 🟡T4 |)
        for (const s of sites) {
          parts.push(escHtml(colorizeSiteLine(s)));
        }
      }

      if (parts.length > 0) {
        const fullText = parts.join("\n").trim();
        const ok = sendAndReplaceTelegram(chatId, fullText, "TIN1_" + team, "[5TNI][" + team + "]");
        if (ok) sendSuccessAny = true;
      }
    } catch (e) {
      Logger.log("[Luồng 5 TNI][" + team + "] ❌ " + e.message);
    }
  }

  // ✅ BẢO VỆ CHẶT CHẼ (POST-SEND COMMIT): Chỉ lưu dedup key KHI GỬI THÀNH CÔNG ÍT NHẤT 1 NHÓM
  if (sendSuccessAny) {
    props.setProperty(TS_KEY_A1, storeKey);
    const now = new Date();
    const sentSlot = Utilities.formatDate(now, "Asia/Rangoon", "yyyyMMddHH") + (now.getMinutes() < 30 ? "_00" : "_30");
    props.setProperty("SD_LAST_SENT_SLOT", sentSlot);
    Logger.log("[Luồng 5 TNI] ✅ Hoàn tất gửi tin 5 TNI & Đã khóa Dedup Key!");
    return true;
  } else {
    Logger.log("[Luồng 5 TNI] ⚠️ Gửi thất bại toàn bộ → KHÔNG khóa key để retry ở phút kế tiếp!");
    return false;
  }
}


// ============================================================================
// 🚂 GHẾ SD-RELAY-3: LUỒNG 2 (SUMMARY) — XỬ LÝ AW7 (CHỈ SỐ SẠCH)
// ============================================================================
function processSummaryAwAz(sheet, forceSend) {
  const rawTs = sheet.getRange("AW7").getValue().toString().trim();
  if (!rawTs) {
    Logger.log("[Luồng Summary] Ô AW7 rỗng — Bỏ qua");
    return false;
  }

  const tsKey = parseAW7Timestamp(sheet) || formatTsHeader(rawTs);

  const props  = PropertiesService.getScriptProperties();
  const lastTs = props.getProperty(TS_KEY_AW7) || "";

  if (tsKey === lastTs && !forceSend) {
    Logger.log("[Luồng Summary] Timestamp AW7 không đổi (" + tsKey + ") → Bỏ qua");
    return false;
  }
  if (forceSend) {
    Logger.log("[Luồng Summary] ⚡ forceSend=true → Ép gửi lại Summary xuống đáy chat!");
  }

  Logger.log("[Luồng Summary] 🆕 Timestamp AW7: " + tsKey + " → Đang gửi tin Summary...");

  const awaz  = readAwAz(sheet);
  const teams = ["T1", "T2", "T3", "T4"];
  var sendSuccessAny = false;

  // ── 1. Gửi sang 4 nhóm Team (Xóa đúng Summary cũ, gửi Summary mới) ──
  for (const team of teams) {
    try {
      const chatId = SD_GROUPS[team];
      if (!chatId) continue;
      const colIdx = AWAZ_COL[team];
      if (colIdx === undefined) continue;
      const msg = buildAwAzTeamMessage(team, tsKey, awaz, colIdx);
      const ok = sendAndReplaceTelegram(chatId, msg, "TIN2_" + team, "[Summary][" + team + "]");
      if (ok) sendSuccessAny = true;
    } catch (err) {
      Logger.log("[Luồng Summary][" + team + "] ❌ " + err.message);
    }
  }

  // ── 2. Gửi nhóm CONTROL ──
  const controlId = SD_GROUPS["CONTROL"];
  if (controlId) {
    try {
      const msg = buildAwAzControlMessage(tsKey, awaz);
      const ok = sendAndReplaceTelegram(controlId, msg, "TIN2_CONTROL", "[Summary][CONTROL]");
      if (ok) sendSuccessAny = true;
    } catch(e) {
      Logger.log("[Luồng Summary][CONTROL] ❌ " + e.message);
    }
  }

  // ── 3. Gửi DM cá nhân ──
  const personalIds = getPersonalIds_();
  for (const pid of personalIds) {
    try {
      const ok = sendAndReplaceTelegram(pid, buildAwAzControlMessage(tsKey, awaz), "TIN2_P_" + pid, "[Summary][DM]");
      if (ok) sendSuccessAny = true;
    } catch(e) {
      Logger.log("[Luồng Summary][DM " + pid + "] ❌ " + e.message);
    }
    Utilities.sleep(200);
  }

  // ✅ BẢO VỆ CHẶT CHẼ (POST-SEND COMMIT): Chỉ lưu dedup key khi gửi thành công
  if (sendSuccessAny) {
    props.setProperty(TS_KEY_AW7, tsKey);
    Logger.log("[Luồng Summary] ✅ Hoàn tất gửi tin Summary & Đã khóa Dedup Key!");
    return true;
  } else {
    Logger.log("[Luồng Summary] ⚠️ Gửi thất bại toàn bộ → KHÔNG khóa key để retry!");
    return false;
  }
}


// ============================================================================
// 🚂 GHẾ SD-RELAY-4: BỘ LÀM SẠCH VĂN BẢN & PARSERS (cleanSummaryCell & formatTeamHeaderHtml)
// ============================================================================
function cleanSummaryCell(val) {
  if (!val) return "";
  let clean = val.toString().replace(/[*_`]/g, "").trim();
  // Tẩy triệt để các tiền tố trùng lặp
  clean = clean.replace(/^(?:(?:Site|Cell)\s+down|DG\s+Abnormal|DG\s+Run\s*>?\s*16H?|Link\s+down)\s*:\s*/i, "").trim();
  return clean;
}

function parseA1Timestamp(sheet) {
  const maxRow = Math.min(sheet.getLastRow(), 50);
  if (maxRow < 1) return null;
  const vals = sheet.getRange(1, 1, maxRow, 1).getValues().flat();

  for (const cellVal of vals) {
    const raw = (cellVal || "").toString();
    const m1 = raw.match(/(\d{2}\/\d{2}\/\d{4}[\s\-T]+\d{2}:\d{2}:\d{2})/);
    if (m1) return m1[1].replace(/[\-T]/g, " ").trim();
    const m2 = raw.match(/(\d{2}\/\d{2}\/\d{4}[\s\-T]+\d{2}:\d{2})/);
    if (m2) return m2[1].replace(/[\-T]/g, " ").trim();
  }

  const textHead = vals.map(v => v.toString().trim()).filter(v => v.length > 0).slice(0, 5).join(" ");
  if (textHead) {
    const nowStr = Utilities.formatDate(new Date(), "Asia/Rangoon", "dd/MM/yyyy HH:mm");
    return "RAW_" + nowStr + "_" + textHead.substring(0, 40).replace(/[^a-zA-Z0-9]/g, "");
  }
  return null;
}

function parseAW7Timestamp(sheet) {
  const raw = sheet.getRange("AW7").getValue().toString();
  const m1 = raw.match(/Site\s*down[^:]*:\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/i);
  if (m1) return m1[1].trim();
  const m2 = raw.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/);
  if (m2) return m2[1].trim();
  return null;
}

function readAwAz(sheet) {
  return sheet.getRange(7, 49, 9, 4).getValues();
}

function buildAwAzTeamMessage(teamKey, ts, awaz, colIdx) {
  const teamNum   = teamKey.replace("T", "");
  const teamEmoji = TEAM_COLORS[teamKey] || "🏷";
  const label     = "Team " + teamNum;
  const numRows   = awaz.length;
  const lines     = [];
  lines.push("📊 <b>SUMMARY — " + teamEmoji + " " + label + "</b>");
  lines.push("📅 " + escHtml(ts));
  lines.push("━".repeat(26));

  let hasData = false;
  for (let r = 0; r < numRows; r++) {
    const txt = ((awaz[r] || [])[colIdx] || "").toString().trim();
    if (!txt || txt === "0") continue;
    const clean = cleanSummaryCell(txt);
    if (!clean || clean === "0") continue;

    if (r < AWAZ_LABELS.length) {
      lines.push("");
      lines.push(AWAZ_LABELS[r].emoji + " <b>" + AWAZ_LABELS[r].name + ":</b>");
      lines.push(escHtml(clean));
    } else {
      const lm = clean.match(/^([^:]+):/);
      const lb = lm ? lm[1].trim() : "Row " + (r + 1);
      const val = lm ? clean.substring(lm[0].length).trim() : clean;
      lines.push("");
      lines.push("📌 <b>" + escHtml(lb) + ":</b>");
      lines.push(escHtml(val));
    }
    hasData = true;
  }
  if (!hasData) lines.push("✅ No incident");
  return lines.join("\n");
}

function buildAwAzControlMessage(ts, awaz) {
  const teamDefs = [
    { key: "T1", label: "Team 1 Dawei",     emoji: "🟠", col: 0 },
    { key: "T2", label: "Team 2 Myeik",     emoji: "🔵", col: 1 },
    { key: "T3", label: "Team 3 Bokpyin",   emoji: "🟢", col: 2 },
    { key: "T4", label: "Team 4 Kawthoung", emoji: "🟡", col: 3 },
  ];
  const numRows = awaz.length;
  const lines   = [];
  lines.push("📊 <b>SUMMARY — ALL TEAMS</b>");
  lines.push("📅 " + escHtml(ts));
  lines.push("━".repeat(26));

  for (const t of teamDefs) {
    lines.push("");
    lines.push(t.emoji + " <b>" + t.label + "</b>");
    lines.push("─".repeat(20));
    let hasData = false;
    for (let r = 0; r < numRows; r++) {
      const txt = ((awaz[r] || [])[t.col] || "").toString().trim();
      if (!txt || txt === "0") continue;
      const clean = cleanSummaryCell(txt);
      if (!clean || clean === "0") continue;

      if (r < AWAZ_LABELS.length) {
        lines.push("");
        lines.push(AWAZ_LABELS[r].emoji + " <b>" + AWAZ_LABELS[r].name + ":</b>");
        lines.push(escHtml(clean));
      } else {
        const lm = clean.match(/^([^:]+):/);
        const lb = lm ? lm[1].trim() : "Row " + (r + 1);
        const val = lm ? clean.substring(lm[0].length).trim() : clean;
        lines.push("");
        lines.push("📌 <b>" + escHtml(lb) + ":</b>");
        lines.push(escHtml(val));
      }
      hasData = true;
    }
    if (!hasData) lines.push("✅ No incident");
  }
  return lines.join("\n");
}

// ── Format riêng cho Header Summary của từng Team (C4-C7) ──
function formatTeamHeaderHtml(rawSummary, teamKey) {
  if (!rawSummary) return "";
  
  let s = escHtml(rawSummary);

  // Gắn icon team cho dòng đầu
  const teamLabels = {
    T1: "🟠 <b>Team 1 Dawei</b>:",
    T2: "🔵 <b>Team 2 Myeik</b>:",
    T3: "🟢 <b>Team 3 Bokpyin</b>:",
    T4: "🟡 <b>Team 4 Kawthoung</b>:"
  };

  const headerEmoji = teamLabels[teamKey] || "🏷️ <b>" + teamKey + "</b>:";
  s = s.replace(/^(?:[🔴🔵🟢🟡🟠🟣⚪⚫]\s*)?Team\s*[0-4]?[^:]*:/i, headerEmoji);

  // Format các keyword icon
  s = s.replace(/(?:^|\n|\s*)(Dont\s+Forget)/gi, "\n🔥 <b>Dont Forget</b>");
  s = s.replace(/(?:^|\n|\s*)(?:&gt;|>)?(?:\s*)(Cell down:)/gi, "\n🔴 <b>Cell down:</b>");
  s = s.replace(/(?:^|\n|\s*)(?:&gt;|>)?(?:\s*)(DG Abnormal:)/gi, "\n⚙️ <b>DG Abnormal:</b>");
  s = s.replace(/(?:^|\n|\s*)(?:&gt;|>)?(?:\s*)(Link down:)/gi, "\n🔗 <b>Link down:</b>");
  s = s.replace(/(?:^|\n|\s*)(?:&gt;|>)?(?:\s*)(Duty:)/gi, "\n🕒 <b>Duty:</b>");
  s = s.replace(/\|\s*(DG Abnormal:)/gi, "\n⚙️ <b>DG Abnormal:</b>");
  s = s.replace(/\|\s*(Link down:)/gi, "\n🔗 <b>Link down:</b>");
  s = s.replace(/\|\s*(Cell down:)/gi, "\n🔴 <b>Cell down:</b>");
  s = s.replace(/\|\s*(Duty:)/gi, "\n🕒 <b>Duty:</b>");

  // DG Run>16H
  s = s.replace(/(?:(?:^|\n|\s*)(?:&gt;|>)|\|)\s*(DG Run(?:&gt;|>)\s*16H:)\s*([^\n\|]*)/gi, function(match, keyword, dataStr) {
     let c = dataStr.replace(/[*_]/g, "").trim();
     let icon = (c && c !== "0" && c !== "-" && c.toLowerCase() !== "none") ? "❌" : "✅";
     return "\n" + icon + " <b>DG Run>16H:</b> " + dataStr;
  });

  return s.trim();
}


// ============================================================================
// 🚂 GHẾ SD-RELAY-4: TELEGRAM BOT API HELPERS (XÓA CÁCH LY ĐỘC LẬP TỪNG LUỒNG)
// ============================================================================
function splitMessage(text, maxLen) {
  if (!text) return [""];
  if (text.length <= maxLen) return [text];
  const chunks = [];
  const lines = text.split("\n");
  let cur = "";
  for (const line of lines) {
    if ((cur + "\n" + line).length > maxLen) {
      if (cur) chunks.push(cur.trim());
      cur = line;
    } else {
      cur = cur ? cur + "\n" + line : line;
    }
  }
  if (cur) chunks.push(cur.trim());
  return chunks;
}

// 🛡️ XÓA CÁCH LY ĐỘC LẬP: TIN1 CHỈ XÓA TIN1, TIN2 CHỈ XÓA TIN2 — KHÔNG BAO GIỜ XÓA CHỒNG NHAU
function sendAndReplaceTelegram(chatId, content, msgKey, tag) {
  deleteOldMessages_(chatId, msgKey);
  Utilities.sleep(200);
  const props  = PropertiesService.getScriptProperties();
  const idKey  = "SD_MSGID_" + msgKey;
  const newIds = sendTelegramCollectIds_(chatId, content, tag);
  if (newIds && newIds.length > 0) {
    props.setProperty(idKey, JSON.stringify(newIds));
    return true;
  }
  return false;
}

function sendTelegramCollectIds_(chatId, text, tag) {
  const token = getBotToken_();
  if (!token) {
    sendSystemAlert_("Telegram API", "SD_BOT_TOKEN is missing in Script Properties!");
    return [];
  }
  const url    = "https://api.telegram.org/bot" + token + "/sendMessage";
  const chunks = splitMessage(text, 4000);
  const ids    = [];

  chunks.forEach((chunk, i) => {
    try {
      const resp = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: "HTML" }),
        muteHttpExceptions: true,
      });
      const code = resp.getResponseCode();
      const res  = JSON.parse(resp.getContentText());
      if (res.ok && res.result && res.result.message_id) {
        ids.push(res.result.message_id);
      } else {
        Logger.log("[" + (tag||"send") + "] ⚠️ HTTP " + code + ": " + resp.getContentText().substring(0, 200));
        if (code !== 200) {
          sendSystemAlert_("Telegram API Send", "HTTP " + code + ": " + res.description, "ChatID: " + chatId);
        }
      }
    } catch(e) {
      Logger.log("[" + (tag||"send") + "] ❌ Send lỗi: " + e.message);
      sendSystemAlert_("Telegram Network Exception", e.message, "ChatID: " + chatId);
    }
  });
  return ids;
}

function deleteTelegramMsgBot_(chatId, messageId) {
  const token = getBotToken_();
  if (!token || !messageId) return false;
  try {
    const resp = UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/deleteMessage", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ chat_id: chatId, message_id: messageId }),
      muteHttpExceptions: true,
    });
    const res = JSON.parse(resp.getContentText());
    return res.ok === true || (res.description && res.description.indexOf("message to delete not found") >= 0);
  } catch(e) {
    return false;
  }
}

// 🛡️ XÓA CHÍNH XÁC THEO MSGKEY: TIN1 CHỈ XÓA ID CỦA TIN1, TIN2 CHỈ XÓA ID CỦA TIN2
function deleteOldMessages_(chatId, msgKey) {
  const props = PropertiesService.getScriptProperties();
  const idKey = "SD_MSGID_" + msgKey;
  const raw = props.getProperty(idKey);
  if (!raw) return;

  let ids = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) ids = parsed;
    else if (typeof parsed === "number" || typeof parsed === "string") ids = [parsed];
  } catch(e) {
    if (/^\d+$/.test(raw.trim())) ids = [raw.trim()];
  }

  for (const mid of ids) {
    deleteTelegramMsgBot_(chatId, mid);
    Utilities.sleep(50);
  }
  props.deleteProperty(idKey);
}

function formatTsHeader(ts) {
  if (!ts) return "";
  const match = ts.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/);
  if (match) return match[1];
  return ts.length > 30 ? ts.substring(0, 30) : ts;
}

function escHtml(str) {
  return (str || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function getSheetByGid(ss, gid) {
  for (const s of ss.getSheets()) {
    if (s.getSheetId().toString() === gid.toString()) return s;
  }
  return null;
}

function triggerBotlookupRelay() {
  const props = PropertiesService.getScriptProperties();
  const pat   = props.getProperty("GITHUB_PAT") || "";
  if (!pat) { Logger.log("[dispatch] GITHUB_PAT rỗng!"); return; }
  try {
    var resp = UrlFetchApp.fetch("https://api.github.com/repos/MON6879/tni-sitedown-relay/actions/workflows/train_5min.yml/dispatches", {
      method: "post",
      headers: { "Authorization": "token " + pat, "Accept": "application/vnd.github.v3+json" },
      contentType: "application/json",
      payload: JSON.stringify({ ref: "main", inputs: { report_type: "Task - Bot Lookup Relay", skip_delay: "1" } }),
      muteHttpExceptions: true,
    });
    Logger.log("[dispatch] HTTP " + resp.getResponseCode());
    props.setProperty("SD_LAST_DISPATCH_TS", Date.now().toString());
  } catch(e) {
    Logger.log("[dispatch] ❌ " + e.message);
  }
}


// ============================================================================
// 🧪 TIỆN ÍCH QUẢN TRỊ, TEST & CÀI ĐẶT TRIGGER
// ============================================================================
function setupSdTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "checkAndSend")
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("checkAndSend").timeBased().everyMinutes(1).create();
  Logger.log("✅ Trigger checkAndSend() mỗi 1 phút đã cài đặt chuẩn xác.");
}

function testSendNow() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(TS_KEY_A1);
  props.deleteProperty(TS_KEY_AW7);
  props.deleteProperty("SD_LAST_DONE_MINUTE");
  const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
  const sheet = getSheetByGid(ss, SD_SHEET_GID);
  if (!sheet) { Logger.log("❌ Sheet not found!"); return; }
  processSiteDownColC(sheet);
  processSummaryAwAz(sheet, true);
}

function testTin1Only() {
  PropertiesService.getScriptProperties().deleteProperty(TS_KEY_A1);
  const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
  const sheet = getSheetByGid(ss, SD_SHEET_GID);
  if (sheet) processSiteDownColC(sheet);
}

function testTin2Only() {
  PropertiesService.getScriptProperties().deleteProperty(TS_KEY_AW7);
  const ss    = SpreadsheetApp.openById(SD_SHEET_ID);
  const sheet = getSheetByGid(ss, SD_SHEET_GID);
  if (sheet) processSummaryAwAz(sheet, true);
}

function testAlertSeat() {
  sendSystemAlert_("Test Alert Seat", "Đây là tin nhắn kiểm tra Ghế Cảnh Báo Lỗi SD-ALERT hoạt động!", "Status: OK 100%");
}
