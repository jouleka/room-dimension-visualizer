export interface Wall {
  id: string;
}

export interface Corner {
  id: string;
  x: number;
  y: number;
  wallStarts: { id: string }[];
  wallEnds: { id: string }[];
}

export interface NormalizedDimension {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RoomData {
  walls: Wall[];
  corners: Corner[];
}

export interface Dimension {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  value: number;
}

export interface RoomDimension {
  length: Dimension;
  width: Dimension;
}
