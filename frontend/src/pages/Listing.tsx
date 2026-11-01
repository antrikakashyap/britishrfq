import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type ListItem } from '../api';
import { StatusBadge } from '../components/bits';
import { useLive, useNow, useTitle } from '../hooks';
import { dayTime, money, span } from '../lib/format';

const FILTERS = [['ALL', 'All'], ['ACTIVE', 'Active'], ['SCHEDULED', 'Scheduled'], ['CLOSED', 'Closed'], ['FORCE_CLOSED', 'Force closed']] as const;

function Insights() {
  const { data: m } = useLive(() => api.metrics());
  if (!m) return <div className="ins">{[0, 1, 2, 3].map((i) => <div key={i}><div className="sk" style={{ width: '60%' }} /></div>)}</div>;
  const e = m.comparison.extended, n = m.comparison.nonExtended;
  return (
    <section className="ins" aria-label="Auction performance">
      <div><b className="num">{m.auctions.active}</b><span>auctions live now</span><small>{m.auctions.total} in total · {m.auctions.scheduled} scheduled</small></div>
      <div><b className="num">{m.bids.avgPerRfq}</b><span>bids per RFQ</span><small>{m.bids.total} bids across all auctions</small></div>
      <div>
        <b className="num">{e.avgBidsPerRfq ?? '-'} <span style={{ fontWeight: 500, fontSize: 14 }}>vs {n.avgBidsPerRfq ?? '-'}</span></b>
        <span>bids when extended vs not</span><small>{e.auctions} extended · {n.auctions} not extended (finished)</small>
      </div>
      <div>
        <b className="num">{e.avgPriceImprovementPct == null ? '-' : `${e.avgPriceImprovementPct}%`}</b>
        <span>lower price won in extra time</span><small>{m.extensions.extraMinutesGranted} min granted over {m.extensions.total} extensions</small>
      </div>
    </section>
  );
}

function Row({ a, now }: { a: ListItem; now: number }) {
  const nav = useNavigate();
  const close = Date.parse(a.bidClose);
  const left = close - now;
  const hot = a.status === 'ACTIVE' && left <= a.config.triggerWindowMin * 60000;
  return (
    <tr className="row" onClick={() => nav(`/auctions/${a.refId}`)}>
      <td>
        <Link to={`/auctions/${a.refId}`} className="nm">{a.name}</Link>
        <div className="ref">{a.refId}</div>
      </td>
      <td><StatusBadge s={a.status} /></td>
      <td className="r">
        {a.lowestBid ? <><div className="price num">{money(a.lowestBid.total, a.currency)}</div><div className="sub">{a.lowestBid.carrierName}</div></> : <span className="faint">No bids yet</span>}
      </td>
      <td>
        <div className="num">{dayTime(a.bidClose)}{a.extensionCount > 0 && <span className="ext" title={`Extended ${a.extensionCount} time(s)`}>+{Math.round((close - Date.parse(a.originalBidClose)) / 60000)} min</span>}</div>
        {a.status === 'ACTIVE' && <div className={`left num ${hot ? 'hot' : ''}`}>{hot ? 'In trigger window · ' : ''}{span(left)} left</div>}
        {a.status === 'SCHEDULED' && <div className="left num">Opens in {span(Date.parse(a.bidStart) - now, false)}</div>}
      </td>
      <td className="num hide-m">{dayTime(a.forcedBidClose)}</td>
      <td className="r num hide-m">{a.bidCount}<div className="sub">{a.supplierCount} {a.supplierCount === 1 ? 'supplier' : 'suppliers'}</div></td>
    </tr>
  );
}

export default function Listing() {
  useTitle('Auctions');
  const [status, setStatus] = useState('ALL');
  const [q, setQ] = useState('');
  const now = useNow();
  const { data, error } = useLive(() => api.list(q, status), [q, status]);

  return (
    <>
      <div className="head">
        <div>
          <h1>British auctions</h1>
          <p>Suppliers lower their quotes in the open. Bids near the close add time, and the forced close ends it.</p>
        </div>
        <Link to="/new" className="btn">New RFQ</Link>
      </div>
      <Insights />
      <section className="panel">
        <div className="tools">
          <div className="chips" role="group" aria-label="Filter by status">
            {FILTERS.map(([k, l]) => <button key={k} className="chip" aria-pressed={status === k} onClick={() => setStatus(k)}>{l}</button>)}
          </div>
          <input className="search" type="search" placeholder="Search by RFQ name or ID" aria-label="Search auctions" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {error && <div className="err" style={{ margin: 18 }}>{error.message}</div>}
        {!data && !error && <div style={{ padding: 18, display: 'grid', gap: 14 }}>{[0, 1, 2].map((i) => <div key={i} className="sk" />)}</div>}
        {data && data.length === 0 && (
          <div className="empty"><strong>{q || status !== 'ALL' ? 'No auctions match' : 'No auctions yet'}</strong>{q || status !== 'ALL' ? 'Try another filter or search term.' : <>Create your first RFQ to start a British auction. <Link to="/new">New RFQ</Link></>}</div>
        )}
        {data && data.length > 0 && (
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr><th>RFQ</th><th>Status</th><th className="r">Current lowest bid</th><th>Current bid close</th><th className="hide-m">Forced close</th><th className="r hide-m">Bids</th></tr></thead>
              <tbody>{data.map((a) => <Row key={a.id} a={a} now={now} />)}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
