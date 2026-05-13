export const API_SESSION_TOKEN_KEY = 'rmdata_api_session_token';

export function clearApiSessionToken() {
  try {
    sessionStorage.removeItem(API_SESSION_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
