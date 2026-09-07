import { dbAll } from "@/lib/db";
import { requirePageRole } from "@/lib/session";
import { getAccessibleAccounts } from "@/lib/account-access";
import ScraperClient from "./ScraperClient";

export const dynamic = "force-dynamic";

export default async function ScraperPage() {
  const user = await requirePageRole(["admin", "editor"]);
  const accessibleAccounts = await getAccessibleAccounts(user);
  const accountIds = accessibleAccounts.map((account) => account.id);
  const placeholders = accountIds.map(() => "?").join(",");
  const accounts = accountIds.length ? await dbAll(
    `SELECT a.id, a.name, a.handle, a.platform, a.scrape_enabled,
            a.last_scraped_at, a.last_scrape_status,
            (SELECT COUNT(*) FROM content_insight ci WHERE ci.account_id = a.id AND ci.scrape_enabled = 1) AS tracked_posts
     FROM accounts a
     WHERE a.id IN (${placeholders})
     ORDER BY a.platform, a.name`,
    accountIds
  ) : [];

  return (
    <ScraperClient
      accounts={JSON.parse(JSON.stringify(accounts))}
      canScrapeAll={user.role === "admin"}
    />
  );
}
