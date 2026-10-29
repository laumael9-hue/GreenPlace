// Set when the owner chooses "Go to dashboard" on the Pending Approval screen.
// Until they sign out they browse as a resident; business tools stay locked by
// VerifiedBusinessRoute.
export const SKIP_PENDING_KEY = 'gp_skip_pending_approval';

export function isPendingSkipped() {
  try {
    return sessionStorage.getItem(SKIP_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function skipPendingApproval() {
  try { sessionStorage.setItem(SKIP_PENDING_KEY, '1'); } catch { /* storage unavailable */ }
}

export function clearPendingSkip() {
  try { sessionStorage.removeItem(SKIP_PENDING_KEY); } catch { /* storage unavailable */ }
}
