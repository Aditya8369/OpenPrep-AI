---
title: '[FEATURE]: Interactive Syllabus Mastery Sunburst Chart & PYQ Chapter Weightage Explorer'
labels: 'enhancement, pyq-analysis, dashboard, frontend, medium-priority, NSoC, NSoC-L2'
assignees: ''
---

## Summary & Motivation
Preparing for competitive entrance examinations (e.g., JEE, NEET, GATE, UPSC) requires students to balance syllabus breadth against historical chapter mark distribution. Traditional linear chapter checklists fail to show hierarchical mastery (Subject -> Chapter -> Subtopic) correlated with past exam weightage.

This feature implements an **Interactive Sunburst & Radial Mastery Chart** that lets students drill down through their syllabus hierarchy while visually identifying high-yield, low-mastery knowledge gaps.

---

## Technical Scope & Architecture

### Frontend Implementation
1. **Hierarchical Sunburst Visualizer (`frontend/src/components/analytics/SyllabusSunburstChart.jsx`)**:
   - Built using Recharts or D3 hierarchy partition layout.
   - Inner ring: Subjects (Physics, Chemistry, Math).
   - Middle ring: Chapters (e.g. Thermodynamics, Electromagnetism).
   - Outer ring: Sub-topics (e.g. Carnot Engine, Entropy).
   - Color coding: Gradient from red (0% mastery) to emerald green (100% mastery).
   - Size of arc: Proportional to historical PYQ marks weightage (high-yield topics occupy larger angular slices).
2. **Interactive Topic Detail Drawer (`frontend/src/components/analytics/TopicMasteryDrawer.jsx`)**:
   - Clicking any slice zooms into that sub-tree and opens a slide-over panel displaying:
     - Total questions practiced vs accuracy rate.
     - Recommended flashcards and quiz questions for this node.
     - Historical exam appearance frequency (e.g. "Appeared in 8 of last 10 years").

### Affected Areas
- [x] Frontend
- [x] PYQ Analysis
- [x] Dashboard

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 2 (Medium / Intermediate) (NSoC-L2)

---

## Acceptance Criteria
- [ ] Renders multi-tiered radial sunburst chart with responsive resize support.
- [ ] Arc sizes correspond to historical weightage and colors represent mastery percentage.
- [ ] Clicking on a sector smoothly focuses on the sector and opens topic review details.
- [ ] Handles missing or partial study data gracefully with default fallbacks.
- [ ] Component unit tests verifying SVG rendering and click event callbacks.

