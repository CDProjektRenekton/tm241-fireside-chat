// Follow-up questions that open under "Current Affiliation", one set per affiliation, to narrow
// down the demographic picture (which degree level, which government sector, how many years…).
// A registrant answers only their own affiliation's set, so affiliations that ask the same thing
// share one answer (and one Airtable column): Program, Designation and Years.
import type { Affiliation } from './config';

export const YEAR_LEVELS = ['1st year', '2nd year', '3rd year', '4th year', '5th year or higher'] as const;
export const DEGREE_LEVELS = ["Master's", 'Doctorate', 'Graduate diploma or certificate'] as const;
export const WORK_STATUSES = [
  'Full-time student',
  'Working in government',
  'Working in the private sector',
  'Working in academe',
  'Other',
] as const;
export const INSTITUTION_TYPES = [
  'University',
  'Government R&D institute',
  'Private company',
  'Nonprofit organization',
  'International organization',
  'Other',
] as const;
export const GOV_LEVELS = ['National government agency (NGA)', 'GOCC', 'Local government unit (LGU)', 'Other'] as const;
export const GOV_SECTORS = [
  'S&T and R&D',
  'Defense and security',
  'ICT',
  'Energy and utilities',
  'Infrastructure and public works',
  'Trade, industry and economic planning',
  'Education',
  'Health',
  'Other',
] as const;
export const POSITION_LEVELS = ['Rank-and-file', 'Technical or professional', 'Supervisory', 'Managerial or executive'] as const;
export const INDUSTRIES = [
  'Manufacturing',
  'IT and software',
  'Telecommunications',
  'Energy and utilities',
  'Aerospace and defense',
  'Engineering and construction',
  'Consulting',
  'Finance',
  'Other',
] as const;

/** Every follow-up answer, in column order. The "…Other" keys hold the "Please specify" text. */
export const DETAIL_KEYS = [
  'program',
  'yearLevel',
  'degreeLevel',
  'workStatus',
  'workStatusOther',
  'department',
  'office',
  'institutionType',
  'institutionTypeOther',
  'govLevel',
  'govLevelOther',
  'govSector',
  'govSectorOther',
  'positionLevel',
  'industry',
  'industryOther',
  'designation',
  'years',
] as const;
export type DetailKey = (typeof DETAIL_KEYS)[number];
export type RoleDetails = Record<DetailKey, string>;

export const EMPTY_DETAILS = Object.fromEntries(DETAIL_KEYS.map((k) => [k, ''])) as RoleDetails;

/** Where the typed answer goes when "Other" is picked. */
export const OTHER_KEYS = {
  workStatus: 'workStatusOther',
  institutionType: 'institutionTypeOther',
  govLevel: 'govLevelOther',
  govSector: 'govSectorOther',
  industry: 'industryOther',
} as const satisfies Partial<Record<DetailKey, DetailKey>>;

export const isOtherKey = (k: DetailKey) => (Object.values(OTHER_KEYS) as DetailKey[]).includes(k);

/**
 * text: one-line text box · pills: radio pills · segmented: pills in one equal-width row ·
 * select: dropdown · years: number box with − / + buttons
 */
export type DetailKind = 'text' | 'pills' | 'segmented' | 'select' | 'years';

export interface DetailQuestion {
  key: DetailKey;
  label: string;
  kind: DetailKind;
  options?: readonly string[];
  /** Set when the options include "Other": the key that holds "Please specify". */
  otherKey?: DetailKey;
  placeholder?: string;
  hint?: string;
}

export const YEARS_MAX = 60;

const years = (label: string): DetailQuestion => ({
  key: 'years',
  label,
  kind: 'years',
  hint: 'Enter 0 if less than a year.',
});

export const ROLE_QUESTIONS: Record<Affiliation, readonly DetailQuestion[]> = {
  'Undergraduate Student': [
    { key: 'program', label: 'Degree program', kind: 'text', placeholder: 'e.g. BS Civil Engineering' },
    { key: 'yearLevel', label: 'Year level', kind: 'pills', options: YEAR_LEVELS },
  ],
  'Graduate Student': [
    { key: 'degreeLevel', label: 'Degree level', kind: 'segmented', options: DEGREE_LEVELS },
    { key: 'program', label: 'Program', kind: 'text', placeholder: 'e.g. Technology Management' },
    { key: 'workStatus', label: 'Are you also working?', kind: 'pills', options: WORK_STATUSES, otherKey: OTHER_KEYS.workStatus },
  ],
  'Faculty Member': [
    { key: 'department', label: 'College or department', kind: 'text', placeholder: 'e.g. College of Engineering' },
    years('Years of teaching'),
  ],
  Researcher: [
    {
      key: 'institutionType',
      label: 'Type of institution',
      kind: 'pills',
      options: INSTITUTION_TYPES,
      otherKey: OTHER_KEYS.institutionType,
    },
    years('Years in research'),
  ],
  'University Staff': [
    { key: 'office', label: 'Office or unit', kind: 'text', placeholder: 'e.g. Technology Transfer Office' },
    { key: 'designation', label: 'Designation', kind: 'text', placeholder: 'e.g. Administrative Officer' },
    years('Years in service'),
  ],
  'Government Employee': [
    { key: 'govLevel', label: 'Level of government', kind: 'pills', options: GOV_LEVELS, otherKey: OTHER_KEYS.govLevel },
    { key: 'govSector', label: 'Sector', kind: 'select', options: GOV_SECTORS, otherKey: OTHER_KEYS.govSector },
    { key: 'positionLevel', label: 'Position level', kind: 'pills', options: POSITION_LEVELS },
    { key: 'designation', label: 'Designation', kind: 'text', placeholder: 'e.g. Information Technology Officer III' },
    years('Years in government service'),
  ],
  'Industry Professional': [
    { key: 'industry', label: 'Industry', kind: 'select', options: INDUSTRIES, otherKey: OTHER_KEYS.industry },
    { key: 'designation', label: 'Designation', kind: 'text', placeholder: 'e.g. Engineer' },
    years('Years of work experience'),
  ],
  // "Other" already has its own "Please specify" box under the affiliation cards.
  Other: [],
};

/** The follow-up questions for this affiliation (none for "Other" or an unknown value). */
export const questionsFor = (affiliation: string): readonly DetailQuestion[] =>
  ROLE_QUESTIONS[affiliation as Affiliation] ?? [];

/** "Working in government", "Other: Freelance" or "7 years" — for tables and exports. */
export function detailText(d: Partial<RoleDetails>, q: DetailQuestion): string {
  const v = d[q.key] ?? '';
  if (!v) return '';
  if (q.otherKey && v === 'Other' && d[q.otherKey]) return `Other: ${d[q.otherKey]}`;
  if (q.kind === 'years') return `${v} ${v === '1' ? 'year' : 'years'}`;
  return v;
}

/** Ranges used to chart years of experience. */
export const YEAR_RANGES = ['Under 2 years', '2–5 years', '6–10 years', '11–20 years', 'Over 20 years'] as const;

export function yearRange(n: number): (typeof YEAR_RANGES)[number] {
  if (n < 2) return YEAR_RANGES[0];
  if (n <= 5) return YEAR_RANGES[1];
  if (n <= 10) return YEAR_RANGES[2];
  if (n <= 20) return YEAR_RANGES[3];
  return YEAR_RANGES[4];
}
