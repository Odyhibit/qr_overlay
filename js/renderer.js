/**
 * Canvas Renderer
 * Main rendering functions for drawing QR codes with logos
 */

import { state } from './state.js';
import { hexToRgba, rgbToHsl, hslToRgb, findBestMatch } from './color-utils.js';
import { isFinderPattern } from './qr-detector.js';
import { drawFinderPatternsSync } from './finder-patterns.js';

// Global variables to cache images and data for performance
let cachedLogoImg = null;
let cachedQRImg = null;
let cachedQRImageData = null;
let cachedLogoImageData = null;

export function drawCanvas(ctx, skipOverlay = false) {
    try {
const canvasSize = 600;
ctx.clearRect(0, 0, canvasSize, canvasSize);

// Apply background fill
if (state.backgroundFill === 'light') {
    ctx.fillStyle = state.lightColor;
    ctx.fillRect(0, 0, canvasSize, canvasSize);
} else if (state.backgroundFill === 'dark') {
    ctx.fillStyle = state.darkColor;
    ctx.fillRect(0, 0, canvasSize, canvasSize);
}
// If transparent, clearRect above already handles it

if (state.logoImage) {
    // Calculate logo size and position
    const scale = state.logoScale / 100;
    const maxSize = canvasSize * scale;

    // Calculate aspect-ratio-preserving dimensions
    let logoWidth, logoHeight;
    if (cachedLogoImg) {
const aspectRatio = cachedLogoImg.width / cachedLogoImg.height;
if (aspectRatio > 1) {
    // Wider than tall
    logoWidth = maxSize;
    logoHeight = maxSize / aspectRatio;
} else {
    // Taller than wide or square
    logoHeight = maxSize;
    logoWidth = maxSize * aspectRatio;
}
    } else {
// If no cached image yet, use square as fallback
logoWidth = maxSize;
logoHeight = maxSize;
    }

    const logoX = (canvasSize * state.logoX / 100) - (logoWidth / 2);
    const logoY = (canvasSize * state.logoY / 100) - (logoHeight / 2);

    // If we have a cached image and are dragging, draw using cached data
    if (cachedLogoImg && skipOverlay) {
ctx.drawImage(cachedLogoImg, logoX, logoY, logoWidth, logoHeight);
// Draw finder patterns synchronously during dragging
drawFinderPatternsSync(ctx);
// Draw modules using cached colors (synchronous, no recalculation)
if (cachedQRImg && cachedQRImageData) {
    drawQROverlaySync(ctx, canvasSize, logoX, logoY, logoWidth, logoHeight);
}
return;
    } else {
// Load the image (will update cache when loaded)
const img = new Image();
img.onload = () => {
    try {
// Update cache
cachedLogoImg = img;

// Recalculate dimensions with actual image aspect ratio
const aspectRatio = img.width / img.height;
if (aspectRatio > 1) {
    logoWidth = maxSize;
    logoHeight = maxSize / aspectRatio;
} else {
    logoHeight = maxSize;
    logoWidth = maxSize * aspectRatio;
}
const logoX = (canvasSize * state.logoX / 100) - (logoWidth / 2);
const logoY = (canvasSize * state.logoY / 100) - (logoHeight / 2);

// Draw logo
ctx.drawImage(img, logoX, logoY, logoWidth, logoHeight);

// Only draw QR overlay if not skipping (i.e., not dragging)
if (!skipOverlay) {
    // Pass logo info to overlay so it can sample original pixels
    drawQROverlay(ctx, canvasSize, {
image: img,
x: logoX,
y: logoY,
width: logoWidth,
height: logoHeight
    });
}
    } catch (e) {
console.error('Error drawing logo:', e);
    }
};
img.onerror = (e) => console.error('Error loading logo image:', e);
img.src = state.logoImage;
    }
} else {
    // Only show checkerboard if background is transparent
    if (state.backgroundFill === 'transparent') {
const checkSize = 20;
for (let y = 0; y < canvasSize; y += checkSize) {
    for (let x = 0; x < canvasSize; x += checkSize) {
ctx.fillStyle = ((x / checkSize + y / checkSize) % 2 === 0) ? '#e0e0e0' : '#ffffff';
ctx.fillRect(x, y, checkSize, checkSize);
    }
}
    }
    if (!skipOverlay) {
drawQROverlay(ctx, canvasSize);
    }
}
    } catch (e) {
console.error('Error in drawCanvas:', e);
    }
}


