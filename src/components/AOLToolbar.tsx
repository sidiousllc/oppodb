import { ArrowLeft, ArrowRight, RotateCw, Home, Star, Mail } from "lucide-react";

interface AOLToolbarProps {
  onBack?: () => void;
  onRefresh?: () => void;
}

export function AOLToolbar({ onBack, onRefresh }: AOLToolbarProps) {
  return (
    <div className="bg-[hsl(var(--win98-face))] border-b-2 border-b-[hsl(var(--win98-shadow))]">
      {/* Menu bar */}
      <div className="flex items-center gap-0 px-1 py-[1px] text-[11px] border-b border-b-[hsl(var(--win98-shadow))]">
        <button className="px-2 py-[1px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white">File</button>
        <button className="px-2 py-[1px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white">Edit</button>
        <button className="px-2 py-[1px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white">View</button>
        <button className="px-2 py-[1px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white">Favorites</button>
        <button className="px-2 py-[1px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white">Help</button>
      </div>

      {/* Navigation toolbar */}
      <div className="flex items-center gap-1 px-2 py-1">
        <button onClick={onBack} className="win98-button flex flex-col items-center gap-0 px-2 py-0.5 text-[9px]" title="Back">
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
        <button className="win98-button flex flex-col items-center gap-0 px-2 py-0.5 text-[9px]" title="Forward">
          <ArrowRight className="h-4 w-4" />
          <span>Forward</span>
        </button>
        <button onClick={onRefresh} className="win98-button flex flex-col items-center gap-0 px-2 py-0.5 text-[9px]" title="Refresh">
          <RotateCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
        <button className="win98-button flex flex-col items-center gap-0 px-2 py-0.5 text-[9px]" title="Home">
          <Home className="h-4 w-4" />
          <span>Home</span>
        </button>
        <button className="win98-button flex flex-col items-center gap-0 px-2 py-0.5 text-[9px]" title="Favorites">
          <Star className="h-4 w-4" />
          <span>Favorites</span>
        </button>
        <button className="win98-button flex flex-col items-center gap-0 px-2 py-0.5 text-[9px]" title="Mail">
          <Mail className="h-4 w-4" />
          <span>Mail</span>
        </button>

        {/* AOL triangle logo area */}
        <div className="ml-auto flex items-center">
          <div className="w-[50px] h-[40px] flex items-center justify-center">
            <span className="text-[28px] leading-none animate-pulse">🌐</span>
          </div>
        </div>
      </div>

      {/* Address bar */}
      <div className="flex items-center gap-1 px-2 py-1 border-t border-t-[hsl(var(--win98-highlight))]">
        <span className="text-[11px] font-bold whitespace-nowrap">Address</span>
        <div className="flex-1 win98-sunken bg-white px-1 py-[1px] text-[11px] flex items-center">
          <span className="text-[hsl(var(--muted-foreground))]">aol://ordb.research/opposition-database</span>
        </div>
        <button className="win98-button text-[11px] px-3">Go</button>
      </div>
    </div>
  );
}
