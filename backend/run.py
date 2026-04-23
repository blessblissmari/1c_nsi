"""Entry point для локального запуска backend'а.

В проде используется `uvicorn app.main:app` напрямую (см. Dockerfile).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def main() -> None:
    backend_dir = Path(__file__).resolve().parent
    os.chdir(backend_dir)
    sys.path.insert(0, str(backend_dir))

    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("APP_ENV", "development") == "development",
    )


if __name__ == "__main__":
    main()
