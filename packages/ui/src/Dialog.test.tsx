import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './Dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from './Sheet';

describe('Dialog', () => {
  it('opens accessibly, closes on Escape and restores focus to its trigger', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger locale="en">Open details</DialogTrigger>
        <DialogContent locale="en">
          <DialogTitle locale="en">Details</DialogTitle>
          <DialogDescription locale="en">More information</DialogDescription>
          <button type="button">Inside</button>
        </DialogContent>
      </Dialog>,
    );

    const trigger = screen.getByRole('button', { name: 'Open details' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Details' });
    expect(dialog).toBeInTheDocument();
    expect(dialog.contains(document.activeElement)).toBe(true);
    screen.getByRole('button', { name: 'Inside' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });
});

describe('Sheet', () => {
  it('uses dialog focus management and provides responsive sheet layout', async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger locale="th">Open filters</SheetTrigger>
        <SheetContent locale="th">
          <SheetTitle locale="th">ตัวกรอง</SheetTitle>
          <SheetDescription locale="th">เลือกข้อมูลที่ต้องการ</SheetDescription>
          <button type="button">เลือกวันที่</button>
        </SheetContent>
      </Sheet>,
    );

    const trigger = screen.getByRole('button', { name: 'Open filters' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'ตัวกรอง' });
    expect(dialog).toHaveAttribute('lang', 'th');
    expect(dialog.className).toContain('md:right-0');
    expect(dialog.className).toContain('bottom-0');
    screen.getByRole('button', { name: 'เลือกวันที่' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'ปิด' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'เลือกวันที่' })).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  });
});
