import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Table, type TableColumn } from './Table';

type Item = { id: string; name: string; amount: number };

const columns: TableColumn<Item>[] = [
  { key: 'name', header: 'Name', cell: (row) => row.name },
  { key: 'amount', header: 'Amount', cell: (row) => row.amount, numeric: true },
];
const rows: Item[] = [{ id: 'a', name: 'Rent', amount: 1200 }];

describe('Table', () => {
  it('renders semantic headers, cells and numeric alignment', () => {
    render(
      <Table
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        locale="en"
      />,
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute(
      'scope',
      'col',
    );
    expect(screen.getByRole('cell', { name: '1200' })).toHaveClass(
      'text-right',
      'tabular-nums',
    );
  });

  it('provides a labeled card layout when collapseOnMobile is enabled', () => {
    render(
      <Table
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        locale="th"
        collapseOnMobile
        mobileView
      />,
    );
    expect(
      screen.getAllByText('Name').some((element) => element.closest('dt')),
    ).toBe(true);
    expect(
      screen.getAllByText('Rent').some((element) => element.closest('dd')),
    ).toBe(true);
    expect(screen.getByRole('table')).toHaveClass('hidden');
  });
});
