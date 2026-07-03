export interface Box {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProcessedImage {
  id: string;
  file: File;
  dataUrl: string;
  width: number;
  height: number;
  boxes: Box[];
}
