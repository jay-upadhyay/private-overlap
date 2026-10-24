import { normalizeField, type MatchField } from './normalize';
import type { CustomerRecord } from './scenario';

/** Normalized match values of an institution's records, aligned with their rowIds. */
export interface IdentifierSet {
  field: MatchField;
  rowIds: string[];
  values: string[];
  /** rowIds whose value failed normalization; they cannot be matched. */
  skipped: string[];
}

export function extractIdentifiers(records: readonly CustomerRecord[], field: MatchField): IdentifierSet {
  const set: IdentifierSet = { field, rowIds: [], values: [], skipped: [] };
  for (const record of records) {
    const value = normalizeField(field, record[field]);
    if (value === null) {
      set.skipped.push(record.rowId);
    } else {
      set.rowIds.push(record.rowId);
      set.values.push(value);
    }
  }
  return set;
}
