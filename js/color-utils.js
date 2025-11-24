/**
 * Color Utility Functions
 * Pure functions for color conversion, distance calculation, and contrast checking
 */

/**
 * Convert hex color to RGBA string
 */
export function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * RGB to HSL conversion (r, g, b in 0-255 range, returns h in 0-360, s and l in 0-100)
 */
export function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return {
        h: h * 360,
        s: s * 100,
        l: l * 100
    };
}

/**
 * HSL to RGB conversion (h in 0-360, s and l in 0-100, returns r, g, b in 0-255)
 */
export function hslToRgb(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;

    let r, g, b;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

/**
 * Calculate Euclidean distance between two RGB colors
 */
export function colorDistance(c1, c2) {
    const dr = c1[0] - c2[0];
    const dg = c1[1] - c2[1];
    const db = c1[2] - c2[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Calculate relative luminance for contrast checking (WCAG formula)
 */
export function getRelativeLuminance(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const toLinear = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(hex1, hex2) {
    const lum1 = getRelativeLuminance(hex1);
    const lum2 = getRelativeLuminance(hex2);
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Calculate hue distance (circular, 0-180)
 */
export function hueDistance(h1, h2) {
    const diff = Math.abs(h1 - h2);
    return Math.min(diff, 360 - diff);
}

/**
 * Find best matching color from a palette based on a sampled RGB color
 */
export function findBestMatch(sampledRgb, palette) {
    // Convert sampled color to HSL
    const sampledHsl = rgbToHsl(sampledRgb[0], sampledRgb[1], sampledRgb[2]);
    const sampledH = sampledHsl.h;
    const sampledS = sampledHsl.s / 100; // Convert from 0-100 to 0-1
    const sampledL = sampledHsl.l / 100; // Convert from 0-100 to 0-1

    // Convert palette hex colors to RGB and HSL
    const paletteData = palette.map(hex => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const hsl = rgbToHsl(r, g, b);
        return { hex, rgb: [r, g, b], hsl: [hsl.h, hsl.s / 100, hsl.l / 100] }; // Convert s,l to 0-1
    });

    // Find best match using weighted distance
    let minDist = Infinity;
    let bestIndex = 0;

    for (let i = 0; i < paletteData.length; i++) {
        const [h, s, l] = paletteData[i].hsl;

        // For colors with saturation, prioritize hue matching
        // For grays (low saturation), use RGB distance
        // Use RGB if EITHER color is grayscale (hue is meaningless for achromatic colors)
        const isGrayscale = sampledS < 0.15 || s < 0.15;

        if (!isGrayscale) {
            // Both colored: weight hue heavily, with saturation and lightness as tiebreakers
            const hueDist = hueDistance(sampledH, h) / 180; // normalize to 0-1
            const satDist = Math.abs(sampledS - s);
            const lightDist = Math.abs(sampledL - l);
            const dist = hueDist * 5 + satDist * 1 + lightDist * 1; // hue weighted 5x

            if (dist < minDist) {
                minDist = dist;
                bestIndex = i;
            }
        } else {
            // At least one is grayscale: use simple RGB distance
            const rgbDist = colorDistance(sampledRgb, paletteData[i].rgb);
            if (rgbDist < minDist) {
                minDist = rgbDist;
                bestIndex = i;
            }
        }
    }

    return palette[bestIndex];
}
