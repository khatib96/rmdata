import { dbQuery } from './dbClient';

export type RecentActivityRow = {
  id: number;
  createdAt: string;
  details?: string;
  action: string;
  module: string;
  entityType: string;
  performedByUsername?: string;
};

export function getRecentDashboardActivities(options?: { signal?: AbortSignal }) {
  return dbQuery<RecentActivityRow[]>(
    `SELECT id, createdAt, details, action, module, entityType, performedByUsername
     FROM activity_logs
     ORDER BY createdAt DESC LIMIT 5`,
    undefined,
    { signal: options?.signal }
  );
}

