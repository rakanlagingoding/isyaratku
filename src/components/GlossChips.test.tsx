import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GlossChips from './GlossChips';

describe('GlossChips', () => {
  it('shows fingerspelled glosses as words and removes a chip on tap', () => {
    const onRemove = vi.fn();
    render(<GlossChips glosses={['FS:RAKAN', 'FS:ADI']} onRemove={onRemove} />);
    expect(screen.getByRole('button', { name: 'Hapus Rakan' })).toHaveTextContent('Rakan');
    fireEvent.click(screen.getByRole('button', { name: 'Hapus Adi' }));
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('renders nothing without glosses', () => {
    const { container } = render(<GlossChips glosses={[]} onRemove={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
