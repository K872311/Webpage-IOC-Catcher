/** IOC 类型与数据结构 */

export const IOC_TYPES = Object.freeze({
  DOMAIN: 'domain',
  IPV4: 'ipv4',
  IPV6: 'ipv6',
  MD5: 'md5',
  SHA1: 'sha1',
  SHA256: 'sha256',
});

export const IOC_TYPE_LABELS = Object.freeze({
  domain: '域名',
  ipv4: 'IPv4',
  ipv6: 'IPv6',
  md5: 'MD5',
  sha1: 'SHA1',
  sha256: 'SHA256',
});

/** 仅展示/导出这些类型（不再采集 URL / 邮箱 / CVE） */
export const IOC_TYPE_ORDER = [
  'domain',
  'ipv4',
  'ipv6',
  'md5',
  'sha1',
  'sha256',
];

export const ALLOWED_IOC_TYPES = new Set(IOC_TYPE_ORDER);

/**
 * @typedef {Object} IocItem
 * @property {string} type
 * @property {string} value
 * @property {string} normalized
 * @property {'text'|'link'|'label'|'field'} source
 * @property {number} count
 * @property {number} firstSeen
 */
