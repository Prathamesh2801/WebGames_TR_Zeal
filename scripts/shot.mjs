import { chromium } from 'playwright';

const OUT = 'scripts/shots';
const URL = 'http://localhost:5174/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 412, height: 810 }, deviceScaleFactor: 2 });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/01-start.png` });

let shot = 0;
async function captureRun(startBtnName) {
  await page.getByRole('button', { name: startBtnName }).click();
  await page.waitForTimeout(2900); // 3·2·1·GO countdown
  for (let i = 0; i < 12; i++) {
    // stop early if the game-over modal appeared
    if (await page.getByText('Game Over').isVisible().catch(() => false)) break;
    shot += 1;
    await page.screenshot({ path: `${OUT}/run-${String(shot).padStart(2, '0')}.png` });
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(800);
}

await captureRun('Start');
// Play a few more rounds to sample more scenery (walls are 1 of 3 variants).
for (let r = 0; r < 3; r++) {
  if (await page.getByText('Game Over').isVisible().catch(() => false)) {
    await captureRun('Retry');
  }
}

console.log('CONSOLE_ERRORS:', JSON.stringify(errors, null, 2));
await browser.close();
