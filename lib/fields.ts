import { AFFILIATIONS, TOPICS } from './config';

/** Airtable column names. Renaming a column in Airtable requires renaming it here too. */
export const F = {
  ref: 'Reference No.',
  submittedAt: 'Submitted At',
  name: 'Name',
  email: 'Email',
  organization: 'University/Organization',
  affiliation: 'Current Affiliation',
  affiliationOther: 'Current Affiliation (Other)',
  topics: 'Topics of Interest',
  topicsOther: 'Topics of Interest (Other)',
  question: 'Question for the Speaker',
  hopes: 'Hopes to Learn',
  consent: 'Data Privacy Consent',
} as const;

export interface FieldSpec {
  name: string;
  type: string;
  description?: string;
  options?: Record<string, unknown>;
}

const choices = (names: readonly string[], colors: string[] = []) => ({
  choices: names.map((name, i) => (colors[i] ? { name, color: colors[i] } : { name })),
});

const AFFILIATION_COLORS = [
  'cyanLight2',
  'blueLight2',
  'purpleLight2',
  'tealLight2',
  'grayLight2',
  'orangeLight2',
  'pinkLight2',
  'yellowLight2',
];
const TOPIC_COLORS = [
  'blueLight2',
  'cyanLight2',
  'purpleLight2',
  'tealLight2',
  'greenLight2',
  'redLight2',
  'orangeLight2',
  'grayLight2',
];

/** Table schema, in column order. The first entry is the primary field. */
export const FIELD_SPECS: FieldSpec[] = [
  { name: F.ref, type: 'singleLineText', description: 'Auto-generated reference number of the registration.' },
  {
    name: F.submittedAt,
    type: 'dateTime',
    description: 'Date and time the form was submitted (Philippine time).',
    options: { dateFormat: { name: 'local' }, timeFormat: { name: '12hour' }, timeZone: 'Asia/Manila' },
  },
  { name: F.name, type: 'singleLineText', description: 'Full name of the registrant.' },
  { name: F.email, type: 'email' },
  { name: F.organization, type: 'singleLineText', description: 'University or organization.' },
  {
    name: F.affiliation,
    type: 'singleSelect',
    description: 'Current affiliation (mark only one).',
    options: choices(AFFILIATIONS, AFFILIATION_COLORS),
  },
  { name: F.affiliationOther, type: 'singleLineText', description: 'Filled in when the affiliation is "Other".' },
  {
    name: F.topics,
    type: 'multipleSelects',
    description: 'Which topics interest you most? (check all that apply)',
    options: choices(TOPICS, TOPIC_COLORS),
  },
  { name: F.topicsOther, type: 'singleLineText', description: 'Filled in when "Other" is one of the topics.' },
  { name: F.question, type: 'multilineText', description: 'Do you have a question for our guest speaker?' },
  { name: F.hopes, type: 'multilineText', description: 'What do you hope to learn from this Fireside Chat?' },
  {
    name: F.consent,
    type: 'singleSelect',
    description:
      'I voluntarily consent to the collection and processing of my information for event registration, attendance monitoring, and event coordination.',
    options: choices(['Yes', 'No'], ['greenLight2', 'redLight2']),
  },
];
