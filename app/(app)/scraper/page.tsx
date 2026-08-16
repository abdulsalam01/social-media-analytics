import { dbAll } from "@/lib/db";
import ScraperClient from "./ScraperClient";

export const dynamic = "force-dynamic";

export default async function ScraperPage() {
  const accounts = await dbAll(
    `SELECT a.id, a.name, a.handle, a.platform, a.scrape_enabled,
            a.last_scraped_at, a.last_scrape_status,
            (SELECT COUNT(*) FROM content_insight ci WHERE ci.account_id = a.id AND ci.scrape_enabled = 1) AS tracked_posts
     FROM accounts a
     ORDER BY a.platform, a.name`
  );

  return <ScraperClient accounts={JSON.parse(JSON.stringify(accounts))} />;
}
