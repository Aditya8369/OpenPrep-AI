import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import ChapterWeightageChart from '../components/pyq/ChapterWeightageChart';
import TopicHeatmap from '../components/pyq/TopicHeatmap';
import SyllabusSunburstChart from '../components/analytics/SyllabusSunburstChart';
import PYQUploadModal from '../components/pyq/PYQUploadModal';
import CustomQuizModal from '../components/pyq/CustomQuizModal';
import {
  FaCloudUploadAlt,
  FaFilePdf,
  FaArrowLeft,
  FaBrain,
  FaHistory,
  FaDownload,
  FaCompass,
  FaTrophy,
} from 'react-icons/fa';
import { Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PYQAnalytics = () => {
  const navigate = useNavigate();
  
  // State
  const [subjects, setSubjects] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [analyses, setAnalyses] = useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  
  // Modals / Status
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCustomQuizOpen, setIsCustomQuizOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  
  // Popover for chapter clicked action
  const [clickedChapter, setClickedChapter] = useState(null);

  // Fetch subjects on mount
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await API.get('/academic/subjects');
        if (res.data?.success) {
          setSubjects(res.data.data);
          if (res.data.data.length > 0) {
            setSelectedSubjectId(res.data.data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load subjects:', err);
      }
    };
    fetchSubjects();
  }, []);

  // Fetch analyses whenever selectedSubjectId changes
  useEffect(() => {
    if (!selectedSubjectId) return;
    fetchAnalyses();
  }, [selectedSubjectId]);

  const fetchAnalyses = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/pyqs/subject/${selectedSubjectId}`);
      if (res.data?.success) {
        setAnalyses(res.data.data);
        if (res.data.data.length > 0) {
          setSelectedAnalysis(res.data.data[0]); // Load latest by default
        } else {
          setSelectedAnalysis(null);
        }
      }
    } catch (err) {
      console.error('Failed to load historical analyses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = (newAnalysis) => {
    // Refresh history
    fetchAnalyses();
  };

  const handleExportPDF = async (analysisId) => {
    try {
      window.open(`${API.defaults.baseURL}/pyqs/analysis/${analysisId}/export`, '_blank');
    } catch (err) {
      console.error('Failed to export PDF:', err);
    }
  };

  const triggerAIQuiz = async (chapterName) => {
    setActionError('');
    setActionSuccess('');
    setActionPending(true);

    try {
      const res = await API.post('/quizzes/generate-ai', {
        subjectId: selectedSubjectId,
        count: 5,
        language: 'English',
      });
      if (res.data?.success) {
        setActionSuccess(`Generated 5-question targeted quiz for ${chapterName}! Redirecting...`);
        setClickedChapter(null);
        setTimeout(() => {
          navigate(`/quiz/${res.data.data.id}`);
        }, 1500);
      }
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to generate targeted quiz.');
    } finally {
      setActionPending(false);
    }
  };

  const triggerAIFlashcards = async (chapterName) => {
    setActionError('');
    setActionSuccess('');
    setActionPending(true);

    try {
      const res = await API.post('/flashcards/generate-ai', {
        subjectId: selectedSubjectId,
        count: 6,
      });
      if (res.data?.success) {
        setActionSuccess(`Targeted AI Flashcard deck generated successfully for ${chapterName}!`);
        setClickedChapter(null);
      }
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to generate targeted flashcards.');
    } finally {
      setActionPending(false);
    }
  };

  const weightageList = selectedAnalysis?.weightageData?.chapterWeightage || [];
  
  // Sorted recommended high-yield chapters (chapters with > 20% weightage or top 3)
  const highYieldChapters = [...weightageList]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-250 p-6 md:p-12 font-inter">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-800 pb-6">
          <div>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center text-xs font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-widest gap-2 mb-3"
            >
              <FaArrowLeft /> Dashboard
            </button>
            <h1 className="text-3xl font-extrabold font-playfair text-stone-100 flex items-center gap-2.5">
              <FaCompass className="text-indigo-400" /> PYQ Trend Analyzer
            </h1>
            <p className="text-stone-400 text-sm mt-1">
              Automated past paper weightages & concept frequency heatmaps
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="bg-neutral-900 border border-neutral-800 text-stone-200 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-semibold"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <button
              onClick={() => setIsUploadOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-5 rounded-xl transition-all shadow-md text-xs flex items-center gap-2"
            >
              <FaCloudUploadAlt className="text-sm" /> Analyze Batch
            </button>

            <button
              onClick={() => setIsCustomQuizOpen(true)}
              className="bg-neutral-800 hover:bg-neutral-750 text-stone-250 border border-neutral-700 font-bold py-3 px-5 rounded-xl transition-all shadow-md text-xs flex items-center gap-2"
            >
              <Sparkles className="text-indigo-400" /> Custom Test
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        <AnimatePresence>
          {actionSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs font-semibold"
            >
              {actionSuccess}
            </motion.div>
          )}
          {actionError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-semibold"
            >
              {actionError}
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-stone-400 text-xs font-semibold">Aggregating subject Past Papers...</p>
          </div>
        ) : !selectedAnalysis ? (
          
          /* Empty State */
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-850 rounded-full border border-neutral-750 text-stone-400">
              <FaFilePdf className="text-2xl" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-stone-100">No Past Papers Analyzed Yet</h3>
              <p className="text-stone-400 text-xs leading-relaxed">
                Upload up to 10 Previous Year Question Papers (PYQs) for this subject. The AI will parse details, weightages, and concepts automatically.
              </p>
            </div>
            <button
              onClick={() => setIsUploadOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl text-xs transition-all shadow-md"
            >
              Upload Past Papers
            </button>
          </div>

        ) : (
          
          /* Active Dashboard */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
            
            {/* Sidebar history (1/4 width) */}
            <div className="lg:col-span-1 bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-4 shadow-xl">
              <h2 className="text-xs font-bold text-stone-400 uppercase tracking-widest border-b border-neutral-800 pb-3 flex items-center gap-2">
                <FaHistory /> Analysis History
              </h2>
              <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-hide">
                {analyses.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedAnalysis(item);
                      setClickedChapter(null);
                    }}
                    className={`w-full text-left p-3 rounded-xl transition-all border text-xs font-semibold flex items-center justify-between ${
                      selectedAnalysis?.id === item.id
                        ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300'
                        : 'bg-stone-950/60 border-neutral-850 hover:bg-neutral-850 text-stone-300'
                    }`}
                  >
                    <span className="truncate">{item.examName}</span>
                    <span className="text-[10px] text-stone-500 font-mono font-bold shrink-0 ml-2">
                      {item.yearRange}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Visualizations (3/4 width) */}
            <div className="lg:col-span-3 space-y-8">
              
              {/* Meta stats bar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-neutral-900 border border-neutral-800 p-5 rounded-2xl shadow-xl gap-4">
                <div>
                  <h2 className="text-lg font-bold text-stone-100">{selectedAnalysis.examName} Analysis</h2>
                  <p className="text-stone-400 text-xs mt-0.5">
                    Papers: <strong className="text-stone-300">{selectedAnalysis.yearRange}</strong> • Aggregated Questions: <strong className="text-stone-300">{selectedAnalysis.totalQuestions}</strong>
                  </p>
                </div>

                <button
                  onClick={() => handleExportPDF(selectedAnalysis.id)}
                  className="bg-neutral-850 hover:bg-neutral-800 text-stone-300 border border-neutral-750 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 transition-all shrink-0"
                >
                  <FaDownload /> Export Report PDF
                </button>
              </div>

              {/* Responsive Charts Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ChapterWeightageChart
                  data={weightageList}
                  onChapterClick={(chName) => setClickedChapter(chName)}
                />
                <TopicHeatmap questions={selectedAnalysis.questions || []} />
              </div>

              {/* Interactive Syllabus Mastery Sunburst Chart & PYQ Chapter Weightage Explorer */}
              <SyllabusSunburstChart
                onSelectTopic={(topic) => setClickedChapter(topic.name)}
              />

              {/* Clicked Chapter Popup Alert */}
              <AnimatePresence>
                {clickedChapter && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-5 bg-neutral-900 border-2 border-indigo-500/50 rounded-2xl shadow-2xl flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left"
                  >
                    <div>
                      <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 justify-center sm:justify-start">
                        <Sparkles /> Practice Chapter
                      </p>
                      <h4 className="text-sm font-bold text-stone-100 mt-1">"{clickedChapter}"</h4>
                      <p className="text-stone-400 text-xs mt-0.5">Select a practice method below to start revision.</p>
                    </div>

                    <div className="flex gap-2.5 shrink-0">
                      <button
                        onClick={() => triggerAIQuiz(clickedChapter)}
                        disabled={actionPending}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center gap-1.5"
                      >
                        <FaBrain /> AI Quiz
                      </button>
                      <button
                        onClick={() => triggerAIFlashcards(clickedChapter)}
                        disabled={actionPending}
                        className="bg-neutral-800 hover:bg-neutral-750 disabled:opacity-50 text-stone-250 border border-neutral-700 font-bold py-2.5 px-4 rounded-xl text-xs transition-all"
                      >
                        AI Flashcards
                      </button>
                      <button
                        onClick={() => setClickedChapter(null)}
                        disabled={actionPending}
                        className="text-stone-500 hover:text-stone-300 text-xs font-bold px-2 py-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Recommended High-Yield Chapter Priorities list */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                  <FaTrophy className="text-amber-500" /> Recommended High-Yield Chapter Priority List
                </h3>
                <p className="text-stone-400 text-xs">
                  We recommend focusing on these topics first to optimize exam preparation:
                </p>

                <div className="space-y-3">
                  {highYieldChapters.map((ch, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-stone-950/60 border border-neutral-850 rounded-xl gap-4"
                    >
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                          Priority #{idx + 1}
                        </span>
                        <h4 className="text-sm font-bold text-stone-200">{ch.chapterName}</h4>
                        <p className="text-xs text-stone-500">
                          Accounts for {ch.percentage}% of overall exam marks.
                        </p>
                      </div>

                      <button
                        onClick={() => setClickedChapter(ch.chapterName)}
                        className="px-4 py-2 bg-neutral-850 hover:bg-neutral-800 text-stone-300 font-bold rounded-xl text-[10px] transition-colors border border-neutral-750 shrink-0"
                      >
                        Practice this Chapter
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

      </div>

      {/* Upload Modal component */}
      <PYQUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
      {/* Custom Test Generator Modal */}
      <CustomQuizModal
        isOpen={isCustomQuizOpen}
        onClose={() => setIsCustomQuizOpen(false)}
        subjectId={selectedSubjectId}
        analyses={analyses}
      />
    </div>
  );
};

export default PYQAnalytics;
