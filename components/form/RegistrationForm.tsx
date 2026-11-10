'use client';

import { useEffect, useRef, useState } from 'react';
import { AFFILIATIONS, AGE_GROUPS, EVENT, SEXES, TOPICS } from '@/lib/config';
import type { FieldErrors, RegistrationInput } from '@/lib/types';
import { LIMITS, STEP_VALIDATORS, stepOf, validateAll } from '@/lib/validation';
import {
  Alert,
  ArrowLeft,
  ArrowRight,
  Badge,
  Book,
  Briefcase,
  Building,
  CalendarPlus,
  Cap,
  Check,
  Flask,
  Info,
  Landmark,
  Mail,
  Pencil,
  Plus,
  Presentation,
  Printer,
  Rocket,
  Shield,
  User,
} from '../Icons';
import CardSweep from '../CardSweep';
import { CardChoice, ChipChoice, fieldId, PillChoice, TextField } from './Fields';
import { CopyRef, downloadInvite, Liftoff, MissionPass } from './MissionPass';

const DRAFT_KEY = 'tm241-fc-draft-v1';

const initialData = (): RegistrationInput => ({
  name: '',
  sex: '',
  ageGroup: '',
  email: '',
  organization: '',
  affiliation: '',
  affiliationOther: '',
  topics: [],
  topicsOther: '',
  question: '',
  hopes: '',
  consent: '',
  website: '',
});

const AFFILIATION_ICONS: Record<(typeof AFFILIATIONS)[number], React.ReactNode> = {
  'Undergraduate Student': <Book />,
  'Graduate Student': <Cap />,
  'Faculty Member': <Presentation />,
  Researcher: <Flask />,
  'University Staff': <Badge />,
  'Government Employee': <Landmark />,
  'Industry Professional': <Briefcase />,
  Other: <Plus />,
};

// Created once (not per render) so the memoized fields see unchanged props.
const ICON_USER = <User />;
const ICON_MAIL = <Mail />;
const ICON_BUILDING = <Building />;

const SEX_OPTIONS = SEXES.map((s) => ({ value: s, label: s }));
const AGE_OPTIONS = AGE_GROUPS.map((a) => ({ value: a, label: a }));
const AFFILIATION_OPTIONS = AFFILIATIONS.map((a) => ({ value: a, label: a, icon: AFFILIATION_ICONS[a] }));
const TOPIC_OPTIONS = TOPICS.map((t) => ({ value: t, label: t }));
const CONSENT_OPTIONS = [
  { value: 'Yes', label: 'Yes', sub: 'I give my consent', icon: <Check /> },
  { value: 'No', label: 'No', sub: 'I do not consent', icon: <Alert /> },
];

const STEPS = [
  { n: 1, title: 'About You', sub: 'Your details' },
  { n: 2, title: 'Audience Engagement', sub: 'Topics & questions' },
  { n: 3, title: 'Consent', sub: 'Review & confirm' },
] as const;

type Step = 1 | 2 | 3;
type Status = 'idle' | 'submitting' | 'done';

