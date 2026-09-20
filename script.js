const 取得 = (識別) => document.getElementById(識別);
// 只可填入公開金鑰，絕對不可放入管理員或伺服器密鑰。
// 只放可公開使用的連線資訊；服務密鑰絕對不能放在瀏覽器。
const 驗證設定 = { 網址: 'https://iwndjcaxobjsthvvqzox.supabase.co', 公開金鑰: 'sb_publishable_PDiCmHkRNPSV39GW2vOQlg_8i4oBZYB' };
// 只有完全尚未設定時使用原本的本機模式；設定錯誤或斷線不可繞過登入。
const 本機模式 = !驗證設定.網址 && !驗證設定.公開金鑰;
// 依使用者要求，網址持有者可直接進入；雲端資料表只允許匿名角色存取共享工作台。
const 免登入模式 = true;
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
  if (免登入模式 || !驗證服務 || 主動登出 || 驗證中) return;
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
    if (目前使用者 !== data.user.id) await 工作台.載入(data.user.id);
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
    if (!工作台) { 工作台 = 建立工作台(); await 工作台.載入(); }
    取得('auth-screen').hidden = true;
    取得('protected-app').hidden = false;
    取得('protected-app').inert = false;
    取得('auth-account').textContent = '本機模式・尚未啟用登入保護';
    取得('auth-signout').hidden = true;
    取得('local-mode-notice').hidden = false;
    設定路徑('#records');
    return;
  }
  if (免登入模式) {
    if (!驗證設定.網址 || !驗證設定.公開金鑰) { 登入訊息('尚未連接雲端專案，請先完成專案設定。'); return; }
    try {
      if (!驗證服務) {
        if (!window.supabase) await new Promise((完成, 失敗) => {
          const 套件=document.createElement('script');套件.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js';
          const 計時=setTimeout(()=>失敗(new Error('載入逾時')),15000);套件.onload=()=>{clearTimeout(計時);完成();};套件.onerror=()=>{clearTimeout(計時);失敗(new Error('無法載入雲端套件'));};document.head.append(套件);
        });
        驗證服務=window.supabase.createClient(驗證設定.網址,驗證設定.公開金鑰,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(網址,選項={})=>fetch(網址,{...選項,signal:AbortSignal.timeout(15000)})}});
      }
      if (!工作台)工作台=建立工作台();
      await 工作台.載入('公開工作台');目前使用者='公開工作台';主動登出=false;
      取得('auth-screen').hidden=true;取得('protected-app').hidden=false;取得('protected-app').inert=false;取得('auth-account').textContent='網址直入・雲端共享';取得('auth-signout').hidden=true;取得('local-mode-notice').hidden=true;設定路徑('#records');
    } catch { 鎖定工作台();登入訊息('雲端資料無法載入，請檢查網路或 Supabase 設定。'); }
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
  if (本機模式 || 免登入模式) return;
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
  if (本機模式 || 免登入模式) { 設定路徑('#records'); return; }
  if (目前使用者 && location.hash === '#records') return;
  if (!目前使用者 && location.hash === '#login') return;
  檢查登入();
});
window.addEventListener('online', 檢查登入);
window.addEventListener('offline', () => { if (本機模式 || 免登入模式) return; ++驗證序號; 清除登入畫面資料(); 登入訊息('網路已中斷，請恢復連線後繼續。'); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) 檢查登入(); });
window.addEventListener('pageshow', 事件 => { if (事件.persisted) 檢查登入(); });
準備驗證();


