import type { Details } from '../api';
import { dateOnly, money } from '../lib/format';
import { supplierColors } from './bits';

export default function Leaderboard({ d, final }: { d: Details; final: boolean }) {
  const cur = d.auction.currency;
  const colors = supplierColors(d.bids);
  if (!d.ranking.length) return <div className="empty"><strong>No bids yet</strong>Suppliers appear here ranked L1, L2, L3… as soon as they quote.</div>;
  return (
    <div className="tblwrap">
      <table className="tbl lb">
        <thead>
          <tr><th>Rank</th><th>Supplier</th><th className="r">Total quote</th><th className="hide-m">Quote breakdown</th><th className="hide-m">Transit</th><th className="hide-m">Valid until</th></tr>
        </thead>
        <tbody>
          {d.ranking.map((r) => (
            <tr key={r.bidId}>
              <td><span className={`rk ${r.rank === 1 ? 'l1' : ''}`}>{r.label}</span></td>
              <td>
                <div className="who"><i className="sw" style={{ background: colors.get(r.carrierName) }} />{r.carrierName}</div>
                <div className="sub">{r.bidsPlaced} {r.bidsPlaced === 1 ? 'bid' : 'bids'}{r.isLowest && final ? ' · winning bid' : ''}</div>
              </td>
              <td className="r"><div className="price num">{money(r.total, cur)}</div>
                {r.rank > 1 && <div className="chg num">+{money(r.total - d.ranking[0]!.total, cur)} vs L1</div>}</td>
              <td className="hide-m det num">
                <div>Freight <b>{money(r.freightCharges, cur)}</b></div>
                <div>Origin <b>{money(r.originCharges, cur)}</b> · Dest. <b>{money(r.destinationCharges, cur)}</b></div>
              </td>
              <td className="hide-m det num">{r.transitTimeDays} days</td>
              <td className="hide-m det num">{dateOnly(r.validUntil)}<div className="mini">{r.quoteValidityDays} day validity</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
