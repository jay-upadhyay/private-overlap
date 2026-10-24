import type { CustomerRecord } from '../../data/scenario';
import { normalizeField, type MatchField } from '../../data/normalize';

/** The fields of a record the PSI stages read. Banlist and customer records both fit. */
export type IdentifierRecord = Pick<CustomerRecord, 'rowId' | MatchField>;

/** A record left out because its identifier did not normalize. */
export interface SkippedRecord {
  rowId: string;
  field: MatchField;
  raw: string;
}

export interface PreparedSet {
  /** Distinct normalized values. Duplicates are sent once so the other side cannot see them. */
  values: string[];
  /** values[i] -> rowIds that carry it. */
  rowIds: string[][];
  skipped: SkippedRecord[];
}

/** Normalizes one field of every record, drops failures and groups duplicates. */
export function prepareSet(records: readonly IdentifierRecord[], field: MatchField): PreparedSet {
  const index = new Map<string, number>();
  const values: string[] = [];
  const rowIds: string[][] = [];
  const skipped: SkippedRecord[] = [];
  for (const record of records) {
    const raw = record[field];
    const value = normalizeField(field, raw);
    if (value === null) {
      skipped.push({ rowId: record.rowId, field, raw });
      continue;
    }
    let i = index.get(value);
    if (i === undefined) {
      i = values.length;
      index.set(value, i);
      values.push(value);
      rowIds.push([]);
    }
    rowIds[i]!.push(record.rowId);
  }
  return { values, rowIds, skipped };
}
