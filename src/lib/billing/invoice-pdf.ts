import { Invoice, Agency } from '@prisma/client';
import { getBankDetails } from './config';

interface InvoicePdfData {
  invoice: Invoice;
  agency: {
    name: string;
    billingContactEmail?: string | null;
  };
}

/**
 * Escapes characters for PDF string literals: (, ), \
 */
function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Generates a branded, standards-compliant PDF 1.4 for an invoice.
 * Built with pure TypeScript (0 external native dependencies).
 */
export function generateInvoicePdf(data: InvoicePdfData): Buffer {
  const { invoice, agency } = data;
  const bank = getBankDetails();

  const formattedAmount = `$${(invoice.amountCents / 100).toFixed(2)}`;
  const formattedPaid = `$${(invoice.amountPaidCents / 100).toFixed(2)}`;
  const balanceDue = Math.max(0, invoice.amountCents - invoice.amountPaidCents);
  const formattedBalance = `$${(balanceDue / 100).toFixed(2)}`;

  const issueDateStr = new Date(invoice.issueDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const dueDateStr = new Date(invoice.dueDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Construct PDF Content Stream
  // A4 dimensions: 595 x 842 points
  const streamLines: string[] = [];

  // Top header banner (Dark Slate: 0.1 0.15 0.25)
  streamLines.push('q');
  streamLines.push('0.1 0.15 0.25 rg');
  streamLines.push('0 740 595 102 re f');
  streamLines.push('Q');

  // Brand Name in Header
  streamLines.push('BT');
  streamLines.push('/F2 24 Tf'); // Helvetica-Bold 24
  streamLines.push('1 1 1 rg');   // White
  streamLines.push('50 790 Td');
  streamLines.push(`(${escapePdfText('PolicyDiff')}) Tj`);
  streamLines.push('ET');

  // Subtitle
  streamLines.push('BT');
  streamLines.push('/F1 10 Tf');
  streamLines.push('0.8 0.85 0.9 rg');
  streamLines.push('50 770 Td');
  streamLines.push(`(${escapePdfText('Commercial P&C Policy Comparison Platform')}) Tj`);
  streamLines.push('ET');

  // "INVOICE" Title right-aligned in header
  streamLines.push('BT');
  streamLines.push('/F2 20 Tf');
  streamLines.push('1 1 1 rg');
  streamLines.push('420 790 Td');
  streamLines.push(`(${escapePdfText('INVOICE')}) Tj`);
  streamLines.push('ET');

  // Invoice Number right-aligned
  streamLines.push('BT');
  streamLines.push('/F1 11 Tf');
  streamLines.push('0.9 0.9 0.9 rg');
  streamLines.push('420 770 Td');
  streamLines.push(`(${escapePdfText(invoice.invoiceNumber)}) Tj`);
  streamLines.push('ET');

  // Billed To Section
  streamLines.push('BT');
  streamLines.push('/F2 11 Tf');
  streamLines.push('0.2 0.2 0.2 rg');
  streamLines.push('50 700 Td');
  streamLines.push(`(${escapePdfText('BILLED TO:')}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F2 13 Tf');
  streamLines.push('0 0 0 rg');
  streamLines.push('50 682 Td');
  streamLines.push(`(${escapePdfText(agency.name)}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F1 10 Tf');
  streamLines.push('0.3 0.3 0.3 rg');
  streamLines.push('50 666 Td');
  streamLines.push(`(${escapePdfText(`Billing Email: ${invoice.billingContactEmail || 'N/A'}`)}) Tj`);
  streamLines.push('ET');

  // Invoice Meta (Dates & Status)
  streamLines.push('BT');
  streamLines.push('/F1 10 Tf');
  streamLines.push('0.3 0.3 0.3 rg');
  streamLines.push('380 700 Td');
  streamLines.push(`(${escapePdfText(`Invoice Date:   ${issueDateStr}`)}) Tj`);
  streamLines.push('T*');
  streamLines.push(`(${escapePdfText(`Due Date:       ${dueDateStr} (Net 7)`)}) Tj`);
  streamLines.push('T*');
  streamLines.push(`(${escapePdfText(`Status:         ${invoice.status}`)}) Tj`);
  streamLines.push('ET');

  // Divider Line
  streamLines.push('q');
  streamLines.push('0.85 0.85 0.85 RG');
  streamLines.push('1 w');
  streamLines.push('50 635 m 545 635 l S');
  streamLines.push('Q');

  // Line Items Table Header
  streamLines.push('q');
  streamLines.push('0.94 0.95 0.98 rg');
  streamLines.push('50 605 495 24 re f');
  streamLines.push('Q');

  streamLines.push('BT');
  streamLines.push('/F2 10 Tf');
  streamLines.push('0.1 0.15 0.25 rg');
  streamLines.push('60 612 Td');
  streamLines.push(`(${escapePdfText('DESCRIPTION')}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F2 10 Tf');
  streamLines.push('0.1 0.15 0.25 rg');
  streamLines.push('340 612 Td');
  streamLines.push(`(${escapePdfText('PERIOD')}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F2 10 Tf');
  streamLines.push('0.1 0.15 0.25 rg');
  streamLines.push('470 612 Td');
  streamLines.push(`(${escapePdfText('AMOUNT')}) Tj`);
  streamLines.push('ET');

  // Item Row
  const itemDesc = `PolicyDiff ${invoice.plan} Subscription (${invoice.billingPeriod.toLowerCase()})`;
  const periodDesc = invoice.billingPeriod === 'ANNUAL' ? '12 Months (2 Free)' : '1 Month';

  streamLines.push('BT');
  streamLines.push('/F1 10 Tf');
  streamLines.push('0 0 0 rg');
  streamLines.push('60 585 Td');
  streamLines.push(`(${escapePdfText(itemDesc)}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F1 10 Tf');
  streamLines.push('0.3 0.3 0.3 rg');
  streamLines.push('340 585 Td');
  streamLines.push(`(${escapePdfText(periodDesc)}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F2 10 Tf');
  streamLines.push('0 0 0 rg');
  streamLines.push('470 585 Td');
  streamLines.push(`(${escapePdfText(formattedAmount)}) Tj`);
  streamLines.push('ET');

  // Row separator
  streamLines.push('q');
  streamLines.push('0.9 0.9 0.9 RG');
  streamLines.push('1 w');
  streamLines.push('50 572 m 545 572 l S');
  streamLines.push('Q');

  // Total summary block
  streamLines.push('BT');
  streamLines.push('/F1 10 Tf');
  streamLines.push('0.4 0.4 0.4 rg');
  streamLines.push('370 545 Td');
  streamLines.push(`(${escapePdfText('Total Amount:')}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F1 10 Tf');
  streamLines.push('0 0 0 rg');
  streamLines.push('470 545 Td');
  streamLines.push(`(${escapePdfText(formattedAmount)}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F1 10 Tf');
  streamLines.push('0.4 0.4 0.4 rg');
  streamLines.push('370 525 Td');
  streamLines.push(`(${escapePdfText('Amount Paid:')}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F1 10 Tf');
  streamLines.push('0.1 0.6 0.2 rg');
  streamLines.push('470 525 Td');
  streamLines.push(`(${escapePdfText(formattedPaid)}) Tj`);
  streamLines.push('ET');

  // Balance Due (Highlighted Box)
  streamLines.push('q');
  streamLines.push('0.96 0.97 1.0 rg');
  streamLines.push('350 492 195 24 re f');
  streamLines.push('0.2 0.35 0.75 RG');
  streamLines.push('1 w');
  streamLines.push('350 492 195 24 re S');
  streamLines.push('Q');

  streamLines.push('BT');
  streamLines.push('/F2 11 Tf');
  streamLines.push('0.1 0.2 0.5 rg');
  streamLines.push('365 500 Td');
  streamLines.push(`(${escapePdfText('Balance Due:')}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F2 12 Tf');
  streamLines.push('0.1 0.2 0.5 rg');
  streamLines.push('470 500 Td');
  streamLines.push(`(${escapePdfText(formattedBalance)}) Tj`);
  streamLines.push('ET');

  // ── PAYMENT INSTRUCTIONS BOX (Crucial Requirement) ───────────────────
  // Bank details loaded strictly from env config
  streamLines.push('q');
  streamLines.push('0.97 0.98 0.99 rg');
  streamLines.push('50 220 495 240 re f');
  streamLines.push('0.8 0.85 0.9 RG');
  streamLines.push('1 w');
  streamLines.push('50 220 495 240 re S');
  streamLines.push('Q');

  streamLines.push('BT');
  streamLines.push('/F2 12 Tf');
  streamLines.push('0.1 0.2 0.4 rg');
  streamLines.push('65 435 Td');
  streamLines.push(`(${escapePdfText('BANK TRANSFER PAYMENT INSTRUCTIONS')}) Tj`);
  streamLines.push('ET');

  streamLines.push('BT');
  streamLines.push('/F1 9.5 Tf');
  streamLines.push('0.2 0.2 0.2 rg');
  streamLines.push('65 415 Td');
  streamLines.push(`(${escapePdfText('Please transfer payment via ACH or Wire Transfer using the exact details below:')}) Tj`);
  streamLines.push('ET');

  const bankEntries = [
    ['Beneficiary Name:', bank.beneficiaryName],
    ['Bank Name:', bank.bankName],
    ['Routing Number (ABA):', bank.routingNumber],
    ['Account Number:', bank.accountNumber],
    ['SWIFT / BIC:', bank.swiftBic || 'N/A'],
    ['Bank Address:', bank.bankAddress || 'N/A'],
    ['Required Reference / Memo:', invoice.invoiceNumber],
  ];

  let yPos = 390;
  for (const [label, val] of bankEntries) {
    streamLines.push('BT');
    streamLines.push('/F2 9.5 Tf');
    streamLines.push('0.3 0.3 0.3 rg');
    streamLines.push(`65 ${yPos} Td`);
    streamLines.push(`(${escapePdfText(label)}) Tj`);
    streamLines.push('ET');

    streamLines.push('BT');
    streamLines.push(label.startsWith('Required') ? '/F2 10 Tf' : '/F1 9.5 Tf');
    streamLines.push(label.startsWith('Required') ? '0.8 0.1 0.1 rg' : '0 0 0 rg');
    streamLines.push(`230 ${yPos} Td`);
    streamLines.push(`(${escapePdfText(val)}) Tj`);
    streamLines.push('ET');
    yPos -= 18;
  }

  // Processing note at bottom of bank box
  streamLines.push('BT');
  streamLines.push('/F1 9 Tf');
  streamLines.push('0.4 0.4 0.4 rg');
  streamLines.push(`65 240 Td`);
  streamLines.push(`(${escapePdfText(`* Expected processing time: ${bank.processingEstimate}. Always include the reference number in your wire memo.`)}) Tj`);
  streamLines.push('ET');

  // Footer
  streamLines.push('BT');
  streamLines.push('/F1 8.5 Tf');
  streamLines.push('0.5 0.5 0.5 rg');
  streamLines.push('50 140 Td');
  streamLines.push(`(${escapePdfText(`Questions regarding this invoice? Contact ${bank.supportEmail}`)}) Tj`);
  streamLines.push('T*');
  streamLines.push(`(${escapePdfText(`${bank.beneficiaryName} | ${bank.companyAddress}`)}) Tj`);
  streamLines.push('ET');

  const streamContent = streamLines.join('\n');
  const streamLength = Buffer.byteLength(streamContent, 'utf-8');

  // Assemble full PDF 1.4 syntax
  const pdfParts: string[] = [];
  pdfParts.push('%PDF-1.4\n');

  const objects: string[] = [];

  // Obj 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Obj 2: Pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // Obj 3: Page
  objects.push(
    '3 0 obj\n' +
      '<< /Type /Page\n' +
      '   /Parent 2 0 R\n' +
      '   /MediaBox [0 0 595.28 841.89]\n' +
      '   /Contents 4 0 R\n' +
      '   /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >>\n' +
      '>>\n' +
      'endobj\n'
  );

  // Obj 4: Content Stream
  objects.push(
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`
  );

  // Obj 5: Font Helvetica
  objects.push(
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n'
  );

  // Obj 6: Font Helvetica-Bold
  objects.push(
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n'
  );

  // Calculate Xref table offsets
  let currentOffset = Buffer.byteLength(pdfParts[0], 'utf-8');
  const offsets: number[] = [0]; // obj 0

  for (const obj of objects) {
    offsets.push(currentOffset);
    currentOffset += Buffer.byteLength(obj, 'utf-8');
  }

  let body = pdfParts[0] + objects.join('');
  const xrefOffset = Buffer.byteLength(body, 'utf-8');

  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    const offStr = String(offsets[i]).padStart(10, '0');
    xref += `${offStr} 00000 n \n`;
  }

  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(body + xref + trailer, 'utf-8');
}
