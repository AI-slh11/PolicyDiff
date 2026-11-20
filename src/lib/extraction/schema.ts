import { z } from 'zod';

export const SourceCitationSchema = z.object({
  documentId: z.string(),
  page: z.number().int().positive(),
  blockIds: z.array(z.string()).default([]),
  textSnippet: z.string().optional(),
  bbox: z
    .object({
      x0: z.number(),
      y0: z.number(),
      x1: z.number(),
      y1: z.number(),
    })
    .optional(),
});

export type SourceCitation = z.infer<typeof SourceCitationSchema>;

export const NamedInsuredSchema = z.object({
  name: z.string(),
  address: z.string().nullable().default(null),
  entityType: z.string().nullable().default(null), // e.g. Corporation, LLC, Individual
  source: SourceCitationSchema,
});

export const PolicyPeriodSchema = z.object({
  effectiveDate: z.string(), // ISO date YYYY-MM-DD or readable
  expirationDate: z.string(),
  source: SourceCitationSchema,
});

export const CarrierSchema = z.object({
  name: z.string(),
  naicNumber: z.string().nullable().default(null),
  amBestRating: z.string().nullable().default(null),
  source: SourceCitationSchema,
});

export const SubLimitSchema = z.object({
  name: z.string(),
  limitAmount: z.number().nullable().default(null),
  limitDescription: z.string(),
  deductibleAmount: z.number().nullable().default(null),
  source: SourceCitationSchema,
});

export const CoverageItemSchema = z.object({
  canonicalKey: z.string(), // e.g. GL_EACH_OCCURRENCE, PROPERTY_BUILDING
  lineOfBusiness: z.enum([
    'GENERAL_LIABILITY',
    'PROPERTY',
    'BOP',
    'COMMERCIAL_AUTO',
    'UMBRELLA',
    'WORKERS_COMP',
    'PROFESSIONAL_LIABILITY',
    'CYBER',
    'OTHER',
  ]),
  name: z.string(),
  limitAmount: z.number().nullable().default(null),
  limitDescription: z.string().nullable().default(null),
  deductibleAmount: z.number().nullable().default(null),
  sirAmount: z.number().nullable().default(null), // Self-Insured Retention
  subLimits: z.array(SubLimitSchema).default([]),
  source: SourceCitationSchema,
});

export const EndorsementFormSchema = z.object({
  formNumber: z.string(), // e.g. "CG 21 49 09 99"
  editionDate: z.string().nullable().default(null),
  title: z.string(),
  category: z.enum(['COVERAGE', 'EXCLUSION', 'CONDITION', 'STATE_SPECIFIC', 'OTHER']),
  source: SourceCitationSchema,
});

export const ExclusionItemSchema = z.object({
  canonicalKey: z.string(), // e.g. EXCL_POLLUTION, EXCL_CYBER
  name: z.string(),
  formNumber: z.string().nullable().default(null),
  summary: z.string(),
  source: SourceCitationSchema,
});

export const ConditionItemSchema = z.object({
  canonicalKey: z.string(),
  name: z.string(),
  description: z.string(),
  source: SourceCitationSchema,
});

export const CommercialPolicyExtractionSchema = z.object({
  policyNumber: z.string(),
  carrier: CarrierSchema,
  namedInsureds: z.array(NamedInsuredSchema).min(1),
  policyPeriod: PolicyPeriodSchema,
  coverages: z.array(CoverageItemSchema),
  endorsements: z.array(EndorsementFormSchema).default([]),
  exclusions: z.array(ExclusionItemSchema).default([]),
  conditions: z.array(ConditionItemSchema).default([]),
});

export type CommercialPolicyExtraction = z.infer<typeof CommercialPolicyExtractionSchema>;
export type CoverageItem = z.infer<typeof CoverageItemSchema>;
export type EndorsementForm = z.infer<typeof EndorsementFormSchema>;
export type ExclusionItem = z.infer<typeof ExclusionItemSchema>;
export type ConditionItem = z.infer<typeof ConditionItemSchema>;
