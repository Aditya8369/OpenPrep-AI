const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Syllabus Parser & Topic Prerequisite DAG Dependency Graph Service
 * Multi-document ingestion, hierarchical extraction, topological sort, cycle-breaking,
 * and dynamic mastery progression.
 */

// Initialize Gemini API client
const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;
if (apiKey && apiKey !== 'your_gemini_api_key_here') {
  genAI = new GoogleGenerativeAI(apiKey);
}

/**
 * Extracts plain text from a single PDF Buffer.
 * @param {Buffer} buffer 
 * @returns {Promise<{ extractedText: string, numPages: number, wordCount: number }>}
 */
async function extractTextFromPDF(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('A valid PDF buffer must be provided.');
  }

  try {
    const parsed = await pdfParse(buffer);
    const extractedText = (parsed.text || '').trim();
    const numPages = parsed.numpages || 1;
    const wordCount = extractedText ? extractedText.split(/\s+/).filter(Boolean).length : 0;

    return {
      extractedText,
      numPages,
      wordCount,
    };
  } catch (error) {
    console.error('[syllabusParserService] PDF extraction failed:', error.message);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Extracts plain text across multiple PDF buffers and concatenates with section boundaries.
 * @param {Array<{ buffer: Buffer, originalname?: string }>} files 
 * @returns {Promise<{ combinedText: string, documents: Array<{ name: string, pageCount: number, wordCount: number }> }>}
 */
async function extractMultiDocumentPDF(files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('Files array must contain at least one PDF file.');
  }

  const documents = [];
  const textParts = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const buffer = file.buffer || file;
    const name = file.originalname || `Document_${i + 1}.pdf`;

    const result = await extractTextFromPDF(buffer);
    documents.push({
      name,
      pageCount: result.numPages,
      wordCount: result.wordCount,
    });

    textParts.push(`\n=== DOCUMENT: ${name} ===\n${result.extractedText}`);
  }

  return {
    combinedText: textParts.join('\n\n'),
    documents,
  };
}

/**
 * Converts a string into a standardized slug identifier.
 * @param {string} str 
 * @returns {string}
 */
