import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KpiTile } from './KpiTile';

describe('KpiTile', () => {
  it('exposes the delta value and its direction in English', () => {
    render(
      <KpiTile
        locale="en"
        label="Monthly sales"
        value="$12,400"
        delta={{ value: '8%', direction: 'up' }}
      />,
    );
    expect(screen.getByText('$12,400')).toBeInTheDocument();
    expect(screen.getByText(/8%/)).toHaveTextContent('8% Increase');
  });

  it('announces Thai delta direction and sets the language', () => {
    render(
      <KpiTile
        locale="th"
        label="ยอดขายรายเดือน"
        value="12,400 บาท"
        delta={{ value: '8%', direction: 'down' }}
      />,
    );
    expect(screen.getByText(/8%/)).toHaveTextContent('8% ลดลง');
    expect(
      screen.getByText('ยอดขายรายเดือน').closest('[lang="th"]'),
    ).toBeInTheDocument();
  });
});
