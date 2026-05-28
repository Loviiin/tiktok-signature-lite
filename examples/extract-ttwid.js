// POC: extrai `ttwid` via document.cookie e via page.cookies() (Puppeteer)
// Requisitos: `npm install puppeteer`

import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://www.tiktok.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
    // aguarda scripts definirem cookies
    await new Promise((r) => setTimeout(r, 3000));

    // cookies acessíveis via document.cookie (não incluem HttpOnly)
    const docCookies = await page.evaluate(() => document.cookie || '');

    // todos os cookies (inclui HttpOnly) via API Puppeteer
    const allCookies = await page.cookies();

    console.log('document.cookie:', docCookies);

    const ttwidFromDoc = (docCookies.match(/ttwid=([^;]+)/) || [])[1] || null;
    console.log('ttwid from document.cookie:', ttwidFromDoc);

    const ttwidCookie = allCookies.find((c) => c.name === 'ttwid');
    console.log('ttwid from page.cookies():', ttwidCookie ? ttwidCookie.value : null);

    console.log('\nAll cookies (puppeteer):');
    console.log(allCookies.map(c => ({ name: c.name, value: c.value, httpOnly: c.httpOnly })).slice(0, 50));
  } catch (e) {
    console.error('Erro durante POC:', e);
  } finally {
    await browser.close();
  }
})();
