import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { encode as encodeXGnarly } from '../xgnarly.mjs';

// Usage: node examples/sign-and-fetch.js <targetUrl>
const targetArg = process.argv[2] || '';
const TARGET_URL =
  targetArg ||
  'https://www.tiktok.com/api/post/item_list/?aid=1988&app_name=tiktok_web&device_platform=web_pc&secUid=MS4wLjABAAAAtBazTpLuo5XSFwEiX3gkaeV4ZY7u071I08MUNFL5B_zZoelUkTWrhCVvxK7LqAkr&cursor=0&count=6';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://www.tiktok.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(1500);

    // Try to inject a local SDK if available to ensure signing functions exist
    try {
      const sdkPath = path.join(process.cwd(), 'javascript', 'webmssdk_5.1.3.js');
      if (fs.existsSync(sdkPath)) {
        const sdkContent = fs.readFileSync(sdkPath, 'utf8');
        await page.addScriptTag({ content: sdkContent });
        // allow SDK to initialize
        await sleep(1500);
        // reload to let injected SDK settle in some cases
        try {
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
          await sleep(1500);
        } catch (e) {}
      }
    } catch (e) {
      // ignore SDK injection errors
    }

    // Evaluate in page to compute X-Bogus and other metadata
    const out = await page.evaluate(async (url) => {
      if (typeof window.__sdkN === 'undefined') return { error: 'SDK not initialized' };
      const sdkN = window.__sdkN;
      let table = null;
      if (sdkN.u && sdkN.u[995] && sdkN.u[995].v) table = sdkN.u;
      else if (sdkN.B && sdkN.B.o && sdkN.B.o[995] && sdkN.B.o[995].v) table = sdkN.B.o;
      else if (sdkN.o && sdkN.o[995] && sdkN.o[995].v) table = sdkN.o;
      if (!table) return { error: 'SDK not ready' };
      const u995 = table[995] && table[995].v;
      if (typeof u995 !== 'function') return { error: 'SDK not ready' };

      const u = new URL(url);
      const msTokenMatches = [...document.cookie.matchAll(/msToken=([^;]+)/g)];
      const msToken = msTokenMatches.length ? msTokenMatches[msTokenMatches.length - 1][1] : '';
      u.searchParams.delete('X-Bogus');
      u.searchParams.delete('X-Gnarly');
      u.searchParams.set('msToken', msToken);
      const queryString = u.search.slice(1);

      if (typeof window.__sigCallCount !== 'number') window.__sigCallCount = 100;
      window.__sigCallCount += 1;
      const baseN = window.__sigCallCount;
      let counterObj = {
        totalXHRRequests: Math.floor(baseN * 0.6),
        totalFetchRequests: Math.floor(baseN * 0.4) + 3,
        interceptedXHRRequests: Math.floor(baseN * 0.1),
        interceptedFetchRequests: Math.floor(baseN * 0.05) + 1,
      };
      try {
        const cap3 = window.__cap3 || [];
        const lastNat = [...cap3].reverse().find((c) => c.fn === 'gnarly_x' && c.args && c.args[3] && c.args[3].v);
        if (lastNat && lastNat.args[3].v) {
          const v = lastNat.args[3].v;
          const fromCap = {
            totalXHRRequests: (v.totalXHRRequests && v.totalXHRRequests.v) || 0,
            totalFetchRequests: (v.totalFetchRequests && v.totalFetchRequests.v) || 0,
            interceptedXHRRequests: (v.interceptedXHRRequests && v.interceptedXHRRequests.v) || 0,
            interceptedFetchRequests: (v.interceptedFetchRequests && v.interceptedFetchRequests.v) || 0,
          };
          if (fromCap.totalXHRRequests + fromCap.totalFetchRequests > 0) counterObj = fromCap;
        }
      } catch (e) {}

      const acrawlerInst = window.byted_acrawler && typeof window.byted_acrawler === 'object' ? window.byted_acrawler : null;
      try {
        const xb = u995.call(acrawlerInst, queryString, '');
        return {
          urlBase: u.toString(),
          queryString,
          xBogus: xb,
          msTokenUsed: msToken,
          userAgent: navigator.userAgent,
          cookies: document.cookie,
          counters: counterObj,
        };
      } catch (e) {
        return { error: e.message, stack: e.stack };
      }
    }, TARGET_URL);

    if (!out || out.error) {
      throw new Error('Page signing failed: ' + (out && out.error ? out.error : 'unknown'));
    }

    // Build X-Gnarly using local function
    const xg = encodeXGnarly(out.queryString, '', out.userAgent, out.counters, {
      ubcode: 4,
      sdkVersion: '1.0.0.368',
    });

    const u = new URL(out.urlBase);
    u.searchParams.set('X-Bogus', out.xBogus);
    u.searchParams.set('X-Gnarly', xg);
    const signedUrl = u.toString();

    console.log('Signed URL:', signedUrl);

    // Build cookie header from page.cookies()
    const cookies = await page.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    // Perform fetch from Node to the signed URL
    const resp = await fetch(signedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': out.userAgent,
        Cookie: cookieHeader,
      },
    });

    console.log('Fetch status:', resp.status);
    const text = await resp.text();
    console.log('Response body (truncated 1000 chars):\n', text.substring(0, 1000));

    await browser.close();
  } catch (e) {
    console.error('Error in sign-and-fetch POC:', e);
    await browser.close();
    process.exit(1);
  }
}

main();
