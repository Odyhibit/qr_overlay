/**
 * Finder Pattern Drawing
 * Functions for drawing QR code finder patterns (position markers) during logo positioning
 */

import { state } from './state.js';
import { hexToRgba } from './color-utils.js';

/**
 * Draw finder patterns synchronously (used during logo dragging)
 * Renders all three finder patterns and quiet zone at full opacity
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 */
export function drawFinderPatternsSync(ctx) {
    const qrImage = state.useUploadedQR ? state.uploadedQR : state.generatedQR;
    if (!qrImage) return;

    // Always draw finder patterns and quiet zone at full opacity
    // (overlay opacity should only affect data modules)
    ctx.globalAlpha = 1.0;

    const canvasSize = 600;
    const contentModules = state.qrSize;
    const canvasQuietZone = state.canvasQuietZone;
    const totalModules = contentModules + 2 * canvasQuietZone;
    const modulePixelSize = canvasSize / totalModules;

    // Helper function to draw a finder pattern
    const drawFinderPattern = (contentX, contentY, corner) => {
        const canvasX = contentX + canvasQuietZone;
        const canvasY = contentY + canvasQuietZone;

        const separatorSize = 8;
        const sepX1 = Math.round(canvasX * modulePixelSize);
        const sepY1 = Math.round(canvasY * modulePixelSize);
        const sepX2 = Math.round((canvasX + separatorSize) * modulePixelSize);
        const sepY2 = Math.round((canvasY + separatorSize) * modulePixelSize);
        const sepWidth = sepX2 - sepX1;
        const sepHeight = sepY2 - sepY1;

        if (state.finderPattern === 'circle') {
            const centerX = sepX1 + (3.5 * modulePixelSize);
            const centerY = sepY1 + (3.5 * modulePixelSize);

            const separatorRadius = 4.5 * modulePixelSize;
            ctx.fillStyle = hexToRgba(state.lightColor, state.lightAlpha);
            ctx.beginPath();
            ctx.arc(centerX, centerY, separatorRadius, 0, Math.PI * 2);
            ctx.fill();

            const outerRadius = 3.5 * modulePixelSize;
            ctx.fillStyle = hexToRgba(state.darkColor, state.darkAlpha);
            ctx.beginPath();
            ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
            ctx.fill();

            const middleRadius = 2.5 * modulePixelSize;
            ctx.fillStyle = hexToRgba(state.lightColor, state.lightAlpha);
            ctx.beginPath();
            ctx.arc(centerX, centerY, middleRadius, 0, Math.PI * 2);
            ctx.fill();

            const innerRadius = 1.5 * modulePixelSize;
            ctx.fillStyle = hexToRgba(state.darkColor, state.darkAlpha);
            ctx.beginPath();
            ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
            ctx.fill();
        } else if (state.finderPattern === 'hybrid') {
            const centerX = sepX1 + (3.5 * modulePixelSize);
            const centerY = sepY1 + (3.5 * modulePixelSize);

            const separatorRadius = 4.5 * modulePixelSize;
            ctx.fillStyle = hexToRgba(state.lightColor, state.lightAlpha);
            ctx.beginPath();
            ctx.arc(centerX, centerY, separatorRadius, 0, Math.PI * 2);
            ctx.fill();

            const outerRadius = 3.5 * modulePixelSize;
            ctx.fillStyle = hexToRgba(state.darkColor, state.darkAlpha);
            ctx.beginPath();
            ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
            ctx.fill();

            const middleRadius = 2.5 * modulePixelSize;
            ctx.fillStyle = hexToRgba(state.lightColor, state.lightAlpha);
            ctx.beginPath();
            ctx.arc(centerX, centerY, middleRadius, 0, Math.PI * 2);
            ctx.fill();

            const squareSize = 3 * modulePixelSize;
            const squareX = centerX - (squareSize / 2);
            const squareY = centerY - (squareSize / 2);
            ctx.fillStyle = hexToRgba(state.darkColor, state.darkAlpha);
            ctx.fillRect(squareX, squareY, squareSize, squareSize);
        } else if (state.finderPattern === 'hybrid-inverse') {
            ctx.fillStyle = hexToRgba(state.lightColor, state.lightAlpha);
            ctx.fillRect(sepX1, sepY1, sepWidth, sepHeight);

            let xOffset = 0;
            let yOffset = 0;
            if (corner === 'tr') xOffset = 1;
            if (corner === 'bl') yOffset = 1;

            const finderModules = 7;
            const x1 = Math.round((canvasX + xOffset) * modulePixelSize);
            const y1 = Math.round((canvasY + yOffset) * modulePixelSize);
            const x2 = Math.round((canvasX + xOffset + finderModules) * modulePixelSize);
            const y2 = Math.round((canvasY + yOffset + finderModules) * modulePixelSize);
            const width = x2 - x1;
            const height = y2 - y1;

            ctx.fillStyle = hexToRgba(state.darkColor, state.darkAlpha);
            ctx.fillRect(x1, y1, width, height);

            const inset1 = Math.round(modulePixelSize);
            ctx.fillStyle = hexToRgba(state.lightColor, state.lightAlpha);
            ctx.fillRect(x1 + inset1, y1 + inset1, width - 2 * inset1, height - 2 * inset1);

            const centerCircleX = x1 + width / 2;
            const centerCircleY = y1 + height / 2;
            const innerRadius = 1.5 * modulePixelSize;
            ctx.fillStyle = hexToRgba(state.darkColor, state.darkAlpha);
            ctx.beginPath();
            ctx.arc(centerCircleX, centerCircleY, innerRadius, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = hexToRgba(state.lightColor, state.lightAlpha);
            ctx.fillRect(sepX1, sepY1, sepWidth, sepHeight);

            let xOffset = 0;
            let yOffset = 0;
            if (corner === 'tr') xOffset = 1;
            if (corner === 'bl') yOffset = 1;

            const finderModules = 7;
            const x1 = Math.round((canvasX + xOffset) * modulePixelSize);
            const y1 = Math.round((canvasY + yOffset) * modulePixelSize);
            const x2 = Math.round((canvasX + xOffset + finderModules) * modulePixelSize);
            const y2 = Math.round((canvasY + yOffset + finderModules) * modulePixelSize);
            const width = x2 - x1;
            const height = y2 - y1;

            ctx.fillStyle = hexToRgba(state.darkColor, state.darkAlpha);
            ctx.fillRect(x1, y1, width, height);

            const inset1 = Math.round(modulePixelSize);
            ctx.fillStyle = hexToRgba(state.lightColor, state.lightAlpha);
            ctx.fillRect(x1 + inset1, y1 + inset1, width - 2 * inset1, height - 2 * inset1);

            const inset2 = Math.round(2 * modulePixelSize);
            ctx.fillStyle = hexToRgba(state.darkColor, state.darkAlpha);
            ctx.fillRect(x1 + inset2, y1 + inset2, width - 2 * inset2, height - 2 * inset2);
        }
    };

    // Draw quiet zone overlay (white border around QR content)
    const quietZoneModules = canvasQuietZone;
    const quietZonePixels = quietZoneModules * modulePixelSize;

    ctx.fillStyle = hexToRgba(state.lightColor, state.lightAlpha);

    // Top quiet zone
    ctx.fillRect(0, 0, canvasSize, quietZonePixels);
    // Bottom quiet zone
    ctx.fillRect(0, canvasSize - quietZonePixels, canvasSize, quietZonePixels);
    // Left quiet zone
    ctx.fillRect(0, 0, quietZonePixels, canvasSize);
    // Right quiet zone
    ctx.fillRect(canvasSize - quietZonePixels, 0, quietZonePixels, canvasSize);

    // Draw the three finder patterns
    if (state.finderPattern === 'circle' || state.finderPattern === 'hybrid') {
        drawFinderPattern(0, 0, 'tl');
        drawFinderPattern(contentModules - 7, 0, 'tr');
        drawFinderPattern(0, contentModules - 7, 'bl');
    } else {
        drawFinderPattern(0, 0, 'tl');
        drawFinderPattern(contentModules - 8, 0, 'tr');
        drawFinderPattern(0, contentModules - 8, 'bl');
    }
}
