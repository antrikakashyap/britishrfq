// Automated WCAG 2.1 A/AA scan of every page at desktop and mobile widths.
//   npm i --no-save playwright axe-core && npx playwright install chromium && node scripts/a11y.cjs   (app must be running on :8080)
const { chromium } = require('playwright'); const fs = require('fs');
const axe = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
(async () => {
  const b = await chromium.launch(); const urls = [['listing','/'],['details-active','/auctions/RFQ-2026-MUM-RTM-0147'],['details-force-closed','/auctions/RFQ-2026-NSA-FXT-0066'],['details-scheduled','/auctions/RFQ-2026-MAA-SIN-0388'],['create','/new']];
  let total = 0;
  for (const vp of [[1360,900,'desktop'],[390,800,'mobile']]) {
    const p = await b.newPage({ viewport: { width: vp[0], height: vp[1] } });
    for (const [n,u] of urls) {
      await p.goto('http://localhost:8080'+u); await p.waitForSelector('main h1, .sk, .empty'); await p.waitForTimeout(900);
      await p.evaluate(axe);
      const r = await p.evaluate(() => axe.run(document, { runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice'] }));
      console.log(`${vp[2].padEnd(8)} ${n.padEnd(22)} violations=${r.violations.length} passes=${r.passes.length}`);
      for (const v of r.violations) { total++; console.log('   -', v.impact, v.id, '|', v.help, '| nodes:', v.nodes.length, '|', v.nodes.slice(0,2).map(x=>x.target.join(' ')).join(' ; ')); }
    }
  }
  console.log('TOTAL violations:', total); await b.close();
})();
