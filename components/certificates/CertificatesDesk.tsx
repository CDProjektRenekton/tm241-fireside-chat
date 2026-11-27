'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EVENT } from '@/lib/config';
import { CERT_PAGE, SIGNATORIES, SIGNATURE_MAX_CHARS } from '@/lib/signatories';
import { Alert, ArrowLeft, Check, Download, Mail, Pencil, Refresh, X } from '../Icons';

interface Signatory {
  key: string;
  name: string;
  title: string;
  signature: string | null;
}
interface Counts {
  answered: number;
  waiting: number;
  sent: number;
  failed: number;
  sending: number;
}
interface State {
  auto: boolean;
  updatedAt: string;
  signatories: Signatory[];
  counts: Counts;
  emailReady: boolean;
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-PH')} ${n === 1 ? one : many}`;

/**
 * A photo or scan of a signature on paper (or a transparent PNG) → a trimmed PNG with the paper made
 * transparent, small enough to store. Runs in the browser, so the original picture never leaves it.
 */
async function prepareSignature(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error('Please choose a PNG or JPG picture of the signature.');
  if (file.size > 15 * 1024 * 1024) throw new Error('That picture is too large (over 15 MB).');
  const url = URL.createObjectURL(file);
  try {
    const img = new window.Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const work = document.createElement('canvas');
    work.width = w;
    work.height = h;
    const ctx = work.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h);
    const d = px.data;
    const lumAt = (a: Uint8ClampedArray, i: number) => 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];

    // A PNG that is already see-through keeps its own transparency. A photo or scan: the paper is judged
    // around each spot (a blurred copy), so grey paper and uneven light disappear and only the ink stays.
    let clear = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 10) clear++;
    if (clear < w * h * 0.2) {
      const cell = 24;
      const small = document.createElement('canvas');
      small.width = Math.max(1, Math.ceil(w / cell));
      small.height = Math.max(1, Math.ceil(h / cell));
      const sctx = small.getContext('2d')!;
      sctx.imageSmoothingQuality = 'high';
      sctx.drawImage(work, 0, 0, small.width, small.height);
      const blur = document.createElement('canvas');
      blur.width = w;
      blur.height = h;
      const bctx = blur.getContext('2d', { willReadFrequently: true })!;
      bctx.imageSmoothingQuality = 'high';
      bctx.drawImage(small, 0, 0, w, h);
      const bg = bctx.getImageData(0, 0, w, h).data;
      for (let i = 0; i < d.length; i += 4) {
        const darker = lumAt(bg, i) - lumAt(d, i);
        const keep = Math.min(1, Math.max(0, (darker - 16) / 44));
        d[i + 3] = Math.round(d[i + 3] * keep);
      }
    }
    // Specks and fully clear pixels are emptied (smaller file); the edges of the ink stay soft.
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 28) d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
    }
    // The signature's edges: rows and columns with a few solid ink pixels (lone specks don't count).
    const rows = new Uint32Array(h);
    const cols = new Uint32Array(w);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (d[(y * w + x) * 4 + 3] > 90) {
          rows[y]++;
          cols[x]++;
        }
    const need = 2;
    let top = rows.findIndex((n) => n >= need);
    let left = cols.findIndex((n) => n >= need);
    let bottom = h - 1 - [...rows].reverse().findIndex((n) => n >= need);
    let right = w - 1 - [...cols].reverse().findIndex((n) => n >= need);
    if (top < 0 || left < 0 || bottom >= h || right >= w) throw new Error('No signature was found in that picture. Use dark ink on white paper, or a PNG with a transparent background.');
    ctx.putImageData(px, 0, 0);
    const pad = 4;
    left = Math.max(0, left - pad);
    top = Math.max(0, top - pad);
    bottom = Math.min(h - 1, bottom + pad);
    right = Math.min(w - 1, right + pad);
    const cw = right - left + 1;
    const ch = bottom - top + 1;
    for (const max of [900, 700, 540, 420, 320]) {
      // at most `max` wide and about half that tall: plenty for the 184 × 64 pt space it prints in
      const s = Math.min(1, max / cw, (max * 0.45) / ch);
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(cw * s));
      out.height = Math.max(1, Math.round(ch * s));
      const o = out.getContext('2d')!;
      o.imageSmoothingQuality = 'high';
      o.drawImage(work, left, top, cw, ch, 0, 0, out.width, out.height);
      const png = out.toDataURL('image/png');
      if (png.length <= SIGNATURE_MAX_CHARS) return png;
    }
    throw new Error('That picture has too much detail to use. Try a clearer photo with only the signature in it.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The certificate picture with a sample name and the signatures where they will print. */
function CertificatePreview({ signatories }: { signatories: Signatory[] }) {
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <div className="crt-cert" role="img" aria-label="Preview of the Certificate of Participation with the signatures">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/certificate-preview.jpg" alt="" width={1120} height={792} />
      <span className="crt-cert-name">JUAN DELA CRUZ</span>
      {SIGNATORIES.map((s) => {
        const sig = signatories.find((x) => x.key === s.key)?.signature;
        return sig ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.key}
            className="crt-cert-sig"
            src={sig}
            alt=""
            style={{ left: pct(s.box.left, CERT_PAGE.width), top: pct(s.box.top, CERT_PAGE.height), width: pct(s.box.width, CERT_PAGE.width), height: pct(s.box.height, CERT_PAGE.height) }}
          />
        ) : (
          <span
            key={s.key}
            className="crt-cert-gap"
            style={{ left: pct(s.box.left, CERT_PAGE.width), top: pct(s.box.top, CERT_PAGE.height), width: pct(s.box.width, CERT_PAGE.width), height: pct(s.box.height, CERT_PAGE.height) }}
          >
            No signature yet
          </span>
        );
      })}
    </div>
  );
}

