import { useMemo, useState } from 'react';
import type { BidRow, LogRow } from '../api';
import { useWidth } from '../hooks';
import { money, time } from '../lib/format';
import { supplierColors } from './bits';

interface Pt { x: number; y: number; carrier: string; at: number; total: number }

/** Each supplier's quote over time (step lines): shows who undercut whom and when the clock was extended. */
export default function PriceChart({ bids, activity, cur }: { bids: BidRow[]; activity: LogRow[]; cur: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hot, setHot] = useState<Pt | null>(null);
  const colors = useMemo(() => supplierColors(bids), [bids]);

  const series = useMemo(() => {
    const m = new Map<string, { at: number; total: number }[]>();
    for (const b of bids) (m.get(b.carrierName) ?? m.set(b.carrierName, []).get(b.carrierName)!).push({ at: Date.parse(b.submittedAt), total: b.total });
    for (const v of m.values()) v.sort((a, b) => a.at - b.at);
    return m;
  }, [bids]);

  if (bids.length < 2) return <div className="empty"><strong>The price chart appears after two bids</strong>Each supplier’s quote is plotted over time.</div>;

  const H = 270, ml = 64, mt = 14, mb = 30;
  const direct = series.size <= 4 && w > 560;
  const mr = direct ? 124 : 18;
  const all = bids.map((b) => b.total);
  const t0 = Math.min(...bids.map((b) => Date.parse(b.submittedAt)));
  const t1 = Math.max(...bids.map((b) => Date.parse(b.submittedAt)));
  const pad = Math.max((t1 - t0) * 0.04, 30000);
  const xa = t0 - pad, xb = t1 + pad;
  const lo = Math.min(...all), hi = Math.max(...all);
  const yp = Math.max((hi - lo) * 0.12, hi * 0.004);
  const ya = lo - yp, yb = hi + yp;
  const X = (t: number) => ml + ((t - xa) / (xb - xa)) * (w - ml - mr);
  const Y = (v: number) => mt + (1 - (v - ya) / (yb - ya)) * (H - mt - mb);
  const yt = [0, 1, 2, 3].map((i) => ya + ((yb - ya) * i) / 3);
  const xt = [0, 1, 2, 3].map((i) => xa + ((xb - xa) * i) / 3);
  const exts = activity.filter((a) => (a.kind === 'TIME_EXTENDED' || a.kind === 'EXTENSION_CAPPED') && Date.parse(a.at) >= xa && Date.parse(a.at) <= xb);
  const pts: Pt[] = [];
  const compact = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(v);

  const ends = [...series.entries()].map(([n, v]) => ({ n, y: Y(v[v.length - 1]!.total) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i]!.y - ends[i - 1]!.y < 14) ends[i]!.y = ends[i - 1]!.y + 14;

  const move = (e: React.MouseEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - r.left + ml, my = e.clientY - r.top + mt;
    let best: Pt | null = null, d = 1e9;
    for (const p of pts) { const q = (p.x - mx) ** 2 + (p.y - my) ** 2; if (q < d) { d = q; best = p; } }
    setHot(best);
  };

  return (
    <div>
      <div className="chart" ref={ref}>
        <svg width={w} height={H} role="img" aria-label="Line chart of each supplier’s quote over time. The same data is in the table below.">
          {yt.map((v) => (
            <g key={v}>
              <line x1={ml} x2={w - mr} y1={Y(v)} y2={Y(v)} stroke="var(--line2)" />
              <text x={ml - 8} y={Y(v) + 4} textAnchor="end">{compact(v)}</text>
            </g>
          ))}
          {xt.map((t) => <text key={t} x={X(t)} y={H - 8} textAnchor="middle">{time(t)}</text>)}
          {exts.map((a) => (
            <g key={a.id}>
              <line x1={X(Date.parse(a.at))} x2={X(Date.parse(a.at))} y1={mt} y2={H - mb} stroke="var(--ink3)" strokeWidth={1.5} strokeDasharray="3 4" />
              <path d={`M${X(Date.parse(a.at))},${H - mb - 11} l5,5 l-5,5 l-5,-5 z`} fill="var(--ink)" />
            </g>
          ))}
          {[...series.entries()].map(([n, v]) => {
            const c = colors.get(n)!;
            const d = v.map((p, i) => `${i ? `H${X(p.at)}V` : 'M' + X(p.at) + ','}${Y(p.total)}`).join(' ');
            v.forEach((p) => pts.push({ x: X(p.at), y: Y(p.total), carrier: n, at: p.at, total: p.total }));
            const last = v[v.length - 1]!;
            return (
              <g key={n}>
                <path d={d + ` H${X(t1)}`} fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" opacity={hot && hot.carrier !== n ? 0.35 : 1} />
                {v.map((p) => <circle key={p.at} cx={X(p.at)} cy={Y(p.total)} r={4} fill={c} stroke="var(--surf)" strokeWidth={2} />)}
                {direct && <text x={w - mr + 10} y={(ends.find((e) => e.n === n)?.y ?? Y(last.total)) + 4} style={{ fill: 'var(--ink)', fontWeight: 600 }}>{n.length > 15 ? n.slice(0, 14) + '…' : n}</text>}
              </g>
            );
          })}
          {hot && <circle cx={hot.x} cy={hot.y} r={7} fill="none" stroke="var(--ink)" strokeWidth={2} />}
          <rect x={ml} y={mt} width={w - ml - mr} height={H - mt - mb} fill="transparent" onMouseMove={move} onMouseLeave={() => setHot(null)} />
        </svg>
        {hot && (
          <div className="tip" style={{ left: hot.x, top: hot.y }}>
            <b>{hot.carrier}</b><br />{money(hot.total, cur)} · {time(hot.at, true)}
          </div>
        )}
      </div>
      <div className="legend">
        {[...series.keys()].map((n) => <span key={n}><i className="sw" style={{ background: colors.get(n) }} />{n}</span>)}
        {exts.length > 0 && <span><i className="sw" style={{ background: 'var(--ink)', transform: 'rotate(45deg) scale(.8)' }} />Auction extended</span>}
      </div>
    </div>
  );
}
