const state = {
  current: '0',
  previous: '',
  previousDisplay: '',
  operator: null,
  expression: '',
  history: [],
  preChainStack: [], // 연쇄 계산 단계별 직전 상태 스택 (backspace 단계 복원용)
  shouldReset: false,
  afterEquals: false, // = 이후 상태 (백스페이스 무시용)
};

const elCurrent          = document.getElementById('current');
const elExpression       = document.getElementById('expression');
const elHistory          = document.getElementById('history');
const elMonthResult      = document.getElementById('monthResult');
const elMonthResultWrap  = document.getElementById('monthResultWrap');
const elHistoryToolbar   = document.getElementById('historyToolbar');
const elHistoryExpandBtn = document.getElementById('historyExpandBtn');
const elHistoryClearBtn  = document.getElementById('historyClearBtn');

const HISTORY_PREVIEW = 3;
let historyExpanded = false;

function renderHistory() {
  const total = state.history.length;
  const showAll = historyExpanded || total <= HISTORY_PREVIEW;
  const lines = showAll ? state.history : state.history.slice(-HISTORY_PREVIEW);

  elHistory.innerHTML = '';
  lines.forEach((line, i) => {
    const div = document.createElement('div');
    const isLast = (showAll ? i : i + state.history.length - HISTORY_PREVIEW) === total - 1;
    div.className = 'history-line' + (isLast ? ' highlight' : '');
    div.textContent = line;
    elHistory.appendChild(div);
  });
  elHistory.scrollTop = elHistory.scrollHeight;

  // 툴바: 히스토리가 1개 이상일 때만 표시
  elHistoryToolbar.classList.toggle('visible', total > 0);

  // 펼치기 버튼: 3개 초과일 때만 표시, 텍스트 토글
  if (total > HISTORY_PREVIEW) {
    elHistoryExpandBtn.style.display = '';
    elHistoryExpandBtn.textContent = historyExpanded ? '∨ 접기' : `∧ 전체 보기 (${total}개)`;
  } else {
    elHistoryExpandBtn.style.display = 'none';
  }

  elHistory.classList.toggle('expanded', historyExpanded);
}

elHistoryExpandBtn.addEventListener('click', () => {
  historyExpanded = !historyExpanded;
  renderHistory();
});

elHistoryClearBtn.addEventListener('click', () => {
  state.history = [];
  historyExpanded = false;
  renderHistory();
});

function addCommas(str) {
  if (str === 'Error') return str;
  const [integer, decimal] = str.split('.');
  const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimal !== undefined ? `${formatted}.${decimal}` : formatted;
}

function updateDisplay() {
  const displayed = addCommas(state.current);
  elCurrent.textContent = displayed;
  const len = displayed.length;
  const fontSize =
    len <= 8  ? 54 :
    len <= 11 ? 40 :
    len <= 14 ? 30 :
    len <= 17 ? 24 :
    len <= 21 ? 19 : 15;
  elCurrent.style.fontSize = fontSize + 'px';
  // className을 통째로 재설정하지 않음 — 15자리 초과 시 추가된 shake 클래스 보존

  elExpression.textContent = state.expression;
  renderHistory();
  divideByMonth();
  updateTax();
  updateCurrency();
}

function appendNumber(value) {
  if (state.current === 'Error') {
    state.current = '0';
    state.expression = '';
  }

  if (state.shouldReset) {
    state.current = value === '.' ? '0.' : value;
    state.shouldReset = false;
    state.afterEquals = false;
  } else if (value === '.') {
    if (state.current.includes('.')) return;
    state.current += '.';
  } else if (state.current === '0') {
    state.current = value;
  } else {
    if (state.current.length >= 15) {
      elCurrent.classList.add('shake');
      setTimeout(() => elCurrent.classList.remove('shake'), 400);
      return;
    }
    state.current += value;
  }

  if (state.operator) {
    state.expression = `${state.previousDisplay || addCommas(state.previous)} ${state.operator} ${addCommas(state.current)}`;
  } else {
    state.expression = '';
  }
}

