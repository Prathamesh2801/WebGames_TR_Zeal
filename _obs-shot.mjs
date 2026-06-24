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
await page.waitForTimeout(2900);

for (let i = 0; i < 20; i++) {
  if (await page.getByText('Game Over').isVisible().catch(() => false)) break;
  await page.screenshot({ path: `${OUT}/obs-${String(i).padStart(2, '0')}.png` });
  await page.waitForTimeout(200);
}
console.log('CONSOLE_ERRORS:', JSON.stringify(errors));
await browser.close();