function slugify(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100) || `topic_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Parses raw syllabus text into structured hierarchical topic entries.
 * Regex heading detectors identify: Subject -> Unit -> Chapter -> Subtopic.
 * 
 * @param {string} text 
 * @param {object} [options]
 * @returns {Array<{ id: string, label: string, subject: string, unit: string, chapter: string, estimatedHours: number }>}
 */
function parseSyllabusHierarchy(text, options = {}) {
  const defaultSubject = options.defaultSubject || 'General Studies';
  if (!text || typeof text !== 'string') {
    return [];
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const topics = [];

  let currentSubject = defaultSubject;
  let currentUnit = 'Foundational Concepts';
  let currentChapter = 'Core Topics';

  const subjectRegex = /^(?:subject|course|curriculum|program)[\s:-]+(.*)$/i;
  const unitRegex = /^(?:unit|module|part)\s*([0-9ivxldcm.-]+)?[\s:-]+(.*)$/i;
  const chapterRegex = /^(?:chapter|section)\s*([0-9ivxldcm.-]+)?[\s:-]+(.*)$/i;
  const numberedTopicRegex = /^(\d+(?:\.\d+)+)\s+(.*)$/;
  const bulletTopicRegex = /^[-*•▪]\s*(.+)$/;

  for (const line of lines) {
    const subjectMatch = line.match(subjectRegex);
    if (subjectMatch && subjectMatch[1].trim().length > 2) {
      currentSubject = subjectMatch[1].trim();
      continue;
    }

    const unitMatch = line.match(unitRegex);
    if (unitMatch) {
      const uPrefix = unitMatch[1] ? `Unit ${unitMatch[1]}: ` : '';
      currentUnit = `${uPrefix}${unitMatch[2]}`.trim();
      continue;
    }

    const chapterMatch = line.match(chapterRegex);
    if (chapterMatch) {
      const cPrefix = chapterMatch[1] ? `Chapter ${chapterMatch[1]}: ` : '';
      currentChapter = `${cPrefix}${chapterMatch[2]}`.trim();
      continue;
    }

    let topicTitle = '';
    const numMatch = line.match(numberedTopicRegex);
    if (numMatch) {
      topicTitle = numMatch[2].trim();
    } else {
      const bulletMatch = line.match(bulletTopicRegex);
      if (bulletMatch) {
        topicTitle = bulletMatch[1].trim();
      }
    }

    // Clean page numbers or trailing syllabus artifacts
    topicTitle = topicTitle.replace(/(?:[.\s_-]+(?:page|p\.?)?\s*\d+|\s*\(\d+\s*(?:hrs?|hours?|marks?)\))$/i, '').trim();

    if (topicTitle && topicTitle.length >= 3 && topicTitle.length <= 120) {
      const subjectPrefix = (currentSubject || 'subj').slice(0, 15);
      const unitPrefix = (currentUnit || 'unit').slice(0, 15);
      const id = slugify(`${subjectPrefix}_${unitPrefix}_${topicTitle}`);
      // Deduplicate if already present
      if (!topics.some(t => t.id === id || t.label.toLowerCase() === topicTitle.toLowerCase())) {
        topics.push({
          id,
          label: topicTitle,
          subject: currentSubject,
          unit: currentUnit,
          chapter: currentChapter,
          estimatedHours: estimateHoursForTopic(topicTitle),
        });
      }
    }
  }

  // Fallback if no structured bullet points were detected (e.g. paragraph text)
  if (topics.length === 0) {
    const sentenceList = text
      .split(/[.;\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 5 && s.length < 80);

    const sample = sentenceList.slice(0, 15);
    sample.forEach((sent, idx) => {
      const label = sent.replace(/^[\d.-]+/, '').trim();
      if (label.length > 3) {
        topics.push({
          id: slugify(`${(currentSubject || 'subj').slice(0, 15)}_topic_${idx + 1}_${label}`),
          label,
          subject: currentSubject,
          unit: currentUnit,
          chapter: currentChapter,
          estimatedHours: 4,
        });
      }
    });
  }

  return topics;
}

/**
 * Provides an hour estimate based on topic terminology complexity.
 */
function estimateHoursForTopic(title) {
  const lower = title.toLowerCase();
  if (lower.includes('advanced') || lower.includes('differential') || lower.includes('quantum') || lower.includes('architecture')) {
    return 8;
  }
  if (lower.includes('introduction') || lower.includes('basics') || lower.includes('overview') || lower.includes('syntax')) {
    return 3;
  }
  return 5;
}

/**
 * Validates cycle freedom using Kahn's algorithm and topological sort.
 * If cycles are found, breaks them by identifying feedback edges to ensure valid DAG.
 * 
 * @param {Array<{ id: string }>} nodes 
 * @param {Array<{ source: string, target: string, relationship?: string }>} edges 
 * @returns {{ isValidDAG: boolean, topologicalOrder: string[], cycles: Array<string[]>, prunedEdges: Array<{ source: string, target: string }> }}
 */
function validateAndSortDAG(nodes, edges) {
  const nodeIds = new Set(nodes.map(n => n.id));
  let validEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target) && e.source !== e.target);

  // Compute in-degree & adjacency list
  const inDegree = new Map();
  const adj = new Map();

  nodes.forEach(n => {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  });

  validEdges.forEach(e => {
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    adj.get(e.source).push(e.target);
  });

  const queue = [];
  nodes.forEach(n => {
    if (inDegree.get(n.id) === 0) {
      queue.push(n.id);
    }
  });

  const topologicalOrder = [];
  const inDegreeCopy = new Map(inDegree);

  while (queue.length > 0) {
    const u = queue.shift();
    topologicalOrder.push(u);

    const neighbors = adj.get(u) || [];
    for (const v of neighbors) {
      inDegreeCopy.set(v, inDegreeCopy.get(v) - 1);
      if (inDegreeCopy.get(v) === 0) {
        queue.push(v);
      }
    }
  }

  // If all nodes are visited, graph is a valid DAG
  if (topologicalOrder.length === nodes.length) {
    return {
      isValidDAG: true,
      topologicalOrder,
      cycles: [],
      prunedEdges: [],
    };
  }

  // Graph has cycles. Detect cycles and prune offending backward edges
  const cycles = [];
  const visited = new Map(); // 0: unvisited, 1: visiting (in stack), 2: visited
  const cycleEdgesToRemove = new Set();

  nodes.forEach(n => visited.set(n.id, 0));

  function dfs(u) {
    visited.set(u, 1);
    const neighbors = adj.get(u) || [];

    for (const v of neighbors) {
      if (visited.get(v) === 1) {
        // Detected back-edge u -> v causing cycle!
        cycles.push([v, u]);
        cycleEdgesToRemove.add(`${u}->${v}`);
      } else if (visited.get(v) === 0) {
        dfs(v);
      }
    }
    visited.set(u, 2);
  }

  nodes.forEach(n => {
    if (visited.get(n.id) === 0) {
      dfs(n.id);
    }
  });

  // Prune cyclic edges to enforce valid DAG
  const prunedEdges = [];
  const cleanedEdges = validEdges.filter(e => {
    const key = `${e.source}->${e.target}`;
    if (cycleEdgesToRemove.has(key)) {
      prunedEdges.push(e);
      return false;
    }
    return true;
  });

  // Re-run Kahn's sort on pruned graph
  const secondPass = validateAndSortDAG(nodes, cleanedEdges);

  // In case isolated subgraphs remained, append any unvisited nodes
  const visitedIds = new Set(secondPass.topologicalOrder);
  nodes.forEach(n => {
    if (!visitedIds.has(n.id)) {
      secondPass.topologicalOrder.push(n.id);
    }
  });

  return {
    isValidDAG: false,
    topologicalOrder: secondPass.topologicalOrder,
    cycles,
    prunedEdges,
  };
}

/**
 * Builds dependency relationships using standard academic prerequisite rules,
 * sequential unit progression, and semantic heuristics.
 * 
 * @param {Array<{ id: string, label: string, subject: string, unit: string, chapter: string }>} topics 
 * @returns {Array<{ id: string, source: string, target: string, relationship: string }>}
 */
function buildHeuristicPrerequisiteEdges(topics) {
  const edges = [];
  const edgeSet = new Set();

  function addEdge(source, target) {
    if (!source || !target || source === target) return;
    const key = `${source}->${target}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push({
        id: key,
        source,
        target,
        relationship: 'PREREQUISITE',
      });
    }
  }

  // 1. Group topics by Unit / Subject
  const unitMap = new Map();
  topics.forEach(t => {
    const key = `${t.subject}::${t.unit}`;
    if (!unitMap.has(key)) unitMap.set(key, []);
    unitMap.get(key).push(t);
  });

  // 2. Intra-unit sequential dependency (each topic builds on preceding topic)
  unitMap.forEach(unitTopics => {
    for (let i = 0; i < unitTopics.length - 1; i++) {
      addEdge(unitTopics[i].id, unitTopics[i + 1].id);
    }
  });

  // 3. Known domain foundational chains
  const domainChains = [
    ['functions', 'limits', 'derivatives', 'integrals', 'differential_equations'],
    ['trigonometry', 'calculus'],
    ['linear_algebra', 'multivariable_calculus', 'optimization', 'machine_learning'],
    ['variables', 'control_flow', 'functions', 'object_oriented_programming', 'data_structures', 'algorithms', 'dynamic_programming'],
    ['newton_laws', 'work_energy', 'rotational_motion', 'gravitation'],
    ['atomic_structure', 'chemical_bonding', 'thermodynamics', 'chemical_kinetics', 'organic_chemistry'],
  ];

  topics.forEach(topicA => {
    const labelA = topicA.label.toLowerCase();
    topics.forEach(topicB => {
      if (topicA.id === topicB.id) return;
      const labelB = topicB.label.toLowerCase();

      for (const chain of domainChains) {
        const idxA = chain.findIndex(k => labelA.includes(k));
        const idxB = chain.findIndex(k => labelB.includes(k));
        if (idxA !== -1 && idxB !== -1 && idxA < idxB) {
          addEdge(topicA.id, topicB.id);
        }
      }

      // Keyword 'Advanced X' or 'Applications of X' depends on 'X'
      if (labelB.includes(`advanced ${labelA}`) || labelB.includes(`applications of ${labelA}`)) {
        addEdge(topicA.id, topicB.id);
      }
    });
  });

  return edges;
}

