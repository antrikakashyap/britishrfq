import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type Details as D } from '../api';
import Activity from '../components/Activity';
import BidForm from '../components/BidForm';
import { StatusBadge, supplierColors } from '../components/bits';
import Leaderboard from '../components/Leaderboard';
import PriceChart from '../components/PriceChart';
import Timeline from '../components/Timeline';
import { useLive, useNow, useTitle } from '../hooks';
import { dateOnly, dayTime, fullDate, money, span, tzShort, TRIG_TEXT } from '../lib/format';
import { useState } from 'react';

function Clock({ d, now }: { d: D; now: number }) {
  const a = d.auction;
  const close = Date.parse(a.bidClose);
  const left = close - now;
  const inWin = a.status === 'ACTIVE' && left <= a.config.triggerWindowMin * 60000;
  if (a.status === 'SCHEDULED')
    return <div className="clock"><div className="big num">{span(Date.parse(a.bidStart) - now, false)}</div><div className="cap">until bidding opens</div></div>;
  if (a.status !== 'ACTIVE')
    return <div className="clock done"><div className="big">{a.status === 'FORCE_CLOSED' ? 'Force closed' : 'Closed'}</div><div className="cap num">{dayTime(a.bidClose)}</div></div>;
  return (
    <div className="clock">
      <div className="big num" aria-live="off">{span(left)}</div>
      <div className="cap">{inWin && <span className="live"><i /> Trigger window open</span>}<span>until close at <b className="num">{dayTime(a.bidClose)}</b></span></div>
    </div>
  );
}