function chooseOperator(op) {
  if (state.current === 'Error') return;

  let prevDisplay;
  if (state.operator && !state.shouldReset) {
    state.preChainStack.push({
      previous: state.previous,
      previousDisplay: state.previousDisplay,
      operator: state.operator,
      current: state.current,
    });
    prevDisplay = `(${state.previousDisplay || addCommas(state.previous)} ${state.operator} ${addCommas(state.current)})`;
    calculate(true);
  }

  state.previous = state.current;
  state.previousDisplay = prevDisplay || addCommas(state.current);
  state.operator = op;
  state.shouldReset = true;
  state.expression = `${state.previousDisplay} ${op}`;

  document.querySelectorAll('.btn-operator').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === op);
  });
}

function calculate(chain = false) {
  if (!state.operator || state.previous === '') return;

  const a = parseFloat(state.previous);
  const b = parseFloat(state.current);
  let result;

  switch (state.operator) {
    case '+': result = a + b; break;
    case '-': result = a - b; break;
    case '×': result = a * b; break;
    case '÷': result = b === 0 ? 'Error' : a / b; break;
  }

  const resultStr = result === 'Error' ? 'Error' : formatResult(result);
  const completedLine = `${state.previousDisplay || addCommas(state.previous)} ${state.operator} ${addCommas(state.current)} = ${addCommas(resultStr)}`;
  if (!chain && !state.shouldReset) {
    state.history.push(completedLine);
    if (state.history.length > 100) state.history.shift();
  }
  state.expression = chain ? `${state.previousDisplay || addCommas(state.previous)} ${state.operator} ${addCommas(state.current)} =` : '';

  state.current = resultStr;
  state.previous = '';
  state.previousDisplay = '';
  state.operator = null;
  if (!chain) state.preChainStack = [];  // chain 계산 시엔 스택 유지
  state.shouldReset = !chain;
  state.afterEquals = !chain;

  document.querySelectorAll('.btn-operator').forEach(btn => btn.classList.remove('active'));
}

function formatResult(num) {
  if (!isFinite(num)) return 'Error';
  return parseFloat(num.toPrecision(12)).toString();
}

function clearAll() {
  state.current = '0';
  state.previous = '';
  state.previousDisplay = '';
  state.operator = null;
  state.expression = '';
  state.preChainStack = [];
  state.shouldReset = false;
  state.afterEquals = false;
  elMonthResult.textContent = '-';
  document.querySelectorAll('.btn-operator').forEach(btn => btn.classList.remove('active'));
}

function backspace() {
  if (state.current === 'Error') return;

  // = 누른 직후 → 무시
  if (state.afterEquals) return;

  // "5 +" 대기 상태 (두 번째 숫자 미입력) → 연산자 취소
  if (state.shouldReset && state.operator) {
    if (state.preChainStack.length) {
      // 연쇄 계산이 있었으면 한 단계 직전 상태로 복원 (스택 pop)
      const snap            = state.preChainStack.pop();
      state.previous        = snap.previous;
      state.previousDisplay = snap.previousDisplay;
      state.operator        = snap.operator;
      state.current         = snap.current;
      state.shouldReset     = false;
      state.expression = `${state.previousDisplay || addCommas(state.previous)} ${state.operator} ${addCommas(state.current)}`;
    } else {
      // 단순 연산자 취소
      state.current         = state.previous;
      state.previous        = '';
      state.previousDisplay = '';
      state.operator        = null;
      state.shouldReset     = false;
      state.expression      = '';
      document.querySelectorAll('.btn-operator').forEach(btn => btn.classList.remove('active'));
    }
    return;
  }

  if (state.current.length > 1) {
    // 두 자리 이상 → 마지막 글자 삭제
    state.current = state.current.slice(0, -1);
  } else if (state.operator) {
    // 두 번째 피연산자 한 자리 → "5 +" 대기 상태로 복귀 (연산자 유지)
    state.current = state.previous;
    state.shouldReset = true;
  } else {
    // 단독 한 자리 → 0
    state.current = '0';
  }

  // shouldReset=true 면 연산자만 표시, 아니면 전체 수식 표시
  if (!state.operator) {
    state.expression = '';
  } else if (state.shouldReset) {
    state.expression = `${state.previousDisplay || addCommas(state.previous)} ${state.operator}`;
  } else {
    state.expression = `${state.previousDisplay || addCommas(state.previous)} ${state.operator} ${addCommas(state.current)}`;
  }
}

