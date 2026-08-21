/**
 * documenso / documenso cubic bezier signature smoothing
 */
export interface SignaturePoint {
  x: number;
  y: number;
  time?: number;
}

export function generateSvgSmoothPath(points: SignaturePoint[]): string {
  if (points.length < 2) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    path += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
  }
  path += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  return path;
}
