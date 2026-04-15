import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface IGFeed {
  inspector: string;
  agency: string;
  agencyName: string;
  url: string;
  method: "rss" | "html" | "firecrawl";
}

const IG_FEEDS: IGFeed[] = [
  // RSS feeds confirmed working April 2026
  { inspector: "gao", agency: "gao", agencyName: "Government Accountability Office", url: "https://www.gao.gov/rss/reports.xml", method: "rss" },
  { inspector: "nasa", agency: "nasa", agencyName: "NASA", url: "https://oig.nasa.gov/feed/", method: "rss" },
  { inspector: "interior", agency: "interior", agencyName: "Department of the Interior", url: "https://www.doioig.gov/rss.xml", method: "rss" },
  { inspector: "education", agency: "education", agencyName: "Department of Education", url: "https://oig.ed.gov/rss.xml", method: "rss" },
  // HTML direct scrape
  { inspector: "labor", agency: "labor", agencyName: "Department of Labor", url: "https://www.oig.dol.gov/auditreports.htm", method: "html" },
  { inspector: "interior-reports", agency: "interior", agencyName: "Department of the Interior", url: "https://www.doioig.gov/reports", method: "html" },
  // Firecrawl scrape for agencies with JS-heavy or blocked pages
  { inspector: "treasury", agency: "treasury", agencyName: "Department of the Treasury", url: "https://oig.treasury.gov/reports", method: "firecrawl" },
  { inspector: "energy", agency: "energy", agencyName: "Department of Energy", url: "https://www.energy.gov/ig/calendar-year-reports", method: "firecrawl" },
  { inspector: "transportation", agency: "transportation", agencyName: "Department of Transportation", url: "https://www.oig.dot.gov/library-item/audits", method: "firecrawl" },
  { inspector: "commerce", agency: "commerce", agencyName: "Department of Commerce", url: "https://oig.commerce.gov/reports", method: "firecrawl" },
  { inspector: "sba", agency: "sba", agencyName: "Small Business Administration", url: "https://www.sba.gov/about-sba/oversight-advocacy/office-inspector-general/reports", method: "firecrawl" },
  { inspector: "epa", agency: "epa", agencyName: "Environmental Protection Agency", url: "https://www.epa.gov/office-inspector-general", method: "firecrawl" },
  { inspector: "homeland", agency: "homeland", agencyName: "Department of Homeland Security", url: "https://www.oig.dhs.gov/reports/audits-inspections-and-evaluations", method: "firecrawl" },
];

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

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

interface ParsedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

function parseRssItems(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const itemBlocks = xml.split(/<item[\s>]/i).slice(1);
  for (const block of itemBlocks.slice(0, 50)) {
    items.push({
      title: extractTag(block, "title"),
      link: extractTag(block, "link") || extractAttr(block, "link", "href"),
      description: extractTag(block, "description") || extractTag(block, "content:encoded") || extractTag(block, "summary"),
      pubDate: extractTag(block, "pubDate") || extractTag(block, "dc:date") || extractTag(block, "published") || extractTag(block, "updated"),
    });
  }
  // Atom entries
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

function parseHtmlReportLinks(html: string, baseUrl: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const linkRe = /<a[^>]+href="([^"]*(?:report|audit|inspection|evaluation|memorandum|assessment|investigation|alert|testimony|special|semiannual|gao-|oig-|ig-)[^"]*)"[^>]*>([^<]+)<\/a>/gi;
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

function parseFirecrawlMarkdown(markdown: string, baseUrl: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const seen = new Set<string>();
  // Match markdown links: [title](url)
  const linkRe = /\[([^\]]{5,})\]\((https?:\/\/[^\s)]+)\)/g;
  let match;
  while ((match = linkRe.exec(markdown)) !== null && items.length < 50) {
    const title = match[1].trim();
    const url = match[2];
    if (seen.has(url)) continue;
    seen.add(url);
    // Filter to report-like links
    const lower = (title + url).toLowerCase();
    if (/(report|audit|inspection|evaluation|alert|testimony|investigation|review|assessment|oig|gao|ig-|semiannual|special|memorandum|advisory)/.test(lower)) {
      items.push({ title, link: url, description: "", pubDate: "" });
    }
  }
  // Also try to extract standalone titles (markdown headings near links)
  if (items.length === 0) {
    // Fallback: extract all links
    const allLinksRe = /\[([^\]]{5,})\]\((https?:\/\/[^\s)]+)\)/g;
    let m2;
    while ((m2 = allLinksRe.exec(markdown)) !== null && items.length < 30) {
      const title = m2[1].trim();
      const url = m2[2];
      if (!seen.has(url) && !/(login|sign|subscribe|cookie|privacy|menu|nav|footer|header|skip|search|home|contact)/.test(title.toLowerCase())) {
        seen.add(url);
        items.push({ title, link: url, description: "", pubDate: "" });
      }
    }
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

async function fetchViaFirecrawl(url: string, apiKey: string): Promise<string> {
  const res = await fetch(`${FIRECRAWL_V2}/scrape`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown", "links"],
      onlyMainContent: true,
      waitFor: 3000,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Firecrawl ${res.status}`);
  return data.data?.markdown || data.markdown || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY") || "";

    let body: any = {};
    try { body = await req.json(); } catch {}

    let feedsToSync = body.inspectors
      ? IG_FEEDS.filter(f => (body.inspectors as string[]).includes(f.inspector))
      : IG_FEEDS;

    // Skip firecrawl feeds if no API key
    if (!firecrawlKey) {
      const skipped = feedsToSync.filter(f => f.method === "firecrawl").map(f => f.inspector);
      feedsToSync = feedsToSync.filter(f => f.method !== "firecrawl");
      if (skipped.length > 0) {
        console.log(`Skipping firecrawl feeds (no API key): ${skipped.join(", ")}`);
      }
    }

    let totalInserted = 0;
    const errors: string[] = [];
    const feedResults: Record<string, number> = {};
    const skippedNoKey: string[] = [];

    for (const feed of feedsToSync) {
      try {
        let items: ParsedItem[] = [];

        if (feed.method === "firecrawl") {
          const md = await fetchViaFirecrawl(feed.url, firecrawlKey);
          items = parseFirecrawlMarkdown(md, feed.url);
        } else {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          const res = await fetch(feed.url, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; ORDB-IGSync/1.0)" },
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

          items = feed.method === "html"
            ? parseHtmlReportLinks(text, feed.url)
            : parseRssItems(text);
        }

        if (items.length === 0) {
          errors.push(`${feed.inspector}: no items parsed`);
          continue;
        }

        const rows = items
          .filter(item => item.title && item.title.length > 3)
          .map((item, idx) => {
            const pubDate = parseDate(item.pubDate);
            const year = pubDate ? parseInt(pubDate.substring(0, 4)) : null;
            // Create a more stable report_id using title hash when no date
            const titleSlug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 80);
            return {
              inspector: feed.inspector === "interior-reports" ? "interior" : feed.inspector,
              inspector_url: feed.url,
              agency: feed.agency,
              agency_name: feed.agencyName,
              report_id: `${feed.inspector}-${pubDate || titleSlug || idx}`,
              title: item.title.substring(0, 1000),
              url: item.link || null,
              landing_url: item.link || null,
              published_on: pubDate,
              type: "report",
              summary: (item.description || "").substring(0, 5000) || null,
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

      await new Promise(r => setTimeout(r, 400));
    }

    return new Response(JSON.stringify({
      success: true,
      totalInserted,
      feeds: feedsToSync.length,
      feedResults,
      errors: errors.slice(0, 25),
      firecrawlEnabled: !!firecrawlKey,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
