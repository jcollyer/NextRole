'use client';

import { useMemo, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { importCompanies } from './actions';

const requiredColumns = ['Company'];

export function CsvImport() {
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const validRows = useMemo(
    () => rows.filter((row) => requiredColumns.every((column) => row[column]?.trim())),
    [rows],
  );

  async function onFileChange(file: File | undefined) {
    setError(null);
    setRows([]);
    setHeaders([]);
    setFileName(file?.name ?? null);
    setIsImporting(false);
    if (!file) return;

    let parsed: { headers: string[]; rows: Array<Record<string, string>> };
    try {
      parsed = await parseCompanyFile(file);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Could not read the uploaded file.');
      return;
    }
    if (!parsed.headers.length) {
      setError('No headers found in the uploaded file.');
      return;
    }
    if (!parsed.headers.includes('Company')) {
      setError('File must include a Company column.');
    }
    setHeaders(parsed.headers);
    setRows(parsed.rows);
  }

  return (
    <div className="grid gap-5">
      <label className="grid gap-2 text-sm font-medium">
        CSV or Excel file
        <input
          type="file"
          accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          onChange={(event) => onFileChange(event.target.files?.[0])}
          className="border-input bg-background rounded-md border p-2 text-sm"
        />
      </label>

      {error ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div> : null}

      {rows.length ? (
        <>
          <div className="text-muted-foreground text-sm">
            Previewing {rows.length} rows{fileName ? ` from ${fileName}` : ''}. {validRows.length} rows have the
            required Company value.
          </div>
          <div className="max-h-[420px] overflow-auto rounded-lg border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  {headers.map((header) => (
                    <th key={header} className="px-3 py-2 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.slice(0, 25).map((row, index) => (
                  <tr key={index} className={!row.Company?.trim() ? 'bg-amber-50/70' : undefined}>
                    {headers.map((header) => (
                      <td key={header} className="max-w-[260px] truncate px-3 py-2">
                        {row[header]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form action={importCompanies} onSubmit={() => setIsImporting(true)}>
            <input type="hidden" name="rows" value={JSON.stringify(validRows)} />
            <Button type="submit" disabled={!validRows.length || isImporting}>
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isImporting ? 'Importing companies...' : `Import ${validRows.length} companies`}
            </Button>
            {isImporting ? (
              <p className="text-muted-foreground mt-2 text-sm" aria-live="polite">
                Importing and checking for duplicate companies. This can take a moment for larger files.
              </p>
            ) : null}
          </form>
        </>
      ) : null}
    </div>
  );
}

async function parseCompanyFile(file: File) {
  const name = file.name.toLowerCase();

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseSpreadsheet(file);
  }

  if (name.endsWith('.csv') || file.type === 'text/csv') {
    return parseCsv(await file.text());
  }

  throw new Error('Unsupported file type. Upload a CSV, XLSX, or XLS file.');
}

async function parseSpreadsheet(file: File) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { headers: [], rows: [] };

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return { headers: [], rows: [] };

  const records = XLSX.utils.sheet_to_json<Array<string | number | boolean | Date | null>>(sheet, {
    header: 1,
    blankrows: false,
    defval: '',
    raw: false,
  });

  return recordsToRows(records);
}

function parseCsv(input: string) {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) records.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some(Boolean)) records.push(row);

  return recordsToRows(records);
}

function recordsToRows(records: Array<Array<string | number | boolean | Date | null>>) {
  const headers = (records[0] ?? [])
    .map((header) => stringifyCell(header))
    .map((header, index) => header || `Column ${index + 1}`);

  const rows = records.slice(1).map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, stringifyCell(record[index])])),
  );

  return { headers, rows };
}

function stringifyCell(value: string | number | boolean | Date | null | undefined) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}
