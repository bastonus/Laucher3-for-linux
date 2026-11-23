import {
  AdaptedIconAnalysis,
  AdapterSettings,
  DEFAULT_IOS_ADAPTER_SETTINGS,
  DetectedIconShape,
  FrostIconItem,
} from '../types/adapter';
import { buildIosSquircleSvgPath, createIosSquirclePath2D } from './iosSquircle';

// Launcher3 IconNormalizer constants
const MAX_SQUARE_AREA_FACTOR = 375.0 / 576.0;
const MAX_CIRCLE_AREA_FACTOR = 380.0 / 576.0;
const CIRCLE_AREA_BY_RECT = Math.PI / 4;
const LINEAR_SCALE_SLOPE =
  (MAX_CIRCLE_AREA_FACTOR - MAX_SQUARE_AREA_FACTOR) / (1 - CIRCLE_AREA_BY_RECT);
const MIN_VISIBLE_ALPHA = 40;
const OPAQUE_PLATE_ALPHA = 200;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  const num = parseInt(clean.slice(0, 6), 16);
  if (Number.isNaN(num)) return [63, 109, 245];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h *= 60;
  }
  return [h, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = ((h % 360) + 360) % 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(hue / 360 + 1 / 3) * 255),
    Math.round(hue2rgb(hue / 360) * 255),
    Math.round(hue2rgb(hue / 360 - 1 / 3) * 255),
  ];
}

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
        break;
      case gn:
        h = ((bn - rn) / d + 2) * 60;
        break;
      default:
        h = ((rn - gn) / d + 4) * 60;
        break;
    }
  }
  return [h, s, v];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const l1 = relativeLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const l2 = relativeLuminance(rgb2[0], rgb2[1], rgb2[2]);
  const bright = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (bright + 0.05) / (dark + 0.05);
}

/**
 * Port of Launcher3's ColorExtractor.findDominantColorByHue(bitmap, samples).
 */
export function extractDominantColorFromImageData(
  imageData: ImageData,
  samples: number = 128
): {
  dominantRgb: [number, number, number];
  isMonochrome: boolean;
  sampledPixels: Array<[number, number, number]>;
} {
  const { width, height, data } = imageData;
  const stride = Math.max(1, Math.floor(Math.sqrt((width * height) / samples)));

  const hueHistogram = new Float32Array(360);
  let highScore = -1;
  let bestHue = -1;
  const sampledPixels: Array<[number, number, number]> = [];

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const idx = (y * width + x) * 4;
      const a = data[idx + 3];
      if (a < 128) continue;

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const [h, s, v] = rgbToHsv(r, g, b);
      const hueIdx = clamp(Math.floor(h), 0, 359);

      sampledPixels.push([r, g, b]);
      const score = s * v;
      hueHistogram[hueIdx] += score;
      if (hueHistogram[hueIdx] > highScore) {
        highScore = hueHistogram[hueIdx];
        bestHue = hueIdx;
      }
    }
  }

  if (sampledPixels.length === 0) {
    return {
      dominantRgb: [122, 131, 148],
      isMonochrome: true,
      sampledPixels: [[122, 131, 148]],
    };
  }

  if (highScore < 0.08) {
    return {
      dominantRgb: [100, 116, 139],
      isMonochrome: true,
      sampledPixels,
    };
  }

  const buckets = new Map<number, { score: number; rgb: [number, number, number] }>();
  let bestBucketScore = -1;
  let bestRgb: [number, number, number] = sampledPixels[0];

  for (const rgb of sampledPixels) {
    const [h, s, v] = rgbToHsv(rgb[0], rgb[1], rgb[2]);
    if (clamp(Math.floor(h), 0, 359) === bestHue) {
      const bucket = Math.floor(s * 100) + Math.floor(v * 10000);
      const score = s * v;
      const prev = buckets.get(bucket);
      const nextScore = (prev ? prev.score : 0) + score;
      buckets.set(bucket, { score: nextScore, rgb });
      if (nextScore > bestBucketScore) {
        bestBucketScore = nextScore;
        bestRgb = rgb;
      }
    }
  }

  const [, sat] = rgbToHsl(bestRgb[0], bestRgb[1], bestRgb[2]);
  return {
    dominantRgb: bestRgb,
    isMonochrome: sat < 0.09,
    sampledPixels,
  };
}

function convertToConvexArray(
  xCoordinates: number[],
  direction: 1 | -1,
  topY: number,
  bottomY: number
): void {
  const angles = new Array<number>(xCoordinates.length).fill(0);
  const first = topY;
  let last = -1;
  let lastAngle = Number.MAX_VALUE;

  for (let i = topY + 1; i <= bottomY; i++) {
    if (xCoordinates[i] <= -1) continue;
    let start: number;

    if (lastAngle === Number.MAX_VALUE) {
      start = first;
    } else {
      let currentAngle = (xCoordinates[i] - xCoordinates[last]) / (i - last);
      start = last;
      if ((currentAngle - lastAngle) * direction < 0) {
        while (start > first) {
          start--;
          currentAngle = (xCoordinates[i] - xCoordinates[start]) / (i - start);
          if ((currentAngle - angles[start]) * direction >= 0) {
            break;
          }
        }
      }
    }

    lastAngle = (xCoordinates[i] - xCoordinates[start]) / (i - start);
    for (let j = start; j < i; j++) {
      angles[j] = lastAngle;
      xCoordinates[j] = xCoordinates[start] + lastAngle * (j - start);
    }
    last = i;
  }
}

/**
 * Port of Launcher3's IconNormalizer.getScale(Drawable, ...) convex hull calculation.
 */
