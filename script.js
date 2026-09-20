const 取得 = (識別) => document.getElementById(識別);
const 儲存鍵 = '小日常班級紀錄第一版';
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
try { const 原始資料 = localStorage.getItem(儲存鍵); if (原始資料) { const 內容 = JSON.parse(原始資料); if (!資料有效(內容)) throw new Error('紀錄格式不正確'); 資料 = 內容; } } catch { 允許儲存 = false; 取得('save-state').textContent = '無法讀取儲存資料'; 通知('無法讀取原有資料；請還原有效備份，或先備份本次紀錄。'); }
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
取得('restore-file').addEventListener('change', async 事件 => { const 檔案 = 事件.target.files[0]; if (!檔案) return; try { if (檔案.size > 10000000) throw new Error('備份過大'); const 備份 = JSON.parse(await 檔案.text()); if (!資料有效(備份)) throw new Error('備份格式不正確'); if (!confirm(`備份含 ${備份.students.length} 位學生，還原後將以備份取代目前紀錄。請先備份現有資料。確定還原？`)) return; 資料 = 備份; 允許儲存 = true; 保存(); 顯示名單(); 通知('備份已載入，請確認右上角儲存狀態'); } catch { 通知('無法還原：請選擇本站下載、格式完整且小於一千萬位元組的備份。'); } finally { 事件.target.value = ''; } });
顯示名單();
