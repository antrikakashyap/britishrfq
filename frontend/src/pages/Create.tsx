import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError, serverNow, type TrigType } from '../api';
import Timeline from '../components/Timeline';
import { useToast } from '../components/Toast';
import { useTitle } from '../hooks';
import { fromLocalInput, toLocalInput, tzShort } from '../lib/format';
import { timelineIssues } from '../lib/validate';

const TRIGS: { k: TrigType; t: string; d: string }[] = [
  { k: 'BID_RECEIVED', t: 'Bid received in last X minutes', d: 'Any new bid inside the trigger window extends the auction.' },
  { k: 'ANY_RANK_CHANGE', t: 'Any supplier rank change in last X minutes', d: 'Extends only when a bid changes the order of suppliers (or adds a new one).' },
  { k: 'L1_CHANGE', t: 'Lowest bidder (L1) change in last X minutes', d: 'Extends only when a different supplier becomes the lowest bidder.' },
];
const CURS = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'SGD'];

export default function Create() {
  useTitle('New RFQ');
  const nav = useNavigate();
  const toast = useToast();
  const t0 = Math.ceil((serverNow() + 5 * 60000) / 300000) * 300000;
  const [f, setF] = useState({
    refId: `RFQ-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    name: '', description: '', currency: 'USD',
    pickup: toLocalInput(t0 + 7 * 86400000).slice(0, 10),
    start: toLocalInput(t0), close: toLocalInput(t0 + 3600000), forced: toLocalInput(t0 + 2 * 3600000),
    x: '10', y: '5', trig: 'BID_RECEIVED' as TrigType,
  });
  const [srv, setSrv] = useState<Record<string, string[]>>({});
  const [top, setTop] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { setF({ ...f, [k]: e.target.value }); setSrv({ ...srv, [k]: [] }); };

  const tl = useMemo(() => ({ start: fromLocalInput(f.start), close: fromLocalInput(f.close), forced: fromLocalInput(f.forced), x: Number(f.x), y: Number(f.y) }), [f]);
  const local = timelineIssues({ ...tl, now: serverNow() });
  const keyMap: Record<string, string> = { bidStart: 'start', bidClose: 'close', forcedBidClose: 'forced', triggerWindowMin: 'x', extensionMin: 'y', refId: 'refId', name: 'name', pickupDate: 'pickup', description: 'description', triggerType: 'trig', currency: 'currency' };
  const err = (k: keyof typeof f): string | undefined => {
    const se = Object.entries(srv).find(([sk, v]) => keyMap[sk] === k && v.length)?.[1][0];
    if (se) return se;
    if (!touched) return undefined;
    const inv = Object.entries(keyMap).find(([, v]) => v === k)?.[0];
    if (k === 'refId' && f.refId.trim().length < 3) return 'Enter a reference ID of at least 3 characters';
    if (k === 'name' && f.name.trim().length < 3) return 'Give the RFQ a name (at least 3 characters)';
    if (k === 'pickup' && !f.pickup) return 'Choose the pickup / service date';
    return inv ? local[inv] : undefined;
  };
  const ok = !Object.keys(local).length && f.refId.trim().length >= 3 && f.name.trim().length >= 3 && !!f.pickup;
  const iso = (v: string) => new Date(v).toISOString();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true); setTop('');
    if (!ok) return;
    setBusy(true);
    try {
      const d = await api.create({
        refId: f.refId.trim(), name: f.name.trim(), description: f.description.trim() || undefined, currency: f.currency,
        pickupDate: f.pickup, bidStart: iso(f.start), bidClose: iso(f.close), forcedBidClose: iso(f.forced),
        triggerWindowMin: Number(f.x), extensionMin: Number(f.y), triggerType: f.trig,
      });
      toast('RFQ created', `${d.auction.refId} is ${d.auction.status === 'ACTIVE' ? 'live' : 'scheduled'}.`);
      nav(`/auctions/${d.auction.refId}`);
    } catch (x) {
      const e2 = x as ApiError;
      setSrv(e2.fields ?? {});
      setTop(e2.message);
    } finally { setBusy(false); }
  }

  const F = (k: keyof typeof f, label: string, el: React.ReactNode, hint?: string) => (
    <div className={`f ${err(k) ? 'bad' : ''}`}>
      <label htmlFor={`c-${k}`}>{label}</label>{el}
      {err(k) ? <span className="msg" role="alert">{err(k)}</span> : hint && <span className="hint">{hint}</span>}
    </div>
  );
  const valid = !Object.keys(local).length;
  const pickupWarn = f.pickup && tl.forced && new Date(f.pickup + 'T23:59:59').getTime() < tl.forced;

  return (
    <>
      <Link to="/" className="crumb">← All auctions</Link>
      <div className="head"><div><h1>New RFQ</h1><p>Set up the lane, the bidding window and how late bids extend the auction.</p></div></div>
      <form className="cgrid" onSubmit={submit} noValidate>
        <div className="stack">
          <section className="panel">
            <header><h2>RFQ details</h2></header>
            <div className="body form">
              {top && <div className="err" role="alert">{top}</div>}
              <div className="two">
                {F('refId', 'RFQ reference ID', <input id="c-refId" value={f.refId} onChange={up('refId')} />, 'Must be unique')}
                {F('currency', 'Currency', <select id="c-currency" value={f.currency} onChange={up('currency')}>{CURS.map((c) => <option key={c}>{c}</option>)}</select>)}
              </div>
              {F('name', 'RFQ name', <input id="c-name" value={f.name} onChange={up('name')} placeholder="e.g. Mumbai → Rotterdam, 2 × 40' FCL" />)}
              {F('description', 'Notes for suppliers (optional)', <textarea id="c-description" rows={2} value={f.description} onChange={up('description')} />)}
              {F('pickup', 'Pickup / service date', <input id="c-pickup" type="date" value={f.pickup} onChange={up('pickup')} />, pickupWarn ? undefined : undefined)}
              {pickupWarn && <div className="notice warn">The pickup date is before the forced bid close. Check it is intentional.</div>}
            </div>
          </section>

          <section className="panel">
            <header><h2>Bidding window</h2><span className="sub">Your time zone: {tzShort()}</span></header>
            <div className="body form">
              {F('start', 'Bid start', <input id="c-start" type="datetime-local" value={f.start} onChange={up('start')} />)}
              <div className="two">
                {F('close', 'Bid close', <input id="c-close" type="datetime-local" value={f.close} onChange={up('close')} />)}
                {F('forced', 'Forced bid close', <input id="c-forced" type="datetime-local" value={f.forced} onChange={up('forced')} />, 'Hard stop. Must be later than bid close.')}
              </div>
            </div>
          </section>

          <section className="panel">
            <header><h2>British auction rules</h2></header>
            <div className="body form">
              <div className="two">
                {F('x', 'Trigger window, X (minutes)', <input id="c-x" inputMode="numeric" value={f.x} onChange={up('x')} />, 'How close to the close the system watches for activity.')}
                {F('y', 'Extension duration, Y (minutes)', <input id="c-y" inputMode="numeric" value={f.y} onChange={up('y')} />, 'Time added each time the trigger fires.')}
              </div>
              <div className="f">
                <span className="lbl" id="trig-l">What triggers an extension?</span>
                <div className="trigs" role="radiogroup" aria-labelledby="trig-l">
                  {TRIGS.map((t) => (
                    <label key={t.k} className="trig">
                      <input type="radio" name="trig" checked={f.trig === t.k} onChange={() => setF({ ...f, trig: t.k })} />
                      <div><b>{t.t.replace('X', f.x || 'X')}</b><span>{t.d}</span></div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="stack" style={{ position: 'sticky', top: 16 }}>
          <section className="panel">
            <header><h2>Preview</h2></header>
            <div className="body" style={{ padding: '4px 4px 8px' }}>
              {valid ? (
                <Timeline start={tl.start} origClose={tl.close} close={tl.close} forced={tl.forced} now={serverNow()} winMin={tl.x} live={false} preview />
              ) : <div className="empty">Fix the highlighted dates to see the timeline.</div>}
            </div>
            <div className="body" style={{ borderTop: '1px solid var(--line2)' }}>
              <p className="muted" style={{ fontSize: 14 }}>
                {valid && <>A qualifying event in the final <b>{tl.x} min</b> adds <b>{tl.y} min</b> to the close. The close can never go past the forced close, so at most the auction can run <b>{Math.round((tl.forced - tl.close) / 60000)} min</b> longer than planned.</>}
              </p>
            </div>
          </section>
          <button className="btn" disabled={busy} style={{ padding: '12px 16px' }}>{busy ? 'Creating…' : 'Create RFQ'}</button>
          {touched && !ok && <div className="err" role="alert">Fix the highlighted fields to continue.</div>}
        </div>
      </form>
    </>
  );
}
