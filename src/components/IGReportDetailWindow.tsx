import { Win98Window } from "@/components/Win98Window";
import { FileText, ExternalLink, Building2, Calendar, Tag } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface IGReportDetailWindowProps {
  report: any;
  onClose: () => void;
}

export function IGReportDetailWindow({ report: r, onClose }: IGReportDetailWindowProps) {
  const markdownContent = buildMarkdown(r);

  return (
    <Win98Window
      title={`IG Report — ${r.title?.slice(0, 40) || "Details"}`}
      icon={<FileText className="h-3.5 w-3.5" />}
      onClose={onClose}
      defaultPosition={{ x: Math.min(140, window.innerWidth - 520), y: 50 }}
      defaultSize={{ width: Math.min(540, window.innerWidth - 20), height: Math.min(560, window.innerHeight - 80) }}
      minSize={{ width: 320, height: 260 }}
    >
      <div className="p-3 space-y-3 text-[11px]">
        {/* Header */}
        <div className="win98-sunken p-2 bg-white">
          <div className="text-[13px] font-bold leading-snug">{r.title}</div>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">
            <span className="font-semibold text-blue-700">{r.agency_name}</span>
            {r.type && <span>• {r.type}</span>}
            {r.published_on && <span>• {new Date(r.published_on).toLocaleDateString()}</span>}
            {r.year && <span>• {r.year}</span>}
          </div>
        </div>

        {/* Agency / Inspector Info */}
        <div>
          <div className="text-[10px] font-bold mb-1 flex items-center gap-1">
            <Building2 className="h-3 w-3" /> Inspector Details
          </div>
          <div className="win98-sunken p-2 bg-white space-y-1">
            <Row label="Agency" value={r.agency_name || r.agency || "N/A"} />
            <Row label="Inspector" value={r.inspector?.toUpperCase() || "N/A"} />
            <Row label="Report ID" value={r.report_id || "N/A"} />
            {r.topic && <Row label="Topic" value={r.topic} />}
            {r.type && <Row label="Type" value={r.type} />}
          </div>
        </div>

        {/* Dates */}
        {(r.published_on || r.year) && (
          <div>
            <div className="text-[10px] font-bold mb-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Publication
            </div>
            <div className="win98-sunken p-2 bg-white grid grid-cols-2 gap-y-1.5 gap-x-4">
              {r.published_on && <Row label="Published" value={new Date(r.published_on).toLocaleDateString()} />}
              {r.year && <Row label="Year" value={String(r.year)} />}
            </div>
          </div>
        )}

        {/* Full Report Content (Markdown) */}
        <div>
          <div className="text-[10px] font-bold mb-1 flex items-center gap-1">
            <FileText className="h-3 w-3" /> Report Content
          </div>
          <div className="win98-sunken p-2 bg-white max-h-[220px] overflow-y-auto">
            <div className="prose-research text-[10px] leading-relaxed">
              <ReactMarkdown>{markdownContent}</ReactMarkdown>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          {r.pdf_url && (
            <a
              href={r.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="win98-button text-[10px] px-3 py-1 inline-flex items-center gap-1"
            >
              <FileText className="h-3 w-3" /> View PDF
            </a>
          )}
          {(r.landing_url || r.url) && (
            <a
              href={r.landing_url || r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="win98-button text-[10px] px-3 py-1 inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" /> View Original
            </a>
          )}
          {r.inspector_url && (
            <a
              href={r.inspector_url}
              target="_blank"
              rel="noopener noreferrer"
              className="win98-button text-[10px] px-3 py-1 inline-flex items-center gap-1"
            >
              <Building2 className="h-3 w-3" /> IG Office
            </a>
          )}
        </div>

        <div className="text-[9px] text-[hsl(var(--muted-foreground))] pt-1">
          Source: Inspector General — {r.inspector?.toUpperCase() || r.agency_name}
        </div>
      </div>
    </Win98Window>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-[10px]">
      <span className="text-[hsl(var(--muted-foreground))] shrink-0">{label}:</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function buildMarkdown(r: any): string {
  const parts: string[] = [];
  parts.push(`# ${r.title}\n`);
  parts.push(`**Agency:** ${r.agency_name}  `);
  parts.push(`**Inspector:** ${r.inspector?.toUpperCase() || "N/A"}  `);
  if (r.published_on) parts.push(`**Published:** ${new Date(r.published_on).toLocaleDateString()}  `);
  if (r.type) parts.push(`**Type:** ${r.type}  `);
  if (r.report_id) parts.push(`**Report ID:** ${r.report_id}  `);
  if (r.topic) parts.push(`**Topic:** ${r.topic}  `);
  parts.push("");
  if (r.summary) {
    parts.push("## Summary\n");
    parts.push(r.summary);
    parts.push("");
  }
  if (r.pdf_url) parts.push(`[View PDF](${r.pdf_url})  `);
  if (r.landing_url || r.url) parts.push(`[View Original Report](${r.landing_url || r.url})  `);
  return parts.join("\n");
}
