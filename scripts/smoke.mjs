// Quick check that a running copy is healthy: API, data and the website itself.
//   node scripts/smoke.mjs                       (http://localhost:8080)
//   BASE=https://your-site.example npm run smoke
const base = (process.env.BASE ?? 'http://localhost:8080').replace(/\/$/, '');
let bad = 0;
const check = (ok, name) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) bad++;
};
const get = async (p) => {
  const r = await fetch(base + p, { signal: AbortSignal.timeout(90_000) });
  return { r, text: await r.text() };
};

try {
  const h = await get('/api/health');
  check(h.r.status === 200 && JSON.parse(h.text).status === 'ok', 'GET /api/health is ok');
  const l = await get('/api/auctions');
  check(l.r.status === 200 && Array.isArray(JSON.parse(l.text)), 'GET /api/auctions returns a list');
  const m = await get('/api/metrics');
  check(m.r.status === 200 && 'auctions' in JSON.parse(m.text), 'GET /api/metrics returns the success metrics');
  const w = await get('/');
  check(w.r.status === 200 && w.text.includes('id="root"'), 'the website is served');
  const d = await get('/auctions/does-not-exist');
  check(d.r.status === 200 && d.text.includes('id="root"'), 'deep links fall back to the website');
  const nf = await get('/api/auctions/does-not-exist');
  check(nf.r.status === 404 && JSON.parse(nf.text).error.code === 'NOT_FOUND', 'an unknown RFQ is a JSON 404');
} catch (e) {
  console.log('FAIL  could not reach', base, '-', e.message);
  bad++;
}
console.log(bad ? `${bad} check(s) failed` : 'Smoke test passed');
process.exit(bad ? 1 : 0);
