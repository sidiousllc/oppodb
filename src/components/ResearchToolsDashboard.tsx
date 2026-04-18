import { Search, ArrowLeft } from "lucide-react";
import { OSINT_TOOLS, OSINT_CATEGORY_META, type OSINTCategory } from "@/data/osintTools";

interface ResearchToolsDashboardProps {
  onNavigateSubsection: (subsection: string) => void;
}

// Built-in (non-OSINT) tools — existing platform features.
const PLATFORM_TOOLS = [
  { id: "voter-data", emoji: "🗳️", label: "Voter Data", description: "Voter registration, live races, election history, campaign finance.", features: ["Name / Address lookup", "Live races", "MIT election history", "FollowTheMoney", "WinRed donations"] },
  { id: "court-records", emoji: "⚖️", label: "Court Records", description: "Federal (CourtListener) + State (JudyRecords) court case search.", features: ["Federal & state cases", "Case number lookup", "Party search", "Document viewer"] },
  { id: "investigations", emoji: "🔍", label: "Investigations", description: "Lobbying, federal contracts, FARA, IG reports, federal spending.", features: ["Senate LDA", "USAspending", "DOJ FARA", "IG reports"] },
  { id: "state-report", emoji: "📊", label: "State Report Generator", description: "Comprehensive intelligence reports for any state.", features: ["Demographics", "Forecasts", "Finance", "Polling", "Intel briefings"] },
  { id: "war-rooms", emoji: "⚔️", label: "War Rooms", description: "Private team collaboration with shared notes, chat, and pinned intel.", features: ["Private rooms", "Real-time chat", "Member invites", "Race scope"] },
  { id: "stakeholders", emoji: "🤝", label: "Stakeholders (CRM)", description: "Track donors, volunteers, vendors, allies, and adversaries.", features: ["Contact records", "Activity timeline", "Notes & follow-ups", "CSV export"] },
  { id: "forecast-lab", emoji: "🎲", label: "Forecast Lab", description: "Monte Carlo scenario simulator powered by polling and markets.", features: ["Monte Carlo", "Polling priors", "Market priors", "Save scenarios"] },
  { id: "entity-graph", emoji: "🕸️", label: "Entity Graph", description: "Visualize relationships between candidates, donors, PACs, lobbyists.", features: ["Money flow", "Co-sponsorship", "Lobbying graphs", "Interactive"] },
];

export function ResearchToolsDashboard({ onNavigateSubsection }: ResearchToolsDashboardProps) {
  const categories: OSINTCategory[] = ["people", "business", "property"];

  return (
    <div className="space-y-4">
      <div className="win98-sunken bg-[hsl(var(--win98-light))] px-3 py-2 mb-3">
        <div className="flex items-center gap-2 text-[11px]">
          <Search className="h-4 w-4" />
          <span className="font-bold">Research Tools</span>
          <span className="text-[hsl(var(--muted-foreground))]">— {PLATFORM_TOOLS.length} platform tools + {OSINT_TOOLS.length} OSINT lookups, all AI-augmented</span>
        </div>
      </div>

      {/* Platform tools (existing) */}
      <section>
        <div className="text-[10px] font-bold mb-2 px-1">🏛️ Platform Research Tools</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {PLATFORM_TOOLS.map((tool) => (
            <ToolCard
              key={tool.id}
              emoji={tool.emoji}
              label={tool.label}
              description={tool.description}
              features={tool.features}
              onClick={() => onNavigateSubsection(tool.id)}
            />
          ))}
        </div>
      </section>

      {/* OSINT toolbox by category */}
      {categories.map((cat) => {
        const meta = OSINT_CATEGORY_META[cat];
        const tools = OSINT_TOOLS.filter((t) => t.category === cat);
        return (
          <section key={cat}>
            <div className="text-[10px] font-bold mb-2 px-1 flex items-center gap-1.5">
              <span className="text-base">{meta.emoji}</span>
              {meta.label}
              <span className="text-[hsl(var(--muted-foreground))] font-normal">— {meta.description}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <ToolCard
                  key={tool.id}
                  emoji={tool.emoji}
                  label={tool.label}
                  description={tool.description}
                  features={tool.tags}
                  onClick={() => onNavigateSubsection(`osint:${tool.id}`)}
                  compact
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ToolCard({ emoji, label, description, features, onClick, compact = false }: {
  emoji: string; label: string; description: string; features: string[]; onClick: () => void; compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="candidate-card text-left hover:bg-[hsl(var(--win98-light))] transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={compact ? "text-base" : "text-xl"}>{emoji}</span>
        <span className={`${compact ? "text-[11px]" : "text-sm"} font-bold`}>{label}</span>
      </div>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-2">{description}</p>
      <div className={compact ? "flex flex-wrap gap-1" : "space-y-1"}>
        {features.slice(0, compact ? 4 : 5).map((f) => (
          compact ? (
            <span key={f} className="text-[8px] px-1 bg-[hsl(var(--win98-light))] border border-[hsl(var(--win98-shadow))]">{f}</span>
          ) : (
            <div key={f} className="text-[9px] flex items-center gap-1">
              <span className="text-[hsl(var(--muted-foreground))]">•</span>
              <span>{f}</span>
            </div>
          )
        ))}
      </div>
    </button>
  );
}
