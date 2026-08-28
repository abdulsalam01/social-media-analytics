import { dbAll, dbGet, dbRun, dbTx, txRun } from "@/lib/db";
import { auditLog } from "@/lib/auth";

export interface ScrapedPost {
  shortcode: string;
  link: string;
  caption: string | null;
  post_date: string;
  likes: number;
  comments: number;
  plays?: number;
  shares?: number;
}

export interface ScrapeProfileResult {
  ok: boolean;
  followers?: number;
  posts?: ScrapedPost[];
  error?: string;
}

export interface ScrapeAccountResult {
  account_id: number;
  status: "ok" | "error";
  posts_found: number;
  posts_updated: number;
  error?: string;
}

const IG_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "X-IG-App-ID": "936619743392459",
  "X-IG-Capabilities": "36r/5/B/HgU=",
  "X-IG-Connection-Type": "WIFI",
  Referer: "https://www.instagram.com/",
};

const TT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

export async function scrapeTikTokProfile(handle: string): Promise<ScrapeProfileResult> {
  const url = `https://www.tiktok.com/@${encodeURIComponent(handle)}`;
  try {
    const res = await fetch(url, {
      headers: TT_HEADERS,
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} from TikTok` };
    }

    const html = await res.text();

    // Detect Cloudflare/bot-check page
    if (html.includes("cf-browser-verification") || html.includes("challenge-form") || html.length < 5000) {
      return { ok: false, error: "TikTok bot-detection triggered — cannot scrape from server environment" };
    }

    // Try __NEXT_DATA__ first (SSR pages)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pageProps: any = null;
    const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
    if (nextMatch) {
      try {
        const nd = JSON.parse(nextMatch[1]);
        pageProps = nd?.props?.pageProps;
      } catch { /* ignore */ }
    }

    // Fallback: SIGI_STATE embedded JSON (older TikTok SSR pattern)
    if (!pageProps) {
      const sigiMatch = html.match(/\bSIGI_STATE\b[^=]*=\s*(\{.+?\});\s*(?:window|var)\b/s);
      if (sigiMatch) {
        try {
          const sigi = JSON.parse(sigiMatch[1]);
          // SIGI_STATE.UserModule.users.<handle>
          const userModule = sigi?.UserModule?.users;
          const statsModule = sigi?.UserModule?.stats;
          const videoModule = sigi?.ItemModule;
          if (userModule) {
            const userKey = Object.keys(userModule)[0];
            const statsKey = Object.keys(statsModule ?? {})[0];
            const userData = userModule[userKey];
            const statsData = statsModule?.[statsKey];
            pageProps = {
              userInfo: {
                user: userData,
                stats: statsData ?? userData?.stats,
              },
              itemList: videoModule ? Object.values(videoModule) : [],
            };
          }
        } catch { /* ignore */ }
      }
    }

    if (!pageProps?.userInfo) {
      return { ok: false, error: "Cannot parse TikTok page — structure may have changed or account is private" };
    }

    const stats = pageProps.userInfo.stats ?? pageProps.userInfo.user?.stats;
    const followers: number = stats?.followerCount ?? 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawItems: any[] = pageProps.itemList ?? pageProps.items ?? [];
    const handle_ = pageProps.userInfo.user?.uniqueId ?? handle;

    const posts: ScrapedPost[] = rawItems.map((item) => {
      const videoId: string = item.id ?? item.aweme_id ?? "";
      const ts: number = item.createTime ?? item.create_time ?? 0;
      const post_date = ts
        ? new Date(ts * 1000).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];
      const s = item.stats ?? item.statistics ?? {};

      return {
        shortcode: videoId,
        link: `https://www.tiktok.com/@${handle_}/video/${videoId}`,
        caption: (item.desc ?? item.text ?? "").slice(0, 300) || null,
        post_date,
        likes: s.diggCount ?? s.digg_count ?? 0,
        comments: s.commentCount ?? s.comment_count ?? 0,
        plays: s.playCount ?? s.play_count ?? 0,
        shares: s.shareCount ?? s.share_count ?? 0,
      };
    });

    return { ok: true, followers, posts };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

