// ── SIDEBAR / HEADER / BOTTOM NAV ─────────────────────────────────────────────
function sidebarInner(onClose = '') {
  const btns = NAV.map(({ k, label }) => {
    const icon = { dashboard:I.grid, clients:I.users, transactions:I.activity, receivables:I.card }[k];
    const a    = S.view === k;
    return `<button onclick="setView('${k}')${onClose}" ${a ? '' : 'class="nav-btn"'}
      style="width:100%;display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;border:none;cursor:pointer;margin-bottom:2px;text-align:left;background:${a?'#fef3c7':'transparent'};color:${a?'#b45309':'#64748b'};font-weight:${a?700:400};font-size:13px;">
      ${icon}${esc(label)}
    </button>`;
  }).join('');

  return `
    <div style="padding:18px 16px;border-bottom:1px solid #e2e8f0;">
      <div style="color:#b45309;font-weight:700;font-size:14px;">거래처·회계</div>
      <div style="color:#94a3b8;font-size:11px;margin-top:2px;">관리 시스템</div>
    </div>
    <nav style="flex:1;padding:10px;overflow-y:auto;">${btns}</nav>
    <div style="padding:10px;border-top:1px solid #e2e8f0;display:flex;flex-direction:column;gap:6px;">
      <button onclick="exportData()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:7px;padding:7px;border-radius:8px;border:1px solid #e2e8f0;background:#f8fafc;color:#475569;font-size:12px;font-weight:500;cursor:pointer;" onmouseenter="this.style.background='#f0fdf4';this.style.color='#16a34a';this.style.borderColor='#bbf7d0'" onmouseleave="this.style.background='#f8fafc';this.style.color='#475569';this.style.borderColor='#e2e8f0'">
        ${I.download} JSON 저장
      </button>
      <button onclick="importData()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:7px;padding:7px;border-radius:8px;border:1px solid #e2e8f0;background:#f8fafc;color:#475569;font-size:12px;font-weight:500;cursor:pointer;" onmouseenter="this.style.background='#eff6ff';this.style.color='#1d4ed8';this.style.borderColor='#bfdbfe'" onmouseleave="this.style.background='#f8fafc';this.style.color='#475569';this.style.borderColor='#e2e8f0'">
        ${I.upload} JSON 불러오기
      </button>
      <button onclick="openSyncModal()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:7px;padding:7px;border-radius:8px;border:1px solid #d97706;background:#fef3c7;color:#b45309;font-size:12px;font-weight:600;cursor:pointer;" onmouseenter="this.style.background='#fde68a'" onmouseleave="this.style.background='#fef3c7'">
        ${I.spark} 납품 관리 연동
      </button>
      <button onclick="openBackupModal()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:7px;padding:7px;border-radius:8px;border:1px solid #c4b5fd;background:#f5f3ff;color:#7c3aed;font-size:12px;font-weight:500;cursor:pointer;" onmouseenter="this.style.background='#ede9fe';this.style.color='#6d28d9'" onmouseleave="this.style.background='#f5f3ff';this.style.color='#7c3aed'">
        🗄️ 백업 / 복구
      </button>
      <div style="text-align:center;color:#cbd5e1;font-size:10px;padding-top:2px;">거래처 ${S.clients.length}개 · ${S.transactions.length}건</div>
      <div style="text-align:center;color:#e2e8f0;font-size:10px;">${APP_VERSION}</div>
      ${_syncBadgeHTML()}
      <!-- 변경이력 아코디언 -->
      <div style="margin-top:6px;border-top:1px solid #334155;padding-top:6px;">
        <button onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('.arr').textContent=this.nextElementSibling.style.display==='none'?'▶':'▼'"
          style="width:100%;background:none;border:none;color:#94a3b8;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;padding:3px 0;">
          <span class="arr">▶</span> 변경이력
        </button>
        <div style="display:none;margin-top:6px;max-height:220px;overflow-y:auto;font-size:10px;color:#94a3b8;line-height:1.6;">
          <div style="margin-bottom:8px;">
            <span style="color:#34d399;font-weight:700;">v6.1</span>
            <ul style="margin:3px 0 0 12px;padding:0;list-style:disc;">
              <li>모든 버전 통합 — 누락 없는 완전체 빌드</li>
              <li>납품 역방향 패치 원자적 처리 (분리 update → 단일 update)</li>
              <li>dlControlled 병합 로직 개선 (local.dlControlled 여부 무관하게 결제필드 덮어씀)</li>
              <li>Firebase 저장 실패 시 에러 토스트 + 로컬 보존 보장</li>
              <li>백그라운드/네트워크 복귀 시 납품 리스너 강제 재연결</li>
              <li>sharedClientsRef detach 메모리 정리</li>
              <li>코드 정리 — 미사용 변수·중복 로직 제거</li>
            </ul>
          </div>
          <div style="margin-bottom:8px;">
            <span style="color:#94a3b8;font-weight:700;">v6.0</span>
            <ul style="margin:3px 0 0 12px;padding:0;list-style:disc;">
              <li>채권·채무 기간 필터 (월별/분기별/전체) + 좌우 이동</li>
              <li>TX_STATUS 상수화 — 상태 문자열 직접 비교 제거</li>
              <li>updatedAt 자동 기록 (저장 시마다)</li>
              <li>납품 앱 실시간 리스너 _pending 마커 버그 수정</li>
            </ul>
          </div>
          <div style="margin-bottom:8px;">
            <span style="color:#94a3b8;font-weight:700;">v5.0</span>
            <ul style="margin:3px 0 0 12px;padding:0;list-style:disc;">
              <li>다중 워크스페이스 실시간 동기화</li>
              <li>sharedClients 필터링 (isSelfWs 버그 수정)</li>
              <li>납품앱 ↔ CRM 결제 역방향 패치</li>
            </ul>
          </div>
          <div style="margin-bottom:8px;">
            <span style="color:#94a3b8;font-weight:700;">v4.0</span>
            <ul style="margin:3px 0 0 12px;padding:0;list-style:disc;">
              <li>멀티파일 구조 분리 (js/)</li>
              <li>채권·채무 관리 뷰</li>
              <li>일괄 수금 처리</li>
            </ul>
          </div>
        </div>
      </div>
    </div>`;
}

function buildMobileHeader() {
  return `
    <div class="mobile-header">
      <button onclick="openDrawer()" style="background:none;border:none;cursor:pointer;color:#475569;display:flex;align-items:center;">${I.menu}</button>
      <span style="font-size:14px;font-weight:700;color:#b45309;">거래처·회계</span>
      <span style="font-size:12px;color:#94a3b8;">${esc(LABELS[S.view] || '')}</span>
    </div>`;
}

function buildBottomNav() {
  const dots  = NAV.map(({ k }) => `<div style="width:5px;height:5px;border-radius:50%;background:${S.view===k?'#d97706':'#e2e8f0'};transition:background .2s;"></div>`).join('');
  const items = NAV.map(({ k, label }) => {
    const icon = { dashboard:I.grid, clients:I.users, transactions:I.activity, receivables:I.card }[k];
    const a    = S.view === k;
    return `<button onclick="setView('${k}')" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:none;border:none;color:${a?'#b45309':'#94a3b8'};padding:4px 0;">
      ${icon}
      <span style="font-size:9px;font-weight:${a?700:400};">${esc(label.replace(/\s/g,''))}</span>
    </button>`;
  }).join('');
  return `<div class="bottom-wrap">
    <div style="display:flex;justify-content:center;gap:6px;padding:5px 0 2px;background:#fff;">${dots}</div>
    <nav class="bottom-nav" style="border-top:1px solid #e2e8f0;">${items}</nav>
  </div>`;
}

function buildDrawer() {
  return `
    <div class="sidebar-overlay" id="sidebarOverlay" onclick="closeDrawer()" style="display:${S.drawerOpen?'block':'none'};"></div>
    <div class="sidebar-drawer ${S.drawerOpen?'open':''}" id="sidebarDrawer">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #e2e8f0;">
        <span style="color:#b45309;font-weight:700;font-size:14px;">메뉴</span>
        <button onclick="closeDrawer()" style="background:none;border:none;cursor:pointer;color:#94a3b8;">${I.x}</button>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">${sidebarInner(';closeDrawer()')}</div>
    </div>`;
}

// ── MODAL WRAPPERS ────────────────────────────────────────────────────────────
function modalWrap(title, onClose, maxW, content) {
  return `
    <div style="position:fixed;top:0;right:0;bottom:0;left:0;z-index:50;display:flex;align-items:flex-end;justify-content:center;padding:0;background:rgba(15,23,42,.35);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);" id="modalBackdrop">
      <div style="background:#fff;border:1px solid #e2e8f0;width:100%;max-width:${maxW}px;border-radius:16px 16px 0 0;box-shadow:0 -8px 40px rgba(0,0,0,.12);max-height:92vh;max-height:92dvh;display:flex;flex-direction:column;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #f1f5f9;flex-shrink:0;">
          <span style="color:#0f172a;font-weight:600;font-size:15px;">${esc(title)}</span>
          <button onclick="${onClose}" style="color:#94a3b8;background:none;border:none;padding:4px;">${I.x}</button>
        </div>
        <div style="padding:18px;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:calc(18px + env(safe-area-inset-bottom,0px));">${content}</div>
      </div>
    </div>`;
}

