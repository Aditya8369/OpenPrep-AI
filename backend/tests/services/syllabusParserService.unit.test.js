import { describe, it, expect, vi, beforeEach } from 'vitest';
const {
  parseSyllabusHierarchy,
  validateAndSortDAG,
  buildHeuristicPrerequisiteEdges,
  buildDependencyDAG,
  computeTopicMasteryStates,
  slugify,
} = require('../../services/syllabusParserService');
const {
  uploadPdfSyllabus,
  getSyllabusDag,
  updateTopicStatus,
  createDefaultCurriculumDAG,
  syllabusDagStore,
} = require('../../controllers/syllabusDagController');

describe('syllabusParserService - Syllabus Ingestion & Prerequisite DAG', () => {
  describe('slugify', () => {
    it('creates lowercase alphanumeric slugs with underscores', () => {
      expect(slugify('Unit 1: Limits & Continuity!')).toBe('unit_1_limits_continuity');
      expect(slugify('Linear Algebra 101')).toBe('linear_algebra_101');
    });
  });

  describe('parseSyllabusHierarchy', () => {
    it('extracts Subject, Unit, Chapter, and numbered Subtopics', () => {
      const syllabusSample = `
Subject: Advanced Engineering Mathematics
Unit 1: Differential Equations
Chapter 1: First Order ODEs
1.1 Variable Separable Equations
1.2 Exact Differential Equations
Unit 2: Linear Algebra
Chapter 2: Matrices & Eigenvalues
2.1 Matrix Rank and Inversion
2.2 Eigenvalues and Eigenvectors
`;
      const topics = parseSyllabusHierarchy(syllabusSample);

      expect(topics.length).toBe(4);
      expect(topics[0]).toMatchObject({
        label: 'Variable Separable Equations',
        subject: 'Advanced Engineering Mathematics',
        unit: 'Unit 1: Differential Equations',
        chapter: 'Chapter 1: First Order ODEs',
      });
      expect(topics[3]).toMatchObject({
        label: 'Eigenvalues and Eigenvectors',
        subject: 'Advanced Engineering Mathematics',
        unit: 'Unit 2: Linear Algebra',
        chapter: 'Chapter 2: Matrices & Eigenvalues',
      });
    });

    it('extracts bullet-pointed topics correctly', () => {
      const syllabusSample = `
Subject: Computer Science
Unit 1: Algorithms
- Bubble Sort and Selection Sort
- Merge Sort and Quick Sort
* Binary Search Trees
`;
      const topics = parseSyllabusHierarchy(syllabusSample);
      expect(topics.length).toBe(3);
      expect(topics.map(t => t.label)).toContain('Bubble Sort and Selection Sort');
      expect(topics.map(t => t.label)).toContain('Binary Search Trees');
    });

    it('falls back gracefully to sentence splitting if no markdown/bullet structure exists', () => {
      const plainText = 'Introduction to Thermodynamics. First law of thermodynamics. Second law of thermodynamics and entropy. Carnot cycle.';
      const topics = parseSyllabusHierarchy(plainText, { defaultSubject: 'Physics' });
      expect(topics.length).toBeGreaterThan(0);
      expect(topics[0].subject).toBe('Physics');
    });
  });

  describe('validateAndSortDAG', () => {
    it('returns isValidDAG=true and topological order for acyclic graph', () => {
      const nodes = [
        { id: 'math_basics' },
        { id: 'limits' },
        { id: 'derivatives' },
        { id: 'integrals' },
      ];
      const edges = [
        { source: 'math_basics', target: 'limits' },
        { source: 'limits', target: 'derivatives' },
        { source: 'derivatives', target: 'integrals' },
      ];

      const result = validateAndSortDAG(nodes, edges);

      expect(result.isValidDAG).toBe(true);
      expect(result.cycles).toHaveLength(0);
      expect(result.prunedEdges).toHaveLength(0);
      expect(result.topologicalOrder).toEqual(['math_basics', 'limits', 'derivatives', 'integrals']);
    });

    it('detects cycles and prunes feedback edges to guarantee an acyclic graph', () => {
      const nodes = [
        { id: 'node_a' },
        { id: 'node_b' },
        { id: 'node_c' },
      ];
      // A -> B -> C -> A (Cycle!)
      const cyclicEdges = [
        { source: 'node_a', target: 'node_b' },
        { source: 'node_b', target: 'node_c' },
        { source: 'node_c', target: 'node_a' },
      ];

      const result = validateAndSortDAG(nodes, cyclicEdges);

      expect(result.isValidDAG).toBe(false);
      expect(result.cycles.length).toBeGreaterThan(0);
      expect(result.prunedEdges.length).toBeGreaterThan(0);
      // Topological order includes all nodes after cycle pruning
      expect(result.topologicalOrder).toHaveLength(3);
      expect(new Set(result.topologicalOrder)).toEqual(new Set(['node_a', 'node_b', 'node_c']));
    });
  });

  describe('buildHeuristicPrerequisiteEdges', () => {
    it('creates intra-unit sequential links and cross-domain prerequisites', () => {
      const topics = [
        { id: 'fn_1', label: 'Functions and Relations', subject: 'Math', unit: 'Calculus', chapter: 'Basics' },
        { id: 'lim_2', label: 'Limits and Continuity', subject: 'Math', unit: 'Calculus', chapter: 'Limits' },
        { id: 'der_3', label: 'Derivatives', subject: 'Math', unit: 'Calculus', chapter: 'Differentiation' },
      ];

      const edges = buildHeuristicPrerequisiteEdges(topics);

      expect(edges.length).toBeGreaterThan(0);
      const edgePairs = edges.map(e => `${e.source}->${e.target}`);
      expect(edgePairs).toContain('fn_1->lim_2');
      expect(edgePairs).toContain('lim_2->der_3');
    });
  });

  describe('computeTopicMasteryStates', () => {
    it('correctly locks downstream nodes until prerequisite parents are Mastered', () => {
      const nodes = [
        { id: 'prereq_1', label: 'Algebra', estimatedHours: 4 },
        { id: 'target_2', label: 'Calculus', estimatedHours: 6 },
      ];
      const edges = [
        { source: 'prereq_1', target: 'target_2', relationship: 'PREREQUISITE' },
      ];

      // Initial state: nothing completed
      const initial = computeTopicMasteryStates(nodes, edges, new Set(), new Set());
      const prereqInitial = initial.updatedNodes.find(n => n.id === 'prereq_1');
      const targetInitial = initial.updatedNodes.find(n => n.id === 'target_2');

      expect(prereqInitial.status).toBe('In-Progress');
      expect(targetInitial.status).toBe('Locked');
      expect(targetInitial.missingPrerequisites).toContain('prereq_1');

      // Now complete prereq_1: target_2 should automatically unlock to In-Progress!
      const afterComplete = computeTopicMasteryStates(nodes, edges, new Set(['prereq_1']), new Set());
      const prereqAfter = afterComplete.updatedNodes.find(n => n.id === 'prereq_1');
      const targetAfter = afterComplete.updatedNodes.find(n => n.id === 'target_2');

      expect(prereqAfter.status).toBe('Mastered');
      expect(prereqAfter.masteryPercentage).toBe(100);
      expect(targetAfter.status).toBe('In-Progress');
      expect(targetAfter.missingPrerequisites).toHaveLength(0);
      expect(afterComplete.stats.masteredCount).toBe(1);
      expect(afterComplete.stats.completionPercentage).toBe(50);
    });
  });

  describe('syllabusDagController Endpoints', () => {
    let req, res;

    beforeEach(() => {
      req = {
        params: {},
        body: {},
        user: { id: 'usr-123' },
      };
      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
    });

    it('uploadPdfSyllabus returns 400 when no files or text are provided', async () => {
      await uploadPdfSyllabus(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringMatching(/please upload/i),
      }));
    });

    it('uploadPdfSyllabus processes raw text input and builds valid DAG', async () => {
      req.body = {
        title: 'Physics 101',
        text: `
Subject: Classical Mechanics
Unit 1: Kinematics
1.1 Velocity and Acceleration
1.2 Projectile Motion
Unit 2: Dynamics
2.1 Newton Laws of Motion
2.2 Work, Energy and Power
`,
      };

      await uploadPdfSyllabus(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        syllabusId: expect.any(String),
        nodes: expect.any(Array),
        edges: expect.any(Array),
        topologicalOrder: expect.any(Array),
      }));
    });

    it('getSyllabusDag returns the DAG structure for an existing or default curriculum', async () => {
      req.params = { id: 'default-curriculum' };

      await getSyllabusDag(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        syllabusId: 'default-curriculum',
        nodes: expect.any(Array),
        edges: expect.any(Array),
      }));
    });

    it('updateTopicStatus dynamically toggles topic completion and unlocks downstream nodes', async () => {
      req.params = { id: 'limits' };
      req.body = { status: 'Mastered', completed: true, syllabusId: 'default-curriculum' };

      await updateTopicStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        node: expect.objectContaining({
          id: 'limits',
          status: 'Mastered',
        }),
      }));
    });
  });
});
