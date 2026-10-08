// Isolated browser contract: real dialog + challenge page, local HTTP and mocked widget.
// Requires an externally installed Playwright. Never contacts Auth or Cloudflare.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { captchaPage } from '../server/captcha-page.ts';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
let enabled = 'true';
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/api/public-config') { res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({captchaEnabled:enabled})); return; }
  if (path === '/auth/captcha') {
    const response = captchaPage('fixture-public-key');
    response.headers.forEach((v,k) => res.setHeader(k,v)); res.end(await response.text()); return;
  }
  const files = {
    '/auth-captcha.js': '../src/services/auth-captcha.ts',
    '/contracts/auth-captcha.ts': '../../contracts/auth-captcha.ts',
  };
  if (files[path]) {
    res.setHeader('Content-Type','text/javascript');
    res.end(ts.transpileModule(await readFile(new URL(files[path],import.meta.url),'utf8'), {compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText); return;
  }
  if (path === '/styles.css') { res.setHeader('Content-Type','text/css'); res.end(await readFile(new URL('../src/styles/base.css',import.meta.url),'utf8')); return; }
  res.setHeader('Content-Type','text/html');
  res.end('<!doctype html><html lang="pt-BR"><link rel="stylesheet" href="/styles.css"><button id="start">Verificar</button><script type="module">import {requestAuthCaptcha} from "/auth-captcha.js"; window.start = () => { window.result = null; window.attempt = requestAuthCaptcha().then(r => window.result = r); }; document.querySelector("button").onclick = window.start;</script></html>');
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless:true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath:process.env.BROWSER_EXECUTABLE } : {}) });
  const page = await browser.newPage();
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith(origin + '/')) return route.continue();
    if (url.startsWith('https://challenges.cloudflare.com/turnstile/v0/api.js')) return route.fulfill({ contentType:'text/javascript', body:'window.turnstile={render:(_target,options)=>{window.fixtureWidget=options;return "fixture";}}; window.kadCaptchaReady();' });
    return route.abort();
  });
  await page.goto(origin);
  await page.clock.install();
  const open = async () => {
    await page.locator('#start').click();
    await page.locator('dialog[open]').waitFor();
    const frame = await page.locator('iframe').elementHandle().then(e => e.contentFrame());
    await frame.waitForFunction(() => Boolean(window.fixtureWidget));
    return frame;
  };
  let frame = await open();
  await page.setViewportSize({width:320,height:640});
  assert.ok((await page.locator('iframe').boundingBox()).width >= 300, 'Turnstile minimum width on small screens');
  // Same-origin attacker frame/window still cannot satisfy source + nonce checks.
  await page.evaluate(() => window.postMessage({type:'kad-captcha',nonce:'forged',token:'forged'},location.origin));
  await frame.evaluate(() => parent.postMessage({type:'kad-captcha',nonce:'wrong',token:'forged'},location.origin));
  assert.equal(await page.locator('dialog[open]').count(),1);
  await frame.evaluate(() => window.fixtureWidget.callback('fixture-valid-token'));
  assert.deepEqual(await page.evaluate(() => window.attempt),{token:'fixture-valid-token'});
  assert.equal(await page.locator('dialog').count(),0);
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length),0);
  for (const callback of ['expired-callback','error-callback','timeout-callback']) {
    frame = await open(); await frame.evaluate(key => window.fixtureWidget[key](),callback);
    assert.ok((await page.evaluate(() => window.attempt)).error);
  }
  await open(); await page.keyboard.press('Escape');
  assert.match((await page.evaluate(() => window.attempt)).error,/cancelada/);
  await open(); await page.clock.fastForward(126000);
  assert.ok((await page.evaluate(() => window.attempt)).error);
  enabled = 'false'; await page.locator('#start').click();
  assert.deepEqual(await page.evaluate(() => window.attempt),{});
  assert.equal(await page.locator('dialog').count(),0);
  enabled = 'true';
  await page.evaluate(() => { HTMLDialogElement.prototype.showModal = () => { throw Error('unavailable'); }; });
  await page.locator('#start').click();
  assert.ok((await page.evaluate(() => window.attempt)).error);
  assert.equal(await page.locator('dialog').count(),0);
  console.log('PASS browser: valid token, forged source/nonce, expiry/error, cancel, timeout, retry, disabled config, cleanup, no token storage. All external traffic mocked/blocked.');
} finally {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
}
