import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Sliders,
  Sparkles,
  Eye,
  EyeOff,
  Download,
  Copy,
  Check,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formulaToKatex } from '../../utils/mathParser';
import MathRenderer from '../common/MathRenderer';

// Preset mathematical formulas for instant student experimentation
export const PRESETS = [
  {
    category: 'Calculus & Waves',
    items: [
      {
        label: 'Damped Oscillation',
        formula: 'sin(x) * exp(-0.1 * x)',
        dimension: '2D',
        type: 'explicit',
        color: '#6366f1',
        description: 'Exponentially decaying sinusoidal wave (JEE/AP Physics)',
      },
      {
        label: 'Wave Interference (Beats)',
        formula: 'sin(k * x) + sin(m * x)',
        dimension: '2D',
        type: 'explicit',
        color: '#8b5cf6',
        params: { k: 5, m: 6 },
        description: 'Superposition of two close frequencies yielding beat envelope',
      },
      {
        label: 'Taylor Approximation (sin x)',
        formula: 'x - (x^3)/6 + (x^5)/120',
        dimension: '2D',
        type: 'explicit',
        color: '#ec4899',
        description: '5th-order Maclaurin series polynomial',
      },
    ],
  },
  {
    category: 'Conics & Geometry',
    items: [
      {
        label: 'Dynamic Parabola',
        formula: 'a * x^2 + b * x + c',
        dimension: '2D',
        type: 'explicit',
        color: '#3b82f6',
        params: { a: 0.5, b: 0, c: -2 },
        description: 'Quadratic function with adjustable vertex & curvature',
      },
      {
        label: 'Conic Hyperbola',
        formula: 'sqrt(x^2 - 4)',
        dimension: '2D',
        type: 'explicit',
        color: '#10b981',
        description: 'Upper branch of standard hyperbola x^2 - y^2 = 4',
      },
      {
        label: 'Parametric Lissajous',
        formula: 'x(t) = sin(3*t), y(t) = sin(2*t)',
        dimension: '2D',
        type: 'parametric',
        xFormula: 'sin(3*t)',
        yFormula: 'sin(2*t)',
        tMin: 0,
        tMax: 6.283,
        color: '#f59e0b',
        description: 'Harmonic motion in perpendicular directions',
      },
    ],
  },
  {
    category: '3D Surfaces & Vectors',
    items: [
      {
        label: '3D Hyperbolic Paraboloid (Saddle)',
        formula: 'x^2 - y^2',
        dimension: '3D',
        type: 'surface3D',
        color: '#06b6d4',
        description: 'Classic saddle surface z = x^2 - y^2 in 3D space',
      },
      {
        label: '3D Ripple Waves',
        formula: 'sin(sqrt(x^2 + y^2) * k)',
        dimension: '3D',
        type: 'surface3D',
        color: '#38bdf8',
        params: { k: 2 },
        description: 'Circular radial ripples in water tank',
      },
      {
        label: '3D Force Vector',
        formula: 'v = [2, 3, 2]',
        dimension: '3D',
        type: 'vector3D',
        vector: [2, 3, 2],
        color: '#e11d48',
        description: 'Spatial vector representation with magnitude & direction',
      },
    ],
  },
];

// Quick insertion buttons
const QUICK_OPERATORS = [
  { label: '+', insert: ' + ' },
  { label: '-', insert: ' - ' },
  { label: '×', insert: ' * ' },
  { label: '÷', insert: ' / ' },
  { label: 'x²', insert: '^2' },
  { label: 'xⁿ', insert: '^' },
  { label: '√x', insert: 'sqrt(' },
  { label: 'sin', insert: 'sin(' },
  { label: 'cos', insert: 'cos(' },
  { label: 'tan', insert: 'tan(' },
  { label: 'ln', insert: 'ln(' },
  { label: 'eˣ', insert: 'exp(' },
  { label: 'π', insert: 'pi' },
  { label: 'θ', insert: 'theta' },
  { label: 'd/dx', insert: 'd/dx ' },
  { label: '∫', insert: 'int ' },
];

