import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader, X, Layers, HelpCircle } from 'lucide-react';
import API from '../../services/api';
import MathRenderer from '../common/MathRenderer';

const DeckImportModal = ({ isOpen, onClose, onImportSuccess, defaultSubjectId = null }) => {
  const [activeTab, setActiveTab] = useState('anki'); // 'anki' | 'quizlet'
  const [file, setFile] = useState(null);
  const [rawText, setRawText] = useState('');
  const [deckName, setDeckName] = useState('');
  const [termSeparator, setTermSeparator] = useState('\t');
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewCards, setPreviewCards] = useState([]);
  const [clozeCount, setClozeCount] = useState(0);
  const [error, setError] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const countClozeInCards = (cards) => {
    const clozeRegex = /\{\{c\d+::/g;
    return cards.reduce((acc, card) => {
      const matchFront = (card.front || '').match(clozeRegex);
      const matchBack = (card.back || '').match(clozeRegex);
      return acc + (matchFront ? matchFront.length : 0) + (matchBack ? matchBack.length : 0);
    }, 0);
  };

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError(null);
    if (!deckName) {
      setDeckName(selected.name.replace(/\.[^/.]+$/, ''));
    }

    if (activeTab === 'quizlet' && (selected.name.endsWith('.txt') || selected.name.endsWith('.csv') || selected.name.endsWith('.tsv') || selected.name.endsWith('.json'))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result || '';
        setRawText(text);
        parseQuizletPreview(text);
      };
      reader.readAsText(selected);
    }
  };

  const parseQuizletPreview = (text) => {
    try {
      const lines = text.split('\n').filter((l) => l.trim().length > 0);
      const cards = [];
      const sep = termSeparator;
      for (const line of lines.slice(0, 10)) {
        const parts = line.split(sep);
        if (parts.length >= 2) {
          cards.push({
            front: parts[0].trim(),
            back: parts.slice(1).join(sep).trim(),
          });
        }
      }
      setPreviewCards(cards);
      setClozeCount(countClozeInCards(cards));
    } catch {
      // preview parsing error ignored
    }
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setRawText(val);
    parseQuizletPreview(val);
  };

  const handleImport = async () => {
    setError(null);
    setIsUploading(true);
    setUploadProgress(20);

    try {
      if (activeTab === 'anki') {
        if (!file) {
          throw new Error('Please select an Anki (.apkg) file.');
        }

        const formData = new FormData();
        formData.append('file', file);
        if (deckName) formData.append('deckName', deckName);
        if (defaultSubjectId) formData.append('subjectId', defaultSubjectId);

        setUploadProgress(50);
        const res = await API.post('/decks/import/anki', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100));
            setUploadProgress(Math.min(90, percent));
          },
        });

        if (res.data?.success) {
          setUploadProgress(100);
          setIsSuccess(true);
          onImportSuccess?.(res.data);
          setTimeout(() => {
            onClose();
          }, 1200);
        } else {
          throw new Error(res.data?.message || 'Import failed.');
        }
      } else {
        // Quizlet import
        let payload;
        let isMultipart = false;
        if (file) {
          payload = new FormData();
          payload.append('file', file);
          if (deckName) payload.append('deckName', deckName);
          if (termSeparator) payload.append('termSeparator', termSeparator);
          if (defaultSubjectId) payload.append('subjectId', defaultSubjectId);
          isMultipart = true;
        } else if (rawText.trim()) {
          payload = {
            text: rawText,
            deckName: deckName || 'Imported Quizlet Deck',
            termSeparator,
            subjectId: defaultSubjectId,
          };
        } else {
          throw new Error('Please enter Quizlet text or select a delimited file.');
        }

        setUploadProgress(60);
        const res = await API.post('/decks/import/quizlet', payload, {
          headers: isMultipart ? { 'Content-Type': 'multipart/form-data' } : {},
        });

        if (res.data?.success) {
          setUploadProgress(100);
          setIsSuccess(true);
          onImportSuccess?.(res.data);
          setTimeout(() => {
            onClose();
          }, 1200);
        } else {
          throw new Error(res.data?.message || 'Import failed.');
        }
      }
    } catch (err) {
      console.error('Import failed:', err);
      setError(err?.response?.data?.message || err.message || 'Import failed. Check format.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100">
              Bi-Directional Deck Importer
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-gray-200 dark:border-slate-700 px-6 pt-3 gap-6 bg-white dark:bg-slate-800">
          <button
            onClick={() => {
              setActiveTab('anki');
              setFile(null);
              setPreviewCards([]);
              setError(null);
            }}
            className={`pb-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'anki'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Anki Package (.apkg)
          </button>
          <button
            onClick={() => {
              setActiveTab('quizlet');
              setFile(null);
              setPreviewCards([]);
              setError(null);
            }}
            className={`pb-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'quizlet'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Quizlet (Delimited / TSV / JSON)
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1">
              Deck Name
            </label>
            <input
              type="text"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="e.g. MCAT Biology & Organic Chemistry"
              className="w-full px-3.5 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-neutral-100 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          {activeTab === 'anki' ? (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-slate-600 hover:border-primary-500 dark:hover:border-primary-400 rounded-xl p-8 text-center cursor-pointer transition-colors bg-gray-50/50 dark:bg-slate-800/40"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".apkg"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="w-10 h-10 text-primary-500 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700 dark:text-neutral-200">
                  {file ? file.name : 'Click or drag & drop Anki .apkg package here'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Preserves SQLite cards, cloze tags, LaTeX formulas ($...$), and audio assets
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Term / Definition Separator
                  </label>
                  <select
                    value={termSeparator}
                    onChange={(e) => {
                      setTermSeparator(e.target.value);
                      parseQuizletPreview(rawText);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-neutral-100 text-sm outline-none"
                  >
                    <option value="	">Tab (\t) - Standard Quizlet Export</option>
                    <option value=",">Comma (,)</option>
                    <option value=" - ">Dash (" - ")</option>
                    <option value=";">Semicolon (;)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                    Paste Exported Text or Upload File
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                  >
                    {file ? `File: ${file.name}` : 'Upload TSV/CSV/JSON file'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.csv,.tsv,.json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
                <textarea
                  rows={4}
                  value={rawText}
                  onChange={handleTextChange}
                  placeholder={`Term 1\tDefinition 1\nTerm 2\tDefinition 2 with {{c1::cloze}}\nTerm 3\tFormula $E=mc^2$`}
                  className="w-full p-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-neutral-100 text-sm font-mono focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              {previewCards.length > 0 && (
                <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3 border border-gray-200 dark:border-slate-700 space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    <span>Parsed Sample ({previewCards.length} cards)</span>
                    {clozeCount > 0 && (
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                        {clozeCount} Cloze Deletion(s) detected
                      </span>
                    )}
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {previewCards.slice(0, 5).map((c, i) => (
                      <div
                        key={i}
                        className="text-xs p-2 bg-white dark:bg-slate-800 rounded border border-gray-200 dark:border-slate-700 flex flex-col gap-0.5"
                      >
                        <span className="font-semibold text-gray-900 dark:text-neutral-100">
                          Q: <MathRenderer text={c.front} />
                        </span>
                        <span className="text-gray-600 dark:text-neutral-300">
                          A: <MathRenderer text={c.back} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Progress bar */}
          {isUploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
                <span>Ingesting cards & packaging media...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-primary-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isSuccess && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg text-sm">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Deck imported successfully! Refreshing...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3 bg-gray-50/50 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-neutral-300 text-sm font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isUploading || isSuccess || (!file && !rawText.trim())}
            className="px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white text-sm font-semibold rounded-lg shadow-sm transition flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              'Start Import'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeckImportModal;
