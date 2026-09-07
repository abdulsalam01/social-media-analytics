export type EngagementRateBasis = "reach" | "plays" | "followers" | null;

export type EngagementInputs = {
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  reposts?: number | null;
  reach?: number | null;
  plays?: number | null;
  followers?: number | null;
};

function count(value: number | null | undefined): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : 0;
}

/**
 * Calculate content engagement from raw counters.
 * Denominator priority follows the data quality available to the app:
 * reach, then video plays, then the latest follower count.
 * A missing denominator returns a null rate instead of dividing by 1.
 */
export function calculateEngagementMetrics(input: EngagementInputs) {
  const engagement =
    count(input.likes) +
    count(input.comments) +
    count(input.shares) +
    count(input.saves) +
    count(input.reposts);

  const reach = count(input.reach);
  const plays = count(input.plays);
  const followers = count(input.followers);

  let denominator = 0;
  let basis: EngagementRateBasis = null;
  if (reach > 0) {
    denominator = reach;
    basis = "reach";
  } else if (plays > 0) {
    denominator = plays;
    basis = "plays";
  } else if (followers > 0) {
    denominator = followers;
    basis = "followers";
  }

  return {
    engagement,
    engagementRate: denominator > 0 ? engagement / denominator : null,
    denominator,
    basis,
  };
}

export function engagementRateBasisLabel(basis: EngagementRateBasis): string {
  if (basis === "reach") return "reach";
  if (basis === "plays") return "plays";
  if (basis === "followers") return "followers terbaru";
  return "data pembagi belum tersedia";
}
