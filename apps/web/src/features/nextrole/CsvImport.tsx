'use client';

import { useMemo, useState } from 'react';
import { Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { importCompanies } from './actions';

const requiredColumns = ['Company'];

export function CsvImport() {
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const validRows = useMemo(
    () => rows.filter((row) => requiredColumns.every((column) => row[column]?.trim())),
    [rows],
  );

  async function onFileChange(file: File | undefined) {
    setError(null);
    setRows([]);
    setHeaders([]);
    if (!file) return;

    const text = await file.text();
    const parsed = parseCsv(text);
    if (!parsed.headers.length) {
      setError('No CSV headers found.');
      return;
    }
    if (!parsed.headers.includes('Company')) {
      setError('CSV must include a Company column.');
    }
    setHeaders(parsed.headers);
    setRows(parsed.rows);
  }

  return (
    <div className="grid gap-5">
      <label className="grid gap-2 text-sm font-medium">
        CSV file
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => onFileChange(event.target.files?.[0])}
          className="border-input bg-background rounded-md border p-2 text-sm"
        />
      </label>

      {error ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div> : null}

      {rows.length ? (
        <>
          <div className="text-muted-foreground text-sm">
            Previewing {rows.length} rows. {validRows.length} rows have the required Company value.
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
          <form action={importCompanies}>
            <input type="hidden" name="rows" value={JSON.stringify(validRows)} />
            <Button type="submit" disabled={!validRows.length}>
              <Upload className="h-4 w-4" />
              Import {validRows.length} companies
            </Button>
          </form>
        </>
      ) : null}
    </div>
  );
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

  const headers = records[0] ?? [];
  const rows = records.slice(1).map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ''])),
  );

  return { headers, rows };
}
