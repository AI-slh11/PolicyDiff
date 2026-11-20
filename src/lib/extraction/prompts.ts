/**
 * Commercial P&C Extraction Prompts & Grounding Verification
 *
 * NON-NEGOTIABLE PRINCIPLES ENFORCED:
 * 1. Output strict JSON only.
 * 2. Use null when a value is not explicitly present; never guess or hallucinate.
 * 3. Copy form numbers exactly (including spaces, edition dates, and punctuation).
 * 4. Every single item must carry a strict source citation referencing documentId, page, and blockIds.
 */

export const EXTRACTION_SYSTEM_PROMPT = `You are a specialized commercial P&C insurance underwriting extraction model.
Your mission is to extract structured policy details with 100% precision and cite the exact page and text blocks where each fact is stated.

STRICT OPERATING RULES:
1. OUTPUT ONLY VALID JSON. No conversational preamble, no markdown backticks, no explanations.
2. USE null FOR MISSING VALUES. If a limit, deductible, SIR, or address is not explicitly written in the provided text, set it to null. NEVER guess, estimate, or infer typical values.
3. EXACT FORM NUMBERS: Copy insurance form numbers character-for-character (e.g., "CG 00 01 04 13", "IL 00 17 11 98", "CP 10 30 10 12"). Do not standardize, reformat, or alter edition numbers.
4. CITATIONS MANDATORY: Every extracted field must include its "source" with documentId, page number, and the block IDs containing the supporting text. If there is no citation, the field cannot be extracted.
5. OPTIMIZE FOR RECALL WITHOUT HALLUCINATION: Capture all sub-limits, exclusions, endorsements, and named insured entities found in the section.`;

export function buildSectionExtractionPrompt(params: {
  sectionType: 'DECLARATIONS' | 'COVERAGE_SCHEDULE' | 'ENDORSEMENTS_EXCLUSIONS';
  documentId: string;
  blocks: { id: string; page: number; text: string }[];
}): string {
  const { sectionType, documentId, blocks } = params;

  return `Extract commercial policy data for section [${sectionType}].
Target Document ID: "${documentId}"

TEXT BLOCKS TO ANALYZE:
${blocks.map((b) => `[BlockID: ${b.id} | Page: ${b.page}] ${b.text}`).join('\n')}

REQUIRED OUTPUT FORMAT (JSON matching CommercialPolicyExtractionSchema):
{
  "policyNumber": "string",
  "carrier": { "name": "string", "naicNumber": null, "amBestRating": null, "source": { "documentId": "${documentId}", "page": 1, "blockIds": ["..."] } },
  "namedInsureds": [
    { "name": "string", "address": null, "entityType": null, "source": { "documentId": "${documentId}", "page": 1, "blockIds": ["..."] } }
  ],
  "policyPeriod": { "effectiveDate": "YYYY-MM-DD", "expirationDate": "YYYY-MM-DD", "source": { "documentId": "${documentId}", "page": 1, "blockIds": ["..."] } },
  "coverages": [
    {
      "canonicalKey": "GL_EACH_OCCURRENCE",
      "lineOfBusiness": "GENERAL_LIABILITY",
      "name": "Each Occurrence",
      "limitAmount": 1000000,
      "limitDescription": "$1,000,000",
      "deductibleAmount": null,
      "sirAmount": null,
      "subLimits": [],
      "source": { "documentId": "${documentId}", "page": 1, "blockIds": ["..."] }
    }
  ],
  "endorsements": [
    { "formNumber": "CG 21 49 09 99", "editionDate": "09 99", "title": "Total Pollution Exclusion", "category": "EXCLUSION", "source": { "documentId": "${documentId}", "page": 2, "blockIds": ["..."] } }
  ],
  "exclusions": [
    { "canonicalKey": "EXCL_POLLUTION", "name": "Total Pollution Exclusion", "formNumber": "CG 21 49", "summary": "Excludes bodily injury or property damage arising out of pollution", "source": { "documentId": "${documentId}", "page": 2, "blockIds": ["..."] } }
  ],
  "conditions": []
}`;
}

/**
 * Prompt for Second Verification Pass
 * Re-reads the cited text block to confirm or reject the extracted value.
 */
export function buildVerificationPrompt(params: {
  fieldPath: string;
  claimedValue: any;
  citedTextRegion: string;
}): string {
  const { fieldPath, claimedValue, citedTextRegion } = params;

  return `You are a strict compliance verification auditor for insurance policy data.
Compare the Claimed Value against the Cited Source Text.

Field: "${fieldPath}"
Claimed Extracted Value: ${JSON.stringify(claimedValue)}

Cited Source Text:
"""
${citedTextRegion}
"""

Verification Criteria:
1. Does the cited source text directly support the claimed value?
2. Are numbers, currency amounts, or form titles exact matches without contradiction?

Respond with ONLY valid JSON:
{
  "verified": true | false,
  "confidence": 0.0 - 1.0,
  "reason": "Brief verification explanation"
}`;
}
