// ── 납품 관리 연동 ────────────────────────────────────────────────────────────
// localStorage key: crm_napum_workspaces → [{id, label, lastSync, syncedCount}]
// localStorage key: crm_napum_synced     → ["wsId:orderId", ...]  (중복 방지)

function _getWorkspaces()      { return lsGet('crm_napum_workspaces', []); }
function _saveWorkspaces(ws)   { lsSet('crm_napum_workspaces', ws); }

// ── 납품앱 Firebase Named Instance 확보 ──────────────────────────────────────
function _getNapumApp() {
  try { return firebase.app('napum'); }
  catch (e) { return firebase.initializeApp(NAPUM_FB_CFG, 'napum'); }
}

// ── 납품 역방향 패치 ─────────────────────────────────────────────────────────
/** CRM 결제 처리 후 → 납품 관리 Firebase의 order 결제 필드 동기화 */
async function _patchNapumOrder(napumKey, patchObj) {
  if (!napumKey || !napumKey.includes(':')) return false;
  const sep     = napumKey.lastIndexOf(':');
  const wsId    = napumKey.slice(0, sep);
  const orderId = napumKey.slice(sep + 1);
  if (!wsId || !orderId) { console.warn('napumKey 파싱 실패:', napumKey); return false; }

  try {
    if (typeof firebase === 'undefined') { console.warn('Firebase SDK 미로드'); return false; }
    const napumDb = _getNapumApp().database();
    const ref     = napumDb.ref(`workspaces/${wsId}/orders/${orderId}`);
    const snap    = await ref.once('value');
    if (!snap.exists()) {
      console.warn('납품앱 order 없음:', wsId, orderId);
      return true; // CRM은 이미 반영됨
    }
    // order 패치 + workspace 루트 writtenBy를 단일 update()로 원자적 처리
    // (분리 시 납품앱이 writtenBy 없는 스냅샷을 먼저 수신해 타임스탬프 필터에 막힐 수 있음)
    const atomicPatch = {};
    Object.keys(patchObj).forEach(k => {
      atomicPatch[`workspaces/${wsId}/orders/${orderId}/${k}`] = patchObj[k];
    });
    atomicPatch[`workspaces/${wsId}/writtenBy`]    = 'CRM_EXTERNAL';
    atomicPatch[`workspaces/${wsId}/lastUpdated`]  = new Date(Date.now() + 1500).toISOString();
    atomicPatch[`workspaces/${wsId}/_crmPatchAt`]  = new Date().toISOString();
    await napumDb.ref('/').update(atomicPatch);
    console.info('납품 역방향 패치 성공:', napumKey, patchObj);
    return true;
  } catch (e) {
    console.warn('납품 역방향 패치 실패:', e.message, '| napumKey:', napumKey);
    return false;
  }
}

function _buildNapumPatch(crmTx) {
  const isPaid = crmTx.status === TX_STATUS.PAID;
  const patch = {
    isPaid,
    paidAmount:    crmTx.paidAmount || 0,
    // 미수금 복귀 시 null로 명시 — || 연산자로 현재 시각이 채워지는 것을 방지
    paidAt:        isPaid ? (crmTx.paidAt || new Date().toISOString()) : null,
    paidMethod:    isPaid ? (crmTx.paidMethod || 'cash') : null,
    updatedAt:     new Date().toISOString(),
    crmControlled: true,  // ★ CRM 우선권 플래그 — 납품 앱이 이 필드들을 덮어쓰지 않음
  };
  if (isPaid && crmTx.paidMethodDetail) patch.paidMethodDetail = crmTx.paidMethodDetail;
  else patch.paidMethodDetail = null; // 미수금 복귀 시 명시적 삭제
  return patch;
}

// ── 납품앱 실시간 리스너 ─────────────────────────────────────────────────────
const _napumListeners = {}; // wsId → { clientsRef, clientsCb, ordersRef, ordersCb }

async function attachNapumListeners() {
  const workspaces = _getWorkspaces();
  if (!workspaces.length) return;
  if (typeof firebase === 'undefined') return;

  const napumDb = _getNapumApp().database();

  // 더 이상 없는 워크스페이스 리스너 제거
  const wsIds = new Set(workspaces.map(w => w.id));
  for (const wsId of Object.keys(_napumListeners)) {
    if (!wsIds.has(wsId)) {
      const h = _napumListeners[wsId];
      if (h.clientsRef)       h.clientsRef.off('value', h.clientsCb);
      if (h.ordersRef)        h.ordersRef.off('value',  h.ordersCb);
      if (h.sharedClientsRef) h.sharedClientsRef.off('value', h.sharedClientsCb);
      delete _napumListeners[wsId];
    }
  }

  // 새 워크스페이스 리스너 등록
  for (const ws of workspaces) {
    if (_napumListeners[ws.id]) continue;

    // ★ 비동기 시작 전 즉시 마커 설정 (중복 등록 방지)
    _napumListeners[ws.id] = { _pending: true };

    const wsRef = napumDb.ref('workspaces/' + ws.id);
    let _napumClientsCache = {};

    const clientsRef     = wsRef.child('clients');
    const clientsCb      = snap => { _napumClientsCache = snap.val() || {}; };

    // sharedClients
    let _sharedClientsCache = [];
    const sharedClientsRef = wsRef.child('sharedClients');
    const sharedClientsCb  = sc => {
      _sharedClientsCache = sc.exists() ? (sc.val() || []) : [];
    };
    sharedClientsRef.on('value', sharedClientsCb,
      e => console.warn('납품 sharedClients 리스너:', e));

    // clients 초기 로드 후 orders 리스너 등록
    clientsRef.once('value')
      .then(snap => {
        _napumClientsCache = snap.val() || {};
        clientsRef.on('value', clientsCb, e => console.warn('납품 clients 리스너:', e));

        const ordersRef = wsRef.child('orders');
        const ordersCb  = snap => {
          _processNapumOrdersSnapshot(ws, snap.val() || {}, _napumClientsCache, _sharedClientsCache);
        };
        ordersRef.on('value', ordersCb, e => console.warn('납품 orders 리스너:', e));

        // ★ 마커 → 실제 핸들러로 교체
        _napumListeners[ws.id] = { clientsRef, clientsCb, sharedClientsRef, sharedClientsCb, ordersRef, ordersCb };
        console.info('[납품 실시간] 리스너 등록 완료:', ws.label, ws.id,
          '| 거래처', Object.keys(_napumClientsCache).length, '명');
      })
      .catch(e => {
        // 초기화 실패 시 마커 제거 → 다음 재연결 때 재시도
        delete _napumListeners[ws.id];
        console.warn('[납품 실시간] 초기 로드 실패, 다음 재연결 시 재시도:', ws.id, e.message);
      });
  }
}