function SignatureCard({ s, busy, onSave }: { s: Signatory; busy: boolean; onSave: (key: string, image: string | null) => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState('');
  const [working, setWorking] = useState(false);
  async function pick(file: File | undefined) {
    if (!file) return;
    setProblem('');
    setWorking(true);
    try {
      await onSave(s.key, await prepareSignature(file));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'That picture could not be used.');
    } finally {
      setWorking(false);
      if (input.current) input.current.value = '';
    }
  }
  return (
    <article className="crt-sig-card">
      <div>
        <p className="crt-sig-name">{s.name}</p>
        <p className="crt-sig-title">{s.title}</p>
      </div>
      <div className={`crt-sig-box${s.signature ? ' has-sig' : ''}`}>
        {s.signature ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.signature} alt={`Signature of ${s.name}`} />
        ) : (
          <span>No signature yet</span>
        )}
      </div>
      <div className="crt-row">
        <label className={`btn-mini btn-mini-solid${busy || working ? ' is-disabled' : ''}`}>
          <Pencil width={15} height={15} />
          {working ? 'Preparing…' : s.signature ? 'Replace signature' : 'Upload signature'}
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || working} onChange={(e) => void pick(e.target.files?.[0])} />
        </label>
        {s.signature && (
          <button type="button" className="btn-mini" disabled={busy || working} onClick={() => void onSave(s.key, null)}>
            <X width={15} height={15} />
            Remove
          </button>
        )}
      </div>
      {problem && (
        <p className="status status-warning crt-problem" role="alert">
          <Alert width={13} height={13} />
          {problem}
        </p>
      )}
    </article>
  );
}

