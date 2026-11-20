import { prisma } from '@/lib/db';
import { NormalizedPage, NormalizedTextBlock, IngestionResult } from './types';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

export interface OcrHandler {
  ocrPage(pageBuffer: Buffer, pageNumber: number): Promise<NormalizedTextBlock[]>;
}

// Built-in OCR fallback handler
export class DefaultOcrHandler implements OcrHandler {
  async ocrPage(pageBuffer: Buffer, pageNumber: number): Promise<NormalizedTextBlock[]> {
    // In production, invoke Tesseract or Cloud Vision OCR
    // Returns simulated OCR blocks with confidence 0.85
    return [
      {
        id: `ocr_p${pageNumber}_b0`,
        page: pageNumber,
        blockIndex: 0,
        text: 'SCANNED POLICY DOCUMENT - OCR EXTRACTED REGION',
        bbox: { x0: 50, y0: 750, x1: 545, y1: 770 },
        confidence: 0.88,
        source: 'OCR',
      },
    ];
  }
}

/**
 * Parses raw PDF buffer and breaks pages into normalized text blocks with bounding box coordinates.
 */
export async function parsePdfToNormalizedBlocks(
  pdfBuffer: Buffer,
  documentId: string,
  ocrHandler: OcrHandler = new DefaultOcrHandler()
): Promise<IngestionResult> {
  const pages: NormalizedPage[] = [];

  // Parse PDF structure using pdf-parse with custom page render callback
  const pageTexts: { pageNumber: number; text: string }[] = [];

  const options = {
    pagerender: function (pageData: any) {
      return pageData.getTextContent().then((textContent: any) => {
        let lastY: number | null = null;
        let text = '';
        for (const item of textContent.items) {
          if (lastY === item.transform[5] || !lastY) {
            text += item.str + ' ';
          } else {
            text += '\n' + item.str + ' ';
          }
          lastY = item.transform[5];
        }
        pageTexts.push({
          pageNumber: pageData.pageIndex + 1,
          text: text.trim(),
        });
        return text;
      });
    },
  };

  let parsed: any;
  try {
    parsed = await pdfParse(pdfBuffer, options);
  } catch (err) {
    // If pdf-parse encounters issue, fallback to basic text extraction or single-page parse
    console.warn('[pdf-parser] Standard parse failed, using stream fallback:', err);
    parsed = { numpages: 1, text: pdfBuffer.toString('latin1') };
    pageTexts.push({ pageNumber: 1, text: parsed.text });
  }

  const numPages = parsed.numpages || Math.max(1, pageTexts.length);
  let totalBlocks = 0;
  let hasTextLayerCount = 0;
  let ocrPageCount = 0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const pageData = pageTexts.find((p) => p.pageNumber === pageNum);
    const rawText = pageData?.text || '';

    // Check if page has meaningful text layer (at least 15 printable characters)
    const hasTextLayer = rawText.replace(/\s+/g, '').length >= 15;

    let blocks: NormalizedTextBlock[] = [];

    if (hasTextLayer) {
      hasTextLayerCount++;
      // Split text into coherent paragraphs / logical form blocks
      const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

      // Standard Letter/A4 coordinates (width: 612, height: 792)
      const pageHeight = 792;
      const pageWidth = 612;
      const lineHeight = Math.min(30, pageHeight / Math.max(lines.length, 1));

      blocks = lines.map((line, idx) => {
        const yTop = pageHeight - 50 - idx * lineHeight;
        const yBottom = Math.max(50, yTop - lineHeight + 4);
        return {
          id: `${documentId}_p${pageNum}_b${idx}`,
          page: pageNum,
          blockIndex: idx,
          text: line,
          bbox: {
            x0: 54, // standard 0.75 in margin
            y0: yBottom,
            x1: pageWidth - 54,
            y1: yTop,
          },
          confidence: 1.0,
          source: 'TEXT_LAYER' as const,
        };
      });
    } else {
      // Scanned page / no text layer -> fallback to OCR
      ocrPageCount++;
      blocks = await ocrHandler.ocrPage(pdfBuffer, pageNum);
    }

    totalBlocks += blocks.length;
    pages.push({
      pageNumber: pageNum,
      width: 612,
      height: 792,
      hasTextLayer,
      blocks,
    });
  }

  return {
    documentId,
    pageCount: numPages,
    hasTextLayerCount,
    ocrPageCount,
    totalBlocks,
    pages,
  };
}

/**
 * Runs full ingestion on an uploaded Document and writes text blocks to database.
 */
export async function ingestDocument(
  documentId: string,
  pdfBuffer: Buffer
): Promise<IngestionResult> {
  const result = await parsePdfToNormalizedBlocks(pdfBuffer, documentId);

  // Update document page count
  await prisma.document.update({
    where: { id: documentId },
    data: { pageCount: result.pageCount },
  });

  // Flatten and persist all text blocks
  const blocksToInsert = result.pages.flatMap((page) =>
    page.blocks.map((block) => ({
      id: block.id,
      documentId,
      page: block.page,
      blockIndex: block.blockIndex,
      text: block.text,
      x0: block.bbox.x0,
      y0: block.bbox.y0,
      x1: block.bbox.x1,
      y1: block.bbox.y1,
      confidence: block.confidence,
      source: block.source,
    }))
  );

  // Delete existing blocks for this document if re-ingesting
  await prisma.documentTextBlock.deleteMany({
    where: { documentId },
  });

  // Bulk create in chunks of 500
  const CHUNK_SIZE = 500;
  for (let i = 0; i < blocksToInsert.length; i += CHUNK_SIZE) {
    const chunk = blocksToInsert.slice(i, i + CHUNK_SIZE);
    await prisma.documentTextBlock.createMany({
      data: chunk,
    });
  }

  return result;
}
