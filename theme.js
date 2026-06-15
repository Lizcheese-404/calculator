const THEMES = [
  { id: 'purple', label: '퍼플',   color: '#7c6aff', light: '#a594ff', glow: 'rgba(124,106,255,0.35)' },
  { id: 'blue',   label: '블루',   color: '#3b82f6', light: '#7cb3fa', glow: 'rgba(59,130,246,0.35)'  },
  { id: 'cyan',   label: '시안',   color: '#06b6d4', light: '#67e3f9', glow: 'rgba(6,182,212,0.35)'   },
  { id: 'green',  label: '그린',   color: '#10b981', light: '#6ee7b7', glow: 'rgba(16,185,129,0.35)'  },
  { id: 'lime',   label: '라임',   color: '#84cc16', light: '#bef264', glow: 'rgba(132,204,22,0.35)'  },
  { id: 'yellow', label: '옐로우', color: '#f59e0b', light: '#fcd34d', glow: 'rgba(245,158,11,0.35)'  },
  { id: 'orange', label: '오렌지', color: '#f97316', light: '#fdba74', glow: 'rgba(249,115,22,0.35)'  },
  { id: 'rose',   label: '로즈',   color: '#f43f5e', light: '#fda4af', glow: 'rgba(244,63,94,0.35)'   },
  { id: 'pink',   label: '핑크',   color: '#ec4899', light: '#f9a8d4', glow: 'rgba(236,72,153,0.35)'  },
  { id: 'indigo', label: '인디고', color: '#6366f1', light: '#a5b4fc', glow: 'rgba(99,102,241,0.35)'  },
  // 무채색: 모드별 회색은 style.css가 [data-theme="mono"]로 정의. applyTheme이 인라인을 제거해 캐스케이드 적용.
  { id: 'mono',   label: '무채색', color: '#8a8a8a', light: '#a3a3a3', glow: 'rgba(138,138,138,0.18)', mono: true },
];

const root         = document.documentElement;
const settingsBtn  = document.getElementById('settingsBtn');
const themePanel   = document.getElementById('themePanel');
const themeBackdrop = document.getElementById('themeBackdrop');
const themeClose   = document.getElementById('themeClose');
const swatchContainer = document.getElementById('swatches');
const modeDarkBtn  = document.getElementById('modeDark');
const modeLightBtn = document.getElementById('modeLight');

let currentMode  = localStorage.getItem('calc-mode')  || 'light';
let currentTheme = localStorage.getItem('calc-theme') || 'mono';

function applyTheme(themeId) {
  const t = THEMES.find(t => t.id === themeId);
  if (!t) return;
  currentTheme = themeId;
  localStorage.setItem('calc-theme', themeId);
  root.setAttribute('data-theme', themeId);
  if (t.mono) {
    // 무채색: 인라인 제거 → CSS [data-theme="mono"] / [data-mode][data-theme="mono"]가 모드별 회색 적용
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-light');
    root.style.removeProperty('--accent-glow');
  } else {
    root.style.setProperty('--accent',       t.color);
    root.style.setProperty('--accent-light', t.light);
    root.style.setProperty('--accent-glow',  t.glow);
  }
  document.querySelectorAll('.swatch').forEach(s =>
    s.classList.toggle('active', s.dataset.theme === themeId)
  );
}

function applyMode(mode) {
  currentMode = mode;
  localStorage.setItem('calc-mode', mode);
  root.setAttribute('data-mode', mode);
  modeDarkBtn.classList.toggle('active',  mode === 'dark');
  modeLightBtn.classList.toggle('active', mode === 'light');
}

function openPanel() {
  themePanel.classList.add('visible');
  themeBackdrop.classList.add('visible');
  settingsBtn.classList.add('open');
}

function closePanel() {
  themePanel.classList.remove('visible');
  themeBackdrop.classList.remove('visible');
  settingsBtn.classList.remove('open');
}

// 스와치 생성
THEMES.forEach(t => {
  const btn = document.createElement('button');
  btn.className = 'swatch';
  btn.dataset.theme = t.id;
  btn.style.background = t.color;
  btn.title = t.label;
  btn.setAttribute('aria-label', t.label + ' 테마');
  btn.addEventListener('click', () => applyTheme(t.id));
  swatchContainer.appendChild(btn);
});

settingsBtn.addEventListener('click', () =>
  themePanel.classList.contains('visible') ? closePanel() : openPanel()
);
themeClose.addEventListener('click', closePanel);
themeBackdrop.addEventListener('click', closePanel);
modeDarkBtn.addEventListener('click',  () => applyMode('dark'));
modeLightBtn.addEventListener('click', () => applyMode('light'));

// 초기 적용
applyMode(currentMode);
applyTheme(currentTheme);
