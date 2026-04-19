// On-screen renderer that mirrors the PDF export styling for report blocks.
// Used by both ReportBuilder preview and PublicReport so blocks look the same
// in-app and on the exported PDF.
import type { ReportBlock } from "@/lib/reports/types";
import { ChartBlockView, TableBlockView, MapBlockView } from "./BlockViews";

const fmtNum = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—" : typeof v === "number" ? v.toLocaleString() : String(v);
const fmtPct = (v: unknown) =>
  typeof v === "number" ? `${v.toFixed(1)}%` : v == null ? "—" : String(v);
const fmtMoney = (v: unknown) =>
  typeof v === "number" ? `$${v.toLocaleString()}` : v == null ? "—" : String(v);
const fmtDate = (v: unknown) => {
  if (!v) return "—";
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString();
};

/** Pretty PDF-style frame around a data block. */
function PdfFrame({
  title,
  accent = "primary",
  children,
}: {
  title: string;
  accent?: "primary" | "muted" | "destructive" | "success";
  children: React.ReactNode;
}) {
  const color =
    accent === "destructive"
      ? "text-destructive border-destructive/40"
      : accent === "success"
      ? "text-[hsl(var(--success,140_60%_30%))] border-[hsl(var(--success,140_60%_30%))]/40"
      : accent === "muted"
      ? "text-muted-foreground border-border"
      : "text-primary border-primary/40";
  return (
    <section className={`border rounded bg-card ${color.split(" ").slice(1).join(" ")}`}>
      <header className={`px-3 py-1.5 border-b ${color} text-[12px] font-bold tracking-wide`}>
        {title}
      </header>
      <div className="p-3 space-y-2 text-foreground">{children}</div>
    </section>
  );
}

