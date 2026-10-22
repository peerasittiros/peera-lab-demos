import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Field } from './Field';
import { SegmentedControl } from './SegmentedControl';

const moves = [
  { value: 'in', label: 'รับเข้า', tone: 'accent' as const },
  { value: 'out', label: 'เบิกออก', tone: 'ink' as const },
  { value: 'adjust', label: 'ปรับยอด', tone: 'warning' as const },
];

describe('SegmentedControl', () => {
  it('is a radio group named by its field label', () => {
    render(
      <Field label="ประเภท" locale="th">
        <SegmentedControl locale="th" options={moves} defaultValue="in" />
      </Field>,
    );
    expect(
      screen.getByRole('radiogroup', { name: 'ประเภท' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'รับเข้า' })).toBeChecked();
  });

  it('moves and selects with the arrow keys, wrapping at the ends', async () => {
    const user = userEvent.setup();
    // Radix moves focus in a timeout and selects only while the arrow is still down,
    // so each press is held across a tick, as a real key press is.
    const press = async (key: string) => {
      await user.keyboard(`{${key}>}`);
      await user.keyboard(`{/${key}}`);
    };
    const onChange = vi.fn();
    render(
      <SegmentedControl
        aria-label="Move type"
        locale="th"
        options={moves}
        defaultValue="in"
        onValueChange={onChange}
      />,
    );
    screen.getByRole('radio', { name: 'รับเข้า' }).focus();

    await press('ArrowRight');
    expect(screen.getByRole('radio', { name: 'เบิกออก' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'เบิกออก' })).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith('out');

    await press('ArrowRight');
    await press('ArrowRight');
    expect(screen.getByRole('radio', { name: 'รับเข้า' })).toBeChecked();

    await press('ArrowLeft');
    expect(screen.getByRole('radio', { name: 'ปรับยอด' })).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith('adjust');
  });
});
