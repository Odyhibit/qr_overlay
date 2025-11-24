/**
 * UI Controller
 * Functions for updating UI state and displaying validation warnings
 */

import { state } from './state.js';
import { getContrastRatio } from './color-utils.js';

/**
 * Check contrast between dark and light palette colors
 * Displays warning if contrast is too low for QR readability
 */
export function checkContrast() {
    let hasLowContrast = false;
    const minContrast = 3.0; // QR codes need at least 3:1 contrast

    for (const darkColor of state.darkPalette) {
        for (const lightColor of state.lightPalette) {
            const ratio = getContrastRatio(darkColor, lightColor);
            if (ratio < minContrast) {
                hasLowContrast = true;
                break;
            }
        }
        if (hasLowContrast) break;
    }

    const contrastWarning = document.getElementById('contrastWarning');
    if (contrastWarning) {
        contrastWarning.style.display = hasLowContrast ? 'block' : 'none';
    }
}

/**
 * Update interaction mode button states based on current state
 */
export function updateModeButtons() {
    const hasQR = state.uploadedQR || state.generatedQR;
    const hasLogo = state.logoImage;

    const positionModeBtn = document.getElementById('positionModeBtn');
    const colorModeBtn = document.getElementById('colorModeBtn');
    const deleteModeBtn = document.getElementById('deleteModeBtn');
    const canvas = document.getElementById('canvas');

    if (!positionModeBtn || !colorModeBtn || !deleteModeBtn || !canvas) return;

    // Update button states
    positionModeBtn.disabled = !hasQR || !hasLogo;
    colorModeBtn.disabled = !hasQR || state.colorMode === 'gradient';
    deleteModeBtn.disabled = !hasQR;

    // Update active state
    positionModeBtn.classList.toggle('active', state.interactionMode === 'position');
    colorModeBtn.classList.toggle('active', state.interactionMode === 'color');
    deleteModeBtn.classList.toggle('active', state.interactionMode === 'delete');

    // Update cursor
    if (state.interactionMode === 'position' && hasLogo) {
        canvas.style.cursor = 'move';
    } else if (state.interactionMode === 'color') {
        canvas.style.cursor = 'crosshair';
    } else if (state.interactionMode === 'delete') {
        canvas.style.cursor = 'crosshair';
    } else {
        canvas.style.cursor = 'default';
    }
}

/**
 * Update palette UI inputs to match current state
 */
export function updatePaletteUI() {
    for (let i = 0; i < 4; i++) {
        const darkInput = document.getElementById(`darkPalette${i}`);
        const lightInput = document.getElementById(`lightPalette${i}`);

        if (darkInput) darkInput.value = state.darkPalette[i];
        if (lightInput) lightInput.value = state.lightPalette[i];
    }
    checkContrast();
}
