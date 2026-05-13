/**
 * Structured log details format: `key::param1::param2::...`
 * OR JSON `{ k, t, n, c: [{ f, from, to }] }` for field-level changes.
 * Parsed at display time and translated via i18n.
 * Legacy (plain text) details are returned as-is.
 */

import type { ChangeSummary } from './buildChangeSummary';
import { getFieldLabel, isImageField } from './fieldLabels';

const KNOWN_KEYS = [
  'archived', 'restored', 'created', 'edited',
  'assignResponsible', 'assignOccupant', 'removeOccupant',
  'expiryUpdate', 'leaseExpiryUpdate', 'statusChange', 'dateCorrection',
  'autoArchived',
] as const;

type TFunc = (key: string, options?: Record<string, string>) => string;

function formatChangeLine(
  change: { f: string; from: string | null; to: string | null },
  entityType: string,
  t: TFunc,
  lang: string,
): string {
  const label = getFieldLabel(entityType, change.f, lang);
  if (isImageField(change.f)) {
    if (change.to && !change.from) return t('logDetails.photoUploaded', { field: label });
    if (!change.to && change.from) return t('logDetails.photoRemoved', { field: label });
    return t('logDetails.photoUploaded', { field: label });
  }
  if (change.from && change.to) {
    return t('logDetails.fieldChanged', { field: label, from: change.from, to: change.to });
  }
  if (!change.from && change.to) {
    return t('logDetails.fieldAdded', { field: label, to: change.to });
  }
  if (change.from && !change.to) {
    return t('logDetails.fieldCleared', { field: label });
  }
  return `${label}`;
}

function formatChangeSummaryText(obj: ChangeSummary, t: TFunc, lang: string): string {
  const typeLabel = t(`logDetails.types.${obj.t}`, { defaultValue: obj.t });
  if (!obj.c || obj.c.length === 0) {
    return t('logDetails.edited', { type: typeLabel, name: obj.n });
  }
  const lines = obj.c.map((ch) => formatChangeLine(ch, obj.t, t, lang));
  const summary = lines.join('، ');
  return t('logDetails.editedWithChanges', { type: typeLabel, name: obj.n, summary });
}

/**
 * Extract individual change lines from a JSON details string for expanded display.
 * Returns null if not a JSON change summary.
 */
export function extractChangeLines(
  details: string | undefined,
  t: TFunc,
  lang: string,
): { entityLabel: string; lines: string[] } | null {
  if (!details || !details.startsWith('{')) return null;
  try {
    const obj = JSON.parse(details) as ChangeSummary;
    if (!obj.k || !obj.c || !Array.isArray(obj.c)) return null;
    const typeLabel = t(`logDetails.types.${obj.t}`, { defaultValue: obj.t });
    const entityLabel = `${t(`logDetails.${obj.k}`, { type: typeLabel, name: obj.n })}`;
    const lines = obj.c.map((ch) => formatChangeLine(ch, obj.t, t, lang));
    return { entityLabel, lines };
  } catch {
    return null;
  }
}

/**
 * Check if details contains a JSON change summary with multiple changes.
 */
export function hasExpandableChanges(details: string | undefined): boolean {
  if (!details || !details.startsWith('{')) return false;
  try {
    const obj = JSON.parse(details);
    return Array.isArray(obj.c) && obj.c.length > 0;
  } catch {
    return false;
  }
}

export function translateLogDetails(details: string | undefined, t: TFunc, lang?: string): string {
  if (!details) return '—';

  if (details.startsWith('{')) {
    try {
      const obj = JSON.parse(details) as ChangeSummary;
      if (obj.k && obj.t && obj.n) {
        return formatChangeSummaryText(obj, t, lang || 'ar');
      }
    } catch { /* fall through to legacy parsing */ }
  }

  const parts = details.split('::');
  if (parts.length < 2 || !KNOWN_KEYS.includes(parts[0] as (typeof KNOWN_KEYS)[number])) {
    return details;
  }

  const [key, ...params] = parts;

  switch (key) {
    case 'archived':
      return t('logDetails.archived', { type: t(`logDetails.types.${params[0]}`, { defaultValue: params[0] || '' }), name: params[1] || '', performer: params[2] || '' });
    case 'restored':
      return t('logDetails.restored', { type: t(`logDetails.types.${params[0]}`, { defaultValue: params[0] || '' }), name: params[1] || '', performer: params[2] || '' });
    case 'autoArchived':
      return t('logDetails.autoArchived', { type: t(`logDetails.types.${params[0]}`, { defaultValue: params[0] || '' }), name: params[1] || '' });
    case 'created':
      return t('logDetails.created', { type: t(`logDetails.types.${params[0]}`, { defaultValue: params[0] || '' }), name: params[1] || '' });
    case 'edited':
      return t('logDetails.edited', { type: t(`logDetails.types.${params[0]}`, { defaultValue: params[0] || '' }), name: params[1] || '' });
    case 'assignResponsible':
      return t('logDetails.assignResponsible', { name: params[0] || '', plate: params[1] || '' });
    case 'assignOccupant':
      return t('logDetails.assignOccupant', { name: params[0] || '', unit: params[1] || '' });
    case 'removeOccupant':
      return t('logDetails.removeOccupant', { name: params[0] || '', unit: params[1] || '' });
    case 'expiryUpdate':
      return t('logDetails.expiryUpdate', { doc: t(`logDetails.docs.${params[0]}`, { defaultValue: params[0] || '' }), date: params[1] || '' });
    case 'leaseExpiryUpdate':
      return t('logDetails.leaseExpiryUpdate', { date: params[0] || '', extra: params[1] || '' });
    case 'statusChange':
      return t('logDetails.statusChange', { status: params[0] || '', extra: params[1] || '' });
    case 'dateCorrection':
      return t('logDetails.dateCorrection', { info: params[0] || '' });
    default:
      return details;
  }
}
