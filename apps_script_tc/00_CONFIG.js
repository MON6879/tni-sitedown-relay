// ============================================================
// FILE: 00_CONFIG.gs
// MÔ TẢ: Cấu hình toàn hệ thống QLTC Chi Nhánh
// PHIÊN BẢN: 1.0 | NGÀY: 2026-05-17
// ============================================================

// ─── TELEGRAM ────────────────────────────────────────────────
const TELEGRAM_BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE';
const TELEGRAM_CHAT_IDS = {
  TPTC  : 'CHAT_ID_TPTC',
  BOD   : 'CHAT_ID_BOD',
  GROUP : 'CHAT_ID_GROUP',
};

// ─── PHÂN QUYỀN EMAIL ────────────────────────────────────────
const ROLES = {
  TPTC : 'tptc@company.com',   // ← Thay email thực của TPTC
  BOD  : 'bod@company.com',    // ← Thay email thực của BOD
  TEAM_LEADERS: [
    { id:'T01', name:'Team 1',             leader:'Đội trưởng T1',  email:'team01@company.com' },
    { id:'T02', name:'Team 2',             leader:'Đội trưởng T2',  email:'team02@company.com' },
    { id:'T03', name:'Team 3',             leader:'Đội trưởng T3',  email:'team03@company.com' },
    { id:'T04', name:'Team 4',             leader:'Đội trưởng T4',  email:'team04@company.com' },
    { id:'T05', name:'Team 2 SUB',         leader:'Đội trưởng T2S', email:'team05@company.com' },
    { id:'T06', name:'Staff Solution',     leader:'Trưởng SS',      email:'team06@company.com' },
    { id:'T07', name:'Staff Construction', leader:'Trưởng SC',      email:'team07@company.com' },
    { id:'T08', name:'M&E',               leader:'Trưởng M&E',     email:'team08@company.com' },
  ]
};

// ─── GOOGLE SHEET IDs ─────────────────────────────────────────
// File Giám đốc (BOD) - "Sum Kioem Soat Tioen 2026"
const BOD_SS_ID      = '1DPOHu9q79F1QQvB-CjU3IdWNz6W-_OKvE-ge_Ox9Vd0';
const BOD_TAB_NAME   = 'Input';

// File Công Nợ TCT
const TCT_SS_ID           = '1BVFyn1-lmKvHpecgSr0zK9yF4ffVVUtBOqEAiiH3xK0';
const TCT_BOD_TAB         = 'BOD';           // Sổ nhật ký Nợ/Có
const TCT_DETAIL_TAB      = 'Detail Team - Dep'; // Chi tiết clear

// ─── TÊN SHEET TRONG HỆ THỐNG CHÍNH ─────────────────────────
const SHEET = {
  CONFIG          : 'CONFIG',
  SETTLEMENT      : 'CHUNG_TU',        // TPTC nhập chứng từ
  TCT_JOURNAL     : 'TCT_SO_CAI',      // Import từ TCT BOD (Nợ/Có)
  TCT_DETAIL      : 'TCT_CHI_TIET',    // Import từ TCT Detail
  ADVANCE_REQUEST : 'LENH_TAM_UNG',    // Lệnh tạm ứng
  ADVANCE_LIMIT   : 'HAN_MUC',         // Hạn mức tự động
  TRANSFER_LOG    : 'CHUYEN_TIEN_BOD', // BOD chuyển tiền
  BOD_CASHFLOW    : 'DONG_TIEN_BOD',   // Import từ BOD file
  DASH_TPTC       : 'DASHBOARD_TPTC',
  DASH_BOD        : 'DASHBOARD_BOD',
};
// Dashboard team: 'DASH_T01' ... 'DASH_T08'

// ─── DANH MỤC CHI PHÍ (từ file TCT thực tế) ─────────────────
const EXPENSE_CATEGORIES = [
  'Support / Living Cost',
  'Guest Reception',
  'Cleaner',
  'Office Security',
  'SSB',
  'Drinking Water',
  'Fuel Car',
  'Admin',
  'Stationery',
  'Electric Bill',
  'Delivery (Documents)',
  'MDG Office Fuel',
  'Delivery (Materials)',
  'Rent Car',
  'Driver OT',
  'Rent Office',
  'Rent House',
  'EPC',
  'Construction',
  'Solution Solar',
  'Maintenance',
  'UPS / Equipment',
  'Khác',
];

