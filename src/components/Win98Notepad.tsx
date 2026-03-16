import { useState, useRef, useCallback } from "react";
import { Win98Window } from "./Win98Window";

interface Win98NotepadProps {
  onClose: () => void;
}

export function Win98Notepad({ onClose }: Win98NotepadProps) {
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("Untitled");
  const [wordWrap, setWordWrap] = useState(true);
  const [showStatus, setShowStatus] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lineCount = content.split("\n").length;
  const charCount = content.length;

  const handleNew = useCallback(() => {
    if (content && !window.confirm(`Save changes to ${fileName}?`)) return;
    setContent("");
    setFileName("Untitled");
  }, [content, fileName]);

  const handleSaveAs = useCallback(() => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName === "Untitled" ? "document" : fileName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [content, fileName]);

  const handleOpen = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.md,.log,.csv,.json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setFileName(file.name.replace(/\.[^.]+$/, ""));
        const reader = new FileReader();
        reader.onload = (ev) => setContent(ev.target?.result as string || "");
        reader.readAsText(file);
      }
    };
    input.click();
  }, []);

  const handleSelectAll = useCallback(() => {
    textareaRef.current?.select();
  }, []);

  const handleTimeDate = useCallback(() => {
    const stamp = new Date().toLocaleString();
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart;
      setContent((c) => c.slice(0, start) + stamp + c.slice(ta.selectionEnd));
    }
  }, []);

  const menuBar = (
    <div className="flex items-center gap-0 text-[11px]">
      <div className="group relative">
        <button className="px-2 py-[2px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white">File</button>
        <div className="hidden group-hover:block absolute top-full left-0 bg-[hsl(var(--win98-face))] win98-raised min-w-[160px] py-[2px] z-50">
          <button onClick={handleNew} className="w-full text-left px-4 py-[2px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white text-[11px]">New</button>
          <button onClick={handleOpen} className="w-full text-left px-4 py-[2px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white text-[11px]">Open...</button>
          <button onClick={handleSaveAs} className="w-full text-left px-4 py-[2px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white text-[11px]">Save As...</button>
          <div className="mx-1 my-[2px] border-t border-[hsl(var(--win98-shadow))]" />
          <button onClick={onClose} className="w-full text-left px-4 py-[2px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white text-[11px]">Exit</button>
        </div>
      </div>
      <div className="group relative">
        <button className="px-2 py-[2px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white">Edit</button>
        <div className="hidden group-hover:block absolute top-full left-0 bg-[hsl(var(--win98-face))] win98-raised min-w-[160px] py-[2px] z-50">
          <button onClick={handleSelectAll} className="w-full text-left px-4 py-[2px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white text-[11px]">Select All</button>
          <button onClick={handleTimeDate} className="w-full text-left px-4 py-[2px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white text-[11px]">Time/Date</button>
        </div>
      </div>
      <div className="group relative">
        <button className="px-2 py-[2px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white">Format</button>
        <div className="hidden group-hover:block absolute top-full left-0 bg-[hsl(var(--win98-face))] win98-raised min-w-[160px] py-[2px] z-50">
          <button onClick={() => setWordWrap((w) => !w)} className="w-full text-left px-4 py-[2px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white text-[11px]">
            {wordWrap ? "✓ " : "  "}Word Wrap
          </button>
        </div>
      </div>
      <div className="group relative">
        <button className="px-2 py-[2px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white">View</button>
        <div className="hidden group-hover:block absolute top-full left-0 bg-[hsl(var(--win98-face))] win98-raised min-w-[160px] py-[2px] z-50">
          <button onClick={() => setShowStatus((s) => !s)} className="w-full text-left px-4 py-[2px] hover:bg-[hsl(var(--win98-titlebar))] hover:text-white text-[11px]">
            {showStatus ? "✓ " : "  "}Status Bar
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[900] pointer-events-none">
      <div className="pointer-events-auto">
        <Win98Window
          title={`${fileName} - Notepad`}
          icon={<span className="text-[12px]">📝</span>}
          onClose={onClose}
          toolbar={menuBar}
          defaultPosition={{ x: Math.round(window.innerWidth / 2 - 260), y: Math.round(window.innerHeight / 2 - 200) }}
          defaultSize={{ width: 520, height: 400 }}
          minSize={{ width: 300, height: 200 }}
          statusBar={showStatus ? (
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
              Ln {lineCount} | {charCount} characters
            </span>
          ) : undefined}
        >
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full resize-none border-none outline-none bg-white p-1 text-[12px] font-mono leading-[16px]"
            style={{ whiteSpace: wordWrap ? "pre-wrap" : "pre", overflowWrap: wordWrap ? "break-word" : "normal" }}
            spellCheck={false}
          />
        </Win98Window>
      </div>
    </div>
  );
}
