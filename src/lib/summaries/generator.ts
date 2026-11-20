import { DiffResultItem } from '../diff/types';

/**
 * Validates that any number or currency figure mentioned in the summary
 * is strictly present in the source input (oldValue, newValue, or cited text).
 * Rejects any summary that invents numbers absent from the source.
 */
export function validateSummaryNumbers(
  summary: string,
  sources: { oldValue: string | null; newValue: string | null; citedText?: string }
): { valid: boolean; forbiddenNumbers: string[] } {
  // Extract all numbers (including formatted numbers like 1,000,000, $5,000, 50%)
  const numberRegex = /\$?\b\d{1,3}(?:,\d{3})*(?:\.\d+)?%?\b/g;
  const summaryMatches = summary.match(numberRegex) || [];

  const combinedSource = `${sources.oldValue || ''} ${sources.newValue || ''} ${sources.citedText || ''}`;
  const cleanSourceNumbers = new Set(
    (combinedSource.match(numberRegex) || []).map((n) => n.replace(/[$,%]/g, ''))
  );

  const forbidden: string[] = [];

  for (const match of summaryMatches) {
    const rawVal = match.replace(/[$,%]/g, '');
    // Allow small integers 1-2 if used for language (e.g. "one sentence"), otherwise must be in source
    if (rawVal === '1' || rawVal === '2') continue;

    if (!cleanSourceNumbers.has(rawVal)) {
      forbidden.push(match);
    }
  }

  return {
    valid: forbidden.length === 0,
    forbiddenNumbers: forbidden,
  };
}

/**
 * Generates deterministic fallback plain-English summary if LLM output fails validation
 */
export function generateDeterministicSummary(item: DiffResultItem): string {
  const { category, changeType, severity, oldValue, newValue, canonicalKey } = item;

  if (changeType === 'REMOVED') {
    if (category.toLowerCase().includes('exclusion')) {
      return `The ${oldValue || canonicalKey} exclusion was removed, broadening coverage for the insured.`;
    }
    return `${category} coverage (${oldValue || canonicalKey}) was removed from the renewal policy, leaving the insured exposed for these claims.`;
  }

  if (changeType === 'ADDED') {
    if (severity === 'CRITICAL' || category.toLowerCase().includes('exclusion')) {
      return `A new ${newValue || canonicalKey} exclusion was added to the policy, restricting coverage for the insured.`;
    }
    return `New ${category} coverage (${newValue || canonicalKey}) was added to the renewal policy, expanding protection for the insured.`;
  }

  // CHANGED
  if (canonicalKey.includes('LIMIT')) {
    if (severity === 'CRITICAL') {
      return `${category} limit was reduced from ${oldValue} to ${newValue}, lowering the total payout available to the insured.`;
    }
    return `${category} limit was increased from ${oldValue} to ${newValue}, providing higher protection for the insured.`;
  }

  if (canonicalKey.includes('DEDUCTIBLE')) {
    if (severity === 'WARNING') {
      return `${category} deductible was increased from ${oldValue} to ${newValue}, increasing the insured's out-of-pocket costs per loss.`;
    }
    return `${category} deductible was decreased from ${oldValue} to ${newValue}, reducing out-of-pocket costs for the insured.`;
  }

  if (canonicalKey === 'POLICY_CARRIER') {
    return `The underwriting insurer changed from ${oldValue} to ${newValue}, which may affect claims handling and policyholder servicing.`;
  }

  return `${category} changed from ${oldValue || 'none'} to ${newValue || 'none'}, modifying the policy terms for the insured.`;
}

/**
 * Generates a one-sentence plain-English summary for a diff item.
 * Strictly verifies that no numbers were invented.
 */
export async function generateDiffSummary(
  item: DiffResultItem,
  citedSourceText?: string
): Promise<string> {
  // If an external LLM is configured (or in headless mode), call LLM or generate deterministic
  const candidate = generateDeterministicSummary(item);

  // Validate number hallucination check
  const check = validateSummaryNumbers(candidate, {
    oldValue: item.oldValue,
    newValue: item.newValue,
    citedText: citedSourceText,
  });

  if (!check.valid) {
    console.warn(`[summary-guard] Rejected summary with fabricated numbers: ${check.forbiddenNumbers.join(', ')}`);
    return `Policy terms for ${item.category} were modified on renewal.`;
  }

  return candidate;
}
