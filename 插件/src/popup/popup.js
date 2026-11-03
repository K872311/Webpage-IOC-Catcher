import { MSG } from '../shared/messages.js';
import { IOC_TYPE_LABELS, IOC_TYPE_ORDER } from '../shared/ioc-types.js';
import { loadPrefs, savePrefs } from '../shared/prefs.js';
import {
  toJson,
  toCsv,
  toTxt,
  toStix,
  toMisp,
  downloadText,
  buildFilename,
} from '../shared/exporters.js';

const TYPE_COLORS = {
  domain: 'var(--c-domain)',
  ipv4: 'var(--c-ipv4)',
  ipv6: 'var(--c-ipv6)',
  md5: 'var(--c-md5)',
  sha1: 'var(--c-sha1)',
  sha256: 'var(--c-sha256)',
};

const SOURCE_LABELS = {
  field: '字段',
  label: '标签',
  link: '链接',
  text: '全文',
};

const els = {
  btnScan: document.getElementById('btnScan'),
  btnOptions: document.getElementById('btnOptions'),
  btnCopy: document.getElementById('btnCopy'),
  btnClear: document.getElementById('btnClear'),
  btnExport: document.getElementById('btnExport'),
  exportFormat: document.getElementById('exportFormat'),
  searchInput: document.getElementById('searchInput'),
  typeFilters: document.getElementById('typeFilters'),
  status: document.getElementById('status'),
  list: document.getElementById('list'),
  meta: document.getElementById('meta'),
  pageTitle: document.getElementById('pageTitle'),
  pageUrl: document.getElementById('pageUrl'),
  statTotal: document.getElementById('statTotal'),
  statTime: document.getElementById('statTime'),
  toast: document.getElementById('toast'),
  modePrecise: document.getElementById('modePrecise'),
  modeAll: document.getElementById('modeAll'),
};

/** @type {object|null} */
let lastResult = null;
/** @type {Set<string>} */
let activeTypes = new Set();
let searchQuery = '';
/** @type {'precise'|'all'} */
let viewMode = 'precise';
/** @type {Awaited<ReturnType<typeof loadPrefs>>|null} */
let prefs = null;

function send(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  els.toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    els.toast.classList.add('hidden');
    els.toast.classList.remove('show');
  }, 1600);
}

function setStatus(text, kind = '') {
  els.status.textContent = text;
  els.status.classList.remove('error', 'ok', 'hidden');
  if (kind) els.status.classList.add(kind);
}

function setActionsEnabled(enabled) {
  els.btnCopy.disabled = !enabled;
  els.btnClear.disabled = !enabled;
  els.btnExport.disabled = !enabled;
  els.exportFormat.disabled = !enabled;
}

function isPreciseItem(item) {
  // 精确模式：仅高置信；field/label 若被标成 medium 也不进精确（避免误报）
  if (item.confidence === 'high') return true;
  if (
    (item.source === 'field' || item.source === 'label') &&
    item.confidence !== 'low' &&
    item.confidence !== 'medium'
  ) {
    return true;
  }
  return false;
}

function getModeItems() {
  if (!lastResult?.items) return [];
  if (viewMode === 'all') return lastResult.items;
  return lastResult.items.filter(isPreciseItem);
}

function getFilteredItems() {
  const base = getModeItems();
  const q = searchQuery.trim().toLowerCase();
  return base.filter((item) => {
    if (activeTypes.size > 0 && !activeTypes.has(item.type)) return false;
    if (!q) return true;
    return (
      item.normalized.toLowerCase().includes(q) ||
      item.value.toLowerCase().includes(q) ||
      item.type.includes(q) ||
      (item.source || '').includes(q)
    );
  });
}

function syncModeButtons() {
  els.modePrecise.classList.toggle('active', viewMode === 'precise');
  els.modeAll.classList.toggle('active', viewMode === 'all');
}

