/**
 * Deterministic Diff Engine (ZERO LLM INVOLVED)
 *
 * NON-NEGOTIABLE PRINCIPLE 2:
 * "The diff is computed in deterministic code, NOT by the LLM."
 *
 * Matches coverages by canonical key, compares limits, deductibles, and sub-limits,
 * detects added/removed/changed endorsement forms and exclusions, and compares
 * named insureds and policy periods with rigorous severity assignment.
 */

import { CommercialPolicyExtraction } from '../extraction/schema';
import { DiffResultItem, DiffSummary } from './types';
import { Severity, ChangeType } from '@prisma/client';

export class DeterministicDiffEngine {
  /**
   * Compares expiring policy extraction against renewal policy extraction.
   */
  computeDiff(
    expiring: CommercialPolicyExtraction,
    renewal: CommercialPolicyExtraction,
    policyCheckId: string = 'check_temp'
  ): DiffSummary {
    const items: DiffResultItem[] = [];

    // ── 1. NAMED INSUREDS COMPARISON ───────────────────────────────────
    this.compareNamedInsureds(expiring.namedInsureds, renewal.namedInsureds, items);

    // ── 2. POLICY PERIOD & CARRIER COMPARISON ──────────────────────────
    this.comparePolicyPeriodAndCarrier(expiring, renewal, items);

    // ── 3. COVERAGE LIMITS, DEDUCTIBLES & SIRS ────────────────────────
    this.compareCoverages(expiring.coverages, renewal.coverages, items);

    // ── 4. ENDORSEMENTS & FORM NUMBERS ────────────────────────────────
    this.compareEndorsements(expiring.endorsements, renewal.endorsements, items);

    // ── 5. EXCLUSIONS ──────────────────────────────────────────────────
    this.compareExclusions(expiring.exclusions, renewal.exclusions, items);

    // Sort items by severity: CRITICAL first, then WARNING, then INFO
    const severityWeight: Record<Severity, number> = {
      CRITICAL: 1,
      WARNING: 2,
      INFO: 3,
    };

    items.sort((a, b) => severityWeight[a.severity] - severityWeight[b.severity]);

    const criticalCount = items.filter((i) => i.severity === 'CRITICAL').length;
    const warningCount = items.filter((i) => i.severity === 'WARNING').length;
    const infoCount = items.filter((i) => i.severity === 'INFO').length;

    return {
      policyCheckId,
      totalChanges: items.length,
      criticalCount,
      warningCount,
      infoCount,
      items,
    };
  }

  private compareNamedInsureds(expiring: any[], renewal: any[], items: DiffResultItem[]) {
    const expiringMap = new Map(expiring.map((i) => [i.name.trim().toLowerCase(), i]));
    const renewalMap = new Map(renewal.map((i) => [i.name.trim().toLowerCase(), i]));

    // Check for removed insured entity (CRITICAL: potential loss of coverage)
    for (const [nameKey, oldInsured] of expiringMap.entries()) {
      if (!renewalMap.has(nameKey)) {
        items.push({
          category: 'Named Insureds',
          canonicalKey: `INSURED_${nameKey.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`,
          changeType: 'REMOVED',
          severity: 'CRITICAL',
          fieldPath: 'namedInsureds',
          oldValue: oldInsured.name,
          newValue: null,
          oldCitation: oldInsured.source,
          newCitation: null,
          reviewStatus: 'PENDING',
        });
      }
    }

    // Check for added insured entity (INFO)
    for (const [nameKey, newInsured] of renewalMap.entries()) {
      if (!expiringMap.has(nameKey)) {
        items.push({
          category: 'Named Insureds',
          canonicalKey: `INSURED_${nameKey.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`,
          changeType: 'ADDED',
          severity: 'INFO',
          fieldPath: 'namedInsureds',
          oldValue: null,
          newValue: newInsured.name,
          oldCitation: null,
          newCitation: newInsured.source,
          reviewStatus: 'PENDING',
        });
      }
    }
  }

