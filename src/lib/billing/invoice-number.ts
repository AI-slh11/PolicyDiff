import { prisma } from '@/lib/db';

/**
 * Generates an atomic, collision-proof, strictly sequential invoice number.
 * Format: PD-YYYY-XXXX (e.g., PD-2026-0001)
 *
 * Guaranteed Properties:
 * 1. Monotonically increasing per year
 * 2. Cannot collide or duplicate even under concurrent generation
 * 3. Tied to a persistent sequence table (invoice_sequences)
 */
export async function generateNextInvoiceNumber(forYear?: number): Promise<string> {
  const year = forYear ?? new Date().getFullYear();

  // Atomically increment the sequence for the given year
  const sequence = await prisma.$transaction(async (tx) => {
    const existing = await tx.invoiceSequence.findUnique({
      where: { year },
    });

    if (!existing) {
      return await tx.invoiceSequence.create({
        data: {
          year,
          lastNumber: 1,
        },
      });
    }

    return await tx.invoiceSequence.update({
      where: { year },
      data: {
        lastNumber: { increment: 1 },
      },
    });
  });

  const paddedNumber = String(sequence.lastNumber).padStart(4, '0');
  return `PD-${year}-${paddedNumber}`;
}
