import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

describe('App layout', () => {
  it('shows the four bottom nav tabs', () => {
    renderAt('/pengaturan');
    const nav = screen.getByRole('navigation', { name: 'Navigasi utama' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(['Terjemah', 'Percakapan', 'Belajar', 'Pengaturan']);
  });

  it('lays the nav out in one column per tab (no empty slot)', () => {
    renderAt('/pengaturan');
    const list = within(screen.getByRole('navigation', { name: 'Navigasi utama' })).getByRole(
      'list',
    );
    expect(list).toHaveClass(`grid-cols-${within(list).getAllByRole('listitem').length}`);
  });

  it('keeps the unavailable "Kata" option focusable and announces why (aria-disabled)', () => {
    renderAt('/');
    const kata = screen.getByRole('radio', { name: /Kata/ });
    expect(kata).toHaveAttribute('aria-disabled', 'true');
    expect(kata).not.toBeDisabled();
    expect(kata).toHaveAccessibleName(/Model kata belum ada/);
  });

  it('navigates between pages', () => {
    renderAt('/pengaturan');
    expect(screen.getByRole('heading', { name: 'Pengaturan' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /Belajar/ }));
    expect(screen.getByRole('heading', { name: 'Belajar' })).toBeInTheDocument();
  });

  it('shows a camera error with a retry button when the camera is unavailable', async () => {
    renderAt('/');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
  });
});