function extractShortcode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
  return m?.[1] ?? null;
}

export interface ScrapePostDirectResult {
  ok: boolean;
  handle?: string;
  likes?: number;
  comments?: number;
  plays?: number;
  views?: number;
  caption?: string | null;
  post_date?: string;
  error?: string;
}

/**
 * Scrape a single Instagram post directly from its public URL.
 * Parses meta description tag (contains likes/comments/handle/date/caption).
 * Works without needing to know the account beforehand.
 * Format: "619 likes, 2 comments - unikom_official on August 16, 2026: caption"
 * Reels: may include "views" or "plays" ahead of likes.
 */
export async function scrapeInstagramPostDirect(shortcode: string): Promise<ScrapePostDirectResult> {
  const url = `https://www.instagram.com/p/${shortcode}/`;
  try {
    const res = await fetch(url, {
      headers: IG_HEADERS,
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} from Instagram post page` };

    const html = await res.text();

    // Handle from og:url — https://www.instagram.com/<handle>/p/<shortcode>/
    const ogUrl = html.match(/<meta property="og:url" content="https:\/\/www\.instagram\.com\/([^/]+)\/(?:p|reel)\//);
    const handle = ogUrl?.[1];

    // Meta description contains counts + caption
    const metaDesc = html.match(/<meta name="description" content="([^"]+)"/);
    if (!metaDesc) return { ok: false, error: "meta description not found — page structure changed or post private" };

    const desc = metaDesc[1]
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, "&");

    // Parse "N likes, M comments" — allow commas + K/M suffixes
    const num = (s: string): number => {
      const clean = s.replace(/,/g, "");
      if (/[Kk]$/.test(clean)) return Math.round(parseFloat(clean) * 1000);
      if (/[Mm]$/.test(clean)) return Math.round(parseFloat(clean) * 1_000_000);
      return parseInt(clean, 10) || 0;
    };

    const likesMatch = desc.match(/([\d,.]+[KMkm]?)\s+likes?/);
    const commentsMatch = desc.match(/([\d,.]+[KMkm]?)\s+comments?/);
    const playsMatch = desc.match(/([\d,.]+[KMkm]?)\s+plays?/);
    const viewsMatch = desc.match(/([\d,.]+[KMkm]?)\s+views?/);

    // Date + caption: "- handle on Month DD, YYYY: caption..."
    const dateMatch = desc.match(/on\s+(\w+\s+\d+,\s+\d{4})/);
    let post_date: string | undefined;
    if (dateMatch) {
      const d = new Date(dateMatch[1] + " UTC");
      if (!isNaN(d.getTime())) post_date = d.toISOString().split("T")[0];
    }

    const captionMatch = desc.match(/:\s*"?(.*?)"?\s*$/s);
    const caption = captionMatch?.[1]?.slice(0, 300) ?? null;

    return {
      ok: true,
      handle,
      likes: likesMatch ? num(likesMatch[1]) : undefined,
      comments: commentsMatch ? num(commentsMatch[1]) : undefined,
      plays: playsMatch ? num(playsMatch[1]) : undefined,
      views: viewsMatch ? num(viewsMatch[1]) : undefined,
      caption,
      post_date,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function scrapeInstagramProfile(handle: string): Promise<ScrapeProfileResult> {
  const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`;
  try {
    const res = await fetch(url, {
      headers: IG_HEADERS,
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} from Instagram` };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    const user = json?.data?.user;
    if (!user) return { ok: false, error: "User not found or private account" };

    const followers: number = user.edge_followed_by?.count ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const edges: any[] = user.edge_owner_to_timeline_media?.edges ?? [];

    const posts: ScrapedPost[] = edges.map((edge) => {
      const node = edge.node;
      const shortcode: string = node.shortcode ?? "";
      const ts: number = node.taken_at_timestamp ?? 0;
      const post_date = ts
        ? new Date(ts * 1000).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];
      const captionText: string | null =
        node.edge_media_to_caption?.edges?.[0]?.node?.text ??
        node.accessibility_caption ??
        null;

      return {
        shortcode,
        link: `https://www.instagram.com/p/${shortcode}/`,
        caption: captionText ? captionText.slice(0, 300) : null,
        post_date,
        likes: node.edge_liked_by?.count ?? node.edge_media_preview_like?.count ?? 0,
        comments: node.edge_media_to_comment?.count ?? 0,
      };
    });

    return { ok: true, followers, posts };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

type AccountRow = {
  id: number;
  handle: string;
  platform: string;
  scrape_url: string | null;
};

type ContentRow = {
  id: number;
  shortcode: string | null;
  link: string | null;
  scrape_enabled: number;
};

export async function runScrapeForAccount(
  accountId: number,
  userId?: number
): Promise<ScrapeAccountResult> {
  const account = await dbGet<AccountRow>(
    "SELECT id, handle, platform, scrape_url FROM accounts WHERE id = ? AND scrape_enabled = 1",
    [accountId]
  );

  if (!account) {
    return { account_id: accountId, status: "error", posts_found: 0, posts_updated: 0, error: "Account not found or scraping disabled" };
  }

  if (account.platform !== "instagram" && account.platform !== "tiktok") {
    return { account_id: accountId, status: "error", posts_found: 0, posts_updated: 0, error: `Platform '${account.platform}' not supported` };
  }

  const handle = account.handle;
  const result = account.platform === "tiktok"
    ? await scrapeTikTokProfile(handle)
    : await scrapeInstagramProfile(handle);

  if (!result.ok || !result.posts) {
    await dbRun(
      `UPDATE accounts SET last_scraped_at = datetime('now'), last_scrape_status = 'error' WHERE id = ?`,
      [accountId]
    );
    await dbRun(
      `INSERT INTO scrape_log (account_id, status, posts_found, posts_updated, error) VALUES (?, 'error', 0, 0, ?)`,
      [accountId, result.error ?? "Unknown"]
    );
    return { account_id: accountId, status: "error", posts_found: 0, posts_updated: 0, error: result.error };
  }

  const posts = result.posts;
  let postsUpdated = 0;

  // Save followers to profile_insight for today
  if (result.followers && result.followers > 0) {
    const today = new Date().toISOString().split("T")[0];
    const prev = await dbGet<{ followers: number }>(
      "SELECT followers FROM profile_insight WHERE account_id = ? AND date < ? ORDER BY date DESC LIMIT 1",
      [accountId, today]
    );
    const growth = prev ? result.followers - prev.followers : 0;
    await dbRun(
      `INSERT INTO profile_insight (account_id, date, followers, followers_growth, visit_per_day, reach_per_day, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, 0, datetime('now'), datetime('now'))
       ON CONFLICT(account_id, date) DO UPDATE SET
         followers = excluded.followers,
         followers_growth = excluded.followers_growth,
         updated_at = datetime('now')`,
      [accountId, today, result.followers, growth]
    );
  }

  // Fetch existing content rows for this account to match by shortcode or link
  const existingContent = await dbAll<ContentRow>(
    "SELECT id, shortcode, link, scrape_enabled FROM content_insight WHERE account_id = ?",
    [accountId]
  );

  await dbTx(async (tx) => {
    for (const post of posts) {
      // Match existing row by shortcode or link
      const existing = existingContent.find(
        (c) =>
          (post.shortcode && c.shortcode === post.shortcode) ||
          (post.link && c.link === post.link) ||
          (post.shortcode && c.link && c.link.includes(post.shortcode))
      );

      if (existing) {
        if (existing.scrape_enabled === 0) continue; // user disabled auto-update for this post
        const engagement = post.likes + post.comments;
        const denom = (post.plays ?? 0) > 0 ? post.plays! : (result.followers || 1);
        const rate = engagement > 0 ? engagement / denom : 0;
        await txRun(tx,
          `UPDATE content_insight
           SET likes = ?, comments = ?,
               plays = CASE WHEN ? > 0 THEN ? ELSE plays END,
               shares = CASE WHEN ? > 0 THEN ? ELSE shares END,
               engagement = ?, engagement_rate = ?,
               shortcode = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [
            post.likes, post.comments,
            post.plays ?? 0, post.plays ?? 0,
            post.shares ?? 0, post.shares ?? 0,
            engagement, rate,
            post.shortcode, existing.id,
          ]
        );
        postsUpdated++;
      } else {
        // New post discovered via scrape — insert with scrape_enabled = 1
        const engagement = post.likes + post.comments;
        const denom = (post.plays ?? 0) > 0 ? post.plays! : (result.followers || 1);
        const rate = engagement > 0 ? engagement / denom : 0;
        await txRun(tx,
          `INSERT INTO content_insight
           (account_id, post_date, title, link, shortcode, likes, comments, shares, saves,
            follows, reach, impression, plays, engagement, engagement_rate,
            scrape_enabled, profile_visit, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?, ?, 1, 0, datetime('now'), datetime('now'))`,
          [accountId, post.post_date, post.caption, post.link, post.shortcode,
           post.likes, post.comments, post.shares ?? 0, post.plays ?? 0, engagement, rate]
        );
        postsUpdated++;
      }
    }
  });

  await dbRun(
    `UPDATE accounts SET last_scraped_at = datetime('now'), last_scrape_status = 'ok' WHERE id = ?`,
    [accountId]
  );
  await dbRun(
    `INSERT INTO scrape_log (account_id, status, posts_found, posts_updated) VALUES (?, 'ok', ?, ?)`,
    [accountId, posts.length, postsUpdated]
  );

  if (userId) {
    await auditLog(userId, "scrape", "account", accountId, { posts_found: posts.length, posts_updated: postsUpdated });
  }

  return { account_id: accountId, status: "ok", posts_found: posts.length, posts_updated: postsUpdated };
}

export interface ScrapePostResult {
  post_id: number;
  status: "ok" | "error";
  matched: boolean;
  error?: string;
  data?: { likes: number; comments: number; plays?: number; shares?: number };
}

/**
 * Extract shortcode (Instagram) or video ID (TikTok) from a post URL.
 * IG: https://www.instagram.com/p/{shortcode}/ or /reel/{shortcode}/
 * TT: https://www.tiktok.com/@{handle}/video/{id}
 */
export function extractPostIdFromUrl(url: string): { platform: "instagram" | "tiktok"; id: string; handle?: string } | null {
  const ig = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
  if (ig) return { platform: "instagram", id: ig[1] };
  const tt = url.match(/tiktok\.com\/@([A-Za-z0-9_.-]+)\/video\/(\d+)/);
  if (tt) return { platform: "tiktok", id: tt[2], handle: tt[1] };
  return null;
}

/**
 * Scrape a single content_insight row by its stored link/shortcode.
 * Strategy: fetch the profile of the owning account, filter recent posts by shortcode.
 * Works only if the post is within the profile's recent 12 posts (Instagram API limit).
 */
export async function runScrapeForPost(postId: number, userId?: number): Promise<ScrapePostResult> {
  const row = await dbGet<{
    id: number;
    account_id: number;
    shortcode: string | null;
    link: string | null;
    scrape_enabled: number;
  }>(
    "SELECT id, account_id, shortcode, link, scrape_enabled FROM content_insight WHERE id = ?",
    [postId]
  );

  if (!row) return { post_id: postId, status: "error", matched: false, error: "Post not found" };
  if (row.scrape_enabled === 0) return { post_id: postId, status: "error", matched: false, error: "Scraping disabled for this post" };

  const account = await dbGet<AccountRow>(
    "SELECT id, handle, platform, scrape_url FROM accounts WHERE id = ?",
    [row.account_id]
  );
  if (!account) return { post_id: postId, status: "error", matched: false, error: "Account not found" };

  // Determine shortcode: use stored shortcode, or extract from link
  let shortcode = row.shortcode;
  if (!shortcode && row.link) {
    const extracted = extractPostIdFromUrl(row.link);
    if (extracted) shortcode = extracted.id;
  }
  if (!shortcode) {
    return { post_id: postId, status: "error", matched: false, error: "Cannot determine post ID — link or shortcode missing" };
  }

  // Instagram: try direct post URL scrape first (works even for old posts)
  if (account.platform === "instagram") {
    const direct = await scrapeInstagramPostDirect(shortcode);
    if (direct.ok && (direct.likes !== undefined || direct.comments !== undefined)) {
      const likes = direct.likes ?? 0;
      const comments = direct.comments ?? 0;
      const plays = direct.plays ?? direct.views ?? 0;
      const engagement = likes + comments;
      const denom = plays > 0 ? plays : 1;
      const rate = engagement > 0 ? engagement / denom : 0;

      await dbRun(
        `UPDATE content_insight
         SET likes = ?, comments = ?,
             plays = CASE WHEN ? > 0 THEN ? ELSE plays END,
             engagement = ?, engagement_rate = ?,
             shortcode = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [likes, comments, plays, plays, engagement, rate, shortcode, postId]
      );

      if (userId) {
        await auditLog(userId, "scrape_post_direct", "content_insight", postId, { shortcode });
      }
      return {
        post_id: postId,
        status: "ok",
        matched: true,
        data: { likes, comments, plays: plays || undefined },
      };
    }
    // Fall through to profile-match approach if direct failed
  }

  const result = account.platform === "tiktok"
    ? await scrapeTikTokProfile(account.handle)
    : await scrapeInstagramProfile(account.handle);

  if (!result.ok || !result.posts) {
    return { post_id: postId, status: "error", matched: false, error: result.error ?? "Scrape failed" };
  }

  const match = result.posts.find((p) => p.shortcode === shortcode);
  if (!match) {
    return {
      post_id: postId,
      status: "error",
      matched: false,
      error: "Post not in recent 12 and direct URL scrape failed",
    };
  }

  const engagement = match.likes + match.comments;
  const denom = (match.plays ?? 0) > 0 ? match.plays! : (result.followers || 1);
  const rate = engagement > 0 ? engagement / denom : 0;

  await dbRun(
    `UPDATE content_insight
     SET likes = ?, comments = ?,
         plays = CASE WHEN ? > 0 THEN ? ELSE plays END,
         shares = CASE WHEN ? > 0 THEN ? ELSE shares END,
         engagement = ?, engagement_rate = ?,
         shortcode = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [
      match.likes, match.comments,
      match.plays ?? 0, match.plays ?? 0,
      match.shares ?? 0, match.shares ?? 0,
      engagement, rate, match.shortcode, postId,
    ]
  );

  if (userId) {
    await auditLog(userId, "scrape_post", "content_insight", postId, { shortcode });
  }

  return {
    post_id: postId,
    status: "ok",
    matched: true,
    data: { likes: match.likes, comments: match.comments, plays: match.plays, shares: match.shares },
  };
}

export async function runScrapeAll(userId?: number): Promise<ScrapeAccountResult[]> {
  const accounts = await dbAll<{ id: number }>(
    "SELECT id FROM accounts WHERE scrape_enabled = 1 AND platform IN ('instagram','tiktok')"
  );

  const results: ScrapeAccountResult[] = [];
  for (const acc of accounts) {
    const res = await runScrapeForAccount(acc.id, userId);
    results.push(res);
    // Polite delay between requests to avoid rate-limiting
    if (accounts.indexOf(acc) < accounts.length - 1) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  return results;
}
