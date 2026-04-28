export function createUI() {
  const menuOverlay = document.getElementById('menuOverlay');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const resultOverlay = document.getElementById('resultOverlay');
  const pauseBadge = document.getElementById('pauseBadge');

  const symbolInput = document.getElementById('symbolInput');
  const timeframeSelect = document.getElementById('timeframeSelect');
  const difficultySelect = document.getElementById('difficultySelect');
  const dataSourceSelect = document.getElementById('dataSourceSelect');

  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const resultTitle = document.getElementById('resultTitle');
  const resultStats = document.getElementById('resultStats');

  const listeners = { onStart: null, onRestart: null };

  function showOnly(name) {
    menuOverlay.classList.toggle('visible', name === 'menu');
    loadingOverlay.classList.toggle('visible', name === 'loading');
    resultOverlay.classList.toggle('visible', name === 'result');
  }

  startBtn.addEventListener('click', () => {
    listeners.onStart?.({
      symbol: symbolInput.value,
      timeframe: timeframeSelect.value,
      difficulty: difficultySelect.value,
      source: dataSourceSelect.value,
    });
  });

  restartBtn.addEventListener('click', () => listeners.onRestart?.());

  return {
    onStart(fn) {
      listeners.onStart = fn;
    },
    onRestart(fn) {
      listeners.onRestart = fn;
    },
    showMenu() {
      showOnly('menu');
    },
    showLoading() {
      showOnly('loading');
    },
    showResult({ title, stats }) {
      resultTitle.textContent = title;
      resultStats.textContent = stats;
      showOnly('result');
    },
    hideOverlays() {
      menuOverlay.classList.remove('visible');
      loadingOverlay.classList.remove('visible');
      resultOverlay.classList.remove('visible');
    },
    setPaused(paused) {
      pauseBadge.classList.toggle('visible', paused);
    },
  };
}
