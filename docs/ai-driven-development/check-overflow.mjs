import { chromium } from 'playwright';
import { readFileSync } from 'fs';
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
await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; }' });
await page.waitForTimeout(500);

const results = await page.evaluate(() => {
  const pages = document.querySelectorAll('.page');
  const issues = [];

  pages.forEach((p, i) => {
    const pageRect = p.getBoundingClientRect();
    const pageMaxH = pageRect.height;

    // 1) Check page-level overflow
    const directChildren = Array.from(p.children).filter(c =>
      !c.classList.contains('page-footer') && !c.classList.contains('page-stripe')
    );

    let maxChildBottom = 0;
    directChildren.forEach(el => {
      const r = el.getBoundingClientRect();
      const relBottom = r.bottom - pageRect.top;
      if (relBottom > maxChildBottom) maxChildBottom = relBottom;
    });
    const pageOverflow = maxChildBottom - pageMaxH;

    // 2) Check for internally clipped elements (scrollHeight > clientHeight)
    const clippedInternally = [];
    p.querySelectorAll('*').forEach(el => {
      if (el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0) {
        const r = el.getBoundingClientRect();
        const relTop = r.top - pageRect.top;
        const relBottom = r.bottom - pageRect.top;
        clippedInternally.push({
          tag: el.tagName,
          cls: el.className.slice(0, 40),
          scrollH: Math.round(el.scrollHeight),
          clientH: Math.round(el.clientHeight),
          clip: Math.round(el.scrollHeight - el.clientHeight),
          relTop: Math.round(relTop),
          relBottom: Math.round(relBottom),
          text: el.textContent.slice(0, 60).trim(),
        });
      }
    });

    if (pageOverflow > 2 || clippedInternally.length > 0) {
      issues.push({
        page: i + 1,
        pageH: Math.round(pageMaxH),
        pageOverflow: Math.round(pageOverflow),
        lastChildBottom: Math.round(maxChildBottom),
        lastEl: directChildren[directChildren.length - 1]
          ? { tag: directChildren[directChildren.length - 1].tagName, cls: directChildren[directChildren.length - 1].className.slice(0, 40), text: directChildren[directChildren.length - 1].textContent.slice(0, 60).trim() }
          : null,
        clippedInternally,
      });
    }
  });
  return issues;
});

console.log('=== OVERFLOW & CLIP REPORT ===');
const targetPages = [7, 11, 21, 33, 36];

results.forEach(r => {
  if (!targetPages.includes(r.page) && r.pageOverflow <= 2) return; // Only show target pages or overflowing pages

  console.log(`\n========= P${r.page} =========`);
  if (r.pageOverflow > 2) {
    console.log(`  [PAGE OVERFLOW] ${r.pageOverflow}px over limit (maxChild=${r.lastChildBottom}px / pageH=${r.pageH}px)`);
    if (r.lastEl) console.log(`  Last child: <${r.lastEl.tag} class="${r.lastEl.cls}"> "${r.lastEl.text}"`);
  } else {
    console.log(`  Page fits (maxChild=${r.lastChildBottom}px / pageH=${r.pageH}px)`);
  }
  if (r.clippedInternally.length > 0) {
    console.log(`  Internally clipped elements:`);
    r.clippedInternally.forEach(el => {
      console.log(`    <${el.tag} class="${el.cls}"> scrollH=${el.scrollH} clientH=${el.clientH} clip=${el.clip}px @ top=${el.relTop}px`);
      console.log(`      "${el.text}"`);
    });
  } else {
    console.log(`  No internal clipping detected.`);
  }
});

await browser.close();
