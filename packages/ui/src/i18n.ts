export type Locale = 'en' | 'th';
export type TypeStyle =
  | 'display-xl'
  | 'display-lg'
  | 'headline-lg'
  | 'headline-md'
  | 'headline-sm'
  | 'title'
  | 'body-lg'
  | 'body'
  | 'body-sm'
  | 'ui'
  | 'label'
  | 'code';

/** Returns the locale-specific type token class. Code typography is not localized. */
export function ts(style: TypeStyle, locale: Locale): string {
  return locale === 'th' && style !== 'code' ? `${style}-th` : style;
}
