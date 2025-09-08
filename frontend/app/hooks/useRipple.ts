import { useEffect } from 'react';

export function useRipple(selector: string = '.ripple') {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
    if (elements.length === 0) return;

    const handlers: Array<{ el: HTMLElement; onClick: (e: MouseEvent) => void }> = [];

    elements.forEach(el => {
      const onClick = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'ripple-span';
        const size = Math.max(rect.width, rect.height) * 1.2;
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${(e.clientX - rect.left) - size / 2}px`;
        ripple.style.top = `${(e.clientY - rect.top) - size / 2}px`;
        el.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
      };
      el.addEventListener('click', onClick);
      handlers.push({ el, onClick });
    });

    return () => {
      handlers.forEach(({ el, onClick }) => el.removeEventListener('click', onClick));
    };
  }, [selector]);
} 