// ── 납품 리스너 재연결 (백그라운드 복귀 / 네트워크 복구) ─────────────────────
// force=true 이면 기존 리스너 전부 해제 후 재연결 (네트워크 복귀 강제 새로고침용)
function _reattachNapumListenersIfNeeded(force = false) {
  const workspaces = _getWorkspaces();
  if (!workspaces.length) return;

  if (force) {
    // 전체 리스너 해제 후 재연결
    detachNapumListeners();
    console.info('[납품] 강제 재연결');
    attachNapumListeners().catch(e => console.warn('[납품] 재연결 실패:', e));
    return;
  }

  // 불완전한 리스너만 재연결
  const needReattach = workspaces.some(ws => {
    const h = _napumListeners[ws.id];
    return !h || h._pending || !h.ordersRef;
  });

  if (needReattach) {
    workspaces.forEach(ws => {
      const h = _napumListeners[ws.id];
      if (h && (h._pending || !h.ordersRef)) delete _napumListeners[ws.id];
    });
    attachNapumListeners().catch(e => console.warn('[납품] 재연결 실패:', e));
  }
}

// 수동 새로고침: 리스너 강제 재연결 + 최신 데이터 pull
async function refreshNapumListeners() {
  showToast('🔄 납품 데이터 새로고침 중…');
  _reattachNapumListenersIfNeeded(true);
  // 리스너 재연결 후 Firebase on()이 즉시 현재값을 콜백하므로 1.5초 후 완료 알림
  setTimeout(() => showToast('✅ 납품 데이터 갱신 완료'), 1500);
}

function detachNapumListeners() {
  for (const wsId of Object.keys(_napumListeners)) {
    const h = _napumListeners[wsId];
    if (h.clientsRef)       h.clientsRef.off('value', h.clientsCb);
    if (h.ordersRef)        h.ordersRef.off('value',  h.ordersCb);
    if (h.sharedClientsRef) h.sharedClientsRef.off('value', h.sharedClientsCb);
    delete _napumListeners[wsId];
  }
}

/** 납품앱 orders 스냅샷을 받아 CRM에 반영
 *  allowed: 이 워크스페이스가 공개 허용한 거래처명 배열 (빈 배열 = 공개 없음)
 */
function _processNapumOrdersSnapshot(ws, ordersObj, napumClientsObj, allowed = []) {
  // allowed가 비어있으면 이 워크스페이스는 아무것도 공개하지 않은 것
  // → 단, CRM에 직접 등록한 워크스페이스(자기 자신)는 필터 없이 전체 허용
  const isSelfWs = _getWorkspaces().some(w => w.id === ws.id);
  // ※ 자기 워크스페이스(isSelfWs)는 sharedClients 필터 적용 안 함
  //    (납품앱에서 "공개 거래처"는 다른 사람 CRM이 볼 수 있는 항목일 뿐,
  //     내 CRM 동기화에는 항상 전체 거래처/주문이 실시간 반영되어야 함)
  const useFilter = !isSelfWs;
  const allowedSet = new Set(allowed);

  const orders       = Object.values(ordersObj)
    .filter(o => {
      if (!useFilter) return true;           // 자기 워크스페이스 + 공개 없음 = 전체 허용
      if (!isSelfWs && allowed.length === 0) return false; // 외부 ws + 공개 없음 = 전부 차단
      return allowedSet.has(o.clientName);   // 허용된 거래처만
    });
  const napumClients = Object.values(napumClientsObj)
    .filter(nc => {
      if (!useFilter) return true;
      if (!isSelfWs && allowed.length === 0) return false;
      return allowedSet.has(nc.name);
    });
  // napumClient id → 객체 맵
  const napumClientById = {};
  napumClients.forEach(nc => { if (nc.id != null) napumClientById[String(nc.id)] = nc; });

  const nameToId = {};
  S.clients.forEach(c => { nameToId[c.name] = c.id; });
  const napumIdToCrmId = {};
  S.transactions.forEach(t => { if (t._napumId) napumIdToCrmId[t._napumId] = t.id; });
  const synced  = new Set(lsGet('crm_napum_synced', []));
  let changed   = false;

  // ── 1단계: 거래처 자동 추가 (clients 목록 기반) ───────────────────────────
  napumClients.forEach(nc => {
    if (!nc.name || nc.isHidden) return;
    if (!nameToId[nc.name]) {
      const newC = {
        id: nextId(S.clients), name: nc.name, bizNo: '', rep: '', email: '',
        phone: nc.phone || '', address: nc.address || '', type: '매출처',
        memo: `[${ws.label}]${nc.note ? ' ' + nc.note : ''}`,
        _wsId: ws.id,
      };
      S.clients = [...S.clients, newC];
      nameToId[nc.name] = newC.id; changed = true;
    } else {
      const cid = nameToId[nc.name];
      S.clients = S.clients.map(c => {
        if (c.id !== cid) return c;
        const prev = JSON.stringify(c);
        const next = { ...c };
        if (nc.phone   && !c.phone)   next.phone   = nc.phone;
        if (nc.address && !c.address) next.address = nc.address;
        if (!c._wsId) next._wsId = ws.id;
        if (JSON.stringify(next) !== prev) { changed = true; return next; }
        return c;
      });
    }
  });

  // ── 2단계: orders에 등장하는 미등록 거래처 추가 ───────────────────────────
  orders.forEach(o => {
    const nc      = napumClientById[String(o.clientId)];
    const crmName = o.clientName || nc?.name || '';
    if (!crmName || nameToId[crmName]) return;
    const newC = {
      id: nextId(S.clients), name: crmName, bizNo: '', rep: '', email: '',
      phone: nc?.phone || '', address: nc?.address || '', type: '매출처',
      memo: `[${ws.label}] (주문에서 자동 추가)`,
      _wsId: ws.id,
    };
    S.clients = [...S.clients, newC];
    nameToId[crmName] = newC.id; changed = true;
    console.info('[실시간] orders에서 거래처 자동 추가:', crmName, ws.label);
  });

  // ── 3단계: 주문 처리 ─────────────────────────────────────────────────────
  orders.forEach(o => {
    if (!o.date || !o.total) return;
    const nc          = napumClientById[String(o.clientId)];
    const crmName     = o.clientName || nc?.name || '';
    const crmClientId = nameToId[crmName];
    if (!crmClientId) {
      console.warn('[실시간] 거래처 매핑 실패 → 건너뜀', { orderId: o.id, clientId: o.clientId, crmName });
      return;
    }

    const memoItems = (o.items || []).map(i => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', ');
    const memo      = `[${ws.label}]${o.isVoid ? ' [타인]' : ''} ${o.note || (memoItems || '납품')}`;
    const amount    = Number(o.total) || 0;
    const status    = o.isPaid ? TX_STATUS.PAID : TX_STATUS.UNPAID;
    const napumKey  = `${ws.id}:${o.id}`;

    if (napumIdToCrmId[napumKey]) {
      S.transactions = S.transactions.map(t => {
        if (t.id !== napumIdToCrmId[napumKey]) return t;
        const prev = JSON.stringify(t);
        const next = { ...t, status, amount, tax: 0, memo };
        if (o.items && o.items.length)  next.items            = o.items; else delete next.items;
        if (o.paidAmount)               next.paidAmount       = o.paidAmount; else delete next.paidAmount;
        // 완납→미수 복귀 시 명시적으로 삭제 (truthy 체크만 하면 이전값이 스프레드로 잔류)
        if (o.paidAt)                   next.paidAt           = o.paidAt;           else delete next.paidAt;
        if (o.paidMethod)               next.paidMethod       = o.paidMethod;       else delete next.paidMethod;
        if (o.paidMethodDetail)         next.paidMethodDetail = o.paidMethodDetail; else delete next.paidMethodDetail;
        if (JSON.stringify(next) !== prev) changed = true;
        return next;
      });
    } else {
      const alreadyExists = S.transactions.some(t => t._napumId === napumKey);
      if (!alreadyExists) {
        const newT = {
          id: nextId(S.transactions), date: o.date, clientId: crmClientId,
          type: '매출', amount, tax: 0, memo, status, _napumId: napumKey,
        };
        if (o.items && o.items.length)  newT.items            = o.items;
        if (o.paidAmount)               newT.paidAmount       = o.paidAmount;
        if (o.paidAt)                   newT.paidAt           = o.paidAt;
        if (o.paidMethod)               newT.paidMethod       = o.paidMethod;
        if (o.paidMethodDetail)         newT.paidMethodDetail = o.paidMethodDetail;
        S.transactions = [...S.transactions, newT];
        synced.add(napumKey); changed = true;
      }
    }
  });

  if (changed) {
    lsSet('crm_clients', S.clients);
    lsSet('crm_tx', S.transactions);
    lsSet('crm_napum_synced', [...synced]);
    (async () => {
      try { await saveC(); await saveTX(); }
      catch (e) { console.error('[납품싱크] Firebase 저장 실패:', e); showToast('⚠️ CRM 저장 실패 (로컬은 유지됨)'); }
    })();
    render();
    // 자기 패치 echo인 경우 토스트 생략 (이미 _afterNapumPatch에서 표시함)
    const isOwnEcho = orders.some(o => _napumOwnPatchKeys?.has(`${ws.id}:${o.id}`));
    if (!isOwnEcho) showToast('📦 납품 관리에서 업데이트됨');
  } else {
    // changed=false여도 자기 패치 echo 콜백이면 화면 갱신 (결제 후 즉시 반영)
    const isOwnEcho = orders.some(o => _napumOwnPatchKeys?.has(`${ws.id}:${o.id}`));
    if (isOwnEcho) render();
  }
}

