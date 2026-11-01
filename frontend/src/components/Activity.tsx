import type { LogRow } from '../api';
import { time } from '../lib/format';

const CLS: Record<string, string> = {
  BID_SUBMITTED: 'bid', TIME_EXTENDED: 'extend', EXTENSION_CAPPED: 'extend', EXTENSION_BLOCKED: 'blocked',
  AUCTION_CLOSED: 'end', AUCTION_FORCE_CLOSED: 'endf',
};

export default function Activity({ rows }: { rows: LogRow[] }) {
  return (
    <ol className="log" aria-label="Activity log, newest first">
      {[...rows].reverse().map((r) => (
        <li key={r.id} className={CLS[r.kind] ?? ''}>
          <div className="t"><span className="num">{time(r.at, true)}</span></div>
          <div className="m">{r.message}</div>
          {r.previousClose && r.newClose && r.kind !== 'EXTENSION_BLOCKED' && (
            <div className="cl num">Close moved {time(r.previousClose)} → {time(r.newClose)}</div>
          )}
          {r.reason && r.kind !== 'AUCTION_FORCE_CLOSED' && <div className="rs"><b>Why:</b> {r.reason}</div>}
          {r.kind === 'AUCTION_FORCE_CLOSED' && r.reason && <div className="rs"><b>Why:</b> {r.reason}</div>}
        </li>
      ))}
    </ol>
  );
}
