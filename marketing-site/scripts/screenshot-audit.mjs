import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'ui-audit-screenshots');
mkdirSync(outDir, { recursive: true });

const url = 'http://127.0.0.1:3000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  console.log('Navigating to', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Full page screenshot
  console.log('Capturing full page...');
  await page.screenshot({ path: join(outDir, '01-full-page.png'), fullPage: true });

  // Capture each major section by scrolling
  const sections = [
    { name: '02-hero', y: 0 },
    { name: '03-features', y: 900 },
    { name: '04-platform', y: 1800 },
    { name: '05-analytics', y: 2700 },
    { name: '06-roi-calculator', y: 3600 },
    { name: '07-memberships', y: 4500 },
    { name: '08-testimonials', y: 5400 },
    { name: '09-cta', y: 6300 },
  ];

  for (const s of sections) {
    await page.evaluate((y) => window.scrollTo(0, y), s.y);
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(outDir, `${s.name}.png`) });
  }

  // Capture at mobile viewport too
  await browser.close();

  const mobileBrowser = await chromium.launch({ headless: true });
  const mobileContext = await mobileBrowser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: join(outDir, '10-mobile-full.png'), fullPage: true });
  await mobileBrowser.close();

  console.log('Done! Screenshots saved to', outDir);
})();
