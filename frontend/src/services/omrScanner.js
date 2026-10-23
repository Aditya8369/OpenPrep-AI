/**
 * @fileoverview Client-Side Computer Vision OMR Scanner Pipeline
 * Implements fiducial corner detection, perspective rectification,
 * bubble grid extraction, and darkness thresholding for instant in-browser grading.
 */

/**
 * Normalizes coordinates and finds 4 corner fiducial marks on an HTML5 Canvas / ImageData
 */
export function detectFiducials(imageData, threshold = 60) {
  const { width, height, data } = imageData;
  const corners = {
    topLeft: null,
    topRight: null,
    bottomLeft: null,
    bottomRight: null,
  };

  const quadW = Math.floor(width * 0.25);
  const quadH = Math.floor(height * 0.25);

  const getBrightness = (x, y) => {
    const idx = (y * width + x) * 4;
    return (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
  };

  // Search quadrant for dark fiducial marker center
  const findQuadrantCenter = (minX, maxX, minY, maxY) => {
    let darkestX = minX;
    let darkestY = minY;
    let minBrightness = 255;
    let count = 0;
    let sumX = 0;
    let sumY = 0;

    for (let y = minY; y < maxY; y += 4) {
      for (let x = minX; x < maxX; x += 4) {
        const b = getBrightness(x, y);
        if (b < threshold) {
          sumX += x;
          sumY += y;
          count++;
        }
        if (b < minBrightness) {
          minBrightness = b;
          darkestX = x;
          darkestY = y;
        }
      }
    }

    if (count > 10) {
      return { x: Math.round(sumX / count), y: Math.round(sumY / count), confidence: 0.98 };
    }
    return { x: darkestX, y: darkestY, confidence: 0.85 };
  };

  corners.topLeft = findQuadrantCenter(0, quadW, 0, quadH);
  corners.topRight = findQuadrantCenter(width - quadW, width, 0, quadH);
  corners.bottomLeft = findQuadrantCenter(0, quadW, height - quadH, height);
  corners.bottomRight = findQuadrantCenter(width - quadW, width, height - quadH, height);

  const confidence = (corners.topLeft.confidence + corners.topRight.confidence +
                      corners.bottomLeft.confidence + corners.bottomRight.confidence) / 4;

  return { corners, confidence };
}

/**
 * Computes perspective-rectified pixel value at fractional coordinates (u, v in [0, 1])
 */
export function bilinearSample(imageData, corners, u, v) {
  const { topLeft: tl, topRight: tr, bottomLeft: bl, bottomRight: br } = corners;

  // Bilinear interpolation across 4 fiducials
  const topX = tl.x + u * (tr.x - tl.x);
  const topY = tl.y + u * (tr.y - tl.y);
  const botX = bl.x + u * (br.x - bl.x);
  const botY = bl.y + u * (br.y - bl.y);

  const sampleX = Math.round(topX + v * (botX - topX));
  const sampleY = Math.round(topY + v * (botY - topY));

  const clampedX = Math.max(0, Math.min(imageData.width - 1, sampleX));
  const clampedY = Math.max(0, Math.min(imageData.height - 1, sampleY));

  const idx = (clampedY * imageData.width + clampedX) * 4;
  const d = imageData.data;
  return (d[idx] * 0.299 + d[idx + 1] * 0.587 + d[idx + 2] * 0.114);
}

/**
 * Evaluates darkness threshold for a circular bubble region
 */
export function evaluateBubbleDarkness(imageData, corners, normCenterX, normCenterY, normRadius = 0.008) {
  let sampleCount = 0;
  let darkPixelCount = 0;
  const steps = 5;

  for (let dx = -steps; dx <= steps; dx++) {
    for (let dy = -steps; dy <= steps; dy++) {
      if (dx * dx + dy * dy <= steps * steps) {
        const u = normCenterX + (dx / steps) * normRadius;
        const v = normCenterY + (dy / steps) * normRadius;
        const brightness = bilinearSample(imageData, corners, u, v);
        sampleCount++;
        // Threshold: darker than 110 is considered marked
        if (brightness < 110) {
          darkPixelCount++;
        }
      }
    }
  }

  const fillDensity = sampleCount > 0 ? (darkPixelCount / sampleCount) : 0;
  return fillDensity;
}

/**
 * High-level scanner: Segments bubble grid and returns detected choices with ambiguity flags
 */
export function scanOmrSheet(imageData, questionCount = 50, customCorners = null) {
  const { corners, confidence } = customCorners
    ? { corners: customCorners, confidence: 0.99 }
    : detectFiducials(imageData);

  const cols = questionCount > 100 ? 4 : questionCount > 50 ? 3 : 2;
  const questionsPerCol = Math.ceil(questionCount / cols);
  const options = ['A', 'B', 'C', 'D'];

  const results = {};
  const flagged = [];

  for (let q = 1; q <= questionCount; q++) {
    const colIdx = Math.floor((q - 1) / questionsPerCol);
    const rowIdx = (q - 1) % questionsPerCol;

    // Normalized positions across canonical grid (0.0 to 1.0)
    const normColBaseX = 0.12 + colIdx * (0.80 / cols);
    const normRowBaseY = 0.26 + rowIdx * (0.68 / questionsPerCol);

    const optionScores = options.map((opt, optIdx) => {
      const normX = normColBaseX + 0.05 + optIdx * 0.035;
      const fill = evaluateBubbleDarkness(imageData, corners, normX, normRowBaseY);
      return { option: opt, fill };
    });

    // Mark threshold is 0.45 (45% darkness in bubble ROI)
    const marked = optionScores.filter((o) => o.fill >= 0.45);

    if (marked.length === 1) {
      results[q] = marked[0].option;
    } else if (marked.length > 1) {
      results[q] = 'MULTIPLE';
      flagged.push({
        questionNumber: q,
        reason: 'Multiple options filled (invalid answer)',
        options: marked.map((m) => m.option),
      });
    } else {
      // Check if there is an ambiguous borderline mark (between 0.30 and 0.45)
      const borderline = optionScores.filter((o) => o.fill >= 0.30 && o.fill < 0.45);
      if (borderline.length > 0) {
        results[q] = borderline[0].option;
        flagged.push({
          questionNumber: q,
          reason: 'Ambiguous or faint shading detected',
          options: borderline.map((m) => m.option),
        });
      } else {
        results[q] = null; // Unattempted / Blank
      }
    }
  }

  return {
    confidence,
    answers: results,
    flagged,
    totalQuestions: questionCount,
    attemptedCount: Object.values(results).filter((v) => v !== null && v !== 'MULTIPLE').length,
  };
}