// ── 동기화 모달 ───────────────────────────────────────────────────────────────
function openSyncModal()  {
  M.syncModal = { step:'idle', newInput:'', newLabel:'', result:null, error:null, progress:null };
  _pushModalHistory();
  renderModals();
  // Firebase 준비되면 공개 거래처 뱃지 로드
  if (typeof firebase !== 'undefined') setTimeout(_loadScBadges, 300);
}
function closeSyncModal() { M.syncModal = null; renderModals(); }

// 동기화 모달 내 각 워크스페이스의 공개 거래처 뱃지 비동기 로드
async function _loadScBadges() {
  const workspaces = _getWorkspaces();
  if (!workspaces.length || typeof firebase === 'undefined') return;
  const napumDb = _getNapumApp().database();
  workspaces.forEach(async w => {
    const el = document.getElementById(`scBadge_${w.id}`);
    if (!el) return;
    try {
      const snap = await napumDb.ref(`workspaces/${w.id}/sharedClients`).get();
      const list = snap.exists() ? (snap.val() || []) : [];
      if (!list.length) {
        el.textContent = '⚠️ 공개 거래처 없음 (납품앱에서 설정 필요)';
        el.style.color = '#f59e0b';
      } else {
        el.innerHTML = '🔓 공개: ' + list.map(n =>
          `<span style="background:#e0e7ff;color:#4f46e5;border-radius:4px;padding:1px 5px;font-size:10px;margin-right:2px;">${esc(n)}</span>`
        ).join('');
      }
    } catch(e) {
      el.textContent = '❌ 접근 불가';
      el.style.color = '#dc2626';
    }
  });
}

function syncAddWorkspace() {
  const sm = M.syncModal;
  const id    = (sm.newInput || '').trim();
  const label = (sm.newLabel || '').trim();
  if (!id) { showToast('워크스페이스 ID를 입력하세요.'); return; }
  const ws = _getWorkspaces();
  if (ws.find(w => w.id === id)) { showToast('이미 등록된 ID입니다.'); return; }
  ws.push({ id, label: label || id, lastSync: null, syncedCount: 0 });
  _saveWorkspaces(ws);
  M.syncModal = { ...sm, newInput: '', newLabel: '' };
  renderModals();
  attachNapumListeners().catch(e => console.warn('납품 리스너 갱신 실패:', e));
}
function syncRemoveWorkspace(id) {
  _saveWorkspaces(_getWorkspaces().filter(w => w.id !== id));
  attachNapumListeners().catch(e => console.warn('납품 리스너 갱신 실패:', e));
  renderModals();
}

