import { z } from 'zod';

/**
 * Citation: a pointer to a specific location in a source PDF.
 * Every extracted value MUST carry one of these.
 */
export const CitationSchema = z.object({
  documentId: z.string(),
  page: z.number().int().positive(),
  blockIds: z.array(z.string()).optional(),
  boundingBox: z
    .object({
      x0: z.number(),
      y0: z.number(),
      x1: z.number(),
      y1: z.number(),
    })
    .optional(),
  textSpan: z
    .object({
      start: z.number().int().nonnegative(),
      end: z.number().int().positive(),
    })
    .optional(),
});

export type Citation = z.infer<typeof CitationSchema>;

/**
 * Validate that a value has a citation. If not, it must not be shown.
 * (Non-negotiable principle #1)
 */
export function hasCitation(citation: unknown): citation is Citation {
  const result = CitationSchema.safeParse(citation);
  return result.success;
}
