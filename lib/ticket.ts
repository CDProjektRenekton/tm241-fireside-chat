// Reference numbers and ticket codes, shared by the form, the boarding pass and the check-in desk.
import { EVENT } from './config';

/** Characters used in reference numbers — no 0/O or 1/I, so a code read aloud or typed by hand can't be mixed up. */
export const REF_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const REF_CODE_LENGTH = 6;

const PREFIX = EVENT.refPrefix; // "TM241-FC"
const prefixPattern = PREFIX.split('-').join('-?'); // "TM241-?FC"
// A reference number anywhere in a longer text (e.g. a link or a QR code with extra words around it).
const EMBEDDED = new RegExp(`${prefixPattern}-?([A-Z0-9]{${REF_CODE_LENGTH}})(?![A-Z0-9])`);
// What a person types at the desk: the whole number, or just the last part ("7KQ2MX", "FC-7KQ2MX").
const TYPED = new RegExp(`^(?:${PREFIX.split('-')[0]})?-?(?:${PREFIX.split('-')[1]})?-?([A-Z0-9]{${REF_CODE_LENGTH}})$`);

/** What the QR code on the boarding pass contains: just the reference number. */
export const ticketPayload = (ref: string) => ref;

/**
 * Turns whatever a scanner read or a person typed into a reference number like "TM241-FC-7KQ2MX".
 * Accepts lower case, spaces, missing dashes and the 6-character code on its own.
 * Returns null when the text is not a Fireside Chat ticket.
 */
export function parseRef(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s_]+/g, '');
  const m = s.match(EMBEDDED) ?? s.match(TYPED);
  return m ? `${PREFIX}-${m[1]}` : null;
}

/** "juan.delacruz@up.edu.ph" → "ju•••@up.edu.ph" — enough for the desk to tell two people apart. */
export function maskEmail(email: string) {
  const [user, domain] = email.split('@');
  if (!domain) return '';
  return `${user.slice(0, Math.min(2, user.length))}•••@${domain}`;
}
