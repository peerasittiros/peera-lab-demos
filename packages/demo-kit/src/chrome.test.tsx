import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { CoachMarks, ContactLink, SampleDataNotice } from './chrome';
import { frameHeaders } from './headers';

const steps = [
  { title: 'Find an item', body: 'Search or scan.' },
  { title: 'Record a move', body: 'In, out or adjust.' },
  { title: 'See the reorder list', body: 'Grouped by supplier.' },
];

afterEach(() => window.history.replaceState(null, '', '/'));

describe('CoachMarks', () => {
  it('walks through the steps and remembers dismissal for the tab', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <CoachMarks locale="en" steps={steps} storageKey="stockline" />,
    );

    expect(
      await screen.findByRole('dialog', { name: 'Find an item' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 3/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      screen.getByRole('dialog', { name: 'See the reorder list' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    unmount();
    render(<CoachMarks locale="en" steps={steps} storageKey="stockline" />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape, in Thai', async () => {
    const user = userEvent.setup();
    render(<CoachMarks locale="th" steps={steps} storageKey="slotbook" />);
    expect(await screen.findByText(/ขั้นที่ 1 จาก 3/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ContactLink and SampleDataNotice', () => {
  it('links to the website contact page in the same language, in the top window when embedded', async () => {
    window.history.replaceState(null, '', '/th?embed=1');
    render(<ContactLink locale="th" siteUrl="https://peera.dev/" />);
    const link = screen.getByRole('link', { name: 'อยากได้ระบบแบบนี้' });
    expect(link).toHaveAttribute('href', 'https://peera.dev/th/contact');
    await screen.findByRole('link', { name: 'อยากได้ระบบแบบนี้' });
    expect(link).toHaveAttribute('target', '_top');
  });

  it('says the data is made up', () => {
    render(<SampleDataNotice locale="en" />);
    expect(screen.getByText(/made up/)).toHaveAttribute('lang', 'en');
  });
});

describe('frameHeaders', () => {
  it('allows only self and the configured origins to frame the app', () => {
    expect(frameHeaders('https://peera.dev  http://localhost:3000')).toEqual([
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "frame-ancestors 'self' https://peera.dev http://localhost:3000",
          },
        ],
      },
    ]);
    expect(frameHeaders(undefined)[0]!.headers[0]!.value).toBe(
      "frame-ancestors 'self'",
    );
  });
});
