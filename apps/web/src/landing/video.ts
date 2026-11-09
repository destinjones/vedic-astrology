// The landing page's videos: the hero reel and the video tour's chapter list.
import { reducedMotion } from '../lib/display';

const reduce = reducedMotion();

// The hero reel plays muted on a loop once the page has loaded, unless the visitor asked for less
// motion or less data; then it waits for a press of play. It never holds up the first paint.
const reel = document.querySelector<HTMLVideoElement>('#promo');
const reelToggle = document.querySelector<HTMLButtonElement>('#promo-toggle');
if (reel && reelToggle) {
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  const show = (playing: boolean) => { reelToggle.textContent = playing ? 'Pause video' : 'Play video'; };
  reelToggle.hidden = false;
  show(false);
  reelToggle.addEventListener('click', () => { if (reel.paused) void reel.play(); else reel.pause(); });
  reel.addEventListener('play', () => show(true));
  reel.addEventListener('pause', () => show(false));
  if (!reduce && !saveData) {
    const start = () => { reel.preload = 'auto'; void reel.play().catch(() => show(false)); };
    if (document.readyState === 'complete') setTimeout(start, 300); else addEventListener('load', () => setTimeout(start, 300), { once: true });
  }
}

// The tour's chapter list comes from the same file the app's player uses, fetched once the section is near.
const tour = document.querySelector<HTMLVideoElement>('#tour-video');
const list = document.querySelector<HTMLOListElement>('#tour-chapters');
if (tour && list && 'IntersectionObserver' in window) {
  const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const near = new IntersectionObserver(async ([e]) => {
    if (!e.isIntersecting) return;
    near.disconnect();
    try {
      const data: { chapters: { id: string; title: string; start: number }[] } = await (await fetch(`${import.meta.env.BASE_URL}media/tutorial.json`)).json();
      const buttons = data.chapters.map((c) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = `<time></time><span></span>`;
        b.querySelector('time')!.textContent = clock(c.start);
        b.querySelector('span')!.textContent = c.title;
        b.addEventListener('click', () => { tour.currentTime = c.start; void tour.play(); });
        const li = document.createElement('li');
        li.append(b);
        return li;
      });
      list.replaceChildren(...buttons);
      tour.addEventListener('timeupdate', () => {
        let on = 0;
        data.chapters.forEach((c, i) => { if (tour.currentTime >= c.start - 0.2) on = i; });
        buttons.forEach((li, i) => li.firstElementChild!.setAttribute('aria-current', String(i === on)));
      });
    } catch { /* offline: the video still plays with its own controls */ }
  }, { rootMargin: '400px' });
  near.observe(tour);
}
