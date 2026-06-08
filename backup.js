// ── 백업 헬퍼 ─────────────────────────────────────────────────────────────────
function _getBackups()         { return lsGet(BACKUP_LS_KEY, []); }
function _saveBackupsLocal(arr){ lsSet(BACKUP_LS_KEY, arr); }

async function _fbSaveBackup(entry) {
  if (!db) return;
  try { await db.ref(`${BACKUP_FB_PATH}/${entry.id}`).set(entry); }
  catch (e) { console.warn('[백업] Firebase 저장 실패:', e.message); }
}
async function _fbDeleteBackup(id) {
  if (!db) return;
  try { await db.ref(`${BACKUP_FB_PATH}/${id}`).remove(); }
  catch (e) { console.warn('[백업] Firebase 삭제 실패:', e.message); }
}
async function _syncBackupsFromFb() {
  if (!db) return;
  try {
    const snap = await db.ref(BACKUP_FB_PATH).get();
    if (!snap.val()) return;
    const arr = Object.values(snap.val()).sort((a, b) => b.id - a.id).slice(0, BACKUP_MAX);
    _saveBackupsLocal(arr);
    console.info(`[백업] Firebase에서 ${arr.length}개 동기화됨`);
  } catch (e) { console.warn('[백업] Firebase 동기화 실패:', e.message); }
}
async function _fbPruneBackups() {
  if (!db) return;
  try {
    const snap = await db.ref(BACKUP_FB_PATH).get();
    if (!snap.val()) return;
    const all      = Object.values(snap.val()).sort((a, b) => b.id - a.id);
    const toDelete = all.slice(BACKUP_MAX);
    await Promise.all(toDelete.map(b => db.ref(`${BACKUP_FB_PATH}/${b.id}`).remove()));
  } catch (e) { console.warn('[백업] Firebase 정리 실패:', e.message); }
}

async function _createBackup(label) {
  const backups = _getBackups();
  const entry   = {
    id:   Date.now(),
    date: new Date().toISOString(),
    label,
    clients:      JSON.parse(JSON.stringify(S.clients)),
    transactions: JSON.parse(JSON.stringify(S.transactions)),
  };
  const filtered = backups.filter(b => b.label !== label);
  filtered.unshift(entry);
  _saveBackupsLocal(filtered.slice(0, BACKUP_MAX));
  _fbSaveBackup(entry).then(() => _fbPruneBackups()).catch(() => {});
  return entry;
}

async function checkAutoBackup() {
  const d       = new Date();
  const day     = d.getDate();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  if (day !== 15 && day !== lastDay) return;
  const label    = `AUTO_${localDate()}`;
  const existing = _getBackups().find(b => b.label === label);
  if (existing) return;
  const entry = await _createBackup(label);
  console.info(`[자동백업] ${label} 완료 (거래처 ${entry.clients.length}개, 거래 ${entry.transactions.length}건)`);
  showToast(`🗄️ 자동 백업 완료 (${localDate()})`);
}

// ── 백업 모달 ─────────────────────────────────────────────────────────────────
async function openBackupModal() {
  M.backupModal = { tab:'list', loading:true };
  _pushModalHistory(); renderModals();
  await _syncBackupsFromFb();
  M.backupModal = { tab:'list', loading:false };
  renderModals();
}
function closeBackupModal() { M.backupModal = null; renderModals(); }

async function restoreBackup(id) {
  const backups = _getBackups();
  let entry     = backups.find(b => b.id === id);
  if (!entry && db) {
    try { const snap = await db.ref(`${BACKUP_FB_PATH}/${id}`).get(); entry = snap.val(); } catch (e) {}
  }
  if (!entry) { showToast('백업을 찾을 수 없습니다.'); return; }
  const dateStr = new Date(entry.date).toLocaleString('ko-KR');
  M.confirm = {
    msg: `[${entry.label}]\n${dateStr}\n거래처 ${entry.clients.length}개 / 거래 ${entry.transactions.length}건\n\n이 백업으로 복구할까요?\n현재 데이터는 덮어씌워집니다.`,
    okStr: `_doRestoreBackup(${id})`,
  };
  renderModals();
}