function percent() {
  if (state.current === 'Error') return;
  state.current = formatResult(parseFloat(state.current) / 100);
  // % 는 현재값을 백분율(1/100)로 변환하는 독립 연산 → 대기 중이던 연산 상태를 정리해
  // 화면 표시(expression)와 내부 상태(operator/previous)의 불일치를 방지
  state.previous = '';
  state.previousDisplay = '';
  state.operator = null;
  state.preChainStack = [];
  state.shouldReset = false;
  state.expression = '';
  document.querySelectorAll('.btn-operator').forEach(btn => btn.classList.remove('active'));
}

function divideByMonth() {
  if (state.current === 'Error') {
    elMonthResult.textContent = '-';
    elMonthResultWrap.dataset.raw = '';
    return;
  }

  let value = parseFloat(state.current);
  if (isNaN(value)) { elMonthResult.textContent = '-'; elMonthResultWrap.dataset.raw = ''; return; }

  if (state.operator && state.previous !== '' && !state.shouldReset) {
    const a = parseFloat(state.previous);
    const b = value;
    switch (state.operator) {
      case '+': value = a + b; break;
      case '-': value = a - b; break;
      case '×': value = a * b; break;
      case '÷': value = b === 0 ? NaN : a / b; break;
    }
    if (isNaN(value)) { elMonthResult.textContent = '-'; elMonthResultWrap.dataset.raw = ''; return; }
  }

  const raw = Math.floor(value / 12).toString();
  elMonthResult.textContent = addCommas(raw);
  elMonthResultWrap.dataset.raw = raw;
  const monthCopyBtn = elMonthResultWrap.querySelector('.copy-btn');
  if (monthCopyBtn) monthCopyBtn.dataset.raw = raw;
}

// ── 세금 계산 ──
let taxType = 'vat';
let customTaxRate = 10;

const elTaxRateBtns  = document.getElementById('taxRateBtns');
const elTaxCustomWrap = document.getElementById('taxCustomWrap');
const elTaxCustomRate = document.getElementById('taxCustomRate');
const elTaxAddRows   = document.getElementById('taxAddRows');
const elTaxSubRows   = document.getElementById('taxSubRows');
const elTaxAddLabel  = document.getElementById('taxAddLabel');
const elTaxSubLabel  = document.getElementById('taxSubLabel');

elTaxRateBtns.addEventListener('click', e => {
  const btn = e.target.closest('.tax-rate-btn');
  if (!btn) return;
  taxType = btn.dataset.tax;
  document.querySelectorAll('.tax-rate-btn').forEach(b => b.classList.toggle('active', b === btn));
  elTaxCustomWrap.classList.toggle('visible', taxType === 'custom');
  updateTax();
});

elTaxCustomRate.addEventListener('input', () => {
  const v = parseFloat(elTaxCustomRate.value);
  if (!isNaN(v) && v > 0) { customTaxRate = v; updateTax(); }
});

function getTaxConfig() {
  switch (taxType) {
    case 'vat':    return { rate: 0.10, parts: null, isVat: true };
    case '33':     return { rate: 0.033, parts: [['소득세 (3%)', 0.03], ['지방소득세 (0.3%)', 0.003]], isVat: false };
    case '88':     return { rate: 0.088, parts: [['소득세 (8%)', 0.08], ['지방소득세 (0.8%)', 0.008]], isVat: false };
    case 'custom': {
      const r = customTaxRate / 100;
      // 소득세 : 지방소득세 = 10 : 1 비율로 분리
      const mainPct  = Math.round(customTaxRate / 1.1 * 10) / 10;
      const localPct = Math.round((customTaxRate - mainPct) * 10) / 10;
      return {
        rate: r,
        parts: [
          [`소득세 (${mainPct}%)`, mainPct / 100],
          [`지방소득세 (${localPct}%)`, localPct / 100],
        ],
        isVat: false,
      };
    }
  }
}

const COPY_ICON = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;

function taxRow(container, label, value, isTotal) {
  const div = document.createElement('div');
  div.className = 'tax-row' + (isTotal ? ' total' : '') + (value === null ? ' dash' : '');
  const raw = value !== null ? formatResult(value) : '';
  const copyBtn = value !== null ? `<button class="copy-btn" data-raw="${raw}" aria-label="복사">${COPY_ICON}</button>` : '';
  div.innerHTML = `<span class="tax-row-label">${label}</span><span class="tax-row-value" data-raw="${raw}">${value !== null ? addCommas(raw) : '—'}${copyBtn}</span>`;
  container.appendChild(div);
}

