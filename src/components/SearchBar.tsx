import { useState, useRef, useEffect, useMemo } from "react";
import { Search, X, User, AlertTriangle, Globe, FileText, MapPin, Landmark } from "lucide-react";
import { searchCandidates } from "@/data/candidates";
import { searchMagaFiles } from "@/data/magaFiles";
import { searchLocalImpact } from "@/data/localImpact";
import { searchNarrativeReports } from "@/data/narrativeReports";
import { searchDistricts, type DistrictProfile } from "@/data/districtIntel";

type SearchResultType = "candidate" | "maga" | "local" | "narrative" | "district";

interface SearchResult {
  type: SearchResultType;
  slug: string;
  title: string;
  subtitle?: string;
  section: string;
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  districts?: DistrictProfile[];
  onNavigate?: (section: string, slug: string) => void;
}

const TYPE_CONFIG: Record<SearchResultType, { icon: React.ReactNode; label: string; section: string }> = {
  candidate: { icon: <User className="h-3 w-3" />, label: "Candidate", section: "candidates" },
  maga: { icon: <AlertTriangle className="h-3 w-3" />, label: "MAGA File", section: "maga-files" },
  local: { icon: <Globe className="h-3 w-3" />, label: "State", section: "local-impact" },
  narrative: { icon: <FileText className="h-3 w-3" />, label: "Report", section: "narratives" },
  district: { icon: <MapPin className="h-3 w-3" />, label: "District", section: "district-intel" },
};

export function SearchBar({ value, onChange, placeholder = "Search candidates, issues, states, districts...", districts = [], onNavigate }: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo<SearchResult[]>(() => {
    if (!value || value.length < 2) return [];

    const all: SearchResult[] = [];

    // Search candidates
    const candidateResults = searchCandidates(value).slice(0, 8);
    for (const c of candidateResults) {
      const stateTag = c.state ? ` (${c.state})` : "";
      all.push({
        type: "candidate",
        slug: c.slug,
        title: c.name,
        subtitle: `${c.category.charAt(0).toUpperCase() + c.category.slice(1)}${stateTag}`,
        section: "candidates",
      });
    }

    // Search districts
    const districtResults = searchDistricts(districts, value).slice(0, 6);
    for (const d of districtResults) {
      all.push({
        type: "district",
        slug: d.district_id,
        title: d.district_id,
        subtitle: d.state ? `${d.state} — Pop: ${d.population?.toLocaleString() ?? "N/A"}` : undefined,
        section: "district-intel",
      });
    }

    // Search local impact (states)
    const localResults = searchLocalImpact(value).slice(0, 5);
    for (const r of localResults) {
      all.push({
        type: "local",
        slug: r.slug,
        title: r.state,
        subtitle: r.summary?.slice(0, 80),
        section: "local-impact",
      });
    }

    // Search MAGA files
    const magaResults = searchMagaFiles(value).slice(0, 5);
    for (const m of magaResults) {
      all.push({
        type: "maga",
        slug: m.slug,
        title: m.name,
        subtitle: "MAGA File",
        section: "maga-files",
      });
    }

    // Search narrative reports
    const narrativeResults = searchNarrativeReports(value).slice(0, 4);
    for (const n of narrativeResults) {
      all.push({
        type: "narrative",
        slug: n.slug,
        title: n.name,
        subtitle: "Narrative Report",
        section: "narratives",
      });
    }

    return all.slice(0, 20);
  }, [value, districts]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  function handleSelect(result: SearchResult) {
    if (onNavigate) {
      onNavigate(result.section, result.slug);
    }
    onChange("");
    setIsFocused(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!results.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === "Escape") {
      setIsFocused(false);
      inputRef.current?.blur();
    }
  }

  const showDropdown = isFocused && value.length >= 2;

  // Calculate dropdown position based on input element
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  
  useEffect(() => {
    if (showDropdown && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed' as const,
        top: rect.bottom + 2,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
  }, [showDropdown, value]);

  return (
    <div ref={wrapperRef} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="search-input pl-10 pr-10"
      />
      {value && (
        <button
          onClick={() => { onChange(""); setIsFocused(false); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {showDropdown && (
        <div style={dropdownStyle} className="border border-[hsl(var(--win98-border-dark))] bg-[hsl(var(--win98-bg))] shadow-lg max-h-[320px] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-3 py-4 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
              No results found for "{value}"
            </div>
          ) : (
            <>
              {/* Group results by type */}
              {(["candidate", "district", "local", "maga", "narrative"] as SearchResultType[]).map((type) => {
                const grouped = results.filter((r) => r.type === type);
                if (grouped.length === 0) return null;
                const config = TYPE_CONFIG[type];
                return (
                  <div key={type}>
                    <div className="px-3 py-1 bg-[hsl(var(--win98-border-light))] text-[9px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                      {config.label}s
                    </div>
                    {grouped.map((result) => {
                      const globalIdx = results.indexOf(result);
                      return (
                        <button
                          key={`${result.type}-${result.slug}`}
                          className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-[11px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white transition-colors ${
                            globalIdx === selectedIndex ? "bg-[hsl(var(--win98-titlebar))] text-white" : "text-[hsl(var(--foreground))]"
                          }`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelect(result)}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                        >
                          <span className={globalIdx === selectedIndex ? "text-white" : "text-[hsl(var(--muted-foreground))]"}>
                            {config.icon}
                          </span>
                          <span className="font-medium truncate">{result.title}</span>
                          {result.subtitle && (
                            <span className={`ml-auto text-[10px] truncate max-w-[40%] ${
                              globalIdx === selectedIndex ? "text-white/70" : "text-[hsl(var(--muted-foreground))]"
                            }`}>
                              {result.subtitle}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
