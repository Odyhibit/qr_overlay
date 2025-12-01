/**
 * Event Handlers
 * All DOM event listeners and user interactions
 */

import { state } from './state.js';
import { extractDominantColors } from './color-extractor.js';
import { detectQRGeometry, isFinderPattern } from './qr-detector.js';
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
const logoSelect = document.getElementById('logoSelect');
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
const gradientControls = document.getElementById('gradientControls');
const paletteInstructions = document.getElementById('paletteInstructions');
const contrastWarning = document.getElementById('contrastWarning');
const advancedToggle = document.getElementById('advancedToggle');
const advancedPanel = document.getElementById('advancedPanel');
const advancedArrow = document.getElementById('advancedArrow');
// Canvas interaction state
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let logoStartX = 0;
let logoStartY = 0;

// Area delete state
let isAreaDeleting = false;
let areaDeleteStart = null;
let areaDeleteEnd = null;
let cachedCanvasImage = null;
let selectedPaletteColor = null;
let editingMode = false;
let selectedColorType = null;

// Touch interaction state
let lastTouchType = null; // 'mouse' or 'touch' - prevents double-firing
let initialPinchDistance = 0;
let initialLogoScale = 100;

// Helper function to update module size label with pixel size
function updateModuleSizeLabel() {
    const canvasSize = 600;
    const totalModules = state.qrSize + 2 * state.canvasQuietZone;
    const modulePixelSize = canvasSize / totalModules;
    const actualModuleSize = modulePixelSize * (state.moduleSize / 100);

    document.getElementById('moduleSizeLabel').textContent =
        `${state.moduleSize}% (${actualModuleSize.toFixed(1)}px)`;
}

// Helper function to update UI visibility based on mode
function updateModeVisibility() {
    const eccLevelSection = document.getElementById('eccLevelSection');
    const qrSizeSection = document.getElementById('qrSizeSection');
    const quietZoneContainer = document.getElementById('quietZoneContainer');
    const paletteControls = document.getElementById('paletteControls');
    const gradientControls = document.getElementById('gradientControls');

    // Update Generate vs Upload mode visibility
    if (state.useUploadedQR) {
        // Upload mode: hide ECC, show QR Size and Quiet Zone pixels
        eccLevelSection.classList.add('hidden');
        qrSizeSection.classList.remove('hidden');
        quietZoneContainer.classList.remove('hidden');
    } else {
        // Generate mode: show ECC, hide QR Size and Quiet Zone pixels
        eccLevelSection.classList.remove('hidden');
        qrSizeSection.classList.add('hidden');
        quietZoneContainer.classList.add('hidden');
    }

    // Update Palette vs Gradient mode visibility
    if (state.colorMode === 'gradient') {
        paletteControls.style.display = 'none';
        gradientControls.style.display = 'block';
    } else {
        paletteControls.style.display = 'block';
        gradientControls.style.display = 'none';
    }
}

// Event Listeners
generateBtn.addEventListener('click', () => {
    state.useUploadedQR = false;
    generateQRCode(() => drawCanvas(ctx), updateModeButtons);
    updateModeVisibility();
});

qrUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                if (img.width === img.height) {
                    state.uploadedQR = event.target.result;
                    state.useUploadedQR = true;
                    state.moduleColors = {};  // Clear manual color overrides

                    // Auto-detect QR geometry
                    const detected = detectQRGeometry(img);
                    state.qrSize = detected.moduleCount;
                    state.quietZonePixels = detected.quietZonePixels;

                    // Update UI
                    qrSizeSelect.value = detected.moduleCount;
                    quietZoneInput.value = detected.quietZonePixels;
                    document.getElementById('quietZonePixelsLabel').textContent = detected.quietZonePixels;
                    updateModeVisibility();

                    console.log(`Detected: ${detected.moduleCount}×${detected.moduleCount} QR code with ${detected.quietZonePixels}px quiet zone`);

                    // Auto-adjust logo scale to fit content area
                    if (state.logoImage) {
                        const totalModules = state.qrSize + 2 * state.canvasQuietZone;
                        const contentScale = Math.round((state.qrSize / totalModules) * 100);
                        state.logoScale = contentScale;
                        logoScale.value = contentScale;
                        document.getElementById('logoScaleLabel').textContent = contentScale;
                    }

                    updateModuleSizeLabel();
                    drawCanvas(ctx);
                    // Switch to delete mode when only QR is present
                    state.interactionMode = 'delete';
                    updateModeButtons();
                } else {
                    alert('QR code image must be square');
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

qrSizeSelect.addEventListener('change', (e) => {
    state.qrSize = parseInt(e.target.value);

    // Auto-adjust logo scale to fit content area when QR size changes
    if (state.logoImage) {
        const totalModules = state.qrSize + 2 * state.canvasQuietZone;
        const contentScale = Math.round((state.qrSize / totalModules) * 100);
        state.logoScale = contentScale;
        logoScale.value = contentScale;
        document.getElementById('logoScaleLabel').textContent = contentScale;
    }

    updateModuleSizeLabel();
    drawCanvas(ctx);
});

quietZoneInput.addEventListener('input', (e) => {
    state.quietZonePixels = parseInt(e.target.value);
    document.getElementById('quietZonePixelsLabel').textContent = e.target.value;
    drawCanvas(ctx);
});

canvasQuietZoneInput.addEventListener('input', (e) => {
    state.canvasQuietZone = parseInt(e.target.value);
    document.getElementById('canvasQuietZoneLabel').textContent = state.canvasQuietZone;

    // Auto-adjust logo scale to fit content area when quiet zone changes
    if (state.logoImage) {
        const totalModules = state.qrSize + 2 * state.canvasQuietZone;
        const contentScale = Math.round((state.qrSize / totalModules) * 100);
        state.logoScale = contentScale;
        logoScale.value = contentScale;
        document.getElementById('logoScaleLabel').textContent = contentScale;
    }

    updateModuleSizeLabel();
    drawCanvas(ctx);
});

logoUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            state.logoImage = event.target.result;
            setCachedLogoImg(null); // Clear cache when new logo is uploaded
            state.cachedModuleColors = {}; // Clear color cache

            // Extract dominant colors from logo
            const img = new Image();
            img.onload = () => {
                const colors = extractDominantColors(img);
                state.darkColor = colors.dark;
                state.lightColor = colors.light;
                state.darkPalette = colors.darkPalette;
                state.lightPalette = colors.lightPalette;
                console.log(`Extracted colors - Dark: ${colors.dark}, Light: ${colors.light}`);
                console.log(`Dark palette:`, colors.darkPalette);
                console.log(`Light palette:`, colors.lightPalette);

                // Update palette UI
                updatePaletteUI();

                // Calculate logo scale to fit content area only (exclude canvas quiet zone)
                const totalModules = state.qrSize + 2 * state.canvasQuietZone;
                const contentScale = Math.round((state.qrSize / totalModules) * 100);
                state.logoScale = contentScale;
                logoScale.value = contentScale;
                document.getElementById('logoScaleLabel').textContent = contentScale;
                console.log(`Logo scaled to ${contentScale}% to fit content area`);

                drawCanvas(ctx);
                // Switch to position mode when logo loads
                state.interactionMode = 'position';
                updateModeButtons();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

moduleSize.addEventListener('input', (e) => {
    state.moduleSize = parseInt(e.target.value);
    updateModuleSizeLabel();
    drawCanvas(ctx);
});

moduleShape.addEventListener('change', (e) => {
    state.moduleShape = e.target.value;
    drawCanvas(ctx);
});

finderPattern.addEventListener('change', (e) => {
    state.finderPattern = e.target.value;
    drawCanvas(ctx);
});

overlayAlpha.addEventListener('input', (e) => {
    state.overlayAlpha = parseInt(e.target.value) / 100;
    document.getElementById('overlayAlphaLabel').textContent = e.target.value;
    drawCanvas(ctx);
});

backgroundFill.addEventListener('change', (e) => {
    state.backgroundFill = e.target.value;
    drawCanvas(ctx);
});

colorMode.addEventListener('change', (e) => {
    state.colorMode = e.target.value;
    state.cachedModuleColors = {}; // Clear color cache when mode changes

    // Update visibility and deselect palette color if switching to gradient
    if (state.colorMode === 'gradient') {
        // Deselect any palette color and exit editing mode
        selectedPaletteColor = null;
        editingMode = false;
        document.querySelectorAll('.palette-color').forEach(el => el.classList.remove('selected'));
    }

    updateModeVisibility();
    updateModeButtons();
    drawCanvas(ctx);
});

darkMaxLuminosity.addEventListener('input', (e) => {
    state.darkMaxLuminosity = parseInt(e.target.value);
    state.cachedModuleColors = {}; // Clear color cache
    document.getElementById('darkLumLabel').textContent = e.target.value;
    document.getElementById('darkLumLabel2').textContent = e.target.value;
    drawCanvas(ctx);
});

lightMinLuminosity.addEventListener('input', (e) => {
    state.lightMinLuminosity = parseInt(e.target.value);
    state.cachedModuleColors = {}; // Clear color cache
    document.getElementById('lightLumLabel').textContent = e.target.value;
    document.getElementById('lightLumLabel2').textContent = e.target.value;
    drawCanvas(ctx);
});

logoScale.addEventListener('input', (e) => {
    state.logoScale = parseInt(e.target.value);
    document.getElementById('logoScaleLabel').textContent = state.logoScale;
    // Use skipOverlay to avoid recalculating module colors during drag
    drawCanvas(ctx, true);
});

// Clear cache when slider is released to recalculate with accurate colors
logoScale.addEventListener('change', (e) => {
    state.cachedModuleColors = {}; // Clear color cache when logo size finalized
    drawCanvas(ctx); // Full redraw without skipOverlay
});

// Mode button management
positionModeBtn.addEventListener('click', () => {
    state.interactionMode = 'position';
    // Deselect any palette color
    selectedPaletteColor = null;
    editingMode = false;
    document.querySelectorAll('.palette-color').forEach(el => el.classList.remove('selected'));
    updateModeButtons();
});

colorModeBtn.addEventListener('click', () => {
    if (state.colorMode === 'gradient') return; // Disabled in gradient mode
    state.interactionMode = 'color';
    updateModeButtons();
});

deleteModeBtn.addEventListener('click', () => {
    state.interactionMode = 'delete';
    // Deselect any palette color
    selectedPaletteColor = null;
    editingMode = false;
    document.querySelectorAll('.palette-color').forEach(el => el.classList.remove('selected'));
    updateModeButtons();
});

// Advanced settings toggle
advancedToggle.addEventListener('click', () => {
    const isHidden = advancedPanel.style.display === 'none';
    advancedPanel.style.display = isHidden ? 'block' : 'none';
    advancedArrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
});

// Main tab switching for Files and Customization
document.querySelectorAll('.main-tab-header').forEach(tabHeader => {
    tabHeader.addEventListener('click', () => {
        const targetTab = tabHeader.dataset.tab;

        // Remove active class from all headers and panes
        document.querySelectorAll('.main-tab-header').forEach(h => h.classList.remove('active'));
        document.querySelectorAll('.main-tab-pane').forEach(p => p.classList.remove('active'));

        // Add active class to clicked header and corresponding pane
        tabHeader.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
    });
});

// Tab switching for QR Code section (nested tabs if any)
document.querySelectorAll('.tab-header').forEach(tabHeader => {
    tabHeader.addEventListener('click', () => {
        const targetTab = tabHeader.dataset.tab;

        // Remove active class from all headers and panes
        document.querySelectorAll('.tab-header').forEach(h => h.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

        // Add active class to clicked header and corresponding pane
        tabHeader.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
    });
});

// Logo dropdown selection
logoSelect.addEventListener('change', (e) => {
    const selectedValue = e.target.value;

    if (selectedValue === '__upload__') {
        // Trigger file upload
        logoUpload.click();
        // Reset dropdown to empty after triggering upload
        setTimeout(() => {
            logoSelect.value = '';
        }, 100);
    } else if (selectedValue && selectedValue !== '') {
        // Load logo from library
        const logoPath = `logos/${selectedValue}`;

        // Create an image and load it
        fetch(logoPath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Logo not found: ${selectedValue}`);
                }
                return response.blob();
            })
            .then(blob => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    state.logoImage = event.target.result;
                    setCachedLogoImg(null); // Clear cache when new logo is loaded
                    state.cachedModuleColors = {}; // Clear color cache

                    // Extract dominant colors from logo
                    const img = new Image();
                    img.onload = () => {
                        const colors = extractDominantColors(img);
                        state.darkColor = colors.dark;
                        state.lightColor = colors.light;
                        state.darkPalette = colors.darkPalette;
                        state.lightPalette = colors.lightPalette;
                        console.log(`Loaded logo: ${selectedValue}`);
                        console.log(`Extracted colors - Dark: ${colors.dark}, Light: ${colors.light}`);

                        // Update palette UI
                        updatePaletteUI();

                        // Calculate logo scale to fit content area only (exclude canvas quiet zone)
                        const totalModules = state.qrSize + 2 * state.canvasQuietZone;
                        const contentScale = Math.round((state.qrSize / totalModules) * 100);
                        state.logoScale = contentScale;
                        logoScale.value = contentScale;
                        document.getElementById('logoScaleLabel').textContent = contentScale;
                        console.log(`Logo scaled to ${contentScale}% to fit content area`);

                        drawCanvas(ctx);
                        // Switch to position mode when logo loads
                        state.interactionMode = 'position';
                        updateModeButtons();
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(blob);
            })
            .catch(error => {
                console.error('Error loading logo:', error);
                alert(`Failed to load logo: ${selectedValue}\n\nMake sure the file exists in the /logos folder.`);
                // Reset dropdown
                logoSelect.value = '';
            });
    }
});

// Palette color change and selection handlers
document.querySelectorAll('.palette-color').forEach(input => {
    // Handle color value changes
    input.addEventListener('input', (e) => {
        const type = e.target.dataset.type;
        const index = parseInt(e.target.dataset.index);
        const newColor = e.target.value;

        if (type === 'dark') {
            state.darkPalette[index] = newColor;
            // Update main dark color if this is the first one
            if (index === 0) {
                state.darkColor = newColor;
            }
        } else {
            state.lightPalette[index] = newColor;
            // Update main light color if this is the first one
            if (index === 0) {
                state.lightColor = newColor;
            }
        }

        state.cachedModuleColors = {}; // Clear color cache
        checkContrast();
        drawCanvas(ctx);
    });

    // Handle palette color selection for module editing
    input.addEventListener('click', (e) => {
        // Disable module editing in gradient mode
        if (state.colorMode === 'gradient') {
            return;
        }

        const type = e.target.dataset.type;
        const index = parseInt(e.target.dataset.index);

        // Toggle selection
        if (selectedPaletteColor &&
            selectedPaletteColor.type === type &&
            selectedPaletteColor.index === index) {
            // Deselect
            selectedPaletteColor = null;
            editingMode = false;
            document.querySelectorAll('.palette-color').forEach(el => el.classList.remove('selected'));
            document.getElementById('paletteInstructions').textContent =
                'Click a color below to select it, then click modules on canvas to apply';
        } else {
            // Select this color
            selectedPaletteColor = { type, index };
            editingMode = true;
            state.interactionMode = 'color';  // Switch to color mode
            document.querySelectorAll('.palette-color').forEach(el => el.classList.remove('selected'));
            e.target.classList.add('selected');
            document.getElementById('paletteInstructions').textContent =
                `Selected: ${type.charAt(0).toUpperCase() + type.slice(1)} color ${index + 1} - Click modules to apply`;
        }
        updateModeButtons();
    });
});

// Canvas drag handlers
canvas.addEventListener('mousedown', (e) => {
    // Prevent double-firing on touch devices
    if (lastTouchType === 'touch') {
        lastTouchType = null;
        return;
    }
    lastTouchType = 'mouse';

    // Position mode: allow dragging logo
    if (state.interactionMode === 'position' && state.logoImage) {
        isDragging = true;
        const rect = canvas.getBoundingClientRect();
        dragStartX = e.clientX - rect.left;
        dragStartY = e.clientY - rect.top;
        // Store initial logo position
        logoStartX = state.logoX;
        logoStartY = state.logoY;
        canvas.style.cursor = 'grabbing';
        return;
    }

    // Delete mode: start area delete if shift is held, otherwise single delete
    if (state.interactionMode === 'delete') {
        const rect = canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;

        if (e.shiftKey) {
            // Start area delete - cache current canvas to avoid recalculating during drag
            isAreaDeleting = true;
            areaDeleteStart = { x: canvasX, y: canvasY };
            areaDeleteEnd = { x: canvasX, y: canvasY };

            // Cache the current canvas state
            cachedCanvasImage = ctx.getImageData(0, 0, canvas.width, canvas.height);

            canvas.style.cursor = 'crosshair';
        } else {
            // Single module delete
            handleModuleClick(canvasX, canvasY);
        }
        return;
    }

    // Color mode: handle module click
    if (state.interactionMode === 'color') {
        const rect = canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        handleModuleClick(canvasX, canvasY);
        return;
    }
});

canvas.addEventListener('mousemove', (e) => {
    // Prevent double-firing on touch devices
    if (lastTouchType === 'touch') return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Handle area delete dragging
    if (isAreaDeleting) {
        areaDeleteEnd = { x: mouseX, y: mouseY };

        // Restore cached canvas image (no recalculation)
        if (cachedCanvasImage) {
            ctx.putImageData(cachedCanvasImage, 0, 0);
        }

        // Draw selection box on top
        drawAreaDeleteBox(ctx);
        return;
    }

    if (!isDragging) return;

    // Calculate delta from initial click position
    const deltaX = mouseX - dragStartX;
    const deltaY = mouseY - dragStartY;

    // Apply delta to initial logo position (as percentage)
    const deltaXPercent = (deltaX / canvas.width) * 100;
    const deltaYPercent = (deltaY / canvas.height) * 100;

    state.logoX = Math.max(0, Math.min(100, logoStartX + deltaXPercent));
    state.logoY = Math.max(0, Math.min(100, logoStartY + deltaYPercent));

    // Skip overlay drawing while dragging for better performance
    drawCanvas(ctx, true);
});

canvas.addEventListener('mouseup', () => {
    // Prevent double-firing on touch devices
    if (lastTouchType === 'touch') return;

    // Handle area delete completion
    if (isAreaDeleting) {
        performAreaDelete();
        isAreaDeleting = false;
        areaDeleteStart = null;
        areaDeleteEnd = null;
        cachedCanvasImage = null;
        updateModeButtons(); // Reset cursor
        drawCanvas(ctx);
        return;
    }

    if (isDragging) {
        isDragging = false;
        state.cachedModuleColors = {}; // Clear cache so colors recalculate with new position
        updateModeButtons(); // Reset cursor based on current mode
        // Redraw with full overlay after drag ends
        drawCanvas(ctx);
    }
});

canvas.addEventListener('mouseleave', () => {
    // Prevent double-firing on touch devices
    if (lastTouchType === 'touch') return;

    // Cancel area delete if mouse leaves canvas
    if (isAreaDeleting) {
        isAreaDeleting = false;
        areaDeleteStart = null;
        areaDeleteEnd = null;
        cachedCanvasImage = null;
        updateModeButtons();
        drawCanvas(ctx);
        return;
    }

    if (isDragging) {
        isDragging = false;
        state.cachedModuleColors = {}; // Clear cache so colors recalculate with new position
        updateModeButtons(); // Reset cursor based on current mode
        // Redraw with full overlay after drag ends
        drawCanvas(ctx);
    }
});

// Touch event handlers
// Helper function to get distance between two touches (for pinch-to-zoom)
function getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// Helper function to handle module click/tap (shared by mouse and touch)
/**
 * Draw the area delete selection box
 */
function drawAreaDeleteBox(ctx) {
    if (!areaDeleteStart || !areaDeleteEnd) return;

    ctx.save();

    const x1 = Math.min(areaDeleteStart.x, areaDeleteEnd.x);
    const y1 = Math.min(areaDeleteStart.y, areaDeleteEnd.y);
    const x2 = Math.max(areaDeleteStart.x, areaDeleteEnd.x);
    const y2 = Math.max(areaDeleteStart.y, areaDeleteEnd.y);
    const width = x2 - x1;
    const height = y2 - y1;

    // Draw semi-transparent fill
    ctx.fillStyle = 'rgba(220, 38, 38, 0.1)'; // Light red
    ctx.fillRect(x1, y1, width, height);

    // Draw border
    ctx.strokeStyle = '#dc2626'; // Red
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]); // Dashed line
    ctx.strokeRect(x1, y1, width, height);

    ctx.restore();
}

/**
 * Perform area delete on all modules in the selection box
 */
function performAreaDelete() {
    if (!areaDeleteStart || !areaDeleteEnd) return;

    const x1 = Math.min(areaDeleteStart.x, areaDeleteEnd.x);
    const y1 = Math.min(areaDeleteStart.y, areaDeleteEnd.y);
    const x2 = Math.max(areaDeleteStart.x, areaDeleteEnd.x);
    const y2 = Math.max(areaDeleteStart.y, areaDeleteEnd.y);

    // Get QR geometry
    const totalModules = state.qrSize + 2 * state.canvasQuietZone;
    const modulePixelSize = canvas.width / totalModules;
    const canvasQuietZone = state.canvasQuietZone;
    const contentModules = state.qrSize;

    let deletedCount = 0;

    // Iterate through all modules and check if they're in the box
    for (let y = 0; y < totalModules; y++) {
        for (let x = 0; x < totalModules; x++) {
            // Calculate module's position on canvas
            const moduleCanvasX = x * modulePixelSize + modulePixelSize / 2;
            const moduleCanvasY = y * modulePixelSize + modulePixelSize / 2;

            // Check if module center is within selection box
            if (moduleCanvasX >= x1 && moduleCanvasX <= x2 &&
                moduleCanvasY >= y1 && moduleCanvasY <= y2) {

                // Check if in quiet zone
                const inQuietZone = x < canvasQuietZone || x >= totalModules - canvasQuietZone ||
                                   y < canvasQuietZone || y >= totalModules - canvasQuietZone;

                if (!inQuietZone) {
                    // Convert to content coordinates
                    const contentX = x - canvasQuietZone;
                    const contentY = y - canvasQuietZone;

                    // Check if it's a finder pattern (can't delete functional patterns)
                    const isFinder = isFinderPattern(contentX, contentY, contentModules);

                    if (!isFinder) {
                        const key = `${contentX},${contentY}`;
                        // Mark module as hidden (same as single delete)
                        state.moduleColors[key] = {
                            type: 'hidden'
                        };
                        deletedCount++;
                    }
                }
            }
        }
    }

    console.log(`Area delete: hidden ${deletedCount} modules`);
}

function handleModuleClick(canvasX, canvasY) {
    const canvasSize = 600;
    const contentModules = state.qrSize;
    const canvasQuietZone = state.canvasQuietZone;
    const totalModules = contentModules + 2 * canvasQuietZone;
    const modulePixelSize = canvasSize / totalModules;

    const moduleX = Math.floor(canvasX / modulePixelSize);
    const moduleY = Math.floor(canvasY / modulePixelSize);

    // Check if click is within content area (not quiet zone)
    const inQuietZone = moduleX < canvasQuietZone || moduleX >= contentModules + canvasQuietZone ||
                        moduleY < canvasQuietZone || moduleY >= contentModules + canvasQuietZone;

    if (!inQuietZone) {
        // Convert to content coordinates
        const contentX = moduleX - canvasQuietZone;
        const contentY = moduleY - canvasQuietZone;

        // Check if it's a finder pattern (can't edit finder patterns)
        const isFinder = isFinderPattern(contentX, contentY, contentModules);

        if (!isFinder) {
            const key = `${contentX},${contentY}`;

            if (state.interactionMode === 'color' && editingMode && selectedPaletteColor) {
                // Color mode: apply selected color
                state.moduleColors[key] = {
                    type: selectedPaletteColor.type,
                    index: selectedPaletteColor.index
                };
                console.log(`Module (${contentX},${contentY}) set to ${selectedPaletteColor.type}[${selectedPaletteColor.index}]`);
                drawCanvas(ctx);
            } else if (state.interactionMode === 'delete') {
                // Delete mode: hide module
                state.moduleColors[key] = {
                    type: 'hidden'
                };
                console.log(`Module (${contentX},${contentY}) hidden`);
                drawCanvas(ctx);
            }
        }
    }
}

canvas.addEventListener('touchstart', (e) => {
    lastTouchType = 'touch';

    // Prevent default to avoid scrolling and double-firing with mouse events
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();

    if (e.touches.length === 2) {
        // Two-finger pinch for scaling
        initialPinchDistance = getTouchDistance(e.touches[0], e.touches[1]);
        initialLogoScale = state.logoScale;
    } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        const canvasX = touch.clientX - rect.left;
        const canvasY = touch.clientY - rect.top;

        // Position mode: allow dragging logo
        if (state.interactionMode === 'position' && state.logoImage) {
            isDragging = true;
            dragStartX = canvasX;
            dragStartY = canvasY;
            logoStartX = state.logoX;
            logoStartY = state.logoY;
            return;
        }

        // Color mode or Delete mode: handle module tap
        if (state.interactionMode === 'color' || state.interactionMode === 'delete') {
            handleModuleClick(canvasX, canvasY);
        }
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    lastTouchType = 'touch';
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();

    if (e.touches.length === 2 && initialPinchDistance > 0) {
        // Two-finger pinch: scale logo
        const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
        const scaleFactor = currentDistance / initialPinchDistance;

        // Apply scale factor to initial scale
        let newScale = Math.round(initialLogoScale * scaleFactor);

        // Clamp to reasonable range (10-200%)
        newScale = Math.max(10, Math.min(200, newScale));

        state.logoScale = newScale;
        logoScale.value = newScale;
        document.getElementById('logoScaleLabel').textContent = newScale;

        drawCanvas(ctx, true); // Skip overlay during pinch for performance
    } else if (e.touches.length === 1 && isDragging) {
        // Single finger drag
        const touch = e.touches[0];
        const mouseX = touch.clientX - rect.left;
        const mouseY = touch.clientY - rect.top;

        // Calculate delta from initial touch position
        const deltaX = mouseX - dragStartX;
        const deltaY = mouseY - dragStartY;

        // Apply delta to initial logo position (as percentage)
        const deltaXPercent = (deltaX / canvas.width) * 100;
        const deltaYPercent = (deltaY / canvas.height) * 100;

        state.logoX = Math.max(0, Math.min(100, logoStartX + deltaXPercent));
        state.logoY = Math.max(0, Math.min(100, logoStartY + deltaYPercent));

        // Skip overlay drawing while dragging for better performance
        drawCanvas(ctx, true);
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    lastTouchType = 'touch';
    e.preventDefault();

    if (e.touches.length === 0) {
        // All fingers lifted
        if (isDragging || initialPinchDistance > 0) {
            isDragging = false;
            initialPinchDistance = 0;
            state.cachedModuleColors = {}; // Clear cache so colors recalculate
            updateModeButtons();
            drawCanvas(ctx); // Full redraw
        }
    } else if (e.touches.length === 1) {
        // One finger still down (was pinching, now single touch)
        initialPinchDistance = 0;

        // Check if we should start dragging with remaining finger
        const rect = canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const canvasX = touch.clientX - rect.left;
        const canvasY = touch.clientY - rect.top;

        if (state.interactionMode === 'position' && state.logoImage) {
            isDragging = true;
            dragStartX = canvasX;
            dragStartY = canvasY;
            logoStartX = state.logoX;
            logoStartY = state.logoY;
        }
    }
}, { passive: false });

canvas.addEventListener('touchcancel', (e) => {
    lastTouchType = 'touch';
    e.preventDefault();

    if (isDragging || initialPinchDistance > 0) {
        isDragging = false;
        initialPinchDistance = 0;
        state.cachedModuleColors = {}; // Clear cache
        updateModeButtons();
        drawCanvas(ctx); // Full redraw
    }
}, { passive: false });

qrText.addEventListener('input', (e) => {
    state.qrText = e.target.value;
});

eccLevel.addEventListener('change', (e) => {
    state.eccLevel = e.target.value;
});

exportBtn.addEventListener('click', () => {
    // Get filename from input and sanitize
    let filename = document.getElementById('exportFilename').value.trim();

    // Remove any .png extension if user added it
    filename = filename.replace(/\.png$/i, '');

    // Sanitize filename - remove invalid characters
    filename = filename.replace(/[^a-z0-9_-]/gi, '_');

    // Use default if empty
    if (!filename) {
        filename = 'custom-qr-code';
    }

    // Add .png extension
    const fullFilename = filename + '.png';

    try {
        canvas.toBlob((blob) => {
            if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = fullFilename;
                link.href = url;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
        }, 'image/png');
    } catch (error) {
        console.error('Export error:', error);
        const link = document.createElement('a');
        link.download = fullFilename;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});

// Initial setup
updatePaletteUI();
updateModeButtons();
updateModuleSizeLabel();
updateModeVisibility();

// ======================
// Mobile Menu Toggle
// ======================
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

if (mobileMenuToggle && sidebar && sidebarOverlay) {
    // Toggle sidebar on button click
    mobileMenuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
        sidebarOverlay.classList.toggle('active');
    });

    // Close sidebar when overlay is clicked
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('mobile-open');
        sidebarOverlay.classList.remove('active');
    });

    // Close sidebar when clicking inside it (after making a selection)
    sidebar.addEventListener('click', (e) => {
        // Only close if we're in mobile view (check if overlay is active)
        if (sidebarOverlay.classList.contains('active')) {
            // Don't close if clicking on inputs, sliders, or interactive elements
            if (!e.target.matches('input, select, button, label, .palette-color')) {
                sidebar.classList.remove('mobile-open');
                sidebarOverlay.classList.remove('active');
            }
        }
    });
}

// Initialize canvas on page load
console.log('Event handlers loaded');
console.log('Canvas:', canvas);
console.log('Context:', ctx);

// Try to draw initial canvas
if (ctx) {
    try {
        drawCanvas(ctx);
        console.log('Initial drawCanvas completed');
    } catch (error) {
        console.error('Error in initial drawCanvas:', error);
    }
}
