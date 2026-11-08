/**
 * Printable pages for the practice: the client's remedy checklist, an invoice
 * or receipt, and the prediction track record. Each is a small standalone HTML
 * page printed from a hidden frame, so "Save as PDF" in the print dialog gives
 * the client a clean file. Every piece of user text is escaped.
 */
import {
  AREA_LABEL, REMEDY_KIND_LABEL, invoiceTotals, money, safeLink,
  type Business, type Invoice, type RemedyPlan, type Score, type TrackedPrediction,
} from './practice';

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const lines = (s: string) => esc(s).replace(/\n/g, '<br>');
const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const STYLE = `
  *{box-sizing:border-box} body{font:14px/1.5 Georgia,'Times New Roman',serif;color:#1d1a16;margin:0;padding:32px 40px;background:#fff}
  h1{font-size:24px;margin:0 0 4px} h2{font-size:16px;margin:24px 0 8px;border-bottom:1px solid #c9bfae;padding-bottom:4px}
  .muted{color:#6b6257} .head{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:20px}
  .right{text-align:right} table{width:100%;border-collapse:collapse;margin-top:6px} th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e3dccf;vertical-align:top}
  th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#6b6257} td.num,th.num{text-align:right;white-space:nowrap}
  .box{display:inline-block;width:14px;height:14px;border:1.5px solid #1d1a16;border-radius:3px;vertical-align:-2px;text-align:center;font-size:11px;line-height:12px}
  .total td{font-weight:bold;border-top:2px solid #1d1a16;border-bottom:none} .stamp{display:inline-block;border:2px solid #2f6b3a;color:#2f6b3a;padding:2px 10px;border-radius:4px;font-weight:bold;letter-spacing:.08em}
  .void{border-color:#8a2b2b;color:#8a2b2b} .pay{margin-top:16px;padding:10px 12px;border:1px solid #c9bfae;border-radius:6px;word-break:break-all}
  .foot{margin-top:28px;font-size:12px} .caveat{font-size:12px;margin-top:20px}
  @page{margin:14mm} @media print{body{padding:0}}
`;

