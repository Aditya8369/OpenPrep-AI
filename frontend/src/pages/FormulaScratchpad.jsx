import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator, PenTool, Keyboard, Lightbulb } from 'lucide-react';
import FloatingUtilityDrawer from '../components/common/FloatingUtilityDrawer';

/**
 * Quick-reference formula cards
 */
const FORMULA_CATEGORIES = [
  {
    name: 'Algebra',
    color: 'from-indigo-500/20 to-indigo-900/10',
    border: 'border-indigo-500/25',
    icon: '∑',
    formulas: [
      { label: 'Quadratic', formula: 'x = (-b ± √(b²-4ac)) / 2a' },
      { label: 'Sum of Series', formula: 'S = n/2 × (a₁ + aₙ)' },
      { label: 'Exponential', formula: 'A = P(1 + r/n)^(nt)' },
    ],
  },
  {
    name: 'Trigonometry',
    color: 'from-violet-500/20 to-violet-900/10',
    border: 'border-violet-500/25',
    icon: '∠',
    formulas: [
      { label: 'Pythagorean', formula: 'sin²θ + cos²θ = 1' },
      { label: 'Double Angle', formula: 'sin(2θ) = 2sin(θ)cos(θ)' },
      { label: 'Law of Cosines', formula: 'c² = a² + b² - 2ab·cos(C)' },
    ],
  },
  {
    name: 'Calculus',
    color: 'from-emerald-500/20 to-emerald-900/10',
    border: 'border-emerald-500/25',
    icon: '∫',
    formulas: [
      { label: 'Power Rule', formula: 'd/dx[xⁿ] = nxⁿ⁻¹' },
      { label: 'Chain Rule', formula: 'd/dx[f(g(x))] = f\'(g(x))·g\'(x)' },
      { label: 'Integration', formula: '∫xⁿdx = xⁿ⁺¹/(n+1) + C' },
    ],
  },
  {
    name: 'Physics',
    color: 'from-amber-500/20 to-amber-900/10',
    border: 'border-amber-500/25',
    icon: '⚡',
    formulas: [
      { label: "Newton's 2nd", formula: 'F = ma' },
      { label: 'Kinetic Energy', formula: 'KE = ½mv²' },
      { label: 'Ohm\'s Law', formula: 'V = IR' },
    ],
  },
  {
    name: 'Statistics',
    color: 'from-cyan-500/20 to-cyan-900/10',
    border: 'border-cyan-500/25',
    icon: 'σ',
    formulas: [
      { label: 'Mean', formula: 'μ = Σxᵢ / n' },
      { label: 'Std Deviation', formula: 'σ = √(Σ(xᵢ-μ)² / n)' },
      { label: 'Normal Dist.', formula: 'f(x) = (1/σ√2π)e^(-(x-μ)²/2σ²)' },
    ],
  },
  {
    name: 'Chemistry',
    color: 'from-rose-500/20 to-rose-900/10',
    border: 'border-rose-500/25',
    icon: '⚗',
    formulas: [
      { label: 'Ideal Gas', formula: 'PV = nRT' },
      { label: 'pH', formula: 'pH = -log[H⁺]' },
      { label: 'Molarity', formula: 'M = mol solute / L solution' },
    ],
  },
];

/**
 * FormulaScratchpad Page
 * A dedicated study utility page with a floating scientific
 * calculator + canvas scratchpad drawer, and quick-reference formula cards.
 */
export default function FormulaScratchpad() {
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Top Bar */}
      <div className="sticky top-0 z-40 bg-stone-950/80 backdrop-blur-xl border-b border-stone-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-lg hover:bg-stone-800/60 transition text-stone-400 hover:text-stone-200"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-black font-display text-stone-100 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-indigo-400" />
                  Formula Calculator & Scratchpad
                </h1>
                <p className="text-[11px] text-stone-500 font-mono hidden sm:block">
                  Scientific calculator + canvas working area for quick calculations
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/graphing-calculator')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/60 cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5 text-indigo-400" />
                2D/3D Graph Sandbox
              </button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition ${
                  isDrawerOpen
                    ? 'bg-indigo-600 text-white'
                    : 'bg-stone-800/60 border border-stone-700/40 text-stone-300 hover:bg-stone-700/60'
                }`}
              >
                {isDrawerOpen ? (
                  <>
                    <PenTool className="w-3.5 h-3.5" />
                    Calculator Open
                  </>
                ) : (
                  <>
                    <Calculator className="w-3.5 h-3.5" />
                    Open Calculator
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Drawer */}
      <FloatingUtilityDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Intro Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-rose-500/10 border border-stone-700/30 rounded-2xl p-6 mb-8"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-500/20 rounded-xl shrink-0">
              <Lightbulb className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-100 mb-1">
                Quick Study Utilities
              </h2>
              <p className="text-sm text-stone-400 leading-relaxed">
                Use the floating <strong className="text-indigo-400">Calculator</strong> for scientific computations and the{' '}
                <strong className="text-violet-400">Scratchpad</strong> for rough work. Drag the drawer anywhere on screen.
                Below are common reference formulas organized by subject.
              </p>
              <div className="flex items-center gap-4 mt-3">
                <span className="flex items-center gap-1.5 text-xs text-stone-500">
                  <Keyboard className="w-3.5 h-3.5" />
                  Keyboard shortcuts supported
                </span>
                <span className="flex items-center gap-1.5 text-xs text-stone-500">
                  <PenTool className="w-3.5 h-3.5" />
                  Touch drawing on mobile
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Formula Reference Cards */}
        <h3 className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-4">
          Quick Reference Formulas
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FORMULA_CATEGORIES.map((cat, catIdx) => (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: catIdx * 0.05 }}
              className={`bg-gradient-to-b ${cat.color} border ${cat.border} rounded-2xl p-4`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{cat.icon}</span>
                <h4 className="text-sm font-bold text-stone-200">{cat.name}</h4>
              </div>
              <div className="space-y-2">
                {cat.formulas.map((f) => (
                  <div
                    key={f.label}
                    className="bg-stone-950/40 border border-stone-800/40 rounded-lg px-3 py-2"
                  >
                    <p className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
                      {f.label}
                    </p>
                    <p className="text-sm font-mono text-stone-200 mt-0.5">
                      {f.formula}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 py-8 mt-4">
          <Calculator className="w-3 h-3 text-stone-700" />
          <p className="text-[11px] text-stone-600 font-mono">
            Calculator and scratchpad run entirely in your browser — no data is sent to any server
          </p>
        </div>
      </div>
    </div>
  );
}