async function doSyncFromDelivery() {
  const sm         = M.syncModal;
  const workspaces = _getWorkspaces();
  if (!workspaces.length) { showToast('워크스페이스를 먼저 추가하세요.'); return; }

  M.syncModal = { ...sm, step:'loading', error:null, progress:{ current:0, total:workspaces.length, label:'Firebase 초기화 중...' } };
  renderModals();

  try {
    if (!_fbReady) {
      await initFirebase();
      if (!_fbReady) throw new Error('Firebase SDK 로드 실패. 네트워크를 확인해주세요.');
    }

    const napumDb      = _getNapumApp().database();
    const nameToId     = {};
    S.clients.forEach(c => { nameToId[c.name] = c.id; });
    const synced       = new Set(lsGet('crm_napum_synced', []));
    const napumIdToCrmId = {};
    S.transactions.forEach(t => { if (t._napumId) napumIdToCrmId[t._napumId] = t.id; });

    let totalNewClients = 0, totalNewTx = 0, totalUpdTx = 0;
    const perWorkspace  = [];
    const wsListUpdated = [...workspaces];

    for (let i = 0; i < workspaces.length; i++) {
      const ws = workspaces[i];
      M.syncModal = { ...M.syncModal, progress:{ current:i + 1, total:workspaces.length, label:`"${ws.label}" 읽는 중...` } };
      renderModals();

      let wsNewClients = 0, wsNewTx = 0, wsUpdTx = 0;
      try {
        const wsRef = napumDb.ref('workspaces/' + ws.id);
        const [csSnap, ordSnap, scSnap] = await Promise.all([
          wsRef.child('clients').get(),
          wsRef.child('orders').get(),
          wsRef.child('sharedClients').get(),
        ]);

        // 이 워크스페이스가 공개 허용한 거래처 목록
        const allowedClients = scSnap.exists() ? (scSnap.val() || []) : [];
        const allowedSet     = new Set(allowedClients);
        // CRM에 직접 등록한 자기 워크스페이스는 전체 허용, 공유로 받은 ws는 필터 적용
        const isSelfWs   = true; // doSync는 항상 자기가 등록한 ws만 처리
        // ※ 자기 워크스페이스는 sharedClients(공개 허용 목록) 필터를 적용하지 않음
        //    (해당 목록은 다른 사람 CRM에게 노출할 항목일 뿐, 내 CRM 동기화 범위와는 무관)
        const useFilter  = false;

        if (!csSnap.exists() && !ordSnap.exists()) {
          perWorkspace.push({ ...ws, error:true, newTx:0 });
          wsListUpdated[i] = { ...ws, lastSync:'ID 없음', syncedCount:0 };
          continue;
        }

        const napumClientsRaw = csSnap.val() || {};
        const napumClients    = Object.values(napumClientsRaw)
          .filter(nc => !useFilter || allowedSet.has(nc.name));
        const napumOrders     = Object.values(ordSnap.val() || {})
          .filter(o  => !useFilter || allowedSet.has(o.clientName));

        // napumClient id → 객체 맵 (order.clientId 매핑용)
        const napumClientById = {};
        napumClients.forEach(nc => { if (nc.id != null) napumClientById[String(nc.id)] = nc; });

        // ── 1단계: 거래처 병합 (orders 처리 전에 반드시 완료) ──────────────────
        napumClients.forEach(nc => {
          if (!nc.name || nc.isHidden) return;
          if (!nameToId[nc.name]) {
            const newC = {
              id: nextId(S.clients), name: nc.name, bizNo: '', rep: '', email: '',
              phone: nc.phone || '', address: nc.address || '', type: '매출처',
              memo: `[${ws.label}]${nc.note ? ' ' + nc.note : ''}`,
              _wsId: ws.id,
            };
            S.clients = [...S.clients, newC];
            nameToId[nc.name] = newC.id; wsNewClients++; totalNewClients++;
          } else {
            const cid = nameToId[nc.name];
            S.clients = S.clients.map(c => {
              if (c.id !== cid) return c;
              const next = { ...c };
              if (nc.phone   && !c.phone)   next.phone   = nc.phone;
              if (nc.address && !c.address) next.address = nc.address;
              if (!c._wsId) next._wsId = ws.id;
                    return next;
            });
          }
        });

        // ── 2단계: orders에 등장하는 거래처 중 아직 미등록인 것 추가 ─────────
        // order.clientName 또는 order.clientId → napumClient.name 으로 추출
        napumOrders.forEach(o => {
          const nc      = napumClientById[String(o.clientId)];
          const crmName = o.clientName || nc?.name || '';
          if (!crmName) return;
          if (!nameToId[crmName]) {
            // orders에는 있지만 clients 목록에 없는 케이스 (삭제된 거래처 등)
            const newC = {
              id: nextId(S.clients), name: crmName, bizNo: '', rep: '', email: '',
              phone: nc?.phone || '', address: nc?.address || '', type: '매출처',
              memo: `[${ws.label}] (주문에서 자동 추가)`,
              _wsId: ws.id,
            };
            S.clients = [...S.clients, newC];
            nameToId[crmName] = newC.id; wsNewClients++; totalNewClients++;
            console.info('[동기화] orders에서 거래처 자동 추가:', crmName, ws.label);
          }
        });

        // ── 3단계: 거래 처리 ─────────────────────────────────────────────────
        napumOrders.forEach(o => {
          if (!o.date || !o.total) return;
          const nc      = napumClientById[String(o.clientId)];
          const crmName = o.clientName || nc?.name || '';
          const crmClientId = nameToId[crmName];
          if (!crmClientId) {
            console.warn('[동기화] 거래처 매핑 실패 → 건너뜀', { orderId: o.id, clientId: o.clientId, crmName });
            return;
          }

          const memoItems = (o.items || []).map(i => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', ');
          const memo      = `[${ws.label}]${o.isVoid ? ' [타인]' : ''} ${o.note || (memoItems || '납품')}`;
          const amount    = Number(o.total) || 0;
          const status    = o.isPaid ? TX_STATUS.PAID : TX_STATUS.UNPAID;
          const napumKey  = `${ws.id}:${o.id}`;

          if (napumIdToCrmId[napumKey]) {
            S.transactions = S.transactions.map(t => {
              if (t.id !== napumIdToCrmId[napumKey]) return t;
              const next = { ...t, status, amount, tax: 0, memo };
              if (o.paidAmount)       next.paidAmount       = o.paidAmount;       else delete next.paidAmount;
              // 완납→미수 복귀 시 명시적으로 삭제
              if (o.paidAt)           next.paidAt           = o.paidAt;           else delete next.paidAt;
              if (o.paidMethod)       next.paidMethod       = o.paidMethod;       else delete next.paidMethod;
              if (o.paidMethodDetail) next.paidMethodDetail = o.paidMethodDetail; else delete next.paidMethodDetail;
              return next;
            });
            wsUpdTx++; totalUpdTx++;
          } else {
            const alreadyExists = S.transactions.some(t => t._napumId === napumKey);
            if (!alreadyExists) {
              const newT = {
                id: nextId(S.transactions), date: o.date, clientId: crmClientId,
                type: '매출', amount, tax: 0, memo, status, _napumId: napumKey,
              };
              if (o.items && o.items.length)  newT.items            = o.items;
              if (o.paidAmount)               newT.paidAmount       = o.paidAmount;
              if (o.paidAt)                   newT.paidAt           = o.paidAt;
              if (o.paidMethod)               newT.paidMethod       = o.paidMethod;
              if (o.paidMethodDetail)         newT.paidMethodDetail = o.paidMethodDetail;
              S.transactions = [...S.transactions, newT];
              synced.add(napumKey); wsNewTx++; totalNewTx++;
            }
          }
        });

        const wsTotal = wsNewTx + wsUpdTx;
        wsListUpdated[i] = { ...ws, lastSync: new Date().toLocaleString('ko-KR'), syncedCount: wsTotal };
        perWorkspace.push({ ...ws, error:false, newTx:wsNewTx, updTx:wsUpdTx });
      } catch (err) {
        perWorkspace.push({ ...ws, error:true, newTx:0, msg:err.message });
        wsListUpdated[i] = { ...ws, lastSync:'오류', syncedCount:0 };
      }
    }

    _saveWorkspaces(wsListUpdated);
    lsSet('crm_napum_synced', [...synced]);
    await saveC();
    await saveTX();
    render();

    M.syncModal = { ...M.syncModal, step:'done', result:{ wsCount:workspaces.length, newClients:totalNewClients, newTx:totalNewTx, updTx:totalUpdTx, perWorkspace } };
    renderModals();
  } catch (err) {
    M.syncModal = { ...M.syncModal, step:'error', error: err.message || '알 수 없는 오류가 발생했습니다.' };
    renderModals();
  }
}

