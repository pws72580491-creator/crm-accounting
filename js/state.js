// ── Global State ──────────────────────────────────────────────────────────────
let S = {
  view: 'dashboard',
  // 거래처
  clients: [], cSearch: '', cFilter: '전체', cWsFilter: '전체', cGroupFilter: '전체', cExpanded: null,
  // 거래
  transactions: [], txSearch: '', txTf: '전체', txSf: '전체', txWsFilter: '전체',
  txMonth: null, txPeriodMode: 'daily', txDate: null, txWeek: null,
  // UI
  drawerOpen: false, rcvSearch: '',
  rcvPeriod: 'month',   // 'month' | 'quarter' | 'all'
  rcvMonth: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })(),
  rcvSort: 'amount',    // 'amount' | 'name' | 'date'
  // 대시보드 PIN 잠금
  dashLocked: false,
};

let M = {
  clientModal: null, txModal: null, confirm: null,
  scanModal: null, syncModal: null,
  qpModal: null, batchPayModal: null,
  statModal: null, resetModal: null, backupModal: null,
};

// ── Firebase ──────────────────────────────────────────────────────────────────
let db        = null;
let DB_ONLINE  = false;
let _fbReady   = false;

function _syncBadgeHTML() {
  const base = 'margin-top:6px;text-align:center;font-size:10px;font-weight:600;padding:3px 0;border-radius:6px;border:1px solid ';
  if (!_fbReady)  return `<div id="syncBadge" style="${base}#e2e8f0;background:#f1f5f9;color:#94a3b8;">● 로컬 모드</div>`;
  if (DB_ONLINE)  return `<div id="syncBadge" style="${base}#86efac;background:#dcfce7;color:#16a34a;">● 동기화됨</div>`;
  return `<div id="syncBadge" style="${base}#fcd34d;background:#fef3c7;color:#b45309;">● 오프라인</div>`;
}
function updateSyncBadge() {
  const el = document.getElementById('syncBadge');
  if (!el) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = _syncBadgeHTML();
  const newEl = tmp.firstElementChild;
  el.style.cssText = newEl.style.cssText;
  el.textContent   = newEl.textContent;
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

async function initFirebase() {
  try {
    await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js');
    if (!firebase.apps.length) firebase.initializeApp(FB_CFG);
    db = firebase.database();
    _fbReady = true;
    db.ref('.info/connected').on('value', snap => {
      DB_ONLINE = !!snap.val();
      updateSyncBadge();
      // 온라인 복구 시 쓰기 대기열 자동 flush
      if (DB_ONLINE) setTimeout(_wqFlush, 500);
    });
  } catch (e) {
    console.warn('Firebase SDK 로드 실패 → 로컬 모드로 동작:', e.message);
    db = null; _fbReady = false;
    updateSyncBadge();
  }
}

// ── Persistence ───────────────────────────────────────────────────────────────
function lsGet(key, def) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v != null ? v : def; }
  catch { return def; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); }
  catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      try {
        // 보조 캐시 정리 후 재시도
        ['crm_napum_synced', 'crm_napum_void_migrated_v1'].forEach(k => localStorage.removeItem(k));
        localStorage.setItem(key, JSON.stringify(val));
        console.warn('[lsSet] 용량 초과 → 보조 캐시 정리 후 재저장 성공');
      } catch (e2) {
        console.error('[lsSet] 저장 실패 (용량 초과):', key, e2.message);
        showToast('⚠️ 저장 공간 부족. 백업 후 오래된 데이터를 정리하세요.');
      }
    }
  }
}

const toMap = arr => arr.reduce((m, o) => { m[o.id] = o; return m; }, {});
const toArr = map => Object.values(map || {}).sort((a, b) => a.id - b.id);

// ── 클라우드 쓰기 대기열 (Write Queue) ───────────────────────────────────────
// 네트워크 오류 시 로컬 영속 보관 → 복구 후 자동 재전송
const WQ_LS_KEY = 'crm_write_queue';

