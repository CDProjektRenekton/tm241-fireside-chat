import { AFFILIATIONS, AGE_GROUPS, SEXES, TOPICS } from './config';
import {
  DEGREE_LEVELS,
  type DetailKey,
  GOV_LEVELS,
  GOV_SECTORS,
  INDUSTRIES,
  INSTITUTION_TYPES,
  POSITION_LEVELS,
  WORK_STATUSES,
  YEAR_LEVELS,
} from './roles';

/** Airtable column names. Renaming a column in Airtable requires renaming it here too. */
export const F = {
  ref: 'Reference No.',
  submittedAt: 'Submitted At',
  name: 'Name',
  sex: 'Sex',
  ageGroup: 'Age Group',
  email: 'Email',
  organization: 'University/Organization',
  affiliation: 'Current Affiliation',
  affiliationOther: 'Current Affiliation (Other)',
  topics: 'Topics of Interest',
  topicsOther: 'Topics of Interest (Other)',
  question: 'Question for the Speaker',
  hopes: 'Hopes to Learn',
  consent: 'Data Privacy Consent',
  attended: 'Attended',
  checkedInAt: 'Checked In At',
} as const;

/** Columns for the follow-up questions under "Current Affiliation" (see lib/roles.ts). */
export const F_DETAIL: Record<DetailKey, string> = {
  program: 'Program',
  yearLevel: 'Year Level',
  degreeLevel: 'Degree Level',
  workStatus: 'Also Working',
  workStatusOther: 'Also Working (Other)',
  department: 'College or Department',
  office: 'Office or Unit',
  institutionType: 'Institution Type',
  institutionTypeOther: 'Institution Type (Other)',
  govLevel: 'Level of Government',
  govLevelOther: 'Level of Government (Other)',
  govSector: 'Government Sector',
  govSectorOther: 'Government Sector (Other)',
  positionLevel: 'Position Level',
  industry: 'Industry',
  industryOther: 'Industry (Other)',
  designation: 'Designation',
  years: 'Years of Experience',
};

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
const PALETTE = ['cyanLight2', 'blueLight2', 'purpleLight2', 'tealLight2', 'greenLight2', 'yellowLight2', 'orangeLight2', 'pinkLight2', 'grayLight2'];
/** Single select whose "Other" (always last) is gray. */
const select = (name: string, names: readonly string[], description: string): FieldSpec => ({
  name,
  type: 'singleSelect',
  description,
  options: choices(
    names,
    names.map((n, i) => (n === 'Other' ? 'grayLight2' : PALETTE[i % (PALETTE.length - 1)])),
  ),
});
const text = (name: string, description: string): FieldSpec => ({ name, type: 'singleLineText', description });

const DETAIL_SPECS: FieldSpec[] = [
  text(F_DETAIL.program, 'Undergraduate Student: degree program. Graduate Student: program.'),
  select(F_DETAIL.yearLevel, YEAR_LEVELS, 'Undergraduate Student: year level.'),
  select(F_DETAIL.degreeLevel, DEGREE_LEVELS, 'Graduate Student: degree level.'),
  select(F_DETAIL.workStatus, WORK_STATUSES, 'Graduate Student: are you also working?'),
  text(F_DETAIL.workStatusOther, 'Filled in when "Also Working" is "Other".'),
  text(F_DETAIL.department, 'Faculty Member: college or department.'),
  text(F_DETAIL.office, 'University Staff: office or unit.'),
  select(F_DETAIL.institutionType, INSTITUTION_TYPES, 'Researcher: type of institution.'),
  text(F_DETAIL.institutionTypeOther, 'Filled in when "Institution Type" is "Other".'),
  select(F_DETAIL.govLevel, GOV_LEVELS, 'Government Employee: level of government.'),
  text(F_DETAIL.govLevelOther, 'Filled in when "Level of Government" is "Other".'),
  select(F_DETAIL.govSector, GOV_SECTORS, 'Government Employee: sector.'),
  text(F_DETAIL.govSectorOther, 'Filled in when "Government Sector" is "Other".'),
  select(F_DETAIL.positionLevel, POSITION_LEVELS, 'Government Employee: position level.'),
  select(F_DETAIL.industry, INDUSTRIES, 'Industry Professional: industry.'),
  text(F_DETAIL.industryOther, 'Filled in when "Industry" is "Other".'),
  text(F_DETAIL.designation, 'University Staff, Government Employee and Industry Professional: designation.'),
  {
    name: F_DETAIL.years,
    type: 'number',
    description:
      'Whole years: of teaching (Faculty Member), in research (Researcher), in service (University Staff), in government service (Government Employee) or of work experience (Industry Professional).',
    options: { precision: 0 },
  },
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
  {
    name: F.sex,
    type: 'singleSelect',
    description: 'Sex. Reported only as group totals.',
    options: choices(SEXES, ['purpleLight2', 'tealLight2', 'grayLight2']),
  },
  {
    name: F.ageGroup,
    type: 'singleSelect',
    description: 'Age group. Reported only as group totals.',
    options: choices(AGE_GROUPS, ['yellowLight2', 'greenLight2', 'tealLight2', 'cyanLight2', 'blueLight2', 'purpleLight2', 'grayLight2']),
  },
  { name: F.email, type: 'email' },
  { name: F.organization, type: 'singleLineText', description: 'University or organization.' },
  {
    name: F.affiliation,
    type: 'singleSelect',
    description: 'Current affiliation (mark only one).',
    options: choices(AFFILIATIONS, AFFILIATION_COLORS),
  },
  { name: F.affiliationOther, type: 'singleLineText', description: 'Filled in when the affiliation is "Other".' },
  ...DETAIL_SPECS,
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
  {
    name: F.attended,
    type: 'checkbox',
    description: 'Ticked by the check-in desk (/checkin) when the registrant arrives at the event.',
    options: { icon: 'check', color: 'greenBright' },
  },
  {
    name: F.checkedInAt,
    type: 'dateTime',
    description: 'When the ticket was scanned at the check-in desk (Philippine time).',
    options: { dateFormat: { name: 'local' }, timeFormat: { name: '12hour' }, timeZone: 'Asia/Manila' },
  },
];
