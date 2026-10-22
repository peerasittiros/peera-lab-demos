'use client';

import { formatTime, type Locale } from '@peera/i18n';
import { Badge, cn, ts } from '@peera/ui';
import { useRef } from 'react';
import { kitStrings } from './strings';

/** A card like a LINE Flex message: title, key/value rows, one button. */
export type ChatCard = {
  title: string;
  rows: [label: string, value: string][];
  button?: string;
};

export type ChatMessage = {
  id: string | number;
  /** `shop` = the official account (left), `customer` = the person chatting (right). */
  from: 'shop' | 'customer';
  at: Date | string;
  text?: string;
  card?: ChatCard;
  quickReplies?: string[];
};

export type LineChatMockProps = {
  locale: Locale;
  shopName: string;
  messages: ChatMessage[];
  className?: string;
};

/**
 * A LINE-style chat preview (no LINE logo, colors or other trademarked assets) for the messages the real system
 * would send. Messages that arrive after the first render slide in, unless reduced motion is on.
 */
export function LineChatMock({
  locale,
  shopName,
  messages,
  className,
}: LineChatMockProps) {
  const strings = kitStrings[locale];
  const initial = useRef<Set<ChatMessage['id']> | null>(null);
  initial.current ??= new Set(messages.map((message) => message.id));

  return (
    <figure lang={locale} className={cn('m-0 flex flex-col gap-2', className)}>
      <div className="overflow-hidden rounded-md border border-line bg-surface-sunken">
        <div className="flex items-center gap-2 border-b border-line bg-surface-raised px-4 py-3">
          <span className={cn(ts('ui', locale), 'font-medium text-ink')}>
            {shopName}
          </span>
          <Badge locale={locale}>{strings.officialAccount}</Badge>
        </div>
        <div role="log" aria-live="polite" aria-label={strings.chatLog}>
          {/* The log role goes on a wrapper: on the <ol> itself it would drop the list semantics. */}
          <ol className="m-0 flex list-none flex-col gap-3 p-4">
            {messages.map((message) => {
              const mine = message.from === 'customer';
              return (
                <li
                  key={message.id}
                  className={cn(
                    'flex max-w-[85%] flex-col gap-1',
                    mine ? 'items-end self-end' : 'items-start self-start',
                    !initial.current?.has(message.id) && 'peera-chat-in',
                  )}
                >
                  {message.text ? (
                    <p
                      className={cn(
                        ts('body-sm', locale),
                        'm-0 rounded-md px-3 py-2 whitespace-pre-line text-ink',
                        mine
                          ? 'bg-product-accent-soft'
                          : 'border border-line bg-surface-raised',
                      )}
                    >
                      {message.text}
                    </p>
                  ) : null}
                  {message.card ? (
                    <div className="w-64 max-w-full overflow-hidden rounded-md border border-line bg-surface-raised">
                      <p
                        className={cn(
                          ts('title', locale),
                          'm-0 border-b border-line px-3 py-2 text-ink',
                        )}
                      >
                        {message.card.title}
                      </p>
                      <dl
                        className={cn(
                          ts('body-sm', locale),
                          'm-0 grid gap-1 px-3 py-2',
                        )}
                      >
                        {message.card.rows.map(([label, value]) => (
                          <div
                            key={label}
                            className="flex justify-between gap-3"
                          >
                            <dt className="text-ink-muted">{label}</dt>
                            <dd className="m-0 text-right text-ink tabular-nums">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      {message.card.button ? (
                        <p
                          className={cn(
                            ts('ui', locale),
                            'm-0 border-t border-line px-3 py-2 text-center text-product-accent',
                          )}
                        >
                          {message.card.button}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <time
                    dateTime={new Date(message.at).toISOString()}
                    className={cn(ts('body-sm', locale), 'text-ink-muted')}
                  >
                    {formatTime(message.at, locale)}
                  </time>
                  {message.quickReplies?.length ? (
                    <ul
                      aria-label={strings.quickReplies}
                      className="m-0 flex list-none flex-wrap gap-2 p-0"
                    >
                      {message.quickReplies.map((reply) => (
                        <li
                          key={reply}
                          className={cn(
                            ts('ui', locale),
                            'rounded-sm border border-line-strong bg-surface-raised px-3 py-1 text-ink',
                          )}
                        >
                          {reply}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <figcaption className={cn(ts('body-sm', locale), 'text-ink-muted')}>
        {strings.chatCaption}
      </figcaption>
    </figure>
  );
}
