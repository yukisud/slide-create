const express = require('express');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 8080;
const API_KEY = process.env.API_KEY || '';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';

app.use(express.json({ limit: '5mb' }));

app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const allowList = ALLOWED_ORIGINS.split(',').map(v => v.trim()).filter(Boolean);
  const allowAll = ALLOWED_ORIGINS === '*' || allowList.length === 0;
  const originAllowed = allowAll || (origin && allowList.includes(origin));

  if (origin && !originAllowed) {
    return res.status(403).json({ error: 'origin not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  return next();
});

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

function requireApiKey(req, res) {
  if (!API_KEY) return true;
  const key = req.header('X-API-Key') || '';
  if (key && key === API_KEY) return true;
  res.status(401).json({ error: 'unauthorized' });
  return false;
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_e) {
    return false;
  }
}

app.post('/render', async (req, res) => {
  if (!requireApiKey(req, res)) return;

  const {
    url,
    html,
    format = 'png',
    width = 1280,
    height = 720,
    scale = 2,
    wait = 1000,
    selector
  } = req.body || {};

  if (!html && (!url || !isValidUrl(url))) {
    return res.status(400).json({ error: 'invalid url or html' });
  }
  if (!['png', 'pdf'].includes(format)) {
    return res.status(400).json({ error: 'invalid format' });
  }

  let browser;
  try {
    browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
      viewport: { width: Number(width), height: Number(height) },
      deviceScaleFactor: Number(scale)
    });
    const page = await context.newPage();
    if (html) {
      await page.setContent(html, { waitUntil: 'networkidle' });
    } else {
      await page.goto(url, { waitUntil: 'networkidle' });
    }
    await page.waitForTimeout(Number(wait));
    await page.evaluate(() => {
      if (document.fonts && document.fonts.ready) {
        return document.fonts.ready;
      }
      return null;
    });
    await page.addStyleTag({
      content: '*{animation:none !important;transition:none !important;}'
    });

    const captureSelector = selector || '#capture-root';
    if (format === 'pdf') {
      const pdf = await page.pdf({
        width: `${Number(width)}px`,
        height: `${Number(height)}px`,
        printBackground: true
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="slide.pdf"');
      return res.status(200).send(pdf);
    }

    const element = await page.$(captureSelector);
    const buffer = element
      ? await element.screenshot({ type: 'png' })
      : await page.screenshot({ type: 'png', fullPage: false });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'inline; filename="slide.png"');
    return res.status(200).send(buffer);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'render failed' });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(PORT, () => {
  console.log(`render api listening on ${PORT}`);
});
