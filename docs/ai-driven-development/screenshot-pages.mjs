import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const htmlPath = join('.', 'guide-v3.html');
const html = readFileSync(htmlPath, 'utf-8');
const CHROME = '/Users/kazuya/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
const A4_W = 794;
const A4_H = 1123;
await page.setViewportSize({ width: A4_W, height: A4_H });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; } body { -webkit-print-color-adjust: exact !important; }' });
await page.waitForTimeout(500);
mkdirSync('screenshots', { recursive: true });
const pages = await page.$$('.page');
console.log('Total pages:', pages.length);
for (let i = 0; i < pages.length; i++) {
  await pages[i].screenshot({ path: `screenshots/page-${String(i+1).padStart(2,'0')}.png` });
  console.log('Captured page', i+1);
}
await browser.close();
