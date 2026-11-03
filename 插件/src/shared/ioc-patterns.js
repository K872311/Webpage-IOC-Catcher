/** IOC 正则规则库与白名单 */

/**
 * 允许的公共后缀（白名单）。不再使用「任意字母 TLD」回退。
 */
export const COMMON_TLDS = new Set([
  'com', 'net', 'org', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'name', 'pro',
  'io', 'co', 'ai', 'app', 'dev', 'tech', 'cloud', 'online', 'site', 'xyz', 'top',
  'vip', 'club', 'store', 'shop', 'blog', 'news', 'media', 'security', 'email',
  'live', 'today', 'world', 'space', 'website', 'fun', 'icu', 'buzz',
  'quest', 'bond', 'cfd', 'cyou', 'lol', 'ink', 'one', 'win', 'bid', 'trade',
  'science', 'click', 'link', 'work', 'digital', 'software', 'support',
  'systems', 'network', 'company', 'center', 'global', 'group', 'ltd', 'llc',
  'wang', 'xin', 'ren', 'mobi', 'asia', 'tel', 'xxx', 'aero', 'jobs', 'museum',
  'coop', 'post',
  'cn', 'uk', 'de', 'fr', 'jp', 'kr', 'ru', 'au', 'ca', 'us', 'eu', 'nl', 'br',
  'in', 'sg', 'hk', 'tw', 'me', 'tv', 'cc', 'ws', 'to', 'gg', 'ly', 'sh', 'so',
  'pw', 'tk', 'ml', 'ga', 'cf', 'gq', 'su', 'ua', 'pl', 'it', 'es', 'se', 'no',
  'fi', 'dk', 'ch', 'at', 'be', 'pt', 'ie', 'nz', 'za', 'mx', 'ar', 'cl', 'tr',
  'il', 'ae', 'sa', 'th', 'vn', 'id', 'ph', 'my', 'pk', 'bd', 'ng', 'ke', 'eg',
  'bg', 'ro', 'hu', 'cz', 'sk', 'hr', 'rs', 'si', 'lt', 'lv', 'ee', 'is', 'lu',
  'mt', 'cy', 'gr', 'by', 'kz', 'uz', 'ge', 'am', 'az', 'md', 'al', 'mk', 'ba',
  'bm', 'bs', 'bb', 'jm', 'tt', 'gy', 'sr', 'bz', 'hn', 'gt', 'sv', 'ni', 'cr',
  'pa', 'cu', 'do', 'ht', 'pr', 'vi', 'ag', 'lc', 'vc', 'gd', 'kn', 'dm', 'ms',
  'ky', 'vg', 'tc', 'ai', 'sx', 'cw', 'aw', 'sz', 'ls', 'mu', 'sc', 'st',
  'gov.cn', 'com.cn', 'net.cn', 'org.cn', 'edu.cn', 'ac.cn',
  'co.uk', 'ac.uk', 'org.uk', 'gov.uk', 'me.uk',
  'com.au', 'net.au', 'org.au', 'edu.au',
  'co.jp', 'or.jp', 'ne.jp', 'ac.jp', 'go.jp',
  'com.tw', 'com.hk', 'com.sg', 'com.br', 'com.mx', 'com.ru',
  'co.kr', 'co.in', 'co.za', 'co.nz', 'com.tr', 'com.ua',
]);

/** 排除的域名/主机名（精确匹配） */
export const EXCLUDED_DOMAINS = new Set([
  'localhost',
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'local',
  'internal',
  'invalid',
  // 技术产品名误报
  'asp.net',
  'microsoft.net',
  'wordpress.com',
]);

/**
 * 全局噪音域名（情报页页眉/页脚/社交/CDN，非子站 C2）
 * 匹配：精确或 *.suffix
 */
export const NOISE_DOMAINS = new Set([
  'beian.miit.gov.cn',
  'www.beian.gov.cn',
  'beian.gov.cn',
  'zz.bdstatic.com',
  'hm.baidu.com',
  'www.google-analytics.com',
  'www.googletagmanager.com',
  'googletagmanager.com',
  'google-analytics.com',
  'github.com',
  'gist.github.com',
  'githubusercontent.com',
  'twitter.com',
  'x.com',
  't.co',
  'linkedin.com',
  'www.linkedin.com',
  'facebook.com',
  'youtube.com',
  'youtu.be',
  'google.com',
  'googleapis.com',
  'gstatic.com',
  'w3.org',
  'www.w3.org',
  'gmpg.org',
  'namecheap.com',
  'www.namecheap.com',
  'registrar-servers.com',
  'freedesktop.org',
  'www.freedesktop.org',
  'schemas.microsoft.com',
  'schemas.openxmlformats.org',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'ajax.googleapis.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
]);

/** 品牌噪音要追加的常见 TLD */
export const BRAND_NOISE_TLDS = [
  'com', 'cn', 'net', 'org', 'io', 'tech', 'xyz', 'online', 'site', 'app', 'dev',
  'co', 'me', 'info', 'pro', 'shop', 'store', 'cloud',
];

/**
 * 代码/API 属性链标签：sys.stdin.read / time.now 等
 */