export function computeLauncher3NormalizerScale(imageData: ImageData): {
  scale: number;
  bounds: { left: number; top: number; right: number; bottom: number };
} {
  const { width, height, data } = imageData;
  const leftBorder = new Array<number>(height).fill(-1);
  const rightBorder = new Array<number>(height).fill(-1);

  let topY = -1;
  let bottomY = -1;
  let leftX = width + 1;
  let rightX = -1;

  for (let y = 0; y < height; y++) {
    let firstX = -1;
    let lastX = -1;
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > MIN_VISIBLE_ALPHA) {
        if (firstX === -1) firstX = x;
        lastX = x;
      }
    }
    leftBorder[y] = firstX;
    rightBorder[y] = lastX;
    if (firstX !== -1) {
      bottomY = y;
      if (topY === -1) topY = y;
      leftX = Math.min(leftX, firstX);
      rightX = Math.max(rightX, lastX);
    }
  }

  if (topY === -1 || rightX === -1) {
    return {
      scale: 1,
      bounds: { left: 0, top: 0, right: width, bottom: height },
    };
  }

  convertToConvexArray(leftBorder, 1, topY, bottomY);
  convertToConvexArray(rightBorder, -1, topY, bottomY);

  let area = 0;
  for (let y = 0; y < height; y++) {
    if (leftBorder[y] <= -1) continue;
    area += rightBorder[y] - leftBorder[y] + 1;
  }

  const rectArea = (bottomY + 1 - topY) * (rightX + 1 - leftX);
  const hullByRect = rectArea > 0 ? area / rectArea : 1;

  const scaleRequired =
    hullByRect < CIRCLE_AREA_BY_RECT
      ? MAX_CIRCLE_AREA_FACTOR
      : MAX_SQUARE_AREA_FACTOR + LINEAR_SCALE_SLOPE * (1 - hullByRect);

  const areaScale = area / (width * height);
  const scale = areaScale > scaleRequired ? Math.sqrt(scaleRequired / areaScale) : 1;

  return {
    scale,
    bounds: { left: leftX, top: topY, right: rightX, bottom: bottomY },
  };
}

export interface SilhouetteAnalysis {
  detectedShape: DetectedIconShape;
  fillRatio: number;
  /** Tight bounding box normalized [0..1] ignoring drop shadows/glows */
  normLeft: number;
  normTop: number;
  normRight: number;
  normBottom: number;
  normWidth: number;
  normHeight: number;
  normCenterX: number;
  normCenterY: number;
  /** Sampled outer background colors from top-left and bottom-right perimeter */
  perimeterTopLeftHex: string | null;
  perimeterBottomRightHex: string | null;
}

/**
 * Analyzes the opaque container silhouette (ignoring semi-transparent drop shadows)
 * to classify rectangle, rounded-rectangle, squircle, circle, or cutout icons.
 */