const page = (title: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLE}</style></head><body>${body}</body></html>`;

const from = (b: Business) =>
  b.name || b.contact || b.address
    ? `<div>${b.name ? `<b>${esc(b.name)}</b><br>` : ''}${b.address ? `${lines(b.address)}<br>` : ''}${b.contact ? `<span class="muted">${lines(b.contact)}</span>` : ''}</div>`
    : '<div></div>';

export function remedyChecklistHtml(client: string, plan: RemedyPlan, business: Business): string {
  const items = plan.items.map((x) => `<tr><td>${esc(REMEDY_KIND_LABEL[x.kind])}</td><td>${esc(x.text)}</td><td>${esc(x.how)}</td></tr>`).join('');
  const checks = plan.checkIns
    .map((c) => `<tr><td><span class="box">${c.status === 'done' ? '✓' : c.status === 'missed' ? '–' : ''}</span></td><td>${fmtDay(c.date)}</td>${plan.items.map(() => '<td><span class="box"></span></td>').join('')}<td>${lines(c.note)}</td></tr>`)
    .join('');
  return page(`Remedies for ${client}`, `
    <div class="head"><div><h1>Remedy checklist</h1><div>For <b>${esc(client)}</b> · starting ${fmtDay(plan.startedOn)}</div></div>${from(business)}</div>
    ${plan.note ? `<p>${lines(plan.note)}</p>` : ''}
    <h2>What to do</h2>
    <table><thead><tr><th>Kind</th><th>Remedy</th><th>How often</th></tr></thead><tbody>${items || '<tr><td colspan="3" class="muted">No remedies added yet.</td></tr>'}</tbody></table>
    ${plan.checkIns.length ? `<h2>Check-ins</h2>
    <p class="muted">Tick each remedy you kept up since the last check-in, and bring this sheet to the next one.</p>
    <table><thead><tr><th>Checked in</th><th>Date</th>${plan.items.map((_, i) => `<th>${i + 1}</th>`).join('')}<th>Notes</th></tr></thead><tbody>${checks}</tbody></table>` : ''}
    <p class="caveat muted">These are traditional practices, offered as reflection and habit. They are optional, you don't need to buy anything, and no remedy replaces medical, legal or financial help.</p>
  `);
}

export function invoiceHtml(client: string, inv: Invoice, business: Business): string {
  const t = invoiceTotals(inv);
  const m = (n: number) => esc(money(n, inv.currency));
  const receipt = inv.status === 'paid';
  const rows = inv.lines.map((l) => `<tr><td>${esc(l.description)}</td><td class="num">${l.qty}</td><td class="num">${m(l.price)}</td><td class="num">${m(l.qty * l.price)}</td></tr>`).join('');
  const link = safeLink(inv.paymentLink);
  return page(`${receipt ? 'Receipt' : 'Invoice'} ${inv.number}`, `
    <div class="head">${from(business)}<div class="right"><h1>${receipt ? 'Receipt' : 'Invoice'}</h1><div>${esc(inv.number)}</div><div class="muted">Issued ${fmtDay(inv.issuedOn)}</div>
      ${receipt ? `<div style="margin-top:8px"><span class="stamp">PAID${inv.paidOn ? ` ${fmtDay(inv.paidOn)}` : ''}</span></div>` : ''}
      ${inv.status === 'void' ? '<div style="margin-top:8px"><span class="stamp void">VOID</span></div>' : ''}</div></div>
    <div><span class="muted">Billed to</span><br><b>${esc(client)}</b></div>
    <table style="margin-top:16px"><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead><tbody>${rows}
      <tr><td colspan="3" class="num">Subtotal</td><td class="num">${m(t.subtotal)}</td></tr>
      ${inv.taxRate ? `<tr><td colspan="3" class="num">${esc(business.taxLabel || 'Tax')} (${inv.taxRate}%)</td><td class="num">${m(t.tax)}</td></tr>` : ''}
      <tr class="total"><td colspan="3" class="num">${receipt ? 'Paid' : 'Total due'}</td><td class="num">${m(t.total)}</td></tr></tbody></table>
    ${receipt && inv.method ? `<p>Paid by ${esc(inv.method)}.</p>` : ''}
    ${!receipt && inv.status !== 'void' && link ? `<div class="pay"><b>Pay online:</b> <a href="${esc(link)}">${esc(link)}</a></div>` : ''}
    ${inv.note ? `<p>${lines(inv.note)}</p>` : ''}
    ${business.footer ? `<p class="foot muted">${lines(business.footer)}</p>` : ''}
  `);
}

export function trackRecordHtml(list: TrackedPrediction[], s: Score, business: Business, opts: { names: boolean }): string {
  const checked = list.filter((p) => p.entry.outcome && p.entry.outcome !== 'open');
  const label = { 'came-true': 'Came true', partly: 'Partly', 'did-not': 'Did not happen', open: 'Not yet known' } as const;
  const rows = checked
    .map((p, i) => `<tr><td>${opts.names ? esc(p.client) : `Client ${i + 1}`}</td><td>${fmtDay(p.entry.at.slice(0, 10))}</td><td>${p.entry.area ? esc(AREA_LABEL[p.entry.area]) : ''}</td><td>${esc(p.entry.text)}</td><td>${label[p.entry.outcome ?? 'open']}</td></tr>`)
    .join('');
  return page('Prediction track record', `
    <div class="head"><div><h1>Prediction track record</h1><div class="muted">as of ${fmtDay(new Date().toISOString().slice(0, 10))}</div></div>${from(business)}</div>
    <p><b>${s.total}</b> predictions logged, <b>${s.checked}</b> checked: <b>${s.hits}</b> came true, <b>${s.partly}</b> partly, <b>${s.misses}</b> did not.${s.rate !== null ? ` Score <b>${Math.round(s.rate * 100)}%</b> (partly counts as half).` : ''}</p>
    <h2>Checked predictions</h2>
    <table><thead><tr><th>Client</th><th>Made</th><th>Area</th><th>Prediction</th><th>Outcome</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="muted">Nothing checked yet.</td></tr>'}</tbody></table>
    <p class="caveat muted">Every prediction made is listed once it has been checked, hits and misses alike.</p>
  `);
}

/** Prints a standalone page from a hidden frame. */
export function printHtml(html: string) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  const go = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  };
  if (doc.readyState === 'complete') setTimeout(go, 50);
  else frame.onload = go;
}

export function downloadFile(text: string, name: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
