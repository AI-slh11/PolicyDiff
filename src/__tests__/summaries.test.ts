import { describe, it, expect } from 'vitest';
import { validateSummaryNumbers, generateDeterministicSummary } from '@/lib/summaries/generator';
import { DiffResultItem } from '@/lib/diff/types';

describe('Step 5: Plain-English Summaries & Number Hallucination Guard', () => {
  it('generates a clear one-sentence summary explaining change and insured impact', () => {
    const item: DiffResultItem = {
      category: 'General Liability',
      canonicalKey: 'GL_EACH_OCCURRENCE_LIMIT',
      changeType: 'CHANGED',
      severity: 'CRITICAL',
      fieldPath: 'coverages.GL_EACH_OCCURRENCE.limitAmount',
      oldValue: '$2,000,000',
      newValue: '$1,000,000',
      oldCitation: null,
      newCitation: null,
      reviewStatus: 'PENDING',
    };

    const summary = generateDeterministicSummary(item);
    expect(summary).toContain('$2,000,000');
    expect(summary).toContain('$1,000,000');
    expect(summary).toContain('insured');
    // Ensure it is one sentence (single terminal period)
    const sentences = summary.split('.').filter((s) => s.trim().length > 0);
    expect(sentences.length).toBe(1);
  });

  it('approves summary when numbers match source values exactly', () => {
    const summary = 'General Liability limit was reduced from $2,000,000 to $1,000,000.';
    const result = validateSummaryNumbers(summary, {
      oldValue: '$2,000,000',
      newValue: '$1,000,000',
      citedText: 'Limit $2,000,000 reduced to $1,000,000',
    });

    expect(result.valid).toBe(true);
    expect(result.forbiddenNumbers).toHaveLength(0);
  });

  it('NON-NEGOTIABLE CHECK: rejects summary mentioning numbers absent from source', () => {
    // Summary hallucinated $500,000 which is nowhere in oldValue, newValue, or citedText!
    const hallucinatedSummary =
      'General Liability limit was reduced from $2,000,000 to $1,000,000 with a $500,000 sub-limit.';
    const result = validateSummaryNumbers(hallucinatedSummary, {
      oldValue: '$2,000,000',
      newValue: '$1,000,000',
      citedText: 'Each Occurrence: $1,000,000',
    });

    expect(result.valid).toBe(false);
    expect(result.forbiddenNumbers).toContain('$500,000');
  });
});
