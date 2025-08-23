import { useCallback, useRef } from "react";

export type LongPressHandlers = {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
};

export function useLongPress(callback: () => void, ms = 500): LongPressHandlers {
  const timerRef = useRef<number | null>(null);

  const start = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      callback();
    }, ms);
  }, [callback, ms]);

  const clear = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return {
    onTouchStart: () => start(),
    onTouchEnd: () => clear(),
    onMouseDown: () => start(),
    onMouseUp: () => clear(),
    onContextMenu: (e) => {
      e.preventDefault();
      callback();
    },
  };
}
