const 取得 = (識別) => document.getElementById(識別);
// 只可填入公開金鑰，絕對不可放入管理員或伺服器密鑰。
const 驗證設定 = { 網址: '', 公開金鑰: '' };
// 只有完全尚未設定時使用原本的本機模式；設定錯誤或斷線不可繞過登入。
const 本機模式 = !驗證設定.網址 && !驗證設定.公開金鑰;
let 驗證服務;
let 工作台;
let 目前使用者 = null;
let 驗證序號 = 0;
let 驗證中 = false;
let 主動登出 = false;
try { 主動登出 = localStorage.getItem('小日常登入鎖定') === '是'; } catch { 主動登出 = true; }

function 登入訊息(文字) { 取得('auth-message').textContent = 文字; }
function 鎖定工作台() {
  取得('protected-app').hidden = true;
  取得('protected-app').inert = true;
  取得('auth-screen').hidden = false;
  document.querySelectorAll('dialog[open]').forEach(視窗 => 視窗.close());
  取得('auth-account').textContent = '';
}
function 清除登入畫面資料() {
  目前使用者 = null;
  工作台?.清空();
  鎖定工作台();
}
function 設定路徑(路徑) {
  // 片段網址可直接從本地檔案開啟，不需要伺服器轉址規則。
  if (location.hash !== 路徑) location.replace(路徑);
}
async function 檢查登入() {
  if (!驗證服務 || 主動登出 || 驗證中) return;
  const 本次序號 = ++驗證序號;
  驗證中 = true;
  鎖定工作台();
  登入訊息('正在確認登入狀態…');
  try {
    // 向驗證伺服器確認身分，不只相信瀏覽器保存的登入資訊。
    const { data, error } = await 驗證服務.auth.getUser();
    if (本次序號 !== 驗證序號 || 主動登出) return;
    if (error || !data.user || data.user.is_anonymous) {
      清除登入畫面資料();
      設定路徑('#login');
      登入訊息(error && error.name !== 'AuthSessionMissingError' ? '無法確認登入狀態，請重新登入或檢查連線。' : '請輸入電子郵件與密碼。');
      return;
    }
    if (!工作台) 工作台 = 建立工作台();
    if (目前使用者 !== data.user.id) 工作台.載入(data.user.id);
    目前使用者 = data.user.id;
    取得('auth-account').textContent = data.user.email || '已登入';
    取得('auth-screen').hidden = true;
    取得('protected-app').hidden = false;
    取得('protected-app').inert = false;
    設定路徑('#records');
  } catch {
    if (本次序號 !== 驗證序號) return;
    清除登入畫面資料();
    登入訊息('目前無法連線，工作台已鎖定。請檢查網路後重試。');
  } finally { 驗證中 = false; }
}
async function 準備驗證() {
  if (本機模式) {
    if (!工作台) { 工作台 = 建立工作台(); 工作台.載入(); }
    取得('auth-screen').hidden = true;
    取得('protected-app').hidden = false;
    取得('protected-app').inert = false;
    取得('auth-account').textContent = '本機模式・尚未啟用登入保護';
    取得('auth-signout').hidden = true;
    取得('local-mode-notice').hidden = false;
    設定路徑('#records');
    return;
  }
  鎖定工作台();
  if (!驗證設定.網址 || !驗證設定.公開金鑰) {
    登入訊息('尚未連接雲端專案，請先完成專案設定。');
    return;
  }
  取得('auth-retry').disabled = true;
  try {
    if (!驗證服務) {
      // 固定套件版本，並用外部指令碼支援直接開啟本地網頁。
      if (!window.supabase) await new Promise((完成, 失敗) => {
        const 套件 = document.createElement('script');
        套件.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js';
        const 計時 = setTimeout(() => 失敗(new Error('載入逾時')), 15000);
        套件.onload = () => { clearTimeout(計時); 完成(); };
        套件.onerror = () => { clearTimeout(計時); 失敗(new Error('無法載入登入套件')); };
        document.head.append(套件);
      });
      驗證服務 = window.supabase.createClient(驗證設定.網址, 驗證設定.公開金鑰, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        global: { fetch: (網址, 選項 = {}) => fetch(網址, { ...選項, signal: AbortSignal.timeout(15000) }) }
      });
      驗證服務.auth.onAuthStateChange((事件, 登入資料) => {
        // 回呼內不等待其他驗證呼叫，避免驗證套件的鎖定互相等待。
        if (!登入資料) {
          ++驗證序號;
          清除登入畫面資料();
          設定路徑('#login');
          登入訊息('請登入後使用工作台。');
        } else if (!主動登出 && !驗證中) setTimeout(檢查登入, 0);
      });
    }
    取得('auth-submit').disabled = false;
    if (主動登出) 登入訊息('工作台已鎖定，請重新登入。');
    await 檢查登入();
  } catch { 登入訊息('登入服務無法載入，請檢查網路並重新檢查連線。'); }
  finally { 取得('auth-retry').disabled = false; }
}
取得('auth-form').addEventListener('submit', async 事件 => {
  事件.preventDefault();
  if (!驗證服務 || 取得('auth-submit').disabled) return;
  取得('auth-submit').disabled = true;
  登入訊息('登入中…');
  try {
    const { error } = await 驗證服務.auth.signInWithPassword({ email: 取得('auth-email').value.trim(), password: 取得('auth-password').value });
    if (error) { 登入訊息('登入失敗，請確認帳號、密碼與信箱驗證狀態，稍後再試。'); return; }
    主動登出 = false;
    try { localStorage.setItem('小日常登入鎖定', '否'); } catch { /* 無法保存時，重新開啟仍須登入。 */ }
    await 檢查登入();
  } catch { 登入訊息('目前無法登入，請檢查網路後重試。'); }
  finally { 取得('auth-password').value = ''; 取得('auth-submit').disabled = false; }
});
取得('auth-signout').addEventListener('click', async () => {
  if (本機模式) return;
  主動登出 = true;
  try { localStorage.setItem('小日常登入鎖定', '是'); } catch { /* 本次頁面仍維持鎖定。 */ }
  ++驗證序號;
  清除登入畫面資料();
  設定路徑('#login');
  try {
    const { error } = await 驗證服務.auth.signOut({ scope: 'local' });
    登入訊息(error ? '工作台已鎖定，但登出未完成。請恢復連線後重新登入。' : '你已登出。');
  } catch { 登入訊息('工作台已鎖定，但登出未完成。請恢復連線後重新登入。'); }
});
取得('auth-retry').addEventListener('click', 準備驗證);
window.addEventListener('hashchange', () => {
  if (本機模式) { 設定路徑('#records'); return; }
  if (目前使用者 && location.hash === '#records') return;
  if (!目前使用者 && location.hash === '#login') return;
  檢查登入();
});
window.addEventListener('online', 檢查登入);
window.addEventListener('offline', () => { if (本機模式) return; ++驗證序號; 清除登入畫面資料(); 登入訊息('網路已中斷，請恢復連線後繼續。'); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) 檢查登入(); });
window.addEventListener('pageshow', 事件 => { if (事件.persisted) 檢查登入(); });
準備驗證();

