import { createContext, useCallback, useRef, useState, ReactNode } from 'react';
import { Icon } from '../utils/icons';

export type ToastType = 'ok' | 'err' | 'info';

interface ToastItem {
  id: number;
  msg: string;
  type: ToastType;
  leaving: boolean;
}

interface ToastContextType {
  toast: (msg: string, type?: ToastType) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

const ICON_BY_TYPE: Record<ToastType, 'check' | 'warn' | 'info'> = {
  ok: 'check',
  err: 'warn',
  info: 'info',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((msg: string, type: ToastType = 'ok') => {
    const id = ++idRef.current;
    setItems((prev) => [...prev, { id, msg, type, leaving: false }]);
    setTimeout(() => {
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 320);
    }, 3400);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-stack">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type}${t.leaving ? ' out' : ''}`}>
            <span className="t-ico"><Icon name={ICON_BY_TYPE[t.type]} size={15} strokeWidth={2.2} /></span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
