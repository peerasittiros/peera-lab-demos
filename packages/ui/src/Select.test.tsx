import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Field } from './Field';
import { Select } from './Select';

const units = [
  { value: 'bottle', label: 'ขวด' },
  { value: 'pack', label: 'แพ็ค ×6' },
  { value: 'case', label: 'ลัง ×24' },
];

function Unit({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState('bottle');
  return (
    <Field label="หน่วย" locale="th">
      <Select
        locale="th"
        options={units}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    </Field>
  );
}

describe('Select', () => {
  it('is a combobox named by its field label', () => {
    render(<Unit onChange={() => {}} />);
    const trigger = screen.getByRole('combobox', { name: 'หน่วย' });
    expect(trigger).toHaveTextContent('ขวด');
  });

  it('opens and chooses with the keyboard', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Unit onChange={onChange} />);
    const trigger = screen.getByRole('combobox', { name: 'หน่วย' });

    trigger.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);

    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('pack');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent('แพ็ค ×6');
  });

  it('passes the field error to the trigger', () => {
    render(
      <Field label="Unit" error="Pick a unit" locale="en">
        <Select locale="en" options={units} placeholder="Choose" />
      </Field>,
    );
    const trigger = screen.getByRole('combobox', { name: 'Unit' });
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAccessibleDescription('Pick a unit');
  });
});