function 建立工作台() {
const 取得 = 識別 => document.getElementById(識別);
const 空資料 = () => ({ version: 1, students: [], days: {}, classes: [], lessonDays: {}, meals: {} });
const 狀態選項 = { arrival: ['尚未到班','已到班','已離班','請假'], homework: ['未開始','進行中','已完成','免做'], assessment: ['未開始','進行中','已完成','免做'], exam: ['未開始','已完成'] };
const 訂餐紀錄選項 = ['依固定安排','臨時加訂','已用餐','臨時取消'];
let 資料 = 空資料();
let 儲存鍵 = '';
let 允許儲存 = false;
let 篩選 = 'all';
let 編輯編號 = null;
let 通知計時;
let 雲端使用者 = '';
let 雲端保存佇列 = Promise.resolve();
function 今日() { const 日 = new Date(); return 日.getFullYear() + '-' + String(日.getMonth()+1).padStart(2,'0') + '-' + String(日.getDate()).padStart(2,'0'); }
function 日期有效(日) { return typeof 日 === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(日) && !Number.isNaN(new Date(日).getTime()) && new Date(日).toISOString().slice(0,10) === 日; }
function 時間有效(時) { return typeof 時 === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(時); }
function 通知(文字) { 取得('toast').textContent = 文字; 取得('toast').hidden = false; clearTimeout(通知計時); 通知計時 = setTimeout(() => 取得('toast').hidden = true,4500); }
function 元素(標籤, 樣式, 文字) { const 節點 = document.createElement(標籤); if (樣式) 節點.className = 樣式; if (文字 !== undefined) 節點.textContent = 文字; return 節點; }
function 是物件(值) { return 值 && typeof 值 === 'object' && !Array.isArray(值); }
function 分數有效(分數) { return 分數 === '' || (typeof 分數 === 'number' && Number.isFinite(分數) && 分數 >= 0 && 分數 <= 100); }
function 紀錄有效(紀錄) {
  // 舊紀錄未含考卷欄位仍可讀取；空白分數與零分分開保存。
  return 是物件(紀錄) && ['arrival','homework','assessment'].every(欄位 => Number.isInteger(紀錄[欄位]) && 紀錄[欄位] >= 0 && 紀錄[欄位] < 4)
    && (紀錄.exam === undefined || (Number.isInteger(紀錄.exam) && 紀錄.exam >= 0 && 紀錄.exam < 2))
    && (紀錄.score === undefined || 分數有效(紀錄.score)) && typeof 紀錄.note === 'string' && 紀錄.note.length <= 500;
}
// 舊的每日紀錄原樣保留，新課次另存，避免跨班互相覆蓋。
function 資料有效(內容) {
  if (!是物件(內容) || 內容.version !== 1 || !Array.isArray(內容.students) || !是物件(內容.days)) return false;
  const 編號 = new Set();
  for (const 學生 of 內容.students) {
    if (!學生 || typeof 學生.id !== 'string' || !/^s[\w-]+$/.test(學生.id) || 編號.has(學生.id) || typeof 學生.name !== 'string' || !學生.name.trim() || 學生.name.length > 30 || typeof 學生.grade !== 'string' || 學生.grade.length > 30 || !日期有效(學生.start)) return false;
    if (學生.mealDays !== undefined && (!Array.isArray(學生.mealDays) || !學生.mealDays.every(星期 => Number.isInteger(星期) && 星期 >= 1 && 星期 <= 7) || new Set(學生.mealDays).size !== 學生.mealDays.length)) return false;
    編號.add(學生.id);
  }
  if (!Object.entries(內容.days).every(([日,列]) => 日期有效(日) && 是物件(列) && Object.entries(列).every(([人,紀錄]) => 編號.has(人) && 紀錄有效(紀錄)))) return false;
  const 班級們 = 內容.classes === undefined ? [] : 內容.classes;
  if (!Array.isArray(班級們)) return false;
  const 班號 = new Set();
  for (const 班 of 班級們) {
    if (!班 || typeof 班.id !== 'string' || !/^c[\w-]+$/.test(班.id) || 班號.has(班.id) || typeof 班.name !== 'string' || !班.name || !['安親','美語','數學','包套'].includes(班.department) || !Array.isArray(班.groups)) return false;
    班號.add(班.id);
    for (const 組 of 班.groups) {
      if (!組 || !Array.isArray(組.studentIds) || !組.studentIds.every(人 => 編號.has(人)) || !Array.isArray(組.slots) || !組.slots.every(時 => 時 && Number.isInteger(時.day) && 時.day >= 1 && 時.day <= 7 && 時間有效(時.start) && 時間有效(時.end) && 時.start < 時.end)) return false;
    }
  }
  // 舊備份沒有訂餐欄位時視為空白；訂餐以日期與學生編號驗證。
  const 訂餐們 = 內容.meals === undefined ? {} : 內容.meals;
  if (!是物件(訂餐們) || !Object.entries(訂餐們).every(([日,列]) => 日期有效(日) && 是物件(列) && Object.entries(列).every(([人,值]) => 編號.has(人) && Number.isInteger(值) && 值 >= 0 && 值 < 訂餐紀錄選項.length))) return false;
  const 課次們 = 內容.lessonDays === undefined ? {} : 內容.lessonDays;
  return 是物件(課次們) && Object.entries(課次們).every(([日,列]) => 日期有效(日) && 是物件(列) && Object.entries(列).every(([鍵,紀錄]) => {
    const [人,班,起,迄,...其餘] = 鍵.split('|');
    return !其餘.length && 編號.has(人) && 班號.has(班) && 時間有效(起) && 時間有效(迄) && 起 < 迄 && 紀錄有效(紀錄);
  }));
}
async function 同步雲端(使用者編號,快照) {
  const {error}=await 驗證服務.from('classroom_workspaces').upsert({workspace_key:'taisho-main',data:快照,updated_at:new Date().toISOString()},{onConflict:'workspace_key'});
  if(error)throw error;
  if(雲端使用者===使用者編號)取得('save-state').textContent='所有變更已同步';
}
function 排入雲端保存(){
  const 使用者編號=雲端使用者;const 快照=JSON.parse(JSON.stringify(資料));
  雲端保存佇列=雲端保存佇列.then(()=>同步雲端(使用者編號,快照)).catch(()=>{
    if(雲端使用者===使用者編號){取得('save-state').textContent='本機已保存，雲端同步失敗';通知('本機已保存，但雲端同步失敗，請檢查網路後再試。');}
  });
}
function 保存() { try { if (!允許儲存 || !儲存鍵) throw new Error('未開放儲存'); localStorage.setItem(儲存鍵,JSON.stringify(資料)); 取得('save-state').textContent = 雲端使用者 ? '正在同步雲端…' : '所有變更已保存'; if(雲端使用者)排入雲端保存(); return true; } catch { 取得('save-state').textContent = '尚未保存，請下載備份'; 通知('目前無法保存，請先下載全部資料備份。'); return false; } }
function 預設紀錄() { return {arrival:0,homework:0,assessment:0,exam:0,score:'',note:''}; }
function 讀取紀錄(課) { const 日 = 取得('record-date').value; return {...預設紀錄(),...(課.legacy ? 資料.days[日]?.[課.student.id] : 資料.lessonDays[日]?.[課.key])}; }
function 修改紀錄(課,欄,值) { const 日 = 取得('record-date').value; const 容器 = 課.legacy ? 資料.days : 資料.lessonDays; 容器[日] ||= {}; 容器[日][課.legacy ? 課.student.id : 課.key] = {...讀取紀錄(課),[欄]:值}; }
// 固定星期是學生設定；當天紀錄只保存臨時加訂、已用餐或臨時取消。
function 固定訂餐(編號,日=取得('record-date').value) {
  const 學生=資料.students.find(人=>人.id===編號);const 星期=new Date(日+'T12:00:00').getDay() || 7;
  return (學生?.mealDays || []).includes(星期);
}
function 讀取訂餐紀錄(編號) { return 資料.meals[取得('record-date').value]?.[編號] ?? 0; }
function 讀取訂餐(編號) {
  const 紀錄=讀取訂餐紀錄(編號);
  if(紀錄===1)return 固定訂餐(編號)?{code:1,label:'固定訂餐',ordered:true,eaten:false}:{code:2,label:'臨時加訂',ordered:true,eaten:false};
  if(紀錄===2)return {code:3,label:'已用餐',ordered:true,eaten:true};
  if(紀錄===3)return {code:0,label:'臨時取消',ordered:false,eaten:false};
  return 固定訂餐(編號)?{code:1,label:'固定訂餐',ordered:true,eaten:false}:{code:0,label:'未訂餐',ordered:false,eaten:false};
}
function 設定訂餐(編號,值) {
  const 日=取得('record-date').value;資料.meals[日] ||= {};
  if(值==='預設')delete 資料.meals[日][編號];else 資料.meals[日][編號]=Number(值);
  if(!Object.keys(資料.meals[日]).length)delete 資料.meals[日];
}
function 訂餐選單內容(編號){
  return 固定訂餐(編號)?[['預設','固定訂餐'],['2','已用餐'],['3','臨時取消']]:[['預設','未訂餐'],['1','臨時加訂'],['2','已用餐']];
}
function 班級名稱(班) { const 同名 = 資料.classes.filter(項 => 項.name === 班.name); return 班.name + (同名.length > 1 ? '（' + (同名.findIndex(項 => 項.id === 班.id)+1) + '）' : ''); }
function 每週文字(時段) { return 時段.map(時 => '週' + '一二三四五六日'[時.day-1] + ' ' + 時.start + '–' + 時.end).join('、'); }
function 當日課次() {
  const 日 = 取得('record-date').value;
  const 星期 = new Date(日 + 'T12:00:00').getDay() || 7;
  const 學生表 = new Map(資料.students.filter(人 => 人.start <= 日).map(人 => [人.id,人]));
  const 結果 = new Map();
  const 已分班 = new Set();
  for (const 班 of 資料.classes) for (const 組 of 班.groups) for (const 編號 of 組.studentIds) {
    已分班.add(編號);
    const 學生 = 學生表.get(編號);
    if (!學生) continue;
    for (const 時 of 組.slots.filter(項 => 項.day === 星期)) {
      const 鍵 = [編號,班.id,時.start,時.end].join('|');
      結果.set(鍵,{key:鍵,student:學生,classId:班.id,department:班.department,className:班級名稱(班),start:時.start,end:時.end,legacy:false});
    }
  }
  // 未分班學生仍可記錄；舊紀錄在原日期另外顯示，保留既有歷史。
  for (const [編號,學生] of 學生表) if (!已分班.has(編號) || 資料.days[日]?.[編號]) 結果.set(編號,{key:編號,student:學生,classId:'legacy',department:'未分班／舊紀錄',className:資料.days[日]?.[編號] ? '原有每日紀錄' : '尚未分班',start:'',end:'',legacy:true});
  // 調整排課後，仍顯示原日期已填寫的課次，避免舊分數與出勤紀錄失去入口。
  for(const 鍵 of Object.keys(資料.lessonDays[日] || {})){
    if(結果.has(鍵))continue;
    const [編號,班號,開始,結束]=鍵.split('|');const 學生=學生表.get(編號);const 班=資料.classes.find(項=>項.id===班號);
    if(學生 && 班)結果.set(鍵,{key:鍵,student:學生,classId:班.id,department:班.department,className:班級名稱(班)+'（原時段紀錄）',start:開始,end:結束,legacy:false});
  }
  return [...結果.values()].sort((甲,乙) => 甲.start.localeCompare(乙.start) || 甲.className.localeCompare(乙.className,'zh-Hant') || 甲.student.name.localeCompare(乙.student.name,'zh-Hant'));
}
function 設定選單(識別,選項,標籤) { const 下拉 = 取得(識別); const 原值 = 下拉.value; 下拉.replaceChildren(); 下拉.append(new Option(標籤,'')); 選項.forEach(([值,名稱]) => 下拉.append(new Option(名稱,值))); 下拉.value = 選項.some(項 => 項[0] === 原值) ? 原值 : ''; }
// 空值代表全選，空集合代表全部取消。
let 已選部門=null;
function 部門符合(名稱){return 名稱!=='未分班／舊紀錄' && (已選部門===null || 已選部門.has(名稱));}
function 更新選單() {
  const 選項=[...new Set(資料.classes.map(班=>班.department))];
  const 容器=取得('department-filter');
  if(容器.dataset.options!==JSON.stringify(選項)){
    容器.replaceChildren();容器.dataset.options=JSON.stringify(選項);
    for(const 名稱 of 選項){const 標籤=元素('label','');const 勾選=document.createElement('input');勾選.type='checkbox';勾選.value=名稱;標籤.append(勾選,document.createTextNode(名稱));容器.append(標籤);}
  }
  for(const 勾選 of 容器.querySelectorAll('input'))勾選.checked=部門符合(勾選.value);
  const 班級選項 = 資料.classes.filter(班=>部門符合(班.department)).map(班=>[班.id,班級名稱(班)]);

  設定選單('class-filter',班級選項,'全部班級');
  const 班號 = 取得('class-filter').value;
  const 時段 = [...new Set(當日課次().filter(課=>(部門符合(課.department)) && (!班號 || 課.classId===班號)).map(課=>課.start ? 課.start+'–'+課.end : '未分時段'))].sort();
  設定選單('time-filter',時段.map(項=>[項,項]),'全部時段');
}
function 範圍課次() { return 當日課次().filter(課=>(部門符合(課.department)) && (!取得('class-filter').value || 課.classId===取得('class-filter').value) && (!取得('time-filter').value || (課.start ? 課.start+'–'+課.end : '未分時段')===取得('time-filter').value)); }
let 排序欄位='';let 排序方向=1;
function 排序值(課){
  if(排序欄位==='name')return 課.student.name;
  if(排序欄位==='class')return 課.className;
  if(排序欄位==='time')return 課.start ? 課.start+'–'+課.end : '';
  if(排序欄位==='meal')return 讀取訂餐(課.student.id).code;
  return 讀取紀錄(課)[排序欄位];
}
function 排序課次(課次){
  if(!排序欄位)return 課次;
  return [...課次].sort((甲,乙)=>{
    const 左=排序值(甲),右=排序值(乙);
    // 未登記分數與未分時段不論排序方向，都放在最後；零分仍是有效分數。
    if(排序欄位==='score' || 排序欄位==='time'){
      if(左==='' && 右!=='')return 1;
      if(右==='' && 左!=='')return -1;
    }
    const 差=typeof 左==='number' && typeof 右==='number' ? 左-右 : String(左).localeCompare(String(右),'zh-Hant',{numeric:true});
    return 差*排序方向;
  });
}
function 更新排序標示(){
  document.querySelectorAll('[data-sort]').forEach(按鈕=>按鈕.closest('th').setAttribute('aria-sort','none'));
  document.querySelectorAll('[data-sort]').forEach(按鈕=>{
    const 已選=按鈕.dataset.sort===排序欄位;
    按鈕.textContent=按鈕.dataset.label+' '+(已選?(排序方向===1?'↑':'↓'):'↕');
    按鈕.classList.toggle('active',已選);
    按鈕.setAttribute('aria-label',按鈕.dataset.label+'，點選'+(已選 && 排序方向===1?'降冪':'升冪')+'排序');
    if(已選)按鈕.closest('th').setAttribute('aria-sort',排序方向===1?'ascending':'descending');
  });
}
document.querySelectorAll('[data-sort]').forEach(按鈕=>按鈕.addEventListener('click',()=>{
  排序方向=排序欄位===按鈕.dataset.sort?-排序方向:1;排序欄位=按鈕.dataset.sort;顯示名單();
}));
function 顯示課次() { const 搜尋 = 取得('search').value.trim(); return 範圍課次().filter(課=>{const 記 = 讀取紀錄(課); return (!搜尋 || 課.student.name.includes(搜尋)) && (篩選==='all' || (篩選==='pending' ? 記.arrival===0 : 記.homework<2 || 記.assessment<2));}); }
function 顯示名單(焦點) {
  更新選單();
  const 全部 = 範圍課次(); const 顯示 = 排序課次(顯示課次());
  更新排序標示();
  取得('total-count').textContent = new Set(全部.map(課=>課.student.id)).size;
  取得('arrival-count').textContent = 全部.filter(課=>[1,2].includes(讀取紀錄(課).arrival)).length;
  取得('arrival-total').textContent = '／ '+全部.length+' 筆';
  取得('homework-count').textContent = 全部.filter(課=>讀取紀錄(課).homework===2).length;
  取得('assessment-count').textContent = 全部.filter(課=>讀取紀錄(課).assessment===2).length;
  const 當日編號 = [...new Set(全部.map(課=>課.student.id))];
  取得('meal-ordered-count').textContent = 當日編號.filter(編號=>讀取訂餐(編號).ordered).length;
  取得('meal-waiting-count').textContent = 當日編號.filter(編號=>{const 狀態=讀取訂餐(編號);return 狀態.ordered && !狀態.eaten;}).length;
  取得('meal-eaten-count').textContent = 當日編號.filter(編號=>讀取訂餐(編號).eaten).length;
  取得('list-count').textContent = 全部.length+' 筆課次';
  取得('shown-count').textContent = '顯示 '+顯示.length+' 筆課次';
  取得('day-label').textContent = new Date(取得('record-date').value+'T12:00:00').toLocaleDateString('zh-TW',{weekday:'long'})+'・依每週排課';
  取得('schedule-notice').textContent = '已建立 '+資料.students.length+' 位學生、'+資料.classes.length+' 個班級。每班課次分別記錄；包套保留原班級，不拆成重複課次。假日與臨時調課需另行確認。';
  const 容器 = 取得('student-rows'); 容器.replaceChildren();
  取得('empty-state').hidden = 顯示.length>0;
  取得('empty-state').querySelector('h3').textContent = 全部.length ? '沒有符合條件的課次' : '這一天沒有符合篩選的排課';
  取得('empty-state').querySelector('p').textContent = '可切換日期或篩選條件，或查看每週課表。';
  for (const 課 of 顯示) {
    const 記 = 讀取紀錄(課); const 列 = 元素('tr'); const 姓名格 = 元素('td'); const 姓名區 = 元素('div','student-info');
    姓名區.append(元素('span','avatar',課.student.name.slice(-2)));
    const 姓名 = 元素('button','student-name',課.student.name); 姓名.title='編輯姓名、年級與加入班級'; 姓名.append(元素('small','',課.student.grade || '未填年級')); 姓名.addEventListener('click',()=>開啟學生(課.student)); 姓名區.append(姓名);
    if(課.legacy){const 設定=元素('button','text-button','編輯名單／分班');設定.type='button';設定.addEventListener('click',()=>開啟學生(課.student));姓名區.append(設定);}
    姓名格.append(姓名區,元素('div','lesson-class',課.department+'・'+課.className),元素('div','lesson-time',課.start ? 課.start+'–'+課.end : '未分時段')); 列.append(姓名格);
    for (const 欄 of Object.keys(狀態選項)) {
      const 值 = 記[欄]; const 樣式 = 欄==='exam' ? (值===1?'good':'') : 值===3 ? 'leave' : 欄==='arrival' ? (值>0?'good':'') : 值===2?'good':值===1?'working':'';
      const 按鈕 = 元素('button','status '+樣式,狀態選項[欄][值]); 按鈕.id=課.key+'-'+欄;
      const 欄名 = {arrival:'到班',homework:'作業',assessment:'評量',exam:'考卷進度'}[欄];
      按鈕.setAttribute('aria-label',課.student.name+'，'+課.className+'，'+課.start+'，'+欄名+'：'+狀態選項[欄][值]+'；點選改為'+狀態選項[欄][(值+1)%狀態選項[欄].length]);
      按鈕.addEventListener('click',()=>{修改紀錄(課,欄,(值+1)%狀態選項[欄].length);保存();顯示名單(按鈕.id);});
      const 格=元素('td');格.append(按鈕);列.append(格);
    }
    const 分數格 = 元素('td'); const 分數欄 = 元素('input','exam-score');
    分數欄.id=課.key+'-score';分數欄.type='number';分數欄.min='0';分數欄.max='100';分數欄.step='any';分數欄.inputMode='decimal';分數欄.value=記.score;分數欄.placeholder='未登記';
    分數欄.setAttribute('aria-label',課.student.name+'，'+課.className+'，'+課.start+'的考卷分數，零至一百分');
    分數欄.title='0～100 分，可填小數；留白表示尚未登記';
    分數欄.addEventListener('change',()=>{
      const 分數=分數欄.value===''?'':Number(分數欄.value);
      if(分數欄.validity.badInput || !分數有效(分數)){分數欄.value=讀取紀錄(課).score;通知('分數未保存，請輸入 0～100 分；留白表示未登記。');return;}
      修改紀錄(課,'score',分數);保存();if(排序欄位==='score')顯示名單(分數欄.id);
    });
    分數格.append(分數欄);列.append(分數格);
    const 訂餐狀態=讀取訂餐(課.student.id);const 訂餐紀錄=讀取訂餐紀錄(課.student.id);
    const 訂餐選單=元素('select','meal-select '+(訂餐狀態.eaten?'good':訂餐狀態.ordered?'working':訂餐紀錄===3?'cancelled':''));訂餐選單.id=課.key+'-meal';
    訂餐選單內容(課.student.id).forEach(([值,名稱])=>訂餐選單.append(new Option(名稱,值)));
    訂餐選單.value=訂餐紀錄===0 || (訂餐紀錄===1 && 固定訂餐(課.student.id))?'預設':String(訂餐紀錄);
    訂餐選單.setAttribute('aria-label',課.student.name+'當天訂餐：'+訂餐狀態.label);
    訂餐選單.title='同一學生當天跨班共用；固定安排可在學生資料中修改';
    訂餐選單.addEventListener('change',()=>{設定訂餐(課.student.id,訂餐選單.value);保存();顯示名單(訂餐選單.id);});
    const 訂餐格=元素('td');訂餐格.append(訂餐選單);列.append(訂餐格);
    const 格=元素('td');const 備註=元素('input','note');備註.value=記.note;備註.maxLength=500;備註.placeholder='記下這堂課的提醒…';備註.setAttribute('aria-label',課.student.name+'，'+課.className+'，'+課.start+'的備註');備註.addEventListener('input',()=>{修改紀錄(課,'note',備註.value);保存();});格.append(備註);列.append(格);
    // 請假時保留備註供填寫原因，其餘後續欄位鎖定，原有紀錄不變。
    if(記.arrival===3){
      列.classList.add('leave-row');
      備註.placeholder='填寫請假原因…';
      備註.setAttribute('aria-label',課.student.name+'，'+課.className+'的請假原因與備註');
      列.querySelectorAll('td:nth-child(n+3) button, td:nth-child(n+3) select, td:nth-child(n+3) input:not(.note)').forEach(控制=>{
        控制.disabled=true;控制.title='此課次已請假，請先變更到班狀態再登記';
      });
    }
    容器.append(列);
  }
  if (焦點) 取得(焦點)?.focus();
}
// 名單管理直接使用所有已匯入學生，不依當日排課篩選。
function 顯示學生總名單(){
  const 搜尋=取得('roster-search').value.trim();const 僅未分班=取得('roster-unassigned').checked;
  const 容器=取得('roster-list');容器.replaceChildren();let 筆數=0;
  for(const 學生 of [...資料.students].sort((甲,乙)=>甲.name.localeCompare(乙.name,'zh-Hant'))){
    const 班級=資料.classes.filter(班=>班.groups.some(組=>組.studentIds.includes(學生.id)));
    if((搜尋 && !學生.name.includes(搜尋)) || (僅未分班 && 班級.length))continue;
    const 按鈕=元素('button','roster-student');按鈕.type='button';
    按鈕.append(元素('strong','',學生.name+'・'+(學生.grade || '未填年級')),元素('span','',班級.length?班級.map(班級名稱).join('、'):'尚未分班・點選設定班級'));
    按鈕.addEventListener('click',()=>開啟學生(學生));容器.append(按鈕);筆數++;
  }
  取得('roster-count').textContent='顯示 '+筆數+' 位學生';
  if(!筆數)容器.append(元素('p','','沒有符合條件的學生。請調整搜尋或取消未分班篩選；尚未匯入者需先匯入名單。'));
}
取得('show-roster').addEventListener('click',()=>{取得('roster-search').value='';取得('roster-unassigned').checked=false;顯示學生總名單();取得('roster-dialog').showModal();取得('roster-search').focus();});
取得('close-roster').addEventListener('click',()=>取得('roster-dialog').close());
取得('roster-search').addEventListener('input',顯示學生總名單);
取得('roster-unassigned').addEventListener('change',顯示學生總名單);
let 修改班級模式=false;
function 顯示班級名稱設定(){
  const 班=資料.classes.find(項=>項.id===取得('class-choice').value);
  取得('class-name').value=班?.name || '';取得('class-department').value=班?.department || '安親';
}
function 填入班級選項(下拉,原值=''){
  下拉.replaceChildren(new Option('請選既有班級',''));
  資料.classes.forEach(項=>下拉.append(new Option(項.department+'・'+班級名稱(項),項.id)));
  下拉.value=原值;
}
function 開啟班級設定(修改){
  if(修改 && !資料.classes.length){通知('目前沒有班級，請先新增。');return;}
  修改班級模式=修改;取得('class-editor-title').textContent=修改?'修改班級名稱':'新增班級';
  取得('class-choice-field').hidden=!修改;取得('class-department').disabled=修改;
  取得('class-choice').replaceChildren();資料.classes.forEach(班=>取得('class-choice').append(new Option(班.department+'・'+班級名稱(班),班.id)));
  if(修改)顯示班級名稱設定();else{取得('class-name').value='';取得('class-department').value='安親';}
  取得('class-editor-help').textContent=修改?'更名會立即套用至所有學生與每週課表，原有時段與紀錄保持不變。':'儲存後會加入一列上課時段，請設定星期與時間，再按「儲存學生」。班級會獨立保存。';
  取得('class-editor').showModal();取得('class-name').focus();
}
取得('create-class').addEventListener('click',()=>開啟班級設定(false));
取得('rename-class').addEventListener('click',()=>開啟班級設定(true));
取得('close-class-editor').addEventListener('click',()=>取得('class-editor').close());
取得('class-choice').addEventListener('change',顯示班級名稱設定);
取得('class-editor-form').addEventListener('submit',事件=>{
  事件.preventDefault();const 名稱=取得('class-name').value.trim();if(!名稱){通知('請填寫班級名稱。');return;}
  const 原班級=JSON.parse(JSON.stringify(資料.classes));
  let 班=修改班級模式?資料.classes.find(項=>項.id===取得('class-choice').value):null;
  if(修改班級模式 && !班){通知('找不到班級，請重新選擇。');return;}
  const 部門=班?.department || 取得('class-department').value;
  const 同名原班級=修改班級模式?資料.classes.filter(項=>項.department===部門 && 項.name===班.name):[];
  if(資料.classes.some(項=>項.department===部門 && 項.name===名稱 && !同名原班級.some(原=>原.id===項.id))){通知('此部門已有相同班級名稱，請使用不同名稱。');return;}
  if(修改班級模式)同名原班級.forEach(項=>項.name=名稱);
  else{班={id:'cmanual'+Date.now().toString(36)+Math.random().toString(36).slice(2,8),name:名稱,department:部門,groups:[]};資料.classes.push(班);}
  if(!保存()){資料.classes=原班級;return;}
  // 更新下拉名稱時保留正在編輯的班級、星期與時間。
  for(const 下拉 of 取得('student-schedules').querySelectorAll('.schedule-class')){
    填入班級選項(下拉,下拉.value);
  }
  if(!修改班級模式)新增學生時段(班.id);
  顯示名單();if(取得('roster-dialog').open)顯示學生總名單();取得('class-editor').close();通知(修改班級模式?'同名班級名稱已一起更新。':'班級已新增，請設定星期與時間後儲存學生。');
});
function 新增學生時段(班號='',時={days:[],start:'',end:''}){
  const 列=元素('div','student-schedule');
  function 欄位(名稱,控制){const 標籤=元素('label','',名稱);標籤.append(控制);列.append(標籤);return 控制;}
  const 班=欄位('選擇既有班級',document.createElement('select'));班.className='schedule-class';填入班級選項(班,班號);
  const 已選星期=new Set((時.days || (時.day?[時.day]:[])).map(Number));
  const 星期組=元素('fieldset','schedule-days');星期組.append(元素('legend','','星期'));
  ['一','二','三','四','五','六','日'].forEach((名,序)=>{
    const 選項=元素('label','schedule-day-choice');const 勾選=document.createElement('input');
    勾選.type='checkbox';勾選.className='schedule-day';勾選.value=String(序+1);勾選.checked=已選星期.has(序+1);
    選項.append(勾選,document.createTextNode('週'+名));星期組.append(選項);
  });
  列.append(星期組);
  for(const [鍵,名稱] of [['start','開始'],['end','結束']]){const 時間=欄位(名稱,document.createElement('input'));時間.type='time';時間.className='schedule-'+鍵;時間.value=時[鍵];}
  const 移除=元素('button','','取消此時段');移除.type='button';移除.addEventListener('click',()=>列.remove());列.append(移除);取得('student-schedules').append(列);
}
取得('add-student-schedule').addEventListener('click',()=>新增學生時段());
function 合併學生時段(學生){
  const 合併=new Map();
  for(const 班 of 資料.classes)for(const 組 of 班.groups)if(組.studentIds.includes(學生.id))for(const 時 of 組.slots){
    const 鍵=班.id+'|'+時.start+'|'+時.end;
    if(!合併.has(鍵))合併.set(鍵,{班號:班.id,時:{days:[],start:時.start,end:時.end}});
    合併.get(鍵).時.days.push(時.day);
  }
  return [...合併.values()];
}
function 開啟學生(學生) {
  編輯編號=學生?.id || null;取得('dialog-title').textContent=學生?'編輯學生資料與課表':'新增學生';取得('student-name').value=學生?.name || '';取得('student-grade').value=學生?.grade || '';
  const 固定星期=new Set(學生?.mealDays || []);
  取得('student-meal-days').querySelectorAll('.student-meal-day').forEach(勾選=>勾選.checked=固定星期.has(Number(勾選.value)));
  取得('student-schedules').replaceChildren();
  const 時段列=學生?合併學生時段(學生):[];
  if(時段列.length)時段列.forEach(項=>新增學生時段(項.班號,項.時));
  else 新增學生時段();
  取得('student-dialog').showModal();取得('student-name').focus();
}
取得('add-student').addEventListener('click',()=>開啟學生());
取得('close-dialog').addEventListener('click',()=>取得('student-dialog').close());
取得('student-form').addEventListener('submit',事件=>{
  事件.preventDefault();const 姓名=取得('student-name').value.trim();if(!姓名)return;
  const 課表=[];
  for(const 列 of 取得('student-schedules').children){
    const 班號=列.querySelector('.schedule-class').value;
    const 星期們=[...列.querySelectorAll('.schedule-day:checked')].map(項=>Number(項.value));
    const 開始=列.querySelector('.schedule-start').value,結束=列.querySelector('.schedule-end').value;
    if(!班號 && !星期們.length && !開始 && !結束)continue;
    if(!資料.classes.some(班=>班.id===班號) || !星期們.length || !時間有效(開始) || !時間有效(結束) || 開始>=結束){通知('請選擇班級、星期，並確認結束時間晚於開始時間。');return;}
    for(const 星期 of 星期們){
      const 時={day:星期,start:開始,end:結束};
      if(課表.some(項=>項.時.day===時.day && 項.時.start<時.end && 時.start<項.時.end)){通知('同一學生的上課時段重疊，請先調整。');return;}
      課表.push({班號,時});
    }
  }
  const 編號=編輯編號 || 's'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const 固定用餐星期=[...取得('student-meal-days').querySelectorAll('.student-meal-day:checked')].map(項=>Number(項.value));
  if(編輯編號)Object.assign(資料.students.find(人=>人.id===編號),{name:姓名,grade:取得('student-grade').value.trim(),mealDays:固定用餐星期});
  else 資料.students.push({id:編號,name:姓名,grade:取得('student-grade').value.trim(),start:取得('record-date').value,mealDays:固定用餐星期});
  // 只更換這名學生的週課表，同班其他學生仍保留原來的排課。
  for(const 班 of 資料.classes){
    for(const 組 of 班.groups)組.studentIds=組.studentIds.filter(人=>人!==編號);
    班.groups=班.groups.filter(組=>組.studentIds.length);
    const 時段=課表.filter(項=>項.班號===班.id).map(項=>項.時);
    if(時段.length)班.groups.push({studentIds:[編號],slots:時段});
  }
  保存();顯示名單();取得('student-dialog').close();if(取得('roster-dialog').open)顯示學生總名單();通知('學生班級、上課時段與固定訂餐已更新。');
});
function 換日(差){const 日=new Date(取得('record-date').value+'T12:00:00');日.setDate(日.getDate()+差);const 值=日.getFullYear()+'-'+String(日.getMonth()+1).padStart(2,'0')+'-'+String(日.getDate()).padStart(2,'0');if(日期有效(值)){取得('record-date').value=值;取得('time-filter').value='';顯示名單();}}
取得('previous-day').addEventListener('click',()=>換日(-1));取得('next-day').addEventListener('click',()=>換日(1));
取得('today').addEventListener('click',()=>{取得('record-date').value=今日();取得('time-filter').value='';顯示名單();});
取得('record-date').addEventListener('change',()=>{if(!日期有效(取得('record-date').value))取得('record-date').value=今日();取得('time-filter').value='';顯示名單();});
取得('search').addEventListener('input',()=>顯示名單());
function 部門變更(){取得('class-filter').value='';取得('time-filter').value='';顯示名單();}
取得('department-filter').addEventListener('change',()=>{已選部門=new Set([...取得('department-filter').querySelectorAll('input:checked')].map(項=>項.value));部門變更();});
取得('department-all').addEventListener('click',()=>{已選部門=null;部門變更();});
取得('department-none').addEventListener('click',()=>{已選部門=new Set();部門變更();});
for(const 識別 of ['class-filter','time-filter'])取得(識別).addEventListener('change',()=>{if(識別==='class-filter')取得('time-filter').value='';顯示名單();});
document.querySelectorAll('[data-filter]').forEach(按鈕=>按鈕.addEventListener('click',()=>{篩選=按鈕.dataset.filter;document.querySelectorAll('[data-filter]').forEach(項=>{項.classList.toggle('active',項===按鈕);項.setAttribute('aria-pressed',String(項===按鈕));});顯示名單();}));
取得('mark-arrived').addEventListener('click',()=>{const 待到=顯示課次().filter(課=>讀取紀錄(課).arrival===0);if(!待到.length){通知('目前沒有尚未到班的課次');return;}if(!confirm('將目前顯示的 '+待到.length+' 筆未到課次標記為已到班？'))return;待到.forEach(課=>修改紀錄(課,'arrival',1));保存();顯示名單();});
function 下載(內容,檔名,類型){const 網址=URL.createObjectURL(new Blob([內容],{type:類型}));const 連結=元素('a');連結.href=網址;連結.download=檔名;連結.click();setTimeout(()=>URL.revokeObjectURL(網址),1000);}
function 表格文字(文字){let 值=String(文字);if(/^\s*[=+@-]/.test(值))值="'"+值;return '"'+值.replaceAll('"','""')+'"';}
取得('backup').addEventListener('click',()=>下載(JSON.stringify(資料,null,2),'小日常完整備份-'+今日()+'.json','application/json'));
取得('export-record').addEventListener('click',()=>{const 列=[['日期','姓名','年級','部門','班級','開始','結束','到班','作業','評量','考卷進度','考卷分數','當天訂餐（同生跨班共用）','備註']];範圍課次().forEach(課=>{const 記=讀取紀錄(課);列.push([取得('record-date').value,課.student.name,課.student.grade,課.department,課.className,課.start,課.end,狀態選項.arrival[記.arrival],狀態選項.homework[記.homework],狀態選項.assessment[記.assessment],狀態選項.exam[記.exam],記.score,讀取訂餐(課.student.id).label,記.note]);});下載('\uFEFF'+列.map(項=>項.map(表格文字).join(',')).join('\r\n'),'班級紀錄-'+取得('record-date').value+'.csv','text/csv;charset=utf-8');});
取得('restore').addEventListener('click',()=>取得('restore-file').click());
取得('restore-file').addEventListener('change',async 事件=>{
  const 檔=事件.target.files[0];if(!檔)return;
  try{if(檔.size>10000000)throw new Error('檔案過大');const 新=JSON.parse(await 檔.text());if(!資料有效(新))throw new Error('格式不符');
    if(!confirm('還原會以備份取代目前資料，請先備份。確定還原？'))return;
    新.classes ||= [];新.lessonDays ||= {};新.meals ||= {};
    localStorage.setItem(儲存鍵,JSON.stringify(新));資料=新;允許儲存=true;取得('save-state').textContent='備份已還原';顯示名單();通知('備份已還原，原版與班級課次紀錄皆可讀取。');
  }catch{通知('未還原：備份格式不正確、檔案過大，或無法保存。');}finally{事件.target.value='';}
});
function 顯示課表(){
  const 容器=取得('week-content');容器.replaceChildren();
  const 班號=取得('class-filter').value;
  for(const 班 of 資料.classes.filter(項=>(部門符合(項.department))&&(!班號 || 項.id===班號))){
    const 卡=元素('article','week-card');卡.append(元素('h3','',班.department+'・'+班級名稱(班)));
    if(班.id==='c235')卡.append(元素('p','schedule-warning','班名寫二、三、五，時間設定為二、四、五；以下沿用時間設定。'));
    if(班.id==='c243')卡.append(元素('p','schedule-warning','班名寫三、四、五，時間設定為二、三、五；以下沿用時間設定。'));
    for(const 組 of 班.groups){卡.append(元素('p','week-names',組.studentIds.map(編=>資料.students.find(人=>人.id===編)?.name || '').join('、')),元素('p','week-times',每週文字(組.slots)));}
    容器.append(卡);
  }
  if(!容器.children.length)容器.append(元素('p','','此篩選範圍沒有每週課表。'));
  取得('week-dialog').showModal();
}
取得('show-week').addEventListener('click',顯示課表);取得('close-week').addEventListener('click',()=>取得('week-dialog').close());

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
const 課表範本 = [
  {
    "id": "c234",
    "name": "2-3幼兒美語班[團][1.5hr]",
    "department": "美語",
    "groups": [
      {
        "studentIds": [
          "smidobc8a984bc22cb40e",
          "smido55167902c2bfa339"
        ],
        "slots": [
          {
            "day": 2,
            "start": "17:30",
            "end": "19:00"
          },
          {
            "day": 3,
            "start": "17:30",
            "end": "19:00"
          }
        ]
      }
    ]
  },
  {
    "id": "c271",
    "name": "安親班[個][單日]",
    "department": "安親",
    "groups": [
      {
        "studentIds": [
          "smido6165c9c51a395485"
        ],
        "slots": [
          {
            "day": 1,
            "start": "13:00",
            "end": "16:00"
          },
          {
            "day": 3,
            "start": "13:00",
            "end": "16:00"
          },
          {
            "day": 4,
            "start": "13:00",
            "end": "16:00"
          },
          {
            "day": 5,
            "start": "13:00",
            "end": "16:00"
          }
        ]
      },
      {
        "studentIds": [
          "smidob46a9244975442bd"
        ],
        "slots": [
          {
            "day": 2,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 5,
            "start": "16:30",
            "end": "18:30"
          }
        ]
      },
      {
        "studentIds": [
          "smidof28adefc09e305fd"
        ],
        "slots": [
          {
            "day": 4,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 5,
            "start": "16:30",
            "end": "18:30"
          }
        ]
      },
      {
        "studentIds": [
          "smido346a58718e58be28",
          "smido7f8b2abae1925fca"
        ],
        "slots": [
          {
            "day": 1,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 2,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 4,
            "start": "16:30",
            "end": "18:30"
          }
        ]
      }
    ]
  },
  {
    "id": "c277",
    "name": "安親班(低年級)[團]",
    "department": "安親",
    "groups": [
      {
        "studentIds": [
          "smido3b02c1389c26161d"
        ],
        "slots": [
          {
            "day": 1,
            "start": "16:00",
            "end": "18:00"
          },
          {
            "day": 2,
            "start": "16:00",
            "end": "18:00"
          },
          {
            "day": 3,
            "start": "13:00",
            "end": "16:00"
          },
          {
            "day": 4,
            "start": "16:00",
            "end": "18:00"
          },
          {
            "day": 5,
            "start": "16:00",
            "end": "18:00"
          }
        ]
      }
    ]
  },
  {
    "id": "c3",
    "name": "安親班(中高年級)[團][含數課]",
    "department": "安親",
    "groups": [
      {
        "studentIds": [
          "smido5b37c9bb2e97ca9e",
          "smido6d63d82ce2f5ca1c",
          "smidob538f3dd8395ba50",
          "smido0e7314c1d453e590",
          "smido4dc17f640e382a7e",
          "smido0387f7f36c8526d3",
          "smido7cc505b010d8493b",
          "smidoeb91d00d53fd23d0",
          "smido0afecc8075ccaab4",
          "smido4c16a5993fd64247"
        ],
        "slots": [
          {
            "day": 1,
            "start": "16:00",
            "end": "20:00"
          },
          {
            "day": 2,
            "start": "16:00",
            "end": "20:00"
          },
          {
            "day": 3,
            "start": "13:00",
            "end": "19:00"
          },
          {
            "day": 4,
            "start": "16:00",
            "end": "20:00"
          },
          {
            "day": 5,
            "start": "16:00",
            "end": "20:00"
          }
        ]
      }
    ]
  },
  {
    "id": "c88",
    "name": "包套課程(美、特、安、數)[團]",
    "department": "包套",
    "groups": [
      {
        "studentIds": [
          "smido8686c76d502a3062",
          "smido427bb291d44492db",
          "smidod158e013118de08d",
          "smidofbed4f7dd97d8425"
        ],
        "slots": [
          {
            "day": 1,
            "start": "16:00",
            "end": "19:30"
          },
          {
            "day": 2,
            "start": "16:00",
            "end": "19:30"
          },
          {
            "day": 3,
            "start": "13:00",
            "end": "19:30"
          },
          {
            "day": 4,
            "start": "16:00",
            "end": "19:30"
          },
          {
            "day": 5,
            "start": "16:00",
            "end": "19:30"
          }
        ]
      }
    ]
  },
  {
    "id": "c28",
    "name": "包套課程(美、數、安)[團]",
    "department": "包套",
    "groups": [
      {
        "studentIds": [
          "smido022577e5a338d9d6",
          "smido5a3a5c93c2b4fe11",
          "smido0e7314c1d453e590"
        ],
        "slots": [
          {
            "day": 1,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 2,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 3,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 4,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 5,
            "start": "16:30",
            "end": "18:30"
          }
        ]
      }
    ]
  },
  {
    "id": "c80",
    "name": "安親-兩堂美語[團][6700]",
    "department": "包套",
    "groups": [
      {
        "studentIds": [
          "smido264212b721d087ad"
        ],
        "slots": [
          {
            "day": 1,
            "start": "16:00",
            "end": "19:00"
          },
          {
            "day": 2,
            "start": "16:00",
            "end": "19:00"
          },
          {
            "day": 3,
            "start": "13:00",
            "end": "17:30"
          },
          {
            "day": 4,
            "start": "16:00",
            "end": "19:00"
          },
          {
            "day": 5,
            "start": "13:00",
            "end": "17:30"
          }
        ]
      }
    ]
  },
  {
    "id": "c248",
    "name": "數學班[個][國小]",
    "department": "數學",
    "groups": [
      {
        "studentIds": [
          "smido6aa889092d007bea"
        ],
        "slots": [
          {
            "day": 2,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 4,
            "start": "16:30",
            "end": "18:30"
          }
        ]
      },
      {
        "studentIds": [
          "smidoa20d9878ba01a049"
        ],
        "slots": [
          {
            "day": 2,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 5,
            "start": "16:30",
            "end": "18:30"
          }
        ]
      },
      {
        "studentIds": [
          "smido1cb689fdecf44a44",
          "smido13fac69c051e108a"
        ],
        "slots": [
          {
            "day": 2,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 3,
            "start": "16:30",
            "end": "18:30"
          }
        ]
      },
      {
        "studentIds": [
          "smidoa5e3c23d56c22e36"
        ],
        "slots": [
          {
            "day": 1,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 2,
            "start": "16:30",
            "end": "18:30"
          }
        ]
      }
    ]
  },
  {
    "id": "c281",
    "name": "1-4美語班[團][4級]",
    "department": "美語",
    "groups": [
      {
        "studentIds": [
          "smido309b42ef600c96e9"
        ],
        "slots": [
          {
            "day": 1,
            "start": "13:00",
            "end": "16:00"
          },
          {
            "day": 4,
            "start": "13:00",
            "end": "16:00"
          }
        ]
      }
    ]
  },
  {
    "id": "c269",
    "name": "1-4-5美語班[團][4級]",
    "department": "美語",
    "groups": [
      {
        "studentIds": [
          "smidoaf911b15c28ca1d5",
          "smidob8c92a64d09d6f80"
        ],
        "slots": [
          {
            "day": 1,
            "start": "13:00",
            "end": "16:00"
          },
          {
            "day": 4,
            "start": "13:00",
            "end": "16:00"
          },
          {
            "day": 5,
            "start": "13:00",
            "end": "16:00"
          }
        ]
      }
    ]
  },
  {
    "id": "c270",
    "name": "1-4-5美語班[團][4級]",
    "department": "美語",
    "groups": [
      {
        "studentIds": [
          "smido2006e2a0151a0ca0"
        ],
        "slots": [
          {
            "day": 1,
            "start": "13:00",
            "end": "16:00"
          },
          {
            "day": 4,
            "start": "13:00",
            "end": "16:00"
          },
          {
            "day": 5,
            "start": "13:00",
            "end": "16:00"
          }
        ]
      }
    ]
  },
  {
    "id": "c227",
    "name": "5美語班[團][7級]",
    "department": "美語",
    "groups": [
      {
        "studentIds": [
          "smidoed50371bd08c7006"
        ],
        "slots": [
          {
            "day": 5,
            "start": "14:00",
            "end": "16:00"
          }
        ]
      }
    ]
  },
  {
    "id": "c279",
    "name": "3-5 美語班[團][7級]",
    "department": "美語",
    "groups": [
      {
        "studentIds": [
          "smidod471929365c20eca",
          "smido0913bb597898c3bd",
          "smido8a3094644276283c"
        ],
        "slots": [
          {
            "day": 3,
            "start": "13:00",
            "end": "16:00"
          },
          {
            "day": 5,
            "start": "13:00",
            "end": "16:00"
          }
        ]
      }
    ]
  },
  {
    "id": "c235",
    "name": "2-3-5美語班[團][7級]",
    "department": "美語",
    "groups": [
      {
        "studentIds": [
          "smidoc981d6860b27a1c3"
        ],
        "slots": [
          {
            "day": 2,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 4,
            "start": "13:00",
            "end": "16:00"
          },
          {
            "day": 5,
            "start": "13:00",
            "end": "16:00"
          }
        ]
      }
    ]
  },
  {
    "id": "c280",
    "name": "1-2-3 美語班[團][7級]",
    "department": "美語",
    "groups": [
      {
        "studentIds": [
          "smidoe99f510f6b89ae63",
          "smidof28adefc09e305fd"
        ],
        "slots": [
          {
            "day": 1,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 2,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 3,
            "start": "16:30",
            "end": "18:30"
          }
        ]
      }
    ]
  },
  {
    "id": "c268",
    "name": "1-4美語班[團][8級]",
    "department": "美語",
    "groups": [
      {
        "studentIds": [
          "smidob4c3a87dd4652551",
          "smido0387f7f36c8526d3",
          "smidoa3f383d86e12f43c",
          "smidob538f3dd8395ba50",
          "smido8f8aa4fe0d062638",
          "smidoa20d9878ba01a049",
          "smido645644960685891b",
          "smido3b5ae42b0c203333"
        ],
        "slots": [
          {
            "day": 1,
            "start": "17:30",
            "end": "19:30"
          },
          {
            "day": 4,
            "start": "17:30",
            "end": "19:30"
          }
        ]
      }
    ]
  },
  {
    "id": "c275",
    "name": "1-5美語班[團][9級]",
    "department": "美語",
    "groups": [
      {
        "studentIds": [
          "smidoc4fbd25d160d09fe"
        ],
        "slots": [
          {
            "day": 1,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 5,
            "start": "13:00",
            "end": "16:00"
          }
        ]
      }
    ]
  },
  {
    "id": "c256",
    "name": "1-5美語班[團][9級]",
    "department": "美語",
    "groups": [
      {
        "studentIds": [
          "smidof62b73713eba9e96",
          "smido5e69699330aa06f9"
        ],
        "slots": [
          {
            "day": 1,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 5,
            "start": "13:00",
            "end": "16:00"
          }
        ]
      }
    ]
  },
  {
    "id": "c226",
    "name": "1-2-5美語班[團][9級]",
    "department": "美語",
    "groups": [
      {
        "studentIds": [
          "smido390cd972eddf1d27"
        ],
        "slots": [
          {
            "day": 1,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 2,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 5,
            "start": "13:00",
            "end": "16:00"
          }
        ]
      }
    ]
  },
  {
    "id": "c255",
    "name": "1-2-4美語班[團][9級]",
    "department": "美語",
    "groups": [
      {
        "studentIds": [
          "smido77b52de1897aa3ab",
          "smidoeb91d00d53fd23d0"
        ],
        "slots": [
          {
            "day": 1,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 2,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 4,
            "start": "16:30",
            "end": "18:30"
          }
        ]
      }
    ]
  },
  {
    "id": "c228",
    "name": "1-4美語班[團][9級]",
    "department": "美語",
    "groups": [
      {
        "studentIds": [
          "smido6d63d82ce2f5ca1c",
          "smido1a8695078b140f91"
        ],
        "slots": [
          {
            "day": 1,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 4,
            "start": "16:30",
            "end": "18:30"
          }
        ]
      }
    ]
  },
  {
    "id": "c243",
    "name": "3-4-5美語班[團][10級]",
    "department": "美語",
    "groups": [
      {
        "studentIds": [
          "smido13fac69c051e108a"
        ],
        "slots": [
          {
            "day": 2,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 3,
            "start": "13:00",
            "end": "16:00"
          },
          {
            "day": 5,
            "start": "14:00",
            "end": "16:00"
          }
        ]
      }
    ]
  },
  {
    "id": "c244",
    "name": "3-4-5美語班[團][10級]",
    "department": "美語",
    "groups": [
      {
        "studentIds": [
          "smidoa5e3c23d56c22e36",
          "smido4c16a5993fd64247",
          "smido7671ee00d6bc8abe"
        ],
        "slots": [
          {
            "day": 3,
            "start": "13:00",
            "end": "16:00"
          },
          {
            "day": 4,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 5,
            "start": "16:30",
            "end": "18:30"
          }
        ]
      }
    ]
  },
  {
    "id": "c245",
    "name": "3-5美語班[團][10級]",
    "department": "美語",
    "groups": [
      {
        "studentIds": [
          "smido0a134922440916d5",
          "smidob85c59ca8fb61537"
        ],
        "slots": [
          {
            "day": 3,
            "start": "13:00",
            "end": "16:00"
          },
          {
            "day": 5,
            "start": "13:00",
            "end": "16:00"
          }
        ]
      }
    ]
  },
  {
    "id": "c250",
    "name": "3-5美語班[團][12級]",
    "department": "美語",
    "groups": [
      {
        "studentIds": [
          "smidoe3e20a2db8c1c924"
        ],
        "slots": [
          {
            "day": 3,
            "start": "13:00",
            "end": "16:00"
          },
          {
            "day": 5,
            "start": "13:00",
            "end": "16:00"
          }
        ]
      }
    ]
  },
  {
    "id": "c251",
    "name": "3-4-5美語班[團][12級]",
    "department": "美語",
    "groups": [
      {
        "studentIds": [
          "smido4dc17f640e382a7e",
          "smido0e7314c1d453e590",
          "smido7cc505b010d8493b"
        ],
        "slots": [
          {
            "day": 3,
            "start": "13:00",
            "end": "16:00"
          },
          {
            "day": 4,
            "start": "16:30",
            "end": "18:30"
          },
          {
            "day": 5,
            "start": "13:00",
            "end": "16:00"
          }
        ]
      }
    ]
  }
];

// 班級資料取自米豆奶的入班名冊與時間設定；相同班名仍以原班級分開。
const 匯入學生編號 = new Set(課表範本.flatMap(班=>班.groups.flatMap(組=>組.studentIds)));
function 準備匯入(){
  return 米豆奶名單.filter(人=>{
    const 年級符合=/^(小[一二三四五六]|[小中大]班)$/.test(人.grade);
    const 範圍=取得('import-scope').value;
    return 範圍==='excluded' ? !年級符合 : 範圍==='pending' ? 年級符合&&!匯入學生編號.has(人.id) : 年級符合&&匯入學生編號.has(人.id);
  });
}
// 用原識別碼或唯一同名學生合併；不覆蓋姓名、既有班級或每日紀錄。
function 合併來源(){
  const 新=JSON.parse(JSON.stringify(資料));const 對應=new Map();
  for(const 人 of 米豆奶名單.filter(項=>匯入學生編號.has(項.id))){
    let 原=新.students.find(項=>項.id===人.id);
    if(!原){const 同名=新.students.filter(項=>項.name.trim()===人.name);if(同名.length>1)throw new Error('名單有同名學生，請先核對');原=同名[0];}
    if(!原){原={...人,start:'2026-09-20'};新.students.push(原);}
    對應.set(人.id,原.id);
  }
  for(const 來源 of 課表範本){
    let 班=新.classes.find(項=>項.id===來源.id);
    if(!班){班={id:來源.id,name:來源.name,department:來源.department,groups:[]};新.classes.push(班);}
    for(const 來源組 of 來源.groups){
      const 時段=JSON.stringify(來源組.slots);
      let 組=班.groups.find(項=>JSON.stringify(項.slots)===時段);
      if(!組){組={studentIds:[],slots:來源組.slots.map(項=>({...項}))};班.groups.push(組);}
      for(const 編 of 來源組.studentIds){const 實際編號=對應.get(編);if(!組.studentIds.includes(實際編號))組.studentIds.push(實際編號);}
    }
  }
  if(!資料有效(新))throw new Error('名單或課表驗證失敗');
  return 新;
}
function 顯示匯入預覽(){
  const 名單=準備匯入();const 符合=取得('import-scope').value==='school';
  取得('import-summary').textContent=符合 ? '55 位已核對學生、26 個班級。重複匯入會合併，不重複建立；現有紀錄保留。' : '此清單本次不匯入，保留供你核對。';
  取得('confirm-import').disabled=!符合;
  取得('confirm-import').textContent=符合?'合併已核對名單與課表':'本次不納入';
  取得('import-rows').replaceChildren();
  for(const 人 of 名單){
    const 列=元素('tr');const 班名=課表範本.filter(班=>班.groups.some(組=>組.studentIds.includes(人.id))).map(班=>班.name).join('、');
    列.append(元素('td','',人.name),元素('td','',人.grade||'未填'),元素('td','import-class-list',符合?班名:取得('import-scope').value==='pending'?'未加入安親、美語、數學或包套班':'年級不在本次範圍'));
    取得('import-rows').append(列);
  }
}
取得('import-roster').addEventListener('click',()=>{顯示匯入預覽();取得('import-dialog').showModal();});
取得('close-import').addEventListener('click',()=>取得('import-dialog').close());
取得('import-scope').addEventListener('change',顯示匯入預覽);
取得('confirm-import').addEventListener('click',()=>{
  if(取得('import-scope').value!=='school')return;
  try{
    if(!允許儲存 || !儲存鍵)throw new Error('尚未開放儲存');
     const 新=合併來源();資料=新;保存();
     取得('import-dialog').close();顯示名單();通知('已合併核對名單與課表，原有紀錄保留。');
  }catch{通知('未匯入：可能有同名學生需核對，或瀏覽器無法保存資料。');}
});
function 清空(){
  資料=空資料();儲存鍵='';允許儲存=false;編輯編號=null;篩選='all';雲端使用者='';
  取得('record-date').value=今日();取得('student-form').reset();取得('search').value='';
  已選部門=null;排序欄位='';排序方向=1;
  for(const 名 of ['class-filter','time-filter'])取得(名).value='';
  document.querySelectorAll('[data-filter]').forEach(項=>{項.classList.toggle('active',項.dataset.filter==='all');項.setAttribute('aria-pressed',String(項.dataset.filter==='all'));});
  取得('import-rows').replaceChildren();取得('week-content').replaceChildren();取得('toast').hidden=true;clearTimeout(通知計時);顯示名單();
}
async function 載入(使用者編號){
  清空();儲存鍵=本機模式?'小日常班級紀錄第一版':'小日常班級紀錄第一版:'+使用者編號;允許儲存=true;雲端使用者=本機模式?'':使用者編號;
  取得('save-state').textContent=本機模式?'本機紀錄自動保存':'正在讀取雲端資料…';
  try{
    if(本機模式){
      const 原=localStorage.getItem(儲存鍵);
      if(原){const 內容=JSON.parse(原);if(!資料有效(內容))throw new Error('紀錄格式錯誤');資料={...內容,classes:內容.classes||[],lessonDays:內容.lessonDays||{},meals:內容.meals||{}};}
      else{資料=合併來源();保存();}
    }else{
      const {data,error}=await 驗證服務.from('classroom_workspaces').select('data').eq('workspace_key','taisho-main').maybeSingle();
      if(error)throw error;
      const 雲端資料=data?.data;
      if(雲端資料 && 資料有效(雲端資料)){
        資料={...雲端資料,classes:雲端資料.classes||[],lessonDays:雲端資料.lessonDays||{},meals:雲端資料.meals||{}};
        localStorage.setItem(儲存鍵,JSON.stringify(資料));
      }else{
        let 本機資料=null;
        for(const 鍵 of [儲存鍵,'小日常班級紀錄第一版']){
          const 原=localStorage.getItem(鍵);if(!原)continue;
          try{const 內容=JSON.parse(原);if(資料有效(內容)){本機資料=內容;break;}}catch{}
        }
        資料=本機資料?{...本機資料,classes:本機資料.classes||[],lessonDays:本機資料.lessonDays||{},meals:本機資料.meals||{}}:合併來源();
        localStorage.setItem(儲存鍵,JSON.stringify(資料));
        await 同步雲端(使用者編號,資料);
      }
    }
  }catch{允許儲存=false;雲端使用者='';取得('save-state').textContent='無法讀取雲端資料';通知('雲端資料無法讀取，請檢查網路或 Supabase 設定。');throw new Error('雲端資料載入失敗');}
  顯示名單();
}
return {載入,清空};
}



