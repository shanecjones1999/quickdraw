import { useState, useEffect } from 'react';

export function useTimer(startTime: number | null): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (startTime === null) { setElapsed(0); return; }
    const tick = () => setElapsed(Date.now() - startTime);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  return elapsed;
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
