// Records the demo video of the running app: real browser, real clock, no audio.
//   BASE=http://localhost:8123 OUT=docs/demo/demo.mp4 node scripts/demo/record.cjs
//   add PREVIEW=1 to just save a few key frames as PNG instead of recording
// Needs: playwright (npm i --no-save playwright && npx playwright install chromium) and ffmpeg.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:8123';
const OUT = process.env.OUT || 'docs/demo/demo.mp4';
const PREVIEW = !!process.env.PREVIEW;
const W = 1920, H = 1080, VW = 1440, VH = 810, FPS = 30;
const INJECT = fs.readFileSync(path.join(__dirname, 'inject.js'), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WPS = 2.0; // narration speed used to size each scene: words per second

/** What the narrator says in each scene (also written to docs/demo/VOICEOVER.md). */
const SAY = {
  intro: 'This is British Auction RFQ: a platform where suppliers compete openly, and the clock itself keeps the auction fair.',
  idea: 'When a company ships goods, it asks several carriers for a price. That request is called an RFQ. In a British auction, carriers bid openly, and each one can only lower its own price. This is the home page: every auction, with its lowest bid, its closing time, and its status.',
  metrics: 'At the top, we measure what matters: how many bids each RFQ receives, and whether the extra time really brings a better price.',
  create: "Creating an auction takes one form. Name it, give it a start time, a close time, and a forced close, which is the hard deadline. If I set the forced close before the close, the form stops me, because it must always be later. Then I choose the rules: watch the last ten minutes, add five minutes when something happens, and decide what counts as activity. The preview shows exactly how the clock will behave.",
  live: "Now a live auction. The countdown follows the server's clock, so nobody can cheat with their own. The timeline shows the original close, time already added in amber, and the trigger window we are inside right now. Suppliers are ranked L1, L2, L3 with every charge, and the chart shows who undercut whom.",
  extend: "Let's bid as Evergreen Marine, four thousand four hundred dollars, lower than everyone. It arrives inside the trigger window and makes us the new lowest bidder, so the auction is extended by ten minutes. The countdown jumps, the timeline grows, and the activity log records exactly why.",
  noext: 'Not every bid extends the clock. This auction only reacts to a new lowest bidder. CMA CGM improves its price but stays second, so there is no extension. The rule is applied exactly as configured.',
  rules: 'The rules are enforced. A supplier cannot repeat or raise its price. The bid is rejected with a clear message, and nothing is saved.',
  force: 'The forced close is the safety net. This auction kept receiving late bids, and was extended again and again, until it hit the hard stop. The log shows one extension that was cut short, and a later one that was refused. It ended Force closed, never one minute past the deadline.',
  outro: 'Under the hood: React and Node, written in TypeScript. Every rule is tested, including a real-time run of a whole auction. Zero accessibility issues, and zero security vulnerabilities. It is live right now. Try it.',
};
const TITLES = { intro: 'Intro', idea: 'The idea', metrics: 'Is it working?', create: 'Create an RFQ', live: 'A live auction', extend: 'A late bid extends the clock', noext: 'Not every bid extends', rules: 'The rules are enforced', force: 'The forced close', outro: 'Wrap-up' };
const words = (s) => s.trim().split(/\s+/).length;
const minDur = (k) => Math.ceil(words(SAY[k]) / WPS + 1.5);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: W / VW });
  const page = await ctx.newPage();
  await page.addInitScript(INJECT);

  /* ---------- recorder: CDP screencast -> constant 30 fps -> ffmpeg ---------- */
  let latest = null, ff = null, tmp = null, tStart = 0, n = 0, timer = null;
  const marks = [];
  const cdp = await ctx.newCDPSession(page);
  cdp.on('Page.screencastFrame', async (ev) => { latest = Buffer.from(ev.data, 'base64'); try { await cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }); } catch {} });
  async function startRec() {
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
    while (!latest) await sleep(20);
    if (PREVIEW) return;
    tmp = OUT.replace(/\.mp4$/, '.part.mp4');
    ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', 'pipe:0',
      '-vf', `scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-r', String(FPS), '-movflags', '+faststart', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
    tStart = Date.now();
    timer = setInterval(() => { const want = Math.floor((Date.now() - tStart) / (1000 / FPS)); while (n < want) { ff.stdin.write(latest); n++; } }, 8);
  }
  const now = () => (PREVIEW ? 0 : (Date.now() - tStart) / 1000);
  async function stopRec() {
    if (PREVIEW) return;
    clearInterval(timer); await cdp.send('Page.stopScreencast');
    await new Promise((res) => { ff.on('close', res); ff.stdin.end(); });
    fs.renameSync(tmp, OUT);
  }

  /* ---------- on-screen helpers ---------- */
  const D = (fn, ...a) => page.evaluate(([f, args]) => window.__demo[f](...args), [fn, a]);
  async function glide(sel, { dy = 0 } = {}) {
    const el = page.locator(sel).first();
    await el.waitFor({ state: 'visible' });
    let b = await el.boundingBox();
    if (b.y < 70 || b.y + b.height > VH - 70) { await el.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'smooth' })); await sleep(900); b = await el.boundingBox(); }
    const tx = b.x + Math.min(b.width / 2, 120), ty = b.y + b.height / 2 + dy;
    const cur = await page.evaluate(() => { const c = document.getElementById('__cur'); const m = new DOMMatrix(getComputedStyle(c).transform); return [m.m41, m.m42]; });
    const dist = Math.hypot(tx - cur[0], ty - cur[1]);
    const ms = Math.max(450, Math.min(1100, 350 + dist * 0.8));
    await D('move', tx, ty, ms); await sleep(ms + 80);
    return [tx, ty];
  }
  async function click(sel) { const [x, y] = await glide(sel); await D('ripple'); await page.mouse.click(x, y); await sleep(350); }
  async function type(sel, text, delay = 55) { await click(sel); await page.keyboard.press('Control+A'); await page.keyboard.type(text, { delay }); await sleep(200); }
  const scrollTo = async (y, ms = 1000) => { await page.evaluate((t) => window.scrollTo({ top: t, behavior: 'smooth' }), y); await sleep(ms); };
  const heading = async (text) => page.evaluate((t) => { const h = [...document.querySelectorAll('h2')].find((e) => e.textContent.includes(t)); return h ? h.getBoundingClientRect().top + window.scrollY : 0; }, text);
  let sceneNo = 0;
  async function scene(key, body) {
    sceneNo++;
    const t0 = now();
    marks.push({ key, title: TITLES[key], start: t0 });
    await D('cap', key === 'intro' || key === 'outro' ? null : sceneNo - 1, TITLES[key]);
    await body();
    const want = t0 + minDur(key);
    while (now() < want) await sleep(100);
    marks[marks.length - 1].end = now();
  }
  const bid = async (name, fr, og, ds) => {
    await type('#b-carrierName', name, 45);
    await type('#b-freightCharges', String(fr), 70); await type('#b-originCharges', String(og), 70); await type('#b-destinationCharges', String(ds), 70);
    await sleep(500);
    await click('button:has-text("Place bid")');
  };

  /* ---------- the story ---------- */
  await page.goto(BASE + '/');
  await page.waitForSelector('.row'); await sleep(800);
  await D('card', 'title'); await sleep(900);
  await startRec();

  if (PREVIEW) {
    const shot = (n) => page.screenshot({ path: `/tmp/prev-${n}.png` });
    await D('card', 'title'); await sleep(1200); await shot('title');
    await D('card'); await sleep(900); await D('cap', 1, 'The idea'); await D('move', 700, 420, 400); await sleep(900); await shot('list');
    await D('card', 'outro'); await sleep(1200); await shot('outro');
    await browser.close(); return;
  }

  await D('go');
  await scene('intro', async () => { await sleep(6500); });
  await D('card'); await sleep(900);

  await scene('idea', async () => {
    await glide('.row >> nth=0'); await sleep(900);
    await glide('.row >> nth=3'); await sleep(700);
    await glide('.chips .chip >> nth=1'); await sleep(600);
  });
  await scene('metrics', async () => { await glide('.ins >> nth=0', { dy: 0 }); await sleep(1000); await glide('.ins div >> nth=2'); await sleep(900); await glide('.ins div >> nth=3'); });

  await scene('create', async () => {
    await click('a.btn:has-text("New RFQ")'); await page.waitForSelector('#c-name'); await sleep(700);
    await type('#c-refId', 'RFQ-2026-DEL-SIN-0501'); await type('#c-name', "Delhi to Singapore, 20' FCL", 45);
    // break the rule on purpose: forced close BEFORE bid close
    const closeV = await page.inputValue('#c-close');
    const early = new Date(new Date(closeV).getTime() - 30 * 60000); const pad = (v) => String(v).padStart(2, '0');
    const bad = `${early.getFullYear()}-${pad(early.getMonth() + 1)}-${pad(early.getDate())}T${pad(early.getHours())}:${pad(early.getMinutes())}`;
    await click('#c-forced'); await page.fill('#c-forced', bad); await sleep(500);
    await click('button:has-text("Create RFQ")'); await sleep(1800);
    const fixed = new Date(new Date(closeV).getTime() + 60 * 60000);
    const good = `${fixed.getFullYear()}-${pad(fixed.getMonth() + 1)}-${pad(fixed.getDate())}T${pad(fixed.getHours())}:${pad(fixed.getMinutes())}`;
    await click('#c-forced'); await page.fill('#c-forced', good); await sleep(900);
    await scrollTo(380, 900);
    await click('label.trig:has-text("Lowest bidder")'); await sleep(900);
    await click('button:has-text("Create RFQ")'); await page.waitForSelector('.dhead'); await sleep(1400);
    await click('a.crumb'); await page.waitForSelector('.row'); await sleep(1200);
  });

  await scene('live', async () => {
    await click('.row:has-text("Mumbai (JNPT)")'); await page.waitForSelector('.lb'); await sleep(2200);
    await scrollTo(250, 1200); await glide('.tl-win'); await sleep(1500);
    await glide('.lb tbody tr >> nth=0'); await sleep(1200);
    await scrollTo(640, 1200); await sleep(2200);
    await scrollTo(0, 1100);
  });

  await scene('extend', async () => {
    await scrollTo(300, 900);
    await bid('Evergreen Marine', 3500, 500, 400);
    await sleep(2200);
    await scrollTo(0, 1000); await sleep(2200);
    await scrollTo(Math.max(0, (await heading('Activity log')) - 120), 1300); await sleep(2800);
  });

  await scene('noext', async () => {
    await scrollTo(300, 1000);
    await bid('CMA CGM', 3600, 500, 380);
    await sleep(2500);
  });

  await scene('rules', async () => {
    await bid('Maersk Line', 3900, 500, 300);
    await sleep(2500);
  });

  await scene('force', async () => {
    await scrollTo(0, 600); await click('a.crumb'); await page.waitForSelector('.row'); await sleep(900);
    await click('.row:has-text("Nhava Sheva")'); await page.waitForSelector('.lb'); await sleep(2300);
    await glide('.tl-win'); await sleep(1000);
    await scrollTo(Math.max(0, (await heading('Activity log')) - 120), 1300); await sleep(1500);
    await page.evaluate(() => { const l = document.querySelector('.log'); l.scrollTo({ top: l.scrollHeight, behavior: 'smooth' }); });
    await sleep(2200);
  });

  await D('cap', null); await D('card', 'outro');
  await scene('outro', async () => { await sleep(900); });
  await sleep(1200);
  await stopRec();
  fs.writeFileSync(OUT.replace(/\.mp4$/, '.marks.json'), JSON.stringify({ say: SAY, marks }, null, 2));
  console.log('saved', OUT, marks.map((m) => `${m.key} ${m.start.toFixed(1)}-${m.end.toFixed(1)}`).join(' | '));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
