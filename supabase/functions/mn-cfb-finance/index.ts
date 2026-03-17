import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// MN Campaign Finance Board data download URLs
const CONTRIB_CANDIDATES_URL =
  "https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=-2026985457";
const EXPEND_CANDIDATES_URL =
  "https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=-1315784544";

interface CandidateAgg {
  name: string;
  reg_num: string;
  total_contributions: number;
  total_expenditures: number;
  contribution_count: number;
  expenditure_count: number;
  top_contributors: Record<string, number>;
  contributor_types: Record<string, number>;
  expenditure_types: Record<string, number>;
  top_vendors: Record<string, number>;
  years_active: Set<string>;
  in_kind_total: number;
}

function parseCSV(text: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const lines = text.split("\n");
  if (lines.length === 0) return rows;

  // Parse header
  const headers = parseCSVLine(lines[0]);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || "";
    }
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function topN(map: Record<string, number>, n: number): Array<{ name: string; amount: number }> {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, amount]) => ({ name, amount }));
}

function detectChamber(name: string): "house" | "senate" | "governor" | "other" {
  const lower = name.toLowerCase();
  if (lower.includes("house committee")) return "house";
  if (lower.includes("senate committee")) return "senate";
  if (lower.includes("gov committee") || lower.includes("governor")) return "governor";
  if (lower.includes("atty gen") || lower.includes("sec of state") || lower.includes("state aud") || lower.includes("sup court")) return "other";
  return "other";
}

