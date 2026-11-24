export interface CsvParseResult {
  validEmails: string[];
  invalidEmails: string[];
  duplicateCount: number;
  totalDetected: number;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEADER_TOKENS = new Set(['email', 'emails', 'recipient', 'recipients', 'address', 'e-mail']);

export function parseEmailListContent(content: string): CsvParseResult {
  const rawTokens = content
    .split(/[\r\n,;|\t]+/)
    .map((token) => token.trim().replace(/^["']|["']$/g, '').toLowerCase())
    .filter(Boolean);

  const validSet = new Set<string>();
  const invalidEmails: string[] = [];
  let duplicateCount = 0;

  for (const token of rawTokens) {
    if (HEADER_TOKENS.has(token)) {
      continue;
    }
    if (EMAIL_REGEX.test(token)) {
      if (validSet.has(token)) {
        duplicateCount += 1;
      } else {
        validSet.add(token);
      }
    } else {
      invalidEmails.push(token);
    }
  }

  return {
    validEmails: Array.from(validSet),
    invalidEmails,
    duplicateCount,
    totalDetected: validSet.size + invalidEmails.length + duplicateCount,
  };
}

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim().toLowerCase());
}
