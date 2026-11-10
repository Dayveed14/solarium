import { useEffect } from 'react';

// Fades sections in as they scroll into view. Elements opt in with className="reveal" (and an optional --d delay).
// Nothing is hidden until this has started, and nothing is hidden at all for people who prefer reduced motion,
// so content is never stuck invisible. It checks positions on scroll instead of using IntersectionObserver, so an
// element the reader jumps straight past (an anchor link, the End key) is still revealed when they scroll back.
export function useReveal(dep) {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const root = document.documentElement;
    let pending = [...document.querySelectorAll('.reveal:not(.in)')];
    if (pending.length === 0) return undefined;
    root.classList.add('js-reveal');

    let frame = 0;
    const check = () => {
      frame = 0;
      const limit = window.innerHeight * 0.92;
      pending = pending.filter((el) => {
        if (el.getBoundingClientRect().top < limit) { el.classList.add('in'); return false; }
        return true;
      });
      if (pending.length === 0) stop();
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(check); };
    const stop = () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => { stop(); if (frame) cancelAnimationFrame(frame); root.classList.remove('js-reveal'); };
  }, [dep]);
}
