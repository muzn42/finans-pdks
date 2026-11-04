/* ==========================================================================
   app.js · Oturum, Yönlendirme, İK ve BT Sayfaları
   V4: Derin Personel Profil Analizi, Özel Tarih/Süre Filtresi,
       Ek Mesai & Net Süre Bakiyesi (Mesai − Gecikme) Ligleri,
       Temalı Özel Şube/Filtre Açılır Menüleri (.cselect) ve Mobil-Web Tam Uyum
   ========================================================================== */
(function () {
    'use strict';
    const A = window.ATF, D = A.DATA, { $, $$, esc, fmt, pad, ic, dlBtn } = A;
    const STATUS = { PRESENT: ['Ofiste', 'ok'], LATE: ['Geç kaldı', 'warn'], LEAVE: ['İzinli', 'info'], ABSENT: ['Devamsız', 'bad'] };
    const brName = c => (D.BRANCHES.find(b => b.code === c) || {}).name || c;
    const emp = id => D.EMPLOYEES.find(e => e.id === id);

    /* ---------- Yetki Kataloğu & Hesaplar (İK, BT ve Admin) ---------- */
    const PERM_CATALOG = {
        HR: [
            { k: 'emp_view', l: 'Personel & Yoklama Görüntüleme', d: 'Tüm şube personel listesi ve günlük giriş-çıkış kayıtları' },
            { k: 'emp_add', l: 'İşe Giriş / Yeni Personel Ekleme', d: 'İşe yeni başlayan personelleri PDKS sistemine kaydetme ve sicil açma' },
            { k: 'leave_manage', l: 'İzin & Mazeret Onaylama', d: 'Yıllık izin, sağlık raporu ve mazeret taleplerini onaylama / reddetme' },
            { k: 'analytics_view', l: 'Ek Mesai & Net Bakiye Analitiği', d: 'Departman kıyaslamaları, gecikme ve mesai lig tabloları' },
            { k: 'excel_export', l: 'Kurumsal Excel (.xlsx) Raporlama', d: 'Puantaj ve performans raporlarını dışa aktarma' }
        ],
        IT: [
            { k: 'sec_radar', l: '30m Geofence & Sahte GPS Radarı', d: 'Şube sınırı ihlallerini ve sahte konum denemelerini izleme' },
            { k: 'device_manage', l: 'Tek Cihaz Eşleme & Engelleme', d: 'Personel mobil cihaz eşlemesini sıfırlama veya engelleme' },
            { k: 'support_reset', l: 'Hesap Kilidi & Geçici Parola', d: 'Kilitlenen hesapları açma ve tek kullanımlık parola üretme' },
            { k: 'branch_geofence', l: 'Şube & 30m Geofence Tanımlama', d: 'Yeni şube koordinatı, yarıçap ve kurumsal Wi-Fi ekleme' },
            { k: 'audit_view', l: 'Denetim Günlüğü (Audit Log)', d: 'Tüm yönetici işlemlerinin değiştirilemez kayıtlarını inceleme' }
        ]
    };

    const DEFAULT_ACCOUNTS = [
        {
            id: 'ACC-1', email: 'ik@albayrakfinans.com.tr', pass: 'Ik!2026demo', role: 'HR',
            name: 'Zehra Yılmaz', title: 'İK Direktörü', branch: 'ALL', active: true,
            perms: ['emp_view', 'emp_add', 'leave_manage', 'analytics_view', 'excel_export']
        },
        {
            id: 'ACC-2', email: 'bt@albayrakfinans.com.tr', pass: 'Bt!2026demo', role: 'IT',
            name: 'Murat Doğan', title: 'BT ve Siber Güvenlik Müdürü', branch: 'ALL', active: true,
            perms: ['sec_radar', 'device_manage', 'support_reset', 'branch_geofence', 'audit_view']
        },
        {
            id: 'ACC-3', email: 'admin@albayrakfinans.com.tr', pass: 'Admin!2026demo', role: 'ADMIN',
            name: 'Selim Albayrak', title: 'Sistem ve Yetki Yöneticisi', branch: 'ALL', active: true,
            perms: ['all_admin']
        },
        {
            id: 'ACC-4', email: 'elif.demir@albayrakfinans.com.tr', pass: 'Ik!2026uzman', role: 'HR',
            name: 'Elif Demir', title: 'İşe Alım ve Özlük Uzmanı', branch: 'HQ', active: true,
            perms: ['emp_view', 'emp_add', 'leave_manage']
        },
        {
            id: 'ACC-5', email: 'kerem.kaya@albayrakfinans.com.tr', pass: 'Bt!2026destek', role: 'IT',
            name: 'Kerem Kaya', title: 'BT Sistem Destek Uzmanı', branch: 'ALL', active: true,
            perms: ['sec_radar', 'device_manage', 'support_reset']
        }
    ];

    let ACCOUNTS = DEFAULT_ACCOUNTS.slice();
    try {
        const savedAcc = JSON.parse(localStorage.getItem('atf_portal_accounts') || 'null');
        if (Array.isArray(savedAcc) && savedAcc.length >= 3) {
            ACCOUNTS = savedAcc;
        }
    } catch (_) {}

    function saveAccounts() {
        try {
            localStorage.setItem('atf_portal_accounts', JSON.stringify(ACCOUNTS));
        } catch (_) {}
    }

    const S = {
        user: null, page: 'overview', range: 30, fromDate: '', toDate: '', branch: 'ALL', portal: 'HR',
        openEmpId: null,
        ui: {
            ovLb: 'best', // 'best' | 'worst'
            emp: { q: '', status: 'ALL', dept: 'ALL', sort: 'net', dir: -1, page: 1, size: 12, openId: null },
            onb: { name: '', dept: 'Şube Operasyon', title: 'Müşteri Temsilcisi', branch: 'HQ', status: 'PRESENT', startDate: '2026-10-20', email: '' },
            adm: {
                filter: 'ALL',
                role: 'HR',
                name: '',
                title: '',
                email: '',
                pass: 'Albayrak!2026',
                branch: 'ALL',
                perms: ['emp_view', 'emp_add', 'leave_manage', 'analytics_view', 'excel_export']
            },
            leave: { f: 'pending', type: 'ALL' }, alert: { sev: 'ALL', type: 'ALL', show: 'open' },
            tk: { f: 'open', type: 'ALL', q: '' }, dev: { q: '', status: 'ALL', ver: 'ALL' }, audit: { cat: 'ALL' },
            policies: { geofence30m: true, mockGpsBlock: true, singleDevice: true, autoTimeout: true },
            simBranch: 'HQ', simDist: 14
        }
    };
    let fails = 0, lockUntil = 0, idleTimer = null, leaving = false;

    const filterOpts = () => ({ range: S.range, fromDate: S.fromDate, toDate: S.toDate });
    const activeDays = () => D.resolveDays(filterOpts());
    const emps = () => D.EMPLOYEES.filter(e => S.branch === 'ALL' || e.branch === S.branch);
    const audit = (act, target, cat) => D.AUDIT.unshift({ t: pad(new Date().getHours()) + ':' + pad(new Date().getMinutes()), who: S.user.name, act, target, cat });

    function rangeLabel() {
        const days = activeDays();
        if (S.fromDate || S.toDate) {
            const f = days[0] ? days[0].fullDate : S.fromDate;
            const t = days[days.length - 1] ? days[days.length - 1].fullDate : S.toDate;
            return f === t ? `${f} (1 iş günü)` : `${f} – ${t} (${days.length} iş günü)`;
        }
        return S.range === 1 ? 'bugün (' + D.DAYS[D.DAYS.length - 1].fullDate + ')' : 'son ' + days.length + ' iş günü';
    }

    function fmtMinSigned(m) {
        if (!Number.isFinite(+m)) return '—';
        const sign = m > 0 ? '+' : m < 0 ? '−' : '';
        const abs = Math.abs(Math.round(m));
        const h = Math.floor(abs / 60), min = abs % 60;
        if (h > 0) return `${sign}${h} sa ${min} dk`;
        return `${sign}${min} dk`;
    }
    function fmtMinDur(m) {
        if (!Number.isFinite(+m)) return '—';
        const abs = Math.abs(Math.round(m));
        const h = Math.floor(abs / 60), min = abs % 60;
        if (h > 0) return `${h} sa ${min} dk`;
        return `${min} dk`;
    }
    function netPill(m) {
        const cls = m > 0 ? 'pos' : m < 0 ? 'neg' : 'zero';
        return `<span class="net-pill ${cls}">${fmtMinSigned(m)}</span>`;
    }

    /* ======================= İstatistik ======================= */
    function stats() {
        const E = emps(), N = E.length || 1, cur = activeDays(), allDays = D.DAYS;
        if (cur.length === 1 && cur[0].dayIndex === allDays.length - 1 && !S.fromDate && !S.toDate) {
            const c = s => E.filter(e => e.status === s).length, late = E.filter(e => e.status === 'LATE');
            const y = allDays[allDays.length - 2];
            const lb = D.computeLeaderboards(E, filterOpts());
            const totOtMin = lb.all.reduce((a, x) => a + x.totalOvertimeMin, 0);
            const totLateMin = lb.all.reduce((a, x) => a + x.totalLateMin, 0);
            return {
                N, onTime: c('PRESENT'), late: c('LATE'), leave: c('LEAVE'), absent: c('ABSENT'),
                avgLate: late.length ? late.reduce((a, e) => a + e.lateMin, 0) / late.length : 0,
                onTimePct: c('PRESENT') / N * 100, prevPct: y.onTime * 100, prevLate: Math.round(y.late * N),
                totalOvertimeH: +(totOtMin / 60).toFixed(1),
                totalLateMin: totLateMin,
                netBalanceMin: totOtMin - totLateMin
            };
        }
        const firstIdx = cur[0] ? cur[0].dayIndex : allDays.length - 1;
        const prev = allDays.slice(Math.max(0, firstIdx - cur.length), firstIdx);
        const avg = (arr, k) => arr.reduce((a, d) => a + d[k], 0) / (arr.length || 1);
        const lb = D.computeLeaderboards(E, filterOpts());
        const totOtMin = lb.all.reduce((a, x) => a + x.totalOvertimeMin, 0);
        const totLateMin = lb.all.reduce((a, x) => a + x.totalLateMin, 0);
        return {
            N, onTime: Math.round(avg(cur, 'onTime') * N), late: Math.round(avg(cur, 'late') * N),
            leave: Math.round(avg(cur, 'leave') * N), absent: Math.round(avg(cur, 'absent') * N),
            avgLate: avg(cur, 'lateMin'),
            onTimePct: avg(cur, 'onTime') * 100, prevPct: avg(prev.length ? prev : cur, 'onTime') * 100,
            prevLate: Math.round(avg(prev.length ? prev : cur, 'late') * N),
            totalOvertimeH: +(totOtMin / 60).toFixed(1),
            totalLateMin: totLateMin,
            netBalanceMin: totOtMin - totLateMin
        };
    }

    const deptStats = () => {
        const E = emps(), lb = D.computeLeaderboards(E, filterOpts());
        const byEmp = {};
        lb.all.forEach(a => { byEmp[a.empId] = a; });
        return D.DEPTS.map(d => {
            const L = E.filter(e => e.dept === d), n = L.length || 1;
            const anList = L.map(e => byEmp[e.id]).filter(Boolean);
            const onTimeSum = anList.reduce((a, x) => a + (Number.isFinite(x.presentDays) ? x.presentDays : 0), 0);
            const attendedSum = anList.reduce((a, x) => a + (Number.isFinite(x.attendedDays) ? x.attendedDays : 0), 0) || 1;
            const pct = A.clamp((onTimeSum / attendedSum) * 100, 68, 99.6);
            const totalLateMin = anList.reduce((a, x) => a + x.totalLateMin, 0);
            const totalOvertimeMin = anList.reduce((a, x) => a + x.totalOvertimeMin, 0);
            const netMin = totalOvertimeMin - totalLateMin;
            const lateDaysSum = anList.reduce((a, x) => a + x.lateDays, 0);
            const avgLate = lateDaysSum ? Math.round(totalLateMin / lateDaysSum) : 0;
            const inList = L.filter(e => e.inMin != null);
            const avgInMin = inList.length ? Math.round(inList.reduce((a, x) => a + eIn(x), 0) / inList.length) : 504;
            function eIn(x) { return x.inMin || 504; }
            const avgWorkH = anList.length ? +(anList.reduce((a, x) => a + x.avgWorkH, 0) / anList.length).toFixed(1) : 8.5;
            return {
                d, pct, n: L.length, avgLate, avgIn: D.hhmm(avgInMin),
                overtimeH: +(totalOvertimeMin / 60).toFixed(1),
                totalLateMin, totalOvertimeMin, netMin, avgWorkH
            };
        }).sort((a, b) => b.pct - a.pct);
    };

    /* ======================= Ortak Parçalar ======================= */
    function kpi(o) {
        return `<article class="card kpi lift"><div class="kpi-top"><span class="kpi-label">${esc(o.label)}</span><span class="kpi-ic ${o.tone || ''}">${ic(o.icon)}</span></div>
        <div class="kpi-val"><span data-count="${o.val}" data-dec="${o.dec || 0}">0</span>${o.unit ? `<small>${o.unit}</small>` : ''}</div>
        <div class="kpi-foot">${o.delta || ''}<span>${o.foot || ''}</span>${o.spark || ''}</div></article>`;
    }
    function delta(v, unit, goodUp) {
        const dir = Math.abs(v) < .05 ? 'flat' : v > 0 ? 'up' : 'down', cls = dir === 'flat' ? 'flat' : ((v > 0) === (goodUp !== false) ? 'up' : 'down');
        return `<span class="delta ${cls}">${ic(dir)}${Math.abs(v).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}${unit}</span>`;
    }
    const pill = (txt, tone) => `<span class="pill ${tone}">${esc(txt)}</span>`;
    const avatar = (e, cls) => `<span class="avatar t${e.tone || 1} ${cls || ''}">${esc(A.initials(e.name))}</span>`;
    const chips = (items, cur, act) => `<div class="chips">${items.map(i => `<button class="chip${cur === i.v ? ' is-active' : ''}" data-act="${act}" data-v="${i.v}">${esc(i.l)}${i.n != null ? ` <span class="n">${i.n}</span>` : ''}</button>`).join('')}</div>`;

    /* Özel temalı açılır menü (tüm sayfalarda işletim sistemi beyaz select sorununu çözer) */
    function selectEl(id, opts, cur, label) {
        const curObj = opts.find(o => String(o.v) === String(cur)) || opts[0] || { v: '', l: label };
        return `<div class="cselect plain" data-cselect="${esc(id)}" title="${esc(label)}">
            <button type="button" class="cselect-btn" data-act="cselect-toggle" aria-label="${esc(label)}">
                <span class="cselect-label">${esc(curObj.l)}</span>
                <svg class="ic cselect-caret" viewBox="0 0 24 24" data-i="chevron"></svg>
            </button>
            <div class="cselect-menu" role="listbox">
                ${opts.map(o => `<button type="button" class="cselect-item${String(o.v) === String(cur) ? ' is-selected' : ''}" data-act="cselect-pick" data-bind="${esc(id)}" data-v="${esc(o.v)}">
                    <span>${esc(o.l)}</span>
                    ${o.sub ? `<small>${esc(o.sub)}</small>` : ''}
                </button>`).join('')}
            </div>
        </div>`;
    }

    const searchEl = (id, val, ph) => `<label class="search">${ic('search')}<input id="${id}" data-bind="${id}" value="${esc(val)}" placeholder="${esc(ph)}" autocomplete="off"></label>`;
    const cardHead = (t, sub, right) => `<div class="card-head"><div><h3>${esc(t)}</h3>${sub ? `<p>${esc(sub)}</p>` : ''}</div>${right || ''}</div>`;
    const rank = (items, cls) => `<div class="rank">${items.map((it, i) => `<div class="rank-row"><div class="rank-top"><span>${esc(it.l)}</span><b>${it.v}</b></div><div class="bar-track"><div class="bar-fill ${it.cls || cls || ''}" style="--w:${it.w}%;--k:${i}"></div></div></div>`).join('')}</div>`;
    const empty = (t, s) => `<div class="empty"><b>${esc(t)}</b>${esc(s || '')}</div>`;
    const dndToolbar = () => `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap">
        <span class="muted" style="font-size:12.5px;display:inline-flex;align-items:center;gap:6px">${ic('grip')} Kutuları sürükleyip bırakarak kendi ekran düzeninizi oluşturabilirsiniz · <b>Dönem: ${esc(rangeLabel())}</b></span>
        <div style="display:flex;gap:8px;align-items:center">
            <button type="button" class="dnd-hint" data-act="dnd-reset">${ic('refresh')} Düzeni Sıfırla</button>
            ${dlBtn('export-analytics', 'Yönetici Excel Raporu (.xlsx)', { cls: 'btn-dark btn-sm' })}
        </div>
    </div>`;

    /* ======================= İK SAYFALARI ======================= */
    const HR = {};

    HR.overview = {
        title: 'Genel bakış', sub: () => 'Personel katılım durumu, fazla mesai ve net süre bakiyesi özeti · ' + rangeLabel(), tools: { range: 1, branch: 1 }, icon: 'grid',
        render() {
            const st = stats(), E = emps(), pend = D.LEAVES.filter(l => l.status === 'pending').slice(0, 3);
            const curDays = activeDays(), daysChart = curDays.length >= 5 ? curDays.slice(-14) : D.DAYS.slice(-14);
            const lb = D.computeLeaderboards(E, filterOpts());
            const geldi = st.onTime + st.late;
            const netList = S.ui.ovLb === 'best' ? lb.bestNet.slice(0, 5) : lb.worstNet.slice(0, 5);

            return `
            ${dndToolbar()}
            <div class="grid g-4">
                ${kpi({ label: 'Toplam personel', val: st.N, icon: 'users', tone: '', foot: S.branch === 'ALL' ? '6 şube · %98,6 geofence' : esc(brName(S.branch)) })}
                ${kpi({ label: curDays.length === 1 ? 'Şu an ofiste' : 'Ortalama katılım', val: geldi, icon: 'check', tone: 'ok', delta: delta(st.onTimePct - st.prevPct, ' puan'), foot: '%' + A.pctText(geldi / st.N * 100) + ' katılım', spark: A.spark(daysChart.map(d => 1 - d.absent - d.leave), '#0E9F6E') })}
                ${kpi({ label: 'Toplam ek mesai', val: st.totalOvertimeH, dec: 1, unit: 'sa', icon: 'activity', tone: 'ok', foot: 'Net bakiye: ' + fmtMinSigned(st.netBalanceMin), spark: A.spark(daysChart.map(d => d.overtimeH), '#0E9F6E') })}
                ${kpi({ label: 'Geç kalan / devamsız', val: st.late, icon: 'clock', tone: 'warn', delta: delta(st.late - st.prevLate, '', false), foot: 'ort. ' + Math.round(st.avgLate) + ' dk gecikme · ' + st.absent + ' devamsız', spark: A.spark(daysChart.map(d => d.late), '#C77700') })}
            </div>

            <!-- YENİ: En Çok Mesai Yapanlar & Net Süre Bakiyesi (Ek Mesai - Gecikme) En İyiler / En Kötüler -->
            <div class="grid g-3 mt">
                <section class="card flush">
                    ${cardHead('En çok ek mesai yapanlar', rangeLabel() + ' · toplam fazla mesai liderleri', dlBtn('export-leaderboards', 'Lig Excel', { cls: 'btn-soft btn-sm' }))}
                    <div class="list" style="margin-top:4px">
                        ${lb.topOvertime.slice(0, 5).map((a, idx) => `<div class="list-item clickable" data-act="emp-open" data-id="${a.emp.id}" style="cursor:pointer">
                            <span class="rank-badge r${idx + 1}">${idx + 1}</span>
                            ${avatar(a.emp, 'sm')}
                            <div class="grow">
                                <b>${esc(a.emp.name)}</b>
                                <small>${esc(a.emp.dept)} · Zirve: <b>${esc(a.mostOvertimeDay.dowName)}</b> (${a.mostOvertimeDay.totalOvertimeMin} dk)</small>
                            </div>
                            <div style="text-align:right">
                                ${pill('+' + fmtMinDur(a.totalOvertimeMin), 'ok')}
                                <small class="muted" style="font-size:10.5px;display:block;margin-top:2px">Net: ${fmtMinSigned(a.netBalanceMin)}</small>
                            </div>
                        </div>`).join('')}
                    </div>
                </section>

                <section class="card flush">
                    ${cardHead(
                        'Net süre bakiyesi (Ek mesai − gecikme)',
                        'Ek mesaiden geç kalınan dakika çıkınca kalan net süre',
                        chips([{ v: 'best', l: 'En İyiler (+)' }, { v: 'worst', l: 'En Kötüler (−)' }], S.ui.ovLb, 'ov-lb-tab')
                    )}
                    <div class="list" style="margin-top:4px">
                        ${netList.map((a, idx) => `<div class="list-item clickable" data-act="emp-open" data-id="${a.emp.id}" style="cursor:pointer">
                            <span class="rank-badge ${S.ui.ovLb === 'best' ? 'r' + (idx + 1) : ''}">${idx + 1}</span>
                            ${avatar(a.emp, 'sm')}
                            <div class="grow">
                                <b>${esc(a.emp.name)}</b>
                                <small>Mesai: <b>+${a.totalOvertimeMin} dk</b> · Geç: <b>−${a.totalLateMin} dk</b></small>
                            </div>
                            <div style="text-align:right">
                                ${netPill(a.netBalanceMin)}
                                <small class="muted" style="font-size:10.5px;display:block;margin-top:2px">${S.ui.ovLb === 'best' ? 'En iyi: ' + a.mostOvertimeDay.dowShort : 'En geç: ' + a.mostLateDay.dowShort}</small>
                            </div>
                        </div>`).join('')}
                    </div>
                </section>

                <section class="card flush">
                    ${cardHead('En çok geç kalanlar', rangeLabel() + ' · gecikme süresi ve en sık gecikilen gün', dlBtn('export-late', 'Excel İndir', { cls: 'btn-soft btn-sm' }))}
                    <div class="list" style="margin-top:4px">
                        ${lb.mostLate.slice(0, 5).map((a, idx) => `<div class="list-item clickable" data-act="emp-open" data-id="${a.emp.id}" style="cursor:pointer">
                            <span class="rank-badge">${idx + 1}</span>
                            ${avatar(a.emp, 'sm')}
                            <div class="grow">
                                <b>${esc(a.emp.name)}</b>
                                <small>${esc(a.emp.dept)} · En çok: <b>${esc(a.mostLateDay.dowName)}</b> (${a.mostLateDay.lateCount} kez)</small>
                            </div>
                            <div style="text-align:right">
                                ${pill('−' + fmtMinDur(a.totalLateMin), 'warn')}
                                <small class="muted" style="font-size:10.5px;display:block;margin-top:2px">Net: ${fmtMinSigned(a.netBalanceMin)}</small>
                            </div>
                        </div>`).join('')}
                    </div>
                </section>
            </div>

            <div class="grid g-main mt">
                <section class="card">${cardHead(curDays.length === 1 ? 'Giriş yoğunluğu (15 dk dilimler)' : 'Zamanında gelme oranı trendi', curDays.length === 1 ? 'Vardiya başlangıcı 08:30 referanslı' : rangeLabel() + ' · günlük oran (%)')}<div id="chArrival"></div></section>
                <section class="card">${cardHead('Durum dağılımı', rangeLabel())}<div id="chDonut"></div></section>
            </div>

            <div class="grid g-3 mt">
                <section class="card">${cardHead('Departmanlara göre zamanında gelme', rangeLabel())}${rank(deptStats().slice(0, 7).map(x => ({ l: x.d, v: A.pctText(x.pct) + '% · Net ' + fmtMinSigned(x.netMin), w: A.clamp(x.pct, 0, 100), cls: x.pct > 94 ? 'ok' : x.pct > 88 ? '' : 'warn' })))}</section>
                <section class="card">${cardHead('Geliş saati yoğunluk haritası', 'Haftanın günü × saat yoğunluğu')}<div id="chHeat"></div></section>
                <section class="card flush">${cardHead('Bekleyen izin & mazeret talepleri', pend.length + ' talep onay bekliyor', `<button class="btn btn-soft btn-sm" data-go="leaves">Tümü</button>`)}
                    <div class="list" style="margin-top:8px">${pend.length ? pend.map(l => { const e = emp(l.empId); return `<div class="list-item">${avatar(e, 'sm')}<div class="grow"><b>${esc(e.name)}</b><small>${esc(l.type)} · ${l.days} gün</small></div><div class="row-actions"><button class="btn btn-ok btn-sm" data-act="leave-act" data-id="${l.id}" data-v="approved" aria-label="Onayla">${ic('check')}</button><button class="btn btn-bad btn-sm" data-act="leave-act" data-id="${l.id}" data-v="rejected" aria-label="Reddet">${ic('x')}</button></div></div>`; }).join('') : empty('Bekleyen talep yok')}</div></section>
            </div>

            <div class="grid g-2 mt">
                <section class="card">${cardHead('Günlük çalışma süresi istikrarı (8,5 sa hedef)', 'Mobil ve web birleşik mesai istikrar grafiği · ' + rangeLabel())}<div id="chStabilityOv"></div></section>
                <section class="card">${cardHead('Fazla mesai eğilimi', 'Günlük toplam fazla mesai saati · ' + rangeLabel())}<div id="chOvertime"></div></section>
            </div>`;
        },
        mount() {
            const st = stats(), E = emps(), curDays = activeDays(), dChart = curDays.length >= 2 ? curDays : D.DAYS.slice(-14);
            if (curDays.length === 1) {
                const b = Array(11).fill(0); E.forEach(e => { if (e.inMin != null) b[A.clamp(Math.floor((e.inMin - 450) / 15), 0, 10)]++; });
                A.areaChart($('#chArrival'), { labels: b.map((_, i) => D.hhmm(450 + i * 15)), series: [{ data: b }], aria: 'Giriş yoğunluğu', tip: (i, v) => `<b>${D.hhmm(450 + i * 15)} – ${D.hhmm(465 + i * 15)}</b>${v[0]} kişi girdi` });
            } else {
                A.areaChart($('#chArrival'), { labels: dChart.map(x => x.label), series: [{ data: dChart.map(x => A.num(x.onTime * 100)) }], yMin: 80, yMax: 100, yFmt: v => v + '%', aria: 'Zamanında gelme oranı', tip: (i, v) => `<b>${dChart[i].fullDate} (${dChart[i].dowName})</b>%${String(v[0]).replace('.', ',')} zamanında` });
            }
            A.donut($('#chDonut'), { items: [{ label: 'Zamanında', value: st.onTime, color: '#1C1D1F' }, { label: 'Geç kalan', value: st.late, color: '#E31E24' }, { label: 'İzinli', value: st.leave, color: '#8E949C' }, { label: 'Devamsız', value: st.absent, color: '#D9DBDF' }], centerTop: '%' + A.pctText(st.onTimePct), centerSub: 'zamanında', aria: 'Durum dağılımı' });
            const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'], cols = ['07:30', '08:00', '08:30', '09:00', '09:30'], r = A.rng(A.hash(S.branch));
            const rows = days.map((l, di) => ({ label: l, cells: cols.map((_, ci) => { const peak = di === 0 ? 2.2 : di === 4 ? 1.1 : 1.6; return A.clamp(Math.exp(-Math.pow(ci - peak, 2) / 1.25) * (.88 + r() * .12) + (ci === 4 ? di === 0 ? .1 : 0 : 0), 0, 1); }) }));
            A.heatmap($('#chHeat'), { cols, rows, tip: v => 'yoğunluk %' + Math.round(v * 100) });
            const d14 = dChart.slice(-14);
            A.areaChart($('#chStabilityOv'), {
                labels: d14.map(x => x.label),
                series: [
                    { data: d14.map(x => A.num(x.workH)) },
                    { data: d14.map(() => 8.5) }
                ],
                yMin: 7, yMax: 10, yFmt: v => v + ' sa',
                tip: (i, v) => `<b>${d14[i].fullDate} (${d14[i].dowName})</b>Gerçekleşen: ${String(v[0]).replace('.', ',')} sa · Standart: 8,5 sa`
            });
            A.barChart($('#chOvertime'), { data: d14.map(x => ({ label: x.label, value: Math.round(x.overtimeH), fullDate: x.fullDate, dow: x.dowName })), accentLast: true, yFmt: v => v + ' sa', aria: 'Fazla mesai', tip: d => `<b>${d.fullDate} (${d.dow})</b>${d.value} saat fazla mesai` });
        }
    };

    function filteredEmps() {
        const u = S.ui.emp, q = u.q.toLocaleLowerCase('tr-TR').trim(), opts = filterOpts();
        let L = emps().filter(e => (u.status === 'ALL' || e.status === u.status) && (u.dept === 'ALL' || e.dept === u.dept) && (!q || (e.name + ' ' + e.sicil + ' ' + e.dept).toLocaleLowerCase('tr-TR').includes(q)));
        const anMap = {};
        L.forEach(e => { anMap[e.id] = D.empAnalytics(e.id, opts); });
        const k = u.sort, key = {
            name: e => e.name,
            dept: e => e.dept,
            in: e => e.inMin == null ? 9999 : e.inMin,
            late: e => anMap[e.id].totalLateMin,
            ot: e => anMap[e.id].totalOvertimeMin,
            net: e => anMap[e.id].netBalanceMin,
            status: e => e.status,
            dist: e => e.dist == null ? 999 : e.dist
        }[k] || (e => e.name);
        return L.sort((a, b) => { const x = key(a), y = key(b); return (typeof x === 'string' ? x.localeCompare(y, 'tr') : x - y) * u.dir; }).map(e => ({ e, an: anMap[e.id] }));
    }

    /* =========================================================================
       PERSONEL LISTESI — SATIR ALTINDA ACILAN DETAY PANELI
       Kullanici satira tiklar, detaylar satirin hemen altinda acilir.
       "Tam profili ac" butonu ayri bir tam sayfa ekrana (route) gecis yapar.
       ========================================================================= */
    function empDetailHtml(e, an) {
        const hucre = (etiket, deger, ton) =>
            `<div class="emp-detail-cell${ton ? ' ' + ton : ''}"><span>${esc(etiket)}</span><b>${deger}</b></div>`;

        return `<div class="emp-detail">
            <div class="emp-detail-top">
                <div class="emp-detail-id">
                    ${avatar(e, 'lg')}
                    <div style="min-width:0">
                        <h4>${esc(e.name)}</h4>
                        <p>${esc(e.title)} · ${esc(e.dept)} · <span class="mono">${e.sicil}</span></p>
                        <div class="emp-detail-tags">
                            ${pill(STATUS[e.status][0], STATUS[e.status][1])}
                            ${pill(brName(e.branch), 'mute')}
                            ${netPill(an.netBalanceMin)}
                        </div>
                    </div>
                </div>
            </div>
            <div class="emp-detail-grid">
                ${hucre('Net Süre Bakiyesi', fmtMinSigned(an.netBalanceMin), an.netBalanceMin >= 0 ? 'ok' : 'bad')}
                ${hucre('Toplam Gecikme', an.totalLateMin > 0 ? '−' + fmtMinDur(an.totalLateMin) : '0 dk', an.totalLateMin > 0 ? 'warn' : '')}
                ${hucre('Toplam Ek Mesai', '+' + fmtMinDur(an.totalOvertimeMin), 'ok')}
                ${hucre('Ort. Giriş / Çıkış', `${an.avgCheckIn} → ${an.avgCheckOut}`)}
                ${hucre('En Çok Geç Kaldığı Gün', an.mostLateDay.totalLateMin > 0
                    ? `${esc(an.mostLateDay.dowName)} <small class="muted">(${an.mostLateDay.totalLateMin} dk)</small>`
                    : 'Yok')}
                ${hucre('Geofence Uyumu', '%' + an.geofenceRate + ' <small class="muted">(' + (e.dist != null ? String(e.dist).replace('.', ',') + ' m)' : '—)'))}
            </div>
            <div class="emp-detail-actions">
                <button type="button" class="btn btn-primary btn-sm" data-act="emp-profile" data-id="${e.id}">
                    ${ic('chevron')} Tam profili aç
                </button>
                <button type="button" class="btn btn-soft btn-sm" data-act="export-one" data-id="${e.id}">
                    ${ic('file')} Excel raporu (.xlsx)
                </button>
                <span class="grow"></span>
                <button type="button" class="btn btn-ghost btn-sm" data-act="emp-collapse">
                    Detayları kapat
                </button>
            </div>
        </div>`;
    }

    HR.employees = {
        title: 'Personel & yoklama analizi', sub: () => 'Personel satırına tıklayarak en çok gecikilen gün, ek mesai günü ve net süre bakiyesi karnesini açın · ' + rangeLabel(), tools: { range: 1, branch: 1 }, icon: 'users',
        render() {
            const u = S.ui.emp, all = emps(), L = filteredEmps(), pages = Math.max(1, Math.ceil(L.length / u.size)); if (u.page > pages) u.page = pages;
            const rows = L.slice((u.page - 1) * u.size, u.page * u.size), cnt = s => all.filter(e => e.status === s).length;
            const th = (k, t) => `<th class="sort${u.sort === k ? ' on' + (u.dir < 0 ? ' desc' : '') : ''}" data-act="emp-sort" data-v="${k}">${t}<span class="arr">↑</span></th>`;
            return `<section class="card flush">
            <div class="toolbar">${searchEl('emp-q', u.q, 'İsim, sicil veya departman ara')}
                ${chips([{ v: 'ALL', l: 'Tümü', n: all.length }, { v: 'PRESENT', l: 'Ofiste', n: cnt('PRESENT') }, { v: 'LATE', l: 'Geç', n: cnt('LATE') }, { v: 'LEAVE', l: 'İzinli', n: cnt('LEAVE') }, { v: 'ABSENT', l: 'Devamsız', n: cnt('ABSENT') }], u.status, 'emp-status')}
                <span class="grow"></span>${selectEl('emp-dept', [{ v: 'ALL', l: 'Tüm departmanlar' }].concat(D.DEPTS.map(d => ({ v: d, l: d }))), u.dept, 'Departman')}
                <button type="button" class="btn btn-primary btn-sm" data-go="onboarding">${ic('plus')}Yeni Personel Ekle</button>
                ${dlBtn('export-emps', 'Excel Raporu (.xlsx)', { cls: 'btn-dark btn-sm' })}</div>
            <div class="table-wrap"><table><thead><tr>
                ${th('name', 'Personel')}
                ${th('dept', 'Departman')}
                ${th('in', 'Ort. Giriş / Çıkış')}
                ${th('late', 'Top. Gecikme')}
                ${th('ot', 'Top. Ek Mesai')}
                ${th('net', 'Net Bakiye (Mesai−Geç)')}
                <th>En Çok Geç / Mesai Günü</th>
                ${th('dist', 'Konum (30m)')}
                ${th('status', 'Bugün')}
                <th></th>
            </tr></thead>
            <tbody>${rows.length ? rows.map(({ e, an }, i) => {
                const acik = u.openId === e.id;
                return `<tr class="emp-row${acik ? ' is-open' : ''}" style="--r:${i}" data-act="emp-expand" data-id="${e.id}" aria-expanded="${acik}">
                <td><div class="cell-user">${avatar(e)}<div><b>${esc(e.name)}</b><small class="mono">${e.sicil} · ${esc(brName(e.branch))}</small></div></div></td>
                <td>${esc(e.dept)}</td>
                <td class="mono">${an.avgCheckIn} <span class="muted">→ ${an.avgCheckOut}</span></td>
                <td class="mono" style="color:${an.totalLateMin > 0 ? 'var(--warn)' : 'var(--muted)'}"><b>${an.totalLateMin > 0 ? '−' + fmtMinDur(an.totalLateMin) : '0 dk'}</b> <small class="muted">(${an.lateDays}g)</small></td>
                <td class="mono" style="color:${an.totalOvertimeMin > 0 ? 'var(--ok)' : 'var(--muted)'}"><b>+${fmtMinDur(an.totalOvertimeMin)}</b> <small class="muted">(${an.overtimeDays}g)</small></td>
                <td>${netPill(an.netBalanceMin)}</td>
                <td><small style="display:block;font-size:var(--fs-xs)"><span style="color:var(--warn);font-weight:700">Geç:</span> ${an.mostLateDay.totalLateMin > 0 ? esc(an.mostLateDay.dowName) + ' (' + an.mostLateDay.totalLateMin + ' dk)' : 'Yok'}</small><small style="display:block;font-size:var(--fs-xs)"><span style="color:var(--ok);font-weight:700">Mesai:</span> ${esc(an.mostOvertimeDay.dowName)} (+${an.mostOvertimeDay.totalOvertimeMin} dk)</small></td>
                <td>${e.dist != null ? `<span class="mono">${String(e.dist).replace('.', ',')} m</span> ${pill('%' + an.geofenceRate, 'ok')}` : '<span class="muted">—</span>'}</td>
                <td>${pill(STATUS[e.status][0], STATUS[e.status][1])}</td>
                <td class="muted"><span class="emp-caret${acik ? ' is-open' : ''}">${ic('chevron')}</span></td>
            </tr>${acik ? `<tr class="detail-row"><td colspan="10">${empDetailHtml(e, an)}</td></tr>` : ''}`;
            }).join('') : `<tr><td colspan="10">${empty('Sonuç bulunamadı', 'Filtreleri değiştirmeyi deneyin.')}</td></tr>`}</tbody></table></div>
            <div class="pager"><span>${fmt(L.length)} personelden ${L.length ? (u.page - 1) * u.size + 1 : 0}–${Math.min(L.length, u.page * u.size)} gösteriliyor · <b>Dönem: ${esc(rangeLabel())}</b></span>
                <div style="display:flex;gap:10px;align-items:center">${selectEl('emp-size', [10, 12, 25, 50].map(n => ({ v: String(n), l: n + ' / sayfa' })), String(u.size), 'Sayfa boyutu')}
                <div class="pg"><button data-act="emp-page" data-v="${u.page - 1}" ${u.page <= 1 ? 'disabled' : ''} aria-label="Önceki">‹</button>${pageBtns(u.page, pages)}<button data-act="emp-page" data-v="${u.page + 1}" ${u.page >= pages ? 'disabled' : ''} aria-label="Sonraki">›</button></div></div></div></section>`;
        }
    };
    function pageBtns(cur, n) {
        const s = new Set([1, n, cur, cur - 1, cur + 1]); const a = [...s].filter(x => x >= 1 && x <= n).sort((x, y) => x - y); let out = '', prev = 0;
        a.forEach(p => { if (p - prev > 1) out += '<button disabled>…</button>'; out += `<button class="${p === cur ? 'on' : ''}" data-act="emp-page" data-v="${p}">${p}</button>`; prev = p; });
        return out;
    }

    HR.onboarding = {
        title: 'Personel ekle (İşe giriş & PDKS kaydı)',
        sub: () => 'İşe yeni başlayan personelleri PDKS sistemine kaydedin, şube 30m geofence ve tek cihaz eşlemesini başlatın',
        tools: {},
        icon: 'plus',
        render() {
            const o = S.ui.onb;
            const newHires = D.EMPLOYEES.filter(e => e.isNewHire).concat(D.EMPLOYEES.slice(0, 6)).slice(0, 8);
            const nextSicil = 'FN-' + (D.EMPLOYEES.reduce((m, x) => Math.max(m, x.id), 1500) + 1);
            return `
            <div class="grid g-4">
                ${kpi({ label: 'Aktif PDKS Kadrosu', val: D.EMPLOYEES.length, icon: 'users', tone: '', foot: D.BRANCHES.length + ' şubede aktif personel' })}
                ${kpi({ label: 'Yeni Açılacak Sicil', val: nextSicil.replace('FN-', ''), unit: 'FN', icon: 'key', tone: 'ok', foot: 'Otomatik ardışık sicil numarası' })}
                ${kpi({ label: 'Geofence Kuralı', val: 30, unit: 'metre', icon: 'pin', tone: 'ok', foot: 'Atanan şubeye otomatik bağlanır' })}
                ${kpi({ label: 'Bu Dönem Eklenen', val: D.EMPLOYEES.filter(e => e.isNewHire).length + 4, icon: 'check', tone: 'info', foot: 'Oryantasyon & cihaz eşlemesi aktif' })}
            </div>

            <div class="grid g-main mt">
                <section class="card">
                    ${cardHead('Yeni İşe Başlayan Personel PDKS Kayıt Formu', 'Personel bilgilerini girdiğinizde otomatik sicil numarası üretilir ve seçilen şubenin 30m geofence alanına tanımlanır.')}
                    <form class="form-grid" id="onbForm" onsubmit="return false" novalidate style="margin-top:8px">
                        <div class="grid g-2">
                            <label class="field">
                                <span>Ad Soyad *</span>
                                <div class="input">${ic('users')}<input id="onbName" data-bind="onb-name" value="${esc(o.name)}" placeholder="Örn. Selin Demirci" required></div>
                            </label>
                            <label class="field">
                                <span>Otomatik Sicil No</span>
                                <div class="input" style="background:var(--surface-2)">${ic('key')}<input value="${esc(nextSicil)} (Otomatik)" readonly style="font-family:var(--mono);font-weight:700;color:var(--red)"></div>
                            </label>
                        </div>

                        <div class="grid g-2">
                            <label class="field">
                                <span>Departman / Birim</span>
                                <div>${selectEl('onb-dept', D.DEPTS.map(d => ({ v: d, l: d })), o.dept, 'Departman seçin')}</div>
                            </label>
                            <label class="field">
                                <span>Ünvan / Görev</span>
                                <div>${selectEl('onb-title', (D.TITLES || ['Finans Uzmanı', 'Müşteri Temsilcisi', 'Operasyon Uzmanı', 'Takım Lideri', 'Uzman Yardımcısı']).map(t => ({ v: t, l: t })), o.title, 'Ünvan seçin')}</div>
                            </label>
                        </div>

                        <div class="grid g-2">
                            <label class="field">
                                <span>Atandığı Şube (30m Geofence)</span>
                                <div>${selectEl('onb-branch', D.BRANCHES.map(b => ({ v: b.code, l: b.name, sub: b.city + ' · 30m' })), o.branch, 'Şube seçin')}</div>
                            </label>
                            <label class="field">
                                <span>İşe Başlama Tarihi</span>
                                <div class="input">${ic('calendar')}<input type="date" id="onbDate" data-bind="onb-date" value="${esc(o.startDate)}"></div>
                            </label>
                        </div>

                        <div class="grid g-2">
                            <label class="field">
                                <span>Kurumsal E-posta</span>
                                <div class="input">${ic('mail')}<input id="onbEmail" data-bind="onb-email" value="${esc(o.email)}" placeholder="ad.soyad@albayrakfinans.com.tr"></div>
                            </label>
                            <label class="field">
                                <span>İlk Gün Yoklama Durumu</span>
                                <div>${selectEl('onb-status', [
                                    { v: 'PRESENT', l: 'Ofiste · Mesaiye Başladı (08:25)' },
                                    { v: 'LEAVE', l: 'Oryantasyon / İzinli' }
                                ], o.status, 'İlk gün durumu')}</div>
                            </label>
                        </div>

                        <p class="form-error" id="onbErr" hidden></p>

                        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px;flex-wrap:wrap">
                            <small class="muted">${ic('shield')} Mobil cihaz eşlemesi ve 30m şube sınırı otomatik tanımlanır.</small>
                            <button type="button" class="btn btn-primary" data-act="onb-submit">${ic('plus')}<span>Personeli PDKS Sistemine Ekle</span></button>
                        </div>
                    </form>
                </section>

                <section class="card flush">
                    ${cardHead('Son İşe Başlayan & Yeni Eklenen Personeller', 'Satıra tıklayarak personelin PDKS profil karnesini açabilirsiniz', `<button class="btn btn-soft btn-sm" data-go="employees">Tüm Liste</button>`)}
                    <div class="list" style="margin-top:4px">
                        ${newHires.map(e => `<div class="list-item clickable" data-act="emp-open" data-id="${e.id}" style="cursor:pointer">
                            ${avatar(e)}
                            <div class="grow">
                                <b>${esc(e.name)} ${e.isNewHire ? pill('Yeni Kayıt', 'ok') : ''}</b>
                                <small><span class="mono">${esc(e.sicil)}</span> · ${esc(e.title)} · ${esc(e.dept)}</small>
                                <small class="muted" style="display:block">${esc(brName(e.branch))} ${e.startDate ? '· Başlangıç: ' + esc(e.startDate) : ''}</small>
                            </div>
                            <div style="text-align:right">
                                ${pill(STATUS[e.status][0], STATUS[e.status][1])}
                            </div>
                        </div>`).join('')}
                    </div>
                </section>
            </div>`;
        }
    };

    HR.leaves = {
        title: 'İzin & mazeret talepleri', sub: () => 'Onay bekleyenleri hızlıca sonuçlandırın', tools: {}, icon: 'inbox',
        render() {
            const u = S.ui.leave, cnt = s => D.LEAVES.filter(l => l.status === s).length;
            const L = D.LEAVES.filter(l => (u.f === 'all' || l.status === u.f) && (u.type === 'ALL' || l.type === u.type));
            const tone = { pending: ['Bekliyor', 'warn'], approved: ['Onaylandı', 'ok'], rejected: ['Reddedildi', 'bad'] };
            return `<section class="card flush"><div class="toolbar">${chips([{ v: 'pending', l: 'Bekleyen', n: cnt('pending') }, { v: 'approved', l: 'Onaylanan', n: cnt('approved') }, { v: 'rejected', l: 'Reddedilen', n: cnt('rejected') }, { v: 'all', l: 'Tümü', n: D.LEAVES.length }], u.f, 'leave-filter')}
                <span class="grow"></span>${selectEl('leave-type', [{ v: 'ALL', l: 'Tüm türler' }].concat(D.LEAVE_TYPES.map(t => ({ v: t, l: t }))), u.type, 'Talep türü')}
                ${dlBtn('export-leaves', 'İzin Raporu (.xlsx)', { cls: 'btn-soft btn-sm' })}</div>
                <div class="list">${L.length ? L.map(l => { const e = emp(l.empId), t = tone[l.status]; return `<div class="list-item" style="animation:rowIn .45s var(--ease) both">${avatar(e)}<div class="grow"><b>${esc(e.name)} <span class="muted" style="font-weight:500">· ${esc(e.dept)}</span></b><small>${esc(l.type)} · ${l.days} gün · ${l.from} · “${esc(l.reason)}”</small></div><span class="muted" style="font-size:12px">${l.ago}</span>${pill(t[0], t[1])}
                ${l.status === 'pending' ? `<div class="row-actions"><button class="btn btn-ok btn-sm" data-act="leave-act" data-id="${l.id}" data-v="approved">${ic('check')}Onayla</button><button class="btn btn-bad btn-sm" data-act="leave-act" data-id="${l.id}" data-v="rejected">${ic('x')}Reddet</button></div>` : ''}</div>`; }).join('') : empty('Bu filtrede talep yok')}</div></section>`;
        }
    };

    HR.analytics = {
        title: 'Katılım, ek mesai & net bakiye analitiği', sub: () => 'En çok mesai yapanlar, net süre bakiyesi (ek mesai − gecikme) en iyiler/en kötüler ve kök neden analizi · ' + rangeLabel(), tools: { range: 1, branch: 1 }, icon: 'chart',
        render() {
            const st = stats(), curDays = activeDays(), d = curDays.length >= 3 ? curDays : D.DAYS.slice(-14);
            const avg = (k) => d.reduce((a, x) => a + x[k], 0) / (d.length || 1);
            const E = emps(), ds = deptStats(), lb = D.computeLeaderboards(E, filterOpts());
            const geofencePct = +(98.4 - (S.branch === 'ALL' ? 0 : 0.3)).toFixed(1);
            const maxOnTime = Math.max(...d.map(x => A.num(x.onTime * 100)));
            const minOnTime = Math.min(...d.map(x => A.num(x.onTime * 100)));

            return `${dndToolbar()}
            <div class="grid g-6">
                ${kpi({ label: 'Zamanında katılım', val: st.onTimePct, dec: 1, unit: '%', icon: 'check', tone: 'ok', delta: delta(st.onTimePct - st.prevPct, ' p'), foot: 'kurumsal hedef %95' })}
                ${kpi({ label: 'Ortalama mesai', val: avg('workH'), dec: 1, unit: 'sa', icon: 'clock', tone: '', foot: 'standart 8,5 sa/gün' })}
                ${kpi({ label: 'Toplam ek mesai', val: st.totalOvertimeH, dec: 1, unit: 'sa', icon: 'activity', tone: 'ok', foot: curDays.length + ' iş günü toplamı' })}
                ${kpi({ label: 'Net süre bakiyesi', val: +(st.netBalanceMin / 60).toFixed(1), dec: 1, unit: 'sa', icon: 'spark', tone: st.netBalanceMin >= 0 ? 'ok' : 'warn', foot: 'Ek mesai − gecikme' })}
                ${kpi({ label: 'Geofence (30m) uyum', val: geofencePct, dec: 1, unit: '%', icon: 'pin', tone: 'ok', foot: 'şube içi doğrulama' })}
                ${kpi({ label: 'Ort. gecikme süresi', val: st.avgLate, dec: 0, unit: 'dk', icon: 'alert', tone: 'warn', foot: 'geç kalan personel' })}
            </div>

            <!-- 3 Sütunlu Lig Tablosu: 1) En Çok Mesai Yapanlar, 2) Net Süre En İyiler, 3) Net Süre En Kötüler -->
            <div class="grid g-3 mt">
                <section class="card flush">
                    ${cardHead('1. En çok ek mesai yapanlar', rangeLabel() + ' · fazla mesai şampiyonları', dlBtn('export-leaderboards', 'Excel', { cls: 'btn-soft btn-sm' }))}
                    <div class="list" style="margin-top:4px">
                        ${lb.topOvertime.slice(0, 7).map((a, i) => `<div class="list-item clickable" data-act="emp-open" data-id="${a.emp.id}" style="cursor:pointer">
                            <span class="rank-badge r${i + 1}">${i + 1}</span>
                            ${avatar(a.emp, 'sm')}
                            <div class="grow">
                                <b>${esc(a.emp.name)}</b>
                                <small>${esc(a.emp.dept)} · En çok: <b>${esc(a.mostOvertimeDay.dowName)}</b> (+${a.mostOvertimeDay.totalOvertimeMin} dk)</small>
                            </div>
                            <div style="text-align:right">
                                ${pill('+' + fmtMinDur(a.totalOvertimeMin), 'ok')}
                                <small class="muted mono" style="font-size:10.5px;display:block;margin-top:2px">${a.overtimeDays} gün mesai</small>
                            </div>
                        </div>`).join('')}
                    </div>
                </section>

                <section class="card flush">
                    ${cardHead('2. Net bakiye en iyiler (Mesai − Geç)', 'Ek mesaiden gecikme çıkınca kalan sürede zirvedekiler')}
                    <div class="list" style="margin-top:4px">
                        ${lb.bestNet.slice(0, 7).map((a, i) => `<div class="list-item clickable" data-act="emp-open" data-id="${a.emp.id}" style="cursor:pointer">
                            <span class="rank-badge r${i + 1}">${i + 1}</span>
                            ${avatar(a.emp, 'sm')}
                            <div class="grow">
                                <b>${esc(a.emp.name)}</b>
                                <small>Ek Mesai: <span style="color:var(--ok);font-weight:700">+${a.totalOvertimeMin} dk</span> · Geç: <span style="color:var(--bad);font-weight:700">−${a.totalLateMin} dk</span></small>
                            </div>
                            <div style="text-align:right">
                                ${netPill(a.netBalanceMin)}
                                <small class="muted" style="font-size:10.5px;display:block;margin-top:2px">Ort. ${String(a.avgWorkH).replace('.', ',')} sa/gün</small>
                            </div>
                        </div>`).join('')}
                    </div>
                </section>

                <section class="card flush">
                    ${cardHead('3. Net bakiye en kötüler (Mesai − Geç)', 'Gecikme süresi ek mesaisini aşan / en düşük net süreliler')}
                    <div class="list" style="margin-top:4px">
                        ${lb.worstNet.slice(0, 7).map((a, i) => `<div class="list-item clickable" data-act="emp-open" data-id="${a.emp.id}" style="cursor:pointer">
                            <span class="rank-badge">${i + 1}</span>
                            ${avatar(a.emp, 'sm')}
                            <div class="grow">
                                <b>${esc(a.emp.name)}</b>
                                <small>Geç: <span style="color:var(--bad);font-weight:700">−${a.totalLateMin} dk</span> (${esc(a.mostLateDay.dowShort)}) · Mesai: <span style="color:var(--ok);font-weight:700">+${a.totalOvertimeMin} dk</span></small>
                            </div>
                            <div style="text-align:right">
                                ${netPill(a.netBalanceMin)}
                                <small class="muted" style="font-size:10.5px;display:block;margin-top:2px">${a.lateDays} gün gecikme</small>
                            </div>
                        </div>`).join('')}
                    </div>
                </section>
            </div>

            <div class="grid g-main mt">
                <section class="card">
                    ${cardHead('Katılım ve dakiklik trend analizi', 'Günlük zamanında giriş oranı (%) ve %95 kurumsal hedef çizgisi')}
                    <div id="chTrendDual"></div>
                    <div class="stat-mini-grid">
                        <div class="stat-mini"><small>En Yüksek Uyum</small><b style="color:var(--ok)">%${String(maxOnTime).replace('.', ',')}</b></div>
                        <div class="stat-mini"><small>En Düşük Uyum</small><b style="color:var(--warn)">%${String(minOnTime).replace('.', ',')}</b></div>
                        <div class="stat-mini"><small>Vardiya Başlangıç Ort.</small><b>08:26</b></div>
                    </div>
                </section>
                <section class="card">${cardHead('Gecikme kök neden & süre kırılımı', 'Geç giriş kayıtlarının süre ve neden dağılımı')}<div id="chLateRoot"></div></section>
            </div>

            <div class="grid g-2 mt">
                <section class="card">${cardHead('Haftanın gününe göre geç kalma vs ek mesai', 'Pazartesi–Cuma kişi başı ortalama gecikme ve ek mesai eğilimi')}<div id="chWeekday"></div></section>
                <section class="card">${cardHead('Günlük fazla mesai yükü & 8,5 sa istikrarı', 'Toplam fazla mesai saati · ' + rangeLabel())}<div id="chOT"></div></section>
            </div>

            <div class="grid g-3 mt">
                <section class="card">${cardHead('Şubelere göre zamanında gelme', rangeLabel())}<div id="chBranch"></div></section>
                <section class="card">${cardHead('İzin & mazeret türleri', 'Onaylanan ve bekleyen talep dağılımı')}<div id="chLeaveType"></div></section>
                <section class="card">${cardHead('Gecikme süresi trendi', 'Günlük ortalama gecikme (dk)')}<div id="chLateMin"></div></section>
            </div>

            <div class="grid g-main mt">
                <section class="card flush">
                    ${cardHead('Departman bazlı performans, ek mesai ve net bakiye matrisi', 'Birimlerin giriş saati, fazla mesai, gecikme ve net süre bakiyesi karşılaştırması', dlBtn('export-analytics', 'Matrisi Excel İndir (.xlsx)', { cls: 'btn-soft btn-sm' }))}
                    <div class="table-wrap">
                        <table>
                            <thead><tr><th>Departman</th><th>Kişi</th><th>Ort. Giriş</th><th>Ort. Mesai</th><th>Top. Ek Mesai</th><th>Top. Gecikme</th><th>Net Bakiye</th><th>Uyum Oranı</th><th>Durum</th></tr></thead>
                            <tbody>
                                ${ds.map((x, i) => `<tr style="--r:${i}">
                                    <td><b>${esc(x.d)}</b></td>
                                    <td class="mono">${x.n}</td>
                                    <td class="mono">${x.avgIn}</td>
                                    <td class="mono">${String(x.avgWorkH).replace('.', ',')} sa</td>
                                    <td class="mono" style="color:var(--ok)"><b>+${fmtMinDur(x.totalOvertimeMin)}</b></td>
                                    <td class="mono" style="color:var(--warn)">−${fmtMinDur(x.totalLateMin)}</td>
                                    <td>${netPill(x.netMin)}</td>
                                    <td class="mono"><b>%${A.pctText(x.pct)}</b></td>
                                    <td>${pill(x.pct >= 93 ? 'Yüksek Uyum' : x.pct >= 88 ? 'Normal' : 'İzlenmeli', x.pct >= 93 ? 'ok' : x.pct >= 88 ? 'info' : 'warn')}</td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </section>
                <section class="card">
                    ${cardHead('Haftanın günleri (Pzt–Cum) kurum özeti', rangeLabel() + ' · hangi gün geç kalınıyor, hangi gün mesai yapılıyor?')}
                    <div id="chWeekdayTable"></div>
                </section>
            </div>`;
        },
        mount() {
            const curDays = activeDays(), d = curDays.length >= 3 ? curDays : D.DAYS.slice(-14), E = emps(), lb = D.computeLeaderboards(E, filterOpts());
            A.areaChart($('#chTrendDual'), {
                labels: d.map(x => x.label),
                series: [
                    { data: d.map(x => A.num(x.onTime * 100)) },
                    { data: d.map(() => 95) }
                ],
                yMin: 80, yMax: 100, yFmt: v => v + '%',
                tip: (i, v) => `<b>${d[i].fullDate} (${d[i].dowName})</b>Gerçekleşen: %${String(v[0]).replace('.', ',')} · Hedef: %95`
            });
            const c10 = Math.max(3, lb.all.filter(e => e.totalLateMin > 0 && e.totalLateMin <= 35).length);
            const c25 = Math.max(2, lb.all.filter(e => e.totalLateMin > 35 && e.totalLateMin <= 90).length);
            const cCrit = Math.max(1, lb.all.filter(e => e.totalLateMin > 90).length);
            A.donut($('#chLateRoot'), {
                items: [
                    { label: 'Düşük Gecikme (Trafik / Ulaşım)', value: c10, color: '#1C1D1F' },
                    { label: 'Orta Gecikme (Sabah Yoğunluğu)', value: c25, color: '#E31E24' },
                    { label: 'Yüksek Gecikme (Kritik Takip)', value: cCrit, color: '#C77700' },
                    { label: 'Saha / Dış Görev Kaynaklı', value: 4, color: '#8E949C' }
                ],
                centerTop: (c10 + c25 + cCrit + 4),
                centerSub: 'personel analizi'
            });

            // Haftanın günleri kurumsal toplamlar
            const wdNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
            const wdShort = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'];
            const wdAgg = [1, 2, 3, 4, 5].map((dow, i) => {
                let lateMin = 0, otMin = 0, lateCnt = 0;
                lb.all.forEach(a => {
                    const w = a.weekdayList[i];
                    if (w) { lateMin += w.totalLateMin; otMin += w.totalOvertimeMin; lateCnt += w.lateCount; }
                });
                return { dow, name: wdNames[i], short: wdShort[i], lateMin, otMin, netMin: otMin - lateMin, lateCnt };
            });

            A.barChart($('#chWeekday'), {
                data: wdAgg.map(w => ({ label: w.short, value: Math.round(w.lateMin / 60), otH: Math.round(w.otMin / 60), name: w.name })),
                accentLast: false, yFmt: v => v + ' sa',
                tip: x => `<b>${x.name}</b>Toplam Gecikme: ${x.value} sa · Ek Mesai: +${x.otH} sa`
            });
            A.areaChart($('#chOT'), { labels: d.map(x => x.label), series: [{ data: d.map(x => Math.round(x.overtimeH)) }], yFmt: v => v + ' sa', tip: (i, v) => `<b>${d[i].fullDate} (${d[i].dowName})</b>${v[0]} saat fazla mesai` });
            $('#chBranch').innerHTML = rank(D.BRANCHES.map(b => { const L = D.EMPLOYEES.filter(e => e.branch === b.code), p = A.clamp((L.filter(e => e.status === 'PRESENT').length / (L.length || 1)) * 100, 0, 100); return { l: b.name, v: A.pctText(p) + '%', w: p, cls: p > 92 ? 'ok' : '' }; }));
            const lt = D.LEAVE_TYPES.map((t, i) => ({ label: t, value: D.LEAVES.filter(l => l.type === t).length, color: ['#1C1D1F', '#E31E24', '#8E949C', '#D9DBDF'][i] }));
            A.donut($('#chLeaveType'), { items: lt, centerTop: D.LEAVES.length, centerSub: 'talep' });
            A.areaChart($('#chLateMin'), { labels: d.map(x => x.label), series: [{ data: d.map(x => Math.round(x.lateMin)) }], yFmt: v => v + ' dk', h: 200, tip: (i, v) => `<b>${d[i].fullDate}</b>${v[0]} dk ortalama` });

            $('#chWeekdayTable').innerHTML = `<div class="table-wrap"><table style="font-size:12.5px">
                <thead><tr><th>Gün</th><th>Top. Gecikme</th><th>Top. Ek Mesai</th><th>Net Bakiye</th></tr></thead>
                <tbody>${wdAgg.map(w => `<tr>
                    <td><b>${w.name}</b></td>
                    <td class="mono" style="color:var(--warn)">−${fmtMinDur(w.lateMin)}</td>
                    <td class="mono" style="color:var(--ok)">+${fmtMinDur(w.otMin)}</td>
                    <td>${netPill(w.netMin)}</td>
                </tr>`).join('')}</tbody>
            </table></div>`;
        }
    };

    /* =========================================================================
       TAM SAYFA PERSONEL PROFILI — #/profile rotasi
       Cekmece (drawer) yerine ayri ekran: geri butonu + derin analiz.
       ========================================================================= */
    HR.profile = {
        title: 'Personel profili',
        sub: () => (S.openEmpId && emp(S.openEmpId)) ? emp(S.openEmpId).name + ' · derin analiz · ' + rangeLabel() : rangeLabel(),
        tools: { range: 1 },
        icon: 'users',
        render() {
            const e = emp(S.openEmpId);
            if (!e) {
                return `<section class="card">${empty('Personel seçilmedi', 'Personel listesinden bir kişi seçin.')}
                    <div style="margin-top:14px"><button type="button" class="btn btn-primary" data-go="employees">Personel listesine dön</button></div></section>`;
            }

            const an = D.empAnalytics(e.id, filterOpts());
            const totBar = Math.max(1, an.totalOvertimeMin + an.totalLateMin);
            const otPct = Math.round((an.totalOvertimeMin / totBar) * 100);

            const deptEmps = D.EMPLOYEES.filter(x => x.dept === e.dept);
            const deptLb = D.computeLeaderboards(deptEmps, filterOpts());
            const dn = deptLb.all.length || 1;
            const deptAvgOt = Math.round(deptLb.all.reduce((a, x) => a + x.totalOvertimeMin, 0) / dn);
            const deptAvgLate = Math.round(deptLb.all.reduce((a, x) => a + x.totalLateMin, 0) / dn);

            const stat = (etiket, deger, alt, ton) =>
                `<div class="profile-stat${ton ? ' ' + ton : ''}"><span>${esc(etiket)}</span><b>${deger}</b><small>${esc(alt)}</small></div>`;

            return `<div class="profile-screen">
                <section class="profile-hero">
                    <div class="profile-hero-in">
                        ${avatar(e, 'lg')}
                        <div class="profile-hero-txt">
                            <h2>${esc(e.name)}</h2>
                            <p>${esc(e.title)} · ${esc(e.dept)} · <span class="mono">${e.sicil}</span></p>
                            <div class="profile-hero-tags">
                                ${pill(STATUS[e.status][0], STATUS[e.status][1])}
                                ${pill(brName(e.branch), 'mute')}
                                ${netPill(an.netBalanceMin)}
                                ${pill('Dönem: ' + rangeLabel(), 'mute')}
                            </div>
                        </div>
                        <div class="profile-hero-actions">
                            <button type="button" class="btn btn-soft btn-sm" data-go="employees">Listeye dön</button>
                            ${dlBtn('export-one', 'Excel (.xlsx)', { cls: 'btn-dark btn-sm', id: e.id })}
                        </div>
                    </div>
                </section>

                <div class="profile-stat-grid">
                    ${stat('Toplam Ek Mesai', '+' + fmtMinDur(an.totalOvertimeMin), an.overtimeDays + ' günde gerçekleşti', 'ok')}
                    ${stat('Toplam Gecikme', an.totalLateMin > 0 ? '−' + fmtMinDur(an.totalLateMin) : '0 dk', an.lateDays + ' günde geç kaldı', an.totalLateMin > 0 ? 'warn' : '')}
                    ${stat('Net Süre Bakiyesi', fmtMinSigned(an.netBalanceMin), 'Ek mesai − gecikme', an.netBalanceMin >= 0 ? 'ok' : 'bad')}
                    ${stat('Ort. Giriş', an.avgCheckIn, 'Ortalama çıkış ' + an.avgCheckOut, 'info')}
                    ${stat('Günlük Ort. Mesai', String(an.avgWorkH).replace('.', ',') + ' sa', 'Kurumsal hedef 8,5 sa', '')}
                    ${stat('Devam / Katılım', an.attendedDays + ' / ' + an.logs.length + ' gün', 'İşe gelinen iş günü', 'red')}
                </div>
                ${profileTerazi(an, otPct)}
                ${profileKiyas(e, an, deptAvgOt, deptAvgLate)}
                <section class="card">
                    <div class="profile-section-head"><span class="n">3</span><h3>Çalışma saati istikrarı</h3><small>8,5 sa referanslı</small></div>
                    <div id="prChart"></div>
                </section>
                ${profileGunluk(an)}
            </div>`;
        }
    };

    /* Profil ekrani yardimcilari */
    function profileTerazi(an, otPct) {
        return `<section class="card">
            <div class="profile-section-head"><span class="n">1</span><h3>Ek Mesai ve Gecikme Süresi Terazisi</h3><small>${esc(rangeLabel())}</small></div>
            <p class="muted" style="font-size:var(--fs-sm);margin-bottom:10px">
                Ek mesai ${fmtMinDur(an.totalOvertimeMin)}, gecikme ${fmtMinDur(an.totalLateMin)} olarak gerçekleşti; aradaki fark <b>${fmtMinSigned(an.netBalanceMin)}</b>.
            </p>
            <div class="net-split" role="img" aria-label="Ek mesai ve gecikme dengesi">
                <div class="net-split-ot" style="width:${otPct}%"></div>
                <div class="net-split-late" style="width:${100 - otPct}%"></div>
            </div>
            <div style="display:flex;justify-content:space-between;gap:10px;margin-top:9px;font-size:var(--fs-sm);font-weight:600;flex-wrap:wrap">
                <span style="color:var(--ok)">● Toplam Ek Mesai: +${fmtMinDur(an.totalOvertimeMin)} (%${otPct})</span>
                <span style="color:var(--bad)">● Toplam Gecikme: −${fmtMinDur(an.totalLateMin)} (%${100 - otPct})</span>
            </div>
        </section>`;
    }

    function profileCmpRow(etiket, deger, oran, ton) {
        const w = A.clamp(oran || 0, 4, 100);
        return `<div class="profile-cmp-row">
            <div class="lbl"><span>${esc(etiket)}</span><b>${esc(deger)}</b></div>
            <div class="profile-cmp-track"><div class="profile-cmp-fill ${ton || ''}" style="width:${w}%"></div></div>
        </div>`;
    }

    function profileKiyas(e, an, deptAvgOt, deptAvgLate) {
        return `<section class="card">
            <div class="profile-section-head"><span class="n">2</span><h3>${esc(e.dept)} birimi ile karşılaştırma</h3></div>
            <p class="muted" style="font-size:var(--fs-sm);margin-bottom:12px">Personelin departman ortalamasına göre konumu</p>
            <div class="profile-cmp">
                ${profileCmpRow(e.name + ' · Ek Mesai', '+' + fmtMinDur(an.totalOvertimeMin), (an.totalOvertimeMin / Math.max(60, deptAvgOt * 1.6)) * 100, 'ok')}
                ${profileCmpRow(e.dept + ' ortalaması', '+' + fmtMinDur(deptAvgOt), (deptAvgOt / Math.max(60, deptAvgOt * 1.6)) * 100, 'muted')}
                ${profileCmpRow(e.name + ' · Gecikme', '−' + fmtMinDur(an.totalLateMin), (an.totalLateMin / Math.max(30, deptAvgLate * 1.6)) * 100, 'warn')}
                ${profileCmpRow(e.dept + ' ortalaması', '−' + fmtMinDur(deptAvgLate), (deptAvgLate / Math.max(30, deptAvgLate * 1.6)) * 100, 'muted')}
            </div>
        </section>`;
    }

    function profileGunluk(an) {
        const satirlar = an.logs.slice().reverse().map(l => `<tr>
            <td class="mono"><b>${l.fullDate}</b></td>
            <td>${esc(l.dowName)}</td>
            <td class="mono">${l.checkIn || '—'}</td>
            <td class="mono">${l.checkOut || '—'}</td>
            <td class="mono">${l.workH ? String(l.workH).replace('.', ',') + ' sa' : '—'}</td>
            <td class="mono" style="color:${l.lateMin > 0 ? 'var(--warn)' : 'var(--muted)'}">${l.lateMin > 0 ? '−' + l.lateMin + ' dk' : '0 dk'}</td>
            <td class="mono" style="color:${l.overtimeMin > 0 ? 'var(--ok)' : 'var(--muted)'}">${l.overtimeMin > 0 ? '+' + l.overtimeMin + ' dk' : '0 dk'}</td>
            <td>${l.status === 'LEAVE' || l.status === 'ABSENT' ? pill(STATUS[l.status][0], STATUS[l.status][1]) : netPill(l.netMin)}</td>
            <td class="mono">${l.dist != null ? String(l.dist).replace('.', ',') + ' m' : '—'}</td>
        </tr>`).join('');

        return `<section class="card flush">
            <div class="profile-section-head" style="padding:18px 20px 9px;margin:0"><span class="n">4</span><h3>Gün gün giriş-çıkış, gecikme ve ek mesai</h3><small>${an.logs.length} iş günü</small></div>
            <div class="table-wrap" style="max-height:340px;overflow-y:auto">
                <table>
                    <thead><tr><th>Tarih</th><th>Gün</th><th>Giriş</th><th>Çıkış</th><th>Mesai</th><th>Gecikme</th><th>Ek Mesai</th><th>Net</th><th>Konum</th></tr></thead>
                    <tbody>${satirlar}</tbody>
                </table>
            </div>
        </section>`;
    }

    HR.reports = {
        title: 'Kurumsal Raporlar', sub: () => 'Bordro, üst yönetim ve denetim için resmi OpenXML Excel (.xlsx) raporları · ' + rangeLabel(), tools: { range: 1, branch: 1 }, icon: 'file',
        render() {
            const st = stats(), ds = deptStats(), days = activeDays();
            const p2 = n => String(n).padStart(2, '0');
            const now = new Date();
            const stamp = `${p2(now.getDate())}.${p2(now.getMonth() + 1)}.${now.getFullYear()} ${p2(now.getHours())}:${p2(now.getMinutes())}`;
            const reportNo = `PDKS-${now.getFullYear()}-${p2(now.getMonth() + 1)}${p2(now.getDate())}`;
            const hazirlayan = S.user ? S.user.name + ' — ' + S.user.title : 'İnsan Kaynakları Yönetimi';
            const subeAdi = S.branch === 'ALL' ? 'Tüm Şubeler (6 Lokasyon)' : brName(S.branch);

            const kpiCards = [
                { l: 'Toplam Personel', v: String(st.N), s: 'Aktif kadro', tone: '' },
                { l: 'Zamanında Giriş', v: '%' + A.pctText(st.onTimePct), s: st.onTime + ' personel zamanında', tone: 'ok' },
                { l: 'Toplam Gecikme', v: fmtMinDur(st.totalLateMin), s: st.late + ' personel geç kaldı', tone: 'bad' },
                { l: 'Toplam Ek Mesai', v: A.numText(st.totalOvertimeH) + ' sa', s: 'Onaylı fazla çalışma', tone: 'ok' },
                { l: 'Net Süre Bakiyesi', v: fmtMinSigned(st.netBalanceMin), s: 'Ek mesai − gecikme', tone: 'info' },
                { l: 'Geç Kalan / Devamsız', v: st.late + ' / ' + st.absent, s: 'Ort. ' + Math.round(st.avgLate) + ' dk gecikme', tone: 'warn' }
            ];

            const catalog = [
                ['export-emps', 'Kurumsal Puantaj ve Devam Raporu', 'Yönetici özeti, departman matrisi ve personel bazlı giriş-çıkış, gecikme, ek mesai ve net bakiye tablosu.', 'Ana belge'],
                ['export-leaderboards', 'Ek Mesai ve Net Süre Bakiyesi Ligi', 'En çok ek mesai yapanlar; net süre bakiyesinde en iyiler ve en kötüler sıralaması.', 'Sıralama'],
                ['export-analytics', 'İK Performans ve Departman Analitiği', 'Departman bazlı katılım, fazla mesai yükü ve günlük eğilim kırılımı.', 'Analitik'],
                ['export-late', 'Gecikme ve Devamsızlık Denetim Raporu', 'Geç kalan personel, gecikme günü ve şube kırılımı; disiplin süreci için.', 'Denetim'],
                ['export-leaves', 'İzin ve Mazeret Yönetim Raporu', 'İzin taleplerinin tür, süre ve onay durumu dökümü.', 'İK kayıt']
            ];

            const rowsHtml = ds.map(x => `<tr>
                    <td class="rpt-td-name">${esc(x.d)}</td>
                    <td class="num">${x.n}</td>
                    <td class="num">${esc(x.avgIn)}</td>
                    <td class="num ok">+${fmtMinDur(x.totalOvertimeMin)}</td>
                    <td class="num bad">−${fmtMinDur(x.totalLateMin)}</td>
                    <td>${netPill(x.netMin)}</td>
                    <td class="num">%${A.pctText(x.pct)}</td>
                </tr>`).join('');
            return `<div class="rpt-shell">
              <article class="rpt-doc">
                <header class="rpt-head">
                  <img class="rpt-logo" src="assets/branding/albayrak_pdks_logo.svg" alt="Albayrak Finans kurumsal logosu" width="62" height="52">
                  <div class="rpt-head-txt">
                    <h2>ALBAYRAK TASARRUF FİNANSMAN A.Ş.</h2>
                    <p>Personel Devam Kontrol Sistemi (PDKS) · İnsan Kaynakları Müdürlüğü</p>
                    <p class="rpt-kunye"><span>Rapor No: <b>${esc(reportNo)}</b></span><span>Üretim: ${esc(stamp)}</span><span>Nüsha: Orijinal</span></p>
                  </div>
                </header>
                <div class="rpt-rule"></div>
                <div class="rpt-title">
                  <h1>PERSONEL PUANTAJ, DEVAM VE PERFORMANS RAPORU</h1>
                  <p>Gecikme, fazla mesai, net süre bakiyesi ve 30 m şube geofence doğrulama özeti</p>
                </div>
                <dl class="rpt-meta">
                  <div><dt>Rapor Dönemi</dt><dd>${esc(rangeLabel())}</dd></div>
                  <div><dt>Şube Kapsamı</dt><dd>${esc(subeAdi)}</dd></div>
                  <div><dt>İş Günü Sayısı</dt><dd>${days.length} iş günü</dd></div>
                  <div><dt>Hazırlayan</dt><dd>${esc(hazirlayan)}</dd></div>
                </dl>

                <h3 class="rpt-sec"><span>1</span> Yönetici Özeti Göstergeleri</h3>
                <div class="rpt-kpis">${kpiCards.map(k => `<div class="rpt-kpi ${k.tone}"><span>${esc(k.l)}</span><b>${esc(k.v)}</b><small>${esc(k.s)}</small></div>`).join('')}</div>

                <h3 class="rpt-sec"><span>2</span> Departman Bazlı Performans Özeti</h3>
                <div class="rpt-tablewrap"><table class="rpt-table">
                  <thead><tr><th>Departman</th><th>Personel</th><th>Ort. Giriş</th><th>Top. Ek Mesai</th><th>Top. Gecikme</th><th>Net Bakiye</th><th>Uyum</th></tr></thead>
                  <tbody>${rowsHtml}</tbody>
                </table></div>

                <h3 class="rpt-sec"><span>3</span> Rapor Kataloğu ve İndirme</h3>
                <p class="rpt-lead">Aşağıdaki belgeler seçili dönem ve şube kapsamı için <b>A4 yatay</b> yazdırmaya hazır, kurumsal antetli ve logolu <b>.xlsx</b> biçiminde üretilir. Her belgede rapor numarası, hazırlayan / onaylayan imza bloğu, tekrarlanan tablo başlığı ve sayfa numarası bulunur.</p>
                <div class="rpt-catalog">${catalog.map((c, i) => `<div class="rpt-doc-row">
                    <span class="rpt-doc-no">${String(i + 1).padStart(2, '0')}</span>
                    <div class="rpt-doc-txt"><b>${esc(c[1])}</b><small>${esc(c[2])}</small></div>
                    <span class="rpt-tag">${esc(c[3])}</span>
                    ${dlBtn(c[0], 'İndir (.xlsx)', { cls: 'btn-dark btn-sm' })}
                  </div>`).join('')}</div>

                <h3 class="rpt-sec"><span>4</span> Değerlendirme ve Metodoloji Notu</h3>
                <ol class="rpt-notes">
                  <li>Gecikme süresi, vardiya başlangıç saatine göre hesaplanan pozitif sapmadır.</li>
                  <li>Ek mesai süresi, vardiya bitişinden sonra gerçekleşen onaylı çalışma süresidir.</li>
                  <li>Net süre bakiyesi = <b>Toplam ek mesai − Toplam gecikme</b>. Negatif bakiye kayıp süreyi gösterir.</li>
                  <li>Konum doğrulaması şube merkezine 30 metre yarıçapla sınırlıdır; sahte konum (mock GPS) tespiti blokajla sonuçlanır.</li>
                  <li>Kayıtlar KVKK kapsamında yalnızca puantaj ve iş hukuku yükümlülükleri için işlenir.</li>
                </ol>

                <footer class="rpt-sign">
                  <div class="rpt-sign-col"><span>Hazırlayan</span><b>${esc(hazirlayan)}</b></div>
                  <div class="rpt-sign-col"><span>Onaylayan</span><b>İnsan Kaynakları Müdürlüğü</b></div>
                </footer>
                <p class="rpt-foot">Bu belge Albayrak Tasarruf Finansman A.Ş. PDKS sistemi tarafından otomatik üretilmiştir. Yetkisiz kopyalanması ve dağıtılması yasaktır.</p>
              </article>

              <aside class="rpt-side">
                <section class="card flush">
                  ${cardHead('Belge ayarları', 'Tüm çıktılar için geçerli')}
                  <div class="rpt-spec">
                    <div><span>Kağıt</span><b>A4 · Yatay</b></div>
                    <div><span>Ölçek</span><b>1 sayfa genişliği</b></div>
                    <div><span>Başlık tekrarı</span><b>Her sayfada</b></div>
                    <div><span>Alt bilgi</span><b>Rapor no · Sayfa X / Y</b></div>
                    <div><span>Kurumsal antet</span><b>Logo + unvan</b></div>
                    <div><span>İmza bloğu</span><b>Hazırlayan / Onaylayan</b></div>
                    <div><span>Format</span><b>OpenXML .xlsx</b></div>
                  </div>
                </section>
                <section class="card flush mt">
                  ${cardHead('Veri saklama', 'KVKK kapsamında')}
                  <p class="rpt-kvkk">Giriş-çıkış ve konum doğrulama kayıtları yalnızca puantaj ve iş hukuku yükümlülükleri için işlenir. Saklama süresi sonunda kayıtlar silinir veya anonimleştirilir. Ayrıntılar için üst çubuktaki kilit simgesine tıklayın.</p>
                </section>
              </aside>
            </div>`;
        }
    };

    /* ======================= BT SAYFALARI (Mobil App ile %100 Uyumlu + Daha Detaylı) ======================= */
    const IT = {};
    const openAlerts = () => D.ALERTS.filter(a => !a.resolved);
    const openTickets = () => D.TICKETS.filter(t => t.status !== 'done');

    IT.overview = {
        title: 'Sistem durumu & güvenlik politikaları', sub: () => 'Uygulama sağlığı, aktif güvenlik kuralları ve cihaz/oturum özeti · ' + rangeLabel(), tools: { range: 1 }, icon: 'grid',
        render() {
            const dv = D.DEVICES, bound = dv.filter(d => d.status === 'BOUND').length, series = failSeries();
            const vers = ['2.4.1', '2.3.8', '2.2.0'].map(v => ({ l: 'v' + v, n: dv.filter(d => d.ver === v).length }));
            const pol = S.ui.policies;
            return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap">
                <span class="muted" style="font-size:12.5px;display:inline-flex;align-items:center;gap:6px">${ic('grip')} Kutuları sürükleyip bırakarak BT panel düzenini özelleştirebilirsiniz</span>
                <div style="display:flex;gap:8px;align-items:center">
                    <button type="button" class="dnd-hint" data-act="dnd-reset">${ic('refresh')} Düzeni Sıfırla</button>
                    ${dlBtn('export-it', 'BT Güvenlik Raporu (.xlsx)', { cls: 'btn-dark btn-sm' })}
                </div>
            </div>
            <div class="grid g-4">
                ${kpi({ label: 'Eşlenmiş cihaz', val: bound, icon: 'phone', tone: 'ok', foot: dv.length + ' cihazdan · Tekil kilit aktif' })}
                ${kpi({ label: 'Açık güvenlik uyarısı', val: openAlerts().length, icon: 'shield', tone: 'red', foot: openAlerts().filter(a => a.sev === 'HIGH').length + ' yüksek önem' })}
                ${kpi({ label: 'Bekleyen destek talebi', val: openTickets().length, icon: 'key', tone: 'warn', foot: 'parola, kilit, cihaz' })}
                ${kpi({ label: 'Hatalı giriş denemesi', val: series.reduce((a, b) => a + b, 0), icon: 'lock', tone: 'info', foot: rangeLabel(), spark: A.spark(series.slice(-14), '#3A66C4') })}
            </div>
            <div class="grid g-main mt">
                <section class="card">${cardHead('Hatalı giriş denemeleri', S.range === 1 && !S.fromDate ? 'Saatlik · son 24 saat' : 'Günlük · ' + rangeLabel())}<div id="chFail"></div></section>
                <section class="card">${cardHead('Sistem sağlığı & servis telemetrisi', 'Canlı BT izleme')}<div class="health">
                    <div class="health-item"><small>API durumu</small><b><span class="pulse"></span> Çalışıyor</b></div>
                    <div class="health-item"><small>Çalışma süresi (30 g)</small><b>%99,98</b></div>
                    <div class="health-item"><small>Ort. yanıt süresi</small><b>142 ms</b></div>
                    <div class="health-item"><small>Senkron kuyruğu</small><b>3 kayıt</b></div>
                    <div class="health-item"><small>Son yedek</small><b>03:00 (Başarılı)</b></div>
                    <div class="health-item"><small>Çökmesiz oturum</small><b>%99,4</b></div></div></section>
            </div>
            <div class="grid g-3 mt">
                <section class="card">${cardHead('Uyarı türleri', 'Tüm kayıtlar')}<div id="chAlertType"></div></section>
                <section class="card">${cardHead('Uygulama sürümleri', 'Eşlenmiş cihazlar')}${rank(vers.map((v, i) => ({ l: v.l + (i ? ' · güncelleme gerekli' : ' · güncel'), v: v.n, w: A.clamp(v.n / (dv.length || 1) * 100, 0, 100), cls: i ? 'warn' : 'ok' })))}</section>
                <section class="card flush">
                    ${cardHead('Aktif güvenlik politikaları', 'Mobil uygulama ve web uç nokta kuralları')}
                    <div>
                        <div class="policy-row"><div><b style="font-size:13px;display:block">30m Şube Geofence Zorunluluğu</b><small class="muted">30 metre dışındaki giriş-çıkışları engelle</small></div><button type="button" class="sw ${pol.geofence30m ? 'on' : ''}" data-act="pol-toggle" data-k="geofence30m" aria-label="30m Geofence"></button></div>
                        <div class="policy-row"><div><b style="font-size:13px;display:block">Sahte GPS (Mock Location) Engeli</b><small class="muted">Geliştirici sahte konum tespitinde oturumu kilitle</small></div><button type="button" class="sw ${pol.mockGpsBlock ? 'on' : ''}" data-act="pol-toggle" data-k="mockGpsBlock" aria-label="Sahte GPS Engeli"></button></div>
                        <div class="policy-row"><div><b style="font-size:13px;display:block">Tekil Cihaz Eşleme Kilidi</b><small class="muted">Her personel yalnızca 1 onaylı cihazdan giriş yapabilir</small></div><button type="button" class="sw ${pol.singleDevice ? 'on' : ''}" data-act="pol-toggle" data-k="singleDevice" aria-label="Tekil Cihaz"></button></div>
                        <div class="policy-row"><div><b style="font-size:13px;display:block">15 Dk Otomatik Oturum Zaman Aşımı</b><small class="muted">Hareketsiz kalan yönetici ve mobil oturumları kapat</small></div><button type="button" class="sw ${pol.autoTimeout ? 'on' : ''}" data-act="pol-toggle" data-k="autoTimeout" aria-label="Otomatik Zaman Aşımı"></button></div>
                    </div>
                </section>
            </div>
            <div class="grid g-2 mt">
                <section class="card flush">${cardHead('Açık destek talepleri', '', `<button class="btn btn-soft btn-sm" data-go="support">Tümü</button>`)}<div class="list" style="margin-top:8px">${openTickets().slice(0, 4).map(t => { const e = emp(t.empId); return `<div class="list-item">${avatar(e, 'sm')}<div class="grow"><b>${esc(e.name)}</b><small>${D.TICKET_TYPES[t.type]} · ${t.ago} önce</small></div></div>`; }).join('')}</div></section>
                <section class="card flush">${cardHead('Son güvenlik uyarıları', '', `<button class="btn btn-soft btn-sm" data-go="security">Tümü</button>`)}<div class="list" style="margin-top:8px">${openAlerts().slice(0, 4).map(alertRow).join('')}</div></section>
            </div>`;
        },
        mount() {
            const s = failSeries(), d = activeDays();
            A.areaChart($('#chFail'), { labels: d.length === 1 ? s.map((_, i) => pad(i) + ':00') : d.map(x => x.label), series: [{ data: s }], tip: (i, v) => `<b>${d.length === 1 ? pad(i) + ':00' : d[i].fullDate}</b>${v[0]} hatalı deneme` });
            const cnt = k => D.ALERTS.filter(a => a.type === k).length, cols = ['#E31E24', '#1C1D1F', '#8E949C', '#B8161B', '#D9DBDF'];
            A.donut($('#chAlertType'), { items: Object.keys(D.ALERT_TYPES).map((k, i) => ({ label: D.ALERT_TYPES[k], value: cnt(k), color: cols[i] })), centerTop: D.ALERTS.length, centerSub: 'uyarı' });
        }
    };
    function failSeries() {
        const d = activeDays(), r = A.rng(404 + d.length);
        if (d.length === 1) return Array.from({ length: 24 }, (_, h) => Math.round((h >= 7 && h <= 9 ? 9 : h >= 17 && h <= 18 ? 4 : 1.2) * (.6 + r() * .8) + (h === 3 ? 11 : 0)));
        return d.map(() => Math.round(18 + r() * 24));
    }
    function alertRow(a) {
        const e = emp(a.empId), tone = { HIGH: 'bad', MED: 'warn', LOW: 'mute' }[a.sev], sl = { HIGH: 'Yüksek', MED: 'Orta', LOW: 'Düşük' }[a.sev];
        return `<div class="list-item"><span class="ico-sq ${a.sev === 'HIGH' ? 'red' : a.sev === 'MED' ? 'warn' : ''}">${ic(a.type === 'MOCK_GPS' || a.type === 'GEOFENCE' ? 'pin' : a.type === 'DEVICE' ? 'phone' : a.type === 'BRUTE' ? 'lock' : 'shield')}</span><div class="grow"><b>${D.ALERT_TYPES[a.type]}</b><small>${esc(e.name)} · ${esc(brName(a.branch))} · ${a.ago} önce</small></div>${pill(sl, tone)}</div>`;
    }

    IT.support = {
        title: 'Destek & parola yönetimi', sub: () => 'Parola, kilit ve cihaz talepleri', tools: {}, icon: 'key',
        render() {
            const u = S.ui.tk, cnt = s => D.TICKETS.filter(t => t.status === s).length, q = u.q.toLocaleLowerCase('tr-TR').trim();
            const L = D.TICKETS.filter(t => (u.f === 'all' || t.status === u.f) && (u.type === 'ALL' || t.type === u.type) && (!q || (emp(t.empId).name + emp(t.empId).sicil).toLocaleLowerCase('tr-TR').includes(q)));
            const tone = { open: ['Açık', 'warn'], progress: ['İşlemde', 'info'], done: ['Çözüldü', 'ok'] };
            return `<section class="card flush"><div class="toolbar">${searchEl('tk-q', u.q, 'Personel adı veya sicil')}
                ${chips([{ v: 'open', l: 'Açık', n: cnt('open') }, { v: 'progress', l: 'İşlemde', n: cnt('progress') }, { v: 'done', l: 'Çözüldü', n: cnt('done') }, { v: 'all', l: 'Tümü', n: D.TICKETS.length }], u.f, 'tk-filter')}
                <span class="grow"></span>${selectEl('tk-type', [{ v: 'ALL', l: 'Tüm türler' }].concat(Object.keys(D.TICKET_TYPES).map(k => ({ v: k, l: D.TICKET_TYPES[k] }))), u.type, 'Tür')}</div>
                <div class="list">${L.length ? L.map(t => { const e = emp(t.empId), tn = tone[t.status]; return `<div class="list-item" style="animation:rowIn .45s var(--ease) both">${avatar(e)}<div class="grow"><b>${esc(e.name)} <span class="muted mono" style="font-weight:500;font-size:12px">${e.sicil}</span></b><small>${D.TICKET_TYPES[t.type]} · ${esc(t.note)} · ${t.ago} önce</small></div>${pill(tn[0], tn[1])}
                ${t.status !== 'done' ? `<div class="row-actions">${t.type === 'FORGOT' || t.type === 'LOCKED' ? `<button class="btn btn-primary btn-sm" data-act="tk-reset" data-id="${t.id}">${ic('key')}Geçici parola</button>` : ''}${t.type === 'LOCKED' ? `<button class="btn btn-soft btn-sm" data-act="tk-unlock" data-id="${t.id}">Kilidi aç</button>` : ''}${t.type === 'DEVICE' ? `<button class="btn btn-primary btn-sm" data-act="tk-device" data-id="${t.id}">${ic('unlink')}Eşlemeyi sıfırla</button>` : ''}${t.type === 'ERROR' && t.status === 'open' ? `<button class="btn btn-soft btn-sm" data-act="tk-progress" data-id="${t.id}">İncele</button>` : ''}<button class="btn btn-ghost btn-sm" data-act="tk-done" data-id="${t.id}" aria-label="Çözüldü">${ic('check')}</button></div>` : ''}</div>`; }).join('') : empty('Talep yok', 'Bu filtrede gösterilecek bir kayıt bulunmuyor.')}</div></section>`;
        }
    };

    IT.security = {
        title: 'Güvenlik radarı', sub: () => 'Sahte konum, cihaz ve oturum uyarıları', tools: {}, icon: 'shield',
        render() {
            const u = S.ui.alert, base = D.ALERTS.filter(a => u.show === 'all' || (u.show === 'open' ? !a.resolved : a.resolved));
            const L = base.filter(a => (u.sev === 'ALL' || a.sev === u.sev) && (u.type === 'ALL' || a.type === u.type)), c = s => base.filter(a => a.sev === s).length;
            return `<section class="card flush"><div class="toolbar">${chips([{ v: 'ALL', l: 'Tümü', n: base.length }, { v: 'HIGH', l: 'Yüksek', n: c('HIGH') }, { v: 'MED', l: 'Orta', n: c('MED') }, { v: 'LOW', l: 'Düşük', n: c('LOW') }], u.sev, 'al-sev')}
                <span class="grow"></span>${selectEl('al-type', [{ v: 'ALL', l: 'Tüm türler' }].concat(Object.keys(D.ALERT_TYPES).map(k => ({ v: k, l: D.ALERT_TYPES[k] }))), u.type, 'Tür')}
                ${selectEl('al-show', [{ v: 'open', l: 'Açık' }, { v: 'done', l: 'Çözülen' }, { v: 'all', l: 'Tümü' }], u.show, 'Durum')}
                ${dlBtn('export-it', 'Excel İndir (.xlsx)', { cls: 'btn-soft btn-sm' })}</div>
                <div class="table-wrap"><table><thead><tr><th>Zaman</th><th>Personel</th><th>Şube</th><th>Tür</th><th>Önem</th><th></th></tr></thead><tbody>${L.length ? L.map((a, i) => { const e = emp(a.empId), tone = { HIGH: 'bad', MED: 'warn', LOW: 'mute' }[a.sev]; return `<tr style="--r:${i}"><td class="mono muted">${a.ago} önce</td><td><div class="cell-user">${avatar(e, 'sm')}<div><b>${esc(e.name)}</b><small class="mono">${e.sicil}</small></div></div></td><td>${esc(brName(a.branch))}</td><td>${D.ALERT_TYPES[a.type]}${a.dist ? ` <span class="muted mono">· ${a.dist} m</span>` : ''}</td><td>${pill({ HIGH: 'Yüksek', MED: 'Orta', LOW: 'Düşük' }[a.sev], tone)}</td><td><div class="row-actions">${a.resolved ? pill('Çözüldü', 'ok') : `<button class="btn btn-soft btn-sm" data-act="al-resolve" data-id="${a.id}">${ic('check')}Çözüldü</button>${a.type === 'MOCK_GPS' || a.type === 'ROOT' ? `<button class="btn btn-bad btn-sm" data-act="al-block" data-id="${a.id}">Cihazı engelle</button>` : ''}`}</div></td></tr>`; }).join('') : `<tr><td colspan="6">${empty('Uyarı yok', 'Seçili filtrede kayıt bulunmuyor.')}</td></tr>`}</tbody></table></div></section>`;
        }
    };

    IT.devices = {
        title: 'Cihaz eşlemeleri', sub: () => 'Her personel tek cihaza bağlıdır', tools: {}, icon: 'phone',
        render() {
            const u = S.ui.dev, q = u.q.toLocaleLowerCase('tr-TR').trim();
            const L = D.DEVICES.filter(d => (u.status === 'ALL' || d.status === u.status) && (u.ver === 'ALL' || d.ver === u.ver) && (!q || (emp(d.empId).name + emp(d.empId).sicil + d.model).toLocaleLowerCase('tr-TR').includes(q))).slice(0, 60);
            const tone = { BOUND: ['Eşlendi', 'ok'], PENDING: ['Sıfırlandı · bekliyor', 'info'], BLOCKED: ['Engelli', 'bad'] };
            return `<section class="card flush"><div class="toolbar">${searchEl('dv-q', u.q, 'Personel, sicil veya model')}<span class="grow"></span>
                ${selectEl('dv-status', [{ v: 'ALL', l: 'Tüm durumlar' }, { v: 'BOUND', l: 'Eşlendi' }, { v: 'PENDING', l: 'Sıfırlandı' }, { v: 'BLOCKED', l: 'Engelli' }], u.status, 'Durum')}
                ${selectEl('dv-ver', [{ v: 'ALL', l: 'Tüm sürümler' }, { v: '2.4.1', l: 'v2.4.1' }, { v: '2.3.8', l: 'v2.3.8' }, { v: '2.2.0', l: 'v2.2.0' }], u.ver, 'Sürüm')}</div>
                <div class="table-wrap"><table><thead><tr><th>Cihaz</th><th>Personel</th><th>Sürüm</th><th>Son görülme</th><th>Durum</th><th></th></tr></thead><tbody>${L.length ? L.map((d, i) => { const e = emp(d.empId), t = tone[d.status]; return `<tr style="--r:${i}"><td><div class="cell-user"><span class="ico-sq">${ic('phone')}</span><div><b>${esc(d.model)}</b><small>${d.os} · <span class="mono">${d.mask}</span></small></div></div></td><td><b style="font-weight:600">${esc(e.name)}</b> <small class="muted mono">${e.sicil}</small></td><td>${pill('v' + d.ver, d.ver === '2.4.1' ? 'ok' : 'warn')}</td><td class="muted">${d.seen} dk önce</td><td>${pill(t[0], t[1])}</td><td><div class="row-actions">${d.status === 'BOUND' ? `<button class="btn btn-soft btn-sm" data-act="dv-unbind" data-id="${d.id}">${ic('unlink')}Eşlemeyi sıfırla</button>` : d.status === 'BLOCKED' ? `<button class="btn btn-soft btn-sm" data-act="dv-unblock" data-id="${d.id}">Engeli kaldır</button>` : ''}</div></td></tr>`; }).join('') : `<tr><td colspan="6">${empty('Cihaz bulunamadı')}</td></tr>`}</tbody></table></div></section>`;
        }
    };

    IT.branches = {
        title: 'Şubeler & 30m geofence doğrulama', sub: () => 'Konum doğrulama alanları, Wi-Fi BSSID/SSID doğrulaması ve canlı mesafe simülatörü', tools: {}, icon: 'building',
        render() {
            const simB = D.BRANCHES.find(b => b.code === S.ui.simBranch) || D.BRANCHES[0];
            const inside = S.ui.simDist <= simB.radius;
            return `<div class="grid g-main">
                <section class="card flush">
                    <div class="toolbar"><div><b>${D.BRANCHES.length} lokasyon</b> <span class="muted">· standart yarıçap 30 m</span></div><span class="grow"></span><button class="btn btn-primary btn-sm" data-act="br-add">${ic('plus')}Şube ekle</button></div>
                    <div class="table-wrap"><table><thead><tr><th>Şube</th><th>Koordinat</th><th>Yarıçap</th><th>Kurumsal Wi-Fi</th><th>Uptime</th><th>Personel</th></tr></thead><tbody>${D.BRANCHES.map((b, i) => `<tr style="--r:${i}"><td><div class="cell-user"><span class="ico-sq red">${ic('pin')}</span><div><b>${esc(b.name)}</b><small>${esc(b.city)} · <span class="mono">${b.code}</span></small></div></div></td><td class="mono">${b.lat.toFixed(4)}, ${b.lng.toFixed(4)}</td><td>${pill(b.radius + ' m', 'ok')}</td><td><span class="mono">${esc(b.wifi)}</span></td><td class="mono" style="color:var(--ok)"><b>%99,9</b></td><td class="mono">${D.EMPLOYEES.filter(e => e.branch === b.code).length}</td></tr>`).join('')}</tbody></table></div>
                </section>
                <section class="card">
                    ${cardHead('30m Geofence Canlı Simülatörü', 'Mobil uygulamadaki konum doğrulama motorunun şube bazlı testi')}
                    <div style="display:grid;gap:14px">
                        <div>
                            <small class="muted" style="font-weight:600;display:block;margin-bottom:6px">Test Edilen Şube</small>
                            ${selectEl('sim-branch', D.BRANCHES.map(b => ({ v: b.code, l: b.name, sub: b.radius + 'm' })), S.ui.simBranch, 'Şube seçin')}
                        </div>
                        <div class="net-meter">
                            <div class="net-meter-top">
                                <span>Şube Merkezine Mesafe: <b class="mono">${S.ui.simDist} metre</b></span>
                                ${pill(inside ? '30m Alan İçinde (Onaylı)' : 'Alan Dışı (Engellendi)', inside ? 'ok' : 'bad')}
                            </div>
                            <input type="range" min="1" max="80" value="${S.ui.simDist}" data-bind="sim-dist" style="width:100%;accent-color:var(--red);cursor:pointer">
                            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted)" class="mono">
                                <span>0m (Merkez)</span><span>30m (Geofence Sınırı)</span><span>80m (Dış Alan)</span>
                            </div>
                        </div>
                        <div class="kv">
                            <div><small>Hedef Koordinat</small><b class="mono">${simB.lat.toFixed(4)}, ${simB.lng.toFixed(4)}</b></div>
                            <div><small>Eşleşen Wi-Fi</small><b class="mono">${esc(simB.wifi)}</b></div>
                        </div>
                    </div>
                </section>
            </div>`;
        }
    };

    IT.audit = {
        title: 'Denetim günlüğü', sub: () => 'Yönetici işlemlerinin değiştirilemez kaydı', tools: {}, icon: 'list',
        render() {
            const u = S.ui.audit, cats = { ALL: 'Tümü', ACCOUNT: 'Hesap', DEVICE: 'Cihaz', SECURITY: 'Güvenlik', HR: 'İK', SYSTEM: 'Sistem' };
            const L = D.AUDIT.filter(a => u.cat === 'ALL' || a.cat === u.cat);
            return `<section class="card flush"><div class="toolbar">${chips(Object.keys(cats).map(k => ({ v: k, l: cats[k] })), u.cat, 'au-cat')}<span class="grow"></span>${dlBtn('export-it', 'Denetim Raporu (.xlsx)', { cls: 'btn-soft btn-sm' })}</div><div class="list">${L.map(a => `<div class="list-item"><span class="mono muted" style="width:48px">${a.t}</span><div class="grow"><b>${esc(a.act)}</b><small>${esc(a.who)} · <span class="mono">${esc(a.target)}</span></small></div>${pill(cats[a.cat] || a.cat, 'mute')}</div>`).join('')}</div></section>`;
        }
    };

    /* ======================= SİSTEM YÖNETİCİSİ (ADMIN) SAYFALARI ======================= */
    const ADMIN = {
        overview: {
            title: 'Kullanıcı & yetki yönetimi',
            sub: () => 'İK ve BT portal kullanıcıları oluşturun, modül bazlı erişim yetkilerini seçin ve düzenleyin',
            tools: {},
            icon: 'shield',
            render() {
                const u = S.ui.adm;
                const hrAccounts = ACCOUNTS.filter(a => a.role === 'HR');
                const itAccounts = ACCOUNTS.filter(a => a.role === 'IT');
                const activeCount = ACCOUNTS.filter(a => a.active !== false).length;
                const availPerms = PERM_CATALOG[u.role] || PERM_CATALOG.HR;
                const filteredList = ACCOUNTS.filter(a => u.filter === 'ALL' || a.role === u.filter);

                return `<div class="grid g-4">
                    ${kpi({ label: 'Toplam Portal Kullanıcısı', val: ACCOUNTS.length, unit: 'hesap', foot: activeCount + ' aktif · ' + (ACCOUNTS.length - activeCount) + ' pasif', icon: 'users', tone: 'ok' })}
                    ${kpi({ label: 'İK Portalı Yetkilileri', val: hrAccounts.length, unit: 'yetkili', foot: 'Puantaj, izin ve işe giriş yetkileri', icon: 'check', tone: 'ok' })}
                    ${kpi({ label: 'BT Portalı Yetkilileri', val: itAccounts.length, unit: 'yetkili', foot: 'Geofence, cihaz ve güvenlik radarı', icon: 'shield', tone: 'ok' })}
                    ${kpi({ label: 'Rol İzolasyonu (RBAC)', val: 100, unit: '%', foot: 'Her işlem denetim günlüğüne yazılır', icon: 'lock', tone: 'ok' })}
                </div>
                <div class="grid g-main mt">
                    <!-- SOL: Yeni İK / BT Kullanıcısı Oluşturma ve Yetki Seçimi Formu -->
                    <section class="card">
                        ${cardHead('Yeni İK / BT kullanıcısı oluştur ve yetkilerini seç', 'Birim rolünü seçin, kullanıcı bilgilerini girin ve erişebileceği PDKS modüllerini işaretleyin')}
                        <div class="form-grid" style="display:flex;flex-direction:column;gap:14px">
                            <div>
                                <span style="display:block;font-size:12px;font-weight:700;color:var(--muted);margin-bottom:6px">1. Kullanıcının Görev Yapacağı Portal Rolü</span>
                                <div class="grid g-2" style="gap:10px">
                                    <button type="button" class="card" data-act="adm-role-pick" data-v="HR" style="padding:12px 14px;text-align:left;cursor:pointer;border:2px solid ${u.role === 'HR' ? 'var(--red)' : 'var(--line)'};background:${u.role === 'HR' ? 'var(--red-soft)' : 'var(--surface)'}">
                                        <div style="display:flex;align-items:center;justify-content:space-between">
                                            <b style="font-size:13.5px;color:var(--ink)">İnsan Kaynakları (İK)</b>
                                            ${u.role === 'HR' ? pill('Seçili', 'ok') : ''}
                                        </div>
                                        <small class="muted" style="display:block;margin-top:4px;font-size:11.5px">Puantaj, personel ekleme, izin onayı ve analitik</small>
                                    </button>
                                    <button type="button" class="card" data-act="adm-role-pick" data-v="IT" style="padding:12px 14px;text-align:left;cursor:pointer;border:2px solid ${u.role === 'IT' ? 'var(--red)' : 'var(--line)'};background:${u.role === 'IT' ? 'var(--red-soft)' : 'var(--surface)'}">
                                        <div style="display:flex;align-items:center;justify-content:space-between">
                                            <b style="font-size:13.5px;color:var(--ink)">Bilgi Teknolojileri (BT)</b>
                                            ${u.role === 'IT' ? pill('Seçili', 'ok') : ''}
                                        </div>
                                        <small class="muted" style="display:block;margin-top:4px;font-size:11.5px">Güvenlik radarı, cihaz eşleme, parola ve şube geofence</small>
                                    </button>
                                </div>
                            </div>

                            <div class="grid g-2">
                                <label class="field">
                                    <span>Ad Soyad *</span>
                                    <div class="input">${ic('users')}<input id="admName" data-bind="adm-name" value="${esc(u.name)}" placeholder="Örn. Zeynep Karahan" maxlength="60"></div>
                                </label>
                                <label class="field">
                                    <span>Kurumsal Ünvan *</span>
                                    <div class="input">${ic('award')}<input id="admTitle" data-bind="adm-title" value="${esc(u.title)}" placeholder="${u.role === 'HR' ? 'Örn. İK İşe Alım Uzmanı' : 'Örn. Kıdemli Sistem Uzmanı'}" maxlength="60"></div>
                                </label>
                            </div>

                            <div class="grid g-2">
                                <label class="field">
                                    <span>Kurumsal E-posta (Kullanıcı Adı) *</span>
                                    <div class="input">${ic('mail')}<input id="admEmail" data-bind="adm-email" value="${esc(u.email)}" placeholder="ad.soyad@albayrakfinans.com.tr" maxlength="80"></div>
                                </label>
                                <label class="field">
                                    <span>Giriş Parolası *</span>
                                    <div class="input">${ic('lock')}<input id="admPass" data-bind="adm-pass" value="${esc(u.pass)}" placeholder="En az 6 karakter"><button type="button" class="btn btn-soft btn-sm" data-act="adm-gen-pw">Üret</button></div>
                                </label>
                            </div>

                            <label class="field">
                                <span>Yetkili Olduğu Şube Kapsamı</span>
                                <div>${selectEl('adm-branch', [{ v: 'ALL', l: 'Tüm Şubeler (Genel Merkez & 6 Şube)' }].concat(D.BRANCHES.map(b => ({ v: b.code, l: b.name, sub: b.city }))), u.branch, 'Şube kapsamı')}</div>
                            </label>

                            <div>
                                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                                    <span style="font-size:12px;font-weight:700;color:var(--muted)">2. Modül ve İşlem Yetkilerini Seçin (${u.role === 'HR' ? 'İK Yetki Paketi' : 'BT Yetki Paketi'})</span>
                                    <small class="mono muted">${u.perms.length} / ${availPerms.length} yetki seçili</small>
                                </div>
                                <div class="list" style="border:1px solid var(--line);border-radius:12px;overflow:hidden">
                                    ${availPerms.map(pm => {
                                        const checked = u.perms.includes(pm.k);
                                        return `<div class="list-item" style="cursor:pointer;padding:10px 14px;background:${checked ? 'var(--surface)' : 'var(--bg)'}" data-act="adm-perm-toggle" data-k="${esc(pm.k)}">
                                            <span class="ico-sq ${checked ? 'ok' : ''}" style="width:28px;height:28px;border-radius:8px">${ic(checked ? 'check' : 'lock')}</span>
                                            <div class="grow">
                                                <b style="font-size:13px">${esc(pm.l)}</b>
                                                <small style="display:block;font-size:11.5px;color:var(--muted)">${esc(pm.d)}</small>
                                            </div>
                                            <button type="button" class="switch ${checked ? 'on' : ''}" aria-label="${esc(pm.l)}"><span></span></button>
                                        </div>`;
                                    }).join('')}
                                </div>
                            </div>

                            <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:4px">
                                <button type="button" class="btn btn-primary" data-act="adm-create-user">${ic('check')}Kullanıcıyı Oluştur & Yetkilendir</button>
                            </div>
                        </div>
                    </section>

                    <!-- SAĞ: Mevcut İK, BT ve Admin Kullanıcıları ve Yetki Düzenleme Listesi -->
                    <section class="card flush">
                        <div class="card-head">
                            <div>
                                <h3>Kayıtlı portal kullanıcıları ve aktif yetkileri</h3>
                                <p>Kullanıcıların yetkilerini anlık olarak düzenleyebilir veya hesabı askıya alabilirsiniz</p>
                            </div>
                        </div>
                        <div class="toolbar">
                            ${chips([
                                { v: 'ALL', l: 'Tümü', n: ACCOUNTS.length },
                                { v: 'HR', l: 'İK Portalı', n: hrAccounts.length },
                                { v: 'IT', l: 'BT Portalı', n: itAccounts.length },
                                { v: 'ADMIN', l: 'Admin', n: ACCOUNTS.filter(a => a.role === 'ADMIN').length }
                            ], u.filter, 'adm-filter')}
                        </div>
                        <div class="list">
                            ${filteredList.map(acc => {
                                const roleLabel = acc.role === 'HR' ? 'İK Portalı' : acc.role === 'IT' ? 'BT Portalı' : 'Sistem Yöneticisi';
                                const roleTone = acc.role === 'HR' ? 'ok' : acc.role === 'IT' ? 'warn' : 'bad';
                                const cat = PERM_CATALOG[acc.role] || [];
                                const accPerms = acc.perms || [];
                                return `<div class="list-item" style="align-items:flex-start;flex-direction:column;gap:10px;padding:14px 18px">
                                    <div style="display:flex;align-items:center;gap:12px;width:100%">
                                        <span class="avatar">${esc(A.initials(acc.name))}</span>
                                        <div class="grow" style="min-width:0">
                                            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                                                <b>${esc(acc.name)}</b>
                                                ${pill(roleLabel, roleTone)}
                                                ${acc.active === false ? pill('Askıda', 'bad') : pill('Aktif', 'ok')}
                                            </div>
                                            <small style="display:block;margin-top:2px">${esc(acc.title)} · <span class="mono">${esc(acc.email)}</span> · Şube: <b>${acc.branch === 'ALL' || !acc.branch ? 'Tüm Şubeler' : esc(brName(acc.branch))}</b></small>
                                        </div>
                                        <div class="row-acts">
                                            ${acc.role !== 'ADMIN' ? `<button type="button" class="btn btn-soft btn-sm" data-act="adm-edit-perms" data-email="${esc(acc.email)}">Yetkileri Seç (${accPerms.length})</button>` : ''}
                                            ${acc.email !== S.user.email ? `<button type="button" class="btn btn-ghost btn-sm" data-act="adm-toggle-active" data-email="${esc(acc.email)}">${acc.active === false ? 'Aktifleştir' : 'Askıya Al'}</button>` : ''}
                                        </div>
                                    </div>
                                    <div style="display:flex;flex-wrap:wrap;gap:6px;padding-left:44px">
                                        ${acc.role === 'ADMIN'
                                            ? `<span class="pill mute">Tam Sistem ve RBAC Yetkisi</span>`
                                            : cat.map(pm => {
                                                const has = accPerms.includes(pm.k);
                                                return `<span class="pill ${has ? 'ok' : 'mute'}" style="opacity:${has ? 1 : 0.45}">${has ? '✓ ' : '× '}${esc(pm.l)}</span>`;
                                            }).join('')}
                                    </div>
                                </div>`;
                            }).join('')}
                        </div>
                    </section>
                </div>`;
            }
        },
        permissions: {
            title: 'Rol & yetki matrisi (RBAC)',
            sub: () => 'İK, BT ve Sistem Yöneticisi rollerinin erişim sınırları ve denetim kayıtları',
            tools: {},
            icon: 'lock',
            render() {
                return `<div class="grid g-2">
                    <section class="card flush">
                        ${cardHead('İnsan Kaynakları (İK) yetki kataloğu', 'İK kullanıcılarına atanabilen modül ve işlem izinleri')}
                        <div class="list">
                            ${PERM_CATALOG.HR.map(p => `<div class="list-item"><span class="ico-sq ok">${ic('check')}</span><div class="grow"><b>${esc(p.l)}</b><small>${esc(p.d)} · Kod: <span class="mono">${esc(p.k)}</span></small></div>${pill('İK Modülü', 'ok')}</div>`).join('')}
                        </div>
                    </section>
                    <section class="card flush">
                        ${cardHead('Bilgi Teknolojileri (BT) yetki kataloğu', 'BT kullanıcılarına atanabilen siber güvenlik ve cihaz izinleri')}
                        <div class="list">
                            ${PERM_CATALOG.IT.map(p => `<div class="list-item"><span class="ico-sq warn">${ic('shield')}</span><div class="grow"><b>${esc(p.l)}</b><small>${esc(p.d)} · Kod: <span class="mono">${esc(p.k)}</span></small></div>${pill('BT Modülü', 'warn')}</div>`).join('')}
                        </div>
                    </section>
                </div>
                <section class="card flush mt">
                    ${cardHead('Son yetkilendirme ve yönetici denetim kayıtları', 'Kullanıcı oluşturma, yetki değişimi ve işe giriş işlemleri')}
                    <div class="list">
                        ${D.AUDIT.slice(0, 12).map(a => `<div class="list-item"><span class="mono muted" style="width:48px">${a.t}</span><div class="grow"><b>${esc(a.act)}</b><small>${esc(a.who)} · <span class="mono">${esc(a.target)}</span></small></div>${pill(a.cat, 'mute')}</div>`).join('')}
                    </div>
                </section>`;
            }
        }
    };

    const PAGES = {
        HR: { overview: HR.overview, employees: HR.employees, onboarding: HR.onboarding, leaves: HR.leaves, analytics: HR.analytics, reports: HR.reports, profile: HR.profile },
        IT: { overview: IT.overview, support: IT.support, security: IT.security, devices: IT.devices, branches: IT.branches, audit: IT.audit },
        ADMIN: { overview: ADMIN.overview, permissions: ADMIN.permissions, branches: IT.branches, audit: IT.audit }
    };
    const NAV = {
        HR: [['Genel', ['overview', 'employees', 'onboarding', 'leaves']], ['Analiz', ['analytics', 'reports']]],
        IT: [['İzleme', ['overview', 'security']], ['Yönetim', ['support', 'devices', 'branches', 'audit']]],
        ADMIN: [['Yetkilendirme', ['overview', 'permissions']], ['Sistem Denetimi', ['branches', 'audit']]]
    };
    const NAV_LABEL = {
        overview: 'Genel bakış',
        employees: 'Personel & yoklama',
        onboarding: 'Personel ekle (İşe giriş)',
        leaves: 'İzin talepleri',
        analytics: 'Analitik',
        reports: 'Raporlar',
        security: 'Güvenlik radarı',
        support: 'Destek & parola',
        devices: 'Cihazlar',
        branches: 'Şubeler',
        audit: 'Denetim günlüğü',
        permissions: 'Rol & yetki matrisi',
        profile: 'Personel profili'
    };

    /* ======================= Özel Şube Seçici & Üst Araç Çubuğu ======================= */
    function renderBranchMenu() {
        const menu = $('#branchMenu'), label = $('#branchLabel');
        if (!menu || !label) return;
        const allCnt = D.EMPLOYEES.length;
        const curName = S.branch === 'ALL' ? 'Tüm şubeler' : brName(S.branch);
        label.textContent = curName;
        const items = [{ code: 'ALL', name: 'Tüm şubeler', city: '6 Lokasyon · Genel Görünüm', cnt: allCnt }].concat(
            D.BRANCHES.map(b => ({ code: b.code, name: b.name, city: b.city + ' · 30m Geofence', cnt: D.EMPLOYEES.filter(e => e.branch === b.code).length }))
        );
        menu.innerHTML = items.map(it => `<button type="button" class="cselect-item${S.branch === it.code ? ' is-selected' : ''}" data-act="branch-pick" data-v="${esc(it.code)}" role="option" aria-selected="${S.branch === it.code}">
            <div style="display:flex;align-items:center;gap:10px;min-width:0">
                <span class="ico-sq ${S.branch === it.code ? 'red' : ''}" style="width:28px;height:28px;border-radius:8px;flex-shrink:0">${ic(it.code === 'ALL' ? 'building' : 'pin')}</span>
                <div style="display:flex;flex-direction:column;align-items:flex-start;min-width:0">
                    <span style="font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(it.name)}</span>
                    <small style="color:var(--muted);font-size:11px">${esc(it.city)}</small>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
                <span class="count" style="font-size:11px">${it.cnt} kişi</span>
                ${S.branch === it.code ? ic('check') : ''}
            </div>
        </button>`).join('');
    }

    function syncDateInputs() {
        const df = $('#dateFrom'), dt = $('#dateTo'), wrap = $('#dateFilterWrap'), clr = $('#dateClearBtn');
        if (!df || !dt) return;
        const minIso = D.DAYS[0].iso, maxIso = D.DAYS[D.DAYS.length - 1].iso;
        df.min = minIso; df.max = maxIso;
        dt.min = minIso; dt.max = maxIso;
        df.value = S.fromDate || '';
        dt.value = S.toDate || '';
        const hasCustom = !!(S.fromDate || S.toDate);
        if (wrap) wrap.classList.toggle('is-custom', hasCustom);
        if (clr) clr.hidden = !hasCustom;
    }

    /* ======================= Yönlendirme & Oluşturma ======================= */
    function badge(id) {
        if (S.user.role === 'HR' && id === 'leaves') return D.LEAVES.filter(l => l.status === 'pending').length;
        if (S.user.role === 'IT' && id === 'support') return openTickets().length;
        if (S.user.role === 'IT' && id === 'security') return openAlerts().length;
        return 0;
    }
    function buildNav() {
        const nav = $('#nav'), role = S.user.role; nav.innerHTML = '<span class="nav-thumb"></span>';
        NAV[role].forEach(([label, ids]) => {
            nav.insertAdjacentHTML('beforeend', `<div class="nav-label">${label}</div>`);
            ids.forEach(id => { const n = badge(id); const aktif = S.page === id || (S.page === 'profile' && id === 'employees'); nav.insertAdjacentHTML('beforeend', `<button class="nav-item${aktif ? ' is-active' : ''}" data-go="${id}" ${S.page === id ? 'aria-current="page"' : ''}>${ic(PAGES[role][id].icon)}<span>${NAV_LABEL[id]}</span>${n ? `<span class="count">${n}</span>` : ''}</button>`); });
        });
        placeNav();
    }
    function placeNav() {
        const th = $('.nav-thumb'), a = $('.nav-item.is-active'); if (!th || !a) return;
        th.style.height = a.offsetHeight + 'px'; th.style.transform = `translateY(${a.offsetTop}px)`; th.style.opacity = 1;
    }
    function setTools(p) {
        const t = p.tools || {};
        $('#rangeSeg').style.display = t.range ? '' : 'none';
        $('#dateFilterWrap').style.display = t.range ? '' : 'none';
        $('#branchWrap').style.display = t.branch ? '' : 'none';
        const hasCustom = !!(S.fromDate || S.toDate);
        $$('#rangeSeg .seg-btn').forEach(b => b.classList.toggle('is-active', !hasCustom && +b.dataset.range === S.range));
        A.placeSeg($('#rangeSeg'));
        renderBranchMenu();
        syncDateInputs();
    }
    function skeleton() { return '<div class="grid g-4">' + '<div class="sk sk-card"></div>'.repeat(4) + '</div><div class="grid g-main mt"><div class="sk sk-big"></div><div class="sk sk-big"></div></div>'; }

    const dndKey = () => 'atf_dnd_' + (S.user ? S.user.role : 'HR') + '_' + S.page;

    function draw(animate) {
        const p = PAGES[S.user.role][S.page], pg = $('#page'), active = document.activeElement, focusId = active && active.id && pg.contains(active) ? active.id : null, pos = focusId ? active.selectionStart : null;
        $('#pageTitle').textContent = p.title; $('#pageSub').textContent = typeof p.sub === 'function' ? p.sub() : p.sub; document.title = p.title + ' · Albayrak Finans PDKS';
        pg.innerHTML = p.render(); pg.classList.toggle('still', !animate);
        Array.from(pg.children).forEach((c, i) => c.style.setProperty('--i', i));
        A.hydrate(pg); if (p.mount) p.mount(); A.enableDragGrid(pg, dndKey()); A.countUp(pg); buildNav(); setTools(p);
        if (S.openEmpId && $('#drawer').classList.contains('on')) empDrawer(S.openEmpId, true);
        if (S.page === 'profile') mountProfileChart();
        if (focusId) { const el = $('#' + focusId); if (el) { el.focus(); if (pos != null && el.setSelectionRange) try { el.setSelectionRange(pos, pos); } catch (e) { } } }
    }
    function go(id, quiet) {
        const role = S.user.role;
        if (!PAGES[role][id]) {
            audit('Yetkisiz sayfa erişim denemesi engellendi (' + id + ')', S.user.email, 'SECURITY');
            A.toast('Bu bölüme erişim yetkiniz yok.', 'err');
            id = 'overview';
        }
        closeSide(); if (leaving) return;
        if (id === S.page && !quiet && $('#page').children.length) { draw(false); return; }
        S.page = id; if (location.hash !== '#/' + id) history.replaceState(null, '', '#/' + id);
        leaving = true; const pg = $('#page'); pg.classList.add('leaving'); buildNav();
        setTimeout(() => { pg.classList.remove('leaving'); pg.classList.remove('still'); pg.innerHTML = skeleton(); setTimeout(() => { leaving = false; draw(true); window.scrollTo({ top: 0 }); }, 260); }, 130);
    }

    /* ======================= Çekmece & Derin Personel Profil Analizi ======================= */
    /* Satir altinda detay ac/kapa (personel listesinde) */
    function empToggleDetail(id) {
        const u = S.ui.emp;
        u.openId = (id == null || u.openId === id) ? null : id;
        draw(false);
    }
    /* Tam sayfa profil ekrani — cekmece yerine ayri rota */
    function empProfile(id) {
        if (!emp(id)) return;
        if (!PAGES[S.user.role].profile) return;
        S.ui.emp.openId = null;
        closeDrawer();          // closeDrawer S.openEmpId'yi sifirlar -> sonra set et
        S.openEmpId = id;
        go('profile');
    }

    /* Profil ekranindaki calisma saati grafigi (draw sonrasi cizilir) */
    function mountProfileChart() {
        const hedef = $('#prChart');
        if (!hedef || !S.openEmpId) return;
        const an = D.empAnalytics(S.openEmpId, filterOpts());
        const kayitlar = an.logs.slice(-14);
        if (!kayitlar.length) return;
        A.areaChart(hedef, {
            labels: kayitlar.map(x => x.label),
            series: [
                { data: kayitlar.map(x => x.workH || 0) },
                { data: kayitlar.map(() => 8.5) }
            ],
            yMin: 0, yMax: 11, h: 185, yFmt: v => v + ' sa',
            tip: (i, v) => `<b>${kayitlar[i].fullDate} (${kayitlar[i].dowName})</b>Çalışma: ${v[0]} sa · Net: ${fmtMinSigned(kayitlar[i].netMin)}`
        });
    }

    function openDrawer(title, html, wide) {
        $('#drawerTitle').textContent = title;
        $('#drawerBody').innerHTML = html;
        A.hydrate($('#drawerBody'));
        const d = $('#drawer');
        d.classList.toggle('wide', !!wide);
        d.classList.add('on');
        d.setAttribute('aria-hidden', 'false');
    }
    function closeDrawer() {
        S.openEmpId = null;
        const d = $('#drawer');
        d.classList.remove('on', 'wide');
        d.setAttribute('aria-hidden', 'true');
    }
    function openModal(title, html, foot) {
        $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html; $('#modalFoot').innerHTML = foot || ''; A.hydrate($('#modal'));
        const m = $('#modal'); m.classList.add('on'); m.setAttribute('aria-hidden', 'false'); (m.querySelector('input') || $('#modalClose')).focus();
    }
    function closeModal() { const m = $('#modal'); m.classList.remove('on'); m.setAttribute('aria-hidden', 'true'); }

    /* Personel Profiline Girince Tüm İnce Detayları Gösteren Derin Analiz Çekmecesi */
    function empDrawer(id, keepOpen) {
        const e = emp(id);
        if (!e) return;
        S.openEmpId = id;
        const an = D.empAnalytics(id, filterOpts());
        const totBar = Math.max(1, an.totalOvertimeMin + an.totalLateMin);
        const otPct = Math.round((an.totalOvertimeMin / totBar) * 100);
        const latePct = 100 - otPct;
        const hasCustom = !!(S.fromDate || S.toDate);
        const minIso = D.DAYS[0].iso, maxIso = D.DAYS[D.DAYS.length - 1].iso;

        // Departman ortalaması ile kıyaslama
        const deptEmps = D.EMPLOYEES.filter(x => x.dept === e.dept);
        const deptLb = D.computeLeaderboards(deptEmps, filterOpts());
        const deptAvgOt = Math.round(deptLb.all.reduce((a, x) => a + x.totalOvertimeMin, 0) / (deptLb.all.length || 1));
        const deptAvgLate = Math.round(deptLb.all.reduce((a, x) => a + x.totalLateMin, 0) / (deptLb.all.length || 1));

        const html = `
            <!-- Üst Kişi Bilgisi + Dönem/Tarih Filtresi -->
            <div class="drawer-profile-bar">
                <div class="profile">
                    ${avatar(e, 'lg')}
                    <div style="min-width:0">
                        <h4>${esc(e.name)}</h4>
                        <span class="muted">${esc(e.title)} · ${esc(e.dept)} · <span class="mono">${e.sicil}</span></span>
                        <div style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                            ${pill(STATUS[e.status][0], STATUS[e.status][1])}
                            ${pill(brName(e.branch), 'mute')}
                            ${netPill(an.netBalanceMin)}
                        </div>
                    </div>
                </div>
                <div class="drawer-profile-filters">
                    <div class="chips">
                        ${[1, 7, 30, 60].map(r => `<button type="button" class="chip${!hasCustom && S.range === r ? ' is-active' : ''}" data-act="dr-range" data-v="${r}">${r === 1 ? 'Bugün' : r + ' gün'}</button>`).join('')}
                    </div>
                    <div class="date-filter ${hasCustom ? 'is-custom' : ''}" style="height:32px">
                        <svg class="ic" viewBox="0 0 24 24" data-i="calendar"></svg>
                        <input type="date" id="drDateFrom" value="${esc(S.fromDate)}" min="${minIso}" max="${maxIso}" aria-label="Başlangıç tarihi">
                        <span class="date-sep">–</span>
                        <input type="date" id="drDateTo" value="${esc(S.toDate)}" min="${minIso}" max="${maxIso}" aria-label="Bitiş tarihi">
                    </div>
                </div>
            </div>

            <!-- 3 Ana Vurgu Kartı: 1) Net Mesai Bakiyesi, 2) En Çok Geç Kaldığı Gün, 3) En Çok Ek Mesai Yaptığı Gün -->
            <div class="profile-highlights">
                <div class="hi-card ${an.netBalanceMin >= 0 ? 'ok' : 'bad'}">
                    <small>Net Mesai Bakiyesi (Mesai − Geç)</small>
                    <b>${fmtMinSigned(an.netBalanceMin)}</b>
                    <span>Ek Mesai: <b>+${fmtMinDur(an.totalOvertimeMin)}</b> · Geç: <b>−${fmtMinDur(an.totalLateMin)}</b></span>
                </div>
                <div class="hi-card warn">
                    <small>En Çok Geç Kaldığı Gün</small>
                    <b>${an.mostLateDay.totalLateMin > 0 ? esc(an.mostLateDay.dowName) : 'Gecikme Yok'}</b>
                    <span>${an.mostLateDay.totalLateMin > 0
                        ? `Toplam <b>${an.mostLateDay.totalLateMin} dk</b> (${an.mostLateDay.lateCount} kez · ort. ${an.mostLateDay.avgLateMin} dk)${an.peakLateRec ? `<br>Zirve: <b>${an.peakLateRec.fullDate} (+${an.peakLateRec.lateMin} dk)</b>` : ''}`
                        : 'Seçili dönemde tüm günlerde zamanında giriş yaptı'}</span>
                </div>
                <div class="hi-card ok">
                    <small>En Çok Ek Mesai Yaptığı Gün</small>
                    <b>${an.mostOvertimeDay.totalOvertimeMin > 0 ? esc(an.mostOvertimeDay.dowName) : 'Ek Mesai Yok'}</b>
                    <span>${an.mostOvertimeDay.totalOvertimeMin > 0
                        ? `Toplam <b>+${an.mostOvertimeDay.totalOvertimeMin} dk</b> (${an.mostOvertimeDay.otCount} gün · ort. +${an.mostOvertimeDay.avgOvertimeMin} dk)${an.peakOtRec ? `<br>Zirve: <b>${an.peakOtRec.fullDate} (+${an.peakOtRec.overtimeMin} dk)</b>` : ''}`
                        : 'Seçili dönemde ek mesai kaydı bulunmuyor'}</span>
                </div>
            </div>

            <!-- Ek Mesaiden Geç Kalınan Dakika Çıkınca Kalan Net Süre Görsel Terazisi -->
            <div class="net-meter">
                <div class="net-meter-top">
                    <div>
                        <b style="font-size:13.5px">Ek Mesai vs Gecikme Süresi Terazisi (${esc(rangeLabel())})</b>
                        <small class="muted" style="display:block">Ek mesaiden (${an.totalOvertimeMin} dk) geç kalınan süre (${an.totalLateMin} dk) çıkarıldığında net <b>${fmtMinSigned(an.netBalanceMin)}</b> kalmaktadır.</small>
                    </div>
                    ${netPill(an.netBalanceMin)}
                </div>
                <div class="net-split-track">
                    <div class="net-split-ot" style="width:${otPct}%"></div>
                    <div class="net-split-late" style="width:${latePct}%"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600">
                    <span style="color:var(--ok)">● Toplam Ek Mesai: +${fmtMinDur(an.totalOvertimeMin)} (%${otPct})</span>
                    <span style="color:var(--bad)">● Toplam Gecikme: −${fmtMinDur(an.totalLateMin)} (%${latePct})</span>
                </div>
            </div>

            <!-- İnce Detay Metrikleri (Saatler, Rekorlar, Konum Doğrulaması) -->
            <div class="stat-mini-grid">
                <div class="stat-mini"><small>Ort. Giriş / En Erken</small><b class="mono">${an.avgCheckIn} <span class="muted" style="font-size:12px">(${an.earliestCheckIn})</span></b></div>
                <div class="stat-mini"><small>Ort. Çıkış / En Geç</small><b class="mono">${an.avgCheckOut} <span class="muted" style="font-size:12px">(${an.latestCheckOut})</span></b></div>
                <div class="stat-mini"><small>En Verimli Gün (Net)</small><b>${esc(an.bestNetDay.dowName)} (${fmtMinSigned(an.bestNetDay.netMin)})</b></div>
                <div class="stat-mini"><small>Günlük Ort. Mesai</small><b>${String(an.avgWorkH).replace('.', ',')} sa <span class="muted" style="font-size:12px">/ 8,5 sa</span></b></div>
                <div class="stat-mini"><small>Devam / Katılım</small><b>${an.attendedDays} / ${an.totalDays} iş günü</b></div>
                <div class="stat-mini"><small>30m Geofence Uyum</small><b style="color:var(--ok)">%${String(an.geofenceRate).replace('.', ',')} (${an.avgDist}m)</b></div>
            </div>

            <!-- Haftanın Günlerine Göre (Pazartesi - Cuma) Kırılım Tablosu -->
            <div class="card flush" style="border:1px solid var(--line)">
                ${cardHead('Haftanın günlerine göre (Pazartesi – Cuma) detaylı analiz', 'Hangi günler geç kalıyor, hangi günler fazla mesai yapıyor ve gün bazlı net süre bakiyesi')}
                <div class="table-wrap">
                    <table style="font-size:12.5px">
                        <thead><tr><th>Gün</th><th>Katılım</th><th>Ort. Giriş</th><th>Ort. Çıkış</th><th>Geç Kalma</th><th>Ek Mesai</th><th>Net Süre (Mesai−Geç)</th></tr></thead>
                        <tbody>
                            ${an.weekdayList.map(w => `<tr>
                                <td><b>${esc(w.dowName)}</b></td>
                                <td class="mono">${w.attended} gün</td>
                                <td class="mono">${w.avgIn}</td>
                                <td class="mono">${w.avgOut}</td>
                                <td class="mono" style="color:${w.totalLateMin > 0 ? 'var(--warn)' : 'var(--muted)'}"><b>${w.totalLateMin > 0 ? '−' + w.totalLateMin + ' dk' : '0 dk'}</b> <small class="muted">(${w.lateCount}x)</small></td>
                                <td class="mono" style="color:${w.totalOvertimeMin > 0 ? 'var(--ok)' : 'var(--muted)'}"><b>+${w.totalOvertimeMin} dk</b> <small class="muted">(${w.otCount}x)</small></td>
                                <td>${netPill(w.netMin)}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Grafikler: Çalışma İstikrarı (8.5 sa) & Departman Kıyaslaması -->
            <div class="grid g-2">
                <div class="card" style="padding:14px">
                    <h4 style="font-size:13.5px;margin-bottom:4px">Çalışma saati istikrarı (8,5 sa referanslı)</h4>
                    <p class="muted" style="font-size:11.5px;margin-bottom:8px">Günlük çalışma süresi ve kurumsal hedef çizgisi</p>
                    <div id="drChart"></div>
                </div>
                <div class="card" style="padding:14px">
                    <h4 style="font-size:13.5px;margin-bottom:4px">${esc(e.dept)} birimi ile karşılaştırma</h4>
                    <p class="muted" style="font-size:11.5px;margin-bottom:12px">Personelin departman ortalamasına göre konumu</p>
                    ${rank([
                        { l: e.name + ' · Ek Mesai', v: '+' + fmtMinDur(an.totalOvertimeMin), w: A.clamp((an.totalOvertimeMin / Math.max(60, deptAvgOt * 1.6)) * 100, 8, 100), cls: 'ok' },
                        { l: e.dept + ' Ort. Ek Mesai', v: '+' + fmtMinDur(deptAvgOt), w: A.clamp((deptAvgOt / Math.max(60, deptAvgOt * 1.6)) * 100, 8, 100), cls: '' },
                        { l: e.name + ' · Gecikme', v: '−' + fmtMinDur(an.totalLateMin), w: A.clamp((an.totalLateMin / Math.max(30, deptAvgLate * 1.6)) * 100, 4, 100), cls: 'warn' },
                        { l: e.dept + ' Ort. Gecikme', v: '−' + fmtMinDur(deptAvgLate), w: A.clamp((deptAvgLate / Math.max(30, deptAvgLate * 1.6)) * 100, 4, 100), cls: '' }
                    ])}
                </div>
            </div>

            <!-- Gün Gün Giriş-Çıkış, Gecikme, Ek Mesai ve Net Bakiye Cetveli -->
            <div class="card flush" style="border:1px solid var(--line)">
                ${cardHead('Gün gün giriş-çıkış, gecikme ve ek mesai kayıtları', 'Seçili dönemdeki (' + an.logs.length + ' iş günü) tüm hareketler')}
                <div class="table-wrap" style="max-height:280px;overflow-y:auto">
                    <table style="font-size:12px">
                        <thead><tr><th>Tarih</th><th>Gün</th><th>Giriş</th><th>Çıkış</th><th>Mesai</th><th>Gecikme</th><th>Ek Mesai</th><th>Net</th><th>Konum</th></tr></thead>
                        <tbody>
                            ${an.logs.slice().reverse().map(l => `<tr>
                                <td class="mono"><b>${l.fullDate}</b></td>
                                <td>${esc(l.dowName)}</td>
                                <td class="mono">${l.checkIn || '—'}</td>
                                <td class="mono">${l.checkOut || '—'}</td>
                                <td class="mono">${l.workH ? String(l.workH).replace('.', ',') + ' sa' : '—'}</td>
                                <td class="mono" style="color:${l.lateMin > 0 ? 'var(--warn)' : 'var(--muted)'}">${l.lateMin > 0 ? '−' + l.lateMin + ' dk' : '0 dk'}</td>
                                <td class="mono" style="color:${l.overtimeMin > 0 ? 'var(--ok)' : 'var(--muted)'}">${l.overtimeMin > 0 ? '+' + l.overtimeMin + ' dk' : '0 dk'}</td>
                                <td>${l.status === 'LEAVE' || l.status === 'ABSENT' ? pill(STATUS[l.status][0], STATUS[l.status][1]) : netPill(l.netMin)}</td>
                                <td class="mono">${l.dist != null ? String(l.dist).replace('.', ',') + ' m' : '—'}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            ${dlBtn('export-one', e.name + ' · Detaylı Analiz & Puantaj Raporu (.xlsx)', { cls: 'btn-dark btn-block', id: e.id })}`;

        openDrawer('Derin Personel Analizi · ' + e.name, html, true);

        const chartLogs = an.logs.slice(-14);
        A.areaChart($('#drChart'), {
            labels: chartLogs.map(x => x.label),
            series: [
                { data: chartLogs.map(x => x.workH || 0) },
                { data: chartLogs.map(() => 8.5) }
            ],
            yMin: 0, yMax: 11, h: 175, yFmt: v => v + ' sa',
            tip: (i, v) => `<b>${chartLogs[i].fullDate} (${chartLogs[i].dowName})</b>Çalışma: ${v[0]} sa · Net: ${fmtMinSigned(chartLogs[i].netMin)}`
        });

        const df = $('#drDateFrom'), dt = $('#drDateTo');
        if (df) df.onchange = () => { S.fromDate = df.value; if (S.toDate && S.fromDate > S.toDate) S.toDate = S.fromDate; draw(false); };
        if (dt) dt.onchange = () => { S.toDate = dt.value; if (S.fromDate && S.toDate < S.fromDate) S.fromDate = S.toDate; draw(false); };
    }

    function kvkkModal() {
        const row = (a, b, c, d) => `<tr><td>${a}</td><td class="${b === '—' ? 'no' : 'yes'}">${b}</td><td class="${c === '—' ? 'no' : 'yes'}">${c}</td><td class="${d === '—' ? 'no' : 'yes'}">${d}</td></tr>`;
        openModal('KVKK ve veri erişimi', `
            <p><b>Veri sorumlusu:</b> Albayrak Tasarruf Finansman A.Ş. Bu sistem; çalışma saatlerinin takibi, devam kontrolü ve iş hukukundan doğan yükümlülüklerin yerine getirilmesi amacıyla çalışır.</p>
            <h4>İşlenen veriler</h4><ul><li>Giriş-çıkış saatleri, fazla mesai ve gecikme bilgisi</li><li>Konum: yalnızca giriş/çıkış anında, şube çevresindeki 30 metrelik alan için doğrulanır; sürekli takip yapılmaz</li><li>Cihaz tanımlayıcısı ve uygulama sürümü (hesap güvenliği için)</li></ul>
            <h4>Kim neyi görür?</h4>
            <table class="matrix"><thead><tr><th>Veri</th><th>Personel</th><th>İK</th><th>BT</th></tr></thead><tbody>
            ${row('Giriş-çıkış ve puantaj', 'Kendisi', 'Tümü', '—')}${row('İzin / mazeret kayıtları', 'Kendisi', 'Tümü', '—')}${row('30 m doğrulama sonucu', 'Kendisi', 'Tümü', 'Yalnızca uyarılarda')}${row('Ham GPS koordinatı', '—', '—', 'Yalnızca güvenlik uyarısında')}${row('Cihaz bilgisi', 'Kendi cihazı', '—', 'Tümü')}${row('Parola', 'Kendisi', '—', 'Sıfırlama (göremez)')}${row('Denetim günlüğü', '—', '—', 'Tümü')}
            </tbody></table>
            <h4>Haklarınız</h4><p>KVKK madde 11 kapsamında verilerinize erişme, düzeltme, silme ve işleme itirazı haklarına sahipsiniz. Başvurular için: <b>kvkk@albayrakfinans.com.tr</b></p>
            <p class="muted" style="font-size:12px">Bu metin bilgilendirme taslağıdır; yayımlanmadan önce Hukuk Müşavirliği tarafından onaylanmalıdır.</p>`, '<button class="btn btn-dark" data-act="modal-close">Anladım</button>');
    }

    function tempPassword() { const ch = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!?', b = new Uint32Array(12); crypto.getRandomValues(b); return Array.from(b, x => ch[x % ch.length]).join(''); }

    /* ======================= Kurumsal Excel (.xlsx) Rapor Üreticileri ======================= */
    function exportEmpsExcel() {
        const st = stats(), ds = deptStats(), list = filteredEmps();
        A.excelReport({
            fileName: 'Albayrak_PDKS_Puantaj_Raporu_' + new Date().toISOString().slice(0, 10),
            title: 'KURUMSAL PERSONEL PUANTAJ, EK MESAİ VE NET BAKİYE RAPORU',
            subtitle: 'Dönem: ' + rangeLabel() + ' · Gecikme, Ek Mesai, Net Süre Bakiyesi ve 30m Şube Geofence Tablosu',
            meta: [
                ['Tarih / Dönem Filtresi', rangeLabel()],
                ['Şube Filtresi', S.branch === 'ALL' ? 'Tüm Şubeler (6 Lokasyon)' : brName(S.branch)],
                ['Yetkili', S.user ? S.user.name + ' (' + S.user.title + ')' : 'İK Yönetimi']
            ],
            kpis: [
                { label: 'Toplam Personel', value: String(st.N), sub: 'Aktif kadro' },
                { label: 'Zamanında Giriş', value: '%' + A.pctText(st.onTimePct), sub: st.onTime + ' personel zamanında', color: '#0B7A53' },
                { label: 'Toplam Gecikme', value: fmtMinDur(st.totalLateMin), sub: st.late + ' personel geç kaldı', color: '#C8191E' },
                { label: 'Toplam Ek Mesai', value: A.numText(st.totalOvertimeH) + ' sa', sub: 'Onaylı fazla çalışma', color: '#0B7A53' },
                { label: 'Net Süre Bakiyesi', value: fmtMinSigned(st.netBalanceMin), sub: 'Ek mesai − gecikme', color: '#2855AE' },
                { label: 'Geç Kalan / Devamsız', value: st.late + ' / ' + st.absent, sub: 'Ort. ' + Math.round(st.avgLate) + ' dk gecikme', color: '#B4690E' }
            ],
            preparedBy: S.user ? S.user.name + ' — ' + S.user.title : 'İnsan Kaynakları Yönetimi',
            approvedBy: 'İnsan Kaynakları Müdürlüğü',
            summaryTitle: 'DEPARTMAN BAZLI UYUM, EK MESAİ VE NET BAKİYE ÖZETİ',
            summaryHeaders: ['Departman', 'Personel', 'Ort. Giriş', 'Top. Ek Mesai', 'Top. Gecikme', 'Net Bakiye (Mesai-Geç)', 'Uyum Oranı'],
            summaryRows: ds.map(x => [x.d, x.n, x.avgIn, '+' + fmtMinDur(x.totalOvertimeMin), '-' + fmtMinDur(x.totalLateMin), fmtMinSigned(x.netMin), '%' + A.pctText(x.pct)]),
            headers: ['Sicil No', 'Ad Soyad', 'Departman', 'Şube', 'Ort. Giriş', 'Ort. Çıkış', 'Top. Gecikme (dk)', 'Top. Ek Mesai (dk)', 'Net Süre Bakiyesi', 'En Çok Geç Kaldığı Gün', 'En Çok Mesai Yaptığı Gün', 'Durum'],
            rows: list.map(({ e, an }) => [
                e.sicil, e.name, e.dept, brName(e.branch),
                an.avgCheckIn, an.avgCheckOut,
                an.totalLateMin,
                an.totalOvertimeMin,
                fmtMinSigned(an.netBalanceMin),
                an.mostLateDay.totalLateMin > 0 ? `${an.mostLateDay.dowName} (${an.mostLateDay.totalLateMin} dk)` : 'Yok',
                `${an.mostOvertimeDay.dowName} (+${an.mostOvertimeDay.totalOvertimeMin} dk)`,
                STATUS[e.status][0]
            ])
        });
        A.toast('Puantaj Excel (.xlsx) raporu indirildi (A4 yazdırmaya hazır)');
    }

    function exportLeaderboardsExcel() {
        const E = emps(), lb = D.computeLeaderboards(E, filterOpts());
        const totOtMin = lb.all.reduce((a, x) => a + x.totalOvertimeMin, 0);
        const totLateMin = lb.all.reduce((a, x) => a + x.totalLateMin, 0);
        A.excelReport({
            fileName: 'Albayrak_Mesai_ve_Net_Bakiye_Ligi_' + new Date().toISOString().slice(0, 10),
            title: 'FAZLA MESAİ LİDERLERİ VE NET SÜRE BAKİYESİ (MESAİ − GECİKME) RAPORU',
            subtitle: 'Dönem: ' + rangeLabel() + ' · Ek Mesaiden Gecikme Çıkınca Kalan Sürede En İyiler ve En Kötüler',
            meta: [
                ['Dönem', rangeLabel()],
                ['Şube', S.branch === 'ALL' ? 'Tüm Şubeler' : brName(S.branch)]
            ],
            kpis: [
                { label: 'En Çok Mesai Yapan', value: lb.topOvertime[0] ? lb.topOvertime[0].emp.name : '—', sub: lb.topOvertime[0] ? '+' + fmtMinDur(lb.topOvertime[0].totalOvertimeMin) : '', color: '#0B7A53' },
                { label: 'Net Bakiye Lideri', value: lb.bestNet[0] ? lb.bestNet[0].emp.name : '—', sub: lb.bestNet[0] ? fmtMinSigned(lb.bestNet[0].netBalanceMin) : '', color: '#0B7A53' },
                { label: 'En Düşük Net Bakiye', value: lb.worstNet[0] ? lb.worstNet[0].emp.name : '—', sub: lb.worstNet[0] ? fmtMinSigned(lb.worstNet[0].netBalanceMin) : '', color: '#C8191E' },
                { label: 'Toplam Ek Mesai', value: fmtMinDur(totOtMin), sub: 'Dönem toplamı', color: '#0B7A53' },
                { label: 'Toplam Gecikme', value: fmtMinDur(totLateMin), sub: 'Dönem toplamı', color: '#C8191E' },
                { label: 'Net Süre Bakiyesi', value: fmtMinSigned(totOtMin - totLateMin), sub: 'Ek mesai − gecikme', color: '#2855AE' }
            ],
            preparedBy: S.user ? S.user.name + ' — ' + S.user.title : 'İnsan Kaynakları Yönetimi',
            summaryTitle: 'NET SÜRE BAKİYESİ EN İYİ 10 PERSONEL (EK MESAİ − GECİKME)',
            summaryHeaders: ['Sıra', 'Sicil No', 'Ad Soyad', 'Departman', 'Toplam Ek Mesai (dk)', 'Toplam Gecikme (dk)', 'Net Bakiye'],
            summaryRows: lb.bestNet.slice(0, 10).map((a, i) => [i + 1, a.emp.sicil, a.emp.name, a.emp.dept, a.totalOvertimeMin, a.totalLateMin, fmtMinSigned(a.netBalanceMin)]),
            headers: ['Sicil No', 'Ad Soyad', 'Departman', 'Şube', 'Ek Mesai (dk)', 'Gecikme (dk)', 'Net Bakiye (dk)', 'Net Süre Özeti', 'En Çok Mesai Günü', 'En Çok Geç Kalınan Gün', 'Değerlendirme'],
            rows: lb.all.slice().sort((a, b) => b.netBalanceMin - a.netBalanceMin).map(a => [
                a.emp.sicil, a.emp.name, a.emp.dept, brName(a.emp.branch),
                a.totalOvertimeMin, a.totalLateMin, a.netBalanceMin,
                fmtMinSigned(a.netBalanceMin),
                `${a.mostOvertimeDay.dowName} (+${a.mostOvertimeDay.totalOvertimeMin} dk)`,
                a.mostLateDay.totalLateMin > 0 ? `${a.mostLateDay.dowName} (${a.mostLateDay.totalLateMin} dk)` : 'Gecikme Yok',
                a.netBalanceMin >= 0 ? 'Zamanında / Pozitif Bakiye' : 'Geç / Negatif Bakiye'
            ])
        });
        A.toast('Mesai ve Net Bakiye Ligi (.xlsx) raporu indirildi (A4 yazdırmaya hazır)');
    }

    function exportAnalyticsExcel() {
        const st = stats(), ds = deptStats(), d = activeDays();
        A.excelReport({
            fileName: 'Albayrak_IK_Analitik_Raporu_' + new Date().toISOString().slice(0, 10),
            title: 'İNSAN KAYNAKLARI PERFORMANS, FAZLA MESAİ VE ANALİTİK RAPORU',
            subtitle: 'Departman Karşılaştırma Matrisi ve Günlük Katılım Eğilimleri · ' + rangeLabel(),
            meta: [
                ['Dönem', rangeLabel()],
                ['Şube', S.branch === 'ALL' ? 'Tüm Şubeler' : brName(S.branch)],
                ['Hazırlayan', S.user ? S.user.name : 'İK Direktörlüğü']
            ],
            kpis: [
                { label: 'Zamanında Katılım Oranı', value: '%' + A.pctText(st.onTimePct), sub: 'Hedef: %95,0', color: '#0B7A53' },
                { label: 'Toplam Fazla Mesai', value: A.numText(st.totalOvertimeH) + ' saat', sub: rangeLabel(), color: '#0B7A53' },
                { label: 'Toplam Gecikme', value: fmtMinDur(st.totalLateMin), sub: st.late + ' personel geç kaldı', color: '#C8191E' },
                { label: 'Net Süre Bakiyesi', value: fmtMinSigned(st.netBalanceMin), sub: 'Ek mesai − gecikme', color: '#2855AE' },
                { label: 'Ortalama Gecikme', value: Math.round(st.avgLate) + ' dk', sub: 'Geç kalan personel ort.', color: '#B4690E' },
                { label: 'Devamsız', value: String(st.absent), sub: 'Kayıt açılmayan personel', color: '#C8191E' }
            ],
            preparedBy: S.user ? S.user.name : 'İK Direktörlüğü',
            summaryTitle: 'DEPARTMAN PERFORMANS, EK MESAİ VE NET BAKİYE MATRİSİ',
            summaryHeaders: ['Departman', 'Kadro', 'Ortalama Giriş', 'Top. Ek Mesai', 'Top. Gecikme', 'Net Bakiye', 'Uyum Oranı (%)'],
            summaryRows: ds.map(x => [x.d, x.n, x.avgIn, '+' + fmtMinDur(x.totalOvertimeMin), '-' + fmtMinDur(x.totalLateMin), fmtMinSigned(x.netMin), '%' + A.pctText(x.pct)]),
            headers: ['Tarih', 'Gün', 'Zamanında Katılım (%)', 'Geç Kalan Oranı (%)', 'İzinli Oranı (%)', 'Ort. Çalışma Süresi (Sa)', 'Toplam Fazla Mesai (Sa)', 'Durum Değerlendirmesi'],
            rows: d.map(x => [
                x.fullDate,
                x.dowName,
                '%' + A.pctText(x.onTime * 100),
                '%' + A.pctText(x.late * 100),
                '%' + A.pctText(x.leave * 100),
                A.numText(x.workH) + ' sa',
                Math.round(x.overtimeH) + ' sa',
                x.onTime >= 0.92 ? 'Zamanında (Hedef Üstü)' : 'Geç (İzlenmeli)'
            ])
        });
        A.toast('İK Analitik Raporu (.xlsx) indirildi (A4 yazdırmaya hazır)');
    }

    function exportLateExcel() {
        const lb = D.computeLeaderboards(emps(), filterOpts());
        const list = lb.mostLate.filter(a => a.totalLateMin > 0);
        A.excelReport({
            fileName: 'Albayrak_Gec_Kalanlar_Raporu_' + new Date().toISOString().slice(0, 10),
            title: 'GECİKME VE NET SÜRE BAKİYESİ DENETİM RAPORU',
            subtitle: 'Dönem: ' + rangeLabel() + ' · En Çok Gecikilen Günler ve Net Mesai Farkları',
            kpis: [
                { label: 'İncelenen Personel', value: String(list.length), sub: 'Gecikme kaydı olan', color: '#C8191E' },
                { label: 'Toplam Gecikme', value: fmtMinDur(list.reduce((a, x) => a + x.totalLateMin, 0)), sub: 'Dönem toplamı', color: '#C8191E' },
                { label: 'Ortalama Gecikme', value: Math.round(stats().avgLate) + ' dk', sub: '08:30 vardiya bazlı', color: '#B4690E' },
                { label: 'Geofence Durumu', value: '30m Aktif', sub: 'Şube sınırı kontrolü', color: '#0B7A53' }
            ],
            preparedBy: S.user ? S.user.name + ' — ' + S.user.title : 'İnsan Kaynakları Yönetimi',
            headers: ['Sicil No', 'Ad Soyad', 'Departman', 'Şube', 'Toplam Gecikme (dk)', 'Gecikme Gün Sayısı', 'En Çok Geç Kaldığı Gün', 'Toplam Ek Mesai (dk)', 'Net Süre Bakiyesi'],
            rows: list.map(a => [
                a.emp.sicil, a.emp.name, a.emp.dept, brName(a.emp.branch),
                a.totalLateMin,
                a.lateDays,
                `${a.mostLateDay.dowName} (${a.mostLateDay.totalLateMin} dk)`,
                a.totalOvertimeMin,
                fmtMinSigned(a.netBalanceMin)
            ])
        });
        A.toast('Gecikme denetim raporu (.xlsx) indirildi');
    }

    function exportLeavesExcel() {
        const tone = { pending: 'Bekliyor', approved: 'Onaylandı', rejected: 'Reddedildi' };
        A.excelReport({
            fileName: 'Albayrak_Izin_Mazeret_Raporu_' + new Date().toISOString().slice(0, 10),
            title: 'KURUMSAL İZİN VE MAZERET TALEPLERİ RAPORU',
            subtitle: 'Personel Yıllık İzin, Sağlık Raporu ve Mazeret İzni Kayıtları',
            kpis: [
                { label: 'Toplam Talep', value: String(D.LEAVES.length), sub: 'Kayıtlı izin talebi' },
                { label: 'Onay Bekleyen', value: String(D.LEAVES.filter(l => l.status === 'pending').length), sub: 'İK onayı bekliyor', color: '#B4690E' },
                { label: 'Onaylanan', value: String(D.LEAVES.filter(l => l.status === 'approved').length), sub: 'Sisteme işlendi', color: '#0B7A53' },
                { label: 'Reddedilen', value: String(D.LEAVES.filter(l => l.status === 'rejected').length), sub: 'Gerekçesiyle kapatıldı', color: '#C8191E' },
                { label: 'Toplam Gecikme', value: fmtMinDur(stats().totalLateMin), sub: 'Dönem toplamı', color: '#C8191E' },
                { label: 'İzinli Personel', value: String(stats().leave), sub: 'Aktif izinli sayısı', color: '#2855AE' }
            ],
            preparedBy: S.user ? S.user.name + ' — ' + S.user.title : 'İnsan Kaynakları Yönetimi',
            headers: ['Talep No', 'Sicil No', 'Personel Adı', 'Departman', 'İzin Türü', 'Süre (Gün)', 'Başlangıç Tarihi', 'Açıklama', 'Durum'],
            rows: D.LEAVES.map(l => {
                const e = emp(l.empId);
                return ['LV-' + l.id, e.sicil, e.name, e.dept, l.type, l.days, l.from, l.reason, tone[l.status] || l.status];
            })
        });
        A.toast('İzin & mazeret Excel (.xlsx) raporu indirildi');
    }

    function exportItExcel() {
        A.excelReport({
            fileName: 'Albayrak_BT_Guvenlik_Denetim_' + new Date().toISOString().slice(0, 10),
            title: 'BT SİBER GÜVENLİK, CİHAZ EŞLEME VE DENETİM RAPORU',
            subtitle: 'Sahte GPS, Geofence İhlali, Cihaz Bütünlüğü ve Yönetici İşlem Kayıtları',
            kpis: [
                { label: 'Eşlenmiş Cihaz', value: String(D.DEVICES.filter(d => d.status === 'BOUND').length), sub: D.DEVICES.length + ' toplam cihaz', color: '#0B7A53' },
                { label: 'Açık Güvenlik Uyarısı', value: String(openAlerts().length), sub: 'Aktif incelemede', color: '#C8191E' },
                { label: 'Destek Talebi', value: String(openTickets().length), sub: 'Parola / kilit / cihaz', color: '#B4690E' }
            ],
            preparedBy: S.user ? S.user.name + ' — ' + S.user.title : 'Bilgi Teknolojileri Müdürlüğü',
            approvedBy: 'Bilgi Teknolojileri Müdürlüğü',
            summaryTitle: 'SON YÖNETİCİ DENETİM GÜNLÜĞÜ (AUDIT LOG)',
            summaryHeaders: ['Saat', 'İşlemi Yapan', 'İşlem Açıklaması', 'Hedef Kayıt', 'Kategori'],
            summaryRows: D.AUDIT.slice(0, 12).map(a => [a.t, a.who, a.act, a.target, a.cat]),
            headers: ['Uyarı No', 'Zaman', 'Sicil No', 'Personel', 'Şube', 'Güvenlik Olayı', 'Önem Derecesi', 'Durum'],
            rows: D.ALERTS.map(a => {
                const e = emp(a.empId);
                return ['AL-' + a.id, a.ago + ' önce', e.sicil, e.name, brName(a.branch), D.ALERT_TYPES[a.type], a.sev === 'HIGH' ? 'Yüksek' : a.sev === 'MED' ? 'Orta' : 'Düşük', a.resolved ? 'Çözüldü' : 'Bekliyor'];
            })
        });
        A.toast('BT Güvenlik ve Denetim Raporu (.xlsx) indirildi (A4 yazdırmaya hazır)');
    }

    /* ======================= Etkinlikler ======================= */
    function closeAllCustomSelects(except) {
        $$('.cselect.is-open').forEach(el => {
            if (el !== except) {
                el.classList.remove('is-open');
                const btn = el.querySelector('.cselect-btn');
                if (btn) btn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    const setTk = (id, status) => { const t = D.TICKETS.find(x => x.id === id); if (t) t.status = status; return t; };
    const acts = {
        'cselect-toggle': el => {
            const wrap = el.closest('.cselect');
            if (!wrap) return;
            const open = !wrap.classList.contains('is-open');
            closeAllCustomSelects(wrap);
            wrap.classList.toggle('is-open', open);
            el.setAttribute('aria-expanded', String(open));
        },
        'cselect-pick': el => {
            const id = el.dataset.bind, v = el.dataset.v;
            closeAllCustomSelects();
            applyBind(id, v);
        },
        'branch-pick': el => {
            S.branch = el.dataset.v;
            closeAllCustomSelects();
            renderBranchMenu();
            draw(false);
        },
        'ov-lb-tab': el => { S.ui.ovLb = el.dataset.v; draw(false); },
        'dr-range': el => { S.fromDate = ''; S.toDate = ''; S.range = +el.dataset.v; draw(false); },
        'pol-toggle': el => {
            const k = el.dataset.k;
            S.ui.policies[k] = !S.ui.policies[k];
            audit('Güvenlik politikası güncellendi (' + k + ')', S.ui.policies[k] ? 'AKTİF' : 'PASİF', 'SECURITY');
            A.toast('Güvenlik politikası güncellendi');
            draw(false);
        },
        'emp-open': el => empProfile(+el.dataset.id),
        'emp-expand': el => empToggleDetail(+el.dataset.id),
        'emp-collapse': () => empToggleDetail(null),
        'emp-profile': el => empProfile(+el.dataset.id),
        'emp-status': el => { S.ui.emp.status = el.dataset.v; S.ui.emp.page = 1; draw(false); },
        'emp-sort': el => { const u = S.ui.emp; u.dir = u.sort === el.dataset.v ? -u.dir : -1; u.sort = el.dataset.v; draw(false); },
        'emp-page': el => { S.ui.emp.page = +el.dataset.v; draw(false); },
        'leave-filter': el => { S.ui.leave.f = el.dataset.v; draw(false); },
        'leave-act': el => { const l = D.LEAVES.find(x => x.id === +el.dataset.id); l.status = el.dataset.v; audit(l.status === 'approved' ? 'İzin talebi onaylandı' : 'İzin talebi reddedildi', 'LV-' + l.id, 'HR'); A.toast(l.status === 'approved' ? 'Talep onaylandı' : 'Talep reddedildi'); draw(false); },
        'dnd-reset': () => A.resetDragLayout(dndKey(), () => draw(true)),
        'export-emps': el => A.runDownload(el, exportEmpsExcel),
        'export-leaderboards': el => A.runDownload(el, exportLeaderboardsExcel),
        'export-analytics': el => A.runDownload(el, exportAnalyticsExcel),
        'export-late': el => A.runDownload(el, exportLateExcel),
        'export-leaves': el => A.runDownload(el, exportLeavesExcel),
        'export-it': el => A.runDownload(el, exportItExcel),
        'export-one': el => A.runDownload(el, () => {
            const e = emp(+el.dataset.id), an = D.empAnalytics(e.id, filterOpts());
            A.excelReport({
                fileName: 'Analiz_' + e.sicil + '_' + new Date().toISOString().slice(0, 10),
                title: e.name.toLocaleUpperCase('tr-TR') + ' — DERİN PERFORMANS, EK MESAİ VE NET BAKİYE RAPORU',
                subtitle: e.title + ' · ' + e.dept + ' · ' + brName(e.branch) + ' · Dönem: ' + rangeLabel(),
                meta: [
                    ['Personel', e.name + ' (' + e.sicil + ')'],
                    ['Dönem', rangeLabel()],
                    ['En Çok Geç Kaldığı Gün', an.mostLateDay.totalLateMin > 0 ? `${an.mostLateDay.dowName} (${an.mostLateDay.totalLateMin} dk)` : 'Gecikme Yok'],
                    ['En Çok Ek Mesai Yaptığı Gün', `${an.mostOvertimeDay.dowName} (+${an.mostOvertimeDay.totalOvertimeMin} dk)`]
                ],
                kpis: [
                    { label: 'Net Süre Bakiyesi', value: fmtMinSigned(an.netBalanceMin), sub: 'Ek mesai − gecikme', color: an.netBalanceMin >= 0 ? '#0B7A53' : '#C8191E' },
                    { label: 'Toplam Ek Mesai', value: '+' + fmtMinDur(an.totalOvertimeMin), sub: an.overtimeDays + ' gün fazla mesai', color: '#0B7A53' },
                    { label: 'Toplam Gecikme', value: '−' + fmtMinDur(an.totalLateMin), sub: an.lateDays + ' gün gecikme', color: '#B4690E' },
                    { label: '30m Geofence Uyum', value: '%' + String(an.geofenceRate).replace('.', ','), sub: 'Ort. ' + an.avgDist + ' m mesafe', color: '#0B7A53' }
                ],
                summaryTitle: 'HAFTANIN GÜNLERİNE GÖRE (PAZARTESİ – CUMA) ÖZET TABLO',
                summaryHeaders: ['Haftanın Günü', 'Katılım (Gün)', 'Ortalama Giriş', 'Ortalama Çıkış', 'Toplam Gecikme (dk)', 'Toplam Ek Mesai (dk)', 'Net Süre Bakiyesi'],
                summaryRows: an.weekdayList.map(w => [w.dowName, w.attended, w.avgIn, w.avgOut, w.totalLateMin, w.totalOvertimeMin, fmtMinSigned(w.netMin)]),
                headers: ['Tarih', 'Gün', 'Giriş Saati', 'Çıkış Saati', 'Çalışma (Sa)', 'Gecikme (dk)', 'Ek Mesai (dk)', 'Net Bakiye', 'Konum (m)', 'Durum'],
                rows: an.logs.slice().reverse().map(l => [
                    l.fullDate, l.dowName, l.checkIn || '—', l.checkOut || '—',
                    l.workH || 0, l.lateMin, l.overtimeMin, fmtMinSigned(l.netMin),
                    l.dist != null ? l.dist + ' m' : '—', STATUS[l.status][0]
                ])
            });
            A.toast(e.name + ' detaylı analiz raporu (.xlsx) indirildi');
        }),
        'tk-filter': el => { S.ui.tk.f = el.dataset.v; draw(false); },
        'tk-reset': el => {
            const t = D.TICKETS.find(x => x.id === el.dataset.id), e = emp(t.empId), pw = tempPassword(); setTk(t.id, 'done'); audit('Geçici parola oluşturuldu', e.sicil, 'ACCOUNT');
            openModal('Geçici parola oluşturuldu', `<p><b>${esc(e.name)}</b> için tek kullanımlık parola hazır. Personele güvenli bir kanaldan iletin; ilk girişte değiştirmesi zorunludur.</p><div class="input" style="height:56px;color:var(--ink)"><input id="tmpPw" readonly value="${esc(pw)}" style="font-family:var(--mono);font-size:18px;letter-spacing:.06em"><button class="btn btn-soft btn-sm" data-act="copy-pw">${ic('copy')}Kopyala</button></div><p class="muted" style="font-size:12px">Bu parola kapatıldıktan sonra tekrar görüntülenemez ve denetim günlüğüne yazılmaz.</p>`, '<button class="btn btn-dark" data-act="modal-close">Tamam</button>');
            draw(false);
        },
        'copy-pw': () => { const i = $('#tmpPw'); i.select(); (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).then(() => A.toast('Panoya kopyalandı')).catch(() => { document.execCommand && document.execCommand('copy'); A.toast('Kopyalandı'); }); },
        'tk-unlock': el => { const t = setTk(el.dataset.id, 'done'); audit('Hesap kilidi açıldı', emp(t.empId).sicil, 'ACCOUNT'); A.toast('Hesap kilidi açıldı'); draw(false); },
        'tk-device': el => { const t = setTk(el.dataset.id, 'done'), d = D.DEVICES.find(x => x.empId === t.empId); if (d) d.status = 'PENDING'; audit('Cihaz eşlemesi sıfırlandı', emp(t.empId).sicil, 'DEVICE'); A.toast('Eşleme sıfırlandı · yeni cihaz bekleniyor'); draw(false); },
        'tk-progress': el => { setTk(el.dataset.id, 'progress'); A.toast('Talep işleme alındı'); draw(false); },
        'tk-done': el => { setTk(el.dataset.id, 'done'); A.toast('Talep çözüldü olarak işaretlendi'); draw(false); },
        'al-sev': el => { S.ui.alert.sev = el.dataset.v; draw(false); },
        'al-resolve': el => { const a = D.ALERTS.find(x => x.id === +el.dataset.id); a.resolved = true; audit('Güvenlik uyarısı kapatıldı', 'AL-' + a.id, 'SECURITY'); A.toast('Uyarı çözüldü'); draw(false); },
        'al-block': el => { const a = D.ALERTS.find(x => x.id === +el.dataset.id), d = D.DEVICES.find(x => x.empId === a.empId); a.resolved = true; if (d) d.status = 'BLOCKED'; audit('Cihaz engellendi', emp(a.empId).sicil, 'SECURITY'); A.toast('Cihaz engellendi'); draw(false); },
        'dv-unbind': el => { const d = D.DEVICES.find(x => x.id === el.dataset.id); d.status = 'PENDING'; audit('Cihaz eşlemesi sıfırlandı', d.id, 'DEVICE'); A.toast('Eşleme sıfırlandı'); draw(false); },
        'dv-unblock': el => { const d = D.DEVICES.find(x => x.id === el.dataset.id); d.status = 'BOUND'; audit('Cihaz engeli kaldırıldı', d.id, 'DEVICE'); A.toast('Engel kaldırıldı'); draw(false); },
        'au-cat': el => { S.ui.audit.cat = el.dataset.v; draw(false); },
        'br-add': () => openModal('Yeni şube', `<form class="form-grid" id="brForm" novalidate>
            <label class="field"><span>Şube adı</span><div class="input"><input id="brName" maxlength="60" placeholder="Örn. Antalya Muratpaşa Şubesi"></div></label>
            <label class="field"><span>Şehir</span><div class="input"><input id="brCity" maxlength="40"></div></label>
            <div class="grid g-2"><label class="field"><span>Enlem</span><div class="input"><input id="brLat" inputmode="decimal" placeholder="36.8841"></div></label><label class="field"><span>Boylam</span><div class="input"><input id="brLng" inputmode="decimal" placeholder="30.7056"></div></label></div>
            <div class="grid g-2"><label class="field"><span>Yarıçap (m)</span><div class="input"><input id="brRad" inputmode="numeric" value="30"></div></label><label class="field"><span>Wi-Fi adı</span><div class="input"><input id="brWifi" maxlength="40"></div></label></div>
            <p class="form-error" id="brErr" hidden></p></form>`, '<button class="btn btn-soft" data-act="modal-close">Vazgeç</button><button class="btn btn-primary" data-act="br-save">Kaydet</button>'),
        'br-save': () => {
            const v = id => $('#' + id).value.trim(), lat = parseFloat(v('brLat').replace(',', '.')), lng = parseFloat(v('brLng').replace(',', '.')), rad = parseInt(v('brRad'), 10), err = $('#brErr');
            const bad = !v('brName') ? 'Şube adı gerekli.' : !(lat >= -90 && lat <= 90) ? 'Enlem −90 ile 90 arasında olmalı.' : !(lng >= -180 && lng <= 180) ? 'Boylam −180 ile 180 arasında olmalı.' : !(rad >= 10 && rad <= 100) ? 'Yarıçap 10–100 m arasında olmalı.' : '';
            if (bad) { err.textContent = bad; err.hidden = false; return; }
            const code = (v('brName').replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '').slice(0, 3) || 'SUB').toLocaleUpperCase('tr-TR') + (D.BRANCHES.length + 1);
            D.BRANCHES.push({ code, name: v('brName'), city: v('brCity') || '—', lat, lng, radius: rad, wifi: v('brWifi') || '—', w: 0 }); audit('Yeni şube geofence tanımlandı', code, 'SYSTEM'); closeModal(); A.toast('Şube eklendi · ' + rad + ' m'); draw(false);
        },
        'onb-submit': () => {
            const u = S.ui.onb;
            const name = (u.name || '').trim();
            if (name.length < 3 || !name.includes(' ')) {
                A.toast('Lütfen personelin ad ve soyadını eksiksiz girin.', 'err');
                const el = $('#onbName'); if (el) el.focus();
                return;
            }
            const created = D.addEmployee({
                name,
                dept: u.dept,
                title: u.title,
                branch: u.branch,
                email: (u.email || '').trim(),
                startDate: u.startDate,
                status: u.status
            });
            audit('Yeni personel işe giriş kaydı oluşturuldu (' + created.name + ')', created.sicil, 'HR');
            u.name = '';
            u.email = '';
            A.toast(created.name + ' (' + created.sicil + ') PDKS sistemine eklendi');
            draw(false);
        },
        'adm-role-pick': el => {
            const r = el.dataset.v;
            S.ui.adm.role = r;
            S.ui.adm.perms = (PERM_CATALOG[r] || []).map(p => p.k);
            draw(false);
        },
        'adm-perm-toggle': el => {
            const k = el.dataset.k;
            const list = S.ui.adm.perms;
            const idx = list.indexOf(k);
            if (idx >= 0) list.splice(idx, 1); else list.push(k);
            draw(false);
        },
        'adm-gen-pw': () => {
            S.ui.adm.pass = tempPassword();
            draw(false);
        },
        'adm-filter': el => {
            S.ui.adm.filter = el.dataset.v;
            draw(false);
        },
        'adm-create-user': () => {
            const u = S.ui.adm;
            const name = (u.name || '').trim();
            const title = (u.title || '').trim() || (u.role === 'HR' ? 'İK Uzmanı' : 'BT Sistem Uzmanı');
            const email = (u.email || '').trim().toLowerCase();
            const pass = (u.pass || '').trim();
            if (name.length < 3) { A.toast('Lütfen kullanıcının ad ve soyadını girin.', 'err'); return; }
            if (!email || !email.includes('@')) { A.toast('Geçerli bir kurumsal e-posta adresi girin.', 'err'); return; }
            if (ACCOUNTS.some(a => a.email === email)) { A.toast('Bu e-posta adresiyle kayıtlı bir kullanıcı zaten var.', 'err'); return; }
            if (pass.length < 6) { A.toast('Parola en az 6 karakter olmalıdır.', 'err'); return; }
            if (!u.perms.length) { A.toast('En az 1 modül yetkisi seçmelisiniz.', 'err'); return; }

            const newAcc = {
                email,
                pass,
                role: u.role,
                name,
                title,
                branch: u.branch || 'ALL',
                active: true,
                perms: u.perms.slice()
            };
            ACCOUNTS.push(newAcc);
            saveAccounts();
            audit('Yeni ' + (u.role === 'HR' ? 'İK' : 'BT') + ' portal kullanıcısı oluşturuldu (' + name + ')', email, 'ACCOUNT');
            u.name = '';
            u.title = '';
            u.email = '';
            u.pass = 'Albayrak!2026';
            A.toast(name + ' (' + (u.role === 'HR' ? 'İK' : 'BT') + ') kullanıcısı ve yetkileri kaydedildi');
            draw(false);
        },
        'adm-toggle-active': el => {
            const acc = ACCOUNTS.find(a => a.email === el.dataset.email);
            if (!acc) return;
            acc.active = acc.active === false ? true : false;
            saveAccounts();
            audit('Kullanıcı durumu güncellendi (' + (acc.active ? 'AKTİF' : 'ASKIDA') + ')', acc.email, 'ACCOUNT');
            A.toast(acc.name + ' hesabı ' + (acc.active ? 'aktifleştirildi' : 'askıya alındı'));
            draw(false);
        },
        'adm-edit-perms': el => {
            const acc = ACCOUNTS.find(a => a.email === el.dataset.email);
            if (!acc) return;
            const cat = PERM_CATALOG[acc.role] || [];
            const renderModalPerms = () => `
                <p style="margin-bottom:12px"><b>${esc(acc.name)}</b> (${esc(acc.email)}) kullanıcısının <b>${acc.role === 'HR' ? 'İK Portalı' : 'BT Portalı'}</b> üzerindeki modül ve işlem yetkilerini seçin:</p>
                <div class="list" style="border:1px solid var(--line);border-radius:12px;overflow:hidden">
                    ${cat.map(pm => {
                        const has = (acc.perms || []).includes(pm.k);
                        return `<div class="list-item" style="cursor:pointer;padding:10px 14px" data-act="adm-perm-modal-toggle" data-email="${esc(acc.email)}" data-k="${esc(pm.k)}">
                            <span class="ico-sq ${has ? 'ok' : ''}" style="width:28px;height:28px;border-radius:8px">${ic(has ? 'check' : 'lock')}</span>
                            <div class="grow"><b>${esc(pm.l)}</b><small style="display:block;color:var(--muted)">${esc(pm.d)}</small></div>
                            <button type="button" class="switch ${has ? 'on' : ''}"><span></span></button>
                        </div>`;
                    }).join('')}
                </div>`;
            openModal('Yetkileri Düzenle · ' + acc.name, renderModalPerms(), '<button class="btn btn-primary" data-act="modal-close">Kaydet ve Kapat</button>');
        },
        'adm-perm-modal-toggle': el => {
            const acc = ACCOUNTS.find(a => a.email === el.dataset.email);
            if (!acc) return;
            acc.perms = acc.perms || [];
            const k = el.dataset.k;
            const idx = acc.perms.indexOf(k);
            if (idx >= 0) acc.perms.splice(idx, 1); else acc.perms.push(k);
            saveAccounts();
            audit('Kullanıcı yetkileri güncellendi (' + acc.perms.length + ' yetki)', acc.email, 'ACCOUNT');
            acts['adm-edit-perms'](el);
            draw(false);
        },
        'modal-close': closeModal
    };

    function applyBind(id, v) {
        const U = S.ui;
        ({
            'emp-q': () => { U.emp.q = v; U.emp.page = 1; },
            'emp-dept': () => { U.emp.dept = v; U.emp.page = 1; },
            'emp-size': () => { U.emp.size = +v; U.emp.page = 1; },
            'leave-type': () => U.leave.type = v,
            'tk-q': () => U.tk.q = v,
            'tk-type': () => U.tk.type = v,
            'al-type': () => U.alert.type = v,
            'al-show': () => U.alert.show = v,
            'dv-q': () => U.dev.q = v,
            'dv-status': () => U.dev.status = v,
            'dv-ver': () => U.dev.ver = v,
            'sim-branch': () => U.simBranch = v,
            'sim-dist': () => U.simDist = +v,
            'onb-name': () => U.onb.name = v,
            'onb-email': () => U.onb.email = v,
            'onb-dept': () => U.onb.dept = v,
            'onb-title': () => U.onb.title = v,
            'onb-branch': () => U.onb.branch = v,
            'onb-date': () => U.onb.startDate = v,
            'onb-status': () => U.onb.status = v,
            'adm-name': () => U.adm.name = v,
            'adm-title': () => U.adm.title = v,
            'adm-email': () => U.adm.email = v,
            'adm-pass': () => U.adm.pass = v,
            'adm-branch': () => U.adm.branch = v
        }[id] || (() => { }))();
        draw(false);
    }

    function onClick(e) {
        if (!e.target.closest('.cselect')) closeAllCustomSelects();
        const go_ = e.target.closest('[data-go]'); if (go_) { go(go_.dataset.go); return; }
        const el = e.target.closest('[data-act]'); if (el && acts[el.dataset.act]) acts[el.dataset.act](el);
    }
    function onBind(e) {
        const t = e.target, id = t.dataset.bind; if (!id) return;
        applyBind(id, t.value);
    }

    /* ======================= Oturum ======================= */
    const ROLE_PORTAL_NAME = { HR: 'İK Portalı', IT: 'BT Portalı', ADMIN: 'Admin Portalı' };
    const ROLE_FULL_NAME = { HR: 'İnsan Kaynakları', IT: 'Bilgi Teknolojileri', ADMIN: 'Sistem Yöneticisi (Admin)' };

    function startApp() {
        $('#authView').hidden = true; $('#appView').hidden = false; window.scrollTo({ top: 0 });
        const u = S.user; S.page = 'overview'; S.range = 30; S.fromDate = ''; S.toDate = ''; S.branch = u.branch && u.branch !== 'ALL' ? u.branch : 'ALL';
        $('#sidePortal').textContent = ROLE_PORTAL_NAME[u.role] || 'Yönetim Portalı'; $('#userName').textContent = u.name; $('#userTitle').textContent = u.title; $('#userAvatar').textContent = A.initials(u.name);
        renderBranchMenu();
        syncDateInputs();
        const h = location.hash.replace('#/', ''); if (PAGES[u.role][h]) S.page = h;
        buildNav(); draw(true); placeNav(); armIdle(); setTimeout(() => { placeNav(); A.placeSeg($('#rangeSeg')); }, 60);
    }
    function logout(msg) {
        sessionStorage.removeItem('atf_session'); S.user = null; clearTimeout(idleTimer); closeDrawer(); closeModal();
        $('#appView').hidden = true; $('#authView').hidden = false; $('#loginPassword').value = ''; history.replaceState(null, '', location.pathname);
        setTimeout(() => A.placeSeg($('#portalSeg')), 30); if (msg) A.toast(msg);
    }
    function armIdle() { clearTimeout(idleTimer); idleTimer = setTimeout(() => logout('Hareketsizlik nedeniyle oturum kapatıldı.'), 15 * 60 * 1000); }
    function login(e) {
        e.preventDefault(); const err = $('#loginError'), btn = $('#loginBtn'); err.hidden = true;
        if (Date.now() < lockUntil) { err.textContent = 'Çok fazla hatalı deneme. ' + Math.ceil((lockUntil - Date.now()) / 1000) + ' sn sonra tekrar deneyin.'; err.hidden = false; return; }
        const email = $('#loginEmail').value.trim().toLowerCase(), pass = $('#loginPassword').value;
        const acc = ACCOUNTS.find(a => a.email === email && a.pass === pass && a.role === S.portal);
        if (!acc) {
            fails++; if (fails >= 5) { lockUntil = Date.now() + 60000; fails = 0; }
            err.textContent = 'E-posta veya parola hatalı ya da seçtiğiniz birim (' + (ROLE_PORTAL_NAME[S.portal] || S.portal) + ') için yetkiniz yok.'; err.hidden = false; err.style.animation = 'none'; void err.offsetWidth; err.style.animation = ''; return;
        }
        if (acc.active === false) {
            err.textContent = 'Bu kullanıcı hesabı Sistem Yöneticisi tarafından askıya alınmıştır.'; err.hidden = false; return;
        }
        fails = 0; btn.disabled = true; btn.querySelector('span').textContent = 'Giriş yapılıyor…';
        setTimeout(() => { btn.disabled = false; btn.querySelector('span').textContent = 'Giriş yap'; S.user = { email: acc.email, role: acc.role, name: acc.name, title: acc.title, branch: acc.branch || 'ALL', perms: acc.perms || [] }; sessionStorage.setItem('atf_session', JSON.stringify({ email: acc.email, role: acc.role })); startApp(); A.toast('Hoş geldiniz, ' + acc.name.split(' ')[0]); }, 450);
    }

    /* ======================= Başlangıç ======================= */
    function init() {
        document.documentElement.dataset.theme = localStorage.getItem('atf_theme') || 'light';
        A.hydrate(document); $('#authLogo').innerHTML = A.LOGO; $('#sideLogo').innerHTML = A.LOGO; $('#authLogo').style.color = '#fff'; $('#sideLogo').style.color = 'var(--charcoal)';
        const themeIc = () => { $('#themeBtn').innerHTML = ic(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon'); $('#sideLogo').style.color = document.documentElement.dataset.theme === 'dark' ? '#fff' : 'var(--charcoal)'; }; themeIc();
        $('#themeBtn').onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; localStorage.setItem('atf_theme', t); themeIc(); if (S.user) draw(false); };

        $('#portalSeg').addEventListener('click', e => { const b = e.target.closest('.seg-btn'); if (!b) return; $$('#portalSeg .seg-btn').forEach(x => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-selected', x === b); }); S.portal = b.dataset.portal; A.placeSeg($('#portalSeg')); $('#loginError').hidden = true; });
        $('#rangeSeg').addEventListener('click', e => {
            const b = e.target.closest('.seg-btn'); if (!b) return;
            S.range = +b.dataset.range; S.fromDate = ''; S.toDate = '';
            $$('#rangeSeg .seg-btn').forEach(x => x.classList.toggle('is-active', x === b));
            A.placeSeg($('#rangeSeg')); syncDateInputs(); draw(false);
        });

        // Üst çubuk Özel Tarih Seçici olayları
        $('#dateFrom').addEventListener('change', e => {
            S.fromDate = e.target.value;
            if (!S.toDate && S.fromDate) S.toDate = D.DAYS[D.DAYS.length - 1].iso;
            if (S.toDate && S.fromDate > S.toDate) S.toDate = S.fromDate;
            syncDateInputs(); draw(false);
        });
        $('#dateTo').addEventListener('change', e => {
            S.toDate = e.target.value;
            if (!S.fromDate && S.toDate) S.fromDate = D.DAYS[0].iso;
            if (S.fromDate && S.toDate < S.fromDate) S.fromDate = S.toDate;
            syncDateInputs(); draw(false);
        });
        $('#dateClearBtn').addEventListener('click', () => {
            S.fromDate = ''; S.toDate = '';
            syncDateInputs(); draw(false);
        });

        $('#loginForm').addEventListener('submit', login);
        $('#togglePass').onclick = () => { const i = $('#loginPassword'); i.type = i.type === 'password' ? 'text' : 'password'; };
        $('#demoFill').onclick = () => { const a = ACCOUNTS.find(x => x.role === S.portal); $('#loginEmail').value = a.email; $('#loginPassword').value = a.pass; $('#loginPassword').focus(); };
        $('#authKvkk').onclick = e => { e.preventDefault(); S.user = S.user || { name: '', role: 'HR' }; const u = S.user; kvkkModal(); if (!$('#appView').hidden) return; S.user = u.name ? u : null; };
        $('#kvkkBtn').onclick = kvkkModal;
        $('#logoutBtn').onclick = () => logout('Oturum kapatıldı.');
        $('#userBtn').onclick = () => openModal('Hesap', `<div class="profile"><span class="avatar lg">${esc(A.initials(S.user.name))}</span><div><h4>${esc(S.user.name)}</h4><span class="muted">${esc(S.user.title)}</span></div></div><div class="kv"><div><small>E-posta</small><b>${esc(S.user.email)}</b></div><div><small>Yetki</small><b>${esc(ROLE_FULL_NAME[S.user.role] || S.user.role)}</b></div></div><p class="muted" style="font-size:12px">Oturum 15 dakika hareketsizlikte otomatik kapanır.</p>`, '<button class="btn btn-soft" data-act="modal-close">Kapat</button>');
        $('#bellBtn').onclick = () => { const items = S.user.role === 'HR' ? [[`${D.LEAVES.filter(l => l.status === 'pending').length} izin talebi onay bekliyor`, 'leaves'], [`Bugün ${D.EMPLOYEES.filter(e => e.status === 'LATE').length} kişi geç kaldı`, 'employees']] : S.user.role === 'ADMIN' ? [[`${ACCOUNTS.length} portal kullanıcısı aktif`, 'overview'], [`RBAC rol ve yetki matrisi güncel`, 'permissions']] : [[`${openAlerts().length} açık güvenlik uyarısı`, 'security'], [`${openTickets().length} destek talebi bekliyor`, 'support']]; openDrawer('Bildirimler', `<div class="list">${items.map(i => `<div class="list-item" style="cursor:pointer" data-go="${i[1]}"><span class="ico-sq red">${ic('bell')}</span><div class="grow"><b>${i[0]}</b><small>Şimdi</small></div>${ic('chevron')}</div>`).join('')}</div>`, false); };
        $('#menuBtn').onclick = () => { $('#side').classList.add('on'); $('#scrim').classList.add('on'); };
        $('#scrim').onclick = closeSide;
        $('#drawerClose').onclick = closeDrawer; $('#modalClose').onclick = closeModal;
        $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
        document.addEventListener('click', e => { if (!e.target.closest('#drawer') && !e.target.closest('[data-act="emp-open"]') && !e.target.closest('#bellBtn')) closeDrawer(); onClick(e); }, true);
        document.addEventListener('input', onBind);
        document.addEventListener('keydown', e => {
            const openWrap = $('.cselect.is-open');
            if (openWrap) {
                const items = Array.from(openWrap.querySelectorAll('.cselect-item'));
                const focused = openWrap.querySelector('.cselect-item:focus') || openWrap.querySelector('.cselect-item.is-selected');
                let idx = items.indexOf(focused);

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = items[(idx + 1) % items.length] || items[0];
                    if (next) next.focus();
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = items[(idx - 1 + items.length) % items.length] || items[items.length - 1];
                    if (prev) prev.focus();
                    return;
                }
                if (e.key === 'Enter' || e.key === ' ') {
                    if (document.activeElement && document.activeElement.classList.contains('cselect-item')) {
                        e.preventDefault();
                        document.activeElement.click();
                        return;
                    }
                }
            }
            if (e.key === 'Escape') { closeAllCustomSelects(); closeModal(); closeDrawer(); closeSide(); }
            if (S.user) armIdle();
        });
        ['pointerdown', 'scroll'].forEach(ev => addEventListener(ev, () => { if (S.user) armIdle(); }, { passive: true }));
        addEventListener('scroll', () => $('.top').classList.toggle('is-stuck', scrollY > 4), { passive: true });
        addEventListener('resize', () => { placeNav(); A.placeSeg($('#rangeSeg')); A.placeSeg($('#portalSeg')); });
        addEventListener('hashchange', () => { if (!S.user) return; const h = location.hash.replace('#/', ''); if (h && h !== S.page) go(h); });

        try { const s = JSON.parse(sessionStorage.getItem('atf_session') || 'null'), a = s && ACCOUNTS.find(x => x.email === s.email && x.role === s.role); if (a) { S.user = { email: a.email, role: a.role, name: a.name, title: a.title }; S.portal = a.role; startApp(); return; } } catch (e) { sessionStorage.removeItem('atf_session'); }
        requestAnimationFrame(() => A.placeSeg($('#portalSeg'))); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => A.placeSeg($('#portalSeg')));
    }
    function closeSide() { $('#side').classList.remove('on'); $('#scrim').classList.remove('on'); }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
