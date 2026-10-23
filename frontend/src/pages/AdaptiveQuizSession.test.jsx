import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import AdaptiveQuizSession from './AdaptiveQuizSession';
import API from '../services/api';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('AdaptiveQuizSession Page Component', () => {
  const mockStartResponse = {
    data: {
      success: true,
      sessionId: 'cat_test_session_123',
      theta: 0.0,
      sem: 1.0,
      questionNumber: 1,
      maxQuestions: 8,
      question: {
        id: 'q_001',
        subject: 'Mathematics',
        topic: 'Algebra',
        questionText: 'What is the solution to 2x + 7 = 15?',
        options: ['x = 3', 'x = 4', 'x = 5', 'x = 8'],
        difficulty: -0.2,
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    API.post.mockResolvedValue(mockStartResponse);
  });

  it('initializes adaptive test and displays question with options and convergence meter', async () => {
    render(<AdaptiveQuizSession />);

    await waitFor(() => {
      expect(screen.getByText(/What is the solution to 2x \+ 7 = 15\?/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Computerized Adaptive Test \(2PL-IRT\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Calibration Confidence:/i)).toBeInTheDocument();
    expect(screen.getByText('x = 4')).toBeInTheDocument();
  });

  it('allows student to select an option and submit answer for IRT calibration', async () => {
    API.post
      .mockResolvedValueOnce(mockStartResponse) // for start
      .mockResolvedValueOnce({
        data: {
          success: true,
          isCorrect: true,
          explanation: 'Subtract 7 from both sides to get 2x = 8, then x = 4.',
          theta: 0.45,
          sem: 0.65,
          questionNumber: 2,
          isFinished: false,
          nextQuestion: {
            id: 'q_002',
            subject: 'Mathematics',
            topic: 'Calculus',
            questionText: 'What is the derivative of x^2?',
            options: ['x', '2x', '2', 'x^3'],
            difficulty: 0.5,
          },
        },
      });

    render(<AdaptiveQuizSession />);

    await waitFor(() => {
      expect(screen.getByText('x = 4')).toBeInTheDocument();
    });

    // Select option B ('x = 4')
    fireEvent.click(screen.getByText('x = 4'));

    const submitBtn = screen.getByText(/Submit & Update Ability/i);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Correct! Calibrating to higher difficulty item/i)).toBeInTheDocument();
      expect(screen.getByText(/Next Calibrated Question/i)).toBeInTheDocument();
    });
  });

  it('renders final ability report and national percentile when test converges', async () => {
    API.post
      .mockResolvedValueOnce(mockStartResponse) // for start
      .mockResolvedValueOnce({ // for respond with isFinished: true
        data: {
          success: true,
          isCorrect: true,
          explanation: 'Good work.',
          theta: 1.25,
          sem: 0.28,
          isFinished: true,
        },
      })
      .mockResolvedValueOnce({ // for finish
        data: {
          success: true,
          percentile: 89,
          finalTheta: 1.25,
          finalSEM: 0.28,
          totalAnswered: 6,
          accuracy: 83,
          trajectory: [
            { questionNumber: 1, difficulty: -0.2, isCorrect: true },
            { questionNumber: 2, difficulty: 0.5, isCorrect: true },
          ],
          masteryBreakdown: [
            { topic: 'Algebra', total: 3, correct: 3, percentage: 100 },
          ],
        },
      });

    render(<AdaptiveQuizSession />);

    await waitFor(() => {
      expect(screen.getByText('x = 4')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('x = 4'));
    fireEvent.click(screen.getByText(/Submit & Update Ability/i));

    await waitFor(() => {
      expect(screen.getByText(/Performance & Calibrated Ability Report/i)).toBeInTheDocument();
      expect(screen.getByText('89th')).toBeInTheDocument();
      expect(screen.getByText('+1.25')).toBeInTheDocument();
      expect(screen.getByText(/Retake Adaptive Test/i)).toBeInTheDocument();
    });
  });
});
