import { render, screen } from '@testing-library/react';
import { Package } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it.each([
    ['success', 'Paid', 'bg-success-soft'],
    ['warning', 'Low', 'bg-warning-soft'],
    ['danger', 'Overdue', 'bg-danger-soft'],
    ['info', 'Reserved', 'bg-info-soft'],
    ['neutral', 'Vacant', 'bg-surface-sunken'],
  ] as const)(
    'shows the word and an icon for the %s tone',
    (tone, label, background) => {
      const { container } = render(
        <StatusBadge tone={tone} label={label} locale="en" />,
      );
      const badge = screen.getByText(label).parentElement;
      expect(badge).toHaveClass(background);
      expect(
        container.querySelector('svg[aria-hidden="true"]'),
      ).toBeInTheDocument();
    },
  );

  it('sets the Thai language and accepts a custom icon', () => {
    const { container } = render(
      <StatusBadge tone="warning" label="ใกล้หมด" locale="th" icon={Package} />,
    );
    expect(
      screen.getByText('ใกล้หมด').closest('[lang="th"]'),
    ).toBeInTheDocument();
    expect(container.querySelector('svg.lucide-package')).toBeInTheDocument();
  });
});
