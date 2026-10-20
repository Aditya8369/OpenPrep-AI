import React, { useState } from 'react';
import MathRenderer from '../common/MathRenderer';
import {
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Copy,
  Check,
  AlertTriangle,
  Tag,
  BookOpen,
  Award,
  Layers,
  Sparkles,
} from 'lucide-react';

export default function DerivationViewer({ result, originalImageSrc, onReset }) {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState(() => {
    // Expand all steps by default
    const init = {};
    if (result?.derivationSteps) {
      result.derivationSteps.forEach((_, idx) => {
        init[idx] = true;
      });
    }
    return init;
  });

  const [activeTooltipStep, setActiveTooltipStep] = useState(null);

  if (!result) return null;

  const toggleStep = (index) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const toggleAllSteps = () => {
    const allExpanded = Object.values(expandedSteps).every(Boolean);
    const nextState = {};
    result.derivationSteps?.forEach((_, idx) => {
      nextState[idx] = !allExpanded;
    });
    setExpandedSteps(nextState);
  };

  const copyToClipboard = (text, index = null) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (index !== null) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } else {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  const copyFullDerivation = () => {
    let markdown = `# ${result.problemStatement}\n\n`;
    if (result.governingLaws?.length) {
      markdown += `### Governing Laws\n${result.governingLaws.map((l) => `- ${l}`).join('\n')}\n\n`;
    }
    markdown += `### Derivation Steps\n`;
    result.derivationSteps?.forEach((s) => {
      markdown += `#### Step ${s.stepNumber}: ${s.title}\n$$${s.latex}$$\n${s.explanation}\n\n`;
    });
    if (result.finalAnswer?.latex) {
      markdown += `### Final Answer\n$$${result.finalAnswer.latex}$$\n`;
    }
    copyToClipboard(markdown);
  };

  return (
    <div className="w-full space-y-6 text-slate-100 text-left">
      {/* Header and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-2xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-100">Step-by-Step Mathematical Derivation</h2>
            <p className="text-xs text-slate-450">
              Interactive KaTeX derivation with verified algebraic transitions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={copyFullDerivation}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedAll ? 'Copied Full!' : 'Copy Markdown'}
          </button>

          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition"
            >
              Solve Another
            </button>
          )}
        </div>
      </div>

      {/* Problem Statement Card */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-wider">
          <BookOpen className="w-4 h-4" />
          Transcribed Problem Statement
        </div>
        <div className="text-sm font-medium text-slate-200 leading-relaxed bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
          <MathRenderer content={result.problemStatement || 'Problem transcribed from diagram.'} />
        </div>

        {/* Optional Diagram Description */}
        {result.diagramDescription && (
          <div className="text-xs text-slate-450 bg-slate-800/40 border border-slate-750/50 p-3.5 rounded-xl flex items-start gap-2.5">
            <Layers className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-300">Diagram Representation: </span>
              {result.diagramDescription}
            </div>
          </div>
        )}
      </div>

      {/* Variables & Target Unknowns Grid */}
      {(result.knownVariables?.length > 0 || result.targetUnknown) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Known Variables */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Identified Parameters & Knowns
            </h3>
            <div className="space-y-2">
              {result.knownVariables?.map((v, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl text-xs"
                >
                  <span className="font-semibold text-slate-300">{v.description || 'Variable'}</span>
                  <div className="font-mono text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/50">
                    <MathRenderer content={`$${v.symbol} = ${v.value}$`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Target Unknown & Governing Laws */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
              Target Unknown & Governing Laws
            </h3>
            {result.targetUnknown && (
              <div className="p-3 bg-indigo-950/30 border border-indigo-800/40 rounded-xl text-xs flex items-center justify-between">
                <span className="text-slate-300 font-semibold">{result.targetUnknown.description}</span>
                <span className="font-mono text-indigo-300 font-extrabold bg-indigo-900/50 px-2.5 py-1 rounded">
                  <MathRenderer content={`$${result.targetUnknown.symbol}$ = ?`} />
                </span>
              </div>
            )}
            {result.governingLaws?.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {result.governingLaws.map((law, idx) => (
                  <div
                    key={idx}
                    className="text-xs text-slate-350 bg-slate-950/50 border border-slate-800 px-3 py-1.5 rounded-lg"
                  >
                    <MathRenderer content={law} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Derivation Steps Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Award className="w-4 h-4 text-indigo-400" />
            Derivation Transitions ({result.derivationSteps?.length || 0} Steps)
          </h3>
          <button
            type="button"
            onClick={toggleAllSteps}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition cursor-pointer"
          >
            {Object.values(expandedSteps).every(Boolean) ? 'Collapse All Steps' : 'Expand All Steps'}
          </button>
        </div>

        <div className="space-y-4">
          {result.derivationSteps?.map((step, idx) => {
            const isExpanded = !!expandedSteps[idx];
            const isTooltipOpen = activeTooltipStep === idx;

            return (
              <div
                key={idx}
                className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl transition"
              >
                {/* Step Header */}
                <div
                  onClick={() => toggleStep(idx)}
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-850/50 transition select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-black text-xs">
                      {step.stepNumber || idx + 1}
                    </div>
                    <span className="text-sm font-bold text-slate-200">{step.title}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(step.latex, idx);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
                      title="Copy Step LaTeX"
                    >
                      {copiedIndex === idx ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Step Body (Foldable) */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 border-t border-slate-800/80 space-y-4 bg-slate-950/30">
                    {/* Equation Canvas in KaTeX */}
                    {step.latex && (
                      <div className="p-4 bg-slate-950/80 border border-indigo-950/60 rounded-2xl text-center overflow-x-auto text-indigo-100 shadow-inner">
                        <MathRenderer content={`$$${step.latex}$$`} />
                      </div>
                    )}

                    {/* Explanation */}
                    <div className="text-xs text-slate-300 leading-relaxed">
                      <MathRenderer content={step.explanation} />
                    </div>

                    {/* Interactive "Why did this step happen?" AI follow-up tooltip */}
                    {step.whyStepHappened && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTooltipStep(isTooltipOpen ? null : idx);
                          }}
                          className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 border border-indigo-800/50 px-3 py-1.5 rounded-xl transition cursor-pointer"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          {isTooltipOpen ? 'Hide Reasoning' : 'Why did this step happen?'}
                        </button>

                        {isTooltipOpen && (
                          <div className="mt-2.5 p-3.5 bg-gradient-to-r from-indigo-950/60 to-purple-950/60 border border-indigo-700/50 rounded-2xl text-xs text-indigo-200 animate-in fade-in-50 duration-200">
                            <span className="font-bold text-indigo-100">Step Intuition: </span>
                            <MathRenderer content={step.whyStepHappened} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Final Answer Banner */}
      {result.finalAnswer && (
        <div className="bg-gradient-to-r from-emerald-950/40 via-teal-950/40 to-slate-900 border border-emerald-500/30 p-6 rounded-3xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              Final Derived Solution
            </div>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">
              <MathRenderer
                content={
                  result.finalAnswer.latex
                    ? `$$${result.finalAnswer.latex}$$`
                    : result.finalAnswer.value
                }
              />
            </div>
          </div>

          {result.finalAnswer.unit && (
            <div className="bg-emerald-900/40 border border-emerald-700/50 px-4 py-2 rounded-2xl text-emerald-300 font-mono text-sm font-bold">
              Unit: {result.finalAnswer.unit}
            </div>
          )}
        </div>
      )}

      {/* Common Pitfalls & Traps Callout */}
      {result.pitfallsAndTraps?.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-600/30 p-5 rounded-3xl shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4" />
            Common Student Pitfalls & Traps
          </div>
          <ul className="space-y-1.5">
            {result.pitfallsAndTraps.map((pitfall, i) => (
              <li
                key={i}
                className="text-xs text-amber-200/90 flex items-start gap-2 bg-amber-950/30 p-2.5 rounded-xl border border-amber-800/40"
              >
                <span className="text-amber-500 font-bold shrink-0">•</span>
                <MathRenderer content={pitfall} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Concept Tags Footer */}
      {result.conceptTags?.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Tag className="w-3.5 h-3.5 text-slate-500 mr-1" />
          {result.conceptTags.map((tag, i) => (
            <span
              key={i}
              className="px-2.5 py-1 bg-slate-800/80 border border-slate-700 text-slate-350 text-xs font-semibold rounded-lg"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