// ─── LOẠI PHÍ (TYPE OF FEE từ TCT) ──────────────────────────
const FEE_TYPES = [
  'Support','Relationship','Cleaner','Office Security','SSB',
  'Water','Fuel Car','Admin','Stationery','Electric','Delivery',
  'MDG Office','Rent Car','Driver OT','Rent Office','Rent House',
  'EPC','Construction','Maintenance','Equipment','Other'
];

// ─── TÀI KHOẢN KẾ TOÁN (ACCOUNT từ TCT) ─────────────────────
const ACCOUNTS = ['1111','11211','11212','3383','6222','6272','6277'];

// ─── LOẠI THANH TOÁN (từ BOD file) ───────────────────────────
const PAYMENT_TYPES = ['Normal','Kpay','Special'];

// ─── TRẠNG THÁI ──────────────────────────────────────────────
const STATUS_SETTLEMENT = [
  'Chờ kiểm tra','TPTC đã xác nhận',
  'Đã gửi TCT','TCT đã phản hồi','Đã clear','Từ chối'
];
const STATUS_ADVANCE = [
  'Chờ BOD duyệt','BOD đã duyệt',
  'BOD đã chuyển tiền','Hoàn tất','Hủy'
];

// ─── MÀU SẮC ─────────────────────────────────────────────────
const CLR = {
  HEADER    : '#1565C0', HEADER_FG : '#FFFFFF',
  CLEARED   : '#E8F5E9', DIFF      : '#FFEBEE',
  PENDING   : '#FFF3E0', APPROVED  : '#E3F2FD',
  WARN      : '#FF6F00', OK        : '#2E7D32',
  SECTION   : '#F5F5F5', ALT_ROW   : '#FAFAFA',
  REJECT    : '#B71C1C', REJECT_FG : '#FFFFFF',
};

// ─── CÀI ĐẶT ─────────────────────────────────────────────────
const SETTINGS = {
  DEFAULT_LIMIT_REF : 1,      // Tháng tham chiếu mặc định
  TZ                : 'Asia/Ho_Chi_Minh',
};

// ════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════

function getSS()               { return SpreadsheetApp.getActiveSpreadsheet(); }
function getSheet(name)        { return getSS().getSheetByName(name); }
function getTeamById(id)       { return ROLES.TEAM_LEADERS.find(t => t.id === id) || null; }
function getTeamByEmail(email) {
  const e = email || Session.getActiveUser().getEmail();
  return ROLES.TEAM_LEADERS.find(t => t.email === e) || null;
}
function getCurrentUserRole() {
  const email = Session.getActiveUser().getEmail();
  if (email === ROLES.TPTC) return 'TPTC';
  if (email === ROLES.BOD)  return 'BOD';
  if (ROLES.TEAM_LEADERS.find(t => t.email === email)) return 'TEAM';
  return 'UNKNOWN';
}
function isTptc() { return getCurrentUserRole() === 'TPTC'; }
function isBod()  { return getCurrentUserRole() === 'BOD'; }
function isTeam() { return getCurrentUserRole() === 'TEAM'; }

function fmtVND(n) {
  if (!n || isNaN(Number(n))) return '0';
  return Number(n).toLocaleString('vi-VN');
}
function getMonthYear(date) {
  const d = date ? new Date(date) : new Date();
  return `${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
function getMonthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return getMonthYear(d);
}
function tsNow() {
  return Utilities.formatDate(new Date(), SETTINGS.TZ, 'dd/MM/yyyy HH:mm:ss');
}
function tsDate() {
  return Utilities.formatDate(new Date(), SETTINGS.TZ, 'dd/MM/yyyy');
}
function getTeamDashName(teamId) { return `DASH_${teamId}`; }

function getTeamNames() {
  return ROLES.TEAM_LEADERS.map(t => t.name);
}
function getTeamIds() {
  return ROLES.TEAM_LEADERS.map(t => t.id);
}
