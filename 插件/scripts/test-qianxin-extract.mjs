/**
 * 回归：奇安信式「IOC / MODBEACON-MD5 / ghost C2」分节（精确/高置信）。
 * 用法：node scripts/test-qianxin-extract.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const SAMPLE_TEXT = `
背景
银狐 Ghost 分发商投递 MODBEACON 特马。
参考：https://mp.weixin.qq.com/s/xxx https://ti.qianxin.com/blog/x https://www.secrss.com/articles/1
坏链 ti.qianxin.comnull 以及 share.php
代码噪音 xray.transport.internet.grpc.encoding.grpcservice
CDN asd268668.oss-ap-southeast-1.aliyuncs.com

IOC
MODBEACON-MD5:
13aff4f82171d42e7f0a72dc96346c45
f6c69d8026d2114e5322f06f69471a6c
9913b09fddbe47d4459c1ae0aa8c4953
e32797efc17c8a9a663f6f0e64fcfa08
MODBEACON C2:
skystackservice.com
fast-cloud-node.com
api.skystackservice.com
api.fast-cloud-node.com
ghost C2:
www.nd9c887r.com
www.damaix9k.com
vaeth.cn
182.16.88.242:22
kkuu8899.org
参考链接
[1] https://mp.weixin.qq.com/s/BUDSvqc
[2] https://ti.qianxin.com/blog/articles/x
[3] https://www.secrss.com/articles/27069
`.trim();

const EXPECTED = {
  md5: [
    '13aff4f82171d42e7f0a72dc96346c45',
    'f6c69d8026d2114e5322f06f69471a6c',
    '9913b09fddbe47d4459c1ae0aa8c4953',
    'e32797efc17c8a9a663f6f0e64fcfa08',
  ],
  domain: [
    'skystackservice.com',
    'fast-cloud-node.com',
    'api.skystackservice.com',
    'api.fast-cloud-node.com',
    'www.nd9c887r.com',
    'www.damaix9k.com',
    'vaeth.cn',
    'kkuu8899.org',
  ],
  ipv4: ['182.16.88.242'],
};

const FORBIDDEN = [
  'https',
  'http',
  'share.php',
  'ti.qianxin.com',
  'ti.qianxin.comnull',
  'mp.weixin.qq.com',
  'www.secrss.com',
  'asd268668.oss-ap-southeast-1.aliyuncs.com',
  'xray.transport.internet.grpc.encoding.grpcservice',
];

function emptyList() {
  return [];
}

function buildSandbox(text) {
  const main = {
    innerText: text,
    querySelectorAll: emptyList,
  };
  return {
    document: {
      body: { innerText: text },
      baseURI: 'https://ti.qianxin.com/blog/demo',
      querySelector(sel) {
        const first = String(sel)
          .split(',')
          .map((s) => s.trim())[0];
        if (
          first === '.main-body' ||
          first === 'article' ||
          first === 'main' ||
          first === '[role="main"]'
        ) {
          return main;
        }
        return null;
      },
      querySelectorAll: emptyList,
    },
    location: {
      hostname: 'ti.qianxin.com',
      href: 'https://ti.qianxin.com/blog/demo',
      pathname: '/blog/demo',
    },
    performance: { now: () => 1 },
    URL,
    console,
  };
}

async function main() {
  const src = readFileSync(join(root, 'src', 'background', 'inline-extract.js'), 'utf8');
  const wrapped =
    src.replace(/^export async function inlineExtract|^export function inlineExtract/m, 'async function inlineExtract') +
    '\nthis.__result = inlineExtract({ autoScroll: false });\n';

  const sandbox = buildSandbox(SAMPLE_TEXT);
  sandbox.window = { scrollBy() {}, scrollTo() {}, scrollY: 0, innerHeight: 800 };
  const ctx = createContext(sandbox);
  runInContext(wrapped, ctx, { filename: 'inline-extract.js' });
  let result = sandbox.__result;
  if (result && typeof result.then === 'function') result = await result;

  const high = (result.items || []).filter(
    (i) => i.confidence === 'high' || i.source === 'label' || i.source === 'field'
  );
  const byType = (t) =>
    new Set(
      high.filter((i) => i.type === t).map((i) => String(i.normalized || i.value || '').toLowerCase())
    );

  let failed = 0;
  function check(name, got, want) {
    const missing = want.filter((w) => !got.has(w.toLowerCase()));
    if (missing.length) {
      console.error(`FAIL ${name}: missing`, missing);
      console.error(
        '  got:',
        [...got].sort()
      );
      failed += 1;
    } else {
      console.log(`OK   ${name}: ${want.length}`);
    }
  }

  check('md5', byType('md5'), EXPECTED.md5);
  check('domain', byType('domain'), EXPECTED.domain);
  check('ipv4', byType('ipv4'), EXPECTED.ipv4);

  if ([...byType('ipv4')].some((v) => v.includes(':'))) {
    console.error('FAIL ipv4: 不应带端口');
    failed += 1;
  }

  const allVals = new Set(
    (result.items || []).map((i) => String(i.normalized || i.value || '').toLowerCase())
  );
  const leaked = FORBIDDEN.filter((f) => allVals.has(f.toLowerCase()));
  if (leaked.length) {
    console.error('FAIL noise leaked:', leaked);
    failed += 1;
  } else {
    console.log(`OK   noise filtered: ${FORBIDDEN.length}`);
  }

  console.log(`high=${high.length} total=${result.total}`);
  if (failed) {
    process.exit(1);
  }
  console.log('All checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
