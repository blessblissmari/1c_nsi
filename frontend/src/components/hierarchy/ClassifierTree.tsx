import { useState } from "react";
import { ChevronDown, ChevronRight, Tag } from "lucide-react";
import type { ClassOption } from "./ClassPicker";

export interface ClassifierClass extends ClassOption {
  model_count?: number;
  subclass_counts?: Record<string, number>;
}

export interface ClassifierSelection {
  classId: number;
  subclassId: number | null;
}

interface ClassifierTreeProps {
  classes: ClassifierClass[];
  selection: ClassifierSelection | null;
  onSelect: (sel: ClassifierSelection | null) => void;
}

export function ClassifierTree({
  classes,
  selection,
  onSelect,
}: ClassifierTreeProps) {
  if (!classes.length) {
    return (
      <p className="text-sm text-slate-400 text-center py-6">
        Классификатор пуст. Загрузите xlsx-классификатор.
      </p>
    );
  }
  return (
    <div className="space-y-0.5">
      {classes.map((cls) => (
        <ClassRow
          key={cls.id}
          cls={cls}
          selection={selection}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function ClassRow({
  cls,
  selection,
  onSelect,
}: {
  cls: ClassifierClass;
  selection: ClassifierSelection | null;
  onSelect: (sel: ClassifierSelection | null) => void;
}) {
  const [expanded, setExpanded] = useState(selection?.classId === cls.id);
  const hasSubs = (cls.subclasses?.length ?? 0) > 0;
  const isClassSelected =
    selection?.classId === cls.id && !selection?.subclassId;
  const totalCount = cls.model_count ?? 0;

  const toggle = () => {
    if (hasSubs) setExpanded((v) => !v);
    onSelect({ classId: cls.id, subclassId: null });
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer text-sm transition-colors ${
          isClassSelected
            ? "bg-blue-50 text-blue-700"
            : "text-slate-700 hover:bg-slate-50"
        }`}
        onClick={toggle}
      >
        {hasSubs ? (
          expanded ? (
            <ChevronDown size={14} className="text-slate-400 shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-slate-400 shrink-0" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <Tag
          size={12}
          className={
            isClassSelected
              ? "text-blue-600 shrink-0"
              : "text-slate-400 shrink-0"
          }
        />
        <span className="truncate flex-1">{cls.name}</span>
        {totalCount > 0 && (
          <span className="text-[11px] text-slate-400 tabular-nums">
            {totalCount}
          </span>
        )}
      </div>
      {expanded && hasSubs && (
        <div className="pl-5">
          {cls.subclasses!.map((sub) => {
            const isSubSelected =
              selection?.classId === cls.id && selection?.subclassId === sub.id;
            const subCount = cls.subclass_counts?.[String(sub.id)] ?? 0;
            return (
              <div
                key={sub.id}
                className={`flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer text-xs transition-colors ${
                  isSubSelected
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() =>
                  onSelect({ classId: cls.id, subclassId: sub.id })
                }
              >
                <Tag
                  size={10}
                  className={
                    isSubSelected
                      ? "text-blue-600 shrink-0"
                      : "text-slate-300 shrink-0"
                  }
                />
                <span className="truncate flex-1">{sub.name}</span>
                {subCount > 0 && (
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {subCount}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
