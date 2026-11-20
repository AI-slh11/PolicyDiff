export type TextBlockSource = 'TEXT_LAYER' | 'OCR';

export interface BoundingBox {
  x0: number; // left
  y0: number; // bottom / top
  x1: number; // right
  y1: number; // top / bottom
}

export interface NormalizedTextBlock {
  id: string;
  page: number;
  blockIndex: number;
  text: string;
  bbox: BoundingBox;
  confidence: number; // 1.0 for native text, 0.0 - 1.0 for OCR
  source: TextBlockSource;
}

export interface NormalizedPage {
  pageNumber: number;
  width: number;
  height: number;
  hasTextLayer: boolean;
  blocks: NormalizedTextBlock[];
}

export interface IngestionResult {
  documentId: string;
  pageCount: number;
  hasTextLayerCount: number;
  ocrPageCount: number;
  totalBlocks: number;
  pages: NormalizedPage[];
}