function _wqLoad() {
  try { return JSON.parse(localStorage.getItem(WQ_LS_KEY) || '{}'); } catch { return {}; }
}
function _wqSave(q) {
  try { localStorage.setItem(WQ_LS_KEY, JSON.stringify(q)); } catch (e) { console.warn('[WQ] 저장 실패:', e); }
}
function _wqAdd(path, data, label) {
  const q = _wqLoad();
  q[path] = { data, label, failedAt: Date.now() };
  _wqSave(q);
  console.info('[WQ] 대기열 추가:', path, '| 현재 대기:', Object.keys(q).length);
}
function _wqRemove(path) {
  const q = _wqLoad();
  delete q[path];
  _wqSave(q);
}

let _wqFlushing = false;

/** 대기열 전체를 클라우드에 업로드. 성공한 항목만 제거. */
async function _wqFlush() {
  if (_wqFlushing || !db) return;
  const q = _wqLoad();
  const keys = Object.keys(q);
  if (!keys.length) return;
  _wqFlushing = true;
  let successCount = 0;
  for (const path of keys) {
    try {
      await db.ref(path).set(q[path].data);
      _wqRemove(path);
      successCount++;
    } catch (e) {
      console.warn('[WQ] flush 실패 (다음 기회에 재시도):', path, e.message || e);
    }
  }
  _wqFlushing = false;
  if (successCount > 0) {
    const remain = Object.keys(_wqLoad()).length;
    showToast(remain === 0
      ? '☁️ 미전송 데이터 클라우드 동기화 완료'
      : `☁️ ${successCount}건 동기화 (${remain}건 대기 중)`);
    console.info('[WQ] flush 완료 — 성공:', successCount, '잔여:', remain);
  }
}

// 네트워크 복구 / 포그라운드 복귀 시 자동 flush (중복 방지: 1회만 등록)
if (!window._wqLifecycleBound) {
  window._wqLifecycleBound = true;
  window.addEventListener('online', () => { setTimeout(_wqFlush, 1000); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') setTimeout(_wqFlush, 800);
  });
}

/**
 * Firebase ref.set() 래퍼 — 네트워크 오류 시 재시도 + 대기열 등록
 * 1) 즉시 시도 → 2) 네트워크 오류 시 1.5초 후 1회 재시도
 *    → 3) 그래도 실패 시 write queue에 등록 (복구 후 자동 재전송)
 * Permission 오류 등 코드 버그는 대기열에 넣지 않고 토스트만.
 */
async function _fbWrite(ref, data, label) {
  const path = ref.toString().replace(/^https?:\/\/[^/]+/, '');

  // 네트워크/일시적 오류 판별 (Firebase RTDB 오프라인 패턴 포괄)
  const _isTransient = e => {
    const code = (e.code || '').toLowerCase();
    const msg  = (e.message || '').toLowerCase();
    if (code === 'permission_denied') return false;
    return (
      code.includes('network')    || code.includes('unavailable') ||
      code.includes('cancelled')  || code.includes('timeout')     ||
      msg.includes('network')     || msg.includes('timeout')      ||
      msg.includes('transport')   || msg.includes('connect')      ||
      msg.includes('fetch')       || msg.includes('offline')      ||
      msg.includes('unavailable') || !navigator.onLine
    );
  };

  try {
    await ref.set(data);
    _wqRemove(path);
    return;
  } catch (e1) {
    console.warn('[_fbWrite] 1차 실패 (' + label + '):', e1.code || e1.message);

    if (_isTransient(e1)) {
      await new Promise(r => setTimeout(r, 1500));
      try {
        await ref.set(data);
        _wqRemove(path);
        return;
      } catch (e2) {
        console.warn('[_fbWrite] 2차 실패 (' + label + '):', e2.code || e2.message);
        // 재시도 실패 — 오류 종류 무관하게 대기열 등록
        _wqAdd(path, data, label);
        showToast('☁️ 오프라인: 로컬 저장됨. 연결 복구 시 자동 동기화');
        return;
      }
    }
    // 영구 오류 (Permission denied 등) — 조용히 로그만
    console.error('[_fbWrite] 영구 오류 (' + label + '):', e1);
  }
}

