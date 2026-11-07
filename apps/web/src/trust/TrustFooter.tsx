import { buildLine } from './buildInfo';
import { RequestLog } from './RequestLog';

const base = import.meta.env.BASE_URL;

/** Links to the trust pages, the ephemeris and build line, and the network log. Goes inside each page's footer. */
export function TrustFooter() {
  const b = buildLine();
  return (
    <div className="trust-foot">
      <p className="trust-links">
        <a href={`${base}privacy/`}>Privacy</a> ·{' '}
        <a href={`${base}how-it-works/`}>How it works</a> ·{' '}
        <a href={`${base}check/`}>Check us against another program</a>
      </p>
      <p className="trust-build mono">
        {b.text}
        {b.commitUrl && <> · <a href={b.commitUrl}>commit {b.commitUrl.split('/').pop()!.slice(0, 7)}</a></>}
      </p>
      <RequestLog />
    </div>
  );
}
