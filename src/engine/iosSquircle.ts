/**
 * Exact iOS Continuous-Curvature Squircle Geometry Engine.
 * Mirrors Apple UIKit continuous rounded-rect / Figma 60% corner smoothing math
 * and Launcher3's IosSquircleAdapter.java.
 */

export const IOS_CORNER_RADIUS_RATIO = 0.2237;
export const IOS_CORNER_SMOOTHING = 0.6;

export interface SquircleCornerGeometry {
  r: number;
  p: number;
  a: number;
  b: number;
  c: number;
  d: number;
  arcMeasure: number;
  angleAlpha: number;
  arcSectionLength: number;
  arcEndOffset: number;
}

export function computeSquircleCornerGeometry(
  size: number,
  radiusRatio: number = IOS_CORNER_RADIUS_RATIO,
  smoothing: number = IOS_CORNER_SMOOTHING
): SquircleCornerGeometry {
  const r = Math.max(0.001, size * radiusRatio);
  const p = Math.min(size / 2, (1 + smoothing) * r);
  const effS = r > 0 ? p / r - 1 : 0;

  const arcMeasure = 90 * (1 - effS);
  const arcHalfRad = ((arcMeasure / 2) * Math.PI) / 180;
  const arcSectionLength = Math.sin(arcHalfRad) * r * Math.SQRT2;
  const angleAlpha = (90 - arcMeasure) / 2;
  const p3ToP4 = r * Math.tan(((angleAlpha / 2) * Math.PI) / 180);
  const angleBeta = 45 * effS;
  const c = p3ToP4 * Math.cos((angleBeta * Math.PI) / 180);
  const d = p3ToP4 * Math.sin((angleBeta * Math.PI) / 180);
  const b = Math.max(0, (p - arcSectionLength - c - d) / 3);
  const a = 2 * b;
  const arcEndOffset = p - a - b - c;

  return {
    r,
    p,
    a,
    b,
    c,
    d,
    arcMeasure,
    angleAlpha,
    arcSectionLength,
    arcEndOffset,
  };
}

/**
 * Generates an exact SVG path string for the iOS continuous squircle
 * centered in a square starting at (offsetX, offsetY) of width/height = size.
 */
export function buildIosSquircleSvgPath(
  size: number,
  radiusRatio: number = IOS_CORNER_RADIUS_RATIO,
  smoothing: number = IOS_CORNER_SMOOTHING,
  offsetX: number = 0,
  offsetY: number = 0
): string {
  const g = computeSquircleCornerGeometry(size, radiusRatio, smoothing);
  const f = (n: number) => Number(n.toFixed(3));
  const left = offsetX;
  const top = offsetY;
  const right = offsetX + size;
  const bottom = offsetY + size;

  return [
    `M ${f(right - g.p)},${f(top)}`,
    `C ${f(right - g.p + g.a)},${f(top)} ${f(right - g.p + g.a + g.b)},${f(top)} ${f(right - g.p + g.a + g.b + g.c)},${f(top + g.d)}`,
    `A ${f(g.r)},${f(g.r)} 0 0 1 ${f(right - g.d)},${f(top + g.arcEndOffset)}`,
    `C ${f(right)},${f(top + g.p - g.a - g.b)} ${f(right)},${f(top + g.p - g.a)} ${f(right)},${f(top + g.p)}`,
    `L ${f(right)},${f(bottom - g.p)}`,
    `C ${f(right)},${f(bottom - g.p + g.a)} ${f(right)},${f(bottom - g.p + g.a + g.b)} ${f(right - g.d)},${f(bottom - g.arcEndOffset)}`,
    `A ${f(g.r)},${f(g.r)} 0 0 1 ${f(right - g.arcEndOffset)},${f(bottom - g.d)}`,
    `C ${f(right - g.p + g.a + g.b)},${f(bottom)} ${f(right - g.p + g.a)},${f(bottom)} ${f(right - g.p)},${f(bottom)}`,
    `L ${f(left + g.p)},${f(bottom)}`,
    `C ${f(left + g.p - g.a)},${f(bottom)} ${f(left + g.p - g.a - g.b)},${f(bottom)} ${f(left + g.arcEndOffset)},${f(bottom - g.d)}`,
    `A ${f(g.r)},${f(g.r)} 0 0 1 ${f(left + g.d)},${f(bottom - g.arcEndOffset)}`,
    `C ${f(left)},${f(bottom - g.p + g.a + g.b)} ${f(left)},${f(bottom - g.p + g.a)} ${f(left)},${f(bottom - g.p)}`,
    `L ${f(left)},${f(top + g.p)}`,
    `C ${f(left)},${f(top + g.p - g.a)} ${f(left)},${f(top + g.p - g.a - g.b)} ${f(left + g.d)},${f(top + g.arcEndOffset)}`,
    `A ${f(g.r)},${f(g.r)} 0 0 1 ${f(left + g.arcEndOffset)},${f(top + g.d)}`,
    `C ${f(left + g.p - g.a - g.b)},${f(top)} ${f(left + g.p - g.a)},${f(top)} ${f(left + g.p)},${f(top)}`,
    'Z',
  ].join(' ');
}

/**
 * Traces the exact iOS continuous squircle onto a CanvasRenderingContext2D using Path2D.
 */
export function createIosSquirclePath2D(
  size: number,
  radiusRatio: number = IOS_CORNER_RADIUS_RATIO,
  smoothing: number = IOS_CORNER_SMOOTHING,
  offsetX: number = 0,
  offsetY: number = 0
): Path2D {
  return new Path2D(buildIosSquircleSvgPath(size, radiusRatio, smoothing, offsetX, offsetY));
}

export const IOS_MASK_PATH_100 = buildIosSquircleSvgPath(100, 0.2237, 0.6);
export const LAUNCHER3_LEGACY_SQUIRCLE_100 =
  'M50,0 C10,0 0,10 0,50 0,90 10,100 50,100 90,100 100,90 100,50 100,10 90,0 50,0 Z';

export function buildStandardRoundedRectPath(size: number, radiusRatio: number): string {
  const r = size * radiusRatio;
  const f = (n: number) => Number(n.toFixed(3));
  return [
    `M ${f(r)},0`,
    `L ${f(size - r)},0`,
    `A ${f(r)},${f(r)} 0 0 1 ${f(size)},${f(r)}`,
    `L ${f(size)},${f(size - r)}`,
    `A ${f(r)},${f(r)} 0 0 1 ${f(size - r)},${f(size)}`,
    `L ${f(r)},${f(size)}`,
    `A ${f(r)},${f(r)} 0 0 1 0,${f(size - r)}`,
    `L 0,${f(r)}`,
    `A ${f(r)},${f(r)} 0 0 1 ${f(r)},0`,
    'Z',
  ].join(' ');
}
