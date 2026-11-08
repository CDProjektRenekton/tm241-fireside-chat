import type { Affiliation } from './config';

/** What the browser sends to /api/submit. */
export interface RegistrationInput {
  name: string;
  email: string;
  organization: string;
  affiliation: Affiliation | '';
  affiliationOther: string;
  topics: string[];
  topicsOther: string;
  question: string;
  hopes: string;
  consent: 'Yes' | 'No' | '';
  /** Honeypot — real people never fill this in. */
  website?: string;
}

/** A registration as read back from Airtable for the dashboard. */
export interface Registration {
  id: string;
  ref: string;
  submittedAt: string;
  name: string;
  email: string;
  organization: string;
  /** One of AFFILIATIONS (or a value someone typed into Airtable directly). */
  affiliation: string;
  affiliationOther: string;
  topics: string[];
  topicsOther: string;
  question: string;
  hopes: string;
  consent: string;
}

export interface SchemaStatus {
  ok: boolean;
  tableName?: string;
  missing: string[];
  error?: string;
}

export type FieldErrors = Record<string, string>;
