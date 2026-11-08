// Event details and answer choices, taken from the TM241 Event Registration Google Form
// and the "Leading from the Start" publication materials.

export const EVENT = {
  series: 'TM241 Fireside Chat',
  title: 'Leading from the Start',
  subtitle: 'Lessons in Building Strategic Technology Capabilities for National Development',
  weekday: 'Friday',
  dateEn: 'November 27, 2026',
  dateShort: '27 Nov 2026',
  time: '1:30 PM – 3:30 PM',
  /** Philippine time (UTC+8). Used by the countdown and the calendar invite. */
  startsAt: '2026-11-27T13:30:00+08:00',
  endsAt: '2026-11-27T15:30:00+08:00',
  venue: 'School of Urban and Regional Planning',
  venueCampus: 'University of the Philippines Diliman, Quezon City',
  organizer: 'TM241 Class · UP Diliman Technology Management Center',
  tagline: 'Leading Innovation. Shaping the Nation’s Future.',
  blurb:
    'Join us for an engaging conversation about leadership, institutional development, technology acquisition, and the future of Philippine innovation.',
  /** Reference numbers look like TM241-FC-7KQ2MX. */
  refPrefix: 'TM241-FC',
} as const;

export const venueFull = () => `${EVENT.venue}, ${EVENT.venueCampus}`;

/** "Current Affiliation" — mark only one. */
export const AFFILIATIONS = [
  'Undergraduate Student',
  'Graduate Student',
  'Faculty Member',
  'Researcher',
  'University Staff',
  'Government Employee',
  'Industry Professional',
  'Other',
] as const;
export type Affiliation = (typeof AFFILIATIONS)[number];

/** "Which topics interest you most?" — check all that apply. */
export const TOPICS = [
  'Building and leading technology institutions',
  'Technology acquisition and assimilation',
  'Philippine space technology and innovation',
  'University research and industry collaboration',
  'Developing Filipino researchers and technical talent',
  'Technological sovereignty and national development',
  'Career opportunities in research and development',
  'Other',
] as const;
export type Topic = (typeof TOPICS)[number];

/** Short labels for charts and tables. */
export const TOPIC_SHORT: Record<Topic, string> = {
  'Building and leading technology institutions': 'Leading tech institutions',
  'Technology acquisition and assimilation': 'Tech acquisition & assimilation',
  'Philippine space technology and innovation': 'PH space tech & innovation',
  'University research and industry collaboration': 'University–industry collaboration',
  'Developing Filipino researchers and technical talent': 'Developing Filipino talent',
  'Technological sovereignty and national development': 'Tech sovereignty & development',
  'Career opportunities in research and development': 'R&D careers',
  Other: 'Other',
};

export const STUDENT_AFFILIATIONS: readonly string[] = ['Undergraduate Student', 'Graduate Student'];
