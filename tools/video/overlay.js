// Injected into every page while recording (see tools/record-videos.mjs). Draws the captions,
// chapter cards, a highlight ring and a visible mouse pointer on top of the real app, so the
// recording shows the app exactly as it is with the explanation laid over it.
(() => {
  if (window.top !== window || window.__dir) return;
  const css = `
  #__dir { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; font-family: Inter, system-ui, sans-serif; }
  #__dir .cap { position: absolute; left: 50%; bottom: 26px; transform: translate(-50%, 12px); width: min(1060px, calc(100% - 64px));
    background: rgba(9, 7, 24, .9); border: 1px solid rgba(240, 196, 110, .55); border-radius: 16px; padding: 14px 24px 16px;
    box-shadow: 0 18px 50px rgba(0,0,0,.55); opacity: 0; transition: opacity .28s ease, transform .28s ease; }
  #__dir .cap.on { opacity: 1; transform: translate(-50%, 0); }
  #__dir .cap small { display: block; font: 600 12.5px/1.2 Inter, system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: #f0c46e; margin-bottom: 6px; }
  #__dir .cap p { margin: 0; font: 500 22px/1.42 Inter, system-ui, sans-serif; color: #fbf7ee; text-wrap: pretty; }
  #__dir .card { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; gap: 14px;
    background: radial-gradient(1200px 700px at 50% 45%, rgba(46, 30, 96, .96), rgba(8, 6, 20, .985)); opacity: 0; transition: opacity .35s ease; }
  #__dir .card.on { opacity: 1; }
  #__dir .card small { font: 600 15px/1 Inter, system-ui, sans-serif; letter-spacing: .26em; text-transform: uppercase; color: #f0c46e; }
  #__dir .card h1 { margin: 0; font: 500 64px/1.08 var(--dir-serif, Georgia, serif); color: #fbf7ee; max-width: 1000px; }
  #__dir .card p { margin: 0 auto; font: 400 22px/1.45 Inter, system-ui, sans-serif; color: #cfc8e6; max-width: 820px; }
  #__dir .card .mark { font-size: 34px; color: #f0c46e; }
  #__dir .ring { position: absolute; border: 3px solid #f0c46e; border-radius: 16px; box-shadow: 0 0 0 6px rgba(240,196,110,.18), 0 0 40px rgba(240,196,110,.45);
    opacity: 0; transition: opacity .3s ease, left .45s ease, top .45s ease, width .45s ease, height .45s ease; }
  #__dir .ring.on { opacity: 1; }
  #__dir .ptr { position: absolute; width: 26px; height: 26px; margin: -3px 0 0 -3px; filter: drop-shadow(0 2px 4px rgba(0,0,0,.6)); opacity: 0; transition: opacity .3s; }
  #__dir .ptr.on { opacity: 1; }
  #__dir .tap { position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; border: 3px solid #f0c46e; animation: __dirtap .55s ease-out forwards; }
  @keyframes __dirtap { from { transform: scale(.3); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }
  #__dir .promo { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; padding: 0 64px 70px;
    background: linear-gradient(180deg, rgba(8,6,20,0) 38%, rgba(8,6,20,.82) 72%, rgba(8,6,20,.94)); opacity: 0; transition: opacity .3s ease; }
  #__dir .promo.on { opacity: 1; }
  #__dir .promo h2 { margin: 0; font: 600 68px/1.04 var(--dir-serif, Georgia, serif); color: #fff; letter-spacing: -.01em; max-width: 1100px;
    transform: translateY(18px); opacity: 0; transition: transform .45s cubic-bezier(.2,.8,.2,1), opacity .45s ease; }
  #__dir .promo h2 em { font-style: italic; color: #f0c46e; }
  #__dir .promo p { margin: 14px 0 0; font: 500 26px/1.35 Inter, system-ui, sans-serif; color: #e4def7; max-width: 980px;
    transform: translateY(14px); opacity: 0; transition: transform .45s .12s cubic-bezier(.2,.8,.2,1), opacity .45s .12s ease; }
  #__dir .promo.on h2, #__dir .promo.on p { transform: none; opacity: 1; }
  `;
  const ptrSvg = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2l7.5 19 2.6-7.6L21 11z" fill="#fff" stroke="#120d2a" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  let root, cap, card, ring, ptr, promo, target = null, pad = 8;

  function mount() {
    if (root || !document.body) return;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
    root = document.createElement('div');
    root.id = '__dir';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = `<div class="ring"></div><div class="promo"><h2></h2><p></p></div><div class="cap"><small></small><p></p></div><div class="card"><span class="mark">✦</span><small></small><h1></h1><p></p></div><div class="ptr">${ptrSvg}</div>`;
    document.body.append(root);
    [ring, promo, cap, card, ptr] = ['.ring', '.promo', '.cap', '.card', '.ptr'].map((s) => root.querySelector(s));
    const h = document.querySelector('h1, h2, h3');
    if (h) root.style.setProperty('--dir-serif', getComputedStyle(h).fontFamily);
    addEventListener('mousemove', (e) => { ptr.style.left = `${e.clientX}px`; ptr.style.top = `${e.clientY}px`; }, true);
    addEventListener('mousedown', (e) => {
      const t = document.createElement('div');
      t.className = 'tap';
      t.style.left = `${e.clientX}px`; t.style.top = `${e.clientY}px`;
      root.append(t);
      setTimeout(() => t.remove(), 600);
    }, true);
    const follow = () => {
      if (target && target.isConnected) {
        const r = target.getBoundingClientRect();
        Object.assign(ring.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
      }
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();

  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
  function glide(from, to, ms, set) {
    return new Promise((done) => {
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / ms);
        set(from + (to - from) * ease(k));
        if (k < 1) requestAnimationFrame(step); else done();
      };
      requestAnimationFrame(step);
    });
  }
  const el = (s) => (typeof s === 'string' ? document.querySelector(s) : s);

  window.__dir = {
    mount,
    caption(text, label = '') {
      mount();
      if (!text) { cap.classList.remove('on'); return; }
      cap.querySelector('small').textContent = label;
      cap.querySelector('p').textContent = text;
      cap.classList.add('on');
    },
    card(eyebrow, title, sub) {
      mount();
      if (!title) { card.classList.remove('on'); return; }
      card.querySelector('small').textContent = eyebrow || '';
      card.querySelector('h1').textContent = title;
      card.querySelector('p').textContent = sub || '';
      card.classList.add('on');
    },
    promo(title, sub) {
      mount();
      if (!title) { promo.classList.remove('on'); return; }
      promo.classList.remove('on');
      void promo.offsetWidth;
      promo.querySelector('h2').innerHTML = title;
      promo.querySelector('p').textContent = sub || '';
      promo.classList.add('on');
    },
    ring(selector, padding = 8) {
      mount();
      pad = padding;
      target = selector ? el(selector) : null;
      ring.classList.toggle('on', !!target);
    },
    pointer(on) { mount(); ptr.classList.toggle('on', on); },
    /** Scrolls the page so the element's top sits `offset` px below the top of the window. */
    scrollTo(selector, offset = 16, ms = 1100) {
      const node = el(selector);
      if (!node) return Promise.resolve(false);
      document.documentElement.style.scrollBehavior = 'auto';
      const to = Math.max(0, Math.min(node.getBoundingClientRect().top + scrollY - offset, document.documentElement.scrollHeight - innerHeight));
      return glide(scrollY, to, ms, (y) => window.scrollTo(0, y)).then(() => true);
    },
    scrollBy(dy, ms = 900) {
      document.documentElement.style.scrollBehavior = 'auto';
      return glide(scrollY, scrollY + dy, ms, (y) => window.scrollTo(0, y));
    },
    /** Scrolls an inner scroll box (a dialog body, say) so the element comes into view. */
    scrollWithin(box, selector, offset = 16, ms = 900) {
      const b = el(box); const node = el(selector);
      if (!b || !node) return Promise.resolve(false);
      const to = node.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop - offset;
      return glide(b.scrollTop, to, ms, (y) => { b.scrollTop = y; }).then(() => true);
    },
  };
})();
