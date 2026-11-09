// The tutorial's script: one function per chapter, in the order they play.
// Captions are written for a working astrologer: what each part shows, what it means and how to use it.

/** Sections render when first scrolled to; this visits each one (with the capture paused) so they are ready. */
async function prerender(d) {
  const p = d.page;
  // step down the whole page twice: lazy sections appear as they come into view and push the rest down
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < (await p.evaluate(() => document.body.scrollHeight)); y += 600) {
      await p.evaluate((v) => window.scrollTo(0, v), y);
      await p.waitForTimeout(120);
    }
  }
  for (const s of ['#session-prep h4', '#birth-time', '#story', '#jaimini .jm-karakas', '#remedies h4', '#timing .vt-card', '#events .ev-form', '#rectify h4', '#varshaphal .vp-moment', '#eclipses li', '#calendar']) {
    await p.waitForSelector(s, { timeout: 60000 }).catch(() => console.warn(`not ready: ${s}`));
  }
  await p.waitForTimeout(1500);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(400);
}

/** Clicks when the control is there; logs and carries on when it is not, so one renamed button never stops a recording. */
async function tap(d, locator, opts) {
  try {
    if (!(await locator.count())) throw new Error('not found');
    await locator.first().scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await d.click(locator.first(), opts);
    return true;
  } catch (e) {
    console.warn(`skipped click on ${locator}: ${e.message.split('\n')[0]}`);
    if (process.env.VIDEO_DEBUG) await d.page.screenshot({ path: `${process.env.VIDEO_DEBUG}/skip-${Date.now()}.png` });
    return false;
  }
}
async function hover(d, locator) {
  try { await d.point(locator.first()); return true; } catch { console.warn(`skipped pointing at ${locator}`); return false; }
}
/** Scrolls to a section, rings it, and shows each caption in turn. A caption can be { text, do } to act while it shows. */
async function tour(d, sel, lines, { offset = 12, ring = true } = {}) {
  await d.scrollTo(sel, offset, 1000);
  if (ring) await d.ring(sel, 6);
  for (const l of lines) {
    if (typeof l === 'string') await d.say(l);
    else await d.say(l.text, l.do);
  }
  await d.ring(null);
}
const button = (p, name, exact = false) => p.getByRole('button', { name, exact }).or(p.getByRole('tab', { name, exact })).or(p.getByRole('radio', { name, exact }));
const topbar = async (d, name) => { await d.page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((x) => x.close())); await d.scrollTo('body', 0, 700); return tap(d, button(d.page, name, true), { after: 900 }); };