function renderTaxSection(container, base, cfg, isAddDir) {
  container.innerHTML = '';
  if (base === null) {
    const rows = cfg.parts ? 4 : 3;
    for (let i = 0; i < rows; i++) taxRow(container, '—', null, i === rows - 1);
    return;
  }

  const { rate, parts, isVat } = cfg;

  if (isVat) {
    if (isAddDir) {
      const tax  = Math.floor(base * rate);
      taxRow(container, '공급가액', base, false);
      taxRow(container, '부가세 (10%)', tax, false);
      taxRow(container, '합계', base + tax, true);
    } else {
      const net  = Math.round(base / (1 + rate));
      const tax  = base - net;
      taxRow(container, '합계', base, false);
      taxRow(container, '부가세 (10%)', tax, false);
      taxRow(container, '공급가액', net, true);
    }
  } else {
    const grossLabel = taxType === 'custom' ? '세전 금액' : '총지급액';
    const netLabel   = taxType === 'custom' ? '세후 금액' : '실수령액';

    if (isAddDir) {
      taxRow(container, grossLabel, base, false);
      if (parts) {
        let total = 0;
        parts.forEach(([lbl, r]) => { const a = Math.floor(base * r); total += a; taxRow(container, lbl, a, false); });
        taxRow(container, '합계 세액', total, false);
        taxRow(container, netLabel, base - total, true);
      } else {
        const tax = Math.floor(base * rate);
        taxRow(container, '세액', tax, false);
        taxRow(container, netLabel, base - tax, true);
      }
    } else {
      const gross = Math.round(base / (1 - rate));
      taxRow(container, netLabel, base, false);
      if (parts) {
        // 합계 세액 = 세전 − 세후로 고정하고, 마지막 항목이 잔차를 흡수해
        // 항목 합과 (세전−세후)가 항상 일치하도록 보정
        const totalTax = gross - base;
        let acc = 0;
        parts.forEach(([lbl, r], i) => {
          const a = i === parts.length - 1 ? totalTax - acc : Math.floor(gross * r);
          acc += a;
          taxRow(container, lbl, a, false);
        });
        taxRow(container, '합계 세액', totalTax, false);
        taxRow(container, grossLabel, gross, true);
      } else {
        const tax = gross - base;
        taxRow(container, '세액', tax, false);
        taxRow(container, grossLabel, gross, true);
      }
    }
  }
}

function updateTax() {
  let value = parseFloat(state.current);
  if (isNaN(value) || state.current === 'Error') { value = null; }
  else if (state.operator && state.previous !== '' && !state.shouldReset) {
    const a = parseFloat(state.previous);
    switch (state.operator) {
      case '+': value = a + value; break;
      case '-': value = a - value; break;
      case '×': value = a * value; break;
      case '÷': value = value === 0 ? null : a / value; break;
    }
    if (!isFinite(value)) value = null;
  }
  if (value !== null && value <= 0) value = null;

  const cfg = getTaxConfig();

  const isVat = cfg.isVat;
  elTaxAddLabel.textContent = isVat ? '공급가액 → 합계' : taxType === 'custom' ? '세전 → 세후' : '총지급액 → 실수령액';
  elTaxSubLabel.textContent = isVat ? '합계 → 공급가액' : taxType === 'custom' ? '세후 → 세전' : '실수령액 → 총지급액';

  renderTaxSection(elTaxAddRows, value, cfg, true);
  renderTaxSection(elTaxSubRows, value, cfg, false);
}

// ── 환율 변환 ──
const CURRENCY_META = {
  usd:    { symbol: '$',  label: '1 USD =',   unit: 1,   decimals: 2 },
  jpy:    { symbol: '¥',  label: '100 JPY =', unit: 100, decimals: 0 },
  eur:    { symbol: '€',  label: '1 EUR =',   unit: 1,   decimals: 2 },
  custom: { symbol: '',   label: '1 ? =',     unit: 1,   decimals: 2 },
};

let currencyType = 'usd';
let customCurrencySymbol = '';
let ratesLoaded = false; // API 응답 전까지 변환 결과 숨김

const currencyRates = {
  usd:    parseFloat(localStorage.getItem('calc-rate-usd'))    || 0,
  jpy:    parseFloat(localStorage.getItem('calc-rate-jpy'))    || 0,
  eur:    parseFloat(localStorage.getItem('calc-rate-eur'))    || 0,
  custom: parseFloat(localStorage.getItem('calc-rate-custom')) || 0,
};

