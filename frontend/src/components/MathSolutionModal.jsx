import React, { useState } from 'react';
import { X, CheckCircle2, LineChart, ExternalLink, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import useAutoGraphDetection from '../hooks/useAutoGraphDetection';
import GraphSandbox from './math/GraphSandbox';

const MathSolutionModal = ({ isOpen, onClose, solutionMarkdown }) => {
  const navigate = useNavigate();
  const [showInlineGraph, setShowInlineGraph] = useState(false);
  const { equations, hasGraphableEquations } = useAutoGraphDetection(solutionMarkdown || '');

  if (!isOpen || !solutionMarkdown) return null;

  const firstEq = equations[0];
  const sandboxEquations = equations.map((eq, i) => ({
    id: eq.id || `eq-${i}`,
    formula: eq.formula,
    visible: true,
    color: i === 0 ? '#6366f1' : i === 1 ? '#ec4899' : '#10b981',
    dimension: eq.dimension || '2D',
    type: eq.type || 'explicit',
  }));

  const handleOpenSandbox = () => {
    if (firstEq) {
      navigate('/graphing-calculator', {
        state: { formula: firstEq.formula, dimension: firstEq.dimension },
      });
    } else {
      navigate('/graphing-calculator');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-stone-100 font-extrabold font-playfair text-lg">AI Step-by-Step Derivation</h2>
          </div>
          <div className="flex items-center gap-2">
            {hasGraphableEquations && (
              <button
                onClick={() => setShowInlineGraph(!showInlineGraph)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  showInlineGraph
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-950/50 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/50'
                }`}
              >
                <LineChart className="w-3.5 h-3.5" />
                {showInlineGraph ? 'Hide Graph Preview' : 'Plot Detected Graph'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-stone-300 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Detected Equation Notification Bar */}
        {hasGraphableEquations && (
          <div className="bg-indigo-950/30 border-b border-indigo-900/40 px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-indigo-200">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                Detected graphable equation:{' '}
                <strong className="font-mono text-indigo-300">{firstEq?.displayLabel || firstEq?.formula}</strong>
              </span>
            </div>
            <button
              onClick={handleOpenSandbox}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition cursor-pointer"
            >
              Open Full Interactive Sandbox <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-stone-200 text-sm leading-relaxed font-sans">
          {/* Inline Interactive Graph Preview */}
          {showInlineGraph && hasGraphableEquations && (
            <div className="mb-6 p-4 bg-neutral-950 rounded-2xl border border-neutral-800 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                  <LineChart className="w-4 h-4 text-indigo-400" />
                  Interactive Curve Preview ({firstEq.dimension})
                </span>
                <button
                  onClick={handleOpenSandbox}
                  className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-stone-300 text-xs font-semibold rounded-lg flex items-center gap-1 transition cursor-pointer"
                >
                  Expand in Sandbox <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <div className="h-[340px] w-full">
                <GraphSandbox
                  equations={sandboxEquations}
                  activeDimension={firstEq.dimension || '2D'}
                  sliders={{ k: 1, m: 1, c: 0, a: 1, b: 0, theta: 0 }}
                />
              </div>
            </div>
          )}

          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {solutionMarkdown}
          </ReactMarkdown>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-between">
          <div>
            {hasGraphableEquations && (
              <button
                onClick={handleOpenSandbox}
                className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <LineChart className="w-4 h-4" />
                Launch 2D/3D Graphing Sandbox
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-stone-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Close Solution
          </button>
        </div>
      </div>
    </div>
  );
};

export default MathSolutionModal;
