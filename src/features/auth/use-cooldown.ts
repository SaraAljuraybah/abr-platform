import { useCallback, useEffect, useState } from 'react';

/**
 * A countdown that starts on mount. Measured against the clock, not by counting ticks, so a
 * throttled background tab still ends on time. restart() starts it again from the full length.
 */
export function useCooldown(seconds: number) {
  const [endsAt, setEndsAt] = useState(() => Date.now() + seconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  const running = now < endsAt;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [running, endsAt]);

  const restart = useCallback(() => {
    const start = Date.now();
    setNow(start);
    setEndsAt(start + seconds * 1000);
  }, [seconds]);

  return { secondsLeft: Math.max(0, Math.ceil((endsAt - now) / 1000)), restart };
}

/** 42 → "0:42", 60 → "1:00". */
export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
