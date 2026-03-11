import { ChevronRight } from "lucide-react";

interface GenericCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  tag?: { label: string; className: string };
  preview: string;
  onClick: () => void;
}

export function GenericCard({ icon, title, subtitle, tag, preview, onClick }: GenericCardProps) {
  return (
    <div className="candidate-card animate-fade-in" onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {icon}
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold text-foreground truncate">
              {title}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              {tag && <span className={`tag ${tag.className}`}>{tag.label}</span>}
              {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
            </div>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-3" />
      </div>
      {preview && (
        <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{preview}...</p>
      )}
    </div>
  );
}
