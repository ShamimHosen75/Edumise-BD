// Amounts in words for receipts (pure, unit tested), in the South Asian system used in
// Bangladesh: thousand, lakh (100,000), crore (10,000,000).

const EN_ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const EN_TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

// 0–99 each have their own word in Bangla.
const BN_0_99 = (
  "শূন্য এক দুই তিন চার পাঁচ ছয় সাত আট নয় দশ এগারো বারো তেরো চৌদ্দ পনেরো ষোলো সতেরো আঠারো উনিশ " +
  "বিশ একুশ বাইশ তেইশ চব্বিশ পঁচিশ ছাব্বিশ সাতাশ আটাশ ঊনত্রিশ ত্রিশ একত্রিশ বত্রিশ তেত্রিশ চৌত্রিশ " +
  "পঁয়ত্রিশ ছত্রিশ সাঁইত্রিশ আটত্রিশ ঊনচল্লিশ চল্লিশ একচল্লিশ বিয়াল্লিশ তেতাল্লিশ চুয়াল্লিশ পঁয়তাল্লিশ " +
  "ছেচল্লিশ সাতচল্লিশ আটচল্লিশ ঊনপঞ্চাশ পঞ্চাশ একান্ন বাহান্ন তিপ্পান্ন চুয়ান্ন পঞ্চান্ন ছাপ্পান্ন সাতান্ন " +
  "আটান্ন ঊনষাট ষাট একষট্টি বাষট্টি তেষট্টি চৌষট্টি পঁয়ষট্টি ছেষট্টি সাতষট্টি আটষট্টি ঊনসত্তর সত্তর " +
  "একাত্তর বাহাত্তর তিয়াত্তর চুয়াত্তর পঁচাত্তর ছিয়াত্তর সাতাত্তর আটাত্তর ঊনআশি আশি একাশি বিরাশি তিরাশি " +
  "চুরাশি পঁচাশি ছিয়াশি সাতাশি আটাশি ঊননব্বই নব্বই একানব্বই বিরানব্বই তিরানব্বই চুরানব্বই পঁচানব্বই " +
  "ছিয়ানব্বই সাতানব্বই আটানব্বই নিরানব্বই"
).split(" ");

type Units = { crore: string; lakh: string; thousand: string; hundred: string };

/** Splits a whole number into crore, lakh, thousand, hundred and the rest (0–99). */
function parts(n: number) {
  return {
    crore: Math.floor(n / 10_000_000),
    lakh: Math.floor(n / 100_000) % 100,
    thousand: Math.floor(n / 1000) % 100,
    hundred: Math.floor(n / 100) % 10,
    rest: n % 100,
  };
}

function inWords(
  n: number,
  below100: (n: number) => string,
  u: Units,
  zero: string,
): string {
  if (n === 0) return zero;
  const p = parts(n);
  const out: string[] = [];
  // Crores can go above 99 (e.g. 150 crore): say that number in full.
  if (p.crore) out.push(`${inWords(p.crore, below100, u, zero)} ${u.crore}`);
  if (p.lakh) out.push(`${below100(p.lakh)} ${u.lakh}`);
  if (p.thousand) out.push(`${below100(p.thousand)} ${u.thousand}`);
  if (p.hundred) out.push(`${below100(p.hundred)} ${u.hundred}`);
  if (p.rest) out.push(below100(p.rest));
  return out.join(" ");
}

const enBelow100 = (n: number) =>
  n < 20
    ? EN_ONES[n]!
    : `${EN_TENS[Math.floor(n / 10)]}${n % 10 ? `-${EN_ONES[n % 10]}` : ""}`;

function check(poisha: number) {
  if (!Number.isSafeInteger(poisha) || poisha < 0)
    throw new Error("Money must be whole poisha");
}

/** 125050 -> "One thousand two hundred fifty taka and fifty poisha only". */
export function amountInWordsEn(poisha: number): string {
  check(poisha);
  const taka = Math.floor(poisha / 100);
  const p = poisha % 100;
  const units = {
    crore: "crore",
    lakh: "lakh",
    thousand: "thousand",
    hundred: "hundred",
  };
  const text = `${inWords(taka, enBelow100, units, "zero")} taka${p ? ` and ${enBelow100(p)} poisha` : ""} only`;
  return text[0]!.toUpperCase() + text.slice(1);
}

/** 125050 -> "এক হাজার দুই শত পঞ্চাশ টাকা পঞ্চাশ পয়সা মাত্র". */
export function amountInWordsBn(poisha: number): string {
  check(poisha);
  const taka = Math.floor(poisha / 100);
  const p = poisha % 100;
  const units = {
    crore: "কোটি",
    lakh: "লক্ষ",
    thousand: "হাজার",
    hundred: "শত",
  };
  const below = (n: number) => BN_0_99[n]!;
  return `${inWords(taka, below, units, "শূন্য")} টাকা${p ? ` ${below(p)} পয়সা` : ""} মাত্র`;
}
