/** 用户偏好（chrome.storage.local） */

export const PREFS_KEY = 'iocPrefs';

export const DEFAULT_PREFS = Object.freeze({
  /** @type {'precise'|'all'} */
  defaultMode: 'precise',
  /** @type {'json'|'csv'|'txt'|'stix'|'misp'} */
  defaultExport: 'json',
  /** 额外噪音域名（每行一个） */
  extraNoise: [],
  /** 扫描同源 iframe */
  scanFrames: true,
  /** 空结果时短重试 */
  retryOnEmpty: true,
  /** 记住上次查看模式 */
  rememberMode: true,
  /** X/Twitter 扫描时自动下拉加载更多推文 */
  autoScrollFeeds: true,
  /** 自动滚动最长毫秒 */
  scrollMaxMs: 18000,
  /** 自动滚动最大轮数 */
  scrollMaxRounds: 55,
});

/**
 * @returns {Promise<typeof DEFAULT_PREFS & Record<string, unknown>>}
 */
export async function loadPrefs() {
  try {
    const data = await chrome.storage.local.get(PREFS_KEY);
    const raw = data[PREFS_KEY] || {};
    return {
      ...DEFAULT_PREFS,
      ...raw,
      extraNoise: Array.isArray(raw.extraNoise)
        ? raw.extraNoise.map((x) => String(x).trim().toLowerCase()).filter(Boolean)
        : [],
    };
  } catch {
    return { ...DEFAULT_PREFS, extraNoise: [] };
  }
}

/**
 * @param {Partial<typeof DEFAULT_PREFS>} patch
 */
export async function savePrefs(patch) {
  const current = await loadPrefs();
  const next = {
    ...current,
    ...patch,
  };
  if (Array.isArray(patch.extraNoise)) {
    next.extraNoise = patch.extraNoise
      .map((x) => String(x).trim().toLowerCase())
      .filter(Boolean);
  }
  await chrome.storage.local.set({ [PREFS_KEY]: next });
  return next;
}
