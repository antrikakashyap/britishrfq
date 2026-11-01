import { dayTime, time } from '../lib/format';

interface P {
  start: number;
  origClose: number;
  close: number;
  forced: number;
  now: number;
  winMin: number;
  /** show the live "now" pin */
  live: boolean;
  preview?: boolean;
}

/**
 * The auction at a glance: bidding period, extension headroom up to the forced close,
 * the trigger window that is being watched, and where "now" is.
 */
export default function Timeline({ start, origClose, close, forced, now, winMin, live, preview }: P) {
  const span = forced - origClose;
  const lo = Math.max(start, origClose - Math.max(span * 2, winMin * 60000 * 3));
  const clipped = lo > start;
  const hi = forced;
  const pc = (t: number) => Math.min(100, Math.max(0, ((t - lo) / (hi - lo)) * 100));
  const winL = pc(close - winMin * 60000);
  const extended = close > origClose;
  const nowP = pc(now);
  const nowIn = live && now >= lo && now <= hi;
  const closeP = pc(close);
  const origP = pc(origClose);
  const sameLabel = Math.abs(closeP - origP) < 14;
  return (
    <div className="tl">
      <div className="tl-track" role="img" aria-label={`Timeline: opens ${dayTime(start)}, closes ${dayTime(close)}, forced close ${dayTime(forced)}`}>
        <div className="tl-base" />
        <div className="tl-seg tl-bid" style={{ left: 0, width: `${origP}%` }} />
        {extended && <div className="tl-seg tl-ext" style={{ left: `${origP}%`, width: `${closeP - origP}%` }} />}
        <div className="tl-seg tl-gap" style={{ left: `${closeP}%`, width: `${100 - closeP}%` }} />
        <div className="tl-win" style={{ left: `${winL}%`, width: `${Math.max(closeP - winL, 0.6)}%` }} title={`Trigger window: ${winMin} min before close`} />
        {extended && <div className="tl-pin orig" style={{ left: `${origP}%` }} />}
        <div className="tl-pin" style={{ left: `${closeP}%` }} />
        <div className="tl-pin forced" style={{ left: '100%' }} />
        {nowIn && <div className="tl-pin now" style={{ left: `${nowP}%` }} />}

        <div className="tl-lab up l" style={{ left: 0 }}>
          <b>{clipped ? 'Bidding opened' : 'Bidding opens'}</b>
          {dayTime(start)}
        </div>
        <div className="tl-lab up" style={{ left: `${Math.min(Math.max(closeP, 10), 90)}%` }}>
          <b>{preview ? 'Bid close' : 'Current close'}</b>
          {time(close)}
        </div>
        {extended && !sameLabel && (
          <div className="tl-lab dn" style={{ left: `${origP}%` }}>
            <b>Original close</b>
            {time(origClose)}
          </div>
        )}
        {nowIn && Math.abs(nowP - origP) > 12 && Math.abs(nowP - 100) > 14 && (
          <div className="tl-lab dn" style={{ left: `${nowP}%` }}>
            <b style={{ color: 'var(--teal)' }}>Now</b>
            {time(now)}
          </div>
        )}
        <div className="tl-lab dn rr" style={{ left: '100%' }}>
          <b style={{ color: 'var(--red)' }}>Forced close</b>
          {dayTime(forced)}
        </div>
      </div>
      <div className="tl-key">
        <span><i style={{ background: 'var(--ink)' }} /> Bidding period</span>
        <span><i style={{ background: 'var(--amber)' }} /> Time added by extensions</span>
        <span><i style={{ background: 'repeating-linear-gradient(135deg,#c3ced8 0 3px,#dfe6ec 3px 6px)' }} /> Room left to extend</span>
        <span><i style={{ border: '2px solid var(--amber)', background: 'rgba(242,169,0,.16)' }} /> Trigger window ({winMin} min)</span>
      </div>
    </div>
  );
}