export default function FormulaBar({
  equations = [],
  onAddEquation,
  onUpdateEquation,
  onRemoveEquation,
  onToggleVisibility,
  sliders = {},
  onSliderChange,
  isAnimating = false,
  onToggleAnimation,
  onExportPNG,
  onExportSVG,
  activeDimension = '2D',
  onDimensionChange,
}) {
  const [activeTab, setActiveTab] = useState('functions'); // 'functions' | 'presets' | 'sliders'
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [showKeypad, setShowKeypad] = useState(false);

  const handleCopyLatex = (formula, idx) => {
    const latex = `$${formulaToKatex(formula)}$`;
    navigator.clipboard?.writeText(latex);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleQuickInsert = (text, eqIndex) => {
    const targetEq = equations[eqIndex];
    if (!targetEq) return;
    const newFormula = (targetEq.formula || '') + text;
    onUpdateEquation(targetEq.id, { formula: newFormula });
  };

  return (
    <div className="bg-neutral-900/90 backdrop-blur-xl border border-neutral-800 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 text-stone-100">
      {/* Top Header & Dimension Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="flex bg-neutral-950 p-1 rounded-2xl border border-neutral-800">
            <button
              onClick={() => onDimensionChange('2D')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeDimension === '2D'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              2D Sandbox
            </button>
            <button
              onClick={() => onDimensionChange('3D')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeDimension === '3D'
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              3D Space (Three.js)
            </button>
          </div>

          <div className="flex bg-neutral-950 p-1 rounded-2xl border border-neutral-800">
            <button
              onClick={() => setActiveTab('functions')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'functions' ? 'bg-neutral-800 text-stone-100' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Formulas ({equations.length})
            </button>
            <button
              onClick={() => setActiveTab('sliders')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer ${
                activeTab === 'sliders' ? 'bg-neutral-800 text-stone-100' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              Sliders
            </button>
            <button
              onClick={() => setActiveTab('presets')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer ${
                activeTab === 'presets' ? 'bg-neutral-800 text-stone-100' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              STEM Library
            </button>
          </div>
        </div>

        {/* Export and Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowKeypad(!showKeypad)}
            className="px-2.5 py-1.5 bg-neutral-800/80 hover:bg-neutral-700 text-stone-300 text-xs font-semibold rounded-xl border border-neutral-700/60 transition flex items-center gap-1 cursor-pointer"
            title="Toggle Math Touchpad"
          >
            Keypad {showKeypad ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onExportPNG}
            className="px-2.5 py-1.5 bg-neutral-800/80 hover:bg-neutral-700 text-stone-300 text-xs font-semibold rounded-xl border border-neutral-700/60 transition flex items-center gap-1 cursor-pointer"
            title="Export High-Resolution PNG"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            PNG
          </button>
          <button
            onClick={onExportSVG}
            className="px-2.5 py-1.5 bg-neutral-800/80 hover:bg-neutral-700 text-stone-300 text-xs font-semibold rounded-xl border border-neutral-700/60 transition flex items-center gap-1 cursor-pointer"
            title="Export Vector SVG"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            SVG
          </button>
        </div>
      </div>

      {/* Quick Insert Keypad Bar (collapsible) */}
      {showKeypad && (
        <div className="bg-neutral-950/70 p-3 rounded-2xl border border-neutral-800 flex flex-wrap gap-1.5">
          {QUICK_OPERATORS.map((op) => (
            <button
              key={op.label}
              onClick={() => handleQuickInsert(op.insert, 0)}
              className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/50 hover:border-indigo-500/60 text-stone-300 hover:text-white rounded-lg text-xs font-mono font-bold transition cursor-pointer"
            >
              {op.label}
            </button>
          ))}
        </div>
      )}

      {/* TAB 1: FORMULAS LIST */}
      {activeTab === 'functions' && (
        <div className="space-y-3">
          {equations.map((eq, index) => {
            const katexPreview = formulaToKatex(eq.formula || '');
            return (
              <div
                key={eq.id}
                className="bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-3 flex flex-col gap-2.5 transition hover:border-neutral-700"
              >
                <div className="flex items-center gap-3">
                  {/* Color indicator / picker */}
                  <input
                    type="color"
                    value={eq.color || '#6366f1'}
                    onChange={(e) => onUpdateEquation(eq.id, { color: e.target.value })}
                    className="w-6 h-6 rounded-lg border-0 bg-transparent cursor-pointer shrink-0"
                    title="Change curve color"
                  />

                  {/* Formula input */}
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2.5 text-xs font-bold font-mono text-stone-500 select-none">
                      {activeDimension === '3D' ? 'z =' : eq.type === 'parametric' ? 'p:' : 'y ='}
                    </span>
                    <input
                      type="text"
                      value={eq.formula}
                      onChange={(e) => onUpdateEquation(eq.id, { formula: e.target.value })}
                      placeholder={activeDimension === '3D' ? 'x^2 - y^2' : 'sin(x) * exp(-0.1*x)'}
                      className="w-full pl-10 pr-3 py-2 bg-neutral-900 border border-neutral-700/60 rounded-xl text-stone-100 font-mono text-sm focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  {/* Curve Visibility Toggle */}
                  <button
                    onClick={() => onToggleVisibility(eq.id)}
                    className="p-2 text-stone-400 hover:text-stone-200 bg-neutral-900 hover:bg-neutral-800 rounded-xl border border-neutral-800 transition cursor-pointer"
                    title={eq.visible ? 'Hide curve' : 'Show curve'}
                  >
                    {eq.visible ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-stone-500" />}
                  </button>

                  {/* Copy KaTeX */}
                  <button
                    onClick={() => handleCopyLatex(eq.formula, index)}
                    className="p-2 text-stone-400 hover:text-stone-200 bg-neutral-900 hover:bg-neutral-800 rounded-xl border border-neutral-800 transition cursor-pointer"
                    title="Copy KaTeX LaTeX string"
                  >
                    {copiedIndex === index ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>

                  {/* Remove Equation */}
                  {equations.length > 1 && (
                    <button
                      onClick={() => onRemoveEquation(eq.id)}
                      className="p-2 text-rose-400 hover:text-rose-300 bg-neutral-900 hover:bg-rose-950/40 rounded-xl border border-neutral-800 hover:border-rose-800/40 transition cursor-pointer"
                      title="Remove equation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* KaTeX Live Math Preview */}
                {katexPreview && (
                  <div className="px-3 py-1.5 bg-neutral-900/60 rounded-xl border border-neutral-800/40 flex items-center justify-between text-xs text-stone-300">
                    <div className="flex items-center gap-2 overflow-x-auto">
                      <span className="text-[10px] text-stone-500 uppercase tracking-widest font-mono">LaTeX:</span>
                      <MathRenderer text={`$${katexPreview}$`} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <button
            onClick={onAddEquation}
            className="w-full py-2.5 border border-dashed border-neutral-700 hover:border-indigo-500 text-stone-400 hover:text-indigo-300 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer bg-neutral-950/40 hover:bg-indigo-950/20"
          >
            <Plus className="w-4 h-4" />
            Add Another Function or Vector
          </button>
        </div>
      )}

      {/* TAB 2: PARAMETER SLIDERS */}
      {activeTab === 'sliders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-400 leading-relaxed">
              Dynamically manipulate parameters (e.g. slope <code className="text-amber-400 font-mono">m</code>, constant <code className="text-amber-400 font-mono">c</code>, frequency <code className="text-amber-400 font-mono">k</code>, angle <code className="text-amber-400 font-mono">theta</code>) to observe real-time curve deformation at 60fps.
            </p>
            <button
              onClick={onToggleAnimation}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                isAnimating
                  ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
                  : 'bg-neutral-800 text-stone-300 hover:bg-neutral-700'
              }`}
            >
              {isAnimating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isAnimating ? 'Pause Animation' : 'Auto Animate'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(sliders).map(([key, val]) => (
              <div
                key={key}
                className="bg-neutral-950/60 border border-neutral-800 rounded-2xl p-3.5 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-amber-400">{key}</span>
                  <div className="flex items-center gap-1 font-mono text-stone-300">
                    <span>{typeof val === 'number' ? val.toFixed(2) : val}</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="0.1"
                  value={val}
                  onChange={(e) => onSliderChange(key, parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-600 font-mono">
                  <span>-10.0</span>
                  <span>0.0</span>
                  <span>+10.0</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PRESETS LIBRARY */}
      {activeTab === 'presets' && (
        <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
          {PRESETS.map((category) => (
            <div key={category.category} className="space-y-2">
              <h4 className="text-[11px] uppercase tracking-wider text-stone-500 font-bold">
                {category.category}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {category.items.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      if (preset.dimension !== activeDimension) {
                        onDimensionChange(preset.dimension);
                      }
                      if (preset.params) {
                        Object.entries(preset.params).forEach(([k, v]) => onSliderChange(k, v));
                      }
                      onUpdateEquation(equations[0]?.id || 'func-1', {
                        formula: preset.formula,
                        color: preset.color,
                        type: preset.type,
                        xFormula: preset.xFormula,
                        yFormula: preset.yFormula,
                        vector: preset.vector,
                      });
                      setActiveTab('functions');
                    }}
                    className="p-3 bg-neutral-950/60 hover:bg-neutral-800/60 border border-neutral-800/80 hover:border-indigo-500/50 rounded-2xl text-left transition flex flex-col gap-1 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-200 group-hover:text-indigo-400">
                        {preset.label}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-stone-400 font-mono">
                        {preset.dimension}
                      </span>
                    </div>
                    <code className="text-[11px] font-mono text-stone-400 group-hover:text-stone-300 truncate">
                      {preset.formula}
                    </code>
                    <p className="text-[10px] text-stone-500 line-clamp-1">{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