function buildConfirm() {
  const c = M.confirm; if (!c) return '';
  return `
    <div style="position:fixed;top:0;right:0;bottom:0;left:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.4);">
      <div style="background:#fff;border:1px solid #e2e8f0;max-width:300px;width:100%;padding:22px;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,.12);">
        <p style="color:#0f172a;font-size:14px;text-align:center;margin-bottom:18px;white-space:pre-line;">${esc(c.msg)}</p>
        <div style="display:flex;gap:8px;">
          <button onclick="M.confirm=null;renderModals()" style="flex:1;padding:9px 0;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;border-radius:8px;font-size:13px;cursor:pointer;">취소</button>
          <button onclick="${c.okStr}" style="flex:1;padding:9px 0;background:#dc2626;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">삭제</button>
        </div>
      </div>
    </div>`;
}

// ── CLIENT / TX MODAL ─────────────────────────────────────────────────────────
function buildClientModal() {
  const m   = M.clientModal;
  const isEd = m !== 'add' && typeof m === 'object';
  const f   = isEd ? m : { name:'', bizNo:'', rep:'', phone:'', email:'', address:'', type:'매출처', memo:'' };
  const inp = (key, ph, type = 'text') => `<input id="cf_${key}" type="${type}" value="${esc(f[key] || '')}" placeholder="${esc(ph)}" style="${ISX}" ${FB}>`;
  const content = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div style="grid-column:1/-1;"><label style="font-size:12px;color:#64748b;">거래처명<span style="color:#dc2626">*</span></label><div style="margin-top:4px;">${inp('name','회사명')}</div></div>
      <div><label style="font-size:12px;color:#64748b;">사업자번호</label><div style="margin-top:4px;">${inp('bizNo','000-00-00000')}</div></div>
      <div><label style="font-size:12px;color:#64748b;">구분<span style="color:#dc2626">*</span></label><div style="margin-top:4px;"><select id="cf_type" style="${ISX}"><option ${f.type==='매출처'?'selected':''}>매출처</option><option ${f.type==='매입처'?'selected':''}>매입처</option><option ${f.type==='매출/매입'?'selected':''}>매출/매입</option></select></div></div>
      <div><label style="font-size:12px;color:#64748b;">대표자</label><div style="margin-top:4px;">${inp('rep','대표자명')}</div></div>
      <div><label style="font-size:12px;color:#64748b;">전화번호</label><div style="margin-top:4px;">${inp('phone','02-0000-0000')}</div></div>
      <div style="grid-column:1/-1;"><label style="font-size:12px;color:#64748b;">이메일</label><div style="margin-top:4px;">${inp('email','email@company.com','email')}</div></div>
      <div style="grid-column:1/-1;"><label style="font-size:12px;color:#64748b;">주소</label><div style="margin-top:4px;">${inp('address','주소 입력')}</div></div>
      <div style="grid-column:1/-1;"><label style="font-size:12px;color:#64748b;">메모</label><div style="margin-top:4px;"><textarea id="cf_memo" placeholder="특이사항" rows="2" style="${ISX}resize:none;" ${FB}>${esc(f.memo||'')}</textarea></div></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;">
      <button onclick="closeClientModal()" style="flex:1;padding:10px 0;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;border-radius:8px;font-size:13px;cursor:pointer;">취소</button>
      <button onclick="submitClientModal(${isEd?f.id:'null'})" style="flex:1;padding:10px 0;background:#d97706;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">저장</button>
    </div>`;
  return modalWrap(isEd ? '거래처 수정' : '거래처 추가', 'closeClientModal()', 480, content);
}

function buildTxModal() {
  const m   = M.txModal;
  const isEd = m !== 'add' && typeof m === 'object';
  const f   = isEd ? m : { date:today(), clientId:S.clients[0]?.id||1, type:'매출', amount:'', tax:'', taxType:'taxable', memo:'', status:defaultStatus('매출') };
  if (!f.taxType) f.taxType = (f.tax === 0 && f.amount > 0) ? 'exempt' : 'taxable';
  const initClientName = isEd ? (S.clients.find(c => c.id === f.clientId)?.name || '') : '';
  const clientOpts = S.clients.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const stOpts     = (f.type === '매출' ? [TX_STATUS.UNPAID,TX_STATUS.PAID] : [TX_STATUS.UNBILLED,TX_STATUS.BILLED]).map(s => `<option ${s === f.status ? 'selected' : ''}>${esc(s)}</option>`).join('');
  const isTaxable  = f.taxType !== 'exempt';
  const taxAmt     = isTaxable ? (+f.tax || 0) : 0;
  const preview    = f.amount > 0
    ? `<div id="txTotal" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;margin-top:12px;display:flex;justify-content:space-between;align-items:center;"><span style="color:#16a34a;font-size:12px;">합계 금액</span><span style="color:#16a34a;font-weight:700;font-size:16px;">${fmtW((+f.amount||0)+taxAmt)}</span></div>`
    : `<div id="txTotal"></div>`;
  const taxToggle = `
    <div style="display:flex;gap:0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-top:4px;">
      <button id="tt_taxable" onclick="onTxTaxType('taxable')" style="flex:1;padding:8px 0;font-size:12px;font-weight:600;border:none;cursor:pointer;transition:all .15s;background:${isTaxable?'#d97706':'#f8fafc'};color:${isTaxable?'#fff':'#94a3b8'};">과세 (10%)</button>
      <button id="tt_exempt"  onclick="onTxTaxType('exempt')"  style="flex:1;padding:8px 0;font-size:12px;font-weight:600;border:none;cursor:pointer;transition:all .15s;background:${!isTaxable?'#0369a1':'#f8fafc'};color:${!isTaxable?'#fff':'#94a3b8'};">비과세</button>
    </div>`;
  const content = `
    <input type="hidden" id="tf_taxType" value="${isTaxable?'taxable':'exempt'}">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div><label style="font-size:12px;color:#64748b;">거래일자<span style="color:#dc2626">*</span></label><div style="margin-top:4px;"><input id="tf_date" type="date" value="${esc(f.date)}" max="${localDate()}" style="${ISX}"></div></div>
      <div><label style="font-size:12px;color:#64748b;">구분<span style="color:#dc2626">*</span></label><div style="margin-top:4px;"><select id="tf_type" onchange="onTxType(this.value)" style="${ISX}"><option ${f.type==='매출'?'selected':''}>매출</option><option ${f.type==='매입'?'selected':''}>매입</option></select></div></div>
      <div style="grid-column:1/-1;"><label style="font-size:12px;color:#64748b;">거래처<span style="color:#dc2626">*</span></label><div style="margin-top:4px;position:relative;"><input id="tf_clientName" list="tf_clientList" value="${esc(initClientName)}" placeholder="거래처명 입력 또는 선택…" autocomplete="off" oninput="_onTxClientInput(this.value)" onkeydown="if(event.key==='Enter'||event.keyCode===13){this.blur();}" style="${ISX}"><datalist id="tf_clientList">${clientOpts}</datalist><input type="hidden" id="tf_clientId" value="${isEd?f.clientId:''}"></div></div>
      <div style="grid-column:1/-1;"><label style="font-size:12px;color:#64748b;">과세 여부</label>${taxToggle}</div>
      <div><label style="font-size:12px;color:#64748b;">공급가액<span style="color:#dc2626">*</span></label><div style="margin-top:4px;"><input id="tf_amount" value="${f.amount?fmt(f.amount):''}" oninput="applyAmtFmt(this);onTxAmt(this.value)" placeholder="0" style="${ISX}" ${FB}></div></div>
      <div><label style="font-size:12px;color:#64748b;">세액${isTaxable?' (자동계산)':' (비과세)'}</label><div style="margin-top:4px;"><input id="tf_tax" value="${isTaxable&&f.tax?fmt(f.tax):''}" oninput="applyAmtFmt(this);onTxTax(this.value)" placeholder="0" style="${ISX};${!isTaxable?'background:#f1f5f9;color:#94a3b8;':''}" ${!isTaxable?'disabled':''} ${FB}></div></div>
      <div style="grid-column:1/-1;"><label style="font-size:12px;color:#64748b;">적요</label><div style="margin-top:4px;"><input id="tf_memo" value="${esc(f.memo||'')}" placeholder="거래 내용" style="${ISX}" ${FB}></div></div>
      <div style="grid-column:1/-1;"><label style="font-size:12px;color:#64748b;">상태</label><div style="margin-top:4px;"><select id="tf_status" style="${ISX}">${stOpts}</select></div></div>
    </div>
    ${preview}
    <div style="display:flex;gap:8px;margin-top:16px;">
      <button onclick="closeTxModal()" style="flex:1;padding:10px 0;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;border-radius:8px;font-size:13px;cursor:pointer;">취소</button>
      <button onclick="submitTxModal(${isEd?f.id:'null'})" style="flex:1;padding:10px 0;background:#d97706;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">저장</button>
    </div>`;
  return modalWrap(isEd ? '거래 수정' : '거래 추가', 'closeTxModal()', 480, content);
}

// ── AI 영수증 스캔 ─────────────────────────────────────────────────────────────
function openScanInput() {
  const proto = location.protocol;
  if (proto === 'file:' || proto === 'content:' || proto === 'blob:') {
    M.scanModal = { state:'localfile', previewUrl:null, base64:null, mediaType:null, result:null, error:null };
    _pushModalHistory(); renderModals(); return;
  }
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment'; input.style.display = 'none';
  document.body.appendChild(input);
  input.onchange = async e => {
    const file = e.target.files[0];
    document.body.removeChild(input);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('이미지가 너무 큽니다. (최대 5MB)'); return; }
    await runScan(file);
  };
  input.click();
}