const elCurrencyApiStatus  = document.getElementById('currencyApiStatus');
const elCurrencyRefreshBtn = document.getElementById('currencyRefreshBtn');
const elRateTypeBtns       = document.getElementById('rateTypeBtns');
const elRateSelectBtn      = document.getElementById('rateSelectBtn');
const elRateSelectMenu     = document.getElementById('rateSelectMenu');
const elRateSpreadWrap     = document.getElementById('rateSpreadWrap');
const elRateSpreadInput    = document.getElementById('rateSpreadInput');
const elSpreadSignBtn      = document.getElementById('spreadSignBtn');

// 'standard' | 'cashBuy' | 'cashSell' | 'ttBuy' | 'ttSell' | 'customSpread'
let rateType = localStorage.getItem('calc-rate-type') || 'standard';
let customSpreadPct = parseFloat(localStorage.getItem('calc-rate-spread'));
if (isNaN(customSpreadPct)) customSpreadPct = 0;
let spreadSign = customSpreadPct < 0 ? -1 : 1; // 부호 토글 (모바일 키패드에 - 없음 대응)
let baseApiLabel = '';

const RATE_SPREADS = {
  standard: 1.0,
  cashBuy:  1.0175,
  cashSell: 0.9825,
  ttBuy:    1.01,
  ttSell:   0.99,
};
const RATE_TYPE_LABELS = {
  standard:     '매매기준율',
  cashBuy:      '현금 살 때',
  cashSell:     '현금 팔 때',
  ttBuy:        '송금 보낼 때',
  ttSell:       '송금 받을 때',
  customSpread: '직접 입력',
};

// 현재 환율 종류의 배율 (매매기준율 대비)
function getSpread() {
  if (currencyType === 'custom') return 1.0;
  if (rateType === 'customSpread') return 1 + customSpreadPct / 100;
  return RATE_SPREADS[rateType] ?? 1.0;
}

const elCurrencyBtns       = document.getElementById('currencyBtns');
const elCurrencySymbolWrap = document.getElementById('currencySymbolWrap');
const elCurrencySymbolInput= document.getElementById('currencySymbolInput');
const elCurrencyRateLabel  = document.getElementById('currencyRateLabel');
const elCurrencyRateInput  = document.getElementById('currencyRateInput');
const elCurrFtoKFrom       = document.getElementById('currFtoKFrom');
const elCurrFtoKValue      = document.getElementById('currFtoKValue');
const elCurrKtoFFrom       = document.getElementById('currKtoFFrom');
const elCurrKtoFValue      = document.getElementById('currKtoFValue');

function getCurrencyMeta() {
  if (currencyType === 'custom') {
    const sym = customCurrencySymbol || '?';
    return { symbol: sym, label: `1 ${sym} =`, unit: 1, decimals: 2 };
  }
  return CURRENCY_META[currencyType];
}

function formatForeign(value, decimals) {
  const fixed = parseFloat(value.toFixed(decimals));
  const [int, dec] = fixed.toString().split('.');
  const intFormatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimals > 0 && dec ? `${intFormatted}.${dec.padEnd(decimals, '0')}` : intFormatted;
}

function setCurrencyRow(elFrom, elVal, fromText, toRaw, toDisplay) {
  elFrom.textContent = fromText;
  elVal.textContent = toDisplay;
  elVal.dataset.raw = toRaw;
  // copy btn
  let btn = elVal.querySelector('.copy-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.setAttribute('aria-label', '복사');
    btn.innerHTML = COPY_ICON;
    elVal.appendChild(btn);
  }
  btn.dataset.raw = toRaw;
}

function setCurrencyDash(elFrom, elVal) {
  elFrom.textContent = '—';
  elVal.textContent = '—';
  elVal.dataset.raw = '';
  const btn = elVal.querySelector('.copy-btn');
  if (btn) btn.remove();
}

