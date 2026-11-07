#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Albayrak Tasarruf Finansman A.Ş. - PDKS Personel CRUD Servisi (SQLite + REST API Katmanı)
server/AGENTS.md standartlarına uygun:
 - PEP 8 & Tip Bildirimleri (Type Annotations)
 - UTF-8 Konsol ve Dosya Kodlaması
 - Context Manager (with sqlite3.connect(...) as conn)
 - İş Parçacığı Güvenliği (EMPLOYEES_LOCK)
 - Girdi Doğrulaması & 30m Geofence Şube Standardı
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import sys
import threading
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "pdks_employees.db")
EMPLOYEES_LOCK = threading.Lock()

VALID_BRANCHES: Dict[str, Dict[str, Any]] = {
    "HQ": {"code": "HQ", "name": "Genel Merkez · Ataşehir", "city": "İstanbul", "radius_meters": 30.0},
    "UMR": {"code": "UMR", "name": "Ümraniye Şubesi", "city": "İstanbul", "radius_meters": 30.0},
    "KAD": {"code": "KAD", "name": "Kadıköy Şubesi", "city": "İstanbul", "radius_meters": 30.0},
    "ANK": {"code": "ANK", "name": "Ankara Kızılay Şubesi", "city": "Ankara", "radius_meters": 30.0},
    "IZM": {"code": "IZM", "name": "İzmir Konak Şubesi", "city": "İzmir", "radius_meters": 30.0},
    "BUR": {"code": "BUR", "name": "Bursa Nilüfer Şubesi", "city": "Bursa", "radius_meters": 30.0},
}

VALID_DEPTS: List[str] = [
    "Bireysel Finansman",
    "Taşıt Finansmanı",
    "Konut Finansmanı",
    "Kurumsal Finansman",
    "Şube Operasyon",
    "Bilgi Teknolojileri",
    "Mali İşler",
    "İnsan Kaynakları",
    "Hukuk ve Uyum",
]

VALID_TITLES: List[str] = [
    "Finans Uzmanı",
    "Müşteri Temsilcisi",
    "Operasyon Uzmanı",
    "Takım Lideri",
    "Uzman Yardımcısı",
    "Şube Müdür Yrd.",
    "Analist",
]

