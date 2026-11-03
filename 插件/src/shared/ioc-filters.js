/**
 * 过滤规则（移植并精简自 hunti/scripts/rss_intel_monitor.py）
 * 用于降低情报页导航/社交/CDN/代码误报
 */

/** 噪音域名：精确或作为后缀匹配（host === x || host.endsWith('.'+x)） */
export const HUNTI_NOISE_DOMAINS = [
  // 主流合法服务 / 社交
  'google.com', 'googleapis.com', 'gstatic.com', 'gmail.com',
  'facebook.com', 'twitter.com', 'x.com', 't.co',
  'microsoft.com', 'office.com', 'live.com', 'office365.com',
  'apple.com', 'icloud.com', 'amazon.com',
  'linkedin.com', 'youtube.com', 'youtu.be', 'instagram.com', 'reddit.com',
  'blogspot.com', 'medium.com', 'github.com', 'githubusercontent.com',
  'gitlab.com', 'bitbucket.org',
  // 安全厂商站点（作为页面噪音；其子域文章内引用可能仍有价值，按后缀过滤页脚链接）
  'kaspersky.com', 'kasperskycontenthub.com', 'kasperskypartners.com',
  'securelist.com', 'securelist.ru', 'securelist.lat', 'securelist.com.br',
  'crowdstrike.com', 'sentinelone.com', 'rapid7.com', 'checkpoint.com',
  'paloaltonetworks.com', 'elastic.co', 'ahnlab.com',
  'thehackernews.com', 'bleepingcomputer.com', 'krebsonsecurity.com',
  'welivesecurity.com', 'virusbulletin.com', 'darktrace.com', 'bitdefender.com',
  'cisa.gov', 'ncsc.gov.uk',
  // CDN / 短链（注意：不排除 cloudflare.com / amazonaws.com 后缀，以免丢掉隧道/C2 主机）
  'cdnjs.cloudflare.com', 'jsdelivr.net', 'unpkg.com',
  'bit.ly', 'tinyurl.com', 'ow.ly', 'buff.ly', 'short.gy', 'tiny.cc',
  'wikipedia.org', 'w3.org', 'schema.org', 'gmpg.org',
  'npmjs.com', 'pypi.org', 'nuget.org', 'docker.com', 'docker.io',
  'telegram.me', 't.me', 'pastebin.com',
  'namecheap.com', 'registrar-servers.com', 'sectigo.com',
  'vercel.app', 'netlify.app', 'pages.dev', 'herokuapp.com', 'github.io',
  'googletagmanager.com', 'google-analytics.com',
  'akismet.com', 'wordpress.com',
  'learn.microsoft.com', 'schemas.microsoft.com',
  // 中文情报站 / 社交（参考链接噪音）
  'qianxin.com', 'ti.qianxin.com', '360.net', 'ti.360.net',
  'weixin.qq.com', 'mp.weixin.qq.com', 'qq.com',
  'weibo.com', 'service.weibo.com',
  'secrss.com', 'aliyuncs.com', 'aliyun.com', 'alicdn.com',
];

/**
 * 域名子串黑名单（出现即丢弃）——来自 hunti EXCLUDE_DOMAIN_PATTERNS 精简版
 * 注意：不要放入会误杀真实 C2 的过宽模式
 */
export const DOMAIN_SUBSTRING_BLOCKLIST = [
  // 文件扩展名片段（避免用过短如 .do/.js，以免误伤 docucloud / 正常域名）
  '.php', '.aspx', '.jsp', '.asp', '.ashx',
  '.exe', '.dll', '.sys', '.scr', '.lnk', '.cpl',
  '.jse', '.vbs', '.vbe', '.ps1', '.bat', '.cmd',
  '.png', '.jpg', '.gif', '.svg', '.ico', '.webp',
  '.css', '.woff', '.map',
  '.docm', '.xlsm', '.xlam', '.xll', '.ppam',
  '.desktop', '.tmp', '.temp', '.hdb', '.pdb',
  // JS/代码属性
  '.length', '.tostring', '.prototype', '.constructor',
  '.stdin', '.stdout', '.stderr', '.buffer',
  // 占位 / 坏链
  'example.com', 'yourdomain', 'your-server',
  'localhost',
  'comnull',
];

/** 表格列头 → IOC 类型（不映射 URL / 邮箱 / CVE） */
export const TABLE_HEADER_TYPE_MAP = [
  { re: /^(ip|ipv4|ip\s*address|ipaddr)$/i, type: 'ipv4' },
  { re: /^(ipv6)$/i, type: 'ipv6' },
  { re: /host\s*names?|domains?|fqdn|hostname/i, type: 'domain' },
  { re: /sha-?256|sha256/i, type: 'sha256' },
  { re: /sha-?1(?!\d)|sha1/i, type: 'sha1' },
  { re: /^(md5|hash)$/i, type: 'md5' },
];

/**
 * 判断是否为噪音 host（hunti 风格）
 */
export function isHuntiNoiseHost(host, extraNoise = []) {
  const h = String(host || '').toLowerCase();
  if (!h) return false;
  const all = extraNoise.length ? [...HUNTI_NOISE_DOMAINS, ...extraNoise] : HUNTI_NOISE_DOMAINS;
  for (const n of all) {
    const nn = n.toLowerCase();
    if (h === nn || h.endsWith(`.${nn}`)) return true;
  }
  return false;
}

export function hasBlockedDomainSubstring(domain) {
  const d = String(domain || '').toLowerCase();
  return DOMAIN_SUBSTRING_BLOCKLIST.some((p) => d.includes(p));
}

/** 过滤内网/保留/组播 IP（移植 hunti _is_relevant_ip） */
export function isPublicIpv4(ip) {
  if (!ip) return false;
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

/** 营销/导航 URL 特征 */
export function isNavOrTrackingUrl(url) {
  const u = String(url || '').toLowerCase();
  if (!u) return true;
  if (u.includes('icid=')) return true;
  if (u.includes('/tag/') || u.includes('/category/') || u.includes('/author/')) return true;
  if (u.includes('facebook.com') || u.includes('twitter.com') || u.includes('linkedin.com/sharing')) {
    return true;
  }
  if (u.includes('/wp-content/') || u.includes('/wp-includes/')) return true;
  return false;
}
