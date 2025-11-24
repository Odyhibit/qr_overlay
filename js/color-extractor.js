/**
 * Color Extraction from Images
 * Functions for analyzing images and extracting dominant color palettes
 */

/**
 * Extract dominant dark and light colors from an image
 * Returns palettes suitable for QR code generation
 */
export function extractDominantColors(img) {
    // Create temp canvas to analyze the logo
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    tempCtx.drawImage(img, 0, 0);

    const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
    const data = imageData.data;

    // Collect dark and light colors with frequency counts
    // Quantize to reduce near-duplicates (group similar colors)
    const quantize = (val) => Math.min(255, Math.round(val / 4) * 4); // Reduce to 64 levels per channel, clamp to 255

    const darkColors = {};
    const lightColors = {};

    for (let i = 0; i < data.length; i += 16) { // Sample every 4 pixels
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Skip transparent pixels
        if (a < 128) continue;

        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

        // Quantize to reduce near-duplicates
        const qR = quantize(r);
        const qG = quantize(g);
        const qB = quantize(b);
        const colorKey = `${qR},${qG},${qB}`;

        if (luminance < 128) {
            darkColors[colorKey] = (darkColors[colorKey] || 0) + 1;
        } else {
            lightColors[colorKey] = (lightColors[colorKey] || 0) + 1;
        }
    }

    // Extract top colors, filtering out rare colors (anti-aliasing artifacts)
    const getTopColors = (colorFreqMap, count = 4) => {
        // Get total pixel count
        const totalPixels = Object.values(colorFreqMap).reduce((a, b) => a + b, 0);

        // Filter out colors that appear in less than 0.1% of pixels (likely anti-aliasing)
        const minFrequency = Math.max(10, totalPixels * 0.001);

        // Sort by frequency (most common first) and filter
        const sorted = Object.entries(colorFreqMap)
            .filter(([colorKey, freq]) => freq >= minFrequency)
            .sort((a, b) => b[1] - a[1]); // Sort by count descending

        console.log(`Filtered ${Object.keys(colorFreqMap).length - sorted.length} rare colors (anti-aliasing artifacts)`);

        // Take top N colors
        const topColors = sorted.slice(0, count);

        // Convert to hex
        return topColors.map(([colorKey, freq]) => {
            const [r, g, b] = colorKey.split(',').map(Number);
            return rgbToHex(r, g, b);
        });
    };

    const rgbToHex = (r, g, b) => {
        return '#' + [r, g, b].map(x => {
            const hex = Math.round(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    };

    // Extract 4 most common colors from each category
    const darkPalette = getTopColors(darkColors, 4);
    const lightPalette = getTopColors(lightColors, 4);

    console.log('Dark colors found:', Object.keys(darkColors).length);
    console.log('Light colors found:', Object.keys(lightColors).length);

    // Debug: show top dark colors with their frequencies and luminance
    const darkEntries = Object.entries(darkColors).sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log('Top 10 dark colors by frequency:');
    darkEntries.forEach(([color, count]) => {
        const [r, g, b] = color.split(',').map(Number);
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        console.log(`  RGB(${r}, ${g}, ${b}) - Count: ${count}, Luminance: ${lum.toFixed(1)}`);
    });

    // Debug: show top light colors
    const lightEntries = Object.entries(lightColors).sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log('Top 10 light colors by frequency:');
    lightEntries.forEach(([color, count]) => {
        const [r, g, b] = color.split(',').map(Number);
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        console.log(`  RGB(${r}, ${g}, ${b}) - Count: ${count}, Luminance: ${lum.toFixed(1)}`);
    });

    console.log('Top 4 dark:', darkPalette);
    console.log('Top 4 light:', lightPalette);

    // Helper to get luminance from hex color (0-1 range)
    const getLuminance = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return 0.299 * r + 0.587 * g + 0.114 * b;
    };

    // Validate dark palette: only use colors from logo that are dark enough
    // If no logo colors are dark enough, fall back to black
    const validateDarkPalette = (palette) => {
        // Filter to only colors that are actually dark (luminance < 0.5)
        const validColors = palette.filter(color => getLuminance(color) < 0.5);

        // If we have at least one valid dark color from logo, use only logo colors
        if (validColors.length > 0) {
            // Pad by duplicating existing logo colors
            while (validColors.length < 4) {
                validColors.push(validColors[validColors.length - 1]);
            }
            return validColors;
        }

        // No dark colors in logo - fall back to black
        console.warn('No dark colors found in logo, using black');
        return ['#000000', '#000000', '#000000', '#000000'];
    };

    // Validate light palette: only use colors from logo that are light enough
    // If no logo colors are light enough, fall back to white
    const validateLightPalette = (palette) => {
        // Filter to only colors that are actually light (luminance > 0.5)
        const validColors = palette.filter(color => getLuminance(color) > 0.5);

        // If we have at least one valid light color from logo, use only logo colors
        if (validColors.length > 0) {
            // Pad by duplicating existing logo colors
            while (validColors.length < 4) {
                validColors.push(validColors[validColors.length - 1]);
            }
            return validColors;
        }

        // No light colors in logo - fall back to white
        console.warn('No light colors found in logo, using white');
        return ['#ffffff', '#ffffff', '#ffffff', '#ffffff'];
    };

    const finalDarkPalette = validateDarkPalette(darkPalette);
    const finalLightPalette = validateLightPalette(lightPalette);

    // Sort dark palette: darkest to lightest (lowest luminance first)
    finalDarkPalette.sort((a, b) => getLuminance(a) - getLuminance(b));

    // Sort light palette: lightest to darkest (highest luminance first)
    finalLightPalette.sort((a, b) => getLuminance(b) - getLuminance(a));

    console.log('Dark palette luminance (darkest first):', finalDarkPalette.map(c => getLuminance(c).toFixed(2)));
    console.log('Light palette luminance (lightest first):', finalLightPalette.map(c => getLuminance(c).toFixed(2)));

    return {
        darkPalette: finalDarkPalette,
        lightPalette: finalLightPalette,
        // Keep single colors for backward compatibility
        dark: finalDarkPalette[0] || '#000000',
        light: finalLightPalette[0] || '#ffffff'
    };
}
