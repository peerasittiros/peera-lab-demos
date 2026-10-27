'use client';

import type { Locale } from '@peera/i18n';
import { useRole } from '../client-store/role';
import { translator } from '../i18n';
import { AppLink } from './AppLink';
import { ItemsList } from './ItemsList';
import { PageHeader } from './PageHeader';
import { buttonLink } from './styles';

/** The items page: the header (import and add are for the owner) and the list. */
export function ItemsView({ locale }: { locale: Locale }) {
  const { m } = translator(locale);
  const owner = useRole() === 'owner';
  return (
    <>
      <PageHeader
        locale={locale}
        title={m.items.title}
        actions={
          <>
            <AppLink href={`/${locale}/items/labels`} className={buttonLink(locale, 'ghost')}>
              {m.items.labels}
            </AppLink>
            {owner ? (
              <>
                <AppLink href={`/${locale}/import`} className={buttonLink(locale, 'secondary')}>
                  {m.items.import}
                </AppLink>
                {/* On phones Add item lives in the bottom action bar (ItemsList). */}
                <AppLink href={`/${locale}/items/new`} className={`${buttonLink(locale, 'primary')} max-md:hidden`}>
                  {m.items.add}
                </AppLink>
              </>
            ) : null}
          </>
        }
      />
      <ItemsList locale={locale} />
    </>
  );
}
