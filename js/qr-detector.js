/**
 * QR Code Detection and Geometry Analysis
 * Functions for detecting QR code size and structure from uploaded images
 */

/**
 * Detect QR code geometry (module count and quiet zone) from an image
 * Uses multiple detection methods including finder pattern analysis
 */
export function detectQRGeometry(img) {
    // Create temp canvas to analyze the image
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    tempCtx.drawImage(img, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
    const data = imageData.data;

    // Find edges of dark content (bounding box)
    let minX = img.width, maxX = 0, minY = img.height, maxY = 0;

    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            const idx = (y * img.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;

            // Consider pixel dark if below threshold
            if (gray < 128) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            }
        }
    }

    // Calculate quiet zone (average of all sides)
    const quietZone = Math.round((minX + minY + (img.width - 1 - maxX) + (img.height - 1 - maxY)) / 4);

    // Content dimensions
    const contentWidth = maxX - minX + 1;
    const contentHeight = maxY - minY + 1;

    console.log('Detection Debug:', {
        imageSize: `${img.width}x${img.height}`,
        contentBox: `${minX},${minY} to ${maxX},${maxY}`,
        contentSize: `${contentWidth}x${contentHeight}`,
        quietZone: quietZone
    });

    // Try multiple detection methods and use the most reliable

    // Method 1: Count transitions in the top row (finder pattern has specific pattern)
    const topY = minY;
    let transitions = 0;
    let lastDark = false;
    for (let x = minX; x <= maxX; x++) {
        const idx = (topY * img.width + x) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        const isDark = gray < 128;
        if (x > minX && isDark !== lastDark) transitions++;
        lastDark = isDark;
    }

    // Method 2: Analyze run-lengths
    const midY = Math.floor((minY + maxY) / 2);
    const runs = [];
    let currentIsDark = false;
    let runLength = 0;

    for (let x = minX; x <= maxX; x++) {
        const idx = (midY * img.width + x) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        const isDark = gray < 128;

        if (x === minX) {
            currentIsDark = isDark;
            runLength = 1;
        } else if (isDark === currentIsDark) {
            runLength++;
        } else {
            runs.push(runLength);
            currentIsDark = isDark;
            runLength = 1;
        }
    }
    runs.push(runLength);

    console.log('Runs:', runs);

    // Method 3: Use finder pattern to calibrate (most accurate)
    // The top-left finder has a 1:1:3:1:1 ratio when scanned through its middle
    // First get a rough estimate of module size from the run analysis
    const sortedRuns = [...runs].sort((a, b) => a - b);
    const sampleSize = Math.max(2, Math.floor(sortedRuns.length * 0.3));
    const smallestRuns = sortedRuns.slice(0, sampleSize);
    const roughModuleSize = smallestRuns.reduce((a, b) => a + b, 0) / smallestRuns.length;

    console.log('Rough module size estimate:', roughModuleSize.toFixed(3));

    // Scan through the approximate middle of the top-left finder pattern
    // The finder is 7×7, so scan through row 3.5 (middle)
    const finderMiddleY = Math.round(minY + roughModuleSize * 3.5);
    const finderRowRuns = [];
    let finderRowDark = false;
    let finderRowLength = 0;

    for (let x = minX; x <= maxX; x++) {
        const idx = (finderMiddleY * img.width + x) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        const isDark = gray < 128;

        if (x === minX) {
            finderRowDark = isDark;
            finderRowLength = 1;
        } else if (isDark === finderRowDark) {
            finderRowLength++;
        } else {
            finderRowRuns.push(finderRowLength);
            finderRowDark = isDark;
            finderRowLength = 1;
        }
    }
    finderRowRuns.push(finderRowLength);

    console.log('Finder middle row runs:', finderRowRuns);

    // Look for the 1:1:3:1:1 pattern in the first 5 runs
    // This should be: dark(1) - light(1) - dark(3) - light(1) - dark(1)
    let modulePixelSize = null;

    if (finderRowRuns.length >= 5 && finderRowRuns[0] > 0) {
        // First 5 runs should follow approximately 1:1:3:1:1 ratio
        const ratio1 = finderRowRuns[0];
        const ratio2 = finderRowRuns[1];
        const ratio3 = finderRowRuns[2];
        const ratio4 = finderRowRuns[3];
        const ratio5 = finderRowRuns[4];

        // Verify it looks like a finder pattern (middle should be ~3x the outer runs)
        const outerAvg = (ratio1 + ratio5) / 2;
        const middleToOuterRatio = ratio3 / outerAvg;

        console.log('Finder pattern ratios:', {
            runs: [ratio1, ratio2, ratio3, ratio4, ratio5],
            outerAvg,
            middleToOuterRatio
        });

        // If the ratio is close to 3, use this for module size
        if (middleToOuterRatio > 2.5 && middleToOuterRatio < 3.5) {
            modulePixelSize = outerAvg;  // Don't round - keep as float for accuracy
            console.log('Finder pattern calibration: module size =', modulePixelSize.toFixed(3));
        } else {
            console.log('Finder pattern ratio not close to 3:1, falling back');
        }
    }

    // Fallback to run analysis if finder pattern detection fails
    if (!modulePixelSize || modulePixelSize < 2) {
        modulePixelSize = roughModuleSize;
        console.log('Using rough module size:', modulePixelSize);
    }

    console.log('Final calculation:', {
        contentWidth,
        contentHeight,
        modulePixelSize,
        calculation: `${contentWidth} / ${modulePixelSize}`
    });

    // Calculate module count
    const moduleCount = Math.round(contentWidth / modulePixelSize);

    console.log('Raw module count:', moduleCount);

    // Snap to standard QR code sizes (Version 1-40: 21 to 177, incrementing by 4)
    const standardSizes = [];
    for (let v = 1; v <= 40; v++) {
        standardSizes.push(21 + (v - 1) * 4);
    }

    // Find candidate sizes (within ±2 of estimated count)
    const candidates = standardSizes.filter(size => Math.abs(size - moduleCount) <= 2);

    // Validate each candidate by checking if finders exist at expected positions
    const validateSize = (size) => {
        const modSize = contentWidth / size;

        const checkFinder = (finderStartX, finderStartY) => {
            // Finder pattern is 7×7 modules
            // Scan through the middle row (module 3) to check the 1:1:3:1:1 pattern
            const y = Math.floor(minY + modSize * (finderStartY + 3.5));
            const samples = [];

            for (let modX = 0; modX < 7; modX++) {
                const x = Math.floor(minX + modSize * (finderStartX + modX + 0.5));
                const idx = (y * img.width + x) * 4;
                const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                samples.push(gray < 128 ? 'D' : 'L');
            }

            // Expected pattern: Dark, Light, Dark, Dark, Dark, Light, Dark (DLDDDLD)
            const pattern = samples.join('');
            const matchesPattern = pattern === 'DLDDDLD';

            return matchesPattern ? 1 : 0;
        };

        // Check all three finders at their starting positions
        // Finders are 7×7, so: top-left (0,0), top-right (size-7, 0), bottom-left (0, size-7)
        const tlScore = checkFinder(0, 0);
        const trScore = checkFinder(size - 7, 0);
        const blScore = checkFinder(0, size - 7);

        return tlScore + trScore + blScore;
    };

    // Pick the candidate with the best validation score
    let bestSize = candidates[0] || standardSizes.reduce((prev, curr) =>
        Math.abs(curr - moduleCount) < Math.abs(prev - moduleCount) ? curr : prev
    );
    let bestScore = 0;

    for (const candidate of candidates) {
        const score = validateSize(candidate);
        console.log(`Validation: ${candidate}×${candidate} scored ${score}/3 finders`);

        // Pick this candidate if: (1) it has a better score, OR
        // (2) it has the same score but is closer to the estimated count
        const isBetterScore = score > bestScore;
        const isSameScoreButCloser = score === bestScore &&
            Math.abs(candidate - moduleCount) < Math.abs(bestSize - moduleCount);

        if (isBetterScore || isSameScoreButCloser) {
            bestScore = score;
            bestSize = candidate;
        }
    }

    // If we didn't get 3/3 finders, expand search to ±4 range
    if (bestScore < 3) {
        console.log('Low confidence, expanding search range...');
        const expandedCandidates = standardSizes.filter(size =>
            Math.abs(size - moduleCount) <= 4 && !candidates.includes(size)
        );

        for (const candidate of expandedCandidates) {
            const score = validateSize(candidate);
            console.log(`Validation: ${candidate}×${candidate} scored ${score}/3 finders`);

            const isBetterScore = score > bestScore;
            const isSameScoreButCloser = score === bestScore &&
                Math.abs(candidate - moduleCount) < Math.abs(bestSize - moduleCount);

            if (isBetterScore || isSameScoreButCloser) {
                bestScore = score;
                bestSize = candidate;
            }
        }
    }

    console.log('Selected size:', bestSize, 'with', bestScore, 'finder confirmations');

    // Calculate actual module size based on validated size for accuracy
    const actualModuleSize = contentWidth / bestSize;
    console.log('Actual module size for', bestSize, 'modules:', actualModuleSize.toFixed(3), 'pixels');

    return {
        moduleCount: bestSize,
        quietZonePixels: quietZone
    };
}

/**
 * Check if given coordinates are within a finder pattern area
 * @param {number} x - X coordinate in content space (0 to contentModules-1)
 * @param {number} y - Y coordinate in content space (0 to contentModules-1)
 * @param {number} contentModules - Total number of modules in QR code
 * @returns {boolean} True if coordinates are in a finder pattern
 */
export function isFinderPattern(x, y, contentModules) {
    // x, y are content module coordinates (0 to contentModules-1)
    // Finder pattern is 7x7, but include 1 module separator = 8x8 total
    const finderSize = 8;

    // Top-left finder (0-7, 0-7) - includes 7x7 finder + 1 module separator
    if (x < finderSize && y < finderSize) return true;
    // Top-right finder
    if (x >= contentModules - finderSize && y < finderSize) return true;
    // Bottom-left finder
    if (x < finderSize && y >= contentModules - finderSize) return true;

    return false;
}