  private comparePolicyPeriodAndCarrier(
    expiring: CommercialPolicyExtraction,
    renewal: CommercialPolicyExtraction,
    items: DiffResultItem[]
  ) {
    // Carrier comparison
    if (expiring.carrier.name.trim().toLowerCase() !== renewal.carrier.name.trim().toLowerCase()) {
      items.push({
        category: 'Carrier & Basic Details',
        canonicalKey: 'POLICY_CARRIER',
        changeType: 'CHANGED',
        severity: 'WARNING',
        fieldPath: 'carrier.name',
        oldValue: expiring.carrier.name,
        newValue: renewal.carrier.name,
        oldCitation: expiring.carrier.source,
        newCitation: renewal.carrier.source,
        reviewStatus: 'PENDING',
      });
    }

    // Policy Period Dates
    if (
      expiring.policyPeriod.effectiveDate !== renewal.policyPeriod.effectiveDate ||
      expiring.policyPeriod.expirationDate !== renewal.policyPeriod.expirationDate
    ) {
      items.push({
        category: 'Policy Period',
        canonicalKey: 'POLICY_PERIOD',
        changeType: 'CHANGED',
        severity: 'INFO',
        fieldPath: 'policyPeriod',
        oldValue: `${expiring.policyPeriod.effectiveDate} to ${expiring.policyPeriod.expirationDate}`,
        newValue: `${renewal.policyPeriod.effectiveDate} to ${renewal.policyPeriod.expirationDate}`,
        oldCitation: expiring.policyPeriod.source,
        newCitation: renewal.policyPeriod.source,
        reviewStatus: 'PENDING',
      });
    }
  }

  private compareCoverages(expiring: any[], renewal: any[], items: DiffResultItem[]) {
    const expiringMap = new Map(expiring.map((c) => [c.canonicalKey, c]));
    const renewalMap = new Map(renewal.map((c) => [c.canonicalKey, c]));

    // Check for removed coverages (CRITICAL)
    for (const [key, oldCov] of expiringMap.entries()) {
      if (!renewalMap.has(key)) {
        items.push({
          category: oldCov.lineOfBusiness.replace(/_/g, ' '),
          canonicalKey: key,
          changeType: 'REMOVED',
          severity: 'CRITICAL',
          fieldPath: `coverages.${key}`,
          oldValue: oldCov.limitDescription || `$${oldCov.limitAmount?.toLocaleString()}`,
          newValue: null,
          oldCitation: oldCov.source,
          newCitation: null,
          reviewStatus: 'PENDING',
        });
      }
    }

    // Check for added coverages (INFO)
    for (const [key, newCov] of renewalMap.entries()) {
      if (!expiringMap.has(key)) {
        items.push({
          category: newCov.lineOfBusiness.replace(/_/g, ' '),
          canonicalKey: key,
          changeType: 'ADDED',
          severity: 'INFO',
          fieldPath: `coverages.${key}`,
          oldValue: null,
          newValue: newCov.limitDescription || `$${newCov.limitAmount?.toLocaleString()}`,
          oldCitation: null,
          newCitation: newCov.source,
          reviewStatus: 'PENDING',
        });
      }
    }

    // Compare matching coverages (Limits & Deductibles)
    for (const [key, oldCov] of expiringMap.entries()) {
      const newCov = renewalMap.get(key);
      if (!newCov) continue;

      const category = oldCov.lineOfBusiness.replace(/_/g, ' ');

      // Compare limits
      if (oldCov.limitAmount !== null && newCov.limitAmount !== null) {
        if (newCov.limitAmount < oldCov.limitAmount) {
          // Limit reduction is CRITICAL
          items.push({
            category,
            canonicalKey: `${key}_LIMIT`,
            changeType: 'CHANGED',
            severity: 'CRITICAL',
            fieldPath: `coverages.${key}.limitAmount`,
            oldValue: `$${oldCov.limitAmount.toLocaleString()}`,
            newValue: `$${newCov.limitAmount.toLocaleString()}`,
            oldCitation: oldCov.source,
            newCitation: newCov.source,
            reviewStatus: 'PENDING',
          });
        } else if (newCov.limitAmount > oldCov.limitAmount) {
          // Limit increase is INFO
          items.push({
            category,
            canonicalKey: `${key}_LIMIT`,
            changeType: 'CHANGED',
            severity: 'INFO',
            fieldPath: `coverages.${key}.limitAmount`,
            oldValue: `$${oldCov.limitAmount.toLocaleString()}`,
            newValue: `$${newCov.limitAmount.toLocaleString()}`,
            oldCitation: oldCov.source,
            newCitation: newCov.source,
            reviewStatus: 'PENDING',
          });
        }
      }

      // Compare deductibles
      if (oldCov.deductibleAmount !== null && newCov.deductibleAmount !== null) {
        if (newCov.deductibleAmount > oldCov.deductibleAmount) {
          // Deductible increase is WARNING
          items.push({
            category,
            canonicalKey: `${key}_DEDUCTIBLE`,
            changeType: 'CHANGED',
            severity: 'WARNING',
            fieldPath: `coverages.${key}.deductibleAmount`,
            oldValue: `$${oldCov.deductibleAmount.toLocaleString()}`,
            newValue: `$${newCov.deductibleAmount.toLocaleString()}`,
            oldCitation: oldCov.source,
            newCitation: newCov.source,
            reviewStatus: 'PENDING',
          });
        } else if (newCov.deductibleAmount < oldCov.deductibleAmount) {
          // Deductible decrease is INFO
          items.push({
            category,
            canonicalKey: `${key}_DEDUCTIBLE`,
            changeType: 'CHANGED',
            severity: 'INFO',
            fieldPath: `coverages.${key}.deductibleAmount`,
            oldValue: `$${oldCov.deductibleAmount.toLocaleString()}`,
            newValue: `$${newCov.deductibleAmount.toLocaleString()}`,
            oldCitation: oldCov.source,
            newCitation: newCov.source,
            reviewStatus: 'PENDING',
          });
        }
      }

      // Compare SIRs
      if (oldCov.sirAmount !== null && newCov.sirAmount !== null) {
        if (newCov.sirAmount > oldCov.sirAmount) {
          items.push({
            category,
            canonicalKey: `${key}_SIR`,
            changeType: 'CHANGED',
            severity: 'WARNING',
            fieldPath: `coverages.${key}.sirAmount`,
            oldValue: `$${oldCov.sirAmount.toLocaleString()}`,
            newValue: `$${newCov.sirAmount.toLocaleString()}`,
            oldCitation: oldCov.source,
            newCitation: newCov.source,
            reviewStatus: 'PENDING',
          });
        }
      }
    }
  }