/**
 * Builds dependency DAG by using Gemini AI when configured, or heuristic graph builder.
 * Validates and ensures the graph is cycle-free.
 * 
 * @param {Array<{ id: string, label: string, subject: string, unit: string, chapter: string, estimatedHours: number }>} topics 
 * @returns {Promise<{ nodes: Array<object>, edges: Array<object>, topologicalOrder: string[] }>}
 */
async function buildDependencyDAG(topics) {
  if (!topics || topics.length === 0) {
    return { nodes: [], edges: [], topologicalOrder: [] };
  }

  let edges = [];

  // Try calling Gemini Flash API if available
  if (genAI && process.env.NODE_ENV !== 'test') {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `Analyze this syllabus topic list and identify prerequisite relationships (which topic must be studied before another topic).
Topic List:
${topics.map(t => `- ID: "${t.id}", Label: "${t.label}", Subject: "${t.subject}", Unit: "${t.unit}"`).join('\n')}

Respond ONLY with a JSON array of directed edges in this exact format:
[
  { "source": "topic_id_prerequisite", "target": "topic_id_dependent", "relationship": "PREREQUISITE" }
]
Make sure there are NO cycles. If no direct prerequisites exist, return an empty array [].`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsedEdges = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsedEdges)) {
          edges = parsedEdges.map(e => ({
            id: `${e.source}->${e.target}`,
            source: e.source,
            target: e.target,
            relationship: 'PREREQUISITE',
          }));
        }
      }
    } catch (err) {
      console.warn('[syllabusParserService] Gemini prerequisite inference failed, using heuristic graph:', err.message);
    }
  }

  // Fallback or complement with heuristic prerequisite edges
  if (edges.length === 0) {
    edges = buildHeuristicPrerequisiteEdges(topics);
  }

  // Validate cycle freedom & resolve topological sort
  const dagValidation = validateAndSortDAG(topics, edges);
  const activeEdges = edges.filter(e => 
    !dagValidation.prunedEdges.some(pe => pe.source === e.source && pe.target === e.target)
  );

  // Compute initial node attributes
  const nodes = topics.map(topic => ({
    ...topic,
    status: 'In-Progress',
    masteryPercentage: 0,
    prerequisites: activeEdges.filter(e => e.target === topic.id).map(e => e.source),
    dependents: activeEdges.filter(e => e.source === topic.id).map(e => e.target),
  }));

  // Initial mastery computation
  const { updatedNodes } = computeTopicMasteryStates(nodes, activeEdges, new Set(), new Set());

  return {
    nodes: updatedNodes,
    edges: activeEdges,
    topologicalOrder: dagValidation.topologicalOrder,
  };
}

