import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, serverNow } from './api';

/** server-corrected "now", ticking every second */
export function useNow(every = 1000): number {
  const [n, setN] = useState(serverNow());
  useEffect(() => {
    const t = setInterval(() => setN(serverNow()), every);
    return () => clearInterval(t);
  }, [every]);
  return n;
}

/**
 * Loads data and keeps it fresh: refetches on every server push (SSE), on tab focus,
 * and on a slow poll as a safety net if the stream is blocked by a proxy.
 */
export function useLive<T>(load: () => Promise<T>, deps: unknown[] = [], filter?: (rfqId: number, refId: string) => boolean) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiError>();
  const [live, setLive] = useState(false);
  const fn = useRef(load);
  fn.current = load;
  const flt = useRef(filter);
  flt.current = filter;
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const d = await fn.current();
      if (mine === seq.current) {
        setData(d);
        setError(undefined);
      }
    } catch (e) {
      if (mine === seq.current) setError(e as ApiError);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setData(undefined); void refresh(); }, deps);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bump = () => { clearTimeout(timer); timer = setTimeout(() => void refresh(), 120); };
    const es = new EventSource('/api/events');
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    for (const t of ['created', 'bid', 'extended', 'status'])
      es.addEventListener(t, (ev) => {
        try {
          const e = JSON.parse((ev as MessageEvent).data) as { rfqId: number; refId: string };
          if (!flt.current || flt.current(e.rfqId, e.refId)) bump();
        } catch { bump(); }
      });
    const poll = setInterval(() => void refresh(), 15000);
    const vis = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', vis);
    return () => { es.close(); clearInterval(poll); clearTimeout(timer); document.removeEventListener('visibilitychange', vis); };
  }, [refresh]);

  return { data, error, live, refresh };
}

export function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => e && setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref as React.RefObject<T>, w];
}

export function useTitle(t: string): void {
  useEffect(() => { document.title = `${t} · British Auction RFQ`; }, [t]);
}