// ── 한국은행 ECOS 환율 API ──
function toKoreanDate(d) {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function setApiStatus(text, isError = false) {
  elCurrencyApiStatus.textContent = text;
  elCurrencyApiStatus.className = 'currency-api-status' + (isError ? ' error' : '');
}

async function fetchExchangeRates() {
  const proxyUrl = window.EXIM_PROXY_URL;
  if (!proxyUrl) { setApiStatus('환율 직접 입력'); return; }

  elCurrencyRefreshBtn.classList.add('spinning');
  setApiStatus('환율 조회 중…');

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(proxyUrl, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('no data');

    const find = code => data.find(r => r.cur_unit === code);
    const usdItem = find('USD');
    const eurItem = find('EUR');
    const jpyItem = find('JPY(100)');
    if (!usdItem && !eurItem && !jpyItem) throw new Error('no rates');

    const parse = item => item ? parseFloat(String(item.deal_bas_r).replace(/,/g, '')) : null;
    const rates = { usd: parse(usdItem), eur: parse(eurItem), jpy: parse(jpyItem) };

    const timeStr = (usdItem || eurItem || jpyItem)?.time ?? '';
    let label = '한국은행';
    if (timeStr.length === 8) {
      const d = new Date(
        parseInt(timeStr.slice(0, 4)),
        parseInt(timeStr.slice(4, 6)) - 1,
        parseInt(timeStr.slice(6, 8))
      );
      label = `한국은행 ${toKoreanDate(d)} 최초고시`;
    }

    applyApiRates(rates, label);
  } catch (_) {
    setApiStatus('조회 실패 · 직접 입력', true);
    ratesLoaded = true; // 실패해도 직접 입력은 가능하도록 잠금 해제
  } finally {
    elCurrencyRefreshBtn.classList.remove('spinning');
  }
}

function applyApiRates(rates, label) {
  if (rates.usd) { currencyRates.usd = rates.usd; localStorage.setItem('calc-rate-usd', rates.usd); }
  if (rates.eur) { currencyRates.eur = rates.eur; localStorage.setItem('calc-rate-eur', rates.eur); }
  if (rates.jpy) { currencyRates.jpy = rates.jpy; localStorage.setItem('calc-rate-jpy', rates.jpy); }
  ratesLoaded = true;
  baseApiLabel = label;
  setApiStatus(label);
  syncCurrencyUI();
  updateCurrency();
}

elCurrencyRefreshBtn.addEventListener('click', () => fetchExchangeRates());

// 매매기준율 탭
elRateTypeBtns.querySelector('[data-type="standard"]').addEventListener('click', () => {
  setRateType('standard');
  closeRateMenu();
});

// 환율 선택 드롭다운 토글
elRateSelectBtn.addEventListener('click', e => {
  e.stopPropagation();
  elRateSelectMenu.hidden = !elRateSelectMenu.hidden;
});

// 드롭다운 항목 선택
elRateSelectMenu.addEventListener('click', e => {
  const opt = e.target.closest('.rate-select-option');
  if (!opt) return;
  setRateType(opt.dataset.type);
  closeRateMenu();
});

// 바깥 클릭 시 메뉴 닫기
document.addEventListener('click', e => {
  if (!elRateSelectMenu.hidden && !e.target.closest('.rate-select-wrap')) closeRateMenu();
});

function closeRateMenu() {
  elRateSelectMenu.hidden = true;
}

function setRateType(type) {
  rateType = type;
  localStorage.setItem('calc-rate-type', type);
  syncRateTypeUI();
  syncCurrencyUI();
  updateCurrency();
}

function syncRateTypeUI() {
  const isStandard = rateType === 'standard';
  elRateTypeBtns.querySelector('[data-type="standard"]')
    .classList.toggle('active', isStandard);
  elRateSelectBtn.classList.toggle('active', !isStandard);
  elRateSelectBtn.textContent = isStandard
    ? '환율 선택 ▾'
    : `${RATE_TYPE_LABELS[rateType]} ▾`;
  elRateSelectMenu.querySelectorAll('.rate-select-option').forEach(o =>
    o.classList.toggle('active', o.dataset.type === rateType)
  );
  elRateSpreadWrap.classList.toggle('visible', rateType === 'customSpread');
}

// 입력란은 크기(양수)만 받고, 부호는 토글 버튼으로 결정
function applySpreadInput() {
  const mag = Math.abs(parseFloat(elRateSpreadInput.value)) || 0;
  customSpreadPct = spreadSign * mag;
  localStorage.setItem('calc-rate-spread', customSpreadPct);
  syncCurrencyUI();
  updateCurrency();
}

elRateSpreadInput.addEventListener('input', applySpreadInput);

elSpreadSignBtn.addEventListener('click', () => {
  spreadSign = -spreadSign;
  elSpreadSignBtn.textContent = spreadSign < 0 ? '−' : '+';
  applySpreadInput();
});

function syncCurrencyUI() {
  const meta = getCurrencyMeta();
  elCurrencyRateLabel.textContent = meta.label;
  const base = currencyRates[currencyType];
  // 소수점 둘째자리까지 항상 표시 (0이어도 .00 유지)
  elCurrencyRateInput.value = base ? (base * getSpread()).toFixed(2) : '';
  elCurrencySymbolWrap.classList.toggle('visible', currencyType === 'custom');
  document.querySelectorAll('#currencyBtns .tax-rate-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.curr === currencyType)
  );
}

function updateCurrency() {
  // API 아직 미응답 + custom 아닌 경우 → 대시 유지
  if (!ratesLoaded && currencyType !== 'custom') {
    setCurrencyDash(elCurrFtoKFrom, elCurrFtoKValue);
    setCurrencyDash(elCurrKtoFFrom, elCurrKtoFValue);
    return;
  }

  const meta   = getCurrencyMeta();
  const base   = currencyRates[currencyType];
  const rate   = base * getSpread();
  const { symbol, unit, decimals } = meta;

  // 계산기 현재값 (수식 미리보기 포함)
  let value = parseFloat(state.current);
  if (isNaN(value) || state.current === 'Error') { setCurrencyDash(elCurrFtoKFrom, elCurrFtoKValue); setCurrencyDash(elCurrKtoFFrom, elCurrKtoFValue); return; }
  if (state.operator && state.previous !== '' && !state.shouldReset) {
    const a = parseFloat(state.previous);
    switch (state.operator) {
      case '+': value = a + value; break;
      case '-': value = a - value; break;
      case '×': value = a * value; break;
      case '÷': value = value === 0 ? NaN : a / value; break;
    }
  }
  if (!isFinite(value) || value <= 0 || !rate || rate <= 0) {
    setCurrencyDash(elCurrFtoKFrom, elCurrFtoKValue);
    setCurrencyDash(elCurrKtoFFrom, elCurrKtoFValue);
    return;
  }

  // 외화 → 원화: value를 외화(unit단위)로 보고 KRW 계산
  const effectiveRate = rate / unit;                    // KRW per 1 foreign unit
  const fToKResult    = Math.floor(value * effectiveRate);
  const fToKDisplay   = '₩' + addCommas(fToKResult.toString());
  const fromForeign   = symbol + formatForeign(value, decimals);
  setCurrencyRow(elCurrFtoKFrom, elCurrFtoKValue, fromForeign, fToKResult.toString(), fToKDisplay);

  // 원화 → 외화: value를 KRW로 보고 외화 계산
  const kToFResult  = value / effectiveRate;
  const kToFRaw     = kToFResult.toFixed(decimals);
  const kToFDisplay = symbol + formatForeign(kToFResult, decimals);
  const fromKrw     = '₩' + addCommas(Math.floor(value).toString());
  setCurrencyRow(elCurrKtoFFrom, elCurrKtoFValue, fromKrw, kToFRaw, kToFDisplay);
}

elCurrencyBtns.addEventListener('click', e => {
  const btn = e.target.closest('.tax-rate-btn');
  if (!btn) return;
  currencyType = btn.dataset.curr;
  syncCurrencyUI();
  updateCurrency();
});

elCurrencyRateInput.addEventListener('input', () => {
  const v = parseFloat(elCurrencyRateInput.value);
  if (!isNaN(v) && v > 0) {
    const base = v / getSpread();
    currencyRates[currencyType] = base;
    localStorage.setItem(`calc-rate-${currencyType}`, base);
    ratesLoaded = true;
    updateCurrency();
  }
});

elCurrencySymbolInput.addEventListener('input', () => {
  customCurrencySymbol = elCurrencySymbolInput.value.trim();
  elCurrencyRateLabel.textContent = getCurrencyMeta().label;
  updateCurrency();
});

if (customSpreadPct) elRateSpreadInput.value = Math.abs(customSpreadPct);
elSpreadSignBtn.textContent = spreadSign < 0 ? '−' : '+';
syncRateTypeUI();
syncCurrencyUI();
fetchExchangeRates();

// ── 클립보드 복사 ──
function copyToClipboard(raw, btn) {
  if (!raw) return;
  navigator.clipboard.writeText(raw).then(() => {
    btn.innerHTML = '✓';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerHTML = COPY_ICON;
      btn.classList.remove('copied');
    }, 1200);
  });
}

