import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Lock,
  Play,
  CheckCircle2,
  Clock,
  Sparkles,
  UploadCloud,
  FileText,
  Search,
  Filter,
  Layers,
  ChevronRight,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import API from '../../services/api';

/**
 * Custom Node representing an academic syllabus topic in the DAG.
 */
const CustomTopicNode = ({ data, id }) => {
  const {
    label,
    subject,
    unit,
    chapter,
    estimatedHours = 4,
    status = 'In-Progress',
    masteryPercentage = 0,
    missingPrerequisites = [],
    onToggleStatus,
    onGenerateQuiz,
  } = data;

  const isLocked = status === 'Locked';
  const isMastered = status === 'Mastered';
  const isInProgress = status === 'In-Progress';

  return (
    <div
      data-testid={`dag-node-${id}`}
      className={`relative w-64 rounded-xl p-3.5 transition-all duration-300 shadow-md ${
        isMastered
          ? 'bg-emerald-950/80 border-2 border-emerald-500/80 text-emerald-100 shadow-emerald-900/30'
          : isInProgress
          ? 'bg-indigo-950/90 border-2 border-indigo-400 text-indigo-100 shadow-indigo-900/40 ring-2 ring-indigo-500/30 animate-pulse-subtle'
          : 'bg-slate-900/90 border border-slate-700/80 text-slate-400 opacity-75'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={`!w-3 !h-3 !rounded-full !border-2 ${
          isMastered
            ? '!bg-emerald-400 !border-emerald-700'
            : isInProgress
            ? '!bg-indigo-400 !border-indigo-700'
            : '!bg-slate-600 !border-slate-800'
        }`}
      />

      {/* Header Badges */}
      <div className="flex items-center justify-between gap-1.5 mb-2 text-xs">
        <span className="truncate font-semibold px-2 py-0.5 rounded-full bg-black/40 text-slate-300 max-w-[130px]">
          {unit || subject || 'Core Unit'}
        </span>
        <div className="flex items-center gap-1 font-mono">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>{estimatedHours}h</span>
        </div>
      </div>

      {/* Node Title & Status Icon */}
      <div className="flex items-start gap-2 mb-2.5">
        <div className="mt-0.5">
          {isMastered && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
          {isInProgress && <Play className="w-5 h-5 text-indigo-400 flex-shrink-0 fill-indigo-400/30" />}
          {isLocked && <Lock className="w-5 h-5 text-slate-500 flex-shrink-0" />}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold leading-tight line-clamp-2 text-white">
            {label}
          </h4>
          {chapter && (
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {chapter}
            </p>
          )}
        </div>
      </div>

      {/* Mastery Progress Bar */}
      <div className="w-full bg-black/40 rounded-full h-1.5 mb-3 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            isMastered
              ? 'bg-emerald-500'
              : isInProgress
              ? 'bg-indigo-500'
              : 'bg-slate-700'
          }`}
          style={{ width: `${isMastered ? 100 : isInProgress ? (masteryPercentage || 30) : 0}%` }}
        />
      </div>

      {/* Missing Prerequisites Warning */}
      {isLocked && missingPrerequisites.length > 0 && (
        <div className="mb-2.5 px-2 py-1 rounded bg-amber-950/40 border border-amber-800/40 text-[10px] text-amber-300 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">Prerequisites incomplete</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-white/10">
        <button
          type="button"
          onClick={() => onToggleStatus && onToggleStatus(id, isMastered ? 'In-Progress' : 'Mastered')}
          className={`flex-1 py-1 px-2 rounded text-[11px] font-medium transition-colors ${
            isMastered
              ? 'bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200'
              : isInProgress
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
          }`}
        >
          {isMastered ? 'Mastered' : isLocked ? 'Locked' : 'Complete'}
        </button>

        <button
          type="button"
          title="Generate Quiz for this Topic"
          onClick={() => onGenerateQuiz && onGenerateQuiz(data)}
          disabled={isLocked}
          className={`p-1 rounded text-[11px] flex items-center justify-center transition-colors ${
            isLocked
              ? 'text-slate-600 cursor-not-allowed'
              : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className={`!w-3 !h-3 !rounded-full !border-2 ${
          isMastered
            ? '!bg-emerald-400 !border-emerald-700'
            : isInProgress
            ? '!bg-indigo-400 !border-indigo-700'
            : '!bg-slate-600 !border-slate-800'
        }`}
      />
    </div>
  );
};

const nodeTypes = {
  customTopic: CustomTopicNode,
};

/**
 * Calculates responsive DAG layout coordinates using topological layers.
 */
function layoutDagNodes(rawNodes, edges) {
  if (!rawNodes || rawNodes.length === 0) return [];

  const inDegree = new Map();
  const childrenMap = new Map();

  rawNodes.forEach(n => {
    inDegree.set(n.id, 0);
    childrenMap.set(n.id, []);
  });

  edges.forEach(e => {
    if (inDegree.has(e.target)) {
      inDegree.set(e.target, inDegree.get(e.target) + 1);
    }
    if (childrenMap.has(e.source)) {
      childrenMap.get(e.source).push(e.target);
    }
  });

  // Assign layers via Longest Path from roots
  const layers = new Map();
  const queue = [];

  rawNodes.forEach(n => {
    if (inDegree.get(n.id) === 0) {
      layers.set(n.id, 0);
      queue.push(n.id);
    }
  });

  while (queue.length > 0) {
    const u = queue.shift();
    const currentLayer = layers.get(u) || 0;
    const children = childrenMap.get(u) || [];

    for (const v of children) {
      const nextLayer = Math.max(layers.get(v) || 0, currentLayer + 1);
      layers.set(v, nextLayer);
      queue.push(v);
    }
  }

  // Group nodes by layer
  const layerGroups = new Map();
  rawNodes.forEach(n => {
    const l = layers.get(n.id) || 0;
    if (!layerGroups.has(l)) layerGroups.set(l, []);
    layerGroups.get(l).push(n);
  });

  const layouted = [];
  const X_SPACING = 300;
  const Y_SPACING = 210;

  layerGroups.forEach((groupNodes, layerIndex) => {
    const totalWidth = (groupNodes.length - 1) * X_SPACING;
    const startX = -totalWidth / 2 + 350;

    groupNodes.forEach((node, nodeIndex) => {
      layouted.push({
        id: node.id,
        type: 'customTopic',
        position: {
          x: startX + nodeIndex * X_SPACING,
          y: layerIndex * Y_SPACING + 40,
        },
        data: node,
      });
    });
  });

  return layouted;
}

export default function SyllabusGraphViewer({
  syllabusId = 'default-curriculum',
  onGenerateQuiz = null,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rawGraphData, setRawGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadText, setUploadText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('canvas'); // 'canvas' | 'sequence'

  /**
   * Fetches the DAG dependency graph from the backend.
   */
  const fetchDAG = useCallback(async (targetId = syllabusId) => {
    setLoading(true);
    try {
      const res = await API.get(`/syllabus/${targetId}/dag`);
      if (res.data?.success) {
        setRawGraphData(res.data);
      }
    } catch (err) {
      console.warn('Could not fetch syllabus DAG from API, using default curriculum:', err.message);
      // Fallback dummy data if backend is offline or during testing
      setRawGraphData({
        syllabusId: 'default-curriculum',
        title: 'Foundational Computer Science & Mathematics',
        nodes: [
          { id: 'math_basics', label: 'Functions & Relations', subject: 'Mathematics', unit: 'Unit 1: Foundations', chapter: 'Algebra', estimatedHours: 4, status: 'Mastered', masteryPercentage: 100 },
          { id: 'limits', label: 'Limits & Continuity', subject: 'Mathematics', unit: 'Unit 2: Calculus', chapter: 'Calculus I', estimatedHours: 6, status: 'Mastered', masteryPercentage: 100 },
          { id: 'derivatives', label: 'Differential Calculus', subject: 'Mathematics', unit: 'Unit 2: Calculus', chapter: 'Calculus I', estimatedHours: 7, status: 'In-Progress', masteryPercentage: 40 },
          { id: 'integrals', label: 'Integral Calculus', subject: 'Mathematics', unit: 'Unit 3: Calculus', chapter: 'Calculus II', estimatedHours: 8, status: 'Locked', missingPrerequisites: ['derivatives'] },
          { id: 'cs_intro', label: 'Programming Logic', subject: 'Computer Science', unit: 'Unit 1: Coding', chapter: 'Basics', estimatedHours: 5, status: 'Mastered', masteryPercentage: 100 },
          { id: 'data_structures', label: 'Data Structures', subject: 'Computer Science', unit: 'Unit 2: Coding', chapter: 'Core CS', estimatedHours: 8, status: 'In-Progress', masteryPercentage: 30 },
          { id: 'algorithms', label: 'Algorithms & Complexity', subject: 'Computer Science', unit: 'Unit 3: Coding', chapter: 'Algorithms', estimatedHours: 10, status: 'Locked', missingPrerequisites: ['data_structures'] },
        ],
        edges: [
          { id: 'math_basics->limits', source: 'math_basics', target: 'limits', relationship: 'PREREQUISITE' },
          { id: 'limits->derivatives', source: 'limits', target: 'derivatives', relationship: 'PREREQUISITE' },
          { id: 'derivatives->integrals', source: 'derivatives', target: 'integrals', relationship: 'PREREQUISITE' },
          { id: 'cs_intro->data_structures', source: 'cs_intro', target: 'data_structures', relationship: 'PREREQUISITE' },
          { id: 'data_structures->algorithms', source: 'data_structures', target: 'algorithms', relationship: 'PREREQUISITE' },
        ],
        topologicalOrder: ['math_basics', 'cs_intro', 'limits', 'derivatives', 'data_structures', 'integrals', 'algorithms'],
        stats: {
          totalTopics: 7,
          masteredCount: 3,
          inProgressCount: 2,
          lockedCount: 2,
          completionPercentage: 43,
          totalHours: 48,
          completedHours: 15,
        },
      });
    } finally {
      setLoading(false);
    }
  }, [syllabusId]);

  useEffect(() => {
    fetchDAG();
  }, [fetchDAG]);

  /**
   * Toggles topic completion status and dynamically unlocks downstream nodes.
   */
  const handleToggleStatus = useCallback(async (nodeId, newStatus) => {
    try {
      const res = await API.patch(`/syllabus/node/${nodeId}/status`, {
        status: newStatus,
        completed: newStatus === 'Mastered',
        syllabusId: rawGraphData?.syllabusId || syllabusId,
      });

      if (res.data?.success && res.data.nodes) {
        setRawGraphData(prev => ({
          ...prev,
          nodes: res.data.nodes,
          stats: res.data.stats,
        }));
      }
    } catch (err) {
      console.warn('Status update API call failed, updating local state:', err.message);
      // Local reactive fallback
      setRawGraphData(prev => {
        if (!prev) return prev;
        const target = prev.nodes.find(n => n.id === nodeId);
        if (!target) return prev;
        const nextStatus = newStatus || (target.status === 'Mastered' ? 'In-Progress' : 'Mastered');

        const updatedNodes = prev.nodes.map(n => {
          if (n.id === nodeId) {
            return {
              ...n,
              status: nextStatus,
              masteryPercentage: nextStatus === 'Mastered' ? 100 : 50,
            };
          }
          return n;
        });

        return {
          ...prev,
          nodes: updatedNodes,
        };
      });
    }
  }, [rawGraphData?.syllabusId, syllabusId]);

  /**
   * Handles quiz generation trigger for a topic node.
   */
  const handleQuizTrigger = useCallback((topicData) => {
    if (onGenerateQuiz) {
      onGenerateQuiz(topicData);
    } else {
      alert(`Generating practice quiz for topic: ${topicData.label} (${topicData.unit || topicData.subject})`);
    }
  }, [onGenerateQuiz]);

  /**
   * Uploads single or multi-part syllabus PDF documents.
   */
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (uploadFiles.length === 0 && !uploadText.trim()) return;

    setUploading(true);
    try {
      const formData = new FormData();
      uploadFiles.forEach(file => {
        formData.append('pdf', file);
      });
      if (uploadText.trim()) {
        formData.append('text', uploadText);
      }

      const res = await API.post('/syllabus/upload-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        setRawGraphData(res.data);
        setShowUploadModal(false);
        setUploadFiles([]);
        setUploadText('');
      }
    } catch (err) {
      console.error('PDF syllabus upload failed:', err);
      alert(err.response?.data?.error || 'Failed to upload syllabus PDF.');
    } finally {
      setUploading(false);
    }
  };

  // Derive subjects list
  const subjects = useMemo(() => {
    if (!rawGraphData?.nodes) return ['All'];
    const set = new Set(rawGraphData.nodes.map(n => n.subject).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [rawGraphData]);

  // Filter and format nodes/edges for React Flow
  useEffect(() => {
    if (!rawGraphData?.nodes) return;

    let filtered = rawGraphData.nodes;
    if (selectedSubject !== 'All') {
      filtered = filtered.filter(n => n.subject === selectedSubject);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(n =>
        n.label.toLowerCase().includes(q) ||
        (n.unit && n.unit.toLowerCase().includes(q))
      );
    }

    const nodeDataList = filtered.map(node => ({
      ...node,
      onToggleStatus: handleToggleStatus,
      onGenerateQuiz: handleQuizTrigger,
    }));

    const layouted = layoutDagNodes(nodeDataList, rawGraphData.edges || []);
    setNodes(layouted);

    const formattedEdges = (rawGraphData.edges || []).map(edge => {
      const sourceNode = rawGraphData.nodes.find(n => n.id === edge.source);
      const isCompleteEdge = sourceNode?.status === 'Mastered';

      return {
        id: edge.id || `${edge.source}->${edge.target}`,
        source: edge.source,
        target: edge.target,
        animated: !isCompleteEdge,
        style: {
          stroke: isCompleteEdge ? '#10b981' : '#6366f1',
          strokeWidth: 2,
        },
      };
    });

    setEdges(formattedEdges);
  }, [rawGraphData, selectedSubject, searchQuery, handleToggleStatus, handleQuizTrigger, setNodes, setEdges]);

  const stats = rawGraphData?.stats || {
    totalTopics: 0,
    masteredCount: 0,
    inProgressCount: 0,
    lockedCount: 0,
    completionPercentage: 0,
    totalHours: 0,
  };

  return (
    <div className="w-full flex flex-col bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden min-h-[650px]">
      {/* Top Navigation & Status Bar */}
      <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              {rawGraphData?.title || 'Syllabus Topic Prerequisite DAG'}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            AI-extracted topic dependencies, unlock paths, and mastery sequencing
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Syllabus PDF</span>
          </button>

          <button
            type="button"
            onClick={() => fetchDAG()}
            title="Refresh graph"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Progress & Stat Cards Bar */}
      <div className="px-6 py-3 bg-slate-900/40 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Mastery:</span>
            <span className="font-bold text-emerald-400 text-sm">{stats.completionPercentage}%</span>
            <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${stats.completionPercentage}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 text-slate-300">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>{stats.masteredCount} Mastered</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
              <span>{stats.inProgressCount} In-Progress</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              <span>{stats.lockedCount} Locked</span>
            </span>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('canvas')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'canvas' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            DAG Graph
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sequence')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'sequence' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Study Sequence
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 py-2.5 bg-slate-900/60 border-b border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Subject Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-xl">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1 flex-shrink-0" />
          {subjects.map(subj => (
            <button
              key={subj}
              type="button"
              onClick={() => setSelectedSubject(subj)}
              className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
                selectedSubject === subj
                  ? 'bg-slate-800 text-white font-medium border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {subj}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-56">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search topic or unit..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative w-full h-[520px]">
        {activeTab === 'canvas' ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.2}
            maxZoom={1.5}
            className="bg-slate-950"
          >
            <Background color="#334155" gap={20} size={1} />
            <Controls className="!bg-slate-900 !border-slate-800 !fill-white" />
            <MiniMap
              nodeColor={node => {
                const status = node.data?.status;
                if (status === 'Mastered') return '#10b981';
                if (status === 'In-Progress') return '#6366f1';
                return '#475569';
              }}
              className="!bg-slate-900 !border !border-slate-800 !rounded-lg overflow-hidden"
            />
          </ReactFlow>
        ) : (
          /* Recommended Study Sequence Tab */
          <div className="p-6 h-full overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-3">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <span>Recommended Learning Sequence (Topological Order)</span>
              </h3>
              {(rawGraphData?.topologicalOrder || []).map((nodeId, idx) => {
                const topic = rawGraphData.nodes.find(n => n.id === nodeId);
                if (!topic) return null;
                const isMastered = topic.status === 'Mastered';
                const isInProgress = topic.status === 'In-Progress';

                return (
                  <div
                    key={nodeId}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                      isMastered
                        ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-100'
                        : isInProgress
                        ? 'bg-indigo-950/40 border-indigo-700/60 text-indigo-100 shadow-md shadow-indigo-950'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold bg-white/10">
                        {idx + 1}
                      </span>
                      <div>
                        <h4 className="text-sm font-semibold text-white">{topic.label}</h4>
                        <p className="text-xs text-slate-400">{topic.unit} • {topic.estimatedHours || 4}h</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(nodeId, isMastered ? 'In-Progress' : 'Mastered')}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          isMastered
                            ? 'bg-emerald-800 text-emerald-100'
                            : isInProgress
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isMastered ? 'Done' : 'Mark Complete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuizTrigger(topic)}
                        className="p-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                        title="Generate Quiz"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Multi-Document PDF Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-indigo-400" />
              <span>Upload Syllabus Documents (Multi-part PDF)</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Upload monolithic or multi-volume syllabus PDFs (e.g. Part 1, Part 2, Lab syllabus). AI will extract topics and construct a prerequisite DAG.
            </p>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Select Syllabus PDF(s)
                </label>
                <input
                  type="file"
                  multiple
                  accept="application/pdf"
                  onChange={e => setUploadFiles(Array.from(e.target.files || []))}
                  className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Or Paste Syllabus Text
                </label>
                <textarea
                  rows={4}
                  placeholder="Paste syllabus text, course outline, or curriculum breakdown..."
                  value={uploadText}
                  onChange={e => setUploadText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || (uploadFiles.length === 0 && !uploadText.trim())}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold"
                >
                  {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{uploading ? 'Processing AI DAG...' : 'Extract & Build DAG'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
