export interface CustomRow {
  id: string;
  key: string;
  value: string;
  isDate: boolean;
  enableAlert?: boolean;
  alertDate?: string;
  daysBeforeExpiry?: number;
}

export interface CustomSection {
  id: string;
  title: string;
  rows: CustomRow[];
}
