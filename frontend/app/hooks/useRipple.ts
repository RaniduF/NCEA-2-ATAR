import { useEffect } from 'react';

export function useRipple(selector: string = '.ripple') {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (prefersReducedMotion) return;

    const ac = new AbortController();
    const onPointerDown = (e: PointerEvent) => {
      const target = (e.target as Element | null)?.closest?.(selector) as HTMLElement | null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'ripple-span';
      const size = Math.max(rect.width, rect.height) * 1.2;
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${(e.clientX - rect.left) - size / 2}px`;
      ripple.style.top = `${(e.clientY - rect.top) - size / 2}px`;
      target.appendChild(ripple);
      const remove = () => ripple.remove();
      ripple.addEventListener('animationend', remove, { once: true });
      // Fallback in case animationend doesn't fire
      window.setTimeout(() => ripple.isConnected && remove(), 1000);
    };
    document.addEventListener('pointerdown', onPointerDown, { signal: ac.signal });

    return () => ac.abort();
  }, [selector]);
} 