'use client';

import {
  CoachMarks,
  ContactLink,
  DemoBar,
  DemoSplit,
  LineChatMock,
  PhoneFrame,
  SampleDataNotice,
  type ChatMessage,
} from '@peera/demo-kit';
import type { Locale } from '@peera/i18n';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  Field,
  Input,
  KpiTile,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SegmentedControl,
  Select,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  StatusBadge,
  Stepper,
  Switch,
  Table,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  ToastProvider,
  toast,
  ts,
  type StatusTone,
  type TableColumn,
} from '@peera/ui';
import { useState, type ReactNode } from 'react';
import { messages } from '@/messages';

type Row = {
  id: string;
  name: string;
  onHand: number;
  tone: StatusTone;
  status: string;
};

function Section({
  title,
  locale,
  children,
}: {
  title: string;
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-6">
      <h2 className={ts('headline-sm', locale)}>{title}</h2>
      {children}
    </section>
  );
}

export function Gallery({ locale }: { locale: Locale }) {
  const m = messages[locale];
  const [role, setRole] = useState('owner');
  const [move, setMove] = useState('in');
  const [quantity, setQuantity] = useState(24);
  const [tour, setTour] = useState(0);

  const rows: Row[] = [
    {
      id: 'water',
      name: m.data.rows.water,
      onHand: 48,
      tone: 'success',
      status: m.data.statuses.ok,
    },
    {
      id: 'rice',
      name: m.data.rows.rice,
      onHand: 3,
      tone: 'warning',
      status: m.data.statuses.low,
    },
    {
      id: 'oil',
      name: m.data.rows.oil,
      onHand: 0,
      tone: 'danger',
      status: m.data.statuses.out,
    },
  ];
  const columns: TableColumn<Row>[] = [
    { key: 'item', header: m.data.table.item, cell: (row) => row.name },
    {
      key: 'onHand',
      header: m.data.table.onHand,
      cell: (row) => row.onHand,
      numeric: true,
    },
    {
      key: 'status',
      header: m.data.table.status,
      cell: (row) => (
        <StatusBadge tone={row.tone} label={row.status} locale={locale} />
      ),
    },
  ];
  const chat: ChatMessage[] = [
    {
      id: 1,
      from: 'customer',
      at: '2026-10-21T07:30:00Z',
      text: m.kit.chat.ask,
    },
    {
      id: 2,
      from: 'shop',
      at: '2026-10-21T07:31:00Z',
      card: {
        title: m.kit.chat.card,
        rows: [
          [m.kit.chat.service, m.kit.chat.serviceValue],
          [m.kit.chat.time, m.kit.chat.timeValue],
        ],
        button: m.kit.chat.button,
      },
      quickReplies: [m.kit.chat.replies.come, m.kit.chat.replies.move],
    },
  ];

  return (
    <ToastProvider locale={locale}>
      <DemoBar
        productName={m.kit.product}
        locale={locale}
        roles={[
          { value: 'owner', label: m.kit.roles.owner },
          { value: 'staff', label: m.kit.roles.staff },
        ]}
        role={role}
        onRoleChange={setRole}
        onReset={async () => {}}
        onResetDone={() => {}}
      />
      <main
        lang={locale}
        className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-8 md:px-8"
      >
        <header className="flex flex-col gap-2">
          <h1 className={ts('headline-lg', locale)}>{m.page.title}</h1>
          <p className={`${ts('body-lg', locale)} text-ink-muted`}>
            {m.page.lead}
          </p>
          <SampleDataNotice locale={locale} />
        </header>

        <Section title={m.sections.buttons} locale={locale}>
          <div className="flex flex-wrap gap-3">
            <Button locale={locale} variant="primary">
              {m.buttons.primary}
            </Button>
            <Button locale={locale}>{m.buttons.secondary}</Button>
            <Button locale={locale} variant="ghost">
              {m.buttons.ghost}
            </Button>
            <Button locale={locale} variant="danger">
              {m.buttons.danger}
            </Button>
            <Button locale={locale} loading>
              {m.buttons.loading}
            </Button>
            <Button locale={locale} disabled>
              {m.buttons.secondary}
            </Button>
          </div>
        </Section>

        <Section title={m.sections.forms} locale={locale}>
          <div className="grid gap-6 md:grid-cols-2">
            <Field
              label={m.forms.itemName}
              hint={m.forms.itemHint}
              locale={locale}
              required
            >
              <Input locale={locale} defaultValue={m.data.rows.water} />
            </Field>
            <Field
              label={m.forms.itemName}
              error={m.forms.itemError}
              locale={locale}
              required
            >
              <Input locale={locale} />
            </Field>
            <Field label={m.forms.unit} locale={locale}>
              <Select
                locale={locale}
                placeholder={m.forms.unitPlaceholder}
                options={[
                  { value: 'piece', label: m.forms.units.piece },
                  { value: 'bottle', label: m.forms.units.bottle },
                  { value: 'case', label: m.forms.units.case },
                ]}
              />
            </Field>
            <Field label={m.forms.note} locale={locale}>
              <Textarea locale={locale} placeholder={m.forms.notePlaceholder} />
            </Field>
            <div className="flex flex-col gap-2">
              <span className={ts('ui', locale)}>{m.forms.move}</span>
              <SegmentedControl
                locale={locale}
                aria-label={m.forms.move}
                value={move}
                onValueChange={setMove}
                options={[
                  { value: 'in', label: m.forms.moves.in, tone: 'accent' },
                  { value: 'out', label: m.forms.moves.out, tone: 'ink' },
                  {
                    value: 'adjust',
                    label: m.forms.moves.adjust,
                    tone: 'warning',
                  },
                ]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className={ts('ui', locale)}>{m.forms.quantity}</span>
              <Stepper
                locale={locale}
                size="lg"
                aria-label={m.forms.quantity}
                value={quantity}
                onValueChange={setQuantity}
                min={0}
              />
            </div>
            <Checkbox
              locale={locale}
              label={m.forms.blindCount}
              defaultChecked
            />
            <Switch
              locale={locale}
              label={m.forms.lowStockAlert}
              defaultChecked
            />
          </div>
        </Section>

        <Section title={m.sections.overlays} locale={locale}>
          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger locale={locale} asChild>
                <Button locale={locale}>{m.overlays.openDialog}</Button>
              </DialogTrigger>
              <DialogContent locale={locale}>
                <DialogTitle locale={locale}>
                  {m.overlays.dialogTitle}
                </DialogTitle>
                <DialogDescription locale={locale}>
                  {m.overlays.dialogBody}
                </DialogDescription>
                <div className="mt-5 flex justify-end gap-2">
                  <DialogClose asChild>
                    <Button locale={locale} variant="ghost">
                      {m.overlays.cancel}
                    </Button>
                  </DialogClose>
                  <Button locale={locale} variant="primary">
                    {m.overlays.confirm}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Sheet>
              <SheetTrigger locale={locale} asChild>
                <Button locale={locale}>{m.overlays.openSheet}</Button>
              </SheetTrigger>
              <SheetContent locale={locale}>
                <SheetTitle locale={locale}>{m.overlays.sheetTitle}</SheetTitle>
                <SheetDescription locale={locale}>
                  {m.overlays.sheetBody}
                </SheetDescription>
              </SheetContent>
            </Sheet>
            <Popover>
              <PopoverTrigger locale={locale} asChild>
                <Button locale={locale}>{m.overlays.popover}</Button>
              </PopoverTrigger>
              <PopoverContent locale={locale}>
                {m.overlays.popoverBody}
              </PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger locale={locale} asChild>
                <Button locale={locale}>{m.overlays.menu}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent locale={locale}>
                <DropdownMenuItem locale={locale}>
                  {m.overlays.menuItems.edit}
                </DropdownMenuItem>
                <DropdownMenuItem locale={locale}>
                  {m.overlays.menuItems.duplicate}
                </DropdownMenuItem>
                <DropdownMenuItem locale={locale}>
                  {m.overlays.menuItems.archive}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              locale={locale}
              onClick={() =>
                toast({
                  title: m.overlays.toastTitle,
                  description: m.overlays.toastBody,
                })
              }
            >
              {m.overlays.toast}
            </Button>
          </div>
          <Tabs locale={locale} defaultValue="overview">
            <TabsList locale={locale}>
              <TabsTrigger locale={locale} value="overview">
                {m.overlays.tabs.overview}
              </TabsTrigger>
              <TabsTrigger locale={locale} value="history">
                {m.overlays.tabs.history}
              </TabsTrigger>
              <TabsTrigger locale={locale} value="settings">
                {m.overlays.tabs.settings}
              </TabsTrigger>
            </TabsList>
            <TabsContent locale={locale} value="overview">
              {m.overlays.tabPanels.overview}
            </TabsContent>
            <TabsContent locale={locale} value="history">
              {m.overlays.tabPanels.history}
            </TabsContent>
            <TabsContent locale={locale} value="settings">
              {m.overlays.tabPanels.settings}
            </TabsContent>
          </Tabs>
        </Section>

        <Section title={m.sections.data} locale={locale}>
          <Table
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            locale={locale}
            collapseOnMobile
          />
          <div className="flex flex-wrap gap-2">
            <Badge locale={locale}>{m.data.badge}</Badge>
            <Badge locale={locale} tone="accent">
              {m.data.accentBadge}
            </Badge>
            <StatusBadge
              locale={locale}
              tone="success"
              label={m.data.statuses.paid}
            />
            <StatusBadge
              locale={locale}
              tone="warning"
              label={m.data.statuses.low}
            />
            <StatusBadge
              locale={locale}
              tone="danger"
              label={m.data.statuses.out}
            />
            <StatusBadge
              locale={locale}
              tone="info"
              label={m.data.statuses.reserved}
            />
            <StatusBadge
              locale={locale}
              tone="neutral"
              label={m.data.statuses.ok}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <KpiTile
              locale={locale}
              label={m.data.kpis.sales}
              value="฿48,250"
              delta={{ value: '12%', direction: 'up' }}
            />
            <KpiTile
              locale={locale}
              label={m.data.kpis.orders}
              value="312"
              delta={{ value: '4%', direction: 'down' }}
            />
            <KpiTile
              locale={locale}
              label={m.data.kpis.waste}
              value="2.4%"
              delta={{ value: '0%', direction: 'flat' }}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card locale={locale}>
              <h3 className={ts('title', locale)}>{m.data.cardTitle}</h3>
              <p className={`${ts('body', locale)} text-ink-muted`}>
                {m.data.cardBody}
              </p>
            </Card>
            <Card locale={locale}>
              <Skeleton locale={locale} lines={3} />
            </Card>
            <EmptyState
              locale={locale}
              title={m.data.emptyTitle}
              description={m.data.emptyBody}
              action={<Button locale={locale}>{m.data.emptyAction}</Button>}
            />
            <ErrorState
              locale={locale}
              title={m.data.errorTitle}
              description={m.data.errorBody}
              retryLabel={m.data.retry}
              onRetry={() => {}}
            />
          </div>
        </Section>

        <Section title={m.sections.kit} locale={locale}>
          <DemoSplit
            locale={locale}
            labels={m.kit.split}
            customer={
              <PhoneFrame label={m.kit.phone}>
                <div className="p-4">
                  <LineChatMock
                    locale={locale}
                    shopName={m.kit.shopName}
                    messages={chat}
                  />
                </div>
              </PhoneFrame>
            }
            shop={
              <Table
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                locale={locale}
              />
            }
          />
          <div className="flex flex-wrap items-center gap-4">
            <Button
              locale={locale}
              onClick={() => {
                sessionStorage.removeItem('peera:coach:kit-preview');
                setTour((count) => count + 1);
              }}
            >
              {m.kit.showTour}
            </Button>
            <ContactLink
              locale={locale}
              siteUrl="https://peera-lab.vercel.app"
            />
          </div>
          {tour > 0 ? (
            <CoachMarks
              key={tour}
              locale={locale}
              storageKey="kit-preview"
              steps={[m.kit.tour.step1, m.kit.tour.step2, m.kit.tour.step3]}
            />
          ) : null}
        </Section>
      </main>
    </ToastProvider>
  );
}
