import type { Locale } from './locale';

export type PluralMessage = { one: string; other: string };
export type MessageTree = {
  readonly [key: string]: string | PluralMessage | MessageTree;
};
export type MessageKey<T extends MessageTree> = {
  [K in keyof T & string]: T[K] extends string | PluralMessage
    ? K
    : T[K] extends MessageTree
      ? `${K}.${MessageKey<T[K]>}`
      : never;
}[keyof T & string];

type WidenMessages<T> = {
  readonly [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends PluralMessage
      ? { readonly one: string; readonly other: string }
      : T[K] extends object
        ? WidenMessages<T[K]>
        : never;
};

export function defineMessages<T extends MessageTree = MessageTree>() {
  return <const M extends T>(messages: M): WidenMessages<M> =>
    messages as unknown as WidenMessages<M>;
}

export type Interpolation = Record<string, string | number>;

type MessageNode = string | PluralMessage | MessageTree;

/** A leaf is a string or a plural pair; a namespace that happens to contain a key named "one" is not. */
function isLeaf(node: MessageNode): node is string | PluralMessage {
  return (
    typeof node === 'string' ||
    (typeof node.one === 'string' && typeof node.other === 'string')
  );
}

function lookup(messages: MessageTree, key: string): string | PluralMessage {
  let current: MessageNode = messages;
  for (const segment of key.split('.')) {
    if (isLeaf(current)) throw new Error(`Unknown message key: ${key}`);
    const next: MessageNode | undefined = current[segment];
    if (next === undefined) throw new Error(`Unknown message key: ${key}`);
    current = next;
  }
  if (isLeaf(current)) return current;
  throw new Error(`Message key is a namespace, not a value: ${key}`);
}

function interpolate(message: string, params: Interpolation = {}): string {
  return message.replace(/\{([\w.]+)\}/g, (placeholder, name: string) => {
    if (!(name in params))
      throw new Error(`Missing interpolation value: ${name}`);
    return String(params[name]);
  });
}

export type Translator<M extends MessageTree> = <K extends MessageKey<M>>(
  key: K,
  params?: Interpolation,
) => string;

export function getT<M extends MessageTree>(
  _locale: Locale,
  messages: M,
): Translator<M> {
  return ((key: string, params?: Interpolation) => {
    const value = lookup(messages, key);
    if (typeof value !== 'string')
      throw new Error(`Message key requires getPluralT(): ${key}`);
    return interpolate(value, params);
  }) as Translator<M>;
}

export function getPluralT<M extends MessageTree>(locale: Locale, messages: M) {
  return (key: MessageKey<M>, count: number, params: Interpolation = {}) => {
    const value = lookup(messages, key);
    if (typeof value === 'string')
      return interpolate(value, { ...params, count });
    const category =
      locale === 'th' ? 'other' : new Intl.PluralRules('en').select(count);
    return interpolate(value[category === 'one' ? 'one' : 'other'], {
      ...params,
      count,
    });
  };
}
