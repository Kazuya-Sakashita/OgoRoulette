import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, 'guide-v3.html');
const pdfDir  = join(__dirname, 'pdf');
const pdfPath  = join(pdfDir, 'ai-driven-development-guide-v3.pdf');

mkdirSync(pdfDir, { recursive: true });
const html = readFileSync(htmlPath, 'utf-8');

const CHROME = '/Users/kazuya/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();

// A4 at 96dpi = 794 x 1123px
const A4_W = 794;
const A4_H = 1123;

await page.setViewportSize({ width: A4_W, height: A4_H });
await page.setContent(html, { waitUntil: 'networkidle' });

// Stop animations for clean PDF rendering; ensure print color accuracy
await page.addStyleTag({ content: `
  * { animation: none !important; transition: none !important; }
  body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @media print {
    .page { page-break-after: always; }
  }
` });

// Wait for any web fonts or layout to settle
await page.waitForTimeout(500);

// Page count check
const pageCount = await page.evaluate(() => document.querySelectorAll('.page').length);
console.log(`Detected ${pageCount} pages`);

await page.pdf({
  path: pdfPath,
  width: `${A4_W}px`,
  height: `${A4_H}px`,
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
  scale: 1,
});

await browser.close();
console.log('PDF generated:', pdfPath);
