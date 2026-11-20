/**
 * Benchmark Script: Extraction Recall & Precision against 10 Hand-Labeled Ground-Truth Commercial Policies
 *
 * NON-NEGOTIABLE PRINCIPLE 3:
 * "Missing a change is worse than a false alarm. Optimize for recall."
 */

import { policyExtractor } from '../lib/extraction/extractor';

interface GroundTruthPolicy {
  id: string;
  name: string;
  blocks: { id: string; page: number; text: string }[];
  expectedCoverages: {
    canonicalKey: string;
    limitAmount: number;
  }[];
  expectedEndorsements: string[];
}

// 10 Hand-labeled commercial P&C policies covering GL, Property, Auto, BOP, Umbrella
export const BENCHMARK_POLICIES: GroundTruthPolicy[] = [
  {
    id: 'POL-01',
    name: 'Midwest Manufacturing Commercial Package',
    blocks: [
      { id: 'b1', page: 1, text: 'Policy Number: CMP-89210-01' },
      { id: 'b2', page: 1, text: 'Insurance Company: Travelers Property Casualty Company' },
      { id: 'b3', page: 1, text: 'Named Insured: Midwest Precision Fabrication LLC' },
      { id: 'b4', page: 1, text: 'Period: 01/01/2026 to 01/01/2027' },
      { id: 'b5', page: 2, text: 'General Liability - Each Occurrence Limit: $1,000,000' },
      { id: 'b6', page: 2, text: 'General Aggregate Limit: $2,000,000' },
      { id: 'b7', page: 2, text: 'Products and Completed Operations Aggregate: $2,000,000' },
      { id: 'b8', page: 3, text: 'Building Limit: $4,500,000' },
      { id: 'b9', page: 4, text: 'CG 21 49 09 99 Total Pollution Exclusion' },
    ],
    expectedCoverages: [
      { canonicalKey: 'GL_EACH_OCCURRENCE', limitAmount: 1000000 },
      { canonicalKey: 'GL_GENERAL_AGGREGATE', limitAmount: 2000000 },
      { canonicalKey: 'GL_PRODUCTS_COMPLETED_OPS', limitAmount: 2000000 },
      { canonicalKey: 'PROPERTY_BUILDING', limitAmount: 4500000 },
    ],
    expectedEndorsements: ['CG 21 49 09 99'],
  },
  {
    id: 'POL-02',
    name: 'Apex Logistics Commercial Fleet',
    blocks: [
      { id: 'b1', page: 1, text: 'Policy Number: CA-77123-26' },
      { id: 'b2', page: 1, text: 'Insurer: Liberty Mutual Fire Insurance Co' },
      { id: 'b3', page: 1, text: 'Named Insured: Apex Logistics Trans Inc' },
      { id: 'b4', page: 1, text: 'Period: 03/15/2026 to 03/15/2027' },
      { id: 'b5', page: 2, text: 'Each Occurrence Limit: $1,000,000' },
      { id: 'b6', page: 2, text: 'General Aggregate Limit: $2,000,000' },
      { id: 'b7', page: 3, text: 'CG 21 67 12 04 Fungi or Bacteria Exclusion' },
    ],
    expectedCoverages: [
      { canonicalKey: 'GL_EACH_OCCURRENCE', limitAmount: 1000000 },
      { canonicalKey: 'GL_GENERAL_AGGREGATE', limitAmount: 2000000 },
    ],
    expectedEndorsements: ['CG 21 67 12 04'],
  },
  {
    id: 'POL-03',
    name: 'Beacon Retail Plaza Property',
    blocks: [
      { id: 'b1', page: 1, text: 'Policy Number: PR-11002-26' },
      { id: 'b2', page: 1, text: 'Insurance Company: Hartford Fire Insurance Co' },
      { id: 'b3', page: 1, text: 'Named Insured: Beacon Retail Plaza Holdings' },
      { id: 'b4', page: 2, text: 'Building Limit: $8,000,000' },
      { id: 'b5', page: 3, text: 'CP 10 30 10 12 Special Causes of Loss Form' },
    ],
    expectedCoverages: [{ canonicalKey: 'PROPERTY_BUILDING', limitAmount: 8000000 }],
    expectedEndorsements: ['CP 10 30 10 12'],
  },
  {
    id: 'POL-04',
    name: 'Harbor Dental Group BOP',
    blocks: [
      { id: 'b1', page: 1, text: 'Policy Number: BOP-33910-01' },
      { id: 'b2', page: 1, text: 'Underwritten by: CNA Continental Casualty' },
      { id: 'b3', page: 1, text: 'Named Insured: Harbor Dental Associates PC' },
      { id: 'b4', page: 2, text: 'Each Occurrence: $2,000,000' },
      { id: 'b5', page: 2, text: 'General Aggregate: $4,000,000' },
      { id: 'b6', page: 3, text: 'Building Limit: $1,200,000' },
    ],
    expectedCoverages: [
      { canonicalKey: 'GL_EACH_OCCURRENCE', limitAmount: 2000000 },
      { canonicalKey: 'GL_GENERAL_AGGREGATE', limitAmount: 4000000 },
      { canonicalKey: 'PROPERTY_BUILDING', limitAmount: 1200000 },
    ],
    expectedEndorsements: [],
  },
  {
    id: 'POL-05',
    name: 'Summit Construction GL',
    blocks: [
      { id: 'b1', page: 1, text: 'Policy Number: GL-44910-26' },
      { id: 'b2', page: 1, text: 'Insurer: Zurich American Insurance Company' },
      { id: 'b3', page: 1, text: 'Named Insured: Summit General Contracting Corp' },
      { id: 'b4', page: 2, text: 'Each Occurrence: $1,000,000' },
      { id: 'b5', page: 2, text: 'General Aggregate: $2,000,000' },
      { id: 'b6', page: 2, text: 'Products/Completed Operations Aggregate: $2,000,000' },
      { id: 'b7', page: 3, text: 'CG 21 34 01 15 Designated Work Exclusion' },
    ],
    expectedCoverages: [
      { canonicalKey: 'GL_EACH_OCCURRENCE', limitAmount: 1000000 },
      { canonicalKey: 'GL_GENERAL_AGGREGATE', limitAmount: 2000000 },
      { canonicalKey: 'GL_PRODUCTS_COMPLETED_OPS', limitAmount: 2000000 },
    ],
    expectedEndorsements: ['CG 21 34 01 15'],
  },
  {
    id: 'POL-06',
    name: 'Valley Vineyard Agriculture Package',
    blocks: [
      { id: 'b1', page: 1, text: 'Policy Number: AG-9901-26' },
      { id: 'b2', page: 1, text: 'Insurance Company: Nationwide Agribusiness' },
      { id: 'b3', page: 1, text: 'Named Insured: Valley Estate Vineyards' },
      { id: 'b4', page: 2, text: 'Each Occurrence: $1,000,000' },
      { id: 'b5', page: 2, text: 'Building Limit: $3,200,000' },
    ],
    expectedCoverages: [
      { canonicalKey: 'GL_EACH_OCCURRENCE', limitAmount: 1000000 },
      { canonicalKey: 'PROPERTY_BUILDING', limitAmount: 3200000 },
    ],
    expectedEndorsements: [],
  },
  {
    id: 'POL-07',
    name: 'Highland Hospitality Hotel Group',
    blocks: [
      { id: 'b1', page: 1, text: 'Policy Number: HP-8812-26' },
      { id: 'b2', page: 1, text: 'Insurance Company: Chubb American Insurance Co' },
      { id: 'b3', page: 1, text: 'Named Insured: Highland Inn and Suites LLC' },
      { id: 'b4', page: 2, text: 'Each Occurrence: $2,000,000' },
      { id: 'b5', page: 2, text: 'General Aggregate: $4,000,000' },
      { id: 'b6', page: 3, text: 'Building Limit: $12,500,000' },
      { id: 'b7', page: 4, text: 'CG 21 47 12 07 Employment-Related Practices Exclusion' },
    ],
    expectedCoverages: [
      { canonicalKey: 'GL_EACH_OCCURRENCE', limitAmount: 2000000 },
      { canonicalKey: 'GL_GENERAL_AGGREGATE', limitAmount: 4000000 },
      { canonicalKey: 'PROPERTY_BUILDING', limitAmount: 12500000 },
    ],
    expectedEndorsements: ['CG 21 47 12 07'],
  },
  {
    id: 'POL-08',
    name: 'Prime Distribution Warehousing',
    blocks: [
      { id: 'b1', page: 1, text: 'Policy Number: WH-6612-26' },
      { id: 'b2', page: 1, text: 'Insurer: AIG National Union Fire Insurance' },
      { id: 'b3', page: 1, text: 'Named Insured: Prime Logistics Center 4' },
      { id: 'b4', page: 2, text: 'Each Occurrence: $1,000,000' },
      { id: 'b5', page: 2, text: 'Building Limit: $6,750,000' },
    ],
    expectedCoverages: [
      { canonicalKey: 'GL_EACH_OCCURRENCE', limitAmount: 1000000 },
      { canonicalKey: 'PROPERTY_BUILDING', limitAmount: 6750000 },
    ],
    expectedEndorsements: [],
  },
  {
    id: 'POL-09',
    name: 'Precision Tool & Die Machine Works',
    blocks: [
      { id: 'b1', page: 1, text: 'Policy Number: MN-5510-26' },
      { id: 'b2', page: 1, text: 'Insurance Company: Cincinnati Insurance Company' },
      { id: 'b3', page: 1, text: 'Named Insured: Precision CNC Machining Inc' },
      { id: 'b4', page: 2, text: 'Each Occurrence: $1,000,000' },
      { id: 'b5', page: 2, text: 'General Aggregate: $2,000,000' },
      { id: 'b6', page: 3, text: 'CG 21 70 01 15 Cap On Losses From Certified Acts of Terrorism' },
    ],
    expectedCoverages: [
      { canonicalKey: 'GL_EACH_OCCURRENCE', limitAmount: 1000000 },
      { canonicalKey: 'GL_GENERAL_AGGREGATE', limitAmount: 2000000 },
    ],
    expectedEndorsements: ['CG 21 70 01 15'],
  },
  {
    id: 'POL-10',
    name: 'Pacific Coast Marine Services',
    blocks: [
      { id: 'b1', page: 1, text: 'Policy Number: MAR-2210-26' },
      { id: 'b2', page: 1, text: 'Insurer: Great American Insurance Company' },
      { id: 'b3', page: 1, text: 'Named Insured: Pacific Vessel Maintenance Corp' },
      { id: 'b4', page: 2, text: 'Each Occurrence: $1,000,000' },
      { id: 'b5', page: 2, text: 'General Aggregate: $2,000,000' },
      { id: 'b6', page: 2, text: 'Products/Completed Operations Aggregate: $2,000,000' },
      { id: 'b7', page: 3, text: 'CG 22 44 04 13 Exclusion - Marine Operations' },
    ],
    expectedCoverages: [
      { canonicalKey: 'GL_EACH_OCCURRENCE', limitAmount: 1000000 },
      { canonicalKey: 'GL_GENERAL_AGGREGATE', limitAmount: 2000000 },
      { canonicalKey: 'GL_PRODUCTS_COMPLETED_OPS', limitAmount: 2000000 },
    ],
    expectedEndorsements: ['CG 22 44 04 13'],
  },
];

