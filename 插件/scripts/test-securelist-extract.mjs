/**
 * 回归：Securelist 风格 IOC 分节（File hashes / Domains and IPs + 多级 Azure/S3）
 * 样本：https://securelist.com/mirage-kitten-new-backdoors-noderabbit-pollcat/121244/
 * 用法：node scripts/test-securelist-extract.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const SAMPLE = `
Infrastructure
Mirage Kitten continues to rely on Azure Websites.

| Domain | Registrar |
| naturalapplication.azurewebsites[.]netretaildemo.azurewebsites[.]nettubitak.azurewebsites[.]net | MarkMonitor |
| healthcomfsdpower[.]comvisitfinancedentists[.]com | NameCheap |
| oracle-challenge.s3[.]us-east-1.amazonaws[.]com | Amazon |

Attribution
Structural similarities (MD5:\`810F8E3B88EB05F710C09552941D6F56\`)

Indicators of compromise

File hashes
CBAAF0900A13F28E380F49ADECEC932C FrontEnd-Task.zip
1EA83E4E4592B01E4ACAB63EB867BEE5 Front-Technical-Challenge.zip
366515822D5AC1CC500711EF57A2E32E Task-FullStack.zip
CF449F1992C2819E62AC44A0B06AC2E7 fullstack-1536.zip
E95A4366686E3F786EA3C056FAB5B0DA webapp76592.zip

Domains and IPs
oracle-challenge.s3[.]us-east-1.amazonaws[.]com
naturalapplication.azurewebsites[.]net
retaildemo.azurewebsites[.]net
tubitak.azurewebsites[.]net
healthcomfsdpower[.]com
visitfinancedentists[.]com
kyrasey-f8hfexa5cqamh7fk.westeurope-01.azurewebsites[.]net
msmanagementgrp[.]com
lifespotify[.]com
sahi-finance[.]com
healthful-hub[.]com
mens-health-online[.]com

Targeted attacks
GReAT webinars
kaspersky.com securelist.com
`.trim();

const EXPECTED_MD5 = [
  'cbaaf0900a13f28e380f49adecec932c',
  '1ea83e4e4592b01e4acab63eb867bee5',
  '366515822d5ac1cc500711ef57a2e32e',
  'cf449f1992c2819e62ac44a0b06ac2e7',
  'e95a4366686e3f786ea3c056fab5b0da',
  '810f8e3b88eb05f710c09552941d6f56',
];

const EXPECTED_DOMAIN = [
  'oracle-challenge.s3.us-east-1.amazonaws.com',
  'naturalapplication.azurewebsites.net',
  'retaildemo.azurewebsites.net',
  'tubitak.azurewebsites.net',
  'healthcomfsdpower.com',
  'visitfinancedentists.com',
  'kyrasey-f8hfexa5cqamh7fk.westeurope-01.azurewebsites.net',
  'msmanagementgrp.com',
  'lifespotify.com',
  'sahi-finance.com',
  'healthful-hub.com',
  'mens-health-online.com',
];

const FORBIDDEN = [
  'kaspersky.com',
  'securelist.com',
  'markmonitor.com',
  'namecheap.com',
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
      baseURI: 'https://securelist.com/mirage-kitten/121244/',
      title: 'Mirage Kitten | Securelist',
      querySelector(sel) {
        const first = String(sel).split(',')[0].trim();
        if (
          ['.c-wysiwyg', 'article', 'main', '[role="main"]', '.entry-content'].includes(first)
        ) {
          return main;
        }
        return null;
      },
      querySelectorAll: emptyList,
    },
    location: {
      hostname: 'securelist.com',
      href: 'https://securelist.com/mirage-kitten/121244/',
      pathname: '/mirage-kitten/121244/',
    },
    performance: { now: () => 1 },
    URL,
    console,
    window: { scrollBy() {}, scrollTo() {}, scrollY: 0, innerHeight: 800 },
  };
}

async function main() {
  const src = readFileSync(join(root, 'src', 'background', 'inline-extract.js'), 'utf8');
  const wrapped =
    src.replace(
      /^export async function inlineExtract|^export function inlineExtract/m,
      'async function inlineExtract'
    ) + '\nthis.__result = inlineExtract({ autoScroll: false });\n';

  const sandbox = buildSandbox(SAMPLE);
  const ctx = createContext(sandbox);
  runInContext(wrapped, ctx, { filename: 'inline-extract.js' });
  let result = sandbox.__result;
  if (result?.then) result = await result;

  const high = (result.items || []).filter(
    (i) => i.confidence === 'high' || i.source === 'label' || i.source === 'field'
  );
  const byType = (t) =>
    new Set(
      high
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

  check('md5', byType('md5'), EXPECTED_MD5);
  check('domain', byType('domain'), EXPECTED_DOMAIN);

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
  if (failed) process.exit(1);
  console.log('All securelist checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
