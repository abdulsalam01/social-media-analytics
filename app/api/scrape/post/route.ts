import { NextRequest, NextResponse } from "next/server";
import { runScrapeForPost } from "@/lib/scraper";
import { currentUser } from "@/lib/session";
import { getAccountIdForContent, hasAccountAccess } from "@/lib/account-access";

// POST /api/scrape/post — scrape a single content post by id
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user || (user.role !== "admin" && user.role !== "editor")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const postId = typeof body?.post_id === "number" ? body.post_id : null;
  if (!postId) return NextResponse.json({ error: "post_id required" }, { status: 400 });
  const accountId = await getAccountIdForContent(postId);
  if (!accountId || !(await hasAccountAccess(user, accountId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await runScrapeForPost(postId, user.id);
  return NextResponse.json({
    ok: result.status === "ok",
    matched: result.matched,
    data: result.data,
    error: result.error,
  });
}
