/**
 * Background Service Worker
 * 编排扫描：多 frame 注入提取、会话存储、右键选区、角标
 */

import { MSG } from '../shared/messages.js';
import { inlineExtract } from './inline-extract.js';
import { loadPrefs, savePrefs } from '../shared/prefs.js';

const STORAGE_KEY = 'lastScanResult';
const SOURCE_RANK = { field: 4, label: 3, link: 2, text: 1 };
const CONF_RANK = { high: 3, medium: 2, low: 1 };

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

function isRestrictedUrl(url = '') {
  return (
    !url ||
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('devtools://') ||
    url.startsWith('https://chrome.google.com/webstore') ||
    url.startsWith('https://microsoftedge.microsoft.com/addons')
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function mergeItems(parts) {
  const map = new Map();
  let truncated = false;
  let elapsedMs = 0;
  let pageUrl = '';
  let pageTitle = '';
  let scannedAt = new Date().toISOString();
  let frames = 0;

  for (const part of parts) {
    if (!part?.items) continue;
    frames += 1;
    truncated = truncated || Boolean(part.truncated);
    elapsedMs = Math.max(elapsedMs, part.elapsedMs || 0);
    if (part.pageUrl && !pageUrl) pageUrl = part.pageUrl;
    if (part.pageTitle && !pageTitle) pageTitle = part.pageTitle;
    if (part.scannedAt) scannedAt = part.scannedAt;

    for (const item of part.items) {
      const key = `${item.type}|${item.normalized}`;
      const ex = map.get(key);
      if (!ex) {
        map.set(key, { ...item });
        continue;
      }
      ex.count = (ex.count || 1) + (item.count || 1);
      if ((SOURCE_RANK[item.source] || 0) > (SOURCE_RANK[ex.source] || 0)) {
        ex.source = item.source;
        ex.confidence = item.confidence;
      } else if ((CONF_RANK[item.confidence] || 0) > (CONF_RANK[ex.confidence] || 0)) {
        ex.confidence = item.confidence;
      }
    }
  }

  const items = Array.from(map.values()).sort((a, b) => {
    const ca = CONF_RANK[a.confidence] ?? 0;
    const cb = CONF_RANK[b.confidence] ?? 0;
    if (ca !== cb) return cb - ca;
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return String(a.normalized).localeCompare(String(b.normalized));
  });

  const stats = {};
  let highCount = 0;
  let fieldCount = 0;
  for (const i of items) {
    stats[i.type] = (stats[i.type] || 0) + 1;
    if (i.confidence === 'high') highCount += 1;
    if (i.source === 'field' || i.source === 'label') fieldCount += 1;
  }

  let tweetsHarvested = 0;
  let feedScrolled = false;
  for (const part of parts) {
    if (!part) continue;
    tweetsHarvested = Math.max(tweetsHarvested, part.tweetsHarvested || 0);
    feedScrolled = feedScrolled || Boolean(part.feedScrolled);
  }

  return {
    items,
    stats,
    total: items.length,
    highCount,
    fieldCount,
    elapsedMs,
    truncated,
    pageUrl,
    pageTitle,
    scannedAt,
    framesScanned: frames,
    tweetsHarvested,
    feedScrolled,
  };
}

async function injectExtract(tabId, extractOptions, allFrames) {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: Boolean(allFrames) },
    func: inlineExtract,
    args: [extractOptions || {}],
  });
  return (results || []).map((r) => r?.result).filter(Boolean);
}

async function scanTab(tab, prefs, extractOptions = {}) {
  if (!tab?.id) {
    throw new Error('未找到活动标签页');
  }
  if (isRestrictedUrl(tab.url)) {
    throw new Error('当前页面受浏览器保护，无法扫描（如 chrome://、扩展商店等）');
  }

  const isTwitter = /(?:^|\.)(?:x|twitter)\.com/i.test(tab.url || '');
  const options = {
    extraNoise: prefs.extraNoise || [],
    autoScroll: prefs.autoScrollFeeds !== false && isTwitter && !extractOptions.selectionOnly,
    scrollMaxMs: prefs.scrollMaxMs || 18000,
    scrollMaxRounds: prefs.scrollMaxRounds || 55,
    ...extractOptions,
  };

  // X/Twitter 自动滚动时只扫主 frame，避免 iframe 重复滚动
  const allFrames = options.autoScroll ? false : prefs.scanFrames !== false;

  let parts = await injectExtract(tab.id, options, allFrames);
  let merged = mergeItems(parts);

  const wantRetry =
    prefs.retryOnEmpty !== false &&
    !options.selectionOnly &&
    !options.autoScroll &&
    (merged.total === 0 || merged.highCount === 0);

  if (wantRetry) {
    await sleep(450);
    parts = await injectExtract(tab.id, options, prefs.scanFrames !== false);
    const again = mergeItems(parts);
    if (again.total >= merged.total && again.highCount >= merged.highCount) {
      merged = again;
    }
  }

  if (!merged.pageUrl && tab.url) merged.pageUrl = tab.url;
  if (!merged.pageTitle && tab.title) merged.pageTitle = tab.title;

  return merged;
}