async function runScan(file) {
  const previewUrl = URL.createObjectURL(file);
  const base64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(',')[1]);
    r.onerror = () => rej(new Error('read failed'));
    r.readAsDataURL(file);
  });
  const mediaType = file.type || 'image/jpeg';
  M.scanModal = { state:'loading', previewUrl, base64, mediaType, result:null, error:null };
  renderModals();

  try {
    if (!OPENROUTER_API_KEY) throw new Error('OpenRouter API 키가 설정되지 않았습니다.');
    const prompt = `이 이미지는 영수증, 세금계산서, 청구서, 거래명세서 등 매입 관련 문서입니다.
이미지를 분석하여 아래 JSON 형식으로만 응답하세요. 마크다운 코드블록 없이 JSON만 출력하세요.

{
  "supplierName": "공급자(판매처) 상호명. 없으면 null",
  "date": "거래일자 YYYY-MM-DD 형식. 없으면 오늘 날짜",
  "amount": "공급가액(세금 제외) 숫자만. 없으면 0",
  "tax": "부가세액 숫자만. 없으면 0",
  "memo": "품목이나 거래내용 요약 (50자 이내)",
  "confidence": "분석 신뢰도 high/medium/low",
  "note": "사용자에게 전달할 참고사항 (한국어, 없으면 null)"
}

규칙:
- amount와 tax는 콤마 없는 정수
- 세금계산서면 공급가액과 세액을 분리
- 영수증(부가세 포함가)이면 amount=총액÷1.1 반올림, tax=총액-amount
- 날짜를 읽기 어려우면 오늘(${localDate()}) 사용
- 문서가 아닌 이미지면 confidence=low, note에 설명`;

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': location.origin,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free',
        max_tokens: 1000,
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
          { type: 'text', text: prompt }
        ]}],
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API 오류 ${resp.status}`);
    }
    const data   = await resp.json();
    const raw    = data.choices?.[0]?.message?.content || '{}';
    const clean  = raw.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);
    M.scanModal = { state:'done', previewUrl, base64, mediaType, result:parsed, error:null };
  } catch (err) {
    M.scanModal = { state:'error', previewUrl, base64, mediaType, result:null, error: err.message || '분석 실패' };
  }
  renderModals();
}

function buildScanModal() {
  const m = M.scanModal; if (!m) return '';

  if (m.state === 'localfile') {
    return modalWrap('AI 영수증 스캔 사용법', 'closeScanModal()', 500, `
      <div style="text-align:center;padding:8px 0 20px;">
        <div style="font-size:40px;margin-bottom:12px;">🌐</div>
        <div style="color:#0f172a;font-weight:700;font-size:16px;margin-bottom:8px;">웹 서버 호스팅이 필요합니다</div>
        <div style="color:#64748b;font-size:13px;line-height:1.6;margin-bottom:20px;">AI 스캔 기능은 외부 API를 호출하기 때문에<br>로컬 파일에서는 보안상 차단됩니다.</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="background:#16a34a;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:9999px;">추천</span><span style="color:#16a34a;font-weight:700;font-size:13px;">GitHub Pages (무료·영구)</span></div>
          <ol style="color:#334155;font-size:12px;line-height:2;padding-left:18px;margin:0;"><li>github.com 가입 → 새 저장소 생성</li><li>HTML 파일 업로드</li><li>Settings → Pages → Branch: main → Save</li></ol>
        </div>
        <div style="background:#fefce8;border:1px solid #fef08a;border-radius:10px;padding:12px;">
          <div style="color:#b45309;font-size:12px;line-height:1.7;">⚠️ <strong>다른 기능은 영향 없음</strong> — 거래처 관리, 거래 내역, 채권·채무, JSON 저장/불러오기는 로컬 파일에서도 정상 작동합니다.</div>
        </div>
      </div>
      <button type="button" onclick="closeScanModal()" style="width:100%;padding:11px 0;background:#d97706;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">확인</button>`);
  }
  if (m.state === 'loading') {
    return modalWrap('AI 영수증 분석', 'closeScanModal()', 480, `
      <div style="text-align:center;padding:32px 0;">
        <div style="margin:0 auto 18px;width:52px;height:52px;border:3px solid #e2e8f0;border-top-color:#d97706;border-radius:50%;animation:spin .8s linear infinite;"></div>
        <div style="color:#0f172a;font-weight:600;margin-bottom:6px;">이미지 분석 중…</div>
        <div style="color:#94a3b8;font-size:12px;">Claude AI가 거래 정보를 읽고 있습니다</div>
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg);}}</style>`);
  }
  if (m.state === 'error') {
    return modalWrap('AI 영수증 분석', 'closeScanModal()', 480, `
      <div style="text-align:center;padding:24px 0;">
        <div style="font-size:36px;margin-bottom:12px;">⚠️</div>
        <div style="color:#dc2626;font-weight:600;margin-bottom:8px;">분석 실패</div>
        <div style="color:#64748b;font-size:13px;margin-bottom:20px;">${esc(m.error)}</div>
        <div style="display:flex;gap:8px;justify-content:center;">
          <button type="button" onclick="closeScanModal()" style="padding:9px 20px;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;border-radius:8px;font-size:13px;cursor:pointer;">닫기</button>
          <button type="button" onclick="openScanInput()" style="padding:9px 20px;background:#d97706;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">다시 촬영</button>
        </div>
      </div>`);
  }

  const r          = m.result || {};
  const confColor  = r.confidence === 'high' ? '#16a34a' : r.confidence === 'medium' ? '#b45309' : '#dc2626';
  const confLabel  = r.confidence === 'high' ? '높음' : r.confidence === 'medium' ? '보통' : '낮음';
  const total      = (+r.amount || 0) + (+r.tax || 0);
  const matchedClient = r.supplierName ? S.clients.find(c => c.type === '매입처' && c.name.includes(r.supplierName?.slice(0, 2))) : null;
  const clientOpts = S.clients.map(c => `<option value="${c.id}" ${matchedClient?.id === c.id ? 'selected' : ''}>${esc(c.name)} (${esc(c.type)})</option>`).join('');

  return modalWrap('AI 영수증 분석 결과', 'closeScanModal()', 520, `
    <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:16px;">
      <img src="${m.previewUrl}" alt="영수증" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;flex-shrink:0;">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="color:#0f172a;font-weight:600;font-size:14px;">분석 완료</span>
          <span style="background:${confColor}18;border:1px solid ${confColor}40;color:${confColor};font-size:11px;padding:1px 8px;border-radius:9999px;font-weight:600;">신뢰도 ${confLabel}</span>
        </div>
        ${r.note ? `<div style="color:#64748b;font-size:12px;background:#f8fafc;border-radius:6px;padding:7px 10px;border-left:3px solid #d97706;">${esc(r.note)}</div>` : ''}
        ${total > 0 ? `<div style="color:#1d4ed8;font-size:13px;font-weight:700;margin-top:6px;">합계 ${fmtW(total)}</div>` : ''}
      </div>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px;">
      <div style="color:#475569;font-size:11px;font-weight:600;margin-bottom:10px;display:flex;align-items:center;gap:5px;">${I.spark} 추출된 정보 (수정 가능)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="grid-column:1/-1;"><label style="font-size:11px;color:#64748b;">거래처</label><select id="sc_clientId" style="${ISX}margin-top:3px;font-size:14px;"><option value="">-- 선택 --</option>${clientOpts}</select>${r.supplierName?`<div style="color:#94a3b8;font-size:10px;margin-top:3px;">📷 인식된 상호: ${esc(r.supplierName)}</div>`:''}</div>
        <div><label style="font-size:11px;color:#64748b;">거래일자</label><input id="sc_date" type="date" value="${esc(r.date||localDate())}" style="${ISX}margin-top:3px;"></div>
        <div><label style="font-size:11px;color:#64748b;">공급가액</label><input id="sc_amount" type="text" value="${fmt(+r.amount||0)}" oninput="applyAmtFmt(this);scUpdateTotal()" style="${ISX}margin-top:3px;"></div>
        <div><label style="font-size:11px;color:#64748b;">세액</label><input id="sc_tax" type="text" value="${fmt(+r.tax||0)}" oninput="applyAmtFmt(this);scUpdateTotal()" style="${ISX}margin-top:3px;"></div>
        <div style="grid-column:1/-1;"><label style="font-size:11px;color:#64748b;">적요</label><input id="sc_memo" type="text" value="${esc(r.memo||'')}" placeholder="거래 내용" style="${ISX}margin-top:3px;"></div>
      </div>
      <div id="scTotal" style="margin-top:10px;"></div>
    </div>
    <div style="display:flex;gap:8px;">
      <button type="button" onclick="openScanInput()" style="padding:10px 14px;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;border-radius:8px;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:5px;">${I.camera} 재촬영</button>
      <button type="button" onclick="closeScanModal()" style="flex:1;padding:10px 0;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;border-radius:8px;font-size:13px;cursor:pointer;">취소</button>
      <button type="button" onclick="applyScanResult()" style="flex:2;padding:10px 0;background:#d97706;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">매입 거래로 추가</button>
    </div>`);
}

function scUpdateTotal() {
  const amt = parseInt((document.getElementById('sc_amount')?.value || '').replace(/[^0-9]/g, '')) || 0;
  const tax = parseInt((document.getElementById('sc_tax')?.value || '').replace(/[^0-9]/g, '')) || 0;
  const el  = document.getElementById('scTotal'); if (!el) return;
  if (amt > 0 || tax > 0) {
    el.style.cssText = 'background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;';
    el.innerHTML = `<span style="color:#1d4ed8;font-size:12px;">합계 금액</span><span style="color:#1d4ed8;font-weight:700;font-size:15px;">${fmtW(amt + tax)}</span>`;
  } else { el.style.cssText = ''; el.innerHTML = ''; }
}

async function applyScanResult() {
  const clientId = Number(document.getElementById('sc_clientId')?.value);
  const amtRaw   = (document.getElementById('sc_amount')?.value || '').replace(/[^0-9]/g, '');
  const taxRaw   = (document.getElementById('sc_tax')?.value || '').replace(/[^0-9]/g, '');
  const dateVal  = document.getElementById('sc_date')?.value;
  const memo     = document.getElementById('sc_memo')?.value || '';
  if (!clientId) { showToast('거래처를 선택하세요.'); return; }
  if (!amtRaw)   { showToast('금액을 입력하세요.'); return; }
  if (!dateVal)  { showToast('거래일자를 확인하세요.'); return; }
  const tx = { date:dateVal, clientId, type:'매입', amount:parseInt(amtRaw)||0, tax:parseInt(taxRaw)||0, memo, status:TX_STATUS.UNBILLED, id:nextId(S.transactions) };
  S.transactions = [...S.transactions, tx];
  saveTX();
  URL.revokeObjectURL(M.scanModal?.previewUrl);
  M.scanModal = null;
  S.view = 'transactions';
  render(); showToast('매입 거래가 추가됐습니다.');
}
function closeScanModal() { if (M.scanModal?.previewUrl) URL.revokeObjectURL(M.scanModal.previewUrl); M.scanModal = null; renderModals(); }

// ── QUICK PAY ─────────────────────────────────────────────────────────────────
function openQuickPay(txId) {
  const t = S.transactions.find(x => x.id === txId); if (!t) return;
  M.qpModal = { txId, amount: _txRemain(t), method:'cash', cash:0, transfer:0 };
  _pushModalHistory(); renderModals();
}
function closeQuickPay() { M.qpModal = null; render(); }

function buildQuickPayModal() {
  const mo   = M.qpModal;
  const t    = S.transactions.find(x => x.id === mo.txId); if (!t) return '';
  const cl   = S.clients.find(c => c.id === t.clientId);
  const total = t.amount + t.tax;
  const already = t.paidAmount || 0;
  const remain  = total - already;
  const isSales = t.status === TX_STATUS.UNPAID;
  const accentColor = isSales ? '#16a34a' : '#1d4ed8';
  const label   = isSales ? '수금' : '지급';
  const previewAmt = mo.method === 'mixed' ? (mo.mixCash||0)+(mo.mixTransfer||0) : (mo.amount||0);
  const carryOver  = S.transactions.filter(x => x.clientId === t.clientId && x.id !== t.id && _txIsPending(x)).reduce((s,x)=>s+_txRemain(x),0);
  const carryBtn   = carryOver > 0
    ? `<button onclick="M.qpModal.amount=${carryOver};document.getElementById('qp_amt').value=new Intl.NumberFormat('ko-KR').format(${carryOver});_updatePayPreview('qp');renderModals()" style="padding:5px 9px;border-radius:7px;border:1px solid #fcd34d;background:#fefce8;color:#b45309;font-size:11px;font-weight:600;cursor:pointer;">⏩ 이월액 ${esc(fmtW(carryOver))}</button>` : '';
  const quickBtns = [
    { label:'전액', val:remain },
    ...(remain>=200000?[{label:'절반',val:Math.round(remain/2/1000)*1000}]:[]),
    ...[500000,300000,200000,100000].filter(v=>v<remain&&v>0).slice(0,2).map(v=>({label:fmtW(v),val:v})),
  ].slice(0,4).map(b=>`<button onclick="M.qpModal.amount=${b.val};document.getElementById('qp_amt').value=new Intl.NumberFormat('ko-KR').format(${b.val});_updatePayPreview('qp');renderModals()" style="padding:5px 9px;border-radius:7px;border:1px solid #e2e8f0;background:#f8fafc;color:#475569;font-size:11px;cursor:pointer;">${esc(b.label)}</button>`).join('');

  return `
    <div onclick="closeQuickPay()" style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:50;display:flex;align-items:flex-end;justify-content:center;padding-bottom:env(safe-area-inset-bottom);">
      <div onclick="event.stopPropagation()" style="background:#fff;border-radius:18px 18px 0 0;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 -8px 40px rgba(0,0,0,.18);">
        <div style="width:36px;height:4px;background:#e2e8f0;border-radius:2px;margin:10px auto 0;"></div>
        <div style="padding:16px 18px 0;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-weight:700;color:#0f172a;font-size:15px;">${isSales?'💳':'💸'} ${label} 처리</div>
            <div style="color:#64748b;font-size:12px;margin-top:2px;">${esc(cl?.name||'?')} · ${esc(t.date)}</div>
          </div>
          <button onclick="closeQuickPay()" style="background:none;border:none;cursor:pointer;color:#94a3b8;">${I.x}</button>
        </div>
        <div style="padding:16px 18px;">
          <div style="display:grid;grid-template-columns:repeat(${already>0?3:2},1fr);gap:8px;margin-bottom:16px;">
            <div style="background:#f8fafc;border-radius:8px;padding:10px;text-align:center;"><div style="color:#94a3b8;font-size:10px;">청구금액</div><div style="color:#0f172a;font-size:14px;font-weight:700;">${fmtW(total)}</div></div>
            ${already>0?`<div style="background:#eff6ff;border-radius:8px;padding:10px;text-align:center;"><div style="color:#94a3b8;font-size:10px;">기수금</div><div style="color:#1d4ed8;font-size:14px;font-weight:700;">${fmtW(already)}</div></div>`:''}
            <div style="background:#fefce8;border-radius:8px;padding:10px;text-align:center;"><div style="color:#94a3b8;font-size:10px;">잔여금액</div><div style="color:#b45309;font-size:14px;font-weight:700;">${fmtW(remain)}</div></div>
          </div>
          <div style="margin-bottom:12px;">
            <div style="font-size:12px;color:#64748b;margin-bottom:6px;">${label}액</div>
            <input id="qp_amt" type="text" inputmode="numeric" value="${mo.amount?fmt(mo.amount):''}" placeholder="${fmt(remain)}" style="${ISX}font-size:16px;font-weight:600;" ${FB} oninput="applyAmtFmt(this);M.qpModal.amount=parseInt(this.value.replace(/[^0-9]/g,''))||0;_updatePayPreview('qp')">
            <div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;">${carryBtn}${quickBtns}</div>
          </div>
          <div style="margin-bottom:12px;"><div style="font-size:12px;color:#64748b;margin-bottom:6px;">결제 수단</div>${_methodTabs(mo.method,'qp')}${_mixedInputs(mo.method,'qp')}</div>
          <div id="qp_preview" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;font-size:12px;margin-bottom:12px;display:${previewAmt>0?'block':'none'};">
            ${previewAmt>0?(previewAmt>=remain?'<span style="color:#16a34a;font-weight:600;">✅ 전액 수금 완료</span>':`<span style="color:#b45309;">💳 부분 수금 · 잔여 <b>${fmtW(remain-previewAmt)}</b></span>`):''}
          </div>
          <div style="display:flex;gap:8px;">
            <button onclick="closeQuickPay()" style="flex:1;padding:11px;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;border-radius:10px;font-size:13px;cursor:pointer;">취소</button>
            <button onclick="confirmQuickPay()" style="flex:2;padding:11px;border:none;background:${accentColor};color:#fff;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">${label} 처리</button>
          </div>
        </div>
      </div>
    </div>`;
}

function confirmQuickPay() {
  const mo   = M.qpModal;
  const t    = S.transactions.find(x => x.id === mo.txId); if (!t) return;
  const already = t.paidAmount || 0;
  const remain  = (t.amount + t.tax) - already;
  const amt     = mo.method === 'mixed' ? (mo.mixCash||0)+(mo.mixTransfer||0) : (mo.amount||0);
  if (amt <= 0)     { showToast('금액을 입력하세요.'); return; }
  if (amt > remain) { showToast('잔여금액보다 많습니다.'); return; }
  const isFull          = amt >= remain;
  const paidMethodDetail = mo.method === 'mixed' ? { cash: mo.mixCash||0, transfer: mo.mixTransfer||0 } : null;
  const paidAt          = new Date().toISOString();
  let updatedTx = null;
  S.transactions = S.transactions.map(tx => {
    if (tx.id !== mo.txId) return tx;
    const next = { ...tx, paidAmount: already + amt, paidAt, paidMethod: mo.method };
    if (paidMethodDetail) next.paidMethodDetail = paidMethodDetail;
    if (isFull) next.status = tx.status === TX_STATUS.UNPAID ? TX_STATUS.PAID : TX_STATUS.BILLED;
    delete next.dlControlled; // CRM이 직접 처리 → 거래장 우선권 해제
    updatedTx = next; return next;
  });
  if (updatedTx) _saveOneTx(updatedTx); else saveTX();
  lsSet('crm_tx', S.transactions);
  closeQuickPay();
  const icon = mo.method === 'transfer' ? '🏦' : mo.method === 'mixed' ? '🔀' : '💵';
  showToast(icon + ' ' + (isFull ? '완납 처리' : '부분 수금 처리'));
  _afterNapumPatch(updatedTx);
}

// ── 일괄 수금 ─────────────────────────────────────────────────────────────────
function openBatchPay(clientId) {
  const pending = S.transactions.filter(t => t.clientId === clientId && t.status === TX_STATUS.UNPAID).sort((a,b)=>a.date.localeCompare(b.date));
  if (!pending.length) { showToast('미수금이 없습니다.'); return; }
  M.batchPayModal = { clientId, amount: pending.reduce((s,t)=>s+_txRemain(t),0), method:'cash', cash:0, transfer:0 };
  _pushModalHistory(); renderModals();
}
function closeBatchPay() { M.batchPayModal = null; render(); }

function _renderBatchPreview() {
  const mo  = M.batchPayModal;
  const el  = document.getElementById('bp_preview'); if (!el) return;
  const pending = S.transactions.filter(t=>t.clientId===mo.clientId&&t.status===TX_STATUS.UNPAID).sort((a,b)=>a.date.localeCompare(b.date));
  const amt = mo.method === 'mixed' ? (mo.mixCash||0)+(mo.mixTransfer||0) : (mo.amount||0);
  if (amt <= 0) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  let remain = amt;
  const rows = [];
  for (const t of pending) {
    if (remain <= 0) break;
    const due   = _txRemain(t);
    const apply = Math.min(due, remain);
    remain -= apply;
    rows.push(`<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:12px;">
      <span style="color:#64748b;">${esc(t.date)} ${esc(t.memo?.slice(0,10)||'')}</span>
      <span>${fmtW(apply)} ${apply>=due?'<span style="color:#16a34a;">→ 완납 ✅</span>':`<span style="color:#b45309;">→ 잔여 ${fmtW(due-apply)}</span>`}</span>
    </div>`);
  }
  const afterTotal = pending.reduce((s,t)=>s+_txRemain(t),0)-Math.min(amt,pending.reduce((s,t)=>s+_txRemain(t),0));
  rows.push(`<div style="display:flex;justify-content:space-between;padding:7px 0;font-size:12px;font-weight:600;"><span style="color:#64748b;">입금 후 잔여 미수금</span><span style="color:${afterTotal>0?'#b45309':'#16a34a'};">${fmtW(afterTotal)}</span></div>`);
  el.innerHTML = rows.join('');
}

function buildBatchPayModal() {
  const mo      = M.batchPayModal;
  const cl      = S.clients.find(c => c.id === mo.clientId);
  const pending = S.transactions.filter(t=>t.clientId===mo.clientId&&t.status===TX_STATUS.UNPAID).sort((a,b)=>a.date.localeCompare(b.date));
  const totalRemain = pending.reduce((s,t)=>s+_txRemain(t),0);
  const _thisYm     = localDate(new Date()).slice(0,7);
  const carryAmt    = pending.filter(t=>t.date.slice(0,7)<_thisYm).reduce((s,t)=>s+_txRemain(t),0);
  const carryBtn    = carryAmt > 0
    ? `<button onclick="M.batchPayModal.amount=${carryAmt};document.getElementById('bp_amt').value=new Intl.NumberFormat('ko-KR').format(${carryAmt});_renderBatchPreview()" style="padding:5px 9px;border-radius:7px;border:1px solid #fcd34d;background:#fefce8;color:#b45309;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;">⏩ 이월액 ${esc(fmtW(carryAmt))}</button>` : '';
  const quickBtns = [
    { label:`전액 ${fmtW(totalRemain)}`, val:totalRemain },
    ...(totalRemain>=200000?[{label:'절반',val:Math.round(totalRemain/2/1000)*1000}]:[]),
    ...[1000000,500000,300000,200000,100000].filter(v=>v<totalRemain).slice(0,2).map(v=>({label:fmtW(v),val:v})),
  ].slice(0,4).map(b=>`<button onclick="M.batchPayModal.amount=${b.val};document.getElementById('bp_amt').value=new Intl.NumberFormat('ko-KR').format(${b.val});_renderBatchPreview()" style="padding:5px 9px;border-radius:7px;border:1px solid #e2e8f0;background:#f8fafc;color:#475569;font-size:11px;cursor:pointer;white-space:nowrap;">${esc(b.label)}</button>`).join('');

  return `
    <div onclick="closeBatchPay()" style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:50;display:flex;align-items:flex-end;justify-content:center;padding-bottom:env(safe-area-inset-bottom);">
      <div onclick="event.stopPropagation()" style="background:#fff;border-radius:18px 18px 0 0;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 -8px 40px rgba(0,0,0,.18);">
        <div style="width:36px;height:4px;background:#e2e8f0;border-radius:2px;margin:10px auto 0;"></div>
        <div style="padding:16px 18px 0;display:flex;align-items:center;justify-content:space-between;">
          <div><div style="font-weight:700;color:#0f172a;font-size:15px;">💰 일괄 수금</div><div style="color:#64748b;font-size:12px;margin-top:2px;">${esc(cl?.name||'?')} · 미수 ${pending.length}건 · ${fmtW(totalRemain)}</div></div>
          <button onclick="closeBatchPay()" style="background:none;border:none;cursor:pointer;color:#94a3b8;">${I.x}</button>
        </div>
        <div style="padding:16px 18px;">
          <div style="margin-bottom:12px;">
            <div style="font-size:12px;color:#64748b;margin-bottom:6px;">입금액</div>
            <input id="bp_amt" type="text" inputmode="numeric" value="${mo.amount?fmt(mo.amount):''}" placeholder="${fmt(totalRemain)}" style="${ISX}font-size:16px;font-weight:600;" ${FB} oninput="applyAmtFmt(this);M.batchPayModal.amount=parseInt(this.value.replace(/[^0-9]/g,''))||0;_renderBatchPreview()">
            ${carryBtn?`<div style="margin-top:6px;">${carryBtn}</div>`:''}
            <div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;">${quickBtns}</div>
          </div>
          <div style="margin-bottom:12px;"><div style="font-size:12px;color:#64748b;margin-bottom:6px;">결제 수단</div>${_methodTabs(mo.method,'bp')}${_mixedInputs(mo.method,'bp')}</div>
          <div style="font-size:12px;color:#64748b;margin-bottom:6px;">배분 미리보기</div>
          <div id="bp_preview" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;font-size:12px;margin-bottom:14px;display:none;"></div>
          <div style="display:flex;gap:8px;">
            <button onclick="closeBatchPay()" style="flex:1;padding:11px;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;border-radius:10px;font-size:13px;cursor:pointer;">취소</button>
            <button onclick="confirmBatchPay()" style="flex:2;padding:11px;border:none;background:#16a34a;color:#fff;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;">수금 처리</button>
          </div>
        </div>
      </div>
    </div>`;
}

function confirmBatchPay() {
  const mo      = M.batchPayModal;
  const pending = S.transactions.filter(t=>t.clientId===mo.clientId&&t.status===TX_STATUS.UNPAID).sort((a,b)=>a.date.localeCompare(b.date));
  const amt     = mo.method === 'mixed' ? (mo.mixCash||0)+(mo.mixTransfer||0) : (mo.amount||0);
  if (amt <= 0) { showToast('금액을 입력하세요.'); return; }
  const paidAt          = new Date().toISOString();
  const paidMethodDetail = mo.method === 'mixed' ? { cash:mo.mixCash||0, transfer:mo.mixTransfer||0 } : null;
  let remain = amt;
  const updatedTxs = [];
  S.transactions = S.transactions.map(tx => {
    if (pending.find(p=>p.id===tx.id) && remain > 0) {
      const due   = _txRemain(tx);
      const apply = Math.min(due, remain);
      remain -= apply;
      const isFull = apply >= due;
      const next   = { ...tx, paidAmount:(tx.paidAmount||0)+apply, paidAt, paidMethod:mo.method };
      if (paidMethodDetail) next.paidMethodDetail = paidMethodDetail;
      if (isFull) next.status = TX_STATUS.PAID;
      updatedTxs.push(next); return next;
    }
    return tx;
  });
  lsSet('crm_tx', S.transactions);
  if (updatedTxs.length === 1) _saveOneTx(updatedTxs[0]); else saveTX();

  const _napumTxsSnap = updatedTxs.filter(t => t._napumId).map(t => ({ ...t }));
  const _iconSnap     = mo.method === 'transfer' ? '🏦' : mo.method === 'mixed' ? '🔀' : '💵';
  const _countSnap    = updatedTxs.length;

  closeBatchPay();
  showToast(`${_iconSnap} ${_countSnap}건 수금 처리`);

  if (_napumTxsSnap.length > 0) {
    _napumTxsSnap.forEach(t => _napumOwnPatchKeys.add(t._napumId));
    Promise.all(_napumTxsSnap.map(t => _patchNapumOrder(t._napumId, _buildNapumPatch(t))))
      .then(results => {
        const ok   = results.filter(Boolean).length;
        const fail = results.length - ok;
        showToast(fail > 0 ? `📦 납품 관리 ${ok}건 반영 / ⚠️ ${fail}건 실패` : `📦 납품 관리 ${ok}건 반영됨`);
        // 패치 성공한 tx들 즉시 re-fetch해 CRM UI 갱신
        _napumTxsSnap.forEach((t, i) => {
          if (results[i]) _refetchNapumOrderAfterPatch(t._napumId);
          else _napumOwnPatchKeys.delete(t._napumId);
        });
      }).catch(() => {
        _napumTxsSnap.forEach(t => _napumOwnPatchKeys.delete(t._napumId));
        showToast('⚠️ 납품 관리 반영 실패');
      });
  }
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function render() {
  const fid = document.activeElement?.id;
  const ss  = document.activeElement?.selectionStart;
  const se  = document.activeElement?.selectionEnd;

  let content = '';
  if      (S.view === 'dashboard')    { checkDashLock(); content = S.dashLocked ? buildDashLockScreen() : buildDashboard(); }
  else if (S.view === 'clients')      content = buildClients();
  else if (S.view === 'transactions') content = buildTransactions();
  else if (S.view === 'receivables')  content = buildReceivables();

  document.getElementById('app').innerHTML = `
    <aside class="sidebar">${sidebarInner()}</aside>
    <div class="main-col">
      ${buildMobileHeader()}
      <main style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;background:#f1f5f9;">
        <div id="mainContent" class="pad-main" style="max-width:1100px;margin:0 auto;padding:22px 20px;">${content}</div>
      </main>
      ${buildBottomNav()}
    </div>`;

  document.getElementById('modal-root').innerHTML = buildDrawer();
  renderModals();
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus(); try { if (ss != null) el.setSelectionRange(ss, se); } catch {} } }
}

function renderContent() {
  const fid = document.activeElement?.id;
  const ss  = document.activeElement?.selectionStart;
  const se  = document.activeElement?.selectionEnd;
  let html = '';
  if      (S.view === 'clients')      html = buildClients();
  else if (S.view === 'transactions') html = buildTransactions();
  else if (S.view === 'receivables')  html = buildReceivables();
  const mc = document.getElementById('mainContent'); if (mc) mc.innerHTML = html;
  if (fid) { const el = document.getElementById(fid); if (el) { el.focus(); try { if (ss != null) el.setSelectionRange(ss, se); } catch {} } }
}

function renderModals() {
  const root   = document.getElementById('modal-root');
  const drawer = buildDrawer();
  if      (_pinModal)           root.innerHTML = drawer + buildPinModal();
  else if (M.confirm)           root.innerHTML = drawer + buildConfirm();
  else if (M.scanModal)         root.innerHTML = drawer + buildScanModal();
  else if (M.syncModal)         root.innerHTML = drawer + buildSyncModal();
  else if (M.statModal)         root.innerHTML = drawer + buildStatModal();
  else if (M.resetModal)        root.innerHTML = drawer + buildResetModal();
  else if (M.backupModal)       root.innerHTML = drawer + buildBackupModal();
  else if (M.qpModal)           root.innerHTML = drawer + buildQuickPayModal();
  else if (M.batchPayModal)     root.innerHTML = drawer + buildBatchPayModal();
  else if (M.clientModal)       root.innerHTML = drawer + buildClientModal();
  else if (M.txModal)           root.innerHTML = drawer + buildTxModal();
  else                          root.innerHTML = drawer;
}

// ── HANDLERS ─────────────────────────────────────────────────────────────────
function goToClientTx(clientId, isSales) {
  const cl = S.clients.find(c => c.id === clientId);
  S.txSearch      = cl ? cl.name : '';
  S.txTf          = '전체';
  S.txSf          = isSales ? TX_STATUS.UNPAID : TX_STATUS.UNBILLED;
  S.txPeriodMode  = 'all';
  S.txMonth       = '전체';
  S.view          = 'transactions';
  render();
}
// ── DASHBOARD PIN 잠금 시스템 ─────────────────────────────────────────────────
const PIN_KEY      = 'crm_dash_pin';   // localStorage: SHA-256 해시 저장
const PIN_TS_KEY   = 'crm_dash_pin_ts'; // 마지막 인증 시각
const PIN_TIMEOUT  = 5 * 60 * 1000;    // 5분 비활성 시 자동 잠금

function _pinHash(pin) {
  // 간단한 해시 (SHA-256 없이 빠른 djb2 변형)
  let h = 5381;
  for (let i = 0; i < pin.length; i++) h = (h * 33) ^ pin.charCodeAt(i);
  return (h >>> 0).toString(16) + pin.length;
}
function hasDashPin()    { return !!localStorage.getItem(PIN_KEY); }
function checkDashPin(p) { return localStorage.getItem(PIN_KEY) === _pinHash(p); }
function saveDashPin(p)  { localStorage.setItem(PIN_KEY, _pinHash(p)); localStorage.setItem(PIN_TS_KEY, '0'); }
function clearDashPin()  { localStorage.removeItem(PIN_KEY); localStorage.removeItem(PIN_TS_KEY); S.dashLocked = false; }
function _stampPinAuth() { localStorage.setItem(PIN_TS_KEY, Date.now().toString()); }
function _isPinExpired() {
  const ts = parseInt(localStorage.getItem(PIN_TS_KEY) || '0', 10);
  return Date.now() - ts > PIN_TIMEOUT;
}

// 앱 시작 / 뷰 전환 시 PIN 만료 체크
function checkDashLock() {
  if (!hasDashPin()) { S.dashLocked = false; return; }
  if (_isPinExpired()) S.dashLocked = true;
  // 만료 안됐으면 기존 dashLocked 상태 유지 (한번 잠기면 명시적 해제 전까지 유지)
}

// PIN 모달 상태
let _pinModal = null; // null | {mode:'unlock'|'set'|'change'|'remove', step:'input'|'confirm', buf:'', first:''}

function openPinModal(mode) {
  _pinModal = { mode, step: 'input', buf: '', first: '' };
  renderModals();
}
function closePinModal() { _pinModal = null; renderModals(); }

function _pinTitle() {
  const m = _pinModal?.mode;
  if (m === 'unlock') return '🔒 대시보드 잠금 해제';
  if (m === 'set')    return '🔑 PIN 번호 설정';
  if (m === 'change') return _pinModal.step === 'input' ? '🔑 현재 PIN 입력' : '🔑 새 PIN 입력';
  if (m === 'remove') return '🔑 PIN 입력 후 삭제';
  return '';
}
function _pinSubtitle() {
  const { mode, step } = _pinModal;
  if (mode === 'unlock') return '4자리 PIN을 입력하세요';
  if (mode === 'set')    return step === 'input'   ? '사용할 4자리 PIN을 입력하세요' : 'PIN을 한 번 더 입력하세요';
  if (mode === 'change') return step === 'input'   ? '현재 PIN을 입력하세요'         :
                                step === 'new'     ? '새 PIN을 입력하세요'           : '새 PIN을 한 번 더 입력하세요';
  if (mode === 'remove') return 'PIN을 입력하면 잠금이 해제됩니다';
  return '';
}

function _pinPressKey(k) {
  if (!_pinModal) return;
  if (_pinModal.buf.length >= 4) return;
  _pinModal.buf += k;
  renderModals();
  if (_pinModal.buf.length === 4) setTimeout(_pinSubmit, 120);
}
function _pinBackspace() {
  if (!_pinModal) return;
  _pinModal.buf = _pinModal.buf.slice(0, -1);
  renderModals();
}

function _pinSubmit() {
  if (!_pinModal) return;
  const { mode, step, buf, first } = _pinModal;

  if (mode === 'unlock') {
    if (checkDashPin(buf)) {
      _stampPinAuth(); S.dashLocked = false; closePinModal(); render();
      showToast('✅ 잠금이 해제됐습니다');
    } else {
      _pinModal.buf = ''; renderModals(); showToast('❌ PIN이 맞지 않습니다');
    }
    return;
  }
  if (mode === 'remove') {
    if (checkDashPin(buf)) {
      clearDashPin(); closePinModal(); render();
      showToast('🔓 PIN 잠금이 해제됐습니다');
    } else {
      _pinModal.buf = ''; renderModals(); showToast('❌ PIN이 맞지 않습니다');
    }
    return;
  }
  if (mode === 'set') {
    if (step === 'input') {
      _pinModal.first = buf; _pinModal.buf = ''; _pinModal.step = 'confirm'; renderModals();
    } else {
      if (buf === first) {
        saveDashPin(buf); closePinModal(); render(); showToast('🔑 PIN이 설정됐습니다');
      } else {
        _pinModal.buf = ''; _pinModal.step = 'input'; _pinModal.first = '';
        renderModals(); showToast('❌ PIN이 일치하지 않습니다. 다시 입력하세요');
      }
    }
    return;
  }
  if (mode === 'change') {
    if (step === 'input') {
      if (checkDashPin(buf)) {
        _pinModal.step = 'new'; _pinModal.buf = ''; renderModals();
      } else {
        _pinModal.buf = ''; renderModals(); showToast('❌ PIN이 맞지 않습니다');
      }
    } else if (step === 'new') {
      _pinModal.first = buf; _pinModal.buf = ''; _pinModal.step = 'confirm'; renderModals();
    } else {
      if (buf === first) {
        saveDashPin(buf); closePinModal(); render(); showToast('🔑 PIN이 변경됐습니다');
      } else {
        _pinModal.buf = ''; _pinModal.step = 'new'; _pinModal.first = '';
        renderModals(); showToast('❌ PIN이 일치하지 않습니다. 다시 입력하세요');
      }
    }
  }
}

function buildPinModal() {
  const { buf } = _pinModal;
  const dots = [0,1,2,3].map(i =>
    `<div style="width:14px;height:14px;border-radius:50%;background:${i < buf.length ? '#b45309' : '#e2e8f0'};border:2px solid ${i < buf.length ? '#b45309' : '#cbd5e1'};transition:background .15s;"></div>`
  ).join('');
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
  const keyBtns = keys.map(k => {
    if (k === '') return `<div></div>`;
    if (k === '⌫') return `<button onclick="_pinBackspace()" style="background:#f1f5f9;border:none;border-radius:12px;height:60px;font-size:20px;cursor:pointer;color:#475569;">⌫</button>`;
    return `<button onclick="_pinPressKey('${k}')" style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;height:60px;font-size:20px;font-weight:600;cursor:pointer;color:#0f172a;active:background:#fef3c7;">${k}</button>`;
  }).join('');

  return `<div onclick="closePinModal()" style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;display:flex;align-items:flex-end;justify-content:center;">
    <div onclick="event.stopPropagation()" style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:420px;padding:28px 24px 40px;">
      <div style="width:40px;height:4px;background:#e2e8f0;border-radius:2px;margin:0 auto 20px;"></div>
      <div style="text-align:center;font-size:17px;font-weight:700;color:#0f172a;margin-bottom:6px;">${_pinTitle()}</div>
      <div style="text-align:center;font-size:13px;color:#64748b;margin-bottom:24px;">${_pinSubtitle()}</div>
      <div style="display:flex;justify-content:center;gap:16px;margin-bottom:28px;">${dots}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">${keyBtns}</div>
    </div>
  </div>`;
}

