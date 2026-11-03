/** IOC 提取主流程 */

import { IOC_PATTERNS } from './ioc-patterns.js';
import {
  normalizeIoc,
  isValidIoc,
  refang,
  refangText,
  stripTrailingPunctuation,
  extractHostFromUrl,
  filterNoiseItems,
} from './ioc-normalize.js';
import { ALLOWED_IOC_TYPES } from './ioc-types.js';

const MAX_TEXT_LENGTH = 500_000;

/**
 * 收集页面文本与链接（在 content script 上下文调用）
 */
export function collectPageData(doc = document) {
  const links = [];
  try {
    const anchors = doc.querySelectorAll('a[href]');
    for (const a of anchors) {
      const href = a.getAttribute('href');
      if (!href) continue;
      if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('#')) {
        continue;
      }
      try {
        const abs = new URL(href, doc.baseURI || location.href).href;
        links.push(abs);
      } catch {
        links.push(href);
      }
    }
  } catch {
    // ignore
  }

  let text = '';
  try {
    text = doc.body ? doc.body.innerText || '' : '';
  } catch {
    text = '';
  }

  if (text.length > MAX_TEXT_LENGTH) {
    text = text.slice(0, MAX_TEXT_LENGTH);
  }

  // 链接文本也并入扫描源
  const linkText = links.join('\n');
  const combined = `${text}\n${linkText}`;

  return {
    text: combined,
    links,
    truncated: (doc.body?.innerText || '').length > MAX_TEXT_LENGTH,
    pageUrl: typeof location !== 'undefined' ? location.href : '',
    pageTitle: typeof document !== 'undefined' ? document.title : '',
  };
}

/**
 * 从文本提取 IOC
 * @param {string} text
 * @param {{ source?: 'text'|'link', links?: string[] }} options
 * @returns {import('./ioc-types.js').IocItem[]}
 */
export function extractIocsFromText(text, options = {}) {
  const source = options.source || 'text';
  const map = new Map();
  const now = Date.now();

  function add(type, raw, src = source) {
    if (!ALLOWED_IOC_TYPES.has(type)) return;
    const cleaned = stripTrailingPunctuation(raw);
    const normalized = normalizeIoc(type, cleaned);
    if (!isValidIoc(type, normalized)) return;

    const key = `${type}|${normalized}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    map.set(key, {
      type,
      value: cleaned,
      normalized,
      source: src,
      count: 1,
      firstSeen: now,
    });
  }

  const input = refangText(String(text || ''));

  for (const { type, pattern } of IOC_PATTERNS) {
    // 每次重置 lastIndex
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(input)) !== null) {
      add(type, match[0]);
      // 防止零宽匹配死循环
      if (match.index === pattern.lastIndex) {
        pattern.lastIndex += 1;
      }
    }
  }

  // 从 hash.ext 文件名补提哈希
  const hashFileRe =
    /\b([a-fA-F0-9]{32}|[a-fA-F0-9]{40}|[a-fA-F0-9]{64})\.(?:exe|dll|sys|bin|dat|msi|tmp|scr|apk|jar|zip|rar|7z)\b/gi;
  let hm;
  while ((hm = hashFileRe.exec(input)) !== null) {
    const hex = hm[1];
    if (hex.length === 64) add('sha256', hex);
    else if (hex.length === 40) add('sha1', hex);
    else if (hex.length === 32) add('md5', hex);
  }

  // 从链接中补充 domain / IP（不采集完整 URL）
  if (options.links && Array.isArray(options.links)) {
    for (const link of options.links) {
      const refanged = refang(stripTrailingPunctuation(link));
      if (/^https?:\/\//i.test(refanged)) {
        const host = extractHostFromUrl(refanged);
        if (host) {
          if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
            add('ipv4', host, 'link');
          } else if (host.includes(':')) {
            add('ipv6', host.replace(/^\[|\]$/g, ''), 'link');
          } else {
            add('domain', host, 'link');
          }
        }
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.normalized.localeCompare(b.normalized);
  });
}

/**
 * 从页面数据提取完整结果
 */
export function extractFromPageData(pageData) {
  const started = performance.now?.() ?? Date.now();
  let items = extractIocsFromText(pageData.text, {
    source: 'text',
    links: pageData.links || [],
  });
  items = filterNoiseItems(items, pageData.pageUrl || '');
  const elapsed = Math.round((performance.now?.() ?? Date.now()) - started);

  const stats = {};
  for (const item of items) {
    stats[item.type] = (stats[item.type] || 0) + 1;
  }

  return {
    items,
    stats,
    total: items.length,
    elapsedMs: elapsed,
    truncated: Boolean(pageData.truncated),
    pageUrl: pageData.pageUrl || '',
    pageTitle: pageData.pageTitle || '',
    scannedAt: new Date().toISOString(),
  };
}
