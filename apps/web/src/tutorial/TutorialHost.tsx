import { lazy, Suspense, useEffect, useState } from 'react';
import chapters from './chapters.json';
import { TUTORIAL_EVENT, openTutorial } from './open';
import './dock.css';

const TutorialPlayer = lazy(() => import('./TutorialPlayer'));
const HIDE_KEY = 'vedic.tutorialHint';

/** Which chapter covers what is on screen now: the mapped section that crosses the upper part of the window. */
function chapterOnScreen(): (typeof chapters)[number] | null {
  if (document.querySelector('dialog[open], .ss-overlay, .is-presenting')) return null;
  const line = innerHeight * 0.35;
  let best: (typeof chapters)[number] | null = null;
  for (const c of chapters) {
    for (const sel of c.sections) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.height && r.top <= line && r.bottom >= line) best = c;
    }
  }
  return best;
}

/**
 * Hosts the tutorial: the player (loaded only when opened) and a small "watch how this part works"
 * link that follows the section on screen. The link can be turned off; the Tutorial button stays.
 */
export function TutorialHost() {
  const [open, setOpen] = useState<{ chapter: string | null } | null>(null);
  const [here, setHere] = useState<(typeof chapters)[number] | null>(null);
  const [hint, setHint] = useState(() => { try { return localStorage.getItem(HIDE_KEY) !== 'off'; } catch { return true; } });

  useEffect(() => {
    const onOpen = (e: Event) => setOpen({ chapter: (e as CustomEvent<string | null>).detail });
    addEventListener(TUTORIAL_EVENT, onOpen);
    return () => removeEventListener(TUTORIAL_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!hint) return;
    let frame = 0;
    const check = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => setHere(chapterOnScreen())); };
    check();
    addEventListener('scroll', check, { passive: true });
    addEventListener('resize', check);
    const timer = setInterval(check, 1500); // panels and dialogs open without a scroll
    return () => { removeEventListener('scroll', check); removeEventListener('resize', check); clearInterval(timer); cancelAnimationFrame(frame); };
  }, [hint]);

  const hide = () => { setHint(false); try { localStorage.setItem(HIDE_KEY, 'off'); } catch { /* storage blocked */ } };

  return (
    <>
      {hint && here && !open && (
        <div className="tutorial-hint" role="complementary" aria-label="Tutorial for this part">
          <button type="button" className="tutorial-hint-open" onClick={() => openTutorial(here.id)}>
            <span aria-hidden>▶</span> <span className="tutorial-hint-label">How this works:</span> <b>{here.title}</b>
          </button>
          <button type="button" className="tutorial-hint-hide" onClick={hide} aria-label="Hide these tutorial links (the Tutorial button stays at the top)" title="Hide these links">×</button>
        </div>
      )}
      {open && (
        <Suspense fallback={null}>
          <TutorialPlayer chapter={open.chapter} onClose={() => setOpen(null)} onHintsBack={hint ? undefined : () => { setHint(true); try { localStorage.removeItem(HIDE_KEY); } catch { /* storage blocked */ } }} />
        </Suspense>
      )}
    </>
  );
}
