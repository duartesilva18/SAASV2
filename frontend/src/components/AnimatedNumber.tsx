'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  formatFn?: (v: number) => string;
  className?: string;
  title?: string;
}

export default function AnimatedNumber({
  value,
  duration = 800,
  formatFn,
  className,
  title,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);
  const rafId = useRef<number>(0);
  const mounted = useRef(false);

  useEffect(() => {
    const start = mounted.current ? prevValue.current : 0;
    mounted.current = true;
    const end = typeof value === 'number' ? value : Number(value) || 0;
    const diff = end - start;

    if (Math.abs(diff) < 0.01) {
      setDisplay(end);
      prevValue.current = end;
      return;
    }

    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + diff * eased);

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate);
      } else {
        setDisplay(end);
        prevValue.current = end;
      }
    };

    rafId.current = requestAnimationFrame(animate);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [value, duration]);

  return (
    <span className={className} title={title}>
      {formatFn ? formatFn(display) : display.toFixed(0)}
    </span>
  );
}
