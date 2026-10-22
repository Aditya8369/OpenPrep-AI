import React, { useState, useRef, useEffect } from 'react';
import { Download, FileJson, FileText, Database, ChevronDown, Globe, Upload, Headphones } from 'lucide-react';
import API from '../../services/api';
import ExportModal from '../common/ExportModal';
import { buildFlashcardDocument, buildFlashcardChapters, exportHTMLToPDF, exportToEPUB } from '../../utils/exportDocs';
import AudioPodcastPlayerModal from './AudioPodcastPlayerModal';
import DeckImportModal from './DeckImportModal';

const ExportDeckDropdown = ({ subjectId = null, onImported = null }) => {
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [loadingShareState, setLoadingShareState] = useState(false);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [showImportWizardModal, setShowImportWizardModal] = useState(false);
  const [deckTitle, setDeckTitle] = useState('Flashcard Deck');
  const [deckCount, setDeckCount] = useState(0);
  const dropdownRef = useRef(null);

  const [isPodcastPlayerOpen, setIsPodcastPlayerOpen] = useState(false);
  const [podcastEpisode, setPodcastEpisode] = useState(null);
  const [isGeneratingPodcast, setIsGeneratingPodcast] = useState(false);
  const [podcastCards, setPodcastCards] = useState([]);

  const handleListenPodcast = async () => {
    const resolvedSubjectId = subjectId && typeof subjectId === 'object' ? subjectId.id : subjectId;
    if (!resolvedSubjectId) {
      alert('Please select a subject deck to listen to.');
      return;
    }

    setIsOpen(false);
    setIsGeneratingPodcast(true);

    try {
      // Fetch cards for local captions
      const { cards, title } = await fetchDeckCards();
      setPodcastCards(cards);
      setDeckTitle(title);

      // Trigger generation endpoint
      const res = await API.post(`/podcast/decks/${resolvedSubjectId}/generate-podcast`);
      if (res.data?.success) {
        setPodcastEpisode(res.data.data);
        setIsPodcastPlayerOpen(true);
      }
    } catch (err) {
      console.error('Failed to generate study podcast:', err);
      alert(err?.response?.data?.error || 'Failed to generate revision podcast.');
    } finally {
      setIsGeneratingPodcast(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch current share state of subject/deck on mount or when dropdown opens
  const fetchShareState = async () => {
    const resolvedSubjectId = subjectId && typeof subjectId === 'object' ? subjectId.id : subjectId;
    if (!resolvedSubjectId) return;
    try {
      const res = await API.get('/subjects'); // list all subjects
      if (res.data?.success) {
        const currentSubject = res.data.data.find(s => s.id === resolvedSubjectId);
        if (currentSubject) {
          setIsPublic(currentSubject.isPublic || false);
        }
      }
    } catch (err) {
      console.error('Failed to fetch subject share state:', err);
    }
  };

  useEffect(() => {
    if (subjectId) {
      fetchShareState();
    }
  }, [subjectId]);

  const handleExport = async (format) => {
    const resolvedSubjectId = subjectId && typeof subjectId === 'object' ? subjectId.id : subjectId;
    setIsOpen(false);
    setIsExporting(true);
    try {
      const query = resolvedSubjectId ? `?subjectId=${resolvedSubjectId}&format=${format}` : `?format=${format}`;
      const response = await API.get(`/flashcards/export${query}`, {
        responseType: format === 'json' ? 'json' : 'blob',
      });
      
      let blob;
      if (format === 'json') {
        const jsonString = JSON.stringify(response.data, null, 2);
        blob = new Blob([jsonString], { type: 'application/json' });
      } else {
        blob = new Blob([response.data]);
      }
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `flashcards.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error('Failed to export flashcards:', err);
      alert('Failed to export flashcards');
    } finally {
      setIsExporting(false);
    }
  };

  // Fetch the deck (optionally subject-scoped) as JSON so it can be rebuilt
  // into a formatted PDF/EPUB document on the client.
  const fetchDeckCards = async () => {
    const resolvedSubjectId = subjectId && typeof subjectId === 'object' ? subjectId.id : subjectId;
    const params = { format: 'json' };
    if (resolvedSubjectId) params.subjectId = resolvedSubjectId;

    const res = await API.get('/flashcards/export', { params });
    const cards = res.data?.data || [];
    let title = 'Flashcard Deck';
    if (resolvedSubjectId) {
      try {
        const subjectsRes = await API.get('/subjects');
        const found = (subjectsRes.data?.data || []).find((s) => s.id === resolvedSubjectId);
        if (found) title = found.name;
      } catch {
        // Keep the generic title if the subject lookup fails
      }
    }
    return { cards, title };
  };

  const openFormattedExport = async () => {
    setIsOpen(false);
    setIsExporting(true);
    try {
      const { cards, title } = await fetchDeckCards();
      setDeckTitle(title);
      setDeckCount(cards.length);
      setShowFormatModal(true);
    } catch (err) {
      console.error('Failed to load deck for export:', err);
      alert('Failed to load flashcards for export.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFormattedExport = async ({ format, layout, includeAnswerKey }) => {
    const { cards, title } = await fetchDeckCards();
    const baseName =
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'flashcards';

    if (format === 'pdf') {
      const html = buildFlashcardDocument({ cards, layout, includeAnswerKey, title });
      await exportHTMLToPDF(html, `openprep-${baseName}.pdf`);
    } else {
      const chapters = buildFlashcardChapters({ cards, layout, includeAnswerKey, title });
      await exportToEPUB({ title, chapters, filename: `openprep-${baseName}.epub` });
    }
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file later
    const resolvedSubjectId = subjectId && typeof subjectId === 'object' ? subjectId.id : subjectId;
    if (!file || !resolvedSubjectId) return;

    setIsOpen(false);
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await API.post(`/flashcards/import?subjectId=${resolvedSubjectId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { imported = 0, skipped = 0 } = res.data || {};
      alert(
        skipped > 0
          ? `Imported ${imported} card(s). Skipped ${skipped} invalid row(s).`
          : `Imported ${imported} card(s) successfully.`
      );
      onImported?.(imported);
    } catch (err) {
      console.error('Failed to import flashcards:', err);
      alert(err?.response?.data?.error || 'Failed to import flashcards. Check the file format and try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleToggleShare = async () => {
    const resolvedSubjectId = subjectId && typeof subjectId === 'object' ? subjectId.id : subjectId;
    if (!resolvedSubjectId) return;
    setLoadingShareState(true);
    try {
      const targetState = !isPublic;
      const res = await API.put(`/flashcards/decks/${resolvedSubjectId}/share`, { isPublic: targetState });
      if (res.data?.success) {
        setIsPublic(targetState);
        alert(targetState 
          ? 'Deck successfully published to the Community Marketplace! Summary tags have been generated by AI.' 
          : 'Deck successfully removed from the Community Marketplace.'
        );
      }
    } catch (err) {
      console.error('Failed to toggle deck sharing:', err);
      const errMsg = err.response?.data?.error || 'Failed to share deck. Make sure the deck is not empty.';
      alert(errMsg);
    } finally {
      setLoadingShareState(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        className="inline-flex justify-center items-center w-full rounded-lg border border-gray-300 dark:border-slate-700 shadow-sm px-4 py-2 bg-white dark:bg-slate-800 text-sm font-medium text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting || isImporting}
      >
        <Download className="w-4 h-4 mr-2" />
        {isExporting ? 'Exporting...' : isImporting ? 'Importing...' : 'Deck Actions'}
        <ChevronDown className="w-4 h-4 ml-2" />
      </button>
      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-52 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 dark:ring-slate-700 z-50 overflow-hidden">
          <div className="py-1 border-b border-gray-100 dark:border-slate-700">
            <div className="px-4 py-1.5 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
              Download Deck
            </div>
            <button
              onClick={() => handleExport('csv')}
              className="group flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-neutral-200 dark:hover:bg-slate-700"
            >
              <FileText className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />
              Plain CSV
            </button>
            <button
              onClick={() => handleExport('json')}
              className="group flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-neutral-200 dark:hover:bg-slate-700"
            >
              <FileJson className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />
              Structured JSON
            </button>
            <button
              onClick={() => handleExport('apkg')}
              className="group flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-neutral-200 dark:hover:bg-slate-700"
            >
              <Database className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />
              Anki (.apkg)
            </button>
            <button
              onClick={openFormattedExport}
              className="group flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-neutral-200 dark:hover:bg-slate-700"
            >
              <FileText className="mr-3 h-4 w-4 text-primary-500 group-hover:text-primary-600" />
              Formatted PDF / EPUB
            </button>
          </div>

          {subjectId && (
            <div className="py-1 border-b border-gray-100 dark:border-slate-700">
              <div className="px-4 py-1.5 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                Import Deck
              </div>
              <button
                onClick={() => importInputRef.current?.click()}
                disabled={isImporting}
                className="group flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-neutral-200 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                <Upload className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />
                {isImporting ? 'Importing...' : 'Import CSV / Anki CSV'}
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleImportFile}
                className="hidden"
              />
            </div>
          )}

          {subjectId && (
            <div className="py-1 border-b border-gray-100 dark:border-slate-700">
              <div className="px-4 py-1.5 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                Audio Revision
              </div>
              <button
                onClick={handleListenPodcast}
                disabled={isGeneratingPodcast}
                className="group flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-neutral-200 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                <Headphones className="mr-3 h-4 w-4 text-indigo-500 group-hover:text-indigo-600" />
                {isGeneratingPodcast ? 'Stitching Audio...' : 'Listen as Podcast'}
              </button>
            </div>
          )}

          {subjectId && (
            <div className="py-1">
              <div className="px-4 py-1.5 text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                Collaboration
              </div>
              <button
                onClick={handleToggleShare}
                disabled={loadingShareState}
                className="group flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-neutral-200 dark:hover:bg-slate-700 text-left"
              >
                <Globe className={`mr-3 h-4 w-4 ${isPublic ? 'text-green-500 animate-pulse' : 'text-gray-400 group-hover:text-gray-500'}`} />
                {loadingShareState ? 'Updating...' : isPublic ? 'Unpublish From Market' : 'Publish to Market'}
              </button>
            </div>
          )}
        </div>
      )}

      <ExportModal
        isOpen={showFormatModal}
        onClose={() => setShowFormatModal(false)}
        contentType="flashcards"
        title={`Export ${deckTitle}`}
        itemCount={deckCount}
        onExport={handleFormattedExport}
      />

      <DeckImportModal
        isOpen={showImportWizardModal}
        onClose={() => setShowImportWizardModal(false)}
        defaultSubjectId={typeof subjectId === 'object' ? subjectId?.id : subjectId}
        onImportSuccess={() => {
          onImported?.();
        }}
      />

      <AudioPodcastPlayerModal
        isOpen={isPodcastPlayerOpen}
        onClose={() => setIsPodcastPlayerOpen(false)}
        episodeData={podcastEpisode}
        subjectName={deckTitle}
        flashcards={podcastCards}
      />
    </div>
  );
};

export default ExportDeckDropdown;