// Synchronous version for drag using cached data and colors
function drawQROverlaySync(ctx, canvasSize, logoX, logoY, logoWidth, logoHeight) {
    const contentModules = state.qrSize;
    const quietZonePixels = state.quietZonePixels;
    const canvasQuietZone = state.canvasQuietZone;
    const totalModules = contentModules + 2 * canvasQuietZone;
    const contentWidth = cachedQRImg.width - 2 * quietZonePixels;
    const contentHeight = cachedQRImg.height - 2 * quietZonePixels;
    const modulePixelSize = canvasSize / totalModules;

    // Use cached QR image data
    const qrImageData = cachedQRImageData;
    const logoImageData = cachedLogoImageData;

    // Apply overlay opacity to data modules only
    ctx.globalAlpha = state.overlayAlpha;

    const currentModuleSize = state.moduleSize / 100;

    // Draw each module using cached colors
    for (let canvasY = 0; canvasY < totalModules; canvasY++) {
        for (let canvasX = 0; canvasX < totalModules; canvasX++) {
            const moduleX1 = Math.round(canvasX * modulePixelSize);
            const moduleY1 = Math.round(canvasY * modulePixelSize);
            const moduleX2 = Math.round((canvasX + 1) * modulePixelSize);
            const moduleY2 = Math.round((canvasY + 1) * modulePixelSize);
            const actualModuleWidth = moduleX2 - moduleX1;
            const actualModuleHeight = moduleY2 - moduleY1;

            const inQuietZone = canvasX < canvasQuietZone || canvasX >= contentModules + canvasQuietZone ||
                                canvasY < canvasQuietZone || canvasY >= contentModules + canvasQuietZone;

            if (inQuietZone) {
                ctx.globalAlpha = 1.0;
                ctx.fillStyle = hexToRgba(state.lightColor, state.lightAlpha);
                ctx.fillRect(moduleX1, moduleY1, actualModuleWidth, actualModuleHeight);
                ctx.globalAlpha = state.overlayAlpha;
                continue;
            }

            const contentX = canvasX - canvasQuietZone;
            const contentY = canvasY - canvasQuietZone;

            // Check if it's a finder pattern (skip, already drawn)
            const isFinder = isFinderPattern(contentX, contentY, contentModules);
            if (isFinder) {
                continue;
            }

            // Sample from QR to determine if dark or light
            const qrSampleX = quietZonePixels + Math.floor((contentX / contentModules) * contentWidth);
            const qrSampleY = quietZonePixels + Math.floor((contentY / contentModules) * contentHeight);
            const qrPixelIndex = (Math.min(qrSampleY, qrImageData.height - 1) * qrImageData.width +
                                  Math.min(qrSampleX, qrImageData.width - 1)) * 4;
            const qrBrightness = qrImageData.data[qrPixelIndex];
            const isDark = qrBrightness < 128;

            // Check for manual color override
            const overrideKey = `${contentX},${contentY}`;
            const colorOverride = state.moduleColors[overrideKey];

            // Skip if hidden
            if (colorOverride && colorOverride.type === 'hidden') {
                continue;
            }

            let moduleColor;

            // Use cached color if available
            if (state.cachedModuleColors[overrideKey]) {
                moduleColor = state.cachedModuleColors[overrideKey];
            } else if (colorOverride) {
                const palette = colorOverride.type === 'dark' ? state.darkPalette : state.lightPalette;
                moduleColor = palette[colorOverride.index];
            } else {
                // No cached color, use default
                moduleColor = isDark ? state.darkColor : state.lightColor;
            }

            const alpha = isDark ? state.darkAlpha : state.lightAlpha;
            ctx.fillStyle = hexToRgba(moduleColor, alpha);

            // Draw module with current shape
            const shrunkWidth = actualModuleWidth * currentModuleSize;
            const shrunkHeight = actualModuleHeight * currentModuleSize;
            const offsetX = (actualModuleWidth - shrunkWidth) / 2;
            const offsetY = (actualModuleHeight - shrunkHeight) / 2;
            const centerX = moduleX1 + offsetX + shrunkWidth / 2;
            const centerY = moduleY1 + offsetY + shrunkHeight / 2;

            if (state.moduleShape === 'circle') {
                const radius = Math.min(shrunkWidth, shrunkHeight) / 2;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.fill();
            } else if (state.moduleShape === 'rounded') {
                const x = moduleX1 + offsetX;
                const y = moduleY1 + offsetY;
                const radius = Math.min(shrunkWidth, shrunkHeight) * 0.25;
                ctx.beginPath();
                ctx.roundRect(x, y, shrunkWidth, shrunkHeight, radius);
                ctx.fill();
            } else if (state.moduleShape === 'diamond') {
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(Math.PI / 4);
                const halfSize = Math.min(shrunkWidth, shrunkHeight) / 2;
                ctx.fillRect(-halfSize, -halfSize, halfSize * 2, halfSize * 2);
                ctx.restore();
            } else {
                ctx.fillRect(moduleX1 + offsetX, moduleY1 + offsetY, shrunkWidth, shrunkHeight);
            }
        }
    }

    ctx.globalAlpha = 1.0;
}