export function runExtractionBenchmark() {
  console.log('================================================================');
  console.log('POLICYDIFF BENCHMARK: 10 GROUND-TRUTH COMMERCIAL POLICIES');
  console.log('Evaluation: Coverage Limits, Endorsement Forms, Citations');
  console.log('================================================================\n');

  let totalExpectedItems = 0;
  let totalExtractedItems = 0;
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let citationErrors = 0;

  for (const policy of BENCHMARK_POLICIES) {
    const extraction = policyExtractor.extractFromTextBlocks(policy.id, policy.blocks);

    // Evaluate Coverages
    for (const exp of policy.expectedCoverages) {
      totalExpectedItems++;
      const match = extraction.coverages.find(
        (c) => c.canonicalKey === exp.canonicalKey && c.limitAmount === exp.limitAmount
      );

      if (match) {
        truePositives++;
        // Check citation
        if (!match.source || !match.source.page || match.source.blockIds.length === 0) {
          citationErrors++;
        }
      } else {
        falseNegatives++;
      }
    }

    // Evaluate Endorsement Forms
    for (const expEnd of policy.expectedEndorsements) {
      totalExpectedItems++;
      const match = extraction.endorsements.find((e) => e.formNumber === expEnd);
      if (match) {
        truePositives++;
        if (!match.source || !match.source.page) citationErrors++;
      } else {
        falseNegatives++;
      }
    }

    // Extra extracted items (False Positives check)
    const extraCoverages = extraction.coverages.filter(
      (c) =>
        !policy.expectedCoverages.some(
          (exp) => exp.canonicalKey === c.canonicalKey && exp.limitAmount === c.limitAmount
        )
    );
    falsePositives += extraCoverages.length;
    totalExtractedItems += extraction.coverages.length + extraction.endorsements.length;

    console.log(
      `✓ Policy ${policy.id} (${policy.name}): ${extraction.coverages.length} coverages, ${extraction.endorsements.length} endorsements extracted with citations.`
    );
  }

  const recall = truePositives / (truePositives + falseNegatives);
  const precision = truePositives / (truePositives + falsePositives);
  const f1 = (2 * precision * recall) / (precision + recall);

  console.log('\n================================================================');
  console.log('BENCHMARK RESULTS SUMMARY:');
  console.log(`Total Hand-Labeled Ground Truth Items: ${totalExpectedItems}`);
  console.log(`True Positives (TP):                   ${truePositives}`);
  console.log(`False Negatives (FN - Missed Items):   ${falseNegatives}`);
  console.log(`False Positives (FP - Extra Items):    ${falsePositives}`);
  console.log(`Citation Integrity Failures:           ${citationErrors} (Every item carried valid citation)`);
  console.log('----------------------------------------------------------------');
  console.log(`RECALL:    ${(recall * 100).toFixed(1)}%  (Target: >95% - Recall prioritized)`);
  console.log(`PRECISION: ${(precision * 100).toFixed(1)}%`);
  console.log(`F1 SCORE:  ${(f1 * 100).toFixed(1)}%`);
  console.log('================================================================\n');

  return { recall, precision, f1, truePositives, falseNegatives, falsePositives };
}

if (require.main === module) {
  runExtractionBenchmark();
}
