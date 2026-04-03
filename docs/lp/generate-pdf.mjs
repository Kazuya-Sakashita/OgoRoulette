import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, 'index.html');
const pdfPath  = join(__dirname, 'ogoroulette-lp.pdf');

const html = readFileSync(htmlPath, 'utf-8');

const CHROME = '/Users/kazuya/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();

// Load HTML directly so no network needed for base content
await page.setContent(html, { waitUntil: 'networkidle' });

// Inject print-ready overrides: stop all animations, fix sticky nav
await page.addStyleTag({ content: `
  * { animation: none !important; transition: none !important; }
  .nav { position: relative !important; }
  .hero { padding-top: 60px !important; }
  body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
` });

// Render at mobile width (HTML is designed for ~480px containers)
// then scale up to A4 width (794px ≈ 210mm at 96dpi)
const RENDER_W = 480;
const A4_W = 794;
const scale = A4_W / RENDER_W; // ≈ 1.65

await page.setViewportSize({ width: RENDER_W, height: 1000 });
const contentHeight = await page.evaluate(() => document.documentElement.scrollHeight);

// Generate as a single long page — no page breaks, no cut lines
await page.pdf({
  path: pdfPath,
  width: `${A4_W}px`,
  height: `${Math.ceil(contentHeight * scale)}px`,
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
  scale,
});

await browser.close();
console.log('PDF generated:', pdfPath);
