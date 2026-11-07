import { useEffect, useMemo, useRef, useState } from 'react';
import type { Chart, PlanetId, VargaChart } from '../types/chart';
import type { ChartStyle } from '../types/ui';
import type { Annotation } from '../lib/annotations';
import type { Knowledge } from '../lib/readings';
import { shareHash } from '../lib/profiles';
import { useI18n } from '../i18n';
import { chartSvg, type ChartLabels, type ExportTheme } from '../export/chartSvg';
import { CARD_SIZE, shareCardSvg, shareText, type CardFormat } from '../export/shareCard';
import { downloadBlob, shareFile, slug, svgBlob, svgToPng } from '../export/raster';
import { withFonts } from '../export/fonts';
import { drawSticker, stickerPack, STICKER_ORDER } from '../export/stickers';
import { PLANET_BY_ID, signInfo } from '../data/constants';

export type ExportTab = 'image' | 'card' | 'embed' | 'stickers';

interface Props {
  chart: Chart;
  varga: VargaChart;
  style: ChartStyle;
  notes: Annotation[];
  knowledge: Knowledge | null;
  initialTab?: ExportTab;
  onClose: () => void;
}

const PREF_KEY = 'vedic.exportPrefs';
interface Prefs { theme: ExportTheme; size: number; header: boolean; withNotes: boolean; card: CardFormat; hideName: boolean; embedTheme: ExportTheme; stickerLabel: boolean }
const DEFAULT_PREFS: Prefs = { theme: 'dark', size: 1600, header: true, withNotes: true, card: 'square', hideName: false, embedTheme: 'dark', stickerLabel: true };
const readPrefs = (): Prefs => { try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') }; } catch { return DEFAULT_PREFS; } };

/** The site's public address, for card footers and the embed snippet. */
const siteBase = () => `${location.origin}${import.meta.env.BASE_URL}`;

export function ExportDialog({ chart, varga, style, notes, knowledge, initialTab = 'image', onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<ExportTab>(initialTab);
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const { v, t, locale } = useI18n();
  const set = <K extends keyof Prefs>(k: K, val: Prefs[K]) => setPrefs((p) => ({ ...p, [k]: val }));

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* storage blocked */ } }, [prefs]);

  // the chart image uses the same names as the chart on screen
  const labels: Partial<ChartLabels> = useMemo(() => ({
    planet: (id: PlanetId) => v.planets[id].short,
    sign: (n: number) => (locale === 'en' ? signInfo(n).short : v.signs[n - 1].length > 5 ? v.signs[n - 1].slice(0, 3) : v.signs[n - 1]),
    asc: t('chart.asc'),
    varga: (vc: VargaChart) => `${vc.id} · ${v.vargas[vc.id]}`,
  }), [v, t, locale]);

  const base = slug(`${chart.input.name || 'chart'}-${varga.id}`);
  const footer = `Jyotisha Explorer · ${siteBase().replace(/^https?:\/\//, '')}`;
  const image = useMemo(() => chartSvg(chart, {
    style, varga, theme: prefs.theme, width: prefs.size, header: prefs.header,
    annotations: prefs.withNotes ? notes : [], labels, footer,
  }), [chart, style, varga, prefs.theme, prefs.size, prefs.header, prefs.withNotes, notes, labels, footer]);
  const preview = useSvgUrl(image.svg);

  const card = useMemo(() => shareCardSvg(chart, knowledge, { format: prefs.card, style, theme: prefs.theme, hideName: prefs.hideName, site: siteBase().replace(/^https?:\/\//, '').replace(/\/$/, '') }),
    [chart, knowledge, prefs.card, style, prefs.theme, prefs.hideName]);
  const cardPreview = useSvgUrl(card);

  const guard = async (label: string, job: () => Promise<void>) => {
    setBusy(label); setStatus(null);
    try { await job(); } catch (e) { console.error(e); setStatus('That did not work in this browser. Try the SVG download instead.'); } finally { setBusy(null); }
  };

  const link = `${siteBase()}app/${shareHash(chart.input, !prefs.hideName)}`;
  const text = shareText(chart, knowledge, prefs.hideName);
  const cardFile = async () => {
    const { width, height } = CARD_SIZE[prefs.card];
    return new File([await svgToPng(card, width, height)], `${slug(prefs.hideName ? 'vedic-chart' : chart.input.name || 'vedic-chart')}-card.png`, { type: 'image/png' });
  };

  return (
    <dialog ref={dialog} className="consult-dialog export-dialog" onClose={onClose} onCancel={onClose} aria-label="Export and share">
      <div className="export-wrap">
        <header>
          <h3>Export and share</h3>
          <div className="seg export-tabs" role="tablist">
            {([['image', 'Chart image'], ['card', 'Share card'], ['embed', 'Embed'], ['stickers', 'Stickers']] as [ExportTab, string][]).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => { setTab(id); setStatus(null); }}>{label}</button>
            ))}
          </div>
          <button type="button" className="btn-ghost sm export-close" onClick={() => dialog.current?.close()} aria-label="Close">✕</button>
        </header>

        {tab === 'image' && (
          <div className="export-grid">
            <div className="export-preview"><img src={preview} alt={`Preview of the ${varga.id} chart image`} /></div>
            <div className="export-opts">
              <p className="muted">The {style === 'north' ? 'North' : 'South'} Indian {varga.id} chart exactly as it is open now. SVG stays sharp at any size and opens in Illustrator, Inkscape or Figma.</p>
              <ThemeSeg value={prefs.theme} onChange={(x) => set('theme', x)} />
              <label className="export-field">
                <span>PNG width</span>
                <select value={prefs.size} onChange={(e) => set('size', Number(e.target.value))}>
                  {[800, 1200, 1600, 2400, 3200].map((n) => <option key={n} value={n}>{n} px</option>)}
                </select>
              </label>
              <label className="check"><input type="checkbox" checked={prefs.header} onChange={(e) => set('header', e.target.checked)} /> Name, date and place above the chart</label>
              <label className="check"><input type="checkbox" checked={prefs.withNotes} disabled={!notes.length} onChange={(e) => set('withNotes', e.target.checked)} /> Include my chart notes{notes.length ? ` (${notes.length})` : ' (none yet)'}</label>
              <div className="pop-row">
                <button className="btn-primary" disabled={!!busy} onClick={() => guard('Making PNG…', async () => { downloadBlob(await svgToPng(image.svg, image.width, image.height), `${base}.png`); setStatus('PNG downloaded.'); })}>{busy ?? 'Download PNG'}</button>
                <button className="btn-ghost" onClick={async () => { downloadBlob(svgBlob(await withFonts(image.svg)), `${base}.svg`); setStatus('SVG downloaded.'); }}>Download SVG</button>
              </div>
              <button className="btn-ghost sm" onClick={() => guard('Copying…', async () => {
                const png = await svgToPng(image.svg, image.width, image.height);
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
                setStatus('Image copied. Paste it into a chat or document.');
              })}>Copy image to clipboard</button>
            </div>
          </div>
        )}

        {tab === 'card' && (
          <div className="export-grid">
            <div className="export-preview"><img src={cardPreview} alt="Preview of the share card" /></div>
            <div className="export-opts">
              <p className="muted">A picture of the chart with the lagna, Moon, nakshatra and running dasha, sized for chats. Send it with the link so the chart opens on their phone.</p>
              <label className="export-field">
                <span>Size</span>
                <select value={prefs.card} onChange={(e) => set('card', e.target.value as CardFormat)}>
                  {(Object.keys(CARD_SIZE) as CardFormat[]).map((f) => <option key={f} value={f}>{CARD_SIZE[f].label}</option>)}
                </select>
              </label>
              <ThemeSeg value={prefs.theme} onChange={(x) => set('theme', x)} />
              {chart.input.name?.trim() && <label className="check"><input type="checkbox" checked={prefs.hideName} onChange={(e) => set('hideName', e.target.checked)} /> Leave the name off</label>}
              <div className="pop-row">
                <button className="btn-primary" disabled={!!busy} onClick={() => guard('Preparing…', async () => {
                  const f = await cardFile();
                  if (await shareFile(f, `${text}\n${link}`, 'Vedic birth chart')) setStatus(null);
                  else { downloadBlob(f, f.name); setStatus('This browser cannot share files directly, so the card was downloaded. Attach it in WhatsApp or Telegram.'); }
                })}>{busy ?? (typeof navigator.canShare === 'function' ? 'Share card…' : 'Download card')}</button>
                <button className="btn-ghost" disabled={!!busy} onClick={() => guard('Making PNG…', async () => { const f = await cardFile(); downloadBlob(f, f.name); })}>Download PNG</button>
              </div>
              <div className="pop-row">
                <a className="btn-ghost sm" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${link}`)}`}>Send text to WhatsApp</a>
                <a className="btn-ghost sm" target="_blank" rel="noopener noreferrer" href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`}>Send to Telegram</a>
              </div>
              <p className="muted pop-note">The text buttons send the summary and the link; WhatsApp and Telegram cannot receive a picture that way, so attach the card yourself. Anyone with the link sees this birth date, time and place.</p>
            </div>
          </div>
        )}

        {tab === 'embed' && <EmbedTab chart={chart} style={style} varga={varga} theme={prefs.embedTheme} onTheme={(x) => set('embedTheme', x)} hideName={prefs.hideName} onHideName={(x) => set('hideName', x)} />}

        {tab === 'stickers' && <StickerTab label={prefs.stickerLabel} onLabel={(x) => set('stickerLabel', x)} />}

        {status && <p className="muted export-status" role="status">{status}</p>}
      </div>
    </dialog>
  );
}

/** An object URL for an SVG with the export fonts inside, so the preview matches the download. */
function useSvgUrl(svg: string): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let live = true;
    let made: string | undefined;
    void withFonts(svg).then((s) => { if (!live) return; made = URL.createObjectURL(svgBlob(s)); setUrl(made); });
    return () => { live = false; if (made) URL.revokeObjectURL(made); };
  }, [svg]);
  return url;
}

function ThemeSeg({ value, onChange }: { value: ExportTheme; onChange: (t: ExportTheme) => void }) {
  return (
    <div className="seg" role="radiogroup" aria-label="Colours">
      <button role="radio" aria-checked={value === 'dark'} className={value === 'dark' ? 'is-active' : ''} onClick={() => onChange('dark')}>Night</button>
      <button role="radio" aria-checked={value === 'light'} className={value === 'light' ? 'is-active' : ''} onClick={() => onChange('light')}>Paper</button>
    </div>
  );
}

function EmbedTab({ chart, style, varga, theme, onTheme, hideName, onHideName }: {
  chart: Chart; style: ChartStyle; varga: VargaChart; theme: ExportTheme; onTheme: (t: ExportTheme) => void; hideName: boolean; onHideName: (b: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const src = `${siteBase()}embed/${shareHash(chart.input, !hideName)}&s=${style}&v=${varga.id}&th=${theme}`;
  const who = (!hideName && chart.input.name?.trim()) || 'Vedic birth chart';
  const snippet = `<iframe src="${src}" width="420" height="560" style="border:0;max-width:100%" loading="lazy" title="${who.replace(/"/g, '&quot;')}: Vedic birth chart"></iframe>`;
  return (
    <div className="export-grid">
      <div className="export-preview embed-preview"><iframe src={src} width={420} height={560} title="Embed preview" loading="lazy" /></div>
      <div className="export-opts">
        <p className="muted">Paste this into a blog post or website. The chart is worked out in the reader's browser from the details in the link, so nothing is stored anywhere, and it links back to the full chart and its source code.</p>
        <ThemeSeg value={theme} onChange={onTheme} />
        {chart.input.name?.trim() && <label className="check"><input type="checkbox" checked={hideName} onChange={(e) => onHideName(e.target.checked)} /> Leave the name off</label>}
        <label className="export-field">
          <span>Embed code</span>
          <textarea readOnly rows={6} value={snippet} onFocus={(e) => e.target.select()} />
        </label>
        <button className="btn-primary" onClick={async () => { try { await navigator.clipboard.writeText(snippet); setCopied(true); } catch { /* select fallback */ } }}>{copied ? 'Copied' : 'Copy embed code'}</button>
        <p className="muted pop-note">Shows the {style === 'north' ? 'North' : 'South'} Indian {varga.id}. Readers can switch style and open the full explorer.</p>
      </div>
    </div>
  );
}

