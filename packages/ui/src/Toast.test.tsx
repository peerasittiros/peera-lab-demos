import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast, ToastProvider } from './Toast';

describe('ToastProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a toast, announces it politely, and dismisses it after four seconds', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider locale="th">
        <button
          type="button"
          onClick={() =>
            toast({ title: 'บันทึกแล้ว', description: 'พร้อมใช้งาน' })
          }
        >
          แจ้งเตือน
        </button>
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'แจ้งเตือน' }));
    // The toast region is named in the active locale (Radix appends the hotkey).
    expect(
      screen.getByRole('region', { name: /^การแจ้งเตือน/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('บันทึกแล้ว');
    // Radix announces through its own live region; type="background" makes it polite.
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');

    act(() => vi.advanceTimersByTime(3999));
    expect(screen.getByRole('listitem')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('throws a clear error when the helper is used without a provider', () => {
    expect(() => toast({ title: 'Saved' })).toThrow(
      'toast() requires a mounted ToastProvider.',
    );
  });
});
