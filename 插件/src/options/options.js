import { loadPrefs, savePrefs } from '../shared/prefs.js';

const els = {
  defaultMode: document.getElementById('defaultMode'),
  defaultExport: document.getElementById('defaultExport'),
  scanFrames: document.getElementById('scanFrames'),
  retryOnEmpty: document.getElementById('retryOnEmpty'),
  rememberMode: document.getElementById('rememberMode'),
  autoScrollFeeds: document.getElementById('autoScrollFeeds'),
  extraNoise: document.getElementById('extraNoise'),
  btnSave: document.getElementById('btnSave'),
  status: document.getElementById('status'),
};

function setStatus(text, ok = false) {
  els.status.textContent = text;
  els.status.classList.toggle('ok', ok);
}

async function hydrate() {
  const prefs = await loadPrefs();
  els.defaultMode.value = prefs.defaultMode || 'precise';
  els.defaultExport.value = prefs.defaultExport || 'json';
  els.scanFrames.checked = prefs.scanFrames !== false;
  els.retryOnEmpty.checked = prefs.retryOnEmpty !== false;
  els.rememberMode.checked = prefs.rememberMode !== false;
  if (els.autoScrollFeeds) {
    els.autoScrollFeeds.checked = prefs.autoScrollFeeds !== false;
  }
  els.extraNoise.value = (prefs.extraNoise || []).join('\n');
}

els.btnSave.addEventListener('click', async () => {
  try {
    const extraNoise = els.extraNoise.value
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    await savePrefs({
      defaultMode: els.defaultMode.value,
      defaultExport: els.defaultExport.value,
      scanFrames: els.scanFrames.checked,
      retryOnEmpty: els.retryOnEmpty.checked,
      rememberMode: els.rememberMode.checked,
      autoScrollFeeds: els.autoScrollFeeds ? els.autoScrollFeeds.checked : true,
      extraNoise,
    });
    setStatus('已保存', true);
  } catch (err) {
    setStatus(err?.message || '保存失败');
  }
});

hydrate().catch((err) => setStatus(err?.message || '加载失败'));
