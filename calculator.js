const state = {
  current: '0',
  previous: '',
  previousDisplay: '', // 표시용 이전 피연산자 (괄호 포함 가능)
  operator: null,
  expression: '',
  history: [],
  shouldReset: false,
};

const elCurrent     = document.getElementById('current');
const elExpression  = document.getElementById('expression');
const elHistory     = document.getElementById('history');
const elMonthResult = document.getElementById('monthResult');

function renderHistory() {
  elHistory.innerHTML = '';
  state.history.forEach((line, i) => {
    const div = document.createElement('div');
    div.className = 'history-line' + (i === state.history.length - 1 ? ' highlight' : '');
    div.textContent = line;
    elHistory.appendChild(div);
  });
  elHistory.scrollTop = elHistory.scrollHeight;
}

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
}

function appendNumber(value) {
  if (state.current === 'Error') {
    state.current = '0';
    state.expression = '';
  }

  if (state.shouldReset) {
    state.current = value === '.' ? '0.' : value;
    state.shouldReset = false;
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
  state.shouldReset = !chain;

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
  state.shouldReset = false;
  elMonthResult.textContent = '-';
  document.querySelectorAll('.btn-operator').forEach(btn => btn.classList.remove('active'));
}

function backspace() {
  if (state.shouldReset || state.current === 'Error') return;
  state.current = state.current.length > 1
    ? state.current.slice(0, -1)
    : '0';
  if (state.operator) {
    state.expression = `${state.previousDisplay || addCommas(state.previous)} ${state.operator} ${addCommas(state.current)}`;
  } else {
    state.expression = '';
  }
}

function percent() {
  if (state.current === 'Error') return;
  state.current = formatResult(parseFloat(state.current) / 100);
  state.expression = '';
}

function divideByMonth() {
  const value = parseFloat(state.current);
  if (state.current === 'Error' || isNaN(value)) {
    elMonthResult.textContent = '-';
    return;
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

document.getElementById('btnMonth').addEventListener('click', divideByMonth);

// 키보드 입력
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
});

updateDisplay();
