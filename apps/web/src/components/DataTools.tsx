import { useRef, useState } from 'react';
import type { BirthInput } from '../types/chart';
import type { Profile } from '../lib/profiles';
import { downloadText } from '../lib/backup';
import { parseAny, profilesToAaf, profilesToCsv, profilesToJson, type ImportDraft } from '../lib/interop';
import { searchGazetteer } from '../lib/gazetteer';
import {
  Conflict, fallbackNoticed, formatSyncId, generatePassphrase, HOSTED_SYNC, loadSyncId, loadSyncUrl, newSyncId, normaliseSyncId, open,
  passphraseProblem, remove, seal, ServerUnavailable, setFallbackNoticed, storeSyncId, storeSyncUrl, syncRound, unlock, WrongPassphrase, type SyncSecret,
} from '../lib/sync';

interface Props {
  profiles: Profile[];
  /** Saves the confirmed imports; returns how many were new. */
  onImport: (items: { label: string; input: BirthInput }[]) => number;
  /** The full backup file of this browser */
  backupText: () => string;
  /** Merges a backup's text in; returns what happened, in words */
  onMerge: (text: string) => string;
}

const resolvePlace = async (q: string) => (await searchGazetteer(q, 1))[0] ?? null;
const stamp = () => new Date().toISOString().slice(0, 10);
/** UTF-8 when it is valid, otherwise Windows-1252, which older desktop programs (Solar Fire, Astrolog) write */
const fileText = async (f: File) => {
  const bytes = await f.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return new TextDecoder('windows-1252').decode(bytes); }
};

