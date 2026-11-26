'use client';

import { useEffect, useRef, useState } from 'react';
import { EVENT } from '@/lib/config';
import {
  DISSATISFIED_TO_SATISFIED,
  EMPTY_FEEDBACK,
  FACILITATION,
  FACILITATION_VALUES,
  FEEDBACK_VALIDATORS,
  feedbackStageOf,
  type FeedbackInput,
  NAME_MAX,
  NOT_TO_VERY_MUCH,
  SESSION_VALUES,
  SESSIONS,
  validateFeedback,
} from '@/lib/feedback';
import type { FieldErrors } from '@/lib/types';
import { LIMITS } from '@/lib/validation';
import { CardChoice, fieldId, TextField } from '../form/Fields';
import { Alert, ArrowLeft, ArrowRight, Check, Download, Info, Mail, Message, Shield, User } from '../Icons';
import { ChoiceGrid, ScaleField, StarRating } from './Scales';

const DRAFT_KEY = 'tm241-fc-feedback-draft-v2';

const CONSENT_OPTIONS = [
  { value: 'Yes', label: 'Yes', sub: 'I give my consent', icon: <Check /> },
  { value: 'No', label: 'No', sub: 'I do not consent', icon: <Alert /> },
];
/** Questions 1 and 2: 1 "Not" to 5 "Very much". */
const NOT_OPTIONS = ['1', '2', '3', '4', '5'].map((v, i) => ({ value: v, label: i === 0 ? NOT_TO_VERY_MUCH[0] : i === 4 ? NOT_TO_VERY_MUCH[1] : v }));
const FACILITATION_COLUMNS = FACILITATION_VALUES.map((v) => ({
  value: v,
  label: v === '1' ? '1, Very dissatisfied' : v === '5' ? '5, Very satisfied' : v === 'N/A' ? 'N/A' : v,
  short: v,
}));
const SESSION_COLUMNS = SESSION_VALUES.map((v) => ({ value: v, label: v }));
const ICON_MAIL = <Mail />;
const ICON_USER = <User />;

const STAGES = [
  { n: 1, title: 'You', sub: 'Your certificate' },
  { n: 2, title: 'Evaluation', sub: 'How it went' },
  { n: 3, title: 'Consent', sub: 'And your certificate' },
] as const;
type Stage = 1 | 2 | 3;

interface Certificate {
  number: string;
  name: string;
  /** Masked address it was emailed to; null when email could not be queued. */
  email: string | null;
  file?: { name: string; base64: string };
  /** It was emailed only minutes ago, so it was not sent again. */
  recently?: string;
  again?: boolean;
  preview?: boolean;
}

type Answered = { email: string; by: 'email' | 'ref' };

/** Saves a base64 PDF from the server as a file. */
function savePdf(file: { name: string; base64: string }) {
  const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function post<T>(path: string, body: object): Promise<{ status: number; json: T & { message?: string; errors?: FieldErrors } }> {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as T & { message?: string; errors?: FieldErrors } };
}

const oops = (e: unknown) => (e instanceof TypeError ? 'Network error — please check your connection and try again.' : (e as Error).message);