export function analyzeOpaqueSilhouette(
  imageData: ImageData,
  iconCategory: string
): SilhouetteAnalysis {
  const { width, height, data } = imageData;

  let topY = -1;
  let bottomY = -1;
  let leftX = width;
  let rightX = -1;
  let opaqueCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a >= OPAQUE_PLATE_ALPHA) {
        opaqueCount++;
        if (topY === -1) topY = y;
        bottomY = y;
        if (x < leftX) leftX = x;
        if (x > rightX) rightX = x;
      }
    }
  }

  if (topY === -1 || rightX < leftX || bottomY < topY) {
    return {
      detectedShape: 'cutout',
      fillRatio: 0,
      normLeft: 0,
      normTop: 0,
      normRight: 1,
      normBottom: 1,
      normWidth: 1,
      normHeight: 1,
      normCenterX: 0.5,
      normCenterY: 0.5,
      perimeterTopLeftHex: null,
      perimeterBottomRightHex: null,
    };
  }

  const bw = rightX - leftX + 1;
  const bh = bottomY - topY + 1;
  const boxArea = bw * bh;
  const fillRatio = boxArea > 0 ? opaqueCount / boxArea : 0;
  const aspectRatio = Math.min(bw, bh) / Math.max(bw, bh);

  const cornerSample = (cxFrac: number, cyFrac: number): boolean => {
    const sx = clamp(Math.round(leftX + bw * cxFrac), 0, width - 1);
    const sy = clamp(Math.round(topY + bh * cyFrac), 0, height - 1);
    return data[(sy * width + sx) * 4 + 3] >= OPAQUE_PLATE_ALPHA;
  };
  const cornerHits03 =
    (cornerSample(0.03, 0.03) ? 1 : 0) +
    (cornerSample(0.97, 0.03) ? 1 : 0) +
    (cornerSample(0.03, 0.97) ? 1 : 0) +
    (cornerSample(0.97, 0.97) ? 1 : 0);

  const cornerHits05 =
    (cornerSample(0.055, 0.055) ? 1 : 0) +
    (cornerSample(0.945, 0.055) ? 1 : 0) +
    (cornerSample(0.055, 0.945) ? 1 : 0) +
    (cornerSample(0.945, 0.945) ? 1 : 0);

  // Check top/bottom/left/right mid-edge continuity so open cutouts & folders
  // do not falsely classify as closed container shapes.
  const midEdgeHits =
    (cornerSample(0.5, 0.04) ? 1 : 0) +
    (cornerSample(0.5, 0.96) ? 1 : 0) +
    (cornerSample(0.04, 0.5) ? 1 : 0) +
    (cornerSample(0.96, 0.5) ? 1 : 0);

  let detectedShape: DetectedIconShape = 'cutout';
  if (iconCategory === 'status' || iconCategory === 'mimetypes') {
    detectedShape = 'cutout';
  } else if (aspectRatio >= 0.85 && midEdgeHits >= 4) {
    if (fillRatio >= 0.97 || cornerHits03 >= 3) {
      detectedShape = 'rectangle';
    } else if (fillRatio >= 0.945 || (cornerHits05 >= 3 && fillRatio >= 0.9)) {
      detectedShape = 'rounded';
    } else if (fillRatio >= 0.845) {
      detectedShape = 'squircle';
    } else if (fillRatio >= 0.725) {
      detectedShape = 'circle';
    }
  } else if (iconCategory === 'places' && aspectRatio >= 0.85 && fillRatio >= 0.9) {
    detectedShape = 'rectangle';
  }

  // Sample outer perimeter background colors using a medoid cluster filter so edge
  // foreground details (e.g. illustration ears/tails touching border) are rejected.
  let perimeterTopLeftHex: string | null = null;
  let perimeterBottomRightHex: string | null = null;

  if (detectedShape !== 'cutout') {
    const sampleMedoidColor = (points: Array<[number, number]>): string | null => {
      const samples: Array<[number, number, number]> = [];
      for (const [fx, fy] of points) {
        const px = clamp(Math.round(leftX + bw * fx), 0, width - 1);
        const py = clamp(Math.round(topY + bh * fy), 0, height - 1);
        const idx = (py * width + px) * 4;
        if (data[idx + 3] >= OPAQUE_PLATE_ALPHA) {
          samples.push([data[idx], data[idx + 1], data[idx + 2]]);
        }
      }
      if (samples.length === 0) return null;

      let bestIdx = 0;
      let bestDistSum = Number.MAX_VALUE;
      for (let i = 0; i < samples.length; i++) {
        let distSum = 0;
        for (let j = 0; j < samples.length; j++) {
          const dr = samples[i][0] - samples[j][0];
          const dg = samples[i][1] - samples[j][1];
          const db = samples[i][2] - samples[j][2];
          distSum += Math.sqrt(dr * dr + dg * dg + db * db);
        }
        if (distSum < bestDistSum) {
          bestDistSum = distSum;
          bestIdx = i;
        }
      }

      const medoid = samples[bestIdx];
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let count = 0;
      for (const s of samples) {
        const dr = s[0] - medoid[0];
        const dg = s[1] - medoid[1];
        const db = s[2] - medoid[2];
        if (Math.sqrt(dr * dr + dg * dg + db * db) <= 48) {
          sr += s[0];
          sg += s[1];
          sb += s[2];
          count++;
        }
      }
      return count > 0 ? rgbToHex(sr / count, sg / count, sb / count) : null;
    };

    const tlPoints: Array<[number, number]> =
      detectedShape === 'circle'
        ? [
            [0.5, 0.06],
            [0.34, 0.11],
            [0.2, 0.22],
            [0.11, 0.34],
            [0.06, 0.5],
          ]
        : [
            [0.08, 0.16],
            [0.06, 0.3],
            [0.05, 0.45],
            [0.16, 0.08],
            [0.3, 0.06],
            [0.45, 0.05],
          ];

    const brPoints: Array<[number, number]> =
      detectedShape === 'circle'
        ? [
            [0.94, 0.5],
            [0.89, 0.66],
            [0.8, 0.78],
            [0.66, 0.89],
            [0.5, 0.94],
          ]
        : [
            [0.92, 0.84],
            [0.94, 0.7],
            [0.95, 0.55],
            [0.84, 0.92],
            [0.7, 0.94],
            [0.55, 0.95],
          ];

    perimeterTopLeftHex = sampleMedoidColor(tlPoints);
    perimeterBottomRightHex = sampleMedoidColor(brPoints);
  }

  return {
    detectedShape,
    fillRatio,
    normLeft: leftX / width,
    normTop: topY / height,
    normRight: (rightX + 1) / width,
    normBottom: (bottomY + 1) / height,
    normWidth: bw / width,
    normHeight: bh / height,
    normCenterX: (leftX + rightX + 1) / (2 * width),
    normCenterY: (topY + bottomY + 1) / (2 * height),
    perimeterTopLeftHex,
    perimeterBottomRightHex,
  };
}

/**
 * Extracts Frost #tint gradient stops directly if present in the SVG so colors match 1:1.
 */
