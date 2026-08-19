// ================================================================
//  TEMPLATE COLLECTOR & MANAGEMENT SHEET — Google Apps Script
//  Sheet ID: 1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8
//  Tab Name: "Template"
// ================================================================

const TEMPLATE_SHEET_ID = "1Etd2PmbY5LgPaYhkdykT7KYXZHhB-_Qx3u-UXhFgpI8";
const TEMPLATE_TAB_NAME = "Template";

/**
 * Khởi tạo và nạp đầy đủ ma trận Template vào tab 'Template' trên Google Sheets
 */
function setupTemplateSheet() {
  const ss = SpreadsheetApp.openById(TEMPLATE_SHEET_ID);
  let sheet = ss.getSheetByName(TEMPLATE_TAB_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(TEMPLATE_TAB_NAME, 0);
  }
  
  // Format Header
  sheet.clear();
  const headers = [
    "Ref ID", 
    "Group Name (Tên Nhóm)", 
    "Seat / Bot Role (Ghế Ngồi & Bot)", 
    "Template Name (Tên Mẫu)", 
    "Trigger Command (Cú Pháp)", 
    "Template Content (Nội Dung Mẫu)", 
    "Target Destination (Nơi Lưu)", 
    "Last Updated (Cập Nhật)"
  ];
  
  sheet.getRange(1, 1, 1, headers.length)
       .setValues([headers])
       .setFontWeight("bold")
       .setBackground("#1a237e")
       .setFontColor("#ffffff")
       .setHorizontalAlignment("center");
       
  sheet.setRowHeight(1, 35);
  sheet.setFrozenRows(1);
  
  const nowStr = Utilities.formatDate(new Date(), "Asia/Yangon", "dd/MM/yyyy HH:mm");
  
  const data = [
    [
      "TPL-001",
      "TNI SEARCH & WORK ORDER BOT",
      "Ghế #1 — Bot Tra Cứu & Báo Cáo (@SEARCHTNITASKWOBOT)",
      "Daily Work Result Report",
      "gõ 'daily' hoặc 'daily_result'",
      "Daily result: DD/MM/YYYY\nTransportation Used: [Motorbike/Car]\nFull Name: [Name]\nDetail WO: [WO IDs]\nDetail task: [Task IDs]\nName Site rescue: [Site]\nName Cell rescue: [Cell]\nResuce Cable: [Cable]\nName and detail Site repair alarm: [Site Details]\nName Site follow partner refuel: [Site]\nOther task: [Details]\nName and detail Site go busines trip start go: [Start]\nName and detail Site go busines trip end go: [End]\nKm moto bike start: [Km Start]\nKm moto bike the end: [Km End]",
      "Sheet: Daily report and Bussiness (Row 2)",
      nowStr
    ],
    [
      "TPL-002",
      "TNI SEARCH & WORK ORDER BOT",
      "Ghế #2 — Ghế Xin Ra Vào Trạm Towerco (@SEARCHTNITASKWOBOT)",
      "Request Enter Site Format",
      "gõ 'site access' hoặc '/request_enter_site TNIxxxx'",
      "Company Name: TNI\nSite Code: TNI0401\nStaff Name: [Full Name]\nContact No: [Phone Number]\nNRC NO: [NRC Number]\nMail add: [Email]\nDate: DD/MM/YYYY\nActivity Detail: Site down check\nActivity Start time: 08:00 AM\nActivity End Time: 05:00 PM",
      "Chatbot Response / Towerco Permit",
      nowStr
    ],
    [
      "TPL-003",
      "TNI TEAM 1-4 PLAN GROUPS",
      "Ghế #3 — Ghế Kế Hoạch Đội Ngũ (Team Leaders & FTs)",
      "Daily Plan Morning & Evening",
      "dán theo định dạng Daily Plan",
      "Daily Plan: DD/MM/YYYY\nTeam X\nI. Hot task\n1. TNIxxxx | Task detail | Assignee\n2. TNIxxxx | Task detail | Assignee\nII. Routine task\n1. TNIxxxx | Maintenance | Assignee",
      "Sheet: Team leader assign Plan (Row 2)",
      nowStr
    ],
    [
      "TPL-004",
      "9 TNI REQUEST REFUEL",
      "Ghế #4 — Ghế Xin Cấp Dầu Trạm (@TNIASSETorderREQUEST_BOT)",
      "Site Refuel Requisition Request",
      "gõ 'Refuel Request' hoặc dán mẫu Cấp dầu",
      "Refuel Request: DD/MM/YYYY\nSite Code: TNIxxxx\nSite Name: [Site Name]\nCurrent Fuel Volume (Liters): [Volume]\nRequested Fuel Volume (Liters): [Volume]\nDG Run Time (Hours): [Hours]\nReason for Refuel: Main power failure\nAssignee: [Staff Name]",
      "Sheet: Refuel Request Data (Row 2)",
      nowStr
    ],
    [
      "TPL-005",
      "TNI TEAM 1-4 PLAN - ALARM",
      "Ghế #5 — Ghế Báo Động Trạm Down (@tni_site_down_bot)",
      "Site Down Emergency Red-Text Alarm",
      "Tự động phát lúc :06 & :36 hàng giờ",
      "🚨 5 TNI_SITE_DOWN_CELL_ALARM — SUMMARY (MMT HH:MM)\n--------------------------------------------------\nTeam X: N sites down\n1: TNIxxxx | 🔵TX | Hours | Partner | Tech | Location | Staff | Status",
      "Sheet: Input Site down Telegram (Row 2)",
      nowStr
    ],
    [
      "TPL-006",
      "TNI SEARCH & WORK ORDER BOT",
      "Ghế #6 — Ghế Tra Cứu TNI / INFO / CONS / CLEAR",
      "Fast Lookup Commands Syntax",
      "TNIxxxx / info: TNIxxxx / cons TNIxxxx / clear TNIxxxx",
      "TNI0019 ➔ Task & WO Details\ninfo: TNI0019 ➔ Full Infrastructure (Site/Cable/GPON/DIA)\ncons TNI0019 ➔ Civil Construction Progress\nclear TNI0019 ➔ Alarm Clear History\n/t1notclose, /t2notclose, /t3notclose, /t4notclose ➔ Team Open WOs\n/mysite, /mycable, /mydia, /mydata ➔ Personal Assigned Resources",
      "Instant Telegram Chat Response",
      nowStr
    ],
    [
      "TPL-007",
      "TNI ATTENDANCE GROUP",
      "Ghế #7 — Ghế Điểm Danh & Template (@SEARCHTNITASKWOBOT)",
      "Team Attendance Report Template (Team 1-4)",
      "gõ 'template attendance' hoặc 'template team 1-4' hoặc 'template header'",
      "Team 01 Attendane report: DD/MM/YY\n1. Staff Name: /Work\n2. Staff Name: /Work\n3. Staff Name: /Work\n(Tương tự cho Team 2, 3, 4)",
      "Sheet: Template Attendance (Col E:J / F:I)",
      nowStr
    ]
  ];
  
  sheet.getRange(2, 1, data.length, headers.length).setValues(data);
  sheet.getRange(2, 1, data.length, headers.length).setVerticalAlignment("top").setWrap(true);
  
  sheet.setColumnWidth(1, 90);   // Ref ID
  sheet.setColumnWidth(2, 220);  // Group Name
  sheet.setColumnWidth(3, 260);  // Seat / Bot Role
  sheet.setColumnWidth(4, 220);  // Template Name
  sheet.setColumnWidth(5, 200);  // Trigger Command
  sheet.setColumnWidth(6, 450);  // Template Content
  sheet.setColumnWidth(7, 220);  // Target Destination
  sheet.setColumnWidth(8, 140);  // Last Updated
  
  Logger.log("✅ Sheet 'Template' setup complete with 6 master templates!");
}
