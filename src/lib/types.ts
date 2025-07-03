export interface ImagenApiEvent extends CustomEvent {
  detail: string;
}

export type CanvasSize = {
  width: number;
  height: number;
};

export type MaskBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};
