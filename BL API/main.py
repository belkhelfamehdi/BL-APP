from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
import base64
import hashlib
import hmac
import re
import secrets
import sqlite3

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
import uvicorn

try:
    import pypyodbc as pypyodbc  # type: ignore[import-not-found]
except ModuleNotFoundError:
    pypyodbc = None

app = FastAPI(title="BL Preparation API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONN_STR = "DSN=BaseHFSQL;"
BL_DETAIL_TABLE_CANDIDATES = [
    "LiBL",
    "LIBL",
    "BonLivLigne",
    "LigneBonLiv",
    "LigneBL",
    "LIGNEBL",
    "BLLigne",
    "BonLivDetail",
    "BonLiv_Detail",
]

DB_PATH = Path(__file__).resolve().parent / "app_data.db"
SESSION_DURATION_HOURS = 12
ROLE_RESPONSABLE = "responsable"
ROLE_PREPARATEUR = "preparateur"
ROLE_ADMIN = "admin"
VALID_ROLES = {ROLE_RESPONSABLE, ROLE_PREPARATEUR, ROLE_ADMIN}

HFSQL_ERRORS: tuple[type[BaseException], ...]
if pypyodbc is None:
    HFSQL_ERRORS = (Exception,)
else:
    HFSQL_ERRORS = (pypyodbc.Error,)


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=3, max_length=120)


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: str


class LoginResponse(BaseModel):
    token: str
    expires_at: str
    user: UserOut


class BLSelectionRequest(BaseModel):
    target_date: date | None = None
    bl_ids: list[int] = Field(min_length=1)

    @field_validator("bl_ids")
    @classmethod
    def validate_bl_ids(cls, value: list[int]) -> list[int]:
        unique: list[int] = []
        seen = set()
        for item in value:
            if item <= 0:
                raise ValueError("Chaque IDBL doit etre strictement positif")
            if item in seen:
                continue
            seen.add(item)
            unique.append(item)
        return unique


class PreparationItemInput(BaseModel):
    reference: str = Field(min_length=1, max_length=120)
    status: str
    quantity_expected: float | None = None
    quantity_prepared: float | None = None
    note: str | None = Field(default=None, max_length=300)

    @field_validator("reference")
    @classmethod
    def validate_reference(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("La reference ne peut pas etre vide")
        return trimmed

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.strip().lower()
        allowed = {"available", "not_available", "partial"}
        if normalized not in allowed:
            raise ValueError("Status invalide. Utilise: available, not_available, partial")
        return normalized

    @field_validator("quantity_expected", "quantity_prepared")
    @classmethod
    def validate_quantity(cls, value: float | None) -> float | None:
        if value is None:
            return None
        if value < 0:
            raise ValueError("La quantite doit etre positive")
        return value


class PreparationReportRequest(BaseModel):
    report_date: date | None = None
    bl_id: int = Field(gt=0)
    overall_comment: str | None = Field(default=None, max_length=500)
    items: list[PreparationItemInput] = Field(min_length=1)


class PreparationReportListFilter(BaseModel):
    report_date: date | None = None


def get_sqlite_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_hfsql_connection():
    if pypyodbc is None:
        raise HTTPException(
            status_code=500,
            detail="Le package pypyodbc est requis pour interroger HFSQL. Lance: pip install -r requirements.txt",
        )
    return pypyodbc.connect(CONN_STR)


def hash_password(password: str, salt: bytes | None = None) -> tuple[str, str]:
    use_salt = salt or secrets.token_bytes(16)
    pwd_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), use_salt, 100_000)
    return base64.b64encode(use_salt).decode("ascii"), base64.b64encode(pwd_hash).decode("ascii")


def verify_password(password: str, salt_b64: str, hash_b64: str) -> bool:
    salt = base64.b64decode(salt_b64.encode("ascii"))
    _, candidate_hash = hash_password(password, salt=salt)
    return hmac.compare_digest(candidate_hash, hash_b64)


