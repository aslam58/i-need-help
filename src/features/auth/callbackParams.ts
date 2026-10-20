/** Parse only the exact app callback. Never log URLs, codes or session tokens. */
export function parseConfirmationCallback(url: string, expectedRedirect: string):
  { kind: 'code'; code: string; flowId?: string } | { kind: 'error' } | { kind: 'empty' } {
  try {
    const actual = new URL(url);
    const expected = new URL(expectedRedirect);
    if (actual.protocol !== expected.protocol || actual.host !== expected.host || actual.pathname !== expected.pathname || actual.username || actual.password) return { kind: 'error' };
    const fragment = new URLSearchParams(actual.hash.slice(1));
    if (actual.searchParams.has('error') || actual.searchParams.has('error_code') || fragment.has('error') || fragment.has('error_code') || fragment.has('access_token') || fragment.has('refresh_token')) return { kind: 'error' };
    const codes = actual.searchParams.getAll('code');
    if (!codes.length) return { kind: 'empty' };
    if (codes.length !== 1 || !/^[A-Za-z0-9_-]{1,2048}$/.test(codes[0])) return { kind: 'error' };
    const flows = actual.searchParams.getAll('sb_flow_id');
    if (flows.length > 1 || (flows.length === 1 && !/^[A-Za-z0-9_-]{1,256}$/.test(flows[0]))) return { kind: 'error' };
    return { kind: 'code', code: codes[0], ...(flows.length ? { flowId: flows[0] } : {}) };
  } catch { return { kind: 'error' }; }
}