async function _doRestoreBackup(id) {
  M.confirm = null;
  const backups = _getBackups();
  let entry     = backups.find(b => b.id === id);
  if (!entry && db) {
    try { const snap = await db.ref(`${BACKUP_FB_PATH}/${id}`).get(); entry = snap.val(); } catch (e) {}
  }
  if (!entry) { showToast('백업을 찾을 수 없습니다.'); return; }
  await _createBackup(`BEFORE_RESTORE_${localDate()}`);
  S.clients      = JSON.parse(JSON.stringify(entry.clients));
  S.transactions = JSON.parse(JSON.stringify(entry.transactions));
  lsSet('crm_clients', S.clients);
  lsSet('crm_tx', S.transactions);
  lsSet('crm_napum_synced', []);
  try {
    if (db) { await saveC(); await saveTX(); showToast('✅ 복구 완료 (클라우드 동기화됨)'); }
    else      showToast('✅ 복구 완료 (로컬 저장)');
  } catch (e) { showToast('✅ 복구 완료 (클라우드 오류)'); }
  closeBackupModal(); render();
}

async function deleteBackup(id) {
  M.confirm = { msg:'이 백업을 삭제할까요?', okStr:`_doDeleteBackup(${id})` };
  renderModals();
}
async function _doDeleteBackup(id) {
  M.confirm = null;
  _saveBackupsLocal(_getBackups().filter(b => b.id !== id));
  _fbDeleteBackup(id);
  M.backupModal = { tab:'list', loading:false };
  renderModals(); showToast('백업이 삭제됐습니다.');
}

async function createManualBackup() {
  const label = `MANUAL_${localDate()}_${Date.now().toString().slice(-4)}`;
  M.backupModal = { tab:'list', loading:true }; renderModals();
  await _createBackup(label);
  M.backupModal = { tab:'list', loading:false }; renderModals();
  showToast('💾 수동 백업이 생성됐습니다.');
}

