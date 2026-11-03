#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Albayrak Tasarruf Finansman A.Ş. - PDKS Yerel Test Sunucusu (Mock Backend & Web Dashboard)
Android emülatörü (10.0.2.2:8080) veya yerel istemciler için HTTP REST API simülasyonu.
Özellikler:
 - 30 metre Geofence şube denetimi
 - Genel Merkez: Ataşehir Yenişehir Mah. Kızılcık Sok. Albayrak Plaza No:1/35
 - https://albayrakfinans.com.tr/subelerimiz üzerinden web scraping ve otomatik gece 01:00 şube senkronizasyonu
 - Zengin HTML Web Dashboard: http://localhost:8080/
"""

import sys
import os
import json
import time
import re
import threading
import urllib.request
import urllib.parse
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import socketserver

# Windows CP1254 terminal çıktısı için UTF-8 yapılandırması
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HOST = "0.0.0.0"
PORT = 8080
CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cached_branches.json")

# Bellekte tutulan aktif şubeler ve kayıtlar
ACTIVE_BRANCHES = []
BRANCHES_LOCK = threading.Lock()
LAST_SCRAPE_TIME = None

RECEIVED_RECORDS = [
    {
        "employee_id": 1,
        "employee_name": "Ahmet Yılmaz",
        "branch_name": "Albayrak Finans Genel Müdürlük (Ataşehir)",
        "record_type": "GIRIS",
        "distance_meters": 4.2,
        "device_model": "Android Emulator",
        "timestamp": int(time.time() * 1000) - 3600000,
        "received_at": "08:58:12"
    },
    {
        "employee_id": 2,
        "employee_name": "Ayşe Kaya",
        "branch_name": "Albayrak Finans Genel Müdürlük (Ataşehir)",
        "record_type": "GIRIS",
        "distance_meters": 6.8,
        "device_model": "Samsung Galaxy S24",
        "timestamp": int(time.time() * 1000) - 3000000,
        "received_at": "09:02:45"
    }
]
RECEIVED_ALERTS = [
    {
        "employee_name": "Mehmet Demir",
        "branch_name": "Albayrak Finans Ümraniye Şubesi",
        "alert_type": "30M_ASIMI",
        "distance_meters": 84.5,
        "severity": "CRITICAL",
        "received_at": "09:15:20"
    }
]
RECORDS_LOCK = threading.Lock()

def get_timestamp_ms():
    return int(time.time() * 1000)

MOCK_FIRST_NAMES = [
    "Ahmet", "Mehmet", "Mustafa", "Ali", "Hüseyin", "Hasan", "İbrahim", "İsmail", "Osman", "Yusuf",
    "Ömer", "Emre", "Burak", "Murat", "Serkan", "Hakan", "Caner", "Tolga", "Onur", "Kerem",
    "Barış", "Eren", "Berk", "Kaan", "Arda", "Alper", "Batuhan", "Cem", "Deniz", "Ege",
    "Furkan", "Gökhan", "Harun", "Kadir", "Koray", "Mert", "Oğuz", "Ozan", "Polat", "Rıza",
    "Samet", "Selim", "Sinan", "Şafak", "Tarık", "Ufuk", "Umut", "Volkan", "Yağız", "Zafer",
    "Adem", "Altan", "Baha", "Berkay", "Bora", "Cihan", "Cüneyt", "Doruk", "Emir", "Enes",
    "Erdem", "Fatih", "Görkem", "Halil", "Hamza", "İlker", "İrfan", "Kenan", "Levent", "Melih",
    "Metin", "Necati", "Nihat", "Okan", "Orhan", "Özgür", "Recep", "Ramazan", "Sabri", "Sedat",
    "Semih", "Serdar", "Süleyman", "Taha", "Tayfun", "Tuna", "Turan", "Uğur", "Vedat", "Yasin",
    "Ayşe", "Fatma", "Emine", "Hatice", "Zeynep", "Elif", "Meryem", "Şerife", "Zehra", "Sultan",
    "Hanife", "Merve", "Büşra", "Esra", "Gamze", "Seda", "Gizem", "Tuğba", "Kübra", "Ebru",
    "Betül", "Yasemin", "Duygu", "Pelin", "Damla", "Selin", "Ece", "İrem", "Başak", "Melis",
    "Ceren", "Aslı", "Burcu", "Derya", "Dilara", "Ezgi", "Fulya", "Gözde", "Hande", "Hazal",
    "Hilal", "Ilgın", "Janset", "Leman", "Mine", "Nazlı", "Nilgün", "Nur", "Özge", "Pınar",
    "Rüya", "Sevgi", "Simge", "Şule", "Yağmur", "Berna", "Bahar", "Beyza", "Buket", "Cansu",
    "Çağla", "Defne", "Eda", "Ela", "Eylül", "Feyza", "Gülşah", "Gülben", "Hacer", "Hale",
    "İnci", "İpek", "Kader", "Kardelen", "Melike", "Nalan", "Nesrin", "Nida", "Nihal",
    "Rabia", "Reyhan", "Rumeysa", "Sahra", "Sanem", "Sedef", "Selen", "Sena", "Sevil", "Sıla",
    "Sude", "Tuğçe", "Tülay", "Vildan", "Zeliha", "Zuhal", "Zümrüt", "Berrin", "Burçak", "Canan"
]

MOCK_LAST_NAMES = [
    "Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Yıldız", "Yıldırım", "Öztürk", "Aydın", "Özdemir",
    "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara", "Koç", "Kurt", "Özkan", "Şimşek",
    "Polat", "Korkmaz", "Önal", "Erdoğan", "Yavuz", "Ceylan", "Güler", "Aktaş", "Yalçın", "Güneş",
    "Bozkurt", "Bulut", "Keskin", "Ünal", "Kaplan", "Avcı", "Karaca", "Taşkın", "Akın", "Coşkun",
    "Şen", "Sönmez", "Bilgin", "Duman", "Erol", "Çakır", "Sevim", "Tekin", "Acar", "Albayrak",
    "Gök", "Turan", "Varol", "Uysal", "Yalaza", "Yaman", "Yenice", "Zorlu", "Aksu", "Alkan",
    "Altun", "Atalay", "Baştürk", "Bayram", "Bozdağ", "Candemir", "Cengiz", "Çakmak", "Dağdelen", "Demirci",
    "Dilek", "Ergin", "Esen", "Gedik", "Göktürk", "Gültekin", "Işık", "Kahraman", "Kandemir", "Karadağ",
    "Kocaman", "Köksal", "Mercan", "Ocak", "Özbay", "Özer", "Pala", "Pehlivan", "Sarı", "Saygın"
]

def build_500_employee_metadata():
    meta = {
        1: {"name": "Ahmet Yılmaz", "branch_id": 1, "branch_name": "Albayrak Finans Genel Müdürlük (Ataşehir)"},
        2: {"name": "Zeynep Kaya", "branch_id": 1, "branch_name": "Albayrak Finans Genel Müdürlük (Ataşehir)"},
        3: {"name": "Caner Özdemir", "branch_id": 2, "branch_name": "Albayrak Finans Kadıköy Rıhtım Ticari Şube"},
        4: {"name": "Elif Demir", "branch_id": 1, "branch_name": "Albayrak Finans Genel Müdürlük (Ataşehir)"},
        5: {"name": "Murat Akın", "branch_id": 1, "branch_name": "Albayrak Finans Genel Müdürlük (Ataşehir)"},
    }
    used = {v["name"] for v in meta.values()}
    fn_len = len(MOCK_FIRST_NAMES)
    ln_len = len(MOCK_LAST_NAMES)
    for i in range(6, 501):
        f_idx = (i * 7 + 13) % fn_len
        l_idx = (i * 11 + 29) % ln_len
        first = MOCK_FIRST_NAMES[f_idx]
        last = MOCK_LAST_NAMES[l_idx]
        full_name = f"{first} {last}"
        offset = 1
        while full_name in used:
            f_idx = (f_idx + offset) % fn_len
            first = MOCK_FIRST_NAMES[f_idx]
            full_name = f"{first} {last}"
            offset += 1
        used.add(full_name)
        b_id = ((i % 50) + 1)
        meta[i] = {
            "name": full_name,
            "branch_id": b_id,
            "branch_name": f"Albayrak Finans Şube #{b_id}"
        }
    return meta

EMPLOYEE_METADATA = build_500_employee_metadata()

def generate_employee_attendance_records(emp_id):
    """
    Belirli bir personel için sunucu tarafında son 30 güne ait
    gerçekçi devam, gecikme ve ek mesai kayıtlarını döndürür.
    Mobil cihazdan gelen canlı kayıtları da içerir.
    """
    meta = EMPLOYEE_METADATA.get(emp_id, {
        "name": f"Personel #{emp_id}",
        "branch_id": 1,
        "branch_name": "Albayrak Finans Genel Müdürlük (Ataşehir)"
    })

    emp_name = meta["name"]
    branch_id = meta["branch_id"]
    branch_name = meta["branch_name"]

    records = []

    # 1. Mobil istemcilerden daha önce canlı gönderilmiş olan kayıtlar
    with RECORDS_LOCK:
        for idx, r in enumerate(RECEIVED_RECORDS):
            if r.get("employee_id") == emp_id or r.get("employee_name") == emp_name:
                rec_type = "GİRİŞ" if "GIRIS" in r.get("record_type", "") else "ÇIKIŞ"
                rec_ts = r.get("timestamp", int(time.time() * 1000))
                dist = float(r.get("distance_meters", 4.2))
                records.append({
                    "id": rec_ts % 100000000 + idx,
                    "employeeId": emp_id,
                    "employeeName": emp_name,
                    "branchId": branch_id,
                    "branchName": r.get("branch_name", branch_name),
                    "recordType": rec_type,
                    "timestamp": rec_ts,
                    "formattedTime": r.get("received_at", "09:00")[:5],
                    "formattedDate": datetime.fromtimestamp(rec_ts / 1000).strftime("%d.%m.%Y"),
                    "userLatitude": 40.995454,
                    "userLongitude": 29.140893,
                    "distanceMeters": dist,
                    "isWithin5Meters": dist <= 30.0,
                    "ipAddress": "10.0.2.16",
                    "deviceModel": r.get("device_model", "Android Mobil İstemci"),
                    "isMockLocation": False,
                    "note": "Canlı mobil işlem",
                    "lateMinutes": 0,
                    "overtimeMinutes": 30 if rec_type == "ÇIKIŞ" else 0
                })

    # 2. Son 30 günlük çalışma günü dökümü (Hafta sonları hariç 20 iş günü)
    base_time = int(time.time())
    day_step = 86400

    for i in range(1, 28):
        day_ts = base_time - (i * day_step)
        dt = datetime.fromtimestamp(day_ts)
        # Hafta sonu atla (Cumartesi=5, Pazar=6)
        if dt.weekday() >= 5:
            continue

        date_str = dt.strftime("%d.%m.%Y")

        # Personele göre gerçekçi gecikme ve ek mesai varyasyonları
        if emp_id == 1:
            # Ahmet Yılmaz: Yüksek dakiklik (yalnızca 2 gün ufak gecikme), bol ek mesai
            late = 12 if i == 4 else (6 if i == 11 else 0)
            ot = 45 if i % 2 == 0 else (60 if i % 3 == 0 else 20)
        elif emp_id == 2:
            # Ayşe Kaya: Sıfır gecikme (Elmas rozet), düzenli ek mesai
            late = 0
            ot = 30 if i % 2 == 0 else 15
        elif emp_id == 3:
            # Mehmet Demir: Arada gecikmeler, az ek mesai
            late = 18 if i == 2 else (25 if i == 8 else (35 if i == 15 else 0))
            ot = 25 if i % 3 == 0 else 0
        else:
            archetype = emp_id % 10
            if archetype in [0, 1, 2, 3]:
                # Elmas: 0 gecikme
                late = 0
                ot = 30 if i % 2 == 0 else 45
            elif archetype in [4, 5, 6]:
                # Altın: max 12 dk gecikme
                late = 12 if i == 4 else 0
                ot = 25 if i % 2 == 0 else 15
            elif archetype in [7, 8]:
                # Gümüş: 15-30 dk gecikme
                late = 22 if i in [4, 11] else 0
                ot = 20 if i == 8 else 0
            else:
                # Bronz: 30 dk üzeri gecikme
                late = 45 if i == 4 else (35 if i == 11 else 0)
                ot = 15 if i == 2 else 0

        # GİRİŞ HAREKETİ
        in_hour = 8 if late == 0 else 9
        in_min = (50 + (i % 8)) if late == 0 else late
        if in_min >= 60:
            in_hour += 1
            in_min -= 60
        checkin_time_str = f"{in_hour:02d}:{in_min:02d}"
        checkin_dt = dt.replace(hour=in_hour, minute=in_min, second=0)
        checkin_ts = int(checkin_dt.timestamp() * 1000)
        dist_in = round(3.2 + ((i * 1.3) % 12.0), 1)

        records.append({
            "id": int(checkin_ts / 10000),
            "employeeId": emp_id,
            "employeeName": emp_name,
            "branchId": branch_id,
            "branchName": branch_name,
            "recordType": "GİRİŞ",
            "timestamp": checkin_ts,
            "formattedTime": checkin_time_str,
            "formattedDate": date_str,
            "userLatitude": 40.995454,
            "userLongitude": 29.140893,
            "distanceMeters": dist_in,
            "isWithin5Meters": dist_in <= 30.0,
            "ipAddress": "10.0.2.16",
            "deviceModel": "Albayrak Kurumsal Cihaz",
            "isMockLocation": False,
            "note": "Zamanında mesai başlangıcı" if late == 0 else f"{late} dk gecikmeli giriş",
            "lateMinutes": late,
            "overtimeMinutes": 0
        })

        # ÇIKIŞ HAREKETİ
        out_hour = 18 + (ot // 60)
        out_min = ot % 60
        checkout_time_str = f"{out_hour:02d}:{out_min:02d}"
        checkout_dt = dt.replace(hour=out_hour, minute=out_min, second=0)
        checkout_ts = int(checkout_dt.timestamp() * 1000)
        dist_out = round(4.5 + ((i * 1.8) % 15.0), 1)

        records.append({
            "id": int(checkout_ts / 10000),
            "employeeId": emp_id,
            "employeeName": emp_name,
            "branchId": branch_id,
            "branchName": branch_name,
            "recordType": "ÇIKIŞ",
            "timestamp": checkout_ts,
            "formattedTime": checkout_time_str,
            "formattedDate": date_str,
            "userLatitude": 40.995454,
            "userLongitude": 29.140893,
            "distanceMeters": dist_out,
            "isWithin5Meters": dist_out <= 30.0,
            "ipAddress": "10.0.2.16",
            "deviceModel": "Albayrak Kurumsal Cihaz",
            "isMockLocation": False,
            "note": f"{ot} dk onaylı ek mesai" if ot > 0 else "Normal mesai bitimi",
            "lateMinutes": 0,
            "overtimeMinutes": ot
        })

    records.sort(key=lambda x: x["timestamp"], reverse=True)
    return records

def scrape_albayrak_branches():
    """
    https://albayrakfinans.com.tr/subelerimiz ve /api/branches/all üzerinden
    güncel şubeleri çeker. Genel Merkez'i Ataşehir Yenişehir olarak sabitler,
    tüm şubelere 30m geofence yarıçapı atar.
    """
    global ACTIVE_BRANCHES, LAST_SCRAPE_TIME
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{now_str}] [SCRAPER] Albayrak Finans web sitesinden şubeler çekiliyor...")

    url = "https://albayrakfinans.com.tr/api/branches/all"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AlbayrakPDKS-Scraper/1.0"}
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            branches_raw = json.loads(resp.read().decode("utf-8"))

        processed = []
        # 1. Şube: ALBAYRAK FİNANS GENEL MÜDÜRLÜK (ATAŞEHİR YENİŞEHİR)
        gm = {
            "id": 1,
            "name": "Albayrak Finans Genel Müdürlük (Ataşehir)",
            "branch_code": "ŞB-001",
            "branchCode": "ŞB-001",
            "city": "İstanbul",
            "address": "Yenişehir Mah. Kızılcık Sok. Albayrak Plaza No:1/35 34779 Ataşehir / İstanbul",
            "latitude": 40.995454,
            "longitude": 29.140893,
            "radius_meters": 30.0,
            "radiusMeters": 30.0,
            "wifi_ssid": "ALBAYRAK_GM_SECURE",
            "wifiSsid": "ALBAYRAK_GM_SECURE",
            "phone": "444 88 61",
            "is_default": True,
            "isDefault": True
        }
        processed.append(gm)

        for idx, b in enumerate(branches_raw, start=2):
            name = b.get("name") or b.get("title") or f"Şube {idx}"
            name = name.replace("&amp;", "&").replace("<br>", "").strip()
            address = b.get("address") or b.get("spot") or ""
            address = address.replace("\r\n", " ").strip()
            province = (b.get("province") or "Türkiye").capitalize()
            phone = b.get("phone", "444 88 61")

            road_url = b.get("googleRoadUrl", "")
            map_url = b.get("googleMapUrl", "")
            lat, lng = None, None

            m = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', road_url + " " + map_url)
            if m:
                lat = float(m.group(1))
                lng = float(m.group(2))

            if lat is None:
                m_dest = re.search(r'3d(-?\d+\.\d+)!4d(-?\d+\.\d+)', road_url + " " + map_url)
                if m_dest:
                    lat = float(m_dest.group(1))
                    lng = float(m_dest.group(2))

            if lat is None:
                lat = 40.995454 + ((idx % 15) * 0.008)
                lng = 29.140893 + ((idx % 15) * 0.008)

            processed.append({
                "id": idx,
                "name": name,
                "branch_code": f"ŞB-{idx:03d}",
                "branchCode": f"ŞB-{idx:03d}",
                "city": province,
                "address": address,
                "latitude": round(lat, 6),
                "longitude": round(lng, 6),
                "radius_meters": 30.0,
                "radiusMeters": 30.0,
                "wifi_ssid": f"ALBAYRAK_{idx}_WIFI",
                "wifiSsid": f"ALBAYRAK_{idx}_WIFI",
                "phone": phone,
                "is_default": False,
                "isDefault": False
            })

        with BRANCHES_LOCK:
            ACTIVE_BRANCHES = processed
            LAST_SCRAPE_TIME = now_str

        # Diske önbellekle
        try:
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(processed, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[{now_str}] [CACHE-WARN] Önbellek dosyası yazılamadı: {e}")

        print(f"[{now_str}] [SCRAPER-OK] Toplam {len(processed)} şube başarıyla çekildi ve güncellendi. (Genel Merkez: Ataşehir Yenişehir, 30m Geofence)")
        return True

    except Exception as e:
        print(f"[{now_str}] [SCRAPER-ERR] Şubeler çekilemedi ({e}). Önbellekten yükleniyor...")
        load_cached_branches()
        return False

def load_cached_branches():
    """Önbellekteki şubeleri yükler veya varsayılan seed oluşturur."""
    global ACTIVE_BRANCHES, LAST_SCRAPE_TIME
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data:
                    with BRANCHES_LOCK:
                        ACTIVE_BRANCHES = data
                    LAST_SCRAPE_TIME = datetime.fromtimestamp(os.path.getmtime(CACHE_FILE)).strftime("%Y-%m-%d %H:%M:%S")
                    print(f"[CACHE] {len(data)} adet önbellek şubesi yüklendi.")
                    return
        except Exception as e:
            print(f"[CACHE-ERR] Önbellek okunamadı: {e}")

    # Fallback default seed
    with BRANCHES_LOCK:
        ACTIVE_BRANCHES = [
            {
                "id": 1,
                "name": "Albayrak Finans Genel Müdürlük (Ataşehir)",
                "branch_code": "ŞB-001",
                "city": "İstanbul",
                "address": "Yenişehir Mah. Kızılcık Sok. Albayrak Plaza No:1/35 34779 Ataşehir / İstanbul",
                "latitude": 40.995454,
                "longitude": 29.140893,
                "radius_meters": 30.0,
                "wifi_ssid": "ALBAYRAK_GM_SECURE",
                "phone": "444 88 61",
                "is_default": True
            }
        ]

def branch_scheduler_worker():
    """
    Arka plan zamanlayıcısı:
    - Sunucu başladığında önbelleği yükler veya ilk scraping yapar.
    - Her gece 01:00'de otomatik olarak web scraping yaparak şubeleri günceller.
    """
    time.sleep(1)
    if not ACTIVE_BRANCHES:
        load_cached_branches()
    scrape_albayrak_branches()

    last_day_scraped = None
    while True:
        try:
            now = datetime.now()
            # Gece 01:00 kontrolü (01:00 ile 01:05 arası, günde 1 kez)
            if now.hour == 1 and now.minute == 0 and last_day_scraped != now.date():
                print(f"\n[{now.strftime('%H:%M:%S')}] [GECE 01:00 ZAMANLAYICI] Gece 01:00 otomatik şube güncellemesi başlatılıyor...")
                scrape_albayrak_branches()
                last_day_scraped = now.date()

            time.sleep(30)
        except Exception as e:
            print(f"[SCHEDULER-ERR] {e}")
            time.sleep(60)

def render_dashboard_html():
    """Web tarayıcısında açılan modern, şık ve duyarlı Albayrak Finans PDKS Kontrol Paneli."""
    with BRANCHES_LOCK:
        branches = list(ACTIVE_BRANCHES)
        scrape_time = LAST_SCRAPE_TIME or "Önbellek"
    with RECORDS_LOCK:
        records = list(RECEIVED_RECORDS)
        alerts = list(RECEIVED_ALERTS)

    branch_count = len(branches)

    # HTML tablosu için şubeleri render et
    branch_rows = []
    for b in branches:
        is_gm = b.get("is_default", False)
        badge = '<span class="badge badge-gold">GENEL MERKEZ</span>' if is_gm else '<span class="badge badge-blue">ŞUBE</span>'
        branch_rows.append(f"""
        <tr>
            <td style="font-weight:600; color:#38BDF8;">{b.get('id')}</td>
            <td><code>{b.get('branch_code')}</code></td>
            <td><strong>{b.get('name')}</strong> {badge}</td>
            <td><span class="city-pill">{b.get('city')}</span></td>
            <td style="max-width:280px; font-size:12px; color:#94A3B8;">{b.get('address')}</td>
            <td style="font-size:11px;">{b.get('latitude')}, {b.get('longitude')}</td>
            <td><span class="badge badge-green">30 Metre</span></td>
            <td><code style="font-size:11px;">{b.get('wifi_ssid')}</code></td>
            <td style="font-size:12px;">{b.get('phone')}</td>
        </tr>
        """)

    record_rows = []
    for r in records[:15]:
        rtype = r.get("record_type", "GIRIS")
        rtype_badge = f'<span class="badge badge-green">{rtype}</span>' if rtype == "GIRIS" else f'<span class="badge badge-orange">{rtype}</span>'
        dist = r.get("distance_meters", 0.0)
        dist_badge = f'<span style="color:#10B981;">{dist:.1f}m</span>' if dist <= 30.0 else f'<span style="color:#EF4444; font-weight:bold;">{dist:.1f}m (30m Aşımı)</span>'
        record_rows.append(f"""
        <tr>
            <td>{r.get('received_at', '-')}</td>
            <td><strong>{r.get('employee_name', 'Personel')}</strong> (ID: {r.get('employee_id', '-')})</td>
            <td>{r.get('branch_name', '-')}</td>
            <td>{rtype_badge}</td>
            <td>{dist_badge}</td>
            <td><small>{r.get('device_model', '-')}</small></td>
        </tr>
        """)

    alert_rows = []
    for a in alerts[:10]:
        alert_rows.append(f"""
        <tr>
            <td>{a.get('received_at', '-')}</td>
            <td><strong style="color:#EF4444;">{a.get('alert_type', 'GÜVENLİK ALARMI')}</strong></td>
            <td>{a.get('employee_name', '-')}</td>
            <td>{a.get('branch_name', '-')}</td>
            <td>{a.get('distance_meters', 0.0):.1f} metre</td>
            <td><span class="badge badge-red">{a.get('severity', 'HIGH')}</span></td>
        </tr>
        """)

    html = f"""<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Albayrak Finans PDKS - Yönetim & Entegrasyon Sunucusu</title>
    <style>
        :root {{
            --bg-dark: #0A192F;
            --bg-card: #112240;
            --bg-card-hover: #1E3A5F;
            --text-main: #E2E8F0;
            --text-muted: #94A3B8;
            --accent-gold: #D4AF37;
            --accent-cyan: #38BDF8;
            --accent-green: #10B981;
            --accent-red: #EF4444;
            --border-color: #1E293B;
        }}
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            background-color: var(--bg-dark);
            color: var(--text-main);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.5;
            padding: 24px;
        }}
        .header {{
            background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
        }}
        .header-title h1 {{
            color: var(--accent-gold);
            font-size: 22px;
            font-weight: 700;
            letter-spacing: 0.5px;
            display: flex;
            align-items: center;
            gap: 10px;
        }}
        .header-title p {{
            color: var(--text-muted);
            font-size: 13px;
            margin-top: 4px;
        }}
        .status-pill {{
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid rgba(16, 185, 129, 0.4);
            color: var(--accent-green);
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 600;
        }}
        .pulse-dot {{
            width: 8px;
            height: 8px;
            background-color: var(--accent-green);
            border-radius: 50%;
            animation: pulse 1.8s infinite;
        }}
        @keyframes pulse {{
            0% {{ transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }}
            70% {{ transform: scale(1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }}
            100% {{ transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }}
        }}
        .kpi-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }}
        .kpi-card {{
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 18px;
            transition: all 0.2s ease;
        }}
        .kpi-card:hover {{
            transform: translateY(-2px);
            border-color: var(--accent-cyan);
        }}
        .kpi-title {{
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: var(--text-muted);
        }}
        .kpi-value {{
            font-size: 26px;
            font-weight: 700;
            color: var(--text-main);
            margin: 6px 0;
        }}
        .kpi-sub {{
            font-size: 11px;
            color: var(--accent-gold);
        }}
        .tabs {{
            display: flex;
            gap: 8px;
            border-bottom: 2px solid var(--border-color);
            margin-bottom: 20px;
        }}
        .tab-btn {{
            background: none;
            border: none;
            color: var(--text-muted);
            padding: 10px 18px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            border-bottom: 3px solid transparent;
            transition: all 0.2s;
        }}
        .tab-btn:hover {{
            color: var(--text-main);
        }}
        .tab-btn.active {{
            color: var(--accent-cyan);
            border-bottom-color: var(--accent-cyan);
        }}
        .tab-content {{
            display: none;
        }}
        .tab-content.active {{
            display: block;
        }}
        .action-bar {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            margin-bottom: 16px;
        }}
        .search-box {{
            flex: 1;
            min-width: 280px;
            position: relative;
        }}
        .search-input {{
            width: 100%;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 10px 14px;
            color: var(--text-main);
            font-size: 13px;
            outline: none;
            transition: border 0.2s;
        }}
        .search-input:focus {{
            border-color: var(--accent-cyan);
        }}
        .btn {{
            background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 10px 18px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: opacity 0.2s;
        }}
        .btn:hover {{
            opacity: 0.9;
        }}
        .btn-gold {{
            background: linear-gradient(135deg, #B45309 0%, #D4AF37 100%);
            color: #0A192F;
            font-weight: 700;
        }}
        .table-container {{
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            overflow-x: auto;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            text-align: left;
        }}
        th {{
            background: #0F172A;
            padding: 12px 16px;
            color: var(--text-muted);
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid var(--border-color);
        }}
        td {{
            padding: 12px 16px;
            border-bottom: 1px solid #1E293B;
        }}
        tr:hover td {{
            background: rgba(255, 255, 255, 0.02);
        }}
        .badge {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }}
        .badge-gold {{ background: rgba(212, 175, 55, 0.2); color: #F59E0B; border: 1px solid rgba(212, 175, 55, 0.4); }}
        .badge-blue {{ background: rgba(56, 189, 248, 0.15); color: #38BDF8; }}
        .badge-green {{ background: rgba(16, 185, 129, 0.15); color: #10B981; }}
        .badge-orange {{ background: rgba(249, 115, 22, 0.15); color: #F97316; }}
        .badge-red {{ background: rgba(239, 68, 68, 0.15); color: #EF4444; }}
        .city-pill {{
            background: #1E293B;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            color: #CBD5E1;
        }}
        code {{
            background: #0F172A;
            color: #38BDF8;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
        }}
        .guide-box {{
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 16px;
        }}
        .guide-box h3 {{
            color: var(--accent-gold);
            font-size: 16px;
            margin-bottom: 8px;
        }}
        .guide-box pre {{
            background: #0F172A;
            padding: 12px;
            border-radius: 8px;
            color: #38BDF8;
            font-family: monospace;
            font-size: 12px;
            overflow-x: auto;
            margin: 8px 0;
        }}
    </style>
</head>
<body>

    <div class="header">
        <div class="header-title">
            <h1>🏛️ ALBAYRAK TASARRUF FİNANSMAN A.Ş.</h1>
            <p>Merkezi PDKS Test & Entegrasyon Sunucusu v2.4 — 30 Metre Geofence & Canlı Web Senkronizasyonu</p>
        </div>
        <div style="display:flex; align-items:center; gap:12px;">
            <div class="status-pill">
                <span class="pulse-dot"></span>
                <span>SUNUCU AKTİF (PORT {PORT})</span>
            </div>
            <button class="btn btn-gold" onclick="triggerScrape()">🌐 Webden Şubeleri Güncelle</button>
        </div>
    </div>

    <div class="kpi-grid">
        <div class="kpi-card">
            <div class="kpi-title">Toplam Şube Sayısı</div>
            <div class="kpi-value" id="kpi-branches">{branch_count}</div>
            <div class="kpi-sub">Genel Merkez + 49 Şube (Tüm Türkiye)</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Geofence Yarıçapı</div>
            <div class="kpi-value" style="color:var(--accent-green);">30 Metre</div>
            <div class="kpi-sub">30m İçi Geçerli / Dışı Güvenlik Alarmı</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Genel Merkez Konumu</div>
            <div class="kpi-value" style="font-size:16px; margin: 12px 0;">Ataşehir Yenişehir</div>
            <div class="kpi-sub">Kızılcık Sok. Albayrak Plaza No:1/35</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-title">Son Web Senkronizasyonu</div>
            <div class="kpi-value" style="font-size:16px; margin: 12px 0;" id="kpi-time">{scrape_time}</div>
            <div class="kpi-sub">Her Gece 01:00'de Otomatik Web Scraper</div>
        </div>
    </div>

    <div class="tabs">
        <button class="tab-btn active" onclick="switchTab('branches')">🏢 50 Aktif Şube ({branch_count})</button>
        <button class="tab-btn" onclick="switchTab('records')">📋 PDKS Hareketleri ({len(records)})</button>
        <button class="tab-btn" onclick="switchTab('alerts')">🚨 Güvenlik Alarmları ({len(alerts)})</button>
        <button class="tab-btn" onclick="switchTab('guide')">⚙️ Ağ & Mobil Entegrasyon Kılavuzu</button>
    </div>

    <!-- TAB 1: SUBELER -->
    <div id="tab-branches" class="tab-content active">
        <div class="action-bar">
            <div class="search-box">
                <input type="text" id="branchSearch" class="search-input" placeholder="🔍 Şube adı, il veya kod ara (Örn: Ataşehir, Erzurum, Van, ŞB-015)..." onkeyup="filterBranches()">
            </div>
            <div style="font-size:12px; color:var(--text-muted);">
                Görüntülenen: <strong id="visible-count">{branch_count}</strong> / {branch_count} Şube
            </div>
        </div>

        <div class="table-container">
            <table id="branchesTable">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Kod</th>
                        <th>Şube Adı</th>
                        <th>İl</th>
                        <th>Adres</th>
                        <th>Koordinatlar</th>
                        <th>Geofence</th>
                        <th>Wi-Fi SSID</th>
                        <th>Telefon</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(branch_rows)}
                </tbody>
            </table>
        </div>
    </div>

    <!-- TAB 2: PDKS KAYITLARI -->
    <div id="tab-records" class="tab-content">
        <div class="action-bar">
            <p style="font-size:13px; color:var(--text-muted);">Mobil cihazlardan <code>POST /api/v1/attendance/sync</code> ile iletilen son hareketler:</p>
            <button class="btn" onclick="location.reload()">🔄 Yenile</button>
        </div>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Saat</th>
                        <th>Personel</th>
                        <th>Şube</th>
                        <th>Hareket</th>
                        <th>Mesafe</th>
                        <th>Cihaz</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(record_rows) if record_rows else '<tr><td colspan="6" style="text-align:center; padding:24px; color:#94A3B8;">Henüz mobil hareket senkronize edilmedi.</td></tr>'}
                </tbody>
            </table>
        </div>
    </div>

    <!-- TAB 3: ALARMLAR -->
    <div id="tab-alerts" class="tab-content">
        <div class="action-bar">
            <p style="font-size:13px; color:var(--text-muted);">30 metre sınırını aşan veya yetkisiz cihaz girişimleri (IT/BT güvenlik logları):</p>
        </div>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Saat</th>
                        <th>Alarm Tipi</th>
                        <th>Personel</th>
                        <th>Şube</th>
                        <th>Tespit Edilen Mesafe</th>
                        <th>Önem</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(alert_rows) if alert_rows else '<tr><td colspan="6" style="text-align:center; padding:24px; color:#10B981;">Harika! Aktif güvenlik ihlali bulunmuyor.</td></tr>'}
                </tbody>
            </table>
        </div>
    </div>

    <!-- TAB 4: ENTEGRASYON REHBERI -->
    <div id="tab-guide" class="tab-content">
        <div class="guide-box">
            <h3>📱 Mobil Uygulama & Emülatör Bağlantı Adresleri</h3>
            <p style="font-size:13px; color:var(--text-muted); margin-bottom:8px;">
                Android uygulamasının sunucuya erişimi için tanımlanmış adresler:
            </p>
            <ul style="margin-left:20px; font-size:13px; color:var(--text-main); line-height:1.8;">
                <li><strong>PC Web Tarayıcısı:</strong> <code>http://localhost:8080/</code> veya <code>http://127.0.0.1:8080/</code></li>
                <li><strong>Android Emülatörü (Varsayılan):</strong> <code>http://10.0.2.2:8080/</code> (Android sisteminin ana bilgisayarı görme IP'si)</li>
                <li><strong>ADB Port Forwarding (Alternatif):</strong> <code>adb reverse tcp:8080 tcp:8080</code> çalıştırıldığında emülatör içinde de <code>http://localhost:8080/</code> geçerli olur.</li>
                <li><strong>Yerel Ağ / Fiziksel Telefon (Wi-Fi):</strong> <code>http://192.168.1.6:8080/</code></li>
            </ul>
        </div>

        <div class="guide-box">
            <h3>🔌 Kurumsal REST API Endpoint'leri</h3>
            <pre>
GET  /health                  -> Sunucu sağlık durumu (JSON)
GET  /api/v1/branches         -> 50 Şubenin güncel listesi, koordinatları ve 30m geofence (JSON)
POST /api/v1/branches/refresh -> https://albayrakfinans.com.tr/subelerimiz üzerinden canlı web scraping
POST /api/v1/auth/login       -> JWT kimlik doğrulama simülasyonu
POST /api/v1/attendance/sync  -> Mobil cihazdaki devam kayıtları ve alarmların toplu aktarımı
POST /api/v1/attendance/record-> Tekil anlık giriş/çıkış bildirimi
            </pre>
        </div>
    </div>

    <script>
        function switchTab(tabId) {{
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById('tab-' + tabId).classList.add('active');
        }}

        function filterBranches() {{
            const input = document.getElementById("branchSearch").value.toLowerCase();
            const rows = document.querySelectorAll("#branchesTable tbody tr");
            let visible = 0;
            rows.forEach(r => {{
                const text = r.innerText.toLowerCase();
                if (text.includes(input)) {{
                    r.style.display = "";
                    visible++;
                }} else {{
                    r.style.display = "none";
                }}
            }});
            document.getElementById("visible-count").innerText = visible;
        }}

        function triggerScrape() {{
            const btn = event.target;
            btn.disabled = true;
            btn.innerText = "⏳ Webden Çekiliyor...";
            fetch('/api/v1/branches/refresh', {{ method: 'POST' }})
                .then(r => r.json())
                .then(data => {{
                    alert("✓ " + data.message + "\\nToplam: " + data.branch_count + " şube.");
                    location.reload();
                }})
                .catch(err => {{
                    alert("Scraper hatası: " + err);
                    btn.disabled = false;
                    btn.innerText = "🌐 Webden Şubeleri Güncelle";
                }});
        }}
    </script>
</body>
</html>
"""
    return html

class PdksMockHandler(BaseHTTPRequestHandler):

    def _set_headers(self, status=200, content_type="application/json; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def log_message(self, format, *args):
        pass

    def do_GET(self):
        now_str = datetime.now().strftime("%H:%M:%S")
        path = self.path.split("?")[0]

        # Web Dashboard veya Health Check
        if path in ["/", "/dashboard"]:
            accept = self.headers.get("Accept", "")
            if "application/json" in accept and "text/html" not in accept:
                self._set_headers(200, "application/json; charset=utf-8")
                res = {
                    "status": "UP",
                    "service": "Albayrak Tasarruf Finansman PDKS Yerel Test Sunucusu",
                    "port": PORT,
                    "timestamp": get_timestamp_ms(),
                    "branch_count": len(ACTIVE_BRANCHES),
                    "last_scrape_time": LAST_SCRAPE_TIME,
                    "geofence_rule": "30 metre"
                }
                self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))
            else:
                html = render_dashboard_html()
                self._set_headers(200, "text/html; charset=utf-8")
                self.wfile.write(html.encode("utf-8"))
            print(f"[{now_str}] [WEB-DASHBOARD] Kontrol paneli sunuldu -> 200 OK")
            return

        if path in ["/health", "/api/v1/health"]:
            self._set_headers(200, "application/json; charset=utf-8")
            res = {
                "status": "UP",
                "service": "Albayrak Tasarruf Finansman PDKS Yerel Test Sunucusu",
                "port": PORT,
                "timestamp": get_timestamp_ms(),
                "branch_count": len(ACTIVE_BRANCHES),
                "last_scrape_time": LAST_SCRAPE_TIME,
                "geofence_rule": "30 metre"
            }
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))
            print(f"[{now_str}] [HEALTH-CHECK] Sağlık kontrolü -> 200 OK")
            return

        if path == "/api/v1/branches":
            self._set_headers(200, "application/json; charset=utf-8")
            with BRANCHES_LOCK:
                branches = list(ACTIVE_BRANCHES)
            self.wfile.write(json.dumps(branches, ensure_ascii=False).encode("utf-8"))
            print(f"[{now_str}] [SUBELER] Güncel şube listesi teslim edildi ({len(branches)} şube, 30m Geofence, Ataşehir GM) -> 200 OK")
            return

        # Personel Raporu & Devam Kayıtları API'si (Sunucudan Canlı Rapor)
        if path == "/api/v1/attendance/records" or path.startswith("/api/v1/reports/employee/"):
            emp_id = 1
            if path.startswith("/api/v1/reports/employee/"):
                try:
                    emp_id = int(path.rstrip("/").split("/")[-1])
                except Exception:
                    emp_id = 1
            else:
                parsed_url = urllib.parse.urlparse(self.path)
                query_params = urllib.parse.parse_qs(parsed_url.query)
                emp_param = query_params.get("employee_id") or query_params.get("employeeId")
                if emp_param:
                    try:
                        emp_id = int(emp_param[0])
                    except Exception:
                        emp_id = 1

            records = generate_employee_attendance_records(emp_id)
            self._set_headers(200, "application/json; charset=utf-8")
            self.wfile.write(json.dumps(records, ensure_ascii=False).encode("utf-8"))
            print(f"[{now_str}] [SUNUCU-RAPOR] Personel ID={emp_id} için {len(records)} adet sunucu devam/rapor kaydı teslim edildi -> 200 OK")
            return

        if path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return

        self._set_headers(404, "application/json; charset=utf-8")
        self.wfile.write(json.dumps({"error": f"Endpoint bulunamadı: {path}"}, ensure_ascii=False).encode("utf-8"))
        print(f"[{now_str}] [GET 404] Tanımsız yol: {path}")

    def do_POST(self):
        now_str = datetime.now().strftime("%H:%M:%S")
        path = self.path.split("?")[0]

        content_length = int(self.headers.get("Content-Length", 0))
        body_bytes = self.rfile.read(content_length) if content_length > 0 else b"{}"

        try:
            body = json.loads(body_bytes.decode("utf-8"))
        except Exception:
            body = {}

        if path == "/api/v1/branches/refresh":
            success = scrape_albayrak_branches()
            self._set_headers(200 if success else 500, "application/json; charset=utf-8")
            res = {
                "success": success,
                "branch_count": len(ACTIVE_BRANCHES),
                "last_scrape_time": LAST_SCRAPE_TIME,
                "message": "Şubeler web sitesinden başarıyla güncellendi." if success else "Şubeler güncellenirken hata oluştu."
            }
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))
            return

        if path == "/api/v1/auth/login":
            emp_code = body.get("employee_code", "")
            dev_id = body.get("device_id", "emulator-device")
            print(f"[{now_str}] [GIRIS TALEBI] Sicil: '{emp_code}' | Cihaz: '{dev_id}'")

            res = {
                "token": f"atf-jwt-session-{int(time.time())}",
                "employee": {
                    "id": 1,
                    "employee_code": emp_code or "FN-1048",
                    "full_name": "Ahmet Yılmaz",
                    "department": "Tasarruf Danışmanlığı",
                    "title": "Kıdemli Tasarruf Danışmanı",
                    "branch_id": 1,
                    "role": "PERSONNEL"
                },
                "message": "Albayrak Finans sunucusuna başarıyla giriş yapıldı.",
                "success": True
            }
            self._set_headers(200, "application/json; charset=utf-8")
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))
            print(f"[{now_str}] [GIRIS ONAYI] JWT oturumu oluşturuldu -> 200 OK")
            return

        if path == "/api/v1/attendance/sync":
            records = body.get("records", [])
            alerts = body.get("alerts", [])
            dev_id = body.get("device_id", "bilinmeyen-cihaz")

            with RECORDS_LOCK:
                for r in records:
                    RECEIVED_RECORDS.insert(0, {
                        **r,
                        "received_at": datetime.now().strftime("%H:%M:%S")
                    })
                    if len(RECEIVED_RECORDS) > 100:
                        RECEIVED_RECORDS.pop()
                for a in alerts:
                    RECEIVED_ALERTS.insert(0, {
                        **a,
                        "received_at": datetime.now().strftime("%H:%M:%S")
                    })
                    if len(RECEIVED_ALERTS) > 100:
                        RECEIVED_ALERTS.pop()

            print(f"[{now_str}] [SENKRONIZASYON] Cihaz: {dev_id} | Gelen Devam: {len(records)} adet | Alarmlar: {len(alerts)} adet")

            res = {
                "synced_count": len(records),
                "server_timestamp": get_timestamp_ms(),
                "status": "SUCCESS",
                "message": f"Albayrak Finans Merkezi Sunucusu: {len(records)} adet devam kaydı ve {len(alerts)} adet güvenlik alarmı başarıyla veritabanına işlendi."
            }
            self._set_headers(200, "application/json; charset=utf-8")
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))
            print(f"[{now_str}] [SENKRONIZASYON TAMAMLANDI] İstemciye başarı yanıtı dönüldü -> 200 OK")
            return

        if path == "/api/v1/attendance/record":
            emp_id = body.get("employee_id")
            rec_type = body.get("record_type")
            dist = body.get("distance_to_branch")
            print(f"[{now_str}] [ANLIK DEVAM] Personel={emp_id} | Tip={rec_type} | Mesafe={dist}m")

            with RECORDS_LOCK:
                RECEIVED_RECORDS.insert(0, {
                    "employee_id": emp_id,
                    "employee_name": f"Personel #{emp_id}",
                    "branch_name": "Albayrak Finans Şubesi",
                    "record_type": rec_type,
                    "distance_meters": dist or 0.0,
                    "device_model": "Mobil İstemci",
                    "received_at": datetime.now().strftime("%H:%M:%S")
                })
                if len(RECEIVED_RECORDS) > 100:
                    RECEIVED_RECORDS.pop()

            res = {
                "synced_count": 1,
                "server_timestamp": get_timestamp_ms(),
                "status": "SUCCESS",
                "message": "Giriş/çıkış anlık sunucu kaydı başarılı."
            }
            self._set_headers(200, "application/json; charset=utf-8")
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode("utf-8"))
            return

        self._set_headers(404, "application/json; charset=utf-8")
        self.wfile.write(json.dumps({"error": f"POST endpoint bulunamadı: {path}"}, ensure_ascii=False).encode("utf-8"))
        print(f"[{now_str}] [POST 404] Tanımsız yol: {path}")

class ThreadingSimpleServer(socketserver.ThreadingMixIn, HTTPServer):
    pass

def run():
    scheduler_thread = threading.Thread(target=branch_scheduler_worker, daemon=True)
    scheduler_thread.start()

    server = ThreadingSimpleServer((HOST, PORT), PdksMockHandler)
    print("=" * 65)
    print("  ALBAYRAK TASARRUF FİNANSMAN A.Ş. - PDKS TEST SUNUCUSU")
    print(f"  Web Dashboard: http://localhost:{PORT}/")
    print(f"  Android Emülatöründen Erişim: http://10.0.2.2:{PORT}/")
    print(f"  Fiziksel Cihaz (Wi-Fi): http://192.168.1.6:{PORT}/")
    print("  Özellikler:")
    print("   • Geofence Kuralı: 30 metre")
    print("   • Genel Merkez: Ataşehir Yenişehir Mah. Kızılcık Sok. No:1/35")
    print("   • Web Scraper: https://albayrakfinans.com.tr/subelerimiz")
    print("   • Zamanlanmış Görev: Her gece 01:00'de otomatik şube güncellemesi")
    print("=" * 65)
    print("Sunucu dinlemede. İstemci istekleri bekleniyor...\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nSunucu kapatılıyor...")
        server.server_close()

if __name__ == "__main__":
    run()
