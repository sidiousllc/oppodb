import { ExternalLink, X } from "lucide-react";

interface ResearchDetailWindowProps {
  title: string;
  subtitle?: string;
  fields: Array<{ label: string; value: any }>;
  sourceUrl?: string | null;
  onClose: () => void;
}

function formatValue(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString();
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) {
    if (v.length === 0) return "—";
    return v.map((item) => (typeof item === "object" ? JSON.stringify(item) : String(item))).join(", ");
  }
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}

export function ResearchDetailWindow({ title, subtitle, fields, sourceUrl, onClose }: ResearchDetailWindowProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="win98-raised bg-[hsl(var(--win98-face))] w-full max-w-2xl max-h-[80vh] flex flex-col shadow-lg"
      >
        {/* Title bar */}
        <div className="flex items-center justify-between bg-[hsl(var(--win98-titlebar))] text-white px-2 py-1">
          <div className="text-[11px] font-bold truncate">{title}</div>
          <button
            onClick={onClose}
            className="win98-button h-[16px] w-[18px] flex items-center justify-center text-black"
            aria-label="Close"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 text-[11px]">
          {subtitle && (
            <div className="win98-sunken bg-[hsl(var(--win98-light))] px-2 py-1 mb-3 text-[10px] text-[hsl(var(--muted-foreground))]">
              {subtitle}
            </div>
          )}
          <table className="w-full border-collapse">
            <tbody>
              {fields.map((f) => {
                const formatted = formatValue(f.value);
                const isLong = formatted.length > 80 || formatted.includes("\n");
                return (
                  <tr key={f.label} className="border-b border-[hsl(var(--win98-shadow))] align-top">
                    <td className="p-1 font-bold w-1/3 bg-[hsl(var(--win98-light))]">{f.label}</td>
                    <td className="p-1 break-words">
                      {isLong ? (
                        <pre className="whitespace-pre-wrap text-[10px] font-mono">{formatted}</pre>
                      ) : (
                        formatted
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Status bar / actions */}
        <div className="border-t border-t-[hsl(var(--win98-shadow))] px-2 py-1 flex items-center justify-between text-[10px] bg-[hsl(var(--win98-face))]">
          <span className="text-[hsl(var(--muted-foreground))]">
            {fields.length} fields
          </span>
          <div className="flex items-center gap-2">
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="win98-button text-[10px] px-2 py-[2px] flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Open Source
              </a>
            )}
            <button onClick={onClose} className="win98-button text-[10px] px-2 py-[2px]">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