  private compareEndorsements(expiring: any[], renewal: any[], items: DiffResultItem[]) {
    const expiringForms = new Map(expiring.map((e) => [e.formNumber.trim().toUpperCase(), e]));
    const renewalForms = new Map(renewal.map((e) => [e.formNumber.trim().toUpperCase(), e]));

    // Check for added endorsement forms
    for (const [formNum, newEnd] of renewalForms.entries()) {
      if (!expiringForms.has(formNum)) {
        // If endorsement is an exclusion form, severity is CRITICAL
        const isExclusion =
          newEnd.category === 'EXCLUSION' ||
          newEnd.title.toLowerCase().includes('exclusion') ||
          newEnd.title.toLowerCase().includes('limitation');

        items.push({
          category: 'Endorsements & Forms',
          canonicalKey: `FORM_${formNum.replace(/[^A-Z0-9]+/g, '_')}`,
          changeType: 'ADDED',
          severity: isExclusion ? 'CRITICAL' : 'INFO',
          fieldPath: 'endorsements',
          oldValue: null,
          newValue: `${newEnd.formNumber} - ${newEnd.title}`,
          oldCitation: null,
          newCitation: newEnd.source,
          reviewStatus: 'PENDING',
        });
      }
    }

    // Check for removed endorsement forms
    for (const [formNum, oldEnd] of expiringForms.entries()) {
      if (!renewalForms.has(formNum)) {
        items.push({
          category: 'Endorsements & Forms',
          canonicalKey: `FORM_${formNum.replace(/[^A-Z0-9]+/g, '_')}`,
          changeType: 'REMOVED',
          severity: oldEnd.category === 'EXCLUSION' ? 'INFO' : 'WARNING',
          fieldPath: 'endorsements',
          oldValue: `${oldEnd.formNumber} - ${oldEnd.title}`,
          newValue: null,
          oldCitation: oldEnd.source,
          newCitation: null,
          reviewStatus: 'PENDING',
        });
      }
    }
  }

  private compareExclusions(expiring: any[], renewal: any[], items: DiffResultItem[]) {
    const expiringMap = new Map(expiring.map((e) => [e.canonicalKey, e]));
    const renewalMap = new Map(renewal.map((e) => [e.canonicalKey, e]));

    // Added Exclusion is ALWAYS CRITICAL
    for (const [key, newExcl] of renewalMap.entries()) {
      if (!expiringMap.has(key)) {
        items.push({
          category: 'Policy Exclusions',
          canonicalKey: key,
          changeType: 'ADDED',
          severity: 'CRITICAL',
          fieldPath: `exclusions.${key}`,
          oldValue: null,
          newValue: newExcl.name,
          oldCitation: null,
          newCitation: newExcl.source,
          reviewStatus: 'PENDING',
        });
      }
    }

    // Removed Exclusion is INFO (broadened coverage)
    for (const [key, oldExcl] of expiringMap.entries()) {
      if (!renewalMap.has(key)) {
        items.push({
          category: 'Policy Exclusions',
          canonicalKey: key,
          changeType: 'REMOVED',
          severity: 'INFO',
          fieldPath: `exclusions.${key}`,
          oldValue: oldExcl.name,
          newValue: null,
          oldCitation: oldExcl.source,
          newCitation: null,
          reviewStatus: 'PENDING',
        });
      }
    }
  }
}

export const deterministicDiffEngine = new DeterministicDiffEngine();
