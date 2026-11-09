// The landing-page promo: about forty seconds of the real app with headlines over it.
// It plays muted on a loop, so everything it says is in the headlines.

const clickText = (page, scope, text) => page.evaluate(([s, t]) => {
  const b = [...document.querySelectorAll(`${s} button, ${s} [role=tab]`)].find((x) => x.textContent.trim() === t || x.textContent.trim().startsWith(t));
  b?.click();
  return !!b;
}, [scope, text]);

async function headline(d, html, sub) {
  const plain = html.replace(/<[^>]+>/g, '');
  d.note(sub ? `${plain} ${sub}` : plain);
  await d.run(([h, s]) => window.__dir.promo(h, s), [html, sub ?? '']);
}

/** Jumps (with the capture paused) so the element's top sits `offset` px down the window. */
const jump = (d, sel, offset = 0) => d.page.evaluate(([s, o]) => {
  const el = document.querySelector(s);
  document.documentElement.style.scrollBehavior = 'auto';
  if (el) window.scrollTo(0, el.getBoundingClientRect().top + scrollY - o);
}, [sel, offset]);

export async function promo(d) {
  const p = d.page;
  // load with the capture not yet started, so the video opens on the first scene
  await p.goto(`${d.base}app/#sample`);
  await p.waitForSelector('#yogas', { timeout: 60000 });
  await d.offscreen(async () => {
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < (await p.evaluate(() => document.body.scrollHeight)); y += 600) {
        await p.evaluate((v) => window.scrollTo(0, v), y);
        await p.waitForTimeout(120);
      }
    }
    for (const s of ['#session-prep h4', '#timing .vt-card', '#sky canvas']) await p.waitForSelector(s, { timeout: 60000 }).catch(() => console.warn(`not ready: ${s}`));
    await clickText(p, '#sky', 'Pause rotation');
    await jump(d, '#chart', 8);
    await p.waitForTimeout(800);
  });

  // 1. the chart and its vargas
  await headline(d, 'Every chart. <em>Every varga.</em>', 'All sixteen divisional charts, North or South Indian style.');
  d.posterAt = d.cap.now() + 1.6;
  for (const v of ['D9', 'D60']) {
    await d.wait(650);
    await p.getByRole('tab', { name: v, exact: true }).first().click();
  }
  await d.wait(500);
  await p.getByRole('radio', { name: 'South' }).first().click();
  await d.wait(700);
  await p.getByRole('radio', { name: 'North' }).first().click();
  await p.getByRole('tab', { name: 'D1', exact: true }).first().click();

  // 2. readings with sources
  await d.run(() => window.__dir.promo());
  await d.wait(250);
  await d.click(p.locator('.chart-stage svg text', { hasText: /^Ju/ }).first(), { after: 200 });
  await headline(d, 'Readings that <em>cite the text.</em>', 'Every line says which rule it comes from, verse by verse.');
  await d.pointer(false);
  await d.scrollWithin('#details', '#details h4, #details h3', 60, 1600).catch(() => {});
  await d.wait(1600);

  // 3. timing
  await d.offscreen(async () => {
    await d.run(() => window.__dir.promo());
    await p.evaluate(() => { const h = [...document.querySelectorAll('#timing h2')].find((x) => x.textContent === 'Life weather'); const c = h.closest('.vt-card'); window.scrollTo(0, c.getBoundingClientRect().top + scrollY - 8); });
    await p.waitForTimeout(500);
  });
  await headline(d, 'See the <em>years ahead.</em>', 'Dashas and transits blended into one forecast.');
  await d.wait(1100);
  await p.getByRole('button', { name: 'Lifetime', exact: true }).first().click();
  await d.wait(1600);

  // 4. the sky
  await d.offscreen(async () => { await d.run(() => window.__dir.promo()); await jump(d, '#sky', 8); await p.waitForSelector('#sky canvas', { timeout: 60000 }); await clickText(p, '#sky', 'Rotate'); await p.waitForTimeout(9000); });
  await headline(d, 'The birth sky, <em>in 3D.</em>', 'Nine grahas on a wheel of signs and nakshatras.');
  await d.wait(3200);

  // 5. session prep
  await d.offscreen(async () => {
    await d.run(() => window.__dir.promo());
    await jump(d, '#session-prep', 8);
    await p.waitForSelector('#session-prep [role=tab]', { timeout: 60000 });
    await jump(d, '#session-prep', 8);
    await clickText(p, '#sky', 'Pause rotation');
    await clickText(p, '#session-prep', 'Question finder');
    await p.waitForSelector('#prep-q');
    await p.waitForTimeout(400);
  });
  await headline(d, 'Prep a session <em>in a minute.</em>', 'Ask the client’s question, get the timing windows and why.');
  await p.locator('#prep-q').pressSequentially('When will I get married?', { delay: 45 });
  await p.keyboard.press('Enter');
  await d.wait(500);
  await d.scrollBy(300, 1200);
  await d.wait(500);

  // 6. clients and alerts
  await d.offscreen(async () => {
    await d.run(() => window.__dir.promo());
    await clickText(p, '.topbar-actions', 'Clients');
    await p.waitForSelector('#clients');
    await clickText(p, '#clients', 'Upcoming alerts');
    await jump(d, '#clients', 8);
    await p.waitForTimeout(500);
  });
  await headline(d, 'Every client. <em>Every follow-up.</em>', 'Alerts before a dasha changes or a big transit lands.');
  await d.wait(3200);

  // 7. session mode
  await d.offscreen(async () => {
    await d.run(() => window.__dir.promo());
    await clickText(p, '.topbar-actions', '◉ Session');
    await p.waitForSelector('.ss-prep');
    await p.waitForTimeout(500);
  });
  await headline(d, 'Share a clean screen <em>on the call.</em>', 'Your notes stay with you. The client sees the chart.');
  await clickText(p, '.ss-prep', 'D9');
  await d.wait(1400);
  await clickText(p, '.ss-prep', 'D10');
  await d.wait(1600);

  // 8. the dashboard (a modal dialog would sit above the headline, so the Life Chart Book is left to the tutorial)
  await d.offscreen(async () => {
    await d.run(() => window.__dir.promo());
    await clickText(p, '.ss-prep', 'Close session');
    await p.waitForTimeout(300);
    await clickText(p, '.topbar-actions', '▦ Dashboard');
    await p.waitForSelector('#dashboard');
    await jump(d, '#dashboard', 8);
    await p.waitForTimeout(600);
  });
  await headline(d, 'D1, D9, D10 and the dasha, <em>on one screen.</em>', 'Plus reports, consultation PDFs and a Life Chart Book under your name.');
  await d.wait(3400);

  // 9. end card
  await d.run(() => window.__dir.promo());
  d.note('Jyotisha Explorer. Free, private, works offline. Read a chart now.');
  await d.run(() => window.__dir.card('Free · Private · Works offline', 'Jyotisha Explorer', 'Read a chart now: no sign-up, nothing to install.'));
  await d.wait(3400);
}
