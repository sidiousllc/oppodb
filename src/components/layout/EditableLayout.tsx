import { useEffect, useMemo, useState, useCallback, ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Eye, EyeOff, RotateCcw, Settings2, Check } from "lucide-react";
import {
  loadLocalLayout,
  saveLocalLayout,
  loadRemoteLayout,
  saveRemoteLayout,
  reconcileOrder,
  clearLocalLayout,
  type LayoutState,
} from "@/lib/layoutPreferences";

export interface LayoutSection {
  /** Stable identifier — used as the persistence key. Do NOT change once shipped. */
  id: string;
  /** Friendly label shown in the edit-mode chrome. */
  label: string;
  /** The actual section content. */
  content: ReactNode;
  /** When true, the section cannot be hidden (still reorderable). Default false. */
  required?: boolean;
}

interface EditableLayoutProps {
  /** Persistence key (e.g. "datahub.polling"). Must be unique app-wide. */
  layoutKey: string;
  sections: LayoutSection[];
  /** Optional: override the default toolbar position. */
  toolbarClassName?: string;
}

export function EditableLayout({ layoutKey, sections, toolbarClassName }: EditableLayoutProps) {
  const canonicalIds = useMemo(() => sections.map((s) => s.id), [sections]);

  const [order, setOrder] = useState<string[]>(canonicalIds);
  const [hidden, setHidden] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate: localStorage first (instant), then remote merge if user is signed in.
  useEffect(() => {
    const local = loadLocalLayout(layoutKey);
    if (local) {
      setOrder(reconcileOrder(local.order, canonicalIds));
      setHidden(local.hidden.filter((id) => canonicalIds.includes(id)));
    }
    setHydrated(true);

    let cancelled = false;
    loadRemoteLayout(layoutKey).then((remote) => {
      if (cancelled || !remote) return;
      const reconciled = reconcileOrder(remote.order, canonicalIds);
      setOrder(reconciled);
      setHidden(remote.hidden.filter((id) => canonicalIds.includes(id)));
      saveLocalLayout(layoutKey, { order: reconciled, hidden: remote.hidden });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);

  // If sections list grows/shrinks at runtime, reconcile.
  useEffect(() => {
    if (!hydrated) return;
    setOrder((prev) => reconcileOrder(prev, canonicalIds));
    setHidden((prev) => prev.filter((id) => canonicalIds.includes(id)));
  }, [canonicalIds, hydrated]);

  const persist = useCallback(
    (next: LayoutState) => {
      saveLocalLayout(layoutKey, next);
      saveRemoteLayout(layoutKey, next);
    },
    [layoutKey]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      persist({ order: next, hidden });
      return next;
    });
  };

  const toggleHidden = (id: string) => {
    setHidden((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      persist({ order, hidden: next });
      return next;
    });
  };

  const resetLayout = () => {
    setOrder(canonicalIds);
    setHidden([]);
    clearLocalLayout(layoutKey);
    persist({ order: canonicalIds, hidden: [] });
  };

  const sectionMap = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);
  const orderedSections = order.map((id) => sectionMap.get(id)).filter(Boolean) as LayoutSection[];
  const visibleSections = editMode ? orderedSections : orderedSections.filter((s) => !hidden.includes(s.id));

  return (
    <div className="space-y-4">
      <div
        className={
          toolbarClassName ??
          "flex items-center justify-between gap-2 rounded-md border border-border bg-card/40 px-3 py-1.5"
        }
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Settings2 className="h-3.5 w-3.5" />
          <span>
            {editMode
              ? `Edit Layout — drag to reorder, eye icon to hide (${hidden.length} hidden)`
              : `${visibleSections.length} of ${sections.length} sections shown`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {editMode && (
            <button
              type="button"
              onClick={resetLayout}
              className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Reset to default order"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors ${
              editMode
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {editMode ? <Check className="h-3 w-3" /> : <Settings2 className="h-3 w-3" />}
            {editMode ? "Done" : "Edit Layout"}
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy} disabled={!editMode}>
          <div className="space-y-4">
            {visibleSections.map((section) => (
              <SortableSection
                key={section.id}
                section={section}
                editMode={editMode}
                isHidden={hidden.includes(section.id)}
                onToggleHidden={() => toggleHidden(section.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

interface SortableSectionProps {
  section: LayoutSection;
  editMode: boolean;
  isHidden: boolean;
  onToggleHidden: () => void;
}

function SortableSection({ section, editMode, isHidden, onToggleHidden }: SortableSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled: !editMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : isHidden ? 0.45 : 1,
  };

  if (!editMode) {
    return <div ref={setNodeRef} style={style}>{section.content}</div>;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative rounded-lg ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
    >
      <div className="absolute -top-3 left-3 z-10 flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 shadow-sm">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="inline-flex cursor-grab items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label={`Drag ${section.label}`}
        >
          <GripVertical className="h-3 w-3" />
          {section.label}
        </button>
        {!section.required && (
          <button
            type="button"
            onClick={onToggleHidden}
            className="inline-flex items-center text-muted-foreground hover:text-foreground"
            title={isHidden ? "Show section" : "Hide section"}
          >
            {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
        )}
      </div>
      <div className={isHidden ? "pointer-events-none" : ""}>{section.content}</div>
    </div>
  );
}
