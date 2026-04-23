from loguru import logger

from app.config import settings


class YandexAIService:
    """AI-сервис. Исторически реализован под Yandex AI Studio, но может работать
    поверх OpenAI-совместимого API (`settings.AI_BACKEND="openai"` либо наличие
    `OPENAI_API_KEY` при пустом `YANDEX_API_KEY`). Публичный интерфейс не меняется.
    """

    def __init__(self):
        self._sdk = None
        self._assistant_id = None
        self._folder_id = settings.YANDEX_FOLDER_ID
        self._api_key = settings.YANDEX_API_KEY
        self._model_uri = settings.YANDEX_MODEL_URL
        self._vector_store_id = settings.YANDEX_VECTOR_STORE_ID

    @property
    def _backend(self) -> str:
        return settings.effective_ai_backend

    @property
    def sdk(self):
        if self._sdk is None:
            try:
                from yandex_ai_studio_sdk import AIStudio
                from yandex_ai_studio_sdk.auth import APIKeyAuth

                self._sdk = AIStudio(
                    folder_id=self._folder_id,
                    auth=APIKeyAuth(self._api_key),
                )
                logger.info("Yandex AI Studio SDK initialized")
            except Exception as e:
                logger.error(f"Failed to init Yandex AI SDK: {e}")
                raise
        return self._sdk

    def _get_assistant_id(self) -> str:
        if self._assistant_id is None:
            try:
                from yandex_ai_studio_sdk._tools.generative_search import GenerativeSearchTool

                gen_tool = GenerativeSearchTool(
                    description="Search the web for industrial equipment information"
                )
                assistant = self.sdk.assistants.create(
                    name="nsi_web_search",
                    model="yandexgpt-lite",
                    tools=[gen_tool],
                    instruction="Ты эксперт по промышленному оборудованию и ТОиР. Отвечай на русском языке. Отвечай строго в запрошенном формате JSON без markdown блоков кода.",
                )
                self._assistant_id = assistant.id
                logger.info(f"Created AI assistant: {self._assistant_id}")
            except Exception as e:
                logger.error(f"Failed to create assistant: {e}")
                raise
        return self._assistant_id

    def _call_with_web_search(self, prompt: str, temperature: float = 0.2) -> str | None:
        """Try HTTP method first (more reliable), fallback to lite model"""
        # Try HTTP first - more reliable than Assistants API
        result = self._call_http(prompt, temperature)
        if result:
            return result

        # Fallback to lite model
        result = self._call_lite(prompt, temperature)
        if result:
            return result

        logger.warning("All AI methods failed, returning None")
        return None

    def _call_http(self, prompt: str, temperature: float = 0.2, max_tokens: int = 2000) -> str | None:
        """Главный chat-completion вызов. Маршрутизируется по `effective_ai_backend`."""
        if self._backend == "openai":
            return self._call_openai(prompt, temperature=temperature, max_tokens=max_tokens)
        return self._call_yandex_http(prompt, temperature=temperature, max_tokens=max_tokens)

    def _call_yandex_http(self, prompt: str, temperature: float = 0.2, max_tokens: int = 2000) -> str | None:
        import httpx

        try:
            payload = {
                "model": self._model_uri,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": temperature,
                "max_tokens": max_tokens,
            }

            def _post(auth_header: str):
                return httpx.post(
                    "https://llm.api.cloud.yandex.net/v1/chat/completions",
                    headers={
                        "Authorization": auth_header,
                        "Content-Type": "application/json",
                    },
                    json=payload,
                    timeout=120,
                )

            # Prefer Api-Key auth for static API keys, fall back to Bearer.
            resp = _post(f"Api-Key {self._api_key}")
            if resp.status_code in (401, 403):
                resp = _post(f"Bearer {self._api_key}")

            if resp.status_code != 200:
                logger.error(f"Yandex HTTP AI error {resp.status_code}: {resp.text[:500]}")
                return None

            data = resp.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content")
            return content.strip() if content else None
        except Exception as e:
            logger.error(f"Yandex HTTP AI call error: {e}")
            return None

    def _call_openai(self, prompt: str, temperature: float = 0.2, max_tokens: int = 2000) -> str | None:
        """Chat completion через OpenAI-совместимый endpoint."""
        import httpx

        if not settings.OPENAI_API_KEY:
            logger.error("OPENAI_API_KEY не задан")
            return None

        try:
            payload = {
                "model": settings.OPENAI_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            resp = httpx.post(
                f"{settings.OPENAI_BASE_URL.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=120,
            )
            if resp.status_code != 200:
                logger.error(f"OpenAI error {resp.status_code}: {resp.text[:500]}")
                return None
            data = resp.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content")
            return content.strip() if content else None
        except Exception as e:
            logger.error(f"OpenAI call error: {e}")
            return None

    def _call_lite(self, prompt: str, temperature: float = 0.2, max_tokens: int = 2000) -> str | None:
        """Fallback-вариант. На OpenAI = тот же `_call_http`."""
        if self._backend == "openai":
            return self._call_openai(prompt, temperature=temperature, max_tokens=max_tokens)
        try:
            model = self.sdk.models.completions("yandexgpt-lite").configure(
                temperature=temperature,
                max_tokens=max_tokens,
            )
            result = model.run([{"role": "user", "text": prompt}])
            return result.alternatives[0].text.strip()
        except Exception as e:
            logger.error(f"yandexgpt-lite call error: {e}")
            return None

    def _parse_json(self, text: str | None) -> dict | list | None:
        if not text:
            return None
        import json

        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            for start_ch, end_ch in [("[", "]"), ("{", "}")]:
                start = text.find(start_ch)
                end = text.rfind(end_ch)
                if start != -1 and end != -1:
                    try:
                        return json.loads(text[start : end + 1])
                    except json.JSONDecodeError:
                        pass
            logger.warning(f"Failed to parse JSON from AI response: {text[:200]}")
            return None

    def classify_model_via_web(self, model_name: str) -> dict | None:
        prompt = (
            f"Определи класс и подкласс промышленного оборудования по названию модели: '{model_name}'.\n"
            'Ответь строго в формате JSON: {"class": "название класса", "subclass": "название подкласса"}\n'
            'Если не можешь определить — ответь {"class": null, "subclass": null}\n'
            "Классы — это функциональные группы (Насосы, Компрессоры, Электродвигатели и т.д.).\n"
            "Подклассы — конструктивные особенности (Центробежные, Поршневые, Асинхронные и т.д.)."
        )

        text = self._call_with_web_search(prompt, temperature=0.2)
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, dict):
            return {
                "class_name": parsed.get("class"),
                "subclass_name": parsed.get("subclass"),
                "source": "yandex_web",
                "confidence": 0.7,
            }
        return None

    def web_search(self, query: str, max_docs: int = 5) -> list[dict]:
        """
        Yandex Web Search API wrapper via AI Studio SDK.
        Returns a compact list of {"title","url","snippet"}.
        На OpenAI-бэкенде web_search недоступен — возвращаем пустой список,
        вызывающий код корректно уходит на прямой LLM без evidence.
        """
        if self._backend == "openai":
            return []
        try:
            from yandex_ai_studio_sdk._search_api.enums import SearchType

            search = self.sdk.search_api.web(SearchType.RU).configure(
                max_passages=3,
                groups_on_page=max(1, min(5, max_docs)),
                docs_in_group=1,
            )
            resp = search.run(query, format="parsed", timeout=60)

            items: list[dict] = []
            docs = getattr(resp, "docs", None) or []
            for d in docs:
                title = getattr(d, "title", None) or ""
                url = getattr(d, "url", None) or ""
                passages = getattr(d, "passages", None) or []
                snippet = " ".join([str(p) for p in passages if p])[:800]
                if url or title or snippet:
                    items.append({"title": str(title), "url": str(url), "snippet": str(snippet)})
                if len(items) >= max_docs:
                    break
            return items
        except Exception as e:
            logger.warning(f"Web search failed: {e}")
            return []

    def classify_model_via_web_search(self, model_name: str, class_options: list[dict]) -> dict | None:
        """
        Two-stage approach for higher accuracy:
        1) Get evidence via Yandex Web Search API.
        2) Ask the LLM to classify using the evidence AND the uploaded classifier options.
        """
        evidence = self.web_search(f"{model_name} оборудование модель", max_docs=5)

        # Build compact classifier list for prompt (keep it small).
        compact_lines: list[str] = []
        for item in class_options[:250]:
            cls = str(item.get("class_name") or "").strip()
            subs = item.get("subclasses") or []
            subs = [str(s).strip() for s in subs if str(s).strip()][:60]
            if not cls:
                continue
            if subs:
                compact_lines.append(f"- {cls}: {', '.join(subs)}")
            else:
                compact_lines.append(f"- {cls}")

        evidence_lines: list[str] = []
        for i, e in enumerate(evidence, 1):
            title = (e.get("title") or "").strip()
            url = (e.get("url") or "").strip()
            snippet = (e.get("snippet") or "").strip()
            if not (title or url or snippet):
                continue
            evidence_lines.append(f"[{i}] {title}\n{url}\n{snippet}")

        prompt = (
            f"Классифицируй оборудование по модели: '{model_name}'.\n\n"
            "Сначала прочитай найденные фрагменты из интернета (они могут быть неполными).\n"
            "Далее выбери КЛАСС и ПОДКЛАСС ТОЛЬКО из списка классификатора.\n"
            "Если уверенно выбрать нельзя — верни null.\n\n"
            "Фрагменты из интернета:\n"
            f"{chr(10).join(evidence_lines) if evidence_lines else '(нет данных)'}\n\n"
            "Классификатор (выбирать только из него, точные строки):\n"
            f"{chr(10).join(compact_lines)}\n\n"
            'Ответь строго JSON: {"class": "<строка или null>", "subclass": "<строка или null>"}'
        )

        text = self._call_http(prompt, temperature=0.0, max_tokens=500) or self._call_lite(
            prompt, temperature=0.0, max_tokens=500
        )
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, dict):
            return {
                "class_name": parsed.get("class"),
                "subclass_name": parsed.get("subclass"),
                "source": "yandex_web_search",
                "confidence": 0.75,
                "sources": [e.get("url") for e in evidence if e.get("url")],
            }
        return None

    def classify_model_via_web_search_guess(
        self, model_name: str, class_names: list[str] | None = None
    ) -> dict | None:
        """
        Web search -> LLM guess (NOT constrained to classifier).
        The API endpoint maps this guess into the uploaded classifier via fuzzy match.
        """
        evidence = self.web_search(f"{model_name} оборудование модель", max_docs=5)

        evidence_lines: list[str] = []
        for i, e in enumerate(evidence, 1):
            title = (e.get("title") or "").strip()
            url = (e.get("url") or "").strip()
            snippet = (e.get("snippet") or "").strip()
            if not (title or url or snippet):
                continue
            evidence_lines.append(f"[{i}] {title}\n{url}\n{snippet}")

        class_hint = ""
        if class_names:
            # Keep list small and stable.
            class_hint = (
                "\n\nВыбирай класс СТРОГО из списка (точное совпадение строки). "
                "Если ни один не подходит — class=null.\n"
                "Список классов:\n- " + "\n- ".join([str(c) for c in class_names[:60]])
            )

        prompt = (
            f"Определи класс и подкласс промышленного оборудования по названию модели: '{model_name}'.\n"
            "Используй фрагменты из интернета ниже как доказательства.\n"
            "Если определить нельзя — верни null.\n\n"
            "Фрагменты из интернета:\n"
            f"{chr(10).join(evidence_lines) if evidence_lines else '(нет данных)'}"
            f"{class_hint}\n\n"
            'Ответь строго JSON: {"class": "<класс или null>", "subclass": "<подкласс или null>"}'
        )

        text = self._call_http(prompt, temperature=0.0, max_tokens=400) or self._call_lite(
            prompt, temperature=0.0, max_tokens=400
        )
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, dict):
            return {
                "class_name": parsed.get("class"),
                "subclass_name": parsed.get("subclass"),
                "source": "yandex_web_search_guess",
                "confidence": 0.55,
                "sources": [e.get("url") for e in evidence if e.get("url")],
            }
        return None

    def classify_model_via_web_constrained(self, model_name: str, classes: list[dict]) -> dict | None:
        """
        Constrained classification: the model MUST choose from the provided classifier lists,
        otherwise return nulls. This avoids hallucinated class/subclass names.

        classes: [{"class_name": str, "subclasses": [str, ...]}, ...]
        """
        # Keep prompt size reasonable.
        compact_lines: list[str] = []
        for item in classes[:200]:
            cls = str(item.get("class_name") or "").strip()
            subs = item.get("subclasses") or []
            subs = [str(s).strip() for s in subs if str(s).strip()][:50]
            if not cls:
                continue
            if subs:
                compact_lines.append(f"- {cls}: {', '.join(subs)}")
            else:
                compact_lines.append(f"- {cls}")

        options_text = "\n".join(compact_lines)
        prompt = (
            f"Определи класс и подкласс промышленного оборудования по названию модели: '{model_name}'.\n"
            "ВАЖНО: выбирать можно ТОЛЬКО из списка ниже (точное совпадение строк). Ничего не придумывай.\n"
            "Если не уверен — ответь null.\n\n"
            "Список классов и подклассов:\n"
            f"{options_text}\n\n"
            'Ответь строго JSON без пояснений: {"class": "<точно как в списке>", "subclass": "<точно как в списке или null>"}\n'
            'Если класс не найден — {"class": null, "subclass": null}.'
        )

        text = self._call_with_web_search(prompt, temperature=0.0)
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, dict):
            return {
                "class_name": parsed.get("class"),
                "subclass_name": parsed.get("subclass"),
                "source": "yandex_web_constrained",
                "confidence": 0.6,
            }
        return None

    def enrich_characteristics_via_web(
        self, model_name: str, class_name: str | None, characteristic_names: list[str]
    ) -> list[dict]:
        char_list = ", ".join(characteristic_names)
        prompt = (
            f"Для промышленного оборудования модели '{model_name}'"
            f"{f', класс: {class_name}' if class_name else ''}\n"
            f"Найди значения следующих характеристик: {char_list}\n"
            "Ответь строго в формате JSON-массива: "
            '[{"characteristic": "название", "value": "значение", "unit": "ед.изм."}]\n'
            "Если не можешь найти значение — не включай эту характеристику в ответ.\n"
            "Значения должны быть в единицах СИ по ГОСТ 8.417."
        )

        text = self._call_with_web_search(prompt, temperature=0.2)
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, list):
            return [
                {
                    "characteristic_name": item.get("characteristic"),
                    "value": item.get("value"),
                    "unit": item.get("unit"),
                    "source": "yandex_web",
                    "confidence": 0.7,
                }
                for item in parsed
                if item.get("value")
            ]
        return []

    def extract_characteristics_from_text(
        self,
        extracted_text: str,
        characteristic_names: list[str],
        require_units: bool = True,
    ) -> list[dict]:
        """
        Extract characteristic values from provided document text (highest priority source).
        Returns list of {"characteristic_name","value","unit","source","confidence"}.
        """
        char_list = ", ".join(characteristic_names)
        prompt = (
            "Извлеки значения характеристик из текста документа.\n"
            "Текст:\n"
            f"{(extracted_text or '')[:9000]}\n\n"
            f"Найти характеристики: {char_list}\n"
            "Ответь строго JSON-массивом:\n"
            '[{"characteristic":"название из списка","value":"значение","unit":"ед.изм. или null"}]\n'
            "Если значение не найдено — не добавляй элемент.\n"
            + ("Единицы измерения указывай по ГОСТ 8.417 (русские обозначения).\n" if require_units else "")
        )
        text = self._call_http(prompt, temperature=0.0, max_tokens=800) or self._call_lite(
            prompt, temperature=0.0, max_tokens=800
        )
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, list):
            out = []
            for item in parsed:
                if not isinstance(item, dict):
                    continue
                val = item.get("value")
                if val is None or str(val).strip() == "":
                    continue
                out.append(
                    {
                        "characteristic_name": item.get("characteristic"),
                        "value": str(val),
                        "unit": item.get("unit"),
                        "source": "vector_store",
                        "confidence": 0.85,
                    }
                )
            return out
        return []

    def extract_other_characteristics_from_text(
        self,
        extracted_text: str,
        exclude_names: list[str] | None = None,
        limit: int = 20,
    ) -> list[dict]:
        """
        Extract other (non-required) characteristics from document text.
        Returns list of {"characteristic_name","value","unit","source","confidence"}.
        """
        exclude = {str(n).strip() for n in (exclude_names or []) if str(n).strip()}
        prompt = (
            "Извлеки из текста документа прочие технические характеристики оборудования (не менее 10, если есть).\n"
            "Требования:\n"
            "- Название характеристики: существительное, в ед. числе, с заглавной буквы.\n"
            "- Значения и единицы в формате ГОСТ 8.417 (например '3.2 А', '380 В').\n"
            "- Не включай характеристики из списка исключения.\n\n"
            f"Список исключения: {', '.join(list(exclude)[:80])}\n\n"
            "Текст:\n"
            f"{(extracted_text or '')[:9000]}\n\n"
            "Ответь строго JSON-массивом:\n"
            '[{"characteristic":"название","value":"значение","unit":"ед.изм. или null"}]\n'
            f"Ограничься максимум {int(limit)} элементами."
        )
        text = self._call_http(prompt, temperature=0.0, max_tokens=1200) or self._call_lite(
            prompt, temperature=0.0, max_tokens=1200
        )
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, list):
            out = []
            for item in parsed:
                if not isinstance(item, dict):
                    continue
                ch = str(item.get("characteristic") or "").strip()
                val = str(item.get("value") or "").strip()
                if not ch or not val:
                    continue
                if ch in exclude:
                    continue
                out.append(
                    {
                        "characteristic_name": ch,
                        "value": val,
                        "unit": item.get("unit"),
                        "source": "vector_store",
                        "confidence": 0.75,
                    }
                )
            return out[:limit]
        return []

    def enrich_characteristics_via_vector_store(
        self, model_name: str, characteristic_names: list[str]
    ) -> list[dict]:
        char_list = ", ".join(characteristic_names)
        prompt = (
            f"Найди в технической документации для модели '{model_name}' "
            f"значения следующих характеристик: {char_list}\n"
            "Ответь строго в формате JSON-массива: "
            '[{"characteristic": "название", "value": "значение", "unit": "ед.изм."}]\n'
            "Если не можешь найти значение — не включай эту характеристику в ответ."
        )

        text = self._call_with_web_search(prompt, temperature=0.2)
        if not text:
            text = self._call_http(prompt, temperature=0.2) or self._call_lite(prompt, temperature=0.2)
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, list):
            return [
                {
                    "characteristic_name": item.get("characteristic"),
                    "value": item.get("value"),
                    "unit": item.get("unit"),
                    "source": "vector_store",
                    "confidence": 0.85,
                }
                for item in parsed
                if item.get("value")
            ]
        return []

    def enrich_maintenance_via_web(self, model_name: str, class_name: str | None) -> list[dict]:
        prompt = (
            f"Для промышленного оборудования модели '{model_name}'"
            f"{f', класс: {class_name}' if class_name else ''}\n"
            "Определи виды технического обслуживания и ремонта (ТОиР) и их периодичности.\n"
            "Ответь строго в формате JSON-массива: "
            '[{"name": "вид воздействия", "periodicity_months": число}]\n'
            "Примеры видов: Осмотр, Текущий ремонт, Средний ремонт, Капитальный ремонт."
        )

        text = self._call_with_web_search(prompt, temperature=0.2)
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, list):
            return [
                {
                    "name": item.get("name"),
                    "periodicity_months": item.get("periodicity_months"),
                    "source": "yandex_web",
                    "confidence": 0.7,
                }
                for item in parsed
                if item.get("name")
            ]
        return []

    def enrich_maintenance_via_vector_store(self, model_name: str) -> list[dict]:
        prompt = (
            f"Найди в технической документации для модели '{model_name}' "
            "виды технического обслуживания и ремонта и их периодичности.\n"
            "Ответь строго в формате JSON-массива: "
            '[{"name": "вид воздействия", "periodicity_months": число}]'
        )

        text = self._call_with_web_search(prompt, temperature=0.2)
        if not text:
            text = self._call_http(prompt, temperature=0.2) or self._call_lite(prompt, temperature=0.2)
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, list):
            return [
                {
                    "name": item.get("name"),
                    "periodicity_months": item.get("periodicity_months"),
                    "source": "vector_store",
                    "confidence": 0.85,
                }
                for item in parsed
                if item.get("name")
            ]
        return []

    def search_analogs(self, model_name: str, characteristics: dict[str, str] | None = None) -> list[dict]:
        char_info = ""
        if characteristics:
            char_info = f" с характеристиками: {characteristics}"
        prompt = (
            f"Найди аналоги промышленного оборудования модели '{model_name}'{char_info}.\n"
            "Ответь строго в формате JSON-массива: "
            '[{"model": "название аналога", "manufacturer": "производитель", '
            '"match_score": число_от_0_до_1, "differences": "отличия"}]\n'
            "Найди до 5 аналогов."
        )

        text = self._call_with_web_search(prompt, temperature=0.3)
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, list):
            return [
                {
                    "model": item.get("model"),
                    "manufacturer": item.get("manufacturer"),
                    "match_score": item.get("match_score", 0.5),
                    "differences": item.get("differences"),
                    "source": "yandex_web",
                }
                for item in parsed
            ]
        return []

    def generate_bom_via_web(self, model_name: str, class_name: str | None) -> list[dict]:
        prompt = (
            f"Сформируй спецификацию BOM (Bill of Materials) для оборудования модели '{model_name}'"
            f"{f', класс: {class_name}' if class_name else ''}\n"
            "Ответь строго в формате JSON-массива: "
            '[{"name": "наименование", "code": "код/номенклатура", '
            '"quantity": число, "unit": "ед.изм."}]'
        )

        text = self._call_with_web_search(prompt, temperature=0.3)
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, list):
            return [
                {
                    "name": item.get("name"),
                    "code": item.get("code"),
                    "quantity": item.get("quantity"),
                    "unit_symbol": item.get("unit"),
                    "source": "yandex_web",
                    "confidence": 0.6,
                }
                for item in parsed
            ]
        return []

    def generate_apl_via_web(self, model_name: str, class_name: str | None) -> list[dict]:
        prompt = (
            f"Сформируй перечень APL (Application Parts List — детали, инструменты и запасные части для ТОиР) "
            f"для оборудования модели '{model_name}'"
            f"{f', класс: {class_name}' if class_name else ''}\n"
            "Не включай расходные материалы (смазки, герметики и т.п.)\n"
            "Ответь строго в формате JSON-массива: "
            '[{"name": "наименование", "code": "код/номенклатура", '
            '"quantity": число, "unit": "ед.изм."}]'
        )

        text = self._call_with_web_search(prompt, temperature=0.3)
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, list):
            return [
                {
                    "name": item.get("name"),
                    "code": item.get("code"),
                    "quantity": item.get("quantity"),
                    "unit_symbol": item.get("unit"),
                    "source": "yandex_web",
                    "confidence": 0.6,
                }
                for item in parsed
            ]
        return []

    def enrich_components_via_web(self, model_name: str, class_name: str | None) -> list[dict]:
        prompt = (
            f"Для промышленного оборудования модели '{model_name}'"
            f"{f', класс: {class_name}' if class_name else ''}\n"
            "Определи состав основных компонентов (узлов, агрегатов, сборочных единиц) для технологической карты ТОиР.\n"
            "Ответь строго в формате JSON-массива: "
            '[{"name": "наименование компонента", "component_type": "тип (узел/агрегат/деталь/система)"}]\n'
            "Примеры типов: узел, агрегат, деталь, система, механизм, аппарат.\n"
            "Найди до 10 основных компонентов."
        )

        text = self._call_with_web_search(prompt, temperature=0.2)
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, list):
            return [
                {
                    "name": item.get("name"),
                    "component_type": item.get("component_type", "узел"),
                    "source": "yandex_web",
                    "confidence": 0.7,
                }
                for item in parsed
                if item.get("name")
            ]
        return []

    def enrich_components_via_vector_store(self, model_name: str) -> list[dict]:
        prompt = (
            f"Найди в технической документации для модели '{model_name}' "
            "состав основных компонентов (узлов, агрегатов, сборочных единиц) для технологической карты ТОиР.\n"
            "Ответь строго в формате JSON-массива: "
            '[{"name": "наименование компонента", "component_type": "тип (узел/агрегат/деталь/система)"}]'
        )

        text = self._call_with_web_search(prompt, temperature=0.2)
        if not text:
            text = self._call_http(prompt, temperature=0.2) or self._call_lite(prompt, temperature=0.2)
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, list):
            return [
                {
                    "name": item.get("name"),
                    "component_type": item.get("component_type", "узел"),
                    "source": "vector_store",
                    "confidence": 0.85,
                }
                for item in parsed
                if item.get("name")
            ]
        return []

    def enrich_operations_via_web(self, component_name: str, class_name: str | None) -> list[dict]:
        prompt = (
            f"Для компонента '{component_name}' промышленного оборудования"
            f"{f', класс: {class_name}' if class_name else ''}\n"
            "Определи перечень операций технического обслуживания и ремонта.\n"
            "Ответь строго в формате JSON-массива: "
            '[{"name": "наименование операции", "profession": "профессия", '
            '"qualification": "квалификация (разряд)", "labor_hours": число_чел.-ч}]\n'
            "Примеры: Осмотр, Замена, Регулировка, Смазка, Диагностика, Ревизия."
        )

        text = self._call_with_web_search(prompt, temperature=0.2)
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, list):
            return [
                {
                    "name": item.get("name"),
                    "profession": item.get("profession"),
                    "qualification": item.get("qualification"),
                    "labor_hours": item.get("labor_hours"),
                    "source": "yandex_web",
                    "confidence": 0.7,
                }
                for item in parsed
                if item.get("name")
            ]
        return []

    def enrich_operations_via_vector_store(self, component_name: str) -> list[dict]:
        prompt = (
            f"Найди в технической документации для компонента '{component_name}' "
            "перечень операций технического обслуживания и ремонта.\n"
            "Ответь строго в формате JSON-массива: "
            '[{"name": "наименование операции", "profession": "профессия", '
            '"qualification": "квалификация (разряд)", "labor_hours": число_чел.-ч}]'
        )

        text = self._call_with_web_search(prompt, temperature=0.2)
        if not text:
            text = self._call_http(prompt, temperature=0.2) or self._call_lite(prompt, temperature=0.2)
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, list):
            return [
                {
                    "name": item.get("name"),
                    "profession": item.get("profession"),
                    "qualification": item.get("qualification"),
                    "labor_hours": item.get("labor_hours"),
                    "source": "vector_store",
                    "confidence": 0.85,
                }
                for item in parsed
                if item.get("name")
            ]
        return []

    def enrich_tmc_via_web(self, operation_name: str) -> list[dict]:
        prompt = (
            f"Для операции '{operation_name}' технического обслуживания промышленного оборудования\n"
            "Определи необходимые ТМЦ (трудоёмкость, материалы, комплектующие, запасные части).\n"
            "Ответь строго в формате JSON-массива: "
            '[{"name": "наименование ТМЦ", "code": "код/номенклатура", '
            '"unit": "ед.изм.", "quantity": число, "consumption_rate": число}]\n'
            "Найди до 10 позиций ТМЦ."
        )

        text = self._call_with_web_search(prompt, temperature=0.2)
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, list):
            return [
                {
                    "name": item.get("name"),
                    "code": item.get("code"),
                    "unit_symbol": item.get("unit"),
                    "quantity": item.get("quantity"),
                    "consumption_rate": item.get("consumption_rate"),
                    "source": "yandex_web",
                    "confidence": 0.7,
                }
                for item in parsed
                if item.get("name")
            ]
        return []

    def enrich_tmc_via_vector_store(self, operation_name: str) -> list[dict]:
        prompt = (
            f"Найди в технической документации для операции '{operation_name}' "
            "необходимые ТМЦ (трудоёмкость, материалы, комплектующие, запасные части).\n"
            "Ответь строго в формате JSON-массива: "
            '[{"name": "наименование ТМЦ", "code": "код/номенклатура", '
            '"unit": "ед.изм.", "quantity": число, "consumption_rate": число}]'
        )

        text = self._call_with_web_search(prompt, temperature=0.2)
        if not text:
            text = self._call_http(prompt, temperature=0.2) or self._call_lite(prompt, temperature=0.2)
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, list):
            return [
                {
                    "name": item.get("name"),
                    "code": item.get("code"),
                    "unit_symbol": item.get("unit"),
                    "quantity": item.get("quantity"),
                    "consumption_rate": item.get("consumption_rate"),
                    "source": "vector_store",
                    "confidence": 0.85,
                }
                for item in parsed
                if item.get("name")
            ]
        return []

    def enrich_reliability_via_web(self, model_name: str, class_name: str | None) -> list[dict]:
        prompt = (
            f"Для промышленного оборудования модели '{model_name}'"
            f"{f', класс: {class_name}' if class_name else ''}\n"
            "Определи параметры надёжности: наработка на отказ (MTBF), среднее время восстановления (MTTR), "
            "коэффициент готовности, интенсивность отказов.\n"
            "Ответь строго в формате JSON-массива: "
            '[{"metric_type": "тип (mtbf/mttr/availability/failure_rate)", '
            '"value": число, "unit": "ед.изм.", "description": "пояснение"}]\n'
            "Все типы: mtbf, mttr, availability, failure_rate."
        )

        text = self._call_with_web_search(prompt, temperature=0.2)
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, list):
            return [
                {
                    "metric_type": item.get("metric_type"),
                    "value": item.get("value"),
                    "unit": item.get("unit"),
                    "description": item.get("description"),
                    "source": "yandex_web",
                    "confidence": 0.7,
                }
                for item in parsed
                if item.get("metric_type")
            ]
        return []

    def enrich_reliability_via_vector_store(self, model_name: str) -> list[dict]:
        prompt = (
            f"Найди в технической документации для модели '{model_name}' "
            "параметры надёжности: наработка на отказ (MTBF), среднее время восстановления (MTTR), "
            "коэффициент готовности, интенсивность отказов.\n"
            "Ответь строго в формате JSON-массива: "
            '[{"metric_type": "тип (mtbf/mttr/availability/failure_rate)", '
            '"value": число, "unit": "ед.изм.", "description": "пояснение"}]'
        )

        text = self._call_with_web_search(prompt, temperature=0.2)
        if not text:
            text = self._call_http(prompt, temperature=0.2) or self._call_lite(prompt, temperature=0.2)
        parsed = self._parse_json(text)
        if parsed and isinstance(parsed, list):
            return [
                {
                    "metric_type": item.get("metric_type"),
                    "value": item.get("value"),
                    "unit": item.get("unit"),
                    "description": item.get("description"),
                    "source": "vector_store",
                    "confidence": 0.85,
                }
                for item in parsed
                if item.get("metric_type")
            ]
        return []


yandex_ai = YandexAIService()
