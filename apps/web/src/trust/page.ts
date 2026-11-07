import '../fonts';
import './page.css';
import { buildLine } from './buildInfo';
import { getRequests, onRequests, startRequestLog } from './requestLog';

// Fills the build line in the footer of the privacy and how-it-works pages.
document.querySelectorAll<HTMLElement>('[data-build]').forEach((el) => {
  const b = buildLine();
  el.textContent = b.text;
  if (b.commitUrl) {
    const a = document.createElement('a');
    a.href = b.commitUrl;
    a.textContent = `commit ${b.commitUrl.split('/').pop()!.slice(0, 7)}`;
    el.append(' · ', a);
  }
});

// Live count of this page's own requests, so the claim on the page can be checked on the page.
const counter = document.querySelector<HTMLElement>('[data-reqcount]');
if (counter) {
  startRequestLog();
  const show = () => {
    const all = getRequests();
    const out = all.filter((r) => !r.sameSite);
    counter.textContent = `This page has made ${all.length} requests so far, ${out.length} of them to other sites${out.length ? `: ${[...new Set(out.map((r) => r.host))].join(', ')}` : ''}.`;
  };
  show();
  onRequests(show);
}

// "Delete everything this site stored in this browser"
const wipe = document.querySelector<HTMLButtonElement>('[data-wipe]');
const wipeNote = document.querySelector<HTMLElement>('[data-wipe-note]');
const ours = () => {
  try { return Object.keys(localStorage).filter((k) => k.startsWith('vedic.') || k.startsWith('va.')); } catch { return []; }
};
const updateWipe = () => {
  if (!wipe || !wipeNote) return;
  const n = ours().length;
  wipe.disabled = n === 0;
  wipeNote.textContent = n ? `${n} item${n === 1 ? '' : 's'} stored now.` : 'Nothing from this site is stored in this browser.';
};
wipe?.addEventListener('click', () => {
  if (!confirm('Delete every saved chart, profile, note and setting this site keeps in this browser? This cannot be undone.')) return;
  for (const k of ours()) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
  updateWipe();
});
updateWipe();
