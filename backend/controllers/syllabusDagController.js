const {
  extractTextFromPDF,
  extractMultiDocumentPDF,
  parseSyllabusHierarchy,
  buildDependencyDAG,
  computeTopicMasteryStates,
  slugify,
} = require('../services/syllabusParserService');
const { Syllabus, SyllabusTopic } = require('../models');

// In-memory persistent DAG registry for active user sessions and rapid retrieval
const syllabusDagStore = new Map();

/**
 * Creates a default standard fallback curriculum DAG when no custom upload exists.
 */
function createDefaultCurriculumDAG(subjectName = 'Computer Science & Mathematics') {
  const defaultTopics = [
    { id: 'cs_basics', label: 'Programming Fundamentals', subject: subjectName, unit: 'Unit 1: Foundations', chapter: 'Basics', estimatedHours: 4 },
    { id: 'math_discrete', label: 'Discrete Mathematics', subject: subjectName, unit: 'Unit 1: Foundations', chapter: 'Logic & Proofs', estimatedHours: 6 },
    { id: 'data_structures', label: 'Linear Data Structures', subject: subjectName, unit: 'Unit 2: Core CS', chapter: 'Lists & Queues', estimatedHours: 8 },
    { id: 'limits', label: 'Limits & Continuity', subject: subjectName, unit: 'Unit 2: Calculus', chapter: 'Real Analysis', estimatedHours: 6 },
    { id: 'derivatives', label: 'Differential Calculus', subject: subjectName, unit: 'Unit 2: Calculus', chapter: 'Derivatives', estimatedHours: 7 },
    { id: 'algorithms', label: 'Sorting & Search Algorithms', subject: subjectName, unit: 'Unit 3: Algorithms', chapter: 'Algorithm Design', estimatedHours: 9 },
    { id: 'integrals', label: 'Integral Calculus', subject: subjectName, unit: 'Unit 3: Calculus', chapter: 'Integrals', estimatedHours: 8 },
    { id: 'graph_algorithms', label: 'Graph Algorithms & Trees', subject: subjectName, unit: 'Unit 4: Advanced CS', chapter: 'Graphs & DAGs', estimatedHours: 10 },
    { id: 'optimization', label: 'Multivariable Optimization', subject: subjectName, unit: 'Unit 4: Calculus', chapter: 'Optimization', estimatedHours: 8 },
    { id: 'machine_learning', label: 'Machine Learning Theory', subject: subjectName, unit: 'Unit 5: AI & Applied', chapter: 'ML Models', estimatedHours: 12 },
  ];

  const defaultEdges = [
    { id: 'cs_basics->data_structures', source: 'cs_basics', target: 'data_structures', relationship: 'PREREQUISITE' },
    { id: 'math_discrete->data_structures', source: 'math_discrete', target: 'data_structures', relationship: 'PREREQUISITE' },
    { id: 'data_structures->algorithms', source: 'data_structures', target: 'algorithms', relationship: 'PREREQUISITE' },
    { id: 'limits->derivatives', source: 'limits', target: 'derivatives', relationship: 'PREREQUISITE' },
    { id: 'derivatives->integrals', source: 'derivatives', target: 'integrals', relationship: 'PREREQUISITE' },
    { id: 'algorithms->graph_algorithms', source: 'algorithms', target: 'graph_algorithms', relationship: 'PREREQUISITE' },
    { id: 'integrals->optimization', source: 'integrals', target: 'optimization', relationship: 'PREREQUISITE' },
    { id: 'graph_algorithms->machine_learning', source: 'graph_algorithms', target: 'machine_learning', relationship: 'PREREQUISITE' },
    { id: 'optimization->machine_learning', source: 'optimization', target: 'machine_learning', relationship: 'PREREQUISITE' },
  ];

  const { updatedNodes, stats } = computeTopicMasteryStates(defaultTopics, defaultEdges, new Set(['cs_basics', 'limits']), new Set(['math_discrete']));

  return {
    syllabusId: 'default-curriculum',
    title: subjectName,
    nodes: updatedNodes,
    edges: defaultEdges,
    completedNodeIds: ['cs_basics', 'limits'],
    inProgressNodeIds: ['math_discrete'],
    topologicalOrder: [
      'cs_basics',
      'math_discrete',
      'limits',
      'data_structures',
      'derivatives',
      'algorithms',
      'integrals',
      'graph_algorithms',
      'optimization',
      'machine_learning',
    ],
    stats,
  };
}

// Seed the default curriculum
syllabusDagStore.set('default-curriculum', createDefaultCurriculumDAG());

/**
 * POST /api/syllabus/upload-pdf
 * Accepts single or multiple PDF documents, parses topic hierarchy, and builds dependency DAG.
 */
