export function validateInsert(columns: string[], values: any[]): void {
  if (columns.length !== values.length) {
    throw new Error(
      `INSERT validation failed: columns count (${columns.length}) does not match values count (${values.length}).`
    );
  }
}
