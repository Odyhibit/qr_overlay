/**
 * Application State Management
 * Central state object for the QR overlay application
 */

export const state = {
    qrText: 'https://example.com',
    eccLevel: 'H',        // Error correction level: L, M, Q, H
    uploadedQR: null,
    generatedQR: null,
    useUploadedQR: false,
    qrSize: 25,
    quietZonePixels: 16,  // Quiet zone in source image (pixels)
    canvasQuietZone: 2,   // Quiet zone to display on canvas (modules)
    logoImage: null,
    moduleSize: 50,       // Default to 50% for dithering effect
    moduleShape: 'square', // 'square', 'circle', etc.
    finderPattern: 'square', // 'square', 'circle', etc.
    darkColor: '#000000',
    darkAlpha: 1,
    lightColor: '#ffffff',
    lightAlpha: 1,
    darkPalette: ['#000000', '#333333', '#1a1a1a', '#0d0d0d'],  // 4 dark colors
    lightPalette: ['#ffffff', '#f0f0f0', '#e0e0e0', '#d0d0d0'], // 4 light colors
    moduleColors: {},     // Per-module color overrides: {x,y} -> colorIndex
    cachedModuleColors: {}, // Cached computed colors for performance during drag
    overlayAlpha: 1,      // Overall QR overlay opacity
    backgroundFill: 'transparent',  // 'transparent', 'light', or 'dark'
    logoScale: 100,
    logoX: 50,
    logoY: 50,
    colorMode: 'palette', // 'palette' or 'gradient'
    darkMaxLuminosity: 33,  // Max luminosity for dark modules in gradient mode (0-50)
    lightMinLuminosity: 66,  // Min luminosity for light modules in gradient mode (50-100)
    interactionMode: 'position'  // 'position', 'color', 'delete'
};