function parseFrostTintStops(svg: string): [string, string] | null {
  const tintMatch = svg.match(
    /<linearGradient[^>]*id=["']tint["'][^>]*>([\s\S]*?)<\/linearGradient>/i
  );
  if (!tintMatch) return null;
  const stops = [...tintMatch[1].matchAll(/stop-color=["']([^"']+)["']/gi)].map((m) => m[1]);
  if (stops.length >= 2) {
    return [stops[0], stops[stops.length - 1]];
  }
  return null;
}

/**
 * Cleans Frost SVG outer contact shadows/glows and optionally promotes Frost app plates
 * to sit directly inside the iOS squircle without double rounded-square borders.
 */
export function prepareSvgForAdaptation(
  icon: FrostIconItem,
  settings: AdapterSettings,
  invertMonochromeToWhite: boolean = false
): { cleanedSvg: string; isSeamlessFrostApp: boolean } {
  let svg = icon.svg;
  let isSeamlessFrostApp = false;

  if (settings.stripFrostOuterShadow) {
    svg = svg.replace(/<ellipse\s+id=["']shadow["'][^>]*\/>/gi, '');
    svg = svg.replace(/<use\s+id=["']glow["'][^>]*\/>/gi, '');
  }

  const hasAppBackRect =
    (icon.category === 'apps' || icon.category === 'custom') &&
    /<rect\s+id=["']back-shape["'][^>]*width=["']104["'][^>]*>/i.test(svg);

  if (settings.frostSeamlessPlate && hasAppBackRect) {
    isSeamlessFrostApp = true;
    svg = svg.replace(/<use\s+id=["']back["'][^>]*\/>/gi, '');
    svg = svg.replace(
      /(<rect\s+id=["']back-shape["'][^>]*?)x=["']12["']\s+y=["']12["']\s+width=["']104["']\s+height=["']104["']\s+rx=["']28["']/i,
      '$1x="0" y="0" width="128" height="128" rx="0"'
    );
  }

  if (icon.category === 'status') {
    const ink = invertMonochromeToWhite ? '#FFFFFF' : '#1E2430';
    svg = svg.replace(/currentColor/g, ink);
    svg = svg.replace(/\.ColorScheme-Text\{color:#232629\}/g, `.ColorScheme-Text{color:${ink}}`);
  }

  return { cleanedSvg: svg, isSeamlessFrostApp };
}

function rgbDistance(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function hueAngleDiff(a: number, b: number): number {
  const d = Math.abs(((a % 360) + 360) % 360 - (((b % 360) + 360) % 360));
  return Math.min(d, 360 - d);
}

function isPurpleHueZone(hue: number): boolean {
  const h = ((hue % 360) + 360) % 360;
  return h >= 248 && h <= 328;
}

function safeArchitecturalHue(targetHue: number): number {
  const h = ((targetHue % 360) + 360) % 360;
  // Keep tinted architectural slates out of the loud purple/violet band (248..328)
  if (h >= 248 && h <= 288) return 226;
  if (h > 288 && h <= 328) return 345;
  return h;
}

function analyzeForegroundHueProfile(fgPixels: Array<[number, number, number]>): {
  occupiedHues: number[];
  isMultiHue: boolean;
} {
  const bins = new Array<number>(12).fill(0);
  let saturatedTotal = 0;
  for (const px of fgPixels) {
    const [h, s, v] = rgbToHsv(px[0], px[1], px[2]);
    if (s >= 0.22 && v >= 0.2) {
      const bin = clamp(Math.floor((((h % 360) + 360) % 360) / 30), 0, 11);
      bins[bin]++;
      saturatedTotal++;
    }
  }
  if (saturatedTotal < 5) {
    return { occupiedHues: [], isMultiHue: false };
  }
  const occupiedHues: number[] = [];
  for (let i = 0; i < 12; i++) {
    if (bins[i] / saturatedTotal >= 0.13) {
      occupiedHues.push(i * 30 + 15);
    }
  }
  let maxSpan = 0;
  for (let i = 0; i < occupiedHues.length; i++) {
    for (let j = i + 1; j < occupiedHues.length; j++) {
      maxSpan = Math.max(maxSpan, hueAngleDiff(occupiedHues[i], occupiedHues[j]));
    }
  }
  return {
    occupiedHues,
    isMultiHue: occupiedHues.length >= 2 && maxSpan >= 48,
  };
}

interface BgCandidate {
  kind:
    | 'light-analogous'
    | 'light-complement'
    | 'deep-analogous'
    | 'deep-complement'
    | 'studio-pearl'
    | 'studio-obsidian'
    | 'mid-steel';
  lightRgb: [number, number, number];
  deepRgb: [number, number, number];
  harmonyBonus: number;
}

function scoreBackgroundCandidate(
  candidate: BgCandidate,
  fgPixels: Array<[number, number, number]>,
  dominantRgb: [number, number, number],
  meanFgRgb: [number, number, number],
  occupiedHues: number[],
  isMultiHue: boolean,
  mode: AdapterSettings['backgroundMode']
): number {
  const { lightRgb, deepRgb, kind } = candidate;
  const contrasts: number[] = [];
  let minFgDist = Number.MAX_VALUE;
  let passCount = 0;

  for (const px of fgPixels) {
    const c = Math.min(contrastRatio(px, lightRgb), contrastRatio(px, deepRgb));
    contrasts.push(c);
    if (c >= 2.8) passCount++;
    const d = Math.min(rgbDistance(px, lightRgb), rgbDistance(px, deepRgb));
    if (d < minFgDist) minFgDist = d;
  }

  contrasts.sort((a, b) => a - b);
  const p20Contrast = contrasts[Math.floor(contrasts.length * 0.2)] ?? 1;
  const meanContrast = contrasts.reduce((acc, v) => acc + v, 0) / Math.max(1, contrasts.length);
  const passFraction = passCount / Math.max(1, contrasts.length);

  const domDist = Math.min(rgbDistance(dominantRgb, lightRgb), rgbDistance(dominantRgb, deepRgb));
  const meanDist = Math.min(rgbDistance(meanFgRgb, lightRgb), rgbDistance(meanFgRgb, deepRgb));
  const sameColorPenalty =
    (domDist < 72 ? -12 - (72 - domDist) * 0.25 : 0) +
    (meanDist < 68 ? -10 - (68 - meanDist) * 0.25 : 0) +
    (minFgDist < 42 ? -4 : 0);

  // Check multi-hue / secondary hue overlap and avoid loud purple backgrounds
  const [bgH, bgS] = rgbToHsl(deepRgb[0], deepRgb[1], deepRgb[2]);
  let hueCollisionPenalty = 0;
  if (bgS >= 0.16) {
    if (isPurpleHueZone(bgH)) {
      hueCollisionPenalty -= 4.5;
    }
    for (const occH of occupiedHues) {
      if (hueAngleDiff(bgH, occH) <= 36) {
        hueCollisionPenalty -= 2.4;
      }
    }
  }

  const isStudioNeutral = kind === 'studio-pearl' || kind === 'studio-obsidian';
  const isLightBg = kind === 'light-analogous' || kind === 'light-complement' || kind === 'studio-pearl';
  const isDeepBg = kind === 'deep-analogous' || kind === 'deep-complement' || kind === 'studio-obsidian';

  let modePreference = candidate.harmonyBonus;
  if (isMultiHue) {
    modePreference += isStudioNeutral ? 2.4 : -1.4;
  }

  if (mode === 'adaptive-deep') {
    if (isDeepBg) modePreference += 4.2;
    else if (kind === 'mid-steel') modePreference += 1.6;
  } else if (mode === 'frosted-glass') {
    if (isLightBg) modePreference += 4.2;
    else if (kind === 'mid-steel') modePreference += 1.2;
  }

  return (
    passFraction * 6.5 +
    Math.min(p20Contrast, 5.5) * 1.15 +
    Math.min(meanContrast, 7.0) * 0.45 +
    modePreference +
    sameColorPenalty +
    hueCollisionPenalty
  );
}

export function computeAdaptedBackground(
  dominantRgb: [number, number, number],
  isMonochrome: boolean,
  settings: AdapterSettings,
  silhouette: SilhouetteAnalysis,
  fgPixels: Array<[number, number, number]>,
  frostTintStops?: [string, string] | null
): {
  bgLightHex: string;
  bgDeepHex: string;
  isDarkBackground: boolean;
  contrastWithWhite: number;
} {
  if (settings.backgroundMode === 'custom') {
    const baseRgb = hexToRgb(settings.customBgColor);
    const [h, s, l] = rgbToHsl(baseRgb[0], baseRgb[1], baseRgb[2]);
    const lightRgb = hslToRgb(h, clamp(s * 0.92, 0.1, 0.9), clamp(l + 0.12, 0.18, 0.88));
    const deepRgb = hslToRgb(h, clamp(s * 1.04, 0.12, 0.96), clamp(l - 0.1, 0.12, 0.72));
    return {
      bgLightHex: rgbToHex(lightRgb[0], lightRgb[1], lightRgb[2]),
      bgDeepHex: rgbToHex(deepRgb[0], deepRgb[1], deepRgb[2]),
      isDarkBackground: relativeLuminance(deepRgb[0], deepRgb[1], deepRgb[2]) < 0.36,
      contrastWithWhite: contrastRatio([255, 255, 255], deepRgb),
    };
  }

  // Container-shaped icons (rectangle, rounded, squircle, circle) keep their sampled
  // outer perimeter color so cropped edges blend seamlessly across the full squircle.
  if (
    settings.backgroundMode === 'adaptive-tint' &&
    silhouette.detectedShape !== 'cutout' &&
    silhouette.perimeterTopLeftHex &&
    silhouette.perimeterBottomRightHex
  ) {
    const lightRgb = hexToRgb(silhouette.perimeterTopLeftHex);
    const deepRgb = hexToRgb(silhouette.perimeterBottomRightHex);
    return {
      bgLightHex: silhouette.perimeterTopLeftHex,
      bgDeepHex: silhouette.perimeterBottomRightHex,
      isDarkBackground: relativeLuminance(deepRgb[0], deepRgb[1], deepRgb[2]) < 0.42,
      contrastWithWhite: contrastRatio([255, 255, 255], lightRgb),
    };
  }

  if (
    frostTintStops &&
    settings.backgroundMode === 'adaptive-tint' &&
    silhouette.detectedShape !== 'cutout'
  ) {
    const lightRgb = hexToRgb(frostTintStops[0]);
    const deepRgb = hexToRgb(frostTintStops[1]);
    return {
      bgLightHex: frostTintStops[0].toUpperCase(),
      bgDeepHex: frostTintStops[1].toUpperCase(),
      isDarkBackground: relativeLuminance(deepRgb[0], deepRgb[1], deepRgb[2]) < 0.42,
      contrastWithWhite: contrastRatio([255, 255, 255], lightRgb),
    };
  }

  // Compute foreground color statistics & occupied hue profile so cutout icons
  // never blend into matching colors or clash on loud purple backdrops.
  const samples = fgPixels.length > 0 ? fgPixels : [dominantRgb];
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (const px of samples) {
    sumR += px[0];
    sumG += px[1];
    sumB += px[2];
  }
  const meanFgRgb: [number, number, number] = [
    sumR / samples.length,
    sumG / samples.length,
    sumB / samples.length,
  ];
  const { occupiedHues, isMultiHue } = analyzeForegroundHueProfile(samples);

  const [h, s] = rgbToHsl(dominantRgb[0], dominantRgb[1], dominantRgb[2]);
  const safeAnaH1 = safeArchitecturalHue(h + 10);
  const safeAnaH2 = safeArchitecturalHue(h + 18);
  const safeCompH1 = safeArchitecturalHue(h + 158);
  const safeCompH2 = safeArchitecturalHue(h + 170);

  const candidates: BgCandidate[] = isMonochrome
    ? [
        {
          kind: 'studio-pearl',
          lightRgb: [246, 248, 252],
          deepRgb: [228, 234, 244],
          harmonyBonus: 1.5,
        },
        {
          kind: 'studio-obsidian',
          lightRgb: [36, 44, 58],
          deepRgb: [19, 24, 34],
          harmonyBonus: 1.2,
        },
        {
          kind: 'mid-steel',
          lightRgb: [122, 134, 154],
          deepRgb: [96, 108, 128],
          harmonyBonus: -1.5,
        },
      ]
    : [
        // Neutral architectural studio pair (ideal for polychromatic/gradient & purple emblems)
        {
          kind: 'studio-pearl',
          lightRgb: [247, 249, 252],
          deepRgb: [232, 237, 245],
          harmonyBonus: 1.35,
        },
        {
          kind: 'studio-obsidian',
          lightRgb: [34, 40, 52],
          deepRgb: [18, 22, 30],
          harmonyBonus: 1.4,
        },
        // Airy analogous pearl-mist (purple-safe hue + high lightness + soft saturation)
        {
          kind: 'light-analogous',
          lightRgb: hslToRgb(safeAnaH1, clamp(s * 0.28, 0.12, 0.3), 0.965),
          deepRgb: hslToRgb(safeAnaH2, clamp(s * 0.34, 0.14, 0.36), 0.895),
          harmonyBonus: 1.45,
        },
        // Soft split-complementary alabaster tint
        {
          kind: 'light-complement',
          lightRgb: hslToRgb(safeCompH1, clamp(s * 0.2, 0.08, 0.22), 0.97),
          deepRgb: hslToRgb(safeCompH2, clamp(s * 0.24, 0.1, 0.26), 0.905),
          harmonyBonus: 1.2,
        },
        // Rich analogous midnight slate (purple-safe deep sapphire/charcoal)
        {
          kind: 'deep-analogous',
          lightRgb: hslToRgb(safeAnaH1, clamp(s * 0.34, 0.14, 0.34), 0.23),
          deepRgb: hslToRgb(safeAnaH2, clamp(s * 0.38, 0.16, 0.38), 0.125),
          harmonyBonus: 1.3,
        },
        // Deep split-complementary midnight slate
        {
          kind: 'deep-complement',
          lightRgb: hslToRgb(safeCompH1, clamp(s * 0.28, 0.12, 0.3), 0.225),
          deepRgb: hslToRgb(safeCompH2, clamp(s * 0.32, 0.14, 0.34), 0.12),
          harmonyBonus: 1.25,
        },
        // Balanced mid-steel slate fallback
        {
          kind: 'mid-steel',
          lightRgb: hslToRgb(safeCompH1, clamp(s * 0.16, 0.06, 0.18), 0.56),
          deepRgb: hslToRgb(safeCompH2, clamp(s * 0.18, 0.08, 0.2), 0.44),
          harmonyBonus: -1.8,
        },
      ];

  let bestCandidate = candidates[0];
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const score = scoreBackgroundCandidate(
      candidate,
      samples,
      dominantRgb,
      meanFgRgb,
      occupiedHues,
      isMultiHue,
      settings.backgroundMode
    );
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  const { lightRgb, deepRgb } = bestCandidate;
  return {
    bgLightHex: rgbToHex(lightRgb[0], lightRgb[1], lightRgb[2]),
    bgDeepHex: rgbToHex(deepRgb[0], deepRgb[1], deepRgb[2]),
    isDarkBackground: relativeLuminance(deepRgb[0], deepRgb[1], deepRgb[2]) < 0.38,
    contrastWithWhite: contrastRatio([255, 255, 255], deepRgb),
  };
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export interface RenderedAdaptation {
  pngDataUrl: string;
  svgString: string;
  analysis: AdaptedIconAnalysis;
}

/**
 * Full Launcher3-style icon adaptation pipeline in browser Canvas + SVG.
 * Automatically cuts edges and fills the full iOS squircle when the source icon
 * has a rectangle, rounded-rectangle, squircle, or circular background.
 */
export async function adaptIcon(
  icon: FrostIconItem,
  settings: AdapterSettings = DEFAULT_IOS_ADAPTER_SETTINGS,
  targetSize: number = 256
): Promise<RenderedAdaptation> {
  const analysisSize = 112;
  const frostTintStops = icon.svg ? parseFrostTintStops(icon.svg) : null;

  const rawUrl = icon.dataUrl
    ? icon.dataUrl
    : svgToDataUrl(
        prepareSvgForAdaptation(icon, { ...settings, frostSeamlessPlate: false }).cleanedSvg
      );

  const rawImg = await loadImageFromUrl(rawUrl);

  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = analysisSize;
  sampleCanvas.height = analysisSize;
  const sampleCtx = sampleCanvas.getContext('2d')!;
  sampleCtx.clearRect(0, 0, analysisSize, analysisSize);
  const rawAspect =
    rawImg.naturalWidth && rawImg.naturalHeight ? rawImg.naturalWidth / rawImg.naturalHeight : 1;
  const fitW = rawAspect >= 1 ? analysisSize : analysisSize * rawAspect;
  const fitH = rawAspect >= 1 ? analysisSize / rawAspect : analysisSize;
  const fitX = (analysisSize - fitW) * 0.5;
  const fitY = (analysisSize - fitH) * 0.5;
  sampleCtx.drawImage(rawImg, fitX, fitY, fitW, fitH);
  const sampleData = sampleCtx.getImageData(0, 0, analysisSize, analysisSize);

  const { dominantRgb, isMonochrome, sampledPixels } = extractDominantColorFromImageData(
    sampleData,
    180
  );
  const { scale: normalizerScale } = computeLauncher3NormalizerScale(sampleData);
  const silhouette = analyzeOpaqueSilhouette(sampleData, icon.category);

  const bg = computeAdaptedBackground(
    dominantRgb,
    isMonochrome,
    settings,
    silhouette,
    sampledPixels,
    frostTintStops
  );
  const [hue, saturation, lightness] = rgbToHsl(dominantRgb[0], dominantRgb[1], dominantRgb[2]);

  const { cleanedSvg, isSeamlessFrostApp } = icon.dataUrl
    ? { cleanedSvg: '', isSeamlessFrostApp: false }
    : prepareSvgForAdaptation(icon, settings, icon.category === 'status' && bg.isDarkBackground);

  const fgImg = icon.dataUrl ? rawImg : await loadImageFromUrl(svgToDataUrl(cleanedSvg));

  // Determine effective scale & centering offset so container-shaped icons
  // (rectangle, rounded, squircle, circle) cut their edges cleanly and fill the entire squircle!
  let effectiveScale = settings.foregroundScale;
  let normCenterX = 0.5;
  let normCenterY = 0.5;
  let fullBleedApplied = false;

  if (isSeamlessFrostApp) {
    effectiveScale = 1.04;
    fullBleedApplied = true;
  } else if (
    settings.scaleStrategy === 'launcher3-normalizer' &&
    silhouette.detectedShape !== 'cutout'
  ) {
    fullBleedApplied = true;
    const tightMax = Math.max(silhouette.normWidth, silhouette.normHeight, 0.25);
    const bleedMultiplier =
      silhouette.detectedShape === 'rectangle'
        ? 1.045
        : silhouette.detectedShape === 'rounded'
        ? 1.065
        : silhouette.detectedShape === 'squircle'
        ? 1.08
        : 1.12; // 'circle'
    effectiveScale = clamp((1 / tightMax) * bleedMultiplier, 0.98, 1.55);
    normCenterX = silhouette.normCenterX;
    normCenterY = silhouette.normCenterY;
  } else if (settings.scaleStrategy === 'launcher3-normalizer') {
    let baseScale =
      icon.category === 'status'
        ? 0.56
        : icon.category === 'places' || icon.category === 'mimetypes'
        ? clamp(normalizerScale * 0.84, 0.68, 0.88)
        : clamp(normalizerScale * 0.86, 0.68, 0.92);

    // General extent rule: tightly-cropped, triangular, or hollow cutouts have low pixel area
    // so area-only normalizers scale them too large (~86%). Cap visible bounding extent cleanly
    // inside the iOS squircle safe zone and center on tight opaque bounds.
    const tightMax = Math.max(silhouette.normWidth, silhouette.normHeight);
    if (tightMax > 0.25 && icon.category !== 'status') {
      const maxSafeExtent = silhouette.fillRatio < 0.6 ? 0.63 : 0.71;
      baseScale = Math.min(baseScale, maxSafeExtent / tightMax);
      normCenterX = silhouette.normCenterX;
      normCenterY = silhouette.normCenterY;
    }
    effectiveScale = clamp(baseScale, 0.52, 0.92);
  } else if (settings.scaleStrategy === 'fixed-legacy') {
    effectiveScale = 0.72;
  }

  // Render Canvas PNG with exact iOS Squircle clip, color-adapted bg, and diagonal bevel stroke
  const outCanvas = document.createElement('canvas');
  outCanvas.width = targetSize;
  outCanvas.height = targetSize;
  const ctx = outCanvas.getContext('2d')!;
  ctx.clearRect(0, 0, targetSize, targetSize);

  const pad = settings.outerDropShadow ? targetSize * (2 / 128) : 0;
  const squircleSize = targetSize - pad * 2;
  const squirclePath = createIosSquirclePath2D(
    squircleSize,
    settings.cornerRadiusRatio,
    settings.cornerSmoothing,
    pad,
    pad
  );

  if (settings.outerDropShadow) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
    ctx.shadowBlur = targetSize * (6 / 128);
    ctx.shadowOffsetY = targetSize * (2.5 / 128);
    ctx.fillStyle = bg.bgDeepHex;
    ctx.fill(squirclePath);
    ctx.restore();
  }

  ctx.save();
  ctx.clip(squirclePath);

  // 1. Color-adapted 135-degree diagonal background gradient filling the whole squircle
  const bgGrad = ctx.createLinearGradient(pad, pad, pad + squircleSize, pad + squircleSize);
  bgGrad.addColorStop(0, bg.bgLightHex);
  bgGrad.addColorStop(1, bg.bgDeepHex);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(pad, pad, squircleSize, squircleSize);

  // Subtle top specular sheen
  const sheen = ctx.createRadialGradient(
    pad + squircleSize * 0.22,
    pad + squircleSize * 0.14,
    0,
    pad + squircleSize * 0.25,
    pad + squircleSize * 0.2,
    squircleSize * 0.85
  );
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(pad, pad, squircleSize, squircleSize);

  // 2. Normalized / edge-cut foreground centered on tight opaque container center
  const boxSize = squircleSize * effectiveScale;
  const aspect =
    fgImg.naturalWidth && fgImg.naturalHeight ? fgImg.naturalWidth / fgImg.naturalHeight : 1;
  const drawW = aspect >= 1 ? boxSize : boxSize * aspect;
  const drawH = aspect >= 1 ? boxSize / aspect : boxSize;
  const boxLeft = pad + squircleSize * 0.5 - boxSize * normCenterX;
  const boxTop = pad + squircleSize * 0.5 - boxSize * normCenterY;
  const drawX = boxLeft + (boxSize - drawW) * 0.5;
  const drawY = boxTop + (boxSize - drawH) * 0.5;
  ctx.drawImage(fgImg, drawX, drawY, drawW, drawH);

  // 3. Diagonal light-and-shadow inner stroke (135 deg: bright top-left -> shadow bottom-right)
  const strokeW = (settings.strokeWidth128 / 128) * squircleSize;
  if (strokeW > 0) {
    const strokeGrad = ctx.createLinearGradient(pad, pad, pad + squircleSize, pad + squircleSize);
    strokeGrad.addColorStop(0, `rgba(255, 255, 255, ${settings.lightStrokeOpacity})`);
    strokeGrad.addColorStop(
      0.32,
      `rgba(255, 255, 255, ${(settings.lightStrokeOpacity * 0.22).toFixed(3)})`
    );
    strokeGrad.addColorStop(0.54, 'rgba(128, 128, 128, 0.02)');
    strokeGrad.addColorStop(
      0.76,
      `rgba(0, 0, 0, ${(settings.shadowStrokeOpacity * 0.45).toFixed(3)})`
    );
    strokeGrad.addColorStop(1, `rgba(0, 0, 0, ${settings.shadowStrokeOpacity})`);

    ctx.lineWidth = strokeW * 2;
    ctx.strokeStyle = strokeGrad;
    ctx.stroke(squirclePath);
  }

  ctx.restore();

  let embeddedDataUrl = icon.dataUrl;
  if (embeddedDataUrl && !embeddedDataUrl.startsWith('data:')) {
    const encSize = Math.min(256, Math.max(fgImg.naturalWidth || 256, fgImg.naturalHeight || 256));
    const encW = aspect >= 1 ? encSize : Math.round(encSize * aspect);
    const encH = aspect >= 1 ? Math.round(encSize / aspect) : encSize;
    const encCanvas = document.createElement('canvas');
    encCanvas.width = Math.max(1, encW);
    encCanvas.height = Math.max(1, encH);
    encCanvas.getContext('2d')!.drawImage(fgImg, 0, 0, encCanvas.width, encCanvas.height);
    embeddedDataUrl = encCanvas.toDataURL('image/png');
  }

  const svgString = buildStandaloneAdaptedSvg(
    icon,
    cleanedSvg,
    embeddedDataUrl,
    settings,
    bg.bgLightHex,
    bg.bgDeepHex,
    effectiveScale,
    normCenterX,
    normCenterY
  );

  return {
    pngDataUrl: outCanvas.toDataURL('image/png'),
    svgString,
    analysis: {
      dominantHex: rgbToHex(dominantRgb[0], dominantRgb[1], dominantRgb[2]),
      bgLightHex: bg.bgLightHex,
      bgDeepHex: bg.bgDeepHex,
      hue: Math.round(hue),
      saturation: Math.round(saturation * 100),
      lightness: Math.round(lightness * 100),
      normalizerScale: Number(normalizerScale.toFixed(3)),
      effectiveScale: Number(effectiveScale.toFixed(3)),
      detectedShape: silhouette.detectedShape,
      fillRatio: Number(silhouette.fillRatio.toFixed(3)),
      fullBleedApplied,
      isMonochrome,
      isDarkBackground: bg.isDarkBackground,
      contrastRatio: Number(bg.contrastWithWhite.toFixed(2)),
    },
  };
}

function buildStandaloneAdaptedSvg(
  icon: FrostIconItem,
  cleanedSvg: string,
  embeddedDataUrl: string | undefined,
  settings: AdapterSettings,
  bgLightHex: string,
  bgDeepHex: string,
  effectiveScale: number,
  normCenterX: number,
  normCenterY: number
): string {
  const size = 128;
  const squirclePath = buildIosSquircleSvgPath(
    size,
    settings.cornerRadiusRatio,
    settings.cornerSmoothing,
    0,
    0
  );
  const strokeW = settings.strokeWidth128 * 2;
  const scaledSize = size * effectiveScale;
  const offsetX = size * 0.5 - scaledSize * normCenterX;
  const offsetY = size * 0.5 - scaledSize * normCenterY;

  const embeddedSource = embeddedDataUrl
    ? `<image href="${embeddedDataUrl}" x="0" y="0" width="128" height="128" preserveAspectRatio="xMidYMid meet"/>`
    : `<image href="${svgToDataUrl(cleanedSvg)}" x="0" y="0" width="128" height="128" preserveAspectRatio="xMidYMid meet"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <!-- Adapted via Launcher3 IosSquircleAdapter (r=${settings.cornerRadiusRatio}, smoothing=${settings.cornerSmoothing}) -->
  <defs>
    <clipPath id="ios-squircle-clip">
      <path d="${squirclePath}"/>
    </clipPath>
    <linearGradient id="adapted-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bgLightHex}"/>
      <stop offset="100%" stop-color="${bgDeepHex}"/>
    </linearGradient>
    <radialGradient id="top-sheen" cx="24%" cy="16%" r="75%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="diagonal-bevel-stroke" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="${settings.lightStrokeOpacity}"/>
      <stop offset="32%" stop-color="#FFFFFF" stop-opacity="${(settings.lightStrokeOpacity * 0.22).toFixed(3)}"/>
      <stop offset="54%" stop-color="#808080" stop-opacity="0.02"/>
      <stop offset="76%" stop-color="#000000" stop-opacity="${(settings.shadowStrokeOpacity * 0.45).toFixed(3)}"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="${settings.shadowStrokeOpacity}"/>
    </linearGradient>
  </defs>
  <g clip-path="url(#ios-squircle-clip)">
    <rect width="128" height="128" fill="url(#adapted-bg)"/>
    <rect width="128" height="128" fill="url(#top-sheen)"/>
    <g transform="translate(${offsetX.toFixed(2)} ${offsetY.toFixed(2)}) scale(${effectiveScale.toFixed(4)})">
      ${embeddedSource}
    </g>
    <path d="${squirclePath}" fill="none" stroke="url(#diagonal-bevel-stroke)" stroke-width="${strokeW.toFixed(2)}"/>
  </g>
</svg>`;
}
