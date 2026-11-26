// Names in one style, however they were typed: "JUAN DELA CRUZ" and "juan dela cruz" both become
// "Juan Dela Cruz". Used when a registration or feedback form is saved (and was run once over the
// registrations that existed before).

/** Generational suffixes stay in capitals: "Juan Cruz III". */
const ROMAN = /^(II|III|IV|VI|VII|VIII|IX)$/i;
const VOWEL = /[AEIOUYÀ-Ý]/i;

const capitalize = (s: string) => s.toLowerCase().replace(/\p{L}/u, (c) => c.toUpperCase());

/** One piece of a name: the letters between spaces, hyphens, apostrophes and periods. */
function piece(p: string, mixedName: boolean): string {
  const letters = p.replace(/[^\p{L}]/gu, '');
  if (!letters) return p;
  if (ROMAN.test(letters)) return p.toUpperCase();
  const upper = letters === letters.toUpperCase();
  const lower = letters === letters.toLowerCase();
  // Already capitalized with capitals inside, e.g. "McDonald", "DeLeon": kept as typed.
  if (!upper && !lower && letters[0] === letters[0].toUpperCase()) return p;
  // Initials used as a name ("JM Junio") when the rest of the name was typed normally.
  if (upper && mixedName && letters.length >= 2 && letters.length <= 3 && !VOWEL.test(letters)) return p;
  return capitalize(p);
}

/** "JUAN DELA CRUZ" → "Juan Dela Cruz"; "mary-ann o'brien" → "Mary-Ann O'Brien"; "Ma. Luisa" stays. */
export function properName(raw: string): string {
  const name = raw.replace(/\s+/g, ' ').trim();
  const mixedName = name !== name.toUpperCase() && name !== name.toLowerCase();
  return name
    .split(' ')
    .map((word) =>
      word
        .split(/([-'’.])/)
        .map((p) => (/^[-'’.]$/.test(p) ? p : piece(p, mixedName)))
        .join(''),
    )
    .join(' ');
}
