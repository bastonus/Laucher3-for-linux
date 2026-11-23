export type IconPackId = 'frost' | 'papirus' | 'colloid' | 'reversal' | 'tela' | 'custom';
export type IconCategory = 'apps' | 'places' | 'mimetypes' | 'status' | 'custom';

export interface PackSummary {
  id: IconPackId;
  label: string;
  description: string;
  total: number;
  categories: Record<string, number>;
}

export interface FrostIconItem {
  id: string;
  name: string;
  file: string;
  pack?: IconPackId;
  category: IconCategory;
  family: string;
  svg: string;
  /** Optional raster/data URL for custom uploaded PNG/WebP icons */
  dataUrl?: string;
}

export type BackgroundAdaptMode = 'adaptive-tint' | 'adaptive-deep' | 'frosted-glass' | 'custom';
export type ScaleStrategy = 'launcher3-normalizer' | 'fixed-legacy' | 'custom';

export interface AdapterSettings {
  /** Exact iOS corner radius ratio (default 0.2237 = 22.37% of icon size) */
  cornerRadiusRatio: number;
  /** Exact iOS continuous corner smoothing (default 0.60 = 60%) */
  cornerSmoothing: number;
  /** How foreground scale is computed */
  scaleStrategy: ScaleStrategy;
  /** Additional scale multiplier or custom scale (0.55 - 1.05) */
  foregroundScale: number;
  /** Background adaptation strategy */
  backgroundMode: BackgroundAdaptMode;
  /** Custom background color when backgroundMode === 'custom' */
  customBgColor: string;
  /** Diagonal stroke width at 128px reference size */
  strokeWidth128: number;
  /** Top-left diagonal highlight opacity (0 - 1) */
  lightStrokeOpacity: number;
  /** Bottom-right diagonal shadow opacity (0 - 1) */
  shadowStrokeOpacity: number;
  /** Strip Frost SVG outer #shadow and #glow ellipses */
  stripFrostOuterShadow: boolean;
  /** Extract Frost glass plate directly onto the iOS squircle for app icons */
  frostSeamlessPlate: boolean;
  /** Render Launcher3 ShadowGenerator outer drop shadow in previews */
  outerDropShadow: boolean;
}

export const DEFAULT_IOS_ADAPTER_SETTINGS: AdapterSettings = {
  cornerRadiusRatio: 0.2237,
  cornerSmoothing: 0.6,
  scaleStrategy: 'launcher3-normalizer',
  foregroundScale: 0.84,
  backgroundMode: 'adaptive-tint',
  customBgColor: '#3F6DF5',
  strokeWidth128: 2.5,
  lightStrokeOpacity: 0.72,
  shadowStrokeOpacity: 0.32,
  stripFrostOuterShadow: true,
  frostSeamlessPlate: true,
  outerDropShadow: true,
};

export type DetectedIconShape = 'rectangle' | 'rounded' | 'squircle' | 'circle' | 'cutout';

export interface AdaptedIconAnalysis {
  dominantHex: string;
  bgLightHex: string;
  bgDeepHex: string;
  hue: number;
  saturation: number;
  lightness: number;
  normalizerScale: number;
  effectiveScale: number;
  detectedShape: DetectedIconShape;
  fillRatio: number;
  fullBleedApplied: boolean;
  isMonochrome: boolean;
  isDarkBackground: boolean;
  contrastRatio: number;
}

export interface Launcher3SourceFile {
  path: string;
  label: string;
  status: 'created' | 'modified' | 'reference';
  summary: string;
  content: string;
}