// ── Firebase 저장 헬퍼 ────────────────────────────────────────────────────────
async function saveC() {
  lsSet('crm_clients', S.clients);
  if (!db) return;
  await _fbWrite(db.ref('clients'), toMap(S.clients), 'saveC');
}
async function saveTX() {
  lsSet('crm_tx', S.transactions);
  if (!db) return;
  await _fbWrite(db.ref('transactions'), toMap(S.transactions), 'saveTX');
}
async function _saveOneClient(obj) {
  // 원본 객체를 변경하지 않도록 updatedAt을 별도 payload에 추가
  const payload = { ...obj, updatedAt: Date.now() };
  lsSet('crm_clients', S.clients);
  if (!db) return;
  await _fbWrite(db.ref('clients/' + obj.id), payload, '_saveOneClient');
}
async function _saveOneTx(obj) {
  const payload = { ...obj, updatedAt: Date.now() };
  lsSet('crm_tx', S.transactions);
  if (!db) return;
  await _fbWrite(db.ref('transactions/' + obj.id), payload, '_saveOneTx');
}
async function _deleteOneClient(id) {
  lsSet('crm_clients', S.clients);
  if (!db) return;
  try { await db.ref('clients/' + id).remove(); }
  catch (e) { console.warn('_deleteOneClient:', e); }
}
async function _deleteOneTx(id) {
  lsSet('crm_tx', S.transactions);
  if (!db) return;
  try { await db.ref('transactions/' + id).remove(); }
  catch (e) { console.warn('_deleteOneTx:', e); }
}
async function _uploadAll() {
  if (!db) return;
  await Promise.all([
    _fbWrite(db.ref('clients'), toMap(S.clients), '_uploadAll:clients'),
    _fbWrite(db.ref('transactions'), toMap(S.transactions), '_uploadAll:transactions'),
  ]);
}

