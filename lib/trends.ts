import "server-only";

export type TrendEvidenceInput = {
  provider: string;
  sourceName: string;
  title: string;
  url: string;
  excerpt: string | null;
  publishedAt: string | null;
  popularityScore: number;
  rawMetrics: Record<string, unknown>;
};

export type ProviderReport = {
  provider: string;
  status: "ok" | "empty" | "error" | "needs_config";
  count: number;
  message: string;
};

type ProviderResult = { items: TrendEvidenceInput[]; report: ProviderReport };

const USER_AGENT = "SocmedInsight/1.0 trend-research (+https://github.com/abdulsalam01/tveloper-social-media)";
const NEWS_MAX_AGE_DAYS = 45;

function decodeXml(value: string): string {
  return value
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function stripHtml(value: string): string {
  return decodeXml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function readTag(block: string, tag: string): string | null {
  const escaped = tag.replace(":", "\\:");
  const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  return match ? decodeXml(match[1].trim()) : null;
}

function parseRss(xml: string, provider: string, fallbackSource: string): TrendEvidenceInput[] {
  const blocks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? [];
  return blocks.slice(0, 15).flatMap((block) => {
    const title = stripHtml(readTag(block, "title") ?? "");
    const url = stripHtml(readTag(block, "link") ?? "");
    if (!title || !/^https?:\/\//i.test(url)) return [];
    const sourceName = stripHtml(readTag(block, "source") ?? readTag(block, "News:Source") ?? fallbackSource);
    const description = stripHtml(readTag(block, "description") ?? "").slice(0, 500) || null;
    const pubDate = readTag(block, "pubDate");
    const publishedAt = pubDate && !Number.isNaN(Date.parse(pubDate)) ? new Date(pubDate).toISOString() : null;
    return [{
      provider,
      sourceName,
      title: title.slice(0, 300),
      url,
      excerpt: description,
      publishedAt,
      popularityScore: 0,
      rawMetrics: {},
    }];
  });
}

function onlyFreshNews(items: TrendEvidenceInput[]): TrendEvidenceInput[] {
  const cutoff = Date.now() - NEWS_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return items.filter((item) => !item.publishedAt || new Date(item.publishedAt).getTime() >= cutoff);
}

async function fetchText(url: string, headers?: Record<string, string>): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml, application/json", ...headers },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function report(provider: string, items: TrendEvidenceInput[], error?: unknown): ProviderResult {
  if (error) {
    const message = error instanceof Error ? error.message : "Provider gagal merespons";
    return { items: [], report: { provider, status: "error", count: 0, message } };
  }
  return {
    items,
    report: {
      provider,
      status: items.length ? "ok" : "empty",
      count: items.length,
      message: items.length ? `${items.length} sumber ditemukan` : "Tidak ada hasil relevan",
    },
  };
}

async function googleNews(query: string): Promise<ProviderResult> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:30d`)}&hl=id&gl=ID&ceid=ID:id`;
    return report("Google News", onlyFreshNews(parseRss(await fetchText(url), "google_news", "Google News")));
  } catch (error) {
    return report("Google News", [], error);
  }
}

async function bingNews(query: string): Promise<ProviderResult> {
  try {
    const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&mkt=id-ID`;
    return report("Bing News", onlyFreshNews(parseRss(await fetchText(url), "bing_news", "Bing News")));
  } catch (error) {
    return report("Bing News", [], error);
  }
}

async function hackerNewsAlgolia(query: string): Promise<ProviderResult> {
  try {
    const weekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&numericFilters=created_at_i%3E${weekAgo}&hitsPerPage=12`;
    const data = JSON.parse(await fetchText(url)) as {
      hits?: Array<{
        objectID?: string;
        title?: string;
        story_title?: string;
        url?: string;
        story_url?: string;
        created_at?: string;
        points?: number;
        num_comments?: number;
      }>;
    };
    const items = (data.hits ?? []).flatMap((hit) => {
      const title = (hit.title || hit.story_title || "").trim();
      if (!title || !hit.objectID) return [];
      const points = Number(hit.points ?? 0);
      const comments = Number(hit.num_comments ?? 0);
      return [{
        provider: "algolia_hn",
        sourceName: "Hacker News / Algolia",
        title: title.slice(0, 300),
        url: hit.url || hit.story_url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
        excerpt: `Sinyal komunitas: ${points} poin dan ${comments} komentar.`,
        publishedAt: hit.created_at && !Number.isNaN(Date.parse(hit.created_at)) ? new Date(hit.created_at).toISOString() : null,
        popularityScore: Math.min(100, points * 0.35 + comments * 0.65),
        rawMetrics: { points, comments, algolia_object_id: hit.objectID },
      }];
    });
    return report("Hacker News / Algolia", items);
  } catch (error) {
    return report("Hacker News / Algolia", [], error);
  }
}

type GeminiGroundingResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
      webSearchQueries?: string[];
    };
  }>;
  error?: { message?: string };
};

function groundedProvider(uri: string): { provider: string; sourceName: string } {
  try {
    const host = new URL(uri).hostname.replace(/^www\./, "");
    if (host === "reddit.com" || host.endsWith(".reddit.com")) return { provider: "reddit_grounded", sourceName: "Reddit via Google" };
    if (host === "x.com" || host.endsWith(".x.com") || host === "twitter.com") return { provider: "x_grounded", sourceName: "X via Google" };
    return { provider: "google_search", sourceName: host };
  } catch {
    return { provider: "google_search", sourceName: "Google Search" };
  }
}