// ── 납품 명세표 모달 ──────────────────────────────────────────────────────────
function openStatModal(clientName) {
  if (!clientName || clientName === '?') return;
  M.statModal = { clientName, month: thisMonth(), step:'loading', orders:[], error:null };
  _pushModalHistory();
  renderModals();
  _loadStatOrders();
}
function closeStatModal() { M.statModal = null; renderModals(); }

function setStatMonth(m) {
  M.statModal.month = m; M.statModal.step = 'loading';
  renderModals(); _loadStatOrders();
}

async function _loadStatOrders() {
  const sm = M.statModal;
  if (!sm) return;

  let workspaces = [..._getWorkspaces()];
  const wsFromTx = new Map();
  workspaces.forEach(w => wsFromTx.set(w.id, w.label));

  const clientTxs = S.transactions.filter(t => {
    const cl = S.clients.find(c => c.id === t.clientId);
    return (cl?.name || '') === sm.clientName && t._napumId;
  });
  clientTxs.forEach(t => {
    const sep = t._napumId.indexOf(':');
    if (sep > 0) {
      const wsId = t._napumId.slice(0, sep);
      if (!wsFromTx.has(wsId)) { wsFromTx.set(wsId, wsId); workspaces.push({ id:wsId, label:wsId }); }
    }
  });

  if (!workspaces.length) {
    M.statModal = { ...sm, step:'error', error:'워크스페이스가 등록되지 않았습니다.\n사이드바 메뉴 → 납품 관리 연동에서 추가하세요.' };
    renderModals(); return;
  }

  try {
    if (!_fbReady) await initFirebase();
    const napumDb   = _getNapumApp().database();
    const allOrders = [];

    // CRM에 직접 등록된 워크스페이스 ID 목록 (자기 워크스페이스)
    const selfWsIds = new Set(_getWorkspaces().map(w => w.id));

    await Promise.all(workspaces.map(async ws => {
      try {
        // 1) 이 워크스페이스가 공개 허용한 거래처 확인
        // ※ 자기 워크스페이스(isSelfWs)는 sharedClients 필터 적용 안 함
        //    (납품앱에서 일부 거래처만 공개 등록해도 자기 내역은 항상 전체 조회)
        const isSelfWs = selfWsIds.has(ws.id);
        if (!isSelfWs) {
          const scSnap       = await napumDb.ref(`workspaces/${ws.id}/sharedClients`).get();
          const allowedNames = scSnap.exists() ? (scSnap.val() || []) : [];
          // 공개 목록이 있고, 현재 조회 거래처가 허용 목록에 없으면 스킵
          if (allowedNames.length > 0 && !allowedNames.includes(sm.clientName)) return;
        }

        const snap   = await napumDb.ref(`workspaces/${ws.id}/orders`).get();
        const orders = Object.values(snap.val() || {});
        orders.forEach(o => {
          if ((o.clientName || '') === sm.clientName)
            allOrders.push({ ...o, _wsLabel: ws.label, _wsId: ws.id });
        });
      } catch (e) { /* 워크스페이스 오류 무시 */ }
    }));

    allOrders.sort((a, b) => a.date.localeCompare(b.date));
    if (M.statModal) M.statModal = { ...M.statModal, step:'done', orders:allOrders, error:null };
    renderModals();
  } catch (err) {
    if (M.statModal) M.statModal = { ...M.statModal, step:'error', error: err.message };
    renderModals();
  }
}

