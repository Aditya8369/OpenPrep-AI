import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Calculator,
  BookOpen,
  Check,
} from 'lucide-react';
import GraphSandbox from '../components/math/GraphSandbox';
import FormulaBar from '../components/math/FormulaBar';

export default function GraphingSandboxPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const exportRef = useRef(null);

  // Initial equation: Damped oscillation or passed via state/URL
  const queryParams = new URLSearchParams(location.search);
  const initialFormula = queryParams.get('formula') || location.state?.formula || 'sin(x) * exp(-0.1 * x)';
  const initialDimension = queryParams.get('dimension') || location.state?.dimension || '2D';

  const [activeDimension, setActiveDimension] = useState(initialDimension);
  const [equations, setEquations] = useState([
    {
      id: 'eq-1',
      formula: initialFormula,
      color: '#6366f1',
      visible: true,
      type: 'explicit',
      dimension: initialDimension,
    },
  ]);

  const [sliders, setSliders] = useState({
    k: 2.0,
    m: 1.0,
    c: 0.0,
    a: 1.0,
    b: 0.0,
    theta: 0.0,
  });

  const [isAnimating, setIsAnimating] = useState(false);
  const [exportNotification, setExportNotification] = useState(null);

  // Auto-animation loop for parameter sliders (e.g. oscillating wave parameter k)
  useEffect(() => {
    if (!isAnimating) return;

    let animId;
    let startTime = performance.now();

    const animateLoop = (time) => {
      const elapsed = (time - startTime) / 1000;
      setSliders((prev) => ({
        ...prev,
        k: Number((Math.sin(elapsed * 2) * 4 + 5).toFixed(2)),
        m: Number((Math.cos(elapsed * 1.5) * 3 + 1).toFixed(2)),
        theta: Number((elapsed % (Math.PI * 2)).toFixed(2)),
      }));
      animId = requestAnimationFrame(animateLoop);
    };

    animId = requestAnimationFrame(animateLoop);
    return () => cancelAnimationFrame(animId);
  }, [isAnimating]);

  // Equation actions
  const handleAddEquation = () => {
    const nextColors = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
    const newId = `eq-${equations.length + 1}`;
    setEquations((prev) => [
      ...prev,
      {
        id: newId,
        formula: 'cos(x)',
        color: nextColors[prev.length % nextColors.length],
        visible: true,
        type: 'explicit',
        dimension: activeDimension,
      },
    ]);
  };

  const handleUpdateEquation = (id, updates) => {
    setEquations((prev) =>
      prev.map((eq) => (eq.id === id ? { ...eq, ...updates } : eq))
    );
  };

  const handleRemoveEquation = (id) => {
    setEquations((prev) => prev.filter((eq) => eq.id !== id));
  };

  const handleToggleVisibility = (id) => {
    setEquations((prev) =>
      prev.map((eq) => (eq.id === id ? { ...eq, visible: !eq.visible } : eq))
    );
  };

  const handleSliderChange = (param, value) => {
    setSliders((prev) => ({ ...prev, [param]: value }));
  };

  const triggerExport = (type) => {
    if (!exportRef.current) return;
    const dataUrl = type === 'PNG' ? exportRef.current.exportPNG() : exportRef.current.exportSVG();
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.download = `openprep-graph-${Date.now()}.${type.toLowerCase()}`;
    link.href = dataUrl;
    link.click();

    setExportNotification(`Exported as high-resolution ${type}`);
    setTimeout(() => setExportNotification(null), 3000);
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-stone-950/80 backdrop-blur-xl border-b border-stone-800/60 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-stone-800/60 text-stone-400 hover:text-stone-200 transition cursor-pointer"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-black font-display text-stone-100 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-400" />
              Interactive Graph & Geometry Sandbox
            </h1>
            <p className="text-[11px] text-stone-400 font-mono hidden sm:block">
              2D / 3D function plotting, KaTeX equation synchronizer & dynamic STEM parameter exploration
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/formula-scratchpad')}
            className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-stone-300 text-xs font-semibold rounded-xl border border-neutral-700/60 transition flex items-center gap-1.5 cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-violet-400" />
            Formula Cards
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6">
        {/* Left Column: Canvas / Three.js Sandbox */}
        <section className="flex-1 flex flex-col gap-4">
          <GraphSandbox
            ref={exportRef}
            equations={equations}
            activeDimension={activeDimension}
            sliders={sliders}
            isAnimating={isAnimating}
          />

          {/* Quick tips & features legend */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-neutral-900/60 border border-neutral-800/80 p-3 rounded-2xl">
              <span className="text-[10px] text-stone-500 uppercase tracking-widest font-mono">Pinch / Zoom</span>
              <p className="text-xs font-semibold text-stone-300 mt-0.5">Mouse wheel & Touch zoom</p>
            </div>
            <div className="bg-neutral-900/60 border border-neutral-800/80 p-3 rounded-2xl">
              <span className="text-[10px] text-stone-500 uppercase tracking-widest font-mono">Pan</span>
              <p className="text-xs font-semibold text-stone-300 mt-0.5">Drag to explore plane</p>
            </div>
            <div className="bg-neutral-900/60 border border-neutral-800/80 p-3 rounded-2xl">
              <span className="text-[10px] text-stone-500 uppercase tracking-widest font-mono">Tangent & Roots</span>
              <p className="text-xs font-semibold text-stone-300 mt-0.5">Hover curve for dy/dx</p>
            </div>
            <div className="bg-neutral-900/60 border border-neutral-800/80 p-3 rounded-2xl">
              <span className="text-[10px] text-stone-500 uppercase tracking-widest font-mono">3D Orbit</span>
              <p className="text-xs font-semibold text-stone-300 mt-0.5">Rotate surface in 3D</p>
            </div>
          </div>
        </section>

        {/* Right Column: Formula Bar, Sliders, & Keypad */}
        <aside className="w-full lg:w-[460px] flex flex-col gap-4">
          <FormulaBar
            equations={equations}
            onAddEquation={handleAddEquation}
            onUpdateEquation={handleUpdateEquation}
            onRemoveEquation={handleRemoveEquation}
            onToggleVisibility={handleToggleVisibility}
            sliders={sliders}
            onSliderChange={handleSliderChange}
            isAnimating={isAnimating}
            onToggleAnimation={() => setIsAnimating(!isAnimating)}
            onExportPNG={() => triggerExport('PNG')}
            onExportSVG={() => triggerExport('SVG')}
            activeDimension={activeDimension}
            onDimensionChange={setActiveDimension}
          />
        </aside>
      </main>

      {/* Floating Export Notification Toast */}
      {exportNotification && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 right-6 z-50 bg-emerald-950 border border-emerald-500/50 text-emerald-200 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold"
        >
          <Check className="w-4 h-4 text-emerald-400" />
          {exportNotification}
        </motion.div>
      )}
    </div>
  );
}
