export interface FieldChange {
  f: string;
  from: string | null;
  to: string | null;
}

export interface ChangeSummary {
  k: 'edited' | 'created';
  t: string;
  n: string;
  c: FieldChange[];
}

function normalize(val: unknown): string | null {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  return s === '' ? null : s;
}

export function buildChangeSummary(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  entityType: string,
  entityName: string,
  trackedFields: string[],
): string {
  const changes: FieldChange[] = [];
  for (const field of trackedFields) {
    const oldVal = normalize(oldData[field]);
    const newVal = normalize(newData[field]);
    if (oldVal === newVal) continue;
    changes.push({ f: field, from: oldVal, to: newVal });
  }
  if (changes.length === 0) {
    return `edited::${entityType}::${entityName}`;
  }
  const summary: ChangeSummary = {
    k: 'edited',
    t: entityType,
    n: entityName,
    c: changes,
  };
  return JSON.stringify(summary);
}
