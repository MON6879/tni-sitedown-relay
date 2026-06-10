// ╔══════════════════════════════════════════════════════════════╗
// ║  📊 DASHBOARD REPORT — TNI  v4 (No-timeout edition)         ║
// ╚══════════════════════════════════════════════════════════════╝
//
// CHẠY THEO THỨ TỰ:
//   BƯỚC 1: Chọn hàm  drStep1_BuildTables  → ▶ Run  (~30s)
//   BƯỚC 2: Chọn hàm  drStep2_BuildCharts  → ▶ Run  (~60s)
//
//   Hoặc dùng menu 📊 Dashboard trong Google Sheet

// ─── CONSTANTS ───────────────────────────────────────────────
const DR_DASH_NAME  = "Dashboard Report";
const DR_RAW_NAME   = "Dashboard Raw";
const DR_REPORT_GID = "133591305";
const DR_INPUT_GID  = "1755404595";
const DR_DATA_TAB   = "Asset order and request";
const DR_CFG_TAB    = "Config";
const DR_SEARCH_LOG = "Search Log";
const DR_TZ         = "Asia/Rangoon";

// ─── MENU — gọi từ onOpen() chung trong apps_script_collector.js ────────────
// ⚠️ KHÔNG để function onOpen() ở đây — sẽ bị trùng với apps_script_collector.js
// Các menu item được đăng ký trong hàm onOpen() của apps_script_collector.js
function drRegisterMenu_(ui) {
  ui.createMenu("📊 Dashboard")
    .addItem("▶ BƯỚC 1: Tạo bảng dữ liệu (~30s)",  "drStep1_BuildTables")
    .addItem("▶ BƯỚC 2: Vẽ biểu đồ (~60s)",        "drStep2_BuildCharts")
    .addSeparator()
    .addItem("📋 Chỉ cập nhật Raw Data",            "drRawOnly")
    .addSeparator()
    .addItem("⏰ Bật auto 18h/ngày",                "drSetupTrigger")
    .addItem("🗑️  Tắt auto",                        "drRemoveTrigger")
    .addToUi();
}

// ═════════════════════════════════════════════════════════════
// BƯỚC 1: CHỈ TẠO BẢNG (không vẽ chart) — chạy < 30s
// ═════════════════════════════════════════════════════════════
function drStep1_BuildTables() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    const d = drGatherData(ss);
    drBuildRaw(ss, d);
    drBuildDash(ss, d);        // chỉ ghi bảng, không chart
    SpreadsheetApp.getUi().alert(
      "✅ BƯỚC 1 XONG!\n\n" +
      "Bảng đã tạo tại sheet 'Dashboard Report' và 'Dashboard Raw'.\n\n" +
      "→ Tiếp theo: Chạy BƯỚC 2 để vẽ biểu đồ."
    );
  } catch(e) {
    SpreadsheetApp.getUi().alert("❌ Lỗi: " + e.message + "\n\n" + e.stack);
  }
}

// BƯỚC 2: CHỈ VẼ BIỂU ĐỒ — chạy riêng sau bước 1
function drStep2_BuildCharts() {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const dash = ss.getSheetByName(DR_DASH_NAME);
  if (!dash) {
    SpreadsheetApp.getUi().alert("❌ Chưa có sheet 'Dashboard Report'.\nHãy chạy BƯỚC 1 trước!");
    return;
  }
  try {
    const d = drGatherData(ss);
    drBuildCharts(ss, dash, d);
    SpreadsheetApp.getUi().alert("✅ BƯỚC 2 XONG! Biểu đồ đã được tạo.");
  } catch(e) {
    SpreadsheetApp.getUi().alert("❌ Lỗi biểu đồ: " + e.message);
  }
}

function drRawOnly() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const d  = drGatherData(ss);
  drBuildRaw(ss, d);
  SpreadsheetApp.getUi().alert("✅ Đã cập nhật 'Dashboard Raw'!");
}