def init_local_db() -> None:
    conn = get_sqlite_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                full_name TEXT NOT NULL,
                role TEXT NOT NULL,
                password_salt TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS bl_selections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                target_date TEXT NOT NULL,
                bl_id INTEGER NOT NULL,
                selected_by INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(target_date, bl_id),
                FOREIGN KEY (selected_by) REFERENCES users(id)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS preparation_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_date TEXT NOT NULL,
                bl_id INTEGER NOT NULL,
                preparer_id INTEGER NOT NULL,
                sent_at TEXT NOT NULL,
                overall_comment TEXT,
                UNIQUE(report_date, bl_id, preparer_id),
                FOREIGN KEY (preparer_id) REFERENCES users(id)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS preparation_report_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_id INTEGER NOT NULL,
                reference TEXT NOT NULL,
                status TEXT NOT NULL,
                quantity_expected REAL,
                quantity_prepared REAL,
                note TEXT,
                FOREIGN KEY (report_id) REFERENCES preparation_reports(id)
            )
            """
        )

        cur.execute("SELECT COUNT(*) AS total FROM users")
        total_users = int(cur.fetchone()["total"])
        if total_users == 0:
            seed_users = [
                ("responsable.bl", "Responsable des BL", ROLE_RESPONSABLE, "RespBL123!"),
                ("preparateur.cmd", "Preparateur de commandes", ROLE_PREPARATEUR, "PrepCMD123!"),
                ("admin.bl", "Administrateur BL", ROLE_ADMIN, "AdminBL123!"),
            ]
            for username, full_name, role, raw_password in seed_users:
                salt, pwd_hash = hash_password(raw_password)
                cur.execute(
                    """
                    INSERT INTO users (username, full_name, role, password_salt, password_hash)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (username, full_name, role, salt, pwd_hash),
                )

        conn.commit()
    finally:
        conn.close()


