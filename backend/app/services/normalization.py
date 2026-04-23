import re

# Latin letters that look like Cyrillic letters must be converted to Cyrillic (ТЗ 8.3.10).
# Important: map by visual similarity, e.g. Latin "P" -> Cyrillic "Р" (not "П").
CYRILLIC_EQUIVALENTS: dict[str, str] = {
    "A": "А",
    "B": "В",
    "C": "С",
    "E": "Е",
    "H": "Н",
    "K": "К",
    "M": "М",
    "O": "О",
    "P": "Р",
    "T": "Т",
    "X": "Х",
}

_INVISIBLE_RE = re.compile(r"[\u200b\u200c\u200d\ufeff\u00a0]")


def normalize_model_name(name: str) -> str:
    """
    Нормализация наименований моделей оборудования (ТЗ 8.3) + уточнённые правила пользователя:
    1) Все буквы заглавные.
    2) Запятая между цифрами -> точка (и вообще все запятые -> точки).
    3) Между цифрой и буквой удалить любой символ.
    4) Между буквой и цифрой удалить любой символ, кроме "№".
    5) Между цифрой и цифрой любой символ (кроме "№") -> дефис, но точка между цифрами остаётся.
    6) Между буквой и буквой любой символ -> дефис.
    7) Пробел между цифрой и буквой/буквой и цифрой удалить.
    8) Пробел между цифрой и цифрой/буквой и буквой -> дефис.
    9) Все запятые заменить на точки.
    10) Сочетание "№" и цифр взять в круглые скобки и поставить в конец: ...-№2,5 -> ...(№2.5)
    """
    if not name:
        return ""

    result = name.strip().upper().replace("Ё", "Е")
    result = _INVISIBLE_RE.sub("", result)

    # Convert Latin lookalikes to Cyrillic only when the model name contains Cyrillic.
    # This prevents mixed-script lookalike issues (e.g. "ПP-12" -> "ПР12"),
    # while keeping purely Latin model codes intact (e.g. "GA37-7.5P").
    has_cyrillic = any("А" <= ch <= "Я" for ch in result)
    if has_cyrillic:
        for lat, cyr in CYRILLIC_EQUIVALENTS.items():
            result = result.replace(lat, cyr)

    # Rule 9: all commas -> dots.
    result = result.replace(",", ".")

    # Keep legacy requirement: "x/х" between digits means dimension separator -> "-"
    result = re.sub(r"(?<=\d)[XХxх](?=\d)", "-", result)

    # Rule 10: extract "№<digits[.digits]>" chunks, normalize, and append as "(№...)" at end.
    no_parts: list[str] = []
    for m in re.finditer(r"№\s*\d+(?:\.\d+)?", result):
        chunk = m.group(0).replace(" ", "")
        # chunk already has commas replaced to dots above
        if not chunk.startswith("№"):
            chunk = "№" + chunk
        no_parts.append(chunk)

    if no_parts:
        # Remove extracted parts and any separators directly before them.
        result = re.sub(r"[\s\-_]*№\s*\d+(?:\.\d+)?", "", result)

    _ROMAN = set("IVXLCDM")
    _ROMAN_EXTRA = {"Ι"}  # Greek capital iota, often used as Roman numeral I in docs

    def _kind(ch: str) -> str:
        if ch.isdigit():
            return "d"
        # Cyrillic letters.
        if "А" <= ch <= "Я":
            return "l"
        # Latin letters (allowed for international model codes).
        if "A" <= ch <= "Z":
            return "l"
        # Roman numerals (allowed by spec if standards say so).
        if ch in _ROMAN or ch in _ROMAN_EXTRA:
            return "l"
        return "o"

    out: list[str] = []
    pending_sep: str = ""
    prev_kind: str | None = None

    def _flush_sep(next_kind: str, next_char: str) -> None:
        nonlocal pending_sep, prev_kind, out
        if not pending_sep or prev_kind is None:
            pending_sep = ""
            return

        if prev_kind == "d" and next_kind == "l":
            # Rule 3 + 7
            # Special-case: keep a hyphen before a Roman-numeral suffix (e.g. "...97-Ι")
            if "-" in pending_sep and (next_char in _ROMAN_EXTRA):
                out.append("-")
            pending_sep = ""
            return

        if prev_kind == "l" and next_kind == "d":
            # Rule 4 + 7 (№ already extracted)
            pending_sep = ""
            return

        if prev_kind == "d" and next_kind == "d":
            # Rule 2 + 5 + 8
            if pending_sep and all(c == "." for c in pending_sep):
                out.append(".")
            else:
                out.append("-")
            pending_sep = ""
            return

        if prev_kind == "l" and next_kind == "l":
            # Rule 6 + 8
            out.append("-")
            pending_sep = ""
            return

        pending_sep = ""

    for ch in result:
        if ch in {"№", "."}:
            pending_sep += ch
            continue

        kind = _kind(ch)
        if kind in {"d", "l"}:
            _flush_sep(kind, ch)
            out.append(ch)
            prev_kind = kind
        else:
            pending_sep += ch

    normalized = "".join(out)

    # Keep only allowed symbols.
    # Note: Latin letters are allowed for international model codes, but we avoid mixed-script
    # lookalikes by converting them above when Cyrillic is present.
    normalized = re.sub(r"[^0-9A-ZА-ЯIVXLCDMΙ\.\-\(\)/]", "", normalized)
    normalized = re.sub(r"-{2,}", "-", normalized).strip("-")
    normalized = re.sub(r"\.{2,}", ".", normalized)

    if no_parts:
        normalized = normalized.rstrip("-").rstrip(".") + "".join(f"({p})" for p in no_parts)

    return normalized.strip()


