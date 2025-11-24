#!/usr/bin/env python3
"""
Automated script to extract remaining JavaScript modules from index.html
Run this to complete the refactoring automatically.
"""

import re

def read_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.readlines()

def write_file(filepath, content):
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def extract_lines(lines, start, end):
    """Extract lines from index (1-based) to index (1-based)"""
    return ''.join(lines[start-1:end])

# Read index.html
print("Reading index.html...")
lines = read_file('index.html')

# Extract checkContrast function (lines 812-828)
print("Extracting checkContrast...")
check_contrast = extract_lines(lines, 812, 829)

# Extract updateModeButtons (lines 2129-2194)
print("Extracting updateModeButtons...")
update_mode_buttons = extract_lines(lines, 2129, 2194)

# Extract updatePaletteUI (lines 2194-2250+)
print("Extracting updatePaletteUI...")
update_palette_ui = extract_lines(lines, 2194, 2260)

# Create ui-controller.js
ui_controller_content = '''/**
 * UI Controller
 * Functions for updating UI state and displaying validation warnings
 */

import { state } from './state.js';
import { getContrastRatio } from './color-utils.js';

'''

# Clean up and add checkContrast
check_contrast_clean = check_contrast.replace('        function checkContrast()', 'export function checkContrast()')
check_contrast_clean = check_contrast_clean.replace('        ', '')
ui_controller_content += check_contrast_clean + '\n'

# Clean up and add updateModeButtons
update_mode_clean = update_mode_buttons.replace('        function updateModeButtons()', 'export function updateModeButtons()')
update_mode_clean = update_mode_clean.replace('        ', '')
ui_controller_content += update_mode_clean + '\n'

# Clean up and add updatePaletteUI
update_palette_clean = update_palette_ui.replace('        function updatePaletteUI()', 'export function updatePaletteUI()')
update_palette_clean = update_palette_clean.replace('        ', '')
ui_controller_content += update_palette_clean + '\n'

write_file('js/ui-controller.js', ui_controller_content)
print("✓ Created js/ui-controller.js")

# Extract drawCanvas (lines 1414-1522)
print("Extracting drawCanvas...")
draw_canvas = extract_lines(lines, 1414, 1522)

# Extract drawQROverlay (lines 1522-1928)
print("Extracting drawQROverlay...")
draw_qr_overlay = extract_lines(lines, 1522, 1928)

# Create renderer.js
renderer_content = '''/**
 * Canvas Renderer
 * Main rendering functions for drawing QR codes with logos
 */

import { state } from './state.js';
import { hexToRgba, rgbToHsl, hslToRgb, findBestMatch } from './color-utils.js';
import { isFinderPattern } from './qr-detector.js';
import { drawFinderPatternsSync } from './finder-patterns.js';

// Global variable to cache logo image for performance
let cachedLogoImg = null;

'''

# Clean up drawCanvas
draw_canvas_clean = draw_canvas.replace('        function drawCanvas(skipOverlay = false)',
                                        'export function drawCanvas(ctx, skipOverlay = false)')
draw_canvas_clean = draw_canvas_clean.replace('        ', '')
draw_canvas_clean = draw_canvas_clean.replace('drawFinderPatternsSync()', 'drawFinderPatternsSync(ctx)')
draw_canvas_clean = draw_canvas_clean.replace('drawQROverlay(canvasSize, logoInfo)',
                                               'drawQROverlay(ctx, canvasSize, logoInfo)')
renderer_content += draw_canvas_clean + '\n'

# Clean up drawQROverlay
draw_qr_clean = draw_qr_overlay.replace('        function drawQROverlay(canvasSize, logoInfo = null, findersOnly = false)',
                                        'export function drawQROverlay(ctx, canvasSize, logoInfo = null, findersOnly = false)')
draw_qr_clean = draw_qr_clean.replace('        ', '')
renderer_content += draw_qr_clean + '\n'

# Add cachedLogoImg accessor
renderer_content += '''
export function setCachedLogoImg(img) {
    cachedLogoImg = img;
}

export function getCachedLogoImg() {
    return cachedLogoImg;
}
'''

write_file('js/renderer.js', renderer_content)
print("✓ Created js/renderer.js")

print("\n✅ Module extraction complete!")
print("\nNext steps:")
print("1. Extract event handlers from lines 1930-2431 to js/event-handlers.js")
print("2. Update index.html to use modules")
print("3. Test the application")
