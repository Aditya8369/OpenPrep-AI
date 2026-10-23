/**
 * Tests for ExportCalendarModal component
 * Fixes #2374
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExportCalendarModal from '../ExportCalendarModal';

// Mock the API service
jest.mock('../../../services/api', () => ({
  get: jest.fn(),
}));

const API = require('../../../services/api');

describe('ExportCalendarModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    planId: 'plan-123',
    planName: 'JEE Advanced 2026 Study Plan',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ExportCalendarModal {...defaultProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the modal with title when isOpen is true', () => {
    render(<ExportCalendarModal {...defaultProps} />);

    expect(screen.getByText('Export to Calendar')).toBeInTheDocument();
    expect(screen.getByText(/Sync your study plan/)).toBeInTheDocument();
  });

  it('displays the plan name when provided', () => {
    render(<ExportCalendarModal {...defaultProps} />);

    expect(screen.getByText('JEE Advanced 2026 Study Plan')).toBeInTheDocument();
  });

  it('has the revision toggle checked by default', () => {
    render(<ExportCalendarModal {...defaultProps} />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('shows Download .ics button', () => {
    render(<ExportCalendarModal {...defaultProps} />);

    expect(screen.getByText('Download .ics File')).toBeInTheDocument();
  });

  it('shows Add to Google Calendar button', () => {
    render(<ExportCalendarModal {...defaultProps} />);

    expect(screen.getByText('Add to Google Calendar')).toBeInTheDocument();
  });

  it('calls onClose when X button is clicked', () => {
    render(<ExportCalendarModal {...defaultProps} />);

    const closeButton = screen.getByLabelText('Close export modal');
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('displays the user timezone', () => {
    render(<ExportCalendarModal {...defaultProps} />);

    // Should show some timezone string
    expect(screen.getByText(/Events will be exported in your timezone/)).toBeInTheDocument();
  });
});
