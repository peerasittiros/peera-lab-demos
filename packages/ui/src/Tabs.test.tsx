import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs';

describe('Tabs', () => {
  it('selects tabs with arrow keys and exposes selected state', async () => {
    const user = userEvent.setup();
    render(
      <Tabs locale="th" defaultValue="overview">
        <TabsList locale="th" aria-label="มุมมอง">
          <TabsTrigger locale="th" value="overview">
            ภาพรวม
          </TabsTrigger>
          <TabsTrigger locale="th" value="activity">
            กิจกรรม
          </TabsTrigger>
        </TabsList>
        <TabsContent locale="th" value="overview">
          สรุปข้อมูล
        </TabsContent>
        <TabsContent locale="th" value="activity">
          รายการล่าสุด
        </TabsContent>
      </Tabs>,
    );

    const overview = screen.getByRole('tab', { name: 'ภาพรวม' });
    const activity = screen.getByRole('tab', { name: 'กิจกรรม' });
    expect(overview).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('สรุปข้อมูล');

    overview.focus();
    await user.keyboard('{ArrowRight}');
    expect(activity).toHaveFocus();
    expect(activity).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('รายการล่าสุด');
  });
});
