import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

describe('data display primitives', () => {
  it('renders localized badge and a raised card', () => {
    render(
      <>
        <Badge locale="th">ชำระแล้ว</Badge>
        <Card locale="en">Summary</Card>
      </>,
    );
    expect(screen.getByText('ชำระแล้ว')).toHaveAttribute('lang', 'th');
    expect(screen.getByText('Summary').closest('section')).toHaveClass(
      'bg-surface-raised',
    );
  });

  it('provides a named empty state and a polite loading status', () => {
    render(
      <>
        <EmptyState
          locale="th"
          title="ยังไม่มีรายการ"
          description="เพิ่มรายการแรกได้เลย"
        />
        <Skeleton locale="en" lines={2} />
      </>,
    );
    expect(
      screen.getByRole('region', { name: 'ยังไม่มีรายการ' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });
});
