import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Tone = 'teal' | 'amber' | 'red';
interface T { id: number; title: string; body?: string; tone: Tone }
const Ctx = createContext<(title: string, body?: string, tone?: Tone) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastHost({ children }: { children: ReactNode }) {
  const [list, setList] = useState<T[]>([]);
  const push = useCallback((title: string, body?: string, tone: Tone = 'teal') => {
    const id = Date.now() + Math.random();
    setList((l) => [...l.slice(-3), { id, title, body, tone }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 6500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={`toast ${t.tone === 'teal' ? '' : t.tone}`}>
            <b>{t.title}</b>
            {t.body}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