/**
 * Computes node lock/unlock and mastery states based on completed topics.
 * 
 * - 'Mastered': topic is marked completed (100% mastery).
 * - 'In-Progress': all prerequisite parent topics are Mastered (unlocked for study).
 * - 'Locked': at least one prerequisite parent topic is not yet Mastered.
 * 
 * @param {Array<object>} nodes 
 * @param {Array<object>} edges 
 * @param {Set<string>|Array<string>} completedNodeIds 
 * @param {Set<string>|Array<string>} inProgressNodeIds 
 * @returns {{ updatedNodes: Array<object>, stats: object }}
 */
function computeTopicMasteryStates(nodes, edges, completedNodeIds = [], inProgressNodeIds = []) {
  const completedSet = completedNodeIds instanceof Set ? completedNodeIds : new Set(completedNodeIds);
  const inProgressSet = inProgressNodeIds instanceof Set ? inProgressNodeIds : new Set(inProgressNodeIds);

  // Map prerequisites for each node
  const prereqMap = new Map();
  nodes.forEach(n => prereqMap.set(n.id, []));
  edges.forEach(e => {
    if (prereqMap.has(e.target)) {
      prereqMap.get(e.target).push(e.source);
    }
  });

  let masteredCount = 0;
  let inProgressCount = 0;
  let lockedCount = 0;
  let totalHours = 0;
  let completedHours = 0;

  const updatedNodes = nodes.map(node => {
    const prereqs = prereqMap.get(node.id) || [];
    const allPrereqsMet = prereqs.every(pId => completedSet.has(pId));
    totalHours += node.estimatedHours || 4;

    let status = 'Locked';
    let masteryPercentage = 0;

    if (completedSet.has(node.id)) {
      status = 'Mastered';
      masteryPercentage = 100;
      masteredCount++;
      completedHours += node.estimatedHours || 4;
    } else if (allPrereqsMet) {
      status = 'In-Progress';
      masteryPercentage = inProgressSet.has(node.id) ? 50 : 15;
      inProgressCount++;
    } else {
      status = 'Locked';
      masteryPercentage = 0;
      lockedCount++;
    }

    return {
      ...node,
      status,
      masteryPercentage,
      missingPrerequisites: prereqs.filter(pId => !completedSet.has(pId)),
    };
  });

  const completionPercentage = nodes.length > 0 ? Math.round((masteredCount / nodes.length) * 100) : 0;

  return {
    updatedNodes,
    stats: {
      totalTopics: nodes.length,
      masteredCount,
      inProgressCount,
      lockedCount,
      completionPercentage,
      totalHours,
      completedHours,
    },
  };
}

module.exports = {
  extractTextFromPDF,
  extractMultiDocumentPDF,
  parseSyllabusHierarchy,
  validateAndSortDAG,
  buildHeuristicPrerequisiteEdges,
  buildDependencyDAG,
  computeTopicMasteryStates,
  slugify,
};
