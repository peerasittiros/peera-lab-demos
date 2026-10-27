'use client';

import type { Locale } from '@peera/i18n';
import {
  Button,
  cn,
  Field,
  Select,
  Table,
  Textarea,
  toast,
  ts,
} from '@peera/ui';
import { CircleAlert, FileUp } from 'lucide-react';
import { useState } from 'react';
import { importRows } from '../client-store/master-commands';
import { useStoreInstance, useStoreState } from '../client-store/hooks';
import {
  detectColumns,
  IMPORT_FIELDS,
  MAX_IMPORT_ROWS,
  parseDelimited,
  SAMPLE_CSV,
  validateRows,
  type ImportField,
  type RowError,
  type ValidationResult,
} from '../domain/import';
import { translator } from '../i18n';
import { AppLink } from './AppLink';
import { buttonLink } from './styles';

type Step = 'upload' | 'map' | 'review' | 'done';
const STEPS: Step[] = ['upload', 'map', 'review', 'done'];
const IGNORE = '__ignore__';

/**
 * Import wizard (02 §8 screen 8): Upload → Map columns → Review → Done. Files are read in the browser; the server
 * only receives validated rows.
 */
export function ImportWizard({ locale }: { locale: Locale }) {
  const { t, tp, m } = translator(locale);
  const i = m.import;
  const [step, setStep] = useState<Step>('upload');
  const [table, setTable] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<(ImportField | null)[]>([]);
  const store = useStoreInstance();
  const { ledger } = useStoreState();
  const [paste, setPaste] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{
    imported: number;
    categories: string[];
    units: string[];
  } | null>(null);

  const load = (text: string) => {
    const rows = parseDelimited(text);
    if (rows.length < 2) {
      setError(i.noRows);
      return;
    }
    setError(rows.length - 1 > MAX_IMPORT_ROWS ? i.tooManyRows : null);
    setTable(rows);
    setMapping(detectColumns(rows[0]!));
    setStep('map');
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (/\.(xlsx|xls|ods)$/i.test(file.name)) {
      // SheetJS (02 §7) isn't installed yet; CSV and pasted rows cover the same data.
      setError(i.xlsxUnavailable);
      return;
    }
    try {
      load(await file.text());
    } catch (reason) {
      setError(t('import.parseError', { reason: String(reason) }));
    }
  };

  const review = async () => {
    if (!mapping.includes('nameTh') && !mapping.includes('nameEn')) {
      setError(t('import.requiredField', { field: i.fields.nameTh }));
      return;
    }
    setBusy(true);
    // The shop's existing SKUs and barcodes (archived items included), so the review flags clashes before anything is saved.
    const existingItems = Object.values(ledger?.entities.item ?? {});
    setBusy(false);
    setResult(
      validateRows(table, mapping, {
        skus: new Set(
          existingItems.map((row) => String(row.sku).toLowerCase()),
        ),
        barcodes: new Set(
          existingItems.flatMap((row) =>
            row.barcode ? [String(row.barcode)] : [],
          ),
        ),
      }),
    );
    setError(null);
    setStep('review');
  };

  const run = async () => {
    if (!result || result.rows.length === 0) return;
    setBusy(true);
    const response = store
      ? await importRows(store, result.rows, 'owner')
      : null;
    setBusy(false);
    if (!response?.ok) {
      toast({
        title: t(
          (response?.error.messageKey ??
            'errors.unexpected') as 'errors.unexpected',
        ),
      });
      return;
    }
    setDone(response.data);
    setStep('done');
  };

  const describe = (error: RowError) => {
    const field = error.field ? i.fields[error.field] : '';
    return t(`import.rowErrors.${error.key}`, { field, n: error.row ?? '' });
  };

  const sampleHref = `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${SAMPLE_CSV}`)}`;

  return (
    <div className="flex max-w-[64rem] flex-col gap-6">
      <ol
        className="m-0 flex list-none flex-wrap gap-2 p-0"
        aria-label={t('import.stepOf', { n: STEPS.indexOf(step) + 1 })}
      >
        {STEPS.map((entry, index) => (
          <li
            key={entry}
            aria-current={entry === step ? 'step' : undefined}
            className={cn(
              ts('ui', locale),
              'inline-flex min-h-9 items-center gap-2 rounded-sm border px-3',
              entry === step
                ? 'border-product-accent bg-product-accent-soft text-ink'
                : 'border-line text-ink-muted',
            )}
          >
            <span className="tabular-nums">{index + 1}</span>
            {i.steps[entry]}
          </li>
        ))}
      </ol>

      {error ? (
        <p
          role="alert"
          className={cn(
            ts('body-sm', locale),
            'm-0 flex items-start gap-2 rounded-sm bg-danger-soft p-3 text-ink',
          )}
        >
          <CircleAlert
            aria-hidden
            size={16}
            strokeWidth={1.75}
            className="mt-1 shrink-0 text-danger"
          />
          {error}
        </p>
      ) : null}

      {step === 'upload' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-3 rounded-sm border border-dashed border-line-strong bg-surface-raised p-5">
            <label className="flex flex-col gap-2">
              <span className={cn(ts('ui', locale), 'text-ink')}>
                {i.uploadLabel}
              </span>
              <span className={cn(ts('body-sm', locale), 'text-ink-muted')}>
                {i.uploadHint}
              </span>
              <span
                className={buttonLink(locale, 'secondary', 'mt-2 self-start')}
              >
                <FileUp aria-hidden size={16} strokeWidth={1.75} />
                {i.chooseFile}
              </span>
              <input
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv"
                className="sr-only"
                onChange={(event) => void onFile(event.target.files?.[0])}
              />
            </label>
            <a
              href={sampleHref}
              download="stockline-sample.csv"
              className={cn(
                ts('body-sm', locale),
                'mt-auto text-ink underline',
              )}
            >
              {i.sampleFile}
            </a>
          </section>
          <section className="flex flex-col gap-3">
            <Field locale={locale} label={i.pasteLabel}>
              <Textarea
                rows={7}
                value={paste}
                placeholder={i.pastePlaceholder}
                onChange={(event) => setPaste(event.target.value)}
              />
            </Field>
            <Button
              locale={locale}
              variant="secondary"
              className="self-start"
              disabled={!paste.trim()}
              onClick={() => load(paste)}
            >
              {i.usePaste}
            </Button>
          </section>
        </div>
      ) : null}

      {step === 'map' ? (
        <section className="flex flex-col gap-4">
          <p className={cn(ts('body', locale), 'm-0 text-ink-muted')}>
            {i.mapHint}
          </p>
          <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
            {table[0]!.map((header, column) => (
              <li
                key={column}
                className="flex flex-col gap-2 rounded-sm border border-line bg-surface-raised p-3"
              >
                <Field
                  locale={locale}
                  label={header || `#${column + 1}`}
                  hint={table
                    .slice(1, 3)
                    .map((row) => row[column])
                    .filter(Boolean)
                    .join(' · ')}
                >
                  <Select
                    locale={locale}
                    value={mapping[column] ?? IGNORE}
                    onValueChange={(value) =>
                      setMapping((current) =>
                        current.map((entry, at) =>
                          at === column
                            ? value === IGNORE
                              ? null
                              : (value as ImportField)
                            : entry === value
                              ? null
                              : entry,
                        ),
                      )
                    }
                    options={[
                      { value: IGNORE, label: i.ignore },
                      ...IMPORT_FIELDS.map((field) => ({
                        value: field,
                        label: i.fields[field],
                      })),
                    ]}
                  />
                </Field>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              locale={locale}
              variant="ghost"
              onClick={() => setStep('upload')}
            >
              {m.common.back}
            </Button>
            <Button
              locale={locale}
              variant="primary"
              loading={busy}
              disabled={!ledger}
              onClick={() => void review()}
            >
              {m.common.next}
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'review' && result ? (
        <section className="flex flex-col gap-4">
          <p className={cn(ts('title', locale), 'm-0 text-ink')}>
            {tp('import.review.ready', result.rows.length)}
          </p>
          {result.rows.length > 0 ? (
            <div className="overflow-hidden rounded-sm border border-line bg-surface-raised">
              <Table
                locale={locale}
                rows={result.rows.slice(0, 8)}
                rowKey={(row) => row.line}
                columns={[
                  {
                    key: 'line',
                    header: '#',
                    numeric: true,
                    cell: (row) => row.line,
                  },
                  {
                    key: 'name',
                    header: i.fields.nameTh,
                    cell: (row) => row.nameTh,
                  },
                  {
                    key: 'sku',
                    header: i.fields.sku,
                    cell: (row) => row.sku ?? '',
                  },
                  {
                    key: 'unit',
                    header: i.fields.unit,
                    cell: (row) => row.unit ?? '',
                  },
                  {
                    key: 'qty',
                    header: i.fields.quantity,
                    numeric: true,
                    cell: (row) => row.quantity,
                  },
                  {
                    key: 'date',
                    header: i.fields.date,
                    cell: (row) => row.date ?? '',
                  },
                ]}
              />
            </div>
          ) : null}
          {result.invalid.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-sm border border-danger bg-danger-soft p-4">
              <p className={cn(ts('ui', locale), 'm-0 text-ink')}>
                {tp('import.review.invalid', result.invalid.length)}
              </p>
              <p className={cn(ts('body-sm', locale), 'm-0 text-ink')}>
                {i.review.skipInvalid}
              </p>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {result.invalid.map((entry) => (
                  <li
                    key={entry.line}
                    className={cn(ts('body-sm', locale), 'text-ink')}
                  >
                    <span className="font-medium">
                      {t('import.review.row', { n: entry.line })}
                    </span>
                    {`: ${entry.errors.map(describe).join(', ')}`}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              locale={locale}
              variant="ghost"
              onClick={() => setStep('map')}
            >
              {m.common.back}
            </Button>
            <Button
              locale={locale}
              variant="primary"
              loading={busy}
              disabled={result.rows.length === 0}
              onClick={() => void run()}
            >
              {busy
                ? i.importing
                : tp('import.importButton', result.rows.length)}
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'done' && done ? (
        <section className="flex flex-col gap-3 rounded-sm border border-line bg-surface-raised p-5">
          <h2 className={cn(ts('title', locale), 'm-0 text-ink')}>
            {tp('import.doneTitle', done.imported)}
          </h2>
          <p className={cn(ts('body', locale), 'm-0 text-ink-muted')}>
            {i.doneBody}
          </p>
          {done.categories.length > 0 ? (
            <p className={cn(ts('body-sm', locale), 'm-0 text-ink')}>
              {t('import.review.newCategories', {
                names: done.categories.join(', '),
              })}
            </p>
          ) : null}
          {done.units.length > 0 ? (
            <p className={cn(ts('body-sm', locale), 'm-0 text-ink')}>
              {t('import.review.newUnits', { names: done.units.join(', ') })}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <AppLink
              href={`/${locale}/items`}
              className={buttonLink(locale, 'primary')}
            >
              {i.viewItems}
            </AppLink>
            <Button
              locale={locale}
              variant="ghost"
              onClick={() => {
                setTable([]);
                setPaste('');
                setResult(null);
                setStep('upload');
              }}
            >
              {i.again}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
