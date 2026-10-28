"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface Toast { id: number; msg: string; err?: boolean }

const Ctx = createContext<{ toast: (msg: string, err?: boolean) => void }>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((msg: string, err?: boolean) => {
    const id = ++idRef.current;
    setList((l) => [...l, { id, msg, err }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3800);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="toasts">
        {list.map((t) => (
          <div key={t.id} className={"toast show" + (t.err ? " err" : "")}>{t.msg}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
