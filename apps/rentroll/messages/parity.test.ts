import { expectParity } from '@peera/i18n/parity';
import { it } from 'vitest';
import { en } from './en';
import { th } from './th';

it('has the same keys in Thai and English, none empty', () => {
  expectParity(en, th);
});
