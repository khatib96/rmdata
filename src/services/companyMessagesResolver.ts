/**
 * Resolves a single company message (dua/motivation) for the dashboard widget
 * from the catalog at /data/company_messages_api_ready.json.
 * Logic follows docs/company_messages_api_ready_spec.md (priority: ramadan → friday → morning → evening → motivation → general → quick).
 */

const CATALOG_URL = './data/company_messages_api_ready.json';
const STORAGE_KEY_LAST_ID = 'company_message_last_id';
const STORAGE_KEY_LAST_AT = 'company_message_last_at';
const COOLDOWN_MS = 180 * 60 * 1000; // 180 minutes

export interface CompanyMessage {
  id: string;
  code: string;
  category: string;
  text_ar: string;
  enabled: boolean;
  weight: number;
}

interface CatalogMessage {
  id: string;
  code?: string;
  category: string;
  text_ar: string;
  enabled?: boolean;
  weight?: number;
}

interface Catalog {
  selection_engine: {
    category_priority_order: string[];
  };
  messages: CatalogMessage[];
}

let cachedCatalog: Catalog | null = null;

export async function loadCatalog(): Promise<Catalog> {
  if (cachedCatalog) return cachedCatalog;
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error(`Failed to load catalog: ${res.status}`);
  const data = (await res.json()) as Catalog;
  if (!data?.messages?.length || !data?.selection_engine?.category_priority_order) {
    throw new Error('Invalid catalog structure');
  }
  cachedCatalog = data;
  return data;
}

/** Hijri month 1–12 in user's local timezone; 9 = Ramadan */
function getHijriMonth(now: Date): number {
  const formatter = new Intl.DateTimeFormat('en-CA-u-ca-islamic', { month: 'numeric' });
  const monthStr = formatter.format(now);
  const n = parseInt(monthStr, 10);
  return Number.isFinite(n) ? n : 1;
}

/** Weekday 0–6 (Sun–Sat) in user's local timezone; 5 = Friday */
function getLocalWeekday(now: Date): number {
  return now.getDay();
}

/** Hour and minute in user's local timezone (for morning/evening windows) */
function getLocalHourMinute(now: Date): { hour: number; minute: number } {
  return { hour: now.getHours(), minute: now.getMinutes() };
}

/** Active category by spec priority: ramadan → friday → morning → evening → motivation (fallback) → general → quick. Uses device location/timezone. */
function getActiveCategory(now: Date): string {
  const hijriMonth = getHijriMonth(now);
  const weekday = getLocalWeekday(now);
  const { hour } = getLocalHourMinute(now);

  if (hijriMonth === 9) return 'ramadan';
  if (weekday === 5) return 'friday';
  if (hour >= 7 && hour < 11) return 'morning';
  if (hour >= 16 && hour < 18) return 'evening';
  return 'motivation';
}

function getCandidates(catalog: Catalog, category: string): CompanyMessage[] {
  const list: CompanyMessage[] = [];
  for (const m of catalog.messages) {
    if (m.category !== category) continue;
    const enabled = m.enabled !== false;
    if (!enabled) continue;
    list.push({
      id: m.id,
      code: m.code ?? m.id,
      category: m.category,
      text_ar: m.text_ar,
      enabled,
      weight: typeof m.weight === 'number' && m.weight > 0 ? m.weight : 1,
    });
  }
  return list;
}

/** Weighted random pick from candidates */
function weightedRandomPick(candidates: CompanyMessage[]): CompanyMessage | null {
  if (candidates.length === 0) return null;
  const total = candidates.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * total;
  for (const c of candidates) {
    r -= c.weight;
    if (r <= 0) return c;
  }
  return candidates[candidates.length - 1];
}

/** Try fallback categories (motivation, general, quick) if primary has no candidates */
function resolveWithFallback(catalog: Catalog, primaryCategory: string): CompanyMessage | null {
  const order = catalog.selection_engine.category_priority_order;
  const fallbacks = order.filter((c) => ['motivation', 'general', 'quick'].includes(c));
  const toTry = [primaryCategory, ...fallbacks.filter((c) => c !== primaryCategory)];
  for (const cat of toTry) {
    const candidates = getCandidates(catalog, cat);
    const picked = weightedRandomPick(candidates);
    if (picked) return picked;
  }
  return null;
}

/** Dedup: avoid same message within cooldown; optionally exclude last id from candidates for next pick */
function getLastStored(): { id: string; at: number } | null {
  try {
    const id = sessionStorage.getItem(STORAGE_KEY_LAST_ID);
    const at = sessionStorage.getItem(STORAGE_KEY_LAST_AT);
    if (id && at) return { id, at: parseInt(at, 10) };
  } catch {
    // ignore
  }
  return null;
}

function setLastStored(id: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY_LAST_ID, id);
    sessionStorage.setItem(STORAGE_KEY_LAST_AT, String(Date.now()));
  } catch {
    // ignore
  }
}

/**
 * Resolves one message for the given date. Uses catalog priority and time/hijri/weekday rules.
 * Returns null on load error or empty catalog; caller should show fallback text.
 */
export async function resolveMessage(now: Date): Promise<{ text_ar: string; id: string } | null> {
  const catalog = await loadCatalog();
  const category = getActiveCategory(now);
  let candidates = getCandidates(catalog, category);
  const last = getLastStored();
  const nowMs = Date.now();
  if (last && nowMs - last.at < COOLDOWN_MS && last.id) {
    candidates = candidates.filter((c) => c.id !== last.id);
  }
  let picked = weightedRandomPick(candidates);
  if (!picked) picked = resolveWithFallback(catalog, category);
  if (!picked) return null;
  setLastStored(picked.id);
  return { text_ar: picked.text_ar, id: picked.id };
}