VALID_STATUSES: Dict[str, str] = {
    "PRESENT": "Ofiste",
    "LATE": "Geç kaldı",
    "LEAVE": "İzinli",
    "ABSENT": "Devamsız",
}

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _hhmm(minutes: Optional[int]) -> Optional[str]:
    if minutes is None:
        return None
    h = max(0, min(23, int(minutes) // 60))
    m = max(0, min(59, int(minutes) % 60))
    return f"{h:02d}:{m:02d}"


def _parse_hhmm(val: Optional[str]) -> Optional[int]:
    if not val or not isinstance(val, str) or ":" not in val:
        return None
    parts = val.strip().split(":")
    try:
        return int(parts[0]) * 60 + int(parts[1])
    except (ValueError, IndexError):
        return None


def _turkish_slug(text: str) -> str:
    tr_map = str.maketrans("çğıöşüÇĞİÖŞÜ ", "cgiosuCGIOSU.")
    cleaned = text.strip().translate(tr_map).lower()
    cleaned = re.sub(r"[^a-z0-9.]", "", cleaned)
    cleaned = re.sub(r"\.+", ".", cleaned).strip(".")
    return cleaned or "personel"


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    in_min = row["in_min"]
    out_min = row["out_min"]
    branch_code = row["branch"] if row["branch"] in VALID_BRANCHES else "HQ"
    branch_meta = VALID_BRANCHES[branch_code]
    return {
        "id": int(row["id"]),
        "sicil": str(row["sicil"]),
        "name": str(row["name"]),
        "dept": str(row["dept"]),
        "title": str(row["title"]),
        "branch": branch_code,
        "branchName": branch_meta["name"],
        "radiusMeters": 30.0,
        "status": str(row["status"]),
        "inMin": int(in_min) if in_min is not None else None,
        "outMin": int(out_min) if out_min is not None else None,
        "checkIn": row["check_in"] or _hhmm(in_min),
        "checkOut": row["check_out"] or _hhmm(out_min),
        "lateMin": int(row["late_min"] or 0),
        "overtimeMin": int(row["overtime_min"] or 0),
        "dist": float(row["dist"]) if row["dist"] is not None else None,
        "tone": int(row["tone"] or 1),
        "proneLateDow": int(row["prone_late_dow"] or 1),
        "proneOtDow": int(row["prone_ot_dow"] or 3),
        "workHabitBias": float(row["work_habit_bias"] or 0.65),
        "email": str(row["email"] or ""),
        "phone": str(row["phone"] or ""),
        "startDate": str(row["start_date"] or "2026-10-20"),
        "isNewHire": bool(row["is_new_hire"]),
        "createdAt": str(row["created_at"] or ""),
        "updatedAt": str(row["updated_at"] or ""),
    }


def _generate_deterministic_500() -> List[Tuple[Any, ...]]:
    """
    web-dashboard/data.js ile %100 uyumlu 500 başlangıç personelini üretir.
    """
    state = 20261020

    def rnd() -> float:
        nonlocal state
        state = (state + 0x6D2B79F5) & 0xFFFFFFFF
        t = state
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t = (t ^ (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF))) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0

    branches_weights = [
        ("HQ", 0.38),
        ("UMR", 0.14),
        ("KAD", 0.12),
        ("ANK", 0.14),
        ("IZM", 0.12),
        ("BUR", 0.10),
    ]

    def wpick() -> str:
        x = rnd()
        acc = 0.0
        for code, w in branches_weights:
            acc += w
            if x <= acc:
                return code
        return "HQ"

    # DAYS (60 iş günü) üretimi sırasında RNG ilerletimi (data.js ile aynı tohum sırası)
    for _ in range(60):
        pass

    fn_list = [
        "Ahmet", "Mehmet", "Mustafa", "Ali", "Hüseyin", "Hasan", "İbrahim", "Ömer", "Yusuf", "Emre",
        "Burak", "Murat", "Serkan", "Hakan", "Caner", "Tolga", "Onur", "Kerem", "Barış", "Eren",
        "Berk", "Kaan", "Arda", "Alper", "Cem", "Deniz", "Ayşe", "Fatma", "Emine", "Hatice",
        "Zeynep", "Elif", "Meryem", "Zehra", "Merve", "Büşra", "Esra", "Gamze", "Seda", "Gizem",
        "Tuğba", "Kübra", "Ebru", "Betül", "Yasemin", "Duygu", "Pelin", "Damla", "Selin", "Ece",
        "İrem", "Başak", "Melis", "Ceren",
    ]
    ln_list = [
        "Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Yıldız", "Yıldırım", "Öztürk", "Aydın", "Özdemir",
        "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara", "Koç", "Kurt", "Özkan", "Şimşek",
        "Polat", "Korkmaz", "Çakır", "Erdoğan", "Yavuz", "Güneş", "Bozkurt", "Ünal", "Acar", "Tekin",
    ]

    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    rows: List[Tuple[Any, ...]] = []

    for i in range(500):
        br_code = wpick()
        r = rnd()
        status = "PRESENT"
        in_min: Optional[int] = None
        late = 0
        out_min: Optional[int] = None
        ot_min = 0

        if r < 0.068:
            status = "LATE"
            in_min = 9 * 60 + 4 + int(rnd() * 52)
            late = in_min - 9 * 60
            out_min = 17 * 60 + 30 + int(rnd() * 45)
            ot_min = max(0, out_min - 18 * 60)
        elif r < 0.10:
            status = "LEAVE"
        elif r < 0.122:
            status = "ABSENT"
        else:
            in_min = 8 * 60 + 5 + int(((rnd() + rnd()) / 2.0) * 52)
            out_min = 17 * 60 + 30 + int(rnd() * 115)
            ot_min = max(0, out_min - 18 * 60)

        name = fn_list[(i * 7 + int(rnd() * 5)) % len(fn_list)] + " " + ln_list[(i * 11 + 3) % len(ln_list)]
        title = VALID_TITLES[int(rnd() * len(VALID_TITLES))]
        dist = round(2.0 + rnd() * 24.0, 1) if status in ("PRESENT", "LATE") else None

        emp_id = 1001 + i
        sicil = f"FN-{emp_id}"
        dept = VALID_DEPTS[i % len(VALID_DEPTS)]
        tone = 1 + (i % 5)
        prone_late_dow = 1 + ((i * 3) % 5)
        prone_ot_dow = 1 + ((i * 2 + 2) % 5)
        work_habit_bias = ((i * 17) % 100) / 100.0
        email = f"{_turkish_slug(name)}.{emp_id}@albayrakfinans.com.tr"
        phone = f"053{(i % 8) + 2} {(100 + (i * 7) % 900):03d} {(10 + (i * 13) % 90):02d} {(10 + (i * 19) % 90):02d}"
        start_year = 2021 + (i % 5)
        start_month = 1 + (i % 12)
        start_day = 1 + ((i * 3) % 27)
        start_date = f"{start_year:04d}-{start_month:02d}-{start_day:02d}"

        rows.append(
            (
                emp_id,
                sicil,
                name,
                dept,
                title,
                br_code,
                status,
                in_min,
                out_min,
                _hhmm(in_min),
                _hhmm(out_min),
                late,
                ot_min,
                dist,
                tone,
                prone_late_dow,
                prone_ot_dow,
                work_habit_bias,
                email,
                phone,
                start_date,
                0,
                now_iso,
                now_iso,
            )
        )
    return rows


def init_db() -> None:
    """SQLite veritabanını ve employees tablosunu oluşturur; boşsa 500 personel ile tohumlar."""
    with EMPLOYEES_LOCK:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS employees (
                    id INTEGER PRIMARY KEY,
                    sicil TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    dept TEXT NOT NULL,
                    title TEXT NOT NULL,
                    branch TEXT NOT NULL DEFAULT 'HQ',
                    status TEXT NOT NULL DEFAULT 'PRESENT',
                    in_min INTEGER,
                    out_min INTEGER,
                    check_in TEXT,
                    check_out TEXT,
                    late_min INTEGER NOT NULL DEFAULT 0,
                    overtime_min INTEGER NOT NULL DEFAULT 0,
                    dist REAL,
                    tone INTEGER NOT NULL DEFAULT 1,
                    prone_late_dow INTEGER NOT NULL DEFAULT 1,
                    prone_ot_dow INTEGER NOT NULL DEFAULT 3,
                    work_habit_bias REAL NOT NULL DEFAULT 0.65,
                    email TEXT NOT NULL DEFAULT '',
                    phone TEXT NOT NULL DEFAULT '',
                    start_date TEXT NOT NULL DEFAULT '2026-10-20',
                    is_new_hire INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            cur = conn.execute("SELECT COUNT(*) FROM employees")
            count = cur.fetchone()[0]
            if count == 0:
                seed_rows = _generate_deterministic_500()
                conn.executemany(
                    """
                    INSERT INTO employees (
                        id, sicil, name, dept, title, branch, status,
                        in_min, out_min, check_in, check_out, late_min, overtime_min, dist,
                        tone, prone_late_dow, prone_ot_dow, work_habit_bias,
                        email, phone, start_date, is_new_hire, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    seed_rows,
                )
                conn.commit()


def validate_employee_payload(payload: Dict[str, Any], is_update: bool = False) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Gelen personel oluşturma veya güncelleme verisini doğrular ve normalize eder.
    """
    if not isinstance(payload, dict):
        return False, "Geçersiz JSON veri gövdesi.", {}

    cleaned: Dict[str, Any] = {}

    if not is_update or "name" in payload:
        name = str(payload.get("name") or "").strip()
        if len(name) < 3 or " " not in name:
            return False, "Personel ad ve soyadı en az 3 karakter olmalı ve boşluk içermelidir.", {}
        if len(name) > 80:
            return False, "Personel ad ve soyadı 80 karakterden uzun olamaz.", {}
        cleaned["name"] = name

    if not is_update or "dept" in payload:
        dept = str(payload.get("dept") or VALID_DEPTS[0]).strip()
        if not dept:
            dept = VALID_DEPTS[0]
        cleaned["dept"] = dept

    if not is_update or "title" in payload:
        title = str(payload.get("title") or VALID_TITLES[0]).strip()
        if not title:
            title = VALID_TITLES[0]
        cleaned["title"] = title

    if not is_update or "branch" in payload:
        branch = str(payload.get("branch") or "HQ").strip().upper()
        if branch not in VALID_BRANCHES:
            return False, f"Geçersiz şube kodu: '{branch}'. Geçerli şubeler: {', '.join(VALID_BRANCHES.keys())}", {}
        cleaned["branch"] = branch

    if not is_update or "status" in payload:
        status = str(payload.get("status") or "PRESENT").strip().upper()
        if status not in VALID_STATUSES:
            return False, f"Geçersiz yoklama durumu: '{status}'. Geçerli değerler: {', '.join(VALID_STATUSES.keys())}", {}
        cleaned["status"] = status

    if "email" in payload or not is_update:
        email = str(payload.get("email") or "").strip().lower()
        if email and not EMAIL_RE.match(email):
            return False, "Geçersiz kurumsal e-posta adresi formatı.", {}
        cleaned["email"] = email

    if "phone" in payload or not is_update:
        phone = str(payload.get("phone") or "").strip()
        cleaned["phone"] = phone[:32]

    if "startDate" in payload or "start_date" in payload or not is_update:
        start_date = str(payload.get("startDate") or payload.get("start_date") or datetime.now().strftime("%Y-%m-%d")).strip()
        cleaned["start_date"] = start_date[:10]

    if "checkIn" in payload or "check_in" in payload:
        ci = payload.get("checkIn") or payload.get("check_in")
        in_m = _parse_hhmm(ci)
        cleaned["in_min"] = in_m
        cleaned["check_in"] = _hhmm(in_m)

    if "checkOut" in payload or "check_out" in payload:
        co = payload.get("checkOut") or payload.get("check_out")
        out_m = _parse_hhmm(co)
        cleaned["out_min"] = out_m
        cleaned["check_out"] = _hhmm(out_m)

    if "lateMin" in payload or "late_min" in payload:
        raw_late = payload.get("lateMin", payload.get("late_min", 0))
        try:
            cleaned["late_min"] = max(0, min(480, int(raw_late)))
        except (ValueError, TypeError):
            return False, "Gecikme dakikası (lateMin) sayısal olmalıdır.", {}

    if "overtimeMin" in payload or "overtime_min" in payload:
        raw_ot = payload.get("overtimeMin", payload.get("overtime_min", 0))
        try:
            cleaned["overtime_min"] = max(0, min(600, int(raw_ot)))
        except (ValueError, TypeError):
            return False, "Ek mesai dakikası (overtimeMin) sayısal olmalıdır.", {}

    if "dist" in payload:
        raw_dist = payload.get("dist")
        if raw_dist is None or raw_dist == "":
            cleaned["dist"] = None
        else:
            try:
                dist_val = round(float(raw_dist), 1)
                if dist_val < 0 or dist_val > 5000:
                    return False, "Geofence mesafesi 0 ile 5000 metre arasında olmalıdır.", {}
                cleaned["dist"] = dist_val
            except (ValueError, TypeError):
                return False, "Geofence mesafesi (dist) sayısal olmalıdır.", {}

    return True, "", cleaned


def list_employees(
    q: str = "",
    dept: str = "ALL",
    branch: str = "ALL",
    status: str = "ALL",
    page: int = 1,
    size: int = 1000,
) -> Dict[str, Any]:
    """Filtreleme ve sayfalama destekli personel listesini döndürür."""
    init_db()
    clauses: List[str] = []
    params: List[Any] = []

    if dept and dept != "ALL":
        clauses.append("dept = ?")
        params.append(dept)
    if branch and branch != "ALL":
        clauses.append("branch = ?")
        params.append(branch.upper())
    if status and status != "ALL":
        clauses.append("status = ?")
        params.append(status.upper())
    if q and q.strip():
        q_like = f"%{q.strip()}%"
        clauses.append("(name LIKE ? OR sicil LIKE ? OR dept LIKE ? OR title LIKE ? OR email LIKE ?)")
        params.extend([q_like, q_like, q_like, q_like, q_like])

    where_sql = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    safe_page = max(1, int(page or 1))
    safe_size = max(1, min(2000, int(size or 1000)))
    offset = (safe_page - 1) * safe_size

    with EMPLOYEES_LOCK:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            total = conn.execute(f"SELECT COUNT(*) FROM employees {where_sql}", params).fetchone()[0]
            rows = conn.execute(
                f"""
                SELECT * FROM employees
                {where_sql}
                ORDER BY is_new_hire DESC, id ASC
                LIMIT ? OFFSET ?
                """,
                [*params, safe_size, offset],
            ).fetchall()

    items = [_row_to_dict(r) for r in rows]
    return {
        "items": items,
        "total": int(total),
        "page": safe_page,
        "size": safe_size,
    }


def get_employee(identifier: str | int) -> Optional[Dict[str, Any]]:
    """Tekil personeli ID (örn. 1001) veya Sicil No (örn. FN-1001) ile getirir."""
    init_db()
    ident_str = str(identifier).strip().upper()
    with EMPLOYEES_LOCK:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            if ident_str.startswith("FN-"):
                row = conn.execute("SELECT * FROM employees WHERE UPPER(sicil) = ?", (ident_str,)).fetchone()
            elif ident_str.isdigit():
                row = conn.execute("SELECT * FROM employees WHERE id = ?", (int(ident_str),)).fetchone()
            else:
                row = conn.execute("SELECT * FROM employees WHERE UPPER(sicil) = ?", (ident_str,)).fetchone()
    return _row_to_dict(row) if row else None


def create_employee(payload: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    """Yeni personel oluşturur (POST /api/v1/employees)."""
    init_db()
    ok, err, cleaned = validate_employee_payload(payload, is_update=False)
    if not ok:
        return 400, {"success": False, "error": err}

    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with EMPLOYEES_LOCK:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            max_id_row = conn.execute("SELECT MAX(id) FROM employees").fetchone()
            next_id = max(1500, int(max_id_row[0] or 1500)) + 1
            sicil = str(payload.get("sicil") or f"FN-{next_id}").strip().upper()

            exists = conn.execute("SELECT 1 FROM employees WHERE UPPER(sicil) = ?", (sicil,)).fetchone()
            if exists:
                return 409, {"success": False, "error": f"'{sicil}' sicil numarasıyla kayıtlı personel zaten mevcut."}

            status = cleaned["status"]
            in_min = cleaned.get("in_min", 505 if status == "PRESENT" else (552 if status == "LATE" else None))
            out_min = cleaned.get("out_min", 1060 if status in ("PRESENT", "LATE") else None)
            late_min = cleaned.get("late_min", 12 if status == "LATE" else 0)
            overtime_min = cleaned.get("overtime_min", 15 if status == "PRESENT" else 0)
            dist = cleaned.get("dist", 8.4 if status in ("PRESENT", "LATE") else None)
            tone = 1 + (next_id % 5)
            email = cleaned["email"] or f"{_turkish_slug(cleaned['name'])}.{next_id}@albayrakfinans.com.tr"
            phone = cleaned["phone"] or "0532 000 00 00"

            conn.execute(
                """
                INSERT INTO employees (
                    id, sicil, name, dept, title, branch, status,
                    in_min, out_min, check_in, check_out, late_min, overtime_min, dist,
                    tone, prone_late_dow, prone_ot_dow, work_habit_bias,
                    email, phone, start_date, is_new_hire, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    next_id,
                    sicil,
                    cleaned["name"],
                    cleaned["dept"],
                    cleaned["title"],
                    cleaned["branch"],
                    status,
                    in_min,
                    out_min,
                    _hhmm(in_min),
                    _hhmm(out_min),
                    late_min,
                    overtime_min,
                    dist,
                    tone,
                    1,
                    3,
                    0.72,
                    email,
                    phone,
                    cleaned["start_date"],
                    1,
                    now_iso,
                    now_iso,
                ),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM employees WHERE id = ?", (next_id,)).fetchone()

    created = _row_to_dict(row)
    return 201, {
        "success": True,
        "message": f"{created['name']} ({created['sicil']}) PDKS sistemine başarıyla eklendi.",
        "employee": created,
    }


def update_employee(identifier: str | int, payload: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
    """Mevcut personelin bilgilerini günceller (PUT / PATCH /api/v1/employees/<id>)."""
    init_db()
    existing = get_employee(identifier)
    if not existing:
        return 404, {"success": False, "error": f"Personel bulunamadı: {identifier}"}

    ok, err, cleaned = validate_employee_payload(payload, is_update=True)
    if not ok:
        return 400, {"success": False, "error": err}

    if not cleaned:
        return 400, {"success": False, "error": "Güncellenecek geçerli bir alan gönderilmedi."}

    emp_id = existing["id"]
    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Durum değiştiyse ve giriş/çıkış açıkça verilmediyse mantıklı varsayılanları senkronize et
    if "status" in cleaned and "in_min" not in cleaned:
        new_st = cleaned["status"]
        if new_st in ("LEAVE", "ABSENT"):
            cleaned["in_min"] = None
            cleaned["out_min"] = None
            cleaned["check_in"] = None
            cleaned["check_out"] = None
            cleaned["dist"] = None
            if "late_min" not in cleaned:
                cleaned["late_min"] = 0
            if "overtime_min" not in cleaned:
                cleaned["overtime_min"] = 0
        elif existing["inMin"] is None:
            in_m = 505 if new_st == "PRESENT" else 552
            out_m = 1060
            cleaned["in_min"] = in_m
            cleaned["out_min"] = out_m
            cleaned["check_in"] = _hhmm(in_m)
            cleaned["check_out"] = _hhmm(out_m)
            cleaned["dist"] = existing["dist"] or 7.8
            if new_st == "LATE" and existing["lateMin"] == 0 and "late_min" not in cleaned:
                cleaned["late_min"] = 12
            elif new_st == "PRESENT" and "late_min" not in cleaned:
                cleaned["late_min"] = 0

    cleaned["updated_at"] = now_iso
    set_cols = ", ".join(f"{col} = ?" for col in cleaned.keys())
    values = list(cleaned.values()) + [emp_id]

    with EMPLOYEES_LOCK:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            conn.execute(f"UPDATE employees SET {set_cols} WHERE id = ?", values)
            conn.commit()
            row = conn.execute("SELECT * FROM employees WHERE id = ?", (emp_id,)).fetchone()

    updated = _row_to_dict(row)
    return 200, {
        "success": True,
        "message": f"{updated['name']} ({updated['sicil']}) bilgileri güncellendi.",
        "employee": updated,
    }


def delete_employee(identifier: str | int) -> Tuple[int, Dict[str, Any]]:
    """Personeli veritabanından siler (DELETE /api/v1/employees/<id>)."""
    init_db()
    existing = get_employee(identifier)
    if not existing:
        return 404, {"success": False, "error": f"Silinecek personel bulunamadı: {identifier}"}

    emp_id = existing["id"]
    with EMPLOYEES_LOCK:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("DELETE FROM employees WHERE id = ?", (emp_id,))
            conn.commit()

    return 200, {
        "success": True,
        "message": f"{existing['name']} ({existing['sicil']}) PDKS kaydı silindi.",
        "deletedId": emp_id,
        "sicil": existing["sicil"],
        "employee": existing,
    }
