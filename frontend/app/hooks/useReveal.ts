import { useEffect } from 'react';

/**
 * Registers reveal animations for elements matching a selector when they enter the viewport.
 *
 * Adds an animation class to each matched element when it becomes visible (and removes the `reveal` class).
 * If IntersectionObserver is unavailable, applies the animation classes immediately as a fallback.
 *
 * @param selector - CSS selector for target elements to reveal. Defaults to `'.reveal'`.
 * @param rootMargin - IntersectionObserver `rootMargin` controlling when elements trigger. Defaults to `'0px 0px -10% 0px'`.
 */
export function useReveal(selector: string = '.reveal', rootMargin: string = '0px 0px -10% 0px') {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
    if (elements.length === 0) return;

    if (!('IntersectionObserver' in window)) {
      elements.forEach(el => {
        if (el.classList.contains('reveal-up')) {
          el.classList.add('animate-reveal-up');
        } else {
          el.classList.add('animate-reveal-in');
        }
        el.classList.remove('reveal');
      });
      return;
    }

    const onIntersect: IntersectionObserverCallback = (entries, observer) => {
      entries.forEach(entry => {
        const el = entry.target as HTMLElement;
        if (entry.isIntersecting) {
          if (el.classList.contains('reveal-up')) {
            el.classList.add('animate-reveal-up');
          } else {
            el.classList.add('animate-reveal-in');
          }
          el.classList.remove('reveal');
          observer.unobserve(el);
        }
      });
    };

    const io = new IntersectionObserver(onIntersect, { root: null, rootMargin, threshold: 0.1 });
    elements.forEach(el => io.observe(el));

    return () => io.disconnect();
  }, [selector, rootMargin]);
} 