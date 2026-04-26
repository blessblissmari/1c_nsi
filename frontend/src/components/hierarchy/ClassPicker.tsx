import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";

export interface ClassOption {
  id: number;
  name: string;
  subclasses?: { id: number; name: string }[];
}

interface ClassPickerProps {
  classes: ClassOption[];
  classId: number | null;
  subclassId: number | null;
  onChange: (data: {
    class_name: string;
    subclass_name: string | null;
    create_if_missing: boolean;
  }) => void;
  disabled?: boolean;
}

/**
 * Combobox для выбора класса/подкласса с автодополнением и созданием новых
 * значений на лету. Пользовательская идея с созвона: «автодополнение
 * класса/подкласса смотря на классификатор».
 *
 * Источник списка — уже загруженный классификатор; новый класс/подкласс
 * можно ввести с клавиатуры и подтвердить — backend создаст их.
 */
export function ClassPicker({
  classes,
  classId,
  subclassId,
  onChange,
  disabled,
}: ClassPickerProps) {
  const currentClass = useMemo(
    () => classes.find((c) => c.id === classId) ?? null,
    [classes, classId],
  );
  const currentSub = useMemo(() => {
    if (!currentClass || !subclassId) return null;
    return currentClass.subclasses?.find((s) => s.id === subclassId) ?? null;
  }, [currentClass, subclassId]);

  const [classQuery, setClassQuery] = useState(currentClass?.name ?? "");
  const [subQuery, setSubQuery] = useState(currentSub?.name ?? "");
  const [classOpen, setClassOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);

  useEffect(() => {
    setClassQuery(currentClass?.name ?? "");
  }, [currentClass?.id, currentClass?.name]);

  useEffect(() => {
    setSubQuery(currentSub?.name ?? "");
  }, [currentSub?.id, currentSub?.name]);

  const filteredClasses = useMemo(() => {
    const q = classQuery.trim().toLowerCase();
    const list = classes.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list.slice(0, 30);
    return list.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 30);
  }, [classes, classQuery]);

  const subOptions = currentClass?.subclasses ?? [];
  const filteredSubs = useMemo(() => {
    const q = subQuery.trim().toLowerCase();
    if (!q) return subOptions.slice(0, 50);
    return subOptions
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 50);
  }, [subOptions, subQuery]);

  const exactClass = useMemo(
    () =>
      classes.find(
        (c) => c.name.toLowerCase() === classQuery.trim().toLowerCase(),
      ) ?? null,
    [classes, classQuery],
  );
  const exactSub = useMemo(
    () =>
      subOptions.find(
        (s) => s.name.toLowerCase() === subQuery.trim().toLowerCase(),
      ) ?? null,
    [subOptions, subQuery],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setClassOpen(false);
        setSubOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const commitClass = (name: string, createIfMissing: boolean) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setClassOpen(false);
    setClassQuery(trimmed);
    setSubQuery("");
    onChange({
      class_name: trimmed,
      subclass_name: null,
      create_if_missing: createIfMissing,
    });
  };

  const commitSub = (name: string, createIfMissing: boolean) => {
    const trimmed = name.trim();
    if (!classQuery.trim()) return;
    setSubOpen(false);
    setSubQuery(trimmed);
    onChange({
      class_name: classQuery.trim(),
      subclass_name: trimmed || null,
      create_if_missing: createIfMissing,
    });
  };

  return (
    <div ref={containerRef} className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="relative">
        <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
          Класс
        </label>
        <div className="relative">
          <input
            disabled={disabled}
            value={classQuery}
            onChange={(e) => {
              setClassQuery(e.target.value);
              setClassOpen(true);
            }}
            onFocus={() => setClassOpen(true)}
            placeholder="Начните вводить класс…"
            className="w-full text-sm border border-slate-300 rounded-md pl-3 pr-8 py-1.5 bg-white focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
          />
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>
        {classOpen && (
          <div className="absolute z-30 mt-1 w-full max-h-60 overflow-auto bg-white border border-slate-200 rounded-md shadow-md text-sm">
            {filteredClasses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => commitClass(c.name, false)}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 flex items-center justify-between gap-2"
              >
                <span className="truncate">{c.name}</span>
                {currentClass?.id === c.id && (
                  <Check size={14} className="text-blue-600" />
                )}
              </button>
            ))}
            {classQuery.trim() && !exactClass && (
              <button
                type="button"
                onClick={() => commitClass(classQuery, true)}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 border-t border-slate-100 text-blue-700 flex items-center gap-2"
              >
                <Plus size={14} /> Создать «{classQuery.trim()}»
              </button>
            )}
            {!filteredClasses.length && !classQuery.trim() && (
              <div className="px-3 py-2 text-slate-400">Нет классов</div>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
          Подкласс
        </label>
        <div className="relative">
          <input
            disabled={disabled || !currentClass}
            value={subQuery}
            onChange={(e) => {
              setSubQuery(e.target.value);
              setSubOpen(true);
            }}
            onFocus={() => setSubOpen(true)}
            placeholder={
              currentClass
                ? "Начните вводить подкласс…"
                : "Сначала выберите класс"
            }
            className="w-full text-sm border border-slate-300 rounded-md pl-3 pr-8 py-1.5 bg-white focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
          />
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>
        {subOpen && currentClass && (
          <div className="absolute z-30 mt-1 w-full max-h-60 overflow-auto bg-white border border-slate-200 rounded-md shadow-md text-sm">
            {filteredSubs.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => commitSub(s.name, false)}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 flex items-center justify-between gap-2"
              >
                <span className="truncate">{s.name}</span>
                {currentSub?.id === s.id && (
                  <Check size={14} className="text-blue-600" />
                )}
              </button>
            ))}
            {subQuery.trim() && !exactSub && (
              <button
                type="button"
                onClick={() => commitSub(subQuery, true)}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 border-t border-slate-100 text-blue-700 flex items-center gap-2"
              >
                <Plus size={14} /> Создать «{subQuery.trim()}»
              </button>
            )}
            {!filteredSubs.length && !subQuery.trim() && (
              <div className="px-3 py-2 text-slate-400">Подклассов нет</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
