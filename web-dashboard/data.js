/* ==========================================================================
   data.js · demo veri üretimi ve derin personel analiz motoru (deterministik).
   ========================================================================== */
(function (g) {
    'use strict';
    const A = g.ATF;
    const rnd = A.rng(20261020);

    const BRANCHES = [
        { code: 'HQ', name: 'Genel Merkez · Ataşehir', city: 'İstanbul', lat: 41.11185, lng: 29.02235, radius: 30, wifi: 'ALBAYRAK_CORP', w: 0.38 },
        { code: 'UMR', name: 'Ümraniye Şubesi', city: 'İstanbul', lat: 41.0165, lng: 29.1248, radius: 30, wifi: 'ALBAYRAK_UMR', w: 0.14 },
        { code: 'KAD', name: 'Kadıköy Şubesi', city: 'İstanbul', lat: 40.9903, lng: 29.0275, radius: 30, wifi: 'ALBAYRAK_KAD', w: 0.12 },
        { code: 'ANK', name: 'Ankara Kızılay Şubesi', city: 'Ankara', lat: 39.9208, lng: 32.8541, radius: 30, wifi: 'ALBAYRAK_ANK', w: 0.14 },
        { code: 'IZM', name: 'İzmir Konak Şubesi', city: 'İzmir', lat: 38.4189, lng: 27.1287, radius: 30, wifi: 'ALBAYRAK_IZM', w: 0.12 },
        { code: 'BUR', name: 'Bursa Nilüfer Şubesi', city: 'Bursa', lat: 40.2133, lng: 28.9807, radius: 30, wifi: 'ALBAYRAK_BUR', w: 0.10 }
    ];
    const DEPTS = ['Bireysel Finansman', 'Taşıt Finansmanı', 'Konut Finansmanı', 'Kurumsal Finansman', 'Şube Operasyon', 'Bilgi Teknolojileri', 'Mali İşler', 'İnsan Kaynakları', 'Hukuk ve Uyum'];
    const TITLES = ['Finans Uzmanı', 'Müşteri Temsilcisi', 'Operasyon Uzmanı', 'Takım Lideri', 'Uzman Yardımcısı', 'Şube Müdür Yrd.', 'Analist'];
    const FN = ['Ahmet', 'Mehmet', 'Mustafa', 'Ali', 'Hüseyin', 'Hasan', 'İbrahim', 'Ömer', 'Yusuf', 'Emre', 'Burak', 'Murat', 'Serkan', 'Hakan', 'Caner', 'Tolga', 'Onur', 'Kerem', 'Barış', 'Eren', 'Berk', 'Kaan', 'Arda', 'Alper', 'Cem', 'Deniz', 'Ayşe', 'Fatma', 'Emine', 'Hatice', 'Zeynep', 'Elif', 'Meryem', 'Zehra', 'Merve', 'Büşra', 'Esra', 'Gamze', 'Seda', 'Gizem', 'Tuğba', 'Kübra', 'Ebru', 'Betül', 'Yasemin', 'Duygu', 'Pelin', 'Damla', 'Selin', 'Ece', 'İrem', 'Başak', 'Melis', 'Ceren'];
    const LN = ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Yıldız', 'Yıldırım', 'Öztürk', 'Aydın', 'Özdemir', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özkan', 'Şimşek', 'Polat', 'Korkmaz', 'Çakır', 'Erdoğan', 'Yavuz', 'Güneş', 'Bozkurt', 'Ünal', 'Acar', 'Tekin'];
    const DOW_NAMES = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    const DOW_SHORT = ['', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

    const pick = (arr, r) => arr[Math.floor((r || rnd)() * arr.length)];
    const wpick = () => { let x = rnd(), a = 0; for (const b of BRANCHES) { a += b.w; if (x <= a) return b; } return BRANCHES[0]; };

    const hhmm = m => A.pad(Math.floor(m / 60)) + ':' + A.pad(Math.round(m % 60));
    const fmtDurMin = min => {
        const sign = min < 0 ? '-' : (min > 0 ? '+' : '');
        const abs = Math.abs(Math.round(min));
        const h = Math.floor(abs / 60);
        const m = abs % 60;
        if (h === 0) return `${sign}${m} dk`;
        if (m === 0) return `${sign}${h} sa`;
        return `${sign}${h} sa ${m} dk`;
    };

    /* ---- Son 60 iş günü (tarih + oranlar) ---- */
    const DAYS = [];
    (function () {
        const d = new Date(2026, 9, 20); // 20.10.2026 referans bugünü
        let guard = 0, out = [];
        while (out.length < 60 && guard++ < 140) {
            const w = d.getDay();
            if (w !== 0 && w !== 6) out.push(new Date(d));
            d.setDate(d.getDate() - 1);
        }
        out.reverse().forEach((dt, i) => {
            const dow = dt.getDay();
            const yyyy = dt.getFullYear();
            const mm = A.pad(dt.getMonth() + 1);
            const dd = A.pad(dt.getDate());
            const iso = `${yyyy}-${mm}-${dd}`;
            const label = `${dd}.${mm}`;
            const fullDate = `${dd}.${mm}.${yyyy}`;
            const r = A.rng(yyyy * 400 + (dt.getMonth() + 1) * 40 + dt.getDate());
            const base = 0.925 + 0.012 * Math.sin(i / 4) - (dow === 1 ? 0.03 : dow === 5 ? 0.018 : 0) + (r() - .5) * 0.02;
            const late = A.clamp(1 - base - 0.045 - 0.012, 0.015, 0.14), absent = 0.014 + r() * 0.014, leave = 0.028 + r() * 0.02;
            DAYS.push({
                idx: i,
                iso,
                label,
                fullDate,
                dow,
                dowName: DOW_NAMES[dow],
                dowShort: DOW_SHORT[dow],
                onTime: 1 - late - absent - leave,
                late,
                absent,
                leave,
                lateMin: 14 + r() * 12,
                overtimeH: 28 + r() * 40 + (dow === 5 ? -10 : 0),
                workH: 8.1 + r() * 0.6
            });
        });
    })();

    /* ---- Personel (500 kişi + kişisel çalışma profili) ---- */
    const EMPLOYEES = [];
    for (let i = 0; i < 500; i++) {
        const br = wpick(), r = rnd();
        let status = 'PRESENT', inMin = null, late = 0, outMin = null, otMin = 0;
        if (r < 0.068) {
            status = 'LATE';
            inMin = 9 * 60 + 4 + Math.floor(rnd() * 52);
            late = inMin - 9 * 60;
            outMin = 17 * 60 + 30 + Math.floor(rnd() * 45);
            otMin = Math.max(0, outMin - 18 * 60);
        } else if (r < 0.10) {
            status = 'LEAVE';
        } else if (r < 0.122) {
            status = 'ABSENT';
        } else {
            inMin = 8 * 60 + 5 + Math.floor((rnd() + rnd()) / 2 * 52);
            outMin = 17 * 60 + 30 + Math.floor(rnd() * 115);
            otMin = Math.max(0, outMin - 18 * 60);
        }
        const name = FN[(i * 7 + Math.floor(rnd() * 5)) % FN.length] + ' ' + LN[(i * 11 + 3) % LN.length];
        // Her personelin karakteristik "en çok geç kaldığı gün" ve "en çok mesai yaptığı gün" eğilimi
        const proneLateDow = 1 + ((i * 3) % 5); // 1=Pzt..5=Cum
        const proneOtDow = 1 + ((i * 2 + 2) % 5);
        const workHabitBias = ((i * 17) % 100) / 100; // >0.55 yüksek mesai eğilimli, <0.22 geç kalma eğilimli

        EMPLOYEES.push({
            id: 1001 + i,
            sicil: 'FN-' + (1001 + i),
            name,
            dept: DEPTS[i % DEPTS.length],
            title: pick(TITLES),
            branch: br.code,
            status,
            inMin,
            outMin,
            checkIn: inMin == null ? null : hhmm(inMin),
            checkOut: outMin == null ? null : hhmm(outMin),
            lateMin: late,
            overtimeMin: otMin,
            dist: status === 'PRESENT' || status === 'LATE' ? +(2 + rnd() * 24).toFixed(1) : null,
            tone: 1 + (i % 5),
            proneLateDow,
            proneOtDow,
            workHabitBias
        });
    }

    /* ---- Tarih Aralığı Çözümleyici ---- */
    function resolveDays(opts) {
        const o = opts || {};
        if (o.fromDate || o.toDate) {
            const from = o.fromDate || DAYS[0].iso;
            const to = o.toDate || DAYS[DAYS.length - 1].iso;
            const filtered = DAYS.filter(d => d.iso >= from && d.iso <= to);
            if (filtered.length > 0) return filtered;
        }
        const n = Math.max(1, Math.min(DAYS.length, +(o.range || 30)));
        return DAYS.slice(-n);
    }

    /* ---- Kişi Bazlı Derin Analiz Motoru (Seçili Süre / Tarih Aralığına Göre) ---- */
    const analyticsCache = new Map();

    function empAnalytics(empId, opts) {
        const e = EMPLOYEES.find(x => x.id === empId) || EMPLOYEES[0];
        const selDays = resolveDays(opts);
        const cacheKey = `${e.id}_${selDays[0].iso}_${selDays[selDays.length - 1].iso}_${e.status}_${e.lateMin}`;
        if (analyticsCache.has(cacheKey)) return analyticsCache.get(cacheKey);

        const logs = [];
        const byDow = {
            1: { dow: 1, name: 'Pazartesi', short: 'Pzt', lateMin: 0, lateCount: 0, otMin: 0, otCount: 0, workMin: 0, days: 0, inSum: 0, outSum: 0 },
            2: { dow: 2, name: 'Salı', short: 'Sal', lateMin: 0, lateCount: 0, otMin: 0, otCount: 0, workMin: 0, days: 0, inSum: 0, outSum: 0 },
            3: { dow: 3, name: 'Çarşamba', short: 'Çar', lateMin: 0, lateCount: 0, otMin: 0, otCount: 0, workMin: 0, days: 0, inSum: 0, outSum: 0 },
            4: { dow: 4, name: 'Perşembe', short: 'Per', lateMin: 0, lateCount: 0, otMin: 0, otCount: 0, workMin: 0, days: 0, inSum: 0, outSum: 0 },
            5: { dow: 5, name: 'Cuma', short: 'Cum', lateMin: 0, lateCount: 0, otMin: 0, otCount: 0, workMin: 0, days: 0, inSum: 0, outSum: 0 }
        };

        let totalLateMin = 0, lateDaysCount = 0;
        let totalOvertimeMin = 0, otDaysCount = 0;
        let presentDays = 0, leaveDays = 0, absentDays = 0;
        let totalWorkMin = 0;
        let inMinSum = 0, outMinSum = 0, activeDays = 0;
        let earliestIn = 9999, latestIn = 0, latestOut = 0;
        let distSum = 0, maxDist = 0, geofenceOk = 0;
        let peakLateRec = null, peakOtRec = null;

        selDays.forEach((day, idx) => {
            const isToday = day.iso === DAYS[DAYS.length - 1].iso;
            const r = A.rng(e.id * 997 + day.idx * 31);
            let st = 'PRESENT', inM = 8 * 60 + 25, outM = 17 * 60 + 35, lMin = 0, oMin = 0, dist = +(3.2 + r() * 18).toFixed(1);

            if (isToday) {
                st = e.status;
                if (st === 'PRESENT' || st === 'LATE') {
                    inM = e.inMin || (8 * 60 + 26);
                    lMin = e.lateMin || 0;
                    // Bugünün ek mesaisi veya beklenen çıkış saati
                    const otChance = r() + (day.dow === e.proneOtDow ? 0.35 : 0) + (e.workHabitBias > 0.55 ? 0.28 : 0);
                    if (otChance > 0.68) {
                        oMin = 20 + Math.floor(r() * 85) + (e.workHabitBias > 0.7 ? 25 : 0);
                        outM = 18 * 60 + oMin;
                    } else {
                        oMin = e.overtimeMin || 0;
                        outM = 17 * 60 + 32 + Math.floor(r() * 24) + oMin;
                    }
                    dist = e.dist != null ? e.dist : dist;
                }
            } else {
                const roll = r();
                const lateThreshold = 0.08 + (day.dow === e.proneLateDow ? 0.16 : 0) + (e.workHabitBias < 0.25 ? 0.14 : 0);
                if (roll < 0.025) {
                    st = 'LEAVE';
                } else if (roll < 0.036 && e.workHabitBias < 0.3) {
                    st = 'ABSENT';
                } else if (roll < 0.036 + lateThreshold) {
                    st = 'LATE';
                    lMin = 6 + Math.floor(r() * 38) + (day.dow === e.proneLateDow ? 11 : 0) + (e.workHabitBias < 0.2 ? 14 : 0);
                    inM = 9 * 60 + lMin;
                } else {
                    st = 'PRESENT';
                    inM = 8 * 60 + 6 + Math.floor(r() * 48);
                }

                if (st === 'PRESENT' || st === 'LATE') {
                    const otRoll = r() + (day.dow === e.proneOtDow ? 0.32 : 0) + (e.workHabitBias > 0.5 ? 0.25 : -0.1);
                    if (otRoll > 0.62) {
                        oMin = 18 + Math.floor(r() * 78) + (day.dow === e.proneOtDow ? 22 : 0) + (e.workHabitBias > 0.75 ? 30 : 0);
                        outM = 18 * 60 + oMin;
                    } else {
                        oMin = 0;
                        outM = 17 * 60 + 30 + Math.floor(r() * 25);
                    }
                }
            }

            if (st === 'LEAVE') {
                leaveDays++;
                logs.push({
                    iso: day.iso, label: day.label, fullDate: day.fullDate, dow: day.dow, dowName: day.dowName, dowShort: day.dowShort,
                    status: st, checkIn: '—', checkOut: '—', lateMin: 0, overtimeMin: 0, netMin: 0, workMin: 0, workH: 0, dist: null
                });
            } else if (st === 'ABSENT') {
                absentDays++;
                logs.push({
                    iso: day.iso, label: day.label, fullDate: day.fullDate, dow: day.dow, dowName: day.dowName, dowShort: day.dowShort,
                    status: st, checkIn: '—', checkOut: '—', lateMin: 0, overtimeMin: 0, netMin: 0, workMin: 0, workH: 0, dist: null
                });
            } else {
                activeDays++;
                if (st === 'PRESENT') presentDays++; else lateDaysCount++;
                const wMin = Math.max(240, outM - inM - 60); // 1 saat öğle arası
                const netM = oMin - lMin;

                totalLateMin += lMin;
                if (oMin > 0) {
                    totalOvertimeMin += oMin;
                    otDaysCount++;
                }
                totalWorkMin += wMin;
                inMinSum += inM;
                outMinSum += outM;
                if (inM < earliestIn) earliestIn = inM;
                if (inM > latestIn) latestIn = inM;
                if (outM > latestOut) latestOut = outM;
                distSum += dist;
                if (dist > maxDist) maxDist = dist;
                if (dist <= 30) geofenceOk++;

                const dBucket = byDow[day.dow];
                if (dBucket) {
                    dBucket.days++;
                    dBucket.lateMin += lMin;
                    if (lMin > 0) dBucket.lateCount++;
                    dBucket.otMin += oMin;
                    if (oMin > 0) dBucket.otCount++;
                    dBucket.workMin += wMin;
                    dBucket.inSum += inM;
                    dBucket.outSum += outM;
                }

                const rec = {
                    iso: day.iso,
                    label: day.label,
                    fullDate: day.fullDate,
                    dow: day.dow,
                    dowName: day.dowName,
                    dowShort: day.dowShort,
                    status: st,
                    checkIn: hhmm(inM),
                    checkOut: hhmm(outM),
                    lateMin: lMin,
                    overtimeMin: oMin,
                    netMin: netM,
                    workMin: wMin,
                    workH: +(wMin / 60).toFixed(1),
                    dist
                };
                if (!peakLateRec || lMin > peakLateRec.lateMin) peakLateRec = rec;
                if (!peakOtRec || oMin > peakOtRec.overtimeMin) peakOtRec = rec;
                logs.push(rec);
            }
        });

        const weekdayList = [1, 2, 3, 4, 5].map(d => {
            const b = byDow[d];
            const cnt = b.days || 1;
            return {
                dow: d,
                name: b.name,
                dowName: b.name,
                short: b.short,
                dowShort: b.short,
                days: b.days,
                attended: b.days,
                lateMin: b.lateMin,
                totalLateMin: b.lateMin,
                lateCount: b.lateCount,
                avgLateMin: b.lateCount ? Math.round(b.lateMin / b.lateCount) : 0,
                otMin: b.otMin,
                totalOvertimeMin: b.otMin,
                otCount: b.otCount,
                avgOtMin: b.otCount ? Math.round(b.otMin / b.otCount) : 0,
                avgOvertimeMin: b.otCount ? Math.round(b.otMin / b.otCount) : 0,
                netMin: b.otMin - b.lateMin,
                avgIn: b.days ? hhmm(Math.round(b.inSum / cnt)) : '08:25',
                avgOut: b.days ? hhmm(Math.round(b.outSum / cnt)) : '17:35',
                avgWorkH: b.days ? +(b.workMin / cnt / 60).toFixed(1) : 8.5
            };
        });

        const mostLateDay = [...weekdayList].sort((a, b) => (b.lateMin - a.lateMin) || (b.lateCount - a.lateCount))[0];
        const mostOvertimeDay = [...weekdayList].sort((a, b) => (b.otMin - a.otMin) || (b.otCount - a.otCount))[0];
        const bestNetDay = [...weekdayList].sort((a, b) => b.netMin - a.netMin)[0];

        const netBalanceMin = totalOvertimeMin - totalLateMin;
        const onTimePct = activeDays > 0 ? +(presentDays / activeDays * 100).toFixed(1) : 95.0;

        const res = {
            empId: e.id,
            emp: e,
            periodLabel: `${selDays[0].fullDate} – ${selDays[selDays.length - 1].fullDate}`,
            totalDays: selDays.length,
            activeDays,
            attendedDays: activeDays,
            presentDays,
            lateDaysCount,
            lateDays: lateDaysCount,
            otDaysCount,
            overtimeDays: otDaysCount,
            leaveDays,
            absentDays,
            onTimePct,
            totalLateMin,
            totalLateFmt: fmtDurMin(-totalLateMin),
            totalOvertimeMin,
            totalOvertimeFmt: fmtDurMin(totalOvertimeMin),
            netBalanceMin,
            netBalanceFmt: fmtDurMin(netBalanceMin),
            avgWorkH: activeDays ? +(totalWorkMin / activeDays / 60).toFixed(1) : 8.5,
            totalWorkH: +(totalWorkMin / 60).toFixed(1),
            avgCheckIn: activeDays ? hhmm(Math.round(inMinSum / activeDays)) : '08:26',
            avgCheckOut: activeDays ? hhmm(Math.round(outMinSum / activeDays)) : '17:42',
            earliestCheckIn: earliestIn < 9999 ? hhmm(earliestIn) : '08:05',
            latestCheckIn: latestIn > 0 ? hhmm(latestIn) : '08:55',
            latestCheckOut: latestOut > 0 ? hhmm(latestOut) : '18:30',
            avgDist: activeDays ? +(distSum / activeDays).toFixed(1) : 5.4,
            maxDist: maxDist > 0 ? maxDist : 14.2,
            geofenceRate: activeDays ? +(geofenceOk / activeDays * 100).toFixed(1) : 100,
            mostLateDay,
            mostOvertimeDay,
            bestNetDay,
            peakLateRec,
            peakOtRec,
            weekdayList,
            logs
        };

        if (analyticsCache.size >= 2500) {
            const oldestKey = analyticsCache.keys().next().value;
            if (oldestKey !== undefined) analyticsCache.delete(oldestKey);
        }
        analyticsCache.set(cacheKey, res);
        return res;
    }

    /* ---- Tüm Personeller İçin Sıralama / Lig Hesaplayıcı (Memoized) ---- */
    const leaderboardCache = new Map();

    function computeLeaderboards(empList, opts) {
        const src = empList || EMPLOYEES;
        const selDays = resolveDays(opts);
        const firstId = src.length ? src[0].id : 0;
        const lastId = src.length ? src[src.length - 1].id : 0;
        const lbKey = `${src.length}_${firstId}_${lastId}_${selDays[0].iso}_${selDays[selDays.length - 1].iso}_${EMPLOYEES.length}`;
        if (leaderboardCache.has(lbKey)) return leaderboardCache.get(lbKey);

        const list = src.map(e => empAnalytics(e.id, opts));
        const topOvertime = [...list].sort((a, b) => (b.totalOvertimeMin - a.totalOvertimeMin) || (b.otDaysCount - a.otDaysCount));
        const bestNet = [...list].sort((a, b) => (b.netBalanceMin - a.netBalanceMin) || (b.onTimePct - a.onTimePct));
        const worstNet = [...list].sort((a, b) => (a.netBalanceMin - b.netBalanceMin) || (b.totalLateMin - a.totalLateMin));
        const mostLate = [...list].sort((a, b) => (b.totalLateMin - a.totalLateMin) || (b.lateDaysCount - a.lateDaysCount));
        const out = { all: list, topOvertime, bestNet, worstNet, mostLate };

        if (leaderboardCache.size >= 60) {
            const oldestKey = leaderboardCache.keys().next().value;
            if (oldestKey !== undefined) leaderboardCache.delete(oldestKey);
        }
        leaderboardCache.set(lbKey, out);
        return out;
    }

    /* ---- İzin / mazeret talepleri ---- */
    const LEAVE_TYPES = ['Yıllık izin', 'Mazeret izni', 'Saha görevi', 'Sağlık raporu'];
    const LEAVES = [];
    (function () {
        const r = A.rng(77), st = ['pending', 'pending', 'pending', 'pending', 'pending', 'pending', 'approved', 'approved', 'approved', 'approved', 'approved', 'approved', 'approved', 'approved', 'rejected', 'rejected', 'rejected', 'rejected'];
        const reasons = ['Ailevi nedenlerle', 'Hastane randevusu', 'Müşteri ziyareti (saha)', 'Tapu işlemleri', 'Çocuğun okul toplantısı', 'Dinlenme izni', 'Doktor raporu ekte', 'Eğitim programı'];
        st.forEach((s, i) => {
            const e = EMPLOYEES[Math.floor(r() * 60) + 3], t = LEAVE_TYPES[Math.floor(r() * 4)], days = t === 'Yıllık izin' ? 2 + Math.floor(r() * 5) : t === 'Sağlık raporu' ? 1 + Math.floor(r() * 3) : 1;
            const d = new Date(2026, 9, 20); d.setDate(d.getDate() + Math.floor(r() * 9) - 2);
            LEAVES.push({ id: i + 1, empId: e.id, type: t, days, from: A.pad(d.getDate()) + '.' + A.pad(d.getMonth() + 1) + '.' + d.getFullYear(), reason: reasons[Math.floor(r() * reasons.length)], status: s, ago: (1 + Math.floor(r() * 46)) + ' sa önce' });
        });
    })();

    /* ---- BT: uyarılar, destek talepleri, cihazlar, denetim ---- */
    const ALERT_TYPES = { MOCK_GPS: 'Sahte konum', GEOFENCE: '30 m dışı deneme', DEVICE: 'Farklı cihaz', ROOT: 'Root/Jailbreak', BRUTE: 'Çoklu hatalı parola' };
    const ALERTS = [];
    (function () {
        const r = A.rng(31), kinds = ['MOCK_GPS', 'GEOFENCE', 'DEVICE', 'GEOFENCE', 'BRUTE', 'ROOT', 'GEOFENCE', 'MOCK_GPS', 'DEVICE', 'GEOFENCE', 'BRUTE', 'GEOFENCE', 'DEVICE', 'ROOT'];
        const sev = { MOCK_GPS: 'HIGH', ROOT: 'HIGH', BRUTE: 'MED', DEVICE: 'MED', GEOFENCE: 'LOW' };
        kinds.forEach((k, i) => {
            const e = EMPLOYEES[Math.floor(r() * 120) + 10];
            ALERTS.push({ id: i + 1, type: k, sev: sev[k], empId: e.id, branch: e.branch, ago: (i + 1) * 17 + 'dk', resolved: i > 9, dist: k === 'GEOFENCE' ? Math.round(34 + r() * 260) : null });
        });
    })();

    const TICKET_TYPES = { FORGOT: 'Parolamı unuttum', LOCKED: 'Hesap kilitli', DEVICE: 'Cihaz değişikliği', ERROR: 'Uygulama hatası' };
    const TICKETS = [];
    (function () {
        const r = A.rng(5), kinds = ['FORGOT', 'LOCKED', 'FORGOT', 'DEVICE', 'ERROR', 'FORGOT', 'LOCKED', 'DEVICE', 'FORGOT', 'ERROR', 'FORGOT', 'LOCKED'];
        const notes = { FORGOT: 'Parolamı hatırlamıyorum, giriş yapamıyorum.', LOCKED: '5 hatalı denemeden sonra hesap kilitlendi.', DEVICE: 'Telefonumu yeniledim, yeni cihazı eşlemek istiyorum.', ERROR: 'Giriş butonuna basınca konum alınamıyor hatası çıkıyor.' };
        kinds.forEach((k, i) => {
            const e = EMPLOYEES[Math.floor(r() * 200) + 20];
            TICKETS.push({ id: 'TK-' + (2041 + i), type: k, empId: e.id, note: notes[k], status: i < 6 ? 'open' : i < 8 ? 'progress' : 'done', ago: (i * 23 + 6) + 'dk' });
        });
    })();

    const MODELS = ['Samsung Galaxy S24', 'Samsung Galaxy A55', 'Xiaomi Redmi Note 13', 'Google Pixel 8', 'Oppo Reno 11', 'Honor 200', 'Samsung Galaxy S23'];
    const DEVICES = [];
    (function () {
        const r = A.rng(900);
        for (let i = 0; i < 90; i++) {
            const e = EMPLOYEES[i * 5 + 2], v = r() < 0.78 ? '2.4.1' : r() < 0.7 ? '2.3.8' : '2.2.0', s = r();
            DEVICES.push({ id: 'DV-' + (7000 + i), empId: e.id, model: MODELS[Math.floor(r() * MODELS.length)], os: 'Android ' + (12 + Math.floor(r() * 3)), ver: v, seen: Math.floor(r() * 50) + 1, status: s < 0.88 ? 'BOUND' : s < 0.96 ? 'PENDING' : 'BLOCKED', mask: 'a' + Math.floor(r() * 9) + 'f…' + Math.floor(r() * 90 + 10) });
        }
    })();

    const AUDIT = [
        { t: '09:12', who: 'Murat Doğan', act: 'Geçici parola oluşturuldu', target: 'FN-1043', cat: 'ACCOUNT' },
        { t: '09:05', who: 'Murat Doğan', act: 'Cihaz eşlemesi sıfırlandı', target: 'DV-7012', cat: 'DEVICE' },
        { t: '08:41', who: 'Sistem', act: 'Sahte konum uyarısı üretildi', target: 'FN-1108', cat: 'SECURITY' },
        { t: '08:30', who: 'Zehra Yılmaz', act: 'İzin talebi onaylandı', target: 'LV-4', cat: 'HR' },
        { t: '08:02', who: 'Sistem', act: 'Gece yedeği tamamlandı', target: 'DB', cat: 'SYSTEM' },
        { t: 'Dün', who: 'Murat Doğan', act: 'Yeni şube geofence tanımlandı', target: 'BUR', cat: 'SYSTEM' }
    ];

    // Yeni işe başlayan, düzenlenen veya silinen personelleri localStorage üzerinden geri yükle
    function persistLocalState() {
        try {
            const custom = EMPLOYEES.filter(x => x.isNewHire);
            localStorage.setItem('atf_custom_employees', JSON.stringify(custom));
        } catch (_) {}
    }

    try {
        const deletedIds = JSON.parse(localStorage.getItem('atf_deleted_emp_ids') || '[]');
        if (Array.isArray(deletedIds) && deletedIds.length) {
            for (let i = EMPLOYEES.length - 1; i >= 0; i--) {
                if (deletedIds.includes(EMPLOYEES[i].id)) EMPLOYEES.splice(i, 1);
            }
        }
        const updatedMap = JSON.parse(localStorage.getItem('atf_updated_employees') || '{}');
        if (updatedMap && typeof updatedMap === 'object') {
            EMPLOYEES.forEach((e, idx) => {
                if (updatedMap[e.id]) {
                    EMPLOYEES[idx] = Object.assign({}, e, updatedMap[e.id]);
                }
            });
        }
        const savedEmps = JSON.parse(localStorage.getItem('atf_custom_employees') || '[]');
        if (Array.isArray(savedEmps)) {
            savedEmps.forEach(ce => {
                if (ce && ce.id && !EMPLOYEES.some(x => x.id === ce.id)) {
                    EMPLOYEES.unshift(ce);
                }
            });
        }
    } catch (_) {}

    function clearAnalyticsCache() {
        analyticsCache.clear();
        leaderboardCache.clear();
    }

    const API_BASE = '/api/v1/employees';

    function syncEmployeesFromBackend(onSync) {
        if (typeof fetch !== 'function' || (typeof location !== 'undefined' && location.protocol === 'file:')) return;
        fetch(API_BASE + '?size=2000', { headers: { 'Accept': 'application/json' } })
            .then(r => (r.ok ? r.json() : null))
            .then(data => {
                if (!data || !Array.isArray(data.items) || !data.items.length) return;
                EMPLOYEES.length = 0;
                data.items.forEach(item => {
                    EMPLOYEES.push(Object.assign({
                        id: item.id,
                        sicil: item.sicil,
                        name: item.name,
                        dept: item.dept,
                        title: item.title,
                        branch: item.branch || 'HQ',
                        status: item.status || 'PRESENT',
                        inMin: item.inMin != null ? item.inMin : null,
                        outMin: item.outMin != null ? item.outMin : null,
                        checkIn: item.checkIn || (item.inMin != null ? hhmm(item.inMin) : null),
                        checkOut: item.checkOut || (item.outMin != null ? hhmm(item.outMin) : null),
                        lateMin: item.lateMin || 0,
                        overtimeMin: item.overtimeMin || 0,
                        dist: item.dist != null ? item.dist : null,
                        tone: item.tone || (1 + (item.id % 5)),
                        proneLateDow: item.proneLateDow || 1,
                        proneOtDow: item.proneOtDow || 3,
                        workHabitBias: item.workHabitBias != null ? item.workHabitBias : 0.65,
                        email: item.email || '',
                        phone: item.phone || '',
                        startDate: item.startDate || '2026-10-20',
                        isNewHire: !!item.isNewHire
                    }));
                });
                clearAnalyticsCache();
                if (typeof onSync === 'function') onSync(EMPLOYEES);
            })
            .catch(() => {});
    }

    function addEmployee(o, onSync) {
        const maxId = EMPLOYEES.reduce((m, x) => Math.max(m, x.id), 1500);
        const nextId = maxId + 1;
        const sicil = 'FN-' + nextId;
        const status = o.status || 'PRESENT';
        const inMin = status === 'PRESENT' ? 505 : status === 'LATE' ? 552 : null;
        const outMin = status === 'PRESENT' || status === 'LATE' ? 1060 : null;
        const newEmp = {
            id: nextId,
            sicil,
            name: o.name,
            dept: o.dept || DEPTS[0],
            title: o.title || TITLES[0],
            branch: o.branch || 'HQ',
            status,
            inMin,
            outMin,
            checkIn: inMin == null ? null : hhmm(inMin),
            checkOut: outMin == null ? null : hhmm(outMin),
            lateMin: status === 'LATE' ? 12 : 0,
            overtimeMin: status === 'PRESENT' ? 15 : 0,
            dist: status === 'PRESENT' || status === 'LATE' ? 8.4 : null,
            tone: 1 + (nextId % 5),
            proneLateDow: 1,
            proneOtDow: 3,
            workHabitBias: 0.72,
            startDate: o.startDate || DAYS[DAYS.length - 1].iso,
            email: o.email || '',
            isNewHire: true
        };
        EMPLOYEES.unshift(newEmp);
        DEVICES.unshift({
            id: 'DV-' + (7000 + DEVICES.length + 1),
            empId: newEmp.id,
            model: o.deviceModel || 'Yeni Kayıt · Mobil Cihaz',
            os: 'Android 14',
            ver: '2.4.1',
            seen: 1,
            status: o.deviceBound === false ? 'PENDING' : 'BOUND',
            mask: 'n' + (nextId % 9) + 'f…' + (nextId % 90 + 10)
        });
        clearAnalyticsCache();
        persistLocalState();

        if (typeof fetch === 'function' && (typeof location === 'undefined' || location.protocol !== 'file:')) {
            fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    name: newEmp.name,
                    dept: newEmp.dept,
                    title: newEmp.title,
                    branch: newEmp.branch,
                    status: newEmp.status,
                    email: newEmp.email,
                    startDate: newEmp.startDate
                })
            })
                .then(r => (r.ok ? r.json() : null))
                .then(res => {
                    if (res && res.employee) {
                        const idx = EMPLOYEES.findIndex(x => x.id === newEmp.id);
                        if (idx >= 0) {
                            EMPLOYEES[idx] = Object.assign({}, EMPLOYEES[idx], res.employee);
                            clearAnalyticsCache();
                            if (typeof onSync === 'function') onSync(EMPLOYEES[idx]);
                        }
                    }
                })
                .catch(() => {});
        }
        return newEmp;
    }

    function updateEmployee(empId, patch, onSync) {
        const idx = EMPLOYEES.findIndex(x => x.id === +empId);
        if (idx < 0) return null;
        const current = EMPLOYEES[idx];
        const nextStatus = patch.status || current.status;
        let inMin = current.inMin;
        let outMin = current.outMin;
        let lateMin = current.lateMin;
        let overtimeMin = current.overtimeMin;
        let dist = current.dist;

        if (patch.status && patch.status !== current.status) {
            if (nextStatus === 'LEAVE' || nextStatus === 'ABSENT') {
                inMin = null;
                outMin = null;
                lateMin = 0;
                overtimeMin = 0;
                dist = null;
            } else if (inMin == null) {
                inMin = nextStatus === 'PRESENT' ? 505 : 552;
                outMin = 1060;
                lateMin = nextStatus === 'LATE' ? 12 : 0;
                overtimeMin = nextStatus === 'PRESENT' ? 15 : 0;
                dist = 7.8;
            }
        }

        const updated = Object.assign({}, current, {
            name: patch.name != null ? patch.name : current.name,
            dept: patch.dept != null ? patch.dept : current.dept,
            title: patch.title != null ? patch.title : current.title,
            branch: patch.branch != null ? patch.branch : current.branch,
            status: nextStatus,
            email: patch.email != null ? patch.email : (current.email || ''),
            startDate: patch.startDate != null ? patch.startDate : (current.startDate || '2026-10-20'),
            inMin,
            outMin,
            checkIn: inMin == null ? null : hhmm(inMin),
            checkOut: outMin == null ? null : hhmm(outMin),
            lateMin,
            overtimeMin,
            dist
        });
        EMPLOYEES[idx] = updated;
        clearAnalyticsCache();
        persistLocalState();

        try {
            const updatedMap = JSON.parse(localStorage.getItem('atf_updated_employees') || '{}');
            updatedMap[updated.id] = updated;
            localStorage.setItem('atf_updated_employees', JSON.stringify(updatedMap));
        } catch (_) {}

        if (typeof fetch === 'function' && (typeof location === 'undefined' || location.protocol !== 'file:')) {
            fetch(`${API_BASE}/${encodeURIComponent(updated.id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(patch)
            })
                .then(r => (r.ok ? r.json() : null))
                .then(res => {
                    if (res && res.employee) {
                        const i2 = EMPLOYEES.findIndex(x => x.id === updated.id);
                        if (i2 >= 0) {
                            EMPLOYEES[i2] = Object.assign({}, EMPLOYEES[i2], res.employee);
                            clearAnalyticsCache();
                            if (typeof onSync === 'function') onSync(EMPLOYEES[i2]);
                        }
                    }
                })
                .catch(() => {});
        }
        return updated;
    }

    function deleteEmployee(empId, onSync) {
        const idx = EMPLOYEES.findIndex(x => x.id === +empId);
        if (idx < 0) return null;
        const removed = EMPLOYEES.splice(idx, 1)[0];
        for (let i = DEVICES.length - 1; i >= 0; i--) {
            if (DEVICES[i].empId === removed.id) DEVICES.splice(i, 1);
        }
        clearAnalyticsCache();
        persistLocalState();

        try {
            const deletedIds = JSON.parse(localStorage.getItem('atf_deleted_emp_ids') || '[]');
            if (!deletedIds.includes(removed.id)) deletedIds.push(removed.id);
            localStorage.setItem('atf_deleted_emp_ids', JSON.stringify(deletedIds));
        } catch (_) {}

        if (typeof fetch === 'function' && (typeof location === 'undefined' || location.protocol !== 'file:')) {
            fetch(`${API_BASE}/${encodeURIComponent(removed.id)}`, {
                method: 'DELETE',
                headers: { 'Accept': 'application/json' }
            })
                .then(r => (r.ok ? r.json() : null))
                .then(res => {
                    if (res && typeof onSync === 'function') onSync(removed);
                })
                .catch(() => {});
        }
        return removed;
    }

    g.ATF.DATA = {
        BRANCHES, DEPTS, TITLES, EMPLOYEES, DAYS, LEAVES, LEAVE_TYPES, ALERTS, ALERT_TYPES,
        TICKETS, TICKET_TYPES, DEVICES, AUDIT, hhmm, fmtDurMin, resolveDays, empAnalytics, computeLeaderboards,
        addEmployee, updateEmployee, deleteEmployee, syncEmployeesFromBackend, clearAnalyticsCache
    };
})(window);