// ── 납품 명세표 공유 ──────────────────────────────────────────────────────────
function shareStatModal(type) {
  const sm = M.statModal;
  if (!sm || sm.step !== 'done') return;
  const { clientName, month, orders } = sm;

  const cl = S.clients.find(c => c.name === clientName);
  const phone = (cl?.phone || '').replace(/[^0-9]/g, '');

  const monthStart  = month + '-01';
  const filt        = orders.filter(o => o.date && o.date.startsWith(month));
  const carryOrders = orders.filter(o => o.date && o.date < monthStart && !o.isPaid);
  const _eff  = o => o.isPaid && (o.discount || 0) > 0 ? o.total - o.discount : o.total;
  const _paid = o => o.isPaid ? (o.paidAmount || o.total) : (o.paidAmount || 0);
  const carryAmt    = carryOrders.reduce((s, o) => s + (o.total - (o.paidAmount || 0)), 0);
  const monthTotal  = filt.reduce((s, o) => s + _eff(o), 0);
  const monthPaid   = filt.reduce((s, o) => s + _paid(o), 0);
  const monthUnpaid = monthTotal - monthPaid;
  const grandUnpaid = carryAmt + monthUnpaid;

  const lines = [];
  lines.push(`📋 ${clientName} 거래명세표`);
  lines.push(`📅 ${fmtMonth(month)}`);
  lines.push('');
  if (carryAmt > 0)
    lines.push(`⏩ 전월 이월: ${fmtW(carryAmt)}`);
  lines.push(`📦 당월 매출: ${fmtW(monthTotal)}`);
  lines.push(`💳 수금액:   ${fmtW(monthPaid)}`);
  lines.push(`🧾 청구 금액: ${fmtW(grandUnpaid)}`);
  lines.push('');
  lines.push('🏦 입금 계좌');
  lines.push('농협 916-02-055664');
  lines.push('예금주: 이애경');

  const text = lines.join('\n');

  if (type === 'sms') {
    // SMS: sms:번호?body=내용
    const encoded = encodeURIComponent(text);
    const uri = phone ? `sms:${phone}?body=${encoded}` : `sms:?body=${encoded}`;
    window.location.href = uri;
  } else if (type === 'kakao') {
    // 카카오: 전화번호 없어도 클립보드 복사 후 안내
    if (navigator.share) {
      navigator.share({ title: `${clientName} 거래명세표`, text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text).then(() => {
        alert('내용이 클립보드에 복사됐습니다.\n카카오톡을 열어 붙여넣기 해주세요.');
      }).catch(() => {
        alert('공유가 지원되지 않는 환경입니다.\n직접 복사 후 전송해주세요.');
      });
    }
  }
}


function buildSyncModal() {
  const sm         = M.syncModal;
  const workspaces = _getWorkspaces();
  let body = '';

  if (sm.step === 'idle' || sm.step === 'error') {
    const wsList = workspaces.length === 0
      ? `<div style="text-align:center;padding:18px 0;color:#94a3b8;font-size:12px;">등록된 워크스페이스가 없습니다.<br>아래에서 추가하세요.</div>`
      : workspaces.map(w => `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:#0f172a;">${esc(w.label)}</div>
            <div style="font-size:10px;color:#94a3b8;letter-spacing:.5px;">${esc(w.id)}${w.lastSync ? ` · ${esc(w.lastSync)}` : ''}</div>
            <div id="scBadge_${esc(w.id)}" style="font-size:10px;color:#6366f1;margin-top:2px;"></div>
          </div>
          ${w.lastSync ? `<span style="font-size:10px;background:#dcfce7;color:#16a34a;padding:2px 6px;border-radius:9999px;font-weight:600;">${w.syncedCount}건</span>` : ''}
          <button onclick="syncRemoveWorkspace('${esc(w.id)}')" style="background:none;border:none;cursor:pointer;color:#fca5a5;padding:2px;" title="삭제">${I.trash}</button>
        </div>`).join('');

    body = `
      <div style="margin-bottom:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="font-size:12px;font-weight:600;color:#475569;">연동 워크스페이스 (${workspaces.length}개)</div>
        </div>
        <div style="max-height:180px;overflow-y:auto;">${wsList}</div>
      </div>
      <div style="background:#fefce8;border:1px solid #fef08a;border-radius:8px;padding:12px;margin-bottom:12px;">
        <div style="font-size:11px;font-weight:600;color:#713f12;margin-bottom:8px;">+ 워크스페이스 추가</div>
        <input id="sm_newLabel" value="${esc(sm.newLabel || '')}" placeholder="이름 (예: 홍길동)"
          style="${ISX}font-size:13px;margin-bottom:6px;" ${FB}
          oninput="M.syncModal.newLabel=this.value">
        <div style="display:flex;gap:6px;">
          <input id="sm_newId" value="${esc(sm.newInput || '')}" placeholder="워크스페이스 ID (예: myshop2024)"
            style="${ISX}font-size:13px;flex:1;" ${FB}
            oninput="M.syncModal.newInput=this.value"
            onkeydown="if(event.key==='Enter')syncAddWorkspace()">
          <button onclick="syncAddWorkspace()" style="padding:8px 12px;border:none;background:#d97706;color:#fff;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">추가</button>
        </div>
      </div>
      ${sm.error ? `<div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:12px;color:#dc2626;">⚠️ ${esc(sm.error)}</div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:9px;font-size:11px;color:#0c4a6e;">
          <div style="font-weight:600;margin-bottom:3px;">가져오는 항목</div>
          <div>• 거래처 → 매출처 자동 병합</div>
          <div>• 전표 → 매출 거래</div>
          <div>• 완납/미납 상태 동기화</div>
        </div>
        <div style="background:#fdf4ff;border:1px solid #e9d5ff;border-radius:8px;padding:9px;font-size:11px;color:#581c87;">
          <div style="font-weight:600;margin-bottom:3px;">다중 사용자</div>
          <div>• 전 사용자 동시 동기화</div>
          <div>• 출처 태그 자동 기재</div>
          <div>• 중복 전표 자동 방지</div>
        </div>
      </div>`;

  } else if (sm.step === 'loading') {
    const prog = sm.progress || { current:0, total:0, label:'' };
    const pct  = prog.total > 0 ? Math.round(prog.current / prog.total * 100) : 0;
    body = `
      <div style="text-align:center;padding:24px 0 16px;">
        <div style="width:44px;height:44px;border:3px solid #e2e8f0;border-top-color:#d97706;border-radius:50%;animation:sp .8s linear infinite;margin:0 auto 14px;"></div>
        <div style="color:#0f172a;font-size:13px;font-weight:600;margin-bottom:4px;">${prog.total > 1 ? `${prog.current}/${prog.total} 워크스페이스 처리 중` : ''}</div>
        <div style="color:#64748b;font-size:12px;">${esc(prog.label || '데이터를 읽어오는 중...')}</div>
        ${prog.total > 1 ? `
        <div style="margin:14px 0 0;background:#e2e8f0;border-radius:9999px;height:6px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:#d97706;border-radius:9999px;transition:width .3s;"></div>
        </div>` : ''}
      </div>`;

  } else if (sm.step === 'done') {
    const r    = sm.result;
    const perWs = r.perWorkspace || [];
    body = `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;margin-bottom:12px;">
        <div style="color:#16a34a;font-weight:700;font-size:14px;margin-bottom:10px;">✅ 전체 동기화 완료</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;">
          ${[
            { label:'워크스페이스', val: r.wsCount + '개',      color:'#7c3aed', bg:'#f5f3ff' },
            { label:'신규 거래처',  val: r.newClients + '개',   color:'#16a34a', bg:'#f0fdf4' },
            { label:'신규 거래',    val: r.newTx + '건',        color:'#b45309', bg:'#fefce8' },
            { label:'업데이트',     val: r.updTx + '건',        color:'#1d4ed8', bg:'#eff6ff' },
          ].map(({ label, val, color, bg }) => `
            <div style="background:${bg};border-radius:8px;padding:8px 4px;text-align:center;">
              <div style="color:${color};font-size:16px;font-weight:700;">${esc(val)}</div>
              <div style="color:#94a3b8;font-size:10px;">${esc(label)}</div>
            </div>`).join('')}
        </div>
      </div>
      ${perWs.length > 1 ? `
      <div style="font-size:11px;color:#64748b;margin-bottom:8px;font-weight:600;">워크스페이스별 결과</div>
      <div style="display:flex;flex-direction:column;gap:5px;max-height:150px;overflow-y:auto;">
        ${perWs.map(w => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:#f8fafc;border-radius:7px;border:1px solid #e2e8f0;">
            <div>
              <span style="font-size:12px;font-weight:600;color:#0f172a;">${esc(w.label)}</span>
              <span style="font-size:10px;color:#94a3b8;margin-left:4px;">${esc(w.id)}</span>
            </div>
            <div style="display:flex;gap:6px;">
              ${w.error
                ? `<span style="font-size:10px;background:#fee2e2;color:#dc2626;padding:2px 7px;border-radius:9999px;">오류</span>`
                : `<span style="font-size:10px;background:#dcfce7;color:#16a34a;padding:2px 7px;border-radius:9999px;">+${w.newTx}건</span>`}
            </div>
          </div>`).join('')}
      </div>` : ''}`;
  }

  const isIdle    = sm.step === 'idle' || sm.step === 'error';
  const isDone    = sm.step === 'done';
  const isLoading = sm.step === 'loading';

  return `
    <div onclick="closeSyncModal()" style="position:fixed;top:0;right:0;bottom:0;left:0;background:rgba(15,23,42,.45);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px;">
      <div onclick="event.stopPropagation()" style="background:#fff;border-radius:14px;width:100%;max-width:420px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2);">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #e2e8f0;">
          <div style="display:flex;align-items:center;gap:8px;">
            ${I.spark}
            <span style="font-weight:700;color:#0f172a;font-size:15px;">납품 관리 연동</span>
          </div>
          <button onclick="closeSyncModal()" style="background:none;border:none;cursor:pointer;color:#94a3b8;">${I.x}</button>
        </div>
        <div style="padding:18px;">${body}</div>
        <!-- 실시간 새로고침 버튼 -->
        ${workspaces.length > 0 && !isDone ? `
        <div style="padding:0 18px 8px;">
          <button onclick="refreshNapumListeners();closeSyncModal();"
            style="width:100%;padding:8px;border:1.5px dashed #d97706;background:#fffbeb;color:#b45309;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">
            🔄 실시간 연결 새로고침 (반영 안 될 때)
          </button>
        </div>` : ''}
        <div style="display:flex;gap:8px;padding:0 18px 18px;">
          ${isDone
            ? `<button onclick="closeSyncModal()" style="flex:1;padding:10px;border:none;background:#d97706;color:#fff;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">확인</button>`
            : `<button onclick="closeSyncModal()" style="flex:1;padding:10px;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;border-radius:8px;font-size:13px;cursor:pointer;">닫기</button>
               <button onclick="doSyncFromDelivery()" ${isLoading || workspaces.length === 0 ? 'disabled' : ''} style="flex:2;padding:10px;border:none;background:${isLoading ? '#fcd34d' : workspaces.length === 0 ? '#e2e8f0' : '#d97706'};color:${workspaces.length === 0 ? '#94a3b8' : '#fff'};border-radius:8px;font-size:13px;font-weight:600;cursor:${workspaces.length === 0 ? 'not-allowed' : 'pointer'};">
                 ${isLoading ? '동기화 중...' : workspaces.length === 0 ? '워크스페이스 없음' : `▶ 전체 동기화 (${workspaces.length}개)`}
               </button>`}
        </div>
      </div>
    </div>`;
}