export const CODE_FALSE_LABELS = new Set([
  'stdin', 'stdout', 'stderr', 'buffer', 'read', 'write', 'now', 'length',
  'prototype', 'tostring', 'valueof', 'constructor', 'tostring', 'hasownproperty',
  'isnullorundefined', 'getelementbyid', 'queryselector', 'innerhtml', 'outerhtml',
  'textcontent', 'classname', 'classlist', 'appendchild', 'removechild',
  'addEventListener', 'addeventlistener', 'createelement', 'getattribute',
  'setattribute', 'encodeuricomponent', 'decodeuricomponent',
]);

/**
 * 文件扩展名（绝不能当 TLD）
 * 勿放入真实 gTLD（如 com）
 */
export const FILE_EXTENSIONS = new Set([
  // 文档 / 网页
  'js', 'mjs', 'cjs', 'css', 'html', 'htm', 'json', 'xml', 'txt', 'pdf', 'md',
  'csv', 'rtf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods',
  // Office 宏 / 加载项（Breakglass 文中大量误报）
  'docm', 'xlsm', 'xlsb', 'xltm', 'pptm', 'ppsm', 'potm', 'dotm',
  'xlam', 'xll', 'ppam', 'ppa', 'hwp', 'hwpx',
  // Linux / 桌面 / Web
  'desktop', 'service', 'socket', 'timer', 'target', 'path', 'mount', 'automount',
  'scope', 'slice', 'swap', 'device', 'conf', 'do', 'action',
  // 图片 / 媒体
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'tif', 'tiff',
  'mp4', 'mp3', 'wav', 'avi', 'mkv', 'mov', 'flv', 'wmv', 'aac', 'ogg',
  // 压缩
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'cab', 'iso', 'img', 'dmg',
  // 可执行 / 样本
  'exe', 'dll', 'sys', 'drv', 'bin', 'dat', 'msi', 'msp', 'msu', 'scr',
  'bat', 'cmd', 'ps1', 'vbs', 'vbe', 'jse', 'wsf', 'wsh', 'lnk', 'pif', 'cpl',
  'jar', 'apk', 'dex', 'dylib', 'ocx', 'ax', 'efi', 'tmp', 'temp',
  'hdb', 'pdb', 'ilk', 'exp', 'lib', 'obj', 'ko',
  // 源码（注意：sh/so 是真实 ccTLD，不能放这里）
  'py', 'pyc', 'pyw', 'java', 'class', 'c', 'cpp', 'cc', 'h', 'hpp', 'go', 'rs',
  'php', 'rb', 'pl', 'pm', 'ts', 'tsx', 'jsx', 'vue', 'swift', 'kt', 'cs', 'fs',
  'bash', 'zsh', 'fish', 'psm1', 'psd1',
  // 配置 / 日志 / 字体
  'yml', 'yaml', 'toml', 'ini', 'cfg', 'config', 'log', 'bak', 'old',
  'cache', 'lock', 'map', 'wasm', 'woff', 'woff2', 'ttf', 'eot', 'otf',
  // 其他
  'db', 'sqlite', 'sql', 'mdb', 'accdb', 'pkg', 'deb', 'rpm', 'nupkg',
  'reg', 'inf', 'cat', 'msc', 'msp', 'msix', 'appx',
]);

/**
 * 提取规则：按优先级排列（哈希优先）
 */
export const IOC_PATTERNS = [
  {
    type: 'sha256',
    pattern: /\b[a-fA-F0-9]{64}\b/g,
  },
  {
    type: 'sha1',
    pattern: /\b[a-fA-F0-9]{40}\b/g,
  },
  {
    type: 'md5',
    pattern: /\b[a-fA-F0-9]{32}\b/g,
  },
  {
    type: 'ipv4',
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g,
  },
  {
    type: 'ipv6',
    pattern: /\b(?:(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}|(?:[a-fA-F0-9]{1,4}:){1,7}:|(?:[a-fA-F0-9]{1,4}:){1,6}:[a-fA-F0-9]{1,4}|(?:[a-fA-F0-9]{1,4}:){1,5}(?::[a-fA-F0-9]{1,4}){1,2}|(?:[a-fA-F0-9]{1,4}:){1,4}(?::[a-fA-F0-9]{1,4}){1,3}|(?:[a-fA-F0-9]{1,4}:){1,3}(?::[a-fA-F0-9]{1,4}){1,4}|(?:[a-fA-F0-9]{1,4}:){1,2}(?::[a-fA-F0-9]{1,4}){1,5}|[a-fA-F0-9]{1,4}:(?::[a-fA-F0-9]{1,4}){1,6}|:(?::[a-fA-F0-9]{1,4}){1,7}|::(?:ffff(?::0{1,4})?:)?(?:(?:25[0-5]|(?:2[0-4]|1?\d)?\d)\.){3}(?:25[0-5]|(?:2[0-4]|1?\d)?\d))\b/gi,
  },
  {
    type: 'domain',
    pattern: /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\s*[\[\(]\s*\.\s*[\]\)]\s*|\.))+(?:[a-zA-Z]{2,24}|xn--[a-zA-Z0-9-]{2,59})\b/g,
  },
];