/** Automatic certificates on or off, the event leads' signatures, and sending the ones that are waiting. */
export default function CertificatesDesk() {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ good: boolean; text: string } | null>(null);
  const [asking, setAsking] = useState<null | 'send' | 'retry'>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/certificates', { cache: 'no-store' });
      if (res.status === 401) return window.location.reload();
      const json = (await res.json().catch(() => ({}))) as State & { message?: string };
      if (!res.ok) throw new Error(json.message || 'Could not load the certificate settings.');
      setState(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the certificate settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function change(body: object, done: string) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch('/api/certificates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as State & { message?: string };
      if (!res.ok) throw new Error(json.message || 'Could not save. Try again.');
      setState(json);
      setNote({ good: true, text: done });
    } catch (e) {
      setNote({ good: false, text: e instanceof Error ? e.message : 'Could not save. Try again.' });
      throw e;
    } finally {
      setBusy(false);
    }
  }

  const missing = state?.signatories.filter((s) => !s.signature) ?? [];

  async function setAuto(on: boolean) {
    if (on && missing.length && !window.confirm(`${missing.map((s) => s.name).join(' and ')} ${missing.length === 1 ? 'has' : 'have'} no signature yet. Certificates would be made without ${missing.length === 1 ? 'it' : 'them'}. Turn on anyway?`)) return;
    await change({ auto: on }, on ? 'Automatic certificates are on.' : 'Automatic certificates are off.').catch(() => {});
  }

  async function send(retry: boolean) {
    if (!state) return;
    setAsking(null);
    setBusy(true);
    setNote(null);
    const total = retry ? state.counts.waiting + state.counts.failed : state.counts.waiting;
    setProgress({ done: 0, total });
    let sent = 0;
    let failed = 0;
    try {
      for (let round = 0; round < 200; round++) {
        const res = await fetch('/api/certificates/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ retry }) });
        const json = (await res.json().catch(() => ({}))) as { sent?: number; failed?: number; left?: number; stopped?: string; counts?: Counts; message?: string };
        if (!res.ok) throw new Error(json.message || 'Sending stopped. Try again.');
        sent += json.sent ?? 0;
        failed += json.failed ?? 0;
        setProgress({ done: sent + failed, total });
        setState((s) => (s && json.counts ? { ...s, counts: json.counts } : s));
        if (json.stopped) throw new Error(`Stopped after ${plural(sent, 'certificate', 'certificates')}: ${json.stopped}`);
        if (!json.left || (!json.sent && !json.failed)) break;
      }
      setNote({ good: !failed, text: `Sent ${plural(sent, 'certificate', 'certificates')}${failed ? `; ${failed} could not be sent (see Airtable, Certificate Email = Failed)` : ''}.` });
    } catch (e) {
      setNote({ good: false, text: e instanceof Error ? e.message : 'Sending stopped. Try again.' });
    } finally {
      setBusy(false);
      setProgress(null);
      void load();
    }
  }

  async function saveSignature(key: string, image: string | null) {
    const who = state?.signatories.find((s) => s.key === key)?.name ?? 'the signatory';
    await change({ signature: { key, image } }, image ? `Signature of ${who} saved.` : `Signature of ${who} removed.`);
  }

  const c = state?.counts;
  return (
    <div className="dash">
      <header className="dash-head">
        <div className="dash-head-inner">
          <div className="dash-brand">
            <div className="dash-logos">
              <Image src="/up-seal.png" alt="University of the Philippines" width={480} height={480} priority />
              <Image src="/tmc-logo.png" alt="UP Technology Management Center" width={400} height={400} priority />
            </div>
            <div>
              <p className="dash-kicker">{EVENT.series} · Certificates</p>
              <h1>{EVENT.title}</h1>
              <p className="dash-sub">The event leads&rsquo; signatures, automatic certificates, and the people waiting for theirs.</p>
            </div>
          </div>
          <div className="dash-actions">
            <a className="head-btn" href="/dashboard">
              <ArrowLeft width={18} height={18} />
              Dashboard
            </a>
            <button type="button" className="head-btn" onClick={() => void load()} disabled={loading || busy}>
              <Refresh className={loading ? 'spin' : ''} width={18} height={18} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="dash-main crt">
        {error && (
          <p className="banner banner-error" role="alert">
            <Alert />
            <span>{error}</span>
            <button type="button" className="btn-mini" onClick={() => void load()}>
              Try again
            </button>
          </p>
        )}
        {note && (
          <p className={`banner ${note.good ? 'banner-ok' : 'banner-error'}`} role="status">
            {note.good ? <Check /> : <Alert />}
            <span>{note.text}</span>
          </p>
        )}

        {state && (
          <>
            <section className="card crt-auto">
              <header className="card-head">
                <h2>Automatic certificates</h2>
                <p>
                  {state.auto
                    ? 'On: a certificate is made and emailed as soon as someone finishes the feedback form.'
                    : 'Off: answers are saved, and people are told their certificate will be emailed once the event leads have signed it. They wait in the list below until you send them.'}
                </p>
              </header>
              <div className="crt-row">
                <div className="crt-switch" role="group" aria-label="Automatic certificates">
                  <button type="button" aria-pressed={!state.auto} disabled={busy} onClick={() => void setAuto(false)}>
                    Off
                  </button>
                  <button type="button" aria-pressed={state.auto} disabled={busy} onClick={() => void setAuto(true)}>
                    On
                  </button>
                </div>
                <span className={`status ${state.auto ? 'status-good' : 'status-neutral'}`}>{state.auto ? 'Certificates go out by themselves' : 'Certificates wait for you'}</span>
              </div>
              {state.auto && missing.length > 0 && (
                <p className="status status-warning crt-problem">
                  <Alert width={13} height={13} />
                  No signature yet for {missing.map((s) => s.name).join(' and ')}: certificates are made without it.
                </p>
              )}
            </section>

            <section className="card">
              <header className="card-head">
                <h2>Signatures</h2>
                <p>A photo or scan of each signature in dark ink on white paper, or a PNG with a transparent background. The paper is removed and the signature trimmed automatically.</p>
              </header>
              <div className="crt-sigs">
                {state.signatories.map((s) => (
                  <SignatureCard key={s.key} s={s} busy={busy} onSave={saveSignature} />
                ))}
              </div>
            </section>

            <section className="card">
              <header className="card-head">
                <h2>How it looks</h2>
                <p>A sample certificate with the signatures as they are now.</p>
              </header>
              <CertificatePreview signatories={state.signatories} />
              <div className="crt-row crt-under">
                <a className="btn-mini" href="/api/certificates/sample" target="_blank" rel="noopener">
                  <Download width={15} height={15} />
                  Open a sample PDF
                </a>
              </div>
            </section>

            <section className="card crt-send">
              <header className="card-head">
                <h2>Waiting for their certificate</h2>
                <p>People who finished the feedback form while automatic certificates were off. Each gets their own certificate, with the signatures as they are when you send.</p>
              </header>
              <dl className="crt-counts">
                <div>
                  <dt>Waiting</dt>
                  <dd>{c!.waiting}</dd>
                </div>
                <div>
                  <dt>Sent</dt>
                  <dd>{c!.sent}</dd>
                </div>
                <div>
                  <dt>Could not be sent</dt>
                  <dd>{c!.failed}</dd>
                </div>
                <div>
                  <dt>Answered in all</dt>
                  <dd>{c!.answered}</dd>
                </div>
              </dl>

              {!state.emailReady && (
                <p className="status status-warning crt-problem">
                  <Alert width={13} height={13} />
                  Email is not set up on this site, so certificates cannot be sent.
                </p>
              )}

              {progress ? (
                <div className="upd-progress" role="status">
                  <progress max={progress.total || 1} value={progress.done} />
                  <span>
                    Sending… {progress.done} of {progress.total}
                  </span>
                </div>
              ) : asking ? (
                <div className="upd-confirm crt-confirm">
                  <p className="upd-confirm-q">
                    Email {plural(asking === 'retry' ? c!.waiting + c!.failed : c!.waiting, 'certificate', 'certificates')} now?
                  </p>
                  <p>
                    Each person gets an email with their own Certificate of Participation attached. This can&rsquo;t be undone.
                  </p>
                  <ul className="crt-check">
                    {state.signatories.map((s) => (
                      <li key={s.key} className={s.signature ? 'is-ok' : 'is-missing'}>
                        {s.signature ? <Check width={14} height={14} /> : <X width={14} height={14} />}
                        {s.name}: {s.signature ? 'signature uploaded' : 'no signature, the certificate is sent without it'}
                      </li>
                    ))}
                  </ul>
                  <div className="crt-row">
                    <button type="button" className="btn-mini btn-mini-solid" onClick={() => void send(asking === 'retry')}>
                      <Mail width={15} height={15} />
                      Yes, send {asking === 'retry' ? c!.waiting + c!.failed : c!.waiting}
                    </button>
                    <button type="button" className="btn-mini" onClick={() => setAsking(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="crt-row">
                  <button type="button" className="btn-mini btn-mini-solid" disabled={busy || !state.emailReady || !c!.waiting} onClick={() => setAsking('send')}>
                    <Mail width={15} height={15} />
                    {c!.waiting ? `Send ${plural(c!.waiting, 'certificate', 'certificates')}` : 'Nobody is waiting'}
                  </button>
                  {c!.failed > 0 && (
                    <button type="button" className="btn-mini" disabled={busy || !state.emailReady} onClick={() => setAsking('retry')}>
                      <Refresh width={15} height={15} />
                      Try the {c!.failed} that could not be sent
                    </button>
                  )}
                  {c!.sending > 0 && <span className="muted">{c!.sending} being sent right now</span>}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
