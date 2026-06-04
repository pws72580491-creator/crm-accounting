// ── Number Formatters ─────────────────────────────────────────────────────────
const fmt  = n => new Intl.NumberFormat('ko-KR').format(n || 0);
const fmtW = n => `₩${fmt(n)}`;

/** 금액 input 콤마 포맷 헬퍼 (커서 위치 보정) */
function applyAmtFmt(el) {
  const raw = el.value.replace(/[^0-9]/g, '');
  const formatted = raw ? new Intl.NumberFormat('ko-KR').format(Number(raw)) : '';
  if (el.value === formatted) return;
  const cur = el.selectionStart || 0;
  const digBefore = el.value.slice(0, cur).replace(/[^0-9]/g, '').length;
  el.value = formatted;
  let cnt = 0, pos = 0;
  for (; pos < formatted.length; pos++) {
    if (/[0-9]/.test(formatted[pos])) cnt++;
    if (cnt >= digBefore) break;
  }
  const newPos = formatted.length > 0 ? (digBefore === 0 ? 0 : pos + 1) : 0;
  try { el.setSelectionRange(newPos, newPos); } catch {}
}

// ── Date Helpers ──────────────────────────────────────────────────────────────
/** UTC 기준 버그 수정 → 로컬(KST) 날짜 사용 */
const localDate = d => {
  const t = d || new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
const today      = () => localDate();
const thisMonth  = () => localDate().slice(0, 7);

/** 로컬 날짜 파싱 (new Date('YYYY-MM-DD')는 UTC→KST 하루 어긋남 방지) */
function _parseLocal(d) {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd);
}

