// Injected into every page of the recording: a smooth cursor with click ripples,
// a chapter caption chip, and full-screen title / closing cards. Appended to <html>, so React never sees it.
(() => {
  if (window.top !== window) return;
  const CSS = `
  #__demo, #__demo * { box-sizing: border-box; }
  #__cur { position: fixed; left: 0; top: 0; width: 30px; height: 30px; z-index: 2147483647; pointer-events: none; will-change: transform; filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
  .__rip { position: fixed; z-index: 2147483646; pointer-events: none; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; border: 3px solid #f2a900; background: rgba(242,169,0,.25); animation: __rip .65s ease-out forwards; }
  @keyframes __rip { to { transform: scale(3.6); opacity: 0; } }
  #__cap { position: fixed; left: 50%; top: 7px; z-index: 2147483645; pointer-events: none; display: flex; align-items: center; gap: 12px; padding: 6px 18px 6px 7px; border-radius: 10px; background: #1d3347; color: #fff; font: 600 19px/1.2 'Instrument Sans Variable', system-ui, sans-serif; letter-spacing: -.01em; opacity: 0; transform: translate(-50%, -8px); transition: opacity .35s, transform .35s; box-shadow: 0 6px 20px rgba(0,0,0,.25), inset 0 0 0 1px rgba(255,255,255,.2); white-space: nowrap; }
  #__cap.on { opacity: 1; transform: translate(-50%, 0); }
  #__card.on ~ #__cur { opacity: 0; }
  #__cur { transition: opacity .3s; }
  #__cap b { display: grid; place-items: center; min-width: 30px; height: 30px; border-radius: 8px; background: #f2a900; color: #0f1f2e; font-size: 16px; }
  #__card { position: fixed; inset: 0; z-index: 2147483644; display: grid; place-items: center; background: linear-gradient(135deg, #0f1f2e, #1d3a52); color: #fff; font-family: 'Instrument Sans Variable', system-ui, sans-serif; opacity: 0; pointer-events: none; transition: opacity .7s; }
  #__card.on { opacity: 1; }
  #__card .in { width: min(1100px, 86vw); }
  #__card .logo { display: flex; align-items: center; gap: 14px; color: #c5d1dc; font-size: 24px; font-weight: 600; margin-bottom: 26px; }
  #__card h1 { margin: 0; font-size: 96px; line-height: 1.02; font-weight: 800; letter-spacing: -.04em; }
  #__card p.tag { margin: 22px 0 0; font-size: 30px; color: #c5d1dc; max-width: 30em; line-height: 1.35; }
  #__card .strip { margin-top: 54px; height: 16px; border-radius: 8px; background: repeating-linear-gradient(135deg,#37506a 0 6px,#4b6781 6px 12px); position: relative; overflow: hidden; }
  #__card .strip i { position: absolute; left: 0; top: 0; bottom: 0; background: #fff; width: 0; border-radius: 8px 0 0 8px; }
  #__card .strip em { position: absolute; top: 0; bottom: 0; background: #f2a900; left: 0; width: 0; }
  #__card.go .strip i { animation: __w 3s .6s ease-out forwards; }
  #__card .strip em { left: 62%; }
  #__card.go .strip em { animation: __a 2s 3.7s ease-out forwards; }
  @keyframes __w { to { width: 62%; } } @keyframes __a { to { width: 14%; } }
  #__card .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 44px; }
  #__card .stats div { padding: 22px 24px; border-radius: 14px; background: rgba(255,255,255,.08); }
  #__card .stats b { display: block; font-size: 58px; letter-spacing: -.03em; line-height: 1; }
  #__card .stats span { display: block; margin-top: 10px; font-size: 20px; color: #c5d1dc; }
  #__card .links { margin-top: 44px; font-size: 30px; line-height: 1.6; }
  #__card .links b { color: #ffd067; }
  `;
  const ARROW = '<svg viewBox="0 0 30 30" width="30" height="30"><path d="M4 3 L4 24 L9.6 19 L13.2 27 L16.6 25.5 L13 17.8 L20.6 17.4 Z" fill="#fff" stroke="#0f1f2e" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  const LOGO = '<svg width="44" height="44" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#f2a900"/><path d="M7 21h12M7 15h18M7 9h8" stroke="#0f1f2e" stroke-width="3" stroke-linecap="round"/></svg>';
  let x = 0, y = 0, cur, cap, card, raf;
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem('__cur') || 'null'); } catch { return null; } })();
  if (saved) { x = saved.x; y = saved.y; }
  const place = () => { if (cur) cur.style.transform = `translate(${x}px,${y}px)`; try { sessionStorage.setItem('__cur', JSON.stringify({ x, y })); } catch {} };
  const boot = () => {
    if (document.getElementById('__demo')) return;
    const r = document.createElement('div'); r.id = '__demo';
    r.innerHTML = `<style>${CSS}</style><div id="__card"></div><div id="__cap"></div><div id="__cur">${ARROW}</div>`;
    document.documentElement.appendChild(r);
    cur = r.querySelector('#__cur'); cap = r.querySelector('#__cap'); card = r.querySelector('#__card'); place();
  };
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', boot) : boot();
  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  window.__demo = {
    move(tx, ty, ms) {
      cancelAnimationFrame(raf); boot();
      const sx = x, sy = y, t0 = performance.now();
      const step = (t) => { const k = Math.min(1, (t - t0) / ms); x = sx + (tx - sx) * ease(k); y = sy + (ty - sy) * ease(k); place(); if (k < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    },
    ripple() { boot(); const d = document.createElement('div'); d.className = '__rip'; d.style.left = x + 'px'; d.style.top = y + 'px'; document.documentElement.appendChild(d); setTimeout(() => d.remove(), 800); },
    cap(n, text) { boot(); if (n == null) { cap.classList.remove('on'); return; } cap.innerHTML = `<b>${n}</b><span>${text}</span>`; cap.classList.add('on'); },
    go() { boot(); card.classList.add('go'); },
    card(kind) {
      boot();
      if (!kind) { card.classList.remove('on'); card.classList.remove('go'); return; }
      card.innerHTML = kind === 'title'
        ? `<div class="in"><div class="logo">${LOGO}<span>RFQ platform</span></div><h1>British Auction RFQ</h1><p class="tag">Suppliers compete in the open. Late bids add time. A forced close keeps it fair.</p><div class="strip"><i></i><em></em></div></div>`
        : `<div class="in"><div class="logo">${LOGO}<span>British Auction RFQ</span></div><h1 style="font-size:70px">Every rule, tested.</h1><div class="stats"><div><b>60</b><span>automated tests</span></div><div><b>39</b><span>real-time end-to-end checks</span></div><div><b>0</b><span>accessibility violations</span></div><div><b>0</b><span>security vulnerabilities</span></div></div><div class="links">Live: <b>british-auction-rfq-3cc2.onrender.com</b><br>Code: <b>github.com/antrikakashyap/britishrfq</b></div></div>`;
      requestAnimationFrame(() => card.classList.add('on'));
    },
  };
})();
