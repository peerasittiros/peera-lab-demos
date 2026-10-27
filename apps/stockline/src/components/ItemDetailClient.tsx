'use client';

import type { Locale } from '@peera/i18n';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@peera/ui';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { setItemActive } from '../client-store/master-commands';
import { useStoreInstance } from '../client-store/hooks';
import type { ItemView } from '../domain/read-models';
import type { Role } from '../domain/stock';
import { nameIn, translator } from '../i18n';
import { useItemViews } from '../client-store/hooks';
import { MoveSheet } from './MoveSheet';

/** "Record a movement" on the item page: the same sheet as quick move. */
export function RecordMovementButton({
  item,
  locale,
  role,
}: {
  item: ItemView;
  locale: Locale;
  role: Role;
}) {
  const { t, m } = translator(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  // The page's item comes from the server clone; the sheet records into the browser store, so it uses the store's
  // item with the same SKU (the sample shop is the same in both).
  const views = useItemViews(role);
  const local = views.find((entry) => entry.sku === item.sku) ?? null;
  return (
    <>
      <Button
        locale={locale}
        variant="primary"
        disabled={!item.active || !local}
        onClick={() => {
          setKey((value) => value + 1);
          setOpen(true);
        }}
      >
        {m.items.overview.record}
      </Button>
      <MoveSheet
        key={key}
        item={local}
        locale={locale}
        role={role}
        open={open}
        onOpenChange={setOpen}
        onSettled={(change, result) => {
          if (result.ok)
            toast({
              title: `${m.types[change.type]} · ${nameIn(item, locale)}`,
            });
          else
            toast({
              title: t('quickMove.failed', {
                reason: t(result.messageKey as 'errors.unexpected'),
              }),
            });
          router.refresh();
        }}
      />
    </>
  );
}

export function ArchiveButton({
  item,
  locale,
}: {
  item: ItemView;
  locale: Locale;
}) {
  const { t, m } = translator(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const store = useStoreInstance();
  const change = async (active: boolean) => {
    if (!store) return;
    setBusy(true);
    const result = await setItemActive(store, item.id, active, 'owner');
    setBusy(false);
    setOpen(false);
    toast({
      title: result.ok
        ? active
          ? m.items.form.restoredToast
          : m.items.form.archivedToast
        : t(result.error.messageKey as 'errors.unexpected'),
    });
    router.refresh();
  };
  if (!item.active)
    return (
      <Button
        locale={locale}
        variant="secondary"
        loading={busy}
        onClick={() => void change(true)}
      >
        {m.items.form.restore}
      </Button>
    );
  return (
    <>
      <Button locale={locale} variant="danger" onClick={() => setOpen(true)}>
        {m.items.form.archive}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent locale={locale}>
          <DialogTitle locale={locale}>
            {t('items.form.archiveTitle', { item: nameIn(item, locale) })}
          </DialogTitle>
          <DialogDescription locale={locale}>
            {m.items.form.archiveBody}
          </DialogDescription>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button locale={locale} variant="ghost">
                {m.common.cancel}
              </Button>
            </DialogClose>
            <Button
              locale={locale}
              variant="danger"
              loading={busy}
              onClick={() => void change(false)}
            >
              {m.items.form.archiveConfirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Overview / History / Settings (02 §8 screen 4). Panels are rendered on the server and passed in. */
export function ItemTabs({
  locale,
  overview,
  history,
  settings,
}: {
  locale: Locale;
  overview: ReactNode;
  history: ReactNode;
  settings?: ReactNode;
}) {
  const { m } = translator(locale);
  return (
    <Tabs locale={locale} defaultValue="overview">
      <TabsList locale={locale}>
        <TabsTrigger locale={locale} value="overview">
          {m.items.tabs.overview}
        </TabsTrigger>
        <TabsTrigger locale={locale} value="history">
          {m.items.tabs.history}
        </TabsTrigger>
        {settings ? (
          <TabsTrigger locale={locale} value="settings">
            {m.items.tabs.settings}
          </TabsTrigger>
        ) : null}
      </TabsList>
      <TabsContent locale={locale} value="overview">
        {overview}
      </TabsContent>
      <TabsContent locale={locale} value="history">
        {history}
      </TabsContent>
      {settings ? (
        <TabsContent locale={locale} value="settings">
          {settings}
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
