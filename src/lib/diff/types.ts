import { Severity, ChangeType, ReviewStatus } from '@prisma/client';
import { SourceCitation } from '../extraction/schema';

export interface DiffResultItem {
  category: string; // e.g. "General Liability", "Property", "Endorsements", "Named Insureds"
  canonicalKey: string;
  changeType: ChangeType;
  severity: Severity;
  fieldPath: string; // dotted path, e.g. "gl.eachOccurrence.limit"
  oldValue: string | null;
  newValue: string | null;
  oldCitation: SourceCitation | null;
  newCitation: SourceCitation | null;
  summary?: string;
  reviewStatus: ReviewStatus;
}

export interface DiffSummary {
  policyCheckId: string;
  totalChanges: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  items: DiffResultItem[];
}
