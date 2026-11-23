import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ConfidenceHint from './ConfidenceHint';

describe('ConfidenceHint', () => {
  it('asks to hold steadier below the threshold', () => {
    render(<ConfidenceHint label="R" confidence={0.58} threshold={0.8} />);
    expect(screen.getByText('58% — tahan lebih stabil')).toBeInTheDocument();
  });

  it('shows the letter and confidence at or above the threshold', () => {
    render(<ConfidenceHint label="R" confidence={0.92} threshold={0.8} />);
    expect(screen.getByText('R 92%')).toBeInTheDocument();
  });
});