// ── Firebase 실시간 리스너 ────────────────────────────────────────────────────
let _offC = null, _offTX = null;
function _attachListeners() {
  if (!db) return;
  if (_offC)  { db.ref('clients').off('value', _offC); }
  if (_offTX) { db.ref('transactions').off('value', _offTX); }

  _offC = db.ref('clients').on('value', snap => {
    const fbArr = toArr(snap.val());
    // 로컬에만 있는 항목(Firebase 미업로드) 보존
    const fbIds       = new Set(fbArr.map(c => c.id));
    const localOnly   = S.clients.filter(c => !fbIds.has(c.id));
    const merged      = localOnly.length > 0 ? [...fbArr, ...localOnly] : fbArr;
    if (JSON.stringify(merged) === JSON.stringify(S.clients)) return;
    S.clients = merged; lsSet('crm_clients', S.clients); render();
    // 로컬에만 있던 항목 Firebase 보충 업로드
    if (localOnly.length > 0) {
      localOnly.forEach(c => _fbWrite(db.ref('clients/' + c.id), { ...c, updatedAt: Date.now() }, 'listener:localOnlyClient'));
    }
  }, e => console.warn('clients 리스너:', e));

  _offTX = db.ref('transactions').on('value', snap => {
    const incoming = toArr(snap.val());
    // 로컬에만 있는 항목(납품 동기화 후 Firebase 미업로드) 보존
    const fbTxIds    = new Set(incoming.map(t => t.id));
    const localOnly  = S.transactions.filter(t => !fbTxIds.has(t.id));

    // dlControlled 병합
    const merged = incoming.map(inTx => {
      if (!inTx.dlControlled) return inTx;
      const local = S.transactions.find(t => t.id === inTx.id);
      if (!local) return inTx;
      return {
        ...local,
        status:           inTx.status,
        paidAmount:       inTx.paidAmount,
        paidAt:           inTx.paidAt,
        paidMethod:       inTx.paidMethod,
        paidMethodDetail: inTx.paidMethodDetail,
        discount:         inTx.discount,
        dlControlled:     true,
      };
    });

    const finalArr = localOnly.length > 0 ? [...merged, ...localOnly] : merged;
    if (JSON.stringify(finalArr) === JSON.stringify(S.transactions)) return;
    S.transactions = finalArr; lsSet('crm_tx', S.transactions); render();
    // 로컬에만 있던 항목 Firebase 보충 업로드
    if (localOnly.length > 0) {
      console.info('[리스너] 로컬 미업로드 거래 Firebase 보충:', localOnly.length, '건');
      localOnly.forEach(t => _fbWrite(db.ref('transactions/' + t.id), { ...t, updatedAt: Date.now() }, 'listener:localOnlyTx'));
    }
  }, e => console.warn('transactions 리스너:', e));
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
function saveClient(f) {
  if (f.id) { S.clients = S.clients.map(c => c.id === f.id ? f : c); _saveOneClient(f); }
  else { const nf = { ...f, id: nextId(S.clients) }; S.clients = [...S.clients, nf]; _saveOneClient(nf); }
  lsSet('crm_clients', S.clients);
  M.clientModal = null; render();
}
function deleteClient(id) {
  S.transactions.filter(t => t.clientId === id).forEach(t => _deleteOneTx(t.id));
  _deleteOneClient(id);
  S.clients      = S.clients.filter(c => c.id !== id);
  S.transactions = S.transactions.filter(t => t.clientId !== id);
  lsSet('crm_clients', S.clients); lsSet('crm_tx', S.transactions);
  if (S.cExpanded === id) S.cExpanded = null;
  M.confirm = null; render();
}
function saveTxFn(f) {
  if (f.id) { S.transactions = S.transactions.map(t => t.id === f.id ? f : t); _saveOneTx(f); }
  else { const nf = { ...f, id: nextId(S.transactions) }; S.transactions = [...S.transactions, nf]; _saveOneTx(nf); }
  lsSet('crm_tx', S.transactions);
  M.txModal = null; render();
}
function deleteTxFn(id) {
  _deleteOneTx(id);
  S.transactions = S.transactions.filter(t => t.id !== id);
  lsSet('crm_tx', S.transactions);
  M.confirm = null; render();
}

/** 상태 토글 (배지 클릭) */
function toggleStatus(txId) {
  const next = TX_STATUS_NEXT;
  let updatedTx = null;
  S.transactions = S.transactions.map(t => {
    if (t.id !== txId) return t;
    const newStatus = next[t.status] || t.status;
    const isFull    = isTxComplete(newStatus);
    const isPending = newStatus === TX_STATUS.UNPAID || newStatus === TX_STATUS.UNBILLED;
    const u = { ...t, status: newStatus };
    if (isFull && !u.paidAmount) {
      u.paidAmount = t.amount + t.tax;
      u.paidAt     = new Date().toISOString();
      u.paidMethod = u.paidMethod || 'cash';
    } else if (isPending) {
      delete u.paidAmount; delete u.paidAt;
      delete u.paidMethod; delete u.paidMethodDetail;
    }
    delete u.dlControlled; // CRM이 직접 처리 → 납품 관리 앱 우선권 해제
    updatedTx = u; return u;
  });
  if (updatedTx) _saveOneTx(updatedTx); else saveTX();
  lsSet('crm_tx', S.transactions);
  render();
  _afterNapumPatch(updatedTx);
}

/** 상태 직접 지정 */
function completeStatus(txId, status) {
  let updatedTx = null;
  S.transactions = S.transactions.map(t => {
    if (t.id !== txId) return t;
    const isFull = isTxComplete(status);
    const u = { ...t, status };
    if (isFull && !u.paidAmount) {
      u.paidAmount = t.amount + t.tax;
      u.paidAt     = new Date().toISOString();
      u.paidMethod = u.paidMethod || 'cash';
    }
    delete u.dlControlled;
    updatedTx = u; return u;
  });
  if (updatedTx) _saveOneTx(updatedTx); else saveTX();
  lsSet('crm_tx', S.transactions);
  render();
  _afterNapumPatch(updatedTx);
}

/** 납품 역방향 패치 공통 헬퍼 */
function _afterNapumPatch(tx, delayMs = 0) {
  if (!tx || !tx._napumId) return;
  const dopatch = () => {
    _napumOwnPatchKeys.add(tx._napumId);
    _patchNapumOrder(tx._napumId, _buildNapumPatch(tx))
      .then(ok => {
        if (ok) {
          showToast('📦 납품 관리에도 반영됨');
          _refetchNapumOrderAfterPatch(tx._napumId);
        } else {
          _napumOwnPatchKeys.delete(tx._napumId);
          showToast('⚠️ 납품 관리 반영 실패 (로그 확인)');
        }
      })
      .catch(() => {
        _napumOwnPatchKeys.delete(tx._napumId);
        showToast('⚠️ 납품 관리 반영 실패');
      });
  };
  if (delayMs > 0) setTimeout(dopatch, delayMs); else dopatch();
}

/** CRM이 직접 패치한 napumId 목록 (Firebase echo 구분용) */
const _napumOwnPatchKeys = new Set();

/** 패치 후 Firebase에서 해당 order를 즉시 re-fetch해 CRM UI 갱신 */
async function _refetchNapumOrderAfterPatch(napumKey) {
  if (!napumKey || !napumKey.includes(':')) return;
  const sep     = napumKey.lastIndexOf(':');
  const wsId    = napumKey.slice(0, sep);
  const orderId = napumKey.slice(sep + 1);
  try {
    if (typeof firebase === 'undefined') return;
    const napumDb = _getNapumApp().database();
    const snap    = await napumDb.ref(`workspaces/${wsId}/orders/${orderId}`).once('value');
    if (!snap.exists()) return;
    const order   = snap.val();
    let changed = false;
    S.transactions = S.transactions.map(t => {
      if (t._napumId !== napumKey) return t;
      const prev  = JSON.stringify(t);
      const next  = { ...t,
        status:     order.isPaid
          ? (t.status === TX_STATUS.UNBILLED ? TX_STATUS.BILLED : TX_STATUS.PAID)
          : TX_STATUS.UNPAID,
        paidAmount: order.paidAmount !== undefined ? order.paidAmount : t.paidAmount,
        paidAt:     order.paidAt    !== undefined ? order.paidAt    : t.paidAt,
        paidMethod: order.paidMethod !== undefined ? order.paidMethod : t.paidMethod,
      };
      // 완납 취소 시 결제 관련 필드 명시적 삭제
      if (!order.isPaid) {
        delete next.paidAt; delete next.paidMethod; delete next.paidMethodDetail;
      } else if (order.paidMethodDetail) {
        next.paidMethodDetail = order.paidMethodDetail;
      }
      if (JSON.stringify(next) !== prev) changed = true;
      return next;
    });
    if (changed) { lsSet('crm_tx', S.transactions); render(); }
    // 자기 패치 echo 허용 처리 완료 후 제거
    setTimeout(() => _napumOwnPatchKeys.delete(napumKey), 3000);
  } catch (e) {
    console.warn('[refetch] 납품 order re-fetch 실패:', e.message);
    _napumOwnPatchKeys.delete(napumKey);
  }
}

// ── 데이터 로드 ───────────────────────────────────────────────────────────────
async function loadData() {
  // 상태 초기화
  S.txMonth = thisMonth();
  S.txDate  = localDate();
  S.txWeek  = null;

  // 1) 로컬 캐시 즉시 렌더
  S.clients      = lsGet('crm_clients', SAMPLE_CLIENTS);
  S.transactions = lsGet('crm_tx', SAMPLE_TX);

  // 마이그레이션 1: 납품 연동 거래의 잘못된 tax 보정
  let _migrated = false;
  S.transactions = S.transactions.map(t => {
    if (t._napumId && t.tax > 0 && Math.round(t.amount * 0.1) === t.tax) {
      _migrated = true;
      return { ...t, tax: 0 };
    }
    return t;
  });
  if (_migrated) {
    lsSet('crm_tx', S.transactions);
    console.info('[마이그레이션1] 납품 연동 거래의 tax 자동 보정 완료');
  }

  // 마이그레이션 2: isVoid(타인거래) 누락 건 재동기화 유도
  const _syncedMigKey = 'crm_napum_void_migrated_v2';
  if (!lsGet(_syncedMigKey, false)) {
    lsSet('crm_napum_synced', []);
    lsSet('crm_napum_void_migrated_v1', true);
    lsSet(_syncedMigKey, true);
    console.info('[마이그레이션2] 타인거래 거래처 자동생성 포함 재동기화');
  }

  try {
    if (typeof render === 'function') render();
  } catch (e) {
    console.error('[loadData] render 오류:', e);
  } finally {
    hideSplash();
  }

  // 2) Firebase 초기화
  await initFirebase();
  updateSyncBadge();

  if (!db) {
    showToast('📴 오프라인 모드 (로컬 저장)');
    return;
  }

  // 3) RTDB 최신 데이터 로드 — 로컬 캐시와 병합 (로컬 우선)
  // ★ 핵심: 납품 동기화 데이터는 비동기로 Firebase에 저장되므로
  //   앱 재실행 시 Firebase에 아직 반영 안 된 데이터가 있을 수 있음.
  //   로컬 캐시(lsGet)가 더 최신일 수 있으므로 단순 덮어쓰기 금지.
  //   → 로컬과 Firebase를 병합: id 기준으로 로컬에만 있는 항목은 로컬 것 유지
  try {
    const [csSnap, txSnap] = await Promise.all([
      db.ref('clients').get(),
      db.ref('transactions').get(),
    ]);
    const csVal  = csSnap.val();
    const txVal  = txSnap.val();

    if (csVal || txVal) {
      const fbClients = toArr(csVal);
      const fbTx      = toArr(txVal);

      // 로컬에만 있는 항목(Firebase에 아직 미업로드) 보존
      const fbClientIds = new Set(fbClients.map(c => c.id));
      const fbTxIds     = new Set(fbTx.map(t => t.id));

      const localOnlyClients = S.clients.filter(c => !fbClientIds.has(c.id));
      const localOnlyTx      = S.transactions.filter(t => !fbTxIds.has(t.id));

      if (localOnlyClients.length > 0 || localOnlyTx.length > 0) {
        console.info('[loadData] 로컬 미업로드 항목 보존:',
          '거래처', localOnlyClients.length, '건 | 거래', localOnlyTx.length, '건',
          '→ Firebase에 추가 업로드');
      }

      S.clients      = [...fbClients, ...localOnlyClients];
      S.transactions = [...fbTx,      ...localOnlyTx];
      lsSet('crm_clients', S.clients);
      lsSet('crm_tx', S.transactions);

      // 로컬에만 있던 항목을 Firebase에 보충 업로드 (비동기, 화면 차단 없음)
      if (localOnlyClients.length > 0 || localOnlyTx.length > 0) {
        (async () => {
          try {
            await Promise.all([
              ...localOnlyClients.map(c => _fbWrite(db.ref('clients/'      + c.id), { ...c, updatedAt: Date.now() }, 'loadData:localOnlyClient')),
              ...localOnlyTx     .map(t => _fbWrite(db.ref('transactions/' + t.id), { ...t, updatedAt: Date.now() }, 'loadData:localOnlyTx')),
            ]);
            console.info('[loadData] 미업로드 항목 Firebase 보충 완료');
          } catch (e) {
            console.warn('[loadData] 미업로드 항목 보충 실패 (Write Queue에 등록됨):', e.message);
          }
        })();
      }

      render();
    } else {
      // Firebase가 비어있으면 로컬 데이터를 전체 업로드
      await _uploadAll();
    }
  } catch (e) {
    console.warn('RTDB 로드 실패, 로컬 캐시 사용:', e.message);
  }

  // 4) 이전 실패 대기열 flush (Firebase 연결 직후 — 앱 재시작 후 미전송 데이터 복구)
  setTimeout(_wqFlush, 500);

  // 5) CRM 실시간 리스너
  _attachListeners();

  // 6) 납품 앱 실시간 리스너
  attachNapumListeners().catch(e => console.warn('납품 리스너 시작 실패:', e));

  // 6-1) 백그라운드 복귀 / 네트워크 복구 시 리스너 재연결 (최초 1회만 등록)
  if (!window._napumLifecycleBound) {
    window._napumLifecycleBound = true;

    // 안드로이드 백그라운드 복귀 감지 → 강제 재연결
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.info('[납품] 포그라운드 복귀 → 리스너 강제 재연결');
        setTimeout(() => _reattachNapumListenersIfNeeded(true), 800);
      }
    });

    // 네트워크 재연결 감지 → 강제 재연결
    window.addEventListener('online', () => {
      console.info('[납품] 네트워크 복구 → 리스너 강제 재연결');
      setTimeout(() => _reattachNapumListenersIfNeeded(true), 1000);
    });

    // pageshow: iOS Safari 뒤로가기 캐시 복귀 → 강제 재연결
    window.addEventListener('pageshow', e => {
      if (e.persisted) {
        console.info('[납품] pageshow(캐시 복귀) → 리스너 강제 재연결');
        setTimeout(() => _reattachNapumListenersIfNeeded(true), 800);
      }
    });
  }

  // 7) 마이그레이션된 데이터 Firebase 반영
  if (_migrated && db) {
    try { await _fbWrite(db.ref('transactions'), toMap(S.transactions), 'migration'); }
    catch (e) { console.warn('마이그레이션 클라우드 반영 실패:', e); }
  }

  // 8) 자동 백업 체크
  setTimeout(async () => {
    await _syncBackupsFromFb();
    checkAutoBackup();
  }, 1500);
}