// ── 납품 명세표 모달 빌드 ─────────────────────────────────────────────────────
function buildStatModal() {
  const sm = M.statModal;
  if (!sm) return '';
  const { clientName, month, step, orders, error } = sm;

  // 월 옵션 (데이터 있는 월 + 최근 6개월)
  const monthSet = new Set();
  const cur = thisMonth();
  for (let i = 0; i < 6; i++) {
    let m = cur;
    for (let j = 0; j < i; j++) m = prevMonth(m);
    monthSet.add(m);
  }
  orders.forEach(o => { if (o.date) monthSet.add(o.date.slice(0, 7)); });
  const monthList = [...monthSet].sort().reverse();

  const curIdx = monthList.indexOf(month);
  const prevM  = curIdx < monthList.length - 1 ? monthList[curIdx + 1] : null;
  const nextM  = curIdx > 0                    ? monthList[curIdx - 1] : null;

  const monthNav = `
    <div style="display:flex;align-items:center;gap:6px;margin-left:auto;">
      <button onclick="${prevM ? `setStatMonth('${prevM}')` : 'void 0'}"
        ${!prevM ? 'disabled' : ''}
        style="width:32px;height:32px;border:1px solid #e2e8f0;border-radius:8px;background:${prevM?'#fff':'#f8fafc'};color:${prevM?'#374151':'#cbd5e1'};font-size:15px;cursor:${prevM?'pointer':'default'};display:flex;align-items:center;justify-content:center;">&#8249;</button>
      <span style="font-size:13px;font-weight:700;color:#0f172a;min-width:72px;text-align:center;">${fmtMonth(month)}</span>
      <button onclick="${nextM ? `setStatMonth('${nextM}')` : 'void 0'}"
        ${!nextM ? 'disabled' : ''}
        style="width:32px;height:32px;border:1px solid #e2e8f0;border-radius:8px;background:${nextM?'#fff':'#f8fafc'};color:${nextM?'#374151':'#cbd5e1'};font-size:15px;cursor:${nextM?'pointer':'default'};display:flex;align-items:center;justify-content:center;">&#8250;</button>
    </div>`;

  let body = '';
  if (step === 'loading') {
    body = `<div style="text-align:center;padding:40px 0;">
      <div style="width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#d97706;border-radius:50%;animation:sp .8s linear infinite;margin:0 auto 14px;"></div>
      <div style="color:#64748b;font-size:13px;">납품 내역을 불러오는 중...</div>
    </div>`;
  } else if (step === 'error') {
    body = `<div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;padding:16px;text-align:center;color:#dc2626;font-size:13px;">
      ⚠️ ${esc(error || '오류가 발생했습니다.')}
    </div>`;
  } else {
    const monthStart = month + '-01';
    const filt        = orders.filter(o => o.date && o.date.startsWith(month));
    const carryOrders = orders.filter(o => o.date && o.date < monthStart && !o.isPaid);
    const _eff  = o => o.isPaid && (o.discount || 0) > 0 ? o.total - o.discount : o.total;
    const _paid = o => o.isPaid ? (o.paidAmount || o.total) : (o.paidAmount || 0);

    const monthTotal  = filt.reduce((s, o) => s + _eff(o), 0);
    const monthPaid   = filt.reduce((s, o) => s + _paid(o), 0);
    const monthUnpaid = monthTotal - monthPaid;
    const carryAmt    = carryOrders.reduce((s, o) => s + (o.total - (o.paidAmount || 0)), 0);
    const grandUnpaid = carryAmt + monthUnpaid;

    const summaryRows = [
      carryAmt > 0 ? { label:'⏩ 전월 이월', val:fmtW(carryAmt),    color:'#b45309', bg:'#fefce8', bd:'#fef08a' } : null,
      { label:'당월 매출', val:fmtW(monthTotal),  color:'#16a34a', bg:'#f0fdf4', bd:'#bbf7d0' },
      { label:'수금액',    val:fmtW(monthPaid),   color:'#1d4ed8', bg:'#eff6ff', bd:'#bfdbfe' },
      { label:'청구 금액', val:fmtW(grandUnpaid), color: grandUnpaid > 0 ? '#dc2626' : '#16a34a', bg: grandUnpaid > 0 ? '#fff1f2' : '#f0fdf4', bd: grandUnpaid > 0 ? '#fecdd3' : '#bbf7d0' },
    ].filter(Boolean).map(({ label, val, color, bg, bd }) => `
      <div style="background:${bg};border:1px solid ${bd};border-radius:8px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">
        <span style="color:#64748b;font-size:12px;">${label}</span>
        <span style="color:${color};font-weight:700;font-size:14px;">${val}</span>
      </div>`).join('');

    const carryRows = carryOrders.map(o => {
      const partial = (o.paidAmount || 0) > 0;
      return `<tr style="background:#fefce8;">
        <td style="color:#b45309;font-size:11px;white-space:nowrap;">${esc(o.date)}</td>
        <td style="font-size:11px;">${esc(_fmtStatItems(o))}</td>
        <td style="text-align:right;font-size:12px;font-weight:600;color:#b45309;white-space:nowrap;">${fmtW(o.total)}</td>
        <td style="text-align:center;">
          <span style="font-size:10px;background:#fef3c7;color:#b45309;border-radius:9999px;padding:2px 6px;font-weight:700;">이월</span>
          ${partial ? `<div style="font-size:9px;color:#1d4ed8;">+${fmtW(o.paidAmount)}</div>` : ''}
        </td>
      </tr>`;
    }).join('');

    const monthRows = filt.length === 0
      ? `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:16px;font-size:12px;">당월 내역 없음</td></tr>`
      : filt.map(o => {
          const partial   = !o.isPaid && (o.paidAmount || 0) > 0;
          const multiWs   = _getWorkspaces().length > 1;
          const wsBadge   = multiWs ? `<span style="font-size:9px;background:#e0e7ff;color:#4f46e5;border-radius:4px;padding:1px 4px;margin-left:3px;">${esc(o._wsLabel || '')}</span>` : '';
          const statBadge = o.isPaid
            ? `<span style="font-size:10px;background:#dcfce7;color:#16a34a;border-radius:9999px;padding:2px 6px;font-weight:700;">${o.discount > 0 ? '✂️할인' : '✅완납'}</span>`
            : partial
            ? `<span style="font-size:10px;background:#eff6ff;color:#1d4ed8;border-radius:9999px;padding:2px 6px;font-weight:700;">💳부분</span>`
            : `<span style="font-size:10px;background:#fee2e2;color:#dc2626;border-radius:9999px;padding:2px 6px;font-weight:700;">미수</span>`;
          const partialDetail = partial ? `<tr style="background:#f0f9ff;">
            <td colspan="4" style="padding:4px 8px 6px 20px;font-size:10px;color:#1d4ed8;">
              💳 수금 ${fmtW(o.paidAmount)} · 잔여 ${fmtW(o.total - (o.paidAmount || 0))}
              ${o.paidMethod === 'transfer' ? '🏦' : o.paidMethod === 'mixed' ? '🔀' : o.paidMethod === 'cash' ? '💵' : ''}
              ${o.paidAt ? `· ${o.paidAt.slice(0, 10)}` : ''}
            </td>
          </tr>` : '';
          return `<tr style="border-bottom:1px solid #f1f5f9;${!o.isPaid ? 'background:#fffbeb;' : ''}">
            <td style="font-size:11px;white-space:nowrap;color:#64748b;">${esc(o.date)}</td>
            <td style="font-size:11px;">${esc(_fmtStatItems(o))}${wsBadge}</td>
            <td style="text-align:right;font-size:12px;font-weight:600;white-space:nowrap;">${fmtW(o.total)}</td>
            <td style="text-align:center;">${statBadge}</td>
          </tr>${partialDetail}`;
        }).join('');

    body = `
      ${summaryRows ? `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px;">${summaryRows}</div>` : ''}
      <div style="overflow-x:auto;border-radius:10px;border:1px solid #e2e8f0;">
        <table style="width:100%;border-collapse:collapse;min-width:280px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;">날짜</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;">품목</th>
              <th style="padding:8px 10px;text-align:right;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;">금액</th>
              <th style="padding:8px 10px;text-align:center;font-size:11px;color:#64748b;border-bottom:1px solid #e2e8f0;">상태</th>
            </tr>
          </thead>
          <tbody>${carryRows}${monthRows}</tbody>
          ${filt.length > 0 ? `<tfoot>
            <tr style="background:#f8fafc;border-top:2px solid #e2e8f0;">
              <td colspan="2" style="padding:9px 10px;font-size:12px;color:#64748b;font-weight:600;">합계</td>
              <td style="padding:9px 10px;text-align:right;font-size:13px;font-weight:700;color:#16a34a;">${fmtW(monthTotal)}</td>
              <td></td>
            </tr>
          </tfoot>` : ''}
        </table>
      </div>
      ${orders.length === 0 ? `<div style="text-align:center;color:#94a3b8;font-size:12px;margin-top:12px;">연동된 납품 내역이 없습니다.<br>납품 관리 동기화 후 다시 확인하세요.</div>` : ''}`;
  }

  return `
    <div onclick="closeStatModal()" style="position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:50;display:flex;align-items:flex-end;justify-content:center;padding-bottom:env(safe-area-inset-bottom);">
      <div onclick="event.stopPropagation()" style="background:#fff;border-radius:18px 18px 0 0;width:100%;max-width:520px;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 -8px 40px rgba(0,0,0,.18);">
        <div style="width:36px;height:4px;background:#e2e8f0;border-radius:2px;margin:10px auto 0;flex-shrink:0;"></div>
        <div style="padding:14px 18px 0;flex-shrink:0;">
          <!-- 1행: 거래처명 + 닫기 -->
          <div style="display:flex;align-items:flex-start;justify-content:space-between;">
            <div>
              <div style="font-weight:700;color:#0f172a;font-size:15px;">📋 ${esc(clientName)}</div>
              <div style="color:#64748b;font-size:12px;margin-top:2px;">납품 거래명세표</div>
            </div>
            <button onclick="closeStatModal()" style="background:none;border:none;cursor:pointer;color:#94a3b8;padding:2px;">${I.x}</button>
          </div>
          <!-- 2행: 공유버튼 + 월선택 -->
          ${step === 'done' ? `
          <div style="display:flex;align-items:center;gap:8px;margin-top:10px;padding-bottom:12px;border-bottom:1px solid #f1f5f9;">
            <button onclick="shareStatModal('sms')" title="문자 전송"
              style="display:flex;align-items:center;gap:5px;background:#16a34a;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;">
              💬 문자
            </button>
            <button onclick="shareStatModal('kakao')" title="카카오톡/공유"
              style="display:flex;align-items:center;gap:5px;background:#f9e000;color:#3c1e1e;border:none;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;">
              🟡 카톡
            </button>
            ${monthNav}
          </div>` : `<div style="border-bottom:1px solid #f1f5f9;margin-top:12px;"></div>`}
        </div>
        <div style="overflow-y:auto;padding:16px 18px;-webkit-overflow-scrolling:touch;">${body}</div>
      </div>
    </div>`;
}
