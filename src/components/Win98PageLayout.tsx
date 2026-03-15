import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Win98Window } from "./Win98Window";
import { Win98Taskbar } from "./Win98Taskbar";
import { AOLBuddyList } from "./AOLBuddyList";
import { AOLMailWindow } from "./AOLMailWindow";
import { Win98MenuBar } from "./Win98MenuBar";
import { useMail } from "@/contexts/MailContext";
import { ArrowLeft, ArrowRight, RotateCw, Home, Star, Mail } from "lucide-react";

interface Win98PageLayoutProps {
  title: string;
  icon?: string;
  children: ReactNode;
  addressUrl?: string;
}

export function Win98PageLayout({ title, icon = "📁", children, addressUrl }: Win98PageLayoutProps) {
  const navigate = useNavigate();
  const { toggleMail, closeMail, isMailOpen, unreadCount } = useMail();

  return (
    <>
      <div className="flex flex-col h-screen bg-[hsl(var(--background))] pb-[28px]">
        <Win98Window
          title={`AOL - ${title}`}
          icon={<span className="text-[14px]">🌐</span>}
          maximized
        >
          {/* Toolbar */}
          <div className="bg-[hsl(var(--win98-face))] border-b-2 border-b-[hsl(var(--win98-shadow))]">
            {/* Menu bar */}
            <Win98MenuBar />

            {/* Navigation toolbar */}
            <div className="flex items-center gap-1 px-2 py-1">
              <button onClick={() => navigate(-1 as any)} className="win98-button flex flex-col items-center gap-0 px-2 py-0.5 text-[9px]" title="Back">
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
              <button onClick={() => window.history.forward()} className="win98-button flex flex-col items-center gap-0 px-2 py-0.5 text-[9px]" title="Forward">
                <ArrowRight className="h-4 w-4" />
                <span>Forward</span>
              </button>
              <button onClick={() => window.location.reload()} className="win98-button flex flex-col items-center gap-0 px-2 py-0.5 text-[9px]" title="Refresh">
                <RotateCw className="h-4 w-4" />
                <span>Refresh</span>
              </button>
              <button onClick={() => navigate("/")} className="win98-button flex flex-col items-center gap-0 px-2 py-0.5 text-[9px]" title="Home">
                <Home className="h-4 w-4" />
                <span>Home</span>
              </button>
              <button onClick={() => navigate("/profile")} className="win98-button flex flex-col items-center gap-0 px-2 py-0.5 text-[9px]" title="Favorites / Profile">
                <Star className="h-4 w-4" />
                <span>Favorites</span>
              </button>
              <button onClick={() => { const el = document.querySelector('[title="AOL Buddy List"]') as HTMLButtonElement; el?.click(); }} className="win98-button flex flex-col items-center gap-0 px-2 py-0.5 text-[9px]" title="Open Buddy List / Mail">
                <Mail className="h-4 w-4" />
                <span>Mail</span>
              </button>
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
                <span className="text-[hsl(var(--muted-foreground))]">
                  {addressUrl || `aol://ordb.research/${title.toLowerCase().replace(/\s+/g, "-")}`}
                </span>
              </div>
              <button className="win98-button text-[11px] px-3" onClick={() => window.location.reload()}>Go</button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto bg-white">
            <div className="max-w-5xl mx-auto px-4 py-4">
              {/* Page title header */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{icon}</span>
                <h1 className="text-sm font-bold">{title}</h1>
                <div className="flex-1" />
                <button
                  onClick={() => navigate("/")}
                  className="win98-button text-[10px] flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Dashboard
                </button>
              </div>
              {children}
            </div>
          </div>
        </Win98Window>
      </div>

      <Win98Taskbar />
      <AOLBuddyList />
    </>
  );
}
