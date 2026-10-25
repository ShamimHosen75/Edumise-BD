// Letters and digits that cannot be mistaken for each other when read aloud or copied
// from a screen (no 0/O, 1/l/I).
const LETTERS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";

function pick(alphabet: string, random: Uint32Array, i: number): string {
  return alphabet[random[i]! % alphabet.length]!;
}

/**
 * A one-time password for a new login: 12 characters, always with letters and digits
 * (the password rule). The person must change it at first sign-in.
 */
export function tempPassword(length = 12): string {
  const random = new Uint32Array(length);
  crypto.getRandomValues(random);
  const all = LETTERS + DIGITS;
  const chars = Array.from({ length }, (_, i) => pick(all, random, i));
  // Guarantee at least one letter and one digit.
  chars[0] = pick(LETTERS, random, 0);
  chars[length - 1] = pick(DIGITS, random, length - 1);
  return chars.join("");
}
