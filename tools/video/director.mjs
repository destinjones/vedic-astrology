// Screen capture and stage directions for tools/record-videos.mjs.
//
// Capture records the page through the Chrome DevTools screencast, which sends a frame each time
// the screen changes, stamped with the time it was drawn. Frames are written to disk and stitched
// into a video by ffmpeg with their real durations, so scrolls and animations play at real speed.
// Pausing the capture (while a page loads, say) cuts that stretch out of the video.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OVERLAY = readFileSync(new URL('./overlay.js', import.meta.url), 'utf8');

export class Capture {
  constructor(page, dir, { width, height, quality = 88 }) {
    this.page = page; this.dir = dir; this.size = { width, height }; this.quality = quality;
    this.frames = []; this.cut = 0; this.origin = null; this.pausedAt = 0; this.running = false;
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  }

  /** Seconds of video recorded so far. */
  now() { return this.origin == null ? 0 : (this.running ? Date.now() / 1000 : this.pausedAt) - this.origin - this.cut; }

  async attach() {
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on('Page.screencastFrame', ({ data, sessionId }) => {
      void this.cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
      if (!this.running) return;
      const t = Math.max(this.now(), this.frames.at(-1)?.t ?? 0);
      const file = join(this.dir, `f${String(this.frames.length).padStart(6, '0')}.jpg`);
      this.frames.push({ t, file });
      writeFileSync(file, Buffer.from(data, 'base64'));
    });
  }

  async resume() {
    if (this.running) return;
    if (!this.cdp) await this.attach();
    const now = Date.now() / 1000;
    if (this.origin == null) this.origin = now; else this.cut += now - this.pausedAt;
    this.running = true;
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: this.quality, maxWidth: this.size.width, maxHeight: this.size.height, everyNthFrame: 1 });
  }

  async pause() {
    if (!this.running) return;
    this.running = false;
    this.pausedAt = Date.now() / 1000;
    await this.cdp.send('Page.stopScreencast').catch(() => {});
  }

  /** Encodes the frames to an H.264 MP4 and returns its duration in seconds. */
  encode(out, { fps = 25, crf = 30, width = this.size.width, height = this.size.height, tail = 0.5 } = {}) {
    const end = this.now() + tail;
    const list = this.frames.map((f, i) => {
      const next = this.frames[i + 1]?.t ?? end;
      return `file '${f.file}'\nduration ${Math.max(0.001, next - f.t).toFixed(4)}`;
    });
    list.push(`file '${this.frames.at(-1).file}'`);
    const listFile = join(this.dir, 'frames.txt');
    writeFileSync(listFile, `${list.join('\n')}\n`);
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
      '-vf', `fps=${fps},scale=${width}:${height}:flags=lanczos,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'veryslow', '-crf', String(crf), '-tune', 'animation',
      '-x264-params', 'keyint=125:min-keyint=25', '-movflags', '+faststart', '-an',
      '-metadata', 'creation_time=1970-01-01T00:00:00Z', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:v', '+bitexact',
      out,
    ], { stdio: 'inherit' });
    return end;
  }

  /** Saves the frame shown at second `t` as a JPEG poster. */
  poster(t, out, { width = this.size.width, height = this.size.height, quality = 6 } = {}) {
    const f = [...this.frames].reverse().find((x) => x.t <= t) ?? this.frames[0];
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', f.file, '-vf', `scale=${width}:${height}:flags=lanczos`, '-q:v', String(quality), out]);
  }
}

const words = (s) => s.trim().split(/\s+/).length;
/** Time to read a caption comfortably: about 2.9 words a second, never under 3.2 s. */
export const readMs = (text) => Math.max(3200, Math.round(words(text) / 2.9 * 1000) + 900);

export class Director {
  constructor(page, capture) {
    this.page = page; this.cap = capture;
    this.chapters = []; this.cues = []; this.label = ''; this.cue = null; this.mouse = { x: 640, y: 400 };
  }

  static async prepare(context) { await context.addInitScript(OVERLAY); }

  wait(ms) { return this.page.waitForTimeout(ms); }
  run(fn, ...args) { return this.page.evaluate(fn, ...args); }

  /** Starts a chapter with a title card. */
  async chapter(id, title, sub, number) {
    await this.caption(null);
    await this.ring(null);
    this.label = title;
    this.chapters.push({ id, title, sub, start: +this.cap.now().toFixed(2) });
    await this.run(([e, t, s]) => window.__dir.card(e, t, s), [number ? `Chapter ${number}` : '', title, sub ?? '']);
    await this.wait(2300);
    await this.run(() => window.__dir.card());
    await this.wait(450);
  }

  /** Starts a caption cue for the WebVTT file without drawing anything (the promo draws its own headlines). */
  note(text) {
    const t = +this.cap.now().toFixed(2);
    if (this.cue) { this.cue.end = t; this.cues.push(this.cue); this.cue = null; }
    if (text) this.cue = { start: t, text };
  }

  async caption(text) {
    this.note(text);
    await this.run(([x, l]) => window.__dir.caption(x, l), [text ?? '', this.label]);
  }

  /** Shows a caption, runs the action alongside it, and holds until the caption has been read. */
  async say(text, action, extraMs = 0) {
    const t0 = Date.now();
    await this.caption(text);
    if (action) await action();
    const left = readMs(text) + extraMs - (Date.now() - t0);
    if (left > 0) await this.wait(left);
  }

  ring(selector, pad = 8) { return this.run(([s, p]) => window.__dir.ring(s, p), [selector, pad]); }
  pointer(on = true) { return this.run((o) => window.__dir.pointer(o), on); }
  scrollTo(selector, offset = 16, ms = 1100) { return this.run(([s, o, m]) => window.__dir.scrollTo(s, o, m), [selector, offset, ms]); }
  scrollBy(dy, ms = 900) { return this.run(([d, m]) => window.__dir.scrollBy(d, m), [dy, ms]); }
  scrollWithin(box, selector, offset = 16, ms = 900) { return this.run(([b, s, o, m]) => window.__dir.scrollWithin(b, s, o, m), [box, selector, offset, ms]); }

  /** Moves the visible pointer to a point over about half a second. */
  async moveTo(x, y, ms = 520) {
    const steps = Math.max(8, Math.round(ms / 20));
    const { x: x0, y: y0 } = this.mouse;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps; const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      await this.page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e);
      await this.wait(16);
    }
    this.mouse = { x, y };
  }

  async point(locator, { dx = 0.5, dy = 0.5, ms } = {}) {
    await this.pointer(true);
    const box = await locator.boundingBox();
    if (!box) throw new Error(`Nothing to point at: ${locator}`);
    await this.moveTo(box.x + box.width * dx, box.y + box.height * dy, ms);
    return box;
  }

  async click(locator, opts = {}) {
    await this.point(locator, opts);
    await this.wait(140);
    await this.page.mouse.down();
    await this.page.mouse.up();
    await this.wait(opts.after ?? 450);
  }

  async type(locator, text, delay = 70) {
    await this.click(locator);
    await locator.pressSequentially(text, { delay });
  }

  finish() {
    if (this.cue) { this.cue.end = +this.cap.now().toFixed(2); this.cues.push(this.cue); this.cue = null; }
  }
}

const stamp = (s) => {
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = (s % 60).toFixed(3).padStart(6, '0');
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sec}`;
};

/** WebVTT captions from the cues the director showed. */
export function vtt(cues) {
  return `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n')}`;
}
