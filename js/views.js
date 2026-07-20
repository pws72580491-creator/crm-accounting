// ── 대시보드 캐시 ─────────────────────────────────────────────────────────────
let _dashCache    = null;
let _dashCacheKey = '';

function _dashKey() {
  return S.txMonth + '|' + S.transactions.length + '|' + S.clients.length + '|'
    + S.transactions.map(t => t.id + '_' + t.status + '_' + (t.paidAmount || 0) + '_' + t.amount).join(',');
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function buildDashboard() {
  const ck = _dashKey();
  if (_dashCache && _dashCacheKey === ck) return _dashCache;
  _dashCacheKey = ck;

  const mon   = S.txMonth;
  const cur   = thisMonth();
  const canNext = mon < cur;
  const monT  = S.transactions.filter(t => t.date.startsWith(mon));
  const rev   = monT.filter(t => t.type === '매출').reduce((s, t) => s + t.amount, 0);
  const pur   = monT.filter(t => t.type === '매입').reduce((s, t) => s + t.amount, 0);
  const pl    = rev - pur;

  // 전월 데이터 (증감률)
  const prevMon  = prevMonth(mon);
  const prevMonT = S.transactions.filter(t => t.date.startsWith(prevMon));
  const prevRev  = prevMonT.filter(t => t.type === '매출').reduce((s, t) => s + t.amount, 0);
  const prevPur  = prevMonT.filter(t => t.type === '매입').reduce((s, t) => s + t.amount, 0);
  const prevPl   = prevRev - prevPur;

  const _growthBadge = (cur, prev, posColor, negColor) => {
    if (prev === 0 && cur === 0) return '';
    if (prev === 0) return `<span style="font-size:10px;color:${posColor};font-weight:600;">NEW</span>`;
    const pct = Math.round((cur - prev) / prev * 100);
    const up  = pct >= 0;
    return `<span style="font-size:10px;color:${up ? posColor : negColor};font-weight:600;">${up ? '▲' : '▼'}${Math.abs(pct)}%</span>`;
  };

  const plColor = pl >= 0 ? '#16a34a' : '#dc2626';
  const plBg    = pl >= 0 ? '#f0fdf4' : '#fff1f2';
  const plBd    = pl >= 0 ? '#bbf7d0' : '#fecdd3';

  const rcv = S.transactions.filter(t => t.status === TX_STATUS.UNPAID).reduce((s, t) => s + _txRemain(t), 0);
  const pay = S.transactions.filter(t => t.status === TX_STATUS.UNBILLED).reduce((s, t) => s + _txRemain(t), 0);

  const monRev      = monT.filter(t => t.type === '매출');
  const totalBill   = monRev.reduce((s, t) => s + t.amount + t.tax, 0);
  const totalPaid   = monRev.reduce((s, t) => s + (t.paidAmount || 0), 0);
  const collectRate = totalBill > 0 ? Math.round((totalPaid / totalBill) * 100) : null;

  // 6개월 추이
  const months6 = [];
  for (let i = 5; i >= 0; i--) {
    const _base = new Date(); _base.setDate(1); _base.setMonth(_base.getMonth() - i);
    const ym = localDate(_base).slice(0, 7);
    const mT = S.transactions.filter(t => t.date.startsWith(ym));
    months6.push({
      ym, label: _base.toLocaleDateString('ko-KR', { month: 'short' }),
      rev: mT.filter(t => t.type === '매출').reduce((s, t) => s + t.amount, 0),
      pur: mT.filter(t => t.type === '매입').reduce((s, t) => s + t.amount, 0),
    });
  }
  const maxBar = Math.max(...months6.map(m => Math.max(m.rev, m.pur)), 1);

  // TOP5 매출 거래처
  const clientRev = {};
  monT.filter(t => t.type === '매출').forEach(t => { clientRev[t.clientId] = (clientRev[t.clientId] || 0) + t.amount; });
  const top  = Object.entries(clientRev).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, v]) => ({ c: S.clients.find(x => x.id === +id), v }));
  const maxV = top[0]?.v || 1;

  // 미수금 오래된 순 TOP5
  const oldUnpaid = [...S.transactions].filter(t => t.status === TX_STATUS.UNPAID).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);

  // 거래처 현황
  const cAll  = S.clients.length;
  const cSell = S.clients.filter(c => c.type === '매출처').length;
  const cBuy  = S.clients.filter(c => c.type === '매입처').length;
  const cBoth = S.clients.filter(c => c.type === '매출/매입').length;

  const dateStr = new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'long' });

  const monthNav = `<div style="display:flex;align-items:center;gap:6px;">
    <button onclick="setTxMonth('${prevMonth(mon)}')" style="width:28px;height:28px;border-radius:7px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer;font-size:15px;color:#64748b;">‹</button>
    <select onchange="setTxMonth(this.value)" style="border:1px solid #e2e8f0;border-radius:8px;padding:4px 8px;font-size:12px;color:#0f172a;background:#fff;cursor:pointer;">
      ${monthOptions().map(m => `<option value="${m}"${m === mon ? ' selected' : ''}>${fmtMonth(m)}</option>`).join('')}
    </select>
    <button onclick="setTxMonth('${nextMonth(mon)}')" ${canNext ? '' : 'disabled'} style="width:28px;height:28px;border-radius:7px;border:1px solid ${canNext ? '#e2e8f0' : '#f1f5f9'};background:${canNext ? '#f8fafc' : '#f1f5f9'};cursor:${canNext ? 'pointer' : 'default'};font-size:15px;color:${canNext ? '#64748b' : '#cbd5e1'};">›</button>
    ${mon !== cur ? `<button onclick="setTxMonth('${cur}')" style="padding:4px 9px;border-radius:7px;border:1px solid #d97706;background:#fef3c7;color:#d97706;font-size:11px;font-weight:600;cursor:pointer;">이번달</button>` : ''}
  </div>`;

  const topCards = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:14px 12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><span style="color:#16a34a;font-size:10px;font-weight:600;letter-spacing:.5px;">매출</span>${_growthBadge(rev, prevRev, '#16a34a', '#dc2626')}</div>
        <div style="color:#16a34a;font-size:17px;font-weight:800;line-height:1.1;">${fmtW(rev)}</div>
        <div style="color:#86efac;font-size:11px;margin-top:4px;">${monT.filter(t => t.type === '매출').length}건</div>
      </div>
      <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:14px;padding:14px 12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><span style="color:#dc2626;font-size:10px;font-weight:600;letter-spacing:.5px;">매입</span>${_growthBadge(pur, prevPur, '#dc2626', '#16a34a')}</div>
        <div style="color:#dc2626;font-size:17px;font-weight:800;line-height:1.1;">${fmtW(pur)}</div>
        <div style="color:#fca5a5;font-size:11px;margin-top:4px;">${monT.filter(t => t.type === '매입').length}건</div>
      </div>
      <div style="background:${plBg};border:1px solid ${plBd};border-radius:14px;padding:14px 12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><span style="color:${plColor};font-size:10px;font-weight:600;letter-spacing:.5px;">손익</span>${_growthBadge(pl, prevPl, pl >= prevPl ? '#16a34a' : '#dc2626', pl >= prevPl ? '#16a34a' : '#dc2626')}</div>
        <div style="color:${plColor};font-size:17px;font-weight:800;line-height:1.1;">${fmtW(pl)}</div>
        <div style="color:${pl >= 0 ? '#86efac' : '#fca5a5'};font-size:11px;margin-top:4px;">${pl >= 0 ? '▲ 흑자' : '▼ 적자'}</div>
      </div>
    </div>`;

  const midCards = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
      <div onclick="setView('receivables')" style="background:#fefce8;border:1px solid #fef08a;border-radius:14px;padding:14px 12px;cursor:pointer;">
        <div style="color:#b45309;font-size:10px;font-weight:600;letter-spacing:.5px;margin-bottom:6px;">미수금</div>
        <div style="color:#b45309;font-size:17px;font-weight:800;line-height:1.1;">${fmtW(rcv)}</div>
        <div style="color:#fcd34d;font-size:11px;margin-top:4px;">전체 누적</div>
      </div>
      <div onclick="setView('receivables')" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:14px 12px;cursor:pointer;">
        <div style="color:#1d4ed8;font-size:10px;font-weight:600;letter-spacing:.5px;margin-bottom:6px;">미지급금</div>
        <div style="color:#1d4ed8;font-size:17px;font-weight:800;line-height:1.1;">${fmtW(pay)}</div>
        <div style="color:#93c5fd;font-size:11px;margin-top:4px;">전체 누적</div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:14px 12px;">
        <div style="color:#475569;font-size:10px;font-weight:600;letter-spacing:.5px;margin-bottom:6px;">수금률</div>
        <div style="color:#0f172a;font-size:17px;font-weight:800;line-height:1.1;">${collectRate !== null ? collectRate + '%' : '—'}</div>
        <div style="color:#94a3b8;font-size:11px;margin-top:4px;">이달 기준</div>
      </div>
    </div>`;

  const barH    = 56;
  const barCols = months6.map(m => {
    const rH = Math.round((m.rev / maxBar) * barH);
    const pH = Math.round((m.pur / maxBar) * barH);
    const isC = m.ym === mon;
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;">
      <div style="display:flex;align-items:flex-end;gap:2px;height:${barH}px;">
        <div style="width:10px;height:${rH || 2}px;background:${isC ? '#16a34a' : '#86efac'};border-radius:3px 3px 0 0;transition:height .3s;"></div>
        <div style="width:10px;height:${pH || 2}px;background:${isC ? '#dc2626' : '#fca5a5'};border-radius:3px 3px 0 0;transition:height .3s;"></div>
      </div>
      <div style="color:${isC ? '#d97706' : '#94a3b8'};font-size:10px;font-weight:${isC ? 700 : 400};">${esc(m.label)}</div>
    </div>`;
  }).join('');

  const chartSection = `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <span style="color:#0f172a;font-weight:700;font-size:13px;">📊 6개월 매출·매입 추이</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="display:flex;align-items:center;gap:3px;font-size:10px;color:#64748b;"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#16a34a;"></span>매출</span>
          <span style="display:flex;align-items:center;gap:3px;font-size:10px;color:#64748b;"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#dc2626;"></span>매입</span>
        </div>
      </div>
      <div style="display:flex;align-items:flex-end;gap:4px;padding:0 4px;">${barCols}</div>
    </div>`;

  const topRows = top.length
    ? top.map(({ c, v }, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f8fafc;">
        <div style="width:20px;height:20px;border-radius:50%;background:${i===0?'#fbbf24':i===1?'#94a3b8':i===2?'#b45309':'#e2e8f0'};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${i<3?'#fff':'#94a3b8'};flex-shrink:0;">${i+1}</div>
        <div style="flex:1;min-width:0;">
          <div style="color:#0f172a;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(c?.name||'?')}</div>
          <div style="height:4px;background:#f1f5f9;border-radius:2px;margin-top:4px;"><div style="height:100%;background:#16a34a;border-radius:2px;width:${Math.round((v/maxV)*100)}%;opacity:.7;"></div></div>
        </div>
        <div style="color:#16a34a;font-size:12px;font-weight:700;flex-shrink:0;">${fmtW(v)}</div>
      </div>`).join('')
    : '<div style="color:#94a3b8;font-size:12px;text-align:center;padding:16px 0;">이달 매출 없음</div>';

  const unpaidRows = oldUnpaid.length
    ? oldUnpaid.map(tx => {
        const cl      = S.clients.find(c => c.id === tx.clientId);
        const remain  = _txRemain(tx);
        const daysAgo = Math.floor((Date.now() - new Date(tx.date)) / 86400000);
        const urgColor = daysAgo >= 60 ? '#dc2626' : daysAgo >= 30 ? '#b45309' : '#64748b';
        return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f8fafc;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:5px;">
              <span style="color:#0f172a;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(cl?.name||'?')}</span>
              <span style="color:${urgColor};font-size:10px;font-weight:600;flex-shrink:0;">${daysAgo}일 경과</span>
            </div>
            <div style="color:#94a3b8;font-size:10px;margin-top:1px;">${esc(tx.date)} · ${esc((tx.memo||'-').slice(0, 20))}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;"><div style="color:#b45309;font-size:12px;font-weight:700;">${fmtW(remain)}</div></div>
        </div>`;
      }).join('')
    : '<div style="color:#94a3b8;font-size:12px;text-align:center;padding:16px 0;">미수금 없음 🎉</div>';

  const clientSection = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
      ${[
        { label:'전체',     val:cAll,  color:'#334155', bg:'#f8fafc', bd:'#e2e8f0' },
        { label:'매출처',   val:cSell, color:'#16a34a', bg:'#f0fdf4', bd:'#bbf7d0' },
        { label:'매입처',   val:cBuy,  color:'#1d4ed8', bg:'#eff6ff', bd:'#bfdbfe' },
        { label:'매출/매입',val:cBoth, color:'#b45309', bg:'#fefce8', bd:'#fef08a' },
      ].map(({ label, val, color, bg, bd }) => `
        <div style="background:${bg};border:1px solid ${bd};border-radius:10px;padding:10px 6px;text-align:center;">
          <div style="color:${color};font-size:18px;font-weight:800;">${val}</div>
          <div style="color:#94a3b8;font-size:10px;margin-top:2px;">${esc(label)}</div>
        </div>`).join('')}
    </div>`;

  const html = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <div>
          <h1 class="page-title" style="color:#0f172a;font-size:20px;font-weight:700;">대시보드</h1>
          <p style="color:#64748b;font-size:12px;margin-top:3px;">${esc(dateStr)}</p>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${hasDashPin()
            ? `<button onclick="openPinModal('change')" title="앱 잠금 PIN 변경" style="background:none;border:1px solid #e2e8f0;border-radius:8px;padding:5px 10px;font-size:11px;color:#64748b;cursor:pointer;">🔑 PIN 변경</button>
               <button onclick="openPinModal('remove')" title="앱 잠금 해제(PIN 삭제)" style="background:none;border:1px solid #e2e8f0;border-radius:8px;padding:5px 10px;font-size:11px;color:#64748b;cursor:pointer;">🔓 해제</button>`
            : `<button onclick="openPinModal('set')" title="앱 전체를 PIN으로 잠금" style="background:none;border:1px solid #e2e8f0;border-radius:8px;padding:5px 10px;font-size:11px;color:#64748b;cursor:pointer;">🔒 PIN 설정</button>`
          }
          ${monthNav}
        </div>
      </div>
      ${topCards}
      ${midCards}
      ${chartSection}
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="color:#0f172a;font-weight:700;font-size:13px;">🏆 이달 매출 상위 거래처</span>
          <button onclick="setView('clients')" style="color:#d97706;font-size:11px;background:none;border:none;cursor:pointer;">전체보기 →</button>
        </div>
        ${topRows}
      </div>
      <div style="background:#fff;border:1px solid #fef08a;border-radius:14px;padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="color:#b45309;font-weight:700;font-size:13px;">⚠️ 미수금 오래된 순</span>
          <button onclick="setView('receivables')" style="color:#d97706;font-size:11px;background:none;border:none;cursor:pointer;">전체보기 →</button>
        </div>
        ${unpaidRows}
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;">
        <div style="color:#0f172a;font-weight:700;font-size:13px;margin-bottom:10px;">🏢 거래처 현황</div>
        ${clientSection}
      </div>
    </div>`;

  _dashCache = html;
  return html;
}

// ── CLIENT ROW BUILDER (공통, 검색부분갱신용) ─────────────────────────────────
function _buildCRows() {
  const workspaces = _getWorkspaces();
  function clientWsId(clientId) {
    const c = S.clients.find(x => x.id === clientId);
    if (c && c._wsId) return c._wsId;
    const tx = S.transactions.find(t => t.clientId === clientId && t._napumId);
    if (!tx) return null;
    const sep = tx._napumId.lastIndexOf(':');
    return sep > -1 ? tx._napumId.slice(0, sep) : null;
  }
  const wsOrder = {};
  workspaces.forEach((w, i) => { wsOrder[w.id] = i; });

  let filtered = S.clients.filter(c => {
    const wsId = clientWsId(c.id);
    const wsOk = S.cWsFilter === '전체'
      || (S.cWsFilter === '__direct__' && wsId === null)
      || wsId === S.cWsFilter;
    return wsOk && (S.cFilter === '전체' || c.type === S.cFilter)
      && matchAny(S.cSearch, c.name, c.bizNo, c.rep, c.phone, c.memo);
  });
  filtered.sort((a, b) => {
    const wa = clientWsId(a.id), wb = clientWsId(b.id);
    const ia = wa !== null && wsOrder[wa] !== undefined ? wsOrder[wa] : 9999;
    const ib = wb !== null && wsOrder[wb] !== undefined ? wsOrder[wb] : 9999;
    if (ia !== ib) return ia - ib;
    return a.name.localeCompare(b.name, 'ko');
  });

  if (filtered.length === 0)
    return '<div style="padding:40px 0;text-align:center;color:#94a3b8;font-size:13px;">거래처가 없습니다.</div>';

  const clientStats = id => {
    const txs     = S.transactions.filter(t => t.clientId === id);
    const unpaid  = txs.filter(t => t.status === TX_STATUS.UNPAID).reduce((s, t) => s + _txRemain(t), 0);
    return { txs, unpaid };
  };

  // ★ 그룹 필터 적용
  if (S.cGroupFilter && S.cGroupFilter !== '전체') {
    filtered = filtered.filter(c => (c._napumGroup || '') === S.cGroupFilter);
  }

  let lastWsGroup = undefined;
  return filtered.map(c => {
    const s     = clientStats(c.id);
    const open  = S.cExpanded === c.id;
    const tc    = c.type === '매출처' ? '#16a34a' : c.type === '매입처' ? '#1d4ed8' : '#b45309';
    const wsId  = clientWsId(c.id);
    const wsLabel = wsId && wsOrder[wsId] !== undefined
      ? (workspaces.find(w => w.id === wsId)?.label || wsId) : '직접 등록';

    let groupHeader = '';
    if (wsLabel !== lastWsGroup) {
      lastWsGroup = wsLabel;
      const hc  = wsId ? '#b45309' : '#94a3b8';
      const hbg = wsId ? '#fefce8' : '#f8fafc';
      const hbd = wsId ? '#fef08a' : '#e2e8f0';
      groupHeader = `<div style="padding:6px 14px;background:${hbg};border-bottom:1px solid ${hbd};border-top:1px solid ${hbd};"><span style="font-size:11px;font-weight:700;color:${hc};">📦 ${esc(wsLabel)}</span></div>`;
    }

    let expHtml = '';
    if (open) {
      const info = [['그룹',c._napumGroup],['사업자번호',c.bizNo],['대표자',c.rep],['전화',c.phone],['이메일',c.email],['주소',c.address],['메모',c.memo]]
        .filter(([, v]) => v)
        .map(([k, v]) => `<div style="display:flex;gap:8px;"><span style="color:#94a3b8;min-width:60px;font-size:12px;">${esc(k)}</span><span style="color:#334155;font-size:12px;word-break:break-all;">${esc(v)}</span></div>`)
        .join('');
      expHtml = `<div style="background:#fafafa;border-bottom:1px solid #e2e8f0;padding:14px;">${
        info
          ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px 20px;">${info}</div>`
          : `<div style="color:#94a3b8;font-size:12px;text-align:center;padding:8px 0;">등록된 정보가 없습니다.</div>`
      }</div>`;
    }

    const unpaidBadge = s.unpaid > 0
      ? `<span style="font-size:11px;font-weight:700;color:#b45309;">${fmtW(s.unpaid)}</span>`
      : `<span style="font-size:11px;color:#94a3b8;">—</span>`;

    return `${groupHeader}<div>
      <div onclick="toggleExpand(${c.id})" class="hover-row" style="display:flex;align-items:center;padding:12px 14px;border-bottom:1px solid #f1f5f9;cursor:pointer;gap:8px;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:5px;">
            <span style="color:${open?'#d97706':'#0f172a'};font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(c.name)}</span>
            <span style="color:#94a3b8;flex-shrink:0;">${open ? I.chevD : I.chevR}</span>
          </div>
          <div style="color:#94a3b8;font-size:11px;margin-top:1px;display:flex;align-items:center;gap:5px;">
            <span style="font-size:10px;font-weight:600;color:${tc};">${esc(c.type)}</span>
            ${c._napumGroup ? `<span style="font-size:10px;font-weight:600;color:#7c3aed;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:4px;padding:1px 5px;">👥 ${esc(c._napumGroup)}</span>` : ''}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">${unpaidBadge}</div>
        <div style="width:52px;display:flex;justify-content:center;gap:8px;flex-shrink:0;" onclick="event.stopPropagation()">
          <button onclick="editClient(${c.id})" style="color:#94a3b8;background:none;border:none;cursor:pointer;" onmouseenter="this.style.color='#d97706'" onmouseleave="this.style.color='#94a3b8'">${I.edit}</button>
          <button onclick="confirmDelClient(${c.id})" style="color:#94a3b8;background:none;border:none;cursor:pointer;" onmouseenter="this.style.color='#dc2626'" onmouseleave="this.style.color='#94a3b8'">${I.trash}</button>
        </div>
      </div>${expHtml}</div>`;
  }).join('');
}

// ── CLIENTS VIEW ──────────────────────────────────────────────────────────────
function buildClients() {
  const workspaces = _getWorkspaces();
  function clientWsId(clientId) {
    const c = S.clients.find(x => x.id === clientId);
    if (c && c._wsId) return c._wsId;
    const tx = S.transactions.find(t => t.clientId === clientId && t._napumId);
    if (!tx) return null;
    const sep = tx._napumId.lastIndexOf(':');
    return sep > -1 ? tx._napumId.slice(0, sep) : null;
  }
  const wsOrder = {};
  workspaces.forEach((w, i) => { wsOrder[w.id] = i; });

  const filterBtns = ['전체','매출처','매입처','매출/매입'].map(t => {
    const a = S.cFilter === t;
    return `<button onclick="setCFilter('${t}')" style="padding:7px 11px;border-radius:8px;font-size:12px;font-weight:${a?700:400};background:${a?'#d97706':'#f8fafc'};color:${a?'#fff':'#64748b'};border:1px solid ${a?'#d97706':'#e2e8f0'};cursor:pointer;">${esc(t)}</button>`;
  }).join('');

  // ★ v89 납품 앱 그룹 필터 버튼
  const napumGroups = [...new Set(S.clients.map(c => c._napumGroup).filter(Boolean))].sort();
  const groupFilterBtns = napumGroups.length > 0
    ? ['전체', ...napumGroups].map(g => {
        const a = (S.cGroupFilter || '전체') === g;
        return `<button onclick="setCGroupFilter('${esc(g)}')" style="padding:5px 10px;border-radius:8px;font-size:11px;font-weight:${a?700:500};background:${a?'#7c3aed':'#f5f3ff'};color:${a?'#fff':'#7c3aed'};border:1px solid ${a?'#7c3aed':'#ddd6fe'};cursor:pointer;white-space:nowrap;">👥 ${esc(g)}</button>`;
      }).join('')
    : '';

  const hasDirectClients = S.clients.some(c => clientWsId(c.id) === null);
  const wsFilterOptions  = [
    { id:'전체', label:'전체' },
    ...workspaces.map(w => ({ id: w.id, label: w.label || w.id })),
    ...(hasDirectClients ? [{ id:'__direct__', label:'직접 등록' }] : []),
  ];
  const wsBtns = workspaces.length >= 1
    ? wsFilterOptions.map(opt => {
        const a    = S.cWsFilter === opt.id;
        const icon = opt.id === '전체' ? '' : opt.id === '__direct__' ? '✏️ ' : '📦 ';
        return `<button onclick="setCWsFilter('${opt.id}')"
          style="padding:5px 10px;border-radius:8px;font-size:11px;font-weight:${a?700:500};
          background:${a?'#0f172a':'#f8fafc'};color:${a?'#fff':'#64748b'};
          border:1px solid ${a?'#0f172a':'#e2e8f0'};cursor:pointer;white-space:nowrap;">
          ${icon}${esc(opt.label)}</button>`;
      }).join('')
    : '';

  const rows = _buildCRows();

  return `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div>
          <h1 class="page-title" style="color:#0f172a;font-size:20px;font-weight:700;">거래처 관리</h1>
          <p style="color:#64748b;font-size:12px;margin-top:2px;">총 ${S.clients.length}개</p>
        </div>
        <div style="display:flex;gap:6px;">
          <button onclick="openResetModal()" style="display:flex;align-items:center;gap:5px;background:#fff1f2;color:#dc2626;border:1px solid #fecdd3;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:600;cursor:pointer;">🗑 초기화</button>
          <button onclick="openClientModal('add')" style="display:flex;align-items:center;gap:5px;background:#d97706;color:#fff;border:none;border-radius:8px;padding:8px 12px;font-size:13px;font-weight:700;cursor:pointer;">${I.plus} <span class="hide-sm">거래처</span> 추가</button>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <div style="position:relative;flex:1;min-width:160px;">
          <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#94a3b8;pointer-events:none;">${I.search}</span>
          <input id="cSearchInput" value="${esc(S.cSearch)}" oninput="setCSearch(this.value)" onkeydown="if(event.key==='Enter'||event.keyCode===13){this.blur();}" enterkeyhint="search" placeholder="검색… (초성 가능)" style="${ISX}padding-left:30px;" ${FB}>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;">${filterBtns}</div>
      </div>
      ${wsBtns ? `<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;"><span style="font-size:11px;color:#94a3b8;white-space:nowrap;flex-shrink:0;">거래처:</span>${wsBtns}</div>` : ''}
      ${groupFilterBtns ? `<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;"><span style="font-size:11px;color:#94a3b8;white-space:nowrap;flex-shrink:0;">그룹:</span>${groupFilterBtns}</div>` : ''}
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="display:flex;padding:9px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;gap:8px;">
          <span style="flex:1;color:#94a3b8;font-size:11px;font-weight:500;">거래처명</span>
          <span style="color:#94a3b8;font-size:11px;text-align:right;">미수금</span>
          <span style="width:52px;color:#94a3b8;font-size:11px;text-align:center;">관리</span>
        </div>
        <div id="cListRows">${rows}</div>
      </div>
    </div>`;
}

// ── TX WS 인덱스 헬퍼 (buildTransactions + _buildTxRowsOnly 공통) ───────────
function _makeTxWsTools() {
  const workspaces = _getWorkspaces();
  const wsOrder    = {};
  workspaces.forEach((w, i) => { wsOrder[w.id] = i; });
  const clientNameCache = {};
  S.clients.forEach(c => { clientNameCache[c.id] = c.name || ''; });

  function wsIdx(tx) {
    if (!tx._napumId) return 9999;
    const sep  = tx._napumId.lastIndexOf(':');
    const wsId = sep > -1 ? tx._napumId.slice(0, sep) : null;
    return wsId !== null && wsOrder[wsId] !== undefined ? wsOrder[wsId] : 9998;
  }
  function txSort(a, b) {
    const dc = b.date.localeCompare(a.date); if (dc) return dc;
    const wc = wsIdx(a) - wsIdx(b);          if (wc) return wc;
    const nc = (clientNameCache[a.clientId] || '').localeCompare(clientNameCache[b.clientId] || '', 'ko');
    if (nc) return nc;
    return a.id - b.id;
  }
  return { workspaces, wsOrder, wsIdx, txSort, clientNameCache };
}

// ── TX ROW ───────────────────────────────────────────────────────────────────
let _cachedWsCount = -1;
function _hasWorkspaces() { return _cachedWsCount > 0; }

function _buildTxRow(tx, hideDate) {
  const cl    = S.clients.find(c => c.id === tx.clientId);
  const color = tx.type === '매출' ? '#16a34a' : '#dc2626';
  const cName = cl?.name || '?';
  const safeAttr = cName.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const canStat  = !!(tx._napumId || _hasWorkspaces());
  const clientNameHtml = canStat
    ? `<span class="stat-trigger" data-cn="${safeAttr}" style="cursor:pointer;border-bottom:1px dashed #d97706;color:#0f172a;" title="📋 납품 명세표">${esc(cName)}</span>`
    : `<span style="color:#0f172a;">${esc(cName)}</span>`;

  return `<div class="hover-row" style="display:flex;align-items:center;padding:11px 14px;border-bottom:1px solid #f1f5f9;gap:8px;">
    ${!hideDate ? `<span class="col-date" style="color:#94a3b8;font-size:11px;">${esc(tx.date)}</span>` : ''}
    <div style="flex:1;min-width:0;">
      <div style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${clientNameHtml}</div>
      <div style="color:#94a3b8;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(tx.memo || '-')}</div>
    </div>
    <span class="col-type" style="font-size:11px;font-weight:600;color:${color};">${esc(tx.type)}</span>
    <span class="col-amt" style="color:${color};font-size:12px;font-weight:600;">${fmtW(tx.amount)}</span>
    <span class="col-tax hide-sm" style="color:#94a3b8;font-size:11px;">${fmtW(tx.tax)}</span>
    <div class="col-status">${statusBadge(tx.status, tx.id)}</div>
    <div class="col-actions">
      <button onclick="editTx(${tx.id})" style="color:#94a3b8;background:none;border:none;cursor:pointer;" onmouseenter="this.style.color='#d97706'" onmouseleave="this.style.color='#94a3b8'">${I.edit}</button>
      <button onclick="confirmDelTx(${tx.id})" style="color:#94a3b8;background:none;border:none;cursor:pointer;" onmouseenter="this.style.color='#dc2626'" onmouseleave="this.style.color='#94a3b8'">${I.trash}</button>
    </div>
  </div>`;
}

// ── TX ROWS ONLY (검색 부분갱신용) ────────────────────────────────────────────
function _buildTxRowsOnly() {
  const mode = S.txPeriodMode || 'monthly';
  if (!S.txWeek) S.txWeek = _weekOf(localDate());
  const dateOk = t => {
    if (mode === 'all')     return true;
    if (mode === 'monthly') return S.txMonth === '전체' || t.date.startsWith(S.txMonth);
    if (mode === 'daily')   return t.date === S.txDate;
    if (mode === 'weekly')  return _inWeek(t.date, S.txWeek);
    return true;
  };
  const { wsOrder, wsIdx, txSort, clientNameCache } = _makeTxWsTools();

  const filtered = [...S.transactions].filter(t => {
    const cl  = S.clients.find(c => c.id === t.clientId);
    const wsOk = S.txWsFilter === '전체' || wsIdx(t) === wsOrder[S.txWsFilter];
    return wsOk && dateOk(t)
      && (S.txTf === '전체' || t.type === S.txTf)
      && (S.txSf === '전체' || t.status === S.txSf)
      && matchAny(S.txSearch, cl?.name, t.memo);
  }).sort(txSort);

  if (filtered.length === 0)
    return '<div style="padding:40px 0;text-align:center;color:#94a3b8;font-size:13px;">거래 내역이 없습니다.</div>';

  const grouped = mode === 'weekly' || mode === 'monthly' || mode === 'all';
  if (!grouped) return filtered.map(tx => _buildTxRow(tx, false)).join('');

  let rows = '';
  const byDate = {};
  filtered.forEach(tx => { if (!byDate[tx.date]) byDate[tx.date] = []; byDate[tx.date].push(tx); });
  Object.keys(byDate).sort((a, b) => b.localeCompare(a)).forEach(date => {
    const dayTxs = byDate[date];
    const dayRev = dayTxs.filter(t => t.type === '매출').reduce((s, t) => s + t.amount, 0);
    const dayPur = dayTxs.filter(t => t.type === '매입').reduce((s, t) => s + t.amount, 0);
    rows += `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;border-top:1px solid #e2e8f0;">
      <span style="font-size:11px;font-weight:600;color:#475569;">${_fmtDayFull(date)}</span>
      <span style="font-size:11px;color:#64748b;">${dayRev > 0 ? `<span style="color:#16a34a;">↑${fmtW(dayRev)}</span> ` : ''}${dayPur > 0 ? `<span style="color:#dc2626;">↓${fmtW(dayPur)}</span>` : ''}</span>
    </div>`;
    rows += dayTxs.slice().sort((a, b) => {
      const wc = wsIdx(a) - wsIdx(b); if (wc) return wc;
      const nc = (clientNameCache[a.clientId] || '').localeCompare(clientNameCache[b.clientId] || '', 'ko');
      return nc || a.id - b.id;
    }).map(tx => _buildTxRow(tx, true)).join('');
  });
  return rows;
}

// ── TRANSACTIONS VIEW ─────────────────────────────────────────────────────────
function buildTransactions() {
  const mode = S.txPeriodMode || 'monthly';
  if (!S.txWeek) S.txWeek = _weekOf(localDate());

  const dateOk = t => {
    if (mode === 'all')     return true;
    if (mode === 'monthly') return S.txMonth === '전체' || t.date.startsWith(S.txMonth);
    if (mode === 'daily')   return t.date === S.txDate;
    if (mode === 'weekly')  return _inWeek(t.date, S.txWeek);
    return true;
  };

  const { workspaces: _wsList, wsOrder: _txWsOrder, wsIdx: _txWsIdx, txSort, clientNameCache: _clientNameCache } = _makeTxWsTools();
  _cachedWsCount = _wsList.length;

  const filtered = [...S.transactions].filter(t => {
    const cl   = S.clients.find(c => c.id === t.clientId);
    const wsOk = S.txWsFilter === '전체' || _txWsIdx(t) === _txWsOrder[S.txWsFilter];
    return wsOk && dateOk(t)
      && (S.txTf === '전체' || t.type === S.txTf)
      && (S.txSf === '전체' || t.status === S.txSf)
      && matchAny(S.txSearch, cl?.name, t.memo);
  }).sort(txSort);

  const sumRev   = filtered.filter(t => t.type === '매출').reduce((s, t) => s + t.amount, 0);
  const sumPur   = filtered.filter(t => t.type === '매입').reduce((s, t) => s + t.amount, 0);
  const plColor  = sumRev - sumPur >= 0 ? '#16a34a' : '#dc2626';

  // 기간 모드 탭
  const modeTabs = [
    { k:'daily', label:'일별' }, { k:'weekly', label:'주별' },
    { k:'monthly', label:'월별' }, { k:'all', label:'전체' },
  ].map(({ k, label }) => {
    const a = mode === k;
    return `<button onclick="setTxPeriodMode('${k}')"
      style="flex:1;padding:7px 0;border-radius:8px;font-size:12px;font-weight:${a?700:400};background:${a?'#d97706':'#f8fafc'};color:${a?'#fff':'#64748b'};border:1px solid ${a?'#d97706':'#e2e8f0'};cursor:pointer;">${label}</button>`;
  }).join('');

  // 기간 네비게이터 공통 버튼 스타일 생성기
  function _navBtn(label, onclick, disabled) {
    const bd  = disabled ? '#f1f5f9' : '#e2e8f0';
    const bg  = disabled ? '#f1f5f9' : '#f8fafc';
    const col = disabled ? '#cbd5e1' : '#64748b';
    return `<button onclick="${onclick}" ${disabled ? 'disabled' : ''} style="width:28px;height:28px;border-radius:7px;border:1px solid ${bd};background:${bg};cursor:${disabled?'default':'pointer'};font-size:15px;color:${col};">${label}</button>`;
  }
  const todayStr = localDate();
  let navHtml = '';
  if (mode === 'daily') {
    const isToday = S.txDate === todayStr;
    const canNext = S.txDate < todayStr;
    navHtml = `<div style="display:flex;align-items:center;gap:6px;">
      ${_navBtn('&#8249;', `S.txDate=_prevDay(S.txDate);renderContent()`, false)}
      <input type="date" value="${S.txDate}" max="${todayStr}" onchange="S.txDate=this.value;renderContent()" style="border:1px solid #e2e8f0;border-radius:8px;padding:4px 8px;font-size:12px;color:#0f172a;background:#fff;cursor:pointer;">
      ${_navBtn('&#8250;', `S.txDate=_nextDay(S.txDate);renderContent()`, !canNext)}
      ${!isToday ? `<button onclick="S.txDate='${todayStr}';renderContent()" style="padding:4px 9px;border-radius:7px;border:1px solid #d97706;background:#fef3c7;color:#d97706;font-size:11px;font-weight:600;cursor:pointer;">오늘</button>` : ''}
    </div>`;
  } else if (mode === 'weekly') {
    const curWeek   = _weekOf(todayStr);
    const isThisWk  = S.txWeek === curWeek;
    const canNext   = S.txWeek < curWeek;
    navHtml = `<div style="display:flex;align-items:center;gap:6px;">
      ${_navBtn('&#8249;', `S.txWeek=_prevWeek(S.txWeek);renderContent()`, false)}
      <span style="border:1px solid #e2e8f0;border-radius:8px;padding:4px 10px;font-size:12px;color:#0f172a;background:#fff;white-space:nowrap;">${_fmtWeek(S.txWeek)}</span>
      ${_navBtn('&#8250;', `S.txWeek=_nextWeek(S.txWeek);renderContent()`, !canNext)}
      ${!isThisWk ? `<button onclick="S.txWeek='${curWeek}';renderContent()" style="padding:4px 9px;border-radius:7px;border:1px solid #d97706;background:#fef3c7;color:#d97706;font-size:11px;font-weight:600;cursor:pointer;">이번주</button>` : ''}
    </div>`;
  } else if (mode === 'monthly') {
    if (S.txMonth === '전체') S.txMonth = thisMonth();
    const mon     = S.txMonth;
    const cur     = thisMonth();
    const canNext = mon < cur;
    navHtml = `<div style="display:flex;align-items:center;gap:6px;">
      ${_navBtn('&#8249;', `setTxMonth('${prevMonth(mon)}')`, false)}
      <select onchange="setTxMonth(this.value)" style="border:1px solid #e2e8f0;border-radius:8px;padding:4px 8px;font-size:12px;color:#0f172a;background:#fff;cursor:pointer;">
        ${monthOptions().map(m => `<option value="${m}"${m === mon ? ' selected' : ''}>${fmtMonth(m)}</option>`).join('')}
      </select>
      ${_navBtn('&#8250;', `setTxMonth('${nextMonth(mon)}')`, !canNext)}
      ${mon !== cur ? `<button onclick="setTxMonth('${cur}')" style="padding:4px 9px;border-radius:7px;border:1px solid #d97706;background:#fef3c7;color:#d97706;font-size:11px;font-weight:600;cursor:pointer;">이번달</button>` : ''}
    </div>`;
  }

  const periodLabel =
    mode === 'daily'   ? _fmtDayFull(S.txDate) :
    mode === 'weekly'  ? _fmtWeek(S.txWeek) :
    mode === 'monthly' ? fmtMonth(S.txMonth) : '전체 기간';

  const wsBtns = _wsList.length >= 1
    ? ['전체', ..._wsList.map(w => w.id)].map(wsId => {
        const a     = S.txWsFilter === wsId;
        const label = wsId === '전체' ? '전체' : (_wsList.find(w => w.id === wsId)?.label || wsId);
        return `<button onclick="setTxWsFilter('${wsId}')"
          style="padding:5px 10px;border-radius:8px;font-size:11px;font-weight:${a?700:500};background:${a?'#0f172a':'#f8fafc'};color:${a?'#fff':'#64748b'};border:1px solid ${a?'#0f172a':'#e2e8f0'};cursor:pointer;white-space:nowrap;">
          ${wsId === '전체' ? '전체' : '📦 ' + esc(label)}</button>`;
      }).join('')
    : '';

  const typeBtns = ['전체','매출','매입'].map(t => {
    const a = S.txTf === t;
    return `<button onclick="setTxTf('${t}')" style="padding:7px 10px;border-radius:8px;font-size:12px;font-weight:${a?700:400};background:${a?'#d97706':'#f8fafc'};color:${a?'#fff':'#64748b'};border:1px solid ${a?'#d97706':'#e2e8f0'};cursor:pointer;">${t}</button>`;
  }).join('');
  const stBtns = ['전체',TX_STATUS.UNPAID,TX_STATUS.PAID,TX_STATUS.UNBILLED,TX_STATUS.BILLED].map(s => {
    const a = S.txSf === s;
    return `<button onclick="setTxSf('${s}')" style="padding:7px 9px;border-radius:8px;font-size:11px;font-weight:${a?700:400};background:${a?'#d97706':'#f8fafc'};color:${a?'#fff':'#64748b'};border:1px solid ${a?'#d97706':'#e2e8f0'};cursor:pointer;">${s}</button>`;
  }).join('');

  const sumCards = [
    { label:'조회 매출', val:fmtW(sumRev),         color:'#16a34a', bg:'#f0fdf4', bd:'#bbf7d0' },
    { label:'조회 매입', val:fmtW(sumPur),         color:'#dc2626', bg:'#fff1f2', bd:'#fecdd3' },
    { label:'손익',      val:fmtW(sumRev - sumPur), color:plColor,  bg:'#f8fafc', bd:'#e2e8f0' },
  ].map(({ label, val, color, bg, bd }) =>
    `<div style="background:${bg};border:1px solid ${bd};border-radius:10px;padding:12px 14px;">
      <div style="color:#64748b;font-size:11px;margin-bottom:4px;">${label}</div>
      <div style="color:${color};font-size:18px;font-weight:700;">${val}</div>
    </div>`
  ).join('');

  // 날짜 그룹 행
  const grouped = mode === 'weekly' || mode === 'monthly' || mode === 'all';
  let rows = '';
  if (grouped && filtered.length > 0) {
    const byDate = {};
    filtered.forEach(tx => { if (!byDate[tx.date]) byDate[tx.date] = []; byDate[tx.date].push(tx); });
    Object.keys(byDate).sort((a, b) => b.localeCompare(a)).forEach(date => {
      const dayTxs = byDate[date];
      const dayRev = dayTxs.filter(t => t.type === '매출').reduce((s, t) => s + t.amount, 0);
      const dayPur = dayTxs.filter(t => t.type === '매입').reduce((s, t) => s + t.amount, 0);
      rows += `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;border-top:1px solid #e2e8f0;">
        <span style="font-size:11px;font-weight:600;color:#475569;">${_fmtDayFull(date)}</span>
        <span style="font-size:11px;color:#64748b;">${dayRev>0?`<span style="color:#16a34a;">↑${fmtW(dayRev)}</span> `:''}${dayPur>0?`<span style="color:#dc2626;">↓${fmtW(dayPur)}</span>`:''}</span>
      </div>`;
      rows += dayTxs.slice().sort((a, b) => {
        const wc = _txWsIdx(a) - _txWsIdx(b); if (wc) return wc;
        const nc = (_clientNameCache[a.clientId]||'').localeCompare(_clientNameCache[b.clientId]||'','ko');
        return nc || a.id - b.id;
      }).map(tx => _buildTxRow(tx, true)).join('');
    });
  } else {
    rows = filtered.map(tx => _buildTxRow(tx, false)).join('');
  }

  return `<div style="display:flex;flex-direction:column;gap:14px;">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
      <div><h1 class="page-title" style="color:#0f172a;font-size:20px;font-weight:700;">거래 내역</h1>
      <p style="color:#64748b;font-size:12px;margin-top:2px;">${periodLabel} · ${filtered.length}건</p></div>
      <div style="display:flex;gap:6px;">
        <button onclick="openTxModal('add')" style="display:flex;align-items:center;gap:5px;background:#d97706;color:#fff;border:none;border-radius:8px;padding:8px 12px;font-size:13px;font-weight:700;cursor:pointer;">${I.plus} 추가</button>
      </div>
    </div>
    <div style="display:flex;gap:4px;background:#f1f5f9;border-radius:10px;padding:3px;">${modeTabs}</div>
    ${navHtml ? `<div style="display:flex;align-items:center;">${navHtml}</div>` : ''}
    <div class="g3">${sumCards}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <div style="position:relative;flex:1;min-width:140px;">
        <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#94a3b8;pointer-events:none;">${I.search}</span>
        <input id="txSearchInput" value="${esc(S.txSearch)}" oninput="setTxSearch(this.value)" onkeydown="if(event.key==='Enter'||event.keyCode===13){this.blur();}" enterkeyhint="search" placeholder="검색… (초성 가능)" style="${ISX}padding-left:30px;" ${FB}>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;">${typeBtns}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;">${stBtns}</div>
    </div>
    ${wsBtns ? `<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;"><span style="font-size:11px;color:#94a3b8;white-space:nowrap;">거래처:</span>${wsBtns}</div>` : ''}
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="display:flex;padding:9px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;gap:8px;">
        ${!grouped ? '<span class="col-date" style="color:#94a3b8;font-size:11px;font-weight:500;">날짜</span>' : ''}
        <span style="flex:1;color:#94a3b8;font-size:11px;font-weight:500;">거래처</span>
        <span class="col-type" style="color:#94a3b8;font-size:11px;">구분</span>
        <span class="col-amt" style="color:#94a3b8;font-size:11px;">공급가액</span>
        <span class="col-tax hide-sm" style="color:#94a3b8;font-size:11px;">세액</span>
        <span class="col-status" style="color:#94a3b8;font-size:11px;text-align:center;">상태</span>
        <span class="col-actions" style="color:#94a3b8;font-size:11px;">관리</span>
      </div>
      ${filtered.length === 0
        ? '<div id="txListRows" style="padding:40px 0;text-align:center;color:#94a3b8;font-size:13px;">거래 내역이 없습니다.</div>'
        : `<div id="txListRows">${rows}</div>`}
    </div>
    <p style="color:#cbd5e1;font-size:11px;text-align:center;">미수금·미지급금 배지를 클릭하면 결제 처리 모달이 열립니다.</p>
  </div>`;
}

// ── RECEIVABLES VIEW ──────────────────────────────────────────────────────────
function _rcvPeriodLabel() {
  const p = S.rcvPeriod;
  if (p === 'all') return '전체';
  if (p === 'month') {
    const [y, m] = S.rcvMonth.split('-');
    return `${y}년 ${parseInt(m)}월`;
  }
  if (p === 'quarter') {
    const [y, m] = S.rcvMonth.split('-').map(Number);
    const q = Math.ceil(m / 3);
    return `${y}년 ${q}분기`;
  }
  return '';
}

function _rcvFilterByPeriod(items) {
  const p = S.rcvPeriod;
  if (p === 'all') return items;
  const [y, mo] = S.rcvMonth.split('-').map(Number);
  return items.filter(t => {
    if (!t.date) return false;
    const [ty, tm] = t.date.split('-').map(Number);
    if (p === 'month') return ty === y && tm === mo;
    if (p === 'quarter') {
      const q  = Math.ceil(mo / 3);
      const tq = Math.ceil(tm / 3);
      return ty === y && tq === q;
    }
    return true;
  });
}

function _buildRcvSummaryCards() {
  const q = S.rcvSearch || '';
  const allTx = _rcvFilterByPeriod(S.transactions);
  const rec   = allTx.filter(t => t.status === TX_STATUS.UNPAID);
  const pay   = allTx.filter(t => t.status === TX_STATUS.UNBILLED);

  function _filterByQ(items) {
    if (!q) return items;
    return items.filter(t => {
      const cl = S.clients.find(c => c.id === t.clientId);
      return matchAny(q, cl?.name, t.memo, t.bizNo, String(t.clientId));
    });
  }
  const recF     = _filterByQ(rec);
  const payF     = _filterByQ(pay);
  const totalRec = recF.reduce((s, t) => s + _txRemain(t), 0);
  const totalPay = payF.reduce((s, t) => s + _txRemain(t), 0);

  return `<div class="g2">
    <div style="background:#fefce8;border:1px solid #fcd34d;border-radius:12px;padding:16px;">
      <div style="color:#b45309;font-size:12px;margin-bottom:5px;">총 미수금 (받을 돈)</div>
      <div style="color:#b45309;font-size:24px;font-weight:700;">${fmtW(totalRec)}</div>
      <div style="color:#d97706;font-size:11px;margin-top:3px;opacity:.75;">${recF.length}건</div>
    </div>
    <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:12px;padding:16px;">
      <div style="color:#dc2626;font-size:12px;margin-bottom:5px;">총 미지급금 (줄 돈)</div>
      <div style="color:#dc2626;font-size:24px;font-weight:700;">${fmtW(totalPay)}</div>
      <div style="color:#ef4444;font-size:11px;margin-top:3px;opacity:.75;">${payF.length}건</div>
    </div>
  </div>`;
}

function _buildRcvSortBtns() {
  const sortOpts = [
    { k: 'amount', label: '금액순' },
    { k: 'name',   label: '가나다순' },
    { k: 'date',   label: '날짜순' },
  ];
  const cur = S.rcvSort || 'amount';
  return `<div id="rcvSortBtns" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
    <span style="font-size:11px;color:#94a3b8;flex-shrink:0;">정렬</span>
    ${sortOpts.map(o => {
      const a = cur === o.k;
      return `<button onclick="setRcvSort('${o.k}')"
        style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid ${a?'#d97706':'#e2e8f0'};background:${a?'#fef3c7':'#f8fafc'};color:${a?'#b45309':'#64748b'};">${o.label}</button>`;
    }).join('')}
  </div>`;
}

function buildReceivables() {
  const p   = S.rcvPeriod;
  const q   = S.rcvSearch || '';
  const [y, mo] = S.rcvMonth.split('-').map(Number);

  // 이번 달 다음 달 여부 (미래 이동 막기)
  const now = new Date();
  const isMaxMonth = y > now.getFullYear() || (y === now.getFullYear() && mo >= now.getMonth() + 1);

  // 기간 버튼 스타일
  const btnStyle = (active) =>
    `padding:5px 13px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:none;` +
    (active ? `background:#d97706;color:#fff;` : `background:#f1f5f9;color:#64748b;`);

  // 월 이동 컨트롤 (월별/분기별일 때만)
  const navHtml = (p !== 'all') ? `
    <div style="display:flex;align-items:center;gap:6px;margin-top:8px;">
      <button onclick="rcvMonthMove(-1)" style="width:30px;height:30px;border-radius:50%;border:1px solid #e2e8f0;background:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">‹</button>
      <span style="font-size:13px;font-weight:700;color:#0f172a;min-width:90px;text-align:center;">${_rcvPeriodLabel()}</span>
      <button onclick="rcvMonthMove(1)" ${isMaxMonth ? 'disabled' : ''} style="width:30px;height:30px;border-radius:50%;border:1px solid #e2e8f0;background:${isMaxMonth?'#f8fafc':'#fff'};font-size:16px;cursor:${isMaxMonth?'default':'pointer'};display:flex;align-items:center;justify-content:center;color:${isMaxMonth?'#cbd5e1':'#0f172a'};">›</button>
    </div>` : '';

  const sortHtml = _buildRcvSortBtns();

  return `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <div>
          <h1 class="page-title" style="color:#0f172a;font-size:20px;font-weight:700;">채권·채무 관리</h1>
          <p style="color:#64748b;font-size:12px;margin-top:2px;">미수금 및 미지급금 현황</p>
        </div>
      </div>

      <!-- 기간 선택 탭 -->
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;gap:6px;">
          <button onclick="setRcvPeriod('month')"   style="${btnStyle(p==='month')}">월별</button>
          <button onclick="setRcvPeriod('quarter')" style="${btnStyle(p==='quarter')}">분기별</button>
          <button onclick="setRcvPeriod('all')"     style="${btnStyle(p==='all')}">전체</button>
        </div>
        ${navHtml}
      </div>

      <!-- 검색 + 정렬 -->
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="position:relative;">
          <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#94a3b8;pointer-events:none;">${I.search}</span>
          <input id="rcvSearchInput" value="${esc(q)}" oninput="setRcvSearch(this.value)" onkeydown="if(event.key==='Enter'||event.keyCode===13){this.blur();}" enterkeyhint="search" placeholder="거래처 검색… (초성 가능)" style="${ISX}padding-left:30px;" ${FB}>
        </div>
        ${sortHtml}
      </div>

      <!-- 합계 카드 -->
      <div id="rcvSummaryCards">${_buildRcvSummaryCards()}</div>
      <div id="rcvListArea">${_buildRcvSections()}</div>
    </div>`;
}

function _buildRcvSections() {
  const allTx = _rcvFilterByPeriod(S.transactions);
  const rec   = allTx.filter(t => t.status === TX_STATUS.UNPAID);
  const pay   = allTx.filter(t => t.status === TX_STATUS.UNBILLED);
  const q   = S.rcvSearch || '';

  function groupByClient(items) {
    const map = {};
    items.forEach(t => {
      const cl = S.clients.find(c => c.id === t.clientId);
      if (q && !matchAny(q, cl?.name, t.memo, t.bizNo, String(t.clientId))) return;
      if (!map[t.clientId]) map[t.clientId] = { clientId: t.clientId, txs: [] };
      map[t.clientId].txs.push(t);
    });
    const sort = S.rcvSort || 'amount';
    return Object.values(map).sort((a, b) => {
      if (sort === 'name') {
        const na = S.clients.find(c => c.id === a.clientId)?.name || '';
        const nb = S.clients.find(c => c.id === b.clientId)?.name || '';
        return na.localeCompare(nb, 'ko');
      }
      if (sort === 'date') {
        const da = a.txs.map(t => t.date).sort()[0] || '';
        const db = b.txs.map(t => t.date).sort()[0] || '';
        return da.localeCompare(db);
      }
      // amount (기본): 금액 내림차순
      return b.txs.reduce((s,t)=>s+_txRemain(t),0) - a.txs.reduce((s,t)=>s+_txRemain(t),0);
    });
  }

  function sectionHtml(title, items, color, bg, bd, isSales) {
    const groups       = groupByClient(items);
    const sectionTotal = fmtW(groups.reduce((s, g) => s + g.txs.reduce((ss,t)=>ss+_txRemain(t),0), 0));
    if (groups.length === 0) return `
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;background:${bg};border-bottom:1px solid ${bd};">
          <h3 style="color:${color};font-weight:600;font-size:14px;">${esc(title)}</h3>
          <span style="color:${color};font-weight:700;">${sectionTotal}</span>
        </div>
        <div style="padding:28px 0;text-align:center;color:#94a3b8;font-size:13px;">${q ? '검색 결과 없음' : '없음'}</div>
      </div>`;

    const groupRows = groups.map(g => {
      const cl         = S.clients.find(c => c.id === g.clientId);
      const groupRemain = g.txs.reduce((s,t)=>s+_txRemain(t),0);
      const oldestDate = g.txs.map(t=>t.date).sort()[0];
      const daysOldest = Math.floor((Date.now()-new Date(oldestDate))/86400000);
      const urgColor   = daysOldest>=60?'#dc2626':daysOldest>=30?'#b45309':'#64748b';
      const urgBg      = daysOldest>=60?'#fee2e2':daysOldest>=30?'#fef3c7':'#f1f5f9';
      return `
        <div onclick="goToClientTx(${g.clientId},${isSales?1:0})" class="hover-row" style="display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid #f1f5f9;gap:10px;cursor:pointer;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span style="font-weight:700;color:#0f172a;font-size:13px;">${esc(cl?.name||'?')}</span>
              <span style="font-size:10px;color:#94a3b8;">${g.txs.length}건</span>
              <span style="font-size:10px;background:${urgBg};color:${urgColor};padding:1px 6px;border-radius:4px;font-weight:600;">${daysOldest}일 경과</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;" onclick="event.stopPropagation()">
            <span style="color:${color};font-weight:700;font-size:15px;">${fmtW(groupRemain)}</span>
            ${isSales ? `<button onclick="openBatchPay(${g.clientId})" style="padding:5px 10px;border:none;background:${color};color:#fff;border-radius:7px;font-size:11px;cursor:pointer;font-weight:600;white-space:nowrap;">💰 수금</button>` : ''}
          </div>
        </div>`;
    }).join('');

    return `
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;background:${bg};border-bottom:1px solid ${bd};">
          <h3 style="color:${color};font-weight:600;font-size:14px;">${esc(title)}</h3>
          <span style="color:${color};font-weight:700;font-size:16px;">${sectionTotal}</span>
        </div>
        ${groupRows}
      </div>`;
  }

  return `
    <div style="display:flex;flex-direction:column;gap:16px;">
      ${sectionHtml('미수금 (받을 돈)', rec, '#b45309', '#fefce8', '#fcd34d', true)}
      ${sectionHtml('미지급금 (줄 돈)', pay, '#dc2626', '#fff1f2', '#fecdd3', false)}
    </div>`;
}
