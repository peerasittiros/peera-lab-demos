'use client';

import type { Locale } from '@peera/i18n';
import { Button, Field, Input, toast } from '@peera/ui';
import { useState, type FormEvent } from 'react';
import { actSaveSetting } from '@/src/client-store/commands/settings';
import { useStore } from '@/src/client-store/hooks';
import { useRole } from '@/src/client-store/role';
import { SETTING } from '@/src/client-store/setting-keys';
import { commandContext, messageFor } from '@/src/components/live/OwnerEdits';
import { ReadyGate } from '@/src/components/live/ReadyGate';
import { PageHeader } from '@/src/components/PageHeader';
import { translator } from '@/src/i18n';
import { settingsValuesView } from './selectors';

/**
 * People (ux-v2/rentroll.md › Settings): the names the demo's account menu shows for the owner, the caretaker and the
 * sample tenant. Names on contracts and invoices are sample data and do not change.
 */
export function PeopleSettings({ locale }: { locale: Locale }) {
  return (
    <ReadyGate locale={locale}>
      <Body locale={locale} />
    </ReadyGate>
  );
}

function Body({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const s = m.settings;
  const role = useRole();
  const values = useStore(settingsValuesView);
  const [owner, setOwner] = useState(values.ownerName ?? '');
  const [caretaker, setCaretaker] = useState(values.caretakerName ?? '');
  const [tenant, setTenant] = useState(values.tenantName ?? '');

  const save = async (key: string, value: string) =>
    await actSaveSetting(commandContext(role), {
      key,
      value: value.trim() === '' ? null : value,
    });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const results = await Promise.all([
      save(SETTING.ownerName, owner),
      save(SETTING.caretakerName, caretaker),
      save(SETTING.tenantName, tenant),
    ]);
    const failed = results.find((result) => !result.ok);
    toast({
      title: failed && !failed.ok ? messageFor(m, failed.error) : s.saved,
    });
  };

  return (
    <>
      <PageHeader
        locale={locale}
        title={s.pages.people.title}
        description={s.pages.people.body}
      />
      <form
        onSubmit={submit}
        lang={locale}
        className="flex max-w-[40rem] flex-col gap-4 rounded-md border border-line bg-surface-raised p-4"
      >
        <Field locale={locale} label={s.ownerName}>
          <Input
            value={owner}
            maxLength={60}
            onChange={(event) => setOwner(event.target.value)}
          />
        </Field>
        <Field locale={locale} label={s.caretakerName}>
          <Input
            value={caretaker}
            maxLength={60}
            onChange={(event) => setCaretaker(event.target.value)}
          />
        </Field>
        <Field locale={locale} label={s.tenantName} hint={s.nameHint}>
          <Input
            value={tenant}
            maxLength={60}
            onChange={(event) => setTenant(event.target.value)}
          />
        </Field>
        <div>
          <Button locale={locale} type="submit" variant="primary">
            {s.savePeople}
          </Button>
        </div>
      </form>
    </>
  );
}
