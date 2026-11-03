/** Defang 还原、归一化与校验 */

import {
  COMMON_TLDS,
  EXCLUDED_DOMAINS,
  FILE_EXTENSIONS,
  NOISE_DOMAINS,
  BRAND_NOISE_TLDS,
  CODE_FALSE_LABELS,
} from './ioc-patterns.js';
import {
  HUNTI_NOISE_DOMAINS,
  isHuntiNoiseHost,
  hasBlockedDomainSubstring,
  isPublicIpv4,
  isNavOrTrackingUrl,
} from './ioc-filters.js';

export function refang(text) {
  if (!text) return '';
  return refangText(text).replace(/\s+/g, '');
}

export function refangText(text) {
  if (!text) return '';
  return String(text)
    .replace(/hxxps/gi, 'https')
    .replace(/hxxp/gi, 'http')
    .replace(/fxps/gi, 'https')
    .replace(/fxp/gi, 'http')
    .replace(/\[\.\]|\(\.\)|{\.}/g, '.')
    .replace(/\[:\]|\(:\)|{:}/g, ':')
    .replace(/\[\/\]|\(\/\)|{\/}/g, '/')
    .replace(/\[@\]|\(@\)|{@}/g, '@');
}

export function stripTrailingPunctuation(value) {
  return String(value).replace(/[.,;:!?）)\]\}'"<>]+$/g, '');
}

export function normalizeIoc(type, rawValue) {
  let value = stripTrailingPunctuation(String(rawValue).trim());
  value = refang(value);

  switch (type) {
    case 'domain':
      return value.toLowerCase().replace(/\.$/, '');
    case 'email':
      return value.toLowerCase();
    case 'url':
      return stripTrailingPunctuation(value).replace(/\/+$/, '');
    case 'md5':
    case 'sha1':
    case 'sha256':
      return value.toLowerCase();
    case 'cve':
      return value.toUpperCase();
    case 'ipv4':
    case 'ipv6':
      return value.toLowerCase();
    default:
      return value;
  }
}

function isValidIpv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  return isPublicIpv4(ip);
}

function isValidIpv6(ip) {
  if (!ip.includes(':')) return false;
  if (ip === '::') return true;
  const cleaned = ip.replace(/^\[|\]$/g, '');
  try {
    // eslint-disable-next-line no-new
    new URL(`http://[${cleaned}]/`);
    return true;
  } catch {
    const parts = cleaned.split('::');
    if (parts.length > 2) return false;
    return /^[a-f0-9:.]+$/i.test(cleaned);
  }
}

function getRegistrableHint(domain) {
  const labels = domain.toLowerCase().split('.');
  if (labels.length < 2) return null;

  const tld = labels[labels.length - 1];
  if (FILE_EXTENSIONS.has(tld)) return null;

  const last3 = labels.length >= 3 ? labels.slice(-3).join('.') : null;
  const last2 = labels.slice(-2).join('.');

  if (last3 && COMMON_TLDS.has(last3)) return last3;
  if (COMMON_TLDS.has(last2)) return last2;
  if (COMMON_TLDS.has(tld)) return tld;
  if (tld.startsWith('xn--') && tld.length >= 5) return tld;
  return null;
}

function isNoiseHost(host) {
  const h = (host || '').toLowerCase();
  if (!h) return false;
  if (NOISE_DOMAINS.has(h) || EXCLUDED_DOMAINS.has(h)) return true;
  for (const n of NOISE_DOMAINS) {
    if (h === n || h.endsWith(`.${n}`)) return true;
  }
  if (isHuntiNoiseHost(h, HUNTI_NOISE_DOMAINS)) return true;
  return false;
}

function isValidDomain(domain) {
  if (!domain || domain.length < 4 || domain.length > 253) return false;
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return false;
  if (EXCLUDED_DOMAINS.has(domain)) return false;
  if (isNoiseHost(domain)) return false;
  if (hasBlockedDomainSubstring(domain)) return false;

  const labels = domain.split('.');
  if (labels.length < 2) return false;

  const tld = labels[labels.length - 1].toLowerCase();
  if (FILE_EXTENSIONS.has(tld)) return false;
  if (!getRegistrableHint(domain)) return false;

  for (const label of labels) {
    if (!label || label.length > 63) return false;
    if (!/^[a-z0-9-]+$/i.test(label)) return false;
    if (label.startsWith('-') || label.endsWith('-')) return false;
    // 代码属性链：sys.stdin.read / time.now
    if (CODE_FALSE_LABELS.has(label.toLowerCase())) return false;
  }

  if (/^\d+(\.\d+)+$/.test(domain)) return false;

  const sld = labels[0];
  if (
    labels.length === 2 &&
    /^(?:[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64})$/i.test(sld)
  ) {
    return false;
  }

  if (labels.length === 2 && labels[0].length <= 1) return false;

  // URL 编码残片：2fintel.breakglass.tech（%2F → 2f）
  if (/^(?:2f|3a|2e)[a-z0-9-]+$/i.test(labels[0])) return false;

  // 过短连字符标签：o-r.kr / n-e.kr
  if (labels.length === 2 && /^[a-z]-[a-z]$/i.test(labels[0])) return false;

  // .so 既是 ccTLD 也是动态库：libfoo.so / libfoo.2.7.so
  if (tld === 'so') {
    if (/^lib/i.test(labels[0])) return false;
    if (labels.length >= 3 && /^\d+$/.test(labels[labels.length - 2])) return false;
  }

  // 纯数字开头的两段「年份.扩展」已被 FILE_EXT 拦；再拦 2025.xxx 若 xxx 非 TLD
  if (labels.length === 2 && /^\d{2,4}$/.test(labels[0]) && FILE_EXTENSIONS.has(tld)) {
    return false;
  }

  return true;
}

