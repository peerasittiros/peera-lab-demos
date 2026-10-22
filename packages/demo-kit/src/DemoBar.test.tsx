import { LocaleProvider } from '@peera/i18n';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoBar, newTabHref } from './DemoBar';

const roles = [
  { value: 'owner', label: 'เจ้าของร้าน' },
  { value: 'staff', label: 'พนักงาน' },
];

function withLocale(children: ReactNode) {
  return (
    <LocaleProvider locale="th" messages={{}}>
      {children}
    </LocaleProvider>
  );
}

function renderBar(props: Partial<Parameters<typeof DemoBar>[0]> = {}) {
  const onRoleChange = vi.fn();
  const onReset = vi.fn();
  const onResetDone = vi.fn();
  render(
    withLocale(
      <DemoBar
        productName="Stockline"
        locale="th"
        roles={roles}
        role="owner"
        onRoleChange={onRoleChange}
        onReset={onReset}
        onResetDone={onResetDone}
        {...props}
      />,
    ),
  );
  return { onRoleChange, onReset, onResetDone };
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
  delete document.documentElement.dataset.theme;
});

describe('DemoBar', () => {
  it('shows the product, the sample-data label and the current role', () => {
    renderBar();
    expect(screen.getByText('Stockline')).toBeInTheDocument();
    expect(screen.getByText('ข้อมูลตัวอย่าง')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'บทบาท: เจ้าของร้าน' }),
    ).toBeInTheDocument();
  });

  it('writes the chosen role to the session', async () => {
    const user = userEvent.setup();
    const { onRoleChange } = renderBar();
    await user.click(
      screen.getByRole('button', { name: 'บทบาท: เจ้าของร้าน' }),
    );
    await user.click(
      await screen.findByRole('menuitemradio', { name: 'พนักงาน' }),
    );
    expect(onRoleChange).toHaveBeenCalledWith('staff');
  });

  it('asks for confirmation before resetting', async () => {
    const user = userEvent.setup();
    const { onReset, onResetDone } = renderBar();

    await user.click(screen.getByRole('button', { name: 'เริ่มใหม่' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'เริ่มเดโมใหม่ไหม',
    });
    expect(dialog).toBeInTheDocument();
    expect(onReset).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'ยกเลิก' }));
    expect(onReset).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'เริ่มใหม่' }));
    await user.click(
      await screen.findByRole('button', { name: 'เริ่มเดโมใหม่' }),
    );
    await waitFor(() => expect(onResetDone).toHaveBeenCalled());
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('hides "open in new tab" outside the iframe', () => {
    renderBar();
    expect(
      screen.queryByRole('link', { name: 'เปิดในแท็บใหม่' }),
    ).not.toBeInTheDocument();
  });

  it('opens the same page in a new tab with language, theme and session, without embed', async () => {
    window.history.replaceState(
      null,
      '',
      '/th/items?embed=1&sid=abc.def&q=water',
    );
    document.documentElement.dataset.theme = 'dark';
    renderBar();
    const link = await screen.findByRole('link', { name: 'เปิดในแท็บใหม่' });
    const url = new URL(link.getAttribute('href')!);
    expect(url.pathname).toBe('/th/items');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      sid: 'abc.def',
      q: 'water',
      lang: 'th',
      theme: 'dark',
    });
    expect(link).toHaveAttribute('target', '_blank');
  });
});

describe('newTabHref', () => {
  it('drops embed and sets lang and theme', () => {
    expect(
      newTabHref(
        'https://stockline.demo.test/en/history?embed=1&lang=th',
        'en',
        'light',
      ),
    ).toBe('https://stockline.demo.test/en/history?lang=en&theme=light');
  });
});
