import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Users, BarChart3, Database, Globe, Loader2, RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

interface StateVoterStat {
  state: string;
  total_registered: number;
  total_eligible: number;
  registration_rate: number;
  turnout_general_2024: number | null;
  source: string;
  source_url: string;
  updated_at: string;
}

export function VoterStatsPanel() {
  const [stats, setStats] = useState<StateVoterStat[]>([]);
  const [national, setNational] = useState<{totalRegistered: number; totalEligible: number; avgRegistrationRate: number; stateCount: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [view, setView] = useState<"stats" | "portals" | "sources">("stats");

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voter-registration-stats`,
        {
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
      const data = await response.json();
      if (data.national) setNational(data.national);
      if (data.states) setStats(data.states);
      if (data.lastUpdated) setLastSync(data.lastUpdated);
    } catch (e) {
      console.error("Failed to fetch voter stats:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voter-file-sync`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "sync_stats" }),
        }
      );
      await fetchStats();
    } catch (e) {
      console.error("Sync failed:", e);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const sortedStats = [...stats].sort((a, b) => b.total_registered - a.total_registered);

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex gap-0 mb-3 border-b border-[hsl(var(--win98-shadow))]">
        {([
          { id: "stats", label: "Registration Stats", icon: BarChart3 },
          { id: "portals", label: "State Portals", icon: Globe },
          { id: "sources", label: "Data Sources", icon: Database },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`win98-button text-[10px] flex items-center gap-1 ${
              view === t.id ? "font-bold bg-white border-b-2 border-white" : ""
            }`}
          >
            <t.icon className="h-3 w-3" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Stats View */}
      {view === "stats" && (
        <div>
          {national && (
            <div className="win98-raised p-3 mb-3 bg-[hsl(var(--win98-titlebar))] text-white">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4" />
                <span className="font-bold text-[11px]">National Voter Registration</span>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="ml-auto win98-button text-[9px] flex items-center gap-1 disabled:opacity-50"
                >
                  {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  {syncing ? "Syncing..." : "Sync Data"}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <div className="text-xl font-bold">{national.totalRegistered.toLocaleString()}</div>
                  <div className="text-[9px] opacity-80">Total Registered</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{national.totalEligible.toLocaleString()}</div>
                  <div className="text-[9px] opacity-80">Total Eligible</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{national.avgRegistrationRate.toFixed(1)}%</div>
                  <div className="text-[9px] opacity-80">Avg Reg Rate</div>
                </div>
                <div>
                  <div className="text-xl font-bold">{national.stateCount}</div>
                  <div className="text-[9px] opacity-80">States</div>
                </div>
              </div>
              {lastSync && (
                <div className="text-[8px] mt-2 opacity-60 text-center">
                  Last synced: {new Date(lastSync).toLocaleDateString()}
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-[hsl(var(--muted-foreground))]" />
              <p className="text-[10px] mt-2 text-[hsl(var(--muted-foreground))]">Loading voter registration data...</p>
            </div>
          ) : stats.length > 0 ? (
            <div className="win98-sunken bg-white p-2">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-[hsl(var(--win98-shadow))] text-left">
                    <th className="pb-1 font-bold">State</th>
                    <th className="pb-1 text-right font-bold">Registered</th>
                    <th className="pb-1 text-right font-bold">Eligible</th>
                    <th className="pb-1 text-right font-bold">Reg Rate</th>
                    <th className="pb-1 text-right font-bold">Turnout '24</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStats.map(s => (
                    <tr key={s.state} className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))]">
                      <td className="py-1 font-bold">{s.state}</td>
                      <td className="py-1 text-right">{s.total_registered?.toLocaleString() ?? "—"}</td>
                      <td className="py-1 text-right">{s.total_eligible?.toLocaleString() ?? "—"}</td>
                      <td className="py-1 text-right">
                        {s.registration_rate ? (
                          <span className={`font-bold ${
                            s.registration_rate >= 90 ? "text-[hsl(140,60%,30%)]"
                              : s.registration_rate >= 80 ? "text-[hsl(45,80%,35%)]"
                              : "text-[hsl(0,70%,45%)]"
                          }`}>{s.registration_rate.toFixed(1)}%</span>
                        ) : "—"}
                      </td>
                      <td className="py-1 text-right text-[9px]">
                        {s.turnout_general_2024 ? `${s.turnout_general_2024}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="win98-sunken bg-white p-6 text-center">
              <BarChart3 className="h-6 w-6 mx-auto mb-2 text-[hsl(var(--muted-foreground))] opacity-40" />
              <p className="text-[11px] font-bold mb-1">No voter registration data yet</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-2">
                Click "Sync Data" to load registration statistics from EAVS 2024.
              </p>
              <button onClick={handleSync} disabled={syncing} className="win98-button text-[10px] flex items-center gap-1 mx-auto disabled:opacity-50">
                {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                {syncing ? "Syncing..." : "Sync Data"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Portals View */}
      {view === "portals" && (
        <div>
          <div className="win98-sunken bg-white p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="h-4 w-4" />
              <span className="font-bold text-[11px]">Official State Voter Lookup Portals</span>
            </div>
            <p className="text-[9px] text-[hsl(var(--muted-foreground))] mb-3">
              Direct links to official state voter registration lookup tools.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
              {US_STATES.map(st => (
                <a
                  key={st}
                  href={`https://www.google.com/search?q=${st}+voter+registration+lookup+official+site:gov`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="win98-button text-[10px] flex items-center gap-1 px-2 py-1 hover:bg-[hsl(var(--win98-light))]"
                >
                  <span className="font-bold">{st}</span>
                  <ExternalLink className="h-3 w-3 ml-auto shrink-0 opacity-50" />
                </a>
              ))}
            </div>
            <p className="text-[8px] text-[hsl(var(--muted-foreground))] mt-2 italic">
              Note: Most portals require name + DOB or voter ID to look up registration status.
            </p>
          </div>

          <div className="win98-raised p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4" style={{ color: "hsl(40, 90%, 45%)" }} />
              <span className="font-bold text-[11px]">Disclaimer</span>
            </div>
            <p className="text-[9px] text-[hsl(var(--muted-foreground))]">
              OppoDB does not sell, share, or provide access to individual voter records. All voter lookup must be done through official state portals, which have their own terms of use.
            </p>
          </div>
        </div>
      )}

      {/* Sources View */}
      {view === "sources" && (
        <div>
          <div className="win98-sunken bg-white p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-4 w-4" />
              <span className="font-bold text-[11px]">State Voter Data Sources</span>
            </div>
            <p className="text-[9px] text-[hsl(var(--muted-foreground))] mb-3">
              Which states make voter registration data publicly available.
            </p>
            <div className="space-y-2">
              {[
                { state: "Florida", status: "public", notes: "Monthly CSV downloads at flvot.org" },
                { state: "Colorado", status: "public", notes: "Quarterly data with data use agreement" },
                { state: "Washington", status: "public", notes: "Available via public records request" },
                { state: "Oregon", status: "public", notes: "Quarterly extracts by request" },
                { state: "North Carolina", status: "public", notes: "Monthly downloads at NCSBE" },
                { state: "Georgia", status: "aggregate", notes: "Statewide totals only" },
                { state: "Texas", status: "aggregate", notes: "County-level aggregate data only" },
                { state: "Most States", status: "restricted", notes: "Individual voter data restricted to election officials" },
              ].map(s => (
                <div key={s.state} className="win98-raised p-2 flex items-start gap-2">
                  {s.status === "public" ? (
                    <CheckCircle className="h-4 w-4 shrink-0" style={{ color: "hsl(140, 60%, 35%)" }} />
                  ) : s.status === "aggregate" ? (
                    <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "hsl(40, 90%, 45%)" }} />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0" style={{ color: "hsl(0, 70%, 50%)" }} />
                  )}
                  <div>
                    <span className="font-bold text-[10px]">{s.state}</span>
                    <p className="text-[9px] text-[hsl(var(--muted-foreground))]">{s.notes}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
