---
title: '[FEATURE]: Automated OMR Bubble Sheet Scanner with Phone Camera & Instant AI Grading'
labels: 'enhancement, frontend, ai, mobile, high-priority, NSoC, NSoC-L3'
assignees: ''
---

## Summary & Motivation
Many major competitive examinations (such as NEET, UPSC, SAT, and CBSE Board Term exams) still require students to fill physical pen-and-paper OMR (Optical Mark Recognition) bubble answer sheets. Practicing mock exams on screen does not simulate the time pressure and motor discipline of bubbling physical sheets.

This feature enables students to print standardized OpenPrep AI OMR sheets, fill them out with pen/pencil, and scan them with their laptop webcam or phone camera. The client-side computer vision engine automatically aligns the sheet, thresholds the marked bubbles, grades the answers, and syncs the score to their analytics profile in seconds.

---

## Technical Scope & Architecture

### 1. Printable OMR Generator (`backend/services/omrTemplateService.js`)
- Generates downloadable PDF OMR sheets customized for 20, 50, 100, or 180 questions using PDFKit.
- Includes 4 corner fiducial marker targets (black bounding squares) and an embedded QR code containing the Quiz ID and Answer Key hash.

### 2. Client-Side Computer Vision Pipeline (`frontend/src/services/omrScanner.js`)
- Uses WebAssembly OpenCV (`opencv.js`) directly in the browser to maintain zero-latency local processing:
  1. *Fiducial Corner Detection*: Finds the 4 corner squares via contour detection and computes homography matrix.
  2. *Perspective Warp Correction*: Rectifies skewed or tilted photos into a flat orthogonal grid.
  3. *Bubble Grid Extraction*: Slices the grid into individual bubble coordinate cells.
  4. *Darkness Thresholding*: Computes non-zero pixel density in options (A, B, C, D) to identify marked answers or invalid double-bubbles.

### 3. Grading & Sync Endpoint (`backend/routes/quizRoutes.js`)
- `POST /api/quiz/:id/submit-omr`: Accepts detected bubble choices and QR metadata, checks against server answer key, logs question-level timing and accuracy, and triggers weakness detection hooks.

### 4. Scanner Camera Component (`frontend/src/components/omr/OmrCameraScanner.jsx`)
- Live camera viewfinder with a guided alignment overlay rectangle.
- Automatic capture trigger once all 4 corner fiducials are recognized with >95% confidence.

### Affected Areas
- [x] Frontend
- [x] AI/Computer Vision
- [x] Backend
- [x] Mobile

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 3 (Hard / Advanced) (NSoC-L3)

---

## Acceptance Criteria
- [ ] Users can generate and print standardized OMR test sheets with embedded QR codes.
- [ ] Web/phone camera successfully captures and auto-corrects skewed angles using perspective transform.
- [ ] Marked pencil and pen bubbles are detected with >98% accuracy under varied lighting conditions.
- [ ] Ambiguous or multiple fills are flagged with visual review before final submission.
- [ ] Quiz scores, analytics, and topic mastery update automatically upon OMR scan submission.
- [ ] Comprehensive unit tests for bubble grid segmentation and threshold evaluation algorithms.