def parse_hfsql_date(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        for fmt in (
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y %H:%M",
            "%d/%m/%Y",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y%m%d%H%M%S",
            "%Y%m%d",
        ):
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
    return None


def parse_authorization_header(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token manquant")
    parts = authorization.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Format Authorization invalide")
    return parts[1]


def create_session(conn: sqlite3.Connection, user_id: int) -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=SESSION_DURATION_HOURS)
    token = secrets.token_urlsafe(48)
    conn.execute("DELETE FROM sessions WHERE expires_at <= ?", (now.isoformat(),))
    conn.execute(
        """
        INSERT INTO sessions (token, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
        """,
        (token, user_id, now.isoformat(), expires.isoformat()),
    )
    conn.commit()
    return token, expires.isoformat()


def get_current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    token = parse_authorization_header(authorization)
    conn = get_sqlite_conn()
    try:
        now = datetime.now(timezone.utc).isoformat()
        row = conn.execute(
            """
            SELECT u.id, u.username, u.full_name, u.role, u.is_active, s.token
            FROM sessions s
            INNER JOIN users u ON u.id = s.user_id
            WHERE s.token = ? AND s.expires_at > ?
            """,
            (token, now),
        ).fetchone()
        if row is None or int(row["is_active"]) != 1:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session invalide ou expiree")
        return dict(row)
    finally:
        conn.close()


def require_roles(current_user: dict[str, Any], allowed_roles: set[str]) -> None:
    role = str(current_user.get("role", "")).lower()
    if role not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acces non autorise")


def fetch_bl_lines_for_idbl(
    cursor,
    idbl: int,
    table: str | None = None,
    preferred_table: str | None = None,
    preferred_link_column: str | None = None,
):
    link_columns = ["LiBL", "LIBL", "IDLBL", "IDBL"]

    def normalize_q_liv(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        quantity_keys = [
            "Q_LIV",
            "q_liv",
            "QLIV",
            "QteBL",
            "QTEBL",
            "qte",
            "QTE",
            "quantite",
            "QUANTITE",
            "Qte",
        ]
        for row in rows:
            if row.get("Q_LIV") is not None:
                continue
            value = None
            for key in quantity_keys:
                if row.get(key) is not None:
                    value = row.get(key)
                    break
            if value is None:
                for key, candidate in row.items():
                    key_lower = str(key).lower()
                    if key_lower in {"q_liv", "qliv", "qtebl", "qte", "quantite"} and candidate is not None:
                        value = candidate
                        break
            if value is not None:
                row["Q_LIV"] = value
        return rows

    if preferred_link_column in link_columns:
        link_columns.remove(preferred_link_column)
        link_columns.insert(0, preferred_link_column)

    if preferred_table and re.fullmatch(r"[A-Za-z0-9_]+", preferred_table):
        for link_column in link_columns:
            try:
                cursor.execute(f"SELECT * FROM {preferred_table} WHERE {link_column} = {int(idbl)}")
                columns = [col[0] for col in cursor.description]
                rows = cursor.fetchall()
                if rows:
                    data = normalize_q_liv([dict(zip(columns, row)) for row in rows])
                    return {
                        "idbl": idbl,
                        "table": preferred_table,
                        "link_column": link_column,
                        "count": len(data),
                        "data": data,
                    }
            except HFSQL_ERRORS:
                continue

    tables_to_try = [table] if table else BL_DETAIL_TABLE_CANDIDATES
    for table_name in tables_to_try:
        if not re.fullmatch(r"[A-Za-z0-9_]+", table_name):
            continue
        for link_column in link_columns:
            try:
                cursor.execute(f"SELECT * FROM {table_name} WHERE {link_column} = {int(idbl)}")
                columns = [col[0] for col in cursor.description]
                rows = cursor.fetchall()
                if not rows:
                    continue
                data = normalize_q_liv([dict(zip(columns, row)) for row in rows])
                return {
                    "idbl": idbl,
                    "table": table_name,
                    "link_column": link_column,
                    "count": len(data),
                    "data": data,
                }
            except HFSQL_ERRORS:
                continue

    return None


def extract_product_references(rows: list[dict[str, Any]]) -> list[str]:
    references = []
    seen = set()
    for row in rows:
        reference = row.get("reference")
        if reference is None:
            reference = row.get("REFERENCE")
        if reference is None:
            continue
        ref_text = str(reference).strip()
        if not ref_text or ref_text in seen:
            continue
        seen.add(ref_text)
        references.append(ref_text)
    return references


def parse_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        text = value.strip().replace(",", ".")
        if not text:
            return None
        try:
            return float(text)
        except ValueError:
            return None
    return None


def compute_missing_quantity(quantity_expected: Any, quantity_prepared: Any) -> float:
    expected = parse_float(quantity_expected)
    if expected is None:
        return 0.0

    prepared = parse_float(quantity_prepared)
    prepared_value = prepared if prepared is not None else 0.0
    missing = expected - prepared_value
    if missing <= 0:
        return 0.0
    return round(missing, 3)


def fetch_bl_headers_by_ids(bl_ids: list[int]) -> dict[int, dict[str, Any]]:
    if not bl_ids:
        return {}

    placeholders = ",".join("?" for _ in bl_ids)
    conn = None
    result: dict[int, dict[str, Any]] = {}
    try:
        conn = get_hfsql_connection()
        cursor = conn.cursor()
        cursor.execute(
            f"SELECT IDBL, Destinataire, DateBL FROM BonLiv WHERE IDBL IN ({placeholders})",
            tuple(bl_ids),
        )
        for idbl, destinataire, date_bl in cursor.fetchall():
            result[int(idbl)] = {
                "IDBL": int(idbl),
                "Destinataire": destinataire,
                "DateBL": date_bl,
            }
    except HFSQL_ERRORS:
        return {}
    finally:
        if conn:
            conn.close()
    return result


@app.on_event("startup")
def on_startup() -> None:
    init_local_db()


@app.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    conn = get_sqlite_conn()
    try:
        row = conn.execute(
            "SELECT id, username, full_name, role, password_salt, password_hash, is_active FROM users WHERE username = ?",
            (payload.username.strip(),),
        ).fetchone()
        if row is None or int(row["is_active"]) != 1:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants invalides")

        if not verify_password(payload.password, row["password_salt"], row["password_hash"]):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants invalides")

        token, expires_at = create_session(conn, int(row["id"]))
        return {
            "token": token,
            "expires_at": expires_at,
            "user": {
                "id": int(row["id"]),
                "username": row["username"],
                "full_name": row["full_name"],
                "role": row["role"],
            },
        }
    finally:
        conn.close()


@app.get("/auth/me", response_model=UserOut)
def me(current_user: dict[str, Any] = Depends(get_current_user)):
    return {
        "id": int(current_user["id"]),
        "username": current_user["username"],
        "full_name": current_user["full_name"],
        "role": current_user["role"],
    }


@app.post("/auth/logout")
def logout(
    current_user: dict[str, Any] = Depends(get_current_user),
    authorization: str | None = Header(default=None),
):
    _ = current_user
    token = parse_authorization_header(authorization)
    conn = get_sqlite_conn()
    try:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}


@app.get("/articles")
def list_articles(
    days: int = Query(default=2, ge=2, le=2, description="Nombre de jours a remonter (fixe a J et J-1)"),
    debug: bool = Query(default=False, description="Ajoute des compteurs de diagnostic"),
):
    conn = None
    try:
        conn = get_hfsql_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT IDBL, Destinataire, DateBL FROM BonLiv ORDER BY DateBL DESC")
        today = date.today()
        target_dates = {today - timedelta(days=offset) for offset in range(days)}
        data = []
        parsed_rows = []
        reference_mode = "system"
        total_rows = 0
        unparsable_rows = 0
        for idbl, destinataire, date_bl in cursor.fetchall():
            total_rows += 1
            parsed_date = parse_hfsql_date(date_bl)
            if parsed_date is None:
                unparsable_rows += 1
                continue
            parsed_rows.append((idbl, destinataire, date_bl, parsed_date))
            if parsed_date in target_dates:
                data.append({"IDBL": idbl, "Destinataire": destinataire, "DateBL": date_bl})

        if not data and parsed_rows:
            latest_date = max(parsed_date for _, _, _, parsed_date in parsed_rows)
            target_dates = {latest_date - timedelta(days=offset) for offset in range(days)}
            reference_mode = "latest_in_db"
            data = [
                {"IDBL": idbl, "Destinataire": destinataire, "DateBL": date_bl}
                for idbl, destinataire, date_bl, parsed_date in parsed_rows
                if parsed_date in target_dates
            ]

        preferred_table = None
        preferred_link_column = None
        for bl in data:
            line_result = fetch_bl_lines_for_idbl(
                cursor,
                int(bl["IDBL"]),
                preferred_table=preferred_table,
                preferred_link_column=preferred_link_column,
            )
            if line_result:
                preferred_table = line_result["table"]
                preferred_link_column = line_result["link_column"]
                references = extract_product_references(line_result["data"])
                bl["references_count"] = len(references)
                bl["references"] = references
            else:
                bl["references_count"] = 0
                bl["references"] = []

        response: dict[str, Any] = {"count": len(data), "data": data}
        if debug:
            response["debug"] = {
                "days": days,
                "today": today.isoformat(),
                "target_dates": sorted(d.isoformat() for d in target_dates),
                "reference_mode": reference_mode,
                "rows_read": total_rows,
                "rows_with_unparsable_date": unparsable_rows,
                "lines_table": preferred_table,
                "lines_link_column": preferred_link_column,
            }
        return response
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erreur HFSQL: {exc}") from exc
    finally:
        if conn:
            conn.close()


@app.get("/bl/{idbl}/produits")
def get_bl_products(idbl: int, table: str | None = None):
    conn = None
    try:
        conn = get_hfsql_connection()
        cursor = conn.cursor()
        result = fetch_bl_lines_for_idbl(cursor, int(idbl), table=table)
        if result:
            return result

        raise HTTPException(
            status_code=404,
            detail=(
                f"Impossible de trouver la table des lignes BL pour IDBL={idbl}. "
                "Tu peux forcer une table: /bl/{idbl}/produits?table=NomTable"
            ),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erreur HFSQL: {exc}") from exc
    finally:
        if conn:
            conn.close()


@app.post("/selections")
def create_selections(
    payload: BLSelectionRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    require_roles(current_user, {ROLE_RESPONSABLE, ROLE_ADMIN})

    target = payload.target_date or (date.today() + timedelta(days=1))
    now = datetime.now(timezone.utc).isoformat()

    conn = get_sqlite_conn()
    try:
        for bl_id in payload.bl_ids:
            conn.execute(
                """
                INSERT INTO bl_selections (target_date, bl_id, selected_by, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(target_date, bl_id)
                DO UPDATE SET selected_by = excluded.selected_by, created_at = excluded.created_at
                """,
                (target.isoformat(), int(bl_id), int(current_user["id"]), now),
            )
        conn.commit()

        headers = fetch_bl_headers_by_ids(payload.bl_ids)
        items = []
        for bl_id in payload.bl_ids:
            info = headers.get(bl_id, {})
            items.append(
                {
                    "bl_id": bl_id,
                    "destinataire": info.get("Destinataire"),
                    "date_bl": info.get("DateBL"),
                }
            )

        return {
            "target_date": target.isoformat(),
            "count": len(items),
            "selected_by": current_user["username"],
            "data": items,
        }
    finally:
        conn.close()


@app.get("/selections")
def list_selections(
    target_date: date | None = None,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    require_roles(current_user, VALID_ROLES)

    target = target_date or date.today()
    conn = get_sqlite_conn()
    try:
        rows = conn.execute(
            """
            SELECT s.target_date, s.bl_id, s.created_at, u.username AS selector_username, u.full_name AS selector_name
            FROM bl_selections s
            INNER JOIN users u ON u.id = s.selected_by
            WHERE s.target_date = ?
            ORDER BY s.bl_id ASC
            """,
            (target.isoformat(),),
        ).fetchall()

        bl_ids = [int(row["bl_id"]) for row in rows]
        headers = fetch_bl_headers_by_ids(bl_ids)
        data = []
        for row in rows:
            bl_id = int(row["bl_id"])
            info = headers.get(bl_id, {})
            data.append(
                {
                    "bl_id": bl_id,
                    "target_date": row["target_date"],
                    "selected_at": row["created_at"],
                    "selector_username": row["selector_username"],
                    "selector_name": row["selector_name"],
                    "destinataire": info.get("Destinataire"),
                    "date_bl": info.get("DateBL"),
                }
            )

        return {"target_date": target.isoformat(), "count": len(data), "data": data}
    finally:
        conn.close()


@app.get("/preparation/bls")
def list_preparation_bls(
    target_date: date | None = None,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    require_roles(current_user, {ROLE_PREPARATEUR, ROLE_ADMIN, ROLE_RESPONSABLE})
    return list_selections(target_date=target_date, current_user=current_user)


@app.post("/preparation/reports")
def submit_preparation_report(
    payload: PreparationReportRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    require_roles(current_user, {ROLE_PREPARATEUR, ROLE_ADMIN})

    report_date = payload.report_date or date.today()

    for item in payload.items:
        if item.status == "partial" and item.quantity_prepared is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Quantite preparee obligatoire pour reference {item.reference} en statut partial",
            )
        if item.status == "not_available" and item.quantity_prepared not in (None, 0):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"La quantite preparee doit etre 0 ou vide pour reference {item.reference} en statut not_available",
            )

    conn = get_sqlite_conn()
    sent_at = datetime.now(timezone.utc).isoformat()
    try:
        existing = conn.execute(
            """
            SELECT id FROM preparation_reports
            WHERE report_date = ? AND bl_id = ? AND preparer_id = ?
            """,
            (report_date.isoformat(), payload.bl_id, int(current_user["id"])),
        ).fetchone()

        if existing is None:
            cur = conn.execute(
                """
                INSERT INTO preparation_reports (report_date, bl_id, preparer_id, sent_at, overall_comment)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    report_date.isoformat(),
                    int(payload.bl_id),
                    int(current_user["id"]),
                    sent_at,
                    payload.overall_comment,
                ),
            )
            report_id = int(cur.lastrowid)
        else:
            report_id = int(existing["id"])
            conn.execute(
                """
                UPDATE preparation_reports
                SET sent_at = ?, overall_comment = ?
                WHERE id = ?
                """,
                (sent_at, payload.overall_comment, report_id),
            )
            conn.execute("DELETE FROM preparation_report_items WHERE report_id = ?", (report_id,))

        for item in payload.items:
            conn.execute(
                """
                INSERT INTO preparation_report_items (
                    report_id, reference, status, quantity_expected, quantity_prepared, note
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    report_id,
                    item.reference,
                    item.status,
                    item.quantity_expected,
                    item.quantity_prepared,
                    item.note,
                ),
            )

        conn.commit()

        available_count = sum(1 for item in payload.items if item.status == "available")
        partial_count = sum(1 for item in payload.items if item.status == "partial")
        not_available_count = sum(1 for item in payload.items if item.status == "not_available")

        return {
            "report_id": report_id,
            "report_date": report_date.isoformat(),
            "bl_id": payload.bl_id,
            "prepared_by": current_user["username"],
            "totals": {
                "available": available_count,
                "partial": partial_count,
                "not_available": not_available_count,
                "items": len(payload.items),
            },
            "sent_at": sent_at,
        }
    finally:
        conn.close()


@app.get("/preparation/reports/me")
def list_my_reports(
    report_date: date | None = None,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    require_roles(current_user, {ROLE_PREPARATEUR, ROLE_ADMIN})

    target = report_date or date.today()
    conn = get_sqlite_conn()
    try:
        rows = conn.execute(
            """
            SELECT id, report_date, bl_id, sent_at, overall_comment
            FROM preparation_reports
            WHERE report_date = ? AND preparer_id = ?
            ORDER BY sent_at DESC
            """,
            (target.isoformat(), int(current_user["id"])),
        ).fetchall()

        data = [
            {
                "report_id": int(row["id"]),
                "report_date": row["report_date"],
                "bl_id": int(row["bl_id"]),
                "sent_at": row["sent_at"],
                "overall_comment": row["overall_comment"],
            }
            for row in rows
        ]
        return {"count": len(data), "data": data}
    finally:
        conn.close()


@app.get("/admin/reports")
def list_admin_reports(
    report_date: date | None = None,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    require_roles(current_user, {ROLE_ADMIN})

    target = report_date or date.today()
    conn = get_sqlite_conn()
    try:
        rows = conn.execute(
            """
            SELECT r.id, r.report_date, r.bl_id, r.sent_at, r.overall_comment, u.username, u.full_name
            FROM preparation_reports r
            INNER JOIN users u ON u.id = r.preparer_id
            WHERE r.report_date = ?
            ORDER BY r.sent_at DESC
            """,
            (target.isoformat(),),
        ).fetchall()

        report_ids = [int(row["id"]) for row in rows]
        item_rows = []
        if report_ids:
            placeholders = ",".join("?" for _ in report_ids)
            item_rows = conn.execute(
                f"""
                SELECT report_id, status, quantity_expected, quantity_prepared
                FROM preparation_report_items
                WHERE report_id IN ({placeholders})
                """,
                tuple(report_ids),
            ).fetchall()

        summary_by_report: dict[int, dict[str, Any]] = {}
        for item in item_rows:
            report_id = int(item["report_id"])
            status_name = str(item["status"])
            summary = summary_by_report.setdefault(
                report_id,
                {
                    "available": 0,
                    "partial": 0,
                    "not_available": 0,
                    "items": 0,
                    "quantity_missing_total": 0.0,
                },
            )
            summary[status_name] = summary.get(status_name, 0) + 1
            summary["items"] += 1
            summary["quantity_missing_total"] += compute_missing_quantity(
                item["quantity_expected"], item["quantity_prepared"]
            )

        bl_ids = [int(row["bl_id"]) for row in rows]
        headers = fetch_bl_headers_by_ids(bl_ids)

        data = []
        for row in rows:
            report_id = int(row["id"])
            bl_id = int(row["bl_id"])
            header = headers.get(bl_id, {})
            data.append(
                {
                    "report_id": report_id,
                    "report_date": row["report_date"],
                    "bl_id": bl_id,
                    "destinataire": header.get("Destinataire"),
                    "sent_at": row["sent_at"],
                    "overall_comment": row["overall_comment"],
                    "preparer_username": row["username"],
                    "preparer_name": row["full_name"],
                    "summary": summary_by_report.get(
                        report_id,
                        {
                            "available": 0,
                            "partial": 0,
                            "not_available": 0,
                            "items": 0,
                            "quantity_missing_total": 0.0,
                        },
                    ),
                }
            )

        return {"report_date": target.isoformat(), "count": len(data), "data": data}
    finally:
        conn.close()


@app.get("/admin/reports/{report_id}")
def get_admin_report_detail(
    report_id: int,
    current_user: dict[str, Any] = Depends(get_current_user),
):
    require_roles(current_user, {ROLE_ADMIN})

    conn = get_sqlite_conn()
    try:
        report = conn.execute(
            """
            SELECT r.id, r.report_date, r.bl_id, r.sent_at, r.overall_comment, u.username, u.full_name
            FROM preparation_reports r
            INNER JOIN users u ON u.id = r.preparer_id
            WHERE r.id = ?
            """,
            (int(report_id),),
        ).fetchone()
        if report is None:
            raise HTTPException(status_code=404, detail="Rapport introuvable")

        items = conn.execute(
            """
            SELECT reference, status, quantity_expected, quantity_prepared, note
            FROM preparation_report_items
            WHERE report_id = ?
            ORDER BY id ASC
            """,
            (int(report_id),),
        ).fetchall()

        payload_items = [
            {
                "reference": row["reference"],
                "status": row["status"],
                "quantity_expected": row["quantity_expected"],
                "quantity_prepared": row["quantity_prepared"],
                "quantity_missing": compute_missing_quantity(row["quantity_expected"], row["quantity_prepared"]),
                "note": row["note"],
            }
            for row in items
        ]

        header = fetch_bl_headers_by_ids([int(report["bl_id"])]).get(int(report["bl_id"]), {})

        return {
            "report_id": int(report["id"]),
            "report_date": report["report_date"],
            "bl_id": int(report["bl_id"]),
            "destinataire": header.get("Destinataire"),
            "sent_at": report["sent_at"],
            "overall_comment": report["overall_comment"],
            "preparer_username": report["username"],
            "preparer_name": report["full_name"],
            "items_count": len(payload_items),
            "items": payload_items,
        }
    finally:
        conn.close()


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
