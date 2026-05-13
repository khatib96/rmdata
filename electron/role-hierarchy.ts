/**
 * ترتيب الأدوار: رقم أعلى = سلطة أعلى (المرتبة العليا تدير ما تحتها فقط).
 * يجب أن يبقى متوافقاً مع `src/utils/roleHierarchy.ts`.
 */
export function rankFromRoleName(name: string | null | undefined): number {
  const n = String(name ?? '').trim();
  const map: Record<string, number> = {
    Admin: 1000,
    Manager: 750,
    Staff: 500,
    Viewer: 250,
    Employee: 500,
  };
  return map[n] ?? 0;
}
