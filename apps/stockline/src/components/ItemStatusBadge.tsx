import type { Locale } from '@peera/i18n';
import { StatusBadge, type StatusTone } from '@peera/ui';
import { Archive, Check } from 'lucide-react';
import type { ItemStatus } from '../domain/stock';
import { translator } from '../i18n';

const tones: Record<ItemStatus, StatusTone> = {
  ok: 'neutral',
  low: 'warning',
  out: 'danger',
};

/** Stock status as icon + word (never color alone). `ok` stays quiet so low and out stand out in long lists. */
export function ItemStatusBadge({
  status,
  locale,
  archived = false,
  className,
}: {
  status: ItemStatus;
  locale: Locale;
  archived?: boolean;
  className?: string;
}) {
  const { m } = translator(locale);
  if (archived)
    return (
      <StatusBadge
        tone="neutral"
        icon={Archive}
        label={m.status.archived}
        locale={locale}
        className={className}
      />
    );
  return (
    <StatusBadge
      tone={tones[status]}
      icon={status === 'ok' ? Check : undefined}
      label={m.status[status]}
      locale={locale}
      className={className}
    />
  );
}
