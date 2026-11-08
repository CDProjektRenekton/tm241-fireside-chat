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
  /** Ticked by the check-in desk when the ticket is scanned at the event. */
  attended: boolean;
  checkedInAt: string;
}

/** What the check-in desk sees about a registrant — no email, questions or other answers. */
export interface DeskRecord {
  id: string;
  ref: string;
  name: string;
  organization: string;
  affiliation: string;
  attended: boolean;
  checkedInAt: string;
  /** Masked, only in name-search results, to tell two people with the same name apart. */
  email?: string;
}

export type CheckInResult =
  /** Ticket is genuine and was just marked "Attended". */
  | 'checked-in'
  /** Ticket is genuine but was already scanned earlier. */
  | 'already'
  /** Verify-only mode: ticket is genuine and not yet checked in. */
  | 'valid'
  /** A check-in was undone. */
  | 'undone'
  /** No registration has this reference number. */
  | 'not-found'
  /** The code isn't a Fireside Chat reference number at all. */
  | 'invalid';

export interface SchemaStatus {
  ok: boolean;
  tableName?: string;
  missing: string[];
  error?: string;
}

export type FieldErrors = Record<string, string>;
