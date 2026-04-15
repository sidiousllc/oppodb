import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verified working IG / oversight RSS feeds as of April 2026
interface IGFeed {
  inspector: string;
  agency: string;
  agencyName: string;
  url: string;
  format: "rss" | "atom" | "html";
}

const IG_FEEDS: IGFeed[] = [
  // RSS feeds confirmed working
  { inspector: "gao", agency: "gao", agencyName: "Government Accountability Office", url: "https://www.gao.gov/rss/reports.xml", format: "rss" },
  { inspector: "nasa", agency: "nasa", agencyName: "NASA", url: "https://oig.nasa.gov/feed/", format: "rss" },
  { inspector: "interior", agency: "interior", agencyName: "Department of the Interior", url: "https://www.doioig.gov/rss.xml", format: "rss" },
  { inspector: "education", agency: "education", agencyName: "Department of Education", url: "https://oig.ed.gov/rss.xml", format: "rss" },
  // HTML scrape fallbacks for agencies without working RSS
  { inspector: "labor", agency: "labor", agencyName: "Department of Labor", url: "https://www.oig.dol.gov/auditreports.htm", format: "html" },
  { inspector: "interior-reports", agency: "interior", agencyName: "Department of the Interior", url: "https://www.doioig.gov/reports", format: "html" },
];

function stripCdata(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").replace(/<[^>]+>/g, "").trim();
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? stripCdata(m[1]) : "";
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, "i");
  const m = xml.match(re);
  return m ? m[1] : "";
}

function parseRssItems(xml: string): Array<{ title: string; link: string; description: string; pubDate: string }> {
  const items: Array<{ title: string; link: string; description: string; pubDate: string }> = [];
  const itemBlocks = xml.split(/<item[\s>]/i).slice(1);
  for (const block of itemBlocks.slice(0, 50)) {
    items.push({
      title: extractTag(block, "title"),
      link: extractTag(block, "link") || extractAttr(block, "link", "href"),
      description: extractTag(block, "description") || extractTag(block, "content:encoded") || extractTag(block, "summary"),
      pubDate: extractTag(block, "pubDate") || extractTag(block, "dc:date") || extractTag(block, "published") || extractTag(block, "updated"),
    });
  }
  // Also handle Atom <entry> elements
  const entryBlocks = xml.split(/<entry[\s>]/i).slice(1);
  for (const block of entryBlocks.slice(0, 50)) {
    items.push({
      title: extractTag(block, "title"),
      link: extractAttr(block, "link", "href") || extractTag(block, "link"),
      description: extractTag(block, "summary") || extractTag(block, "content"),
      pubDate: extractTag(block, "published") || extractTag(block, "updated"),
    });
  }
  return items;
}

function parseHtmlReportLinks(html: string, baseUrl: string): Array<{ title: string; link: string; description: string; pubDate: string }> {
  const items: Array<{ title: string; link: string; description: string; pubDate: string }> = [];
  // Match links that look like report links
  const linkRe = /<a[^>]+href="([^"]*(?:report|audit|inspection|evaluation|memorandum)[^"]*)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  const seen = new Set<string>();
  while ((match = linkRe.exec(html)) !== null && items.length < 50) {
    let href = match[1];
    const title = stripCdata(match[2]).trim();
    if (!title || title.length < 5 || seen.has(href)) continue;
    seen.add(href);
    if (href.startsWith("/")) {
      const u = new URL(baseUrl);
      href = `${u.origin}${href}`;
    }
    items.push({ title, link: href, description: "", pubDate: "" });
  }
  return items;
}

function parseDate(s: string): string | null {
  if (!s) return null;
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let body: any = {};
    try { body = await req.json(); } catch {}

    const feedsToSync = body.inspectors
      ? IG_FEEDS.filter(f => (body.inspectors as string[]).includes(f.inspector))
      : IG_FEEDS;

    let totalInserted = 0;
    const errors: string[] = [];
    const feedResults: Record<string, number> = {};

    for (const feed of feedsToSync) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(feed.url, {
          headers: { "User-Agent": "ORDB-IGSync/1.0" },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          errors.push(`${feed.inspector}: HTTP ${res.status}`);
          continue;
        }

        const text = await res.text();
        if (!text || text.length < 100) {
          errors.push(`${feed.inspector}: empty response`);
          continue;
        }

        const items = feed.format === "html"
          ? parseHtmlReportLinks(text, feed.url)
          : parseRssItems(text);
        if (items.length === 0) {
          errors.push(`${feed.inspector}: no items parsed`);
          continue;
        }

        const rows = items
          .filter(item => item.title && item.title.length > 3)
          .map((item, idx) => {
            const pubDate = parseDate(item.pubDate);
            const year = pubDate ? parseInt(pubDate.substring(0, 4)) : null;
            return {
              inspector: feed.inspector,
              inspector_url: feed.url,
              agency: feed.agency,
              agency_name: feed.agencyName,
              report_id: `${feed.inspector}-${pubDate || "unknown"}-${idx}`,
              title: item.title.substring(0, 1000),
              url: item.link || null,
              landing_url: item.link || null,
              published_on: pubDate,
              type: "report",
              summary: item.description.substring(0, 5000) || null,
              year,
              raw_data: {},
            };
          });

        if (rows.length === 0) continue;

        const { error } = await supabase
          .from("ig_reports")
          .upsert(rows, { onConflict: "inspector,report_id" });

        if (error) {
          errors.push(`${feed.inspector}: ${error.message}`);
        } else {
          totalInserted += rows.length;
          feedResults[feed.inspector] = rows.length;
        }
      } catch (e) {
        errors.push(`${feed.inspector}: ${e.message}`);
      }

      await new Promise(r => setTimeout(r, 300));
    }

    return new Response(JSON.stringify({
      success: true,
      totalInserted,
      feeds: feedsToSync.length,
      feedResults,
      errors: errors.slice(0, 20),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
