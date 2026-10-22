import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';
import { Stepper, type StepperProps } from './Stepper';

function Quantity(props: Partial<StepperProps>) {
  const [value, setValue] = useState(props.value ?? 1);
  return (
    <Field label="จำนวน" locale="th">
      <Stepper
        locale="th"
        min={0}
        max={3}
        {...props}
        value={value}
        onValueChange={setValue}
      />
    </Field>
  );
}

describe('Stepper', () => {
  it('is a spinbutton named by its field label, with named buttons', () => {
    render(<Quantity />);
    const spin = screen.getByRole('spinbutton', { name: 'จำนวน' });
    expect(spin).toHaveValue('1');
    expect(spin).toHaveAttribute('aria-valuemin', '0');
    expect(spin).toHaveAttribute('aria-valuemax', '3');
    expect(screen.getByRole('button', { name: 'ลดจำนวน' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'เพิ่มจำนวน' }),
    ).toBeInTheDocument();
  });

  it('stops at its bounds and disables the button there', async () => {
    const user = userEvent.setup();
    render(<Quantity />);
    const spin = screen.getByRole('spinbutton');
    const minus = screen.getByRole('button', { name: 'ลดจำนวน' });
    const plus = screen.getByRole('button', { name: 'เพิ่มจำนวน' });

    await user.click(minus);
    expect(spin).toHaveValue('0');
    expect(minus).toBeDisabled();

    await user.click(plus);
    await user.click(plus);
    await user.click(plus);
    expect(spin).toHaveValue('3');
    expect(plus).toBeDisabled();
  });

  it('steps with the arrow keys and jumps with Home and End', async () => {
    const user = userEvent.setup();
    render(<Quantity />);
    const spin = screen.getByRole('spinbutton');
    spin.focus();

    await user.keyboard('{ArrowUp}');
    expect(spin).toHaveAttribute('aria-valuenow', '2');
    await user.keyboard('{End}{ArrowUp}');
    expect(spin).toHaveAttribute('aria-valuenow', '3');
    await user.keyboard('{Home}{ArrowDown}');
    expect(spin).toHaveAttribute('aria-valuenow', '0');
  });

  it('clamps a typed value and ignores text that is not a number', async () => {
    const user = userEvent.setup();
    render(<Quantity />);
    const spin = screen.getByRole('spinbutton');

    await user.clear(spin);
    await user.type(spin, '9{Enter}');
    expect(spin).toHaveValue('3');

    await user.clear(spin);
    await user.type(spin, 'abc');
    await user.tab();
    expect(spin).toHaveValue('3');
  });

  it('has 56px buttons in the large size', () => {
    render(<Quantity size="lg" />);
    expect(screen.getByRole('button', { name: 'เพิ่มจำนวน' })).toHaveClass(
      'size-14',
    );
  });
});
