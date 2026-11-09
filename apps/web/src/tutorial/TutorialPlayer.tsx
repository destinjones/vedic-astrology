import { useEffect, useMemo, useRef, useState } from 'react';
import './tutorial.css';

interface Chapter { id: string; title: string; sub?: string; start: number; lines: string[] }
interface Tutorial { duration: number; chapters: Chapter[] }

const MEDIA = `${import.meta.env.BASE_URL}media/`;
const PLACE_KEY = 'vedic.tutorialAt';
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * The video tour, in a dialog: the video, its chapters to jump between, and what the current chapter says
 * written out. It opens at a chapter, or where the viewer stopped last time.
 */
export default function TutorialPlayer({ chapter, onClose, onHintsBack }: { chapter: string | null; onClose: () => void; onHintsBack?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [data, setData] = useState<Tutorial | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let live = true;
    fetch(`${MEDIA}tutorial.json`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))).then((d: Tutorial) => { if (live) setData(d); }).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, []);

  // first position: the chapter asked for, or the place saved last time
  useEffect(() => {
    const v = video.current;
    if (!v || !data) return;
    const at = chapter ? data.chapters.find((c) => c.id === chapter)?.start : Number((() => { try { return localStorage.getItem(PLACE_KEY); } catch { return 0; } })()) || 0;
    const go = () => {
      v.currentTime = at && at < data.duration - 5 ? at : 0;
      if (chapter) void v.play().catch(() => {});
    };
    if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
  }, [data, chapter]);

  const current = useMemo(() => {
    if (!data) return null;
    let c = data.chapters[0];
    for (const x of data.chapters) if (now >= x.start - 0.2) c = x;
    return c;
  }, [data, now]);

  const jump = (c: Chapter) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = c.start;
    void v.play().catch(() => {});
  };
  const remember = () => { try { localStorage.setItem(PLACE_KEY, String(Math.floor(video.current?.currentTime ?? 0))); } catch { /* storage blocked */ } };

  return (
    <dialog ref={dialog} className="consult-dialog tutorial-dialog" aria-labelledby="tutorial-title" onClose={() => { remember(); onClose(); }} onCancel={() => { remember(); onClose(); }}>
      <header className="tutorial-head">
        <div>
          <h3 id="tutorial-title">Tutorial</h3>
          <p className="muted">The whole app, chapter by chapter, for astrologers. Pick a chapter, or carry on where you stopped.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => dialog.current?.close()}>Close</button>
      </header>
      <div className="tutorial-body">
        <div className="tutorial-main">
          <video
            ref={video}
            controls
            playsInline
            preload="metadata"
            width={1120}
            height={700}
            poster={`${MEDIA}tutorial.jpg`}
            onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
            onPause={remember}
            onError={() => setFailed(true)}
          >
            <source src={`${MEDIA}tutorial.mp4`} type="video/mp4" />
            <track kind="captions" srcLang="en" label="English" src={`${MEDIA}tutorial.vtt`} />
          </video>
          {failed && (
            <p className="tutorial-note" role="status">
              The video could not load. It is not kept for offline use, so it needs a connection.{' '}
              <a href={`${MEDIA}tutorial.mp4`} target="_blank" rel="noopener noreferrer">Open the video file</a>
            </p>
          )}
          {current && (
            <section className="tutorial-transcript" aria-live="polite" aria-label="What this chapter says">
              <h4>{current.title}</h4>
              {current.lines.map((l) => <p key={l}>{l}</p>)}
            </section>
          )}
        </div>
        <nav className="tutorial-chapters" aria-label="Chapters">
          <ol>
            {data?.chapters.map((c, i) => (
              <li key={c.id}>
                <button type="button" aria-current={current?.id === c.id} onClick={() => jump(c)}>
                  <time>{clock(c.start)}</time>
                  <span><b>{i + 1}. {c.title}</b>{c.sub && <small>{c.sub}</small>}</span>
                </button>
              </li>
            ))}
          </ol>
          {onHintsBack && <button type="button" className="link-btn tutorial-hints-back" onClick={onHintsBack}>Show the “How this works” links again</button>}
        </nav>
      </div>
    </dialog>
  );
}
