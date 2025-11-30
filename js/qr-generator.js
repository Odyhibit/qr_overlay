/**
 * QR Code Generation
 * Functions for generating QR codes from text using QRCode.js library
 */

import { state } from './state.js';
import { detectQRGeometry } from './qr-detector.js';

/**
 * Generate QR code from text input
 * Uses qrcode-generator library which properly supports all QR versions 1-40
 * @param {Function} drawCanvasCallback - Callback to redraw canvas after generation
 * @param {Function} updateModeButtonsCallback - Callback to update UI buttons
 */
export function generateQRCode(drawCanvasCallback, updateModeButtonsCallback) {
    if (!state.qrText.trim()) return;

    try {
        // Generate QR code using qrcode-generator library
        // typeNumber 0 means auto-detect optimal version
        const qr = window.qrcode(0, state.eccLevel);
        qr.addData(state.qrText);
        qr.make();

        // Get the module count (QR code size)
        const moduleCount = qr.getModuleCount();
        console.log(`Generated QR Version: ${(moduleCount - 17) / 4 + 1}, Size: ${moduleCount}×${moduleCount}`);

        // Create data URL with 10px per module, 0px margin (we handle quiet zone separately)
        const cellSize = 10;
        const margin = 0;
        const dataURL = qr.createDataURL(cellSize, margin);

        // Update state
        state.generatedQR = dataURL;
        state.useUploadedQR = false;
        state.moduleColors = {};  // Clear manual color overrides
        state.qrSize = moduleCount;
        state.quietZonePixels = 0;  // qrcode-generator doesn't add quiet zone to the image

        // Auto-adjust logo scale to fit content area
        if (state.logoImage) {
            const totalModules = state.qrSize + 2 * state.canvasQuietZone;
            const contentScale = Math.round((state.qrSize / totalModules) * 100);
            state.logoScale = contentScale;
            const logoScaleInput = document.getElementById('logoScale');
            if (logoScaleInput) {
                logoScaleInput.value = contentScale;
                const label = document.getElementById('logoScaleLabel');
                if (label) label.textContent = contentScale;
            }
        }

        drawCanvasCallback();
        updateModeButtonsCallback();
    } catch (error) {
        console.error('QR generation error:', error);
        alert('Failed to generate QR code. Please check your input.');
    }
}
