import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DemoSplit } from './DemoSplit';
import { LineChatMock, type ChatMessage } from './LineChatMock';
import { PhoneFrame } from './PhoneFrame';
import userEvent from '@testing-library/user-event';

// 07:30 UTC = 14:30 in Bangkok.
const messages: ChatMessage[] = [
  {
    id: 1,
    from: 'customer',
    at: '2026-10-21T07:30:00Z',
    text: 'ขอจองพรุ่งนี้บ่ายสาม',
  },
  {
    id: 2,
    from: 'shop',
    at: '2026-10-21T07:31:00Z',
    card: {
      title: 'ยืนยันการจอง',
      rows: [
        ['บริการ', 'ตัดผม'],
        ['เวลา', '15:00 น.'],
      ],
      button: 'ดูการจอง',
    },
    quickReplies: ['ยืนยันมา', 'ขอเลื่อน'],
  },
];

describe('LineChatMock', () => {
  it('renders a Thai chat with card, time and quick replies', () => {
    render(
      <LineChatMock locale="th" shopName="ช่างหนุ่ม" messages={messages} />,
    );
    expect(screen.getByText('ช่างหนุ่ม')).toBeInTheDocument();
    expect(screen.getByText('บัญชีทางการ')).toBeInTheDocument();
    const log = screen.getByRole('log', { name: 'ข้อความในแชต' });
    expect(within(log).getByText('ขอจองพรุ่งนี้บ่ายสาม')).toBeInTheDocument();
    expect(within(log).getByText('14:30 น.')).toBeInTheDocument();
    expect(within(log).getByText('ยืนยันการจอง')).toBeInTheDocument();
    expect(within(log).getByText('15:00 น.')).toBeInTheDocument();
    expect(
      within(log).getByRole('list', { name: 'ตัวเลือกตอบกลับด่วน' }),
    ).toHaveTextContent('ยืนยันมาขอเลื่อน');
    expect(
      screen.getByText('ตัวอย่างข้อความที่จะส่งเข้า LINE จริง'),
    ).toBeInTheDocument();
  });

  it('renders English and animates only messages that arrive later', () => {
    const { rerender } = render(
      <LineChatMock
        locale="en"
        shopName="Sabai"
        messages={messages.slice(0, 1)}
      />,
    );
    expect(screen.getByText('Official account')).toBeInTheDocument();
    expect(screen.getByText('14:30')).toBeInTheDocument();
    expect(
      screen.getByText('ขอจองพรุ่งนี้บ่ายสาม').closest('li'),
    ).not.toHaveClass('peera-chat-in');

    rerender(<LineChatMock locale="en" shopName="Sabai" messages={messages} />);
    expect(screen.getByText('ยืนยันการจอง').closest('li')).toHaveClass(
      'peera-chat-in',
    );
  });
});

describe('DemoSplit', () => {
  it('keeps both sides mounted and switches the visible one with tabs and arrow keys', async () => {
    const user = userEvent.setup();
    render(
      <DemoSplit
        locale="en"
        customer={<p>Phone side</p>}
        shop={<p>Shop side</p>}
        labels={{ customer: 'Customer view', shop: 'Shop view' }}
      />,
    );
    const customerTab = screen.getByRole('tab', { name: 'Customer view' });
    expect(customerTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Phone side')).toBeInTheDocument();
    expect(
      screen.getByText('Shop side').closest('[role="tabpanel"]'),
    ).toHaveClass('max-lg:hidden');

    await user.click(screen.getByRole('tab', { name: 'Shop view' }));
    expect(
      screen.getByText('Phone side').closest('[role="tabpanel"]'),
    ).toHaveClass('max-lg:hidden');
    expect(
      screen.getByText('Shop side').closest('[role="tabpanel"]'),
    ).not.toHaveClass('max-lg:hidden');

    await user.keyboard('{ArrowLeft}');
    expect(customerTab).toHaveFocus();
    expect(customerTab).toHaveAttribute('aria-selected', 'true');
  });
});

describe('PhoneFrame', () => {
  it('is a labeled group around the content', () => {
    render(
      <PhoneFrame label="Customer's phone">
        <p>Book a time</p>
      </PhoneFrame>,
    );
    expect(
      screen.getByRole('group', { name: "Customer's phone" }),
    ).toHaveTextContent('Book a time');
  });
});