function downloadBackup(id) {
  const entry = _getBackups().find(b => b.id === id); if (!entry) return;
  const blob  = new Blob([JSON.stringify({ exportedAt:entry.date, version:1, label:entry.label, clients:entry.clients, transactions:entry.transactions }, null, 2)], { type:'application/json' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href = url; a.download = `crm-backup-${entry.label}.json`; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
}

function buildBackupModal() {
  if (!M.backupModal) return '';
  if (M.backupModal.loading) return `
    <div onclick="closeBackupModal()" style="position:fixed;inset:0;background:rgba(15,23,42,.45);backdrop-filter:blur(4px);z-index:1100;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div onclick="event.stopPropagation()" style="background:#fff;border-radius:16px;width:100%;max-width:460px;padding:48px 20px;display:flex;flex-direction:column;align-items:center;gap:12px;box-shadow:0 20px 60px rgba(0,0,0,.25);">
        <div style="font-size:28px;">🗄️</div>
        <div style="font-size:13px;color:#64748b;">Firebase에서 백업 목록을 불러오는 중...</div>
      </div>
    </div>`;

  const backups      = _getBackups();
  const typeIcon     = lbl => lbl.startsWith('AUTO') ? '🗄️' : lbl.startsWith('BEFORE_RESTORE') ? '🔄' : '💾';
  const typeLabel    = lbl => lbl.startsWith('AUTO') ? '자동' : lbl.startsWith('BEFORE_RESTORE') ? '복구전' : '수동';
  const typeBadge    = lbl => lbl.startsWith('AUTO')
    ? { bg:'#eff6ff', tx:'#1d4ed8', bd:'#bfdbfe' }
    : lbl.startsWith('BEFORE_RESTORE')
    ? { bg:'#fef3c7', tx:'#b45309', bd:'#fcd34d' }
    : { bg:'#f0fdf4', tx:'#16a34a', bd:'#bbf7d0' };

  const rows = backups.length === 0
    ? `<div style="text-align:center;padding:40px 0;color:#94a3b8;font-size:13px;">저장된 백업이 없습니다.<br>수동 백업을 생성하거나 15일·말일을 기다려주세요.</div>`
    : backups.map(b => {
        const c  = typeBadge(b.label);
        const dt = new Date(b.date).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
        return `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <div style="font-size:20px;flex-shrink:0;">${typeIcon(b.label)}</div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
              <span style="font-size:11px;padding:1px 7px;border-radius:9999px;background:${c.bg};color:${c.tx};border:1px solid ${c.bd};font-weight:600;">${typeLabel(b.label)}</span>
              <span style="font-size:12px;color:#475569;font-weight:500;">${dt}</span>
            </div>
            <div style="font-size:11px;color:#94a3b8;">거래처 ${b.clients.length}개 · 거래 ${b.transactions.length}건</div>
          </div>
          <div style="display:flex;gap:5px;flex-shrink:0;">
            <button onclick="downloadBackup(${b.id})" title="다운로드" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:5px 8px;cursor:pointer;font-size:11px;color:#475569;" onmouseenter="this.style.background='#f0fdf4';this.style.color='#16a34a'" onmouseleave="this.style.background='#f8fafc';this.style.color='#475569'">⬇</button>
            <button onclick="restoreBackup(${b.id})" title="복구" style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:5px 8px;cursor:pointer;font-size:11px;color:#b45309;font-weight:600;" onmouseenter="this.style.background='#fde68a'" onmouseleave="this.style.background='#fef3c7'">복구</button>
            <button onclick="deleteBackup(${b.id})" title="삭제" style="background:#fff1f2;border:1px solid #fecdd3;border-radius:6px;padding:5px 8px;cursor:pointer;font-size:11px;color:#dc2626;" onmouseenter="this.style.background='#fee2e2'" onmouseleave="this.style.background='#fff1f2'">✕</button>
          </div>
        </div>`;
      }).join('');

  const d       = new Date();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const nextBackup = d.getDate() < 15 ? '이달 15일' : d.getDate() < lastDay ? `이달 말일(${lastDay}일)` : '다음달 15일';

  return `
    <div onclick="closeBackupModal()" style="position:fixed;inset:0;background:rgba(15,23,42,.45);backdrop-filter:blur(4px);z-index:1100;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div onclick="event.stopPropagation()" style="background:#fff;border-radius:16px;width:100%;max-width:460px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.25);overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #e2e8f0;flex-shrink:0;">
          <div>
            <div style="font-weight:700;font-size:15px;color:#0f172a;">🗄️ 자동 백업 관리</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">다음 자동 백업: ${nextBackup} · 최대 ${BACKUP_MAX}개 보관</div>
            <div style="font-size:10px;margin-top:3px;color:${db?'#16a34a':'#f59e0b'};">${db?'☁️ Firebase 저장됨':'📴 로컬 저장 (오프라인)'}</div>
          </div>
          <button onclick="closeBackupModal()" style="background:none;border:none;cursor:pointer;color:#94a3b8;padding:4px;">${I.x}</button>
        </div>
        <div style="padding:12px 16px;border-bottom:1px solid #e2e8f0;flex-shrink:0;">
          <button onclick="createManualBackup()" style="width:100%;padding:10px;border-radius:8px;border:1.5px dashed #d97706;background:#fffbeb;color:#b45309;font-size:13px;font-weight:600;cursor:pointer;" onmouseenter="this.style.background='#fef3c7'" onmouseleave="this.style.background='#fffbeb'">💾 지금 수동 백업 만들기</button>
        </div>
        <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 16px;">${rows}</div>
      </div>
    </div>`;
}

// ── 초기화 모달 ───────────────────────────────────────────────────────────────
function openResetModal() {
  M.resetModal = { step:'select', scope:'all', targetClient:null, confirmText:'', error:null };
  _pushModalHistory(); renderModals();
}
function closeResetModal() { M.resetModal = null; renderModals(); }

function _onResetInput(val) {
  if (!M.resetModal) return;
  M.resetModal.confirmText = val;
  M.resetModal.error       = null;
  const btn = document.getElementById('resetExecBtn'); if (!btn) return;
  const rm  = M.resetModal;
  const tc  = rm.targetClient ? S.clients.find(c => c.id === rm.targetClient) : null;
  const kw  = (tc ? tc.name : '초기화').trim().normalize('NFC');
  const ok  = val.trim().normalize('NFC') === kw;
  btn.style.opacity    = ok ? '1' : '0.5';
  btn.style.background = ok ? '#dc2626' : '#f87171';
  btn.style.cursor     = ok ? 'pointer' : 'default';
}

function goResetConfirm() {
  const rm = M.resetModal;
  if (rm.scope === 'client' && !rm.targetClient) { showToast('거래처를 선택하세요.'); return; }
  M.resetModal = { ...rm, step:'confirm', confirmText:'', error:null };
  renderModals();
}

function buildResetModal() {
  const rm = M.resetModal;
  const napumTx      = S.transactions.filter(t => t._napumId).length;
  const localTx      = S.transactions.length - napumTx;
  const _tc          = rm.targetClient ? S.clients.find(c => c.id === rm.targetClient) : null;
  const keyword      = _tc ? _tc.name : '초기화';
  let body = '';

  if (rm.step === 'select') {
    const scopeOpts = [
      { key:'all',       icon:'💥', label:'전체 초기화',      desc:`거래처 ${S.clients.length}개 + 거래 내역 ${S.transactions.length}건 모두 삭제`,              color:'#dc2626', bg:'#fff1f2', bd:'#fecdd3' },
      { key:'txonly',    icon:'🗒', label:'거래 내역만 삭제', desc:`거래처 목록 유지 · 거래 내역 ${S.transactions.length}건만 삭제`,                             color:'#b45309', bg:'#fefce8', bd:'#fef08a' },
      { key:'localonly', icon:'🔒', label:'로컬 거래만 삭제', desc:`납품 연동 거래(${napumTx}건) 제외 · 직접 입력 거래(${localTx}건)만 삭제`,                   color:'#1d4ed8', bg:'#eff6ff', bd:'#bfdbfe' },
      { key:'client',    icon:'👤', label:'특정 거래처만',    desc:'거래처 1개와 연관 거래 내역 선택 삭제',                                                        color:'#7c3aed', bg:'#fdf4ff', bd:'#e9d5ff' },
    ].map(({ key, icon, label, desc, color, bg, bd }) => {
      const a = rm.scope === key;
      return `<button onclick="M.resetModal.scope='${key}';renderModals()"
        style="width:100%;text-align:left;padding:12px 14px;border-radius:10px;border:2px solid ${a?color:bd};background:${a?bg:'#fff'};cursor:pointer;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;">${icon}</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:${a?color:'#0f172a'};">${label}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px;">${desc}</div>
          </div>
          ${a ? `<span style="margin-left:auto;color:${color};font-size:16px;">●</span>` : ''}
        </div>
      </button>`;
    }).join('');

    const clientSelect = rm.scope === 'client' ? `
      <div style="margin-top:4px;">
        <div style="font-size:12px;color:#64748b;margin-bottom:6px;">삭제할 거래처 선택</div>
        <select onchange="M.resetModal.targetClient=Number(this.value)||null;renderModals()"
          style="width:100%;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-size:13px;color:#0f172a;background:#fff;">
          <option value="">-- 거래처 선택 --</option>
          ${S.clients.map(c => {
            const txCount = S.transactions.filter(t => t.clientId === c.id).length;
            return `<option value="${c.id}"${rm.targetClient===c.id?' selected':''}>${esc(c.name)} (거래 ${txCount}건)</option>`;
          }).join('')}
        </select>
      </div>` : '';

    const napumWarn = napumTx > 0 ? `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-top:12px;font-size:11px;color:#1d4ed8;">
        💡 납품 관리 연동 거래 <b>${napumTx}건</b>은 CRM에서 삭제해도 납품 관리 앱 데이터에는 영향 없습니다.
      </div>` : '';

    body = `
      <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;padding:12px 14px;margin-bottom:16px;">
        <div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:4px;">⚠️ 주의</div>
        <div style="font-size:12px;color:#64748b;">삭제된 데이터는 복구할 수 없습니다.<br>납품 관리 앱 원본 데이터에는 영향을 주지 않습니다.</div>
      </div>
      <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:8px;">삭제 범위 선택</div>
      ${scopeOpts}${clientSelect}${napumWarn}`;

  } else {
    const txCount     = rm.scope === 'localonly' ? localTx : rm.scope === 'client' ? S.transactions.filter(t => t.clientId === _tc?.id).length : S.transactions.length;
    const clientCount = rm.scope === 'all' ? S.clients.length : rm.scope === 'client' && _tc ? 1 : 0;
    body = `
      <div style="background:#fff1f2;border:2px solid #fecdd3;border-radius:10px;padding:14px;margin-bottom:16px;text-align:center;">
        <div style="font-size:24px;margin-bottom:6px;">🚨</div>
        <div style="font-size:14px;font-weight:700;color:#dc2626;margin-bottom:8px;">정말 삭제하시겠습니까?</div>
        <div style="display:flex;justify-content:center;gap:16px;flex-wrap:wrap;">
          ${clientCount > 0 ? `<div><div style="font-size:20px;font-weight:700;color:#dc2626;">${clientCount}개</div><div style="font-size:11px;color:#94a3b8;">거래처</div></div>` : ''}
          <div><div style="font-size:20px;font-weight:700;color:#b45309;">${txCount}건</div><div style="font-size:11px;color:#94a3b8;">거래 내역</div></div>
        </div>
      </div>
      <div style="margin-bottom:14px;">
        <div style="font-size:12px;color:#64748b;margin-bottom:6px;">확인을 위해 <b style="color:#dc2626;">${esc(keyword)}</b> 를 입력하세요</div>
        <input id="resetConfirmInput" type="text" value="${esc(rm.confirmText||'')}" placeholder="${esc(keyword)}"
          style="${ISX}font-size:14px;border-color:${rm.error?'#dc2626':'#e2e8f0'};" ${FB}
          oninput="_onResetInput(this.value)">
        ${rm.error ? `<div style="color:#dc2626;font-size:11px;margin-top:4px;">${esc(rm.error)}</div>` : ''}
      </div>`;
  }

  const isSelect = rm.step === 'select';
  const canNext  = isSelect && (rm.scope !== 'client' || rm.targetClient != null);
  const matchKw  = (rm.confirmText || '').trim().normalize('NFC') === keyword;

  return `
    <div onclick="closeResetModal()" style="position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:50;display:flex;align-items:flex-end;justify-content:center;padding-bottom:env(safe-area-inset-bottom);">
      <div onclick="event.stopPropagation()" style="background:#fff;border-radius:18px 18px 0 0;width:100%;max-width:480px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,.2);">
        <div style="width:36px;height:4px;background:#e2e8f0;border-radius:2px;margin:10px auto 0;flex-shrink:0;"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px 12px;border-bottom:1px solid #f1f5f9;flex-shrink:0;">
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:15px;">🗑 거래처 초기화</div>
            <div style="color:#94a3b8;font-size:11px;margin-top:1px;">CRM 앱 데이터만 삭제 · 납품 관리 앱 영향 없음</div>
          </div>
          <button onclick="closeResetModal()" style="background:none;border:none;cursor:pointer;color:#94a3b8;">${I.x}</button>
        </div>
        <div style="overflow-y:auto;padding:16px 18px;flex:1;-webkit-overflow-scrolling:touch;">${body}</div>
        <div style="display:flex;gap:8px;padding:12px 18px;border-top:1px solid #f1f5f9;flex-shrink:0;">
          ${isSelect
            ? `<button onclick="closeResetModal()" style="flex:1;padding:11px;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;border-radius:10px;font-size:13px;cursor:pointer;">취소</button>
               <button onclick="goResetConfirm()" ${canNext?'':'disabled'} style="flex:2;padding:11px;border:none;background:${canNext?'#dc2626':'#e2e8f0'};color:${canNext?'#fff':'#94a3b8'};border-radius:10px;font-size:13px;font-weight:700;cursor:${canNext?'pointer':'default'};">다음 →</button>`
            : `<button onclick="M.resetModal.step='select';renderModals()" style="flex:1;padding:11px;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;border-radius:10px;font-size:13px;cursor:pointer;">← 뒤로</button>
               <button id="resetExecBtn" onclick="confirmReset()" style="flex:2;padding:11px;border:none;background:${matchKw?'#dc2626':'#f87171'};color:#fff;border-radius:10px;font-size:13px;font-weight:700;cursor:${matchKw?'pointer':'default'};opacity:${matchKw?'1':'0.5'};">🗑 영구 삭제</button>`}
        </div>
      </div>
    </div>`;
}

async function confirmReset() {
  const inputEl = document.getElementById('resetConfirmInput');
  const input   = (inputEl?.value || '').trim().normalize('NFC');
  const rm      = M.resetModal;
  const tc      = rm.targetClient ? S.clients.find(c => c.id === rm.targetClient) : null;
  const keyword = (tc ? tc.name : '초기화').trim().normalize('NFC');

  if (input !== keyword) {
    showToast(`"${keyword}"를 정확히 입력하세요.`);
    if (inputEl) inputEl.style.borderColor = '#dc2626'; return;
  }

  const scope = rm.scope;
  try {
    if (scope === 'all') {
      S.transactions = []; S.clients = [];
      lsSet('crm_clients', []); lsSet('crm_tx', []); lsSet('crm_napum_synced', []);
    } else if (scope === 'txonly') {
      S.transactions = [];
      lsSet('crm_tx', []); lsSet('crm_napum_synced', []);
    } else if (scope === 'localonly') {
      S.transactions = S.transactions.filter(t => t._napumId);
      lsSet('crm_tx', S.transactions);
    } else if (scope === 'client' && tc) {
      S.transactions = S.transactions.filter(t => t.clientId !== tc.id);
      S.clients      = S.clients.filter(c => c.id !== tc.id);
      if (S.cExpanded === tc.id) S.cExpanded = null;
      lsSet('crm_clients', S.clients); lsSet('crm_tx', S.transactions);
    }
  } catch (e) {
    console.error('로컬 초기화 오류:', e);
    showToast('⚠️ 초기화 중 오류가 발생했습니다.'); return;
  }

  closeResetModal(); render();
  const labels = { all:'전체 초기화', txonly:'거래 내역 삭제', localonly:'로컬 거래 삭제', client:`${tc?.name||''} 삭제` };
  showToast('✅ ' + labels[scope] + ' 완료');

  if (db) {
    try {
      if (scope === 'all') {
        await Promise.all([db.ref('clients').set(null), db.ref('transactions').set(null)]);
      } else if (scope === 'txonly') {
        await db.ref('transactions').set(null);
      } else if (scope === 'localonly') {
        await db.ref('transactions').set(S.transactions.length ? toMap(S.transactions) : null);
      } else if (scope === 'client' && tc) {
        await Promise.all([
          db.ref('clients').set(S.clients.length ? toMap(S.clients) : null),
          db.ref('transactions').set(S.transactions.length ? toMap(S.transactions) : null),
        ]);
      }
    } catch (e) {
      console.warn('Firebase 초기화 실패 (로컬은 삭제됨):', e);
      showToast('⚠️ 클라우드 삭제 실패 (로컬은 완료)');
    }
  }
}
