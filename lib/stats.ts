// Filtering and summary statistics shared by the dashboard and the export endpoint,
// so the numbers on screen always match the downloaded file.
import { AFFILIATIONS, AGE_GROUPS, SEXES, STUDENT_AFFILIATIONS, TOPICS } from './config';
import type { Registration } from './types';

export type RangeKey = 'all' | 'today' | '7d' | '30d';

export interface Filters {
  q: string;
  sex: string;
  /** Age group */
  age: string;
  affiliation: string;
  topic: string;
  question: '' | 'yes' | 'no';
  /** Checked in at the event (the Attended box in Airtable). */
  attended: '' | 'yes' | 'no';
  range: RangeKey;
}

export const EMPTY_FILTERS: Filters = { q: '', sex: '', age: '', affiliation: '', topic: '', question: '', attended: '', range: 'all' };

export const RANGE_LABELS: Record<RangeKey, string> = {
  all: 'All time',
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};

const manilaDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** YYYY-MM-DD in Philippine time. */
export function dayKey(iso: string | Date) {
  return manilaDay.format(typeof iso === 'string' ? new Date(iso) : iso);
}

/** "Graduate Student", or "Other: Alumni" when the registrant typed their own. */
export function affiliationLabel(r: Pick<Registration, 'affiliation' | 'affiliationOther'>) {
  if (r.affiliation === 'Other' && r.affiliationOther) return `Other: ${r.affiliationOther}`;
  return r.affiliation;
}

export function topicsLabel(r: Pick<Registration, 'topics' | 'topicsOther'>) {
  return r.topics.map((t) => (t === 'Other' && r.topicsOther ? `Other: ${r.topicsOther}` : t));
}

export function filtersFromParams(p: URLSearchParams): Filters {
  const range = p.get('range') as RangeKey | null;
  const question = p.get('question');
  const attended = p.get('attended');
  return {
    q: p.get('q') ?? '',
    sex: p.get('sex') ?? '',
    age: p.get('age') ?? '',
    affiliation: p.get('affiliation') ?? '',
    topic: p.get('topic') ?? '',
    question: question === 'yes' || question === 'no' ? question : '',
    attended: attended === 'yes' || attended === 'no' ? attended : '',
    range: range && range in RANGE_LABELS ? range : 'all',
  };
}

export function filtersToParams(f: Filters) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v && v !== 'all') p.set(k, v);
  return p;
}

export function describeFilters(f: Filters) {
  const parts: string[] = [];
  if (f.range !== 'all') parts.push(RANGE_LABELS[f.range]);
  if (f.sex) parts.push(`Sex: ${f.sex}`);
  if (f.age) parts.push(`Age group: ${f.age}`);
  if (f.affiliation) parts.push(f.affiliation);
  if (f.topic) parts.push(`Interested in “${f.topic}”`);
  if (f.question) parts.push(f.question === 'yes' ? 'With a question for the speaker' : 'Without a question');
  if (f.attended) parts.push(f.attended === 'yes' ? 'Checked in' : 'Not checked in');
  if (f.q) parts.push(`Search: "${f.q}"`);
  return parts.length ? parts.join(' · ') : 'All registrations';
}

export function applyFilters(rows: Registration[], f: Filters, now = new Date()): Registration[] {
  const q = f.q.trim().toLowerCase();
  let since = '';
  if (f.range !== 'all') {
    const days = f.range === 'today' ? 0 : f.range === '7d' ? 6 : 29;
    since = dayKey(new Date(now.getTime() - days * 86_400_000));
  }
  return rows.filter((r) => {
    if (f.sex && r.sex !== f.sex) return false;
    if (f.age && r.ageGroup !== f.age) return false;
    if (f.affiliation && r.affiliation !== f.affiliation) return false;
    if (f.topic && !r.topics.includes(f.topic)) return false;
    if (f.question === 'yes' && !r.question) return false;
    if (f.question === 'no' && r.question) return false;
    if (f.attended === 'yes' && !r.attended) return false;
    if (f.attended === 'no' && r.attended) return false;
    if (since && dayKey(r.submittedAt) < since) return false;
    if (q) {
      const hay = [r.ref, r.name, r.email, r.organization, affiliationLabel(r), r.question, r.hopes, r.topicsOther]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export const duplicateKey = (r: Registration) => r.email.trim().toLowerCase();

/** E-mail addresses that registered more than once. */
export function findDuplicates(rows: Registration[]) {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = duplicateKey(r);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, n]) => n > 1).map(([k]) => k));
}

