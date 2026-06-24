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
await page.waitForTimeout(2900); // 3·2·1·GO countdown

await page.screenshot({ path: `${OUT}/jump-0-ground.png` });

const canvas = page.locator('canvas').first();
await canvas.focus().catch(() => {});
await page.keyboard.press('Space');
await page.waitForTimeout(180);
await page.screenshot({ path: `${OUT}/jump-1-rising.png` });
await page.waitForTimeout(170);
await page.screenshot({ path: `${OUT}/jump-2-apex.png` });
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/jump-3-falling.png` });
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/jump-4-landed.png` });

const over = await page.getByText('Game Over').isVisible().catch(() => false);
console.log('GAME_OVER_AFTER_JUMP:', over);
console.log('CONSOLE_ERRORS:', JSON.stringify(errors, null, 2));
await browser.close();