function buildDashLockScreen() {
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:16px;padding:40px 24px;text-align:center;">
    <div style="font-size:56px;">🔒</div>
    <div style="font-size:18px;font-weight:700;color:#0f172a;">대시보드가 잠겨 있습니다</div>
    <div style="font-size:13px;color:#64748b;">PIN 번호를 입력하면 내용을 볼 수 있습니다</div>
    <button onclick="openPinModal('unlock')" style="margin-top:8px;padding:13px 36px;background:#b45309;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">🔑 PIN 입력</button>
  </div>`;
}

function setView(v) { S.view = v; render(); }

function setCSearch(v) {
  S.cSearch = v;
  const el = document.getElementById('cListRows');
  if (el) el.innerHTML = _buildCRows(); else renderContent();
}
function setCFilter(v)   { S.cFilter = v; renderContent(); }
function setCGroupFilter(v) { S.cGroupFilter = v; renderContent(); } // ★ v89 납품 그룹 필터
function setCWsFilter(v) { S.cWsFilter = v; renderContent(); }
function setRcvSearch(v) {
  S.rcvSearch = v;
  const el = document.getElementById('rcvListArea');
  if (el) el.innerHTML = _buildRcvSections(); else renderContent();
}
function setRcvPeriod(p) {
  S.rcvPeriod = p;
  // month 선택 시 현재 월로 초기화
  if (p === 'month') {
    const d = new Date();
    S.rcvMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  render();
}
function rcvMonthMove(delta) {
  const [y, m] = S.rcvMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  S.rcvMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  render();
}

function toggleExpand(id) { S.cExpanded = S.cExpanded === id ? null : id; renderContent(); }
function setTxSearch(v) {
  S.txSearch = v;
  const el = document.getElementById('txListRows');
  if (el) el.innerHTML = _buildTxRowsOnly(); else renderContent();
}
function setTxTf(v)       { S.txTf = v; renderContent(); }
function setTxWsFilter(v) { S.txWsFilter = v; renderContent(); }
function setTxSf(v)       { S.txSf = v; renderContent(); }
function setTxMonth(v)    { S.txMonth = v; render(); }
function setTxPeriodMode(mode) {
  S.txPeriodMode = mode;
  if (mode === 'monthly') S.txMonth = thisMonth();
  if (mode === 'daily')   S.txDate  = localDate();
  if (mode === 'weekly')  S.txWeek  = _weekOf(localDate());
  if (mode === 'all')     S.txMonth = '전체';
  render();
}
function openDrawer()  { S.drawerOpen = true;  renderModals(); }
function closeDrawer() { S.drawerOpen = false; renderModals(); }

function openClientModal(x)  { M.clientModal = x === 'add' ? 'add' : S.clients.find(c => c.id === x); _pushModalHistory(); renderModals(); }
function closeClientModal()  { M.clientModal = null; renderModals(); }
function editClient(id)      { openClientModal(id); }

function submitClientModal(existId) {
  existId = existId === 'null' ? null : existId;
  const name = document.getElementById('cf_name')?.value?.trim();
  if (!name) { showToast('거래처명을 입력하세요.'); return; }
  const dupClient = S.clients.find(c => c.name === name && (existId === null || c.id !== existId));
  if (dupClient) { showToast(`"${name}" 이름의 거래처가 이미 존재합니다.`); return; }
  const f = {
    name, bizNo:    document.getElementById('cf_bizNo')?.value?.trim()   || '',
    rep:    document.getElementById('cf_rep')?.value?.trim()    || '',
    phone:  document.getElementById('cf_phone')?.value?.trim()  || '',
    email:  document.getElementById('cf_email')?.value?.trim()  || '',
    address:document.getElementById('cf_address')?.value?.trim()|| '',
    type:   document.getElementById('cf_type')?.value           || '매출처',
    memo:   document.getElementById('cf_memo')?.value?.trim()   || '',
  };
  if (existId !== null) f.id = existId;
  saveClient(f);
}

function confirmDelClient(id) {
  const c = S.clients.find(x => x.id === id);
  M.confirm = { msg:`"${c?.name}"을(를) 삭제하시겠습니까?\n관련 거래 내역도 함께 삭제됩니다.`, okStr:`deleteClient(${id})` };
  M.clientModal = null; _pushModalHistory(); renderModals();
}

function openTxModal(x) { M.txModal = x === 'add' ? 'add' : S.transactions.find(t => t.id === x); _pushModalHistory(); renderModals(); }
function closeTxModal() { M.txModal = null; renderModals(); }
function editTx(id)     { openTxModal(id); }

function _onTxClientInput(val) {
  const matched = S.clients.find(c => c.name === val.trim());
  const hidEl   = document.getElementById('tf_clientId');
  if (hidEl) hidEl.value = matched ? matched.id : '';
}

function submitTxModal(existId) {
  existId = existId === 'null' ? null : existId;
  const dateVal = document.getElementById('tf_date')?.value;
  let clientId  = Number(document.getElementById('tf_clientId')?.value) || 0;
  if (!clientId) {
    const nameVal = (document.getElementById('tf_clientName')?.value || '').trim();
    const matched = S.clients.find(c => c.name === nameVal);
    if (matched) clientId = matched.id;
  }
  const amtRaw = (document.getElementById('tf_amount')?.value || '').replace(/[^0-9]/g, '');
  const taxRaw = (document.getElementById('tf_tax')?.value    || '').replace(/[^0-9]/g, '');
  if (!dateVal)  { showToast('거래일자를 입력하세요.'); return; }
  if (!clientId) { showToast('거래처를 선택하세요.'); return; }
  if (!amtRaw)   { showToast('금액을 입력하세요.'); return; }
  const amount = parseInt(amtRaw) || 0;
  const tax    = parseInt(taxRaw) || 0;
  if (amount < 0 || tax < 0) { showToast('금액은 0 이상이어야 합니다.'); return; }
  if (existId === null) {
    const dupTx = S.transactions.find(t =>
      t.clientId === clientId && t.date === dateVal && t.amount === amount && t.type === (document.getElementById('tf_type')?.value)
    );
    if (dupTx) {
      const cl = S.clients.find(c => c.id === clientId);
      if (!confirm(`"${cl?.name||''}" ${dateVal} ${fmtW(amount)} 동일 거래가 이미 있습니다.\n계속 등록하시겠습니까?`)) return;
    }
  }
  const _origTx = existId !== null ? S.transactions.find(t => t.id === existId) : null;
  const taxType = document.getElementById('tf_taxType')?.value || 'taxable';
  const f = {
    ...(_origTx || {}),
    date: dateVal, clientId,
    type:    document.getElementById('tf_type')?.value,
    amount, tax: taxType === 'exempt' ? 0 : tax,
    taxType,
    memo:    document.getElementById('tf_memo')?.value   || '',
    status:  document.getElementById('tf_status')?.value,
  };
  if (existId !== null) f.id = existId;
  saveTxFn(f);
}

function confirmDelTx(id) {
  M.confirm = { msg:'이 거래를 삭제하시겠습니까?', okStr:`deleteTxFn(${id})` };
  M.txModal = null; _pushModalHistory(); renderModals();
}

function onTxTaxType(type) {
  const hidEl = document.getElementById('tf_taxType');
  if (hidEl) hidEl.value = type;
  const taxEl  = document.getElementById('tf_tax');
  const lblEl  = taxEl?.previousElementSibling || taxEl?.parentElement?.previousElementSibling;
  const btnTax = document.getElementById('tt_taxable');
  const btnExe = document.getElementById('tt_exempt');
  if (type === 'exempt') {
    if (taxEl) { taxEl.value = ''; taxEl.disabled = true; taxEl.style.background = '#f1f5f9'; taxEl.style.color = '#94a3b8'; }
    if (btnTax) { btnTax.style.background = '#f8fafc'; btnTax.style.color = '#94a3b8'; }
    if (btnExe) { btnExe.style.background = '#0369a1'; btnExe.style.color = '#fff'; }
    // 세액 라벨 업데이트
    const label = taxEl?.closest('div')?.previousElementSibling;
    if (label?.tagName === 'LABEL') label.textContent = '세액 (비과세)';
    const amt = parseInt((document.getElementById('tf_amount')?.value || '').replace(/[^0-9]/g, '')) || 0;
    updateTxTotal(amt, 0);
  } else {
    if (taxEl) { taxEl.disabled = false; taxEl.style.background = ''; taxEl.style.color = ''; }
    if (btnTax) { btnTax.style.background = '#d97706'; btnTax.style.color = '#fff'; }
    if (btnExe) { btnExe.style.background = '#f8fafc'; btnExe.style.color = '#94a3b8'; }
    const label = taxEl?.closest('div')?.previousElementSibling;
    if (label?.tagName === 'LABEL') label.textContent = '세액 (자동계산)';
    const amt = parseInt((document.getElementById('tf_amount')?.value || '').replace(/[^0-9]/g, '')) || 0;
    onTxAmt(String(amt));
  }
}
function onTxAmt(val) {
  const n        = parseInt(val.replace(/[^0-9]/g, '')) || 0;
  const taxType  = document.getElementById('tf_taxType')?.value || 'taxable';
  if (taxType === 'exempt') {
    updateTxTotal(n, 0);
    return;
  }
  const tax = Math.round(n * 0.1);
  const tf  = document.getElementById('tf_tax'); if (tf) tf.value = tax ? fmt(tax) : '';
  updateTxTotal(n, tax);
}
function onTxTax(val) {
  const tax = parseInt(val.replace(/[^0-9]/g, '')) || 0;
  const amt = parseInt((document.getElementById('tf_amount')?.value || '').replace(/[^0-9]/g, '')) || 0;
  updateTxTotal(amt, tax);
}
function updateTxTotal(amt, tax) {
  const el = document.getElementById('txTotal'); if (!el) return;
  if (amt > 0) {
    el.style.cssText = 'background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;margin-top:12px;display:flex;justify-content:space-between;align-items:center;';
    el.innerHTML = `<span style="color:#16a34a;font-size:12px;">합계 금액 (공급가+세액)</span><span style="color:#16a34a;font-weight:700;font-size:16px;">${fmtW(amt + tax)}</span>`;
  } else { el.style.cssText = ''; el.innerHTML = ''; }
}
function onTxType(type) {
  const sel = document.getElementById('tf_status'); if (!sel) return;
  sel.innerHTML = (type === '매출' ? [TX_STATUS.UNPAID,TX_STATUS.PAID] : [TX_STATUS.UNBILLED,TX_STATUS.BILLED]).map(s => `<option>${esc(s)}</option>`).join('');
}

// ── SWIPE NAVIGATION ──────────────────────────────────────────────────────────
(function () {
  const VIEWS = ['dashboard','clients','transactions','receivables'];
  let tx0 = null, ty0 = null, startTime = null, swiping = false;

  function onStart(e) {
    if (M.clientModal||M.txModal||M.confirm||M.scanModal||M.syncModal||M.qpModal||M.batchPayModal||M.statModal||M.resetModal||M.backupModal||S.drawerOpen) return;
    const t = e.touches ? e.touches[0] : e;
    tx0 = t.clientX; ty0 = t.clientY; startTime = Date.now(); swiping = true;
  }
  function onMove(e) {
    if (!swiping || tx0 === null) return;
    const t  = e.touches ? e.touches[0] : e;
    const dx = t.clientX - tx0, dy = t.clientY - ty0;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) { swiping = false; return; }
    if (Math.abs(dx) > 10) e.preventDefault();
  }
  function onEnd(e) {
    if (!swiping || tx0 === null) { swiping = false; tx0 = null; return; }
    const t  = e.changedTouches ? e.changedTouches[0] : e;
    const dx = t.clientX - tx0, dy = t.clientY - ty0, dt = Date.now() - startTime;
    swiping = false; tx0 = null; ty0 = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) || dt > 400) return;
    const cur  = VIEWS.indexOf(S.view); if (cur === -1) return;
    const next = dx < 0 ? (cur+1 < VIEWS.length ? VIEWS[cur+1] : null) : (cur-1 >= 0 ? VIEWS[cur-1] : null);
    if (!next) return;
    const mc = document.getElementById('mainContent');
    if (mc) {
      const dir = dx < 0 ? -1 : 1;
      mc.style.transition = 'transform .22s ease';
      mc.style.transform  = `translateX(${dir*60}px)`;
      mc.style.opacity    = '0';
      setTimeout(() => {
        setView(next);
        const mc2 = document.getElementById('mainContent');
        if (mc2) {
          mc2.style.transition = 'none';
          mc2.style.transform  = `translateX(${-dir*60}px)`;
          mc2.style.opacity    = '0';
          requestAnimationFrame(() => requestAnimationFrame(() => {
            mc2.style.transition = 'transform .22s ease, opacity .22s ease';
            mc2.style.transform  = 'translateX(0)';
            mc2.style.opacity    = '1';
          }));
        }
      }, 150);
    } else { setView(next); }
  }
  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchmove',  onMove,  { passive: false });
  document.addEventListener('touchend',   onEnd,   { passive: true });
})();

// ── 모달 히스토리 ──────────────────────────────────────────────────────────────
let _modalDepth = 0;
function _pushModalHistory() { _modalDepth++; history.pushState({ modal:true, depth:_modalDepth }, ''); }
function _hasOpenModal() {
  return !!(M.clientModal||M.txModal||M.confirm||M.scanModal||M.syncModal||M.qpModal||M.batchPayModal||M.resetModal||M.statModal||M.backupModal);
}
function _closeTopModal() {
  if (M.resetModal)    { closeResetModal(); return; }
  if (M.confirm)       { M.confirm = null; renderModals(); return; }
  if (M.scanModal)     { closeScanModal(); return; }
  if (M.backupModal)   { closeBackupModal(); return; }
  if (M.qpModal)       { closeQuickPay(); return; }
  if (M.batchPayModal) { closeBatchPay(); return; }
  if (M.txModal)       { closeTxModal(); return; }
  if (M.clientModal)   { closeClientModal(); return; }
  if (M.syncModal)     { closeSyncModal(); return; }
  if (M.statModal)     { M.statModal = null; renderModals(); return; }
}
window.addEventListener('popstate', e => {
  if (_hasOpenModal()) {
    e.preventDefault && e.preventDefault();
    _modalDepth = Math.max(0, _modalDepth - 1);
    _closeTopModal();
    if (_hasOpenModal()) { _modalDepth++; history.pushState({ modal:true, depth:_modalDepth }, ''); }
    else { _modalDepth = 0; history.replaceState({ modal:false, depth:0 }, ''); }
  }
});
function _initHistory() { _modalDepth = 0; history.replaceState({ modal:false, depth:0 }, ''); }

// ── 전역 이벤트 위임 ──────────────────────────────────────────────────────────
document.addEventListener('click', e => {
  const el = e.target.closest('.stat-trigger');
  if (!el) return;
  e.stopPropagation();
  const cn = el.getAttribute('data-cn');
  if (cn) openStatModal(cn);
});

document.addEventListener('dblclick', e => {
  const el = e.target;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.select();
});
(() => {
  let _lastTap = 0, _lastEl = null;
  document.addEventListener('touchend', e => {
    const el  = e.target;
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
    const now = Date.now();
    if (_lastEl === el && now - _lastTap < 400) {
      e.preventDefault(); el.select(); _lastTap = 0; _lastEl = null;
    } else { _lastTap = now; _lastEl = el; }
  }, { passive: false });
})();

// ── INIT ──────────────────────────────────────────────────────────────────────
function _showFatalError(msg) {
  hideSplash();
  const safeMsg = String(msg).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const appEl = document.getElementById('app');
  if (appEl) appEl.innerHTML = `
    <div style="padding:40px 24px;text-align:center;color:#dc2626;">
      <div style="font-size:32px;margin-bottom:12px;">⚠️</div>
      <div style="font-weight:700;margin-bottom:8px;">앱 오류</div>
      <div style="font-size:12px;color:#64748b;word-break:break-all;">${safeMsg}</div>
      <button onclick="location.reload()" style="margin-top:20px;padding:10px 24px;background:#d97706;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">새로고침</button>
    </div>`;
}

window.onerror = function (msg, src, line, col, err) {
  console.error('[onerror]', msg, src, line);
  _showFatalError(msg);
  return false;
};

(async () => {
  try {
    // PIN이 설정되어 있으면 앱 시작 시 무조건 잠금
    if (hasDashPin()) S.dashLocked = true;
    await loadData();
    _initHistory();
    setTimeout(updateSyncBadge, 1000);
  } catch (e) {
    console.error('[INIT] loadData 오류:', e);
    _showFatalError(e?.message || String(e));
  }
})();
