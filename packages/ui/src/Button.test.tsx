import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('is a button named by its label, type=button by default', () => {
    render(<Button locale="en">Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'button');
  });

  it('fills primary with the product accent and labels it with on-accent', () => {
    render(
      <Button locale="en" variant="primary">
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveClass('bg-product-accent', 'text-product-on-accent');
    expect(button.className).not.toMatch(/text-white/);
  });

  it('uses the Thai type style and lang in Thai', () => {
    render(<Button locale="th">บันทึก</Button>);
    const button = screen.getByRole('button', { name: 'บันทึก' });
    expect(button).toHaveClass('ui-th');
    expect(button).toHaveAttribute('lang', 'th');
  });

  it('keeps at least 44px touch height on mobile for every size', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const { unmount } = render(
        <Button locale="en" size={size}>
          Go
        </Button>,
      );
      expect(screen.getByRole('button').className).toMatch(/min-h-1[12]/);
      unmount();
    }
  });

  it('blocks clicks and reports busy while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button locale="th" loading onClick={onClick}>
        บันทึก
      </Button>,
    );
    const button = screen.getByRole('button', { name: /บันทึก/ });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    expect(screen.getByLabelText('กำลังโหลด')).toBeInTheDocument();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
