export type FollowerImpact = {
  enabled: boolean;
  initialFollowers: number;
  currentFollowers: number;
  impact: number;
  impactRate: number | null;
};

function followerCount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

/**
 * Calculate account growth from the user-defined starting point. A missing
 * current snapshot means the account is still at its baseline, not at zero.
 */
export function calculateFollowerImpact(
  initialFollowers: number | null | undefined,
  currentFollowers: number | null | undefined
): FollowerImpact {
  const initial = followerCount(initialFollowers);
  const current = currentFollowers === null || currentFollowers === undefined
    ? initial
    : followerCount(currentFollowers);
  const enabled = initial > 0;
  const impact = enabled ? current - initial : 0;

  return {
    enabled,
    initialFollowers: initial,
    currentFollowers: current,
    impact,
    impactRate: enabled ? impact / initial : null,
  };
}
