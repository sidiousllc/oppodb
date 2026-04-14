import { useState, useCallback } from "react";
import { Globe, Search, ArrowLeft } from "lucide-react";
import { CONTINENTS, COUNTRIES, getCountriesByContinent, CONTINENT_EMOJI, type CountryInfo } from "@/data/internationalCountries";
import { CountryDetail } from "./CountryDetail";
import { ResearchToolsDashboard } from "./ResearchToolsDashboard";
import { VoterDataSection } from "./VoterDataSection";
import { CourtRecordsSearch } from "./CourtRecordsSearch";
import { StateReportGenerator } from "./StateReportGenerator";

export function InternationalHub() {
  const [selectedContinent, setSelectedContinent] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // US subsection routing (when user picks USA from North America)
  const [usSubsection, setUsSubsection] = useState<string | null>(null);

  const handleSelectCountry = useCallback((code: string) => {
    setSelectedCountry(code);
    setUsSubsection(null);
  }, []);

  const handleBack = useCallback(() => {
    if (usSubsection) {
      setUsSubsection(null);
      return;
    }
    if (selectedCountry) {
      // If US, go back to continent
      setSelectedCountry(null);
      return;
    }
    if (selectedContinent) {
      setSelectedContinent(null);
      return;
    }
  }, [selectedContinent, selectedCountry, usSubsection]);

  // US-specific: render existing US tools
  if (selectedCountry === "US") {
    if (usSubsection === "voter-data") {
      return (
        <div>
          <button onClick={handleBack} className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-3">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to USA
          </button>
          <VoterDataSection />
        </div>
      );
    }
    if (usSubsection === "court-records") {
      return <CourtRecordsSearch onBack={handleBack} />;
    }
    if (usSubsection === "state-report") {
      return <StateReportGenerator onBack={handleBack} />;
    }
    // Show US research tools dashboard
    return (
      <div>
        <button onClick={() => setSelectedCountry(null)} className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to North America
        </button>
        <div className="win98-sunken bg-[hsl(var(--win98-light))] px-3 py-2 mb-3">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-base">🇺🇸</span>
            <span className="font-bold">United States</span>
            <span className="text-[hsl(var(--muted-foreground))]">— Research tools and intelligence</span>
          </div>
        </div>
        <ResearchToolsDashboard onNavigateSubsection={(sub) => setUsSubsection(sub)} />
      </div>
    );
  }

  // Country detail view
  if (selectedCountry) {
    return <CountryDetail countryCode={selectedCountry} onBack={handleBack} />;
  }

  // Continent country list
  if (selectedContinent) {
    const countries = getCountriesByContinent(selectedContinent);
    const filtered = search
      ? countries.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()))
      : countries;

    // Group by region
    const byRegion = new Map<string, CountryInfo[]>();
    for (const c of filtered) {
      if (!byRegion.has(c.region)) byRegion.set(c.region, []);
      byRegion.get(c.region)!.push(c);
    }

    return (
      <div className="space-y-3">
        <button onClick={handleBack} className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Continents
        </button>

        <div className="win98-sunken bg-[hsl(var(--win98-light))] px-3 py-2">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-base">{CONTINENT_EMOJI[selectedContinent] || "🌐"}</span>
            <span className="font-bold">{selectedContinent}</span>
            <span className="text-[hsl(var(--muted-foreground))]">— {countries.length} countries</span>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search countries..."
            className="win98-input w-full pl-7 text-[11px] py-1.5"
          />
        </div>

        {[...byRegion.entries()].map(([region, regionCountries]) => (
          <div key={region}>
            <h3 className="text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-1.5 px-1">{region}</h3>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {regionCountries.map((c) => (
                <button
                  key={c.code}
                  onClick={() => handleSelectCountry(c.code)}
                  className="candidate-card text-left hover:bg-[hsl(var(--win98-light))] transition-colors p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{c.flag}</span>
                    <div>
                      <span className="text-[11px] font-bold block">{c.name}</span>
                      <span className="text-[9px] text-[hsl(var(--muted-foreground))]">{c.code}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Main continent picker
  return (
    <div className="space-y-4">
      <div className="win98-sunken bg-[hsl(var(--win98-light))] px-3 py-2 mb-3">
        <div className="flex items-center gap-2 text-[11px]">
          <Globe className="h-4 w-4" />
          <span className="font-bold">InternationalHub</span>
          <span className="text-[hsl(var(--muted-foreground))]">— Global political intelligence by continent and country</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CONTINENTS.map((continent) => {
          const countries = getCountriesByContinent(continent);
          return (
            <button
              key={continent}
              onClick={() => { setSelectedContinent(continent); setSearch(""); }}
              className="candidate-card text-left hover:bg-[hsl(var(--win98-light))] transition-colors p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{CONTINENT_EMOJI[continent] || "🌐"}</span>
                <span className="text-sm font-bold">{continent}</span>
              </div>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] mb-2">
                {countries.length} countries tracked
              </p>
              <div className="flex flex-wrap gap-1">
                {countries.slice(0, 5).map(c => (
                  <span key={c.code} className="text-xs">{c.flag}</span>
                ))}
                {countries.length > 5 && (
                  <span className="text-[9px] text-[hsl(var(--muted-foreground))]">+{countries.length - 5} more</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