async function uploadPdfSyllabus(req, res) {
  try {
    let files = [];
    if (req.files && Array.isArray(req.files)) {
      files = req.files;
    } else if (req.file) {
      files = [req.file];
    }

    let combinedText = '';
    let documentNames = [];

    if (files.length > 0) {
      const extracted = await extractMultiDocumentPDF(files);
      combinedText = extracted.combinedText;
      documentNames = extracted.documents.map(d => d.name);
    } else if (req.body && (req.body.text || req.body.syllabusText)) {
      combinedText = req.body.text || req.body.syllabusText;
      documentNames = ['Provided Text'];
    } else {
      return res.status(400).json({
        success: false,
        error: 'Please upload at least one syllabus PDF file or provide syllabus text.',
      });
    }

    const syllabusTitle = req.body.title || documentNames[0] || 'Uploaded Syllabus Curriculum';
    const parsedTopics = parseSyllabusHierarchy(combinedText, { defaultSubject: syllabusTitle });

    if (parsedTopics.length === 0) {
      return res.status(422).json({
        success: false,
        error: 'Unable to detect structured topics from the uploaded document(s). Please ensure the PDF contains clear syllabus headings.',
      });
    }

    const { nodes, edges, topologicalOrder } = await buildDependencyDAG(parsedTopics);
    const syllabusId = `syl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const { updatedNodes, stats } = computeTopicMasteryStates(nodes, edges, new Set(), new Set());

    const record = {
      syllabusId,
      title: syllabusTitle,
      userId: req.user ? req.user.id : null,
      nodes: updatedNodes,
      edges,
      completedNodeIds: [],
      inProgressNodeIds: [],
      topologicalOrder,
      stats,
      createdAt: new Date().toISOString(),
    };

    syllabusDagStore.set(syllabusId, record);

    return res.status(201).json({
      success: true,
      message: 'Syllabus PDF successfully processed into prerequisite DAG.',
      syllabusId,
      title: syllabusTitle,
      nodes: updatedNodes,
      edges,
      topologicalOrder,
      stats,
    });
  } catch (error) {
    console.error('[syllabusDagController] uploadPdfSyllabus error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to process syllabus PDF upload.',
    });
  }
}

/**
 * GET /api/syllabus/:id/dag
 * Fetches the interactive DAG dependency graph for a syllabus.
 */
async function getSyllabusDag(req, res) {
  try {
    const { id } = req.params;
    let dag = syllabusDagStore.get(id);

    if (!dag) {
      // Check if id is 'default' or if not found, provide seeded default curriculum
      if (id === 'default' || id === 'current' || id === 'default-curriculum') {
        dag = syllabusDagStore.get('default-curriculum');
      } else {
        // Return default curriculum with the requested ID
        dag = {
          ...createDefaultCurriculumDAG(),
          syllabusId: id,
        };
        syllabusDagStore.set(id, dag);
      }
    }

    return res.status(200).json({
      success: true,
      syllabusId: dag.syllabusId,
      title: dag.title,
      nodes: dag.nodes,
      edges: dag.edges,
      topologicalOrder: dag.topologicalOrder,
      stats: dag.stats,
    });
  } catch (error) {
    console.error('[syllabusDagController] getSyllabusDag error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve syllabus dependency graph.',
    });
  }
}

/**
 * PATCH /api/syllabus/node/:id/status or PATCH /api/syllabus/:id/node/:nodeId/status
 * Updates topic completion state and unlocks downstream nodes.
 */
async function updateTopicStatus(req, res) {
  try {
    const topicId = req.params.nodeId || req.params.id || req.body.nodeId || req.body.id;
    const requestedStatus = req.body.status; // 'Mastered', 'In-Progress', 'Locked'
    const isCompleted = req.body.completed === true || requestedStatus === 'Mastered';

    if (!topicId) {
      return res.status(400).json({
        success: false,
        error: 'Topic ID must be specified.',
      });
    }

    // Determine target syllabus DAG
    const syllabusId = req.params.syllabusId || req.body.syllabusId || 'default-curriculum';
    let dag = syllabusDagStore.get(syllabusId) || syllabusDagStore.get('default-curriculum');

    if (!dag) {
      dag = createDefaultCurriculumDAG();
      syllabusDagStore.set('default-curriculum', dag);
    }

    const completedSet = new Set(dag.completedNodeIds || []);
    const inProgressSet = new Set(dag.inProgressNodeIds || []);

    if (isCompleted) {
      completedSet.add(topicId);
      inProgressSet.delete(topicId);
    } else if (requestedStatus === 'In-Progress') {
      completedSet.delete(topicId);
      inProgressSet.add(topicId);
    } else {
      // Locked / Reset
      completedSet.delete(topicId);
      inProgressSet.delete(topicId);
    }

    const { updatedNodes, stats } = computeTopicMasteryStates(dag.nodes, dag.edges, completedSet, inProgressSet);

    dag.nodes = updatedNodes;
    dag.completedNodeIds = Array.from(completedSet);
    dag.inProgressNodeIds = Array.from(inProgressSet);
    dag.stats = stats;
    syllabusDagStore.set(syllabusId, dag);

    const targetNode = updatedNodes.find(n => n.id === topicId) || { id: topicId, status: requestedStatus };

    return res.status(200).json({
      success: true,
      message: `Topic ${topicId} status updated to ${targetNode.status}.`,
      node: targetNode,
      nodes: updatedNodes,
      edges: dag.edges,
      stats,
    });
  } catch (error) {
    console.error('[syllabusDagController] updateTopicStatus error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update topic status.',
    });
  }
}

module.exports = {
  uploadPdfSyllabus,
  getSyllabusDag,
  updateTopicStatus,
  createDefaultCurriculumDAG,
  syllabusDagStore,
};
