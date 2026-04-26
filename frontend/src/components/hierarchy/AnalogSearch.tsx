import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import toast from "react-hot-toast";
import { hierarchyApi, massProcessingApi } from "../../api";

interface AnalogSearchProps {
  modelId: number;
}

interface TorChar {
  id: number;
  characteristic_id: number;
  characteristic_name?: string | null;
  unit_symbol?: string | null;
  value?: string | null;
}

interface AnalogResult {
  model_id: number;
  model: string;
  match_score: number;
  differences?: string | null;
  compare?: { name: string; base_value: string; candidate_value: string }[];
}

/**
 * Поиск аналогов ТОР по характеристикам и классу.
 *
 * По созвону: «поиск аналогов по характеристикам и классам». Раньше эта
 * функциональность жила только в окне массовой обработки — теперь
 * доступна прямо из карточки ТОР.
 */
export function AnalogSearch({ modelId }: AnalogSearchProps) {
  const [chars, setChars] = useState<TorChar[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [results, setResults] = useState<AnalogResult[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    massProcessingApi
      .getTorCharacteristics(modelId)
      .then((data: any) => {
        if (!cancelled) {
          setChars((data ?? []) as TorChar[]);
          setSelected([]);
          setResults(null);
        }
      })
      .catch(() => {
        if (!cancelled) setChars([]);
      });
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  const filledChars = useMemo(
    () =>
      chars.filter(
        (c) =>
          c.value !== null &&
          c.value !== undefined &&
          String(c.value).length > 0,
      ),
    [chars],
  );

  const toggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const run = async () => {
    setLoading(true);
    try {
      const data = await hierarchyApi.findAnalogs(modelId, {
        selected_characteristic_ids: selected,
        limit: 8,
      });
      setResults((data ?? []) as AnalogResult[]);
    } catch {
      toast.error("Не удалось подобрать аналоги");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500">
        Отметьте характеристики, по которым хотите искать аналоги. Остальные
        будут показаны для сравнения.
      </div>

      {filledChars.length === 0 ? (
        <div className="text-xs text-slate-400 italic">
          У ТОР пока нет заполненных характеристик. Поиск пойдёт только по
          классу/имени.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {filledChars.map((c) => (
            <label
              key={c.id}
              className="flex items-start gap-2 text-xs px-2 py-1.5 rounded-md border border-slate-200 cursor-pointer hover:bg-slate-50"
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={selected.includes(c.id)}
                onChange={() => toggle(c.id)}
              />
              <span className="flex-1">
                <span className="font-medium text-slate-700">
                  {c.characteristic_name ?? "—"}
                </span>
                <span className="text-slate-500">
                  {" "}
                  = {c.value}
                  {c.unit_symbol ? ` ${c.unit_symbol}` : ""}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}

      <div>
        <button
          type="button"
          className="btn-primary text-xs flex items-center gap-2"
          onClick={run}
          disabled={loading}
        >
          <Search size={14} /> {loading ? "Поиск…" : "Подобрать аналоги"}
        </button>
      </div>

      {results !== null && (
        <div className="space-y-2">
          {results.length === 0 && (
            <div className="text-xs text-slate-400 italic">
              Совпадений не найдено.
            </div>
          )}
          {results.map((r) => (
            <div
              key={r.model_id}
              className="border border-slate-200 rounded-md p-2 text-xs space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-800 truncate">
                  {r.model}
                </span>
                <span className="text-slate-500 tabular-nums">
                  {Math.round((r.match_score ?? 0) * 100)}%
                </span>
              </div>
              {r.differences && (
                <div className="text-amber-700">{r.differences}</div>
              )}
              {r.compare && r.compare.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                  {r.compare.map((d) => (
                    <div
                      key={d.name}
                      className="flex items-center justify-between gap-2 bg-slate-50 rounded px-2 py-1"
                    >
                      <span className="truncate text-slate-500">{d.name}</span>
                      <span className="text-slate-700 truncate">
                        {d.base_value} → {d.candidate_value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
