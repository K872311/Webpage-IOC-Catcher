/** 导出序列化：JSON / CSV / TXT / STIX 2.1 / MISP */

/**
 * @param {object} result 扫描结果
 * @param {Array} items 要导出的 IOC 列表
 */
export function toJson(result, items) {
  const payload = {
    scannedAt: result.scannedAt || new Date().toISOString(),
    pageUrl: result.pageUrl || '',
    pageTitle: result.pageTitle || '',
    total: items.length,
    stats: summarize(items),
    framesScanned: result.framesScanned || 1,
    items: items.map((i) => ({
      type: i.type,
      value: i.normalized || i.value,
      count: i.count,
      source: i.source,
      confidence: i.confidence || '',
    })),
  };
  return JSON.stringify(payload, null, 2);
}

export function toCsv(items) {
  const header = 'type,value,count,source,confidence';
  const rows = items.map((i) => {
    const value = csvEscape(i.normalized || i.value);
    return `${i.type},${value},${i.count || 1},${i.source || 'text'},${i.confidence || ''}`;
  });
  return [header, ...rows].join('\n');
}

export function toTxt(items, { withType = true } = {}) {
  return items
    .map((i) => {
      const v = i.normalized || i.value;
      return withType ? `${i.type}\t${v}` : v;
    })
    .join('\n');
}

/** STIX 2.1 bundle（indicator + observed-data 简化） */
export function toStix(result, items) {
  const now = result.scannedAt || new Date().toISOString();
  const bundleId = `bundle--${uuidish()}`;
  const objects = [];

  for (const item of items) {
    const value = item.normalized || item.value;
    const pattern = stixPattern(item.type, value);
    if (!pattern) continue;
    const id = `indicator--${uuidish()}`;
    objects.push({
      type: 'indicator',
      spec_version: '2.1',
      id,
      created: now,
      modified: now,
      name: `${item.type}: ${value}`,
      pattern,
      pattern_type: 'stix',
      valid_from: now,
      confidence: confidenceScore(item.confidence),
      labels: ['ioc-collector', item.source || 'text', item.confidence || 'low'].filter(Boolean),
      external_references: result.pageUrl
        ? [{ source_name: 'page', url: result.pageUrl }]
        : [],
    });
  }

  return JSON.stringify(
    {
      type: 'bundle',
      id: bundleId,
      objects,
    },
    null,
    2
  );
}

/** MISP 事件 JSON（Attribute 列表） */
export function toMisp(result, items) {
  const now = Math.floor(Date.now() / 1000);
  const attrs = items
    .map((item) => {
      const type = mispType(item.type);
      if (!type) return null;
      return {
        type,
        category: mispCategory(item.type),
        value: item.normalized || item.value,
        to_ids: true,
        comment: `source=${item.source || 'text'}; confidence=${item.confidence || ''}; count=${item.count || 1}`,
      };
    })
    .filter(Boolean);

  return JSON.stringify(
    {
      Event: {
        info: result.pageTitle
          ? `IOC from: ${result.pageTitle}`
          : `IOC export ${new Date().toISOString()}`,
        date: new Date().toISOString().slice(0, 10),
        timestamp: String(now),
        publish_timestamp: String(now),
        threat_level_id: '2',
        analysis: '1',
        distribution: '0',
        Attribute: attrs,
        Tag: [{ name: 'ioc-collector' }],
        ...(result.pageUrl ? { references: [result.pageUrl] } : {}),
      },
    },
    null,
    2
  );
}

function stixPattern(type, value) {
  const v = String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  switch (type) {
    case 'domain':
      return `[domain-name:value = '${v}']`;
    case 'ipv4':
      return `[ipv4-addr:value = '${v}']`;
    case 'ipv6':
      return `[ipv6-addr:value = '${v}']`;
    case 'md5':
      return `[file:hashes.MD5 = '${v}']`;
    case 'sha1':
      return `[file:hashes.'SHA-1' = '${v}']`;
    case 'sha256':
      return `[file:hashes.'SHA-256' = '${v}']`;
    default:
      return null;
  }
}

function mispType(type) {
  switch (type) {
    case 'domain':
      return 'domain';
    case 'ipv4':
      return 'ip-dst';
    case 'ipv6':
      return 'ip-dst';
    case 'md5':
      return 'md5';
    case 'sha1':
      return 'sha1';
    case 'sha256':
      return 'sha256';
    default:
      return null;
  }
}

function mispCategory(type) {
  if (type === 'domain' || type === 'ipv4' || type === 'ipv6') return 'Network activity';
  return 'Payload delivery';
}

function confidenceScore(c) {
  if (c === 'high') return 90;
  if (c === 'medium') return 60;
  return 30;
}

function uuidish() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function summarize(items) {
  const stats = {};
  for (const i of items) {
    stats[i.type] = (stats[i.type] || 0) + 1;
  }
  return stats;
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * 在浏览器中触发下载
 */
export function downloadText(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildFilename(pageUrl, ext) {
  let host = 'page';
  try {
    host = new URL(pageUrl).hostname.replace(/[^\w.-]/g, '_') || 'page';
  } catch {
    // keep default
  }
  const ts = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
  return `ioc-${host}-${ts}.${ext}`;
}
