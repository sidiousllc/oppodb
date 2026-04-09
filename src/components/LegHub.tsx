import { useState } from "react";
import { Scale, Landmark } from "lucide-react";
import { StateLegislativeSection } from "@/components/StateLegislativeSection";
import { LegislationSection } from "@/components/LegislationSection";
import type { StateLegislativeProfile } from "@/data/stateLegislativeIntel";

type LegHubTab = "state-legislative" | "legislation";

interface LegHubProps {
  stateLegDistricts: StateLegislativeProfile[];
  stateLegLoading: boolean;
  onStateLegSync: (stateAbbr?: string, chamber?: string) => void;
  stateLegSyncing: boolean;
}

export function LegHub({ stateLegDistricts, stateLegLoading, onStateLegSync, stateLegSyncing }: LegHubProps) {
  const [tab, setTab] = useState<LegHubTab>("state-legislative");

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Scale className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold text-foreground">LegHub</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-2">
        <button
          onClick={() => setTab("state-legislative")}
          className={`win98-button text-[10px] flex items-center gap-1 ${tab === "state-legislative" ? "font-bold" : ""}`}
        >
          <Landmark className="h-3 w-3" />
          State Legislatures ({stateLegDistricts.length})
        </button>
        <button
          onClick={() => setTab("legislation")}
          className={`win98-button text-[10px] flex items-center gap-1 ${tab === "legislation" ? "font-bold" : ""}`}
        >
          <Scale className="h-3 w-3" />
          Legislation
        </button>
      </div>

      {/* Tab Content */}
      {tab === "state-legislative" && (
        <StateLegislativeSection
          districts={stateLegDistricts}
          loading={stateLegLoading}
          onSync={onStateLegSync}
          syncing={stateLegSyncing}
        />
      )}
      {tab === "legislation" && <LegislationSection />}
    </div>
  );
}