def normalize_class_name(name: str) -> str:
    if not name:
        return ""

    result = name.strip()
    result = result.replace("Ё", "Е").replace("ё", "Е")
    result = _INVISIBLE_RE.sub("", result)
    result = re.sub(r" +", " ", result).strip()
    if result:
        result = result[0].upper() + result[1:]
    return result


def normalize_operation_name(name: str) -> str:
    if not name:
        return ""

    result = name.strip()
    result = result.replace("Ё", "Е").replace("ё", "Е")
    result = _INVISIBLE_RE.sub("", result)
    result = re.sub(r" +", " ", result).strip()
    if result:
        result = result[0].upper() + result[1:]
    return result


def normalize_characteristic_name(name: str) -> str:
    return normalize_operation_name(name)


def parse_periodicity_to_months(value: str | float | int | None) -> float | None:
    """
    Best-effort periodicity parser.
    Accepts:
    - number-like values treated as months
    - strings like "6", "6 мес", "0.5 года", "1 год", "90 дней"
    """
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)

    s = str(value).strip().lower().replace(",", ".")
    if not s:
        return None

    m = re.search(r"([0-9]+(?:\.[0-9]+)?)", s)
    if not m:
        return None

    num = float(m.group(1))
    # Default unit: months
    if "год" in s or "лет" in s or "г." in s:
        return num * 12.0
    if "дн" in s or "day" in s:
        return num / 30.0
    if "нед" in s or "week" in s:
        return num / 4.345
    return num


def normalize_unit_value(
    value: str, unit_symbol: str, target_unit_symbol: str, conversion_rules: dict | None = None
) -> tuple[str, str]:
    if not conversion_rules:
        return value, unit_symbol

    key = f"{unit_symbol}->{target_unit_symbol}"
    if key not in conversion_rules:
        return value, unit_symbol

    rule = conversion_rules[key]
    try:
        num_val = float(value)
        factor = rule.get("factor", 1.0)
        offset = rule.get("offset", 0.0)
        converted = num_val * factor + offset
        if converted == int(converted):
            converted = int(converted)
        return str(converted), target_unit_symbol
    except (ValueError, TypeError):
        return value, unit_symbol
