import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';

describe('Popover', () => {
  it('opens from the trigger and closes on Escape', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger locale="en">Choose period</PopoverTrigger>
        <PopoverContent locale="en" aria-label="Period options">
          This month
        </PopoverContent>
      </Popover>,
    );

    await user.click(screen.getByRole('button', { name: 'Choose period' }));
    expect(
      screen.getByRole('dialog', { name: 'Period options' }),
    ).toHaveTextContent('This month');
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });
});
