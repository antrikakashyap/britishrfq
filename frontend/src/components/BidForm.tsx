import { useMemo, useState } from 'react';
import { api, ApiError, type BidResult, type Details } from '../api';
import { dayTime, money, time } from '../lib/format';
import { useToast } from './Toast';

const KEY = 'rfq.carrier';
const load = (): string => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } };

interface P { d: Details; now: number; demo: boolean; onDone: (r: BidResult) => void }

export default function BidForm({ d, now, demo, onDone }: P) {
  const toast = useToast();
  const a = d.auction;
  const [f, setF] = useState({ carrier: load(), fr: '', og: '', ds: '', tr: '21', vd: '14' });
  const [errs, setErrs] = useState<Record<string, string[]>>({});
  const [top, setTop] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
  const total = [f.fr, f.og, f.ds].reduce((s, v) => s + (num(v) || 0), 0);
  const mine = useMemo(() => d.ranking.find((r) => r.carrierName.toLowerCase() === f.carrier.trim().replace(/\s+/g, ' ').toLowerCase()), [d.ranking, f.carrier]);
  const close = Date.parse(a.bidClose);
  const winMs = a.config.triggerWindowMin * 60000;
  const inWin = a.status === 'ACTIVE' && now >= close - winMs;
  const nextClose = Math.min(close + a.config.extensionMin * 60000, Date.parse(a.forcedBidClose));
  const atCeiling = close >= Date.parse(a.forcedBidClose);

  if (a.status === 'SCHEDULED')
    return <div className="body"><div className="notice">Bidding opens {dayTime(a.bidStart)}. You can submit quotes from then until the auction closes.</div></div>;
  if (a.status !== 'ACTIVE')
    return <div className="body"><div className="notice">Bidding has ended{a.status === 'FORCE_CLOSED' ? ' at the Forced Bid Close time' : ''}. No more quotes are accepted.</div></div>;

  const trigText =
    a.config.triggerType === 'BID_RECEIVED' ? 'Any bid placed now' : a.config.triggerType === 'ANY_RANK_CHANGE' ? 'A bid that changes the supplier ranking' : 'A bid that makes you the lowest bidder (L1)';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErrs({}); setTop('');
    try {
      const r = await api.bid(a.refId, {
        carrierName: f.carrier,
        freightCharges: num(f.fr), originCharges: num(f.og), destinationCharges: num(f.ds),
        transitTimeDays: num(f.tr), quoteValidityDays: num(f.vd),
      });
      try { localStorage.setItem(KEY, f.carrier.trim()); } catch { /* private mode */ }
      const x = r.extension;
      toast(
        `Bid placed - you are ${r.rankLabel}`,
        x.outcome === 'EXTENDED' ? `Auction extended to ${time(x.newClose)}.` : x.outcome === 'CAPPED' ? `Extended to ${time(x.newClose)}, the Forced Bid Close - the last extension possible.` : x.outcome === 'BLOCKED' ? 'Already at the Forced Bid Close - no further extension.' : undefined,
        x.extended ? 'amber' : 'teal',
      );
      setF({ ...f, fr: '', og: '', ds: '' });
      onDone(r);
    } catch (err) {
      const e2 = err as ApiError;
      setErrs(e2.fields ?? {});
      setTop(e2.message);
      if (e2.code === 'AUCTION_CLOSED') toast('Bidding has closed', e2.message, 'red');
    } finally { setBusy(false); }
  }

  const fld = (k: string, label: string, el: React.ReactNode, hint?: string) => (
    <div className={`f ${errs[k] ? 'bad' : ''}`}>
      <label htmlFor={`b-${k}`}>{label}</label>
      {el}
      {errs[k] ? <span className="msg" role="alert">{errs[k]![0]}</span> : hint && <span className="hint">{hint}</span>}
    </div>
  );
  const inp = (k: keyof typeof f, fk: string, p: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input id={`b-${fk}`} value={f[k]} onChange={set(k)} aria-invalid={!!errs[fk]} {...p} />
  );

  return (
    <form className="body form" onSubmit={submit} noValidate>
      {inWin && (
        <div className="notice warn">
          <b>Inside the trigger window.</b>{' '}
          {atCeiling ? 'The auction is at its Forced Bid Close, so it cannot be extended again.' : `${trigText} extends the close by ${a.config.extensionMin} min, to ${time(nextClose)}${nextClose < close + a.config.extensionMin * 60000 ? ' (capped at the Forced Bid Close)' : ''}.`}
        </div>
      )}
      {top && <div className="err" role="alert">{top}</div>}
      {fld('carrierName', 'Carrier name', <>
        {inp('carrier', 'carrierName', { list: 'carriers', autoComplete: 'organization', placeholder: 'e.g. Maersk Line' })}
        <datalist id="carriers">{d.ranking.map((r) => <option key={r.bidId} value={r.carrierName} />)}</datalist>
      </>, mine ? `Your current bid is ${money(mine.total, a.currency)} (${mine.label}). A new quote must be lower.` : undefined)}
      <div className="three">
        {fld('freightCharges', 'Freight', inp('fr', 'freightCharges', { inputMode: 'decimal', placeholder: '0.00' }))}
        {fld('originCharges', 'Origin', inp('og', 'originCharges', { inputMode: 'decimal', placeholder: '0.00' }))}
        {fld('destinationCharges', 'Destination', inp('ds', 'destinationCharges', { inputMode: 'decimal', placeholder: '0.00' }))}
      </div>
      <div className="sum"><span>Total quote ({a.currency})</span><b className="num">{money(total, a.currency)}</b></div>
      <div className="two">
        {fld('transitTimeDays', 'Transit time (days)', inp('tr', 'transitTimeDays', { inputMode: 'numeric' }))}
        {fld('quoteValidityDays', 'Quote valid for (days)', inp('vd', 'quoteValidityDays', { inputMode: 'numeric' }))}
      </div>
      <button className="btn" disabled={busy}>{busy ? 'Placing bid…' : 'Place bid'}</button>
      {demo && (
        <div className="demo">
          <button type="button" className="btn ghost sm" disabled={busy} onClick={async () => {
            setBusy(true);
            try { const r = await api.simulate(a.refId); toast('Rival bid placed', r.extension.extended ? `Auction extended to ${time(r.extension.newClose)}.` : `They are ${r.rankLabel}.`, r.extension.extended ? 'amber' : 'teal'); onDone(r); }
            catch (e) { toast('Could not place rival bid', (e as Error).message, 'red'); }
            finally { setBusy(false); }
          }}>Simulate a rival bid</button>
          <span>Demo helper: another carrier undercuts.</span>
        </div>
      )}
    </form>
  );
}
