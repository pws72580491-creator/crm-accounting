// ── Version ───────────────────────────────────────────────────────────────────
const APP_VERSION = 'v1.5.5';

// ── Sample Data ───────────────────────────────────────────────────────────────
const SAMPLE_CLIENTS = [
  { id:1, name:"삼성전자",   bizNo:"124-81-00998", rep:"이재용", phone:"02-2255-0114",  email:"contact@samsung.com",  address:"서울 강남구 삼성로 129",       type:"매출처", memo:"주요 고객사" },
  { id:2, name:"LG전자",     bizNo:"107-86-14075", rep:"조주완", phone:"02-3777-1114",  email:"contact@lg.com",       address:"서울 영등포구 여의대로 128",    type:"매출처", memo:"" },
  { id:3, name:"현대자동차", bizNo:"119-81-02477", rep:"장재훈", phone:"02-3464-1114",  email:"contact@hyundai.com",  address:"서울 서초구 헌릉로 12",         type:"매입처", memo:"부품 공급업체" },
  { id:4, name:"SK하이닉스", bizNo:"000-00-11000", rep:"곽노정", phone:"031-8061-4114", email:"contact@skhynix.com",  address:"경기도 이천시 부발읍",          type:"매출처", memo:"" },
  { id:5, name:"롯데케미칼", bizNo:"000-00-11001", rep:"황진구", phone:"02-3479-1114",  email:"contact@lottechem.com",address:"서울 중구 을지로 30",           type:"매입처", memo:"원자재 공급" },
];

const SAMPLE_TX = [
  { id:1,  date:"2026-05-20", clientId:1, type:"매출", amount:5500000, tax:550000, memo:"전자부품 납품",      status:"미수금"   },
  { id:2,  date:"2026-05-18", clientId:2, type:"매출", amount:3200000, tax:320000, memo:"소프트웨어 라이선스",status:"수금완료" },
  { id:3,  date:"2026-05-15", clientId:3, type:"매입", amount:2100000, tax:210000, memo:"원자재 구매",        status:"지급완료" },
  { id:4,  date:"2026-05-12", clientId:4, type:"매출", amount:8800000, tax:880000, memo:"반도체 납품",        status:"수금완료" },
  { id:5,  date:"2026-05-10", clientId:5, type:"매입", amount:1500000, tax:150000, memo:"화학원료 구매",      status:"미지급금" },
  { id:6,  date:"2026-05-08", clientId:1, type:"매출", amount:4200000, tax:420000, memo:"유지보수 서비스",    status:"수금완료" },
  { id:7,  date:"2026-05-05", clientId:3, type:"매입", amount:3700000, tax:370000, memo:"설비 부품",          status:"미지급금" },
  { id:8,  date:"2026-04-28", clientId:2, type:"매출", amount:2600000, tax:260000, memo:"컨설팅 서비스",      status:"미수금"   },
  { id:9,  date:"2026-04-20", clientId:4, type:"매출", amount:6100000, tax:610000, memo:"메모리 칩 납품",     status:"수금완료" },
  { id:10, date:"2026-04-15", clientId:5, type:"매입", amount:900000,  tax:90000,  memo:"소모품 구매",        status:"지급완료" },
];

// ── Firebase Config (CRM) ─────────────────────────────────────────────────────
// ⑨ 보안 권고: Firebase 규칙에서 auth 없는 쓰기 차단 + allowedDomains를 배포 도메인으로 제한하세요.
const FB_CFG = {
  apiKey:            "AIzaSyBfSu4_0u_7nSEqo9-HQVKINgF_l59YkE8",
  authDomain:        "crm-accounting-d7bd0.firebaseapp.com",
  projectId:         "crm-accounting-d7bd0",
  storageBucket:     "crm-accounting-d7bd0.firebasestorage.app",
  messagingSenderId: "329588634587",
  appId:             "1:329588634587:web:ebf56826605b7263486dfe",
  measurementId:     "G-H3QX287VM9",
  databaseURL:       "https://crm-accounting-d7bd0-default-rtdb.asia-southeast1.firebasedatabase.app",
};

// ── Firebase Config (납품 관리) ───────────────────────────────────────────────
const NAPUM_FB_CFG = {
  apiKey:            "AIzaSyD9AaPcjjI842XYEz6Man4tgzZmcoFdSHE",
  authDomain:        "test-b1713.firebaseapp.com",
  databaseURL:       "https://test-b1713-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "test-b1713",
  storageBucket:     "test-b1713.firebasestorage.app",
  messagingSenderId: "96408145171",
  appId:             "1:96408145171:web:30a300ff2f7b735d929ee6",
};

// ── Nav Items ─────────────────────────────────────────────────────────────────
const NAV = [
  { k:'dashboard',    label:'대시보드',    icon:null }, // icon은 config.js 로드 후 I에서 참조
  { k:'clients',      label:'거래처 관리', icon:null },
  { k:'transactions', label:'거래 내역',   icon:null },
  { k:'receivables',  label:'채권·채무',   icon:null },
];
const LABELS = {
  dashboard:    '대시보드',
  clients:      '거래처 관리',
  transactions: '거래 내역',
  receivables:  '채권·채무',
};

// ── Status Config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  수금완료: { bg:'#dcfce7', bd:'#86efac', tx:'#16a34a' },
  지급완료: { bg:'#dbeafe', bd:'#93c5fd', tx:'#1d4ed8' },
  미수금:   { bg:'#fef3c7', bd:'#fcd34d', tx:'#b45309' },
  미지급금: { bg:'#fee2e2', bd:'#fca5a5', tx:'#dc2626' },
};

// ── Input Style Constants ─────────────────────────────────────────────────────
const ISX = `background:#fff;border:1px solid #cbd5e1;color:#0f172a;border-radius:8px;padding:8px 12px;width:100%;outline:none;`;
const FB  = `onfocus="this.style.borderColor='#d97706'" onblur="this.style.borderColor='#cbd5e1'"`;

// ── Backup Constants ──────────────────────────────────────────────────────────
const BACKUP_LS_KEY  = 'crm_auto_backups';
const BACKUP_FB_PATH = 'backups';
const BACKUP_MAX     = 10;
