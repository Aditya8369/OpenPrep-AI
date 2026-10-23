import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import SyllabusGraphViewer from './SyllabusGraphViewer';
import API from '../../services/api';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('@xyflow/react', () => {
  return {
    ReactFlow: ({ children, nodes, nodeTypes }) => (
      <div data-testid="react-flow-mock">
        {nodes?.map((node) => {
          const NodeComp = nodeTypes?.[node.type];
          return NodeComp ? (
            <NodeComp key={node.id} id={node.id} data={node.data} />
          ) : null;
        })}
        {children}
      </div>
    ),
    Controls: () => <div data-testid="react-flow-controls" />,
    MiniMap: () => <div data-testid="react-flow-minimap" />,
    Background: () => <div data-testid="react-flow-background" />,
    Handle: () => <div data-testid="react-flow-handle" />,
    Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
    useNodesState: (initial) => {
      const [state, setState] = React.useState(initial || []);
      return [state, setState, vi.fn()];
    },
    useEdgesState: (initial) => {
      const [state, setState] = React.useState(initial || []);
      return [state, setState, vi.fn()];
    },
  };
});

describe('SyllabusGraphViewer Component', () => {
  const mockDagData = {
    syllabusId: 'syl-123',
    title: 'Advanced Applied Mathematics',
    nodes: [
      {
        id: 'algebra_1',
        label: 'Linear Algebra',
        subject: 'Mathematics',
        unit: 'Unit 1: Algebra',
        chapter: 'Matrices',
        estimatedHours: 5,
        status: 'Mastered',
        masteryPercentage: 100,
      },
      {
        id: 'calculus_2',
        label: 'Differential Equations',
        subject: 'Mathematics',
        unit: 'Unit 2: Calculus',
        chapter: 'ODEs',
        estimatedHours: 8,
        status: 'In-Progress',
        masteryPercentage: 40,
      },
      {
        id: 'advanced_calc',
        label: 'Partial Differential Equations',
        subject: 'Mathematics',
        unit: 'Unit 3: Advanced',
        chapter: 'PDEs',
        estimatedHours: 10,
        status: 'Locked',
        missingPrerequisites: ['calculus_2'],
      },
    ],
    edges: [
      { id: 'algebra_1->calculus_2', source: 'algebra_1', target: 'calculus_2' },
      { id: 'calculus_2->advanced_calc', source: 'calculus_2', target: 'advanced_calc' },
    ],
    topologicalOrder: ['algebra_1', 'calculus_2', 'advanced_calc'],
    stats: {
      totalTopics: 3,
      masteredCount: 1,
      inProgressCount: 1,
      lockedCount: 1,
      completionPercentage: 33,
      totalHours: 23,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    API.get.mockResolvedValue({
      data: {
        success: true,
        ...mockDagData,
      },
    });
  });

  it('renders graph header, title, and mastery stats', async () => {
    render(<SyllabusGraphViewer syllabusId="syl-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Advanced Applied Mathematics/i)).toBeInTheDocument();
    });

    expect(screen.getByText('33%')).toBeInTheDocument();
    expect(screen.getByText(/1 Mastered/i)).toBeInTheDocument();
    expect(screen.getByText(/1 In-Progress/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Locked/i)).toBeInTheDocument();
  });

  it('renders topic nodes with custom statuses and badges', async () => {
    render(<SyllabusGraphViewer syllabusId="syl-123" />);

    await waitFor(() => {
      expect(screen.getByText('Linear Algebra')).toBeInTheDocument();
      expect(screen.getByText('Differential Equations')).toBeInTheDocument();
      expect(screen.getByText('Partial Differential Equations')).toBeInTheDocument();
    });

    // Incomplete prerequisites warning badge for locked node
    expect(screen.getByText(/Prerequisites incomplete/i)).toBeInTheDocument();
  });

  it('allows switching to Recommended Study Sequence tab', async () => {
    render(<SyllabusGraphViewer syllabusId="syl-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Study Sequence/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Study Sequence'));

    expect(screen.getByText(/Recommended Learning Sequence \(Topological Order\)/i)).toBeInTheDocument();
    expect(screen.getByText('Linear Algebra')).toBeInTheDocument();
  });

  it('triggers onGenerateQuiz callback when quiz icon is clicked', async () => {
    const handleQuiz = vi.fn();
    render(<SyllabusGraphViewer syllabusId="syl-123" onGenerateQuiz={handleQuiz} />);

    await waitFor(() => {
      expect(screen.getByText('Linear Algebra')).toBeInTheDocument();
    });

    const quizButtons = screen.getAllByTitle(/Generate Quiz for this Topic/i);
    fireEvent.click(quizButtons[0]);

    expect(handleQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'algebra_1',
        label: 'Linear Algebra',
      })
    );
  });

  it('opens and closes the PDF Upload Modal', async () => {
    render(<SyllabusGraphViewer syllabusId="syl-123" />);

    const uploadBtn = screen.getByText(/Upload Syllabus PDF/i);
    fireEvent.click(uploadBtn);

    expect(screen.getByText(/Upload Syllabus Documents \(Multi-part PDF\)/i)).toBeInTheDocument();

    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    expect(screen.queryByText(/Upload Syllabus Documents \(Multi-part PDF\)/i)).not.toBeInTheDocument();
  });
});