document.addEventListener('click', e => {
  const btn = e.target.closest('.copy-btn');
  if (!btn) return;
  e.stopPropagation();
  const raw = btn.dataset.raw || btn.closest('[data-raw]')?.dataset.raw;
  copyToClipboard(raw, btn);
});

// 월 패널 복사 (wrap 전체 클릭)
document.getElementById('monthResultWrap').addEventListener('click', e => {
  if (e.target.closest('.copy-btn')) return; // copy-btn 자체 클릭은 위에서 처리
  const raw = elMonthResultWrap.dataset.raw;
  const btn = elMonthResultWrap.querySelector('.copy-btn');
  if (btn) copyToClipboard(raw, btn);
});

// 버튼 이벤트
document.querySelector('.buttons').addEventListener('click', e => {
  const btn = e.target.closest('.btn');
  if (!btn) return;

  const { action, value } = btn.dataset;

  switch (action) {
    case 'number':    appendNumber(value); break;
    case 'decimal':   appendNumber('.'); break;
    case 'operator':  chooseOperator(value); break;
    case 'equals':    calculate(); break;
    case 'clear':     clearAll(); break;
    case 'backspace': backspace(); break;
    case 'percent':   percent(); break;
  }

  updateDisplay();
});


// 키보드 → 버튼 매핑
const KEY_TO_BTN = {
  '0':'[data-action="number"][data-value="0"]',
  '1':'[data-action="number"][data-value="1"]',
  '2':'[data-action="number"][data-value="2"]',
  '3':'[data-action="number"][data-value="3"]',
  '4':'[data-action="number"][data-value="4"]',
  '5':'[data-action="number"][data-value="5"]',
  '6':'[data-action="number"][data-value="6"]',
  '7':'[data-action="number"][data-value="7"]',
  '8':'[data-action="number"][data-value="8"]',
  '9':'[data-action="number"][data-value="9"]',
  '.':'[data-action="decimal"]',
  '+':'[data-action="operator"][data-value="+"]',
  '-':'[data-action="operator"][data-value="-"]',
  '*':'[data-action="operator"][data-value="×"]',
  '/':'[data-action="operator"][data-value="÷"]',
  'Enter':'[data-action="equals"]',
  '=':'[data-action="equals"]',
  'Backspace':'[data-action="backspace"]',
  'Escape':'[data-action="clear"]',
  '%':'[data-action="percent"]',
};

