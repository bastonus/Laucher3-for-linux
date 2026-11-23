/*
 * Copyright (C) 2026 Adapted Launcher3 Icon Adapter
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.android.launcher3.graphics;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.support.v4.graphics.ColorUtils;

/**
 * Adapts any icon bitmap into an iOS continuous-curvature squircle with:
 * 1. Exact iOS HIG squircle geometry (corner radius ratio = 0.2237, smoothing = 0.60).
 * 2. Shape-aware edge cutting & full-bleed scaling for rectangle, rounded-rect, squircle,
 *    and circular icons, plus perimeter-matched background color filling the entire squircle.
 * 3. Color-adapted tonal gradient background derived via {@link ColorExtractor} for cutouts.
 * 4. Diagonal (135 deg) light-to-shadow inner bevel stroke over the clipped icon.
 */
public class IosSquircleAdapter {

    /** Apple iOS App Icon grid corner radius ratio (229px / 1024px = 0.22363 -> 0.2237). */
    public static final float IOS_CORNER_RADIUS_RATIO = 0.2237f;

    /** Apple UIKit continuous corner smoothing factor (60%). */
    public static final float IOS_CORNER_SMOOTHING = 0.60f;

    /** Normalized [0..100] SVG path string for Android config_icon_mask & PathParser. */
    public static final String IOS_SQUIRCLE_MASK_PATH_DATA =
            "M 64.208,0 C 76.736,0 83.001,0 87.786,2.438 "
            + "A 22.37,22.37 0 0 1 97.562,12.214 "
            + "C 100,16.999 100,23.264 100,35.792 L 100,64.208 "
            + "C 100,76.736 100,83.001 97.562,87.786 "
            + "A 22.37,22.37 0 0 1 87.786,97.562 "
            + "C 83.001,100 76.736,100 64.208,100 L 35.792,100 "
            + "C 23.264,100 16.999,100 12.214,97.562 "
            + "A 22.37,22.37 0 0 1 2.438,87.786 "
            + "C 0,83.001 0,76.736 0,64.208 L 0,35.792 "
            + "C 0,23.264 0,16.999 2.438,12.214 "
            + "A 22.37,22.37 0 0 1 12.214,2.438 "
            + "C 16.999,0 23.264,0 35.792,0 Z";

    /** Diagonal bevel stroke thickness relative to icon size (2.5px @ 128px). */
    public static final float STROKE_WIDTH_RATIO = 2.5f / 128f;

    public static final float LIGHT_STROKE_ALPHA = 0.72f;
    public static final float SHADOW_STROKE_ALPHA = 0.32f;

    private static final int OPAQUE_PLATE_ALPHA = 200;

    public enum DetectedShape {
        RECTANGLE,
        ROUNDED,
        SQUIRCLE,
        CIRCLE,
        CUTOUT
    }

    public static class SilhouetteInfo {
        public final DetectedShape shape;
        public final float normWidth;
        public final float normHeight;
        public final float normCenterX;
        public final float normCenterY;
        public final int[] perimeterColors;

        SilhouetteInfo(DetectedShape shape, float normWidth, float normHeight,
                float normCenterX, float normCenterY, int[] perimeterColors) {
            this.shape = shape;
            this.normWidth = normWidth;
            this.normHeight = normHeight;
            this.normCenterX = normCenterX;
            this.normCenterY = normCenterY;
            this.perimeterColors = perimeterColors;
        }
    }