function 建立工作台() {
const 取得 = (識別) => document.getElementById(識別);
let 儲存鍵 = '';
const 狀態選項 = { arrival: ['尚未到班', '已到班', '已離班', '請假'], homework: ['未開始', '進行中', '已完成', '免做'], assessment: ['未開始', '進行中', '已完成', '免做'] };
let 資料 = { version: 1, students: [], days: {} };
let 篩選 = 'all';
let 編輯編號 = null;
let 通知計時;
let 允許儲存 = true;

// 使用本地日期，避免午夜附近被時差切換到前一天。
function 今日() { const 時間 = new Date(); return `${時間.getFullYear()}-${String(時間.getMonth() + 1).padStart(2, '0')}-${String(時間.getDate()).padStart(2, '0')}`; }
取得('record-date').value = 今日();
function 通知(內容) { 取得('toast').textContent = 內容; 取得('toast').hidden = false; clearTimeout(通知計時); 通知計時 = setTimeout(() => 取得('toast').hidden = true, 3500); }
function 日期有效(日期) { return typeof 日期 === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(日期) && !Number.isNaN(new Date(日期).getTime()) && new Date(日期).toISOString().slice(0, 10) === 日期; }
// 還原前先檢查每筆資料，避免格式不符的檔案蓋過原有紀錄。
function 資料有效(內容) {
  if (!內容 || 內容.version !== 1 || !Array.isArray(內容.students) || !內容.days || typeof 內容.days !== 'object' || Array.isArray(內容.days)) return false;
  const 編號集合 = new Set();
  for (const 學生 of 內容.students) {
    if (!學生 || typeof 學生.id !== 'string' || !/^s[\w-]+$/.test(學生.id) || 編號集合.has(學生.id) || typeof 學生.name !== 'string' || !學生.name.trim() || 學生.name.length > 30 || typeof 學生.grade !== 'string' || 學生.grade.length > 30 || !日期有效(學生.start)) return false;
    編號集合.add(學生.id);
  }
  return Object.entries(內容.days).every(([日期, 當日]) => 日期有效(日期) && 當日 && typeof 當日 === 'object' && !Array.isArray(當日) && Object.entries(當日).every(([編號, 紀錄]) => 編號集合.has(編號) && 紀錄 && ['arrival', 'homework', 'assessment'].every(項目 => Number.isInteger(紀錄[項目]) && 紀錄[項目] >= 0 && 紀錄[項目] < 4) && typeof 紀錄.note === 'string' && 紀錄.note.length <= 500));
}
function 保存() {
  try { if (!允許儲存) throw new Error('尚未開放儲存'); localStorage.setItem(儲存鍵, JSON.stringify(資料)); 取得('save-state').textContent = '所有變更已保存'; }
  catch { 取得('save-state').textContent = '尚未保存，請下載備份'; 通知('目前無法自動保存，請先下載全部資料備份。'); }
}
function 當日學生() { return 資料.students.filter(學生 => 學生.start <= 取得('record-date').value); }
function 讀取紀錄(編號) { return 資料.days[取得('record-date').value]?.[編號] || { arrival: 0, homework: 0, assessment: 0, note: '' }; }
function 修改紀錄(編號, 項目, 值) { const 日期 = 取得('record-date').value; 資料.days[日期] ||= {}; 資料.days[日期][編號] = { ...讀取紀錄(編號), [項目]: 值 }; 保存(); }
function 元素(標籤, 樣式, 文字) { const 節點 = document.createElement(標籤); if (樣式) 節點.className = 樣式; if (文字 !== undefined) 節點.textContent = 文字; return 節點; }
function 更新摘要() {
  const 學生們 = 當日學生();
  取得('total-count').textContent = 學生們.length;
  取得('arrival-total').textContent = `／ ${學生們.length} 位`;
  取得('arrival-count').textContent = 學生們.filter(學生 => [1, 2].includes(讀取紀錄(學生.id).arrival)).length;
  取得('homework-count').textContent = 學生們.filter(學生 => 讀取紀錄(學生.id).homework === 2).length;
  取得('assessment-count').textContent = 學生們.filter(學生 => 讀取紀錄(學生.id).assessment === 2).length;
}
function 顯示名單(恢復按鈕) {
  更新摘要();
  const 學生們 = 當日學生();
  const 關鍵字 = 取得('search').value.trim();
  const 顯示學生 = 學生們.filter(學生 => { const 紀錄 = 讀取紀錄(學生.id); return 學生.name.includes(關鍵字) && (篩選 === 'all' || (篩選 === 'pending' ? 紀錄.arrival === 0 : 紀錄.homework < 2 || 紀錄.assessment < 2)); });
  取得('list-count').textContent = `${學生們.length} 位`;
  取得('shown-count').textContent = `顯示 ${顯示學生.length} 位學生`;
  取得('day-label').textContent = new Date(取得('record-date').value + 'T12:00:00').toLocaleDateString('zh-TW', { weekday: 'long' }) + (取得('record-date').value === 今日() ? '・今天' : '・每日紀錄');
  const 容器 = 取得('student-rows'); 容器.replaceChildren();
  取得('empty-state').hidden = 顯示學生.length > 0;
  取得('empty-state').querySelector('h3').textContent = 學生們.length ? '沒有符合條件的學生' : '準備好記錄今天了嗎？';
  取得('empty-state').querySelector('p').textContent = 學生們.length ? '試著切換篩選條件，或輸入其他姓名。' : '點選「新增學生」建立名單，開始你的班級紀錄。';
  for (const 學生 of 顯示學生) {
    const 紀錄 = 讀取紀錄(學生.id); const 列 = 元素('tr'); const 姓名格 = 元素('td'); const 姓名區 = 元素('div', 'student-info');
    姓名區.append(元素('span', 'avatar', 學生.name.slice(-2)));
    const 姓名按鈕 = 元素('button', 'student-name', 學生.name); 姓名按鈕.title = '編輯學生資料'; 姓名按鈕.append(元素('small', '', 學生.grade || '尚未設定年級')); 姓名按鈕.addEventListener('click', () => 開啟學生(學生)); 姓名區.append(姓名按鈕); 姓名格.append(姓名區); 列.append(姓名格);
    for (const 項目 of ['arrival', 'homework', 'assessment']) {
      const 值 = 紀錄[項目]; const 樣式 = 值 === 3 ? 'leave' : 項目 === 'arrival' ? (值 > 0 ? 'good' : '') : (值 === 2 ? 'good' : 值 === 1 ? 'working' : '');
      const 按鈕 = 元素('button', `status ${樣式}`, 狀態選項[項目][值]); const 按鈕編號 = `${學生.id}-${項目}`; 按鈕.id = 按鈕編號;
      const 標題 = { arrival: '到班狀態', homework: '作業進度', assessment: '評量進度' }[項目];
      按鈕.setAttribute('aria-label', `${學生.name}的${標題}：${狀態選項[項目][值]}，點選改為${狀態選項[項目][(值 + 1) % 4]}`);
      按鈕.addEventListener('click', () => { 修改紀錄(學生.id, 項目, (值 + 1) % 4); 顯示名單(按鈕編號); });
      const 格 = 元素('td'); 格.append(按鈕); 列.append(格);
    }
    const 備註格 = 元素('td'); const 備註 = 元素('input', 'note'); 備註.value = 紀錄.note; 備註.placeholder = '記下提醒或今天的進步…'; 備註.maxLength = 500; 備註.setAttribute('aria-label', `${學生.name}的備註`); 備註.addEventListener('input', () => 修改紀錄(學生.id, 'note', 備註.value)); 備註格.append(備註); 列.append(備註格); 容器.append(列);
  }
  if (恢復按鈕) 取得(恢復按鈕)?.focus();
}
function 開啟學生(學生) { 編輯編號 = 學生?.id || null; 取得('dialog-title').textContent = 學生 ? '編輯學生資料' : '新增學生'; 取得('student-name').value = 學生?.name || ''; 取得('student-grade').value = 學生?.grade || ''; 取得('student-dialog').showModal(); 取得('student-name').focus(); }
取得('add-student').addEventListener('click', () => 開啟學生());
取得('close-dialog').addEventListener('click', () => 取得('student-dialog').close());
取得('student-form').addEventListener('submit', 事件 => { 事件.preventDefault(); const 姓名 = 取得('student-name').value.trim(); if (!姓名) { 取得('student-name').focus(); return; } const 年級 = 取得('student-grade').value.trim(); if (編輯編號) { Object.assign(資料.students.find(學生 => 學生.id === 編輯編號), { name: 姓名, grade: 年級 }); } else { 資料.students.push({ id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9), name: 姓名, grade: 年級, start: 取得('record-date').value }); } 保存(); 顯示名單(); 取得('student-dialog').close(); 通知(編輯編號 ? '學生資料已更新' : '已加入學生名單'); });
取得('record-date').addEventListener('change', () => { if (!日期有效(取得('record-date').value)) 取得('record-date').value = 今日(); 顯示名單(); });
function 換日(差值) { const 日期 = new Date(取得('record-date').value + 'T12:00:00'); 日期.setDate(日期.getDate() + 差值); const 新日期 = `${日期.getFullYear()}-${String(日期.getMonth() + 1).padStart(2, '0')}-${String(日期.getDate()).padStart(2, '0')}`; if (日期有效(新日期)) { 取得('record-date').value = 新日期; 顯示名單(); } }
取得('previous-day').addEventListener('click', () => 換日(-1)); 取得('next-day').addEventListener('click', () => 換日(1)); 取得('today').addEventListener('click', () => { 取得('record-date').value = 今日(); 顯示名單(); });
取得('search').addEventListener('input', () => 顯示名單());
document.querySelectorAll('[data-filter]').forEach(按鈕 => 按鈕.addEventListener('click', () => { 篩選 = 按鈕.dataset.filter; document.querySelectorAll('[data-filter]').forEach(選項 => { 選項.classList.toggle('active', 選項 === 按鈕); 選項.setAttribute('aria-pressed', String(選項 === 按鈕)); }); 顯示名單(); }));
取得('mark-arrived').addEventListener('click', () => { const 待到學生 = 當日學生().filter(學生 => 讀取紀錄(學生.id).arrival === 0); if (!待到學生.length) { 通知('目前沒有尚未到班的學生'); return; } if (!confirm(`將 ${取得('record-date').value} 的 ${待到學生.length} 位尚未到班學生標記為已到班？`)) return; const 日期 = 取得('record-date').value; 資料.days[日期] ||= {}; 待到學生.forEach(學生 => 資料.days[日期][學生.id] = { ...讀取紀錄(學生.id), arrival: 1 }); 保存(); 顯示名單(); 通知(`已將 ${待到學生.length} 位學生標記為到班`); });
function 下載(內容, 檔名, 類型) { const 網址 = URL.createObjectURL(new Blob([內容], { type: 類型 })); const 連結 = 元素('a'); 連結.href = 網址; 連結.download = 檔名; 連結.click(); setTimeout(() => URL.revokeObjectURL(網址), 1000); }
取得('backup').addEventListener('click', () => 下載(JSON.stringify(資料, null, 2), `小日常完整備份-${今日()}.json`, 'application/json'));
// 為表格文字加上引號，並阻止姓名、備註被試算表當成公式執行。
function 表格文字(文字) { let 值 = String(文字); if (/^[\s]*[=+@-]/.test(值)) 值 = "'" + 值; return '"' + 值.replaceAll('"', '""') + '"'; }
取得('export-record').addEventListener('click', () => { const 列們 = [['日期', '學生姓名', '年級／班別', '到班狀態', '作業進度', '評量進度', '備註']]; 當日學生().forEach(學生 => { const 紀錄 = 讀取紀錄(學生.id); 列們.push([取得('record-date').value, 學生.name, 學生.grade, 狀態選項.arrival[紀錄.arrival], 狀態選項.homework[紀錄.homework], 狀態選項.assessment[紀錄.assessment], 紀錄.note]); }); 下載('\uFEFF' + 列們.map(列 => 列.map(表格文字).join(',')).join('\r\n'), `班級紀錄-${取得('record-date').value}.csv`, 'text/csv;charset=utf-8'); });
取得('restore').addEventListener('click', () => 取得('restore-file').click());
取得('restore-file').addEventListener('change', async 事件 => { const 檔案 = 事件.target.files[0]; if (!檔案) return; try { if (檔案.size > 10000000) throw new Error('備份過大'); const 原本帳號 = 儲存鍵; const 備份 = JSON.parse(await 檔案.text()); if (!原本帳號 || 原本帳號 !== 儲存鍵 || (!目前使用者 && !本機模式)) return; if (!資料有效(備份)) throw new Error('備份格式不正確'); if (!confirm(`備份含 ${備份.students.length} 位學生，還原後將以備份取代目前紀錄。請先備份現有資料。確定還原？`)) return; 資料 = 備份; 允許儲存 = true; 保存(); 顯示名單(); 通知('備份已載入，請確認右上角儲存狀態'); } catch { 通知('無法還原：請選擇本站下載、格式完整且小於一千萬位元組的備份。'); } finally { 事件.target.value = ''; } });
顯示名單();

