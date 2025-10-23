export interface FilterSettings {
  brightness: number;
  contrast: number;
  grayscale: number;
  rotation: number;
  sharpen: number;
}

export interface OcrWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number; };
}

export interface OcrData {
  text: string;
  words: OcrWord[];
  scaleFactor: number;
}

export interface Page {
  id: string;
  originalSrc: string; // base64 data URL
  name: string;
  filterSettings: FilterSettings;
  ocrData?: OcrData;
  isSelected?: boolean;
  isIndexing?: boolean;
}

export type SearchMode = 'name' | 'deep';

export type SearchResult = {
  pageIndex: number;
  wordMatches: {
    wordIndex: number;
    bbox: { x0: number; y0: number; x1: number; y1: number; };
  }[];
};

// Electron API exposed via preload script
export interface IElectronAPI {
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  getTessdataLangPath: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