    /**
     * Analyzes opaque container pixels (alpha >= 200, ignoring drop shadows) to classify
     * rectangle, rounded-rect, squircle, circle, or cutout icons and sample edge colors.
     */
    public static SilhouetteInfo analyzeSilhouette(Bitmap bitmap) {
        int w = bitmap.getWidth();
        int h = bitmap.getHeight();
        int topY = -1, bottomY = -1, leftX = w, rightX = -1, opaqueCount = 0;

        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int alpha = Color.alpha(bitmap.getPixel(x, y));
                if (alpha >= OPAQUE_PLATE_ALPHA) {
                    opaqueCount++;
                    if (topY == -1) topY = y;
                    bottomY = y;
                    if (x < leftX) leftX = x;
                    if (x > rightX) rightX = x;
                }
            }
        }

        if (topY == -1 || rightX < leftX || bottomY < topY) {
            return new SilhouetteInfo(DetectedShape.CUTOUT, 1f, 1f, 0.5f, 0.5f, null);
        }

        int bw = rightX - leftX + 1;
        int bh = bottomY - topY + 1;
        float fillRatio = (float) opaqueCount / (bw * bh);
        float aspectRatio = (float) Math.min(bw, bh) / Math.max(bw, bh);

        int midEdgeHits = 0;
        if (isOpaqueAt(bitmap, leftX + bw * 0.5f, topY + bh * 0.04f)) midEdgeHits++;
        if (isOpaqueAt(bitmap, leftX + bw * 0.5f, topY + bh * 0.96f)) midEdgeHits++;
        if (isOpaqueAt(bitmap, leftX + bw * 0.04f, topY + bh * 0.5f)) midEdgeHits++;
        if (isOpaqueAt(bitmap, leftX + bw * 0.96f, topY + bh * 0.5f)) midEdgeHits++;

        int cornerHits03 = 0;
        if (isOpaqueAt(bitmap, leftX + bw * 0.03f, topY + bh * 0.03f)) cornerHits03++;
        if (isOpaqueAt(bitmap, leftX + bw * 0.97f, topY + bh * 0.03f)) cornerHits03++;
        if (isOpaqueAt(bitmap, leftX + bw * 0.03f, topY + bh * 0.97f)) cornerHits03++;
        if (isOpaqueAt(bitmap, leftX + bw * 0.97f, topY + bh * 0.97f)) cornerHits03++;

        int cornerHits05 = 0;
        if (isOpaqueAt(bitmap, leftX + bw * 0.055f, topY + bh * 0.055f)) cornerHits05++;
        if (isOpaqueAt(bitmap, leftX + bw * 0.945f, topY + bh * 0.055f)) cornerHits05++;
        if (isOpaqueAt(bitmap, leftX + bw * 0.055f, topY + bh * 0.945f)) cornerHits05++;
        if (isOpaqueAt(bitmap, leftX + bw * 0.945f, topY + bh * 0.945f)) cornerHits05++;

        DetectedShape shape = DetectedShape.CUTOUT;
        if (aspectRatio >= 0.85f && midEdgeHits >= 4) {
            if (fillRatio >= 0.97f || cornerHits03 >= 3) {
                shape = DetectedShape.RECTANGLE;
            } else if (fillRatio >= 0.945f || (cornerHits05 >= 3 && fillRatio >= 0.90f)) {
                shape = DetectedShape.ROUNDED;
            } else if (fillRatio >= 0.845f) {
                shape = DetectedShape.SQUIRCLE;
            } else if (fillRatio >= 0.725f) {
                shape = DetectedShape.CIRCLE;
            }
        }

        int[] perimeterColors = null;
        if (shape != DetectedShape.CUTOUT) {
            int tl = sampleAveragePerimeterColor(bitmap, leftX, topY, bw, bh, shape, true);
            int br = sampleAveragePerimeterColor(bitmap, leftX, topY, bw, bh, shape, false);
            if (tl != 0 && br != 0) {
                perimeterColors = new int[]{tl, br};
            }
        }

        return new SilhouetteInfo(
                shape,
                (float) bw / w,
                (float) bh / h,
                (leftX + rightX + 1f) / (2f * w),
                (topY + bottomY + 1f) / (2f * h),
                perimeterColors);
    }

    private static boolean isOpaqueAt(Bitmap bmp, float fx, float fy) {
        int px = Math.max(0, Math.min(bmp.getWidth() - 1, Math.round(fx)));
        int py = Math.max(0, Math.min(bmp.getHeight() - 1, Math.round(fy)));
        return Color.alpha(bmp.getPixel(px, py)) >= OPAQUE_PLATE_ALPHA;
    }

    private static int sampleAveragePerimeterColor(Bitmap bmp, int leftX, int topY, int bw, int bh,
            DetectedShape shape, boolean topLeft) {
        float[][] pts = (shape == DetectedShape.CIRCLE)
                ? (topLeft
                        ? new float[][]{{0.5f, 0.06f}, {0.34f, 0.11f}, {0.2f, 0.22f}, {0.11f, 0.34f}, {0.06f, 0.5f}}
                        : new float[][]{{0.94f, 0.5f}, {0.89f, 0.66f}, {0.8f, 0.78f}, {0.66f, 0.89f}, {0.5f, 0.94f}})
                : (topLeft
                        ? new float[][]{{0.08f, 0.16f}, {0.06f, 0.3f}, {0.05f, 0.45f}, {0.16f, 0.08f}, {0.3f, 0.06f}, {0.45f, 0.05f}}
                        : new float[][]{{0.92f, 0.84f}, {0.94f, 0.7f}, {0.95f, 0.55f}, {0.84f, 0.92f}, {0.7f, 0.94f}, {0.55f, 0.95f}});

        int[] colors = new int[pts.length];
        int n = 0;
        for (float[] pt : pts) {
            int px = Math.max(0, Math.min(bmp.getWidth() - 1, Math.round(leftX + bw * pt[0])));
            int py = Math.max(0, Math.min(bmp.getHeight() - 1, Math.round(topY + bh * pt[1])));
            int c = bmp.getPixel(px, py);
            if (Color.alpha(c) >= OPAQUE_PLATE_ALPHA) {
                colors[n++] = c;
            }
        }
        if (n == 0) return 0;

        int bestIdx = 0;
        double bestDist = Double.MAX_VALUE;
        for (int i = 0; i < n; i++) {
            double d = 0;
            for (int j = 0; j < n; j++) {
                int dr = Color.red(colors[i]) - Color.red(colors[j]);
                int dg = Color.green(colors[i]) - Color.green(colors[j]);
                int db = Color.blue(colors[i]) - Color.blue(colors[j]);
                d += Math.sqrt(dr * dr + dg * dg + db * db);
            }
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
            }
        }

        int medoid = colors[bestIdx];
        int sr = 0, sg = 0, sb = 0, count = 0;
        for (int i = 0; i < n; i++) {
            int dr = Color.red(colors[i]) - Color.red(medoid);
            int dg = Color.green(colors[i]) - Color.green(medoid);
            int db = Color.blue(colors[i]) - Color.blue(medoid);
            if (Math.sqrt(dr * dr + dg * dg + db * db) <= 48.0) {
                sr += Color.red(colors[i]);
                sg += Color.green(colors[i]);
                sb += Color.blue(colors[i]);
                count++;
            }
        }
        return count > 0 ? Color.rgb(sr / count, sg / count, sb / count) : 0;
    }

    /**
     * Builds an exact iOS continuous-curvature squircle {@link Path} inside [left, top, size].
     */
    public static Path buildIosSquirclePath(float left, float top, float size) {
        return buildIosSquirclePath(left, top, size, IOS_CORNER_RADIUS_RATIO, IOS_CORNER_SMOOTHING);
    }

    public static Path buildIosSquirclePath(
            float left, float top, float size, float radiusRatio, float smoothing) {
        float r = size * radiusRatio;
        float p = Math.min(size / 2f, (1f + smoothing) * r);
        float effS = (r > 0f) ? (p / r - 1f) : 0f;

        float arcMeasure = 90f * (1f - effS);
        double arcHalfRad = Math.toRadians(arcMeasure / 2f);
        float arcSectionLength = (float) (Math.sin(arcHalfRad) * r * Math.sqrt(2.0));
        float angleAlpha = (90f - arcMeasure) / 2f;
        float p3ToP4 = (float) (r * Math.tan(Math.toRadians(angleAlpha / 2f)));
        float angleBeta = 45f * effS;
        float c = (float) (p3ToP4 * Math.cos(Math.toRadians(angleBeta)));
        float d = (float) (p3ToP4 * Math.sin(Math.toRadians(angleBeta)));
        float b = Math.max(0f, (p - arcSectionLength - c - d) / 3f);
        float a = 2f * b;

        float right = left + size;
        float bottom = top + size;
        float arcEndOffset = p - a - b - c;

        Path path = new Path();
        path.moveTo(right - p, top);
        path.cubicTo(
                right - p + a, top,
                right - p + a + b, top,
                right - p + a + b + c, top + d);
        path.arcTo(
                new RectF(right - 2f * r, top, right, top + 2f * r),
                -90f + angleAlpha, arcMeasure, false);
        path.cubicTo(
                right, top + p - a - b,
                right, top + p - a,
                right, top + p);

        path.lineTo(right, bottom - p);
        path.cubicTo(
                right, bottom - p + a,
                right, bottom - p + a + b,
                right - d, bottom - p + a + b + c);
        path.arcTo(
                new RectF(right - 2f * r, bottom - 2f * r, right, bottom),
                angleAlpha, arcMeasure, false);
        path.cubicTo(
                right - p + a + b, bottom,
                right - p + a, bottom,
                right - p, bottom);

        path.lineTo(left + p, bottom);
        path.cubicTo(
                left + p - a, bottom,
                left + p - a - b, bottom,
                left + arcEndOffset, bottom - d);
        path.arcTo(
                new RectF(left, bottom - 2f * r, left + 2f * r, bottom),
                90f + angleAlpha, arcMeasure, false);
        path.cubicTo(
                left, bottom - p + a + b,
                left, bottom - p + a,
                left, bottom - p);

        path.lineTo(left, top + p);
        path.cubicTo(
                left, top + p - a,
                left, top + p - a - b,
                left + d, top + arcEndOffset);
        path.arcTo(
                new RectF(left, top, left + 2f * r, top + 2f * r),
                180f + angleAlpha, arcMeasure, false);
        path.cubicTo(
                left + arcEndOffset + c, top,
                left + p - a, top,
                left + p, top);

        path.close();
        return path;
    }

    /**
     * Computes a harmonized 2-stop diagonal background gradient (top-left light, bottom-right deep)
     * that avoids matching foreground hues (including multi-hue/purple gradients) and guarantees contrast.
     */
    public static int[] computeAdaptedBackgroundColors(Bitmap iconBitmap) {
        int dominant = ColorExtractor.findDominantColorByHue(iconBitmap, 64);
        float[] hsl = new float[3];
        ColorUtils.colorToHSL(dominant, hsl);

        int w = iconBitmap.getWidth();
        int h = iconBitmap.getHeight();
        int stride = Math.max(1, (int) Math.sqrt((w * h) / 160.0));
        int[] samples = new int[200];
        int sampleCount = 0;
        long sr = 0, sg = 0, sb = 0;
        int[] hueBins = new int[12];
        int satTotal = 0;
        float[] hsv = new float[3];

        for (int y = 0; y < h && sampleCount < samples.length; y += stride) {
            for (int x = 0; x < w && sampleCount < samples.length; x += stride) {
                int c = iconBitmap.getPixel(x, y);
                if (Color.alpha(c) >= 128) {
                    samples[sampleCount++] = c;
                    sr += Color.red(c);
                    sg += Color.green(c);
                    sb += Color.blue(c);
                    Color.colorToHSV(c, hsv);
                    if (hsv[1] >= 0.22f && hsv[2] >= 0.20f) {
                        int bin = Math.max(0, Math.min(11, (int) (hsv[0] / 30f)));
                        hueBins[bin]++;
                        satTotal++;
                    }
                }
            }
        }
        int meanRgb = sampleCount > 0
                ? Color.rgb((int) (sr / sampleCount), (int) (sg / sampleCount), (int) (sb / sampleCount))
                : dominant;

        int[] occupiedHues = new int[12];
        int occCount = 0;
        if (satTotal >= 5) {
            for (int i = 0; i < 12; i++) {
                if ((float) hueBins[i] / satTotal >= 0.13f) {
                    occupiedHues[occCount++] = i * 30 + 15;
                }
            }
        }
        boolean isMultiHue = false;
        for (int i = 0; i < occCount; i++) {
            for (int j = i + 1; j < occCount; j++) {
                if (hueAngleDiff(occupiedHues[i], occupiedHues[j]) >= 48f) {
                    isMultiHue = true;
                }
            }
        }

        int[][] candidates;
        boolean[] isNeutralStudio;
        if (hsl[1] < 0.08f) {
            candidates = new int[][]{
                    {Color.rgb(246, 248, 252), Color.rgb(228, 234, 244)},
                    {Color.rgb(36, 44, 58), Color.rgb(19, 24, 34)},
                    {Color.rgb(122, 134, 154), Color.rgb(96, 108, 128)}
            };
            isNeutralStudio = new boolean[]{true, true, false};
        } else {
            float hue = hsl[0];
            float sat = hsl[1];
            float safeAna1 = safeArchitecturalHue(hue + 10f);
            float safeAna2 = safeArchitecturalHue(hue + 18f);
            float safeComp1 = safeArchitecturalHue(hue + 158f);
            float safeComp2 = safeArchitecturalHue(hue + 170f);
            candidates = new int[][]{
                    {Color.rgb(247, 249, 252), Color.rgb(232, 237, 245)},
                    {Color.rgb(34, 40, 52), Color.rgb(18, 22, 30)},
                    {
                            ColorUtils.HSLToColor(new float[]{safeAna1, clamp01(sat * 0.28f, 0.12f, 0.30f), 0.965f}),
                            ColorUtils.HSLToColor(new float[]{safeAna2, clamp01(sat * 0.34f, 0.14f, 0.36f), 0.895f})
                    },
                    {
                            ColorUtils.HSLToColor(new float[]{safeComp1, clamp01(sat * 0.20f, 0.08f, 0.22f), 0.970f}),
                            ColorUtils.HSLToColor(new float[]{safeComp2, clamp01(sat * 0.24f, 0.10f, 0.26f), 0.905f})
                    },
                    {
                            ColorUtils.HSLToColor(new float[]{safeAna1, clamp01(sat * 0.34f, 0.14f, 0.34f), 0.230f}),
                            ColorUtils.HSLToColor(new float[]{safeAna2, clamp01(sat * 0.38f, 0.16f, 0.38f), 0.125f})
                    },
                    {
                            ColorUtils.HSLToColor(new float[]{safeComp1, clamp01(sat * 0.28f, 0.12f, 0.30f), 0.225f}),
                            ColorUtils.HSLToColor(new float[]{safeComp2, clamp01(sat * 0.32f, 0.14f, 0.34f), 0.120f})
                    }
            };
            isNeutralStudio = new boolean[]{true, true, false, false, false, false};
        }

        int[] best = candidates[0];
        double bestScore = -Double.MAX_VALUE;
        float[] bgHsl = new float[3];
        for (int idx = 0; idx < candidates.length; idx++) {
            int cLight = candidates[idx][0];
            int cDeep = candidates[idx][1];
            double sumContrast = 0;
            int passCount = 0;
            double[] contrasts = new double[Math.max(1, sampleCount)];
            for (int i = 0; i < sampleCount; i++) {
                double c = Math.min(
                        ColorUtils.calculateContrast(samples[i], cLight),
                        ColorUtils.calculateContrast(samples[i], cDeep));
                contrasts[i] = c;
                sumContrast += c;
                if (c >= 2.8) passCount++;
            }
            java.util.Arrays.sort(contrasts);
            double p20 = sampleCount > 0 ? contrasts[(int) (sampleCount * 0.2)] : 4.5;
            double meanContrast = sampleCount > 0 ? sumContrast / sampleCount : 4.5;
            double passFraction = sampleCount > 0 ? (double) passCount / sampleCount : 1.0;

            double domDist = Math.min(rgbDist(dominant, cLight), rgbDist(dominant, cDeep));
            double meanDist = Math.min(rgbDist(meanRgb, cLight), rgbDist(meanRgb, cDeep));
            double penalty = (domDist < 72.0 ? -12.0 - (72.0 - domDist) * 0.25 : 0.0)
                    + (meanDist < 68.0 ? -10.0 - (68.0 - meanDist) * 0.25 : 0.0);

            ColorUtils.colorToHSL(cDeep, bgHsl);
            if (bgHsl[1] >= 0.16f) {
                if (bgHsl[0] >= 248f && bgHsl[0] <= 328f) penalty -= 4.5;
                for (int i = 0; i < occCount; i++) {
                    if (hueAngleDiff(bgHsl[0], occupiedHues[i]) <= 36f) penalty -= 2.4;
                }
            }

            double harmony = 1.35;
            if (isMultiHue) {
                harmony += isNeutralStudio[idx] ? 2.4 : -1.4;
            }
            double score = passFraction * 6.5
                    + Math.min(p20, 5.5) * 1.15
                    + Math.min(meanContrast, 7.0) * 0.45
                    + harmony
                    + penalty;
            if (score > bestScore) {
                bestScore = score;
                best = candidates[idx];
            }
        }
        return best;
    }

    private static float safeArchitecturalHue(float targetHue) {
        float h = ((targetHue % 360f) + 360f) % 360f;
        if (h >= 248f && h <= 288f) return 226f;
        if (h > 288f && h <= 328f) return 345f;
        return h;
    }

    private static float hueAngleDiff(float a, float b) {
        float d = Math.abs((((a % 360f) + 360f) % 360f) - (((b % 360f) + 360f) % 360f));
        return Math.min(d, 360f - d);
    }

    private static float clamp01(float v, float min, float max) {
        return Math.max(min, Math.min(max, v));
    }

    private static double rgbDist(int c1, int c2) {
        int dr = Color.red(c1) - Color.red(c2);
        int dg = Color.green(c1) - Color.green(c2);
        int db = Color.blue(c1) - Color.blue(c2);
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    /**
     * Renders any normalized icon bitmap into an iOS squircle container.
     * Container-shaped icons (rectangle, rounded, squircle, circle) are scaled to bleed past
     * the squircle edges so corners are cut cleanly and the perimeter background color fills
     * the entire squircle icon.
     */
    public static Bitmap adaptToIosSquircle(Bitmap sourceIcon, int targetSize, float contentScale) {
        Bitmap output = Bitmap.createBitmap(targetSize, targetSize, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(output);

        float inset = targetSize * ShadowGenerator.BLUR_FACTOR;
        float squircleSize = targetSize - 2f * inset;
        Path squirclePath = buildIosSquirclePath(inset, inset, squircleSize);

        SilhouetteInfo silhouette = analyzeSilhouette(sourceIcon);
        int[] bgColors = (silhouette.perimeterColors != null)
                ? silhouette.perimeterColors
                : computeAdaptedBackgroundColors(sourceIcon);

        float effectiveScale = contentScale;
        float cx = 0.5f;
        float cy = 0.5f;
        float tightMax = Math.max(silhouette.normWidth, silhouette.normHeight);
        if (silhouette.shape != DetectedShape.CUTOUT) {
            float bleed = (silhouette.shape == DetectedShape.RECTANGLE)
                    ? 1.045f
                    : (silhouette.shape == DetectedShape.ROUNDED
                            ? 1.065f
                            : (silhouette.shape == DetectedShape.SQUIRCLE ? 1.08f : 1.12f));
            effectiveScale = Math.max(0.98f, Math.min(1.55f, (1f / Math.max(0.25f, tightMax)) * bleed));
            cx = silhouette.normCenterX;
            cy = silhouette.normCenterY;
        } else if (tightMax > 0.25f) {
            effectiveScale = Math.max(0.52f, Math.min(contentScale, 0.63f / tightMax));
            cx = silhouette.normCenterX;
            cy = silhouette.normCenterY;
        }

        int saveCount = canvas.save();
        canvas.clipPath(squirclePath);

        // 1. Color-adapted / perimeter-matched diagonal background gradient filling full squircle
        Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);
        bgPaint.setShader(new LinearGradient(
                inset, inset,
                inset + squircleSize, inset + squircleSize,
                bgColors[0], bgColors[1],
                Shader.TileMode.CLAMP));
        canvas.drawPath(squirclePath, bgPaint);

        // 2. Foreground icon aligned on tight opaque center and scaled to cut/fill edges
        Paint iconPaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        float drawSize = squircleSize * effectiveScale;
        float drawLeft = inset + squircleSize * 0.5f - drawSize * cx;
        float drawTop = inset + squircleSize * 0.5f - drawSize * cy;
        canvas.drawBitmap(sourceIcon,
                new Rect(0, 0, sourceIcon.getWidth(), sourceIcon.getHeight()),
                new RectF(drawLeft, drawTop, drawLeft + drawSize, drawTop + drawSize),
                iconPaint);

        // 3. Diagonal light-and-shadow inner stroke (135 deg: bright top-left -> shadow bottom-right)
        float strokeWidth = Math.max(1.5f, squircleSize * STROKE_WIDTH_RATIO);
        Paint strokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        strokePaint.setStyle(Paint.Style.STROKE);
        strokePaint.setStrokeWidth(strokeWidth * 2f);
        strokePaint.setShader(new LinearGradient(
                inset, inset,
                inset + squircleSize, inset + squircleSize,
                new int[]{
                        ColorUtils.setAlphaComponent(Color.WHITE, (int) (255 * LIGHT_STROKE_ALPHA)),
                        ColorUtils.setAlphaComponent(Color.WHITE, (int) (255 * 0.14f)),
                        ColorUtils.setAlphaComponent(Color.BLACK, (int) (255 * 0.06f)),
                        ColorUtils.setAlphaComponent(Color.BLACK, (int) (255 * SHADOW_STROKE_ALPHA))
                },
                new float[]{0f, 0.35f, 0.62f, 1f},
                Shader.TileMode.CLAMP));
        canvas.drawPath(squirclePath, strokePaint);

        canvas.restoreToCount(saveCount);
        return output;
    }
}