function isValidUrl(url) {
  try {
    if (isNavOrTrackingUrl(url)) return false;
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    if (!u.hostname) return false;
    if (isNoiseHost(u.hostname)) return false;
    if (u.hostname.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) {
      return isPublicIpv4(u.hostname) || u.hostname.includes(':');
    }
    return isValidDomain(u.hostname);
  } catch {
    return false;
  }
}

function isValidEmail(email) {
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64) return false;
  // 注册商 abuse 邮箱噪音
  if (local === 'abuse' || local === 'postmaster' || local === 'noreply') return false;
  return isValidDomain(domain);
}

function isValidHash(type, value) {
  const lengths = { md5: 32, sha1: 40, sha256: 64 };
  const expected = lengths[type];
  if (!expected || value.length !== expected) return false;
  if (!/^[a-f0-9]+$/i.test(value)) return false;
  if (/^0+$/i.test(value) || /^f+$/i.test(value)) return false;
  return true;
}

export function isValidIoc(type, normalized) {
  if (!normalized) return false;
  switch (type) {
    case 'ipv4':
      return isValidIpv4(normalized);
    case 'ipv6':
      return isValidIpv6(normalized);
    case 'domain':
      return isValidDomain(normalized);
    case 'url':
      return isValidUrl(normalized);
    case 'email':
      return isValidEmail(normalized);
    case 'md5':
    case 'sha1':
    case 'sha256':
      return isValidHash(type, normalized);
    case 'cve':
      return /^CVE-\d{4}-\d{4,7}$/.test(normalized);
    default:
      return false;
  }
}

export function extractHostFromUrl(url) {
  try {
    const u = new URL(refang(url));
    return u.hostname || null;
  } catch {
    return null;
  }
}

export function getPageNoiseDomains(pageUrl) {
  const noise = new Set([...NOISE_DOMAINS, ...HUNTI_NOISE_DOMAINS]);
  if (!pageUrl) return noise;
  try {
    const host = new URL(pageUrl).hostname.toLowerCase();
    if (!host) return noise;
    noise.add(host);
    const labels = host.split('.');
    if (labels.length >= 2) {
      const last2 = labels.slice(-2).join('.');
      const last3 = labels.length >= 3 ? labels.slice(-3).join('.') : null;
      let brand;
      if (last3 && COMMON_TLDS.has(last3)) {
        noise.add(last3);
        brand = labels[labels.length - 3];
      } else {
        noise.add(last2);
        brand = labels[labels.length - 2];
      }
      if (brand) {
        for (const t of BRAND_NOISE_TLDS) {
          noise.add(`${brand}.${t}`);
        }
      }
    }
  } catch {
    // ignore
  }
  return noise;
}

export function getPathTagNames(pageUrl) {
  const tags = new Set();
  if (!pageUrl) return tags;
  try {
    const { pathname } = new URL(pageUrl);
    for (const seg of pathname.split('/')) {
      const s = seg.trim().toLowerCase();
      if (s && /^[a-z0-9-]{3,64}$/i.test(s) && !/^\d+$/.test(s)) {
        tags.add(s);
      }
    }
  } catch {
    // ignore
  }
  return tags;
}

export function filterNoiseItems(items, pageUrl) {
  const noise = getPageNoiseDomains(pageUrl);
  const tags = getPathTagNames(pageUrl);

  return items.filter((item) => {
    if (item.type !== 'domain') return true;

    const host = (item.normalized || '').toLowerCase();
    if (!host) return true;

    for (const n of noise) {
      if (host === n || host.endsWith(`.${n}`)) return false;
    }

    const labels = host.split('.');
    if (labels.length === 2 && tags.has(labels[0])) {
      return false;
    }

    return true;
  });
}
