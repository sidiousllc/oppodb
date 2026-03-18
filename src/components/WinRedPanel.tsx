import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, DollarSign, Users, Loader2, ChevronDown, ChevronRight, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

function formatMoney(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

interface WinRedDonation {
  id: string;
  donor_first_name: string | null;
  donor_last_name: string | null;
  donor_email: string | null;
  donor_phone: string | null;
  donor_address: string | null;
  donor_city: string | null;
  donor_state: string | null;
  donor_zip: string | null;
  donor_employer: string | null;
  donor_occupation: string | null;
  amount: number;
  recurring: boolean;
  page_name: string | null;
  candidate_name: string | null;
  committee_name: string | null;
  transaction_id: string | null;
  transaction_date: string | null;
  refunded: boolean;
}

export function WinRedPanel({ embedded }: { embedded?: boolean }) {
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [state, setState] = useState("");
  const [email, setEmail] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<WinRedDonation[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    setExpandedIdx(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please log in"); setLoading(false); return; }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/winred-webhook/search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            last_name: lastName.trim() || undefined,
            first_name: firstName.trim() || undefined,
            state: state || undefined,
            email: email.trim() || undefined,
            candidate_name: candidateName.trim() || undefined,
            min_amount: minAmount ? parseFloat(minAmount) : undefined,
          }),
        }
      );

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Search failed");

      setResults(data.results || []);
      setStats(data.stats || null);
      if ((data.results || []).length === 0) toast.info("No WinRed donations found");
    } catch (e: any) {
      toast.error(e.message || "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [lastName, firstName, state, email, candidateName, minAmount]);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/winred-webhook`;

  const containerClass = embedded ? "" : "rounded-xl border border-border bg-card p-6 mb-6";

  return (
    <div className={containerClass}>
      {!embedded && (
        <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5" style={{ color: "hsl(0, 70%, 50%)" }} />
          WinRed Donations
        </h2>
      )}

      {/* Webhook setup info */}
      <div className="win98-raised bg-[hsl(var(--win98-face))] p-2 mb-3">
        <details>
          <summary className="text-[10px] font-bold cursor-pointer">⚙️ Webhook Setup Instructions</summary>
          <div className="text-[9px] text-muted-foreground mt-2 space-y-1">
            <p>1. Log in to <a href="https://portal.winred.com" target="_blank" rel="noopener noreferrer" className="underline">portal.winred.com</a></p>
            <p>2. Go to <b>Utilities → Integrations</b></p>
            <p>3. Click <b>Add Integration</b> → select <b>Webhook</b></p>
            <p>4. Set the Endpoint URL to:</p>
            <code className="block bg-white px-2 py-1 border border-[hsl(var(--win98-shadow))] text-[8px] break-all select-all">
              {webhookUrl}
            </code>
            <p>5. Save. Donations will now flow in real-time!</p>
          </div>
        </details>
      </div>

      {/* Search form */}
      <div className="win98-sunken bg-white p-3 mb-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] font-bold mb-1">Last Name:</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)} className="win98-input w-full" placeholder="e.g. Smith" maxLength={100} />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-1">First Name:</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)} className="win98-input w-full" placeholder="Optional" maxLength={100} />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-1">State:</label>
            <select value={state} onChange={e => setState(e.target.value)} className="win98-input w-full">
              <option value="">All states</option>
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-1">Email:</label>
            <input value={email} onChange={e => setEmail(e.target.value)} className="win98-input w-full" placeholder="donor@email.com" maxLength={200} />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-1">Candidate:</label>
            <input value={candidateName} onChange={e => setCandidateName(e.target.value)} className="win98-input w-full" placeholder="e.g. Trump" maxLength={100} />
          </div>
          <div>
            <label className="block text-[10px] font-bold mb-1">Min Amount:</label>
            <input value={minAmount} onChange={e => setMinAmount(e.target.value)} className="win98-input w-full" placeholder="e.g. 100" type="number" />
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <button onClick={handleSearch} disabled={loading} className="win98-button text-[10px] font-bold flex items-center gap-1 disabled:opacity-50">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            {loading ? "Searching..." : "Search WinRed"}
          </button>
          <span className="text-[9px] text-muted-foreground">
            Searches your WinRed webhook donation data
          </span>
        </div>
      </div>

      {/* Stats */}
      {stats && hasSearched && !loading && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="win98-raised p-2 text-center">
            <p className="text-[9px] font-bold text-muted-foreground">Donations</p>
            <p className="text-lg font-bold">{stats.count}</p>
          </div>
          <div className="win98-raised p-2 text-center">
            <p className="text-[9px] font-bold text-muted-foreground">Total Amount</p>
            <p className="text-lg font-bold" style={{ color: "hsl(150, 55%, 45%)" }}>{formatMoney(stats.total_amount)}</p>
          </div>
          <div className="win98-raised p-2 text-center">
            <p className="text-[9px] font-bold text-muted-foreground">Unique Donors</p>
            <p className="text-lg font-bold">{stats.unique_donors}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {hasSearched && !loading && results.length > 0 && (
        <div className="win98-sunken bg-white">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-[hsl(var(--win98-face))] border-b border-[hsl(var(--win98-shadow))]">
                <th className="text-left px-2 py-1 font-bold w-5"></th>
                <th className="text-left px-2 py-1 font-bold">Donor</th>
                <th className="text-left px-2 py-1 font-bold">Location</th>
                <th className="text-left px-2 py-1 font-bold">Candidate</th>
                <th className="text-right px-2 py-1 font-bold">Amount</th>
                <th className="text-left px-2 py-1 font-bold">Date</th>
              </tr>
            </thead>
            <tbody>
              {results.map((d, idx) => {
                const isExp = expandedIdx === idx;
                const dateStr = d.transaction_date
                  ? new Date(d.transaction_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "—";
                return (
                  <tbody key={d.id}>
                    <tr
                      onClick={() => setExpandedIdx(isExp ? null : idx)}
                      className="border-b border-[hsl(var(--win98-light))] hover:bg-[hsl(var(--win98-light))] cursor-pointer"
                    >
                      <td className="px-1 py-1">
                        {isExp ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </td>
                      <td className="px-2 py-1">
                        <span className="font-bold">{d.donor_first_name} {d.donor_last_name}</span>
                        {d.donor_employer && (
                          <span className="block text-[8px] text-muted-foreground">{d.donor_occupation} @ {d.donor_employer}</span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {[d.donor_city, d.donor_state].filter(Boolean).join(", ") || "—"}
                        {d.donor_zip && <span className="text-[9px] text-muted-foreground ml-1">{d.donor_zip}</span>}
                      </td>
                      <td className="px-2 py-1">{d.candidate_name || d.committee_name || d.page_name || "—"}</td>
                      <td className="px-2 py-1 text-right font-bold" style={{ color: d.refunded ? "hsl(0, 70%, 50%)" : "hsl(150, 55%, 45%)" }}>
                        {d.refunded && "⊘ "}${d.amount.toLocaleString()}
                        {d.recurring && <RefreshCw className="h-2.5 w-2.5 inline ml-0.5" style={{ color: "hsl(210, 70%, 50%)" }} />}
                      </td>
                      <td className="px-2 py-1 text-[9px]">{dateStr}</td>
                    </tr>
                    {isExp && (
                      <tr className="bg-[hsl(var(--win98-light))]">
                        <td colSpan={6} className="px-3 py-2">
                          <div className="grid grid-cols-3 gap-3 text-[10px]">
                            <div className="win98-sunken bg-white p-2">
                              <p className="font-bold mb-1 text-[9px] border-b border-[hsl(var(--win98-shadow))] pb-0.5">Donor Info</p>
                              <div className="space-y-0.5">
                                <div><b>Name:</b> {d.donor_first_name} {d.donor_last_name}</div>
                                {d.donor_email && <div><b>Email:</b> {d.donor_email}</div>}
                                {d.donor_phone && <div><b>Phone:</b> {d.donor_phone}</div>}
                                {d.donor_employer && <div><b>Employer:</b> {d.donor_employer}</div>}
                                {d.donor_occupation && <div><b>Occupation:</b> {d.donor_occupation}</div>}
                              </div>
                            </div>
                            <div className="win98-sunken bg-white p-2">
                              <p className="font-bold mb-1 text-[9px] border-b border-[hsl(var(--win98-shadow))] pb-0.5">Address</p>
                              <div className="space-y-0.5">
                                {d.donor_address && <div>{d.donor_address}</div>}
                                <div>{[d.donor_city, d.donor_state].filter(Boolean).join(", ")} {d.donor_zip}</div>
                              </div>
                            </div>
                            <div className="win98-sunken bg-white p-2">
                              <p className="font-bold mb-1 text-[9px] border-b border-[hsl(var(--win98-shadow))] pb-0.5">Transaction</p>
                              <div className="space-y-0.5">
                                <div><b>Amount:</b> <span style={{ color: "hsl(150, 55%, 45%)" }}>${d.amount.toLocaleString()}</span></div>
                                <div><b>Recurring:</b> {d.recurring ? "Yes" : "No"}</div>
                                <div><b>Refunded:</b> {d.refunded ? "Yes" : "No"}</div>
                                {d.page_name && <div><b>Page:</b> {d.page_name}</div>}
                                {d.candidate_name && <div><b>Candidate:</b> {d.candidate_name}</div>}
                                {d.committee_name && <div><b>Committee:</b> {d.committee_name}</div>}
                                {d.transaction_id && <div><b>TX ID:</b> <code className="text-[8px]">{d.transaction_id}</code></div>}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasSearched && !loading && results.length === 0 && (
        <div className="win98-sunken bg-white p-6 text-center text-[10px] text-muted-foreground">
          <Users className="h-6 w-6 mx-auto mb-2 opacity-40" />
          No WinRed donations found. Make sure the webhook is configured.
        </div>
      )}

      {!hasSearched && (
        <div className="win98-sunken bg-white p-6 text-center text-[10px] text-muted-foreground">
          <span className="text-3xl block mb-2">🟥</span>
          <p className="font-bold mb-1">WinRed Donation Search</p>
          <p>Search donor records received via WinRed webhook integration.</p>
          <p className="mt-1 text-[9px]">
            Configure the webhook in your WinRed portal to start receiving real-time donation data.
          </p>
        </div>
      )}
    </div>
  );
}