// 本次提供的名單只保留姓名與年級；不帶入卡號或家庭聯絡資料。
const 米豆奶名單 = [
  {
    "id": "smido448885b9dda9214e",
    "name": "黃苡喬",
    "grade": "國三"
  },
  {
    "id": "smido6741fb97575ed2bd",
    "name": "盧柏澄",
    "grade": "高二"
  },
  {
    "id": "smido800b4579b89cc377",
    "name": "劉芷涵",
    "grade": "高三"
  },
  {
    "id": "smido70f2ff9c4f1d9008",
    "name": "葉梓齊",
    "grade": "高二"
  },
  {
    "id": "smidof9649adae8467286",
    "name": "林千翔",
    "grade": "國一"
  },
  {
    "id": "smido77ec71799550d476",
    "name": "劉鐘謙",
    "grade": "大一"
  },
  {
    "id": "smidob63f51f7793c8c9b",
    "name": "劉千育",
    "grade": "國二"
  },
  {
    "id": "smido199e7a289452194a",
    "name": "洪子耘",
    "grade": "高三"
  },
  {
    "id": "smido5a3a5c93c2b4fe11",
    "name": "陳芓霖",
    "grade": "小六"
  },
  {
    "id": "smido61864ef5a7e21640",
    "name": "吳姍珊",
    "grade": "高三"
  },
  {
    "id": "smido022577e5a338d9d6",
    "name": "施維翰",
    "grade": "小六"
  },
  {
    "id": "smido1f909d8b2eaa37d1",
    "name": "林宥滕",
    "grade": "大三"
  },
  {
    "id": "smidoe3e20a2db8c1c924",
    "name": "廖珈葳",
    "grade": "小六"
  },
  {
    "id": "smido5e69699330aa06f9",
    "name": "廖禹琁",
    "grade": "小四"
  },
  {
    "id": "smido0e7314c1d453e590",
    "name": "簡禾聿",
    "grade": "小六"
  },
  {
    "id": "smido67f2a9fd6f2bd2a7",
    "name": "許棋皓",
    "grade": "國三"
  },
  {
    "id": "smido6d63d82ce2f5ca1c",
    "name": "蔡杰霆",
    "grade": "小六"
  },
  {
    "id": "smidoac6f8f34123baa19",
    "name": "張瑞洋",
    "grade": "國二"
  },
  {
    "id": "smido13fac69c051e108a",
    "name": "林煜豪",
    "grade": "小五"
  },
  {
    "id": "smido65d4233fd5d354d4",
    "name": "許媛欣",
    "grade": "國一"
  },
  {
    "id": "smido9bd08a515658e786",
    "name": "林泳萱",
    "grade": "高三"
  },
  {
    "id": "smido264212b721d087ad",
    "name": "劉守畯",
    "grade": "小六"
  },
  {
    "id": "smido0a134922440916d5",
    "name": "李品樂",
    "grade": "小五"
  },
  {
    "id": "smidob85c59ca8fb61537",
    "name": "徐遠達",
    "grade": "小五"
  },
  {
    "id": "smido2c6deab6a23e84f2",
    "name": "張瑀航",
    "grade": "國一"
  },
  {
    "id": "smido8686c76d502a3062",
    "name": "簡彤恩",
    "grade": "小三"
  },
  {
    "id": "smidoc3abf2adb5701aff",
    "name": "簡睿均",
    "grade": "高三"
  },
  {
    "id": "smidoee8acca08e2e0390",
    "name": "黎世棋",
    "grade": "小六"
  },
  {
    "id": "smidoabc5f0c978aac700",
    "name": "張榆旋",
    "grade": "國二"
  },
  {
    "id": "smidoa5e3c23d56c22e36",
    "name": "吳品辰",
    "grade": "小五"
  },
  {
    "id": "smidoe99f510f6b89ae63",
    "name": "楊翊",
    "grade": "小三"
  },
  {
    "id": "smidoae88b21e9ca05f65",
    "name": "蕭語璇",
    "grade": "高三"
  },
  {
    "id": "smido5ea48c6c50b7ab33",
    "name": "詹承濡",
    "grade": "國三"
  },
  {
    "id": "smidoc4fbd25d160d09fe",
    "name": "林栢緯",
    "grade": "小四"
  },
  {
    "id": "smido7bdc5cc32b980937",
    "name": "賴妍言",
    "grade": "國二"
  },
  {
    "id": "smido4dc17f640e382a7e",
    "name": "詹芷晴",
    "grade": "小六"
  },
  {
    "id": "smidoed50371bd08c7006",
    "name": "盧致勳",
    "grade": "小五"
  },
  {
    "id": "smido0a54b4a6bacec82d",
    "name": "許呈豪",
    "grade": "國三"
  },
  {
    "id": "smido057ef14abb2ff85c",
    "name": "葉煒恩",
    "grade": "國二"
  },
  {
    "id": "smido1cb689fdecf44a44",
    "name": "張宇慶",
    "grade": "小六"
  },
  {
    "id": "smido77b52de1897aa3ab",
    "name": "陳荺媃",
    "grade": "小五"
  },
  {
    "id": "smidocf3cccd0d2ec7ac4",
    "name": "蔣上云",
    "grade": "國三"
  },
  {
    "id": "smido0ada9f577baf8efb",
    "name": "賴妍安",
    "grade": "國一"
  },
  {
    "id": "smido0387f7f36c8526d3",
    "name": "賴妍榕",
    "grade": "小五"
  },
  {
    "id": "smido427bb291d44492db",
    "name": "陳可芯",
    "grade": "小四"
  },
  {
    "id": "smido20d6911fb932ca8c",
    "name": "劉芷彤",
    "grade": "國二"
  },
  {
    "id": "smido6e5d1a3c4bd57e42",
    "name": "李杰穎",
    "grade": "國三"
  },
  {
    "id": "smidofcb187807b14afc8",
    "name": "許詠甯",
    "grade": "國三"
  },
  {
    "id": "smidobb85bdd5564efaa1",
    "name": "連詠嫻",
    "grade": "國三"
  },
  {
    "id": "smidoe8b995688d6907d8",
    "name": "李芳綺",
    "grade": "國三"
  },
  {
    "id": "smidoaede4a49e6500042",
    "name": "黃彥棠",
    "grade": "高三"
  },
  {
    "id": "smido67fcab081e6143da",
    "name": "簡稚潔",
    "grade": "高三"
  },
  {
    "id": "smido390cd972eddf1d27",
    "name": "楊東澐",
    "grade": "小四"
  },
  {
    "id": "smido040e9b05b727157c",
    "name": "王心辰",
    "grade": "國一"
  },
  {
    "id": "smidod158e013118de08d",
    "name": "陳子閎",
    "grade": "小三"
  },
  {
    "id": "smidod471929365c20eca",
    "name": "曾禹新",
    "grade": "小三"
  },
  {
    "id": "smidoc981d6860b27a1c3",
    "name": "鄧喆恩",
    "grade": "小三"
  },
  {
    "id": "smidoc63d48d49c4013bf",
    "name": "陳采婕",
    "grade": "國一"
  },
  {
    "id": "smidof62b73713eba9e96",
    "name": "梅茹漩",
    "grade": "小四"
  },
  {
    "id": "smidoafef9fcee3b667b1",
    "name": "羅璽恩",
    "grade": "國一"
  },
  {
    "id": "smido74d72bde739a9dc2",
    "name": "吳昱陞",
    "grade": "國三"
  },
  {
    "id": "smido679f8d809de6ffaa",
    "name": "廖予晨",
    "grade": "國三"
  },
  {
    "id": "smidoa29a29a17904119a",
    "name": "廖芷聆",
    "grade": "國三"
  },
  {
    "id": "smido3637ff365819c4c4",
    "name": "劉煌銘",
    "grade": "國二"
  },
  {
    "id": "smido1357b13db91027b3",
    "name": "劉萱綺",
    "grade": "國一"
  },
  {
    "id": "smido2f3913587dca447e",
    "name": "吳詩嫻",
    "grade": "國三"
  },
  {
    "id": "smido6b6cc62b0156d9ea",
    "name": "吳哲維",
    "grade": "國三"
  },
  {
    "id": "smido455adc7781ff00d3",
    "name": "邱敏貴",
    "grade": "高三"
  },
  {
    "id": "smido3c3eb316671c0bc6",
    "name": "劉倚安",
    "grade": "國二"
  },
  {
    "id": "smido014ca6afbaf8a399",
    "name": "蕭子晴",
    "grade": "國二"
  },
  {
    "id": "smido01a89e5eef0f3ec4",
    "name": "王騰緯",
    "grade": "國三"
  },
  {
    "id": "smidoa3f383d86e12f43c",
    "name": "陳姿榕",
    "grade": "小五"
  },
  {
    "id": "smido5441efa5cc6c6d58",
    "name": "許詠晴國二",
    "grade": "國二"
  },
  {
    "id": "smidof28adefc09e305fd",
    "name": "黃靖明",
    "grade": "小三"
  },
  {
    "id": "smido76825fc481a2ca57",
    "name": "葉炤廷",
    "grade": "國二"
  },
  {
    "id": "smidoeff5fb8c699ce8a2",
    "name": "陳柏任",
    "grade": "國二"
  },
  {
    "id": "smidof35f02ca0992783e",
    "name": "申屠舞",
    "grade": "國二"
  },
  {
    "id": "smido7e51480bc3a0eb4d",
    "name": "林祖維",
    "grade": "國二"
  },
  {
    "id": "smidob64eaa60a7a0ebb1",
    "name": "呂宥彤",
    "grade": "高二"
  },
  {
    "id": "smido7cc505b010d8493b",
    "name": "陳佩緹",
    "grade": "小六"
  },
  {
    "id": "smidob4c3a87dd4652551",
    "name": "陳建宇",
    "grade": "小五"
  },
  {
    "id": "smidob46a9244975442bd",
    "name": "林芊序",
    "grade": "小六"
  },
  {
    "id": "smido7a5cf5a0dcd3369c",
    "name": "李易霖",
    "grade": "國二"
  },
  {
    "id": "smido0ba92a3a6c12e72d",
    "name": "吳星叡",
    "grade": "國二"
  },
  {
    "id": "smido2006e2a0151a0ca0",
    "name": "李恩寬",
    "grade": "小二"
  },
  {
    "id": "smidob538f3dd8395ba50",
    "name": "陳庭翰",
    "grade": "小五"
  },
  {
    "id": "smidoaf911b15c28ca1d5",
    "name": "陳冠瑋",
    "grade": "小二"
  },
  {
    "id": "smidob8caeb3ef4ed2005",
    "name": "李昭賢",
    "grade": "小四"
  },
  {
    "id": "smido8f8aa4fe0d062638",
    "name": "呂宸豪",
    "grade": "小五"
  },
  {
    "id": "smido48ecd92f5c303e54",
    "name": "賴宥餘",
    "grade": "小五"
  },
  {
    "id": "smido720ea19f8e92d7e8",
    "name": "賴宥熹",
    "grade": "小五"
  },
  {
    "id": "smido7f8b2abae1925fca",
    "name": "周奕樺",
    "grade": "小六"
  },
  {
    "id": "smido346a58718e58be28",
    "name": "周歆喬",
    "grade": "小四"
  },
  {
    "id": "smido5b37c9bb2e97ca9e",
    "name": "方威哲",
    "grade": "小五"
  },
  {
    "id": "smido649899a02dcb790d",
    "name": "劉昱承",
    "grade": "國三"
  },
  {
    "id": "smido25f5244f8296b408",
    "name": "吳瑀萌",
    "grade": "國三"
  },
  {
    "id": "smidoa20d9878ba01a049",
    "name": "賴諭萱",
    "grade": "小五"
  },
  {
    "id": "smidofbed4f7dd97d8425",
    "name": "賴羿閎",
    "grade": "小一"
  },
  {
    "id": "smido20eea1592503d3b2",
    "name": "陳彥薰",
    "grade": "高三"
  },
  {
    "id": "smidode89c7e435f4a2ee",
    "name": "吳瑀芯",
    "grade": "國一"
  },
  {
    "id": "smido645644960685891b",
    "name": "許定安",
    "grade": "小五"
  },
  {
    "id": "smido3b5ae42b0c203333",
    "name": "許定宇",
    "grade": "小五"
  },
  {
    "id": "smidodfd54fd2bee56e91",
    "name": "李秉宸",
    "grade": "小二"
  },
  {
    "id": "smido1a8695078b140f91",
    "name": "王子云",
    "grade": "小五"
  },
  {
    "id": "smido30e3d16ddabc6f6f",
    "name": "蔡承澔",
    "grade": "小六"
  },
  {
    "id": "smidob8c92a64d09d6f80",
    "name": "曹宇澤",
    "grade": "小二"
  },
  {
    "id": "smido51b4d2d9d6bcb840",
    "name": "張中弈",
    "grade": "高二"
  },
  {
    "id": "smido21bdfe621ccc24ba",
    "name": "吳瑀葳",
    "grade": "小六"
  },
  {
    "id": "smido0afecc8075ccaab4",
    "name": "梁瑀恩",
    "grade": "小六"
  },
  {
    "id": "smidoeb91d00d53fd23d0",
    "name": "黃傑佳",
    "grade": "小五"
  },
  {
    "id": "smido57da09e8d00d529e",
    "name": "黃奕勳",
    "grade": "高二"
  },
  {
    "id": "smido278599a78eaf34b7",
    "name": "丁守心",
    "grade": "國二"
  },
  {
    "id": "smido7d9d547031aeda66",
    "name": "周品叡",
    "grade": "國一"
  },
  {
    "id": "smido2fd8740ec539476c",
    "name": "周妡菲",
    "grade": "國二"
  },
  {
    "id": "smido408d3e65977ac49a",
    "name": "田恩昕",
    "grade": "國一"
  },
  {
    "id": "smidocd768b2d67925587",
    "name": "張宸碩",
    "grade": "小六"
  },
  {
    "id": "smido0bbb0a76cdc2f5c4",
    "name": "鄭安妤",
    "grade": "國一"
  },
  {
    "id": "smidoe7413650bf89ca37",
    "name": "呂盈孜",
    "grade": "小六"
  },
  {
    "id": "smidobc8a984bc22cb40e",
    "name": "沈榮恩",
    "grade": "大班"
  },
  {
    "id": "smido73f4ca9a0a3dc623",
    "name": "張芷彤",
    "grade": "國三"
  },
  {
    "id": "smido776ac339d66d1123",
    "name": "林鈞睿",
    "grade": "大班"
  },
  {
    "id": "smido4208147ffe2468c6",
    "name": "陳楷翔",
    "grade": "國二"
  },
  {
    "id": "smidoda2307df26e9926a",
    "name": "蘇怡禎",
    "grade": "小四"
  },
  {
    "id": "smido97c8e2f84df88caf",
    "name": "蘇珉樂",
    "grade": "小二"
  },
  {
    "id": "smido2748d20c62bd92c4",
    "name": "黃靖綾",
    "grade": "小四"
  },
  {
    "id": "smido6cb5a9599db1bb5f",
    "name": "林姿妤",
    "grade": "國三"
  },
  {
    "id": "smido4fc83b500a7a285a",
    "name": "黃信穎",
    "grade": "國一"
  },
  {
    "id": "smidof3f3bdd4f8dd5257",
    "name": "王品頤",
    "grade": "國一"
  },
  {
    "id": "smido4c16a5993fd64247",
    "name": "顧允凱",
    "grade": "小六"
  },
  {
    "id": "smidoa53755b35bc91d8e",
    "name": "黃郁翔",
    "grade": "國一"
  },
  {
    "id": "smido2f392a3f58bc97b6",
    "name": "許宸華",
    "grade": "小二"
  },
  {
    "id": "smido0654a9a748497672",
    "name": "黃宥之",
    "grade": ""
  },
  {
    "id": "smidoe177099b45547610",
    "name": "陳品蓁",
    "grade": ""
  },
  {
    "id": "smido7671ee00d6bc8abe",
    "name": "陳品睿",
    "grade": "小五"
  },
  {
    "id": "smido55167902c2bfa339",
    "name": "陳泳璇",
    "grade": "中班"
  },
  {
    "id": "smido6165c9c51a395485",
    "name": "廖棠宇",
    "grade": "小二"
  },
  {
    "id": "smido43990bf95fd59edd",
    "name": "高丞佑",
    "grade": "小五"
  },
  {
    "id": "smido6aa889092d007bea",
    "name": "林靖芸",
    "grade": "小六"
  },
  {
    "id": "smido392558eb3c86ffda",
    "name": "顧子靖",
    "grade": ""
  },
  {
    "id": "smido3b02c1389c26161d",
    "name": "林睿思",
    "grade": "小一"
  },
  {
    "id": "smido0913bb597898c3bd",
    "name": "蘇軒禾",
    "grade": "小三"
  },
  {
    "id": "smido8a3094644276283c",
    "name": "蘇軒岑",
    "grade": "小三"
  },
  {
    "id": "smido309b42ef600c96e9",
    "name": "曾凱浩",
    "grade": "小二"
  },
  {
    "id": "smido9d59f4ce39493c5d",
    "name": "郭寶芸",
    "grade": "國一"
  },
  {
    "id": "smido36d667eaa5ea51dc",
    "name": "呂權宇",
    "grade": "國一"
  },
  {
    "id": "smidob44fa11120c5aca8",
    "name": "呂米娜",
    "grade": "高一"
  }
];

