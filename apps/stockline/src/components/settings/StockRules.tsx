'use client';

import type { Locale } from '@peera/i18n';
import { Button, Field, Select, Skeleton, toast } from '@peera/ui';
import { useState, type FormEvent } from 'react';
import { useStoreInstance, useStoreState } from '../../client-store/hooks';
import { saveSettings } from '../../client-store/master-commands';
import type { Settings } from '../../client-store/ops';
import { translator, weekdayName } from '../../i18n';
import { ChipGroup } from '../ChipGroup';
import { PageHeader } from '../PageHeader';

/** When an item counts as low, and the reorder day. */
export function StockRules({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const { ledger, status } = useStoreState();
  const page = m.settings.pages.stock;
  return (
    <>
      <PageHeader locale={locale} title={page.title} description={page.body} />
      {!ledger || status === 'loading' ? (
        <Skeleton locale={locale} lines={4} />
      ) : (
        <RulesForm locale={locale} settings={ledger.settings} />
      )}
    </>
  );
}

function RulesForm({
  locale,
  settings,
}: {
  locale: Locale;
  settings: Settings;
}) {
  const { m } = translator(locale);
  const s = m.settings;
  const store = useStoreInstance();
  const [lowStockRule, setLowStockRule] = useState<string>(
    settings.lowStockRule,
  );
  const [reorderWeekday, setReorderWeekday] = useState(
    String(settings.reorderWeekday),
  );
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const result = store
      ? await saveSettings(
          store,
          {
            lowStockRule: lowStockRule as Settings['lowStockRule'],
            reorderWeekday: Number(reorderWeekday),
          },
          'owner',
        )
      : null;
    setSaving(false);
    toast({ title: result?.ok ? s.saved : m.errors.unexpected });
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex max-w-[40rem] flex-col gap-5"
    >
      <ChipGroup
        locale={locale}
        legend={s.lowStockRule}
        value={lowStockRule}
        onChange={setLowStockRule}
        chips={[
          { value: 'at_or_below_min', label: s.ruleAtOrBelow },
          { value: 'below_min', label: s.ruleBelow },
        ]}
      />
      <Field
        locale={locale}
        label={s.reorderDay}
        hint={s.reorderDayHint}
        className="max-w-[16rem]"
      >
        <Select
          locale={locale}
          value={reorderWeekday}
          onValueChange={setReorderWeekday}
          options={[1, 2, 3, 4, 5, 6, 7].map((day) => ({
            value: String(day),
            label: weekdayName(locale, day),
          }))}
        />
      </Field>
      <div>
        <Button
          locale={locale}
          type="submit"
          variant="primary"
          loading={saving}
        >
          {s.saveRules}
        </Button>
      </div>
    </form>
  );
}
