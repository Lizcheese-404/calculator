const state = {
  current: '0',
  previous: '',
  previousDisplay: '',
  operator: null,
  expression: '',
  history: [],
  preChain: null,    // 연쇄 계산 직전 상태 (backspace 복원용)
  shouldReset: false,
  afterEquals: false, // = 이후 상태 (백스페이스 무시용)
};

const elCurrent          = document.getElementById('current');
const elExpression       = document.getElementById('expression');
const elHistory          = document.getElementById('history');
const elMonthResult      = document.getElementById('monthResult');
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
  elCurrent.className = 'display-current';

  elExpression.textContent = state.expression;
  renderHistory();
  divideByMonth();
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
    if (state.current.length >= 15) return;
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
    state.preChain = {
      previous: state.previous,
      previousDisplay: state.previousDisplay,
      operator: state.operator,
      current: state.current,
    };
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
  if (!chain && !state.shouldReset) state.history.push(completedLine);
  state.expression = chain ? `${state.previousDisplay || addCommas(state.previous)} ${state.operator} ${addCommas(state.current)} =` : '';

  state.current = resultStr;
  state.previous = '';
  state.previousDisplay = '';
  state.operator = null;
  if (!chain) state.preChain = null;  // chain 계산 시엔 preChain 유지
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
  state.history = [];
  state.preChain = null;
  historyExpanded = false;
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
    if (state.preChain) {
      // 연쇄 계산이 있었으면 그 직전 상태로 복원
      state.previous        = state.preChain.previous;
      state.previousDisplay = state.preChain.previousDisplay;
      state.operator        = state.preChain.operator;
      state.current         = state.preChain.current;
      state.preChain        = null;
      state.shouldReset     = false;
      state.expression = `${state.previousDisplay || addCommas(state.previous)} ${state.operator} ${addCommas(state.current)}`;
    } else {
      // 단순 연산자 취소
      state.current         = state.previous;
      state.previous        = '';
      state.previousDisplay = '';
      state.operator        = null;
      state.shouldReset     = true;
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
  state.expression = '';
}

function divideByMonth() {
  if (state.current === 'Error') { elMonthResult.textContent = '-'; return; }

  let value = parseFloat(state.current);
  if (isNaN(value)) { elMonthResult.textContent = '-'; return; }

  // 수식이 진행 중이면 예상 결과를 미리 계산해 사용
  if (state.operator && state.previous !== '') {
    const a = parseFloat(state.previous);
    const b = value;
    switch (state.operator) {
      case '+': value = a + b; break;
      case '-': value = a - b; break;
      case '×': value = a * b; break;
      case '÷': value = b === 0 ? NaN : a / b; break;
    }
    if (isNaN(value)) { elMonthResult.textContent = '-'; return; }
  }

  elMonthResult.textContent = addCommas(formatResult(value / 12));
}

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
