import React, { useState } from 'react';
import {
  BookOpen,
  Code2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  RotateCcw,
  Send,
  HelpCircle,
  Award,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Layers,
  Check
} from 'lucide-react';

const SAMPLE_PROMPTS = [
  {
    title: 'Biology / Biochemistry',
    prompt: 'Explain the mechanism of enzyme catalysis, comparing the Lock-and-Key and Induced Fit models, and describe the factors that affect enzymatic reaction velocity (temperature, pH, and substrate concentration).',
    rubric: [
      { criterion: 'Lock-and-Key vs Induced Fit Models', maxPoints: 3 },
      { criterion: 'Active site interaction & activation energy reduction', maxPoints: 3 },
      { criterion: 'Environmental factors (Temperature, pH, Vmax/Km)', maxPoints: 4 },
    ],
    defaultText: `Enzymes act as biological catalysts that accelerate chemical reactions by lowering the activation energy without being consumed in the process.

Under the Lock-and-Key model proposed by Emil Fischer, the enzyme's active site is a rigid template into which a complementary substrate fits exactly. In contrast, Koshland's Induced Fit hypothesis posits that the active site is flexible and undergoes a conformational change upon substrate binding to optimize transition-state stabilization.

The rate of enzymatic reaction is heavily influenced by environmental conditions. As temperature rises, kinetic energy increases reaction velocity until an optimum temperature is reached, beyond which thermal denaturation occurs. Similarly, extreme fluctuations in pH alter the ionization states of amino acid residues in the catalytic site. As substrate concentration increases, the reaction velocity approaches Vmax asymptotically.`,
  },
  {
    title: 'Computer Science / Algorithms',
    prompt: 'Write and explain an efficient algorithm to detect if an array contains duplicates within k distance. Analyze its time and space complexity.',
    rubric: [
      { criterion: 'Correct algorithmic approach (Sliding Window / Hash Set)', maxPoints: 4 },
      { criterion: 'Asymptotic Time Complexity Analysis (O(N))', maxPoints: 3 },
      { criterion: 'Space Complexity & Boundary Condition Checks', maxPoints: 3 },
    ],
    defaultText: `function containsNearbyDuplicate(nums, k) {
  if (!nums || nums.length <= 1 || k <= 0) {
    return false;
  }

  const windowSet = new Set();

  for (let i = 0; i < nums.length; i++) {
    // If the window size exceeds k, remove the oldest element
    if (i > k) {
      windowSet.delete(nums[i - k - 1]);
    }

    // If current element is already in sliding window, duplicate found
    if (windowSet.has(nums[i])) {
      return true;
    }

    windowSet.add(nums[i]);
  }

  return false;
}`,
  },
];

