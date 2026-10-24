/** How long after opening a reset link the user may set a new password. */
export const RECOVERY_WINDOW_SECONDS = 15 * 60;

type Amr = { method?: string; timestamp?: number }[] | undefined | null;

/** True when this session came from a reset link (email one-time code) in the last 15 minutes. */
export function isFreshRecoverySession(amr: Amr, nowSeconds: number): boolean {
  return (amr ?? []).some(
    (entry) =>
      (entry.method === "otp" || entry.method === "recovery") &&
      typeof entry.timestamp === "number" &&
      nowSeconds - entry.timestamp <= RECOVERY_WINDOW_SECONDS,
  );
}

/**
 * A new password can be set without the current one only when the school forced a change,
 * or right after a reset link. A normal logged-in session (possibly stolen) cannot.
 */
export function canSetPasswordWithoutCurrent(opts: {
  mustChangePassword: boolean;
  amr: Amr;
  nowSeconds: number;
}) {
  return (
    opts.mustChangePassword || isFreshRecoverySession(opts.amr, opts.nowSeconds)
  );
}
