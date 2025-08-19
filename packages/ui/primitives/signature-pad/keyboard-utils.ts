export enum KeyboardLayout {
  QWERTY = 'QWERTY',
}

export type CurveType =
  | 'linear'
  | 'simple-curve'
  | 'quadratic-bezier'
  | 'cubic-bezier'
  | 'catmull-rom';

export enum StrokeStyle {
  SOLID = 'solid',
  GRADIENT = 'gradient',
}

export interface StrokeConfig {
  style: StrokeStyle;
  color: string;
  gradientStart: string;
  gradientEnd: string;
  width: number;
}

export interface Point {
  x: number;
  y: number;
}

export const getKeyboardLayout = (
  layout: KeyboardLayout,
  includeNumbers: boolean = false,
): Record<string, Point> => {
  const qwertyLayout: Record<string, Point> = {
    Q: { x: 0, y: includeNumbers ? 1 : 0 },
    W: { x: 1, y: includeNumbers ? 1 : 0 },
    E: { x: 2, y: includeNumbers ? 1 : 0 },
    R: { x: 3, y: includeNumbers ? 1 : 0 },
    T: { x: 4, y: includeNumbers ? 1 : 0 },
    Y: { x: 5, y: includeNumbers ? 1 : 0 },
    U: { x: 6, y: includeNumbers ? 1 : 0 },
    I: { x: 7, y: includeNumbers ? 1 : 0 },
    O: { x: 8, y: includeNumbers ? 1 : 0 },
    P: { x: 9, y: includeNumbers ? 1 : 0 },

    A: { x: 0.5, y: includeNumbers ? 2 : 1 },
    S: { x: 1.5, y: includeNumbers ? 2 : 1 },
    D: { x: 2.5, y: includeNumbers ? 2 : 1 },
    F: { x: 3.5, y: includeNumbers ? 2 : 1 },
    G: { x: 4.5, y: includeNumbers ? 2 : 1 },
    H: { x: 5.5, y: includeNumbers ? 2 : 1 },
    J: { x: 6.5, y: includeNumbers ? 2 : 1 },
    K: { x: 7.5, y: includeNumbers ? 2 : 1 },
    L: { x: 8.5, y: includeNumbers ? 2 : 1 },

    Z: { x: 1, y: includeNumbers ? 3 : 2 },
    X: { x: 2, y: includeNumbers ? 3 : 2 },
    C: { x: 3, y: includeNumbers ? 3 : 2 },
    V: { x: 4, y: includeNumbers ? 3 : 2 },
    B: { x: 5, y: includeNumbers ? 3 : 2 },
    N: { x: 6, y: includeNumbers ? 3 : 2 },
    M: { x: 7, y: includeNumbers ? 3 : 2 },
  };

  if (includeNumbers) {
    const numberRow = {
      '1': { x: 0, y: 0 },
      '2': { x: 1, y: 0 },
      '3': { x: 2, y: 0 },
      '4': { x: 3, y: 0 },
      '5': { x: 4, y: 0 },
      '6': { x: 5, y: 0 },
      '7': { x: 6, y: 0 },
      '8': { x: 7, y: 0 },
      '9': { x: 8, y: 0 },
      '0': { x: 9, y: 0 },
    };
    return { ...numberRow, ...qwertyLayout };
  }

  return qwertyLayout;
};

export const generatePath = (points: Point[], curveType: CurveType): string => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  switch (curveType) {
    case 'linear':
      return generateLinearPath(points);
    case 'simple-curve':
      return generateSimpleCurvePath(points);
    case 'quadratic-bezier':
      return generateQuadraticBezierPath(points);
    case 'cubic-bezier':
      return generateCubicBezierPath(points);
    case 'catmull-rom':
      return generateCatmullRomPath(points);
    default:
      return generateLinearPath(points);
  }
};

const generateLinearPath = (points: Point[]): string => {
  if (points.length === 0) return '';

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  return path;
};

const generateSimpleCurvePath = (points: Point[]): string => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;

    if (i === 1) {
      path += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
    } else {
      path += ` T ${midX} ${midY}`;
    }
  }

  const lastPoint = points[points.length - 1];
  path += ` T ${lastPoint.x} ${lastPoint.y}`;

  return path;
};

const generateQuadraticBezierPath = (points: Point[]): string => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const controlX = prev.x + (curr.x - prev.x) * 0.5;
    const controlY = prev.y - Math.abs(curr.x - prev.x) * 0.3;

    path += ` Q ${controlX} ${controlY} ${curr.x} ${curr.y}`;
  }

  return path;
};

const generateCubicBezierPath = (points: Point[]): string => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;

    const cp1x = prev.x + dx * 0.25;
    const cp1y = prev.y + dy * 0.25 - Math.abs(dx) * 0.2;

    const cp2x = prev.x + dx * 0.75;
    const cp2y = prev.y + dy * 0.75 - Math.abs(dx) * 0.2;

    path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${curr.x} ${curr.y}`;
  }

  return path;
};

const generateCatmullRomPath = (points: Point[]): string => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return generateLinearPath(points);

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    const p0 = i === 1 ? points[0] : points[i - 2];
    const p1 = points[i - 1];
    const p2 = points[i];
    const p3 = i === points.length - 1 ? points[i] : points[i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;

    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }

  return path;
};
