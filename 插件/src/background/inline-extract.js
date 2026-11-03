/**
 * 注入到页面执行的 IOC 提取逻辑（必须自包含，不可引用外部模块）
 * 结合 hunti 过滤规则 + 网页结构化字段（表格列 / Hunt.io /domain/ 链接）
 *
 * @param {{
 *   extraNoise?: string[],
 *   selectionOnly?: boolean,
 *   selectedText?: string,
 *   autoScroll?: boolean,
 *   scrollMaxMs?: number,
 *   scrollMaxRounds?: number,
 * }} [options]
 */

export async function inlineExtract(options = {}) {
  const MAX_TEXT_LENGTH = 500000;
  const started = performance.now();
  const extraNoise = Array.isArray(options?.extraNoise) ? options.extraNoise : [];
  const selectionOnly = Boolean(options?.selectionOnly);
  const selectedTextOpt =
    typeof options?.selectedText === 'string' ? options.selectedText : '';
  const autoScroll = options?.autoScroll !== false;
  const scrollMaxMs = Math.min(60000, Math.max(3000, Number(options?.scrollMaxMs) || 18000));
  const scrollMaxRounds = Math.min(120, Math.max(5, Number(options?.scrollMaxRounds) || 55));

  /** 去掉推文里常见的零宽字符，避免 45[.]61 被拆断 */
  function stripZw(text) {
    return String(text || '').replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g, '');
  }

  function refangValue(text) {
    return stripZw(text)
      .replace(/hxxps/gi, 'https')
      .replace(/hxxp/gi, 'http')
      .replace(/fxps/gi, 'https')
      .replace(/fxp/gi, 'http')
      .replace(/meow/gi, 'http')
      // ASCII / 全角括号 defang：[.] (.) {.} ［.］ 【.】 等
      .replace(
        /(?:\[|\uFF3B|\u3010|\u3014|\(|\{|（|<\s*)\s*(?:\.|\uFF0E|\u2024)\s*(?:\]|\uFF3D|\u3011|\u3015|\)|\}|）|>)/g,
        '.'
      )
      .replace(/\s+dot\s+|\s+DOT\s+/gi, '.')
      .replace(/\[:\]|\(:\)|{:}|（:）|\uFF3B:\uFF3D/g, ':')
      .replace(/\[\/\]|\(\/\)|{\/}/g, '/')
      .replace(/\[@\]|\(@\)|{@}/g, '@')
      .replace(/\u2024|\uFF0E/g, '.')
      .replace(/\s+/g, '');
  }

  function refangText(text) {
    return stripZw(text)
      .replace(/hxxps/gi, 'https')
      .replace(/hxxp/gi, 'http')
      .replace(/fxps/gi, 'https')
      .replace(/fxp/gi, 'http')
      .replace(/meow/gi, 'http')
      .replace(
        /(?:\[|\uFF3B|\u3010|\u3014|\(|\{|（|<\s*)\s*(?:\.|\uFF0E|\u2024)\s*(?:\]|\uFF3D|\u3011|\u3015|\)|\}|）|>)/g,
        '.'
      )
      .replace(/\s+dot\s+|\s+DOT\s+/gi, '.')
      .replace(/\[:\]|\(:\)|{:}|（:）|\uFF3B:\uFF3D/g, ':')
      .replace(/\[\/\]|\(\/\)|{\/}/g, '/')
      .replace(/\[@\]|\(@\)|{@}/g, '@')
      .replace(/\u2024|\uFF0E/g, '.');
  }

  function strip(v) {
    return String(v).replace(/[.,;:!?）)\]\}'"<>]+$/g, '');
  }

  const FILE_EXT = new Set([
    'js', 'mjs', 'cjs', 'css', 'html', 'htm', 'json', 'xml', 'txt', 'pdf', 'md', 'csv',
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'hwp', 'hwpx',
    'docm', 'xlsm', 'xlsb', 'xltm', 'pptm', 'ppsm', 'potm', 'dotm', 'xlam', 'xll', 'ppam',
    'desktop', 'service', 'socket', 'conf', 'do', 'action',
    'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp',
    'mp4', 'mp3', 'zip', 'rar', '7z', 'tar', 'gz', 'iso', 'img', 'dmg',
    'exe', 'dll', 'sys', 'drv', 'bin', 'dat', 'msi', 'msp', 'scr', 'bat', 'cmd',
    'ps1', 'vbs', 'vbe', 'jse', 'lnk', 'tmp', 'temp', 'hdb', 'pdb', 'jar', 'apk',
    'py', 'java', 'c', 'cpp', 'h', 'go', 'rs', 'php', 'rb', 'ts', 'tsx', 'jsx',
    'yml', 'yaml', 'toml', 'ini', 'cfg', 'log', 'bak', 'map', 'woff', 'woff2', 'db', 'sql',
  ]);

  const COMMON_TLDS = new Set([
    'com', 'net', 'org', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'name', 'pro',
    'io', 'co', 'ai', 'app', 'dev', 'tech', 'cloud', 'online', 'site', 'xyz', 'top',
    'vip', 'club', 'store', 'shop', 'blog', 'news', 'media', 'security', 'live',
    'quest', 'bond', 'cfd', 'cyou', 'lol', 'ink', 'one', 'win', 'click', 'link',
    'work', 'wang', 'xin', 'icu', 'fun', 'buzz', 'space', 'website', 'today', 'network',
    'test',
    'cn', 'uk', 'de', 'fr', 'jp', 'kr', 'ru', 'au', 'ca', 'us', 'eu', 'nl', 'br',
    'in', 'sg', 'hk', 'tw', 'me', 'tv', 'cc', 'ws', 'to', 'gg', 'ly', 'sh', 'so',
    'pw', 'tk', 'ml', 'ga', 'cf', 'gq', 'su', 'ua', 'pl', 'it', 'es', 'se', 'no',
    'fi', 'dk', 'ch', 'at', 'be', 'pt', 'ie', 'nz', 'za', 'mx', 'tr', 'il', 'th',
    'vn', 'id', 'ph', 'my', 'bg', 'ro', 'hu', 'cz', 'sk', 'hr', 'rs', 'by', 'kz',
    'bm', 'bs', 'sx', 'cw', 'ai', 'vg', 'ky', 'tc', 'sz', 'ls', 'mu', 'sc', 'cx',
    'gov.cn', 'com.cn', 'net.cn', 'org.cn', 'edu.cn', 'ac.cn',
    'co.uk', 'ac.uk', 'org.uk', 'com.au', 'co.jp', 'or.jp', 'ne.jp', 'co.kr',
    'com.tw', 'com.hk', 'com.sg', 'co.in', 'com.ru', 'com.br',
  ]);

  const EXCLUDED = new Set([
    'localhost', 'example.com', 'example.org', 'example.net', 'test.com',
    'asp.net', 'microsoft.net',
  ]);

  // hunti EXCLUDE_DOMAINS 精简（不含 amazonaws / cloudflare 以免丢 C2）
  // 另含中文情报站/社交/CDN：作页面噪音，避免参考链接进 IOC
  const NOISE = new Set([
    'beian.miit.gov.cn', 'www.beian.gov.cn', 'beian.gov.cn',
    'zz.bdstatic.com', 'hm.baidu.com',
    'github.com', 'gist.github.com', 'githubusercontent.com',
    'twitter.com', 'x.com', 't.co', 'linkedin.com', 'www.linkedin.com',
    'facebook.com', 'youtube.com', 'youtu.be', 'instagram.com', 'reddit.com',
    'google.com', 'googleapis.com', 'gstatic.com', 'gmail.com',
    'w3.org', 'www.w3.org', 'schema.org', 'gmpg.org', 'wikipedia.org',
    'namecheap.com', 'registrar-servers.com', 'freedesktop.org',
    'googletagmanager.com', 'google-analytics.com', 'cdn.jsdelivr.net', 'unpkg.com',
    'cdnjs.cloudflare.com', 'akismet.com', 'wordpress.com',
    'microsoft.com', 'office.com', 'learn.microsoft.com', 'schemas.microsoft.com',
    'apple.com', 'amazon.com', 'medium.com', 'blogspot.com',
    'kaspersky.com', 'kasperskycontenthub.com', 'kasperskypartners.com',
    'securelist.com', 'securelist.ru', 'securelist.lat', 'securelist.com.br',
    'crowdstrike.com', 'sentinelone.com', 'rapid7.com', 'checkpoint.com',
    'thehackernews.com', 'bleepingcomputer.com', 'welivesecurity.com',
    'bit.ly', 'tinyurl.com', 'telegram.me', 't.me', 'pastebin.com',
    'npmjs.com', 'pypi.org', 'docker.com', 'vercel.app', 'netlify.app', 'github.io',
    // 中文威胁情报 / 社交 / 引用站
    'qianxin.com', 'ti.qianxin.com', '360.net', 'ti.360.net',
    'weixin.qq.com', 'mp.weixin.qq.com', 'qq.com',
    'weibo.com', 'service.weibo.com', 'sina.com.cn',
    'secrss.com', 'www.secrss.com',
    'aliyuncs.com', 'aliyun.com', 'alicdn.com',
    // 常见情报/沙箱平台自身域名（页面噪音）
    'virustotal.com', 'www.virustotal.com',
    'abuse.ch', 'urlhaus.abuse.ch', 'bazaar.abuse.ch', 'threatfox.abuse.ch',
    'alienvault.com', 'otx.alienvault.com',
    'misp-project.org', 'circl.lu',
    'any.run', 'app.any.run', 'hybrid-analysis.com', 'www.hybrid-analysis.com',
    'malwarebazaar.com', 'urlscan.io', 'www.urlscan.io',
    'shodan.io', 'www.shodan.io', 'censys.io', 'search.censys.io',
    'greynoise.io', 'viz.greynoise.io',
    'threatbook.cn', 'x.threatbook.com', 's.threatbook.cn',
    'venuseye.com.cn', 'ti.dbappsecurity.com.cn',
    'nsfocus.net', 'nti.nsfocus.com',
  ]);

  for (const n of extraNoise) {
    const h = String(n || '').trim().toLowerCase();
    if (h) NOISE.add(h);
  }

  const CODE_LABELS = new Set([
    'stdin', 'stdout', 'stderr', 'buffer', 'read', 'write', 'now', 'length',
    'prototype', 'tostring', 'valueof', 'constructor',
    // protobuf / gRPC 包路径常见段
    'transport', 'encoding', 'internet', 'grpc', 'grpcservice', 'service',
    'internal', 'impl', 'util', 'utils', 'common', 'config', 'context',
  ]);

  const SUBSTR_BLOCK = [
    '.php', '.aspx', '.jsp', '.asp', '.ashx', '.exe', '.dll', '.sys', '.scr',
    '.jse', '.vbs', '.vbe', '.ps1', '.png', '.jpg', '.css', '.woff',
    '.docm', '.xlsm', '.xlam', '.xll', '.ppam', '.desktop', '.tmp', '.hdb',
    '.length', '.tostring', '.prototype', '.stdin', '.stdout',
    'example.com', 'localhost',
    'comnull', // 奇安信坏链 ti.qianxin.comnull
  ];

  /** 协议名 / 非域名 token */
  const SCHEME_TOKENS = new Set([
    'http', 'https', 'hxxp', 'hxxps', 'ftp', 'sftp', 'ws', 'wss', 'mailto', 'file',
  ]);

  const BRAND_TLDS = [
    'com', 'cn', 'net', 'org', 'io', 'tech', 'xyz', 'online', 'site', 'app', 'dev',
    'co', 'me', 'info', 'pro', 'shop', 'store', 'cloud', 'ru', 'lat', 'br',
  ];

  function isNoiseHost(h) {
    const host = (h || '').toLowerCase();
    if (!host) return false;
    if (NOISE.has(host) || EXCLUDED.has(host)) return true;
    for (const n of NOISE) {
      if (host === n || host.endsWith(`.${n}`)) return true;
    }
    return false;
  }

  function hasBlockedSubstr(d) {
    const s = String(d || '').toLowerCase();
    return SUBSTR_BLOCK.some((p) => s.includes(p));
  }

  function isPublicIp(ip) {
    if (
      ip.startsWith('0.') ||
      ip.startsWith('127.') ||
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      ip.startsWith('169.254.')
    ) {
      return false;
    }
    if (ip.startsWith('172.')) {
      const second = Number(ip.split('.')[1]);
      if (second >= 16 && second <= 31) return false;
    }
    const first = Number(ip.split('.')[0]);
    if (Number.isNaN(first) || first >= 224) return false;
    return true;
  }

  function hasAllowedTld(d) {
    const labels = d.toLowerCase().split('.');
    if (labels.length < 2) return false;
    const tld = labels[labels.length - 1];
    if (FILE_EXT.has(tld)) return false;
    const last2 = labels.slice(-2).join('.');
    const last3 = labels.length >= 3 ? labels.slice(-3).join('.') : null;
    if (last3 && COMMON_TLDS.has(last3)) return true;
    if (COMMON_TLDS.has(last2)) return true;
    if (COMMON_TLDS.has(tld)) return true;
    if (tld.startsWith('xn--') && tld.length >= 5) return true;
    return false;
  }

  /** 云厂商多级 C2（S3 / Azure Websites 等）允许更深标签 */
  const CLOUD_SUFFIXES = [
    'azurewebsites.net',
    'amazonaws.com',
    'cloudfront.net',
    'cloudapp.net',
    'azure.com',
    'windows.net',
    'elasticbeanstalk.com',
  ];

  function isCloudHost(host) {
    const h = String(host || '').toLowerCase();
    return CLOUD_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
  }

  function isDomain(d) {
    if (!d || d.length < 4 || d.length > 253) return false;
    const lower = String(d).toLowerCase();
    if (SCHEME_TOKENS.has(lower)) return false;
    if (lower.includes('null')) return false;
    if (EXCLUDED.has(lower) || isNoiseHost(lower) || hasBlockedSubstr(lower)) return false;
    const labels = lower.split('.');
    if (labels.length < 2) return false;
    if (FILE_EXT.has(labels[labels.length - 1])) return false;
    if (!hasAllowedTld(lower)) return false;
    if (/^\d+(\.\d+)+$/.test(lower)) return false;
    // protobuf 过深包路径；云 C2 放宽到 7 级（如 s3.us-east-1.amazonaws.com）
    if (labels.length >= 5 && !isCloudHost(lower)) return false;
    if (labels.length >= 8) return false;
    if (
      labels.length === 2 &&
      /^(?:[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64})$/i.test(labels[0])
    ) {
      return false;
    }
    if (labels.length === 2 && labels[0].length <= 1) return false;
    if (/^(?:2f|3a|2e)[a-z0-9-]+$/i.test(labels[0])) return false;
    // 过短连字符标签：o-r.jp / n-e.jp 等基础设施根域噪音
    if (labels.length === 2 && /^[a-z]-[a-z]$/i.test(labels[0])) return false;
    if (labels[labels.length - 1] === 'so') {
      if (/^lib/i.test(labels[0])) return false;
      if (labels.length >= 3 && /^\d+$/.test(labels[labels.length - 2])) return false;
    }
    for (const l of labels) {
      if (!l || l.length > 63) return false;
      if (!/^[a-z0-9-]+$/i.test(l)) return false;
      if (l.startsWith('-') || l.endsWith('-')) return false;
      if (CODE_LABELS.has(l) || SCHEME_TOKENS.has(l)) return false;
    }
    return true;
  }

  function isIpv4(ip) {
    const p = ip.split('.').map(Number);
    return (
      p.length === 4 &&
      p.every((n) => !Number.isNaN(n) && n >= 0 && n <= 255) &&
      isPublicIp(ip)
    );
  }

  function isIpv6(ip) {
    if (!ip.includes(':')) return false;
    try {
      // eslint-disable-next-line no-new
      new URL(`http://[${ip.replace(/^\[|\]$/g, '')}]/`);
      return true;
    } catch {
      return /^[a-f0-9:.]+$/i.test(ip) && (ip.match(/:/g) || []).length >= 2;
    }
  }

  function isHash(type, v) {
    const len = { md5: 32, sha1: 40, sha256: 64 }[type];
    return (
      v.length === len &&
      /^[a-f0-9]+$/i.test(v) &&
      !/^0+$/i.test(v) &&
      !/^f+$/i.test(v)
    );
  }

  function isNavUrl(url) {
    const u = String(url || '').toLowerCase();
    if (u.includes('icid=')) return true;
    if (u.includes('/tag/') || u.includes('/category/') || u.includes('/author/')) return true;
    if (u.includes('linkedin.com/sharing') || u.includes('twitter.com/intent')) return true;
    if (u.includes('/wp-content/') || u.includes('/wp-includes/')) return true;
    if (u.includes('/cdn-cgi/') || u.includes('/static/') || u.includes('/assets/')) return true;
    return false;
  }

  /** 收集 document + 开放 Shadow DOM 根，便于扫 Web Component 页面 */
  function collectRoots(doc = document) {
    const roots = [doc];
    const walk = (root) => {
      let nodes;
      try {
        nodes = root.querySelectorAll('*');
      } catch {
        return;
      }
      for (const el of nodes) {
        if (el.shadowRoot) {
          roots.push(el.shadowRoot);
          walk(el.shadowRoot);
        }
      }
    };
    try {
      walk(doc);
    } catch {
      /* ignore */
    }
    return roots;
  }

  function queryAllDeep(selector, doc = document) {
    const out = [];
    for (const root of collectRoots(doc)) {
      try {
        root.querySelectorAll(selector).forEach((el) => out.push(el));
      } catch {
        /* ignore invalid selector in some roots */
      }
    }
    return out;
  }

  /** 仅采集：域名 / IP / MD5 / SHA1 / SHA256（不采集 URL/邮箱/CVE） */
  const ALLOWED_TYPES = new Set(['domain', 'ipv4', 'ipv6', 'md5', 'sha1', 'sha256']);

  const patterns = [
    { type: 'sha256', re: /\b[a-fA-F0-9]{64}\b/g },
    { type: 'sha1', re: /\b[a-fA-F0-9]{40}\b/g },
    { type: 'md5', re: /\b[a-fA-F0-9]{32}\b/g },
    {
      type: 'ipv4',
      re: /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g,
    },
    {
      type: 'ipv6',
      re: /\b(?:(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}|(?:[a-fA-F0-9]{1,4}:){1,7}:|(?:[a-fA-F0-9]{1,4}:){1,6}:[a-fA-F0-9]{1,4}|(?:[a-fA-F0-9]{1,4}:){1,5}(?::[a-fA-F0-9]{1,4}){1,2}|(?:[a-fA-F0-9]{1,4}:){1,4}(?::[a-fA-F0-9]{1,4}){1,3}|(?:[a-fA-F0-9]{1,4}:){1,3}(?::[a-fA-F0-9]{1,4}){1,4}|(?:[a-fA-F0-9]{1,4}:){1,2}(?::[a-fA-F0-9]{1,4}){1,5}|[a-fA-F0-9]{1,4}:(?::[a-fA-F0-9]{1,4}){1,6}|:(?::[a-fA-F0-9]{1,4}){1,7})\b/gi,
    },
    {
      type: 'domain',
      re: /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\s*[\[\(]\s*\.\s*[\]\)]\s*|\.))+(?:[a-zA-Z]{2,24}|xn--[a-zA-Z0-9-]{2,59})\b/g,
    },
  ];

  function normalize(type, raw) {
    let v = refangValue(strip(raw)).trim();
    if (['domain', 'md5', 'sha1', 'sha256', 'ipv4', 'ipv6'].includes(type)) {
      v = v.toLowerCase();
    }
    if (type === 'domain') v = v.replace(/\.$/, '');
    if (type === 'ipv6') v = v.replace(/^\[|\]$/g, '');
    return v;
  }

  function valid(type, v) {
    switch (type) {
      case 'ipv4':
        return isIpv4(v);
      case 'ipv6':
        return isIpv6(v);
      case 'domain':
        return isDomain(v);
      case 'md5':
      case 'sha1':
      case 'sha256':
        return isHash(type, v);
      default:
        return false;
    }
  }

  /** 网络类取值：若是 URL 只收主机，绝不收录完整 URL / 协议名 */
  function addNetValue(raw, source, confidence) {
    let v = String(raw || '').trim();
    if (!v) return;
    // 裸协议名：https / http:
    const schemeOnly = v.toLowerCase().replace(/:$/, '');
    if (SCHEME_TOKENS.has(schemeOnly)) return;

    if (/^(?:h(?:xx|tt)ps?|wss?):\/\//i.test(v) || /^\/\//.test(v)) {
      try {
        const href = refangValue(v.startsWith('//') ? `http:${v}` : v);
        if (isNavUrl(href)) return;
        const host = new URL(href).hostname;
        if (isIpv4(host)) add('ipv4', host, source, confidence);
        else if (host.includes(':')) add('ipv6', host.replace(/^\[|\]$/g, ''), source, confidence);
        else if (host) add('domain', host, source, confidence);
      } catch {
        /* ignore */
      }
      return;
    }

    const ipOnly = stripIpPort(v);
    if (
      /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(
        ipOnly
      )
    ) {
      add('ipv4', ipOnly, source, confidence);
      return;
    }
    add('domain', v, source, confidence);
  }

  const SOURCE_RANK = { field: 4, label: 3, link: 2, text: 1 };

  const map = new Map();
  const now = Date.now();

  function add(type, raw, source, confidence) {
    if (!raw) return;
    if (!ALLOWED_TYPES.has(type)) return;
    const cleaned = strip(String(raw));
    const normalized = normalize(type, cleaned);
    if (!valid(type, normalized)) return;
    const src = source || 'text';
    const conf =
      confidence ||
      (src === 'field' || src === 'label' ? 'high' : src === 'link' ? 'medium' : 'low');
    const key = `${type}|${normalized}`;
    const ex = map.get(key);
    if (ex) {
      ex.count += 1;
      if ((SOURCE_RANK[src] || 0) > (SOURCE_RANK[ex.source] || 0)) {
        ex.source = src;
        ex.confidence = conf;
      } else if (conf === 'high' && ex.confidence !== 'high') {
        ex.confidence = 'high';
      }
      return;
    }
    map.set(key, {
      type,
      value: cleaned,
      normalized,
      source: src,
      confidence: conf,
      count: 1,
      firstSeen: now,
    });
  }

  /** 从一段文本中按类型抽出候选值 */
  function pullValues(type, chunk) {
    const s = String(chunk || '');
    const out = [];
    let re;
    if (type === 'sha256') re = /\b[a-fA-F0-9]{64}\b/g;
    else if (type === 'sha1') re = /\b[a-fA-F0-9]{40}\b/g;
    else if (type === 'md5') re = /\b[a-fA-F0-9]{32}\b/g;
    else if (type === 'ipv4') {
      re =
        /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;
    }     else if (type === 'domain') {
      re =
        /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:[a-zA-Z]{2,24}|xn--[a-zA-Z0-9-]{2,59})\b/g;
    } else return out;
    let m;
    while ((m = re.exec(s)) !== null) out.push(m[0]);
    return out;
  }

  /**
   * 标签行 + IOC 分节提取
   * - Breakglass: Network / Sample hashes / Panel + C2 domains
   * - 奇安信等: 「IOC」节 +「MODBEACON-MD5:」「ghost C2:」等命名块
   */
  function extractLabeledFromText(text) {
    const rules = [
      {
        type: 'sha256',
        re: /(?:sha[\s\-]?256|sha256sum|file\s*hash|hash\s*value|样本哈希|文件哈希)\s*[:：=#]?\s*([a-fA-F0-9]{64})\b/gi,
      },
      {
        type: 'sha1',
        re: /(?:sha[\s\-]?1|sha1sum)\s*[:：=#]?\s*([a-fA-F0-9]{40})\b/gi,
      },
      {
        type: 'md5',
        // 支持 MD5: / MD5:`…` / MODBEACON-MD5: / xxx_MD5:
        re: /(?:[A-Za-z0-9][\w.\-]{0,40}[\-_])?(?:\bmd5\b|md5sum)\s*[:：=#`]*\s*`?([a-fA-F0-9]{32})\b/gi,
      },
      {
        type: 'ipv4',
        re: /(?:\bip(?:v4)?(?:\s*address)?\b|\bc2\b|\bc&c\b|基础设施|远控)\s*[:：=#]?\s*((?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))(?::\d{1,5})?\b/gi,
      },
      {
        type: 'domain',
        re: /(?:\bdomains?\b|\bhost(?:name)?s?\b|\bfqdn\b|\bc2\s*server\b|域名)\s*[:：=#]?\s*([a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?)+)/gi,
      },
    ];

    for (const { type, re } of rules) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        add(type, m[1], 'label', 'high');
      }
    }

    extractIocSections(text);
    extractNamedIocBlocks(text);
  }

  /** 从可能带端口的串里取出纯 IPv4 */
  function stripIpPort(v) {
    const s = String(v || '').trim();
    const m = s.match(
      /^((?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))(?::\d{1,5})?$/
    );
    return m ? m[1] : s;
  }

  /**
   * 表格/粘贴里域名粘连：a.azurewebsites.netb.azurewebsites.net
   * 或 Securelist 单元格多域挤在一起
   */
  function splitPackedHosts(text) {
    let s = refangText(String(text || ''));
    s = s.replace(
      /(azurewebsites\.net|amazonaws\.com|cloudfront\.net|cloudapp\.net|windows\.net)(?=[a-z0-9])/gi,
      '$1 '
    );
    s = s.replace(/(\.(?:com|net|org|io|info|biz|co))(?=[a-z][a-z0-9-]{1,62}\.)/gi, '$1 ');
    return s
      .split(/[\s,;|]+/)
      .map((x) => x.trim())
      .filter((x) => x.length >= 4);
  }

  function ingestNetOrHashLine(line) {
    const raw = line.trim().replace(/^[-*•]\s*/, '');
    if (!raw || raw.length > 400) return false;
    if (/^(参考|Reference|http)/i.test(raw) && !/[\[\(]\s*\./.test(raw)) return false;

    // Securelist：MD5 后跟文件名  CBAAF090… FrontEnd-Task.zip
    const hashFile = raw.match(
      /^([a-fA-F0-9]{32}|[a-fA-F0-9]{40}|[a-fA-F0-9]{64})(?:\s+[^\s].*)?$/
    );
    if (hashFile) {
      const hex = hashFile[1];
      if (hex.length === 64) add('sha256', hex, 'label', 'high');
      else if (hex.length === 40) add('sha1', hex, 'label', 'high');
      else add('md5', hex, 'label', 'high');
      return true;
    }

    // 内联 MD5:`810F…` / MD5: 810F…
    const inlineMd5 = raw.match(/\bmd5\b\s*[:=：`]+\s*`?([a-fA-F0-9]{32})\b/i);
    if (inlineMd5) {
      add('md5', inlineMd5[1], 'label', 'high');
      return true;
    }

    const parts = splitPackedHosts(raw);
    let hit = false;
    for (const part of parts.length ? parts : [raw]) {
      const v = refangValue(part);
      if (!v) continue;

      const ipOnly = stripIpPort(v);
      if (
        /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(
          ipOnly
        )
      ) {
        add('ipv4', ipOnly, 'label', 'high');
        hit = true;
        continue;
      }

      if (/^(?:h(?:xx|tt)ps?|wss?):\/\//i.test(v) || /^\/\//.test(part)) {
        try {
          const href = v.startsWith('//') ? `http:${v}` : v;
          const host = new URL(href).hostname;
          if (isIpv4(host)) add('ipv4', host, 'label', 'high');
          else if (host.includes(':')) add('ipv6', host.replace(/^\[|\]$/g, ''), 'label', 'high');
          else if (host) add('domain', host, 'label', 'high');
          hit = true;
        } catch {
          /* ignore */
        }
        continue;
      }

      // 域名（含 azurewebsites / s3 多级）
      if (
        /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:[a-zA-Z]{2,24}|xn--[a-zA-Z0-9-]{2,59})$/.test(
          v
        )
      ) {
        add('domain', v, 'label', 'high');
        hit = true;
      }
    }
    return hit;
  }

  /**
   * 奇安信 / 中文报告常见：
   *   IOC
   *   MODBEACON-MD5:
   *   <md5>
   *   MODBEACON C2:
   *   <domain>
   *   ghost C2:
   *   <domain|ip:port>
   */
  function extractNamedIocBlocks(text) {
    const lines = text.split(/\n/);
    // 块标题：可选家族名前缀 + MD5/SHA/C2/IOC
    const blockHead =
      /^\s*(?:[A-Za-z][\w.\-]{0,48}\s*[\-_]\s*)?(?:MD5|SHA[\s\-]?256|SHA[\s\-]?1|SHA1|SHA256|C2|IOC|IOCs|Domains?|IPs?|URLs?|Hashes?)(?:\s*C2)?\s*[:：]?\s*$/i;
    const softHead =
      /^\s*(?:[A-Za-z0-9][\w.\-]{0,40})\s+C2\s*[:：]?\s*$/i; // ghost C2: / MODBEACON C2:

    let mode = null; // 'md5' | 'sha256' | 'sha1' | 'net' | 'any'
    let emptyStreak = 0;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();
      if (!line) {
        emptyStreak += 1;
        if (emptyStreak >= 2) mode = null;
        continue;
      }
      emptyStreak = 0;

      // 大节标题 IOC / 威胁指标
      if (/^(?:IOC|IOCs|Indicators?\s+of\s+Compromise|威胁指标|检测指标|相关IOC)\s*[:：]?$/i.test(line)) {
        mode = 'any';
        continue;
      }

      let mHead = line.match(blockHead) || line.match(softHead);
      if (mHead) {
        const L = line.toLowerCase();
        if (/md5/.test(L)) mode = 'md5';
        else if (/sha\s*256|sha256/.test(L)) mode = 'sha256';
        else if (/sha\s*1|sha1/.test(L) && !/256/.test(L)) mode = 'sha1';
        else if (/c2|domain|ip|url|ioc|hash/.test(L)) mode = 'net';
        else mode = 'any';
        // 标题同行尾部若已带值
        const after = line.replace(/^[^:：]+[:：]\s*/, '');
        if (after && after !== line) ingestNetOrHashLine(after);
        continue;
      }

      if (!mode) continue;

      // 遇到新的章节标题则退出块
      if (/^(?:参考|Reference|总结|背景|分析|附录)\b/i.test(line) && line.length < 40) {
        mode = null;
        continue;
      }

      if (mode === 'md5') {
        if (/^[a-fA-F0-9]{32}$/.test(line)) add('md5', line, 'label', 'high');
        else if (!ingestNetOrHashLine(line)) {
          /* 非哈希则可能块结束 */
          if (/[:：]$/.test(line) || /^[A-Za-z].{0,40}C2\s*[:：]?$/i.test(line)) {
            i -= 1; // 回退，让下一轮当标题解析
            mode = null;
          }
        }
        continue;
      }
      if (mode === 'sha256') {
        if (/^[a-fA-F0-9]{64}$/.test(line)) add('sha256', line, 'label', 'high');
        else ingestNetOrHashLine(line);
        continue;
      }
      if (mode === 'sha1') {
        if (/^[a-fA-F0-9]{40}$/.test(line)) add('sha1', line, 'label', 'high');
        else ingestNetOrHashLine(line);
        continue;
      }
      // net / any
      ingestNetOrHashLine(line);
    }
  }

  function extractIocSections(text) {
    const headerRe =
      /(?:^|\n)[ \t]*(Network|Panel\s*\+\s*C2\s*domains?|C2\s*domains?|Domains?\s+and\s+IPs?|IPs?\s+and\s+[Dd]omains?|File\s+hashes?|Sample\s+hashes?|Hashes?|URLs?|Host[\s\-]?based|IOCs?|Indicators?\s+of\s+[Cc]ompromise|Infrastructure|C2\s+Infrastructure|威胁指标|检测指标|相关\s*IOC)\s*(?:\n|$)/gi;

    const hits = [];
    let hm;
    while ((hm = headerRe.exec(text)) !== null) {
      hits.push({
        name: hm[1].toLowerCase().replace(/\s+/g, ' '),
        bodyStart: hm.index + hm[0].length,
      });
    }

    if (!hits.length) {
      extractHashLines(text, 'label');
      return;
    }

    for (let i = 0; i < hits.length; i++) {
      const start = hits[i].bodyStart;
      let end = i + 1 < hits.length ? hits[i + 1].bodyStart : text.length;
      // IOC 节后的「参考链接」/页脚不要整段当 IOC
      const sliced = text.slice(start, Math.min(end, start + 30000));
      const cut = sliced.search(
        /(?:^|\n)[ \t]*(?:参考(?:链接|资料)?|References?|See\s+also|相关链接|Targeted attacks|GReAT webinars|From the same authors|In the same category|Table of Contents)\s*(?:\n|$)/i
      );
      const body = cut >= 0 ? sliced.slice(0, cut) : sliced;
      const name = hits[i].name;
      const bodyRef = refangText(body);

      const wantHash = /hash|ioc|indicator|host[\s\-]?based|sample|威胁指标|检测指标/.test(name);
      const wantNet =
        /network|domain|ip|c2|infrastructure|panel|url|host|ioc|威胁指标|检测指标/.test(name);

      if (wantHash || wantNet) {
        extractHashLines(body, 'label');
        extractNamedIocBlocks(body);
        // Securelist「MD5 文件名」行
        body.split(/\n/).forEach((line) => ingestNetOrHashLine(line));
        pullValues('ipv4', bodyRef).forEach((v) => add('ipv4', stripIpPort(v), 'label', 'high'));
        pullValues('sha256', bodyRef).forEach((v) => add('sha256', v, 'label', 'high'));
        pullValues('sha1', bodyRef).forEach((v) => add('sha1', v, 'label', 'high'));
        pullValues('md5', bodyRef).forEach((v) => add('md5', v, 'label', 'high'));
      }
      if (wantNet || /url/.test(name)) {
        body.split(/\n/).forEach((line) => {
          splitPackedHosts(line).forEach((part) => ingestNetOrHashLine(part));
        });
        pullValues('domain', bodyRef).forEach((v) => add('domain', v, 'label', 'high'));
        const ipPortRe =
          /\b((?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))(?::\d{1,5})?\b/g;
        let im;
        while ((im = ipPortRe.exec(bodyRef)) !== null) {
          add('ipv4', im[1], 'label', 'high');
        }
      }
    }
  }

  /** 行首 32/40/64 位哈希（后面可跟说明，如 DeskRAT ...） */
  function extractHashLines(text, source) {
    const lineRe = /^[ \t]*([a-fA-F0-9]{32}|[a-fA-F0-9]{40}|[a-fA-F0-9]{64})(?:\b|[ \t])/gm;
    let m;
    while ((m = lineRe.exec(text)) !== null) {
      const hex = m[1];
      if (hex.length === 64) add('sha256', hex, source, 'high');
      else if (hex.length === 40) add('sha1', hex, source, 'high');
      else if (hex.length === 32) add('md5', hex, source, 'high');
    }
  }

  /** DOM：标签节点旁的值（dt/dd、th/td、strong 后的 code） */
  function extractLabeledFromDom() {
    // 允许「MODBEACON-MD5」「ghost C2」等带家族前缀的标签
    const labelRe =
      /^(?:[A-Za-z0-9][\w.\-]{0,40}[\-_\s]+)?(?:sha[\s\-]?256|sha256|sha[\s\-]?1|sha1|md5|ip(?:v4)?|ip\s*address|domains?|host(?:name)?s?|fqdn|urls?|cve|hash(?:es)?|file\s*hash|c2|ioc|域名|哈希)$/i;

    function typeFromLabel(label) {
      const l = label.toLowerCase().replace(/\s+/g, '');
      if (/sha.?256|sha256/.test(l)) return 'sha256';
      if (/sha.?1|sha1/.test(l) && !/256/.test(l)) return 'sha1';
      if (/md5/.test(l)) return 'md5';
      if (/^hash|filehash|哈希/.test(l)) return 'hash'; // 后面按长度分流
      if (/ipv4|^ip$|ipaddress/.test(l)) return 'ipv4';
      // C2 / 域名标签：后续值可能是 domain 或 IP，交给 ingest 分流
      if (/c2|domain|host|fqdn|域名|ioc/.test(l)) return 'net';
      if (/url/.test(l)) return null; // 不采集 URL
      if (/cve/.test(l)) return null;
      return null;
    }

    function ingest(type, value) {
      if (!type || !value) return;
      if (type === 'hash') {
        const v = value.trim();
        if (/^[a-fA-F0-9]{64}$/.test(v)) add('sha256', v, 'label', 'high');
        else if (/^[a-fA-F0-9]{40}$/.test(v)) add('sha1', v, 'label', 'high');
        else if (/^[a-fA-F0-9]{32}$/.test(v)) add('md5', v, 'label', 'high');
        else {
          pullValues('sha256', v).forEach((x) => add('sha256', x, 'label', 'high'));
          pullValues('sha1', v).forEach((x) => add('sha1', x, 'label', 'high'));
          pullValues('md5', v).forEach((x) => add('md5', x, 'label', 'high'));
        }
        return;
      }
      if (type === 'net') {
        String(value)
          .split(/\n+/)
          .forEach((line) => ingestNetOrHashLine(line));
        return;
      }
      if (type === 'ipv4') {
        pullValues('ipv4', value).forEach((x) => add('ipv4', stripIpPort(x), 'label', 'high'));
        const one = stripIpPort(value.trim());
        if (/^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(one)) {
          add('ipv4', one, 'label', 'high');
        }
        return;
      }
      pullValues(type, value).forEach((x) => add(type, x, 'label', 'high'));
      // 整段也可能就是单个值
      add(type, value, 'label', 'high');
    }

    // dt + dd
    queryAllDeep('dt').forEach((dt) => {
      const label = (dt.innerText || '').trim();
      if (!labelRe.test(label.replace(/[:：]\s*$/, ''))) return;
      const type = typeFromLabel(label.replace(/[:：]\s*$/, ''));
      const dd = dt.nextElementSibling;
      if (dd && dd.tagName === 'DD') ingest(type, dd.innerText || '');
    });

    // th + 同行 td（单列表头场景）
    queryAllDeep('tr').forEach((tr) => {
      const th = tr.querySelector('th');
      const td = tr.querySelector('td');
      if (!th || !td) return;
      const label = (th.innerText || '').trim().replace(/[:：]\s*$/, '');
      if (!labelRe.test(label) && !/sha|md5|hash|ip|domain|host|cve|url|域名|哈希/i.test(label)) {
        return;
      }
      const type = typeFromLabel(label) || ( /sha.?256/i.test(label) ? 'sha256' : /md5/i.test(label) ? 'md5' : /sha.?1/i.test(label) ? 'sha1' : null);
      if (type) ingest(type, td.innerText || '');
    });

    // <strong>SHA256</strong> <code>....</code> 或相邻文本
    queryAllDeep('strong, b, span, label, h2, h3, h4, h5').forEach((el) => {
      const label = (el.innerText || '').trim().replace(/[:：]\s*$/, '');
      if (label.length > 40) return;
      if (!/sha|md5|hash|ip|domain|host|cve|url|ioc|域名|哈希|c2/i.test(label)) return;
      const type = typeFromLabel(label);
      if (!type && !/^hash$/i.test(label)) return;
      const t = type || 'hash';
      // 下一个 code / 兄弟节点
      let sib = el.nextElementSibling;
      if (sib && /^(CODE|PRE|TT|A|SPAN)$/.test(sib.tagName)) {
        ingest(t, sib.innerText || '');
      }
      const parent = el.parentElement;
      if (parent) {
        const code = parent.querySelector('code, pre, tt');
        if (code) ingest(t, code.innerText || '');
      }
    });

    /**
     * 奇安信 ti.qianxin.com：<p class="line">MODBEACON-MD5:</p> + 后续同级 <p>
     * 以及「xxx C2如下：」后的 <ul><li>
     */
    function isIocLabelLine(t) {
      const s = t.replace(/[:：]\s*$/, '').trim();
      if (!s || s.length > 48) return false;
      if (labelRe.test(s)) return true;
      if (/^(?:[A-Za-z0-9][\w.\-]{0,40})(?:[\-_]|[\s]+)(?:MD5|SHA[\s\-]?256|SHA[\s\-]?1|C2)$/i.test(s)) {
        return true;
      }
      if (/^(?:[A-Za-z0-9][\w.\-]{0,40})\s+C2$/i.test(s)) return true;
      return false;
    }

    queryAllDeep('p.line, h2.line, p, li').forEach((el) => {
      const raw = (el.innerText || '').trim();
      if (!raw || raw.length > 80) return;
      if (!isIocLabelLine(raw)) return;
      const label = raw.replace(/[:：]\s*$/, '');
      const type = typeFromLabel(label) || (/md5/i.test(label) ? 'md5' : /c2|ioc/i.test(label) ? 'net' : null);
      if (!type) return;

      // 标签在 li 内且自身就是值则跳过（由下方 ul 处理）
      if (el.tagName === 'LI' && !/[:：]\s*$/.test(raw) && ingestNetOrHashLine(raw)) return;

      let sib = el.nextElementSibling;
      let n = 0;
      while (sib && n < 40) {
        n += 1;
        if (/^H[1-6]$/.test(sib.tagName)) break;
        const t = (sib.innerText || '').trim();
        if (!t) {
          sib = sib.nextElementSibling;
          continue;
        }
        if (isIocLabelLine(t.split('\n')[0] || t)) break;
        if (sib.tagName === 'UL' || sib.tagName === 'OL') {
          sib.querySelectorAll(':scope > li').forEach((li) => {
            ingestNetOrHashLine((li.innerText || '').trim());
          });
          sib = sib.nextElementSibling;
          continue;
        }
        const ok = ingestNetOrHashLine(t);
        if (!ok && type !== 'net' && type !== 'hash') break;
        if (!ok) break;
        sib = sib.nextElementSibling;
      }
    });

    // 「ghost C2如下」类描述句后的列表
    queryAllDeep('p, h2, h3, h4').forEach((el) => {
      const t = (el.innerText || '').trim();
      if (!/(?:C2|IOC|域名|哈希|指标).{0,12}如下/i.test(t) && !/如下[:：]?\s*$/.test(t)) return;
      if (!/c2|ioc|域名|hash|md5|ip|指标/i.test(t)) return;
      let sib = el.nextElementSibling;
      if (sib && (sib.tagName === 'UL' || sib.tagName === 'OL')) {
        sib.querySelectorAll(':scope > li').forEach((li) => {
          ingestNetOrHashLine((li.innerText || '').trim());
        });
      }
    });

    // code/pre 中的纯哈希（常见于 IOC 列表）
    queryAllDeep(
      'article code, article pre, .entry-content code, .entry-content pre, .post-content code, .c-wysiwyg code, main code, main pre, .main-body code, .main-body pre, code, pre'
    ).forEach((el) => {
      const v = (el.innerText || '').trim();
      if (/^[a-fA-F0-9]{64}$/.test(v)) add('sha256', v, 'field', 'high');
      else if (/^[a-fA-F0-9]{40}$/.test(v)) add('sha1', v, 'field', 'high');
      else if (/^[a-fA-F0-9]{32}$/.test(v)) add('md5', v, 'field', 'high');
      else if (/^[a-fA-F0-9]{32,64}(\s+[a-fA-F0-9]{32,64})+$/.test(v)) {
        pullValues('sha256', v).forEach((x) => add('sha256', x, 'field', 'high'));
        pullValues('sha1', v).forEach((x) => add('sha1', x, 'field', 'high'));
        pullValues('md5', v).forEach((x) => add('md5', x, 'field', 'high'));
      }
    });
  }

  function walkJsonIocs(node, depth) {
    if (depth > 8 || node == null) return;
    if (typeof node === 'string') {
      const v = node.trim();
      if (/^[a-fA-F0-9]{64}$/.test(v)) add('sha256', v, 'field', 'high');
      else if (/^[a-fA-F0-9]{40}$/.test(v)) add('sha1', v, 'field', 'high');
      else if (/^[a-fA-F0-9]{32}$/.test(v)) add('md5', v, 'field', 'high');
      else if (
        /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(v)
      ) {
        add('ipv4', v, 'field', 'high');
      } else if (/^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,24}$/.test(v) && v.length < 120) {
        add('domain', v, 'field', 'medium');
      }
      return;
    }
    if (Array.isArray(node)) {
      node.slice(0, 200).forEach((x) => walkJsonIocs(x, depth + 1));
      return;
    }
    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        const key = String(k).toLowerCase();
        if (/sha.?256|sha256/.test(key) && typeof v === 'string') add('sha256', v, 'field', 'high');
        else if (/^md5$/.test(key) && typeof v === 'string') add('md5', v, 'field', 'high');
        else if (/sha.?1|sha1/.test(key) && typeof v === 'string') add('sha1', v, 'field', 'high');
        else if (/^(ip|ipv4|ipaddress)$/.test(key) && typeof v === 'string') {
          addNetValue(v, 'field', 'high');
        } else if (/domain|hostname|fqdn|host/.test(key) && typeof v === 'string') {
          addNetValue(v, 'field', 'high');
        } else walkJsonIocs(v, depth + 1);
      }
    }
  }

  // ---------- 1) 结构化：Hunt.io / VT / OTX / 表格 IOC 列 ----------
  function extractStructured() {
    // portal.hunt.io/domain/<host> 或任意 /domain/<host>
    queryAllDeep('a[href*="/domain/"]').forEach((a) => {
      const href = a.getAttribute('href') || '';
      const m = href.match(/\/domain\/([a-zA-Z0-9._-]+)/i);
      if (m) add('domain', m[1], 'field', 'high');
    });

    // /ip/ 或纯 IP 链接
    queryAllDeep('a[href*="/ip/"], a[href*="/host/"]').forEach((a) => {
      const href = a.getAttribute('href') || '';
      const m = href.match(/\/(?:ip|host)\/([a-zA-Z0-9.:_-]+)/i);
      if (!m) return;
      const v = m[1];
      if (isIpv4(v)) add('ipv4', v, 'field', 'high');
      else if (v.includes(':')) add('ipv6', v, 'field', 'high');
      else add('domain', v, 'field', 'high');
    });

    // VirusTotal /gui/domain|ip|file/
    queryAllDeep('a[href*="/gui/"]').forEach((a) => {
      const href = a.getAttribute('href') || '';
      let m = href.match(/\/gui\/domain\/([a-zA-Z0-9._-]+)/i);
      if (m) {
        add('domain', m[1], 'field', 'high');
        return;
      }
      m = href.match(/\/gui\/ip-address\/([a-fA-F0-9.:]+)/i);
      if (m) {
        const v = m[1];
        if (isIpv4(v)) add('ipv4', v, 'field', 'high');
        else if (v.includes(':')) add('ipv6', v, 'field', 'high');
        return;
      }
      m = href.match(/\/gui\/file\/([a-fA-F0-9]{32,64})/i);
      if (m) {
        const hex = m[1];
        if (hex.length === 64) add('sha256', hex, 'field', 'high');
        else if (hex.length === 40) add('sha1', hex, 'field', 'high');
        else if (hex.length === 32) add('md5', hex, 'field', 'high');
      }
    });

    // OTX indicator 链接
    queryAllDeep('a[href*="/indicator/"]').forEach((a) => {
      const href = a.getAttribute('href') || '';
      const m = href.match(/\/indicator\/(?:domain|hostname|IPv4|IPv6|file)\/([^/?#]+)/i);
      if (!m) return;
      const v = decodeURIComponent(m[1]);
      if (/\/file\//i.test(href)) {
        if (v.length === 64) add('sha256', v, 'field', 'high');
        else if (v.length === 40) add('sha1', v, 'field', 'high');
        else if (v.length === 32) add('md5', v, 'field', 'high');
      } else if (isIpv4(v)) add('ipv4', v, 'field', 'high');
      else if (v.includes(':')) add('ipv6', v, 'field', 'high');
      else add('domain', v, 'field', 'high');
    });

    // abuse.ch / threatfox 参数
    queryAllDeep('a[href*="abuse.ch"], a[href*="threatfox"], a[href*="urlhaus"]').forEach((a) => {
      const href = a.getAttribute('href') || '';
      const hm = href.match(/[?&](?:sha256|hash|md5)=([a-fA-F0-9]{32,64})/i);
      if (hm) {
        const hex = hm[1];
        if (hex.length === 64) add('sha256', hex, 'field', 'high');
        else if (hex.length === 40) add('sha1', hex, 'field', 'high');
        else if (hex.length === 32) add('md5', hex, 'field', 'high');
      }
      const dm = href.match(/[?&](?:host|domain|ioc)=([a-zA-Z0-9._-]+)/i);
      if (dm) addNetValue(dm[1], 'field', 'high');
    });

    queryAllDeep(
      '[data-domain], [data-ip], [data-hash], [data-sha256], [data-md5], [data-sha1], [data-ioc-value]'
    ).forEach((el) => {
      const domain = el.getAttribute('data-domain') || el.getAttribute('data-ioc-value');
      const ip = el.getAttribute('data-ip');
      const sha256 = el.getAttribute('data-sha256') || el.getAttribute('data-hash');
      const md5 = el.getAttribute('data-md5');
      const sha1 = el.getAttribute('data-sha1');
      if (domain) addNetValue(domain, 'field', 'high');
      if (ip) addNetValue(ip, 'field', 'high');
      if (sha256) {
        if (sha256.length === 64) add('sha256', sha256, 'field', 'high');
        else if (sha256.length === 40) add('sha1', sha256, 'field', 'high');
        else if (sha256.length === 32) add('md5', sha256, 'field', 'high');
      }
      if (md5) add('md5', md5, 'field', 'high');
      if (sha1) add('sha1', sha1, 'field', 'high');
    });

    // 表格：按表头识别 IP / Hostnames / Hash 列
    queryAllDeep('table').forEach((table) => {
      const headers = [...table.querySelectorAll('thead th, tr th')].map((th) =>
        (th.innerText || th.textContent || '').trim().toLowerCase()
      );
      if (!headers.length) return;

      const colTypes = headers.map((h) => {
        if (/^(ip|ipv4|ip\s*address|ipaddr)$/.test(h)) return 'ipv4';
        if (/^ipv6$/.test(h)) return 'ipv6';
        if (/host\s*names?|domains?|fqdn|hostname|ioc\s*value|indicator/.test(h)) return 'domain';
        if (/^(url|uri|link)$/.test(h)) return null;
        if (/sha-?256|sha256/.test(h)) return 'sha256';
        if (/sha-?1(?!\d)|sha1/.test(h)) return 'sha1';
        if (/^(md5)$/.test(h)) return 'md5';
        if (/^hash(es)?$|file\s*hash|sample/.test(h)) return 'hash';
        if (/cve/.test(h)) return 'cve';
        return null;
      });
      if (!colTypes.some(Boolean)) return;

      const rows = table.querySelectorAll('tbody tr');
      const list = rows.length ? rows : table.querySelectorAll('tr');
      list.forEach((tr) => {
        if (tr.querySelector('th') && !tr.querySelector('td')) return;
        const cells = [...tr.querySelectorAll('td')];
        cells.forEach((td, i) => {
          let type = colTypes[i];
          if (!type) return;
          td.querySelectorAll('a[href]').forEach((a) => {
            const href = a.getAttribute('href') || '';
            const dm = href.match(/\/domain\/([a-zA-Z0-9._-]+)/i);
            if (dm) add('domain', dm[1], 'field', 'high');
            const text = (a.innerText || '').trim();
            if (text) {
              if (type === 'hash') {
                if (text.length === 64) add('sha256', text, 'field', 'high');
                else if (text.length === 40) add('sha1', text, 'field', 'high');
                else if (text.length === 32) add('md5', text, 'field', 'high');
              } else if (type === 'domain' || type === 'ipv4' || type === 'ipv6') {
                addNetValue(text, 'field', 'high');
              } else {
                add(type, text, 'field', 'high');
              }
            }
          });
          const raw = (td.innerText || '').trim();
          if (!raw) return;
          if (type === 'hash') {
            pullValues('sha256', raw).forEach((v) => add('sha256', v, 'field', 'high'));
            pullValues('sha1', raw).forEach((v) => add('sha1', v, 'field', 'high'));
            pullValues('md5', raw).forEach((v) => add('md5', v, 'field', 'high'));
            ingestNetOrHashLine(raw);
            return;
          }
          if (type === 'cve') return;
          const parts =
            type === 'domain' || type === 'ipv4' || type === 'ipv6'
              ? splitPackedHosts(raw)
              : raw.split(/[\s,;|]+/);
          parts.forEach((part) => {
            const p = part.trim();
            if (!p || p.length < 4) return;
            if (type === 'domain' || type === 'ipv4' || type === 'ipv6') {
              addNetValue(p, 'field', 'high');
            } else {
              add(type, p, 'field', 'high');
            }
          });
        });
      });
    });

    queryAllDeep('[data-ioc], [data-indicator], .ioc, .indicator, .hash, .sha256, .md5').forEach(
      (el) => {
        const t = (el.getAttribute('data-type') || el.className || '').toLowerCase();
        const v = (el.innerText || el.getAttribute('data-ioc') || '').trim();
        if (!v) return;
        if (/sha.?256|sha256/.test(t)) add('sha256', v, 'field', 'high');
        else if (/sha.?1|sha1/.test(t)) add('sha1', v, 'field', 'high');
        else if (/md5/.test(t)) add('md5', v, 'field', 'high');
        else if (/ip/.test(t)) add('ipv4', v, 'field', 'high');
        else if (/domain|host/.test(t)) addNetValue(v, 'field', 'high');
        else if (/url|uri|link/.test(t)) {
          addNetValue(v, 'field', 'high');
        } else {
          if (/^[a-fA-F0-9]{64}$/.test(v)) add('sha256', v, 'field', 'high');
          else if (/^[a-fA-F0-9]{40}$/.test(v)) add('sha1', v, 'field', 'high');
          else if (/^[a-fA-F0-9]{32}$/.test(v)) add('md5', v, 'field', 'high');
        }
      }
    );

    queryAllDeep('script[type="application/ld+json"], script[type="application/json"]').forEach(
      (el) => {
        const raw = (el.textContent || '').trim();
        if (!raw || raw.length < 20 || raw.length > 200000) return;
        if (!/(sha256|md5|domain|ipv4|indicator|ioc|hostname)/i.test(raw)) return;
        try {
          walkJsonIocs(JSON.parse(raw), 0);
        } catch {
          /* ignore */
        }
      }
    );
  }

  // ---------- 2) 正文优先文本（去掉 nav/footer） ----------
  function isTwitterHost() {
    return /(^|\.)(x|twitter)\.com$/i.test(location.hostname || '');
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** 快照当前 DOM 中的推文正文（X 虚拟列表会卸载滚出屏幕的节点） */
  function snapshotTweetTexts(seen, chunks) {
    const push = (raw) => {
      const t = stripZw(String(raw || '').trim());
      if (!t || t.length < 3) return;
      // 归一化空白后再去重，避免同一推文微调导致重复
      const key = t.replace(/\s+/g, ' ');
      if (seen.has(key)) return;
      seen.add(key);
      chunks.push(t);
    };

    queryAllDeep('[data-testid="tweetText"]').forEach((el) => {
      push(el.innerText || el.textContent || '');
    });

    queryAllDeep('article[data-testid="tweet"]').forEach((el) => {
      const node = el.querySelector?.('[data-testid="tweetText"]');
      if (node) push(node.innerText || node.textContent || '');
    });
  }

  /** X / Twitter：按推文正文节点汇总（避免只命中第一个 article） */
  function getSocialFeedText() {
    if (!isTwitterHost()) return '';
    const chunks = [];
    const seen = new Set();
    snapshotTweetTexts(seen, chunks);

    if (!chunks.length) {
      queryAllDeep('article').forEach((el) => {
        const node =
          el.querySelector?.('[data-testid="tweetText"]') ||
          el.querySelector?.('[lang]') ||
          null;
        const t = stripZw(
          String(node ? node.innerText || node.textContent : el.innerText || '').trim()
        );
        if (!t || t.length < 3) return;
        const key = t.replace(/\s+/g, ' ');
        if (seen.has(key)) return;
        seen.add(key);
        chunks.push(t);
      });
    }

    if (!chunks.length) {
      const main =
        document.querySelector('[data-testid="primaryColumn"]') ||
        document.querySelector('[role="main"]') ||
        document.querySelector('main');
      if (main) {
        const t = stripZw(String(main.innerText || '').trim());
        if (t) chunks.push(t);
      }
    }

    return chunks.join('\n');
  }

  /**
   * 自动下拉时间线并持续快照推文（解决无限滚动 / 虚拟列表漏扫）
   */
  async function harvestSocialFeedByScroll() {
    if (!isTwitterHost()) return { text: getSocialFeedText(), tweets: 0, scrolled: false };

    const canScroll =
      typeof window !== 'undefined' && typeof window.scrollBy === 'function';
    if (!canScroll || !autoScroll) {
      const text = getSocialFeedText();
      return {
        text,
        tweets: text ? text.split('\n').filter(Boolean).length : 0,
        scrolled: false,
      };
    }

    const seen = new Set();
    const chunks = [];
    snapshotTweetTexts(seen, chunks);

    let stable = 0;
    let lastCount = chunks.length;
    const t0 = performance.now();
    const startY = window.scrollY || 0;

    for (let i = 0; i < scrollMaxRounds && performance.now() - t0 < scrollMaxMs; i++) {
      const yBefore = window.scrollY || 0;
      const step = Math.max(480, Math.floor((window.innerHeight || 800) * 0.92));
      try {
        window.scrollBy(0, step);
      } catch {
        /* ignore */
      }

      // 部分布局下主栏自身可滚动
      try {
        const col =
          document.querySelector('[data-testid="primaryColumn"]') ||
          document.querySelector('[role="main"]');
        if (col && col.scrollHeight > col.clientHeight + 40) {
          col.scrollTop = Math.min(col.scrollHeight, (col.scrollTop || 0) + step);
        }
      } catch {
        /* ignore */
      }

      await sleep(380);
      snapshotTweetTexts(seen, chunks);

      const yAfter = window.scrollY || 0;
      const moved = Math.abs(yAfter - yBefore) > 30;
      if (chunks.length === lastCount) {
        stable += 1;
        // 滚不动且没有新推文 → 到底或限流
        if (!moved && stable >= 3) break;
        if (stable >= 8) break;
      } else {
        stable = 0;
        lastCount = chunks.length;
      }
    }

    // 回到原位置，减少打扰
    try {
      window.scrollTo(0, startY);
    } catch {
      /* ignore */
    }

    return {
      text: chunks.join('\n'),
      tweets: chunks.length,
      scrolled: true,
    };
  }

  /**
   * 社交威胁情报常见写法：#IOC #C2 … 后跟 defang IP/域名
   * 高置信仅限 X/Twitter，或「标签 + defang」同时出现，避免污染情报站精确模式
   */
  function extractSocialThreatLines(text) {
    const onTwitter = isTwitterHost();
    const lines = String(text || '').split(/\n+/);
    for (const line of lines) {
      const raw = line.trim();
      if (!raw) continue;
      const hasTag =
        /#(?:IOC|IOCs|C2|C2s|APT|Malware|Phishing|Ransomware|ThreatIntel|CyberSecurity|Kimsuky|Lazarus|daily)\b/i.test(
          raw
        ) || /daily\s+hunting/i.test(raw);
      const hasDefang = /[\[\(\{（【\uFF3B].{0,2}[\]\)\}）】\uFF3D]/.test(raw) || /\sdot\s/i.test(raw);
      if (!hasTag && !hasDefang) continue;

      const cleaned = refangText(raw);
      const elevate = onTwitter ? hasTag || hasDefang : hasTag && hasDefang;
      const conf = elevate ? 'high' : 'medium';
      const src = elevate ? 'label' : 'text';

      const ipRe =
        /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;
      let m;
      while ((m = ipRe.exec(cleaned)) !== null) {
        add('ipv4', m[0], src, conf);
      }

      const domRe =
        /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:[a-zA-Z]{2,24}|xn--[a-zA-Z0-9-]{2,59})\b/g;
      while ((m = domRe.exec(cleaned)) !== null) {
        add('domain', m[0], src, conf);
      }

      // 仍带 [.] 的原文再扫一遍（refang 失败时）
      const defIp =
        /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\s*[\[\(\{\uFF3B]\s*[.\uFF0E\u2024]\s*[\]\)\}\uFF3D]\s*|\.)){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;
      while ((m = defIp.exec(raw)) !== null) {
        add('ipv4', refangValue(m[0]), src, conf);
      }
      const defDom =
        /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\s*[\[\(\{\uFF3B]\s*[.\uFF0E\u2024]\s*[\]\)\}\uFF3D]\s*|\.))+(?:[a-zA-Z]{2,24}|xn--[a-zA-Z0-9-]{2,59})\b/g;
      while ((m = defDom.exec(raw)) !== null) {
        add('domain', refangValue(m[0]), src, conf);
      }
    }
  }

  function getMainText() {
    const social = getSocialFeedText();
    if (social && social.length > 20) return social;

    // 多 article 页面（如时间线）不要只取第一个 article
    const articles = document.querySelectorAll('article');
    if (articles.length > 1) {
      const main =
        document.querySelector('[role="main"]') || document.querySelector('main');
      if (main) {
        const t = main.innerText || '';
        if (t.length > 200) return t;
      }
      const joined = [...articles]
        .slice(0, 80)
        .map((a) => a.innerText || '')
        .filter((t) => t.length > 20)
        .join('\n');
      if (joined.length > 200) return joined;
    }

    const sels = [
      '[role="main"]',
      'main',
      'article',
      '.main-body',
      '.article-page',
      '.entry-content',
      '.post-content',
      '.article-content',
      '.article-body',
      '.c-wysiwyg',
      '.js-article-content',
      '.td-post-content',
      '.pulse-indicators',
      '.ioc-list',
      '.indicators',
      '#content',
    ];
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const t = el.innerText || '';
      if (t.length > 400) return t;
    }
    let bodyText = document.body ? document.body.innerText || '' : '';
    for (const root of collectRoots()) {
      if (root === document) continue;
      try {
        const t = root.textContent || '';
        if (t.length > 80) bodyText += `\n${t}`;
      } catch {
        /* ignore */
      }
    }
    return bodyText;
  }

  function collectLinks(root) {
    const links = [];
    if (!root) return links;
    const anchors =
      root === document || root === document.body
        ? queryAllDeep('a[href]')
        : root.querySelectorAll
          ? [...root.querySelectorAll('a[href]')]
          : [];
    anchors.forEach((a) => {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('#')) {
        return;
      }
      try {
        links.push(new URL(href, document.baseURI).href);
      } catch {
        links.push(href);
      }
    });
    return links;
  }

  function runTextPipeline(rawText, linkList) {
    const rawCombined = `${rawText || ''}\n${(linkList || []).join('\n')}`;
    // 先对含 #IOC / defang 的社交行做高置信提取（X/Twitter 等）
    extractSocialThreatLines(rawCombined);

    let text = refangText(rawCombined);
    const truncatedLocal = text.length > MAX_TEXT_LENGTH;
    if (truncatedLocal) text = text.slice(0, MAX_TEXT_LENGTH);

    extractLabeledFromText(text);

    for (const { type, re } of patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        const conf = ['sha256', 'sha1', 'md5', 'domain'].includes(type) ? 'low' : 'medium';
        add(type, m[0], 'text', conf);
        if (m.index === re.lastIndex) re.lastIndex += 1;
      }
    }

    const hashFileRe =
      /\b([a-fA-F0-9]{32}|[a-fA-F0-9]{40}|[a-fA-F0-9]{64})\.(?:exe|dll|sys|bin|dat|msi|tmp|scr|apk|jar|zip|rar|7z)\b/gi;
    let hm;
    while ((hm = hashFileRe.exec(text)) !== null) {
      const hex = hm[1];
      if (hex.length === 64) add('sha256', hex, 'label', 'high');
      else if (hex.length === 40) add('sha1', hex, 'label', 'high');
      else if (hex.length === 32) add('md5', hex, 'label', 'high');
    }

    for (const link of linkList || []) {
      const r = refangValue(strip(link));
      if (!/^https?:\/\//i.test(r) || isNavUrl(r)) continue;
      try {
        const host = new URL(r).hostname;
        if (isIpv4(host)) add('ipv4', host, 'link', 'medium');
        else if (host.includes(':')) add('ipv6', host.replace(/^\[|\]$/g, ''), 'link', 'medium');
        else if (host) add('domain', host, 'link', 'medium');
      } catch {
        /* ignore */
      }
    }
    return truncatedLocal;
  }

  let truncated = false;
  let tweetsHarvested = 0;
  let feedScrolled = false;

  if (selectionOnly) {
    const sel =
      selectedTextOpt ||
      (typeof window !== 'undefined' && window.getSelection
        ? String(window.getSelection())
        : '');
    if (sel.trim()) truncated = runTextPipeline(sel, []);
  } else {
    extractStructured();
    extractLabeledFromDom();

    let mainText;
    if (isTwitterHost() && autoScroll) {
      const harvested = await harvestSocialFeedByScroll();
      mainText = harvested.text || getMainText();
      tweetsHarvested = harvested.tweets || 0;
      feedScrolled = Boolean(harvested.scrolled);
    } else {
      mainText = getMainText();
      if (isTwitterHost() && mainText) {
        tweetsHarvested = mainText.split('\n').filter(Boolean).length;
      }
    }

    const linkRoot =
      document.querySelector(
        'article, [role="main"], main, .main-body, .entry-content, .post-content, .article-content, .ioc-list, .indicators'
      ) || document.body;
    truncated = runTextPipeline(mainText, collectLinks(linkRoot));
  }

  // ---------- 3) 排除当前站 / 同源品牌 / 路径标签 ----------
  const pageHost = location.hostname.toLowerCase();
  const noiseHosts = new Set(NOISE);
  noiseHosts.add(pageHost);
  const hostLabels = pageHost.split('.');
  if (hostLabels.length >= 2) {
    const last2 = hostLabels.slice(-2).join('.');
    const last3 = hostLabels.length >= 3 ? hostLabels.slice(-3).join('.') : null;
    let brand;
    if (last3 && COMMON_TLDS.has(last3)) {
      noiseHosts.add(last3);
      brand = hostLabels[hostLabels.length - 3];
    } else {
      noiseHosts.add(last2);
      brand = hostLabels[hostLabels.length - 2];
    }
    if (brand) {
      for (const t of BRAND_TLDS) noiseHosts.add(`${brand}.${t}`);
    }
  }
  // Securelist ↔ Kaspersky 同源噪音
  if (pageHost.includes('securelist') || pageHost.includes('kaspersky')) {
    ['kaspersky.com', 'kasperskycontenthub.com', 'securelist.com', 'securelist.ru'].forEach((n) =>
      noiseHosts.add(n)
    );
  }

  const pathTags = new Set();
  for (const seg of location.pathname.split('/')) {
    const s = seg.trim().toLowerCase();
    if (s && /^[a-z0-9-]{3,64}$/i.test(s) && !/^\d+$/.test(s)) pathTags.add(s);
  }

  let items = Array.from(map.values()).filter((item) => {
    if (!ALLOWED_TYPES.has(item.type)) return false;
    if (item.type !== 'domain') return true;
    const host = (item.normalized || '').toLowerCase();
    for (const n of noiseHosts) {
      if (host === n || host.endsWith(`.${n}`)) return false;
    }
    const labels = host.split('.');
    if (labels.length === 2 && pathTags.has(labels[0])) return false;
    return true;
  });

  items = items.sort((a, b) => {
    const confOrder = { high: 0, medium: 1, low: 2 };
    const ca = confOrder[a.confidence] ?? 3;
    const cb = confOrder[b.confidence] ?? 3;
    if (ca !== cb) return ca - cb;
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.normalized.localeCompare(b.normalized);
  });
  const stats = {};
  let highCount = 0;
  let fieldCount = 0;
  for (const i of items) {
    stats[i.type] = (stats[i.type] || 0) + 1;
    if (i.confidence === 'high') highCount += 1;
    if (i.source === 'field' || i.source === 'label') fieldCount += 1;
  }

  return {
    items,
    stats,
    total: items.length,
    highCount,
    fieldCount,
    elapsedMs: Math.round(performance.now() - started),
    truncated,
    tweetsHarvested,
    feedScrolled,
    pageUrl: location.href,
    pageTitle: document.title,
    scannedAt: new Date().toISOString(),
    frameUrl: location.href,
  };
}
