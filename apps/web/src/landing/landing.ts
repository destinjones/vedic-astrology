import '../fonts';
import './landing.css';
import '../a11y.css';
import { reducedMotion } from '../lib/display';

// Counts the headline numbers up once they scroll into view. The real numbers
// are already in the HTML, so nothing is lost without JavaScript or with reduced motion.
const reduce = reducedMotion();

if (!reduce && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const el = e.target as HTMLElement;
      const end = Number(el.dataset.count);
      const suffix = el.dataset.suffix ?? '';
      const t0 = performance.now();
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / 900);
        el.textContent = `${Math.round(end * (1 - (1 - k) ** 3))}${k === 1 ? suffix : ''}`;
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach((el) => io.observe(el));
}
