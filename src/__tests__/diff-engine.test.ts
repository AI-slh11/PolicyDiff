import { describe, it, expect } from 'vitest';
import { DeterministicDiffEngine } from '@/lib/diff/engine';
import { CommercialPolicyExtraction } from '@/lib/extraction/schema';

describe('Step 4: Deterministic Diff Engine (20+ Change Scenarios)', () => {
  const engine = new DeterministicDiffEngine();

  const baseCitation = (docId: string, page: number = 1) => ({
    documentId: docId,
    page,
    blockIds: [`${docId}_b1`],
    textSnippet: 'Sample citation text',
  });

  const createBaseExtraction = (docId: string): CommercialPolicyExtraction => ({
    policyNumber: 'POL-100-BASE',
    carrier: {
      name: 'Travelers Property Casualty',
      naicNumber: null,
      amBestRating: 'A++',
      source: baseCitation(docId, 1),
    },
    namedInsureds: [
      {
        name: 'Acme Commercial Corp',
        address: '100 Main St',
        entityType: 'Corporation',
        source: baseCitation(docId, 1),
      },
    ],
    policyPeriod: {
      effectiveDate: '2026-01-01',
      expirationDate: '2027-01-01',
      source: baseCitation(docId, 1),
    },
    coverages: [
      {
        canonicalKey: 'GL_EACH_OCCURRENCE',
        lineOfBusiness: 'GENERAL_LIABILITY',
        name: 'Each Occurrence',
        limitAmount: 2000000,
        limitDescription: '$2,000,000',
        deductibleAmount: 1000,
        sirAmount: null,
        subLimits: [],
        source: baseCitation(docId, 2),
      },
    ],
    endorsements: [],
    exclusions: [],
    conditions: [],
  });

  // ── SCENARIO 1: REDUCED COVERAGE LIMIT (CRITICAL) ─────────────────
  it('Scenario 1: flags reduced coverage limit as CRITICAL', () => {
    const expiring = createBaseExtraction('exp_1');
    const renewal = createBaseExtraction('ren_1');
    renewal.coverages[0].limitAmount = 1000000; // $2M -> $1M

    const diff = engine.computeDiff(expiring, renewal);
    const item = diff.items.find((i) => i.canonicalKey === 'GL_EACH_OCCURRENCE_LIMIT');

    expect(item).toBeDefined();
    expect(item?.severity).toBe('CRITICAL');
    expect(item?.changeType).toBe('CHANGED');
    expect(item?.oldValue).toBe('$2,000,000');
    expect(item?.newValue).toBe('$1,000,000');
    expect(item?.oldCitation).toBeDefined();
    expect(item?.newCitation).toBeDefined();
  });

  // ── SCENARIO 2: INCREASED COVERAGE LIMIT (INFO) ────────────────────
  it('Scenario 2: flags increased coverage limit as INFO', () => {
    const expiring = createBaseExtraction('exp_1');
    const renewal = createBaseExtraction('ren_1');
    renewal.coverages[0].limitAmount = 4000000; // $2M -> $4M

    const diff = engine.computeDiff(expiring, renewal);
    const item = diff.items.find((i) => i.canonicalKey === 'GL_EACH_OCCURRENCE_LIMIT');

    expect(item).toBeDefined();
    expect(item?.severity).toBe('INFO');
    expect(item?.changeType).toBe('CHANGED');
  });

  // ── SCENARIO 3: UNCHANGED COVERAGE LIMIT ──────────────────────────
  it('Scenario 3: does not generate diff when limit is unchanged', () => {
    const expiring = createBaseExtraction('exp_1');
    const renewal = createBaseExtraction('ren_1');

    const diff = engine.computeDiff(expiring, renewal);
    const item = diff.items.find((i) => i.canonicalKey === 'GL_EACH_OCCURRENCE_LIMIT');
    expect(item).toBeUndefined();
  });

  // ── SCENARIO 4: COVERAGE COMPLETELY REMOVED (CRITICAL) ─────────────
  it('Scenario 4: flags completely removed coverage line as CRITICAL', () => {
    const expiring = createBaseExtraction('exp_1');
    const renewal = createBaseExtraction('ren_1');
    renewal.coverages = []; // Coverage dropped

    const diff = engine.computeDiff(expiring, renewal);
    const item = diff.items.find((i) => i.canonicalKey === 'GL_EACH_OCCURRENCE');

    expect(item).toBeDefined();
    expect(item?.severity).toBe('CRITICAL');
    expect(item?.changeType).toBe('REMOVED');
    expect(item?.oldCitation).toBeDefined();
  });

  // ── SCENARIO 5: NEW COVERAGE ADDED (INFO) ─────────────────────────
  it('Scenario 5: flags newly added coverage line as INFO', () => {
    const expiring = createBaseExtraction('exp_1');
    const renewal = createBaseExtraction('ren_1');
    renewal.coverages.push({
      canonicalKey: 'CYBER_SECURITY',
      lineOfBusiness: 'CYBER',
      name: 'Cyber Liability',
      limitAmount: 1000000,
      limitDescription: '$1,000,000',
      deductibleAmount: 10000,
      sirAmount: null,
      subLimits: [],
      source: baseCitation('ren_1', 3),
    });

    const diff = engine.computeDiff(expiring, renewal);
    const item = diff.items.find((i) => i.canonicalKey === 'CYBER_SECURITY');

    expect(item).toBeDefined();
    expect(item?.severity).toBe('INFO');
    expect(item?.changeType).toBe('ADDED');
  });

  // ── SCENARIO 6: DEDUCTIBLE INCREASED (WARNING) ─────────────────────
  it('Scenario 6: flags increased deductible as WARNING', () => {
    const expiring = createBaseExtraction('exp_1');
    const renewal = createBaseExtraction('ren_1');
    renewal.coverages[0].deductibleAmount = 5000; // $1,000 -> $5,000

    const diff = engine.computeDiff(expiring, renewal);
    const item = diff.items.find((i) => i.canonicalKey === 'GL_EACH_OCCURRENCE_DEDUCTIBLE');

    expect(item).toBeDefined();
    expect(item?.severity).toBe('WARNING');
    expect(item?.changeType).toBe('CHANGED');
    expect(item?.oldValue).toBe('$1,000');
    expect(item?.newValue).toBe('$5,000');
  });

  // ── SCENARIO 7: DEDUCTIBLE DECREASED (INFO) ──────────────────────
  it('Scenario 7: flags decreased deductible as INFO', () => {
    const expiring = createBaseExtraction('exp_1');
    const renewal = createBaseExtraction('ren_1');
    renewal.coverages[0].deductibleAmount = 500; // $1,000 -> $500

    const diff = engine.computeDiff(expiring, renewal);
    const item = diff.items.find((i) => i.canonicalKey === 'GL_EACH_OCCURRENCE_DEDUCTIBLE');

    expect(item).toBeDefined();
    expect(item?.severity).toBe('INFO');
  });

  // ── SCENARIO 8: SIR (SELF-INSURED RETENTION) INCREASED (WARNING) ──
  it('Scenario 8: flags increased SIR as WARNING', () => {
    const expiring = createBaseExtraction('exp_1');
    expiring.coverages[0].sirAmount = 10000;
    const renewal = createBaseExtraction('ren_1');
    renewal.coverages[0].sirAmount = 25000;

    const diff = engine.computeDiff(expiring, renewal);
    const item = diff.items.find((i) => i.canonicalKey === 'GL_EACH_OCCURRENCE_SIR');

    expect(item).toBeDefined();
    expect(item?.severity).toBe('WARNING');
  });

  // ── SCENARIO 9: NEW EXCLUSION FORM ADDED (CRITICAL) ───────────────
  it('Scenario 9: flags new exclusion endorsement form as CRITICAL', () => {
    const expiring = createBaseExtraction('exp_1');
    const renewal = createBaseExtraction('ren_1');
    renewal.endorsements.push({
      formNumber: 'CG 21 49 09 99',
      editionDate: '09 99',
      title: 'Total Pollution Exclusion',
      category: 'EXCLUSION',
      source: baseCitation('ren_1', 4),
    });

    const diff = engine.computeDiff(expiring, renewal);
    const item = diff.items.find((i) => i.canonicalKey.includes('CG_21_49'));

    expect(item).toBeDefined();
    expect(item?.severity).toBe('CRITICAL');
    expect(item?.changeType).toBe('ADDED');
  });

  // ── SCENARIO 10: COVERAGE EXPANSION ENDORSEMENT ADDED (INFO) ──────
  it('Scenario 10: flags standard coverage endorsement added as INFO', () => {
    const expiring = createBaseExtraction('exp_1');
    const renewal = createBaseExtraction('ren_1');
    renewal.endorsements.push({
      formNumber: 'CG 20 10 04 13',
      editionDate: '04 13',
      title: 'Additional Insured - Owners, Lessees or Contractors',
      category: 'COVERAGE',
      source: baseCitation('ren_1', 5),
    });

    const diff = engine.computeDiff(expiring, renewal);
    const item = diff.items.find((i) => i.canonicalKey.includes('CG_20_10'));

    expect(item).toBeDefined();
    expect(item?.severity).toBe('INFO');
    expect(item?.changeType).toBe('ADDED');
  });

  // ── SCENARIO 11: EXCLUSION ENDORSEMENT REMOVED (INFO) ─────────────
  it('Scenario 11: flags removed exclusion endorsement as INFO (broadened coverage)', () => {
    const expiring = createBaseExtraction('exp_1');
    expiring.endorsements.push({
      formNumber: 'CG 21 67 12 04',
      editionDate: '12 04',
      title: 'Fungi or Bacteria Exclusion',
      category: 'EXCLUSION',
      source: baseCitation('exp_1', 6),
    });
    const renewal = createBaseExtraction('ren_1');

    const diff = engine.computeDiff(expiring, renewal);
    const item = diff.items.find((i) => i.canonicalKey.includes('CG_21_67'));

    expect(item).toBeDefined();
    expect(item?.severity).toBe('INFO');
    expect(item?.changeType).toBe('REMOVED');
  });

  // ── SCENARIO 12: COVERAGE ENDORSEMENT REMOVED (WARNING) ───────────
  it('Scenario 12: flags removed coverage endorsement as WARNING', () => {
    const expiring = createBaseExtraction('exp_1');
    expiring.endorsements.push({
      formNumber: 'CA 99 48 10 13',
      editionDate: '10 13',
      title: 'Pollution Liability Broadened Coverage for Autos',
      category: 'COVERAGE',
      source: baseCitation('exp_1', 6),
    });
    const renewal = createBaseExtraction('ren_1');

    const diff = engine.computeDiff(expiring, renewal);
    const item = diff.items.find((i) => i.canonicalKey.includes('CA_99_48'));

    expect(item).toBeDefined();
    expect(item?.severity).toBe('WARNING');
    expect(item?.changeType).toBe('REMOVED');
  });

  // ── SCENARIO 13: NAMED INSURED ENTITY REMOVED (CRITICAL) ──────────
  it('Scenario 13: flags dropped named insured entity as CRITICAL', () => {
    const expiring = createBaseExtraction('exp_1');
    expiring.namedInsureds.push({
      name: 'Acme Subsidiary LLC',
      address: null,
      entityType: 'LLC',
      source: baseCitation('exp_1', 1),
    });
    const renewal = createBaseExtraction('ren_1'); // Only Acme Commercial Corp

    const diff = engine.computeDiff(expiring, renewal);
    const item = diff.items.find((i) => i.canonicalKey.includes('SUBSIDIARY'));

    expect(item).toBeDefined();
    expect(item?.severity).toBe('CRITICAL');
    expect(item?.changeType).toBe('REMOVED');
  });

  // ── SCENARIO 14: NAMED INSURED ENTITY ADDED (INFO) ────────────────
  it('Scenario 14: flags added named insured entity as INFO', () => {
    const expiring = createBaseExtraction('exp_1');
    const renewal = createBaseExtraction('ren_1');
    renewal.namedInsureds.push({
      name: 'Acme East Distribution LLC',
      address: null,
      entityType: 'LLC',
      source: baseCitation('ren_1', 1),
    });

    const diff = engine.computeDiff(expiring, renewal);
    const item = diff.items.find((i) => i.canonicalKey.includes('EAST'));

    expect(item).toBeDefined();
    expect(item?.severity).toBe('INFO');
    expect(item?.changeType).toBe('ADDED');
  });

  // ── SCENARIO 15: CARRIER CHANGED (WARNING) ────────────────────────
  it('Scenario 15: flags insurance carrier change as WARNING', () => {
    const expiring = createBaseExtraction('exp_1');
    const renewal = createBaseExtraction('ren_1');
    renewal.carrier.name = 'Chubb American Insurance Company';

    const diff = engine.computeDiff(expiring, renewal);
    const item = diff.items.find((i) => i.canonicalKey === 'POLICY_CARRIER');

    expect(item).toBeDefined();
    expect(item?.severity).toBe('WARNING');
    expect(item?.changeType).toBe('CHANGED');
    expect(item?.oldValue).toBe('Travelers Property Casualty');
    expect(item?.newValue).toBe('Chubb American Insurance Company');
  });

  // ── SCENARIO 16: POLICY PERIOD RENEWED (INFO) ─────────────────────
  it('Scenario 16: flags updated policy period as INFO', () => {
    const expiring = createBaseExtraction('exp_1');
    const renewal = createBaseExtraction('ren_1');
    renewal.policyPeriod.effectiveDate = '2027-01-01';
    renewal.policyPeriod.expirationDate = '2028-01-01';

    const diff = engine.computeDiff(expiring, renewal);
    const item = diff.items.find((i) => i.canonicalKey === 'POLICY_PERIOD');

    expect(item).toBeDefined();
    expect(item?.severity).toBe('INFO');
  });

  // ── SCENARIO 17: NEW POLICY EXCLUSION ADDED (CRITICAL) ────────────
  it('Scenario 17: flags added canonical exclusion as CRITICAL', () => {
    const expiring = createBaseExtraction('exp_1');
    const renewal = createBaseExtraction('ren_1');
    renewal.exclusions.push({
      canonicalKey: 'EXCL_CYBER_DATA_BREACH',
      name: 'Cyber & Data Breach Exclusion',
      formNumber: null,
      summary: 'Excludes all liability arising from electronic data security incidents',
      source: baseCitation('ren_1', 7),
    });

    const diff = engine.computeDiff(expiring, renewal);
    const item = diff.items.find((i) => i.canonicalKey === 'EXCL_CYBER_DATA_BREACH');

    expect(item).toBeDefined();
    expect(item?.severity).toBe('CRITICAL');
    expect(item?.changeType).toBe('ADDED');
  });

  // ── SCENARIO 18: REMOVED EXCLUSION (INFO) ─────────────────────────
  it('Scenario 18: flags removed canonical exclusion as INFO', () => {
    const expiring = createBaseExtraction('exp_1');
    expiring.exclusions.push({
      canonicalKey: 'EXCL_DESIGNATED_OPERATIONS',
      name: 'Designated Operations Exclusion',
      formNumber: null,
      summary: 'Excludes roofing operations',
      source: baseCitation('exp_1', 8),
    });
    const renewal = createBaseExtraction('ren_1');

    const diff = engine.computeDiff(expiring, renewal);
    const item = diff.items.find((i) => i.canonicalKey === 'EXCL_DESIGNATED_OPERATIONS');

    expect(item).toBeDefined();
    expect(item?.severity).toBe('INFO');
    expect(item?.changeType).toBe('REMOVED');
  });

  // ── SCENARIO 19: MULTIPLE SIMULTANEOUS CHANGES SORTED BY SEVERITY ─
  it('Scenario 19: sorts items deterministically by severity (CRITICAL first)', () => {
    const expiring = createBaseExtraction('exp_1');
    const renewal = createBaseExtraction('ren_1');

    // 1 Info: Limit increased
    renewal.coverages[0].limitAmount = 3000000;
    // 1 Warning: Carrier changed
    renewal.carrier.name = 'Hartford Fire Insurance Co';
    // 1 Critical: New Exclusion added
    renewal.exclusions.push({
      canonicalKey: 'EXCL_ASBESTOS',
      name: 'Asbestos Exclusion',
      formNumber: null,
      summary: 'Total asbestos exclusion',
      source: baseCitation('ren_1', 5),
    });

    const diff = engine.computeDiff(expiring, renewal);
    expect(diff.totalChanges).toBe(3);
    expect(diff.items[0].severity).toBe('CRITICAL');
    expect(diff.items[1].severity).toBe('WARNING');
    expect(diff.items[2].severity).toBe('INFO');
  });

  // ── SCENARIO 20: MANDATORY CITATION AUDIT (PRINCIPLE 1) ───────────
  it('Scenario 20: enforces that every flagged change carries a source citation', () => {
    const expiring = createBaseExtraction('exp_1');
    const renewal = createBaseExtraction('ren_1');
    renewal.coverages[0].limitAmount = 1000000;
    renewal.coverages[0].deductibleAmount = 2500;

    const diff = engine.computeDiff(expiring, renewal);
    expect(diff.items.length).toBeGreaterThan(0);

    for (const item of diff.items) {
      const hasOldOrNewCitation = item.oldCitation !== null || item.newCitation !== null;
      expect(hasOldOrNewCitation).toBe(true);
      if (item.oldCitation) {
        expect(item.oldCitation.page).toBeGreaterThan(0);
      }
      if (item.newCitation) {
        expect(item.newCitation.page).toBeGreaterThan(0);
      }
    }
  });
});