// ═════════════════════════════════════════════════════════════
// THU THẬP DỮ LIỆU
// ═════════════════════════════════════════════════════════════
function drGatherData(ss) {
  const now      = new Date();
  const todayStr = Utilities.formatDate(now, DR_TZ, "dd/MM/yyyy");
  const d1Str    = Utilities.formatDate(new Date(now-86400000),   DR_TZ, "dd/MM/yyyy");
  const d2Str    = Utilities.formatDate(new Date(now-2*86400000), DR_TZ, "dd/MM/yyyy");
  const msWeek   = 7*86400000;

  // ── Kỳ tháng: ngày 21/tháng trước → ngày 20/tháng này (giờ Myanmar UTC+6:30)
  // Ví dụ: hôm nay 07/06 → kỳ = 21/05 ~ 20/06
  //        hôm nay 25/06 → kỳ = 21/06 ~ 20/07
  const tzOff_  = 6.5 * 3600000;
  const nowLocal = new Date(now.getTime() + tzOff_);
  const dayNow   = nowLocal.getUTCDate();    // ngày trong tháng hiện tại (giờ MMT)
  let monthStartUTC;
  if (dayNow <= 20) {
    // Còn trong kỳ cũ → đầu kỳ là ngày 21 của tháng TRƯỚC
    monthStartUTC = Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth() - 1, 21);
  } else {
    // Đã qua ngày 20 → đầu kỳ là ngày 21 của tháng NÀY
    monthStartUTC = Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), 21);
  }
  const monthStart = new Date(monthStartUTC - tzOff_);  // đổi về UTC thực
  const monthStartStr = Utilities.formatDate(monthStart, DR_TZ, "dd/MM/yyyy");
  // monthStart giờ Myanmar: ngày 21 đầu kỳ

  // A. Task remain
  const taskRemain = {}, techDeps = {};
  const rptSh = drGid(ss, DR_REPORT_GID);
  if (rptSh && rptSh.getLastRow() >= 4) {
    const raw = rptSh.getRange(1,1,rptSh.getLastRow(),5).getValues();
    for (let i=3; i<raw.length; i++) {
      const rn=i+1;
      const A=str(raw[i][0]), B=str(raw[i][1]), C=str(raw[i][2]),
            D=str(raw[i][3]), E=str(raw[i][4]);
      if      (rn>=4  && rn<=32 && A && B)                         taskRemain[B]       = {team:A, role:"Nhân viên",   chat_id:E, wo:D};
      else if (rn>=33 && rn<=55 && /Team leader/i.test(C) && A)    taskRemain[B||C]    = {team:A, role:"Team Leader", chat_id:E, wo:D};
      else if (rn===63 && E)                                        taskRemain["BOD"]   = {team:"Management", role:"BOD",          chat_id:E, wo:""};
      else if (rn===65 && E)                                        taskRemain["DutyMgr"]= {team:"Management", role:"Duty Manager", chat_id:E, wo:""};
      else if (rn>=75 && rn<=87 && C && E)                         techDeps[C]         = {chat_id:E, content:D};
    }
  }

  // B. Search stats
  const srch = {}, logSh = ss.getSheetByName(DR_SEARCH_LOG);
  if (logSh && logSh.getLastRow() >= 2) {
    const rows = logSh.getRange(2,1,logSh.getLastRow()-1,5).getValues();
    for (const r of rows) {
      const dt=str(r[0]), name=str(r[2]).toLowerCase();
      if (!name) continue;
      if (!srch[name]) srch[name]={today:0,d1:0,d2:0,week:0,month:0};
      const u=srch[name], pts=dt.split("/");
      if (pts.length!==3) continue;
      const rd=new Date(+pts[2],+pts[1]-1,+pts[0]), diff=now-rd;
      if (dt===todayStr)    u.today++;
      if (dt===d1Str)       u.d1++;
      if (dt===d2Str)       u.d2++;
      if (diff<=msWeek)     u.week++;           // 7 ngày liền kề
      if (rd>=monthStart)   u.month++;          // từ ngày 1 tháng này
    }
  }

  // C. Input task (task done/total per dep)
  const taskStats = {};
  const inpSh = drGid(ss, DR_INPUT_GID);
  if (inpSh && inpSh.getLastRow() >= 2) {
    const rows = inpSh.getRange(2,1,inpSh.getLastRow()-1,10).getValues();
    for (const r of rows) {
      const dep=str(r[1]), con=str(r[3]), done=str(r[9]);
      if (!dep||!con) continue;
      if (!taskStats[dep]) taskStats[dep]={total:0,done:0,remain:0};
      taskStats[dep].total++;
      if (done) taskStats[dep].done++; else taskStats[dep].remain++;
    }
  }

  // D. Asset stats
  const assetStats = {};
  const dataSh = ss.getSheetByName(DR_DATA_TAB);
  if (dataSh && dataSh.getLastRow() >= 2) {
    // Action types
    const ats=[], cfgSh=ss.getSheetByName(DR_CFG_TAB);
    if (cfgSh && cfgSh.getLastRow()>=2) {
      cfgSh.getRange(2,1,cfgSh.getLastRow()-1,1).getValues().forEach(r=>{
        const v=str(r[0]); if(!v) return;
        const t=v.split(":")[0].trim(); if(t&&!ats.includes(t)) ats.push(t);
      });
    }
    if (!ats.length) ["Order","Revoke","Export","Move","Asset Sent","Destroys"].forEach(t=>ats.push(t));

    // chat_id → team
    const id2team={};
    for (const [,info] of Object.entries(taskRemain)) if(info.chat_id&&info.team) id2team[info.chat_id]=info.team;

    const tzOff=6.5*3600000;
    const todayMs=new Date(Math.floor((now.getTime()+tzOff)/86400000)*86400000-tzOff);
    const rows=dataSh.getRange(2,1,dataSh.getLastRow()-1,5).getValues();
    for (const r of rows) {
      const chatId=str(r[2]), content=str(r[3]), doneV=str(r[4]);
      if (!content) continue;
      const at=content.split(":")[0].trim();
      if (!ats.includes(at)) continue;
      const team=id2team[chatId]; if(!team) continue;
      if (!assetStats[team]) assetStats[team]={};
      if (!assetStats[team][at]) assetStats[team][at]={d0:0,d1:0,d2:0,week:0,month:0,total:0,done:0};
      const s=assetStats[team][at]; s.total++; if(doneV) s.done++;
      let rd=null;
      if (r[1] instanceof Date) rd=r[1];
      else if (r[1]) {
        // Tách date từ "DD/MM/YYYY HH:MM" (collector lưu cả giờ)
        const dateStr = r[1].toString().split(' ')[0];
        const p = dateStr.split('/');
        if (p.length === 3) rd = new Date(parseInt(p[2]), parseInt(p[1])-1, parseInt(p[0]));
      }
      if (!rd) continue;
      const ds=Utilities.formatDate(rd,DR_TZ,"dd/MM/yyyy"), df=todayMs-rd.getTime();
      if(ds===todayStr)  s.d0++;   if(ds===d1Str)   s.d1++;  if(ds===d2Str) s.d2++;
      if(df<=msWeek)     s.week++;                                 // 7 ngày liền kề
      if(rd>=monthStart) s.month++;                               // từ ngày 1 tháng này
    }
  }

  return {now, todayStr, d1Str, d2Str, monthStart, monthStartStr, taskRemain, techDeps, taskStats, srch, assetStats};
}

