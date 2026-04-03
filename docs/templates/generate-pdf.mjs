import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, 'ai-driven-development.html');
const pdfPath  = join(__dirname, 'ai-driven-development.pdf');

const html = readFileSync(htmlPath, 'utf-8');

const CHROME = '/Users/kazuya/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();

// Load HTML — wait for network (Google Fonts)
await page.setContent(html, { waitUntil: 'networkidle' });

// Print-ready overrides
await page.addStyleTag({ content: `
  * { animation: none !important; transition: none !important; }
  body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
` });

// Render at full desktop width (900px content + 96px padding each side = 992px)
const RENDER_W = 992;
await page.setViewportSize({ width: RENDER_W, height: 1080 });

// Wait for fonts to render
await page.waitForTimeout(1500);

const contentHeight = await page.evaluate(() => document.documentElement.scrollHeight);

// A4 landscape: 1123 x 794px (@96dpi)  →  scale so content fills width
const A4_W = 1123;
const scale = A4_W / RENDER_W;

await page.pdf({
  path: pdfPath,
  width:  `${A4_W}px`,
  height: `${Math.ceil(contentHeight * scale)}px`,
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
  scale,
});

await browser.close();
console.log('PDF generated:', pdfPath);
