import React, { useState } from 'react';
import API from '../../services/api';
import ProblemImageCapture from '../../components/ocr/ProblemImageCapture';
import DerivationViewer from '../../components/ocr/DerivationViewer';
import DiagramImageCropper from '../../components/ocr/DiagramImageCropper';
import OcrResultViewer from '../../components/ocr/OcrResultViewer';
import { Camera, Sparkles, AlertCircle, FileText, Cpu, CheckCircle } from 'lucide-react';

export default function OcrSolverPage() {
  const [activeTab, setActiveTab] = useState('derivation'); // 'derivation' | 'classic'
  const [croppedImageSrc, setCroppedImageSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [derivationResult, setDerivationResult] = useState(null);
  const [classicResult, setClassicResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [rateLimitWait, setRateLimitWait] = useState(null);

  // Derivation Solver Handler (/api/ai/solve-diagram)
  const handleDerivationSolve = async (blob, dataUrl, subjectHint) => {
    setCroppedImageSrc(dataUrl);
    setLoading(true);
    setErrorMsg('');
    setRateLimitWait(null);
    setDerivationResult(null);

    const formData = new FormData();
    formData.append('image', blob, 'diagram_problem.jpg');
    if (subjectHint) {
      formData.append('subjectHint', subjectHint);
    }

    try {
      const res = await API.post('/ai/solve-diagram', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setDerivationResult(res.data.data);
    } catch (err) {
      if (err.response?.status === 429) {
        const retryAfter = err.response.data?.retryAfter || 60;
        setRateLimitWait(retryAfter);
        setErrorMsg(`AI Vision rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`);
      } else if (err.response?.status === 422) {
        setErrorMsg(
          err.response.data?.error ||
            'The uploaded image was not recognized as a STEM problem or diagram. Please upload a clear math or science figure.'
        );
      } else {
        setErrorMsg(
          err.response?.data?.error ||
            'Failed to solve math/science diagram. Please try a clearer crop or higher contrast image.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Classic OCR parse handler (/api/ocr/parse-diagram)
  const handleClassicCropComplete = async (blob, dataUrl) => {
    setCroppedImageSrc(dataUrl);
    setLoading(true);
    setErrorMsg('');
    setClassicResult(null);

    const formData = new FormData();
    formData.append('image', blob, 'cropped_diagram.jpg');

    try {
      const res = await API.post('/ocr/parse-diagram', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setClassicResult(res.data.data);
    } catch (err) {
      setErrorMsg(
        err.response?.data?.error || 'Failed to parse diagram. Please try a clearer crop.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setDerivationResult(null);
    setClassicResult(null);
    setCroppedImageSrc(null);
    setErrorMsg('');
    setRateLimitWait(null);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 p-4 md:p-6 text-slate-100 text-left">
      {/* Header Panel */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 rounded-2xl shadow-inner">
            <Camera className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-100 via-indigo-100 to-indigo-300">
              Multimodal Math & Science Diagram Solver
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Crop textbook problems, circuit diagrams, or differential equations into interactive KaTeX derivations.
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800 self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('derivation');
              handleReset();
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'derivation'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            KaTeX Derivations
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('classic');
              handleReset();
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'classic'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Raw Transcriber
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/25 text-rose-300 p-4 rounded-2xl text-xs font-bold flex items-start gap-3 shadow-lg">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>{errorMsg}</p>
            {rateLimitWait && (
              <p className="text-slate-400 font-normal">
                OpenPrep AI rate limiter prevents excessive API consumption. Your quota resets shortly.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
          <Sparkles className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
          <h3 className="font-extrabold text-slate-100 text-base">
            Gemini Multimodal Vision Engine Analyzing Diagram...
          </h3>
          <p className="text-xs text-slate-400 mt-1 text-center max-w-md">
            Isolating problem parameters, identifying governing physical theorems, and constructing step-by-step KaTeX derivations.
          </p>
        </div>
      )}

      {/* Mode 1: Interactive KaTeX Derivations */}
      {activeTab === 'derivation' && !loading && (
        <>
          {!derivationResult ? (
            <ProblemImageCapture
              onCaptureComplete={handleDerivationSolve}
              isProcessing={loading}
            />
          ) : (
            <DerivationViewer
              result={derivationResult}
              originalImageSrc={croppedImageSrc}
              onReset={handleReset}
            />
          )}
        </>
      )}

      {/* Mode 2: Classic Transcriber */}
      {activeTab === 'classic' && !loading && (
        <>
          {!classicResult ? (
            <DiagramImageCropper onCropComplete={handleClassicCropComplete} />
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Transcribed Structure
                </h3>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Analyze New Image
                </button>
              </div>
              <OcrResultViewer result={classicResult} originalImageSrc={croppedImageSrc} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
