import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AhoCorasick = require("ahocorasick") as new (keywords: string[]) => {
  search(input: string): Array<[number, string[]]>;
};

const DEFAULT_SENSITIVE_WORDS = [
  "傻逼",
  "傻x",
  "妈的",
  "操你",
  "去死",
  "死全家",
  "nmsl",
  "sb",
  "fuck",
  "shit",
  "bitch",
  "slut",
] as const;

function parseConfiguredWords(): string[] {
  const configured = process.env.MESSAGE_SENSITIVE_WORDS;
  if (!configured) {
    return [];
  }

  return configured
    .split(/[\n,]/g)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

const sensitiveWords = Array.from(
  new Set(
    [...DEFAULT_SENSITIVE_WORDS, ...parseConfiguredWords()]
      .map(normalizeWord)
      .filter((item) => item.length > 0),
  ),
);

const matcher = new AhoCorasick(sensitiveWords);

export function findSensitiveWords(input: string): string[] {
  const normalized = input.trim().toLowerCase();
  if (normalized.length === 0 || sensitiveWords.length === 0) {
    return [];
  }

  const matches = matcher.search(normalized);
  const found = new Set<string>();

  for (const [, words] of matches) {
    for (const word of words) {
      found.add(word);
    }
  }

  return Array.from(found);
}