/** Export, import, bulk paste and encrypted sync, under the saved charts list. */
export function DataTools({ profiles, onImport, backupText, onMerge }: Props) {
  const [paste, setPaste] = useState('');
  const [drafts, setDrafts] = useState<ImportDraft[] | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const read = async (text: string, name = '') => {
    setImportNote(null);
    try { setDrafts(await parseAny(text, name, resolvePlace)); } catch { setDrafts([{ source: name || 'pasted text', error: 'Could not read this' }]); }
  };
  const good = drafts?.filter((d) => d.input) ?? [];
  const confirm = () => {
    const added = onImport(good.map((d) => ({ label: d.input!.name || 'Unnamed', input: d.input! })));
    setImportNote(`Added ${added} chart${added === 1 ? '' : 's'}${good.length - added ? `; ${good.length - added} were already saved` : ''}.`);
    setDrafts(null);
    setPaste('');
  };

  /* ---------- sync ---------- */
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [useServer, setUseServer] = useState(() => !!loadSyncUrl());
  const [url, setUrl] = useState(() => loadSyncUrl() || HOSTED_SYNC[0]?.url || '');
  const [syncId, setSyncId] = useState(loadSyncId);
  const [syncNote, setSyncNote] = useState<{ text: string; error?: boolean } | null>(null);
  const [working, setWorking] = useState(false);
  const secret = useRef<SyncSecret | null>(null);
  const sealedRef = useRef<HTMLInputElement>(null);

  const checkPass = () => { const problem = passphraseProblem(pass); if (problem) throw new Error(problem); };
  const sealHere = async () => {
    checkPass();
    if (secret.current?.pass !== pass) secret.current = await unlock(pass);
    return seal(secret.current, backupText());
  };
  const task = async (label: string, fn: () => Promise<string>) => {
    setWorking(true);
    setSyncNote({ text: label });
    try { setSyncNote({ text: await fn() }); }
    catch (e) { setSyncNote({ text: e instanceof WrongPassphrase ? 'That passphrase does not open this data.' : (e as Error).message, error: true }); }
    finally { setWorking(false); }
  };
  const saveFile = async () => {
    downloadText(await sealHere(), `jyotisha-sync-${stamp()}.jyosync`);
    return 'Saved an encrypted file. Put it in any cloud folder, then open it on the other device with the same passphrase.';
  };
  const saveSealed = () => task('Making the key and encrypting…', saveFile);
  const openSealed = (file: File) => task('Making the key and decrypting…', async () => {
    const opened = await open(pass, await file.text(), secret.current);
    secret.current = opened.secret;
    return onMerge(opened.text);
  });
  const syncNow = () => task('Making the key and syncing…', async () => {
    checkPass();
    let id = normaliseSyncId(syncId);
    if (syncId.trim() && !id) throw new Error('A sync ID is 32 letters and digits (0–9, a–f). Copy it again from your other device.');
    if (!id) { id = newSyncId(); setSyncId(formatSyncId(id)); }
    storeSyncId(formatSyncId(id));
    storeSyncUrl(url.trim());
    try {
      const round = await syncRound({ base: url.trim(), id, pass, secret: secret.current, merge: onMerge, local: backupText });
      secret.current = round.secret;
      setFallbackNoticed(false);
      return `${round.note} Synced at ${new Date().toLocaleTimeString()}.`;
    } catch (e) {
      if (!(e instanceof ServerUnavailable || e instanceof Conflict)) throw e;
      // kill switch: never leave the person without a copy; fall back to file sync and say so once
      const saved = await saveFile();
      if (fallbackNoticed()) return saved;
      setFallbackNoticed(true);
      return `${e.message} Nothing was sent, so an encrypted file was saved instead. ${saved.replace(/^Saved an encrypted file\. /, '')}`;
    }
  });
  const forget = () => task('Deleting…', async () => {
    const id = normaliseSyncId(syncId);
    if (!id) throw new Error('There is no sync ID to delete.');
    await remove(url.trim(), id);
    storeSyncId('');
    setSyncId('');
    return 'Deleted everything the server held under this sync ID. The data in this browser is untouched.';
  });

  return (
    <details className="data-tools" id="data-tools">
      <summary>Import, export and sync</summary>

      <h4>Export saved charts</h4>
      <div className="data-row">
        <button type="button" className="btn-ghost sm" disabled={!profiles.length} onClick={() => downloadText(profilesToCsv(profiles), `jyotisha-charts-${stamp()}.csv`)}>CSV</button>
        <button type="button" className="btn-ghost sm" disabled={!profiles.length} onClick={() => downloadText(profilesToJson(profiles), `jyotisha-charts-${stamp()}.json`)}>JSON</button>
        <button type="button" className="btn-ghost sm" disabled={!profiles.length} onClick={() => downloadText(profilesToAaf(profiles), `jyotisha-charts-${stamp()}.aaf`)} title="Astrological Exchange Format, read by astro.com, Astrolog and most desktop programs">AAF</button>
      </div>

      <h4>Import or paste many charts</h4>
      <p className="muted">
        Paste one chart per line, like <code>Asha, 1990-08-15, 06:30, New Delhi</code> or with coordinates and a zone
        {' '}<code>Ravi; 3/11/1985; 11:45 pm; 19.076, 72.8777; Asia/Kolkata</code>. You can also paste a CSV with a header row,
        AAF records, or the text of an Astro-Databank or astro.com chart page. You can also open a Jagannatha Hora <code>.jhd</code>, an Astrolog
        {' '}<code>.as</code> or <code>.chtk</code>, an Astro-Databank XML export, a Solar Fire Quick*Chart
        {' '}or <code>charts.txt</code> export, or an iCalendar <code>.ics</code> file.
        Places are looked up in this browser.
      </p>
      <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'Asha, 1990-08-15, 06:30, New Delhi\nRavi, 1985-11-03, 23:45, Mumbai'} aria-label="Charts to import" />
      <div className="data-row">
        <button type="button" className="btn-ghost sm" disabled={!paste.trim()} onClick={() => void read(paste)}>Check these</button>
        <button type="button" className="btn-ghost sm" onClick={() => fileRef.current?.click()}>Open a file…</button>
        <input ref={fileRef} type="file" hidden accept=".csv,.json,.aaf,.jhd,.as,.chtk,.qck,.dat,.xml,.ics,.txt,text/plain,text/calendar,application/xml,text/xml,text/csv,application/json"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) await read(await fileText(f), f.name); e.target.value = ''; }} />
      </div>
      {drafts && (
        <>
          {[...new Set(drafts.map((d) => d.note).filter(Boolean))].map((n) => <p key={n} className="muted import-note">{n}</p>)}
          <ul className="import-preview">
            {drafts.map((d, i) => (
              <li key={i} className={d.input ? '' : 'bad'}>
                {d.input
                  ? <>✓ <b>{d.input.name || 'Unnamed'}</b> · {d.input.date} {d.input.time} · {d.input.place} <small className="muted">{d.input.timezone}{d.input.utcOffsetMinutes !== undefined ? `, UTC${d.input.utcOffsetMinutes >= 0 ? '+' : ''}${d.input.utcOffsetMinutes / 60}` : ''}{d.input.rodden ? ` · Rodden ${d.input.rodden}` : ''}</small></>
                  : <>✕ {d.source.slice(0, 80)} <small>{d.error}</small></>}
              </li>
            ))}
          </ul>
          <div className="data-row">
            <button type="button" className="btn-primary" disabled={!good.length} onClick={confirm}>Save {good.length} chart{good.length === 1 ? '' : 's'}</button>
            <button type="button" className="btn-ghost sm" onClick={() => setDrafts(null)}>Cancel</button>
          </div>
        </>
      )}
      {importNote && <p className="data-status" role="status">{importNote}</p>}

      <h4>Encrypted sync between devices</h4>
      <p className="muted">
        No account. Your tabs, notes and saved charts are encrypted in this browser with a key made on this device from your
        passphrase (Argon2id, then AES-256-GCM). The passphrase is never stored or sent, and if you lose it the data cannot be recovered.
        Use the same passphrase on each device.
      </p>
      <div className="data-row">
        <input type={show ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Passphrase, 16 characters or more" autoComplete="new-password" aria-label="Sync passphrase" />
        <button type="button" className="btn-ghost sm" onClick={() => setShow((s) => !s)}>{show ? 'Hide' : 'Show'}</button>
        <button type="button" className="btn-ghost sm" onClick={() => { setPass(generatePassphrase()); setShow(true); }}>Make one</button>
      </div>
      <div className="data-row">
        <button type="button" className="btn-primary" disabled={working} onClick={saveSealed}>Save encrypted file</button>
        <button type="button" className="btn-ghost sm" disabled={working} onClick={() => sealedRef.current?.click()}>Open encrypted file…</button>
        <input ref={sealedRef} type="file" hidden accept=".jyosync,application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) void openSealed(f); e.target.value = ''; }} />
      </div>

      <label className="check-row">
        <input type="checkbox" checked={useServer} onChange={(e) => setUseServer(e.target.checked)} />
        {' '}Sync through a server you trust (optional)
      </label>
      {useServer && (
        <div className="sync-server">
          <p className="muted" id="sync-server-sees">
            The server sees only ciphertext, a random sync ID and the times it was written and read. It never sees your passphrase, names or birth data.
          </p>
          <div className="data-row">
            {HOSTED_SYNC.map((h) => (
              <button key={h.url} type="button" className={`btn-ghost sm ${url === h.url ? 'is-on' : ''}`} onClick={() => setUrl(h.url)}>{h.label}</button>
            ))}
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://sync.your-domain.example" aria-label="Sync server address" />
          </div>
          <div className="data-row">
            <input value={syncId} onChange={(e) => setSyncId(e.target.value)} placeholder="Sync ID: leave empty on the first device" aria-label="Sync ID" spellCheck={false} autoComplete="off" className="mono" />
            <button type="button" className="btn-primary" disabled={working || !url.trim()} onClick={syncNow}>Sync now</button>
            <button type="button" className="btn-ghost sm" disabled={working || !normaliseSyncId(syncId) || !url.trim()} onClick={forget}>Delete from server</button>
          </div>
          <p className="muted">
            The first sync makes a random sync ID. On your other devices, enter that ID and the same passphrase.
            If the server fails or does not answer, an encrypted file is saved instead. To run your own server, see the
            {' '}<a href="https://github.com/destinjones/vedic-astrology/tree/main/tools/sync-worker" target="_blank" rel="noreferrer">sync server notes</a>.
          </p>
        </div>
      )}
      {syncNote && <p className={`data-status ${syncNote.error ? 'is-error' : ''}`} role="status">{syncNote.text}</p>}
    </details>
  );
}
