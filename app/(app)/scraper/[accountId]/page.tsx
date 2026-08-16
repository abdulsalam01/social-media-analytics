import { notFound } from "next/navigation";
import { dbGet, dbAll } from "@/lib/db";
import { requirePageRole } from "@/lib/session";
import PostScrapeClient from "./PostScrapeClient";

export const dynamic = "force-dynamic";

export default async function AccountScraperPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  await requirePageRole(["admin"]);
  const { accountId } = await params;
  const id = parseInt(accountId, 10);
  if (isNaN(id)) notFound();

  const account = await dbGet(
    `SELECT id, name, handle, platform, scrape_enabled, last_scraped_at, last_scrape_status
     FROM accounts WHERE id = ?`,
    [id]
  );
  if (!account) notFound();

  const posts = await dbAll(
    `SELECT id, post_date, title, link, shortcode, likes, comments, engagement_rate,
            scrape_enabled, updated_at
     FROM content_insight
     WHERE account_id = ?
     ORDER BY post_date DESC, created_at DESC`,
    [id]
  );

  const lastLog = await dbGet(
    `SELECT id, scraped_at, status, posts_found, posts_updated, error
     FROM scrape_log WHERE account_id = ? ORDER BY scraped_at DESC LIMIT 1`,
    [id]
  );

  const plainAccount = JSON.parse(JSON.stringify(account));
  const plainPosts = JSON.parse(JSON.stringify(posts));
  const plainLastLog = lastLog ? JSON.parse(JSON.stringify(lastLog)) : null;
  return <PostScrapeClient account={plainAccount} posts={plainPosts} lastLog={plainLastLog} />;
}
