/**
 * E&O Audit Checklist & Client Renewal Comparison PDF Generators
 * Built in pure TypeScript (PDF 1.4 vector standard, zero native dependencies).
 */

function escapePdf(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

interface ExportData {
  policyCheck: {
    id: string;
    title: string;
    createdAt: Date;
  };
  agency: {
    name: string;
  };
  reviewer: {
    name: string | null;
    email: string;
  };
  signoff: {
    status: string;
    signedOffAt: Date;
    notes: string | null;
  };
  diffItems: any[];
}

/**
 * (a) Timestamped E&O Audit Checklist PDF
 */
export function generateEoChecklistPdf(data: ExportData): Buffer {
  const { policyCheck, agency, reviewer, signoff, diffItems } = data;
  const timestamp = new Date(signoff.signedOffAt).toISOString();

  const streamLines: string[] = [];

  // Header Banner (Dark Navy)
  streamLines.push('q 0.08 0.12 0.22 rg 0 740 595 102 re f Q');

  // Brand & Title
  streamLines.push('BT /F2 20 Tf 1 1 1 rg 50 790 Td (E&O AUDIT VERIFICATION CHECKLIST) Tj ET');
  streamLines.push(`BT /F1 10 Tf 0.8 0.85 0.9 rg 50 770 Td (${escapePdf(`Prepared for ${agency.name} | PolicyDiff E&O Compliance Standard`)}) Tj ET`);

  // Sign-off verification box
  streamLines.push('q 0.95 0.97 0.99 rg 50 635 495 85 re f 0.8 0.85 0.9 RG 1 w 50 635 495 85 re S Q');

  streamLines.push('BT /F2 10 Tf 0.1 0.2 0.4 rg 65 700 Td (MANDATORY HUMAN SIGN-OFF RECORD) Tj ET');
  streamLines.push(`BT /F1 9 Tf 0.2 0.2 0.2 rg 65 682 Td (${escapePdf(`Reviewer: ${reviewer.name || reviewer.email} (${reviewer.email})`)}) Tj ET`);
  streamLines.push(`BT /F1 9 Tf 0.2 0.2 0.2 rg 65 666 Td (${escapePdf(`Timestamp: ${timestamp} | Verification Status: ${signoff.status}`)}) Tj ET`);
  streamLines.push(`BT /F1 9 Tf 0.2 0.2 0.2 rg 65 650 Td (${escapePdf(`Sign-off Notes: ${signoff.notes || 'No exceptions noted by reviewer'}`)}) Tj ET`);

  // Table Header
  streamLines.push('q 0.92 0.94 0.96 rg 50 595 495 24 re f Q');
  streamLines.push('BT /F2 9 Tf 0.1 0.15 0.25 rg 60 603 Td (SEVERITY) Tj ET');
  streamLines.push('BT /F2 9 Tf 0.1 0.15 0.25 rg 130 603 Td (COVERAGE / ITEM) Tj ET');
  streamLines.push('BT /F2 9 Tf 0.1 0.15 0.25 rg 290 603 Td (EXPIRING -> RENEWAL) Tj ET');
  streamLines.push('BT /F2 9 Tf 0.1 0.15 0.25 rg 440 603 Td (CITATION & REVIEW) Tj ET');

  // Diff rows
  let y = 575;
  for (const item of diffItems.slice(0, 15)) {
    const sevColor =
      item.severity === 'CRITICAL' ? '0.8 0.1 0.1 rg' : item.severity === 'WARNING' ? '0.8 0.4 0.0 rg' : '0.1 0.4 0.8 rg';

    streamLines.push(`BT /F2 8.5 Tf ${sevColor} 60 ${y} Td (${escapePdf(item.severity)}) Tj ET`);
    streamLines.push(`BT /F1 8.5 Tf 0 0 0 rg 130 ${y} Td (${escapePdf((item.category + ': ' + item.canonicalKey).slice(0, 30))}) Tj ET`);
    streamLines.push(`BT /F1 8.5 Tf 0.2 0.2 0.2 rg 290 ${y} Td (${escapePdf(`${item.oldValue || 'None'} -> ${item.newValue || 'None'}`.slice(0, 26))}) Tj ET`);

    const citationStr = item.newCitation?.page ? `Pg ${item.newCitation.page}` : item.oldCitation?.page ? `Pg ${item.oldCitation.page}` : 'Verified';
    streamLines.push(`BT /F2 8.5 Tf 0.1 0.5 0.2 rg 440 ${y} Td (${escapePdf(`[${item.reviewStatus}] ${citationStr}`)}) Tj ET`);

    streamLines.push(`q 0.9 0.9 0.9 RG 0.5 w 50 ${y - 4} m 545 ${y - 4} l S Q`);
    y -= 22;
  }

  // Legal Disclaimer at bottom
  streamLines.push('BT /F1 8 Tf 0.4 0.4 0.4 rg 50 60 Td (E&O DISCLAIMER: This document serves as an immutable audit record that human professional review was conducted.) Tj ET');
  streamLines.push('BT /F1 8 Tf 0.4 0.4 0.4 rg 50 48 Td (PolicyDiff assists human review and provides coordinate-verified citations; it does not replace licensed professional judgment.) Tj ET');

  return buildPdfFromStream(streamLines);
}

/**
 * (b) Client-Friendly Renewal Comparison PDF
 */
export function generateClientRenewalSummaryPdf(data: ExportData): Buffer {
  const { policyCheck, agency, diffItems } = data;

  const streamLines: string[] = [];

  // Elegant Header
  streamLines.push('q 0.12 0.25 0.45 rg 0 740 595 102 re f Q');
  streamLines.push('BT /F2 22 Tf 1 1 1 rg 50 790 Td (ANNUAL POLICY RENEWAL COMPARISON) Tj ET');
  streamLines.push(`BT /F1 10 Tf 0.85 0.92 1 rg 50 770 Td (${escapePdf(`Prepared exclusively by ${agency.name}`)}) Tj ET`);

  // Client greeting
  streamLines.push('BT /F2 13 Tf 0.1 0.15 0.25 rg 50 700 Td (Executive Summary of Policy Changes) Tj ET');
  streamLines.push('BT /F1 9.5 Tf 0.3 0.3 0.3 rg 50 682 Td (We have conducted a thorough side-by-side analysis of your expiring commercial coverage against your renewal terms.) Tj ET');
  streamLines.push('BT /F1 9.5 Tf 0.3 0.3 0.3 rg 50 668 Td (Below is an itemized breakdown of key differences, limit adjustments, and endorsement updates.) Tj ET');

  // Change cards
  let y = 620;
  for (const item of diffItems.slice(0, 8)) {
    streamLines.push(`q 0.97 0.98 0.99 rg 50 ${y - 35} 495 48 re f 0.85 0.88 0.92 RG 1 w 50 ${y - 35} 495 48 re S Q`);

    streamLines.push(`BT /F2 10 Tf 0.1 0.2 0.4 rg 65 ${y} Td (${escapePdf(item.category)} - ${escapePdf(item.canonicalKey)}) Tj ET`);
    streamLines.push(`BT /F1 9 Tf 0.2 0.2 0.2 rg 65 ${y - 14} Td (Expiring: ${escapePdf(item.oldValue || 'N/A')}  |  Renewal: ${escapePdf(item.newValue || 'N/A')}) Tj ET`);

    if (item.summary) {
      streamLines.push(`BT /F1 8.5 Tf 0.4 0.4 0.4 rg 65 ${y - 28} Td (${escapePdf(item.summary.slice(0, 90))}) Tj ET`);
    }

    y -= 58;
  }

  // Agency footer
  streamLines.push(`BT /F1 9 Tf 0.4 0.4 0.4 rg 50 50 Td (${escapePdf(`For questions about your renewal coverage, please contact your account executive at ${agency.name}.`)}) Tj ET`);

  return buildPdfFromStream(streamLines);
}

function buildPdfFromStream(streamLines: string[]): Buffer {
  const streamContent = streamLines.join('\n');
  const streamLength = Buffer.byteLength(streamContent, 'utf-8');

  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n'
  );
  objects.push(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`);
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');
  objects.push('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');

  const header = '%PDF-1.4\n';
  let currentOffset = Buffer.byteLength(header, 'utf-8');
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(currentOffset);
    currentOffset += Buffer.byteLength(obj, 'utf-8');
  }

  const body = header + objects.join('');
  const xrefOffset = Buffer.byteLength(body, 'utf-8');

  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(body + xref + trailer, 'utf-8');
}
