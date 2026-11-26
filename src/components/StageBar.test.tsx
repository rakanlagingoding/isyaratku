import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StageBar from './StageBar';

const detail = (stage: string) => <p>detail {stage}</p>;

describe('StageBar', () => {
  it('shows the 4 stages in order and marks the running one', () => {
    render(<StageBar current="interpretasi" renderDetail={detail} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      '1Tangan',
      '2Ekspresi',
      '●3Interpretasi', // the dot marks the running stage without relying on color
      '4Suara',
    ]);
    expect(screen.getByRole('button', { name: /Interpretasi/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByRole('button', { name: /Tangan/ })).not.toHaveAttribute('aria-current');
  });

  it('opens and closes the detail of a tapped stage', () => {
    render(<StageBar current={null} renderDetail={detail} />);
    const suara = screen.getByRole('button', { name: /Suara/ });
    fireEvent.click(suara);
    expect(suara).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('detail suara')).toBeInTheDocument();
    fireEvent.click(suara);
    expect(screen.queryByText('detail suara')).not.toBeInTheDocument();
  });
});