async function saveResult(result, tabId) {
  const payload = {
    ...result,
    tabId,
    savedAt: Date.now(),
  };
  await chrome.storage.session.set({ [STORAGE_KEY]: payload });
  await updateBadge(payload);
  return payload;
}

async function getLastResult() {
  const data = await chrome.storage.session.get(STORAGE_KEY);
  return data[STORAGE_KEY] || null;
}

async function clearResult() {
  await chrome.storage.session.remove(STORAGE_KEY);
  await updateBadge(null);
}

async function updateBadge(result) {
  try {
    const n = result?.highCount ?? result?.total ?? 0;
    const text = n > 0 ? (n > 99 ? '99+' : String(n)) : '';
    await chrome.action.setBadgeText({ text });
    await chrome.action.setBadgeBackgroundColor({ color: '#3d9cf0' });
  } catch {
    /* ignore */
  }
}

function ensureContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'ioc-scan-page',
      title: '扫描本页 IOC',
      contexts: ['page', 'frame'],
    });
    chrome.contextMenus.create({
      id: 'ioc-scan-selection',
      title: '从选中文本提取 IOC',
      contexts: ['selection'],
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  ensureContextMenus();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    const prefs = await loadPrefs();
    if (info.menuItemId === 'ioc-scan-selection') {
      const t = tab || (await getActiveTab());
      const result = await scanTab(t, prefs, {
        selectionOnly: true,
        selectedText: info.selectionText || '',
      });
      await saveResult(result, t?.id);
      return;
    }
    if (info.menuItemId === 'ioc-scan-page') {
      const t = tab || (await getActiveTab());
      const result = await scanTab(t, prefs);
      await saveResult(result, t?.id);
    }
  } catch (err) {
    console.warn('[IOC] context menu scan failed', err);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'scan-current-tab') return;
  try {
    const prefs = await loadPrefs();
    const tab = await getActiveTab();
    const result = await scanTab(tab, prefs);
    await saveResult(result, tab?.id);
  } catch (err) {
    console.warn('[IOC] command scan failed', err);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      switch (message?.type) {
        case MSG.SCAN_CURRENT_TAB: {
          const prefs = await loadPrefs();
          const tab = await getActiveTab();
          const result = await scanTab(tab, prefs);
          const saved = await saveResult(result, tab.id);
          sendResponse({ ok: true, data: saved });
          break;
        }
        case MSG.SCAN_SELECTION: {
          const prefs = await loadPrefs();
          const tab = await getActiveTab();
          const result = await scanTab(tab, prefs, {
            selectionOnly: true,
            selectedText: message.selectedText || '',
          });
          const saved = await saveResult(result, tab.id);
          sendResponse({ ok: true, data: saved });
          break;
        }
        case MSG.GET_LAST_RESULT: {
          const data = await getLastResult();
          sendResponse({ ok: true, data });
          break;
        }
        case MSG.CLEAR_RESULT: {
          await clearResult();
          sendResponse({ ok: true, data: null });
          break;
        }
        case MSG.GET_PREFS: {
          const prefs = await loadPrefs();
          sendResponse({ ok: true, data: prefs });
          break;
        }
        case MSG.SAVE_PREFS: {
          const prefs = await savePrefs(message.prefs || {});
          sendResponse({ ok: true, data: prefs });
          break;
        }
        default:
          sendResponse({ ok: false, error: '未知消息类型' });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err?.message || String(err) });
    }
  })();
  return true;
});

ensureContextMenus();
getLastResult().then(updateBadge).catch(() => {});
