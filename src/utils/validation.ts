/** Loose email check — full RFC validation is overkill for internal ERP fields. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** UAE / international style: digits, optional leading +, spaces, hyphens; min 7 digits total. */
const PHONE_RE = /^[\d\s\-+()]{7,20}$/;
const PHONE_DIGITS_RE = /\d/g;

const URL_RE = /^https?:\/\/[^\s]+$/i;

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return EMAIL_RE.test(v);
}

/** Empty string is valid (optional field). */
export function isOptionalEmail(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  return isValidEmail(v);
}

export function isValidPhone(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (!PHONE_RE.test(v)) return false;
  const digits = (v.match(PHONE_DIGITS_RE) || []).length;
  return digits >= 7;
}

export function isOptionalPhone(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  return isValidPhone(v);
}

export function isValidHttpUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  try {
    if (!URL_RE.test(v)) return false;
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isOptionalHttpUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  return isValidHttpUrl(v);
}