export function drawQROverlay(ctx, canvasSize, logoInfo = null, findersOnly = false) {
    const qrImage = state.useUploadedQR ? state.uploadedQR : state.generatedQR;
    if (!qrImage) return;

    const img = new Image();
    img.onload = () => {
// Cache QR image
cachedQRImg = img;

// Get the QR code dimensions (works for both uploaded and generated)
const contentModules = state.qrSize;
const quietZonePixels = state.quietZonePixels;
const canvasQuietZone = state.canvasQuietZone;

// Total modules including canvas quiet zone
const totalModules = contentModules + 2 * canvasQuietZone;

// Calculate content area in the source image (excluding quiet zone)
const contentWidth = img.width - 2 * quietZonePixels;
const contentHeight = img.height - 2 * quietZonePixels;

// Create temp canvas to read QR code data
const qrTempCanvas = document.createElement('canvas');
const qrTempCtx = qrTempCanvas.getContext('2d');
qrTempCanvas.width = img.width;
qrTempCanvas.height = img.height;
qrTempCtx.drawImage(img, 0, 0);
const qrImageData = qrTempCtx.getImageData(0, 0, img.width, img.height);
// Cache QR ImageData
cachedQRImageData = qrImageData;

// Create temp canvas to read original logo data (not scaled canvas version)
let logoImageData = null;
if (logoInfo) {
    const logoTempCanvas = document.createElement('canvas');
    const logoTempCtx = logoTempCanvas.getContext('2d');
    logoTempCanvas.width = logoInfo.image.width;
    logoTempCanvas.height = logoInfo.image.height;
    logoTempCtx.drawImage(logoInfo.image, 0, 0);
    logoImageData = logoTempCtx.getImageData(0, 0, logoInfo.image.width, logoInfo.image.height);
    // Cache logo ImageData
    cachedLogoImageData = logoImageData;
}

// Module size on output canvas (includes quiet zone)
const modulePixelSize = canvasSize / totalModules;

// Helper function to draw a finder pattern
const drawFinderPattern = (contentX, contentY, corner) => {
    // contentX, contentY are the top-left coordinates in content space (0-based)
    // corner: 'tl' (top-left), 'tr' (top-right), 'bl' (bottom-left)
    // Convert to canvas coordinates (including quiet zone offset)
    const canvasX = contentX + canvasQuietZone;
    const canvasY = contentY + canvasQuietZone;

    // Calculate the 8×8 separator area bounds
    const separatorSize = 8;
    const sepX1 = Math.round(canvasX * modulePixelSize);
    const sepY1 = Math.round(canvasY * modulePixelSize);
    const sepX2 = Math.round((canvasX + separatorSize) * modulePixelSize);
    const sepY2 = Math.round((canvasY + separatorSize) * modulePixelSize);
    const sepWidth = sepX2 - sepX1;
    const sepHeight = sepY2 - sepY1;
    const sepCenterX = sepX1 + sepWidth / 2;
    const sepCenterY = sepY1 + sepHeight / 2;

    if (state.finderPattern === 'circle') {
// Circles centered at module position 3.5, 3.5 within the 8×8 separator area
// This aligns with the center of the 7×7 finder pattern
const centerX = sepX1 + (3.5 * modulePixelSize);
const centerY = sepY1 + (3.5 * modulePixelSize);

// Draw concentric circles with radii in module units:
// Separator (white): 4.5 modules radius (1 module border around 7-module finder)
// Outer dark: 3.5 modules radius (7 modules diameter)
// Middle light: 2.5 modules radius (5 modules diameter)
// Inner dark: 1.5 modules radius (3 modules diameter)

// Separator white circle (radius 4.5 = 3.5 finder + 1.0 separator)
const separatorRadius = 4.5 * modulePixelSize;
ctx.fillStyle = hexToRgba(state.lightColor, state.lightAlpha);
ctx.beginPath();
ctx.arc(centerX, centerY, separatorRadius, 0, Math.PI * 2);
ctx.fill();

// Outer dark circle (7 modules diameter = 3.5 modules radius)
const outerRadius = 3.5 * modulePixelSize;
ctx.fillStyle = hexToRgba(state.darkColor, state.darkAlpha);
ctx.beginPath();
ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
ctx.fill();

// Middle light ring (5 modules diameter = 2.5 modules radius)
const middleRadius = 2.5 * modulePixelSize;
ctx.fillStyle = hexToRgba(state.lightColor, state.lightAlpha);
ctx.beginPath();
ctx.arc(centerX, centerY, middleRadius, 0, Math.PI * 2);
ctx.fill();

// Inner dark circle (3 modules diameter = 1.5 modules radius)
const innerRadius = 1.5 * modulePixelSize;
ctx.fillStyle = hexToRgba(state.darkColor, state.darkAlpha);
ctx.beginPath();
ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
ctx.fill();
    } else if (state.finderPattern === 'hybrid') {
// Hybrid: circular outer rings with square center
const centerX = sepX1 + (3.5 * modulePixelSize);
const centerY = sepY1 + (3.5 * modulePixelSize);

// Separator white circle (radius 4.5 = 3.5 finder + 1.0 separator)
const separatorRadius = 4.5 * modulePixelSize;
ctx.fillStyle = hexToRgba(state.lightColor, state.lightAlpha);
ctx.beginPath();
ctx.arc(centerX, centerY, separatorRadius, 0, Math.PI * 2);
ctx.fill();

// Outer dark circle (7 modules diameter = 3.5 modules radius)
const outerRadius = 3.5 * modulePixelSize;
ctx.fillStyle = hexToRgba(state.darkColor, state.darkAlpha);
ctx.beginPath();
ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
ctx.fill();

// Middle light ring (5 modules diameter = 2.5 modules radius)
const middleRadius = 2.5 * modulePixelSize;
ctx.fillStyle = hexToRgba(state.lightColor, state.lightAlpha);
ctx.beginPath();
ctx.arc(centerX, centerY, middleRadius, 0, Math.PI * 2);
ctx.fill();

// Inner dark SQUARE (3×3 modules, centered at 3.5, 3.5)
// Square extends from 2.0 to 5.0 in both dimensions
const squareSize = 3 * modulePixelSize;
const squareX = centerX - (squareSize / 2);
const squareY = centerY - (squareSize / 2);
ctx.fillStyle = hexToRgba(state.darkColor, state.darkAlpha);
ctx.fillRect(squareX, squareY, squareSize, squareSize);
    } else if (state.finderPattern === 'hybrid-inverse') {
// Hybrid inverse: square outer rings with circular center
// First draw the 8×8 separator area (light background)
ctx.fillStyle = hexToRgba(state.lightColor, state.lightAlpha);
ctx.fillRect(sepX1, sepY1, sepWidth, sepHeight);

// Determine offset for 7×7 finder within 8×8 separator area
let xOffset = 0;
let yOffset = 0;
if (corner === 'tr') xOffset = 1;
if (corner === 'bl') yOffset = 1;

// Calculate 7×7 finder bounds with offset
const finderModules = 7;
const x1 = Math.round((canvasX + xOffset) * modulePixelSize);
const y1 = Math.round((canvasY + yOffset) * modulePixelSize);
const x2 = Math.round((canvasX + xOffset + finderModules) * modulePixelSize);
const y2 = Math.round((canvasY + yOffset + finderModules) * modulePixelSize);
const width = x2 - x1;
const height = y2 - y1;

// Outer 7×7: dark
ctx.fillStyle = hexToRgba(state.darkColor, state.darkAlpha);
ctx.fillRect(x1, y1, width, height);

// Inner 5×5: light (inset by 1 module on each side)
const inset1 = Math.round(modulePixelSize);
ctx.fillStyle = hexToRgba(state.lightColor, state.lightAlpha);
ctx.fillRect(x1 + inset1, y1 + inset1, width - 2 * inset1, height - 2 * inset1);

// Inner dark CIRCLE (3 modules diameter = 1.5 modules radius)
// Center the circle in the 7×7 square
const centerCircleX = x1 + width / 2;
const centerCircleY = y1 + height / 2;
const innerRadius = 1.5 * modulePixelSize;
ctx.fillStyle = hexToRgba(state.darkColor, state.darkAlpha);
ctx.beginPath();
ctx.arc(centerCircleX, centerCircleY, innerRadius, 0, Math.PI * 2);
ctx.fill();
    } else {
// Traditional square finder pattern
// First draw the 8×8 separator area (light background)
ctx.fillStyle = hexToRgba(state.lightColor, state.lightAlpha);
ctx.fillRect(sepX1, sepY1, sepWidth, sepHeight);

// Determine offset for 7×7 finder within 8×8 separator area
// Top-left: separator on right & bottom -> offset (0, 0)
// Top-right: separator on left & bottom -> offset (1, 0)
// Bottom-left: separator on right & top -> offset (0, 1)
let xOffset = 0;
let yOffset = 0;
if (corner === 'tr') xOffset = 1;
if (corner === 'bl') yOffset = 1;

// Calculate 7×7 finder bounds with offset
const finderModules = 7;
const x1 = Math.round((canvasX + xOffset) * modulePixelSize);
const y1 = Math.round((canvasY + yOffset) * modulePixelSize);
const x2 = Math.round((canvasX + xOffset + finderModules) * modulePixelSize);
const y2 = Math.round((canvasY + yOffset + finderModules) * modulePixelSize);
const width = x2 - x1;
const height = y2 - y1;

// Outer 7×7: dark
ctx.fillStyle = hexToRgba(state.darkColor, state.darkAlpha);
ctx.fillRect(x1, y1, width, height);

// Inner 5×5: light (inset by 1 module on each side)
const inset1 = Math.round(modulePixelSize);
ctx.fillStyle = hexToRgba(state.lightColor, state.lightAlpha);
ctx.fillRect(x1 + inset1, y1 + inset1, width - 2 * inset1, height - 2 * inset1);

// Inner 3×3: dark (inset by 2 modules on each side)
const inset2 = Math.round(modulePixelSize * 2);
ctx.fillStyle = hexToRgba(state.darkColor, state.darkAlpha);
ctx.fillRect(x1 + inset2, y1 + inset2, width - 2 * inset2, height - 2 * inset2);
    }
};

// Finder patterns and quiet zone should always be drawn at full opacity
ctx.globalAlpha = 1.0;

// Draw the three finder patterns before drawing individual modules
// Patterns with circular outer use centered positioning, square outer use offset positioning
if (state.finderPattern === 'circle' || state.finderPattern === 'hybrid') {
    // Circle/Hybrid (circular outer): 8×8 area positioned so circles are at standard finder positions
    drawFinderPattern(0, 0, 'tl');
    drawFinderPattern(contentModules - 7, 0, 'tr');
    drawFinderPattern(0, contentModules - 7, 'bl');
} else {
    // Square/Hybrid-Inverse (square outer): 8×8 area positioned to allow separator on correct sides
    // Top-left (0, 0): separator on right & bottom
    // Top-right (size-8, 0): separator on left & bottom
    // Bottom-left (0, size-8): separator on right & top
    drawFinderPattern(0, 0, 'tl');
    drawFinderPattern(contentModules - 8, 0, 'tr');
    drawFinderPattern(0, contentModules - 8, 'bl');
}

// If only drawing finders (during logo dragging), stop here
if (findersOnly) {
    return; // globalAlpha already reset above
}

// Apply overlay opacity for data modules only (not finders or quiet zone)
ctx.globalAlpha = state.overlayAlpha;

// Draw all modules (including quiet zone)
for (let y = 0; y < totalModules; y++) {
    for (let x = 0; x < totalModules; x++) {
// Check if we're in the canvas quiet zone
const inQuietZone = x < canvasQuietZone || x >= contentModules + canvasQuietZone ||
  y < canvasQuietZone || y >= contentModules + canvasQuietZone;

// Convert to content coordinates (needed for color overrides later)
const contentX = x - canvasQuietZone;
const contentY = y - canvasQuietZone;

let isDark = false;
let isFinder = false;

if (!inQuietZone) {

    // Sample QR code from content area only (skip quiet zone in source image)
    const qrContentPixelX = (contentX * contentWidth) / contentModules;
    const qrContentPixelY = (contentY * contentHeight) / contentModules;
    const qrSampleX = Math.floor(quietZonePixels + qrContentPixelX + contentWidth / contentModules / 2);
    const qrSampleY = Math.floor(quietZonePixels + qrContentPixelY + contentHeight / contentModules / 2);
    const qrClampedX = Math.min(qrSampleX, img.width - 1);
    const qrClampedY = Math.min(qrSampleY, img.height - 1);
    const qrPixelIndex = (qrClampedY * img.width + qrClampedX) * 4;
    isDark = qrImageData.data[qrPixelIndex] < 128;

    // Determine if this is a finder pattern (in content coordinates)
    isFinder = isFinderPattern(contentX, contentY, contentModules);
}

const currentModuleSize = isFinder ? 1 : state.moduleSize / 100;

// Use pixel-aligned boundaries to avoid gaps
const moduleX1 = Math.round(x * modulePixelSize);
const moduleY1 = Math.round(y * modulePixelSize);
const moduleX2 = Math.round((x + 1) * modulePixelSize);
const moduleY2 = Math.round((y + 1) * modulePixelSize);
const actualModuleWidth = moduleX2 - moduleX1;
const actualModuleHeight = moduleY2 - moduleY1;

// Quiet zone modules are always light colored (full size, full opacity)
if (inQuietZone) {
    ctx.globalAlpha = 1.0; // Quiet zone always at full opacity
    ctx.fillStyle = hexToRgba(state.lightColor, state.lightAlpha);
    ctx.fillRect(moduleX1, moduleY1, actualModuleWidth, actualModuleHeight);
    ctx.globalAlpha = state.overlayAlpha; // Restore overlay opacity for data modules
    continue;
}

// Determine color for this module
let moduleColor;

// Check for manual color override first
const overrideKey = `${contentX},${contentY}`;
const colorOverride = state.moduleColors[overrideKey];

// Skip drawing if module is hidden
if (colorOverride && colorOverride.type === 'hidden') {
    continue;
}

if (colorOverride) {
    // Use manually assigned color
    const palette = colorOverride.type === 'dark' ? state.darkPalette : state.lightPalette;
    moduleColor = palette[colorOverride.index];
} else if (isFinder) {
    // Finders use single color for reliability
    moduleColor = isDark ? state.darkColor : state.lightColor;
} else if (logoImageData && logoInfo) {
    // Sample from ORIGINAL logo image at module center
    const moduleCenterX = moduleX1 + actualModuleWidth / 2;
    const moduleCenterY = moduleY1 + actualModuleHeight / 2;

    // Map canvas position to original logo position
    const logoLocalX = moduleCenterX - logoInfo.x;
    const logoLocalY = moduleCenterY - logoInfo.y;

    // Check if module center is within the scaled logo bounds
    const isInsideLogo = logoLocalX >= 0 && logoLocalX < logoInfo.width &&
                         logoLocalY >= 0 && logoLocalY < logoInfo.height;

    if (isInsideLogo) {
        // Convert from scaled logo coordinates to original image coordinates
        const logoOriginalX = Math.floor((logoLocalX / logoInfo.width) * logoInfo.image.width);
        const logoOriginalY = Math.floor((logoLocalY / logoInfo.height) * logoInfo.image.height);

        // Clamp to logo bounds (safety)
        const clampedX = Math.max(0, Math.min(logoInfo.image.width - 1, logoOriginalX));
        const clampedY = Math.max(0, Math.min(logoInfo.image.height - 1, logoOriginalY));

        const logoPixelIndex = (clampedY * logoInfo.image.width + clampedX) * 4;

        const sampledR = logoImageData.data[logoPixelIndex];
        const sampledG = logoImageData.data[logoPixelIndex + 1];
        const sampledB = logoImageData.data[logoPixelIndex + 2];

        if (state.colorMode === 'gradient') {
            // Gradient mode: preserve hue/saturation, adjust lightness only when needed
            const hsl = rgbToHsl(sampledR, sampledG, sampledB);

            // Adjust lightness based on module type
            if (isDark) {
                // Dark module: only darken if logo pixel is too bright
                // If already dark enough, keep it
                if (hsl.l > state.darkMaxLuminosity) {
                    hsl.l = state.darkMaxLuminosity;
                }
                // Otherwise keep original darkness
            } else {
                // Light module: only brighten if logo pixel is too dark
                // If already bright enough, keep it
                if (hsl.l < state.lightMinLuminosity) {
                    hsl.l = state.lightMinLuminosity;
                }
                // Otherwise keep original brightness (don't reduce!)
            }

            // Convert back to RGB
            const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);

            // Convert to hex
            const r = rgb.r.toString(16).padStart(2, '0');
            const g = rgb.g.toString(16).padStart(2, '0');
            const b = rgb.b.toString(16).padStart(2, '0');
            moduleColor = `#${r}${g}${b}`;
        } else {
            // Palette mode: find best matching color from appropriate palette
            const palette = isDark ? state.darkPalette : state.lightPalette;
            moduleColor = findBestMatch([sampledR, sampledG, sampledB], palette);
        }
    } else {
        // Module center is outside logo bounds
        if (state.colorMode === 'palette') {
            // Palette mode: use palette based on module type (dark or light from QR code)
            const palette = isDark ? state.darkPalette : state.lightPalette;
            moduleColor = palette[0];
        } else {
            // Gradient mode: use background fill color with luminosity adjustments
            let fillColor;
            if (state.backgroundFill === 'light') {
                fillColor = state.lightColor;
            } else if (state.backgroundFill === 'dark') {
                fillColor = state.darkColor;
            } else {
                // Transparent - use default colors
                fillColor = isDark ? state.darkColor : state.lightColor;
            }

            if (state.backgroundFill !== 'transparent') {
                // Parse the fill color to RGB
                const hex = fillColor.replace('#', '');
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);

                const hsl = rgbToHsl(r, g, b);

                // Apply luminosity based on module type
                if (isDark) {
                    if (hsl.l > state.darkMaxLuminosity) {
                        hsl.l = state.darkMaxLuminosity;
                    }
                } else {
                    if (hsl.l < state.lightMinLuminosity) {
                        hsl.l = state.lightMinLuminosity;
                    }
                }

                // Convert back to RGB
                const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
                const rHex = rgb.r.toString(16).padStart(2, '0');
                const gHex = rgb.g.toString(16).padStart(2, '0');
                const bHex = rgb.b.toString(16).padStart(2, '0');
                moduleColor = `#${rHex}${gHex}${bHex}`;
            } else {
                moduleColor = fillColor;
            }
        }
    }
} else {
    // No logo - use default colors
    moduleColor = isDark ? state.darkColor : state.lightColor;
}

// Cache the calculated color for drag performance
if (!colorOverride && !isFinder) {
    state.cachedModuleColors[overrideKey] = moduleColor;
}

// Skip finder modules - they're already drawn
if (isFinder) {
    continue;
}

const alpha = isDark ? state.darkAlpha : state.lightAlpha;
ctx.fillStyle = hexToRgba(moduleColor, alpha);

// Data modules: apply size and shape
const shrunkWidth = actualModuleWidth * currentModuleSize;
const shrunkHeight = actualModuleHeight * currentModuleSize;
const offsetX = (actualModuleWidth - shrunkWidth) / 2;
const offsetY = (actualModuleHeight - shrunkHeight) / 2;
const centerX = moduleX1 + offsetX + shrunkWidth / 2;
const centerY = moduleY1 + offsetY + shrunkHeight / 2;

// Draw shape based on state.moduleShape
if (state.moduleShape === 'circle') {
    // Draw circle
    const radius = Math.min(shrunkWidth, shrunkHeight) / 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
} else if (state.moduleShape === 'rounded') {
    // Draw rounded square
    const x = moduleX1 + offsetX;
    const y = moduleY1 + offsetY;
    const radius = Math.min(shrunkWidth, shrunkHeight) * 0.25; // 25% radius
    ctx.beginPath();
    ctx.roundRect(x, y, shrunkWidth, shrunkHeight, radius);
    ctx.fill();
} else if (state.moduleShape === 'diamond') {
    // Draw diamond (45° rotated square)
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(Math.PI / 4); // 45 degrees
    const halfSize = Math.min(shrunkWidth, shrunkHeight) / 2;
    ctx.fillRect(-halfSize, -halfSize, halfSize * 2, halfSize * 2);
    ctx.restore();
} else {
    // Default: square
    ctx.fillRect(moduleX1 + offsetX, moduleY1 + offsetY, shrunkWidth, shrunkHeight);
}
    }
}

                // Reset global alpha
                ctx.globalAlpha = 1.0;
            };
            img.src = qrImage;
        }

export function setCachedLogoImg(img) {
    cachedLogoImg = img;
}

export function getCachedLogoImg() {
    return cachedLogoImg;
}