// ── Export / Import ───────────────────────────────────────────────────────────
function exportData() {
  const data = {
    exportedAt: new Date().toISOString(), version: 1,
    clients: S.clients, transactions: S.transactions,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `crm-data-${localDate()}.json`; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
  showToast('데이터를 저장했습니다.');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json'; input.style.display = 'none';
  document.body.appendChild(input);
  input.onchange = e => {
    const file = e.target.files[0];
    document.body.removeChild(input);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data.clients) || !Array.isArray(data.transactions)) {
          showToast('올바른 CRM 백업 파일이 아닙니다.'); return;
        }
        const validC = data.clients.filter(c => c.id && c.name && c.type);
        const validT = data.transactions.filter(t => t.id && t.clientId && t.date && t.type && typeof t.amount === 'number');
        if (!confirm(`거래처 ${validC.length}개, 거래 ${validT.length}건을 불러옵니다.\n현재 데이터는 덮어씌워집니다. 계속할까요?`)) return;
        S.clients = validC; S.transactions = validT;
        await saveC(); await saveTX();
        render(); showToast('데이터를 불러왔습니다.');
      } catch (err) { showToast('파일을 읽는 중 오류가 발생했습니다.'); }
    };
    reader.readAsText(file);
  };
  // iOS Safari: input이 DOM에 있어야 파일 선택창 열림
  input.click();
}