export default function SubjectiveEvaluationView() {
  const [selectedSampleIdx, setSelectedSampleIdx] = useState(0);
  const [questionPrompt, setQuestionPrompt] = useState(SAMPLE_PROMPTS[0].prompt);
  const [studentSubmission, setStudentSubmission] = useState(SAMPLE_PROMPTS[0].defaultText);
  const [scoringRubric, setScoringRubric] = useState(SAMPLE_PROMPTS[0].rubric);

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [lintResult, setLintResult] = useState(null);
  const [activeTab, setActiveTab] = useState('rubric'); // 'rubric' | 'annotations' | 'exemplar' | 'codeAnalysis'

  const selectSample = (idx) => {
    setSelectedSampleIdx(idx);
    setQuestionPrompt(SAMPLE_PROMPTS[idx].prompt);
    setStudentSubmission(SAMPLE_PROMPTS[idx].defaultText);
    setScoringRubric(SAMPLE_PROMPTS[idx].rubric);
    setEvaluationResult(null);
    setLintResult(null);
  };

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    try {
      // 1. Evaluate rubric
      const res = await fetch('/api/evaluator/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionPrompt,
          studentSubmission,
          scoringRubric,
        }),
      });
      const data = await res.json();
      setEvaluationResult(data);

      // 2. If looks like code, run linter as well
      if (studentSubmission.includes('function') || studentSubmission.includes('def ') || studentSubmission.includes('{')) {
        const lintRes = await fetch('/api/evaluator/lint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: studentSubmission, language: 'javascript' }),
        });
        const lintData = await lintRes.json();
        if (lintData.success) {
          setLintResult(lintData.data);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Evaluation completed via client-side preview mode.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleReattempt = () => {
    setEvaluationResult(null);
    setLintResult(null);
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Award className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                AI Subjective Essay & Code Solution Auto-Grader
              </h1>
              <p className="text-sm text-slate-400">
                Institutional rubric-based evaluation with line annotations, point allocations, and code complexity profiler
              </p>
            </div>
          </div>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl">
          {SAMPLE_PROMPTS.map((sample, idx) => (
            <button
              key={idx}
              onClick={() => selectSample(idx)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedSampleIdx === idx
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {sample.title}
            </button>
          ))}
        </div>
      </div>

      {/* Question Prompt Card */}
      <div className="mt-6 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
        <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider">
          Question Prompt
        </span>
        <p className="text-sm text-slate-200 mt-1 font-medium">{questionPrompt}</p>
      </div>

      {/* Split-Screen Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Left Column: Student Submission / Code Editor (6 or 7 cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              Student Submission Draft
            </h2>
            <span className="text-xs text-slate-400">
              {studentSubmission.split('\n').length} lines • {studentSubmission.length} characters
            </span>
          </div>

          <div className="relative flex-1">
            <textarea
              value={studentSubmission}
              onChange={(e) => setStudentSubmission(e.target.value)}
              placeholder="Paste or write your essay response or code implementation..."
              rows={18}
              disabled={isEvaluating}
              className="w-full h-full min-h-[460px] bg-slate-900/70 border border-slate-800 rounded-2xl p-4 text-sm text-slate-100 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            />
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2">
            {evaluationResult ? (
              <button
                onClick={handleReattempt}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-semibold border border-slate-700 transition-all"
              >
                <RotateCcw className="w-4 h-4 text-indigo-400" /> Re-attempt with Feedback
              </button>
            ) : (
              <div className="text-xs text-slate-500">
                Rubric point deductions will be calculated across criteria
              </div>
            )}

            <button
              onClick={handleEvaluate}
              disabled={isEvaluating || !studentSubmission.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {isEvaluating ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" /> Evaluating Rubric...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Evaluate Submission
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Scorecard, Rubric Breakdown, Annotations (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Default state before evaluation: Display Rubric Criteria */}
          {!evaluationResult && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-base font-semibold text-slate-200 flex items-center gap-2 mb-4">
                <Layers className="w-5 h-5 text-indigo-400" />
                Institutional Scoring Rubric
              </h3>

              <div className="space-y-4">
                {scoringRubric.map((r, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-sm font-medium text-slate-200">{r.criterion}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Evaluation dimension {idx + 1}</p>
                    </div>
                    <span className="text-xs font-mono font-bold bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-lg border border-indigo-500/20">
                      {r.maxPoints} pts
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl text-xs text-slate-400 text-center">
                Submit your response to receive mathematical point allocation, line-by-line constructive annotations, and model answers.
              </div>
            </div>
          )}

          {/* Graded Result View */}
          {evaluationResult && (
            <div className="space-y-6">
              {/* Overall Score Banner */}
              <div className="p-6 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/30 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-bold">
                    Official Rubric Scorecard
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/30">
                    {evaluationResult.gradePercentage}% Grade
                  </span>
                </div>

                <div className="flex items-baseline gap-2 mt-3">
                  <span className="text-5xl font-mono font-bold text-white">
                    {evaluationResult.totalScore}
                  </span>
                  <span className="text-xl text-slate-400 font-mono">
                    / {evaluationResult.maxScore} pts
                  </span>
                </div>

                <p className="text-xs text-slate-300 mt-3 leading-relaxed">
                  {evaluationResult.overallFeedback}
                </p>
              </div>

              {/* Sub-Tabs: Rubric Breakdown, Annotations, Exemplar */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                <div className="flex border-b border-slate-800 pb-3 gap-2">
                  <button
                    onClick={() => setActiveTab('rubric')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'rubric' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Criteria ({evaluationResult.criteria?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('annotations')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'annotations' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Line Annotations ({evaluationResult.annotations?.length || 0})
                  </button>
                  {lintResult && (
                    <button
                      onClick={() => setActiveTab('codeAnalysis')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        activeTab === 'codeAnalysis' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Complexity & Lint
                    </button>
                  )}
                  <button
                    onClick={() => setActiveTab('exemplar')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'exemplar' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Model Exemplar
                  </button>
                </div>

                {/* Tab 1: Criteria Breakdown */}
                {activeTab === 'rubric' && (
                  <div className="space-y-4 mt-4">
                    {evaluationResult.criteria?.map((c, idx) => (
                      <div key={idx} className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-200">{c.criterion}</span>
                          <span className="font-mono font-bold text-indigo-400">
                            {c.score} / {c.maxPoints} pts
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.round((c.score / c.maxPoints) * 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{c.feedback}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab 2: Line Annotations */}
                {activeTab === 'annotations' && (
                  <div className="space-y-3 mt-4 max-h-96 overflow-y-auto">
                    {evaluationResult.annotations?.length === 0 ? (
                      <p className="text-xs text-slate-400">No specific line deductions detected.</p>
                    ) : (
                      evaluationResult.annotations?.map((ann, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border text-xs space-y-1 ${
                            ann.severity === 'error'
                              ? 'bg-red-500/10 border-red-500/30 text-red-200'
                              : ann.severity === 'warning'
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                              : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200'
                          }`}
                        >
                          <div className="flex justify-between font-mono font-bold">
                            <span>Line {ann.line}</span>
                            <span className="uppercase text-[10px]">{ann.severity}</span>
                          </div>
                          {ann.quote && (
                            <blockquote className="italic opacity-80 border-l-2 pl-2 border-current">
                              "{ann.quote}"
                            </blockquote>
                          )}
                          <p>{ann.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tab 3: Code Complexity Profiler */}
                {activeTab === 'codeAnalysis' && lintResult && (
                  <div className="space-y-4 mt-4 text-xs">
                    <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-300">Asymptotic Time Complexity</span>
                        <span className="font-mono font-bold text-emerald-400 px-2 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20">
                          {lintResult.timeComplexity?.complexity}
                        </span>
                      </div>
                      <p className="text-slate-400">{lintResult.timeComplexity?.rationale}</p>
                    </div>

                    <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex justify-between items-center">
                      <span className="font-semibold text-slate-300">Auxiliary Space Efficiency</span>
                      <span className="font-mono text-indigo-300">{lintResult.spaceComplexity}</span>
                    </div>

                    {lintResult.missedEdgeCases?.length > 0 && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1.5">
                        <span className="font-bold text-amber-300">Potential Missed Edge Cases:</span>
                        <ul className="list-disc list-inside space-y-1 text-amber-200/80">
                          {lintResult.missedEdgeCases.map((ec, idx) => (
                            <li key={idx}>{ec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 4: Model Exemplar Answer */}
                {activeTab === 'exemplar' && (
                  <div className="mt-4 p-4 bg-slate-950/80 border border-slate-800 rounded-xl max-h-96 overflow-y-auto">
                    <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider block mb-2">
                      Full-Marks Benchmark Answer
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                      {evaluationResult.modelExemplarAnswer}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