const flashTimers = new Map();

function flashBtn(key) {
  const selector = KEY_TO_BTN[key];
  if (!selector) return;
  const btn = document.querySelector(selector);
  if (!btn) return;

  // 기존 타이머 취소 후 재시작 — 빠른 연속 입력 시 깜빡임 방지
  if (flashTimers.has(btn)) clearTimeout(flashTimers.get(btn));
  btn.classList.add('key-active');
  flashTimers.set(btn, setTimeout(() => {
    btn.classList.remove('key-active');
    flashTimers.delete(btn);
  }, 150));
}

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'c') {
      const raw = state.current;
      if (raw && raw !== 'Error') navigator.clipboard.writeText(raw);
    } else if (e.key === 'v') {
      e.preventDefault();
      navigator.clipboard.readText().then(text => {
        const num = text.replace(/,/g, '').trim();
        if (/^\d+(\.\d+)?$/.test(num)) {
          state.current = num;
          state.shouldReset = false;
          state.afterEquals = false;
          state.expression = '';
          updateDisplay();
        }
      });
    }
    return;
  }

  if (e.key >= '0' && e.key <= '9') { appendNumber(e.key); updateDisplay(); }
  else if (e.key === '.')            { appendNumber('.'); updateDisplay(); }
  else if (e.key === '+')            { chooseOperator('+'); updateDisplay(); }
  else if (e.key === '-')            { chooseOperator('-'); updateDisplay(); }
  else if (e.key === '*')            { chooseOperator('×'); updateDisplay(); }
  else if (e.key === '/')            { e.preventDefault(); chooseOperator('÷'); updateDisplay(); }
  else if (e.key === 'Enter' || e.key === '=') { calculate(); updateDisplay(); }
  else if (e.key === 'Backspace')    { backspace(); updateDisplay(); }
  else if (e.key === 'Escape')       { clearAll(); updateDisplay(); }
  else if (e.key === '%')            { percent(); updateDisplay(); }
  else return;
  flashBtn(e.key);
});

updateDisplay();
