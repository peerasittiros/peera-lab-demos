import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import customLiterals from './no-literal-string.js';
import noRawDb from './no-raw-db.js';

const peera = { rules: { ...customLiterals.rules, 'no-raw-db': noRawDb } };

export default [
  {
    ignores: [
      '**/.next/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: { console: 'readonly', process: 'readonly', Buffer: 'readonly' },
    },
    plugins: { '@typescript-eslint': tsPlugin, '@peera': peera },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // TypeScript already reports undefined names, and no-undef can't see DOM or React types.
    files: ['**/*.{ts,tsx}'],
    rules: { 'no-undef': 'off' },
  },
  {
    files: ['apps/**/*.{jsx,tsx}'],
    rules: { '@peera/no-literal-string': 'error' },
  },
  {
    // App code queries tenant tables through withTenant(); schema, seed, clone, scripts and tests may go raw.
    files: ['apps/**/*.{ts,tsx}'],
    ignores: [
      'apps/*/src/db/**',
      'apps/*/scripts/**',
      'apps/**/*.test.{ts,tsx}',
    ],
    rules: { '@peera/no-raw-db': 'error' },
  },
];
