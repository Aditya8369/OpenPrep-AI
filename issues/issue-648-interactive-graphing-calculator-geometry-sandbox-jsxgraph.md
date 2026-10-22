---
title: '[FEATURE]: Interactive 2D/3D Graphing Calculator & Geometry Construction Sandbox (KaTeX + JSXGraph)'
labels: 'enhancement, frontend, ui/ux, high-priority, NSoC, NSoC-L2'
assignees: ''
---

## Summary & Motivation
Students preparing for STEM exams (JEE, NEET, AP Calculus, SAT Math, Physics, and Chemistry) frequently struggle with static diagrams in solutions and notes. Understanding how mathematical functions change, how tangents move along curves, or how vectors interact in 2D/3D space requires dynamic visual experimentation.

This feature integrates an **Interactive Graphing & Geometric Sandbox** inside the OpenPrep AI study viewer, allowing students to plot functions, interact with geometric primitives, adjust parameter sliders ($k$, $m$, $\theta$), and test intuition directly alongside AI-generated problem derivations.

---

## Technical Scope & Architecture

### 1. Interactive Canvas Integration (`frontend/src/components/math/GraphSandbox.jsx`)
- Integrates `JSXGraph` / `FunctionPlot` and `Three.js` (for 3D vectors/surfaces) into a lightweight, responsive React component.
- Supports:
  - Explicit functions: $f(x) = \sin(x) \cdot e^{-0.1x}$
  - Implicit functions and conic sections (parabolas, ellipses, hyperbolas)
  - Parametric equations: $x(t) = r \cos(t), y(t) = r \sin(t)$
  - Geometric constructions: points, lines, circles, angle bisectors, perpendiculars
- Parameter Sliders: Dynamic reactive variables with real-time curve deformation (e.g. varying slope $m$ in $y = mx + c$).

### 2. Math Formula Input & KaTeX Synchronizer (`frontend/src/components/math/FormulaBar.jsx`)
- Formula input with auto-formatting into KaTeX syntax.
- Quick insertion buttons for common mathematical operators, calculus limits, derivatives ($\frac{d}{dx}$), and integrals ($\int$).
- Export capability: One-click export of plotted diagrams as SVG or PNG images to attach directly to custom study notes or flashcards.

### 3. AI Derivation Embed Hook (`frontend/src/hooks/useAutoGraphDetection.js`)
- Regex and AST parser that scans AI problem solutions for graphable functions or equations and automatically renders an interactive "Plot Graph" preview button next to the equation.

### Affected Areas
- [x] Frontend
- [x] UI/UX

### Open Source Programs
- [x] NSoC

### Difficulty Level (NSoC)
- [x] Level 2 (Medium) (NSoC-L2)

---

## Acceptance Criteria
- [ ] Users can enter mathematical formulas and view responsive 2D/3D plots.
- [ ] Sliders allow dynamic manipulation of variables with smooth 60fps rendering.
- [ ] Pinch-to-zoom and drag-to-pan work smoothly across mobile and desktop devices.
- [ ] Plots can be exported as SVG/PNG and saved into user's note attachments.
- [ ] Formula input supports keyboard shortcuts and mobile math touchpads.
- [ ] Unit tests for math expression parsing and equation validity checks.
