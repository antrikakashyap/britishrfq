// Real-clock end-to-end check of every spec feature against a running server.
//   BASE=https://your-app.onrender.com node scripts/e2e-live.mjs      (takes ~3.5 minutes)
const B = process.env.BASE ?? 'http://localhost:8080';
const t0 = Date.now();
const at = (s) => new Date(t0 + s * 1000).toISOString();
const sleepTo = (s) => new Promise((r) => setTimeout(r, Math.max(0, t0 + s * 1000 - Date.now())));
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? '  PASS' : '  FAIL'}  ${m}`); };
const j = async (m, p, body) => {
  const r = await fetch(B + '/api' + p, { method: m, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  return { s: r.status, b: await r.json() };
};
const bid = (ref, name, total) => j('POST', `/auctions/${ref}/bids`, { carrierName: name, freightCharges: total - 100, originCharges: 60, destinationCharges: 40, transitTimeDays: 20, quoteValidityDays: 14 });
const cfg = (ref, trig) => ({ refId: ref, name: `E2E ${trig}`, currency: 'USD', pickupDate: '2026-12-01', bidStart: at(-5), bidClose: at(90), forcedBidClose: at(200), triggerWindowMin: 1, extensionMin: 1, triggerType: trig });
const R = { b: `E2E-BID-${t0}`, r: `E2E-RANK-${t0}`, l: `E2E-L1-${t0}` };
const outcome = (x) => x.b.extension?.outcome;

// SSE listener
const seen = new Set();
const ac = new AbortController();
fetch(B + '/api/events', { signal: ac.signal }).then(async (res) => {
  const rd = res.body.getReader(), dec = new TextDecoder();
  for (;;) { const { value, done } = await rd.read(); if (done) break; for (const m of dec.decode(value).matchAll(/^event: (\w+)/gm)) seen.add(m[1]); }
}).catch(() => {});

console.log(`Target ${B}\n\n[1] Validation rules (spec s7)`);
let v = await j('POST', '/auctions', { ...cfg('x', 'BID_RECEIVED'), refId: 'E2E-BAD-' + t0, forcedBidClose: at(90) });
ok(v.s === 422 && /later than bid close/.test(v.b.error.fields.forcedBidClose?.[0] ?? ''), 'forced close == bid close rejected with field error');
v = await j('POST', '/auctions', { ...cfg('x', 'BID_RECEIVED'), refId: 'E2E-BAD2-' + t0, forcedBidClose: at(10) });
ok(v.s === 422, 'forced close < bid close rejected');
v = await j('POST', '/auctions', { ...cfg('x', 'BID_RECEIVED'), refId: 'E2E-BAD3-' + t0, triggerType: 'NOPE' });
ok(v.s === 422, 'unknown trigger type rejected');

console.log('\n[2] RFQ creation (spec s5)');
for (const [k, trig] of [['b', 'BID_RECEIVED'], ['r', 'ANY_RANK_CHANGE'], ['l', 'L1_CHANGE']]) {
  const c = await j('POST', '/auctions', cfg(R[k], trig));
  ok(c.s === 201 && c.b.auction.status === 'ACTIVE' && c.b.auction.config.triggerType === trig, `create ${trig} RFQ -> ACTIVE`);
}
ok((await j('POST', '/auctions', cfg(R.b, 'BID_RECEIVED'))).s === 409, 'duplicate reference ID rejected (409)');

console.log('\n[3] Bids outside the trigger window do not extend');
for (const k of ['b', 'r', 'l']) {
  const a = await bid(R[k], 'Alpha Freight', 1000), b = await bid(R[k], 'Bravo Cargo', 1100);
  ok(a.s === 201 && a.b.rankLabel === 'L1' && b.b.rankLabel === 'L2' && outcome(a) === 'NONE' && outcome(b) === 'NONE', `${k}: L1/L2 assigned, no extension before the window`);
}
let nl = await bid(R.b, 'Alpha Freight', 1000);
ok(nl.s === 422 && nl.b.error.code === 'BID_NOT_LOWER', 'supplier cannot re-bid the same / a higher total');
ok((await j('POST', `/auctions/${R.b}/bids`, { carrierName: 'X' })).s === 422, 'incomplete quote rejected');

await sleepTo(35);
console.log('\n[4] Inside the window (t = 35 s; close = 90 s, window = 30-90 s)');
let x = await bid(R.b, 'Alpha Freight', 990);
ok(outcome(x) === 'EXTENDED' && Date.parse(x.b.extension.newClose) - Date.parse(x.b.extension.previousClose) === 60000, 'BID_RECEIVED: any bid extends by exactly Y (+60 s)');
x = await bid(R.r, 'Alpha Freight', 990);
ok(outcome(x) === 'NONE', 'ANY_RANK_CHANGE: price drop that keeps the order does NOT extend');
x = await bid(R.r, 'Bravo Cargo', 980);
ok(outcome(x) === 'EXTENDED' && x.b.rankLabel === 'L1', 'ANY_RANK_CHANGE: Bravo overtakes Alpha -> extends');
x = await bid(R.l, 'Alpha Freight', 990);
ok(outcome(x) === 'NONE', 'L1_CHANGE: L1 lowers own price -> no extension');
x = await bid(R.l, 'Charlie Lines', 1200);
ok(outcome(x) === 'NONE' && x.b.rankLabel === 'L3', 'L1_CHANGE: new supplier enters at L3 -> no extension');
x = await bid(R.l, 'Bravo Cargo', 970);
ok(outcome(x) === 'EXTENDED' && x.b.rankLabel === 'L1', 'L1_CHANGE: new lowest bidder -> extends');

await sleepTo(100);
console.log('\n[5] Chain to the Forced Bid Close (t = 100 s; close = 150 s, forced = 200 s)');
x = await bid(R.b, 'Alpha Freight', 980);
ok(outcome(x) === 'CAPPED' && x.b.extension.newClose === at(200), 'second extension is CAPPED at the forced close (210 s -> 200 s)');
await sleepTo(145);
x = await bid(R.b, 'Bravo Cargo', 1050);
ok(outcome(x) === 'BLOCKED' && x.b.extension.newClose === at(200), 'trigger fires again but extension BLOCKED - close stays at forced close');

await sleepTo(153);
console.log('\n[6] Normal close (t = 153 s)');
let d = await j('GET', `/auctions/${R.r}`);
ok(d.b.auction.status === 'CLOSED', 'RANK auction ended as CLOSED (not force closed)');
ok((await bid(R.r, 'Delta', 500)).b.error?.code === 'AUCTION_CLOSED', 'bid after close rejected (409 AUCTION_CLOSED)');
ok((await j('GET', `/auctions/${R.l}`)).b.auction.status === 'CLOSED', 'L1 auction ended as CLOSED');

await sleepTo(202);
console.log('\n[7] Forced close (t = 202 s)');
d = await j('GET', `/auctions/${R.b}`);
const a = d.b.auction, kinds = d.b.activity.map((e) => e.kind);
ok(a.status === 'FORCE_CLOSED' && a.bidClose === a.forcedBidClose, 'BID auction FORCE_CLOSED exactly at forced close');
ok(Date.parse(a.bidClose) <= Date.parse(a.forcedBidClose), 'close never beyond forced close');
ok(['EXTENSION_CAPPED', 'EXTENSION_BLOCKED', 'AUCTION_FORCE_CLOSED', 'TIME_EXTENDED'].every((k) => kinds.includes(k)), 'activity log has extensions, cap, blocked attempt and force close');
ok(d.b.activity.filter((e) => e.kind.startsWith('TIME_EXT') || e.kind === 'EXTENSION_CAPPED').every((e) => e.reason && e.previousClose && e.newClose), 'every extension carries a reason and old -> new close');
ok((await bid(R.b, 'Echo', 1)).s === 409, 'bid after force close rejected');

console.log('\n[8] Listing & details (spec s8)');
const L = await j('GET', '/auctions');
const row = L.b.find((r) => r.refId === R.b);
ok(row && row.status === 'FORCE_CLOSED' && row.lowestBid.total === 980 && row.forcedBidClose === at(200) && row.bidClose === at(200), 'listing shows name/ID, lowest bid, current close, forced close, status');
ok(L.b.filter((r) => r.refId.startsWith('E2E-') && r.status === 'ACTIVE').length === 0, 'no E2E auction left ACTIVE');
ok(d.b.ranking.map((r) => r.label).join() === 'L1,L2' && d.b.ranking[0].total <= d.b.ranking[1].total, 'ranking L1, L2 ordered by price');
const prices = d.b.bids.map((b) => b.total);
ok(prices.every((p, i) => i === 0 || p >= prices[i - 1]), 'all bids sorted by price (asc)');
const q = d.b.ranking[0];
ok(q.freightCharges > 0 && q.originCharges === 60 && q.destinationCharges === 40 && q.transitTimeDays === 20 && q.quoteValidityDays === 14 && q.validUntil, 'quote details: charges, transit, validity');
ok(a.config.triggerWindowMin === 1 && a.config.extensionMin === 1, 'configuration (X, Y) exposed');
ok(/Bid received in last X minutes/.test(d.b.activity.find((e) => e.kind === 'TIME_EXTENDED').reason), 'extension reason names the trigger');
const dl = await j('GET', `/auctions/${R.l}`);
ok(/became the lowest bidder \(L1\), replacing Alpha Freight/.test(dl.b.activity.find((e) => e.kind === 'TIME_EXTENDED').reason), 'L1 reason names old and new leader');
const dr = await j('GET', `/auctions/${R.r}`);
ok(/Bravo Cargo moved from L2 to L1/.test(dr.b.activity.find((e) => e.kind === 'TIME_EXTENDED').reason), 'rank-change reason shows the move');
const m = await j('GET', '/metrics');
ok(m.s === 200 && m.b.comparison.extended.auctions >= 3, 'success metrics computed (extended vs non-extended)');
ok(['bid', 'extended', 'status'].every((e) => seen.has(e)), `live SSE events received (${[...seen].join(', ')})`);
ac.abort();
console.log(`\n${fail ? 'FAILED' : 'ALL GOOD'}: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
