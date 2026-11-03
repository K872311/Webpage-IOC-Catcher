/**
 * 回归：X/Twitter 风格 defang IOC（#C2 #IOC + 45[.]61[.]…）
 * 用法：node scripts/test-twitter-defang.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const TWEETS = `
#C2 #APT #Malware #IOC 45[.]61[.]137[.]107 sacksolution[.]info
#C2 #APT #Malware #IOC basiner[.]xyz 193[.]243[.]147[.]71
#C2 #APT #Malware #IOC 38[.]132[.]122[.]174 cowound[.]com
#C2 #APT #Malware #IOC wingsiy[.]com 89[.]110[.]95[.]204
#C2 #APT #Malware #IOC f2f-peopleconnect[.]com 216[.]238[.]87[.]147
`.trim();

const EXPECTED = {
  ipv4: [
    '45.61.137.107',
    '193.243.147.71',
    '38.132.122.174',
    '89.110.95.204',
    '216.238.87.147',
  ],
  domain: [
    'sacksolution.info',
    'basiner.xyz',
    'cowound.com',
    'wingsiy.com',
    'f2f-peopleconnect.com',
  ],
};

function buildSandbox(text) {
  const tweetNodes = text.split('\n').map((line) => ({
    innerText: line,
    textContent: line,
  }));
  return {
    document: {
      body: { innerText: text },
      baseURI: 'https://x.com/phatomcandle',
      querySelector(sel) {
        if (sel === '[data-testid="primaryColumn"]' || sel === '[role="main"]' || sel === 'main') {
          return { innerText: text };
        }
        return null;
      },
      querySelectorAll(sel) {
        if (sel === '[data-testid="tweetText"]') return tweetNodes;
        if (sel === 'article' || sel === 'article[data-testid="tweet"]') return [];
        if (sel === '*') return [];
        return [];
      },
    },
    location: {
      hostname: 'x.com',
      href: 'https://x.com/phatomcandle',
      pathname: '/phatomcandle',
    },
    performance: { now: () => 1 },
    URL,
    console,
    window: {},
  };
}

async function main() {
  const src = readFileSync(join(root, 'src', 'background', 'inline-extract.js'), 'utf8');
  const wrapped =
    src.replace(/^export async function inlineExtract|^export function inlineExtract/m, 'async function inlineExtract') +
    '\nthis.__result = inlineExtract({ autoScroll: false });\n';

  const sandbox = buildSandbox(TWEETS);
  sandbox.window = { scrollBy() {}, scrollTo() {}, scrollY: 0, innerHeight: 800 };
  // queryAllDeep / collectRoots 会调 document.querySelectorAll('*')
  const ctx = createContext(sandbox);
  runInContext(wrapped, ctx, { filename: 'inline-extract.js' });
  let result = sandbox.__result;
  if (result && typeof result.then === 'function') result = await result;

  const byType = (t) =>
    new Set(
      (result.items || [])
        .filter((i) => i.type === t)
        .map((i) => String(i.normalized || i.value || '').toLowerCase())
    );

  let failed = 0;
  function check(name, got, want) {
    const missing = want.filter((w) => !got.has(w.toLowerCase()));
    if (missing.length) {
      console.error(`FAIL ${name}: missing`, missing);
      console.error('  got:', [...got].sort());
      failed += 1;
    } else {
      console.log(`OK   ${name}: ${want.length}`);
    }
  }

  check('ipv4', byType('ipv4'), EXPECTED.ipv4);
  check('domain', byType('domain'), EXPECTED.domain);

  const high = (result.items || []).filter(
    (i) => i.confidence === 'high' || i.source === 'label' || i.source === 'field'
  );
  if (high.length < 8) {
    console.error(`FAIL high-confidence too low: ${high.length}`);
    failed += 1;
  } else {
    console.log(`OK   high-confidence: ${high.length}`);
  }

  // 不应把 x.com / twitter 自身当 IOC
  const leaked = [...byType('domain')].filter((d) => d === 'x.com' || d.endsWith('.x.com'));
  if (leaked.length) {
    console.error('FAIL noise leaked:', leaked);
    failed += 1;
  } else {
    console.log('OK   x.com filtered');
  }

  console.log(`total=${result.total}`);
  if (failed) process.exit(1);
  console.log('All twitter-defang checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