function extractCandidateName(committeeName: string): string {
  // "Walz, Tim Gov Committee" -> "Tim Walz"
  // "Fowke, Kathleen Senate Committee" -> "Kathleen Fowke"
  const cleaned = committeeName
    .replace(/\s*(House|Senate|Gov|Governor|Atty Gen|Sec of State|State Aud|Sup Court)\s*Committee\s*/i, "")
    .trim();
  const parts = cleaned.split(",").map((s) => s.trim());
  if (parts.length >= 2) {
    return `${parts[1]} ${parts[0]}`;
  }
  return cleaned;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const chamber = url.searchParams.get("chamber") || "all"; // house, senate, governor, all
    const yearFilter = url.searchParams.get("year") || ""; // e.g. "2024"
    const search = (url.searchParams.get("search") || "").toLowerCase();

    console.log(`MN CFB finance: chamber=${chamber}, year=${yearFilter}, search=${search}`);

    // Fetch both CSVs in parallel
    const [contribResp, expendResp] = await Promise.all([
      fetch(CONTRIB_CANDIDATES_URL),
      fetch(EXPEND_CANDIDATES_URL),
    ]);

    if (!contribResp.ok || !expendResp.ok) {
      throw new Error(`Failed to fetch MN CFB data: contrib=${contribResp.status}, expend=${expendResp.status}`);
    }

    const [contribText, expendText] = await Promise.all([
      contribResp.text(),
      expendResp.text(),
    ]);

    const contribRows = parseCSV(contribText);
    const expendRows = parseCSV(expendText);

    console.log(`Parsed ${contribRows.length} contribution rows, ${expendRows.length} expenditure rows`);

    // Aggregate by candidate (recipient reg num)
    const candidates = new Map<string, CandidateAgg>();

    for (const row of contribRows) {
      const regNum = row["Recipient reg num"] || "";
      const name = row["Recipient"] || "";
      const amount = parseFloat(row["Amount"] || "0");
      const year = row["Year"] || "";
      const contributor = row["Contributor"] || "";
      const contribType = row["Contrib type"] || "";
      const isInKind = row["In kind?"] === "Yes";

      if (yearFilter && year !== yearFilter) continue;

      if (!candidates.has(regNum)) {
        candidates.set(regNum, {
          name,
          reg_num: regNum,
          total_contributions: 0,
          total_expenditures: 0,
          contribution_count: 0,
          expenditure_count: 0,
          top_contributors: {},
          contributor_types: {},
          expenditure_types: {},
          top_vendors: {},
          years_active: new Set(),
          in_kind_total: 0,
        });
      }

      const c = candidates.get(regNum)!;
      c.total_contributions += amount;
      c.contribution_count++;
      c.years_active.add(year);

      if (isInKind) c.in_kind_total += amount;

      if (contributor) {
        c.top_contributors[contributor] = (c.top_contributors[contributor] || 0) + amount;
      }
      if (contribType) {
        c.contributor_types[contribType] = (c.contributor_types[contribType] || 0) + amount;
      }
    }

    for (const row of expendRows) {
      const regNum = row["Committee reg num"] || "";
      const name = row["Committee name"] || "";
      const amount = parseFloat(row["Amount"] || "0");
      const year = row["Year"] || "";
      const vendor = row["Vendor name"] || "";
      const type = row["Type"] || "";

      if (yearFilter && year !== yearFilter) continue;

      if (!candidates.has(regNum)) {
        candidates.set(regNum, {
          name,
          reg_num: regNum,
          total_contributions: 0,
          total_expenditures: 0,
          contribution_count: 0,
          expenditure_count: 0,
          top_contributors: {},
          contributor_types: {},
          expenditure_types: {},
          top_vendors: {},
          years_active: new Set(),
          in_kind_total: 0,
        });
      }

      const c = candidates.get(regNum)!;
      c.total_expenditures += amount;
      c.expenditure_count++;
      c.years_active.add(year);

      if (vendor) {
        c.top_vendors[vendor] = (c.top_vendors[vendor] || 0) + amount;
      }
      if (type) {
        c.expenditure_types[type] = (c.expenditure_types[type] || 0) + amount;
      }
    }

    // Convert to output array
    let results = Array.from(candidates.values()).map((c) => {
      const chamberType = detectChamber(c.name);
      return {
        committee_name: c.name,
        candidate_name: extractCandidateName(c.name),
        reg_num: c.reg_num,
        chamber: chamberType,
        total_contributions: Math.round(c.total_contributions * 100) / 100,
        total_expenditures: Math.round(c.total_expenditures * 100) / 100,
        net_cash: Math.round((c.total_contributions - c.total_expenditures) * 100) / 100,
        contribution_count: c.contribution_count,
        expenditure_count: c.expenditure_count,
        in_kind_total: Math.round(c.in_kind_total * 100) / 100,
        years_active: Array.from(c.years_active).sort().reverse(),
        top_contributors: topN(c.top_contributors, 15),
        contributor_types: topN(c.contributor_types, 10),
        expenditure_types: topN(c.expenditure_types, 10),
        top_vendors: topN(c.top_vendors, 15),
      };
    });

    // Filter by chamber
    if (chamber !== "all") {
      results = results.filter((r) => r.chamber === chamber);
    }

    // Filter by search
    if (search) {
      results = results.filter(
        (r) =>
          r.candidate_name.toLowerCase().includes(search) ||
          r.committee_name.toLowerCase().includes(search),
      );
    }

    // Sort by total contributions descending
    results.sort((a, b) => b.total_contributions - a.total_contributions);

    // Compute aggregate stats
    const totalRaised = results.reduce((s, r) => s + r.total_contributions, 0);
    const totalSpent = results.reduce((s, r) => s + r.total_expenditures, 0);
    const candidateCount = results.length;

    return new Response(
      JSON.stringify({
        success: true,
        state: "MN",
        source: "Minnesota Campaign Finance Board",
        source_url: "https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/",
        filters: { chamber, year: yearFilter || "all", search: search || null },
        summary: {
          total_raised: Math.round(totalRaised * 100) / 100,
          total_spent: Math.round(totalSpent * 100) / 100,
          candidate_count: candidateCount,
        },
        candidates: results.slice(0, 500),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("MN CFB finance error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