export default function FeedbackForm({ preview, opens, initialWho }: { preview: boolean; opens: string; initialWho: string }) {
  const [data, setData] = useState<FeedbackInput>(() => ({ ...EMPTY_FEEDBACK, who: initialWho }));
  const [stage, setStage] = useState<Stage>(1);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [tried, setTried] = useState<Record<Stage, boolean>>({ 1: false, 2: false, 3: false });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const loaded = useRef(false);

  // Keep an unfinished form for this browser tab only (cleared when the tab closes or the form is sent).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<FeedbackInput>;
        setData((d) => ({ ...d, ...saved, who: d.who || saved.who || '', consent: '', website: '' }));
      }
    } catch {
      /* storage unavailable — start fresh */
    }
    loaded.current = true;
  }, []);

  // A personal link (…/feedback?ref=TM241-FC-…) fills in the name they registered with.
  useEffect(() => {
    if (!initialWho || preview) return;
    void post<{ ok?: boolean; name?: string }>('/api/feedback/check', { who: initialWho })
      .then(({ json }) => {
        if (!json.ok || !json.name) return;
        setData((d) => ({ ...d, name: d.name || json.name!.slice(0, NAME_MAX) }));
      })
      .catch(() => {});
  }, [initialWho, preview]);

  useEffect(() => {
    if (!loaded.current || certificate) return;
    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      } catch {
        /* ignore */
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [data, certificate]);

  // Once a stage has been attempted, re-check it as they answer.
  useEffect(() => {
    if (tried[stage]) setErrors(FEEDBACK_VALIDATORS[stage - 1](data));
  }, [data, stage, tried]);

  // One stable setter per field, so memoized fields don't re-render on every keystroke.
  const setters = useRef<Partial<Record<keyof FeedbackInput, (v: never) => void>>>({});
  const set = <K extends keyof FeedbackInput>(key: K) => {
    const cache = setters.current;
    if (!cache[key]) cache[key] = ((v: FeedbackInput[K]) => setData((d) => ({ ...d, [key]: v }))) as (v: never) => void;
    return cache[key] as unknown as (v: FeedbackInput[K]) => void;
  };

  const setRow = (key: string, v: string) => setData((d) => ({ ...d, [key]: v }));

  const toTop = () =>
    window.requestAnimationFrame(() => {
      const el = cardRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 16;
      if (Math.abs(window.scrollY - top) > 40) window.scrollTo({ top });
    });

  function focusFirst(errs: FieldErrors) {
    const first = Object.keys(errs)[0];
    if (!first) return;
    window.requestAnimationFrame(() => {
      const el = document.getElementById(fieldId(first));
      if (!el) return;
      el.scrollIntoView({ block: 'center' });
      const target = first === 'facilitation' || first === 'sessions' ? el.querySelector('.is-missing input') : el.matches('[role=radiogroup], fieldset') ? el.querySelector('input') : el;
      ((target as HTMLElement | null) ?? el).focus({ preventScroll: true });
    });
  }

  function goTo(n: Stage) {
    setStage(n);
    setErrors(tried[n] ? FEEDBACK_VALIDATORS[n - 1](data) : {});
    setProblem('');
    toTop();
  }

  /** Stage 1: is this a registrant, and have they answered already? */
  async function checkWho() {
    const { status, json } = await post<{ ok?: boolean; answered?: boolean; email?: string; by?: 'email' | 'ref'; notFound?: boolean }>('/api/feedback/check', { who: data.who });
    if (status === 404) {
      setErrors({ who: json.message ?? 'Not found.' });
      focusFirst({ who: '' });
      return false;
    }
    if (!json.ok) throw new Error(json.message || 'Please try again.');
    if (json.answered) {
      setAnswered({ email: json.email ?? '', by: json.by ?? 'email' });
      toTop();
      return false;
    }
    return true;
  }

  async function submit() {
    const errs = validateFeedback(data);
    if (Object.keys(errs).length) {
      setTried({ 1: true, 2: true, 3: true });
      const at = feedbackStageOf(Object.keys(errs)[0]);
      if (at !== stage) setStage(at);
      setErrors(FEEDBACK_VALIDATORS[at - 1](data));
      return focusFirst(errs);
    }
    const { status, json } = await post<Certificate & { ok?: boolean; answered?: boolean; by?: 'email' | 'ref' }>('/api/feedback', data);
    if (status === 409 && json.answered) return setAnswered({ email: json.email ?? '', by: json.by ?? 'email' });
    if (!json.ok) {
      if (json.errors && Object.keys(json.errors).length) {
        const at = feedbackStageOf(Object.keys(json.errors)[0]);
        setTried({ 1: true, 2: true, 3: true });
        setStage(at);
        setErrors(json.errors);
        focusFirst(json.errors);
      }
      throw new Error(json.message || 'Your feedback could not be sent. Please try again.');
    }
    setCertificate({ number: json.number, name: json.name, email: json.email, file: json.file, preview: json.preview });
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    toTop();
  }

  async function next(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setProblem('');
    const errs = FEEDBACK_VALIDATORS[stage - 1](data);
    setTried((t) => ({ ...t, [stage]: true }));
    setErrors(errs);
    if (Object.keys(errs).length) return focusFirst(errs);
    setBusy(true);
    try {
      if (stage === 1) {
        if (await checkWho()) goTo(2);
      } else if (stage === 2) goTo(3);
      else await submit();
    } catch (err) {
      setProblem(oops(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendAgain() {
    setBusy(true);
    setProblem('');
    try {
      const { json } = await post<Certificate & { ok?: boolean }>('/api/feedback/again', { who: data.who });
      if (!json.ok) throw new Error(json.message || 'Please try again.');
      setCertificate({ number: json.number, name: json.name ?? '', email: json.email, file: json.file, recently: json.recently, again: true });
      toTop();
    } catch (err) {
      setProblem(oops(err));
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------ certificate

  if (certificate) {
    const c = certificate;
    return (
      <section className="form-card feedback-done" ref={cardRef} aria-live="polite">
        <p className="success-script">Thank you</p>
        <h2 className="success-title">{c.again ? 'Here it is again' : 'Your certificate is ready'}</h2>
        <p className="success-lead">
          {c.again
            ? `You’ve already sent your feedback for ${EVENT.title}.`
            : `Thank you for sharing your feedback on ${EVENT.title}. It helps us make the next conversation better.`}
        </p>

        {c.name && c.file && (
          <div className="cert" role="img" aria-label={`Certificate of Participation for ${c.name}, number ${c.number}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/certificate-preview.jpg" alt="" width={1120} height={792} />
            <CertificateName name={c.name} />
            <span className="cert-no">Certificate No. {c.number}</span>
          </div>
        )}

        {c.file && (
          <div className="pass-actions">
            <button type="button" className="btn btn-primary" onClick={() => savePdf(c.file!)}>
              <Download />
              Download certificate (PDF)
            </button>
          </div>
        )}

        <ul className="success-facts">
          <li>
            <span>Number</span>
            {c.number}
          </li>
          <li>
            <span>Email</span>
            <div>
              {c.email ? (
                <>
                  Also on its way to <b>{c.email}</b>. Not there in a few minutes? Check Promotions or Spam.
                </>
              ) : c.recently ? (
                <>
                  We emailed it to <b>{c.recently}</b> a few minutes ago. Please check Promotions or Spam.
                </>
              ) : c.preview ? (
                'Not emailed: a try-out only emails an address typed into the first question.'
              ) : (
                'We couldn’t email it just now, so please download it here.'
              )}
            </div>
          </li>
        </ul>
        {c.preview && (
          <p className="callout callout-info">
            <Info />
            <span>This was a preview: nothing was saved, and the certificate says SAMPLE.</span>
          </p>
        )}
      </section>
    );
  }

  // ------------------------------------------------------------ already answered

  if (answered) {
    return (
      <section className="form-card feedback-done" ref={cardRef} aria-live="polite">
        <h2 className="success-title">You&rsquo;ve already answered</h2>
        <p className="success-lead">
          Thank you, we have your feedback. {answered.by === 'ref' ? 'You can get your certificate again here, and we’ll email it to' : 'We can email your certificate again to'}{' '}
          <b>{answered.email}</b>.
        </p>
        <div className="pass-actions">
          <button type="button" className={`btn btn-primary${busy ? ' is-loading' : ''}`} disabled={busy} onClick={() => void sendAgain()}>
            <Mail />
            {busy ? 'One moment…' : answered.by === 'ref' ? 'Get my certificate' : 'Email it again'}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setAnswered(null)}>
            <ArrowLeft />
            Back
          </button>
        </div>
        {answered.by === 'email' && <p className="field-hint">To download it here instead, go back and use your reference number (TM241-FC-…).</p>}
        {problem && (
          <p className="callout callout-error" role="alert">
            <Alert />
            <span>{problem}</span>
          </p>
        )}
      </section>
    );
  }

  // ------------------------------------------------------------ form

  const progress = ((stage - 1) / (STAGES.length - 1)) * 100;
  return (
    <section className="form-card" ref={cardRef} aria-labelledby="feedback-title">
      {preview && (
        <p className="callout callout-info">
          <Info />
          <span>
            Organizer preview. The form opens to everyone on {opens}.
            <small>Nothing you send here is saved. Type your own email to receive the sample certificate.</small>
          </span>
        </p>
      )}
      <div className="form-card-head">
        <p className="form-kicker">
          <Message width={16} height={16} />
          Feedback
        </p>
        <p className="form-stage" aria-live="polite">
          Stage {String(stage).padStart(2, '0')} <span>/ 03</span>
        </p>
      </div>

      <nav className="trajectory" aria-label="Form progress">
        <div className="traj-track" aria-hidden="true">
          <span className="traj-fill" style={{ width: `${progress}%` }} />
        </div>
        <ol className="traj-steps">
          {STAGES.map((s) => (
            <li key={s.n} className={`traj-step ${stage === s.n ? 'is-current' : stage > s.n ? 'is-done' : ''}`} aria-current={stage === s.n ? 'step' : undefined}>
              <button type="button" disabled={s.n >= stage || busy} onClick={() => goTo(s.n as Stage)}>
                <span className="traj-planet">
                  <span>{stage > s.n ? <Check width={14} height={14} /> : s.n}</span>
                </span>
                <span className="traj-text">
                  <b>{s.title}</b>
                  <small>{s.sub}</small>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <form onSubmit={(e) => void next(e)} noValidate>
        {/* Honeypot: hidden from people, tempting to bots. */}
        <div className="hp" aria-hidden="true">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={data.website} onChange={(e) => set('website')(e.target.value)} />
          </label>
        </div>

        {stage === 1 && (
          <div className="section">
            <header className="section-head">
              <h3>About you</h3>
              <p>So we can find your registration and make your certificate.</p>
            </header>
            <TextField
              name="who"
              number={1}
              label="Registered email or reference number"
              hint="The email you registered with, or the number on your boarding pass (TM241-FC-…)."
              required
              icon={ICON_MAIL}
              autoComplete="email"
              placeholder="you@example.com or TM241-FC-XXXXXX"
              maxLength={254}
              value={data.who}
              onChange={set('who')}
              error={errors.who}
            />
            <TextField
              name="name"
              number={2}
              label="Name on your certificate"
              hint="Exactly as it should be printed."
              required
              icon={ICON_USER}
              autoComplete="name"
              placeholder="e.g. Juan M. Dela Cruz"
              maxLength={NAME_MAX}
              value={data.name}
              onChange={set('name')}
              error={errors.name}
            />
          </div>
        )}

        {stage === 2 && (
          <div className="section">
            <header className="section-head">
              <h3>Event evaluation</h3>
              <p>There are no wrong answers. Please be honest.</p>
            </header>
            <ScaleField
              name="satisfied"
              number={3}
              label="How satisfied were you with the event?"
              options={NOT_OPTIONS}
              value={data.satisfied}
              onChange={set('satisfied')}
              error={errors.satisfied}
              ends={NOT_TO_VERY_MUCH}
            />
            <ScaleField
              name="relevant"
              number={4}
              label="How relevant and helpful do you think it was for your role or field?"
              options={NOT_OPTIONS}
              value={data.relevant}
              onChange={set('relevant')}
              error={errors.relevant}
              ends={NOT_TO_VERY_MUCH}
            />
            <TextField
              name="takeaways"
              number={5}
              label="What were your key takeaways from the fireside chat?"
              required
              multiline
              rows={3}
              maxLength={LIMITS.long}
              placeholder="An idea, a lesson, something you’ll try…"
              value={data.takeaways}
              onChange={set('takeaways')}
              error={errors.takeaways}
            />
            <ChoiceGrid
              name="facilitation"
              number={6}
              label="How satisfied were you with the event facilitation?"
              hint={DISSATISFIED_TO_SATISFIED}
              columns={FACILITATION_COLUMNS}
              rows={FACILITATION}
              values={data as unknown as Record<string, string>}
              onChange={setRow}
              error={errors.facilitation}
              legend={`${DISSATISFIED_TO_SATISFIED}, or N/A`}
            />
            <TextField
              name="facilitationNotes"
              number={7}
              label="Tell us more about your feedback above!"
              required
              multiline
              rows={3}
              maxLength={LIMITS.long}
              placeholder="What worked well, and what could be better…"
              value={data.facilitationNotes}
              onChange={set('facilitationNotes')}
              error={errors.facilitationNotes}
            />
            <ChoiceGrid
              name="sessions"
              number={8}
              label="Which sessions did you find most relevant?"
              columns={SESSION_COLUMNS}
              rows={SESSIONS}
              values={data as unknown as Record<string, string>}
              onChange={setRow}
              error={errors.sessions}
              legend="Not relevant, Relevant, Very relevant, or Did not attend"
              wide
            />
            <StarRating
              name="overall"
              number={9}
              label="How satisfied were you with the overall fireside chat?"
              hint={DISSATISFIED_TO_SATISFIED}
              value={data.overall}
              onChange={set('overall')}
              error={errors.overall}
              words={['Very dissatisfied', 'Very satisfied']}
            />
            <TextField
              name="overallFeedback"
              number={10}
              label="Any overall feedback for the event?"
              optional
              multiline
              rows={3}
              maxLength={LIMITS.long}
              placeholder="Anything else you’d like us to know…"
              value={data.overallFeedback}
              onChange={set('overallFeedback')}
              error={errors.overallFeedback}
            />
          </div>
        )}

        {stage === 3 && (
          <div className="section">
            <header className="section-head">
              <h3>Consent</h3>
              <p>One last step, and your certificate is ready.</p>
            </header>
            <div className="consent">
              <div className="consent-head">
                <Shield />
                <div>
                  <b>Data privacy</b>
                  <small>Republic Act No. 10173 — Data Privacy Act of 2012</small>
                </div>
              </div>
              <p className="consent-body">
                The {EVENT.organizer} uses your answers only to evaluate the {EVENT.series} and to issue your certificate. Your answers are kept
                confidential and shared only with the event organizers.
              </p>
              <CardChoice
                name="consent"
                number={11}
                label="I voluntarily consent to the processing of my answers for event evaluation and for issuing my Certificate of Participation."
                required
                className="cards-consent"
                options={CONSENT_OPTIONS}
                value={data.consent}
                onChange={set('consent') as (v: string) => void}
                error={errors.consent}
              />
            </div>
          </div>
        )}

        {problem && (
          <p className="callout callout-error" role="alert">
            <Alert />
            <span>{problem}</span>
          </p>
        )}

        <div className={`actions${stage === 3 ? ' is-last' : ''}`}>
          {stage > 1 ? (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => goTo((stage - 1) as Stage)}>
              <ArrowLeft />
              Back
            </button>
          ) : (
            <span className="actions-note">
              <span className="req">*</span> Required
            </span>
          )}
          <button type="submit" className={`btn btn-primary${busy ? ' is-loading' : ''}`} disabled={busy || (stage === 3 && data.consent === 'No')}>
            {busy ? (
              <>
                <span className="spinner" aria-hidden="true" />
                {stage === 3 ? 'Making your certificate…' : 'Checking…'}
              </>
            ) : stage === 3 ? (
              <>
                Submit and get my certificate
                <Check />
              </>
            ) : (
              <>
                Next
                <ArrowRight />
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}

/** The name on the picture of the certificate: shrinks to fit its line, and wraps when it is long. */
function CertificateName({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = name.toLocaleUpperCase('en-PH');
  useEffect(() => {
    const el = ref.current;
    if (!el?.parentElement) return;
    const fit = () => {
      const box = el.parentElement!.clientWidth;
      const max = box * 0.045;
      el.style.whiteSpace = 'nowrap';
      el.style.fontSize = `${max}px`;
      const need = el.scrollWidth / (box * 0.756);
      if (need <= 1) return;
      const size = max / need;
      if (size >= box * 0.031 || !shown.includes(' ')) el.style.fontSize = `${size}px`;
      else {
        el.style.whiteSpace = 'normal';
        el.style.fontSize = `${box * 0.0285}px`;
      }
    };
    fit();
    void document.fonts?.ready.then(fit);
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [shown]);
  return (
    <span className="cert-name">
      <span ref={ref}>{shown}</span>
    </span>
  );
}