export default function Details() {
  const { key = '' } = useParams();
  const now = useNow();
  const { data: d, error, refresh } = useLive(() => api.get(key), [key], (_i, ref) => ref.toLowerCase() === key.toLowerCase() || String(_i) === key);
  const [demo, setDemo] = useState(false);
  const [local, setLocal] = useState<D>();
  useEffect(() => { api.meta().then((m) => setDemo(m.demo)).catch(() => {}); }, []);
  useEffect(() => { setLocal(undefined); }, [key]);
  const data = d && local && Date.parse(local.serverTime) > Date.parse(d.serverTime) ? local : d;
  useTitle(data?.auction.refId ?? 'Auction');

  // when the countdown reaches zero, ask the server for the new state (closed / extended)
  const fired = useRef('');
  useEffect(() => {
    if (!data) return;
    const sig = `${data.auction.status}-${data.auction.bidClose}`;
    const t = data.auction.status === 'SCHEDULED' ? Date.parse(data.auction.bidStart) : Date.parse(data.auction.bidClose);
    if (data.auction.status !== 'CLOSED' && data.auction.status !== 'FORCE_CLOSED' && now >= t && fired.current !== sig) {
      fired.current = sig;
      setTimeout(refresh, 400);
    }
  }, [now, data, refresh]);

  if (error && !data) return <div><Link to="/" className="crumb">← All auctions</Link><div className="err">{error.status === 404 ? `No RFQ "${key}" exists.` : error.message}</div></div>;
  if (!data) return <div style={{ display: 'grid', gap: 14 }}><div className="sk" style={{ width: 220, height: 26 }} /><div className="sk" style={{ height: 120 }} /><div className="sk" style={{ height: 260 }} /></div>;

  const a = data.auction;
  const finished = a.status === 'CLOSED' || a.status === 'FORCE_CLOSED';
  const colors = supplierColors(data.bids);

  return (
    <>
      <Link to="/" className="crumb">← All auctions</Link>
      <div className="dhead">
        <div>
          <div className="ref"><span>{a.refId}</span><StatusBadge s={a.status} />{a.extensionCount > 0 && <span className="ext" style={{ marginLeft: 0 }}>Extended {a.extensionCount}× · +{a.totalExtendedMin} min</span>}</div>
          <h1>{a.name}</h1>
          {a.description && <p className="muted" style={{ marginTop: 6, maxWidth: '70ch' }}>{a.description}</p>}
        </div>
        <Clock d={data} now={now} />
      </div>

      <section className="panel" style={{ marginBottom: 18 }}>
        <header><h2>Auction timeline</h2><span className="sub">Times shown in {tzShort()}</span></header>
        <Timeline start={Date.parse(a.bidStart)} origClose={Date.parse(a.originalBidClose)} close={Date.parse(a.bidClose)} forced={Date.parse(a.forcedBidClose)} now={now} winMin={a.config.triggerWindowMin} live={a.status === 'ACTIVE'} />
      </section>

      <div className="grid">
        <div className="stack">
          <section className="panel">
            <header>
              <h2>{finished ? 'Final ranking' : 'Supplier ranking'}</h2>
              <span className="sub num">{a.supplierCount} suppliers · {a.bidCount} bids</span>
            </header>
            <Leaderboard d={data} final={finished} />
          </section>

          <section className="panel">
            <header><h2>Quotes over time</h2><span className="sub">Hover a point for details</span></header>
            <PriceChart bids={data.bids} activity={data.activity} cur={a.currency} />
          </section>

          <section className="panel">
            <header><h2>All bids by price</h2><span className="sub">Lowest first · highlighted rows are each supplier’s current quote</span></header>
            {data.bids.length === 0 ? <div className="empty"><strong>No bids yet</strong></div> : (
              <div className="tblwrap">
                <table className="tbl lb">
                  <thead><tr><th>Supplier</th><th className="r">Total</th><th className="hide-m">Freight</th><th className="hide-m">Origin</th><th className="hide-m">Destination</th><th>Transit</th><th className="hide-m">Valid until</th><th>Submitted</th></tr></thead>
                  <tbody>
                    {data.bids.map((b) => (
                      <tr key={b.bidId} className={`hist-row ${b.isCurrent ? 'cur' : ''}`}>
                        <td><div className="who"><i className="sw" style={{ background: colors.get(b.carrierName) }} />{b.carrierName}</div>{b.isCurrent && <div className="sub">Current · L{b.supplierRank}</div>}</td>
                        <td className="r num"><b>{money(b.total, a.currency)}</b></td>
                        <td className="hide-m num det">{money(b.freightCharges, a.currency)}</td>
                        <td className="hide-m num det">{money(b.originCharges, a.currency)}</td>
                        <td className="hide-m num det">{money(b.destinationCharges, a.currency)}</td>
                        <td className="num det">{b.transitTimeDays}d</td>
                        <td className="hide-m num det">{dateOnly(b.validUntil)}</td>
                        <td className="num det">{dayTime(b.submittedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <header><h2>{a.status === 'ACTIVE' ? 'Place a bid' : 'Bidding'}</h2></header>
            <BidForm d={data} now={now} demo={demo} onDone={(r) => { setLocal(r.auction); void refresh(); }} />
          </section>

          <section className="panel">
            <header><h2>Auction configuration</h2></header>
            <div className="body">
              <dl className="kv">
                <dt>Trigger window (X)</dt><dd className="num">{a.config.triggerWindowMin} min</dd>
                <dt>Extension duration (Y)</dt><dd className="num">{a.config.extensionMin} min</dd>
                <dt>Extension trigger</dt><dd>{TRIG_TEXT[a.config.triggerType].replace('X', String(a.config.triggerWindowMin))}</dd>
                <dt>Bidding opens</dt><dd className="num">{fullDate(a.bidStart)}</dd>
                <dt>Original bid close</dt><dd className="num">{fullDate(a.originalBidClose)}</dd>
                <dt>Current bid close</dt><dd className="num">{fullDate(a.bidClose)}</dd>
                <dt>Forced bid close</dt><dd className="num">{fullDate(a.forcedBidClose)}</dd>
                <dt>Pickup / service date</dt><dd className="num">{dateOnly(a.pickupDate)}</dd>
                <dt>Currency</dt><dd>{a.currency}</dd>
              </dl>
            </div>
          </section>

          <section className="panel">
            <header><h2>Activity log</h2><span className="sub">{data.activity.length} events</span></header>
            <Activity rows={data.activity} />
          </section>
        </div>
      </div>
    </>
  );
}
