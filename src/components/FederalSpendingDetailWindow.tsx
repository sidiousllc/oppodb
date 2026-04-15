import { Win98Window } from "@/components/Win98Window";
import { DollarSign, ExternalLink, Building2, MapPin, Calendar, FileText } from "lucide-react";

interface FederalSpendingDetailWindowProps {
  record: any;
  onClose: () => void;
}

export function FederalSpendingDetailWindow({ record: r, onClose }: FederalSpendingDetailWindowProps) {
  const fmt = (n: number | null) => n != null ? `$${n.toLocaleString()}` : "N/A";

  return (
    <Win98Window
      title={`Award — ${r.recipient_name?.slice(0, 40) || "Details"}`}
      icon={<DollarSign className="h-3.5 w-3.5" />}
      onClose={onClose}
      defaultPosition={{ x: Math.min(120, window.innerWidth - 420), y: 60 }}
      defaultSize={{ width: Math.min(480, window.innerWidth - 20), height: Math.min(520, window.innerHeight - 80) }}
      minSize={{ width: 300, height: 250 }}
    >
      <div className="p-3 space-y-3 text-[11px]">
        {/* Header */}
        <div className="win98-sunken p-2 bg-white">
          <div className="text-[13px] font-bold">{r.recipient_name}</div>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
            <span className={`font-semibold ${r.award_type === "grant" ? "text-green-700" : "text-blue-700"}`}>
              {r.award_type === "grant" ? "Grant" : "Contract"}
            </span>
            {r.award_id && <span>• Award #{r.award_id}</span>}
          </div>
        </div>

        {/* Financial Details */}
        <div>
          <div className="text-[10px] font-bold mb-1 flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> Financial Details
          </div>
          <div className="win98-sunken p-2 bg-white grid grid-cols-2 gap-y-1.5 gap-x-4">
            <Row label="Award Amount" value={fmt(r.award_amount)} bold />
            <Row label="Total Obligation" value={fmt(r.total_obligation)} />
            <Row label="Fiscal Year" value={r.fiscal_year ? `FY${r.fiscal_year}` : "N/A"} />
          </div>
        </div>

        {/* Agency Info */}
        <div>
          <div className="text-[10px] font-bold mb-1 flex items-center gap-1">
            <Building2 className="h-3 w-3" /> Agency Information
          </div>
          <div className="win98-sunken p-2 bg-white space-y-1">
            <Row label="Awarding Agency" value={r.awarding_agency || "N/A"} />
            <Row label="Funding Agency" value={r.funding_agency || r.awarding_agency || "N/A"} />
          </div>
        </div>

        {/* Location */}
        <div>
          <div className="text-[10px] font-bold mb-1 flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Location
          </div>
          <div className="win98-sunken p-2 bg-white grid grid-cols-2 gap-y-1.5 gap-x-4">
            <Row label="Recipient State" value={r.recipient_state || "N/A"} />
            <Row label="Recipient District" value={r.recipient_district ? `CD-${r.recipient_district}` : "N/A"} />
            <Row label="Performance State" value={r.place_of_performance_state || r.recipient_state || "N/A"} />
            <Row label="Performance District" value={r.place_of_performance_district ? `CD-${r.place_of_performance_district}` : "N/A"} />
          </div>
        </div>

        {/* Period of Performance */}
        {(r.period_of_performance_start || r.period_of_performance_end) && (
          <div>
            <div className="text-[10px] font-bold mb-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Period of Performance
            </div>
            <div className="win98-sunken p-2 bg-white grid grid-cols-2 gap-y-1.5 gap-x-4">
              <Row label="Start" value={r.period_of_performance_start ? new Date(r.period_of_performance_start).toLocaleDateString() : "N/A"} />
              <Row label="End" value={r.period_of_performance_end ? new Date(r.period_of_performance_end).toLocaleDateString() : "N/A"} />
            </div>
          </div>
        )}

        {/* Industry Classification */}
        {(r.naics_code || r.cfda_number) && (
          <div>
            <div className="text-[10px] font-bold mb-1 flex items-center gap-1">
              <FileText className="h-3 w-3" /> Classification
            </div>
            <div className="win98-sunken p-2 bg-white space-y-1">
              {r.naics_code && <Row label="NAICS" value={`${r.naics_code}${r.naics_description ? ` — ${r.naics_description}` : ""}`} />}
              {r.cfda_number && <Row label="CFDA" value={`${r.cfda_number}${r.cfda_title ? ` — ${r.cfda_title}` : ""}`} />}
            </div>
          </div>
        )}

        {/* Description */}
        {r.description && (
          <div>
            <div className="text-[10px] font-bold mb-1">Description</div>
            <div className="win98-sunken p-2 bg-white text-[10px] whitespace-pre-wrap">{r.description}</div>
          </div>
        )}

        {/* Source Link */}
        {r.source_url && (
          <div className="pt-1">
            <a
              href={r.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="win98-button text-[10px] px-3 py-1 inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" /> View on USASpending.gov
            </a>
          </div>
        )}

        <div className="text-[9px] text-[hsl(var(--muted-foreground))] pt-1">
          Source: {r.source || "USASpending.gov"}
        </div>
      </div>
    </Win98Window>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[hsl(var(--muted-foreground))] shrink-0">{label}:</span>
      <span className={`text-right ${bold ? "font-bold" : ""}`}>{value}</span>
    </div>
  );
}
