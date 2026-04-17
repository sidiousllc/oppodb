import { Search } from "lucide-react";

interface ResearchToolsDashboardProps {
  onNavigateSubsection: (subsection: string) => void;
}

export function ResearchToolsDashboard({ onNavigateSubsection }: ResearchToolsDashboardProps) {
  const tools = [
    {
      id: "voter-data",
      emoji: "🗳️",
      label: "Voter Data",
      description: "Search voter records, registration data, live races, election history, and campaign finance by state.",
      features: ["Name / Address / District lookup", "Live race tracking", "Election history (MIT)", "State finance (FollowTheMoney)", "WinRed donations"],
    },
    {
      id: "court-records",
      emoji: "⚖️",
      label: "Court Records (JudyRecords)",
      description: "External search of millions of U.S. state and local court records via JudyRecords.",
      features: ["Federal & state court cases", "Name-based search", "Case number lookup", "Party & attorney search", "Direct links to case details"],
    },
    {
      id: "investigations",
      emoji: "🔍",
      label: "Investigations",
      description: "Public records intelligence: lobbying, federal contracts, courts, FARA, IG reports, and federal spending.",
      features: ["Senate LDA lobbying filings", "USAspending federal contracts", "CourtListener federal cases", "DOJ FARA registrants", "Inspector General reports", "Federal grants & spending"],
    },
    {
      id: "state-report",
      emoji: "📊",
      label: "State Report Generator",
      description: "Generate comprehensive intelligence reports for any state, pulling data from all databases.",
      features: ["Districts & demographics", "Election history & forecasts", "Campaign finance", "Polling & prediction markets", "Intel briefings & oppo research"],
    },
    {
      id: "war-rooms",
      emoji: "⚔️",
      label: "War Rooms",
      description: "Private collaboration spaces for teams: shared notes, real-time chat, and pinned intel on a candidate or race.",
      features: ["Private team rooms", "Real-time chat", "Member invites by email", "Race scope tagging", "Owner / editor / viewer roles"],
    },
    {
      id: "stakeholders",
      emoji: "🤝",
      label: "Stakeholders (CRM)",
      description: "Track donors, volunteers, vendors, allies, and adversaries across campaigns and accounts.",
      features: ["Contact records & tags", "Activity timeline", "Org / individual relationships", "Notes & follow-ups", "CSV export"],
    },
    {
      id: "forecast-lab",
      emoji: "🎲",
      label: "Forecast Lab",
      description: "Monte Carlo scenario simulator powered by DataHub forecasts, polling aggregates, and prediction markets.",
      features: ["Monte Carlo simulation", "National swing modeling", "Seed from Cook/538/Sabato", "Pull from polling aggregates", "Prediction market priors", "Save & compare scenarios"],
    },
    {
      id: "entity-graph",
      emoji: "🕸️",
      label: "Entity Graph",
      description: "Visualize relationships between candidates, donors, PACs, lobbyists, contractors, and bills.",
      features: ["Money flow visualization", "Co-sponsorship networks", "Lobbying client graphs", "Contractor relationships", "Interactive exploration"],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="win98-sunken bg-[hsl(var(--win98-light))] px-3 py-2 mb-3">
        <div className="flex items-center gap-2 text-[11px]">
          <Search className="h-4 w-4" />
          <span className="font-bold">Research Tools</span>
          <span className="text-[hsl(var(--muted-foreground))]">— Integrated search, collaboration, and modeling across public records and platform data</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onNavigateSubsection(tool.id)}
            className="candidate-card text-left hover:bg-[hsl(var(--win98-light))] transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{tool.emoji}</span>
              <span className="text-sm font-bold">{tool.label}</span>
            </div>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-2">{tool.description}</p>
            <div className="space-y-1">
              {tool.features.map((f) => (
                <div key={f} className="text-[9px] flex items-center gap-1">
                  <span className="text-[hsl(var(--muted-foreground))]">•</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
