import { Users, Scale, Search } from "lucide-react";

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
      label: "Court Records",
      description: "Search millions of U.S. court case records via JudyRecords — covers federal, state, and local courts.",
      features: ["Federal & state court cases", "Name-based search", "Case number lookup", "Party & attorney search", "Direct links to case details"],
    },
    {
      id: "state-report",
      emoji: "📊",
      label: "State Report Generator",
      description: "Generate comprehensive intelligence reports for any state, pulling data from all databases.",
      features: ["Districts & demographics", "Election history & forecasts", "Campaign finance", "Polling & prediction markets", "Intel briefings & oppo research"],
    },
    {
      id: "federal-spending",
      emoji: "💵",
      label: "Federal Spending",
      description: "Browse federal contracts and grants from USASpending.gov by state and congressional district.",
      features: ["Federal contracts by state", "Grant awards by agency", "Spending by congressional district", "Top recipients & NAICS codes"],
    },
    {
      id: "ig-reports",
      emoji: "🔍",
      label: "IG Reports",
      description: "Inspector General oversight reports from 65+ federal agencies via Oversight.garden.",
      features: ["Audit & investigation reports", "Search by agency", "Waste/fraud/abuse findings", "PDF report access"],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="win98-sunken bg-[hsl(var(--win98-light))] px-3 py-2 mb-3">
        <div className="flex items-center gap-2 text-[11px]">
          <Search className="h-4 w-4" />
          <span className="font-bold">Research Tools</span>
          <span className="text-[hsl(var(--muted-foreground))]">— Integrated search across public records and data sources</span>
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
