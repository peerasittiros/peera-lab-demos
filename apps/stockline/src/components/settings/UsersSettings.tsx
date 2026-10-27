'use client';

import type { Locale } from '@peera/i18n';
import { Button, cn, Field, Input, Skeleton, toast, ts } from '@peera/ui';
import { useState, type FormEvent } from 'react';
import { useStoreInstance, useStoreState } from '../../client-store/hooks';
import { saveUser } from '../../client-store/master-commands';
import type { Role } from '../../domain/stock';
import { translator } from '../../i18n';
import { PageHeader } from '../PageHeader';

/** The sample shop's two people: their display names on the account menu and in history. */
export function UsersSettings({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const { ledger, status } = useStoreState();
  const page = m.settings.pages.users;
  return (
    <>
      <PageHeader locale={locale} title={page.title} description={page.body} />
      {!ledger || status === 'loading' ? (
        <Skeleton locale={locale} lines={4} />
      ) : (
        <ul className="m-0 flex max-w-[40rem] list-none flex-col divide-y divide-line rounded-md border border-line bg-surface-raised p-0">
          {(['owner', 'staff'] as const).map((role) => (
            <li key={role} className="p-4">
              <UserRow
                locale={locale}
                role={role}
                name={ledger.users[role]?.displayName ?? ''}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function UserRow({
  locale,
  role,
  name,
}: {
  locale: Locale;
  role: Role;
  name: string;
}) {
  const { t, m } = translator(locale);
  const store = useStoreInstance();
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) {
      setError(m.errors.nameRequired);
      return;
    }
    setError(undefined);
    if (!store) return;
    setSaving(true);
    const result = await saveUser(store, { role, displayName: value }, 'owner');
    setSaving(false);
    toast({
      title: result.ok
        ? m.settings.userSaved
        : t(
            (result.error.messageKey ??
              'errors.unexpected') as 'errors.unexpected',
          ),
    });
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex w-full flex-col">
        <span className={cn(ts('ui', locale), 'font-medium text-ink')}>
          {m.roles[role]}
        </span>
      </div>
      <Field
        locale={locale}
        label={m.settings.displayName}
        error={error}
        className="min-w-[12rem] flex-1"
      >
        <Input
          value={value}
          maxLength={60}
          onChange={(event) => setValue(event.target.value)}
        />
      </Field>
      <Button
        locale={locale}
        type="submit"
        variant="secondary"
        loading={saving}
        disabled={value.trim() === name}
      >
        {m.common.save}
      </Button>
    </form>
  );
}