// ═════════════════════════════════════════════════════════════
// XÂY DỰNG RAW DATA SHEET
// ═════════════════════════════════════════════════════════════
function drBuildRaw(ss, d) {
  const {now, taskRemain, techDeps, taskStats, srch, assetStats} = d;
  const dg = Utilities.formatDate(now, DR_TZ, "dd/MM/yyyy HH:mm");

  let sh = ss.getSheetByName(DR_RAW_NAME);
  if (sh) ss.deleteSheet(sh);
  sh = ss.insertSheet(DR_RAW_NAME);

  const HDR = ["Ngày","Loại","Tên / Phòng ban","Đội","Vai trò",
               "Search D-2","Search D-1","Search HN","Search 7Ngày","Search 1Tháng","Search 3Ngày",
               "Asset Loại","Asset D-2","Asset D-1","Asset HN","Asset 7Ngày","Asset 1Tháng","Asset Tổng","Asset Done",
               "Task Tổng","Task Xong","Còn lại","% Done","WO/Nội dung"];
  const NC = HDR.length;
  const rows = [];

  // Nhân viên + Leader
  for (const [name, info] of Object.entries(taskRemain)) {
    if (!["Nhân viên","Team Leader"].includes(info.role)) continue;
    const s=srch[name.toLowerCase()]||{};
    const [d2,d1,td,wk,mo]=[s.d2||0,s.d1||0,s.today||0,s.week||0,s.month||0];
    rows.push([dg,info.role,name,info.team,info.role, d2,d1,td,wk,mo,`${d2}/${d1}/${td}`,
               "",0,0,0,0,0,0,0, 0,0,0,"", info.wo||""]);
  }

  // Đội tổng hợp
  const tAgg={};
  for (const [name, info] of Object.entries(taskRemain)) {
    if (!["Nhân viên","Team Leader"].includes(info.role)) continue;
    const s=srch[name.toLowerCase()]||{};
    if (!tAgg[info.team]) tAgg[info.team]={d2:0,d1:0,today:0,week:0,month:0};
    const t=tAgg[info.team];
    t.d2+=s.d2||0; t.d1+=s.d1||0; t.today+=s.today||0; t.week+=s.week||0; t.month+=s.month||0;
  }
  for (const [team, ts] of Object.entries(tAgg)) {
    const tA=assetStats[team]||{};
    const atList=Object.keys(tA);
    if (!atList.length) {
      rows.push([dg,"Đội",team,team,"Tổng đội", ts.d2,ts.d1,ts.today,ts.week,ts.month,`${ts.d2}/${ts.d1}/${ts.today}`,
                 "Tất cả",0,0,0,0,0,0,0, 0,0,0,"",""]);
    } else {
      for (const at of atList) {
        const a=tA[at];
        rows.push([dg,"Đội",team,team,"Tổng đội", ts.d2,ts.d1,ts.today,ts.week,ts.month,`${ts.d2}/${ts.d1}/${ts.today}`,
                   at,a.d2,a.d1,a.d0,a.week,a.month,a.total,a.done, 0,0,0,a.total>0?Math.round(a.done/a.total*100)+"%":"0%",""]);
      }
    }
  }

  // Technical Dep
  for (const [dep, info] of Object.entries(techDeps)) {
    const ts=taskStats[dep]||{total:0,done:0,remain:0};
    rows.push([dg,"Technical Dep",dep,"Technical","Technical Dep", 0,0,0,0,0,"",
               "",0,0,0,0,0,0,0,
               ts.total,ts.done,ts.remain, ts.total>0?Math.round(ts.done/ts.total*100)+"%":"0%",
               (info.content||"").substring(0,300)]);
  }

  // Ghi 1 lần
  const allData = [HDR].concat(rows);
  sh.getRange(1,1,allData.length,NC).setValues(allData);

  // Format tối thiểu (ít API call)
  sh.getRange(1,1,1,NC).setBackground("#1A237E").setFontColor("#FFFFFF").setFontWeight("bold").setWrap(true);
  sh.setRowHeight(1,48); sh.setFrozenRows(1); sh.setFrozenColumns(3);
  [140,110,200,200,110,70,70,80,80,80,160,110,70,70,80,80,80,75,75,80,75,80,80,260]
    .forEach((w,i)=>sh.setColumnWidth(i+1,w));

  SpreadsheetApp.flush();
}

