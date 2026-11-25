import { AFFILIATIONS, AGE_GROUPS, ATTENDANCE_MODES, SEXES, TOPICS } from './config';
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
import { AUDIENCES, UPDATE_STATUSES } from './updates';

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
  attendanceMode: 'Attendance Mode',
  topics: 'Topics of Interest',
  topicsOther: 'Topics of Interest (Other)',
  question: 'Question for the Speaker',
  hopes: 'Hopes to Learn',
  consent: 'Data Privacy Consent',
  attended: 'Attended',
  checkedInAt: 'Checked In At',
  emailLog: 'Email Log',
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
    name: F.attendanceMode,
    type: 'singleSelect',
    description:
      'How will you join? Onsite registrants get a QR code for the door; Online registrants get the Zoom link. Empty = registered before the question was added (onsite).',
    options: choices(ATTENDANCE_MODES, ['tealLight2', 'purpleLight2']),
  },
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
  {
    name: F.emailLog,
    type: 'multilineText',
    description:
      'Email updates this registration has had, one per line (e.g. "UPD-7KQ2MX Sent"). Kept by the Email updates page so nobody gets an update twice — please do not edit.',
  },
];

// ---------------------------------------------------------------- the Email Updates table

export const UPDATES_TABLE = 'Email Updates';

/** Column names of the Email Updates table (one row per update organizers write). */
export const U = {
  code: 'Update ID',
  status: 'Status',
  subject: 'Subject',
  headline: 'Headline',
  message: 'Message',
  before: 'Was',
  now: 'Now',
  buttonLabel: 'Button Words',
  buttonUrl: 'Button Link',
  audience: 'Audience',
  includePass: 'Include Boarding Pass',
  attachInvite: 'Attach Calendar Invite',
  createdAt: 'Created At',
  sentAt: 'Sent At',
  people: 'People Emailed',
} as const;

const MANILA_TIME = { dateFormat: { name: 'local' }, timeFormat: { name: '12hour' }, timeZone: 'Asia/Manila' };
const CHECK = { icon: 'check', color: 'greenBright' };

/** Email Updates schema, in column order. The first entry is the primary field. */
export const UPDATE_SPECS: FieldSpec[] = [
  { name: U.code, type: 'singleLineText', description: 'Made by the Email updates page; also written in each registration\'s Email Log.' },
  {
    name: U.status,
    type: 'singleSelect',
    description: 'Draft = can still be edited. Sending = started. Sent = everyone in the audience has had it.',
    options: choices(UPDATE_STATUSES, ['grayLight2', 'yellowLight2', 'greenLight2', 'redLight2']),
  },
  text(U.subject, 'Subject line.'),
  text(U.headline, 'Big heading in the email.'),
  { name: U.message, type: 'multilineText', description: 'The message, as written.' },
  text(U.before, 'Optional: the old value in the Was/Now box.'),
  text(U.now, 'Optional: the new value in the Was/Now box.'),
  text(U.buttonLabel, 'Optional: words on the button.'),
  { name: U.buttonUrl, type: 'url', description: 'Optional: the link the button opens.' },
  {
    name: U.audience,
    type: 'singleSelect',
    description: 'Who it goes to (one email per address).',
    options: choices(AUDIENCES, ['blueLight2', 'tealLight2', 'purpleLight2', 'greenLight2']),
  },
  { name: U.includePass, type: 'checkbox', options: CHECK },
  { name: U.attachInvite, type: 'checkbox', options: CHECK },
  { name: U.createdAt, type: 'dateTime', options: MANILA_TIME },
  { name: U.sentAt, type: 'dateTime', description: 'When the first email of this update went out.', options: MANILA_TIME },
  { name: U.people, type: 'number', description: 'People emailed so far.', options: { precision: 0 } },
];