// 只有年級資料，無法證明已加入安親或美語班，因此只提供核對預覽。
function 準備匯入() {
  return 米豆奶名單.filter(學生 => {
    const 符合年級 = /^(小[一二三四五六]|[小中大]班)$/.test(學生.grade);
    return 取得('import-scope').value === 'excluded' ? !符合年級 : 符合年級;
  });
}
function 顯示匯入預覽() {
  const 名單 = 準備匯入();
  const 不納入 = 取得('import-scope').value === 'excluded';
  取得('import-summary').textContent = 不納入 ? `${名單.length} 位屬其他年級或未填年級，本次不納入。` : `${名單.length} 位國小與幼兒園學生待核對安親、美語入班資料；目前尚未匯入。`;
  取得('confirm-import').textContent = 不納入 ? '本次不納入' : '等待入班名冊，暫不匯入';
  取得('confirm-import').disabled = true;
  取得('import-rows').replaceChildren();
  for (const 學生 of 名單) {
    const 列 = 元素('tr');
    列.append(元素('td', '', 學生.name), 元素('td', '', 學生.grade || '未填'), 元素('td', '', 不納入 ? '本次不納入' : '入班待核對'));
    取得('import-rows').append(列);
  }
}
取得('import-roster').addEventListener('click', () => { 顯示匯入預覽(); 取得('import-dialog').showModal(); });
取得('close-import').addEventListener('click', () => 取得('import-dialog').close());
取得('import-scope').addEventListener('change', 顯示匯入預覽);


// 帳號分開儲存；舊版共用資料保留原處，不自動歸給第一位登入者。
function 清空() {
  資料 = { version: 1, students: [], days: {} };
  儲存鍵 = '';
  允許儲存 = false;
  編輯編號 = null;
  取得('student-form').reset();
  取得('search').value = '';
  取得('import-rows').replaceChildren();
  取得('toast').hidden = true;
  顯示名單();
}
function 載入(使用者編號) {
  清空();
  儲存鍵 = 本機模式 ? '小日常班級紀錄第一版' : '小日常班級紀錄第一版:' + 使用者編號;
  允許儲存 = true;
  取得('save-state').textContent = 本機模式 ? '本機紀錄自動保存' : '此帳號的紀錄自動保存';
try { const 原始資料 = localStorage.getItem(儲存鍵); if (原始資料) { const 內容 = JSON.parse(原始資料); if (!資料有效(內容)) throw new Error('紀錄格式不正確'); 資料 = 內容; } } catch { 允許儲存 = false; 取得('save-state').textContent = '無法讀取儲存資料'; 通知('無法讀取原有資料；請還原有效備份，或先備份本次紀錄。'); }

顯示名單();
}
return { 載入, 清空 };
}