function renderFilters() {
  const pool = getModeItems();
  const stats = {};
  for (const i of pool) stats[i.type] = (stats[i.type] || 0) + 1;
  const typesPresent = IOC_TYPE_ORDER.filter((t) => stats[t] > 0);

  els.typeFilters.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = `chip ${activeTypes.size === 0 ? 'active' : ''}`;
  allBtn.textContent = '全部';
  allBtn.addEventListener('click', () => {
    activeTypes = new Set();
    render();
  });
  els.typeFilters.appendChild(allBtn);

  for (const type of typesPresent) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip ${activeTypes.has(type) ? 'active' : ''}`;
    btn.style.setProperty('--chip-color', TYPE_COLORS[type] || 'var(--accent)');
    btn.innerHTML = `${IOC_TYPE_LABELS[type] || type}<span class="count">${stats[type]}</span>`;
    btn.addEventListener('click', () => {
      if (activeTypes.has(type)) activeTypes.delete(type);
      else activeTypes.add(type);
      render();
    });
    els.typeFilters.appendChild(btn);
  }
}

function renderList(items) {
  els.list.innerHTML = '';

  if (!lastResult) {
    els.list.innerHTML = `
      <div class="welcome" id="welcome">
        <p class="welcome-title">v1.4.3</p>
        <ul class="feature-list">
          <li><strong>精确提取</strong> — Securelist 分节 / 多级云域名 / defang</li>
          <li><strong>X/Twitter</strong> — 自动下拉采推文 + <code>[.]</code> defang</li>
          <li><strong>多 frame + Shadow</strong> — 扫描时自动合并</li>
          <li><strong>右键 / Alt+Shift+I</strong> — 选区或快捷扫描</li>
          <li><strong>STIX / MISP</strong> — 底部导出格式可选</li>
          <li><strong>选项</strong> — 噪音域名、默认模式、iframe 开关</li>
        </ul>
        <p class="welcome-hint">打开 demo/sample-iocs.html 后点「扫描」可验证。</p>
      </div>`;
    return;
  }

  if (items.length === 0) {
    const tip =
      viewMode === 'precise'
        ? '精确模式下无结果。可切换「全部」查看全文匹配，或确认页面是否含 SHA256/表格等字段。'
        : '没有匹配的 IOC';
    els.list.innerHTML = `<div class="empty">${tip}</div>`;
    return;
  }

  const frag = document.createDocumentFragment();
  const limit = 500;
  const slice = items.slice(0, limit);

  for (const item of slice) {
    const row = document.createElement('div');
    row.className = 'ioc-item';

    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.style.setProperty('--tag-color', TYPE_COLORS[item.type] || 'var(--accent)');
    tag.textContent = IOC_TYPE_LABELS[item.type] || item.type;

    const value = document.createElement('div');
    value.className = 'ioc-value';
    value.title = `${item.normalized}  [${SOURCE_LABELS[item.source] || item.source}/${item.confidence || ''}]`;
    value.textContent = item.normalized;

    const badge = document.createElement('span');
    const conf =
      item.confidence || (item.source === 'field' || item.source === 'label' ? 'high' : 'low');
    badge.className = `src-badge ${conf}`;
    badge.title = `来源: ${SOURCE_LABELS[item.source] || item.source} · 置信: ${conf}`;
    badge.textContent = SOURCE_LABELS[item.source] || item.source || '—';

    const count = document.createElement('span');
    count.className = 'ioc-count';
    count.textContent = `×${item.count}`;

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn-icon';
    copyBtn.title = '复制';
    copyBtn.textContent = '复制';
    copyBtn.addEventListener('click', async () => {
      const ok = await copyText(item.normalized);
      showToast(ok ? '已复制' : '复制失败');
    });

    row.append(tag, value, badge, count, copyBtn);
    frag.appendChild(row);
  }

  els.list.appendChild(frag);

  if (items.length > limit) {
    const tip = document.createElement('div');
    tip.className = 'empty';
    tip.textContent = `仅显示前 ${limit} 条，导出可包含全部 ${items.length} 条`;
    els.list.appendChild(tip);
  }
}

function renderMeta() {
  if (!lastResult) {
    els.meta.classList.add('hidden');
    return;
  }
  els.meta.classList.remove('hidden');
  els.pageTitle.textContent = lastResult.pageTitle || '(无标题)';
  els.pageTitle.title = lastResult.pageTitle || '';
  els.pageUrl.textContent = lastResult.pageUrl || '';
  els.pageUrl.title = lastResult.pageUrl || '';

  const filtered = getFilteredItems();
  const allTotal = lastResult.total || 0;
  const frames =
    lastResult.framesScanned && lastResult.framesScanned > 1
      ? ` · ${lastResult.framesScanned} frames`
      : '';
  const tweets =
    lastResult.tweetsHarvested > 0 ? ` · ${lastResult.tweetsHarvested} 推文` : '';
  els.statTotal.textContent =
    viewMode === 'precise'
      ? `${filtered.length} 精确 / ${allTotal} 总${frames}${tweets}`
      : filtered.length === allTotal
        ? `${allTotal} 条${frames}${tweets}`
        : `${filtered.length} / ${allTotal} 条${frames}${tweets}`;
  els.statTime.textContent = lastResult.elapsedMs
    ? `${lastResult.elapsedMs} ms`
    : new Date(lastResult.scannedAt || Date.now()).toLocaleTimeString();
}

function render() {
  syncModeButtons();
  renderFilters();
  const items = getFilteredItems();
  renderList(items);
  renderMeta();
  setActionsEnabled(Boolean(getModeItems().length) || Boolean(lastResult?.items?.length));

  if (lastResult) {
    const high =
      lastResult.highCount ??
      lastResult.items.filter(
        (i) => i.confidence === 'high' || i.source === 'field' || i.source === 'label'
      ).length;
    const tip = lastResult.truncated ? '（文本已截断）' : '';
    if (viewMode === 'precise') {
      setStatus(
        `精确模式：${getModeItems().length} 条高置信 IOC（全页匹配 ${lastResult.total}）${tip}`,
        'ok'
      );
    } else {
      setStatus(`全部模式：${lastResult.total} 条（其中高置信 ${high}）${tip}`, 'ok');
    }
  }
}

async function persistMode() {
  if (prefs?.rememberMode === false) return;
  try {
    prefs = await savePrefs({ defaultMode: viewMode });
  } catch {
    /* ignore */
  }
}

async function handleScan() {
  els.btnScan.classList.add('loading');
  els.btnScan.textContent = '扫描中…';
  els.btnScan.disabled = true;
  setStatus('正在提取…若在 X/Twitter 将自动下拉加载推文（约 10–20 秒）');

  try {
    const res = await send(MSG.SCAN_CURRENT_TAB);
    if (!res?.ok) throw new Error(res?.error || '扫描失败');
    lastResult = res.data;
    activeTypes = new Set();
    searchQuery = '';
    els.searchInput.value = '';
    if (prefs?.rememberMode === false) {
      viewMode = prefs?.defaultMode === 'all' ? 'all' : 'precise';
    }
    render();
    const n = getModeItems().length;
    const tw = lastResult.tweetsHarvested
      ? `（采到 ${lastResult.tweetsHarvested} 条推文）`
      : '';
    showToast(n ? `精确命中 ${n} 条${tw}` : `全文 ${lastResult.total} 条，可切「全部」`);
  } catch (err) {
    setStatus(err?.message || String(err), 'error');
    showToast('扫描失败');
  } finally {
    els.btnScan.classList.remove('loading');
    els.btnScan.textContent = '扫描';
    els.btnScan.disabled = false;
  }
}

async function handleCopy() {
  const items = getFilteredItems();
  if (!items.length) return;
  const text = items.map((i) => i.normalized).join('\n');
  const ok = await copyText(text);
  showToast(ok ? `已复制 ${items.length} 条` : '复制失败');
}

async function handleClear() {
  await send(MSG.CLEAR_RESULT);
  lastResult = null;
  activeTypes = new Set();
  searchQuery = '';
  els.searchInput.value = '';
  render();
  setStatus('已清空。点击「扫描」重新提取。');
  setActionsEnabled(false);
  showToast('已清空');
}

function handleExport() {
  const items = getFilteredItems();
  if (!items.length) {
    showToast('没有可导出的数据');
    return;
  }

  const format = els.exportFormat.value;
  let content;
  let mime;
  let ext;

  switch (format) {
    case 'csv':
      content = toCsv(items);
      mime = 'text/csv';
      ext = 'csv';
      break;
    case 'txt':
      content = toTxt(items, { withType: true });
      mime = 'text/plain';
      ext = 'txt';
      break;
    case 'stix':
      content = toStix(lastResult, items);
      mime = 'application/json';
      ext = 'stix.json';
      break;
    case 'misp':
      content = toMisp(lastResult, items);
      mime = 'application/json';
      ext = 'misp.json';
      break;
    case 'json':
    default:
      content = toJson(lastResult, items);
      mime = 'application/json';
      ext = 'json';
      break;
  }

  const filename = buildFilename(lastResult?.pageUrl || '', ext);
  downloadText(filename, content, mime);
  showToast(`已导出 ${items.length} 条`);
}

async function restoreLast() {
  try {
    prefs = await loadPrefs();
    viewMode = prefs.defaultMode === 'all' ? 'all' : 'precise';
    if (prefs.defaultExport) {
      els.exportFormat.value = prefs.defaultExport;
    }
  } catch {
    prefs = null;
  }

  try {
    const res = await send(MSG.GET_LAST_RESULT);
    if (res?.ok && res.data) {
      lastResult = res.data;
      render();
    } else {
      setActionsEnabled(false);
    }
  } catch {
    setActionsEnabled(false);
  }
}

els.btnScan.addEventListener('click', handleScan);
els.btnOptions?.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
els.btnCopy.addEventListener('click', handleCopy);
els.btnClear.addEventListener('click', handleClear);
els.btnExport.addEventListener('click', handleExport);
els.searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value || '';
  render();
});
els.modePrecise.addEventListener('click', () => {
  viewMode = 'precise';
  persistMode();
  render();
});
els.modeAll.addEventListener('click', () => {
  viewMode = 'all';
  persistMode();
  render();
});

restoreLast();