/** Groups "UP Diliman", "up diliman" and "U.P. Diliman " together. */
const orgKey = (s: string) => s.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();

export interface Stats {
  total: number;
  organizations: number;
  students: number;
  questions: number;
  hopes: number;
  today: number;
  /** Checked in at the event. */
  attended: number;
  /** In the form's order (not sorted by count). */
  bySex: { label: string; count: number }[];
  /** Youngest to oldest, then "Prefer not to say". */
  byAge: { label: string; count: number }[];
  /** Registered before the sex and age questions were added, so they have no answer. */
  demographicsNotAsked: number;
  byAffiliation: { label: string; count: number }[];
  byTopic: { topic: string; count: number }[];
  /** Registrants who picked at least one topic. */
  topicResponders: number;
  byOrganization: { label: string; count: number }[];
  daily: { day: string; count: number }[];
  duplicates: number;
}

export function computeStats(rows: Registration[], now = new Date()): Stats {
  const orgs = new Map<string, { labels: Map<string, number>; count: number }>();
  for (const r of rows) {
    if (!r.organization) continue;
    const k = orgKey(r.organization);
    const o = orgs.get(k) ?? { labels: new Map(), count: 0 };
    o.count += 1;
    o.labels.set(r.organization, (o.labels.get(r.organization) ?? 0) + 1);
    orgs.set(k, o);
  }
  const byOrganization = [...orgs.values()]
    .map((o) => ({ label: [...o.labels].sort((a, b) => b[1] - a[1])[0][0], count: o.count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const dayMap = new Map<string, number>();
  for (const r of rows) dayMap.set(dayKey(r.submittedAt), (dayMap.get(dayKey(r.submittedAt)) ?? 0) + 1);
  const days = [...dayMap.keys()].sort();
  const daily: Stats['daily'] = [];
  if (days.length) {
    // Fill gaps so quiet days show as zero rather than disappearing.
    for (let d = new Date(`${days[0]}T00:00:00+08:00`); dayKey(d) <= days[days.length - 1]; d = new Date(d.getTime() + 86_400_000)) {
      daily.push({ day: dayKey(d), count: dayMap.get(dayKey(d)) ?? 0 });
    }
  }

  const known = new Set<string>(AFFILIATIONS);
  const unknownAffiliations = rows.filter((r) => r.affiliation && !known.has(r.affiliation)).length;
  const byAffiliation = AFFILIATIONS.map((a) => ({ label: a as string, count: rows.filter((r) => r.affiliation === a).length }));
  if (unknownAffiliations) {
    const other = byAffiliation.find((a) => a.label === 'Other');
    if (other) other.count += unknownAffiliations;
  }

  const dupKeys = findDuplicates(rows);
  const todayKey = dayKey(now);

  return {
    total: rows.length,
    organizations: orgs.size,
    students: rows.filter((r) => STUDENT_AFFILIATIONS.includes(r.affiliation)).length,
    questions: rows.filter((r) => r.question).length,
    hopes: rows.filter((r) => r.hopes).length,
    today: rows.filter((r) => dayKey(r.submittedAt) === todayKey).length,
    attended: rows.filter((r) => r.attended).length,
    bySex: SEXES.map((s) => ({ label: s as string, count: rows.filter((r) => r.sex === s).length })),
    byAge: AGE_GROUPS.map((a) => ({ label: a as string, count: rows.filter((r) => r.ageGroup === a).length })),
    demographicsNotAsked: rows.filter((r) => !r.sex && !r.ageGroup).length,
    byAffiliation: byAffiliation.sort((a, b) => b.count - a.count || AFFILIATIONS.indexOf(a.label as never) - AFFILIATIONS.indexOf(b.label as never)),
    byTopic: TOPICS.map((t) => ({ topic: t as string, count: rows.filter((r) => r.topics.includes(t)).length })).sort(
      (a, b) => b.count - a.count,
    ),
    topicResponders: rows.filter((r) => r.topics.length > 0).length,
    byOrganization,
    daily,
    duplicates: rows.filter((r) => dupKeys.has(duplicateKey(r))).length,
  };
}

const longDate = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export const formatDateTime = (iso: string) => (iso ? longDate.format(new Date(iso)) : '');
