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

// A4 page dimensions at 96dpi: 794px × 1123px
// We render at 794px width so 1mm = ~3.78px
await page.setViewportSize({ width: 794, height: 1123 });

// Load HTML — wait for Google Fonts to load
await page.setContent(html, { waitUntil: 'networkidle' });

// Print overrides
await page.addStyleTag({ content: `
  * { animation: none !important; transition: none !important; }
  body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
` });

// Wait for fonts to render
await page.waitForTimeout(2000);

// Generate multi-page A4 PDF
await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
});

await browser.close();
console.log('PDF generated:', pdfPath);