function StickerTab({ label, onLabel }: { label: boolean; onLabel: (b: boolean) => void }) {
  const [urls, setUrls] = useState<Partial<Record<PlanetId, string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      for (const id of STICKER_ORDER) {
        const c = await drawSticker(id, { label, size: 256 });
        if (!live) return;
        const u = c.toDataURL('image/png');
        setUrls((m) => ({ ...m, [id]: u }));
      }
    })().catch((e) => console.error('Stickers', e));
    return () => { live = false; };
  }, [label]);

  return (
    <div className="sticker-tab">
      <p className="muted">The nine grahas from the app's Blender renders, cut out as 512×512 stickers for WhatsApp, Telegram and Signal. The download has PNG and WebP copies and a short how-to for each app.</p>
      <ul className="sticker-grid">
        {STICKER_ORDER.map((id) => (
          <li key={id}>
            {urls[id] ? <img src={urls[id]} alt={`${PLANET_BY_ID[id].sanskrit} sticker`} width={128} height={128} /> : <span className="sticker-wait" />}
            <button className="btn-ghost sm" onClick={async () => { const c = await drawSticker(id, { label }); c.toBlob((b) => b && downloadBlob(b, `${PLANET_BY_ID[id].sanskrit.toLowerCase()}-sticker.png`)); }}>{PLANET_BY_ID[id].sanskrit}</button>
          </li>
        ))}
      </ul>
      <div className="pop-row sticker-actions">
        <label className="check"><input type="checkbox" checked={label} onChange={(e) => onLabel(e.target.checked)} /> Write each graha's name on it</label>
        <button className="btn-primary" disabled={!!busy} onClick={async () => {
          setBusy('Drawing 0 of 9…');
          try { downloadBlob(await stickerPack({ label }, (d, n) => setBusy(`Drawing ${d} of ${n}…`)), 'graha-stickers.zip'); } finally { setBusy(null); }
        }}>{busy ?? 'Download sticker pack (.zip)'}</button>
      </div>
    </div>
  );
}

