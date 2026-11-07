import { useRef, useState } from 'react';
import type { BirthInput } from '../types/chart';
import type { Profile } from '../lib/profiles';
import { downloadText } from '../lib/backup';
import { parseAny, profilesToAaf, profilesToCsv, profilesToJson, type ImportDraft } from '../lib/interop';
import { searchGazetteer } from '../lib/gazetteer';
import { deriveKeys, generatePassphrase, loadSyncUrl, open, passphraseProblem, pull, push, seal, storeSyncUrl, WrongPassphrase, type SyncKeys } from '../lib/sync';

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
  const [url, setUrl] = useState(loadSyncUrl);
  const [syncNote, setSyncNote] = useState<{ text: string; error?: boolean } | null>(null);
  const [working, setWorking] = useState(false);
  const keyCache = useRef<{ pass: string; keys: SyncKeys } | null>(null);
  const sealedRef = useRef<HTMLInputElement>(null);

  const keys = async () => {
    const problem = passphraseProblem(pass);
    if (problem) throw new Error(problem);
    if (keyCache.current?.pass !== pass) keyCache.current = { pass, keys: await deriveKeys(pass) };
    return keyCache.current.keys;
  };
  const task = async (label: string, fn: () => Promise<string>) => {
    setWorking(true);
    setSyncNote({ text: label });
    try { setSyncNote({ text: await fn() }); }
    catch (e) { setSyncNote({ text: e instanceof WrongPassphrase ? 'That passphrase does not open this data.' : (e as Error).message, error: true }); }
    finally { setWorking(false); }
  };
  const syncNow = () => task('Deriving the key and syncing…', async () => {
    const k = await keys();
    storeSyncUrl(url.trim());
    const remote = await pull(url.trim(), k.id);
    const merged = remote ? onMerge(await open(k, remote)) : 'Nothing stored yet under this passphrase; uploaded this browser’s data.';
    await push(url.trim(), k.id, await seal(k, backupText()));
    return `${merged} Synced at ${new Date().toLocaleTimeString()}.`;
  });
  const saveSealed = () => task('Encrypting…', async () => {
    const k = await keys();
    downloadText(await seal(k, backupText()), `jyotisha-sync-${stamp()}.jyosync`);
    return 'Saved an encrypted file. Put it in any cloud folder, then open it on the other device with the same passphrase.';
  });
  const openSealed = (file: File) => task('Decrypting…', async () => onMerge(await open(await keys(), await file.text())));

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
        AAF records, or the text of an Astro-Databank or astro.com chart page, or open a Jagannatha Hora <code>.jhd</code> file.
        Places are looked up in this browser.
      </p>
      <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'Asha, 1990-08-15, 06:30, New Delhi\nRavi, 1985-11-03, 23:45, Mumbai'} aria-label="Charts to import" />
      <div className="data-row">
        <button type="button" className="btn-ghost sm" disabled={!paste.trim()} onClick={() => void read(paste)}>Check these</button>
        <button type="button" className="btn-ghost sm" onClick={() => fileRef.current?.click()}>Open a file…</button>
        <input ref={fileRef} type="file" hidden accept=".csv,.json,.aaf,.jhd,.txt,text/plain,text/csv,application/json"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) await read(await f.text(), f.name); e.target.value = ''; }} />
      </div>
      {drafts && (
        <>
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
        No account. Your tabs, notes and saved charts are encrypted here with a key made from your passphrase
        (PBKDF2, 600,000 rounds, then AES-256-GCM). Only the ciphertext leaves this browser, and the passphrase is never stored or sent.
        Use the same passphrase on each device. If you lose it, the data cannot be recovered.
      </p>
      <div className="data-row">
        <input type={show ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Passphrase, 16 characters or more" autoComplete="new-password" aria-label="Sync passphrase" />
        <button type="button" className="btn-ghost sm" onClick={() => setShow((s) => !s)}>{show ? 'Hide' : 'Show'}</button>
        <button type="button" className="btn-ghost sm" onClick={() => { setPass(generatePassphrase()); setShow(true); }}>Make one</button>
      </div>
      <div className="data-row">
        <button type="button" className="btn-ghost sm" disabled={working} onClick={saveSealed}>Save encrypted file</button>
        <button type="button" className="btn-ghost sm" disabled={working} onClick={() => sealedRef.current?.click()}>Open encrypted file…</button>
        <input ref={sealedRef} type="file" hidden accept=".jyosync,application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) void openSealed(f); e.target.value = ''; }} />
      </div>
      <p className="muted">Or sync through a server you trust. It only ever receives the encrypted blob, named by a code derived from the passphrase. <code>node tools/sync-server.mjs</code> in the source runs one.</p>
      <div className="data-row">
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-server.example/sync" aria-label="Sync server address" />
        <button type="button" className="btn-primary" disabled={working || !url.trim()} onClick={syncNow}>Sync now</button>
      </div>
      {syncNote && <p className={`data-status ${syncNote.error ? 'is-error' : ''}`} role="status">{syncNote.text}</p>}
    </details>
  );
}
