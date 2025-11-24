/**
 * QR Code Generation
 * Functions for generating QR codes from text using QRCode.js library
 */

import { state } from './state.js';
import { detectQRGeometry } from './qr-detector.js';

/**
 * Generate QR code from text input
 * Uses QRCode.js library and auto-detects the generated code dimensions
 * @param {Function} drawCanvasCallback - Callback to redraw canvas after generation
 * @param {Function} updateModeButtonsCallback - Callback to update UI buttons
 */
export function generateQRCode(drawCanvasCallback, updateModeButtonsCallback) {
    if (!state.qrText.trim()) return;

    // Create a temporary container for QRCode.js
    const tempDiv = document.createElement('div');
    tempDiv.style.display = 'none';
    document.body.appendChild(tempDiv);

    try {
        // Generate QR code using QRCode.js
        const qr = new QRCode(tempDiv, {
            text: state.qrText,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel[state.eccLevel]
        });

        // Wait for the QR code to be generated
        setTimeout(() => {
            // Check if QRCode.js exposes module count directly
            console.log('QRCode object:', qr);
            console.log('QRCode properties:', Object.keys(qr));
            if (qr._oQRCode) {
                console.log('_oQRCode:', qr._oQRCode);
                console.log('_oQRCode properties:', Object.keys(qr._oQRCode));
                if (qr._oQRCode.moduleCount) {
                    console.log('Module count from library:', qr._oQRCode.moduleCount);
                }
            }

            const qrImage = tempDiv.querySelector('img');
            if (qrImage) {
                state.generatedQR = qrImage.src;
                state.useUploadedQR = false;
                state.moduleColors = {};  // Clear manual color overrides

                // Check if we can get module count directly from the library
                let moduleCountFromLib = null;
                if (qr._oQRCode && qr._oQRCode.moduleCount) {
                    moduleCountFromLib = qr._oQRCode.moduleCount;
                }

                // Auto-detect the generated QR code
                const img = new Image();
                img.onload = () => {
                    // Use library-provided module count if available, otherwise detect
                    if (moduleCountFromLib) {
                        state.qrSize = moduleCountFromLib;
                        state.quietZonePixels = 0;  // QRCode.js doesn't add quiet zone to the image
                        console.log(`Generated: ${moduleCountFromLib}×${moduleCountFromLib} QR code (from library)`);
                    } else {
                        const detected = detectQRGeometry(img);
                        state.qrSize = detected.moduleCount;
                        state.quietZonePixels = detected.quietZonePixels;
                        console.log(`Generated: ${detected.moduleCount}×${detected.moduleCount} QR code with ${detected.quietZonePixels}px quiet zone (detected)`);
                    }

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
                };
                img.src = state.generatedQR;
            }

            // Clean up temp div
            document.body.removeChild(tempDiv);
        }, 100);
    } catch (error) {
        console.error('QR generation error:', error);
        document.body.removeChild(tempDiv);
        alert('Failed to generate QR code. Please check your input.');
    }
}
