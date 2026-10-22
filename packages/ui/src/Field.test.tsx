import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';
import { Input, Textarea } from './Input';

describe('Field', () => {
  it('associates its label with the input', () => {
    render(
      <Field label="ชื่อสินค้า" locale="th">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('ชื่อสินค้า');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('lang', 'th');
    expect(input).toHaveClass('body-th');
  });

  it('describes the control with hint and error, and marks it invalid', () => {
    render(
      <Field
        label="Quantity"
        hint="Whole units only"
        error="Enter a number"
        locale="en"
      >
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Quantity');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(
      'Whole units only Enter a number',
    );
    expect(screen.getByText('Enter a number')).toBeVisible();
  });

  it('is not invalid without an error', () => {
    render(
      <Field label="Note" hint="Optional" locale="en">
        <Textarea />
      </Field>,
    );
    const textarea = screen.getByLabelText('Note');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).not.toHaveAttribute('aria-invalid');
    expect(textarea).toHaveAccessibleDescription('Optional');
  });

  it('keeps a description the control already has', () => {
    render(
      <>
        <p id="extra">Shown on the invoice</p>
        <Field label="Reference" error="Too long" locale="en">
          <Input aria-describedby="extra" />
        </Field>
      </>,
    );
    expect(screen.getByLabelText('Reference')).toHaveAccessibleDescription(
      'Shown on the invoice Too long',
    );
  });

  it('marks required fields in words and on the control', () => {
    render(
      <Field label="เหตุผล" required locale="th">
        <Input />
      </Field>,
    );
    expect(screen.getByText('(จำเป็น)')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeRequired();
  });
});
