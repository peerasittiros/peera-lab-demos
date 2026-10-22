import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './DropdownMenu';

describe('DropdownMenu', () => {
  it('opens and navigates menu items with the keyboard', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger locale="en">More actions</DropdownMenuTrigger>
        <DropdownMenuContent locale="th">
          <DropdownMenuItem locale="th" onSelect={onSelect}>
            แก้ไข
          </DropdownMenuItem>
          <DropdownMenuItem locale="th">เก็บถาวร</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    screen.getByRole('button', { name: 'More actions' }).focus();
    await user.keyboard('{ArrowDown}');
    // Radix labels the menu by its trigger (aria-labelledby).
    expect(
      screen.getByRole('menu', { name: 'More actions' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'แก้ไข' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
