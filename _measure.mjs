import { chromium } from 'playwright';

const sheets = [
  { name: 'idle', file: 'player_idle.png', cols: 4, rows: 2 },
  { name: 'run',  file: 'player_run.png',  cols: 4, rows: 3 },
  { name: 'jump', file: 'player_jump.png', cols: 4, rows: 2 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5175/'); // same-origin so canvas isn't tainted

for (const s of sheets) {
  const res = await page.evaluate(async ({ file, cols, rows }) => {
    const img = new Image();
    img.src = 'http://localhost:5175/assets/templeRun/' + file;
    await img.decode();
    const fw = img.width / cols;
    const fh = img.height / rows;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const out = [];
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const data = ctx.getImageData(col * fw, r * fh, fw, fh).data;
        let minY = fh, maxY = -1;
        for (let y = 0; y < fh; y++) {
          for (let x = 0; x < fw; x++) {
            if (data[(y * fw + x) * 4 + 3] > 16) { // alpha threshold
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              break;
            }
          }
        }
        const contentH = maxY - minY + 1;
        out.push({ h: +(contentH / fh).toFixed(3), feet: +((maxY + 1) / fh).toFixed(3), top: +(minY / fh).toFixed(3) });
      }
    }
    return { fw, fh, frac: out };
  }, s);
  const hs = res.frac.map((f) => f.h);
  const feet = res.frac.map((f) => f.feet);
  console.log(`${s.name}: frame ${Math.round(res.fw)}x${Math.round(res.fh)}`);
  console.log(`  height frac : [${hs.join(', ')}]  max=${Math.max(...hs)}`);
  console.log(`  feet  frac : [${feet.join(', ')}]  min=${Math.min(...feet)} max=${Math.max(...feet)}`);
}

await browser.close();
