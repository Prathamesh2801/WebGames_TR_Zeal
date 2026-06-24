import { chromium } from 'playwright';

const OUT = 'C:/Users/singh/AppData/Local/Temp/claude/c--Users-singh-Desktop-Prathamesh-Web-Games-Temple-Run/c73b4421-135a-4913-bc7d-b05482971a89/scratchpad';
const URL = 'http://localhost:5175/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 412, height: 810 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'Start' }).click();
await page.waitForTimeout(2900); // countdown

// Tutorial window (~5s): sample the three hints + confirm no spawns.
for (let i = 0; i < 5; i++) {
  await page.screenshot({ path: `${OUT}/tut-${i}.png` });
  await page.waitForTimeout(900);
}
// Just after tutorial ends → spawns should resume.
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/tut-after.png` });

console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
await browser.close();