/** @param {import('./director.mjs').Director & Record<string, any>} d */
const scenes = {
  async start(d) {
    const p = d.page;
    await d.open('app/', '.birth-form');
    await d.chapterById('start');
    await d.ring('.form-card', 6);
    await d.say('Jyotisha Explorer is a full Vedic chart workbench that runs in your browser. Charts are calculated on your own computer with the Swiss Ephemeris, and no client details are sent anywhere.');
    await d.ring(null);
    await d.say('To cast a chart, type the client’s name, birth date and the exact birth time. The lagna, the houses and every divisional chart move with the time, so use the most exact time you have.', async () => {
      await d.scrollTo('.birth-form', 120, 800);
      await d.type(p.locator('.birth-form input').first(), 'Priya Sharma');
      await d.click(p.locator('.birth-form input[type=date]'));
      await p.locator('.birth-form input[type=date]').fill('1988-03-14');
      await d.click(p.locator('.birth-form input[type=time]'));
      await p.locator('.birth-form input[type=time]').fill('05:42:00');
    });
    const online = p.locator('.place-online input');
    if (await online.isChecked()) await d.click(online);
    await d.say('Start typing the birthplace and pick it from the list. With online search off, 25,000 places are searched inside your browser and nothing is sent. Latitude, longitude and the historical time zone fill in for you.', async () => {
      await d.type(p.locator('.place-field input'), 'Mumbai', 110);
      await d.wait(700);
      await d.click(p.locator('.suggest button').first());
    });
    await d.say('You can check or override the coordinates, record how exact the birth time is and its Rodden rating, and choose the ayanamsa: Lahiri, True Chitra, Raman or KP. Then calculate.', async () => {
      const more = p.locator('.coords-more summary');
      if (await more.count()) await d.click(more);
      await d.scrollTo('.birth-form .btn-primary', 520, 700);
      await d.wait(600);
    });
    await d.click(p.locator('.birth-form .btn-primary'), { after: 300 });
    await p.waitForSelector('#yogas', { timeout: 60000 });
    await d.offscreen(() => prerender(d));
    await d.say('Each chart opens in its own tab, so you can keep several clients open side by side. The tabs are kept between visits, and every chart you open joins your client list.', async () => {
      await d.ring('.tabbar', 4);
    });
    await d.ring(null);
  },

  async overview(d) {
    const p = d.page;
    await d.chapterById('overview');
    await d.scrollTo('.summary-strip', 90, 900);
    await d.ring('.summary-strip', 6);
    await d.say('The summary strip gives you the essentials at once: lagna, Moon sign, janma nakshatra with its pada, Sun sign, the retrograde planets, and the birth data.');
    await d.ring('#time-quality', 6);
    await d.say('When a birth time has no Rodden rating the app says so, and reminds you that the lagna, the houses, the D9 and finer vargas and the dasha dates all depend on it. Rate it under Edit birth details.');
    await d.scrollTo('#today', 70, 900);
    await d.ring('#today', 6);
    await d.say('Today for you reads the current day against this chart: the tithi, where the Moon is, tara bala from the birth star, and whether it is Chandrashtama.');
    await d.ring('#sade-sati', 6);
    await d.say('Beside it, the Sade Sati countdown with the dates of its rising, peak and setting phases, and how rare this chart’s yogas are compared with ten thousand random charts.');
    await d.ring(null);
    void p;
  },

  async chart(d) {
    const p = d.page;
    await d.chapterById('chart');
    await d.scrollTo('#chart', 12, 1000);
    await d.say('This is the birth chart. Switch between North and South Indian style at the top; the app remembers your choice for every chart.', async () => {
      await d.click(p.getByRole('radio', { name: 'South' }).first());
      await d.wait(900);
      await d.click(p.getByRole('radio', { name: 'North' }).first());
    });
    await d.say('The row of tabs holds all sixteen Parashari vargas, from D1 to D60. Each planet keeps its colour, so you can follow it from the rashi into the navamsha and the dashamsha.', async () => {
      for (const v of ['D9', 'D10', 'D60']) {
        await d.click(p.getByRole('tab', { name: v, exact: true }).first(), { after: 900 });
      }
      await d.click(p.getByRole('tab', { name: 'D1', exact: true }).first());
    });
    await d.say('On the rashi chart you can switch the houses to Bhava Chalit, by Sripati or another house system, to see which planets cross a cusp. The chalit house is what the readings then use.', async () => {
      const chalit = p.locator('.chalit-control button, .chalit-control [role=radio]').nth(1);
      if (await chalit.count()) { await d.click(chalit, { after: 1400 }); await d.click(p.locator('.chalit-control button, .chalit-control [role=radio]').first()); }
    });
    await d.say('Notes pins your own remarks to a house or planet for this client. Export gives you the chart as a PNG or SVG, a share card or an embed. And Show as a table lists every placement for screen readers.', async () => {
      await d.point(p.getByRole('button', { name: /Notes/ }).first());
      await d.wait(900);
      await d.point(p.getByRole('button', { name: /Export/ }).first());
      await d.wait(900);
      await d.point(p.getByRole('button', { name: 'Show as a table' }));
    });
  },

  async readings(d) {
    const p = d.page;
    await d.chapterById('readings');
    await d.scrollTo('#chart', 12, 600);
    await d.say('Click any planet, any house or the lagna. The panel beside the chart reads it for this chart: its sign and dignity, the houses it rules, the aspects it gives and receives, and its nakshatra.', async () => {
      await d.click(p.locator('.chart-stage svg text', { hasText: /^Ju/ }).first(), { after: 500 });
      await d.ring('#details', 6);
    });
    await d.say('Every line of a reading names the rule it comes from, with the text and verse, such as BPHS or Phaladeepika. Nothing is a black box: you can always see why a reading says what it says.', async () => {
      await d.scrollWithin('#details', '#details .cite, #details cite, #details a', 120, 1200).catch(() => {});
    });
    await d.ring(null);
    await d.say('Houses read the same way: the sign on the cusp, its lord and where that lord sits, the planets inside and the karakas for that house.', async () => {
      await d.click(p.locator('.chart-stage [data-house="10"], .chart-stage .house').nth(3), { after: 400 }).catch(() => {});
    });
  },
  async prep(d) {
    const p = d.page;
    await d.chapterById('prep');
    await tour(d, '#session-prep', [
      'Session prep gathers what you need before a consultation. The client snapshot lists the top strengths and challenges with their sources, the running dasha and its theme, and the main transits now.',
      { text: 'Talking points sorts the chart by life area: what the chart promises for career, marriage, money or health, what is active right now, and the best windows ahead. Copy them all as text for your notes.', do: async () => {
        await tap(d, button(p, 'Talking points'));
        await tap(d, p.locator('#session-prep .prep-chips button').nth(2), { after: 1200 });
      } },
      { text: 'Question finder takes the client’s question in their own words. It finds the matching houses and karakas, then lists the antardashas whose lords are linked to the topic, marking the ones with a Jupiter–Saturn double transit.', do: async () => {
        await tap(d, button(p, 'Question finder'));
        await d.type(p.locator('#prep-q'), 'When will I get married?', 45);
        await p.keyboard.press('Enter');
        await d.wait(800);
        await d.scrollBy(260, 900);
      } },
      'Print one page makes a plain A4 sheet of the snapshot for your desk. Everything here is built from the chart’s rules, with no AI service and nothing sent anywhere.',
    ]);
  },

  async 'birth-time'(d) {
    const p = d.page;
    await d.chapterById('birth-time');
    await tour(d, '#birth-time', [
      'Birth times are often rounded. The birth-time slider shows what changes as the time moves: step a minute at a time, or press play to sweep through the range.',
      { text: 'Watch the lagna degree, the D9 and D10 lagnas and the dasha balance. If a varga lagna changes sign within a few minutes, treat that varga with care until the time is confirmed.', do: async () => {
        await tap(d, button(p, 'One minute later'), { after: 700 });
        await tap(d, button(p, 'One minute later'), { after: 700 });
        await tap(d, button(p, '▶ Play'), { after: 3500 });
        await tap(d, button(p, /Pause|Stop/), { after: 400 });
        await tap(d, button(p, 'Reset'));
      } },
    ]);
  },

  async yogas(d) {
    const p = d.page;
    await d.chapterById('yogas');
    await tour(d, '#yogas', [
      'Yogas and doshas lists every combination found in this chart, each with its strength, the rule that forms it, and the classical verses it comes from.',
      { text: 'Open one to see why it forms here: the planets and houses involved, what strengthens or weakens it, and any cancellation, as with Manglik dosha or Neecha Bhanga.', do: async () => {
        await tap(d, p.locator('#yogas details summary, #yogas button[aria-expanded]').first(), { after: 900 });
        await d.scrollBy(240, 900);
      } },
    ], { offset: 12 });
    await tour(d, '#story', [
      'The chart as a story reads the chart in plain sentences for a client, chapter by chapter. Show it in the chart lights up the placements behind each sentence.',
    ]);
  },

  async condition(d) {
    await d.chapterById('condition');
    await tour(d, '#panchanga', [
      'The panchanga of the birth moment: tithi, vara, nakshatra, yoga and karana, with the same five limbs for any other date you pick.',
    ]);
    await tour(d, '#condition', [
      'Planet condition gives each graha’s avasthas, its age and state, combustion and planetary war, with the critical degrees such as gandanta and mrityu bhaga, and the classical ayurdaya.',
    ]);
    await tour(d, '#strength', [
      'Shadbala in rupas against each planet’s required minimum, ranked, with all six components. Below it, dignity across the seven vargas and Bhava Bala for the twelve houses.',
    ]);
    await tour(d, '#ayanamsa-diff', [
      'Four ayanamsas side by side: Lahiri, True Chitra, Raman and KP. You see at once which planets or lagnas change sign or nakshatra with the ayanamsa, so a borderline placement never surprises you.',
    ]);
  },

  async sky(d) {
    const p = d.page;
    await d.chapterById('sky');
    await tour(d, '#sky', [
      'The sky view puts the nine grahas on a 3D wheel of the signs and nakshatras, each at its true longitude for the birth moment. Drag to turn it, and click a planet to read it.',
      { text: 'Real stars switches the artwork backdrop for the actual star field, and Sky tonight shows where the grahas are now. It is a good way to show a client their chart.', do: async () => { await d.wait(1500); await hover(d, button(p, 'Real stars')); } },
    ]);
    await tour(d, '#wheel', [
      'The nakshatra wheel shows all 27 nakshatras and their padas, with every planet on its exact degree. Switch between the artwork and a plain diagram.',
    ]);
    await tour(d, '#planets', [
      'Planetary positions is the full table: longitude, sign, nakshatra and pada, its lord, dignity and retrograde status for every graha.',
    ]);
  },

  async dasha(d) {
    const p = d.page;
    await d.chapterById('dasha');
    await tour(d, '#dasha', [
      { text: 'The dasha card shows the Vimshottari sequence for the whole life. Click a mahadasha to open its antardashas, and an antardasha for its pratyantardashas.', do: async () => {
        await tap(d, p.locator('#dasha button[aria-label*="Saturn mahadasha"], #dasha button[aria-label*="mahadasha"]').nth(2), { after: 900 });
      } },
      { text: 'Switch to Yogini, Ashtottari or Kalachakra dasha to compare systems on the same timeline.', do: async () => {
        await tap(d, button(p.locator('#dasha'), 'Yogini', false), { after: 1200 });
        await tap(d, button(p.locator('#dasha'), 'Kalachakra', false), { after: 1200 });
        await tap(d, button(p.locator('#dasha'), 'Vimshottari', false));
      } },
    ]);
    await tour(d, '#junctions', [
      'Dasha junctions marks each sandhi, where one mahadasha hands over to the next, and the chidra at the end of a period, when changes often arrive.',
      { text: 'Below, the Saturn–Jupiter double transit over each house, or its lord, in the next ten or thirty years or the past twenty. Use it to confirm the timing a dasha suggests.', do: async () => { await d.scrollBy(420, 1200); } },
    ]);
  },

  async jaimini(d) {
    const p = d.page;
    await d.chapterById('jaimini');
    await tour(d, '#jaimini', [
      'The Jaimini layer: the chara karakas, with a switch between the seven and eight karaka schemes, the Atmakaraka and Karakamsa, and what each means for this chart.',
      { text: 'Further down, the arudha padas with the Arudha Lagna and Upapada, rashi drishti between the signs, and the chara dasha with its sign periods.', do: async () => { await tap(d, button(p, '7 karakas'), { after: 800 }); await tap(d, button(p, '8 karakas')); await d.scrollBy(620, 1400); } },
    ]);
  },

  async remedies(d) {
    await d.chapterById('remedies');
    await tour(d, '#remedies', [
      'Remedies lists the afflicted grahas, worst first, and why each counts as afflicted. For each one you get the mantra, the deity, fasting day, charity and gemstone, each with the text it comes from.',
      { text: 'Gemstone advice carries the classical cautions, so you can decide what is safe to recommend. Add any remedy to the client’s tracker with one click.', do: async () => { await d.scrollBy(420, 1200); } },
    ]);
  },

  async timing(d) {
    const p = d.page;
    await d.chapterById('timing');
    await tour(d, '#timing', [
      'Timing brings the dashas and transits together. Right now scores the running mahadasha, antardasha and pratyantardasha for this chart, with the reasons for each score.',
      { text: 'Transit search answers the usual questions in one click: when Saturn next crosses the Moon, the next Jupiter return, when a planet enters a sign, or your own search.', do: async () => {
        await d.scrollTo('#timing .vt-search, #timing form', 80, 900).catch(() => {});
        await hover(d, p.locator('#timing button', { hasText: 'Next Jupiter return' }));
      } },
      { text: 'Life weather blends the dashas with the transits over the Moon into one line, from one year to a lifetime. Bright stretches favour action; dark ones ask for patience.', do: async () => {
        await p.evaluate(() => { const h = [...document.querySelectorAll('#timing h2')].find((x) => x.textContent === 'Life weather'); window.__dir.scrollTo(h.closest('.vt-card'), 12, 1000); });
        await d.wait(1100);
        await tap(d, button(p, '7 yrs', true), { after: 1300 });
        await tap(d, button(p, 'Lifetime', true), { after: 1300 });
        await tap(d, button(p, '3 yrs', true));
      } },
      { text: 'Below it, the dasha map, the transits for any date with the ashtakavarga bindus, upcoming good and careful windows, every retrograde and the Saturn phases.', do: async () => { await d.scrollBy(1100, 2600); } },
    ], { ring: false });
  },

  async events(d) {
    const p = d.page;
    await d.chapterById('events');
    await tour(d, '#events', [
      { text: 'The life event checker tells you what was running on a date: pick the kind of event and when it happened, and it lists the dasha lords and transits active then and whether they fit the event.', do: async () => {
        await hover(d, p.locator('#events select').first());
      } },
    ]);
    await tour(d, '#rectify', [
      'The birth time finder narrows an uncertain time. Give the window the birth could fall in, then add life events: marriage, children, career moves, bereavements.',
      'It tests each candidate time against those events with the dashas and transits, and ranks the times that explain them best. Apply the best one to the chart with one click.',
    ]);
  },

  async varshaphal(d) {
    const p = d.page;
    await d.chapterById('varshaphal');
    await tour(d, '#varshaphal', [
      'Varshaphal casts the Tajika annual chart for the exact second the Sun returns to its natal degree, for this year or any other, and for where the client lives now.',
      { text: 'It names the year lord from the five office-bearers, places the Muntha, and runs the Mudda dasha. Then the Tajika yogas and the sahams, each explained.', do: async () => { await d.scrollBy(700, 1600); await d.wait(900); await d.scrollBy(700, 1600); } },
    ], { ring: false });
    void p;
  },

  async eclipses(d) {
    const p = d.page;
    await d.chapterById('eclipses');
    await tour(d, '#eclipses', [
      { text: 'Eclipses and Sankrantis lists coming eclipses and where each falls on this chart, by house and near which natal points, plus the Sankranti charts for the Sun’s ingresses.', do: async () => { await tap(d, button(p, 'Eclipses on this chart'), { after: 900 }); } },
    ]);
    await tour(d, '#poster', [
      'For clients there are keepsakes: the chart as a printable poster, a time capsule they can seal until a date, and the panchanga as a calendar file for their phone.',
    ]);
  },

  async 'client-notes'(d) {
    const p = d.page;
    await d.chapterById('client-notes');
    await tour(d, '#client-history', [
      { text: 'Client notes and history keeps your record for this client: their questions, your predictions and notes. Give a prediction the date it is about and it is checked later in your track record.', do: async () => {
        await tap(d, button(p.locator('#client-history'), 'Prediction', false));
        await d.type(p.locator('#client-history textarea, #client-history input').first(), 'Career move likely in the Jupiter–Mercury period', 30);
      } },
    ]);
    await tour(d, '#client-practice', [
      'Remedies and billing tracks the remedies you gave: the start and end dates, a printable checklist for the client, and follow-ups. Below it, invoices and receipts for this client.',
    ]);
  },

  async clients(d) {
    const p = d.page;
    await d.chapterById('clients');
    await topbar(d, 'Clients');
    await tour(d, '#clients', [
      'Clients lists everyone whose chart you have opened, with their last reading, the next follow-up and what you predicted last time. Search by name, place, notes or readings, and sort by follow-up.',
      { text: 'Upcoming alerts looks across all your clients for dasha changes and major transits coming up, so you know who to contact before it happens.', do: async () => { await tap(d, p.locator('#clients').getByRole('tab', { name: /Upcoming alerts/ }).or(button(p, /Upcoming alerts/)), { after: 1200 }); } },
      'The client list is kept in this browser only. It is never put in share links and is hidden while you present. Back up writes everything to one file you can restore anywhere.',
    ]);
    await tap(d, p.locator('#clients').getByRole('button', { name: 'Close' }));
  },

  async intake(d) {
    const p = d.page;
    await d.chapterById('intake');
    await topbar(d, 'Edit birth details');
    await p.waitForSelector('#client-intake');
    await d.scrollTo('#client-intake', 140, 900);
    await tap(d, p.locator('#client-intake summary'));
    await d.ring('#client-intake', 6);
    await d.say('A client intake link lets new clients enter their own birth details and questions. Add your name and a note, then copy the link and send it by email or message.', async () => {
      await d.type(p.locator('#client-intake input').first(), 'Asha Rao', 60);
    });
    await d.say('The client fills in a simple form and gets a reply link to send back. Paste it here and the chart is added to your clients. Nothing is uploaded: the details travel only in the messages you exchange.', async () => {
      await d.scrollBy(200, 800);
    });
    await d.ring(null);
    await tap(d, p.locator('#client-intake summary'));
    await d.offscreen(async () => { await p.locator('.birth-form .btn-primary').click(); await p.waitForSelector('#yogas'); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(500); });
  },

  async practice(d) {
    const p = d.page;
    await d.chapterById('practice');
    await topbar(d, 'Practice');
    await tour(d, '#practice', [
      'Your practice is the view across all clients. Track record lists the predictions you logged, and when their date comes it asks whether each one came true, so you build an honest hit rate.',
      { text: 'Invoices collects every invoice and receipt, paid or due. Packages and details holds your services and prices and the business details printed on invoices.', do: async () => {
        await tap(d, button(p.locator('#practice'), 'Invoices', false), { after: 1300 });
        await tap(d, button(p.locator('#practice'), 'Packages and details', false));
      } },
    ]);
    await tap(d, p.locator('#practice').getByRole('button', { name: 'Close' }));
  },

  async phrases(d) {
    const p = d.page;
    await d.chapterById('phrases');
    await topbar(d, /^Readings and phrases/);
    await d.say('Readings and phrases holds your own wording. Start a reading for this client from a template, and each section begins with your saved phrases for the placements it covers.');
    await d.say('Save a phrase for a placement, such as Saturn in the 10th, and it is suggested whenever that placement comes up again: here, in the consultation PDF and in the Life Chart Book.', async () => {
      await tap(d, button(p.locator('.practice-dialog'), 'Saved phrases', false), { after: 1200 });
      await tap(d, button(p.locator('.practice-dialog'), 'Reading templates', false));
    });
    await d.say('Write your own templates, and export them all to keep a copy or move them to another computer.');
    await tap(d, p.locator('.practice-dialog').getByRole('button', { name: 'Done' }));
  },

  async session(d) {
    const p = d.page;
    await d.chapterById('session');
    await topbar(d, '◉ Session');
    await d.say('Session mode is for consultations over a video call. This screen is yours alone: pick a varga, click a planet, house or the lagna, and add it to your talking points.', async () => {
      await tap(d, button(p.locator('.ss-prep'), 'D9', true), { after: 800 });
      await tap(d, p.locator('.ss-prep svg text', { hasText: /^Ve/ }), { after: 600 });
      await tap(d, p.locator('.ss-prep').getByRole('button', { name: /^\+ Add “/ }), { after: 800 });
    });
    await d.say('Go live shows a clean client screen to share: the chart and your points, never your notes. Or open it in its own window. Use the arrow keys to step through, B to blank the screen and Esc to end.', async () => {
      await hover(d, button(p, 'Go live here, full screen'));
      await d.wait(900);
      await hover(d, button(p, 'Open client window'));
    });
    await tap(d, button(p, 'Close session'));
    await topbar(d, '▦ Dashboard');
    await d.say('The dashboard puts the D1, D9 and D10 and the running dasha on one screen. Arrange lets you choose and order the panels, and the layout is remembered.', async () => {
      await d.ring('#dashboard', 4);
      await tap(d, button(p, '⇄ Arrange'), { after: 1500 });
      await tap(d, button(p, /Done|⇄ Arrange/));
    });
    await d.ring(null);
    await d.say('Two more ways to talk a client through the chart: Present runs a full-screen walkthrough, and Listen reads the chart aloud, moving through it as it goes.', async () => {
      await tap(d, button(p, 'Back to the full chart'));
      await d.scrollTo('body', 0, 600);
      await hover(d, button(p, '▶ Present'));
      await d.wait(800);
      await hover(d, button(p, '🔊 Listen'));
    });
  },

  async reports(d) {
    const p = d.page;
    await d.chapterById('reports');
    await d.scrollTo('body', 0, 600);
    await d.say('Download PDF report makes a complete written report of the chart. Consultation export builds a shorter PDF from the points you choose, in your own words.', async () => {
      await hover(d, button(p, 'Download PDF report'));
      await d.wait(700);
      await hover(d, button(p, 'Consultation export'));
    });
    await tap(d, button(p, 'Your branding'), { after: 800 });
    await d.say('Your branding puts your name, practice, contact details and logo on the cover and at the foot of every page you give a client. Leave it empty for unbranded PDFs.', async () => {
      await d.type(p.locator('.branding-dialog input').first(), 'Asha Rao', 60);
      await d.type(p.locator('.branding-dialog input').nth(1), 'Lotus Jyotish', 50);
    });
    await tap(d, p.locator('.branding-dialog').getByRole('button', { name: 'Done' }));
    await tap(d, button(p, 'Life Chart Book'), { after: 900 });
    await d.say('The Life Chart Book is a long, printed book for a client. Each chapter teaches the idea first, then reads it in their chart, with sources. Add your own letters and notes anywhere.', async () => {
      for (const t of ['Letters', 'Chapters', 'Years']) {
        await tap(d, button(p.locator('.book-dialog'), t, true), { after: 1000 });
      }
    });
    await d.say('Choose the chapters and the years to cover, then export the book as a PDF ready for print. Drafts are saved in this browser, and as a file you can open again later.', async () => {
      await tap(d, button(p.locator('.book-dialog'), 'Format', true), { after: 800 });
      await hover(d, p.locator('.book-dialog').getByRole('button', { name: 'Export book PDF' }));
    });
    await tap(d, p.locator('.book-dialog').getByRole('button', { name: 'Close' }));
  },

  async share(d) {
    const p = d.page;
    await d.chapterById('share');
    await d.scrollTo('#chart', 12, 900);
    await tap(d, button(p, '⤓ Export'), { after: 900 });
    await d.say('Export gives the chart as a PNG or SVG image, a share card sized for social media, embed code for your own website, and planet stickers.', async () => {
      for (const t of ['Share card', 'Card', 'Embed', 'Stickers']) {
        await tap(d, p.locator('.export-dialog').getByRole('tab', { name: new RegExp(t) }), { after: 900 });
      }
    });
    await p.keyboard.press('Escape');
    await d.wait(400);
    await d.scrollTo('body', 0, 600);
    await d.say('Share link copies a link that opens this chart anywhere, with no account. Save keeps the chart in this browser’s saved charts.', async () => {
      await hover(d, button(p, 'Share link'));
      await d.wait(700);
      await hover(d, button(p, '☆ Save'));
    });
  },

  async 'more-tools'(d) {
    const p = d.page;
    await d.chapterById('more-tools');
    await d.open('compare/', '#root h1, #root h2, #root h3'); await d.offscreen(() => d.wait(1500));
    await d.say('Compare charts sets up to four charts side by side, with synastry between two: how each person’s planets fall in the other’s houses.', async () => {
      await tap(d, p.locator('button', { hasText: /^Add$/ }), { after: 1100 });
      await tap(d, button(p, 'Famous', true), { after: 900 });
      await tap(d, p.locator('button', { hasText: /^Add$/ }), { after: 1400 });
      await d.scrollBy(380, 1400);
    });
    await d.open('match/', '#root h1, #root h2, #root h3'); await d.offscreen(() => d.wait(1500));
    await d.say('Compatibility runs Ashtakoota matching on all eight kootas out of 36, with Manglik dosha and its cancellations for both people, plus the South Indian porutham and other traditions.');
    await d.scrollBy(400, 1400);
    await d.open('family/', '#root h1, #root h2, #root h3'); await d.offscreen(() => d.wait(1500));
    await d.say('Family charts keeps a household together: each member’s chart, and how their placements and running dashas relate to one another.');
    await d.open('tools/', '#root h1, #root h2, #root h3'); await d.offscreen(() => d.wait(1500));
    await d.say('KP, Prashna and Muhurta: KP cusps with star and sub lords, a horary chart for a question asked now, and a search for auspicious times.');
    await d.scrollBy(400, 1400);
  },

  async everyday(d) {
    const p = d.page;
    await d.chapterById('everyday');
    await d.open('app/', '.topbar');
    await d.say('Quick switch, or Ctrl K, jumps to any client, chart, varga or section by typing a few letters. Press the question mark to see every keyboard shortcut.', async () => {
      await tap(d, button(p, /Quick switch/), { after: 700 });
      await p.keyboard.type('d9', { delay: 160 });
      await d.wait(1200);
      await p.keyboard.press('Escape');
    });
    await d.say('The app speaks nine languages, including Hindi, Tamil and Telugu. Display sets the text size, contrast, motion and a dyslexia-friendly font, and whether terms appear in English, IAST or Devanagari.', async () => {
      await tap(d, button(p, /Display$/), { after: 1500 });
      await p.keyboard.press('Escape');
    });
    await d.say('Your charts, clients and notes live in this browser. Under Saved charts, back up everything to one file, restore it on another computer, or sync between your own devices.', async () => {
      await tap(d, button(p, 'Saved charts', true), { after: 900 });
      await d.scrollTo('.form-card', 120, 900).catch(() => {});
      await hover(d, button(p, 'Back up everything'));
    });
    await d.say('Once opened, the whole app works offline and can be installed like an ordinary app, so you can read charts with no connection at all. That is the tour: open any section’s video again from the Tutorial button.');
  },
};


export async function tutorial(d) {
  const only = process.env.CHAPTERS?.split(',');
  for (const [id, scene] of Object.entries(scenes)) {
    if (only && !only.includes(id) && id !== 'start') continue;
    await scene(d);
  }
}