/** Two-column key/value list mirroring the PDF kvTable. */
function KV({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  const filtered = rows.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (!filtered.length) return null;
  return (
    <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1 text-[11px]">
      {filtered.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="font-bold text-muted-foreground">{k}</dt>
          <dd className="text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] whitespace-pre-wrap leading-relaxed text-foreground">{children}</div>;
}

export function PdfStyleBlockView({ block }: { block: ReportBlock }) {
  switch (block.type) {
    case "heading":
      return <h2 className="text-lg font-bold text-primary border-b border-border pb-1">{block.text}</h2>;
    case "subheading":
      return <h3 className="text-base font-bold">{block.text}</h3>;
    case "text":
      return <p className="text-[11px] whitespace-pre-wrap leading-relaxed text-foreground">{block.text}</p>;
    case "image":
      return (
        <figure className="border border-border rounded p-2 bg-card">
          {block.url ? (
            <img src={block.url} alt={block.caption ?? ""} className="max-w-full rounded" />
          ) : (
            <div className="text-xs text-muted-foreground italic">No image URL</div>
          )}
          {block.caption && (
            <figcaption className="text-[10px] text-muted-foreground italic text-center mt-1">{block.caption}</figcaption>
          )}
        </figure>
      );
    case "divider":
      return <hr className="border-border my-2" />;
    case "page_break":
      return <div className="border-t border-dashed border-border my-4 text-[9px] text-muted-foreground text-center">— page break —</div>;
    case "tabs":
      return (
        <div className="space-y-3">
          {block.tabs.map((t) => (
            <PdfFrame key={t.id} title={`▶ ${t.label}`} accent="muted">
              <div className="space-y-3">
                {t.blocks.map((b) => <PdfStyleBlockView key={b.id} block={b} />)}
              </div>
            </PdfFrame>
          ))}
        </div>
      );
    case "chart": return <ChartBlockView block={block} />;
    case "table": return <TableBlockView block={block} />;
    case "map":   return <MapBlockView block={block} />;

    case "candidate": {
      const s: any = (block as any).snapshot ?? {};
      return (
        <PdfFrame title={block.title ?? `👤 ${s.name ?? (block as any).refId}`}>
          <KV rows={[
            ["Slug", s.slug ?? (block as any).refId],
            ["Tags", Array.isArray(s.tags) ? s.tags.join(", ") : "—"],
          ]} />
          {s.content && <Body>{String(s.content).slice(0, 4000)}</Body>}
        </PdfFrame>
      );
    }

    case "research": {
      const s: any = (block as any).snapshot ?? {};
      return (
        <PdfFrame title={block.title ?? `🔍 ${s.subpage_title ?? s.name ?? (block as any).refId}`}>
          <KV rows={[
            ["Parent", s.parent_slug ?? "—"],
            ["Subpage", s.subpage_title ?? s.slug ?? "—"],
          ]} />
          {s.content && <Body>{String(s.content).slice(0, 6000)}</Body>}
        </PdfFrame>
      );
    }

    case "district": {
      const s: any = (block as any).snapshot ?? {};
      return (
        <PdfFrame title={block.title ?? `🗺️ ${s.district_id ?? (block as any).refId}`}>
          <KV rows={[
            ["State", s.state ?? "—"],
            ["Population", fmtNum(s.population)],
            ["Median income", fmtMoney(s.median_income)],
            ["Median age", fmtNum(s.median_age)],
            ["Bachelor+ %", fmtPct(s.education_bachelor_pct)],
            ["W / B / H / A", `${fmtPct(s.white_pct)} / ${fmtPct(s.black_pct)} / ${fmtPct(s.hispanic_pct)} / ${fmtPct(s.asian_pct)}`],
            ["Unemployment", fmtPct(s.unemployment_rate)],
            ["Poverty rate", fmtPct(s.poverty_rate)],
            ["Top issues", Array.isArray(s.top_issues) ? s.top_issues.join(", ") : "—"],
          ]} />
        </PdfFrame>
      );
    }

    case "intel": {
      const items: any[] = (block as any).snapshot?.items ?? [];
      return (
        <PdfFrame title={block.title ?? `🕵️ Intel — ${(block as any).refId}`}>
          {items.length === 0 ? (
            <div className="text-[11px] italic text-muted-foreground">(no cached briefings)</div>
          ) : (
            <ul className="space-y-2">
              {items.slice(0, 15).map((it, i) => (
                <li key={i} className="text-[11px]">
                  <div className="font-bold">• {it.title}</div>
                  <div className="text-[10px] text-muted-foreground ml-3">
                    {it.source_name}{it.published_at ? ` — ${new Date(it.published_at).toLocaleDateString()}` : ""}
                  </div>
                  {it.summary && <div className="ml-3">{it.summary}</div>}
                </li>
              ))}
            </ul>
          )}
        </PdfFrame>
      );
    }

    case "polling": {
      const s: any = (block as any).snapshot ?? {};
      return (
        <PdfFrame title={block.title ?? `📊 Poll — ${s.pollster ?? (block as any).refId}`}>
          <KV rows={[
            ["Pollster", s.pollster ?? "—"],
            ["Question", s.question ?? s.topic ?? "—"],
            ["State / District", `${s.state ?? "—"} / ${s.district ?? "—"}`],
            ["Date", fmtDate(s.poll_date ?? s.end_date)],
            ["Sample size", fmtNum(s.sample_size)],
            ["Margin of error", s.margin_of_error != null ? `±${s.margin_of_error}` : "—"],
            ["Approve / Disapprove", `${fmtPct(s.approve_pct)} / ${fmtPct(s.disapprove_pct)}`],
          ]} />
        </PdfFrame>
      );
    }

    case "finance": {
      const s: any = (block as any).snapshot ?? {};
      return (
        <PdfFrame title={block.title ?? `💰 ${s.candidate_name ?? (block as any).refId} — Cycle ${s.cycle ?? ""}`}>
          <KV rows={[
            ["Office", s.office ?? "—"],
            ["State / District", `${s.state_abbr ?? "—"} / ${s.district ?? "—"}`],
            ["Total raised", fmtMoney(s.total_raised)],
            ["Total spent", fmtMoney(s.total_spent)],
            ["Cash on hand", fmtMoney(s.cash_on_hand)],
            ["Total debt", fmtMoney(s.total_debt)],
            ["Individual contributions", fmtMoney(s.individual_contributions)],
            ["PAC contributions", fmtMoney(s.pac_contributions)],
            ["Self-funding", fmtMoney(s.self_funding)],
            ["Small dollar %", fmtPct(s.small_dollar_pct)],
            ["Large donor %", fmtPct(s.large_donor_pct)],
            ["Out-of-state %", fmtPct(s.out_of_state_pct)],
            ["Source", `${s.source ?? "—"}${s.filing_date ? " (" + fmtDate(s.filing_date) + ")" : ""}`],
          ]} />
        </PdfFrame>
      );
    }

    case "election": {
      const items: any[] = (block as any).snapshot?.items ?? [];
      return (
        <PdfFrame title={block.title ?? `🗳️ Election — ${(block as any).refId}`} accent="success">
          {items.length === 0 ? (
            <div className="text-[11px] italic text-muted-foreground">(no cached results)</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-muted">
                  <tr>
                    {["Year", "Type", "Candidate", "Party", "Votes", "Pct", "Win"].map((h) => (
                      <th key={h} className="px-2 py-1 text-left border-b border-border font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-b border-border last:border-b-0">
                      <td className="px-2 py-1">{fmtNum(it.election_year)}</td>
                      <td className="px-2 py-1">{it.election_type ?? "—"}</td>
                      <td className="px-2 py-1">{it.candidate_name ?? "—"}</td>
                      <td className="px-2 py-1">{it.party ?? "—"}</td>
                      <td className="px-2 py-1">{fmtNum(it.votes)}</td>
                      <td className="px-2 py-1">{fmtPct(it.vote_pct)}</td>
                      <td className="px-2 py-1">{it.is_winner ? "★" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PdfFrame>
      );
    }

    case "international": {
      const s: any = (block as any).snapshot ?? {};
      return (
        <PdfFrame title={block.title ?? `🌐 ${s.country_name ?? (block as any).refId}`}>
          <KV rows={[
            ["Code", s.country_code ?? "—"],
            ["Capital", s.capital ?? "—"],
            ["Population", fmtNum(s.population)],
            ["GDP", fmtMoney(s.gdp)],
            ["GDP per capita", fmtMoney(s.gdp_per_capita)],
            ["Head of state", s.head_of_state ?? "—"],
            ["Head of government", s.head_of_government ?? "—"],
            ["Ruling party", s.ruling_party ?? "—"],
            ["Last election", fmtDate(s.last_election_date)],
            ["Next election", fmtDate(s.next_election_date)],
          ]} />
        </PdfFrame>
      );
    }

    case "legislation": {
      const s: any = (block as any).snapshot ?? {};
      return (
        <PdfFrame title={block.title ?? `⚖️ ${s.short_title ?? s.bill_id ?? (block as any).refId}`}>
          <KV rows={[
            ["Bill ID", s.bill_id ?? (block as any).refId],
            ["Title", s.title ?? "—"],
            ["Sponsor", s.sponsor_name ?? "—"],
            ["Status", s.status ?? "—"],
            ["Latest action", `${s.latest_action_text ?? "—"}${s.latest_action_date ? " (" + fmtDate(s.latest_action_date) + ")" : ""}`],
          ]} />
        </PdfFrame>
      );
    }

    case "messaging": {
      const s: any = (block as any).snapshot ?? {};
      return (
        <PdfFrame title={block.title ?? `📢 Messaging — ${s.title ?? (block as any).refId}`}>
          <KV rows={[
            ["Source", s.source ?? "—"],
            ["Author", s.author ?? "—"],
            ["Published", fmtDate(s.published_date)],
            ["Tags", Array.isArray(s.issue_areas) ? s.issue_areas.join(", ") : "—"],
          ]} />
          {s.summary && <Body>{s.summary}</Body>}
        </PdfFrame>
      );
    }

    case "messaging_ai": {
      const s: any = (block as any).snapshot ?? {};
      const item = s.item ?? {};
      const aud = s.audience_analysis;
      const tp: any[] = Array.isArray(s.talking_points) ? s.talking_points : [];
      const imp: any[] = Array.isArray(s.impact_analyses) ? s.impact_analyses : [];
      return (
        <PdfFrame title={block.title ?? `🧠 Messaging AI — ${item.title ?? (block as any).refId}`}>
          {aud && (
            <div className="space-y-1">
              <div className="text-[11px] font-bold">Effectiveness: {Math.round(aud.effectiveness_score ?? 0)}/100</div>
              {aud.summary && <Body>{aud.summary}</Body>}
              {Array.isArray(aud.segment_breakdown) && aud.segment_breakdown.slice(0, 8).map((seg: any, i: number) => (
                <div key={i} className="text-[11px]">
                  <span className="font-bold">• {seg.segment} — {seg.score}/100</span>
                  {seg.reasoning && <div className="ml-3 text-muted-foreground">{seg.reasoning}</div>}
                </div>
              ))}
              {Array.isArray(aud.risks) && aud.risks.length > 0 && (
                <div className="mt-1">
                  <div className="text-[11px] font-bold text-destructive">Risks:</div>
                  {aud.risks.slice(0, 6).map((r: any, i: number) => (
                    <div key={i} className="text-[11px] ml-2">⚠ [{r.severity}] {r.headline} — {r.summary ?? ""}</div>
                  ))}
                </div>
              )}
            </div>
          )}
          {tp.length > 0 && (
            <div>
              <div className="text-[11px] font-bold">Talking Points:</div>
              {tp.slice(0, 3).map((blk: any, i: number) => (
                <div key={i} className="text-[11px]">
                  <div className="font-bold text-muted-foreground">{blk.audience} / {blk.angle}</div>
                  {(Array.isArray(blk.points) ? blk.points : []).map((p: any, j: number) => (
                    <div key={j} className="ml-3">{j + 1}. {p.message ?? ""}</div>
                  ))}
                </div>
              ))}
            </div>
          )}
          {imp.length > 0 && (
            <div>
              <div className="text-[11px] font-bold">Impact Analyses:</div>
              {imp.slice(0, 3).map((a: any, i: number) => (
                <div key={i} className="text-[11px]">[{a.scope}{a.scope_ref ? " " + a.scope_ref : ""}] {a.summary ?? ""}</div>
              ))}
            </div>
          )}
        </PdfFrame>
      );
    }

    case "talking_points": {
      const items: any[] = (block as any).snapshot?.items ?? [];
      return (
        <PdfFrame title={block.title ?? `🗣️ Talking Points — ${(block as any).refId}`}>
          {items.length === 0 ? (
            <div className="text-[11px] italic text-muted-foreground">(no cached talking points)</div>
          ) : items.map((tp, i) => (
            <div key={i} className="space-y-1">
              <div className="text-[11px] font-bold">{tp.audience} / {tp.angle} — {fmtDate(tp.created_at)}</div>
              {(Array.isArray(tp.points) ? tp.points : []).map((p: any, j: number) => (
                <div key={j} className="text-[11px] ml-2">
                  <div className="font-bold">{j + 1}. {p.message ?? ""}</div>
                  {p.rationale && <div className="ml-3 text-muted-foreground">Why: {p.rationale}</div>}
                  {p.delivery_tips && <div className="ml-3 italic text-muted-foreground">Tip: {p.delivery_tips}</div>}
                </div>
              ))}
              {Array.isArray(tp.evidence) && tp.evidence.length > 0 && (
                <div className="text-[11px]">
                  <div className="font-bold">Evidence:</div>
                  {tp.evidence.map((e: any, k: number) => (
                    <div key={k} className="ml-3">• {e.claim}{e.source_hint ? " — " + e.source_hint : ""}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </PdfFrame>
      );
    }

    case "vulnerability": {
      const s: any = (block as any).snapshot ?? {};
      return (
        <PdfFrame title={block.title ?? `🛡️ Vulnerability — ${(block as any).refId}`} accent="destructive">
          <KV rows={[
            ["Score", s.score != null ? `${s.score}/100` : "—"],
            ["Generated", fmtDate(s.generated_at)],
            ["Model", s.model ?? "—"],
          ]} />
          {s.summary && <Body>{s.summary}</Body>}
        </PdfFrame>
      );
    }

    case "bill_impact": {
      const s: any = (block as any).snapshot ?? {};
      return (
        <PdfFrame title={block.title ?? `🧠 Bill Impact — ${(block as any).refId}`}>
          <KV rows={[
            ["Scope", `${s.scope ?? "—"}${s.scope_ref ? " · " + s.scope_ref : ""}`],
            ["Fiscal", s.fiscal_impact ?? "—"],
            ["Political", s.political_impact ?? "—"],
          ]} />
          {s.summary && <Body>{s.summary}</Body>}
        </PdfFrame>
      );
    }

    case "forecast": {
      const s: any = (block as any).snapshot ?? {};
      return (
        <PdfFrame title={block.title ?? `🎲 Forecast — ${(block as any).refId}`}>
          <KV rows={[
            ["Source", s.source ?? "—"],
            ["Rating", s.rating ?? "—"],
            ["Margin", s.margin != null ? String(s.margin) : "—"],
            ["Dem win prob", s.dem_win_prob != null ? fmtPct(s.dem_win_prob * 100) : "—"],
            ["Rep win prob", s.rep_win_prob != null ? fmtPct(s.rep_win_prob * 100) : "—"],
            ["Last updated", fmtDate(s.last_updated)],
          ]} />
        </PdfFrame>
      );
    }

    case "prediction_market": {
      const s: any = (block as any).snapshot ?? {};
      return (
        <PdfFrame title={block.title ?? `📉 ${s.title ?? (block as any).refId}`}>
          <KV rows={[
            ["Source", s.source ?? "—"],
            ["Yes price", s.yes_price != null ? `${(s.yes_price * 100).toFixed(0)}¢` : "—"],
            ["No price", s.no_price != null ? `${(s.no_price * 100).toFixed(0)}¢` : "—"],
            ["Volume", fmtMoney(s.volume)],
            ["Liquidity", fmtMoney(s.liquidity)],
          ]} />
        </PdfFrame>
      );
    }

    case "investigations":
    case "war_room":
    case "entity_graph": {
      const s: any = (block as any).snapshot ?? {};
      const counts = Object.entries(s).filter(([, v]) => Array.isArray(v));
      return (
        <PdfFrame title={block.title ?? `${block.type.replace(/_/g, " ")} — ${(block as any).refId}`}>
          {counts.length > 0 ? (
            <KV rows={counts.map(([k, v]) => [k, `${(v as any[]).length} item(s)`])} />
          ) : (
            <div className="text-[11px] italic text-muted-foreground">(no cached data)</div>
          )}
        </PdfFrame>
      );
    }

    case "osint_results": {
      const s: any = (block as any).snapshot ?? {};
      const results: any[] = Array.isArray(s.results) ? s.results : [];
      return (
        <PdfFrame title={block.title ?? `🔎 OSINT — ${(block as any).toolLabel ?? (block as any).toolId}`}>
          <KV rows={[
            ["Query", (block as any).query ?? "—"],
            ["Source URL", s.source_url ?? "—"],
            ["Fetched", fmtDate(s.fetched_at)],
          ]} />
          {results.length > 0 && (
            <ul className="text-[11px] space-y-1">
              {results.slice(0, 25).map((r, i) => (
                <li key={i} className="border-l-2 border-primary/40 pl-2">
                  {Object.entries(r).slice(0, 6).map(([k, v]) => (
                    <div key={k}><span className="font-bold text-muted-foreground">{k}:</span> {String(v)}</div>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </PdfFrame>
      );
    }

    case "subject_ai": {
      const s: any = (block as any).snapshot ?? {};
      return (
        <PdfFrame title={block.title ?? `🧠 Subject — ${(block as any).subject}`}>
          <KV rows={[
            ["Generated", fmtDate(s.generated_at)],
            ["Model", s.model ?? "—"],
          ]} />
          {s.audience_analysis && (
            <div className="text-[11px]">
              <div className="font-bold">Audience:</div>
              <pre className="whitespace-pre-wrap text-[10px] bg-muted p-2 rounded max-h-48 overflow-auto">
                {typeof s.audience_analysis === "string" ? s.audience_analysis : JSON.stringify(s.audience_analysis, null, 2)}
              </pre>
            </div>
          )}
          {s.talking_points && (
            <div className="text-[11px]">
              <div className="font-bold">Talking Points:</div>
              <pre className="whitespace-pre-wrap text-[10px] bg-muted p-2 rounded max-h-48 overflow-auto">
                {typeof s.talking_points === "string" ? s.talking_points : JSON.stringify(s.talking_points, null, 2)}
              </pre>
            </div>
          )}
        </PdfFrame>
      );
    }

    case "admin_activity": {
      const rows: any[] = (block as any).snapshot?.rows ?? [];
      return (
        <PdfFrame title={block.title ?? "📋 Activity Logs"} accent="muted">
          <div className="text-[11px] text-muted-foreground">{rows.length} rows cached</div>
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-muted">
                  <tr>
                    {["When", "User", "Action", "Target"].map((h) => (
                      <th key={h} className="px-2 py-1 text-left border-b border-border font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-b-0">
                      <td className="px-2 py-1">{fmtDate(r.created_at)}</td>
                      <td className="px-2 py-1">{r.user_email ?? r.user_id ?? "—"}</td>
                      <td className="px-2 py-1">{r.action ?? "—"}</td>
                      <td className="px-2 py-1">{r.target ?? r.entity ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PdfFrame>
      );
    }

    case "admin_locations": {
      const rows: any[] = (block as any).snapshot?.rows ?? [];
      return (
        <PdfFrame title={block.title ?? "📍 Location History"} accent="muted">
          <div className="text-[11px] text-muted-foreground">{rows.length} points cached</div>
        </PdfFrame>
      );
    }

    case "api_data": {
      const snap: any = (block as any).snapshot;
      return (
        <PdfFrame title={block.title ?? `🔌 API: ${(block as any).endpoint}`} accent="muted">
          {snap ? (
            <pre className="text-[10px] bg-muted p-2 rounded max-h-72 overflow-auto whitespace-pre-wrap">
              {typeof snap === "string" ? snap : JSON.stringify(snap, null, 2)}
            </pre>
          ) : (
            <div className="text-[11px] italic text-muted-foreground">(no cached data)</div>
          )}
        </PdfFrame>
      );
    }

    case "mcp_data": {
      const snap: any = (block as any).snapshot;
      return (
        <PdfFrame title={block.title ?? `🤖 MCP: ${(block as any).toolName}`} accent="muted">
          {snap ? (
            <pre className="text-[10px] bg-muted p-2 rounded max-h-72 overflow-auto whitespace-pre-wrap">
              {typeof snap === "string" ? snap : JSON.stringify(snap, null, 2)}
            </pre>
          ) : (
            <div className="text-[11px] italic text-muted-foreground">(no cached data)</div>
          )}
        </PdfFrame>
      );
    }

    default: {
      const snap: any = (block as any).snapshot;
      return (
        <PdfFrame title={`${(block as any).type}${block.title ? " — " + block.title : ""}`} accent="muted">
          {snap ? (
            <pre className="text-[10px] bg-muted p-2 rounded max-h-72 overflow-auto whitespace-pre-wrap">
              {JSON.stringify(snap, null, 2)}
            </pre>
          ) : (
            <div className="text-[11px] italic text-muted-foreground">(no cached data)</div>
          )}
        </PdfFrame>
      );
    }
  }
}