async function googleGrounding(query: string): Promise<ProviderResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
  if (!apiKey) {
    return { items: [], report: { provider: "Google Search Grounding", status: "needs_config", count: 0, message: "GEMINI_API_KEY belum diatur" } };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Cari sinyal tren paling baru dalam 7 hari terakhir untuk topik: ${query}. Prioritaskan fakta, data, berita, diskusi komunitas Reddit, dan post X yang bisa dirujuk. Fokus Indonesia jika relevan. Berikan ringkasan singkat dalam Bahasa Indonesia.`,
            }],
          }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
        }),
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      }
    );
    const data = await response.json() as GeminiGroundingResponse;
    if (!response.ok) throw new Error(data.error?.message || `Gemini HTTP ${response.status}`);
    const candidate = data.candidates?.[0];
    const summary = candidate?.content?.parts?.map((part) => part.text ?? "").join(" ").trim().slice(0, 700) || null;
    const queries = candidate?.groundingMetadata?.webSearchQueries ?? [];
    const items = (candidate?.groundingMetadata?.groundingChunks ?? []).flatMap((chunk) => {
      const uri = chunk.web?.uri;
      const title = chunk.web?.title?.trim();
      if (!uri || !title || !/^https?:\/\//i.test(uri)) return [];
      const inferred = groundedProvider(uri);
      return [{
        provider: inferred.provider,
        sourceName: inferred.sourceName,
        title: title.slice(0, 300),
        url: uri,
        excerpt: summary,
        publishedAt: null,
        popularityScore: 0,
        rawMetrics: { grounded: true, search_queries: queries },
      }];
    });
    return report("Google Search Grounding", items);
  } catch (error) {
    return report("Google Search Grounding", [], error);
  }
}

async function xRecentSearch(query: string): Promise<ProviderResult> {
  const bearer = process.env.X_BEARER_TOKEN;
  if (!bearer) {
    return { items: [], report: { provider: "X", status: "needs_config", count: 0, message: "X_BEARER_TOKEN opsional belum diatur; hasil X masih dapat muncul lewat Google grounding" } };
  }
  try {
    const search = `${query} -is:retweet lang:id`;
    const url = `https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(search)}&max_results=10&tweet.fields=created_at,public_metrics`;
    const data = JSON.parse(await fetchText(url, { Authorization: `Bearer ${bearer}` })) as {
      data?: Array<{
        id: string;
        text: string;
        created_at?: string;
        public_metrics?: { like_count?: number; reply_count?: number; repost_count?: number; quote_count?: number };
      }>;
    };
    const items = (data.data ?? []).map((post) => {
      const metrics = post.public_metrics ?? {};
      const engagement = Number(metrics.like_count ?? 0) + Number(metrics.reply_count ?? 0) * 2 + Number(metrics.repost_count ?? 0) * 3 + Number(metrics.quote_count ?? 0) * 2;
      return {
        provider: "x_api",
        sourceName: "X",
        title: post.text.replace(/\s+/g, " ").slice(0, 240),
        url: `https://x.com/i/web/status/${post.id}`,
        excerpt: null,
        publishedAt: post.created_at ?? null,
        popularityScore: Math.min(100, Math.sqrt(engagement) * 8),
        rawMetrics: metrics,
      };
    });
    return report("X", items);
  } catch (error) {
    return report("X", [], error);
  }
}

function recencyScore(publishedAt: string | null): number {
  if (!publishedAt) return 12;
  const ageHours = Math.max(0, (Date.now() - new Date(publishedAt).getTime()) / 3_600_000);
  if (ageHours <= 24) return 35;
  if (ageHours <= 72) return 28;
  if (ageHours <= 168) return 18;
  return 5;
}

function keywordScore(item: TrendEvidenceInput, keywords: string[]): number {
  const haystack = `${item.title} ${item.excerpt ?? ""}`.toLowerCase();
  const tokens = keywords.flatMap((keyword) => keyword.toLowerCase().split(/\s+/)).filter((token) => token.length >= 3);
  const matches = new Set(tokens.filter((token) => haystack.includes(token))).size;
  return Math.min(30, matches * 7.5);
}

function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw);
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].forEach((key) => url.searchParams.delete(key));
    url.hash = "";
    return url.toString();
  } catch {
    return raw;
  }
}

export async function collectTrendEvidence(keywords: string[]): Promise<{ items: TrendEvidenceInput[]; reports: ProviderReport[] }> {
  const normalized = keywords.map((keyword) => keyword.trim()).filter(Boolean).slice(0, 8);
  const query = normalized.map((keyword) => keyword.includes(" ") ? `"${keyword}"` : keyword).join(" OR ");
  if (!query) throw new Error("Minimal satu keyword diperlukan untuk riset tren");

  const results = await Promise.all([
    googleNews(query),
    // Bing RSS is substantially less reliable with quoted OR syntax, so use a
    // natural-language query while preserving the same normalized keywords.
    bingNews(normalized.join(" ")),
    hackerNewsAlgolia(normalized.join(" ")),
    googleGrounding(normalized.join(", ")),
    xRecentSearch(normalized.join(" OR ")),
  ]);

  const seen = new Set<string>();
  const items = results
    .flatMap((result) => result.items)
    .map((item) => {
      const url = canonicalUrl(item.url);
      const providerBase = item.provider.includes("google") ? 12 : item.provider.includes("bing") ? 10 : 8;
      return {
        ...item,
        url,
        popularityScore: Math.min(100, item.popularityScore * 0.35 + recencyScore(item.publishedAt) + keywordScore(item, normalized) + providerBase),
      };
    })
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, 36);

  return { items, reports: results.map((result) => result.report) };
}
