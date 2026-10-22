import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from './Checkbox';
import { Switch } from './Switch';

describe('Checkbox', () => {
  it('is named by its label and toggles from the label and with Space', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Checkbox
        label="แจ้งเตือนเมื่อของใกล้หมด"
        locale="th"
        onCheckedChange={onChange}
      />,
    );
    const checkbox = screen.getByRole('checkbox', {
      name: 'แจ้งเตือนเมื่อของใกล้หมด',
    });
    expect(checkbox).not.toBeChecked();

    await user.click(screen.getByText('แจ้งเตือนเมื่อของใกล้หมด'));
    expect(checkbox).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(true);

    await user.keyboard(' ');
    expect(checkbox).not.toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});

describe('Switch', () => {
  it('is a switch named by its label and toggles with the keyboard', async () => {
    const user = userEvent.setup();
    render(<Switch label="Dark mode" locale="en" />);
    const control = screen.getByRole('switch', { name: 'Dark mode' });
    expect(control).toHaveAttribute('aria-checked', 'false');

    control.focus();
    await user.keyboard(' ');
    expect(control).toHaveAttribute('aria-checked', 'true');
  });

  it('has no pill shape', () => {
    render(<Switch label="Dark mode" locale="en" />);
    expect(screen.getByRole('switch').className).not.toMatch(/rounded-full/);
  });
});
