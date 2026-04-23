# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding='utf-8')

from backend.app.config import settings
from backend.app.models.models import EquipmentModel
from sqlalchemy import create_engine

engine = create_engine(settings.DATABASE_URL)
with engine.connect() as conn:
    # Count total models
    total = conn.execute("SELECT COUNT(*) FROM equipment_models").scalar()
    # Count unclassified
    unclassified = conn.execute("SELECT COUNT(*) FROM equipment_models WHERE class_id IS NULL").scalar()
    print(f"Total models: {total}")
    print(f"Unclassified: {unclassified}")