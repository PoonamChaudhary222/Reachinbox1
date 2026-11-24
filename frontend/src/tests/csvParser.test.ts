import { describe, expect, it } from 'vitest';
import { parseEmailListContent } from '../utils/csvParser';

describe('CSV / TXT Email Parser', () => {
  it('extracts valid emails, deduplicates, skips headers, and counts invalid addresses', () => {
    const input = [
      'email',
      'John.Smith@company.com',
      'sarah@startup.io, john.smith@company.com',
      'not-an-email',
      'alex@domain.org; bad@@domain.com',
    ].join('\n');

    const result = parseEmailListContent(input);

    expect(result.validEmails).toEqual([
      'john.smith@company.com',
      'sarah@startup.io',
      'alex@domain.org',
    ]);
    expect(result.invalidEmails).toEqual(['not-an-email', 'bad@@domain.com']);
    expect(result.duplicateCount).toBe(1);
    expect(result.totalDetected).toBe(6);
  });
});
