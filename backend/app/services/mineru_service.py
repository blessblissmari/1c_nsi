# -*- coding: utf-8 -*-
"""Mineru document parsing service"""
import httpx
import logging
from app.config import settings

logger = logging.getLogger(__name__)


class MineruService:
    def __init__(self):
        self._api_key = settings.MINERU_API_KEY
        self._base_url = "https://api.mineru.cn/v1"

    def parse_document(self, file_path: str) -> dict | None:
        """Parse technical passport PDF/image and extract structured data"""
        if not self._api_key:
            logger.warning("Mineru API key not configured")
            return None

        try:
            with open(file_path, "rb") as f:
                files = {"file": f}
                data = {"structure": "auto"}
                resp = httpx.post(
                    f"{self._base_url}/parse",
                    files=files,
                    data=data,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    timeout=60,
                )

            if resp.status_code != 200:
                logger.error(f"Mineru error {resp.status_code}: {resp.text[:300]}")
                return None

            return resp.json()
        except Exception as e:
            logger.error(f"Mineru parsing error: {e}")
            return None

    def parse_from_url(self, url: str) -> dict | None:
        """Parse document from URL"""
        if not self._api_key:
            return None

        try:
            resp = httpx.post(
                f"{self._base_url}/parse",
                json={"url": url, "structure": "auto"},
                headers={"Authorization": f"Bearer {self._api_key}"},
                timeout=60,
            )

            if resp.status_code != 200:
                return None

            return resp.json()
        except Exception as e:
            logger.error(f"Mineru URL parsing error: {e}")
            return None


mineru_service = MineruService()
