#!/usr/bin/env python3
"""
Create event-handlers.js by extracting from index.html
"""

def read_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.readlines()

def write_file(filepath, content):
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

lines = read_file('index.html')

# Extract event listeners section (lines 1930-2428, before </script>)
event_section = ''.join(lines[1929:2428])  # 0-indexed, so 1929 = line 1930

# Clean up indentation (remove 8 spaces)
event_section = '\n'.join(line[8:] if line.startswith('        ') else line
                          for line in event_section.split('\n'))

# Create the module
content = '''/**
 * Event Handlers
 * All DOM event listeners and user interactions
 */

import { state } from './state.js';
import { extractDominantColors } from './color-extractor.js';
import { detectQRGeometry } from './qr-detector.js';
import { generateQRCode } from './qr-generator.js';
import { drawCanvas, setCachedLogoImg, getCachedLogoImg } from './renderer.js';
import { updateModeButtons, updatePaletteUI, checkContrast } from './ui-controller.js';

// Get DOM elements
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const generateBtn = document.getElementById('generateBtn');
const qrText = document.getElementById('qrText');
const qrUpload = document.getElementById('qrUpload');
const logoUpload = document.getElementById('logoUpload');
const exportBtn = document.getElementById('exportBtn');
const qrSizeSelect = document.getElementById('qrSize');
const quietZoneInput = document.getElementById('quietZone');
const quietZoneContainer = document.getElementById('quietZoneContainer');
const canvasQuietZoneInput = document.getElementById('canvasQuietZone');
const logoScale = document.getElementById('logoScale');
const moduleSize = document.getElementById('moduleSize');
const moduleShape = document.getElementById('moduleShape');
const finderPattern = document.getElementById('finderPattern');
const overlayAlpha = document.getElementById('overlayAlpha');
const colorMode = document.getElementById('colorMode');
const darkMaxLuminosity = document.getElementById('darkMaxLuminosity');
const lightMinLuminosity = document.getElementById('lightMinLuminosity');
const backgroundFill = document.getElementById('backgroundFill');
const eccLevel = document.getElementById('eccLevel');
const positionModeBtn = document.getElementById('positionModeBtn');
const colorModeBtn = document.getElementById('colorModeBtn');
const deleteModeBtn = document.getElementById('deleteModeBtn');
const paletteToggle = document.getElementById('paletteToggle');
const paletteEditor = document.getElementById('paletteEditor');
const setupToggle = document.getElementById('setupToggle');
const setupPanel = document.getElementById('setupPanel');
const gradientControls = document.getElementById('gradientControls');
const paletteInstructions = document.getElementById('paletteInstructions');
const contrastWarning = document.getElementById('contrastWarning');

// Canvas interaction state
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let selectedPaletteColor = null;
let selectedColorType = null;

''' + event_section + '''
'''

write_file('js/event-handlers.js', content)
print("✓ Created js/event-handlers.js")