export default function RegistrationForm() {
  const [data, setData] = useState<RegistrationInput>(initialData);
  const [step, setStep] = useState<Step>(1);
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState<Record<Step, boolean>>({ 1: false, 2: false, 3: false });
  const [status, setStatus] = useState<Status>('idle');
  const [serverError, setServerError] = useState('');
  const [result, setResult] = useState<{ ref: string; data: RegistrationInput; emailed: boolean } | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const loaded = useRef(false);

  // Keep an in-progress draft for this browser tab only (sessionStorage clears when the tab closes,
  // which matters on shared computers at the registration desk).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<RegistrationInput>;
        setData((d) => ({
          ...d,
          ...saved,
          topics: Array.isArray(saved.topics) ? saved.topics.filter((t) => typeof t === 'string') : [],
          website: '',
        }));
      }
    } catch {
      /* storage unavailable — start fresh */
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current || status === 'done') return;
    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      } catch {
        /* ignore */
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [data, status]);

  // Once a step has been attempted, re-check it as the user types.
  useEffect(() => {
    if (attempted[step]) setErrors(STEP_VALIDATORS[step - 1](data));
  }, [data, step, attempted]);

  // One stable setter per field (cached), so memoized fields don't re-render on every keystroke.
  const setters = useRef<Partial<Record<keyof RegistrationInput, (v: never) => void>>>({});
  const set = <K extends keyof RegistrationInput>(key: K) => {
    const cache = setters.current;
    if (!cache[key]) cache[key] = ((v: RegistrationInput[K]) => setData((d) => ({ ...d, [key]: v }))) as (v: never) => void;
    return cache[key] as unknown as (v: RegistrationInput[K]) => void;
  };

  const scrollToCard = () => {
    const el = cardRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 16;
    if (Math.abs(window.scrollY - top) > 40) window.scrollTo({ top, behavior: 'smooth' });
  };

  const focusFirstError = (errs: FieldErrors) => {
    const first = Object.keys(errs)[0];
    if (!first) return;
    window.requestAnimationFrame(() => {
      const el = document.getElementById(fieldId(first));
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el.matches('[role=radiogroup], fieldset') ? (el.querySelector('input') ?? el) : el).focus({ preventScroll: true });
    });
  };

  const goTo = (n: Step) => {
    setDir(n > step ? 'fwd' : 'back');
    setStep(n);
    setErrors(attempted[n] ? STEP_VALIDATORS[n - 1](data) : {});
    setServerError('');
    window.requestAnimationFrame(scrollToCard);
  };

  async function submit() {
    const errs = validateAll(data);
    if (Object.keys(errs).length) {
      setAttempted({ 1: true, 2: true, 3: true });
      const firstStep = stepOf(Object.keys(errs)[0]);
      if (firstStep !== step) goTo(firstStep);
      setErrors(STEP_VALIDATORS[firstStep - 1](data));
      focusFirstError(errs);
      return;
    }
    setStatus('submitting');
    setServerError('');
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        ref?: string;
        emailed?: boolean;
        message?: string;
        errors?: FieldErrors;
      };
      if (!res.ok || !json.ok || !json.ref) {
        if (json.errors && Object.keys(json.errors).length) {
          const firstStep = stepOf(Object.keys(json.errors)[0]);
          setAttempted({ 1: true, 2: true, 3: true });
          if (firstStep !== step) goTo(firstStep);
          setErrors(json.errors);
          focusFirstError(json.errors);
        }
        throw new Error(json.message || 'Submission failed. Please try again.');
      }
      setResult({ ref: json.ref, data, emailed: Boolean(json.emailed) });
      setStatus('done');
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      window.requestAnimationFrame(scrollToCard);
    } catch (e) {
      setStatus('idle');
      setServerError(
        e instanceof TypeError ? 'Network error — please check your connection and try again.' : (e as Error).message,
      );
    }
  }

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'submitting') return;
    const errs = STEP_VALIDATORS[step - 1](data);
    setAttempted((a) => ({ ...a, [step]: true }));
    setErrors(errs);
    if (Object.keys(errs).length) return focusFirstError(errs);
    if (step < 3) return goTo((step + 1) as Step);
    void submit();
  }

  function reset() {
    setData(initialData());
    setErrors({});
    setAttempted({ 1: false, 2: false, 3: false });
    setDir('back');
    setStep(1);
    setResult(null);
    setStatus('idle');
    window.requestAnimationFrame(scrollToCard);
  }

  // ------------------------------------------------------------ success

  if (status === 'done' && result) {
    const first = result.data.name.split(' ')[0];
    return (
      <section className="form-card success-card" ref={cardRef} aria-live="polite">
        <CardSweep />
        <Liftoff />
        <p className="success-script">See you there</p>
        <h2 className="success-title">You&rsquo;re cleared for liftoff!</h2>
        <p className="success-lead">
          Thank you, {first}! Your registration for <b>{EVENT.title}</b> has been received. Here is your boarding pass —
          save or print it, and show its QR code at the registration desk on the day.
        </p>

        <MissionPass data={result.data} refNo={result.ref} />

        <div className="pass-actions no-print">
          <button type="button" className="btn btn-primary" onClick={() => downloadInvite(result.ref, result.data)}>
            <CalendarPlus />
            Add to calendar
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
            <Printer />
            Print / save pass
          </button>
          <CopyRef value={result.ref} />
        </div>

        <ul className="success-facts no-print">
          <li>
            <span>When</span>
            {EVENT.weekday}, {EVENT.dateEn} · {EVENT.time}
          </li>
          <li>
            <span>Where</span>
            {EVENT.venue}, UP Diliman
          </li>
          {result.emailed && (
            <li>
              <span>Email</span>
              <div>
                A copy is on its way to <b>{result.data.email}</b>. Not there in a few minutes? Check Promotions or Spam.
              </div>
            </li>
          )}
        </ul>

        <button type="button" className="btn btn-text no-print" onClick={reset}>
          <Plus width={18} height={18} />
          Register another person
        </button>
      </section>
    );
  }

  // ------------------------------------------------------------ form

  const submitting = status === 'submitting';
  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <section className="form-card" ref={cardRef} aria-labelledby="form-title">
      <CardSweep />
      <div className="form-card-head">
        <p className="form-kicker">
          <Rocket width={16} height={16} />
          Registration
        </p>
        <h2 id="form-title" className="sr-only">
          Register for the {EVENT.series}
        </h2>
        <p className="form-stage" aria-live="polite">
          Stage {String(step).padStart(2, '0')} <span>/ 03</span>
        </p>
      </div>

      <nav className="trajectory" aria-label="Form progress">
        <div className="traj-track" aria-hidden="true">
          <span className="traj-fill" style={{ width: `${progress}%` }} />
          <span className="traj-rocket" style={{ left: `${progress}%` }}>
            <Rocket width={20} height={20} />
          </span>
        </div>
        <ol className="traj-steps">
          {STEPS.map((s) => {
            const state = step === s.n ? 'is-current' : step > s.n ? 'is-done' : '';
            return (
              <li key={s.n} className={`traj-step ${state}`} aria-current={step === s.n ? 'step' : undefined}>
                <button type="button" disabled={s.n >= step || submitting} onClick={() => goTo(s.n as Step)}>
                  <span className="traj-planet">
                    <span>{step > s.n ? <Check width={14} height={14} /> : s.n}</span>
                  </span>
                  <span className="traj-text">
                    <b>{s.title}</b>
                    <small>{s.sub}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <form onSubmit={next} noValidate>
        {/* Honeypot: hidden from people, tempting to bots. */}
        <div className="hp" aria-hidden="true">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={data.website} onChange={(e) => set('website')(e.target.value)} />
          </label>
        </div>

        {step === 1 && (
          <div className={`section dir-${dir}`} key="s1">
            <header className="section-head">
              <h3>About You</h3>
              <p>Tell us who&rsquo;s coming aboard.</p>
            </header>

            <TextField
              name="name"
              number={1}
              label="Name"
              required
              icon={ICON_USER}
              autoComplete="name"
              placeholder="Full name, e.g. Juan Dela Cruz"
              maxLength={LIMITS.name}
              value={data.name}
              onChange={set('name')}
              error={errors.name}
            />
            <PillChoice
              name="sex"
              number={2}
              label="Sex"
              hint="Used only for group totals in event reports."
              required
              segmented
              options={SEX_OPTIONS}
              value={data.sex}
              onChange={set('sex') as (v: string) => void}
              error={errors.sex}
            />
            <PillChoice
              name="ageGroup"
              number={3}
              label="Age group"
              required
              options={AGE_OPTIONS}
              value={data.ageGroup}
              onChange={set('ageGroup') as (v: string) => void}
              error={errors.ageGroup}
            />
            <TextField
              name="email"
              number={4}
              label="Email"
              required
              type="email"
              inputMode="email"
              autoComplete="email"
              icon={ICON_MAIL}
              placeholder="you@example.com"
              value={data.email}
              onChange={set('email')}
              error={errors.email}
            />
            <TextField
              name="organization"
              number={5}
              label="University / Organization"
              required
              autoComplete="organization"
              icon={ICON_BUILDING}
              placeholder="e.g. University of the Philippines Diliman"
              value={data.organization}
              onChange={set('organization')}
              error={errors.organization}
            />
            <CardChoice
              name="affiliation"
              number={6}
              label="Current Affiliation"
              hint="Mark only one."
              required
              className="cards-affiliation"
              options={AFFILIATION_OPTIONS}
              value={data.affiliation}
              onChange={set('affiliation') as (v: string) => void}
              error={errors.affiliation}
            >
              {data.affiliation === 'Other' && (
                <div className="other-box">
                  <TextField
                    name="affiliationOther"
                    label="Other affiliation"
                    bare
                    autoFocus
                    placeholder="Please specify your affiliation"
                    value={data.affiliationOther}
                    onChange={set('affiliationOther')}
                    error={errors.affiliationOther}
                  />
                </div>
              )}
            </CardChoice>
          </div>
        )}

        {step === 2 && (
          <div className={`section dir-${dir}`} key="s2">
            <header className="section-head">
              <h3>Audience Engagement</h3>
              <p>Help us shape the conversation. Everything here is optional.</p>
            </header>

            <ChipChoice
              name="topics"
              number={7}
              label="Which topics interest you most?"
              hint="Check all that apply."
              options={TOPIC_OPTIONS}
              values={data.topics}
              onChange={set('topics')}
              error={errors.topics}
            >
              {data.topics.includes('Other') && (
                <div className="other-box">
                  <TextField
                    name="topicsOther"
                    label="Other topic"
                    bare
                    autoFocus
                    placeholder="What other topic interests you?"
                    value={data.topicsOther}
                    onChange={set('topicsOther')}
                    error={errors.topicsOther}
                  />
                </div>
              )}
            </ChipChoice>
            <TextField
              name="question"
              number={8}
              label="Do you have a question for our guest speaker?"
              multiline
              rows={4}
              maxLength={LIMITS.long}
              placeholder="Ask about leadership, building institutions, technology, or the road ahead…"
              value={data.question}
              onChange={set('question')}
              error={errors.question}
            />
            <TextField
              name="hopes"
              number={9}
              label="What do you hope to learn from this Fireside Chat?"
              multiline
              rows={4}
              maxLength={LIMITS.long}
              placeholder="Share what you’d like to take home from the conversation…"
              value={data.hopes}
              onChange={set('hopes')}
              error={errors.hopes}
            />
          </div>
        )}

        {step === 3 && (
          <div className={`section dir-${dir}`} key="s3">
            <header className="section-head">
              <h3>Consent</h3>
              <p>One last check before liftoff — here is a preview of your boarding pass.</p>
            </header>

            <MissionPass data={data} />
            <div className="review-edit">
              <button type="button" className="btn btn-text btn-sm" onClick={() => goTo(1)}>
                <Pencil width={16} height={16} />
                Edit details
              </button>
              <button type="button" className="btn btn-text btn-sm" onClick={() => goTo(2)}>
                <Pencil width={16} height={16} />
                Edit engagement
                {data.topics.length > 0 && <span className="pill">{data.topics.length} topics</span>}
                {data.question && <span className="pill">1 question</span>}
              </button>
            </div>

            <div className="consent">
              <div className="consent-head">
                <Shield />
                <div>
                  <b>Data privacy</b>
                  <small>Republic Act No. 10173 — Data Privacy Act of 2012</small>
                </div>
              </div>
              <p className="consent-body">
                The TM241 class of the UP Diliman Technology Management Center collects the information in this form only
                for the {EVENT.series}. It is kept confidential, shared only with the event organizers, and is not used for
                any other purpose.
              </p>
              <CardChoice
                name="consent"
                number={10}
                label="I voluntarily consent to the collection and processing of my information for event registration, attendance monitoring, and event coordination."
                required
                className="cards-consent"
                options={CONSENT_OPTIONS}
                value={data.consent}
                onChange={set('consent') as (v: string) => void}
                error={errors.consent}
              />
              {data.consent === 'No' && (
                <p className="callout callout-warn" role="status">
                  <Info />
                  <span>
                    We can only complete your registration with your consent.
                    <small>Choose “Yes” to continue, or close this page if you prefer not to register.</small>
                  </span>
                </p>
              )}
            </div>
          </div>
        )}

        {serverError && (
          <p className="callout callout-error" role="alert">
            <Alert />
            <span>{serverError}</span>
          </p>
        )}

        <div className="actions">
          {step > 1 ? (
            <button type="button" className="btn btn-ghost" disabled={submitting} onClick={() => goTo((step - 1) as Step)}>
              <ArrowLeft />
              Back
            </button>
          ) : (
            <span className="actions-note">
              <span className="req">*</span> Required
            </span>
          )}
          <button
            type="submit"
            className={`btn btn-primary${step === 3 ? ' btn-launch' : ''}${submitting ? ' is-loading' : ''}`}
            disabled={submitting || (step === 3 && data.consent === 'No')}
          >
            {submitting ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Launching…
              </>
            ) : step === 3 ? (
              <>
                Submit registration
                <Rocket />
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