// ═════════════════════════════════════════════════════════════
// XÂY DỰNG DASHBOARD (chỉ bảng, không chart)
// ═════════════════════════════════════════════════════════════
function drBuildDash(ss, d) {
  const {now, taskRemain, techDeps, taskStats, srch, assetStats, monthStartStr} = d;
  const dg = Utilities.formatDate(now, DR_TZ, "dd/MM/yyyy HH:mm");
  const todayStr2 = Utilities.formatDate(now, DR_TZ, "dd/MM/yyyy");

  let sh = ss.getSheetByName(DR_DASH_NAME);
  if (sh) ss.deleteSheet(sh);
  sh = ss.insertSheet(DR_DASH_NAME);

  const NC = 12;
  const allRows   = [];   // dữ liệu
  const bgRows    = [];   // màu nền theo dòng
  const boldRows  = [];   // dòng in đậm
  const mergeRows = [];   // dòng merge
  const hRows     = [];   // dòng header bảng

  function push(data, bg, bold, merge, isHeader) {
    while (data.length < NC) data.push("");
    allRows.push(data.slice(0,NC));
    bgRows.push(bg||"#FFFFFF");
    boldRows.push(!!bold);
    mergeRows.push(!!merge);
    hRows.push(!!isHeader);
  }

  // TIÊU ĐỀ
  push(["📊  DASHBOARD BÁO CÁO TNI  —  "+dg], "#0D47A1", true, true);
  push(["Kỳ báo cáo:   3 Ngày (D-2/D-1/HN)   |   7 Ngày liền kề   |   1 Tháng: "+monthStartStr+" → "+todayStr2],
       "#E8EAF6", false, true);
  push(["→ Dùng sheet 'Dashboard Raw'  +  Data → Add a slicer  để lọc"], "#F5F5F5", false, true);
  push([""], "#FFFFFF");

  // ── SECTION 1: TỪNG NGƯỜI ──────────────────────────────────
  push(["🔍  1.  THỐNG KÊ TÌM KIẾM — TỪNG NGƯỜI"], "#1B5E20", true, true);
  push(["STT","Họ tên","Đội","Vai trò","3Ngày (D-2/D-1/HN)","D-2","D-1","Hôm nay","7 Ngày","1 Tháng","",""],
       "#2E7D32", true, false, true);

  const s1Start = allRows.length + 1;
  let stt=1;
  const teamAgg={};

  for (const [name, info] of Object.entries(taskRemain)) {
    if (!["Nhân viên","Team Leader"].includes(info.role)) continue;
    const s=srch[name.toLowerCase()]||{};
    const [d2,d1,td,wk,mo]=[s.d2||0,s.d1||0,s.today||0,s.week||0,s.month||0];
    const isL = info.role==="Team Leader";
    push([stt++,name,info.team,info.role,`${d2}/${d1}/${td}`,d2,d1,td,wk,mo,"",""],
         isL?"#DCEEFB":"#FFFFFF", isL);
    if (!teamAgg[info.team]) teamAgg[info.team]={d2:0,d1:0,today:0,week:0,month:0,count:0};
    const t=teamAgg[info.team]; t.d2+=d2;t.d1+=d1;t.today+=td;t.week+=wk;t.month+=mo;t.count++;
  }
  const s1End = allRows.length;

  // Dòng tổng S1
  push(["TỔNG","","","","",
    `=SUM(F${s1Start}:F${s1End})`,`=SUM(G${s1Start}:G${s1End})`,`=SUM(H${s1Start}:H${s1End})`,
    `=SUM(I${s1Start}:I${s1End})`,`=SUM(J${s1Start}:J${s1End})`,"",""],
    "#A5D6A7", true);
  push([""], "#FFFFFF");

  // ── SECTION 2: THEO ĐỘI ──────────────────────────────────
  push(["🏷️  2.  THỐNG KÊ TÌM KIẾM — THEO ĐỘI"], "#0277BD", true, true);
  push(["STT","Tên Đội","Số TV","3Ngày (D-2/D-1/HN)","D-2","D-1","Hôm nay","7 Ngày","1 Tháng","","",""],
       "#0288D1", true, false, true);

  const s2Start = allRows.length+1;
  let stt2=1;
  for (const [team, t] of Object.entries(teamAgg)) {
    push([stt2++,team,t.count,`${t.d2}/${t.d1}/${t.today}`,t.d2,t.d1,t.today,t.week,t.month,"","",""],
         "#FFFFFF");
  }
  const s2End = allRows.length;
  push(["TỔNG","",`=SUM(C${s2Start}:C${s2End})`,"",
    `=SUM(E${s2Start}:E${s2End})`,`=SUM(F${s2Start}:F${s2End})`,`=SUM(G${s2Start}:G${s2End})`,
    `=SUM(H${s2Start}:H${s2End})`,`=SUM(I${s2Start}:I${s2End})`,"","",""],
    "#81D4FA", true);
  push([""], "#FFFFFF");

  // ── SECTION 3: ASSET ──────────────────────────────────────
  push(["📦  3.  THỐNG KÊ ASSET — THEO ĐỘI & LOẠI"], "#BF360C", true, true);
  push(["STT","Đội","Loại Asset","3Ngày (D-2/D-1/HN)","D-2","D-1","Hôm nay","7 Ngày","1 Tháng","Tổng","Xong","% Done"],
       "#E64A19", true, false, true);

  let stt3=1;
  const assetGrand={};
  for (const [team, actions] of Object.entries(assetStats)) {
    for (const [at, a] of Object.entries(actions)) {
      const pct=a.total>0?Math.round(a.done/a.total*100)+"%":"—";
      push([stt3++,team,at,`${a.d2}/${a.d1}/${a.d0}`,a.d2,a.d1,a.d0,a.week,a.month,a.total,a.done,pct],
           "#FFFFFF");
      if (!assetGrand[at]) assetGrand[at]={d0:0,d1:0,d2:0,week:0,month:0,total:0,done:0};
      const g=assetGrand[at];
      g.d0+=a.d0;g.d1+=a.d1;g.d2+=a.d2;g.week+=a.week;g.month+=a.month;g.total+=a.total;g.done+=a.done;
    }
  }
  // Grand total
  push(["▶ TỔNG TẤT CẢ TEAM","","","","","","","","","","",""], "#FF8A65", true, true);
  for (const [at, g] of Object.entries(assetGrand)) {
    const pct=g.total>0?Math.round(g.done/g.total*100)+"%":"—";
    push(["→","ALL",at,`${g.d2}/${g.d1}/${g.d0}`,g.d2,g.d1,g.d0,g.week,g.month,g.total,g.done,pct],
         "#FFCCBC", true);
  }
  push([""], "#FFFFFF");

  // ── SECTION 4: TECHNICAL DEP ─────────────────────────────
  push(["🔧  4.  TECHNICAL DEP — TASK PROGRESS  (Rows 75-87)"], "#4A148C", true, true);
  push(["STT","Phòng ban","Task Tổng","Task Xong","Còn lại","% Done","3Day (D-2/D-1/HN)","7 Day","1 Month","Nội dung","",""],
       "#6A1B9A", true, false, true);

  let stt4=1, allTot=0, allDone=0, allRem=0;
  for (const [dep, info] of Object.entries(techDeps)) {
    const ts=taskStats[dep]||{total:0,done:0,remain:0};
    const pct=ts.total>0?Math.round(ts.done/ts.total*100)+"%":"—";
    const cnt=info.content||"";
    const m3=cnt.match(/3\s*day[:\s]+([0-9/]+)/i);
    const m7=cnt.match(/7\s*day[:\s]+([0-9]+)/i);
    const mM=cnt.match(/month[:\s]+([0-9]+)/i);
    push([stt4++,dep,ts.total,ts.done,ts.remain,pct,
          m3?m3[1]:"0/0/0", m7?m7[1]:"0", mM?mM[1]:"0",
          cnt.substring(0,200),"",""], "#FFFFFF");
    allTot+=ts.total; allDone+=ts.done; allRem+=ts.remain;
  }
  const allPct=allTot>0?Math.round(allDone/allTot*100)+"%":"—";
  push(["TỔNG","ALL",allTot,allDone,allRem,allPct,"","","","","",""], "#CE93D8", true);

  // ── BATCH WRITE ───────────────────────────────────────────
  sh.getRange(1,1,allRows.length,NC).setValues(allRows);

  // Màu nền — nhóm liên tiếp để giảm API call
  let pBg=null, pStart=1, pCount=0;
  for (let i=0; i<bgRows.length; i++) {
    const bg=bgRows[i];
    if (bg===pBg) { pCount++; }
    else { if(pBg&&pBg!=="#FFFFFF") sh.getRange(pStart,1,pCount,NC).setBackground(pBg); pBg=bg; pStart=i+1; pCount=1; }
  }
  if (pBg&&pBg!=="#FFFFFF") sh.getRange(pStart,1,pCount,NC).setBackground(pBg);

  // Font color trắng cho header/section rows
  const whiteIdxs = allRows.map((_,i)=>i).filter(i => boldRows[i] &&
    ["#0D47A1","#1B5E20","#0277BD","#BF360C","#4A148C",
     "#2E7D32","#0288D1","#E64A19","#6A1B9A","#FF8A65"].includes(bgRows[i]));
  if (whiteIdxs.length) {
    // Gom thành range liên tục
    let wi=0;
    while (wi<whiteIdxs.length) {
      let start=whiteIdxs[wi], cnt=1;
      while (wi+cnt<whiteIdxs.length && whiteIdxs[wi+cnt]===start+cnt) cnt++;
      sh.getRange(start+1,1,cnt,NC).setFontColor("#FFFFFF").setFontWeight("bold");
      wi+=cnt;
    }
  }

  // Bold normal rows
  const boldIdxs = allRows.map((_,i)=>i).filter(i=>boldRows[i] && !whiteIdxs.includes(i));
  boldIdxs.forEach(i=>sh.getRange(i+1,1,1,NC).setFontWeight("bold"));

  // Merge tiêu đề + section
  mergeRows.forEach((m,i)=>{ if(m) sh.getRange(i+1,1,1,NC).mergeAcross(); });

  // Row heights cho tiêu đề
  sh.setRowHeight(1,44); sh.setRowHeight(2,26); sh.setRowHeight(3,26);

  // Độ rộng cột
  [50,200,200,120,190,75,75,90,90,90,80,90].forEach((w,i)=>sh.setColumnWidth(i+1,w));

  sh.setFrozenRows(4);
  sh.getRange(1,1,allRows.length,NC)
    .setVerticalAlignment("middle").setFontFamily("Arial").setFontSize(10);

  SpreadsheetApp.flush();

  // Lưu metadata để bước 2 dùng
  const meta = ss.getSheetByName("_meta_") || ss.insertSheet("_meta_");
  meta.hideSheet();
  meta.getRange("A1").setValue(JSON.stringify({s1Start, s1End}));

  ss.setActiveSheet(sh);
  ss.moveActiveSheet(1);
  return sh;
}

