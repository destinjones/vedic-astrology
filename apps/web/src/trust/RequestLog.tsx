import { useEffect, useState } from 'react';
import { describeHost, getRequests, onRequests, startRequestLog, type LoggedRequest } from './requestLog';
import { REPO } from './buildInfo';
import './trust.css';

startRequestLog();

const base = import.meta.env.BASE_URL;

/** A collapsible list of everything this page has requested, other sites first. */
export function RequestLog() {
  const [all, setAll] = useState<LoggedRequest[]>(getRequests);
  const [showOwn, setShowOwn] = useState(false);
  useEffect(() => onRequests(setAll), []);

  const outside = all.filter((r) => !r.sameSite);
  const own = all.filter((r) => r.sameSite);
  const hosts = [...new Set(outside.map((r) => r.host))];
  const shown = showOwn ? all : outside;

  return (
    <details className="reqlog">
      <summary>
        Network log: {all.length} request{all.length === 1 ? '' : 's'} so far, {outside.length} to other sites
      </summary>
      <div className="reqlog-body">
        <p>
          Every request this page has made since it opened, as recorded by your browser. Requests to this site fetch the app
          itself (code, the ephemeris, artwork). Anything else is listed on the <a href={`${base}privacy/`}>privacy page</a>.
          To check this list, open your browser's developer tools and watch the Network tab.
        </p>
        {hosts.length > 0 ? (
          <ul className="reqlog-hosts">
            {hosts.map((h) => (
              <li key={h}><b>{h}</b> ({outside.filter((r) => r.host === h).length}): {describeHost(h)}</li>
            ))}
          </ul>
        ) : (
          <p className="reqlog-clean">Nothing has gone to another site yet.</p>
        )}
        <label className="reqlog-toggle">
          <input type="checkbox" checked={showOwn} onChange={(e) => setShowOwn(e.target.checked)} /> Also show the {own.length} requests to this site
        </label>
        {shown.length > 0 && (
          <div className="reqlog-scroll">
            <table className="reqlog-table">
              <thead><tr><th>Time</th><th>Type</th><th>Address</th></tr></thead>
              <tbody>
                {shown.slice().reverse().map((r, i) => (
                  <tr key={`${r.at}-${i}`} className={r.sameSite ? '' : 'is-outside'}>
                    <td className="mono">{(r.at / 1000).toFixed(1)}s</td>
                    <td>{r.kind}</td>
                    <td className="mono reqlog-url">{r.sameSite ? r.url.replace(location.origin, '') : r.url}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hosts.some((h) => describeHost(h).startsWith('Not on')) && (
          <p>
            A host above is not on our list. A browser extension can cause this too.{' '}
            <a href={`${REPO}/security/advisories/new`}>Report it privately</a>.
          </p>
        )}
      </div>
    </details>
  );
}
