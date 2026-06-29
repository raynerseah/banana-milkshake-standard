export interface AdCopy {
  headline: string;
  description: string;
  cta: string;
}

export interface ImageData {
  data: string;
  mimeType: string;
}

export type AdGenerationStatus = 'idle' | 'loading' | 'success' | 'error';

export interface GeneratedAd {
  id: string;
  index: number; // Corresponds to the position in the flattened array of (ratios x styles)
  status: AdGenerationStatus;
  imageUrl: string | null;
  error?: string;
  history: string[]; // For undo/redo functionality
  aspectRatio: string;
}