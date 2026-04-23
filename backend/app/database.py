from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from typing import Generator

from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 30},
    echo=False,
)

# Enable WAL mode and increase busy timeout for better concurrency
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=30000")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def reset_db() -> None:
    """Reset database to clean state - delete all data but keep structure"""
    from app.models.models import (
        OperationTMC, ComponentOperation, TORComponent, ReliabilityMetric,
        APLItem, BOMItem, MaintenanceType, TORCharacteristic, Document,
        EquipmentModel, ClassificationRule, EquipmentSubclass, EquipmentClass, Characteristic,
        Unit, NormalizationRule, Operation, HierarchyNode, Profession, Qualification, LaborNorm
    )
    db = SessionLocal()
    try:
        db.query(OperationTMC).delete()
        db.query(ComponentOperation).delete()
        db.query(TORComponent).delete()
        db.query(ReliabilityMetric).delete()
        db.query(APLItem).delete()
        db.query(BOMItem).delete()
        db.query(MaintenanceType).delete()
        db.query(TORCharacteristic).delete()
        db.query(Document).delete()
        db.query(EquipmentModel).delete()
        db.query(ClassificationRule).delete()
        db.query(EquipmentSubclass).delete()
        db.query(EquipmentClass).delete()
        db.query(Characteristic).delete()
        db.query(Unit).delete()
        db.query(NormalizationRule).delete()
        db.query(Operation).delete()
        db.query(LaborNorm).delete()
        db.query(Qualification).delete()
        db.query(Profession).delete()
        db.query(HierarchyNode).delete()
        db.commit()
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()