function _prevDay(d)    { const dt = _parseLocal(d); dt.setDate(dt.getDate() - 1); return localDate(dt); }
function _nextDay(d)    { const dt = _parseLocal(d); dt.setDate(dt.getDate() + 1); return localDate(dt); }
function _fmtDayFull(d) {
  const [y, m, dd] = d.split('-').map(Number);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${y}년 ${+m}월 ${+dd}일 (${days[_parseLocal(d).getDay()]})`;
}

// 주(週) 헬퍼 - 월요일 기준
function _weekOf(d)    { const dt = _parseLocal(d); const dow = dt.getDay(); const diff = dow === 0 ? -6 : 1 - dow; dt.setDate(dt.getDate() + diff); return localDate(dt); }
function _weekEnd(mon) { const dt = _parseLocal(mon); dt.setDate(dt.getDate() + 6); return localDate(dt); }
function _prevWeek(mon){ const dt = _parseLocal(mon); dt.setDate(dt.getDate() - 7); return localDate(dt); }
function _nextWeek(mon){ const dt = _parseLocal(mon); dt.setDate(dt.getDate() + 7); return localDate(dt); }
function _inWeek(date, mon){ return date >= mon && date <= _weekEnd(mon); }
function _fmtWeek(mon) {
  const end = _weekEnd(mon);
  const [ym, mm, dm] = mon.split('-');
  const [ye, me, de] = end.split('-');
  return ym === ye && mm === me
    ? `${+ym}년 ${+mm}월 ${+dm}~${+de}일`
    : `${+ym}년 ${+mm}월 ${+dm}일 ~ ${+me}월 ${+de}일`;
}

function prevMonth(ym) { const [y, m] = ym.split('-').map(Number); return m === 1  ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; }
function nextMonth(ym) { const [y, m] = ym.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; }
function fmtMonth(ym)  { const [y, m] = ym.split('-'); return `${y}년 ${+m}월`; }

function monthOptions() {
  const cur = thisMonth();
  const months = new Set([cur]);
  S.transactions.forEach(t => { if (t.date) months.add(t.date.slice(0, 7)); });
  const sorted = [...months].sort();
  const min = sorted[0] || cur;
  const list = [];
  let m = min;
  while (m <= cur) { list.push(m); m = nextMonth(m); }
  return list;
}

// ── ID Generator ──────────────────────────────────────────────────────────────
/** 다중기기 동시 추가 시 ID 충돌 방지 → timestamp 기반 */
const nextId = arr => {
  const ts = Date.now();
  const mx = arr.length === 0 ? 0 : Math.max(...arr.map(x => x.id || 0));
  return Math.max(ts, mx + 1);
};

// ── HTML Escaping ─────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── 초성 검색 ─────────────────────────────────────────────────────────────────
const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const getCs = s => [...String(s ?? '')].map(c => {
  const n = c.charCodeAt(0);
  return (n >= 0xAC00 && n <= 0xD7A3) ? CHO[Math.floor((n - 0xAC00) / 588)] : c;
}).join('');
const matchStr = (text, q) => {
  if (!q) return true;
  const t = String(text ?? '').toLowerCase(), lq = q.toLowerCase();
  if (t.includes(lq)) return true;
  if ([...lq].every(c => CHO.includes(c))) return getCs(t).includes(lq);
  return false;
};
const matchAny = (q, ...fields) => !q || fields.some(f => matchStr(f, q));

// ── Toast ─────────────────────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText = 'position:fixed;bottom:calc(80px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%) translateY(60px);background:#0f172a;color:#fff;padding:10px 20px;border-radius:9999px;font-size:13px;font-weight:500;z-index:9999;transition:transform .25s,opacity .25s;opacity:0;white-space:nowrap;pointer-events:none;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.transform = 'translateX(-50%) translateY(0)';
  el.style.opacity = '1';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.style.transform = 'translateX(-50%) translateY(60px)';
    el.style.opacity = '0';
  }, 2400);
}

// ── Transaction Helpers ───────────────────────────────────────────────────────
const _txRemain    = t => (t.amount + t.tax) - (t.paidAmount || 0);
const _txIsPending = t => t.status === '미수금' || t.status === '미지급금';

/** 상태 배지 HTML */
function statusBadge(status, txId) {
  const partial = txId != null && (() => {
    const t = S.transactions.find(x => x.id === txId);
    return t && (t.paidAmount || 0) > 0 && _txIsPending(t);
  })();
  const c = partial
    ? { bg:'#eff6ff', bd:'#93c5fd', tx:'#1d4ed8' }
    : STATUS_CFG[status] || { bg:'#f1f5f9', bd:'#cbd5e1', tx:'#64748b' };
  const label = partial ? '💳 부분' : esc(status);

  if (txId != null) {
    if (status === '미수금' || status === '미지급금')
      return `<span onclick="openQuickPay(${txId})" style="background:${c.bg};border:1px solid ${c.bd};color:${c.tx};cursor:pointer;font-size:11px;padding:2px 8px;border-radius:9999px;font-weight:600;user-select:none;white-space:nowrap;">${label}</span>`;
    return `<span onclick="toggleStatus(${txId})" style="background:${c.bg};border:1px solid ${c.bd};color:${c.tx};cursor:pointer;font-size:11px;padding:2px 8px;border-radius:9999px;font-weight:600;user-select:none;white-space:nowrap;">${label}</span>`;
  }
  return `<span style="background:${c.bg};border:1px solid ${c.bd};color:${c.tx};cursor:default;font-size:11px;padding:2px 8px;border-radius:9999px;font-weight:600;user-select:none;white-space:nowrap;">${label}</span>`;
}

/** 납품 명세표 품목 포맷 */
function _fmtStatItems(o) {
  const items = o.items || [];
  if (!items.length) return o.note || '(품목 없음)';
  return items.map(i => {
    const qty   = i.qty || 1;
    const price = i.price || i.unitPrice || 0;
    let str = i.name;
    if (qty > 1) str += ` ×${qty}`;
    if (price)   str += ` @${fmtW(price)}`;
    return str;
  }).join(', ');
}

/** 결제 수단 탭 헬퍼 */
function _methodTab(cur, key, label, color, targetModal) {
  const a = cur === key;
  const fn = targetModal === 'qp'
    ? `M.qpModal.method='${key}';renderModals()`
    : `M.batchPayModal.method='${key}';renderModals()`;
  return `<button onclick="${fn}"
    style="flex:1;padding:8px 0;border-radius:8px;border:1px solid ${a ? color : '#e2e8f0'};background:${a ? color + '20' : '#f8fafc'};color:${a ? color : '#64748b'};font-size:12px;font-weight:${a ? 700 : 400};cursor:pointer;">${label}</button>`;
}
function _methodTabs(cur, targetModal) {
  return `<div style="display:flex;gap:6px;">
    ${_methodTab(cur, 'cash',     '💵 현금',    '#16a34a', targetModal)}
    ${_methodTab(cur, 'transfer', '🏦 계좌이체', '#1d4ed8', targetModal)}
    ${_methodTab(cur, 'mixed',    '🔀 혼합',     '#7c3aed', targetModal)}
  </div>`;
}
function _mixedInputs(m, targetModal) {
  if (m !== 'mixed') return '';
  const mo  = targetModal === 'qp' ? M.qpModal : M.batchPayModal;
  const pfx = targetModal === 'qp' ? 'qpModal' : 'batchPayModal';
  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
      <div>
        <div style="font-size:11px;color:#64748b;margin-bottom:4px;">💵 현금</div>
        <input type="text" inputmode="numeric" value="${mo.mixCash ? fmt(mo.mixCash) : ''}" placeholder="0"
          style="${ISX}font-size:13px;" ${FB}
          oninput="applyAmtFmt(this);M.${pfx}.mixCash=parseInt(this.value.replace(/[^0-9]/g,''))||0;_syncMixedTotal('${targetModal}')">
      </div>
      <div>
        <div style="font-size:11px;color:#64748b;margin-bottom:4px;">🏦 계좌이체</div>
        <input type="text" inputmode="numeric" value="${mo.mixTransfer ? fmt(mo.mixTransfer) : ''}" placeholder="0"
          style="${ISX}font-size:13px;" ${FB}
          oninput="applyAmtFmt(this);M.${pfx}.mixTransfer=parseInt(this.value.replace(/[^0-9]/g,''))||0;_syncMixedTotal('${targetModal}')">
      </div>
    </div>`;
}
function _syncMixedTotal(targetModal) {
  const mo = targetModal === 'qp' ? M.qpModal : M.batchPayModal;
  mo.amount = (mo.mixCash || 0) + (mo.mixTransfer || 0);
  _updatePayPreview(targetModal);
}
function _updatePayPreview(targetModal) {
  if (targetModal === 'qp') {
    const mo = M.qpModal; if (!mo) return;
    const t  = S.transactions.find(x => x.id === mo.txId); if (!t) return;
    const remain = _txRemain(t);
    const amt    = mo.method === 'mixed' ? (mo.mixCash || 0) + (mo.mixTransfer || 0) : (mo.amount || 0);
    const el = document.getElementById('qp_preview'); if (!el) return;
    if (amt <= 0) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.innerHTML = amt >= remain
      ? `<span style="color:#16a34a;font-weight:600;">✅ 전액 수금 완료</span>`
      : `<span style="color:#b45309;">💳 부분 수금 · 잔여 <b>${fmtW(remain - amt)}</b></span>`;
  } else {
    _renderBatchPreview();
  }
}