// ═════════════════════════════════════════════════════════════
// VẼ BIỂU ĐỒ (BƯỚC 2 — chạy riêng)
// ═════════════════════════════════════════════════════════════
function drBuildCharts(ss, dashSh, d) {
  const {taskRemain, techDeps, taskStats, srch, assetStats} = d;

  // Xóa chart cũ
  dashSh.getCharts().forEach(c=>dashSh.removeChart(c));

  // Sheet temp cho chart data
  let tmpSh = ss.getSheetByName("_ChartData_");
  if (tmpSh) ss.deleteSheet(tmpSh);
  tmpSh = ss.insertSheet("_ChartData_");
  tmpSh.hideSheet();

  let tRow=1;

  // ── Chart 1: Search theo Đội ─────────────────────────────
  const teamChartData=[];
  const tAgg={};
  for (const [name, info] of Object.entries(taskRemain)) {
    if (!["Nhân viên","Team Leader"].includes(info.role)) continue;
    const s=srch[name.toLowerCase()]||{};
    if (!tAgg[info.team]) tAgg[info.team]={week:0,month:0};
    tAgg[info.team].week+=s.week||0; tAgg[info.team].month+=s.month||0;
  }
  for (const [team,t] of Object.entries(tAgg)) teamChartData.push([team,t.week,t.month]);

  if (teamChartData.length>0) {
    tmpSh.getRange(tRow,1,1,3).setValues([["Đội","7 Ngày","1 Tháng"]]);
    tmpSh.getRange(tRow+1,1,teamChartData.length,3).setValues(teamChartData);
    dashSh.insertChart(dashSh.newChart().setChartType(Charts.ChartType.BAR)
      .addRange(tmpSh.getRange(tRow,1,teamChartData.length+1,3))
      .setPosition(5,14,5,5)
      .setOption("title","🔍 Search theo Đội — 7Ngày & 1Tháng")
      .setOption("width",480).setOption("height",250)
      .setOption("legend",{position:"top"}).setOption("colors",["#1565C0","#42A5F5"])
      .build());
    tRow+=teamChartData.length+3;
  }

  // ── Chart 2: Asset theo Đội (Pie) ───────────────────────
  const assetChartData=[];
  for (const [team, actions] of Object.entries(assetStats)) {
    const tot=Object.values(actions).reduce((s,a)=>s+a.total,0);
    if (tot>0) assetChartData.push([team,tot]);
  }
  if (assetChartData.length>0) {
    tmpSh.getRange(tRow,1,1,2).setValues([["Đội","Tổng Asset"]]);
    tmpSh.getRange(tRow+1,1,assetChartData.length,2).setValues(assetChartData);
    dashSh.insertChart(dashSh.newChart().setChartType(Charts.ChartType.PIE)
      .addRange(tmpSh.getRange(tRow,1,assetChartData.length+1,2))
      .setPosition(20,14,5,5)
      .setOption("title","📦 Asset — Phân bổ theo Đội")
      .setOption("width",460).setOption("height",250).setOption("pieHole",0.4)
      .setOption("legend",{position:"right"})
      .build());
    tRow+=assetChartData.length+3;
  }

  // ── Chart 3: Technical Dep (Stacked Bar) ─────────────────
  const techChartData=[];
  for (const [dep] of Object.entries(techDeps)) {
    const ts=taskStats[dep]||{total:0,done:0,remain:0};
    if (ts.total>0) techChartData.push([dep,ts.done,ts.remain]);
  }
  if (techChartData.length>0) {
    tmpSh.getRange(tRow,1,1,3).setValues([["Phòng ban","Xong","Còn lại"]]);
    tmpSh.getRange(tRow+1,1,techChartData.length,3).setValues(techChartData);
    dashSh.insertChart(dashSh.newChart().setChartType(Charts.ChartType.BAR)
      .addRange(tmpSh.getRange(tRow,1,techChartData.length+1,3))
      .setPosition(37,14,5,5)
      .setOption("title","🔧 Technical Dep — Xong vs Còn lại")
      .setOption("width",480).setOption("height",280).setOption("isStacked",true)
      .setOption("legend",{position:"top"}).setOption("colors",["#2E7D32","#EF5350"])
      .build());
  }

  SpreadsheetApp.flush();
}

// ─── HELPERS ──────────────────────────────────────────────────
function str(v) { return (v||"").toString().trim(); }
function drGid(ss, gid) { return ss.getSheets().find(s=>s.getSheetId().toString()===gid)||null; }

// ─── TRIGGER ──────────────────────────────────────────────────
function drSetupTrigger() {
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==="drStep1_BuildTables")
    .forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("drStep1_BuildTables").timeBased().atHour(11).everyDays(1).create();
  SpreadsheetApp.getUi().alert("✅ Auto trigger đã bật!\nBảng tự động cập nhật mỗi ngày ~18:00 MMT.");
}
function drRemoveTrigger() {
  let n=0;
  ScriptApp.getProjectTriggers().filter(t=>["drStep1_BuildTables","buildDashboardReport"].includes(t.getHandlerFunction()))
    .forEach(t=>{ScriptApp.deleteTrigger(t);n++;});
  SpreadsheetApp.getUi().alert("🗑️ Đã xóa "+n+" trigger.");
}
