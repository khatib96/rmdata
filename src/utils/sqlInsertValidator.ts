function splitSqlList(input: string): string[] {
  const out: string[] = [];
  let buf = '';
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let prev = '';

  for (const ch of input) {
    if (ch === "'" && !inDouble && prev !== '\\') inSingle = !inSingle;
    else if (ch === '"' && !inSingle && prev !== '\\') inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      else if (ch === ',' && depth === 0) {
        const item = buf.trim();
        if (item) out.push(item);
        buf = '';
        prev = ch;
        continue;
      }
    }
    buf += ch;
    prev = ch;
  }

  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

const isDev = process.env.NODE_ENV === 'development';

function findMatchingParenIndex(input: string, openIndex: number): number {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let prev = '';

  for (let i = openIndex; i < input.length; i++) {
    const ch = input[i];
    if (ch === "'" && !inDouble && prev !== '\\') inSingle = !inSingle;
    else if (ch === '"' && !inSingle && prev !== '\\') inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) return i;
      }
    }
    prev = ch;
  }
  return -1;
}

function parseInsertParts(query: string): { tableName: string; columnsPart: string; valuesPart: string } | null {
  const q = String(query || '');
  const lower = q.toLowerCase();
  const insertIntoIdx = lower.indexOf('insert into');
  if (insertIntoIdx === -1) return null;

  const firstParen = q.indexOf('(', insertIntoIdx);
  if (firstParen === -1) return null;

  const tableSegment = q.slice(insertIntoIdx + 'insert into'.length, firstParen).trim();
  if (!tableSegment) return null;

  const columnsClose = findMatchingParenIndex(q, firstParen);
  if (columnsClose === -1) return null;

  const afterColumns = q.slice(columnsClose + 1);
  const valuesKeywordIdx = afterColumns.toLowerCase().indexOf('values');
  if (valuesKeywordIdx === -1) return null;

  const valuesOpen = q.indexOf('(', columnsClose + 1 + valuesKeywordIdx);
  if (valuesOpen === -1) return null;
  const valuesClose = findMatchingParenIndex(q, valuesOpen);
  if (valuesClose === -1) return null;

  return {
    tableName: tableSegment.replace(/[`"]/g, ''),
    columnsPart: q.slice(firstParen + 1, columnsClose),
    valuesPart: q.slice(valuesOpen + 1, valuesClose),
  };
}

export function validateInsertSql(query: string, params?: unknown[]): void {
  const parts = parseInsertParts(query);
  if (!parts) return;

  const tableName = parts.tableName;
  const columns = splitSqlList(parts.columnsPart);
  const values = splitSqlList(parts.valuesPart);
  if (columns.length !== values.length) {
    if (isDev) {
      console.warn(
        `[validateInsertSql] Blocked INSERT on table "${tableName}": columns count (${columns.length}) does not match values count (${values.length}).`,
      );
    }
    throw new Error(
      `INSERT validation failed: columns count (${columns.length}) does not match values count (${values.length}).`,
    );
  }

  if (Array.isArray(params)) {
    const placeholderCount = (parts.valuesPart.match(/\?/g) || []).length;
    if (placeholderCount !== params.length) {
      if (isDev) {
        console.warn(
          `[validateInsertSql] Blocked INSERT params on table "${tableName}": placeholders count (${placeholderCount}) does not match params count (${params.length}).`,
        );
      }
      throw new Error(
        `INSERT parameter validation failed: placeholders count (${placeholderCount}) does not match params count (${params.length}).`,
      );
    }
  }
}
