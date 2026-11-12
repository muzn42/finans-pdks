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
            name: 'Elif Demir', title: 'İşe Alım ve Özlük Uzmanı', branch: 'ŞB-001', active: true,
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
            // Varsayılan demo hesapları dışındaki kullanıcıların parolası tarayıcıya yazılmaz.
            const demoEmails = new Set(DEFAULT_ACCOUNTS.map(a => a.email));
            const safe = ACCOUNTS.map(a => (demoEmails.has(a.email) ? a : Object.assign({}, a, { pass: undefined })));
            localStorage.setItem('atf_portal_accounts', JSON.stringify(safe));
        } catch (_) {}
    }

    /* Admin hesap güncellemesini sunucuya yazar. Sunucuya ulaşılamazsa (çevrimdışı demo) yerelde devam eder. */
    async function patchAccount(body) {
        let res = null;
        try {
            res = await fetch('/api/v1/accounts', {
                method: 'PATCH', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(body)
            });
        } catch (_) { return true; }
        if (res.ok) return true;
        const d = await res.json().catch(() => null);
        A.toast((d && d.message) || 'Kullanıcı güncellenemedi.', 'err');
        return false;
    }

    const S = {
        user: null, page: 'overview', range: 30, fromDate: '', toDate: '', branch: 'ALL', portal: 'HR',
        openEmpId: null,
        ui: {
            ovLb: 'best', // 'best' | 'worst'
            emp: { q: '', status: 'ALL', dept: 'ALL', sort: 'net', dir: -1, page: 1, size: 12, openId: null },
            profLog: { sort: 'date', dir: -1, status: 'ALL' },
            onb: { name: '', dept: 'Şube Operasyon', title: 'Müşteri Temsilcisi', branch: 'ŞB-001', status: 'PRESENT', startDate: '2026-10-20', email: '' },
            adm: {
                filter: 'ALL',
                role: 'HR',
                name: '',
                title: '',
                email: '',
                pass: tempPassword(),
                branch: 'ALL',
                perms: ['emp_view', 'emp_add', 'leave_manage', 'analytics_view', 'excel_export']
            },
            leave: { f: 'pending', type: 'ALL', lateSort: 'pending' }, alert: { sev: 'ALL', type: 'ALL', show: 'open' },
            tk: { f: 'open', type: 'ALL', q: '' }, dev: { q: '', status: 'ALL', ver: 'ALL' }, audit: { cat: 'ALL' },
            policies: {
                geofence30m: true,
                mockGpsBlock: true,
                freshLocationZeroAge: true,
                accuracyFracFilter: true,
                passiveWifiScanLog: true,
                strictWifiBssidCheck: false,
                singleDevice: true,
                autoTimeout: true
            },
            simBranch: 'ŞB-001', simDist: 14, brQ: '', wifiDiscQ: '', wifiDiscFilter: 'UNASSIGNED', branchRank: { q: '', limit: 10 },
            reportId: null,
            shifts: {
                empId: null, event: 'CHECK_IN', source: 'MOBILE_GEOFENCE', clock: '08:28', dist: 8,
                accuracy: '3.4521', mock: false, wifiScanMode: 'MATCH_PRIMARY', customBssid: 'a4:2b:8c:1d:e5:9f',
                lvType: 'Saatlik izin', lvDate: '', lvStart: '08:30', lvEnd: '10:00', lvDays: 1,
                lvNote: 'Resmi kurum ve noter işlemi için sabah saatlik izin talebi.',
                shCode: '', shName: '', shStart: '08:30', shEnd: '17:30', shGrace: 5, shBreak: 60,
                editId: null, asgScope: 'none',
                feedback: null
            }
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
        const c = s => E.filter(e => e.status === s).length;
        // İK'nın haklı bulup gecikmeden düştüğü dakikalar tüm KPI'lardan düşülür
        const eLate = e => Math.max(0, (e.lateMin || 0) - (e.lateExcusedMin || 0));
        const fullyExcused = E.filter(e => e.status === 'LATE' && eLate(e) === 0).length;
        const onTime = c('PRESENT') + fullyExcused;
        const lateEmpsForCount = E.filter(e => eLate(e) > 0);
        const late = lateEmpsForCount.length;
        const leave = c('LEAVE');
        const absent = c('ABSENT');
        const lateEmps = lateEmpsForCount;
        const avgLate = lateEmps.length ? lateEmps.reduce((a, e) => a + eLate(e), 0) / lateEmps.length : 0;
        const withDist = E.filter(e => e.dist != null);
        const geoOk = withDist.filter(e => e.dist <= 30).length;
        const geofencePct = withDist.length ? +((geoOk / withDist.length) * 100).toFixed(1) : 98.6;
        const y = allDays[allDays.length - 2] || allDays[allDays.length - 1] || { onTime: 0.9, late: 0.05 };
        const lb = D.computeLeaderboards(E, filterOpts());
        const isSingleToday = cur.length === 1 && !S.fromDate && !S.toDate;
        const totOtMin = isSingleToday
            ? E.reduce((a, e) => a + (e.overtimeMin || 0), 0)
            : lb.all.reduce((a, x) => a + x.totalOvertimeMin, 0);
        const totLateMin = isSingleToday
            ? E.reduce((a, e) => a + eLate(e), 0)
            : lb.all.reduce((a, x) => a + x.totalLateMin, 0);
        return {
            N,
            onTime,
            late,
            leave,
            absent,
            attended: onTime + late,
            avgLate,
            geofencePct,
            onTimePct: (onTime / N) * 100,
            prevPct: (y.onTime || 0.9) * 100,
            prevLate: Math.round((y.late || 0.05) * N),
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
        return `<article class="card kpi lift${o.cls ? ' ' + o.cls : ''}"><div class="kpi-top"><span class="kpi-label">${esc(o.label)}</span><span class="kpi-ic ${o.tone || ''}">${ic(o.icon)}</span></div>
        <div class="kpi-val"><span data-count="${o.val}" data-dec="${o.dec || 0}">0</span>${o.unit ? `<small>${o.unit}</small>` : ''}</div>
        <div class="kpi-foot">${o.delta || ''}<span>${o.foot || ''}</span>${o.spark || ''}</div></article>`;
    }
    function delta(v, unit, goodUp) {
        const dir = Math.abs(v) < .05 ? 'flat' : v > 0 ? 'up' : 'down', cls = dir === 'flat' ? 'flat' : ((v > 0) === (goodUp !== false) ? 'up' : 'down');
        return `<span class="delta ${cls}">${ic(dir)}${Math.abs(v).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}${unit}</span>`;
    }
    const pill = (txt, tone) => `<span class="pill ${tone}">${esc(txt)}</span>`;
    const avatar = (e, cls) => e
        ? `<span class="avatar t${e.tone || 1} ${cls || ''}">${esc(A.initials(e.name || ''))}</span>`
        : `<span class="avatar ${cls || ''}" aria-hidden="true">—</span>`;
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

    /* ======================= Kişiselleştirilebilir Kart Düzeni =======================
       Her kart W() ile kayda girer (kimlik, başlık, bölüm, varsayılan görünürlük).
       Kullanıcının gizle/göster tercihi rol + sayfa bazında tarayıcıda saklanır;
       sıralama ve genişlik mevcut sürükle-bırak motoru (A.enableDragGrid) ile tutulur. */
    let WREG = [];
    const wKey = () => 'atf_wvis_' + (S.user ? S.user.role : 'HR') + '_' + S.page;
    function wPrefs() {
        try {
            const p = JSON.parse(localStorage.getItem(wKey()) || '{}');
            return p && typeof p === 'object' ? p : {};
        } catch (_) { return {}; }
    }
    function wSetVisible(id, on) {
        const p = wPrefs();
        const vis = Object.assign({}, p.vis || {}, { [id]: !!on });
        try { localStorage.setItem(wKey(), JSON.stringify(Object.assign({}, p, { vis }))); } catch (_) { }
    }
    function wIsVisible(id, def) {
        const v = (wPrefs().vis || {})[id];
        return v == null ? def !== false : !!v;
    }
    /* Kartı kayda ekler. html bir `.card` ile başlamalı; görünür değilse boş döner. */
    function W(o, html) {
        const on = wIsVisible(o.id, o.def);
        WREG.push({ id: o.id, title: o.title, group: o.group || 'Kartlar', row: o.row || '', def: o.def !== false, on });
        if (!on) return '';
        return String(html).replace(/^\s*<(section|article)\b/, m => `${m} data-wid="${esc(o.id)}" data-wtitle="${esc(o.title)}" data-hideable="1"`);
    }
    /* Satır: görünür kart sayısına göre sütun düzenini seçer; tümü gizliyse satır hiç basılmaz. */
    function wRow(gid, items, kind) {
        const vis = items.filter(Boolean);
        if (!vis.length) return '';
        const n = vis.length;
        let cls;
        if (kind === 'kpi') cls = n >= 5 ? 'g-5' : n === 4 ? 'g-4' : n === 3 ? 'g-3' : n === 2 ? 'g-2' : 'g-1';
        else if (kind === 'main') cls = n === 2 ? 'g-main' : n >= 3 ? 'g-3' : 'g-1';
        else cls = n >= 3 ? 'g-3' : n === 2 ? 'g-2' : 'g-1';
        return `<div class="grid ${cls} mt" data-gid="${esc(gid)}">${vis.join('')}</div>`;
    }
    /* Bölüm başlığı: Analitik ve Genel bakışta içerik gruplarını ayırır */
    function wSection(id, title, sub, body) {
        if (!body.trim()) return '';
        const closed = !!(S.ui.secClosed && S.ui.secClosed[S.page + ':' + id]);
        return `<section class="w-section${closed ? ' is-closed' : ''}" id="sec-${esc(id)}" aria-labelledby="sec-${esc(id)}-h">
            <header class="w-section-head">
                <button type="button" class="w-section-toggle" data-act="w-sec" data-v="${esc(id)}" aria-expanded="${!closed}" aria-controls="sec-${esc(id)}-b">
                    <span class="w-section-caret">${ic('chevron')}</span>
                    <h2 id="sec-${esc(id)}-h">${esc(title)}</h2>
                </button>
                ${sub ? `<p>${esc(sub)}</p>` : ''}
            </header>
            <div class="w-section-body" id="sec-${esc(id)}-b"${closed ? ' hidden' : ''}>${body}</div>
        </section>`;
    }
    /* Sayfa üstü araç çubuğu: dönem etiketi + Düzeni özelleştir */
    const wToolbar = (label, extra) => `<div class="w-toolbar">
        <span class="w-toolbar-label">${label}</span>
        <div class="w-toolbar-acts">
            ${extra || ''}
            <button type="button" class="btn btn-soft btn-sm" data-act="w-panel" aria-haspopup="dialog">${ic('sliders')} Düzeni özelleştir</button>
        </div>
    </div>`;
    function wPanelHtml() {
        const groups = [];
        WREG.forEach(r => { let g = groups.find(x => x.name === r.group); if (!g) { g = { name: r.group, items: [] }; groups.push(g); } g.items.push(r); });
        /* İsteğe bağlı kartlar her zaman listenin sonunda */
        groups.sort((a, b) => (a.name === 'Ek kartlar') - (b.name === 'Ek kartlar'));
        const shown = WREG.filter(r => r.on).length;
        return `<p class="muted w-panel-intro">Gösterilecek kartları seçin. Kartları sayfada tutup sürükleyerek veya aşağıdaki oklarla sıralayabilirsiniz. Tercihleriniz bu tarayıcıda saklanır.</p>
        <div class="w-panel-count"><b>${shown}</b> / ${WREG.length} kart gösteriliyor</div>
        ${groups.map(g => `<div class="w-panel-group" role="group" aria-label="${esc(g.name)}">
            <h4>${esc(g.name)}</h4>
            ${g.items.map(r => `<div class="w-panel-item${r.on ? ' is-on' : ''}">
                <button type="button" class="w-switch" role="switch" aria-checked="${r.on}" data-act="w-toggle" data-id="${esc(r.id)}" id="wsw-${esc(r.id)}">
                    <span class="w-switch-track"><span class="w-switch-dot"></span></span>
                    <span class="w-switch-label">${esc(r.title)}${r.def ? '' : ' <small class="pill info">Ek kart</small>'}</span>
                </button>
                <div class="w-panel-move">
                    <button type="button" class="icon-btn sm" data-act="w-move" data-id="${esc(r.id)}" data-v="-1" ${r.on ? '' : 'disabled'} aria-label="${esc(r.title)} kartını öne al">${ic('arrUp')}</button>
                    <button type="button" class="icon-btn sm" data-act="w-move" data-id="${esc(r.id)}" data-v="1" ${r.on ? '' : 'disabled'} aria-label="${esc(r.title)} kartını geri al">${ic('arrDown')}</button>
                </div>
            </div>`).join('')}
        </div>`).join('')}
        <div class="w-panel-foot"><button type="button" class="btn btn-ghost btn-sm" data-act="w-reset">${ic('refresh')} Varsayılan düzene dön</button></div>`;
    }

    /* Şubelere göre zamanında gelme: 54 şube kartı büyütmesin diye arama + İlk 10 / Tümü
       ve kart içinde kaydırma (`.rank-scroll`) ile sınırlandırılır. */
    function branchRankData() {
        const q = (S.ui.branchRank.q || '').trim().toLocaleLowerCase('tr');
        const rows = D.BRANCHES.map(b => {
            const L = D.EMPLOYEES.filter(e => e.branch === b.code);
            const p = A.clamp((L.filter(e => e.status === 'PRESENT').length / (L.length || 1)) * 100, 0, 100);
            return { l: b.name, v: A.pctText(p) + '%', w: p, cls: p > 92 ? 'ok' : '', n: L.length };
        }).filter(x => !q || x.l.toLocaleLowerCase('tr').includes(q))
            .sort((a, b) => b.w - a.w || a.l.localeCompare(b.l, 'tr'));
        return { rows, shown: S.ui.branchRank.limit > 0 ? rows.slice(0, S.ui.branchRank.limit) : rows };
    }
    function paintBranchRank() {
        const host = $('#chBranch'); if (!host) return;
        const { rows, shown } = branchRankData();
        host.innerHTML = shown.length
            ? rank(shown)
            : `<div class="rank-empty">${esc(S.ui.branchRank.q ? 'Eşleşen şube yok.' : 'Şube verisi yok.')}</div>`;
        const meta = $('#brRankMeta');
        if (meta) meta.textContent = `${shown.length}/${rows.length} şube`;
    }
    const empty = (t, s) => `<div class="empty"><b>${esc(t)}</b>${esc(s || '')}</div>`;

    /* ======================= İK SAYFALARI ======================= */
    const HR = {};

    /* ---------- İK yardımcıları: bugün ve son 30 iş günü gecikme özeti ---------- */
    const lateNet = e => Math.max(0, (e.lateMin || 0) - (e.lateExcusedMin || 0));
    const inBranch = id => { const e = emp(id); return !!e && (S.branch === 'ALL' || e.branch === S.branch); };
    /* Son N iş gününün günlük gecikme dökümü (personel kayıtlarından, şube filtresine uyumlu) */
    function dailyLateSeries(lb, days) {
        const map = new Map(days.map(d => [d.iso, { day: d, cnt: 0, min: 0, att: 0 }]));
        lb.all.forEach(a => a.logs.forEach(l => {
            const m = map.get(l.iso); if (!m) return;
            if (l.status === 'LEAVE' || l.status === 'ABSENT') return;
            m.att++;
            if (l.lateMin > 0) { m.cnt++; m.min += l.lateMin; }
        }));
        return days.map(d => map.get(d.iso));
    }
    function pendingLateReasons() {
        return (D.LATE_REASONS || []).filter(r => r.status === 'PENDING' && inBranch(r.empId));
    }
    function pendingLeaves() {
        return D.LEAVES.filter(l => l.status === 'pending' && inBranch(l.empId));
    }
    const todayLabel = () => { const d = D.DAYS[D.DAYS.length - 1]; return d ? d.fullDate + ' · ' + d.dowName : 'bugün'; };

    HR.overview = {
        title: 'Genel bakış',
        sub: () => 'Bugünün devam durumu ve onayınızı bekleyen işler · ' + todayLabel(),
        tools: { branch: 1 },
        icon: 'grid',
        render() {
            const E = emps(), N = E.length || 1;
            const lateToday = E.filter(e => lateNet(e) > 0).slice().sort((a, b) => lateNet(b) - lateNet(a));
            const absentToday = E.filter(e => e.status === 'ABSENT');
            const leaveToday = E.filter(e => e.status === 'LEAVE');
            const onTime = E.filter(e => e.status === 'PRESENT' || (e.status === 'LATE' && lateNet(e) === 0)).length;
            const avgLate = lateToday.length ? Math.round(lateToday.reduce((s, e) => s + lateNet(e), 0) / lateToday.length) : 0;
            const latestIn = lateToday.reduce((m, e) => (e.inMin != null && e.inMin > m ? e.inMin : m), 0);

            const lb30 = D.computeLeaderboards(E, { range: 30 });
            const lateDaysOf = new Map(lb30.all.map(a => [a.empId, a.lateDays]));
            const series = dailyLateSeries(lb30, D.DAYS.slice(-14));
            const prev = series[series.length - 2] || { cnt: 0 };
            const chronic = lb30.mostLate.filter(a => a.lateDays > 0).slice(0, 6);
            const pLate = pendingLateReasons(), pLeave = pendingLeaves();
            const absentDaysOf = new Map(lb30.all.map(a => [a.empId, a.absentDays]));
            /* İzinlinin onaylı izin kaydı (tür + tarih); bulunamazsa genel "İzinli" */
            const leaveOf = id => D.LEAVES.filter(l => l.empId === id && l.status === 'approved').slice(-1)[0];

            const kpis = wRow('ov-kpi', [
                W({ id: 'ov-k-late', title: 'Bugün geç kalan', group: 'Bugün' }, kpi({
                    label: 'Bugün geç kalan', val: lateToday.length, icon: 'clock', tone: 'warn', cls: 'kpi-primary',
                    delta: delta(lateToday.length - prev.cnt, ' kişi', false),
                    foot: lateToday.length ? `ort. ${avgLate} dk · en geç giriş ${D.hhmm(latestIn)}` : 'Bugün gecikme yok',
                    spark: A.spark(series.map(s => s.cnt), '#C77700')
                })),
                W({ id: 'ov-k-absent', title: 'Gelmeyen (izinsiz)', group: 'Bugün' }, kpi({
                    label: 'Gelmeyen (izinsiz)', val: absentToday.length, icon: 'alert', tone: absentToday.length ? 'red' : 'ok',
                    foot: absentToday.length ? 'İzin kaydı olmadan giriş yapmadı' : 'Herkes giriş yaptı ya da izinli'
                })),
                W({ id: 'ov-k-leave', title: 'İzinli', group: 'Bugün' }, kpi({
                    label: 'İzinli', val: leaveToday.length, icon: 'calendar', tone: 'info',
                    foot: pLeave.length ? pLeave.length + ' izin talebi onay bekliyor' : 'Bekleyen izin talebi yok'
                })),
                W({ id: 'ov-k-ontime', title: 'Zamanında katılım', group: 'Bugün' }, kpi({
                    label: 'Zamanında katılım', val: +(onTime / N * 100).toFixed(1), dec: 1, unit: '%', icon: 'check', tone: onTime / N >= 0.95 ? 'ok' : 'warn',
                    foot: `${fmt(onTime)} / ${fmt(E.length)} personel · hedef %95`,
                    spark: A.spark(series.map(s => s.att ? 100 - s.cnt / s.att * 100 : 100), '#0E9F6E')
                })),
                W({ id: 'ov-k-total', title: 'Toplam personel', group: 'Ek kartlar', def: false }, kpi({
                    label: 'Toplam personel', val: E.length, icon: 'users',
                    foot: S.branch === 'ALL' ? D.BRANCHES.length + ' şube' : esc(brName(S.branch))
                }))
            ], 'kpi');

            const seeAll = (list, status) => list.length > 6
                ? `<div class="card-foot-link"><button type="button" class="btn btn-ghost btn-sm" data-act="ov-see-list" data-v="${status}">Tümünü gör (${list.length}) ${ic('chevron')}</button></div>`
                : '';
            const personRow = (e, meta, right) => `<div class="list-item clickable" data-act="emp-open" data-id="${e.id}" tabindex="0" role="button">
                ${avatar(e, 'sm')}
                <div class="grow"><b>${esc(e.name)}</b><small>${meta}</small></div>
                ${right}
            </div>`;

            const todayCard = W({ id: 'ov-today', title: 'Bugün geç kalanlar', group: 'Bugün' }, `<section class="card flush">
                ${cardHead('Bugün geç kalanlar', 'Gecikme süresine göre · rozet son 30 iş günündeki tekrar sayısı', pill(lateToday.length + ' kişi', lateToday.length ? 'warn' : 'ok'))}
                <div class="list" style="margin-top:4px">
                    ${lateToday.length ? lateToday.slice(0, 6).map(e => {
                        const rep = lateDaysOf.get(e.id) || 0;
                        return personRow(e,
                            `${esc(e.dept)} · ${esc(brName(e.branch))}${e.inMin != null ? ' · giriş <b class="mono">' + D.hhmm(e.inMin) + '</b>' : ''}`,
                            `${rep >= 3 ? `<span class="pill warn" title="Son 30 iş gününde ${rep} gün geç kaldı">30 günde ${rep} kez</span>` : ''}<span class="late-chip" aria-label="${lateNet(e)} dakika geç">${ic('clock')}−${fmtMinDur(lateNet(e))}</span>`);
                    }).join('') : empty('Bugün geç kalan yok', 'Harika bir gün.')}
                </div>
                ${seeAll(lateToday, 'LATE')}
            </section>`);

            /* Gelmeyenler iki ayrı kartta: izinsizler (İK aksiyonu gerekir) ve izinliler (bilgi) */
            const absentCard = W({ id: 'ov-absent', title: 'İzinsiz gelmeyenler', group: 'Bugün' }, `<section class="card flush">
                ${cardHead('İzinsiz gelmeyenler', 'İzin kaydı olmadan giriş yapmayan personel · rozet son 30 iş günündeki devamsızlık', pill(absentToday.length + ' kişi', absentToday.length ? 'bad' : 'ok'))}
                <div class="list" style="margin-top:4px">
                    ${absentToday.length ? absentToday.slice(0, 6).map(e => {
                        const ad = absentDaysOf.get(e.id) || 0;
                        return personRow(e,
                            `${esc(e.dept)} · ${esc(brName(e.branch))}`,
                            `${ad >= 2 ? `<span class="pill bad" title="Son 30 iş gününde ${ad} gün izinsiz gelmedi">30 günde ${ad} gün</span>` : ''}<span class="absent-chip">${ic('alert')}Giriş yok</span>`);
                    }).join('') : empty('Bugün izinsiz gelmeyen yok', 'Gelmeyenlerin hepsinin izin kaydı var.')}
                </div>
                ${seeAll(absentToday, 'ABSENT')}
            </section>`);

            const leaveCard = W({ id: 'ov-leave', title: 'Bugün izinliler', group: 'Bugün' }, `<section class="card flush">
                ${cardHead('Bugün izinliler', 'Onaylı izin, rapor ve saha görevi', pill(leaveToday.length + ' kişi', 'info'))}
                <div class="list" style="margin-top:4px">
                    ${leaveToday.length ? leaveToday.slice(0, 6).map(e => {
                        const lv = leaveOf(e.id);
                        const detail = lv ? (lv.isHourly && lv.startClock ? esc(lv.startClock) + '–' + esc(lv.endClock) : lv.days + ' gün') : '';
                        return personRow(e,
                            `${esc(e.dept)} · ${esc(brName(e.branch))}${detail ? ' · ' + detail : ''}`,
                            pill(lv ? lv.type : 'İzinli', 'info'));
                    }).join('') : empty('Bugün izinli personel yok')}
                </div>
                ${seeAll(leaveToday, 'LEAVE')}
            </section>`);

            const pendCount = pLate.length + pLeave.length;
            const pendItems = []
                .concat(pLate.slice(0, 4).map(r => {
                    const e = emp(r.empId);
                    return `<div class="list-item">
                        ${avatar(e, 'sm')}
                        <div class="grow">
                            <b>${esc(r.name || (e && e.name) || '—')} <span class="muted" style="font-weight:500">· gecikme gerekçesi</span></b>
                            <small>${esc(r.workDateTr || r.workDate)} · <b>${r.lateMin} dk</b> · ${esc(lateReasonLabel(r.reasonCode))}</small>
                        </div>
                        <div class="row-actions"><button type="button" class="btn btn-soft btn-sm" data-act="late-reason-open" data-id="${r.id}">${ic('tool')}İncele</button></div>
                    </div>`;
                }))
                .concat(pLeave.slice(0, 4).map(l => {
                    const e = emp(l.empId);
                    return `<div class="list-item">
                        ${avatar(e, 'sm')}
                        <div class="grow">
                            <b>${esc(e.name)} <span class="muted" style="font-weight:500">· ${esc(l.type)}</span></b>
                            <small>${l.isHourly && l.startClock ? esc(l.startClock) + '–' + esc(l.endClock) + ' (saatlik)' : l.days + ' gün'} · ${esc(l.from || '')}</small>
                        </div>
                        <div class="row-actions">
                            <button class="btn btn-ok btn-sm" data-act="leave-act" data-id="${l.id}" data-v="approved" aria-label="${esc(e.name)} izin talebini onayla">${ic('check')}</button>
                            <button class="btn btn-bad btn-sm" data-act="leave-act" data-id="${l.id}" data-v="rejected" aria-label="${esc(e.name)} izin talebini reddet">${ic('x')}</button>
                        </div>
                    </div>`;
                }));
            const pendCard = W({ id: 'ov-pending', title: 'Onayınızı bekleyenler', group: 'Bugün' }, `<section class="card flush">
                ${cardHead('Onayınızı bekleyenler', 'Gecikme gerekçeleri ve izin talepleri', `<div class="card-head-acts">${pill(pendCount + ' bekliyor', pendCount ? 'warn' : 'ok')}<button type="button" class="btn btn-soft btn-sm" data-go="leaves">Tümü</button></div>`)}
                <div class="list" style="margin-top:4px">${pendItems.length ? pendItems.join('') : empty('Bekleyen işiniz yok', 'Tüm talepler sonuçlandırıldı.')}</div>
                ${pendCount > pendItems.length ? `<div class="card-foot-link"><button type="button" class="btn btn-ghost btn-sm" data-go="leaves">${pendCount - pendItems.length} talep daha · tümünü gör ${ic('chevron')}</button></div>` : ''}
            </section>`);

            const chronicCard = W({ id: 'ov-chronic', title: 'Sürekli geç kalanlar', group: 'Son 30 iş günü' }, `<section class="card flush">
                ${cardHead('Sürekli geç kalanlar', 'Son 30 iş günü · geç kalınan gün sayısına göre', dlBtn('export-late', 'Excel', { cls: 'btn-soft btn-sm' }))}
                <div class="list" style="margin-top:4px">
                    ${chronic.length ? chronic.map((a, i) => `<div class="list-item clickable" data-act="emp-open" data-id="${a.emp.id}" tabindex="0" role="button">
                        <span class="rank-badge">${i + 1}</span>
                        ${avatar(a.emp, 'sm')}
                        <div class="grow">
                            <b>${esc(a.emp.name)}</b>
                            <small>${esc(a.emp.dept)} · en çok <b>${esc(a.mostLateDay.dowName)}</b></small>
                        </div>
                        <div style="text-align:right">
                            <span class="late-chip">${a.lateDays} gün</span>
                            <small class="muted mono" style="display:block;font-size:11px;margin-top:2px">toplam −${fmtMinDur(a.totalLateMin)}</small>
                        </div>
                    </div>`).join('') : empty('Son 30 iş gününde gecikme yok')}
                </div>
            </section>`);

            const trendCard = W({ id: 'ov-trend', title: 'Gecikme trendi', group: 'Son 30 iş günü' }, `<section class="card">
                ${cardHead('Gecikme trendi', 'Son 14 iş günü · günlük geç kalan kişi sayısı', pill('Bugün ' + lateToday.length + ' kişi', 'warn'))}
                <div id="chOvLate"></div>
            </section>`);

            /* İsteğe bağlı kartlar (varsayılan kapalı): Düzeni özelleştir > Ek kartlar */
            const otCard = W({ id: 'ov-ot', title: 'En çok ek mesai yapanlar', group: 'Ek kartlar', def: false }, `<section class="card flush">
                ${cardHead('En çok ek mesai yapanlar', 'Son 30 iş günü')}
                <div class="list" style="margin-top:4px">${lb30.topOvertime.slice(0, 5).map((a, i) => `<div class="list-item clickable" data-act="emp-open" data-id="${a.emp.id}" tabindex="0" role="button">
                    <span class="rank-badge r${i + 1}">${i + 1}</span>${avatar(a.emp, 'sm')}
                    <div class="grow"><b>${esc(a.emp.name)}</b><small>${esc(a.emp.dept)}</small></div>${pill('+' + fmtMinDur(a.totalOvertimeMin), 'ok')}
                </div>`).join('')}</div>
            </section>`);
            const deptCard = W({ id: 'ov-dept', title: 'Departmanlara göre zamanında gelme', group: 'Ek kartlar', def: false }, `<section class="card">
                ${cardHead('Departmanlara göre zamanında gelme', 'Son 30 iş günü')}
                ${rank(deptStats().slice(0, 7).map(x => ({ l: x.d, v: A.pctText(x.pct) + '%', w: A.clamp(x.pct, 0, 100), cls: x.pct > 94 ? 'ok' : x.pct > 88 ? '' : 'warn' })))}
            </section>`);
            const donutCard = W({ id: 'ov-donut', title: 'Bugünkü durum dağılımı', group: 'Ek kartlar', def: false }, `<section class="card">
                ${cardHead('Bugünkü durum dağılımı', todayLabel())}<div id="chDonut"></div>
            </section>`);

            return wToolbar(`<b>Bugün</b> · ${esc(todayLabel())} · ${S.branch === 'ALL' ? 'Tüm şubeler' : esc(brName(S.branch))}`)
                + kpis
                + wRow('ov-act', [todayCard, pendCard], 'main')
                + wRow('ov-away', [absentCard, leaveCard])
                + wRow('ov-30', [chronicCard, trendCard], 'main')
                + wRow('ov-extra', [otCard, deptCard, donutCard]);
        },
        mount() {
            const E = emps();
            const lb30 = D.computeLeaderboards(E, { range: 30 });
            const s = dailyLateSeries(lb30, D.DAYS.slice(-14));
            const host = $('#chOvLate');
            if (host) A.barChart(host, {
                data: s.map(x => ({ label: x.day.label, value: x.cnt, fullDate: x.day.fullDate, dow: x.day.dowName, avg: x.cnt ? Math.round(x.min / x.cnt) : 0 })),
                accentLast: true, yFmt: v => v + ' kişi', aria: 'Son 14 iş günü geç kalan kişi sayısı',
                tip: d => `<b>${d.fullDate} (${d.dow})</b>${d.value} kişi geç kaldı · ort. ${d.avg} dk`
            });
            const dn = $('#chDonut');
            if (dn) {
                const lateN = E.filter(e => lateNet(e) > 0).length;
                const leaveN = E.filter(e => e.status === 'LEAVE').length, absN = E.filter(e => e.status === 'ABSENT').length;
                const onN = Math.max(0, E.length - lateN - leaveN - absN);
                A.donut(dn, { items: [{ label: 'Zamanında', value: onN, color: '#1C1D1F' }, { label: 'Geç kalan', value: lateN, color: '#E31E24' }, { label: 'İzinli', value: leaveN, color: '#8E949C' }, { label: 'Devamsız', value: absN, color: '#D9DBDF' }], centerTop: '%' + A.pctText(onN / (E.length || 1) * 100), centerSub: 'zamanında', aria: 'Bugünkü durum dağılımı' });
            }
        }
    };

    function filteredEmps() {
        const u = S.ui.emp, q = u.q.toLocaleLowerCase('tr-TR').trim(), opts = filterOpts();
        let L = emps().filter(e => (u.status === 'ALL' || e.status === u.status) && (u.dept === 'ALL' || e.dept === u.dept) && (!q || (e.name + ' ' + e.sicil + ' ' + e.dept).toLocaleLowerCase('tr-TR').includes(q)));
        const k = u.sort;
        const needsAnSort = (k === 'late' || k === 'ot' || k === 'net');
        const anMap = {};
        if (needsAnSort) {
            L.forEach(e => { anMap[e.id] = D.empAnalytics(e.id, opts); });
        }
        const getAn = e => anMap[e.id] || (anMap[e.id] = D.empAnalytics(e.id, opts));
        const key = {
            name: e => e.name,
            dept: e => e.dept,
            in: e => e.inMin == null ? 9999 : e.inMin,
            late: e => getAn(e).totalLateMin,
            ot: e => getAn(e).totalOvertimeMin,
            net: e => getAn(e).netBalanceMin,
            status: e => e.status,
            dist: e => e.dist == null ? 999 : e.dist
        }[k] || (e => e.name);
        return L.sort((a, b) => { const x = key(a), y = key(b); return (typeof x === 'string' ? x.localeCompare(y, 'tr') : x - y) * u.dir; }).map(e => ({ e, an: getAn(e) }));
    }

    /* =========================================================================
       PERSONEL LISTESI — SATIR ALTINDA ACILAN DETAY PANELI
       Kullanici satira tiklar, detaylar satirin hemen altinda acilir.
       "Tam profili ac" butonu ayri bir tam sayfa ekrana (route) gecis yapar.
       ========================================================================= */
    function empDetailHtml(e, an) {
        const br = D.BRANCHES.find(b => b.code === e.branch) || D.BRANCHES[0];
        const dev = D.DEVICES.find(d => d.empId === e.id);
        const deptPeers = D.EMPLOYEES.filter(x => x.dept === e.dept);
        const deptLb = D.computeLeaderboards(deptPeers, filterOpts());
        const deptRankIdx = deptLb.bestNet.findIndex(x => x.empId === e.id);
        const deptRank = deptRankIdx >= 0 ? (deptRankIdx + 1) : 1;
        const hucre = (etiket, deger, ton) =>
            `<div class="emp-detail-cell${ton ? ' ' + ton : ''}"><span>${esc(etiket)}</span><b>${deger}</b></div>`;

        return `<div class="emp-detail">
            <div class="emp-detail-top">
                <div class="emp-detail-id">
                    ${avatar(e, 'lg')}
                    <div style="min-width:0">
                        <h4>${esc(e.name)}</h4>
                        <p>${esc(e.title)} · ${esc(e.dept)} · <span class="mono">${e.sicil}</span> · <span class="mono">${esc(br.wifi)}</span></p>
                        <div class="emp-detail-tags">
                            ${pill(STATUS[e.status][0], STATUS[e.status][1])}
                            ${pill(br.name, 'mute')}
                            ${netPill(an.netBalanceMin)}
                            ${pill(e.dept + ' Sırası: ' + deptRank + ' / ' + (deptLb.all.length || 1), 'info')}
                            ${dev ? pill(dev.model + ' · v' + dev.ver, dev.status === 'BOUND' ? 'ok' : 'warn') : ''}
                        </div>
                    </div>
                </div>
            </div>
            <div class="emp-detail-grid">
                ${hucre('Net Süre Bakiyesi', fmtMinSigned(an.netBalanceMin), an.netBalanceMin >= 0 ? 'ok' : 'bad')}
                ${hucre('Toplam Ek Mesai', '+' + fmtMinDur(an.totalOvertimeMin) + ` <small class="muted">(${an.overtimeDays}g)</small>`, 'ok')}
                ${hucre('Toplam Gecikme', an.totalLateMin > 0 ? '−' + fmtMinDur(an.totalLateMin) + ` <small class="muted">(${an.lateDays}g)</small>` : '0 dk', an.totalLateMin > 0 ? 'warn' : '')}
                ${hucre('Fiili Mesai / Ort.', `${A.numText(an.totalWorkH)} sa <small class="muted">(${A.numText(an.avgWorkH)} sa/g)</small>`)}
                ${hucre('Ort. Giriş / Çıkış', `${an.avgCheckIn} → ${an.avgCheckOut}`)}
                ${hucre('En Çok Geç Kaldığı Gün', an.mostLateDay.totalLateMin > 0
                    ? `${esc(an.mostLateDay.dowName)} <small class="muted">(−${an.mostLateDay.totalLateMin} dk)</small>`
                    : 'Gecikme Yok')}
                ${hucre('En Çok Ek Mesai Günü', an.mostOvertimeDay.totalOvertimeMin > 0
                    ? `${esc(an.mostOvertimeDay.dowName)} <small class="muted">(+${an.mostOvertimeDay.totalOvertimeMin} dk)</small>`
                    : 'Yok')}
                ${hucre('30m Geofence Uyumu', '%' + A.pctText(an.geofenceRate) + ' <small class="muted">(' + (e.dist != null ? A.numText(e.dist) + ' m)' : '—)'))}
            </div>
            <div class="emp-detail-actions">
                <button type="button" class="btn btn-primary btn-sm" data-act="emp-profile" data-id="${e.id}">
                    ${ic('chevron')} Tam PDKS profilini ve grafikleri aç
                </button>
                <button type="button" class="btn btn-dark btn-sm" data-act="export-one" data-id="${e.id}">
                    ${ic('file')} Dikey PDKS Karnesi (.xlsx)
                </button>
                <button type="button" class="btn btn-soft btn-sm" data-act="emp-edit" data-id="${e.id}">
                    ${ic('tool')} Bilgileri Düzenle
                </button>
                <button type="button" class="btn btn-bad btn-sm" data-act="emp-delete" data-id="${e.id}">
                    ${ic('x')} Personeli Sil
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
                return `<tr class="emp-row${acik ? ' is-open' : ''}" style="--r:${i}" data-act="emp-expand" data-id="${e.id}" tabindex="0" role="button" aria-expanded="${acik}" aria-label="${esc(e.name)} detaylarını ${acik ? 'kapat' : 'aç'}">
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
                    ${cardHead('Son İşe Başlayan & Yeni Eklenen Personeller (CRUD)', 'Satıra tıklayarak profil karnesini açabilir, sağdaki butonlarla düzenleyebilir veya silebilirsiniz', `<button class="btn btn-soft btn-sm" data-go="employees">Tüm Liste</button>`)}
                    <div class="list" style="margin-top:4px">
                        ${newHires.map(e => `<div class="list-item clickable" data-act="emp-open" data-id="${e.id}" tabindex="0" role="button">
                            ${avatar(e)}
                            <div class="grow">
                                <b>${esc(e.name)} ${e.isNewHire ? pill('Yeni Kayıt', 'ok') : ''}</b>
                                <small><span class="mono">${esc(e.sicil)}</span> · ${esc(e.title)} · ${esc(e.dept)}</small>
                                <small class="muted" style="display:block">${esc(brName(e.branch))} ${e.startDate ? '· Başlangıç: ' + esc(e.startDate) : ''}</small>
                            </div>
                            <div class="row-acts" onclick="event.stopPropagation()">
                                ${pill(STATUS[e.status][0], STATUS[e.status][1])}
                                <button type="button" class="btn btn-soft btn-sm" data-act="emp-edit" data-id="${e.id}" title="Bilgileri düzenle">${ic('tool')}Düzenle</button>
                                <button type="button" class="btn btn-bad btn-sm" data-act="emp-delete" data-id="${e.id}" title="Personeli sil">${ic('x')}Sil</button>
                            </div>
                        </div>`).join('')}
                    </div>
                </section>
            </div>`;
        }
    };

    /* Geç kalma gerekçesi şablon adları (mobil uygulama kodlarıyla birebir) */
    const LATE_REASON_LABELS = {
        TRAFIK: 'Trafik yoğunluğu',
        TOPLU_TASIMA: 'Toplu taşıma gecikmesi / arıza',
        ARAC_ARIZA: 'Araç arızası',
        SERVIS: 'Personel servisi gecikmesi',
        YOL_KAPALI: 'Yol kapanması / trafik kazası',
        OTOPARK: 'Otopark / park yeri sorunu',
        HAVA: 'Hava koşulları',
        SAGLIK_KENDI: 'Kendi sağlık sorunu / doktor randevusu',
        SAGLIK_AILE: 'Aile / çocuk sağlığı',
        ACIL_HASTANE: 'Acil hastane / refakat',
        ECZANE: 'Eczane, kan / numune işlemi',
        COCUK: 'Çocuğu okula / kreşe bırakma',
        AILEVI_ACIL: 'Ailevi acil durum',
        RESMI_KURUM: 'Resmi kurum işlemi',
        EV_ACIL: 'Evde acil tamir',
        ADLI: 'Adli / idari zorunluluk',
        SAHA_GOREVI: 'Şube dışı saha görevi',
        YONETICI_TALIMAT: 'Yönetici talimatıyla görev',
        EVRAK: 'Evrak / belge teslimi',
        ONCEKI_GUN_MESAISI: 'Önceki gün geç biten toplantı / mesai',
        CIHAZ_ARIZA: 'Mobil cihaz arızası / şarj',
        GPS_SINYAL: 'Konum / GPS sinyali alınamadı',
        UYGULAMA: 'Uygulama / internet kesintisi',
        SISTEM_BAKIM: 'Sistem bakımı / güncelleme',
        DIGER: 'Diğer'
    };
    const lateReasonLabel = code => LATE_REASON_LABELS[code] || code || '—';

    function lateReasonCard(sortKey) {
        const rows = (D.LATE_REASONS || []).slice();
        const key = sortKey || 'pending';
        const dateVal = r => String(r.workDate || '');
        rows.sort((a, b) => {
            if (key === 'late_desc') return (b.lateMin || 0) - (a.lateMin || 0) || dateVal(b).localeCompare(dateVal(a));
            if (key === 'late_asc') return (a.lateMin || 0) - (b.lateMin || 0) || dateVal(b).localeCompare(dateVal(a));
            if (key === 'date_desc') return dateVal(b).localeCompare(dateVal(a)) || (b.id || 0) - (a.id || 0);
            if (key === 'date_asc') return dateVal(a).localeCompare(dateVal(b)) || (a.id || 0) - (b.id || 0);
            // Varsayılan: değerlendirme bekleyenler önce, sonra en yeni tarih
            const pa = a.status === 'PENDING' ? 0 : 1;
            const pb = b.status === 'PENDING' ? 0 : 1;
            if (pa !== pb) return pa - pb;
            return dateVal(b).localeCompare(dateVal(a));
        });
        const pendingCount = rows.filter(r => r.status === 'PENDING').length;
        const excusedTotal = rows.filter(r => r.status === 'APPROVED').reduce((a, r) => a + (r.excusedMin || 0), 0);
        return `<section class="card flush">
            ${cardHead('Gecikme gerekçeleri (İK değerlendirmesi)', `Personelin bildirdiği mazeretleri inceleyin; haklı bulursanız gecikmeden düşün (toplam ${excusedTotal} dk düşüldü)`, selectEl('late-sort', [
                { v: 'pending', l: 'Bekleyenler önce' },
                { v: 'late_desc', l: 'Gecikme: çok → az' },
                { v: 'late_asc', l: 'Gecikme: az → çok' },
                { v: 'date_desc', l: 'Tarih: yeni → eski' },
                { v: 'date_asc', l: 'Tarih: eski → yeni' }
            ], key, 'Sıralama') + pill(pendingCount + ' bekliyor', pendingCount ? 'warn' : 'ok'))}
            <div class="list">
                ${rows.length ? rows.slice(0, 30).map(r => {
                    const net = Math.max(0, (r.lateMin || 0) - (r.excusedMin || 0));
                    const tone = r.status === 'APPROVED' ? ['Haklı bulundu', 'ok'] : r.status === 'REJECTED' ? ['Reddedildi', 'bad'] : ['Değerlendirme bekliyor', 'warn'];
                    const empRef = emp(r.empId);
                    return `<div class="list-item">
                        <div class="grow">
                            <b>${esc(r.name || (empRef && empRef.name) || '—')} <span class="muted" style="font-weight:500">· ${esc(r.dept || '')} · ${esc(r.workDateTr || r.workDate)} · giriş ${esc(r.checkIn || '—')}</span></b>
                            <small>${esc(lateReasonLabel(r.reasonCode))}${r.reasonNote ? ' · “' + esc(r.reasonNote) + '”' : ''}</small>
                            <small class="muted" style="display:block">Gecikme: <b>${r.lateMin} dk</b>${r.excusedMin ? ` · Düşülen: <b>${r.excusedMin} dk</b> · Kalan: <b>${net} dk</b>` : ''}${r.reviewedBy ? ' · ' + esc(r.reviewedBy) : ''}</small>
                        </div>
                        ${pill(tone[0], tone[1])}
                        <div class="row-actions">
                            <button type="button" class="btn btn-soft btn-sm" data-act="late-reason-open" data-id="${r.id}">${ic('tool')}${r.status === 'APPROVED' ? 'Yeniden değerlendir' : 'İncele'}</button>
                        </div>
                    </div>`;
                }).join('') : empty('Bildirilmiş geç kalma gerekçesi yok')}
            </div>
        </section>`;
    }

    HR.leaves = {
        title: 'İzin & mazeret talepleri', sub: () => 'Onay bekleyenleri hızlıca sonuçlandırın', tools: {}, icon: 'inbox',
        render() {
            const u = S.ui.leave, cnt = s => D.LEAVES.filter(l => l.status === s).length;
            const L = D.LEAVES.filter(l => (u.f === 'all' || l.status === u.f) && (u.type === 'ALL' || l.type === u.type) && emp(l.empId));
            const tone = { pending: ['Bekliyor', 'warn'], approved: ['Onaylandı', 'ok'], rejected: ['Reddedildi', 'bad'] };
            return `${lateReasonCard(u.lateSort)}<section class="card flush" style="margin-top:16px"><div class="toolbar">${chips([{ v: 'pending', l: 'Bekleyen', n: cnt('pending') }, { v: 'approved', l: 'Onaylanan', n: cnt('approved') }, { v: 'rejected', l: 'Reddedilen', n: cnt('rejected') }, { v: 'all', l: 'Tümü', n: D.LEAVES.length }], u.f, 'leave-filter')}
                <span class="grow"></span>${selectEl('leave-type', [{ v: 'ALL', l: 'Tüm türler' }].concat(D.LEAVE_TYPES.map(t => ({ v: t, l: t }))), u.type, 'Talep türü')}
                <button type="button" class="btn btn-primary btn-sm" data-act="leave-hourly-open">${ic('plus')} İzin talebi oluştur</button>
                ${dlBtn('export-leaves', 'İzin Raporu (.xlsx)', { cls: 'btn-soft btn-sm' })}</div>
                <div class="list">${L.length ? L.map(l => { const e = emp(l.empId), t = tone[l.status]; return `<div class="list-item" style="animation:rowIn .45s var(--ease) both">${avatar(e)}<div class="grow"><b>${esc(e.name)} <span class="muted" style="font-weight:500">· ${esc(e.dept)}</span></b><small>${esc(l.type)}${l.isHourly && l.startClock ? ' · ' + esc(l.startClock) + '–' + esc(l.endClock) + ' (saatlik)' : ' · ' + l.days + ' gün'} · ${esc(l.from)} · “${esc(l.reason)}”</small></div><span class="muted" style="font-size:12px">${esc(l.ago)}</span>${pill(t[0], t[1])}
                ${l.status === 'pending' ? `<div class="row-actions"><button class="btn btn-ok btn-sm" data-act="leave-act" data-id="${l.id}" data-v="approved">${ic('check')}Onayla</button><button class="btn btn-bad btn-sm" data-act="leave-act" data-id="${l.id}" data-v="rejected">${ic('x')}Reddet</button></div>` : ''}</div>`; }).join('') : empty('Bu filtrede talep yok')}</div></section>`;
        }
    };

    /* Gizli (kapalı bölüm / gizli kart) alanlara grafik çizilmez */
    const visEl = sel => { const el = $(sel); return el && !el.closest('.w-section-body[hidden], details:not([open])') ? el : null; };
    /* Dönemdeki tüm gecikme kayıtları ve özet (şube + tarih filtresine uyumlu) */
    function lateDigest() {
        const E = emps(), lb = D.computeLeaderboards(E, filterOpts());
        let att = 0, lateCnt = 0, lateMin = 0;
        const buckets = [0, 0, 0, 0]; // 1–15, 16–30, 31–60, 60+
        lb.all.forEach(a => a.logs.forEach(l => {
            if (l.status === 'LEAVE' || l.status === 'ABSENT') return;
            att++;
            if (l.lateMin > 0) {
                lateCnt++; lateMin += l.lateMin;
                buckets[l.lateMin <= 15 ? 0 : l.lateMin <= 30 ? 1 : l.lateMin <= 60 ? 2 : 3]++;
            }
        }));
        const isoSet = new Set(activeDays().map(d => d.iso));
        const reasons = (D.LATE_REASONS || []).filter(r => inBranch(r.empId) && isoSet.has(String(r.workDate || '').slice(0, 10)));
        const excusedMin = reasons.filter(r => r.status === 'APPROVED').reduce((s, r) => s + (r.excusedMin || 0), 0)
            || E.reduce((s, e) => s + (e.lateExcusedMin || 0), 0);
        const byCode = {};
        reasons.forEach(r => { const k = r.reasonCode || 'DIGER'; byCode[k] = (byCode[k] || 0) + 1; });
        const reasonRows = Object.keys(byCode).map(k => ({ k, n: byCode[k] })).sort((a, b) => b.n - a.n);
        return { E, lb, att, lateCnt, lateMin, buckets, excusedMin, reasons, reasonRows };
    }
    function weekdayAgg(lb) {
        const names = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'], short = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'];
        return [0, 1, 2, 3, 4].map(i => {
            let lateMin = 0, otMin = 0, lateCnt = 0;
            lb.all.forEach(a => { const w = a.weekdayList[i]; if (w) { lateMin += w.totalLateMin; otMin += w.totalOvertimeMin; lateCnt += w.lateCount; } });
            return { name: names[i], short: short[i], lateMin, otMin, netMin: otMin - lateMin, lateCnt };
        });
    }

    HR.analytics = {
        title: 'Analitik',
        sub: () => 'Gecikme, katılım, ek mesai ve departman analizi · ' + rangeLabel(),
        tools: { range: 1, branch: 1 },
        icon: 'chart',
        render() {
            const g = lateDigest(), { E, lb } = g;
            const st = stats(), ds = deptStats(), curDays = activeDays();
            const d = curDays.length >= 3 ? curDays : D.DAYS.slice(-14);
            const avgWork = d.reduce((a, x) => a + x.workH, 0) / (d.length || 1);
            const lateRate = g.att ? g.lateCnt / g.att * 100 : 0;
            const avgLatePer = g.lateCnt ? Math.round(g.lateMin / g.lateCnt) : 0;
            const lateEmpN = lb.all.filter(a => a.totalLateMin > 0).length;
            const onTimeSeries = d.map(x => A.num(x.onTime * 100));
            const maxOn = onTimeSeries.length ? Math.max(...onTimeSeries) : 0, minOn = onTimeSeries.length ? Math.min(...onTimeSeries) : 0;
            const withIn = E.filter(e => e.inMin != null);
            const avgInMin = withIn.length ? Math.round(withIn.reduce((s, e) => s + e.inMin, 0) / withIn.length) : 0;
            const netTab = S.ui.ovLb === 'worst' ? 'worst' : 'best';
            const netList = (netTab === 'worst' ? lb.worstNet : lb.bestNet).slice(0, 7);
            const deptLate = ds.map(x => ({ d: x.d, per: x.n ? Math.round(x.totalLateMin / x.n) : 0, avg: x.avgLate })).sort((a, b) => b.per - a.per);
            const maxDeptLate = Math.max(1, ...deptLate.map(x => x.per));
            const maxReason = Math.max(1, ...g.reasonRows.map(r => r.n));

            /* ---------- A. GECİKME ---------- */
            const lateKpis = wRow('an-late-kpi', [
                W({ id: 'an-k-latetotal', title: 'Toplam gecikme', group: 'Gecikme analizi' }, kpi({
                    label: 'Toplam gecikme', val: +(g.lateMin / 60).toFixed(1), dec: 1, unit: 'sa', icon: 'clock', tone: 'warn', cls: 'kpi-primary',
                    foot: `${fmt(g.lateCnt)} geç giriş · ${fmt(lateEmpN)} kişi`
                })),
                W({ id: 'an-k-lateavg', title: 'Geç girişte ortalama', group: 'Gecikme analizi' }, kpi({
                    label: 'Geç girişte ortalama', val: avgLatePer, unit: 'dk', icon: 'alert', tone: 'warn', foot: 'gecikme başına süre'
                })),
                W({ id: 'an-k-laterate', title: 'Geç giriş oranı', group: 'Gecikme analizi' }, kpi({
                    label: 'Geç giriş oranı', val: +lateRate.toFixed(1), dec: 1, unit: '%', icon: 'activity', tone: lateRate > 8 ? 'warn' : 'ok',
                    foot: `${fmt(g.att)} giriş kaydı içinde`
                })),
                W({ id: 'an-k-excused', title: 'Gerekçeyle düşülen', group: 'Gecikme analizi' }, kpi({
                    label: 'Gerekçeyle düşülen', val: g.excusedMin, unit: 'dk', icon: 'check', tone: 'info',
                    foot: `${g.reasons.filter(r => r.status === 'PENDING').length} gerekçe değerlendirme bekliyor`
                }))
            ], 'kpi');

            const lateMain = wRow('an-late-main', [
                W({ id: 'an-late-trend', title: 'Gecikme trendi', group: 'Gecikme analizi' }, `<section class="card">
                    ${cardHead('Gecikme trendi', 'Günlük geç kalan kişi sayısı · ' + rangeLabel())}<div id="chAnLate"></div>
                </section>`),
                W({ id: 'an-late-buckets', title: 'Gecikme süresi dağılımı', group: 'Gecikme analizi' }, `<section class="card">
                    ${cardHead('Gecikme süresi dağılımı', 'Geç girişler kaç dakika sürdü?')}<div id="chAnBuckets"></div>
                </section>`)
            ], 'main');

            const lateLists = wRow('an-late-lists', [
                W({ id: 'an-most-late', title: 'En çok geç kalanlar', group: 'Gecikme analizi' }, `<section class="card flush">
                    ${cardHead('En çok geç kalanlar', rangeLabel(), dlBtn('export-late', 'Excel', { cls: 'btn-soft btn-sm' }))}
                    <div class="list" style="margin-top:4px">${lb.mostLate.filter(a => a.totalLateMin > 0).slice(0, 7).map((a, i) => `<div class="list-item clickable" data-act="emp-open" data-id="${a.emp.id}" tabindex="0" role="button">
                        <span class="rank-badge">${i + 1}</span>${avatar(a.emp, 'sm')}
                        <div class="grow"><b>${esc(a.emp.name)}</b><small>${esc(a.emp.dept)} · en çok <b>${esc(a.mostLateDay.dowName)}</b> (${a.mostLateDay.lateCount} kez)</small></div>
                        <div style="text-align:right"><span class="late-chip">−${fmtMinDur(a.totalLateMin)}</span><small class="muted mono" style="display:block;font-size:11px;margin-top:2px">${a.lateDays} gün</small></div>
                    </div>`).join('') || empty('Bu dönemde gecikme yok')}</div>
                </section>`),
                W({ id: 'an-late-weekday', title: 'Haftanın gününe göre gecikme', group: 'Gecikme analizi' }, `<section class="card">
                    ${cardHead('Haftanın gününe göre gecikme', 'Toplam gecikme süresi (saat)')}<div id="chAnWeekday"></div>
                </section>`),
                W({ id: 'an-late-reasons', title: 'Gecikme gerekçeleri', group: 'Gecikme analizi' }, `<section class="card">
                    ${cardHead('Gecikme gerekçeleri', 'Personelin bildirdiği nedenler · ' + g.reasons.length + ' bildirim', `<button type="button" class="btn btn-soft btn-sm" data-go="leaves">İncele</button>`)}
                    ${g.reasonRows.length ? rank(g.reasonRows.slice(0, 7).map(r => ({ l: lateReasonLabel(r.k), v: r.n + ' bildirim', w: A.clamp(r.n / maxReason * 100, 6, 100), cls: 'warn' }))) : empty('Bu dönemde bildirilmiş gerekçe yok', 'Personel mobil uygulamadan gerekçe bildirdikçe burada dağılım görünür.')}
                </section>`)
            ]);

            const lateDept = wRow('an-late-dept', [
                W({ id: 'an-dept-late', title: 'Departmanlara göre gecikme', group: 'Gecikme analizi' }, `<section class="card">
                    ${cardHead('Departmanlara göre gecikme', 'Kişi başı toplam gecikme · ' + rangeLabel())}
                    ${rank(deptLate.slice(0, 8).map(x => ({ l: x.d, v: fmtMinDur(x.per) + ' / kişi', w: A.clamp(x.per / maxDeptLate * 100, 4, 100), cls: x.per >= maxDeptLate * 0.75 ? 'warn' : '' })))}
                </section>`),
                W({ id: 'an-weekday-table', title: 'Gün bazında gecikme ve ek mesai', group: 'Gecikme analizi' }, `<section class="card">
                    ${cardHead('Gün bazında gecikme ve ek mesai', 'Pazartesi–Cuma kurum toplamları')}<div id="chWeekdayTable"></div>
                </section>`)
            ]);

            /* ---------- B. KATILIM ---------- */
            const attKpis = wRow('an-att-kpi', [
                W({ id: 'an-k-ontime', title: 'Zamanında katılım', group: 'Katılım' }, kpi({ label: 'Zamanında katılım', val: st.onTimePct, dec: 1, unit: '%', icon: 'check', tone: st.onTimePct >= 95 ? 'ok' : 'warn', delta: delta(st.onTimePct - st.prevPct, ' p'), foot: 'kurumsal hedef %95' })),
                W({ id: 'an-k-work', title: 'Ortalama günlük mesai', group: 'Katılım' }, kpi({ label: 'Ortalama günlük mesai', val: avgWork, dec: 1, unit: 'sa', icon: 'clock', foot: 'standart 8,5 sa/gün' })),
                W({ id: 'an-k-absent', title: 'Bugün devamsız', group: 'Katılım' }, kpi({ label: 'Bugün devamsız', val: st.absent, icon: 'alert', tone: st.absent ? 'red' : 'ok', foot: st.leave + ' kişi izinli' })),
                W({ id: 'an-k-geo', title: 'Konum (30 m) uyumu', group: 'Ek kartlar', def: false }, kpi({ label: 'Konum (30 m) uyumu', val: st.geofencePct, dec: 1, unit: '%', icon: 'pin', tone: 'ok', foot: 'şube içi doğrulama' }))
            ], 'kpi');
            const attMain = wRow('an-att-main', [
                W({ id: 'an-ontime-trend', title: 'Zamanında gelme trendi', group: 'Katılım' }, `<section class="card">
                    ${cardHead('Zamanında gelme trendi', 'Günlük oran (%) ve %95 hedef çizgisi')}
                    <div id="chTrendDual"></div>
                    <div class="stat-mini-grid">
                        <div class="stat-mini"><small>En yüksek</small><b style="color:var(--ok)">%${A.pctText(maxOn)}</b></div>
                        <div class="stat-mini"><small>En düşük</small><b style="color:var(--warn)">%${A.pctText(minOn)}</b></div>
                        <div class="stat-mini"><small>Bugün ort. giriş</small><b class="mono">${avgInMin ? D.hhmm(avgInMin) : '—'}</b></div>
                    </div>
                </section>`),
                W({ id: 'an-leave-types', title: 'İzin ve mazeret türleri', group: 'Katılım' }, `<section class="card">
                    ${cardHead('İzin ve mazeret türleri', 'Talep dağılımı')}<div id="chLeaveType"></div>
                </section>`)
            ], 'main');
            const attBranch = wRow('an-att-branch', [
                W({ id: 'an-branch-rank', title: 'Şubelere göre zamanında gelme', group: 'Katılım' }, `<section class="card">
                    ${cardHead('Şubelere göre zamanında gelme', 'Bugün', '<span class="pill info" id="brRankMeta"></span>')}
                    <div class="rank-tools">
                        <label class="search">${ic('search')}<input id="brRankQ" type="search" value="${esc(S.ui.branchRank.q)}" placeholder="Şube ara" autocomplete="off" aria-label="Şube ara"></label>
                        <div class="seg" id="brRankSeg" role="group" aria-label="Şube listesi uzunluğu">
                            <span class="seg-thumb"></span>
                            <button type="button" class="seg-btn ${S.ui.branchRank.limit === 10 ? 'is-active' : ''}" data-rank-limit="10" aria-pressed="${S.ui.branchRank.limit === 10}">İlk 10</button>
                            <button type="button" class="seg-btn ${S.ui.branchRank.limit === 0 ? 'is-active' : ''}" data-rank-limit="0" aria-pressed="${S.ui.branchRank.limit === 0}">Tümü</button>
                        </div>
                    </div>
                    <div id="chBranch" class="rank-scroll"></div>
                </section>`),
                W({ id: 'an-work-stab', title: 'Günlük çalışma süresi istikrarı', group: 'Ek kartlar', def: false }, `<section class="card">
                    ${cardHead('Günlük çalışma süresi istikrarı', '8,5 saat hedefe göre · ' + rangeLabel())}<div id="chStabilityAn"></div>
                </section>`)
            ]);

            /* ---------- C. EK MESAİ & NET BAKİYE ---------- */
            const otKpis = wRow('an-ot-kpi', [
                W({ id: 'an-k-ot', title: 'Toplam ek mesai', group: 'Ek mesai ve net bakiye' }, kpi({ label: 'Toplam ek mesai', val: st.totalOvertimeH, dec: 1, unit: 'sa', icon: 'activity', tone: 'ok', foot: curDays.length + ' iş günü toplamı' })),
                W({ id: 'an-k-net', title: 'Net süre bakiyesi', group: 'Ek mesai ve net bakiye' }, kpi({ label: 'Net süre bakiyesi', val: +(st.netBalanceMin / 60).toFixed(1), dec: 1, unit: 'sa', icon: 'spark', tone: st.netBalanceMin >= 0 ? 'ok' : 'warn', foot: 'ek mesai − gecikme' }))
            ], 'kpi');
            const otLists = wRow('an-ot-lists', [
                W({ id: 'an-ot-top', title: 'En çok ek mesai yapanlar', group: 'Ek mesai ve net bakiye' }, `<section class="card flush">
                    ${cardHead('En çok ek mesai yapanlar', rangeLabel(), dlBtn('export-leaderboards', 'Excel', { cls: 'btn-soft btn-sm' }))}
                    <div class="list" style="margin-top:4px">${lb.topOvertime.slice(0, 7).map((a, i) => `<div class="list-item clickable" data-act="emp-open" data-id="${a.emp.id}" tabindex="0" role="button">
                        <span class="rank-badge r${i + 1}">${i + 1}</span>${avatar(a.emp, 'sm')}
                        <div class="grow"><b>${esc(a.emp.name)}</b><small>${esc(a.emp.dept)} · en çok <b>${esc(a.mostOvertimeDay.dowName)}</b></small></div>
                        <div style="text-align:right">${pill('+' + fmtMinDur(a.totalOvertimeMin), 'ok')}<small class="muted mono" style="display:block;font-size:10.5px;margin-top:2px">${a.overtimeDays} gün</small></div>
                    </div>`).join('')}</div>
                </section>`),
                W({ id: 'an-net', title: 'Net süre bakiyesi sıralaması', group: 'Ek mesai ve net bakiye' }, `<section class="card flush">
                    ${cardHead('Net süre bakiyesi', 'Ek mesaiden gecikme düşülünce kalan süre', chips([{ v: 'best', l: 'En iyiler' }, { v: 'worst', l: 'En kötüler' }], netTab, 'ov-lb-tab'))}
                    <div class="list" style="margin-top:4px">${netList.map((a, i) => `<div class="list-item clickable" data-act="emp-open" data-id="${a.emp.id}" tabindex="0" role="button">
                        <span class="rank-badge ${netTab === 'best' ? 'r' + (i + 1) : ''}">${i + 1}</span>${avatar(a.emp, 'sm')}
                        <div class="grow"><b>${esc(a.emp.name)}</b><small>Mesai <b style="color:var(--ok)">+${a.totalOvertimeMin} dk</b> · Geç <b style="color:var(--bad)">−${a.totalLateMin} dk</b></small></div>
                        ${netPill(a.netBalanceMin)}
                    </div>`).join('')}</div>
                </section>`),
                W({ id: 'an-ot-trend', title: 'Günlük fazla mesai yükü', group: 'Ek mesai ve net bakiye' }, `<section class="card">
                    ${cardHead('Günlük fazla mesai yükü', 'Toplam saat · ' + rangeLabel())}<div id="chOT"></div>
                </section>`)
            ]);

            /* ---------- D. DEPARTMAN ---------- */
            const deptRow = wRow('an-dept', [
                W({ id: 'an-dept-matrix', title: 'Departman performans matrisi', group: 'Departman' }, `<section class="card flush">
                    ${cardHead('Departman performans matrisi', 'Giriş saati, gecikme, ek mesai ve net bakiye karşılaştırması', dlBtn('export-analytics', 'Excel (.xlsx)', { cls: 'btn-soft btn-sm' }))}
                    <div class="table-wrap"><table>
                        <thead><tr><th>Departman</th><th>Kişi</th><th>Ort. giriş</th><th>Top. gecikme</th><th>Kişi başı gecikme</th><th>Top. ek mesai</th><th>Net bakiye</th><th>Zamanında</th><th>Durum</th></tr></thead>
                        <tbody>${ds.slice().sort((a, b) => (b.n ? b.totalLateMin / b.n : 0) - (a.n ? a.totalLateMin / a.n : 0)).map((x, i) => `<tr style="--r:${i}">
                            <td><b>${esc(x.d)}</b></td>
                            <td class="mono">${x.n}</td>
                            <td class="mono">${x.avgIn}</td>
                            <td class="mono" style="color:var(--warn)"><b>−${fmtMinDur(x.totalLateMin)}</b></td>
                            <td class="mono">${fmtMinDur(x.n ? x.totalLateMin / x.n : 0)}</td>
                            <td class="mono" style="color:var(--ok)">+${fmtMinDur(x.totalOvertimeMin)}</td>
                            <td>${netPill(x.netMin)}</td>
                            <td class="mono">%${A.pctText(x.pct)}</td>
                            <td>${pill(x.pct >= 93 ? 'Yüksek uyum' : x.pct >= 88 ? 'Normal' : 'İzlenmeli', x.pct >= 93 ? 'ok' : x.pct >= 88 ? 'info' : 'warn')}</td>
                        </tr>`).join('')}</tbody>
                    </table></div>
                </section>`)
            ]);

            const jump = [['late', 'Gecikme'], ['att', 'Katılım'], ['ot', 'Ek mesai'], ['dept', 'Departman']]
                .map(([k, l]) => `<button type="button" class="chip" data-act="an-jump" data-v="${k}">${l}</button>`).join('');
            return wToolbar(`<b>Dönem:</b> ${esc(rangeLabel())} · ${S.branch === 'ALL' ? 'Tüm şubeler' : esc(brName(S.branch))}`,
                `<nav class="chips an-jump" aria-label="Analitik bölümleri">${jump}</nav>${dlBtn('export-analytics', 'Yönetici raporu (.xlsx)', { cls: 'btn-dark btn-sm' })}`)
                + wSection('late', 'Gecikme analizi', 'Kim, ne zaman, ne kadar ve neden geç kalıyor?', lateKpis + lateMain + lateLists + lateDept)
                + wSection('att', 'Katılım', 'Zamanında gelme, devamsızlık ve izinler', attKpis + attMain + attBranch)
                + wSection('ot', 'Ek mesai ve net bakiye', 'Bordro dönemi için fazla çalışma ve net süre', otKpis + otLists)
                + wSection('dept', 'Departman', 'Birimlerin karşılaştırmalı tablosu', deptRow);
        },
        mount() {
            const g = lateDigest(), { lb } = g;
            const curDays = activeDays(), d = curDays.length >= 3 ? curDays : D.DAYS.slice(-14);
            const ser = dailyLateSeries(lb, d);
            let el;
            if ((el = visEl('#chAnLate'))) A.areaChart(el, {
                labels: ser.map(x => x.day.label), series: [{ data: ser.map(x => x.cnt) }], yFmt: v => v + ' kişi',
                aria: 'Günlük geç kalan kişi sayısı',
                tip: (i, v) => `<b>${ser[i].day.fullDate} (${ser[i].day.dowName})</b>${v[0]} kişi geç kaldı · ort. ${ser[i].cnt ? Math.round(ser[i].min / ser[i].cnt) : 0} dk`
            });
            if ((el = visEl('#chAnBuckets'))) {
                const b = g.buckets, tot = b.reduce((s, x) => s + x, 0);
                A.donut(el, {
                    items: [
                        { label: '1–15 dk', value: b[0], color: '#8E949C' },
                        { label: '16–30 dk', value: b[1], color: '#C77700' },
                        { label: '31–60 dk', value: b[2], color: '#E31E24' },
                        { label: '60 dk üzeri', value: b[3], color: '#1C1D1F' }
                    ],
                    centerTop: fmt(tot), centerSub: 'geç giriş', aria: 'Gecikme süresi dağılımı'
                });
            }
            const wd = weekdayAgg(lb);
            if ((el = visEl('#chAnWeekday'))) A.barChart(el, {
                data: wd.map(w => ({ label: w.short, value: Math.round(w.lateMin / 60), name: w.name, cnt: w.lateCnt })),
                accentLast: false, yFmt: v => v + ' sa', aria: 'Haftanın gününe göre gecikme',
                tip: x => `<b>${x.name}</b>${x.value} sa toplam gecikme · ${x.cnt} geç giriş`
            });
            if ((el = visEl('#chWeekdayTable'))) el.innerHTML = `<div class="table-wrap"><table style="font-size:12.5px">
                <thead><tr><th>Gün</th><th>Geç giriş</th><th>Top. gecikme</th><th>Top. ek mesai</th><th>Net</th></tr></thead>
                <tbody>${wd.map(w => `<tr><td><b>${w.name}</b></td><td class="mono">${w.lateCnt}</td><td class="mono" style="color:var(--warn)">−${fmtMinDur(w.lateMin)}</td><td class="mono" style="color:var(--ok)">+${fmtMinDur(w.otMin)}</td><td>${netPill(w.netMin)}</td></tr>`).join('')}</tbody>
            </table></div>`;
            if ((el = visEl('#chTrendDual'))) A.areaChart(el, {
                labels: d.map(x => x.label), series: [{ data: d.map(x => A.num(x.onTime * 100)) }, { data: d.map(() => 95) }],
                yMin: 80, yMax: 100, yFmt: v => v + '%',
                tip: (i, v) => `<b>${d[i].fullDate} (${d[i].dowName})</b>Gerçekleşen: %${String(v[0]).replace('.', ',')} · Hedef: %95`
            });
            if ((el = visEl('#chLeaveType'))) {
                const lt = D.LEAVE_TYPES.map((t, i) => ({ label: t, value: D.LEAVES.filter(l => l.type === t && inBranch(l.empId)).length, color: ['#E31E24', '#1C1D1F', '#8E949C', '#B8161B', '#D9DBDF'][i % 5] }));
                A.donut(el, { items: lt, centerTop: lt.reduce((s, x) => s + x.value, 0), centerSub: 'talep', aria: 'İzin türleri' });
            }
            if ((el = visEl('#chOT'))) A.areaChart(el, { labels: d.map(x => x.label), series: [{ data: d.map(x => Math.round(x.overtimeH)) }], yFmt: v => v + ' sa', tip: (i, v) => `<b>${d[i].fullDate} (${d[i].dowName})</b>${v[0]} saat fazla mesai` });
            if ((el = visEl('#chStabilityAn'))) A.areaChart(el, {
                labels: d.map(x => x.label), series: [{ data: d.map(x => A.num(x.workH)) }, { data: d.map(() => 8.5) }],
                yMin: 7, yMax: 10, yFmt: v => v + ' sa',
                tip: (i, v) => `<b>${d[i].fullDate}</b>Gerçekleşen: ${String(v[0]).replace('.', ',')} sa · Standart: 8,5 sa`
            });
            if (visEl('#chBranch')) {
                paintBranchRank();
                const rankQ = $('#brRankQ'), rankSeg = $('#brRankSeg');
                if (rankSeg) A.placeSeg(rankSeg);
                if (rankQ) rankQ.addEventListener('input', () => { S.ui.branchRank.q = rankQ.value; paintBranchRank(); });
                if (rankSeg) rankSeg.addEventListener('click', e => {
                    const b = e.target.closest('.seg-btn'); if (!b) return;
                    S.ui.branchRank.limit = +b.dataset.rankLimit;
                    $$('#brRankSeg .seg-btn').forEach(x => { const on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', String(on)); });
                    A.placeSeg(rankSeg);
                    paintBranchRank();
                });
            }
        }
    };

    /* =========================================================================
       TAM SAYFA PERSONEL PROFILI — #/profile rotasi
       IK Yöneticisi Karar Destek Kokpiti: Dikey Excel Karnesi ile %100 Veri Eşleniği +
       Anasayfa (HR.overview) ile Birebir Tasarım & Tipografi Bütünlüğü + 4 İnteraktif Grafik
       ========================================================================= */
    HR.profile = {
        title: 'Personel profili',
        sub: () => (S.openEmpId && emp(S.openEmpId)) ? emp(S.openEmpId).name + ' (' + emp(S.openEmpId).sicil + ') · ' + emp(S.openEmpId).dept + ' · ' + rangeLabel() : rangeLabel(),
        tools: { range: 1 },
        icon: 'users',
        render() {
            const e = emp(S.openEmpId) || D.EMPLOYEES[0];
            if (!e) {
                return `<section class="card">${empty('Personel seçilmedi', 'Personel listesinden bir kişi seçin.')}
                    <div style="margin-top:14px"><button type="button" class="btn btn-primary" data-go="employees">Personel listesine dön</button></div></section>`;
            }
            if (!S.openEmpId) S.openEmpId = e.id;

            const an = D.empAnalytics(e.id, filterOpts());
            const b = D.BRANCHES.find(x => x.code === e.branch) || D.BRANCHES[0] || { name: 'Genel Müdürlük', city: 'İstanbul', lat: 41.0082, lng: 28.9784, radius: 30, wifi: 'ALBAYRAK_CORP' };
            const totBar = Math.max(1, an.totalOvertimeMin + an.totalLateMin);
            const otPct = Math.round((an.totalOvertimeMin / totBar) * 100);
            const latePct = 100 - otPct;

            // Departman ve Kurum Geneli Sıralama & Kıyaslama
            const deptEmps = D.EMPLOYEES.filter(x => x.dept === e.dept);
            const deptLb = D.computeLeaderboards(deptEmps, filterOpts());
            const allLb = D.computeLeaderboards(D.EMPLOYEES, filterOpts());
            const dn = deptLb.all.length || 1;
            const cn = allLb.all.length || 1;
            const deptRankIdx = deptLb.bestNet.findIndex(x => x.empId === e.id);
            const deptRank = deptRankIdx >= 0 ? (deptRankIdx + 1) : 1;
            const compRankIdx = allLb.bestNet.findIndex(x => x.empId === e.id);
            const compRank = compRankIdx >= 0 ? (compRankIdx + 1) : 1;

            const deptAvgOt = Math.round(deptLb.all.reduce((a, x) => a + x.totalOvertimeMin, 0) / dn);
            const deptAvgLate = Math.round(deptLb.all.reduce((a, x) => a + x.totalLateMin, 0) / dn);
            const deptAvgWorkH = +(deptLb.all.reduce((a, x) => a + x.avgWorkH, 0) / dn).toFixed(1);
            const compAvgOt = Math.round(allLb.all.reduce((a, x) => a + x.totalOvertimeMin, 0) / cn);
            const compAvgLate = Math.round(allLb.all.reduce((a, x) => a + x.totalLateMin, 0) / cn);

            const totalWorkH = an.totalWorkH || 0;
            const totalWorkMin = Math.round(totalWorkH * 60);
            const attRate = an.totalDays ? +((an.attendedDays / an.totalDays) * 100).toFixed(1) : 100;
            const onTimeRate = +(an.onTimePct || 100).toFixed(1);
            const shiftDiffH = +(an.avgWorkH - 8.5).toFixed(1);

            const devObj = D.DEVICES.find(d => d.empId === e.id);
            const devStatusLabel = devObj
                ? (devObj.status === 'BOUND' ? 'Eşlendi (Aktif)' : devObj.status === 'PENDING' ? 'Eşleme Bekliyor' : 'Engellendi')
                : 'Eşlendi (Aktif)';
            const empLeaves = D.LEAVES.filter(l => l.empId === e.id);
            const empSec = D.ALERTS.filter(a => a.empId === e.id);

            const dLogs = an.logs.filter(l => l.dist != null && l.status !== 'LEAVE' && l.status !== 'ABSENT');
            const minDist = dLogs.length ? Math.min(...dLogs.map(l => l.dist)) : 0;
            const maxDist = an.maxDist || (dLogs.length ? Math.max(...dLogs.map(l => l.dist)) : 0);
            const firstLog = an.logs[0], lastLog = an.logs[an.logs.length - 1];
            const periodStr = an.periodLabel ? `${an.periodLabel} (${an.totalDays} İş Günü)` : (firstLog && lastLog ? `${firstLog.fullDate} – ${lastLog.fullDate} (${an.totalDays} İş Günü)` : rangeLabel());

            // Önceki / Sonraki personel hızlı geçişi
            const empIdx = D.EMPLOYEES.findIndex(x => x.id === e.id);
            const prevEmp = D.EMPLOYEES[(empIdx - 1 + D.EMPLOYEES.length) % D.EMPLOYEES.length];
            const nextEmp = D.EMPLOYEES[(empIdx + 1) % D.EMPLOYEES.length];

            const corpEmail = e.email || (e.name.toLocaleLowerCase('tr-TR')
                .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
                .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
                .replace(/[^a-z0-9]+/g, '.') + '@albayrakfinans.com.tr');
            const startDateStr = e.start || e.startDate || ('15.0' + (1 + (e.id % 8)) + '.' + (2019 + (e.id % 6)));

            // Gün gün PDKS tablosu sıralama ve durum filtreleme
            const pl = S.ui.profLog || (S.ui.profLog = { sort: 'date', dir: -1, status: 'ALL' });
            const filteredLogs = an.logs.filter(l => {
                if (pl.status === 'ALL') return true;
                if (pl.status === 'OT') return (l.overtimeMin || 0) > 0;
                if (pl.status === 'LATE') return (l.lateMin || 0) > 0 || l.status === 'LATE';
                if (pl.status === 'PRESENT') return l.status === 'PRESENT' && !(l.lateMin > 0);
                if (pl.status === 'LEAVE_ABS') return l.status === 'LEAVE' || l.status === 'ABSENT';
                return l.status === pl.status;
            });
            const toMin = hhmmStr => {
                if (!hhmmStr || typeof hhmmStr !== 'string' || !hhmmStr.includes(':')) return -1;
                const [hh, mm] = hhmmStr.split(':').map(Number);
                return (hh || 0) * 60 + (mm || 0);
            };
            const sortKeyFn = {
                date: l => l.idx != null ? l.idx : l.fullDate,
                dow: l => l.dow || 0,
                in: l => toMin(l.checkIn),
                out: l => toMin(l.checkOut),
                work: l => l.workH || 0,
                late: l => l.lateMin || 0,
                ot: l => l.overtimeMin || 0,
                net: l => l.netMin || 0,
                dist: l => l.dist != null ? l.dist : 999,
                status: l => l.status || ''
            }[pl.sort] || (l => l.idx || 0);

            const sortedLogs = filteredLogs.slice().sort((a, b2) => {
                const va = sortKeyFn(a), vb = sortKeyFn(b2);
                if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb, 'tr') * pl.dir;
                return ((va > vb ? 1 : va < vb ? -1 : 0)) * pl.dir;
            });

            const thSort = (key, label) => {
                const active = pl.sort === key;
                const arrow = active ? (pl.dir === 1 ? '▲' : '▼') : '↕';
                return `<th class="th-sort${active ? ' is-sorted' : ''}" data-act="prof-log-sort" data-v="${key}" title="Sıralamak için tıklayın (${esc(label)})">${esc(label)}<span class="sort-ind">${arrow}</span></th>`;
            };

            /* İK önce davranışa bakar: gecikme özeti, son gecikmeler, gün gün cetvel.
               Özlük / cihaz bilgileri en altta kapalı bölümde durur. */
            const empReasons = (D.LATE_REASONS || []).filter(r => r.empId === e.id);
            const reasonOf = iso => empReasons.find(r => String(r.workDate || '').slice(0, 10) === iso);
            const pendingReasonN = empReasons.filter(r => r.status === 'PENDING').length;
            const recentLate = an.logs.filter(l => l.lateMin > 0).slice().sort((x, y) => String(y.iso).localeCompare(String(x.iso))).slice(0, 8);
            const lateRatio = deptAvgLate > 0 ? an.totalLateMin / deptAvgLate : 0;
            const summaryTone = an.lateDays === 0 && an.absentDays === 0 ? 'ok' : (lateRatio >= 1.5 || an.absentDays > 0 || an.lateDays >= 5) ? 'warn' : 'info';
            const summaryParts = [];
            if (an.lateDays > 0) {
                summaryParts.push(`Bu dönemde <b>${an.lateDays} gün</b> geç kaldı (toplam <b>${fmtMinDur(an.totalLateMin)}</b>)`);
                if (an.mostLateDay.lateCount > 1) summaryParts.push(`en çok <b>${esc(an.mostLateDay.dowName)}</b> günleri`);
                if (deptAvgLate > 0) summaryParts.push(lateRatio >= 1.15 ? `birim ortalamasının <b>${A.numText(lateRatio)} katı</b>` : lateRatio <= 0.85 ? 'birim ortalamasının altında' : 'birim ortalamasına yakın');
            } else {
                summaryParts.push('Bu dönemde <b>hiç geç kalmadı</b>');
            }
            if (an.absentDays > 0) summaryParts.push(`<b>${an.absentDays} gün</b> izinsiz gelmedi`);
            if (pendingReasonN > 0) summaryParts.push(`<b>${pendingReasonN}</b> gecikme gerekçesi onayınızı bekliyor`);
            const detOpen = !!S.ui.profDetOpen;

            return `
            <div class="prof-bar">
                <div class="prof-bar-nav">
                    <button type="button" class="btn btn-soft btn-sm" data-go="employees">${ic('chevron', 'flip')} Personel listesi</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-act="emp-profile" data-id="${prevEmp.id}" title="${esc(prevEmp.name)}" aria-label="Önceki personel: ${esc(prevEmp.name)}">‹ Önceki</button>
                    <button type="button" class="btn btn-ghost btn-sm" data-act="emp-profile" data-id="${nextEmp.id}" title="${esc(nextEmp.name)}" aria-label="Sonraki personel: ${esc(nextEmp.name)}">Sonraki ›</button>
                </div>
                <div class="prof-bar-acts">
                    ${dlBtn('export-one', 'PDKS karnesi (.xlsx)', { cls: 'btn-primary btn-sm', id: e.id })}
                    <button type="button" class="btn btn-soft btn-sm" data-act="emp-edit" data-id="${e.id}">${ic('tool')} Düzenle</button>
                    <button type="button" class="btn btn-bad btn-sm icon-only" data-act="emp-delete" data-id="${e.id}" title="Personeli sil" aria-label="${esc(e.name)} personelini sil">${ic('x')}</button>
                </div>
            </div>

            <section class="card prof-head">
                ${avatar(e, 'lg')}
                <div class="prof-head-txt">
                    <div class="prof-head-name"><h2>${esc(e.name)}</h2>${pill('Bugün: ' + STATUS[e.status][0], STATUS[e.status][1])}</div>
                    <p>${esc(e.title)} · <b>${esc(e.dept)}</b> · ${esc(b.name)} · <span class="mono">${esc(e.sicil)}</span></p>
                </div>
                <div class="prof-head-rank">${pill('Birimde ' + deptRank + ' / ' + dn, 'info')}</div>
            </section>

            <div class="prof-summary ${summaryTone}" role="note">
                ${ic(summaryTone === 'ok' ? 'check' : 'alert')}
                <p>${summaryParts.join(' · ')}. <span class="muted">(${esc(rangeLabel())})</span></p>
            </div>

            <div class="grid g-4 mt">
                ${kpi({
                    label: 'Toplam gecikme',
                    /* 2 saati aşan gecikme saat olarak okunur (688 dk yerine 11,5 sa) */
                    val: an.totalLateMin >= 120 ? +(an.totalLateMin / 60).toFixed(1) : an.totalLateMin,
                    dec: an.totalLateMin >= 120 ? 1 : 0,
                    unit: an.totalLateMin >= 120 ? 'sa' : 'dk', icon: 'clock', cls: 'kpi-primary',
                    tone: an.totalLateMin > 0 ? 'warn' : 'ok',
                    delta: deptAvgLate > 0 ? delta(an.totalLateMin - deptAvgLate, ' dk', false) : '',
                    foot: an.lateDays + ' gün · birim ort. ' + deptAvgLate + ' dk',
                    spark: A.spark(an.logs.slice(-14).map(x => x.lateMin || 0), '#C77700')
                })}
                ${kpi({
                    label: 'Zamanında giriş', val: onTimeRate, dec: 1, unit: '%', icon: 'check',
                    tone: onTimeRate >= 90 ? 'ok' : 'warn',
                    foot: an.presentDays + ' / ' + an.attendedDays + ' çalışılan gün'
                })}
                ${kpi({
                    label: 'Devamsız gün', val: an.absentDays, unit: 'gün', icon: 'alert',
                    tone: an.absentDays > 0 ? 'red' : 'ok',
                    foot: an.leaveDays + ' gün izinli / raporlu'
                })}
                ${kpi({
                    label: 'Net süre bakiyesi', val: +(an.netBalanceMin / 60).toFixed(1), dec: 1, unit: 'sa', icon: 'activity',
                    tone: an.netBalanceMin >= 0 ? 'ok' : 'bad',
                    foot: '+' + fmtMinDur(an.totalOvertimeMin) + ' ek mesai − ' + fmtMinDur(an.totalLateMin) + ' gecikme'
                })}
            </div>

            <div class="grid g-main mt">
                <section class="card flush">
                    ${cardHead('Son gecikmeler', 'En yeni önce · gerekçe durumu ile', pill(an.lateDays + ' gün', an.lateDays ? 'warn' : 'ok'))}
                    <div class="list" style="margin-top:4px">
                        ${recentLate.length ? recentLate.map(l => {
                            const r = reasonOf(l.iso);
                            const st = !r ? ['Gerekçe yok', 'mute'] : r.status === 'APPROVED' ? ['Haklı bulundu', 'ok'] : r.status === 'REJECTED' ? ['Reddedildi', 'bad'] : ['Onay bekliyor', 'warn'];
                            return `<div class="list-item">
                                <div class="grow">
                                    <b class="mono">${esc(l.fullDate)} <span class="muted" style="font-weight:500;font-family:var(--font)">· ${esc(l.dowName)}</span></b>
                                    <small>Giriş <b class="mono">${esc(l.checkIn)}</b>${r ? ' · ' + esc(lateReasonLabel(r.reasonCode)) : ''}</small>
                                </div>
                                ${pill(st[0], st[1])}
                                <span class="late-chip">−${fmtMinDur(l.lateMin)}</span>
                                ${r && r.status === 'PENDING' ? `<button type="button" class="btn btn-soft btn-sm" data-act="late-reason-open" data-id="${r.id}">İncele</button>` : ''}
                            </div>`;
                        }).join('') : empty('Bu dönemde gecikme yok', 'Tam vardiya uyumu.')}
                    </div>
                </section>
                <section class="card">
                    ${cardHead('Haftanın günlerine göre gecikme', 'Hangi gün geç kalıyor?', an.mostLateDay.totalLateMin > 0 ? pill('En çok: ' + an.mostLateDay.dowName, 'warn') : pill('Gecikme yok', 'ok'))}
                    <div id="prChartWeekday"></div>
                </section>
            </div>

            <!-- GÜN GÜN PDKS CETVELİ (sıralanabilir & filtrelenebilir) -->
            <section class="card flush mt">
                ${cardHead(
                    'Gün gün giriş-çıkış cetveli',
                    'Sütun başlığına tıklayarak sıralayın · Gösterilen: ' + sortedLogs.length + ' / ' + an.logs.length + ' iş günü',
                    `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                        ${chips([
                            { v: 'ALL', l: 'Tümü', n: an.logs.length },
                            { v: 'LATE', l: 'Geç kaldı', n: an.lateDays },
                            { v: 'LEAVE_ABS', l: 'İzin / Devamsız', n: an.leaveDays + an.absentDays },
                            { v: 'PRESENT', l: 'Zamanında', n: an.presentDays },
                            { v: 'OT', l: 'Ek mesai', n: an.overtimeDays }
                        ], pl.status, 'prof-log-status')}
                    </div>`
                )}
                <div class="table-wrap" style="max-height:460px;overflow-y:auto">
                    <table>
                        <thead>
                            <tr>
                                ${thSort('date', 'Tarih')}
                                ${thSort('dow', 'Gün')}
                                ${thSort('in', 'İlk giriş')}
                                ${thSort('late', 'Gecikme')}
                                ${thSort('out', 'Son çıkış')}
                                ${thSort('work', 'Fiili mesai')}
                                ${thSort('ot', 'Ek mesai')}
                                ${thSort('net', 'Net')}
                                ${thSort('status', 'Durum')}
                                ${thSort('dist', 'Konum')}
                            </tr>
                        </thead>
                        <tbody>
                            ${sortedLogs.length ? sortedLogs.map(l => {
                                const st = STATUS[l.status] || [l.status, 'mute'];
                                return `<tr>
                                    <td class="mono"><b>${l.fullDate}</b></td>
                                    <td>${esc(l.dowName)}</td>
                                    <td class="mono"><b>${l.checkIn || '—'}</b></td>
                                    <td class="mono" style="color:${l.lateMin > 0 ? 'var(--warn)' : 'var(--muted)'}"><b>${l.lateMin > 0 ? '−' + l.lateMin + ' dk' : '0 dk'}</b></td>
                                    <td class="mono">${l.checkOut || '—'}</td>
                                    <td class="mono">${l.workH ? String(l.workH).replace('.', ',') + ' sa' : '—'}</td>
                                    <td class="mono" style="color:${l.overtimeMin > 0 ? 'var(--ok)' : 'var(--muted)'}">${l.overtimeMin > 0 ? '+' + l.overtimeMin + ' dk' : '0 dk'}</td>
                                    <td>${l.status === 'LEAVE' || l.status === 'ABSENT' ? '—' : netPill(l.netMin)}</td>
                                    <td>${pill(st[0], st[1])}</td>
                                    <td class="mono">${l.dist != null ? pill(String(l.dist).replace('.', ',') + ' m', l.dist <= 30 ? 'ok' : 'bad') : '—'}</td>
                                </tr>`;
                            }).join('') : `<tr><td colspan="10">${empty('Seçili filtreye uygun gün kaydı bulunamadı', 'Tüm günleri görmek için "Tümü" filtresini seçin.')}</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </section>

            <div class="grid g-3 mt">
                <section class="card profile-exec-card">
                    ${cardHead('En çok geç kaldığı gün', 'Vardiya başlangıç disiplini', pill(an.lateDays + ' gün', an.lateDays > 0 ? 'warn' : 'ok'))}
                    <div class="profile-exec-val ${an.mostLateDay.totalLateMin > 0 ? 'warn' : 'ok'}">
                        ${an.mostLateDay.totalLateMin > 0 ? esc(an.mostLateDay.dowName) + ' (−' + an.mostLateDay.totalLateMin + ' dk)' : 'Gecikme kaydı yok'}
                    </div>
                    <div class="profile-exec-rows">
                        <div class="profile-exec-row"><span>Tekrar ve ortalama</span><b>${an.mostLateDay.totalLateMin > 0 ? `${an.mostLateDay.lateCount} kez · ort. −${an.mostLateDay.avgLateMin} dk` : 'Tam vardiya uyumu'}</b></div>
                        <div class="profile-exec-row"><span>En uzun gecikme</span><b class="mono">${an.peakLateRec && an.peakLateRec.lateMin > 0 ? `${an.peakLateRec.fullDate} (−${an.peakLateRec.lateMin} dk · ${an.peakLateRec.checkIn})` : '—'}</b></div>
                        <div class="profile-exec-row"><span>Ortalama / en geç giriş</span><b class="mono">${an.avgCheckIn} · ${an.latestCheckIn}</b></div>
                    </div>
                </section>
                <section class="card profile-exec-card">
                    ${cardHead('Ek mesai ve gecikme dengesi', 'Net süre', netPill(an.netBalanceMin))}
                    <div class="net-split-track" role="img" aria-label="Ek mesai yüzde ${otPct}, gecikme yüzde ${latePct}">
                        <div class="net-split-ot" style="width:${otPct}%"></div>
                        <div class="net-split-late" style="width:${latePct}%"></div>
                    </div>
                    <div class="profile-exec-rows">
                        <div class="profile-exec-row"><span>● Ek mesai (%${otPct})</span><b style="color:var(--ok)">+${fmtMinDur(an.totalOvertimeMin)} (${an.overtimeDays} gün)</b></div>
                        <div class="profile-exec-row"><span>● Gecikme (%${latePct})</span><b style="color:${an.totalLateMin > 0 ? 'var(--bad)' : 'var(--ink)'}">${an.totalLateMin > 0 ? '−' + fmtMinDur(an.totalLateMin) : '0 dk'} (${an.lateDays} gün)</b></div>
                        <div class="profile-exec-row"><span>${esc(e.dept)} birim ort. ek mesai</span><b>+${fmtMinDur(deptAvgOt)}</b></div>
                    </div>
                </section>
                <section class="card profile-exec-card">
                    ${cardHead('En çok ek mesai günü', 'Fazla çalışma yoğunluğu', pill(an.overtimeDays + ' gün', 'ok'))}
                    <div class="profile-exec-val ok">
                        ${an.mostOvertimeDay.totalOvertimeMin > 0 ? esc(an.mostOvertimeDay.dowName) + ' (+' + fmtMinDur(an.mostOvertimeDay.totalOvertimeMin) + ')' : 'Ek mesai kaydı yok'}
                    </div>
                    <div class="profile-exec-rows">
                        <div class="profile-exec-row"><span>Tekrar ve ortalama</span><b>${an.mostOvertimeDay.totalOvertimeMin > 0 ? `${an.mostOvertimeDay.otCount} gün · ort. +${an.mostOvertimeDay.avgOvertimeMin} dk` : 'Standart mesai'}</b></div>
                        <div class="profile-exec-row"><span>En uzun ek mesai</span><b class="mono">${an.peakOtRec && an.peakOtRec.overtimeMin > 0 ? `${an.peakOtRec.fullDate} (+${an.peakOtRec.overtimeMin} dk)` : '—'}</b></div>
                        <div class="profile-exec-row"><span>Ortalama çıkış ve mesai</span><b class="mono">${an.avgCheckOut} · ${String(an.avgWorkH).replace('.', ',')} sa/gün</b></div>
                    </div>
                </section>
            </div>

            <div class="grid g-main mt">
                <section class="card">
                    ${cardHead('Günlük çalışma süresi', 'Son 14 iş günü · 8,5 saat hedef çizgisi', pill('Ort. ' + String(an.avgWorkH).replace('.', ',') + ' sa / gün', an.avgWorkH >= 8.5 ? 'ok' : 'warn'))}
                    <div id="prChartWork"></div>
                </section>
                <section class="card">
                    ${cardHead('Dönem devam dağılımı', an.totalDays + ' iş günü', pill('%' + String(attRate).replace('.', ',') + ' devam', 'ok'))}
                    <div id="prChartDonut"></div>
                </section>
            </div>

            <div class="grid g-main mt">
                <section class="card flush">
                    ${cardHead('Haftanın günlerine göre davranış', 'Gün bazında giriş-çıkış, gecikme ve ek mesai')}
                    <div class="table-wrap">
                        <table>
                            <thead><tr><th>Gün</th><th>Çalışılan</th><th>Ort. giriş</th><th>Gecikme</th><th>Ek mesai</th><th>Ort. çıkış</th><th>Net</th></tr></thead>
                            <tbody>
                                ${an.weekdayList.map(w => `<tr>
                                    <td><b>${esc(w.dowName)}</b></td>
                                    <td class="mono">${w.attended} gün</td>
                                    <td class="mono">${w.avgIn}</td>
                                    <td class="mono" style="color:${w.totalLateMin > 0 ? 'var(--warn)' : 'var(--muted)'}"><b>${w.totalLateMin > 0 ? '−' + w.totalLateMin + ' dk' : '0 dk'}</b> <small class="muted">(${w.lateCount}x)</small></td>
                                    <td class="mono" style="color:${w.totalOvertimeMin > 0 ? 'var(--ok)' : 'var(--muted)'}">+${w.totalOvertimeMin} dk <small class="muted">(${w.otCount}x)</small></td>
                                    <td class="mono">${w.avgOut}</td>
                                    <td>${netPill(w.netMin)}</td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </section>
                <section class="card">
                    ${cardHead('Birim ve kurum ortalamasıyla kıyas', e.dept + ' · ' + rangeLabel(), pill(deptRank + ' / ' + dn + '. sıra', 'info'))}
                    ${rank([
                        { l: 'Toplam gecikme', v: an.totalLateMin > 0 ? '−' + fmtMinDur(an.totalLateMin) : '0 dk', w: A.clamp((an.totalLateMin / Math.max(30, Math.max(deptAvgLate, compAvgLate, an.totalLateMin) * 1.15)) * 100, 4, 100), cls: 'warn' },
                        { l: 'Birim ort. gecikme', v: '−' + fmtMinDur(deptAvgLate), w: A.clamp((deptAvgLate / Math.max(30, Math.max(deptAvgLate, compAvgLate, an.totalLateMin) * 1.15)) * 100, 4, 100), cls: '' },
                        { l: 'Kurum ort. gecikme', v: '−' + fmtMinDur(compAvgLate), w: A.clamp((compAvgLate / Math.max(30, Math.max(deptAvgLate, compAvgLate, an.totalLateMin) * 1.15)) * 100, 4, 100), cls: '' },
                        { l: 'Ek mesai', v: '+' + fmtMinDur(an.totalOvertimeMin), w: A.clamp((an.totalOvertimeMin / Math.max(60, Math.max(deptAvgOt, compAvgOt, an.totalOvertimeMin) * 1.15)) * 100, 8, 100), cls: 'ok' },
                        { l: 'Birim ort. ek mesai', v: '+' + fmtMinDur(deptAvgOt), w: A.clamp((deptAvgOt / Math.max(60, Math.max(deptAvgOt, compAvgOt, an.totalOvertimeMin) * 1.15)) * 100, 8, 100), cls: '' },
                        { l: 'Günlük ort. mesai', v: String(an.avgWorkH).replace('.', ',') + ' sa · birim ' + String(deptAvgWorkH).replace('.', ',') + ' sa', w: A.clamp((an.avgWorkH / 10.5) * 100, 10, 100), cls: 'ok' }
                    ])}
                </section>
            </div>

            <section class="card flush mt">
                ${cardHead('İzin, mazeret ve güvenlik kayıtları', 'Seçili dönemdeki talepler ve konum / cihaz uyarıları', pill(empLeaves.length + ' izin · ' + empSec.length + ' güvenlik', empSec.length > 0 ? 'warn' : 'ok'))}
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>Kayıt türü</th><th>Tarih</th><th>Başlık</th><th>Açıklama</th><th>Durum</th></tr></thead>
                        <tbody>
                            ${empLeaves.map(l => {
                                const stMap = { pending: ['Onay bekliyor', 'warn'], approved: ['Onaylandı', 'ok'], rejected: ['Reddedildi', 'bad'], PENDING: ['Onay bekliyor', 'warn'], APPROVED: ['Onaylandı', 'ok'], REJECTED: ['Reddedildi', 'bad'] }[l.status] || [l.status, 'mute'];
                                return `<tr>
                                    <td>${pill('İzin / mazeret', 'info')}</td>
                                    <td class="mono"><b>${esc(l.from || l.dates || '')}</b> (${l.days} gün)</td>
                                    <td><b>${esc(l.type)}</b></td>
                                    <td>${esc(l.reason || l.note || '')}</td>
                                    <td>${pill(stMap[0], stMap[1])} ${(l.status === 'pending' || l.status === 'PENDING') ? `<button type="button" class="btn btn-ok btn-xs" data-act="leave-act" data-id="${l.id}" data-v="approved">Onayla</button> <button type="button" class="btn btn-bad btn-xs" data-act="leave-act" data-id="${l.id}" data-v="rejected">Reddet</button>` : ''}</td>
                                </tr>`;
                            }).join('')}
                            ${empSec.map(s => {
                                const sevMap = { HIGH: ['Yüksek risk', 'bad'], MED: ['Orta risk', 'warn'], LOW: ['Bilgi', 'info'] }[s.sev] || [s.sev, 'mute'];
                                return `<tr>
                                    <td>${pill('Güvenlik / cihaz', sevMap[1])}</td>
                                    <td class="mono"><b>${esc((s.ago || '') + ' önce')}</b></td>
                                    <td><b>${esc(D.ALERT_TYPES[s.type] || s.type)}</b></td>
                                    <td>${esc(brName(s.branch))}${s.dist != null ? ' · Mesafe: ' + s.dist + ' m' : ''}</td>
                                    <td>${pill(s.resolved ? 'Çözüldü' : sevMap[0], s.resolved ? 'ok' : sevMap[1])}</td>
                                </tr>`;
                            }).join('')}
                            ${(!empLeaves.length && !empSec.length) ? `<tr><td colspan="5">${empty('Kayıt yok', 'Seçili dönemde izin talebi veya güvenlik uyarısı bulunmuyor.')}</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>
            </section>

            <details class="card prof-details no-zoom mt" id="prDetails"${detOpen ? ' open' : ''}>
                <summary>
                    <span class="prof-details-caret">${ic('chevron')}</span>
                    <span><b>Özlük, şube, cihaz ve puantaj bilgileri</b><small>Sicil kartı, konum doğrulama ve Excel karnesindeki puantaj cetveli</small></span>
                </summary>
                <div class="prof-details-body">
                    <div class="grid g-2">
                        <section class="card flush">
                            ${cardHead('Özlük, şube ve cihaz', 'Excel karnesi 1. bölüm', pill(e.sicil, 'mute'))}
                            <div class="table-wrap">
                                <table class="pdks-kv-table">
                                    <tbody>
                                        <tr><th>Sicil</th><td class="mono"><b>${esc(e.sicil)}</b></td><th>Ad soyad</th><td><b>${esc(e.name)}</b></td></tr>
                                        <tr><th>Departman</th><td>${esc(e.dept)}</td><th>Unvan</th><td>${esc(e.title)}</td></tr>
                                        <tr><th>Kurumsal e-posta</th><td class="mono">${esc(corpEmail)}</td><th>İşe başlama</th><td class="mono">${esc(startDateStr)}</td></tr>
                                        <tr><th>Şube</th><td><b>${esc(b.name)}</b> (${esc(b.city)})</td><th>Konum sınırı</th><td class="mono">${b.lat.toFixed(4)}, ${b.lng.toFixed(4)} · ${b.radius} m</td></tr>
                                        <tr><th>Şube adresi</th><td><small style="display:block;line-height:1.35">${esc(b.address || (b.name + ' · ' + b.city))}</small></td><th>Şube telefon</th><td><span class="mono">${esc(b.phone || '0850 222 0 252')}</span> · <button type="button" class="btn btn-soft btn-sm" style="height:24px;padding:0 8px;font-size:11px" data-act="br-map" data-code="${esc(b.code)}">${ic('pin')}Harita</button></td></tr>
                                        <tr><th>Kurumsal Wi-Fi</th><td class="mono">${esc(b.wifi)}</td><th>Vardiya</th><td class="mono">${esc(D.shiftOf(e).name)} · ${D.hhmm(D.shiftOf(e).startMin)} – ${D.hhmm(D.shiftOf(e).endMin)} (tolerans ${D.shiftOf(e).graceMin} dk)</td></tr>
                                        <tr><th>Mobil cihaz</th><td>${devObj ? esc(devObj.model + ' (' + devObj.os + ')') : esc(e.device || 'Kurumsal Android cihaz')}</td><th>Cihaz durumu</th><td>${devObj ? pill(devStatusLabel + ' · v' + devObj.ver, devObj.status === 'BOUND' ? 'ok' : 'warn') : pill('Eşlendi (aktif)', 'ok')}</td></tr>
                                        <tr><th>Cihaz kimliği</th><td class="mono">${devObj ? esc(devObj.mask) + ' · Son: ' + esc(devObj.lastSeen || 'Aktif') : '—'}</td><th>Konum uyumu</th><td>${pill('%' + String(an.geofenceRate).replace('.', ',') + ' (ort. ' + String(an.avgDist).replace('.', ',') + ' m)', an.geofenceRate >= 98 ? 'ok' : 'warn')}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </section>
                        <section class="card flush">
                            ${cardHead('Dönem puantaj cetveli', 'Excel karnesi 2. bölüm · ' + periodStr, netPill(an.netBalanceMin))}
                            <div class="table-wrap">
                                <table class="pdks-kv-table">
                                    <tbody>
                                        <tr><th>Takvim iş günü</th><td class="mono"><b>${an.totalDays}</b></td><th>Çalışılan gün</th><td class="mono"><b>${an.attendedDays}</b> (%${String(attRate).replace('.', ',')})</td></tr>
                                        <tr><th>Zamanında giriş</th><td class="mono">${an.presentDays} gün</td><th>Geç kalınan</th><td class="mono">${an.lateDays} gün</td></tr>
                                        <tr><th>İzinli / raporlu</th><td class="mono">${an.leaveDays} gün</td><th>Devamsız</th><td class="mono">${an.absentDays} gün</td></tr>
                                        <tr><th>Toplam fiili çalışma</th><td class="mono"><b>${String(totalWorkH).replace('.', ',')} sa</b> (${totalWorkMin} dk)</td><th>Günlük ortalama</th><td class="mono">${String(an.avgWorkH).replace('.', ',')} sa (hedef 8,5 · fark ${shiftDiffH >= 0 ? '+' : ''}${String(shiftDiffH).replace('.', ',')})</td></tr>
                                        <tr><th>Toplam ek mesai</th><td style="color:var(--ok)"><b>+${fmtMinDur(an.totalOvertimeMin)}</b></td><th>Toplam gecikme</th><td style="color:${an.totalLateMin > 0 ? 'var(--bad)' : 'var(--ink)'}"><b>${an.totalLateMin > 0 ? '−' + fmtMinDur(an.totalLateMin) : '0 dk'}</b></td></tr>
                                        <tr><th>Net süre bakiyesi</th><td>${netPill(an.netBalanceMin)}</td><th>Birim / kurum sırası</th><td><b>${deptRank}/${dn}</b> · ${compRank}/${cn}</td></tr>
                                        <tr><th>Ort. giriş / çıkış</th><td class="mono">${an.avgCheckIn} → ${an.avgCheckOut}</td><th>En erken / en geç giriş</th><td class="mono">${an.earliestCheckIn} – ${an.latestCheckIn}</td></tr>
                                        <tr><th>Konum mesafesi</th><td class="mono">Min ${String(minDist).replace('.', ',')} m · Maks ${String(maxDist).replace('.', ',')} m</td><th>İzin / güvenlik</th><td>${empLeaves.length} izin · ${empSec.length ? empSec.length + ' uyarı' : 'ihlal yok'}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                    <section class="card mt">
                        ${cardHead('Şube konum mesafesi', b.name + ' merkezine günlük giriş mesafesi ve 30 m sınır', pill('Ort. ' + String(an.avgDist).replace('.', ',') + ' m', 'info'))}
                        <div id="prChartDist"></div>
                    </section>
                </div>
            </details>`;
        }
    };

    HR.reports = {
        title: 'Kurumsal Raporlar', sub: () => 'Raporu seçerek ekranda inceleyin, yazdırın veya resmi OpenXML Excel (.xlsx) olarak indirin · ' + rangeLabel(), tools: { range: 1, branch: 1 }, icon: 'file',
        render() {
            const st = stats(), ds = deptStats(), days = activeDays(), E = emps();
            const lb = D.computeLeaderboards(E, filterOpts());
            const lateList = lb.mostLate.filter(a => a.totalLateMin > 0);
            const branchLeaves = D.LEAVES.filter(l => S.branch === 'ALL' || (emp(l.empId) && emp(l.empId).branch === S.branch));
            const branchAlerts = D.ALERTS.filter(a => S.branch === 'ALL' || a.branch === S.branch);
            const branchDevices = D.DEVICES.filter(d => S.branch === 'ALL' || (emp(d.empId) && emp(d.empId).branch === S.branch));
            const p2 = n => String(n).padStart(2, '0');
            const now = new Date();
            const stamp = `${p2(now.getDate())}.${p2(now.getMonth() + 1)}.${now.getFullYear()} ${p2(now.getHours())}:${p2(now.getMinutes())}`;
            const reportNo = `PDKS-${now.getFullYear()}-${p2(now.getMonth() + 1)}${p2(now.getDate())}`;
            const hazirlayan = S.user ? S.user.name + ' — ' + S.user.title : 'İnsan Kaynakları Yönetimi';
            const subeAdi = S.branch === 'ALL' ? `Tüm Şubeler (${D.BRANCHES.length} Lokasyon)` : brName(S.branch);

            const reportsCatalog = [
                {
                    id: 'emps',
                    no: '01',
                    tag: 'Ana Puantaj',
                    icon: 'users',
                    exportAct: 'export-emps',
                    title: 'Kurumsal Puantaj, Ek Mesai ve Net Bakiye Raporu',
                    docTitle: 'KURUMSAL PERSONEL PUANTAJ, EK MESAİ VE NET BAKİYE RAPORU',
                    docSub: 'Departman uyum matrisi ve personel bazlı giriş-çıkış, gecikme, ek mesai ve net süre bakiyesi cetveli',
                    desc: 'Yönetici özeti, departman performans matrisi ve tüm personelin giriş-çıkış, gecikme, ek mesai ve net süre bakiyesi tablosu.',
                    badge: `${st.N} personel · ${ds.length} departman`,
                    stats: [
                        ['Aktif Kadro', `${st.N} kişi`],
                        ['Zamanında Uyum', `%${A.pctText(st.onTimePct)}`],
                        ['Net Süre Bakiyesi', fmtMinSigned(st.netBalanceMin)]
                    ],
                    kpis: [
                        { l: 'Toplam Personel', v: String(st.N), s: 'Seçili kapsamda aktif kadro', tone: '', icon: 'users' },
                        { l: 'Zamanında Giriş', v: '%' + A.pctText(st.onTimePct), s: st.onTime + ' personel zamanında', tone: 'ok', icon: 'check' },
                        { l: 'Toplam Gecikme', v: fmtMinDur(st.totalLateMin), s: st.late + ' personel geç kaldı', tone: 'bad', icon: 'clock' },
                        { l: 'Toplam Ek Mesai', v: A.numText(st.totalOvertimeH) + ' sa', s: 'Onaylı fazla çalışma', tone: 'ok', icon: 'up' },
                        { l: 'Net Süre Bakiyesi', v: fmtMinSigned(st.netBalanceMin), s: 'Ek mesai − gecikme', tone: 'info', icon: 'chart' },
                        { l: 'Geç Kalan / Devamsız', v: st.late + ' / ' + st.absent, s: 'Ort. ' + Math.round(st.avgLate) + ' dk gecikme', tone: 'warn', icon: 'alert' }
                    ],
                    explain: [
                        ['Ort. Giriş / Ort. Çıkış', 'Seçili dönemdeki aktif iş günlerinde personelin ilk giriş (CHECK_IN) ve son çıkış (CHECK_OUT) saatlerinin aritmetik ortalamasıdır.'],
                        ['Top. Gecikme (dk)', 'Her personelin atanmış vardiya şablonundaki başlangıç saati + hoşgörü süresinden (örn. 08:30 + 5 dk = 08:35) sonra yaptığı girişlerin toplam dakikasıdır. Onaylı saatlik izinler düşülür.'],
                        ['Top. Ek Mesai (dk)', 'Personelin atanmış vardiya şablonunun bitiş saatinden (örn. 17:30) sonra yapılan onaylı fazla çalışmaların toplam dakikasıdır.'],
                        ['Net Süre Bakiyesi', 'Toplam Ek Mesai (dk) − Toplam Gecikme (dk) formülüyle hesaplanır. Pozitif (+) değer fazla mesai üstünlüğünü, negatif (−) değer net süre kaybını gösterir.']
                    ]
                },
                {
                    id: 'leaderboards',
                    no: '02',
                    tag: 'Performans Ligi',
                    icon: 'chart',
                    exportAct: 'export-leaderboards',
                    title: 'Fazla Mesai Liderleri ve Net Süre Bakiyesi Ligi',
                    docTitle: 'FAZLA MESAİ LİDERLERİ VE NET SÜRE BAKİYESİ (MESAİ − GECİKME) RAPORU',
                    docSub: 'Ek mesaiden gecikme çıkınca kalan net sürede en iyiler, en kötüler ve tüm kadro sıralaması',
                    desc: 'En çok ek mesai yapan personel ile net süre bakiyesinde (ek mesai − gecikme) en iyiler ve en kötüler sıralaması.',
                    badge: `${lb.all.length} personel sıralaması`,
                    stats: [
                        ['Mesai Lideri', lb.topOvertime[0] ? lb.topOvertime[0].emp.name : '—'],
                        ['En İyi Net Bakiye', lb.bestNet[0] ? fmtMinSigned(lb.bestNet[0].netBalanceMin) : '—'],
                        ['En Düşük Net Bakiye', lb.worstNet[0] ? fmtMinSigned(lb.worstNet[0].netBalanceMin) : '—']
                    ],
                    kpis: [
                        { l: 'En Çok Mesai Yapan', v: lb.topOvertime[0] ? lb.topOvertime[0].emp.name : '—', s: lb.topOvertime[0] ? '+' + fmtMinDur(lb.topOvertime[0].totalOvertimeMin) : '', tone: 'ok', icon: 'up' },
                        { l: 'Net Bakiye Lideri', v: lb.bestNet[0] ? lb.bestNet[0].emp.name : '—', s: lb.bestNet[0] ? fmtMinSigned(lb.bestNet[0].netBalanceMin) : '', tone: 'ok', icon: 'check' },
                        { l: 'En Düşük Net Bakiye', v: lb.worstNet[0] ? lb.worstNet[0].emp.name : '—', s: lb.worstNet[0] ? fmtMinSigned(lb.worstNet[0].netBalanceMin) : '', tone: 'bad', icon: 'alert' },
                        { l: 'Toplam Ek Mesai', v: A.numText(st.totalOvertimeH) + ' sa', s: 'Dönem toplamı', tone: 'ok', icon: 'activity' },
                        { l: 'Toplam Gecikme', v: fmtMinDur(st.totalLateMin), s: 'Dönem toplamı', tone: 'bad', icon: 'clock' },
                        { l: 'Kurum Net Bakiyesi', v: fmtMinSigned(st.netBalanceMin), s: 'Ek mesai − gecikme', tone: 'info', icon: 'chart' }
                    ],
                    explain: [
                        ['Sıralama Kriteri (Net Bakiye)', 'Personeller Net Bakiye (dk) = Toplam Ek Mesai (dk) − Toplam Gecikme (dk) değerine göre büyükten küçüğe sıralanır.'],
                        ['En Çok Mesai Günü', 'Haftanın 5 iş günü (Pazartesi–Cuma) içinde personelin en yüksek toplam fazla mesai ürettiği gündür.'],
                        ['En Çok Geç Kalınan Gün', 'Haftanın günleri içinde personelin en fazla gecikme dakikası biriktirdiği gündür; 0 dk ise "Gecikme Yok" yazılır.'],
                        ['Değerlendirme Durumu', 'Net bakiyesi ≥ 0 dk olan personel "Zamanında / Pozitif Bakiye", < 0 dk olan personel "Geç / Negatif Bakiye" olarak sınıflandırılır.']
                    ]
                },
                {
                    id: 'analytics',
                    no: '03',
                    tag: 'İK Analitik',
                    icon: 'activity',
                    exportAct: 'export-analytics',
                    title: 'İK Performans, Departman Matrisi ve Günlük Eğilim Raporu',
                    docTitle: 'İNSAN KAYNAKLARI PERFORMANS, FAZLA MESAİ VE ANALİTİK RAPORU',
                    docSub: 'Departman karşılaştırma matrisi ve seçili dönemdeki iş günü bazlı katılım/mesai eğilimleri',
                    desc: 'Departman bazlı katılım, ortalama giriş saati, fazla mesai yükü ve iş günü bazında zamanında geliş eğilim kırılımı.',
                    badge: `${ds.length} departman · ${days.length} iş günü`,
                    stats: [
                        ['Uyum Oranı', `%${A.pctText(st.onTimePct)}`],
                        ['Dönem İş Günü', `${days.length} gün`],
                        ['Toplam Fazla Mesai', `${A.numText(st.totalOvertimeH)} sa`]
                    ],
                    kpis: [
                        { l: 'Zamanında Katılım', v: '%' + A.pctText(st.onTimePct), s: 'Kurumsal hedef: %95,0', tone: 'ok', icon: 'check' },
                        { l: 'Toplam Fazla Mesai', v: A.numText(st.totalOvertimeH) + ' sa', s: rangeLabel(), tone: 'ok', icon: 'up' },
                        { l: 'Toplam Gecikme', v: fmtMinDur(st.totalLateMin), s: st.late + ' personel geç kaldı', tone: 'bad', icon: 'clock' },
                        { l: 'Net Süre Bakiyesi', v: fmtMinSigned(st.netBalanceMin), s: 'Ek mesai − gecikme', tone: 'info', icon: 'chart' },
                        { l: 'Ortalama Gecikme', v: Math.round(st.avgLate) + ' dk', s: 'Geç kalan personel ort.', tone: 'warn', icon: 'alert' },
                        { l: 'Devamsız Kadro', v: String(st.absent), s: 'Kayıt açılmayan personel', tone: 'bad', icon: 'users' }
                    ],
                    explain: [
                        ['Departman Uyum Oranı (%)', 'Departmandaki zamanında gelinen toplam personel-gün sayısının, toplam aktif çalışma gününe oranıdır: (Zamanında Gün / Aktif Gün) × 100.'],
                        ['Günlük Zamanında / Geç / İzinli (%)', 'İlgili iş gününde zamanında gelen, geç kalan ve izinli olan personelin toplam kadroya yüzdesel oranıdır.'],
                        ['Ort. Çalışma Süresi (Sa)', 'Giriş ve çıkış saatleri arasındaki süreden 1 saat (60 dk) öğle molası düşülerek bulunan günlük kişi başı fiili çalışma ortalamasıdır.'],
                        ['Durum Değerlendirmesi', 'Günlük zamanında katılım oranı ≥ %92 olan günler "Zamanında (Hedef Üstü)", altındaki günler "Geç (İzlenmeli)" olarak işaretlenir.']
                    ]
                },
                {
                    id: 'late',
                    no: '04',
                    tag: 'Disiplin & Denetim',
                    icon: 'alert',
                    exportAct: 'export-late',
                    title: 'Gecikme ve Devamsızlık Denetim Raporu',
                    docTitle: 'GECİKME VE NET SÜRE BAKİYESİ DENETİM RAPORU',
                    docSub: 'Gecikme kaydı bulunan personelin gecikme gün sayısı, en sık gecikilen gün ve net bakiye dökümü',
                    desc: 'Geç kalan personel listesi, toplam gecikme dakikası, gecikme gün sayısı, en çok gecikilen gün ve şube kırılımı.',
                    badge: `${st.late} bugün geç · ${lateList.length} dönem kaydı`,
                    stats: [
                        ['Bugün Geç Kalan', `${st.late} kişi`],
                        ['Bugün Devamsız', `${st.absent} kişi`],
                        ['Ort. Gecikme', `${Math.round(st.avgLate)} dk`]
                    ],
                    kpis: [
                        { l: 'Bugün Geç Kalan', v: String(st.late), s: 'Aktif vardiyada geciken', tone: 'warn', icon: 'clock' },
                        { l: 'Bugün Devamsız', v: String(st.absent), s: 'Giriş kaydı bulunmayan', tone: 'bad', icon: 'alert' },
                        { l: 'Dönem Gecikme Kaydı', v: String(lateList.length), s: 'Gecikmesi olan personel', tone: 'info', icon: 'users' },
                        { l: 'Toplam Gecikme Süresi', v: fmtMinDur(st.totalLateMin), s: rangeLabel(), tone: 'bad', icon: 'clock' },
                        { l: 'Ortalama Gecikme', v: Math.round(st.avgLate) + ' dk', s: 'Vardiya + tolerans bazlı', tone: 'warn', icon: 'activity' },
                        { l: 'Geofence Denetimi', v: '%' + A.pctText(st.geofencePct), s: '30 m şube sınırı aktif', tone: 'ok', icon: 'pin' }
                    ],
                    explain: [
                        ['Gecikme Başlangıç Eşiği', 'Her personelin PostgreSQL shifts tablosunda kendisine atanmış vardiya şablonunun başlangıç saatine hoşgörü süresi eklenir (standart 08:30 + 5 dk = 08:35; GM 09:00 + 10 dk = 09:10). Şablon değiştiğinde tüm analiz ve raporlar anında yeni vardiyaya göre hesaplanır.'],
                        ['Gecikme Gün Sayısı', 'Seçili dönemde personelin vardiya tolerans saatinden sonra giriş yaptığı toplam iş günü sayısıdır.'],
                        ['Saatlik İzin Mahsubu', 'İK tarafından onaylanan saatlik izin süresi (durationMin), ilgili gündeki gecikme dakikasından otomatik düşülür.'],
                        ['Telafi / Net Bakiye', 'Personelin yaptığı fazla mesai, toplam gecikmesinden büyükse Net Süre Bakiyesi pozitif (+) olur ve gecikmesini telafi ettiği görülür.']
                    ]
                },
                {
                    id: 'leaves',
                    no: '05',
                    tag: 'İK Kayıt',
                    icon: 'calendar',
                    exportAct: 'export-leaves',
                    title: 'İzin, Saatlik İzin ve Mazeret Yönetim Raporu',
                    docTitle: 'KURUMSAL İZİN, SAATLİK İZİN VE MAZERET TALEPLERİ RAPORU',
                    docSub: 'Yıllık izin, saatlik izin, mazeret izni, saha görevi ve sağlık raporu kayıtlarının onay dökümü',
                    desc: 'PostgreSQL leave_requests tablosundaki tam gün ve saatlik izin taleplerinin tür, süre, saat aralığı ve onay durumu dökümü.',
                    badge: `${branchLeaves.length} talep · ${branchLeaves.filter(l => l.status === 'pending').length} bekleyen`,
                    stats: [
                        ['Toplam Talep', `${branchLeaves.length} kayıt`],
                        ['Onay Bekleyen', `${branchLeaves.filter(l => l.status === 'pending').length} talep`],
                        ['Saatlik İzin', `${branchLeaves.filter(l => l.isHourly).length} kayıt`]
                    ],
                    kpis: [
                        { l: 'Toplam İzin Talebi', v: String(branchLeaves.length), s: 'PostgreSQL leave_requests', tone: '', icon: 'calendar' },
                        { l: 'Onay Bekleyen', v: String(branchLeaves.filter(l => l.status === 'pending').length), s: 'İK onayı bekliyor', tone: 'warn', icon: 'clock' },
                        { l: 'Onaylanan', v: String(branchLeaves.filter(l => l.status === 'approved').length), s: 'Puantaja işlendi', tone: 'ok', icon: 'check' },
                        { l: 'Reddedilen', v: String(branchLeaves.filter(l => l.status === 'rejected').length), s: 'Kapatılan talep', tone: 'bad', icon: 'x' },
                        { l: 'Saatlik İzin Kaydı', v: String(branchLeaves.filter(l => l.isHourly).length), s: 'Gecikmeden düşülen', tone: 'info', icon: 'activity' },
                        { l: 'Bugün İzinli Kadro', v: String(st.leave), s: 'Aktif izinli personel', tone: 'info', icon: 'users' }
                    ],
                    explain: [
                        ['Tam Gün vs Saatlik İzin', 'Tam gün izinler gün bazında (örn. 1–14 gün) yıllık izin kotasından düşer; saatlik izinler başlangıç-bitiş saatiyle (örn. 08:30–10:00, 90 dk) kaydedilir.'],
                        ['Saatlik İzin Gecikme Etkisi', 'Saatlik izin "Onaylandı" (APPROVED) durumuna geçtiğinde, süresi kadar dakika personelin o günkü gecikme süresinden otomatik indirilir.'],
                        ['İzin Kotası (Hak Edilen / Kullanılan)', 'Her personelin yıllık izin hakkı (leaveTotalDays) ve kullandığı gün (leaveUsedDays) PostgreSQL employees tablosunda takip edilir.'],
                        ['Onay Akışı', 'Bekleyen (PENDING) talepler İK tarafından onaylandığında veya reddedildiğinde işlem zaman damgası ve denetim iziyle kaydedilir.']
                    ]
                },
                {
                    id: 'it',
                    no: '06',
                    tag: 'BT & Güvenlik',
                    icon: 'shield',
                    exportAct: 'export-it',
                    title: 'BT Siber Güvenlik, Cihaz Eşleme ve Denetim Raporu',
                    docTitle: 'BT SİBER GÜVENLİK, CİHAZ EŞLEME VE DENETİM RAPORU',
                    docSub: 'Sahte GPS blokajları, 30m geofence ihlalleri, tekil cihaz eşlemeleri ve yönetici denetim günlüğü',
                    desc: 'Sahte konum (Mock GPS), 30m şube sınırı aşımı, tekil cihaz eşleme durumu ve yönetici denetim günlüğü (audit_logs) raporu.',
                    badge: `${branchAlerts.length} güvenlik kaydı · ${branchDevices.length} cihaz`,
                    stats: [
                        ['Açık Uyarı', `${branchAlerts.filter(a => !a.resolved).length} kayıt`],
                        ['Eşlenmiş Cihaz', `${branchDevices.filter(d => d.status === 'BOUND').length} / ${branchDevices.length}`],
                        ['Denetim Kaydı', `${D.AUDIT.length} işlem`]
                    ],
                    kpis: [
                        { l: 'Eşlenmiş Cihaz', v: String(branchDevices.filter(d => d.status === 'BOUND').length), s: branchDevices.length + ' toplam cihaz', tone: 'ok', icon: 'phone' },
                        { l: 'Açık Güvenlik Uyarısı', v: String(branchAlerts.filter(a => !a.resolved).length), s: branchAlerts.filter(a => !a.resolved && a.sev === 'HIGH').length + ' yüksek önem', tone: 'bad', icon: 'shield' },
                        { l: 'Toplam Güvenlik Kaydı', v: String(branchAlerts.length), s: 'PostgreSQL security_alerts', tone: 'warn', icon: 'alert' },
                        { l: 'Sahte GPS Blokajı', v: String(branchAlerts.filter(a => a.type === 'MOCK_GPS').length), s: 'Anında reddedilen deneme', tone: 'bad', icon: 'pin' },
                        { l: '30m Sınır İhlali', v: String(branchAlerts.filter(a => a.type === 'GEOFENCE').length), s: 'Geofence dışı deneme', tone: 'warn', icon: 'pin' },
                        { l: 'Denetim Günlüğü', v: String(D.AUDIT.length), s: 'Değiştirilemez audit_logs', tone: 'info', icon: 'list' }
                    ],
                    explain: [
                        ['30m Geofence Mesafe Hesabı', 'Personel cihaz koordinatı ile şube merkez koordinatı arasındaki mesafe Haversine formülüyle metre cinsinden hesaplanır; > 30 m işlemler reddedilir.'],
                        ['Sahte GPS (Mock Location) Tespiti', 'Android Location.isMock / isFromMockProvider, Bundle ekstraları, 0 m doğruluk anomalisi ve geliştirici sahte konum ayarları denetlenir; tespitte işlem mesafe kontrolünden önce engellenir.'],
                        ['Tekil Cihaz Eşleme (Device Binding)', 'Her personel yalnızca onaylı tek bir mobil cihaz kimliği (deviceModel / deviceId) ile giriş yapabilir; farklı cihaz denemeleri uyarı üretir.'],
                        ['Denetim Günlüğü (Audit Log)', 'Şube, personel, izin, vardiya ve güvenlik politikası üzerindeki tüm yönetici işlemleri zaman damgası ve kullanıcı bilgisiyle kaydedilir.']
                    ]
                }
            ];

            const selected = reportsCatalog.find(r => r.id === S.ui.reportId) || null;

            // VARSAYILAN GÖRÜNÜM: Rapor seçilmediyse yalnızca Rapor Merkezi listesi/kartları gösterilir.
            if (!selected) {
                return `<div class="rpt-page">
                  <section class="card flush">
                    ${cardHead(
                        'Kurumsal Rapor Merkezi',
                        `${rangeLabel()} · ${subeAdi} — İncelemek, yazdırmak veya Excel (.xlsx) olarak indirmek istediğiniz rapora tıklayın`,
                        `<span class="pill info">${reportsCatalog.length} rapor hazır</span>`
                    )}
                    <div class="rpt-hub-grid">
                      ${reportsCatalog.map(r => `<article class="card rpt-hub-card lift" data-act="rpt-open" data-id="${r.id}" tabindex="0" role="button" aria-label="${esc(r.title)} raporunu görüntüle">
                        <div class="rpt-card-top">
                          <span class="rpt-card-no">${r.no}</span>
                          <span class="rpt-tag">${esc(r.tag)}</span>
                          <span class="pill mute">${esc(r.badge)}</span>
                          <span class="rpt-card-ic">${ic(r.icon)}</span>
                        </div>
                        <div class="rpt-hub-body">
                          <h4>${esc(r.title)}</h4>
                          <p>${esc(r.desc)}</p>
                        </div>
                        <div class="stat-mini-grid rpt-hub-stats">
                          ${r.stats.map(s => `<div class="stat-mini"><small>${esc(s[0])}</small><b>${esc(s[1])}</b></div>`).join('')}
                        </div>
                        <div class="rpt-hub-actions">
                          <button type="button" class="btn btn-primary btn-sm" data-act="rpt-open" data-id="${r.id}">${ic('file')} Raporu Görüntüle</button>
                          ${dlBtn(r.exportAct, 'Excel İndir (.xlsx)', { cls: 'btn-soft btn-sm' })}
                        </div>
                      </article>`).join('')}
                    </div>
                  </section>
                </div>`;
            }

            // SEÇİLİ RAPOR İÇERİĞİ (Her rapor kendi gerçek PostgreSQL/analitik tablosunu üretir)
            let bodySectionsHtml = '';
            if (selected.id === 'emps') {
                const list = filteredEmps().slice(0, 80);
                const deptRowsHtml = ds.map(x => `<tr>
                    <td class="rpt-td-name">${esc(x.d)}</td>
                    <td class="num">${x.n}</td>
                    <td class="num">${esc(x.avgIn)}</td>
                    <td class="num ok">+${fmtMinDur(x.totalOvertimeMin)}</td>
                    <td class="num bad">−${fmtMinDur(x.totalLateMin)}</td>
                    <td>${netPill(x.netMin)}</td>
                    <td class="num">%${A.pctText(x.pct)}</td>
                </tr>`).join('');
                const empRowsHtml = list.map(({ e, an }) => `<tr>
                    <td class="mono">${esc(e.sicil)}</td>
                    <td class="rpt-td-name">${esc(e.name)}</td>
                    <td>${esc(e.dept)}</td>
                    <td>${esc(brName(e.branch))}</td>
                    <td class="num">${esc(an.avgCheckIn)} → ${esc(an.avgCheckOut)}</td>
                    <td class="num bad">${an.totalLateMin > 0 ? '−' + fmtMinDur(an.totalLateMin) : '0 dk'}</td>
                    <td class="num ok">+${fmtMinDur(an.totalOvertimeMin)}</td>
                    <td>${netPill(an.netBalanceMin)}</td>
                    <td>${pill(STATUS[e.status][0], STATUS[e.status][1])}</td>
                </tr>`).join('');
                bodySectionsHtml = `
                  <h3 class="rpt-sec"><span>1</span> Departman Bazlı Uyum, Ek Mesai ve Net Bakiye Özeti</h3>
                  <div class="rpt-tablewrap"><table class="rpt-table">
                    <thead><tr><th>Departman</th><th class="num">Personel</th><th class="num">Ort. Giriş</th><th class="num">Top. Ek Mesai</th><th class="num">Top. Gecikme</th><th>Net Bakiye</th><th class="num">Uyum</th></tr></thead>
                    <tbody>${deptRowsHtml}</tbody>
                  </table></div>
                  <h3 class="rpt-sec"><span>2</span> Personel Bazlı Puantaj ve Net Süre Bakiyesi Cetveli (${list.length} / ${st.N} kayıt önizlemesi · tamamı Excel'de)</h3>
                  <div class="rpt-tablewrap"><table class="rpt-table">
                    <thead><tr><th>Sicil No</th><th>Ad Soyad</th><th>Departman</th><th>Şube</th><th class="num">Ort. Giriş / Çıkış</th><th class="num">Top. Gecikme</th><th class="num">Top. Ek Mesai</th><th>Net Bakiye</th><th>Bugün</th></tr></thead>
                    <tbody>${empRowsHtml}</tbody>
                  </table></div>`;
            } else if (selected.id === 'leaderboards') {
                const top10Html = lb.bestNet.slice(0, 10).map((a, i) => `<tr>
                    <td class="num">${i + 1}</td>
                    <td class="mono">${esc(a.emp.sicil)}</td>
                    <td class="rpt-td-name">${esc(a.emp.name)}</td>
                    <td>${esc(a.emp.dept)}</td>
                    <td class="num ok">+${fmtMinDur(a.totalOvertimeMin)}</td>
                    <td class="num bad">${a.totalLateMin > 0 ? '−' + fmtMinDur(a.totalLateMin) : '0 dk'}</td>
                    <td>${netPill(a.netBalanceMin)}</td>
                </tr>`).join('');
                const allSorted = lb.all.slice().sort((a, b) => b.netBalanceMin - a.netBalanceMin).slice(0, 80);
                const allRowsHtml = allSorted.map(a => `<tr>
                    <td class="mono">${esc(a.emp.sicil)}</td>
                    <td class="rpt-td-name">${esc(a.emp.name)}</td>
                    <td>${esc(a.emp.dept)}</td>
                    <td>${esc(brName(a.emp.branch))}</td>
                    <td class="num ok">+${a.totalOvertimeMin} dk</td>
                    <td class="num bad">−${a.totalLateMin} dk</td>
                    <td>${netPill(a.netBalanceMin)}</td>
                    <td>${esc(a.mostOvertimeDay.dowName)} (+${a.mostOvertimeDay.totalOvertimeMin} dk)</td>
                    <td>${a.mostLateDay.totalLateMin > 0 ? esc(a.mostLateDay.dowName) + ' (−' + a.mostLateDay.totalLateMin + ' dk)' : 'Gecikme Yok'}</td>
                </tr>`).join('');
                bodySectionsHtml = `
                  <h3 class="rpt-sec"><span>1</span> Net Süre Bakiyesi En İyi 10 Personel (Ek Mesai − Gecikme)</h3>
                  <div class="rpt-tablewrap"><table class="rpt-table">
                    <thead><tr><th class="num">Sıra</th><th>Sicil No</th><th>Ad Soyad</th><th>Departman</th><th class="num">Top. Ek Mesai</th><th class="num">Top. Gecikme</th><th>Net Bakiye</th></tr></thead>
                    <tbody>${top10Html}</tbody>
                  </table></div>
                  <h3 class="rpt-sec"><span>2</span> Fazla Mesai ve Net Süre Bakiyesi Sıralama Cetveli (${allSorted.length} / ${lb.all.length} kayıt)</h3>
                  <div class="rpt-tablewrap"><table class="rpt-table">
                    <thead><tr><th>Sicil No</th><th>Ad Soyad</th><th>Departman</th><th>Şube</th><th class="num">Ek Mesai</th><th class="num">Gecikme</th><th>Net Bakiye</th><th>En Çok Mesai Günü</th><th>En Çok Geç Kalınan Gün</th></tr></thead>
                    <tbody>${allRowsHtml}</tbody>
                  </table></div>`;
            } else if (selected.id === 'analytics') {
                const deptRowsHtml = ds.map(x => `<tr>
                    <td class="rpt-td-name">${esc(x.d)}</td>
                    <td class="num">${x.n}</td>
                    <td class="num">${esc(x.avgIn)}</td>
                    <td class="num">${String(x.avgWorkH).replace('.', ',')} sa</td>
                    <td class="num ok">+${fmtMinDur(x.totalOvertimeMin)}</td>
                    <td class="num bad">−${fmtMinDur(x.totalLateMin)}</td>
                    <td>${netPill(x.netMin)}</td>
                    <td class="num">%${A.pctText(x.pct)}</td>
                </tr>`).join('');
                const dayRowsHtml = days.map(x => `<tr>
                    <td class="mono">${esc(x.fullDate)}</td>
                    <td>${esc(x.dowName)}</td>
                    <td class="num ok">%${A.pctText(x.onTime * 100)}</td>
                    <td class="num bad">%${A.pctText(x.late * 100)}</td>
                    <td class="num">%${A.pctText(x.leave * 100)}</td>
                    <td class="num">${A.numText(x.workH)} sa</td>
                    <td class="num ok">+${Math.round(x.overtimeH)} sa</td>
                    <td>${pill(x.onTime >= 0.92 ? 'Zamanında (Hedef Üstü)' : 'İzlenmeli', x.onTime >= 0.92 ? 'ok' : 'warn')}</td>
                </tr>`).join('');
                bodySectionsHtml = `
                  <h3 class="rpt-sec"><span>1</span> Departman Performans, Ek Mesai ve Net Bakiye Matrisi</h3>
                  <div class="rpt-tablewrap"><table class="rpt-table">
                    <thead><tr><th>Departman</th><th class="num">Kadro</th><th class="num">Ort. Giriş</th><th class="num">Ort. Mesai</th><th class="num">Top. Ek Mesai</th><th class="num">Top. Gecikme</th><th>Net Bakiye</th><th class="num">Uyum (%)</th></tr></thead>
                    <tbody>${deptRowsHtml}</tbody>
                  </table></div>
                  <h3 class="rpt-sec"><span>2</span> Günlük Katılım, Çalışma Süresi ve Fazla Mesai Eğilim Cetveli (${days.length} iş günü)</h3>
                  <div class="rpt-tablewrap"><table class="rpt-table">
                    <thead><tr><th>Tarih</th><th>Gün</th><th class="num">Zamanında (%)</th><th class="num">Geç Kalan (%)</th><th class="num">İzinli (%)</th><th class="num">Ort. Çalışma</th><th class="num">Fazla Mesai</th><th>Değerlendirme</th></tr></thead>
                    <tbody>${dayRowsHtml}</tbody>
                  </table></div>`;
            } else if (selected.id === 'late') {
                const lateRowsHtml = lateList.slice(0, 80).map(a => `<tr>
                    <td class="mono">${esc(a.emp.sicil)}</td>
                    <td class="rpt-td-name">${esc(a.emp.name)}</td>
                    <td>${esc(a.emp.dept)}</td>
                    <td>${esc(brName(a.emp.branch))}</td>
                    <td class="num bad">−${a.totalLateMin} dk</td>
                    <td class="num">${a.lateDays} gün</td>
                    <td>${esc(a.mostLateDay.dowName)} (−${a.mostLateDay.totalLateMin} dk)</td>
                    <td class="num ok">+${a.totalOvertimeMin} dk</td>
                    <td>${netPill(a.netBalanceMin)}</td>
                </tr>`).join('');
                bodySectionsHtml = `
                  <h3 class="rpt-sec"><span>1</span> Gecikme ve Net Süre Bakiyesi Denetim Cetveli (${lateList.length} personel)</h3>
                  <div class="rpt-tablewrap"><table class="rpt-table">
                    <thead><tr><th>Sicil No</th><th>Ad Soyad</th><th>Departman</th><th>Şube</th><th class="num">Top. Gecikme</th><th class="num">Gecikme Günü</th><th>En Çok Geç Kaldığı Gün</th><th class="num">Top. Ek Mesai</th><th>Net Bakiye</th></tr></thead>
                    <tbody>${lateRowsHtml || `<tr><td colspan="9">${empty('Gecikme kaydı bulunamadı')}</td></tr>`}</tbody>
                  </table></div>`;
            } else if (selected.id === 'leaves') {
                const tone = { pending: ['Bekliyor', 'warn'], approved: ['Onaylandı', 'ok'], rejected: ['Reddedildi', 'bad'] };
                const leaveRowsHtml = branchLeaves.map(l => {
                    const e = emp(l.empId) || { sicil: l.sicil || '—', name: l.name || 'Bilinmeyen Personel', dept: '—' };
                    const tn = tone[l.status] || [l.status, 'mute'];
                    return `<tr>
                        <td class="mono">${esc(l.code || ('LV-' + l.id))}</td>
                        <td class="mono">${esc(e.sicil)}</td>
                        <td class="rpt-td-name">${esc(e.name)}</td>
                        <td>${esc(e.dept)}</td>
                        <td>${esc(l.type)}</td>
                        <td class="num">${l.isHourly && l.startClock ? `${esc(l.startClock)}–${esc(l.endClock)} (saatlik)` : `${l.days} gün`}</td>
                        <td class="mono">${esc(l.from)}</td>
                        <td>${esc(l.reason)}</td>
                        <td>${pill(tn[0], tn[1])}</td>
                    </tr>`;
                }).join('');
                bodySectionsHtml = `
                  <h3 class="rpt-sec"><span>1</span> İzin, Saatlik İzin ve Mazeret Talepleri Dökümü (${branchLeaves.length} kayıt)</h3>
                  <div class="rpt-tablewrap"><table class="rpt-table">
                    <thead><tr><th>Talep No</th><th>Sicil No</th><th>Personel Adı</th><th>Departman</th><th>İzin Türü</th><th class="num">Süre / Saat</th><th>Başlangıç</th><th>Açıklama</th><th>Durum</th></tr></thead>
                    <tbody>${leaveRowsHtml || `<tr><td colspan="9">${empty('İzin kaydı bulunamadı')}</td></tr>`}</tbody>
                  </table></div>`;
            } else if (selected.id === 'it') {
                const auditRowsHtml = D.AUDIT.slice(0, 15).map(a => `<tr>
                    <td class="mono">${esc(a.t)}</td>
                    <td class="rpt-td-name">${esc(a.who)}</td>
                    <td>${esc(a.act)}</td>
                    <td class="mono">${esc(a.target)}</td>
                    <td>${pill(a.cat, 'mute')}</td>
                </tr>`).join('');
                const alertRowsHtml = branchAlerts.map(a => {
                    const e = emp(a.empId) || { sicil: '—', name: 'Bilinmeyen Personel' };
                    const sevMap = { HIGH: ['Yüksek', 'bad'], MED: ['Orta', 'warn'], LOW: ['Düşük', 'mute'] }[a.sev] || [a.sev, 'mute'];
                    return `<tr>
                        <td class="mono">${esc(a.code || ('AL-' + a.id))}</td>
                        <td class="mono">${esc(a.ago)}</td>
                        <td class="mono">${esc(e.sicil)}</td>
                        <td class="rpt-td-name">${esc(e.name)}</td>
                        <td>${esc(brName(a.branch))}</td>
                        <td>${esc(D.ALERT_TYPES[a.type] || a.rawType || a.type)}${a.dist ? ` · ${a.dist} m` : ''}</td>
                        <td>${pill(sevMap[0], sevMap[1])}</td>
                        <td>${pill(a.resolved ? 'Çözüldü' : 'Açık', a.resolved ? 'ok' : 'warn')}</td>
                    </tr>`;
                }).join('');
                bodySectionsHtml = `
                  <h3 class="rpt-sec"><span>1</span> Son Yönetici Denetim Günlüğü (Audit Log)</h3>
                  <div class="rpt-tablewrap"><table class="rpt-table">
                    <thead><tr><th>Saat</th><th>İşlemi Yapan</th><th>İşlem Açıklaması</th><th>Hedef Kayıt</th><th>Kategori</th></tr></thead>
                    <tbody>${auditRowsHtml}</tbody>
                  </table></div>
                  <h3 class="rpt-sec"><span>2</span> Güvenlik İhlalleri, Sahte GPS ve 30m Geofence Denetim Kayıtları (${branchAlerts.length} kayıt)</h3>
                  <div class="rpt-tablewrap"><table class="rpt-table">
                    <thead><tr><th>Uyarı No</th><th>Zaman</th><th>Sicil No</th><th>Personel</th><th>Şube</th><th>Güvenlik Olayı</th><th>Önem</th><th>Durum</th></tr></thead>
                    <tbody>${alertRowsHtml || `<tr><td colspan="8">${empty('Güvenlik kaydı bulunamadı')}</td></tr>`}</tbody>
                  </table></div>`;
            }

            return `<div class="rpt-page">
              <section class="card rpt-toolbar no-print">
                <div class="rpt-toolbar-top">
                  <button type="button" class="btn btn-soft btn-sm" data-act="rpt-close">← Tüm Raporlara Dön</button>
                  <div class="chips">
                    ${reportsCatalog.map(r => `<button type="button" class="chip${r.id === selected.id ? ' is-active' : ''}" data-act="rpt-open" data-id="${r.id}"><span class="mono">${r.no}</span> ${esc(r.tag)}</button>`).join('')}
                  </div>
                  <span class="grow"></span>
                  <div class="rpt-toolbar-actions">
                    <button type="button" class="btn btn-soft btn-sm" data-act="rpt-print">${ic('file')} Yazdır</button>
                    ${dlBtn(selected.exportAct, 'Excel İndir (.xlsx)', { cls: 'btn-primary btn-sm' })}
                  </div>
                </div>
              </section>

              <section class="card flush mt rpt-preview">
                <div class="rpt-doc">
                  <header class="rpt-head">
                    <img class="rpt-logo" src="assets/branding/albayrak_pdks_logo.svg" alt="Albayrak Finans kurumsal logosu" width="62" height="52">
                    <div class="rpt-head-txt">
                      <h2>ALBAYRAK TASARRUF FİNANSMAN A.Ş.</h2>
                      <p>Personel Devam Kontrol Sistemi (PDKS) · İnsan Kaynakları ve Bilgi Teknolojileri Raporlama Merkezi</p>
                      <p class="rpt-kunye"><span>Rapor No: <b>${esc(reportNo)}-${selected.no}</b></span><span>Üretim: <b>${esc(stamp)}</b></span><span>Kategori: <b>${esc(selected.tag)}</b></span></p>
                    </div>
                  </header>
                  <div class="rpt-rule"></div>
                  <div class="rpt-title">
                    <h1>${esc(selected.docTitle)}</h1>
                    <p>${esc(selected.docSub)}</p>
                  </div>
                  <dl class="rpt-meta">
                    <div><dt>Rapor Dönemi</dt><dd>${esc(rangeLabel())}</dd></div>
                    <div><dt>Şube Kapsamı</dt><dd>${esc(subeAdi)}</dd></div>
                    <div><dt>İş Günü Sayısı</dt><dd>${days.length} iş günü</dd></div>
                    <div><dt>Hazırlayan</dt><dd>${esc(hazirlayan)}</dd></div>
                  </dl>

                  <div class="grid g-3 mt rpt-kpi-grid">
                    ${selected.kpis.map(k => `<article class="card kpi rpt-kpi-card ${k.tone}">
                      <div class="kpi-top"><span class="kpi-label">${esc(k.l)}</span><span class="kpi-ic ${k.tone}">${ic(k.icon)}</span></div>
                      <div class="kpi-val">${esc(k.v)}</div>
                      <div class="kpi-foot"><span>${esc(k.s)}</span></div>
                    </article>`).join('')}
                  </div>

                  ${bodySectionsHtml}

                  <footer class="rpt-sign">
                    <div class="rpt-sign-col"><span>Hazırlayan</span><b>${esc(hazirlayan)}</b></div>
                    <div class="rpt-sign-col"><span>Onaylayan</span><b>İnsan Kaynakları Müdürlüğü</b></div>
                  </footer>
                  <p class="rpt-foot">Bu belge Albayrak Tasarruf Finansman A.Ş. PDKS sistemi tarafından PostgreSQL 18 canlı verisinden üretilmiştir.</p>
                </div>
              </section>

              <section class="card mt rpt-methodology no-print">
                ${cardHead(
                    'Bu Rapor Nasıl Hesaplanır? · Terimler ve Metodoloji Rehberi',
                    'Aşağıdaki açıklamalar yalnızca ekranda bilgilendirme amaçlıdır; yazdırma çıktısına ve indirilen Excel (.xlsx) dosyasına dahil edilmez',
                    `<span class="pill mute">${esc(selected.tag)} Metodolojisi</span>`
                )}
                <div class="grid g-2">
                  ${selected.explain.map((ex, idx) => `<div class="rpt-method-item">
                    <div class="rpt-method-top">
                      <span class="rpt-method-num">${idx + 1}</span>
                      <b>${esc(ex[0])}</b>
                    </div>
                    <p>${esc(ex[1])}</p>
                  </div>`).join('')}
                </div>
                <div class="rpt-method- divider"></div>
                <div class="grid g-3 mt">
                  <div class="stat-mini">
                    <small>Vardiya ve Gecikme Formülü</small>
                    <b>Gecikme = Giriş − (Vardiya + Tolerans)</b>
                    <span class="muted" style="font-size:11.5px;display:block;margin-top:4px">Standart 08:30 (+5 dk), Erken 08:00 (+5 dk), GM 09:00 (+10 dk). Onaylı saatlik izinler gecikmeden otomatik düşülür.</span>
                  </div>
                  <div class="stat-mini">
                    <small>Ek Mesai ve Net Süre Bakiyesi</small>
                    <b>Net Bakiye = Ek Mesai − Gecikme</b>
                    <span class="muted" style="font-size:11.5px;display:block;margin-top:4px">Vardiya bitişinden sonraki onaylı çalışma ek mesaidir. Fiili mesai süresinden 60 dk öğle arası düşülür.</span>
                  </div>
                  <div class="stat-mini">
                    <small>30m Geofence ve Sahte Konum</small>
                    <b>Haversine ≤ 30 m & Mock GPS Blokajı</b>
                    <span class="muted" style="font-size:11.5px;display:block;margin-top:4px">Şube merkezine 30 m dışındaki veya sahte GPS (geliştirici sahte konum) tespit edilen işlemler engellenir.</span>
                  </div>
                </div>
              </section>
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
                        <div class="policy-row"><div><b style="font-size:13px;display:block">Taze Konum + location.mocked Engeli (maximumAge: 0)</b><small class="muted">Önbellek konumunu kapat; Geliştirici Seçenekleri aç-kapa hilesini yakala</small></div><button type="button" class="sw ${pol.freshLocationZeroAge !== false ? 'on' : ''}" data-act="pol-toggle" data-k="freshLocationZeroAge" aria-label="Taze Konum"></button></div>
                        <div class="policy-row"><div><b style="font-size:13px;display:block">GPS Sapma (Accuracy Küsurat) Filtresi</b><small class="muted">Sabit 1.00000 / 5.00000 m gönderen ucuz Fake GPS uygulamalarını engelle</small></div><button type="button" class="sw ${pol.accuracyFracFilter !== false ? 'on' : ''}" data-act="pol-toggle" data-k="accuracyFracFilter" aria-label="Accuracy Filtresi"></button></div>
                        <div class="policy-row"><div><b style="font-size:13px;display:block">Bağlantısız Pasif Wi-Fi BSSID Öğrenme Modu (loadWifiList)</b><small class="muted">Ağa bağlanmadan etraftaki modem MAC + RSSI listesini logla ve ortak modemi keşfet</small></div><button type="button" class="sw ${pol.passiveWifiScanLog !== false ? 'on' : ''}" data-act="pol-toggle" data-k="passiveWifiScanLog" aria-label="Pasif Wi-Fi Tarama"></button></div>
                        <div class="policy-row"><div><b style="font-size:13px;display:block">Tekil Cihaz Eşleme Kilidi</b><small class="muted">Her personel yalnızca 1 onaylı cihazdan giriş yapabilir</small></div><button type="button" class="sw ${pol.singleDevice ? 'on' : ''}" data-act="pol-toggle" data-k="singleDevice" aria-label="Tekil Cihaz"></button></div>
                    </div>
                </section>
            </div>
            <div class="grid g-2 mt">
                <section class="card flush">${cardHead('Açık destek talepleri', '', `<button class="btn btn-soft btn-sm" data-go="support">Tümü</button>`)}<div class="list" style="margin-top:8px">${openTickets().filter(t => emp(t.empId)).slice(0, 4).map(t => { const e = emp(t.empId); return `<div class="list-item">${avatar(e, 'sm')}<div class="grow"><b>${esc(e.name)}</b><small>${D.TICKET_TYPES[t.type]} · ${t.ago} önce</small></div></div>`; }).join('')}</div></section>
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
        const e = emp(a.empId);
        if (!e) return '';
        const tone = { HIGH: 'bad', MED: 'warn', LOW: 'mute' }[a.sev], sl = { HIGH: 'Yüksek', MED: 'Orta', LOW: 'Düşük' }[a.sev];
        return `<div class="list-item"><span class="ico-sq ${a.sev === 'HIGH' ? 'red' : a.sev === 'MED' ? 'warn' : ''}">${ic(a.type === 'MOCK_GPS' || a.type === 'GEOFENCE' ? 'pin' : a.type === 'DEVICE' ? 'phone' : a.type === 'BRUTE' ? 'lock' : 'shield')}</span><div class="grow"><b>${D.ALERT_TYPES[a.type]}</b><small>${esc(e.name)} · ${esc(brName(a.branch))} · ${a.ago} önce</small></div>${pill(sl, tone)}</div>`;
    }

    IT.support = {
        title: 'Destek & parola yönetimi', sub: () => 'Parola, kilit ve cihaz talepleri', tools: {}, icon: 'key',
        render() {
            const u = S.ui.tk, cnt = s => D.TICKETS.filter(t => t.status === s).length, q = u.q.toLocaleLowerCase('tr-TR').trim();
            const L = D.TICKETS.filter(t => (u.f === 'all' || t.status === u.f) && (u.type === 'ALL' || t.type === u.type) && emp(t.empId) && (!q || (emp(t.empId).name + emp(t.empId).sicil).toLocaleLowerCase('tr-TR').includes(q)));
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
            const L = base.filter(a => (u.sev === 'ALL' || a.sev === u.sev) && (u.type === 'ALL' || a.type === u.type) && emp(a.empId)), c = s => base.filter(a => a.sev === s).length;
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
            const L = D.DEVICES.filter(d => emp(d.empId) && (u.status === 'ALL' || d.status === u.status) && (u.ver === 'ALL' || d.ver === u.ver) && (!q || (emp(d.empId).name + emp(d.empId).sicil + d.model).toLocaleLowerCase('tr-TR').includes(q))).slice(0, 60);
            const tone = { BOUND: ['Eşlendi', 'ok'], PENDING: ['Sıfırlandı · bekliyor', 'info'], BLOCKED: ['Engelli', 'bad'] };
            return `<section class="card flush"><div class="toolbar">${searchEl('dv-q', u.q, 'Personel, sicil veya model')}<span class="grow"></span>
                ${selectEl('dv-status', [{ v: 'ALL', l: 'Tüm durumlar' }, { v: 'BOUND', l: 'Eşlendi' }, { v: 'PENDING', l: 'Sıfırlandı' }, { v: 'BLOCKED', l: 'Engelli' }], u.status, 'Durum')}
                ${selectEl('dv-ver', [{ v: 'ALL', l: 'Tüm sürümler' }, { v: '2.4.1', l: 'v2.4.1' }, { v: '2.3.8', l: 'v2.3.8' }, { v: '2.2.0', l: 'v2.2.0' }], u.ver, 'Sürüm')}</div>
                <div class="table-wrap"><table><thead><tr><th>Cihaz</th><th>Personel</th><th>Sürüm</th><th>Son görülme</th><th>Durum</th><th></th></tr></thead><tbody>${L.length ? L.map((d, i) => { const e = emp(d.empId), t = tone[d.status]; return `<tr style="--r:${i}"><td><div class="cell-user"><span class="ico-sq">${ic('phone')}</span><div><b>${esc(d.model)}</b><small>${d.os} · <span class="mono">${d.mask}</span></small></div></div></td><td><b style="font-weight:600">${esc(e.name)}</b> <small class="muted mono">${e.sicil}</small></td><td>${pill('v' + d.ver, d.ver === '2.4.1' ? 'ok' : 'warn')}</td><td class="muted">${d.seen} dk önce</td><td>${pill(t[0], t[1])}</td><td><div class="row-actions">${d.status === 'BOUND' ? `<button class="btn btn-soft btn-sm" data-act="dv-unbind" data-id="${d.id}">${ic('unlink')}Eşlemeyi sıfırla</button>` : d.status === 'BLOCKED' ? `<button class="btn btn-soft btn-sm" data-act="dv-unblock" data-id="${d.id}">Engeli kaldır</button>` : ''}</div></td></tr>`; }).join('') : `<tr><td colspan="6">${empty('Cihaz bulunamadı')}</td></tr>`}</tbody></table></div></section>`;
        }
    };

    IT.branches = {
        title: 'Şubeler, 30m Geofence & Bağlantısız Wi-Fi BSSID Öğrenme Merkezi', sub: () => 'Türkiye genelindeki ' + D.BRANCHES.length + ' şubenin 30m geofence, pasif Wi-Fi BSSID tarama (ağa bağlanmadan) ve ortak modem keşif merkezi', tools: {}, icon: 'building',
        render() {
            const simB = D.BRANCHES.find(b => b.code === S.ui.simBranch) || D.BRANCHES[0];
            const inside = S.ui.simDist <= simB.radius;
            const q = (S.ui.brQ || '').toLocaleLowerCase('tr-TR').trim();
            const filteredBranches = D.BRANCHES.filter(b => !q || (b.name + ' ' + b.city + ' ' + (b.district || '') + ' ' + (b.address || '') + ' ' + b.code + ' ' + (b.wifiBssid || '') + ' ' + (b.backupWifiBssids || '')).toLocaleLowerCase('tr-TR').includes(q));
            const bbox = `${(simB.lng - 0.0045).toFixed(5)}%2C${(simB.lat - 0.0032).toFixed(5)}%2C${(simB.lng + 0.0045).toFixed(5)}%2C${(simB.lat + 0.0032).toFixed(5)}`;
            const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${simB.lat.toFixed(5)}%2C${simB.lng.toFixed(5)}`;
            const gmapsUrl = (simB.googleMapUrl && simB.googleMapUrl.startsWith('https://')) ? simB.googleMapUrl : `https://www.google.com/maps/search/?api=1&query=${simB.lat},${simB.lng}`;
            const pinOffsetPx = Math.min(72, Math.round((S.ui.simDist / 80) * 72));

            const allDisc = D.WIFI_DISCOVERY || [];
            const discQ = (S.ui.wifiDiscQ || '').toLocaleLowerCase('tr-TR').trim();
            const discFilter = S.ui.wifiDiscFilter || 'UNASSIGNED';
            const filteredDisc = allDisc.filter(c => {
                if (discFilter === 'UNASSIGNED' && c.assignmentStatus !== 'UNASSIGNED') return false;
                if (discFilter === 'ASSIGNED' && c.assignmentStatus === 'UNASSIGNED') return false;
                if (discFilter === 'BRANCH' && c.branchCode !== simB.code) return false;
                if (discQ && !(c.branchName + ' ' + c.branchCode + ' ' + c.city + ' ' + c.bssid + ' ' + c.ssid).toLocaleLowerCase('tr-TR').includes(discQ)) return false;
                return true;
            });
            const unassignedCnt = allDisc.filter(c => c.assignmentStatus === 'UNASSIGNED').length;
            const assignedBranchesCnt = D.BRANCHES.filter(b => b.wifiBssid).length;
            const strictBranchesCnt = D.BRANCHES.filter(b => b.wifiEnforcementMode === 'STRICT').length;
            const simBranchCandidates = allDisc.filter(c => c.branchCode === simB.code);

            return `<div class="grid g-4">
                ${kpi({ label: 'BSSID Tanımlı Şube', val: assignedBranchesCnt, unit: '/ ' + D.BRANCHES.length, icon: 'wifi', tone: assignedBranchesCnt ? 'ok' : 'info', foot: (D.BRANCHES.length - assignedBranchesCnt) + ' şube öğrenme modunda logluyor' })}
                ${kpi({ label: 'Ortak Görülen Aday Modem', val: unassignedCnt, unit: 'BSSID', icon: 'activity', tone: 'warn', foot: 'Aynı şubedeki personellerin ortak gördüğü MAC adresleri' })}
                ${kpi({ label: 'Zorunlu BSSID Koruması', val: strictBranchesCnt, unit: 'şube', icon: 'shield', tone: 'ok', foot: 'Evden Fake GPS ile giriş %100 engellenir' })}
                ${kpi({ label: 'Pasif Tarama (loadWifiList)', val: 100, unit: '%', icon: 'phone', tone: 'info', foot: 'Wi-Fi ağına bağlanmadan · Android 9+ throttling dostu' })}
            </div>

            <section class="card flush mt">
                ${cardHead(
                    'Öğrenme Modu · Aynı Şubedeki Personellerin Ortak Gördüğü Wi-Fi Modemler (Tek Tıkla BSSID Atama Kısayolu)',
                    'Telefonların şirket Wi-Fi ağına bağlanmasına gerek yoktur! Personel giriş yaptıkça telefonun arka planda pasif taradığı (loadWifiList) nearby_wifis listesinden aynı şubede ortak görülen MAC (BSSID) adresleri otomatik tespit edilir. Tek tıkla Ana Şube Modemi veya Yan Dükkan (Yedek) Doğrulayıcı olarak atayabilirsiniz.',
                    `<div style="display:flex;gap:8px;flex-wrap:wrap">
                        <button type="button" class="btn btn-primary btn-sm" data-act="wifi-assign-all-top">${ic('check')} Tüm Şubelerde %100 Ortak Modemleri Tek Tıkla Ata</button>
                    </div>`
                )}
                <div class="toolbar">
                    ${searchEl('wifi-disc-q', S.ui.wifiDiscQ || '', 'Şube adı, BSSID (a4:2b:...) veya modem adı ara...')}
                    ${chips([
                        { v: 'UNASSIGNED', l: 'Atama Bekleyen Ortak Modemler', n: unassignedCnt },
                        { v: 'BRANCH', l: simB.code + ' (' + simB.city + ') Modemleri', n: simBranchCandidates.length },
                        { v: 'ASSIGNED', l: 'Atanmış BSSID\'ler', n: allDisc.length - unassignedCnt },
                        { v: 'ALL', l: 'Tümü', n: allDisc.length }
                    ], discFilter, 'wifi-disc-filter')}
                </div>
                <div class="table-wrap" style="max-height:370px;overflow-y:auto">
                    <table>
                        <thead>
                            <tr>
                                <th>Şube</th>
                                <th>Ortak Görülen Modem MAC (BSSID) & Adı</th>
                                <th>Ortak Görülme Oranı (Personel)</th>
                                <th>Sinyal (RSSI)</th>
                                <th>Durum / Öneri</th>
                                <th>Tek Tıkla Şubeye Atama Kısayolu</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredDisc.slice(0, 45).map((c, idx) => {
                                const sampleNames = (c.employeeSample || []).slice(0, 3).map(e => e.name).join(', ');
                                const extraCnt = Math.max(0, (c.uniqueEmployeeCount || 0) - 3);
                                const statusBadge = c.assignmentStatus === 'PRIMARY'
                                    ? pill('Ana Şube Modemi (Aktif)', 'ok')
                                    : c.assignmentStatus === 'BACKUP'
                                    ? pill('Yedek / Yan Dükkan Modemi', 'info')
                                    : c.recommendedRole === 'PRIMARY'
                                    ? pill('%' + c.commonalityPct + ' Ortak · Ana Modem Adayı', 'warn')
                                    : pill('Yan Dükkan / İkincil Aday', 'mute');
                                return `<tr style="--r:${idx}">
                                    <td>
                                        <b>${esc(c.branchName)}</b>
                                        <small class="muted" style="display:block">${esc(c.city)} · <span class="mono">${esc(c.branchCode)}</span></small>
                                    </td>
                                    <td>
                                        <span class="mono" style="font-weight:700;font-size:12.5px;color:var(--ink)">${esc(c.bssid)}</span>
                                        <small class="muted" style="display:block">${ic('wifi')} ${esc(c.ssid || 'Gizli Kurumsal Ağ')} · ${c.scanHitCount || c.uniqueEmployeeCount} tarama kaydı</small>
                                    </td>
                                    <td>
                                        <div style="display:flex;align-items:center;gap:8px">
                                            <b class="mono" style="color:${c.commonalityPct >= 90 ? 'var(--ok)' : 'var(--ink)'}">${c.uniqueEmployeeCount} / ${c.totalBranchCheckInEmployees} personel (%${c.commonalityPct})</b>
                                        </div>
                                        <small class="muted" style="display:block;font-size:11px">${esc(sampleNames)}${extraCnt > 0 ? ' +' + extraCnt + ' kişi ortak gördü' : ''}</small>
                                    </td>
                                    <td class="mono">
                                        <b>${c.avgRssi} dBm</b>
                                        <small class="muted" style="display:block">zirve ${c.maxRssi} dBm</small>
                                    </td>
                                    <td>${statusBadge}</td>
                                    <td>
                                        <div class="row-actions" style="flex-wrap:wrap">
                                            ${c.assignmentStatus !== 'PRIMARY' ? `<button type="button" class="btn btn-primary btn-sm" data-act="wifi-assign" data-branch="${esc(c.branchCode)}" data-bssid="${esc(c.bssid)}" data-ssid="${esc(c.ssid || '')}" data-role="PRIMARY" title="Bu BSSID'yi şubenin ana modemi olarak ata">${ic('check')} Ana Modem Ata</button>` : ''}
                                            ${c.assignmentStatus !== 'BACKUP' ? `<button type="button" class="btn btn-soft btn-sm" data-act="wifi-assign" data-branch="${esc(c.branchCode)}" data-bssid="${esc(c.bssid)}" data-ssid="${esc(c.ssid || '')}" data-role="BACKUP" title="Şube modemi bozulursa yan dükkan/yedek doğrulayıcı olarak ekle">${ic('plus')} Yedek (Yan Dükkan) Ekle</button>` : ''}
                                            ${c.assignmentStatus !== 'UNASSIGNED' ? `<button type="button" class="btn btn-ghost btn-sm" data-act="wifi-assign" data-branch="${esc(c.branchCode)}" data-bssid="${esc(c.bssid)}" data-role="REMOVE" title="Atamayı kaldır">${ic('x')}</button>` : ''}
                                        </div>
                                    </td>
                                </tr>`;
                            }).join('') || `<tr><td colspan="6">${empty('Aday modem bulunamadı', 'Filtreyi değiştirerek tüm şubelerdeki ortak BSSID kayıtlarını görüntüleyebilirsiniz.')}</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </section>

            <div class="grid g-main mt">
                <section class="card flush">
                    <div class="toolbar">
                        ${searchEl('br-q', S.ui.brQ || '', 'Şube adı, il, ilçe, BSSID veya açık adres ara...')}
                        <div><b>${filteredBranches.length} / ${D.BRANCHES.length} şube</b> <span class="muted">· 30 m + pasif BSSID</span></div>
                        <span class="grow"></span>
                        <button class="btn btn-soft btn-sm" data-act="br-sync-web">${ic('download')}Web'den Şubeleri Güncelle</button>
                        <button class="btn btn-primary btn-sm" data-act="br-add">${ic('plus')}Şube ekle</button>
                    </div>
                    <div class="table-wrap" style="max-height:680px;overflow-y:auto"><table class="br-table"><thead><tr><th>Şube & şehir</th><th>Açık adres & telefon</th><th>Konum, Wi-Fi BSSID & Mod</th><th>Personel</th><th>İşlem</th></tr></thead><tbody>${filteredBranches.map((b, i) => {
                        const isSelected = b.code === simB.code;
                        const backups = b.backupWifiBssids ? b.backupWifiBssids.split(',').map(x => x.trim()).filter(Boolean) : [];
                        const isStrict = b.wifiEnforcementMode === 'STRICT';
                        return `<tr style="--r:${i};${isSelected ? 'background:var(--red-soft)' : ''}">
                            <td class="br-name"><b>${esc(b.name)}</b><small>${esc(b.city)}${b.district ? ' / ' + esc(b.district) : ''} · <span class="mono">${esc(b.code)}</span></small></td>
                            <td><div class="br-addr">${esc(b.address || (b.name + ' · ' + b.city))}</div><small class="mono muted">${esc(b.phone || '0850 222 0 252')}</small></td>
                            <td>
                                <span class="mono br-nowrap">${b.lat.toFixed(4)}, ${b.lng.toFixed(4)}</span>
                                <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">
                                    ${pill(b.radius + ' m sınır', 'ok')}
                                    <button type="button" class="chip ${isStrict ? 'is-active' : ''}" style="height:22px;padding:0 8px;font-size:10.5px" data-act="br-toggle-mode" data-code="${esc(b.code)}" data-mode="${isStrict ? 'LEARNING' : 'STRICT'}" title="Tıklayarak Öğrenme Modu / Zorunlu BSSID Modu arasında geçiş yapın">
                                        ${isStrict ? '🔒 Zorunlu BSSID' : '📡 Öğrenme Modu'}
                                    </button>
                                </div>
                                <small class="mono muted br-wifi">SSID: ${esc(b.wifi)}</small>
                                ${b.wifiBssid
                                    ? `<small class="mono" style="display:block;color:var(--ok);font-weight:700;font-size:11px">Ana BSSID: ${esc(b.wifiBssid)}</small>`
                                    : `<small class="muted" style="display:block;font-size:11px">Ana BSSID: Henüz atanmadı (Öğreniliyor)</small>`}
                                ${backups.length ? `<small class="mono muted" style="display:block;font-size:10.5px">Yedek (${backups.length}): ${esc(backups.join(', '))}</small>` : ''}
                            </td>
                            <td class="mono br-nowrap"><b>${D.EMPLOYEES.filter(e => e.branch === b.code).length}</b> kişi</td>
                            <td><div class="row-actions br-actions">
                                <button type="button" class="btn ${isSelected ? 'btn-primary' : 'btn-soft'} btn-sm btn-icon" data-act="br-map" data-code="${esc(b.code)}" title="Haritada gör" aria-label="${esc(b.name)} haritada gör">${ic('pin')}</button>
                                <button type="button" class="btn btn-soft btn-sm btn-icon" data-act="br-edit" data-code="${esc(b.code)}" title="Düzenle & BSSID ata" aria-label="${esc(b.name)} düzenle">${ic('tool')}</button>
                                <button type="button" class="btn btn-bad btn-sm btn-icon" data-act="br-delete" data-code="${esc(b.code)}" title="Sil" aria-label="${esc(b.name)} sil">${ic('x')}</button>
                            </div></td>
                        </tr>`;
                    }).join('') || `<tr><td colspan="5">${empty('Şube bulunamadı', 'Arama kriterinize uygun şube kaydı bulunmuyor.')}</td></tr>`}</tbody></table></div>
                </section>
                <section class="card">
                    ${cardHead('Şube Haritası & 30m Geofence + BSSID Simülatörü', simB.name + ' (' + simB.city + ') açık adresi, harita konumu ve radyo sinyali doğrulaması')}
                    <div style="display:grid;gap:14px">
                        <div>
                            <small class="muted" style="font-weight:600;display:block;margin-bottom:6px">Haritada İncelenen & Test Edilen Şube (${D.BRANCHES.length} Şube)</small>
                            ${selectEl('sim-branch', D.BRANCHES.map(b => ({ v: b.code, l: b.name, sub: b.city + ' · ' + (b.wifiBssid ? 'BSSID: ' + b.wifiBssid : 'Öğrenme Modu') })), S.ui.simBranch, 'Şube seçin')}
                        </div>
                        <div style="padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:var(--surface-2);display:grid;gap:6px">
                            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                                <b style="font-size:13px;color:var(--ink)">${esc(simB.name)}</b>
                                ${pill(simB.city + (simB.district ? ' / ' + simB.district : ''), 'info')}
                            </div>
                            <div style="font-size:12px;color:var(--ink-2);line-height:1.45">${esc(simB.address || (simB.name + ' · ' + simB.city))}</div>
                            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:4px;font-size:11.5px">
                                <span class="mono muted">Tel: <b>${esc(simB.phone || '0850 222 0 252')}</b> · Koord: <b>${simB.lat.toFixed(4)}, ${simB.lng.toFixed(4)}</b></span>
                                <a href="${esc(gmapsUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-soft btn-sm" style="height:26px;padding:0 10px;font-size:11px;text-decoration:none">${ic('pin')}Google Haritalar'da Aç ↗</a>
                            </div>
                        </div>
                        <div style="position:relative;border-radius:14px;overflow:hidden;border:1px solid var(--line);height:210px;background:var(--surface-2)">
                            <iframe title="${esc(simB.name)} Harita Konumu" src="${osmEmbedUrl}" style="width:100%;height:100%;border:0" loading="lazy"></iframe>
                            <div style="position:absolute;left:10px;bottom:10px;background:rgba(15,17,21,0.84);color:#fff;padding:5px 10px;border-radius:8px;font-size:11px;backdrop-filter:blur(6px)" class="mono">
                                Şube Pin: ${simB.lat.toFixed(4)}, ${simB.lng.toFixed(4)} · 30m Geofence
                            </div>
                        </div>
                        <div style="padding:12px;border-radius:12px;border:1px solid var(--line);background:var(--surface-2);display:flex;align-items:center;gap:14px">
                            <svg role="img" aria-label="Canlı 30 metre geofence konum radarı" viewBox="0 0 180 180" style="width:118px;height:118px;flex-shrink:0;border-radius:50%;background:radial-gradient(circle, rgba(227,6,19,0.10) 0%, rgba(15,23,42,0.06) 100%);border:1px solid var(--line)">
                                <circle cx="90" cy="90" r="76" fill="none" stroke="var(--line)" stroke-dasharray="3 3" />
                                <circle cx="90" cy="90" r="34" fill="${inside ? 'rgba(16,185,129,0.14)' : 'rgba(227,6,19,0.12)'}" stroke="${inside ? 'var(--ok)' : 'var(--red)'}" stroke-width="2" stroke-dasharray="4 2" />
                                <line x1="90" y1="90" x2="${90 + pinOffsetPx}" y2="90" stroke="${inside ? 'var(--ok)' : 'var(--bad)'}" stroke-width="2" />
                                <circle cx="90" cy="90" r="6" fill="var(--red)" />
                                <circle cx="${90 + pinOffsetPx}" cy="90" r="6" fill="${inside ? 'var(--ok)' : 'var(--bad)'}" stroke="#fff" stroke-width="2" />
                                <text x="90" y="108" text-anchor="middle" font-size="9" font-weight="700" fill="var(--ink)">ŞUBE (0m)</text>
                                <text x="90" y="50" text-anchor="middle" font-size="8.5" font-weight="700" fill="${inside ? 'var(--ok)' : 'var(--red)'}">30m Sınır</text>
                            </svg>
                            <div style="flex:1;min-width:0">
                                <div style="font-size:12.5px;font-weight:700;color:var(--ink);margin-bottom:4px">Canlı Şube & Personel Konum Radarı</div>
                                <div style="font-size:11.5px;color:var(--muted);line-height:1.4">Merkezdeki kırmızı nokta <b>${esc(simB.name)}</b> konumunu, hareketli nokta ise personelin şubeye olan <b>${S.ui.simDist} m</b> mesafesini gösterir.</div>
                            </div>
                        </div>
                        <div class="net-meter">
                            <div class="net-meter-top">
                                <span>Şube Merkezine Mesafe: <b class="mono">${S.ui.simDist} metre</b></span>
                                ${pill(inside ? '30m Alan İçinde (Onaylı)' : 'Alan Dışı (Engellendi)', inside ? 'ok' : 'bad')}
                            </div>
                            <input type="range" min="1" max="80" value="${S.ui.simDist}" data-bind="sim-dist" aria-label="Şube merkezine mesafe (metre)" style="width:100%;accent-color:var(--red);cursor:pointer">
                            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted)" class="mono">
                                <span>0m (Şube Merkezi)</span><span>30m (Geofence Sınırı)</span><span>80m (Dış Alan)</span>
                            </div>
                        </div>
                        <div class="kv">
                            <div><small>Ana Modem BSSID</small><b class="mono">${esc(simB.wifiBssid || 'Öğrenme Modunda')}</b></div>
                            <div><small>Yedek (Yan Dükkan) BSSID</small><b class="mono">${esc(simB.backupWifiBssids || 'Tanımlı değil')}</b></div>
                        </div>
                        ${simBranchCandidates.length ? `<div style="padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:var(--surface-2)">
                            <small class="muted" style="display:block;font-weight:700;margin-bottom:6px">${esc(simB.name)} İçin Personellerde Ortak Görülen Modemler</small>
                            <div style="display:grid;gap:6px">
                                ${simBranchCandidates.slice(0, 3).map(c => `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px">
                                    <div><span class="mono" style="font-weight:700">${esc(c.bssid)}</span> <span class="muted">(${esc(c.ssid)} · %${c.commonalityPct} ortak · ${c.avgRssi} dBm)</span></div>
                                    <div style="display:flex;gap:4px">
                                        ${c.assignmentStatus !== 'PRIMARY' ? `<button type="button" class="btn btn-primary btn-sm" style="height:24px;padding:0 8px;font-size:11px" data-act="wifi-assign" data-branch="${esc(c.branchCode)}" data-bssid="${esc(c.bssid)}" data-ssid="${esc(c.ssid || '')}" data-role="PRIMARY">Ana Yap</button>` : pill('Ana Modem', 'ok')}
                                        ${c.assignmentStatus !== 'BACKUP' && c.assignmentStatus !== 'PRIMARY' ? `<button type="button" class="btn btn-soft btn-sm" style="height:24px;padding:0 8px;font-size:11px" data-act="wifi-assign" data-branch="${esc(c.branchCode)}" data-bssid="${esc(c.bssid)}" data-ssid="${esc(c.ssid || '')}" data-role="BACKUP">Yedek Yap</button>` : ''}
                                    </div>
                                </div>`).join('')}
                            </div>
                        </div>` : ''}
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
                                <div>${selectEl('adm-branch', [{ v: 'ALL', l: `Tüm Şubeler (${D.BRANCHES.length} Lokasyon)` }].concat(D.BRANCHES.map(b => ({ v: b.code, l: b.name, sub: b.city }))), u.branch, 'Şube kapsamı')}</div>
                            </label>

                            <div>
                                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                                    <span style="font-size:12px;font-weight:700;color:var(--muted)">2. Modül ve İşlem Yetkilerini Seçin (${u.role === 'HR' ? 'İK Yetki Paketi' : 'BT Yetki Paketi'})</span>
                                    <small class="mono muted">${u.perms.length} / ${availPerms.length} yetki seçili</small>
                                </div>
                                <div class="list" style="border:1px solid var(--line);border-radius:12px;overflow:hidden">
                                    ${availPerms.map(pm => {
                                        const checked = u.perms.includes(pm.k);
                                        return `<div class="list-item clickable" style="padding:10px 14px;background:${checked ? 'var(--surface)' : 'var(--bg)'}" data-act="adm-perm-toggle" data-k="${esc(pm.k)}" tabindex="0" role="button" aria-pressed="${checked}">
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

    /* =========================================================================
       VARDİYA & CANLI AKIŞ — PostgreSQL 18 + Prisma + SSE tek ekran
       (Eski sağ alt yüzen LiveRealtimeHub çekmecesinin sol menüye taşınmış hâli)
       ========================================================================= */
    async function postJson(url, payload, method) {
        const res = await fetch(url, {
            method: method || 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload)
        });
        let json = null;
        try { json = await res.json(); } catch (_) { }
        if (!res.ok) throw new Error((json && json.message) || 'İşlem başarısız (HTTP ' + res.status + ')');
        return json || {};
    }
    /* Vardiya şablonu atama kapsamını formdan okur (none → atama değiştirilmez) */
    function buildShiftAssignment() {
        const u = S.ui.shifts;
        const scope = u.asgScope || 'none';
        if (scope === 'none') return undefined;
        if (scope === 'all') return { scope: 'all', branchCodes: [], employeeIds: [] };
        if (scope === 'branches') {
            const el = document.getElementById('shAsgBranches');
            const codes = el ? Array.from(el.options).filter(o => o.selected).map(o => o.value) : [];
            if (!codes.length) throw new Error('Atama için en az bir şube seçin.');
            return { scope: 'branches', branchCodes: codes, employeeIds: [] };
        }
        const el = document.getElementById('shAsgEmps');
        const ids = el ? Array.from(el.options).filter(o => o.selected).map(o => +o.value).filter(Boolean) : [];
        if (!ids.length) throw new Error('Atama için en az bir personel seçin.');
        return { scope: 'employees', branchCodes: [], employeeIds: ids };
    }
    const onShiftsPage = () => !!(S.user && S.page === 'shifts' && PAGES[S.user.role] && PAGES[S.user.role].shifts);
    let shiftsSyncDrawAt = 0;
    function scheduleShiftsSyncDraw(ev) {
        const now = Date.now();
        if (now - shiftsSyncDrawAt < 250) return;
        shiftsSyncDrawAt = now;
        if (!S.user) return;
        renderBranchMenu();
        buildNav();
        const active = document.activeElement;
        const isTypingInPage = active && active.closest && active.closest('#page') && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA');
        if (ev && ev.detail && ev.detail.background && isTypingInPage) return;
        draw(false);
    }
    // SSE açılamazsa (proxy/tarayıcı tamponu) veri 20 sn'de bir sessizce tazelenir.
    let livePollTimer = null;
    function ensureLivePolling() {
        if (livePollTimer) return;
        livePollTimer = setInterval(() => {
            if (S.user && !document.hidden && D.SYNC.sse !== 'open' && !D.SYNC.inFlight) {
                D.syncAllFromPostgres({ force: true });
            }
        }, 20000);
    }
    const syncGuard = fn => (...args) => {
        const out = fn(...args);
        if (out && typeof out.then === 'function') out.catch(err => A.toast(String(err && err.message || err), 'err'));
        return out;
    };

    function shiftsPage(roleKey) {
        const perspective = roleKey === 'IT' ? 'BT güvenlik perspektifi' : 'İK yönetim perspektifi';
        return {
            title: 'Vardiya & canlı akış',
            sub: () => 'PostgreSQL 18 + Prisma + SSE · ' + perspective + (D.SYNC && D.SYNC.lastSync ? ' · son eşitleme ' + new Date(D.SYNC.lastSync).toLocaleTimeString('tr-TR') : ' · canlı veri bekleniyor'),
            tools: { branch: 1 },
            icon: 'activity',
            render() {
                const E = emps(), st = stats(), allLogs = D.ACCESS_LOGS || [], shifts = D.SHIFTS || [], sync = D.SYNC || {};
                const logs = S.branch === 'ALL' ? allLogs : allLogs.filter(l => l.branch === S.branch);
                const branchLeaves = D.LEAVES.filter(l => S.branch === 'ALL' || (emp(l.empId) && emp(l.empId).branch === S.branch));
                const u = S.ui.shifts;
                const present = st.attended;
                const late = st.late;
                const leave = st.leave;
                const pending = branchLeaves.filter(l => l.status === 'pending');
                const hourly = branchLeaves.filter(l => l.isHourly).length;
                const latestDate = logs.reduce((m, l) => (l.dateIstanbul && l.dateIstanbul > m ? l.dateIstanbul : m), '');
                const sseTone = sync.sse === 'open' ? 'ok' : sync.sse === 'retry' ? 'warn' : sync.sse === 'connecting' ? 'info' : 'mute';
                const sseLabel = sync.sse === 'open' ? 'SSE canlı' : sync.sse === 'retry' ? 'SSE yeniden bağlanıyor' : sync.sse === 'connecting' ? 'SSE bağlanıyor…' : 'SSE bekliyor';
                const fb = u.feedback;
                const empOptions = sel => E.slice().sort((a, b) => a.sicil.localeCompare(b.sicil, 'tr'))
                    .map(e => `<option value="${e.id}"${+sel === e.id ? ' selected' : ''}>${esc(e.sicil)} · ${esc(e.name)} (${esc(e.dept)} · ${esc(e.branch)})</option>`).join('');
                const selEmp = u.empId || (E[0] && E[0].id) || '';
                const EVENT_LABEL = { CHECK_IN: 'Sabah giriş', LUNCH_OUT: 'Öğle çıkış', LUNCH_IN: 'Öğle dönüş', BREAK_OUT: 'Mola çıkış', BREAK_IN: 'Mola dönüş', CHECK_OUT: 'Akşam çıkış' };
    /* Konum/Wi-Fi doğrulama kaynakları. Kart ve QR okuyucu desteği sistemden kaldırıldı;
       eski kayıtlarda kalan diğer değerler "Konum doğrulama" olarak gösterilir. */
    const sourceLabel = s => {
        switch (s) {
            case 'MOBILE_GEOFENCE': return 'Mobil konum (GPS)';
            case 'WEB_MANUAL': return 'İK manuel';
            case 'WIFI': return 'Kurumsal Wi-Fi';
            default: return 'Konum doğrulama';
        }
    };
    const liveEvents = (sync.events || []).slice(0, 12);
                const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });

                return `<div class="grid g-4">
                    ${kpi({ label: 'Şu an içeride / katılım', val: present, unit: 'personel', icon: 'check', tone: 'ok', foot: st.onTime + ' zamanında · ' + E.length + ' aktif kadro' })}
                    ${kpi({ label: 'Geç kalan / devamsız', val: late, unit: 'kişi', icon: 'clock', tone: 'warn', foot: 'ort. ' + Math.round(st.avgLate) + ' dk gecikme · ' + st.absent + ' devamsız' })}
                    ${kpi({ label: 'İzinli / raporlu', val: leave, unit: 'kişi', icon: 'calendar', tone: 'info', foot: hourly + ' saatlik izin kaydı' })}
                    ${kpi({ label: 'Gün içi ham geçiş', val: (S.branch === 'ALL' ? (sync.accessLogTotal || logs.length) : logs.length), unit: 'AccessLog', icon: 'activity', tone: '', foot: (latestDate ? trShort(latestDate) : 'kayıt yok') + ' · son 120 kayıt yüklü' })}
                </div>

                <div class="shifts-head mt">
                    <div class="shifts-meta">
                        <span class="pill ${sseTone}" id="shSsePill">${sseLabel}</span>
                        <span class="pill ${sync.ok ? 'ok' : sync.error ? 'bad' : 'mute'}">${sync.ok ? 'PostgreSQL 18 · Prisma bağlı' : sync.error ? 'Bağlantı hatası' : 'Veri bekleniyor'}</span>
                        ${sync.error ? `<span class="muted" style="font-size:11.5px">${esc(sync.error)}</span>` : ''}
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                        <button type="button" class="btn btn-soft btn-sm" data-act="shifts-refresh">${ic('refresh')} Verileri Yenile</button>
                        ${dlBtn('export-it', 'Geçiş Kayıtları (.xlsx)', { cls: 'btn-dark btn-sm' })}
                    </div>
                </div>

                ${fb ? `<div class="shifts-feedback ${fb.tone}" role="status">${ic(fb.tone === 'ok' ? 'check' : 'alert')}<span>${esc(fb.text)}</span></div>` : ''}

                <div class="grid g-main mt">
                    <section class="card">
                        ${cardHead('Canlı konum, GPS sapma (accuracy) ve pasif Wi-Fi BSSID geçiş testi', 'Taze konum (maximumAge: 0) + küsuratlı GPS sapma kontrolü + bağlantısız Wi-Fi BSSID tarama (loadWifiList)')}
                        <div class="shift-form">
                            <label class="field"><span>Personel</span><div class="input"><select id="shEmp">${empOptions(selEmp)}</select></div></label>
                            <div class="shift-form-row">
                                <label class="field"><span>Geçiş hareketi</span><div class="input"><select id="shEvent">
                                    ${Object.keys(EVENT_LABEL).map(k => `<option value="${k}"${u.event === k ? ' selected' : ''}>${EVENT_LABEL[k]} (${k})</option>`).join('')}
                                </select></div></label>
                                <label class="field"><span>Okuma kaynağı</span><div class="input"><select id="shSource">
                                    <option value="MOBILE_GEOFENCE"${u.source === 'MOBILE_GEOFENCE' ? ' selected' : ''}>Mobil konum + pasif Wi-Fi BSSID</option>
                                    <option value="WEB_MANUAL"${u.source === 'WEB_MANUAL' ? ' selected' : ''}>İK manuel kayıt</option>
                                </select></div></label>
                            </div>
                            <div class="shift-form-row">
                                <label class="field"><span>İşlem saati (GMT+3)</span><div class="input"><input id="shClock" type="time" value="${esc(u.clock)}"></div></label>
                                <label class="field"><span>Şube mesafesi: <b id="shDistOut">${u.dist} m</b> (sınır 30 m)</span><input id="shDist" type="range" min="1" max="95" step="0.5" value="${u.dist}"></label>
                            </div>
                            <div class="shift-form-row">
                                <label class="field"><span>GPS Sapma (Accuracy m) · <small class="muted">Gerçek: 3.4521 / Sahte: 1.0</small></span>
                                    <div class="input"><input id="shAccuracy" value="${esc(u.accuracy || '3.4521')}" placeholder="3.4521 (Sabit 1.0 veya 5.0 engellenir)"></div>
                                </label>
                                <label class="field"><span>Pasif Wi-Fi BSSID Tarama (loadWifiList)</span>
                                    <div class="input"><select id="shWifiMode">
                                        <option value="MATCH_PRIMARY"${u.wifiScanMode === 'MATCH_PRIMARY' ? ' selected' : ''}>Şube modemi etrafta görülsün (BSSID + RSSI)</option>
                                        <option value="MATCH_BACKUP"${u.wifiScanMode === 'MATCH_BACKUP' ? ' selected' : ''}>Yan dükkan / yedek modem görülsün</option>
                                        <option value="HOME_NO_MATCH"${u.wifiScanMode === 'HOME_NO_MATCH' ? ' selected' : ''}>Evden Fake GPS (Şube BSSID etrafta yok)</option>
                                    </select></div>
                                </label>
                            </div>
                            <label class="shift-check"><input id="shMock" type="checkbox"${u.mock ? ' checked' : ''}> <span><b>location.mocked === true (Sahte GPS / Geliştirici Seçenekleri)</b> simülasyonu · anında blokaj</span></label>
                            <button type="button" class="btn btn-primary btn-block" data-act="shifts-sim">${ic('activity')} Geçişi Gönder (Taze GPS + BSSID Paketi)</button>
                        </div>
                    </section>

                    <section class="card">
                        ${cardHead('Canlı SSE bildirim akışı', 'Sayfa yenilenmeden düşen son olaylar', `<span class="pill ${sseTone}">${liveEvents.length} olay</span>`)}
                        <div class="live-feed">
                            ${liveEvents.length ? liveEvents.map(ev => `<div class="live-item ${esc(ev.severity || 'info')}">
                                <span class="live-dot"></span>
                                <div class="grow"><b>${esc(ev.title || 'PDKS olayı')}</b><small>${esc(ev.message || '')}</small></div>
                                <span class="mono muted" style="font-size:11px">${esc(new Date(ev.timestampUtc).toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' }))}</span>
                            </div>`).join('') : `<div class="empty" style="padding:34px 12px"><b>Henüz canlı olay yok</b>Soldaki testten bir giriş/çıkış tetikleyin; sayfa yenilenmeden buraya düşer.</div>`}
                        </div>
                    </section>
                </div>

                <div class="grid g-main mt">
                    <section class="card flush">
                        ${cardHead('Gün içi ham geçiş kayıtları (access_logs)', 'İlk giriş checkIn, son çıkış checkOut olarak işlenir · ' + (sync.accessLogTotal || logs.length) + ' kayıt (son 120 yüklü)', '')}
                        <div class="table-wrap">
                            <table>
                                <thead><tr><th>Personel</th><th>Hareket</th><th>Kaynak & BSSID</th><th>Mesafe & Sapma</th><th>TR saati (GMT+3)</th></tr></thead>
                                <tbody>${logs.slice(0, 40).map(log => {
                                    const wStat = log.wifiStatus === 'VERIFIED_PRIMARY'
                                        ? pill('BSSID Doğrulandı', 'ok')
                                        : log.wifiStatus === 'VERIFIED_BACKUP'
                                        ? pill('Yedek BSSID', 'info')
                                        : log.nearbyWifis && log.nearbyWifis.length
                                        ? pill(log.nearbyWifis.length + ' modem loglandı', 'mute')
                                        : '';
                                    return `<tr>
                                    <td><b>${esc(log.name)}</b><div class="muted" style="font-size:11px">${esc(log.sicil)} · ${esc(log.dept)} · ${esc(log.branch)}</div></td>
                                    <td>${pill(EVENT_LABEL[log.eventType] || log.eventType, log.eventType === 'CHECK_IN' ? 'ok' : log.eventType === 'CHECK_OUT' ? 'info' : 'mute')}</td>
                                    <td class="mono" style="font-size:11.5px">${esc(sourceLabel(log.source))} ${wStat}${log.matchedBssid ? `<div class="muted" style="font-size:10.5px">${esc(log.matchedBssid)}</div>` : ''}</td>
                                    <td class="mono">${(+log.distanceMeters || 0).toFixed(1)} m ${log.accuracyMeters ? `<small class="muted">(±${(+log.accuracyMeters).toFixed(4)}m)</small>` : ''} ${log.isMockGps ? pill('Mock GPS', 'bad') : ''}</td>
                                    <td class="mono">${esc(log.dateIstanbul)} ${esc(log.timeIstanbul)}</td>
                                </tr>`;
                                }).join('') || `<tr><td colspan="5">${empty('Geçiş kaydı yok', 'Simülatörden bir geçiş gönderin.')}</td></tr>`}</tbody>
                            </table>
                        </div>
                    </section>

                    <section class="card">
                        ${cardHead('Vardiya şablonları (shifts)', 'Düzenleyin, silin veya tüm şubelere / şubeye / personellere atayın')}
                        <div class="shift-list">
                            ${shifts.map(s => {
                                const sc = s.startMin != null ? s.startMin : 510;
                                const ec = s.endMin != null ? s.endMin : 1050;
                                const cnt = (D.EMPLOYEES || []).filter(x => +x.shiftId === +s.id).length;
                                return `<div class="shift-item">
                                <div class="grow"><b>${esc(s.name)} ${pill(cnt + ' personel', cnt ? 'info' : 'mute')}</b>
                                    <small>${esc(s.code)} · Hoşgörü ${s.graceMin} dk · Mola ${s.breakMin} dk${s.isFlexible ? ' · Esnek' : ''}</small></div>
                                <span class="pill info mono">${A.pad(Math.floor(sc / 60))}:${A.pad(sc % 60)} – ${A.pad(Math.floor(ec / 60))}:${A.pad(ec % 60)}</span>
                                <div class="row-actions">
                                    <button type="button" class="btn btn-soft btn-sm" data-act="shifts-edit" data-id="${s.id}">${ic('edit')} Düzenle</button>
                                    <button type="button" class="btn btn-soft btn-sm" data-act="shifts-del" data-id="${s.id}" data-name="${esc(s.name)}">${ic('x')} Sil</button>
                                </div>
                            </div>`;
                            }).join('') || empty('Vardiya tanımı yok')}
                        </div>
                        <div class="shift-form mt-sm">
                            <div class="shift-form-head">
                                <b>${u.editId ? 'Vardiya şablonunu düzenle' : 'Yeni vardiya şablonu'}</b>
                                ${u.editId ? `<button type="button" class="btn btn-ghost btn-sm" data-act="shifts-cancel">Vazgeç</button>` : ''}
                            </div>
                            <div class="shift-form-row">
                                <label class="field"><span>Kod</span><div class="input"><input id="shCode" value="${esc(u.shCode)}" placeholder="GECE-01"></div></label>
                                <label class="field"><span>Ad</span><div class="input"><input id="shName" value="${esc(u.shName)}" placeholder="Gece vardiyası"></div></label>
                            </div>
                            <div class="shift-form-row">
                                <label class="field"><span>Başlangıç</span><div class="input"><input id="shStart" type="time" value="${esc(u.shStart)}"></div></label>
                                <label class="field"><span>Bitiş</span><div class="input"><input id="shEnd" type="time" value="${esc(u.shEnd)}"></div></label>
                            </div>
                            <div class="shift-form-row">
                                <label class="field"><span>Tolerans (dk)</span><div class="input"><input id="shGrace" type="number" min="0" max="60" value="${u.shGrace}"></div></label>
                                <label class="field"><span>Mola (dk)</span><div class="input"><input id="shBreak" type="number" min="0" max="180" value="${u.shBreak}"></div></label>
                            </div>

                            <div class="shift-assign">
                                <label class="field"><span>Atama kapsamı</span><div class="input"><select id="shAsgScope" data-bind="shifts-scope">
                                    <option value="none"${u.asgScope === 'none' ? ' selected' : ''}>Atama yapma (mevcut atamalar korunur)</option>
                                    <option value="all"${u.asgScope === 'all' ? ' selected' : ''}>Tüm şubelerdeki tüm personel</option>
                                    <option value="branches"${u.asgScope === 'branches' ? ' selected' : ''}>Seçili şubeler</option>
                                    <option value="employees"${u.asgScope === 'employees' ? ' selected' : ''}>Seçili personeller</option>
                                </select></div></label>
                                ${u.asgScope === 'branches' ? `<label class="field"><span>Şubeler (birden fazla seçmek için Ctrl)</span>
                                    <div class="input"><select id="shAsgBranches" multiple size="7">${(D.BRANCHES || []).map(b => `<option value="${esc(b.code)}">${esc(b.code)} · ${esc(b.name)}</option>`).join('')}</select></div>
                                </label>` : ''}
                                ${u.asgScope === 'employees' ? `<label class="field"><span>Personeller (Ctrl ile çoklu seçim)</span>
                                    <div class="input"><select id="shAsgEmps" multiple size="9">${(D.EMPLOYEES || []).filter(x => S.branch === 'ALL' || x.branch === S.branch).slice(0, 200).map(x => `<option value="${x.id}">${esc(x.name)} · ${esc(x.sicil)} · ${esc(x.dept)}</option>`).join('')}</select></div>
                                    <small class="muted">Liste şube filtresine göre daralır (en fazla 200 kayıt).</small>
                                </label>` : ''}
                            </div>

                            <button type="button" class="btn ${u.editId ? 'btn-primary' : 'btn-soft'} btn-block" data-act="${u.editId ? 'shifts-update' : 'shifts-add'}">
                                ${ic(u.editId ? 'check' : 'plus')} ${u.editId ? 'Değişiklikleri kaydet' : 'Vardiya şablonu ekle'}
                            </button>
                        </div>
                    </section>
                </div>

                <div class="grid g-main mt">
                    <section class="card">
                        ${cardHead('Saatlik izin & izin talebi oluştur', 'Saatlik izin onaylandığında personelin günlük gecikme dakikasından otomatik düşer')}
                        <div class="shift-form">
                            <label class="field"><span>Personel</span><div class="input"><select id="shLvEmp">${empOptions(selEmp)}</select></div></label>
                            <div class="shift-form-row">
                                <label class="field"><span>İzin türü</span><div class="input"><select id="shLvType">
                                    ${['Saatlik izin', 'Yıllık izin', 'Mazeret izni', 'Sağlık raporu', 'Saha görevi'].map(t => `<option value="${t}"${u.lvType === t ? ' selected' : ''}>${t}</option>`).join('')}
                                </select></div></label>
                                <label class="field"><span>Tarih</span><div class="input"><input id="shLvDate" type="date" value="${esc(u.lvDate || today)}"></div></label>
                            </div>
                            <div class="shift-form-row">
                                <label class="field"><span>Başlangıç saati</span><div class="input"><input id="shLvStart" type="time" value="${esc(u.lvStart)}"></div></label>
                                <label class="field"><span>Bitiş saati</span><div class="input"><input id="shLvEnd" type="time" value="${esc(u.lvEnd)}"></div></label>
                                <label class="field"><span>Gün (tam gün)</span><div class="input"><input id="shLvDays" type="number" min="1" max="30" value="${u.lvDays}"></div></label>
                            </div>
                            <label class="field"><span>Mazeret / açıklama</span><div class="input"><input id="shLvNote" value="${esc(u.lvNote)}"></div></label>
                            <button type="button" class="btn btn-primary btn-block" data-act="shifts-leave-create">${ic('plus')} İzin talebini PostgreSQL'e kaydet</button>
                        </div>
                    </section>

                    <section class="card flush">
                        ${cardHead('İzin onay akışı', 'Pending → Approved / Rejected · ' + pending.length + ' bekleyen', '')}
                        <div class="list">
                            ${branchLeaves.slice(0, 24).map(l => {
                                const empRow = E.find(e => e.id === l.empId) || emp(l.empId);
                                const tone = l.status === 'approved' ? ['Onaylandı', 'ok'] : l.status === 'rejected' ? ['Reddedildi', 'bad'] : ['Bekliyor', 'warn'];
                                return `<div class="list-item">
                                    <div class="grow">
                                        <b>${esc(empRow ? empRow.name : (l.name || 'Bilinmeyen personel'))} <span class="muted" style="font-weight:500">· ${esc(l.type)}${l.isHourly && l.startClock ? ` · ${esc(l.startClock)}–${esc(l.endClock)}` : ''}</span></b>
                                        <small>${esc(l.from)}${l.reason ? ' · “' + esc(l.reason) + '”' : ''} ${l.code ? '· <span class="mono">' + esc(l.code) + '</span>' : ''}</small>
                                    </div>
                                    ${pill(tone[0], tone[1])}
                                    ${l.status === 'pending' && l.code ? `<div class="row-actions">
                                        <button class="btn btn-ok btn-sm" data-act="shifts-leave-decide" data-code="${esc(l.code)}" data-v="approved">${ic('check')}Onayla</button>
                                        <button class="btn btn-bad btn-sm" data-act="shifts-leave-decide" data-code="${esc(l.code)}" data-v="rejected">${ic('x')}Reddet</button>
                                    </div>` : ''}
                                </div>`;
                            }).join('') || empty('İzin talebi yok')}
                        </div>
                    </section>
                </div>

                <div class="grid g-2 mt">
                    <section class="card">${cardHead('Departman bazlı ek mesai & gecikme', 'PostgreSQL canlı puantaj verisinden toplam dakika')}<div id="shDeptChart"></div></section>
                    <section class="card">${cardHead('Departman aktif katılımı', 'İçeride / geç kalan dağılımı')}<div id="shPresentChart"></div></section>
                </div>`;
            },
            mount() {
                const byDept = new Map();
                emps().forEach(e => {
                    const cur = byDept.get(e.dept) || { dept: String(e.dept || '').replace(' Finansmanı', '').replace(' Finansman', ''), overtimeMin: 0, lateMin: 0, present: 0, late: 0 };
                    cur.overtimeMin += e.overtimeMin || 0;
                    cur.lateMin += e.lateMin || 0;
                    if (e.status === 'PRESENT' || e.status === 'LATE') cur.present++;
                    if (e.status === 'LATE') cur.late++;
                    byDept.set(e.dept, cur);
                });
                const rows = Array.from(byDept.values()).sort((a, b) => (b.overtimeMin + b.lateMin) - (a.overtimeMin + a.lateMin)).slice(0, 8);
                if (rows.length) {
                    A.barChart($('#shDeptChart'), {
                        data: rows.map(r => ({ label: r.dept.split(' ')[0], value: Math.round((r.overtimeMin + r.lateMin) / 60), name: r.dept, ot: r.overtimeMin, late: r.lateMin })),
                        yFmt: v => v + ' sa',
                        tip: d => `<b>${esc(d.name)}</b>Ek mesai: ${fmtMinDur(d.ot)} · Gecikme: ${fmtMinDur(d.late)}`
                    });
                    A.barChart($('#shPresentChart'), {
                        data: rows.map(r => ({ label: r.dept.split(' ')[0], value: r.present, name: r.dept, late: r.late })),
                        color: '#1C1D1F',
                        tip: d => `<b>${esc(d.name)}</b>Aktif: ${d.value} · Geç kalan: ${d.late}`
                    });
                }
                const dist = $('#shDist');
                if (dist) dist.addEventListener('input', () => { const out = $('#shDistOut'); if (out) out.textContent = (+dist.value).toFixed(1) + ' m'; });
            }
        };
    }
    function trShort(iso) {
        const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? `${m[3]}.${m[2]}` : String(iso || '');
    }

    const PAGES = {
        HR: { overview: HR.overview, employees: HR.employees, onboarding: HR.onboarding, leaves: HR.leaves, shifts: shiftsPage('HR'), analytics: HR.analytics, reports: HR.reports, profile: HR.profile },
        IT: { overview: IT.overview, support: IT.support, security: IT.security, devices: IT.devices, shifts: shiftsPage('IT'), branches: IT.branches, audit: IT.audit },
        ADMIN: { overview: ADMIN.overview, permissions: ADMIN.permissions, branches: IT.branches, shifts: shiftsPage('IT'), audit: IT.audit }
    };
    const NAV = {
        HR: [['Genel', ['overview', 'employees', 'onboarding', 'leaves']], ['Operasyon', ['shifts']], ['Analiz', ['analytics', 'reports']]],
        IT: [['İzleme', ['overview', 'security']], ['Operasyon', ['shifts']], ['Yönetim', ['support', 'devices', 'branches', 'audit']]],
        ADMIN: [['Yetkilendirme', ['overview', 'permissions']], ['Operasyon', ['shifts']], ['Sistem Denetimi', ['branches', 'audit']]]
    };
    const NAV_LABEL = {
        overview: 'Genel bakış',
        employees: 'Personel & yoklama',
        onboarding: 'Personel ekle (İşe giriş)',
        leaves: 'İzin talepleri',
        shifts: 'Vardiya & canlı akış',
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
        const items = [{ code: 'ALL', name: 'Tüm şubeler', city: D.BRANCHES.length + ' Lokasyon · Genel Görünüm', cnt: allCnt }].concat(
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
    function skeleton() {
        return '<div class="grid g-4">' + '<div class="sk sk-card"></div>'.repeat(4) + '</div>'
            + '<div class="sk sk-toolbar mt"></div>'
            + '<div class="sk-table mt">' + '<div class="sk sk-row"></div>'.repeat(8) + '</div>';
    }

    /* v2: kartlar artık sabit kimlikle (data-wid) saklanır; eski konum tabanlı düzenler yok sayılır. */
    const dndKey = () => 'atf_dnd2_' + (S.user ? S.user.role : 'HR') + '_' + S.page;

    /* Sayfadaki satır sıralarını (data-gid) sürükle-bırak kaydına yazar; genişlik tercihleri korunur. */
    function wPersistOrder() {
        const key = dndKey();
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (_) { saved = {}; }
        const order = Object.assign({}, saved.order || {});
        $$('#page .grid[data-gid]').forEach(g => {
            order[g.dataset.gid] = Array.from(g.children).filter(c => c.classList.contains('card') && c.dataset.wid).map(c => c.dataset.wid);
        });
        try { localStorage.setItem(key, JSON.stringify(Object.assign({}, saved, { order }))); } catch (_) { }
    }
    function wRefreshPanel(focusSel) {
        const d = $('#drawer');
        if (!d || !d.classList.contains('on') || !d.dataset.wpanel) return;
        $('#drawerBody').innerHTML = wPanelHtml();
        A.hydrate($('#drawerBody'));
        if (focusSel) { const f = $(focusSel); if (f) try { f.focus({ preventScroll: true }); } catch (_) { } }
    }

    function draw(animate) {
        if (!S.user || !PAGES[S.user.role] || !PAGES[S.user.role][S.page]) return;
        if (A.closeCardPopover) A.closeCardPopover(true);
        const p = PAGES[S.user.role][S.page], pg = $('#page'), active = document.activeElement, focusId = active && active.id && pg.contains(active) ? active.id : null, pos = focusId ? active.selectionStart : null;
        $('#pageTitle').textContent = p.title; $('#pageSub').textContent = typeof p.sub === 'function' ? p.sub() : p.sub; document.title = p.title + ' · Albayrak Finans PDKS';
        WREG = [];
        pg.innerHTML = p.render(); pg.classList.toggle('still', !animate);
        Array.from(pg.children).forEach((c, i) => c.style.setProperty('--i', i));
        A.hydrate(pg); if (p.mount) p.mount(); A.enableDragGrid(pg, dndKey()); A.countUp(pg); buildNav(); setTools(p);
        if (S.page === 'profile') mountProfileChart();
        if (focusId) { const el = $('#' + focusId); if (el) { el.focus(); if (pos != null && el.setSelectionRange) try { el.setSelectionRange(pos, pos); } catch (e) { } } }
    }
    function go(id, quiet) {
        if (!S.user || !PAGES[S.user.role]) return;   // oturum kapanmissa sessizce cik
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
        if (!S.user) return;
        const u = S.ui.emp;
        u.openId = (id == null || u.openId === id) ? null : id;
        draw(false);
    }
    /* Tam sayfa profil ekrani — cekmece yerine ayri rota */
    function empProfile(id) {
        if (!S.user || !emp(id)) return;
        if (!PAGES[S.user.role].profile) return;
        S.ui.emp.openId = null;
        closeDrawer();          // closeDrawer S.openEmpId'yi sifirlar -> sonra set et
        S.openEmpId = id;
        try { sessionStorage.setItem('atf_emp', String(id)); } catch (e) { }
        go('profile');
    }

    /* Profil ekranindaki 4 ana interaktif grafik (draw sonrasi cizilir) */
    function mountProfileChart() {
        if (!S.openEmpId) return;
        const an = D.empAnalytics(S.openEmpId, filterOpts());
        const kayitlar = an.logs.slice(-14);
        if (!kayitlar.length) return;

        // 1. Gunluk Calisma Suresi Istikrari (8,5 sa kurumsal hedef cizgisiyle)
        const elWork = $('#prChartWork');
        if (elWork) {
            A.areaChart(elWork, {
                labels: kayitlar.map(x => x.label),
                series: [
                    { data: kayitlar.map(x => x.workH || 0) },
                    { data: kayitlar.map(() => 8.5) }
                ],
                yMin: 0, yMax: 11.5, h: 205, yFmt: v => v + ' sa',
                tip: (i, v) => `<b>${kayitlar[i].fullDate} (${kayitlar[i].dowName})</b>Giriş: ${kayitlar[i].checkIn || '—'} · Çıkış: ${kayitlar[i].checkOut || '—'} · Fiili: ${v[0]} sa · Net: ${fmtMinSigned(kayitlar[i].netMin)}`
            });
        }

        // 2. Donem Yoklama ve Puantaj Dagilimi (Donut Chart)
        const elDonut = $('#prChartDonut');
        if (elDonut) {
            const attRate = an.totalDays ? +((an.attendedDays / an.totalDays) * 100).toFixed(1) : 100;
            A.donut(elDonut, {
                centerTop: '%' + String(attRate).replace('.', ','),
                centerSub: 'devam oranı',
                items: [
                    { label: 'Zamanında Giriş', value: an.presentDays, color: '#0E9F6E' },
                    { label: 'Geç Kalınan Gün', value: an.lateDays, color: '#C77700' },
                    { label: 'İzinli / Raporlu', value: an.leaveDays, color: '#2563EB' },
                    { label: 'Devamsız İş Günü', value: an.absentDays, color: '#C8102E' }
                ]
            });
        }

        // 3. Haftanin Gunlerine Gore (Pzt-Cum) Gecikme (İK'nın ilk baktığı davranış)
        const elWeekday = $('#prChartWeekday');
        if (elWeekday) {
            const wList = an.weekdayList;
            const maxBar = Math.max(30, ...wList.map(w => w.totalLateMin)) + 10;
            A.barChart(elWeekday, {
                data: wList.map(w => ({
                    label: w.dowShort || w.dowName,
                    value: w.totalLateMin,
                    color: '#C77700',
                    raw: w
                })),
                yMax: maxBar, h: 195,
                yFmt: v => v + ' dk',
                aria: 'Haftanın günlerine göre gecikme',
                tip: d => `<b>${d.raw.dowName} (${d.raw.attended} iş günü)</b>Gecikme: −${d.raw.totalLateMin} dk (${d.raw.lateCount} kez) · Ek mesai: +${d.raw.totalOvertimeMin} dk`
            });
        }

        // 4. Sube konum mesafesi — kapalı "Özlük ve cihaz" bölümünde; yalnızca açıkken çizilir
        const det = $('#prDetails');
        if (det) det.addEventListener('toggle', () => {
            S.ui.profDetOpen = det.open;
            if (det.open) drawDist();
        });
        drawDist();
        function drawDist() {
        const elDist = $('#prChartDist');
        if (elDist && !elDist.closest('details:not([open])')) {
            A.areaChart(elDist, {
                labels: kayitlar.map(x => x.label),
                series: [
                    { data: kayitlar.map(x => x.dist != null ? x.dist : 0) },
                    { data: kayitlar.map(() => 30) }
                ],
                yMin: 0, yMax: 35, h: 195, yFmt: v => v + ' m',
                tip: (i, v) => `<b>${kayitlar[i].fullDate} (${kayitlar[i].dowName})</b>Şube Merkezine Mesafe: ${v[0]} m · Geofence Sınırı: 30 m (${v[0] <= 30 ? 'Uygun' : 'Sınır Dışı'})`
            });
        }
        }
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
        const d = $('#drawer');
        // Sadece gercekten acikken kapat; S.openEmpId'yi sifirlama (profil sayfasi kullanir)
        if (!d.classList.contains('on')) return;
        delete d.dataset.wpanel;
        d.classList.remove('on', 'wide');
        d.setAttribute('aria-hidden', 'true');
    }
    function openModal(title, html, foot) {
        $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html; $('#modalFoot').innerHTML = foot || ''; A.hydrate($('#modal'));
        const m = $('#modal'); m.classList.add('on'); m.setAttribute('aria-hidden', 'false'); (m.querySelector('input') || $('#modalClose')).focus();
    }
    function closeModal() { const m = $('#modal'); m.classList.remove('on'); m.setAttribute('aria-hidden', 'true'); }

    /* Şube ekle/düzenle modalı için ortak form (POST / PUT aynı alanları kullanır) */
    function branchFormHtml(b) {
        const v = k => (b && b[k] != null ? b[k] : '');
        const mode = (b && b.wifiEnforcementMode) || 'LEARNING';
        return `<form class="form-grid" id="brForm" novalidate>
            <label class="field"><span>Şube kodu</span><div class="input"><input id="brCode" maxlength="12" value="${esc(v('code'))}" placeholder="ŞB-055"${b ? ' readonly' : ''}></div></label>
            <label class="field"><span>Şube adı</span><div class="input"><input id="brName" maxlength="120" value="${esc(v('name'))}" placeholder="Örn. Antalya Muratpaşa Şubesi"></div></label>
            <div class="grid g-2">
                <label class="field"><span>Şehir</span><div class="input"><input id="brCity" maxlength="60" value="${esc(v('city'))}"></div></label>
                <label class="field"><span>İlçe</span><div class="input"><input id="brDistrict" maxlength="60" value="${esc(v('district'))}"></div></label>
            </div>
            <label class="field"><span>Açık adres</span><div class="input"><input id="brAddress" maxlength="260" value="${esc(v('address'))}" placeholder="Mahalle, cadde, no, ilçe / il"></div></label>
            <div class="grid g-2">
                <label class="field"><span>Telefon</span><div class="input"><input id="brPhone" maxlength="32" value="${esc(v('phone'))}" placeholder="444 88 61"></div></label>
                <label class="field"><span>Kurumsal Wi-Fi etiketi (SSID)</span><div class="input"><input id="brWifi" maxlength="64" value="${esc(v('wifi'))}" placeholder="ALBAYRAK_55_WIFI"></div></label>
            </div>
            <div class="grid g-2">
                <label class="field"><span>Ana Şube Modemi MAC (BSSID)</span><div class="input"><input id="brWifiBssid" maxlength="17" class="mono" value="${esc(v('wifiBssid'))}" placeholder="a4:2b:8c:1d:e5:9f (boşsa öğrenir)"></div></label>
                <label class="field"><span>Pasif Wi-Fi Doğrulama Modu</span><div class="input"><select id="brWifiMode">
                    <option value="LEARNING"${mode === 'LEARNING' ? ' selected' : ''}>Öğrenme Modu (Logla · Engelleme)</option>
                    <option value="STRICT"${mode === 'STRICT' ? ' selected' : ''}>Zorunlu BSSID Modu (Modem yoksa engelle)</option>
                </select></div></label>
            </div>
            <label class="field"><span>Yedek / Yan Dükkan Modem MAC Adresleri (virgülle ayırın)</span><div class="input"><input id="brBackupBssids" maxlength="160" class="mono" value="${esc(v('backupWifiBssids'))}" placeholder="c8:3a:35:91:02:11, d4:6e:0e:44:12:89"></div></label>
            <div class="grid g-2">
                <label class="field"><span>Enlem</span><div class="input"><input id="brLat" inputmode="decimal" value="${esc(v('lat'))}" placeholder="36.8841"></div></label>
                <label class="field"><span>Boylam</span><div class="input"><input id="brLng" inputmode="decimal" value="${esc(v('lng'))}" placeholder="30.7056"></div></label>
            </div>
            <div class="grid g-2">
                <label class="field"><span>Yarıçap (m)</span><div class="input"><input id="brRad" inputmode="numeric" value="${esc(v('radius') || 30)}"></div></label>
                <label class="field"><span>Google Haritalar bağlantısı</span><div class="input"><input id="brMap" maxlength="300" value="${esc(v('googleMapUrl'))}" placeholder="https://maps.app.goo.gl/..."></div></label>
            </div>
            <p class="form-error" id="brErr" hidden></p>
        </form>`;
    }
    function branchFormValues() {
        const v = id => { const n = $('#' + id); return n ? n.value.trim() : ''; };
        return {
            code: v('brCode').toUpperCase(),
            name: v('brName'),
            city: v('brCity'),
            district: v('brDistrict'),
            address: v('brAddress'),
            phone: v('brPhone') || '444 88 61',
            lat: parseFloat(v('brLat').replace(',', '.')),
            lng: parseFloat(v('brLng').replace(',', '.')),
            radius: parseInt(v('brRad'), 10),
            wifi: v('brWifi'),
            wifiBssid: v('brWifiBssid').toLowerCase(),
            backupWifiBssids: v('brBackupBssids').toLowerCase(),
            wifiEnforcementMode: v('brWifiMode') || 'LEARNING',
            googleMapUrl: v('brMap')
        };
    }
    function branchFormError(d) {
        if (!d.name || d.name.length < 3) return 'Şube adı en az 3 karakter olmalı.';
        if (!d.city || d.city.length < 2) return 'Şehir gerekli.';
        if (!(d.lat >= -90 && d.lat <= 90)) return 'Enlem −90 ile 90 arasında olmalı.';
        if (!(d.lng >= -180 && d.lng <= 180)) return 'Boylam −180 ile 180 arasında olmalı.';
        if (!(d.radius >= 10 && d.radius <= 200)) return 'Yarıçap 10–200 m arasında olmalı.';
        if (!d.wifi || d.wifi.length < 3) return 'Kurumsal Wi-Fi ağı en az 3 karakter olmalı.';
        if (d.wifiBssid && !/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(d.wifiBssid)) return 'Ana modem MAC (BSSID) formatı a4:2b:8c:1d:e5:9f şeklinde olmalı.';
        if (d.code && !/^[A-Z0-9ÇĞİÖŞÜ-]{2,12}$/.test(d.code)) return 'Şube kodu 2–12 karakter olmalı (örn. ŞB-055).';
        if (d.googleMapUrl && !d.googleMapUrl.startsWith('https://')) return 'Harita bağlantısı https:// ile başlamalı.';
        return '';
    }
    function showBranchError(msg) {
        const err = $('#brErr');
        if (err) { err.textContent = msg; err.hidden = false; }
        else A.toast(msg, 'err');
    }
    function nextBranchCode() {
        const max = D.BRANCHES.reduce((m, b) => {
            const n = (String(b.code).match(/(\d+)$/) || [])[1];
            return Math.max(m, n ? +n : 0);
        }, 0);
        return 'ŞB-' + String(max + 1).padStart(3, '0');
    }
    async function refreshBranches() {
        const synced = await D.syncAllFromPostgres({ force: true });
        if (!synced) draw(false);
    }

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

    /* ======================= McKinsey / Big-4 Ortak Kurumsal Rapor Modeli & Excel/Print Üreticileri ======================= */
    function buildExecutiveReportModel(reportId) {
        const st = stats(), ds = deptStats(), d = activeDays();
        const E = emps(), lb = D.computeLeaderboards(E, filterOpts());
        const subeAdi = S.branch === 'ALL' ? `Tüm Şubeler (${D.BRANCHES.length} Lokasyon)` : brName(S.branch);
        const hazirlayan = S.user ? (S.user.name + ' — ' + S.user.title) : 'İnsan Kaynakları Yönetimi';
        const periodStr = rangeLabel();
        const dateIso = new Date().toISOString().slice(0, 10);

        if (reportId === 'emps') {
            const list = filteredEmps();
            const gapPts = +(st.onTimePct - 95).toFixed(1);
            const lowestDept = ds.slice().sort((a, b) => a.pct - b.pct)[0] || { d: 'Operasyon', pct: 90 };
            const otMin = Math.round(st.totalOvertimeH * 60);
            const lateMin = Math.round(st.totalLateMin);
            const netMin = st.netBalanceMin;
            return {
                fileName: 'Albayrak_PDKS_Puantaj_Raporu_' + dateIso,
                title: 'KURUMSAL PERSONEL PUANTAJ, EK MESAİ VE NET BAKİYE RAPORU',
                subtitle: `Dönem: ${periodStr} · Gecikme, Ek Mesai, Net Süre Bakiyesi ve 30m Şube Geofence Tablosu`,
                period: periodStr,
                scope: subeAdi,
                actionTitle: `Zamanında katılım oranı %${A.pctText(st.onTimePct)} ile kurumsal %95,0 hedefinin ${gapPts >= 0 ? A.pctText(gapPts) + ' puan üzerinde' : A.pctText(Math.abs(gapPts)) + ' puan altında'} gerçekleşmiş; dönem sonunda ${fmtMinSigned(netMin)} net süre bakiyesi oluşmuştur.`,
                scqa: [
                    ['DURUM (SITUATION)', `${subeAdi} kapsamında aktif ${st.N} personel ve ${d.length} iş günü üzerinden PostgreSQL 18 canlı puantaj verileri konsolide edilmiştir.`],
                    ['KARMAŞIKLIK (COMPLICATION)', `Dönem içinde ${st.late} personelde toplam ${fmtMinDur(lateMin)} gecikme oluşmuş; en düşük uyum oranı %${A.pctText(lowestDept.pct)} ile ${lowestDept.d} biriminde gözlenmiştir.`],
                    ['ANA BULGU (KEY FINDING)', `Toplam +${A.numText(st.totalOvertimeH)} saat onaylı ek mesai, gecikme kayıplarını telafi ederek kurum net süre bakiyesini ${fmtMinSigned(netMin)} seviyesinde tutmuştur.`],
                    ['ÖNERİLEN AKSİYON', `${lowestDept.d} biriminde vardiya giriş disiplini gözden geçirilmeli ve tekrarlayan gecikmeler için saatlik izin/vardiya esnekliği denetlenmelidir.`]
                ],
                meta: [
                    ['Tarih / Dönem Filtresi', periodStr],
                    ['Şube Kapsamı', subeAdi],
                    ['Hazırlayan Yetkili', hazirlayan]
                ],
                kpis: [
                    { label: 'Toplam Aktif Personel', value: String(st.N), target: `${D.BRANCHES.length} şube aktif kadro`, color: '#0B7A53' },
                    { label: 'Zamanında Giriş Oranı', value: '%' + A.pctText(st.onTimePct), target: 'Kurumsal Hedef: %95,0', color: st.onTimePct >= 95 ? '#0B7A53' : '#B4690E' },
                    { label: 'Toplam Gecikme Süresi', value: lateMin + ' dk', target: `${st.late} personel · Ort. ${Math.round(st.avgLate)} dk`, color: '#C8191E' },
                    { label: 'Toplam Onaylı Ek Mesai', value: A.numText(st.totalOvertimeH) + ' sa', target: `${otMin} dk fazla çalışma`, color: '#0B7A53' },
                    { label: 'Kurumsal Net Süre Bakiyesi', value: (netMin >= 0 ? '+' : '') + netMin + ' dk', target: 'Hedef: ≥ 0 dk (Pozitif Denge)', color: netMin >= 0 ? '#0B7A53' : '#C8191E' },
                    { label: '30m Geofence Doğrulama', value: '%' + A.pctText(st.geofencePct), target: 'Hedef: %100 (Haversine ≤ 30m)', color: '#0B7A53' }
                ],
                exhibits: [
                    {
                        figNo: 'SERGİ 1 · BİRİM UYUM KARŞILAŞTIRMASI',
                        title: 'Departman bazında zamanında katılım oranı ve %95,0 kurumsal hedef çizgisi',
                        subtitle: 'Seçili dönemde zamanında giriş yapılan iş günü oranı (%)',
                        unit: 'Birim: % Uyum',
                        kind: 'hbar',
                        target: 95,
                        targetLabel: 'Hedef: %95,0',
                        max: 100,
                        suffix: '%',
                        data: ds.map(x => ({ label: x.d, value: +Number(x.pct).toFixed(1), display: '%' + A.pctText(x.pct) }))
                    },
                    {
                        figNo: 'SERGİ 2 · KURUMSAL SÜRE KÖPRÜSÜ (WATERFALL)',
                        title: 'Brüt ek mesaiden gecikme mahsubu sonrası net süre bakiyesine geçiş köprüsü',
                        subtitle: 'Dönem toplamı dakika (dk) bazında pozitif ve negatif süre hareketleri',
                        unit: 'Birim: Dakika (dk)',
                        kind: 'waterfall',
                        data: [
                            { label: 'Brüt Ek Mesai', value: otMin, display: '+' + otMin + ' dk', color: '#0B7A53' },
                            { label: 'Gecikme Kaybı', value: -lateMin, display: '−' + lateMin + ' dk', color: '#C8191E' },
                            { label: 'Net Süre Bakiyesi', value: netMin, isTotal: true, display: (netMin >= 0 ? '+' : '') + netMin + ' dk', color: '#1E293B' }
                        ]
                    }
                ],
                preparedBy: hazirlayan,
                approvedBy: 'İnsan Kaynakları Müdürlüğü',
                summaryTitle: 'DEPARTMAN BAZLI UYUM, EK MESAİ VE NET BAKİYE ÖZETİ',
                summaryHeaders: ['Departman', 'Personel', 'Ort. Giriş', 'Top. Ek Mesai (dk)', 'Top. Gecikme (dk)', 'Net Bakiye (dk)', 'Uyum Oranı (%)'],
                summaryRows: ds.map(x => [x.d, x.n, x.avgIn, '+' + x.totalOvertimeMin + ' dk', '-' + x.totalLateMin + ' dk', (x.netMin >= 0 ? '+' : '') + x.netMin + ' dk', '%' + A.pctText(x.pct)]),
                headers: ['Sicil No', 'Ad Soyad', 'Departman', 'Şube', 'Vardiya', 'Ort. Giriş', 'Ort. Çıkış', 'Top. Gecikme (dk)', 'Top. Ek Mesai (dk)', 'Net Bakiye (dk)', 'En Çok Geç Kaldığı Gün', 'En Çok Mesai Yaptığı Gün', 'Durum'],
                rows: list.map(({ e, an }) => [
                    e.sicil, e.name, e.dept, brName(e.branch),
                    `${D.shiftOf(e).name} (${D.hhmm(D.shiftOf(e).startMin)}–${D.hhmm(D.shiftOf(e).endMin)})`,
                    an.avgCheckIn, an.avgCheckOut,
                    an.totalLateMin,
                    an.totalOvertimeMin,
                    (an.netBalanceMin >= 0 ? '+' : '') + an.netBalanceMin + ' dk',
                    an.mostLateDay.totalLateMin > 0 ? `${an.mostLateDay.dowName} (${an.mostLateDay.totalLateMin} dk)` : 'Yok',
                    `${an.mostOvertimeDay.dowName} (+${an.mostOvertimeDay.totalOvertimeMin} dk)`,
                    STATUS[e.status][0]
                ])
            };
        }

        if (reportId === 'leaderboards') {
            const totOtMin = lb.all.reduce((a, x) => a + x.totalOvertimeMin, 0);
            const totLateMin = lb.all.reduce((a, x) => a + x.totalLateMin, 0);
            const netTot = totOtMin - totLateMin;
            const best = lb.bestNet[0];
            const worst = lb.worstNet[0];
            const top4 = lb.bestNet.slice(0, 4).map(a => ({ label: a.emp.name, value: a.netBalanceMin, display: '+' + a.netBalanceMin + ' dk' }));
            const bot4 = lb.worstNet.slice(0, 4).reverse().map(a => ({ label: a.emp.name, value: a.netBalanceMin, display: a.netBalanceMin + ' dk' }));
            return {
                fileName: 'Albayrak_Mesai_ve_Net_Bakiye_Ligi_' + dateIso,
                title: 'FAZLA MESAİ LİDERLERİ VE NET SÜRE BAKİYESİ (MESAİ − GECİKME) RAPORU',
                subtitle: `Dönem: ${periodStr} · Ek Mesaiden Gecikme Çıkınca Kalan Sürede En İyiler ve En Kötüler`,
                period: periodStr,
                scope: subeAdi,
                actionTitle: `Dönem içinde toplam +${totOtMin} dk ek mesaiye karşılık −${totLateMin} dk gecikme oluşmuş; personel net süre bakiyesi uçları ${best ? best.emp.name + ' (+' + best.netBalanceMin + ' dk)' : '—'} ile ${worst ? worst.emp.name + ' (' + worst.netBalanceMin + ' dk)' : '—'} arasında ayrışmıştır.`,
                scqa: [
                    ['DURUM (SITUATION)', `${lb.all.length} personelin tamamı Net Süre Bakiyesi = Toplam Ek Mesai (dk) − Toplam Gecikme (dk) denklemine göre sıralanmıştır.`],
                    ['KARMAŞIKLIK (COMPLICATION)', `Personelin ${lb.all.filter(x => x.netBalanceMin < 0).length} tanesinde gecikme süresi yapılan fazla mesaiyi aşarak negatif net bakiye üretmiştir.`],
                    ['ANA BULGU (KEY FINDING)', `En yüksek katkı sağlayan ilk 10 personel toplam fazla mesainin önemli bölümünü üstlenirken, negatif bakiye belirli şube ve günlerde yoğunlaşmaktadır.`],
                    ['ÖNERİLEN AKSİYON', `Pozitif net bakiye liderleri ödüllendirme/takdir havuzuna alınmalı; negatif bakiyeli personelle birebir vardiya uyum görüşmesi yapılmalıdır.`]
                ],
                meta: [
                    ['Dönem', periodStr],
                    ['Şube Kapsamı', subeAdi],
                    ['Hazırlayan', hazirlayan]
                ],
                kpis: [
                    { label: 'En Çok Mesai Yapan', value: lb.topOvertime[0] ? lb.topOvertime[0].emp.name : '—', target: lb.topOvertime[0] ? '+' + fmtMinDur(lb.topOvertime[0].totalOvertimeMin) : '—', color: '#0B7A53' },
                    { label: 'Net Bakiye Lideri', value: best ? best.emp.name : '—', target: best ? fmtMinSigned(best.netBalanceMin) : '—', color: '#0B7A53' },
                    { label: 'En Düşük Net Bakiye', value: worst ? worst.emp.name : '—', target: worst ? fmtMinSigned(worst.netBalanceMin) : '—', color: '#C8191E' },
                    { label: 'Toplam Ek Mesai (dk)', value: '+' + totOtMin + ' dk', target: 'Dönem toplamı', color: '#0B7A53' },
                    { label: 'Toplam Gecikme (dk)', value: '-' + totLateMin + ' dk', target: 'Dönem toplamı', color: '#C8191E' },
                    { label: 'Kurum Net Bakiyesi (dk)', value: (netTot >= 0 ? '+' : '') + netTot + ' dk', target: 'Ek mesai − gecikme', color: netTot >= 0 ? '#0B7A53' : '#C8191E' }
                ],
                exhibits: [
                    {
                        figNo: 'SERGİ 1 · NET BAKİYE UÇ ANALİZİ (EN İYİ 4 & EN DÜŞÜK 4)',
                        title: 'Personel bazında net süre bakiyesi dağılım uçları (Ek Mesai − Gecikme)',
                        subtitle: 'Sıfır denge eksenine göre en yüksek pozitif ve negatif bakiye üreten personeller',
                        unit: 'Birim: Net Dakika (dk)',
                        kind: 'diverging',
                        data: [...top4, ...bot4]
                    },
                    {
                        figNo: 'SERGİ 2 · BİRİM BAZLI NET SÜRE BAKİYESİ',
                        title: 'Departmanların toplam net süre bakiyesi katkısı (Ek Mesai − Gecikme)',
                        subtitle: 'Birim bazında kümülatif dakika dengesi',
                        unit: 'Birim: Dakika (dk)',
                        kind: 'diverging',
                        data: ds.map(x => ({ label: x.d, value: x.netMin, display: (x.netMin >= 0 ? '+' : '') + x.netMin + ' dk' }))
                    }
                ],
                preparedBy: hazirlayan,
                approvedBy: 'İnsan Kaynakları Müdürlüğü',
                summaryTitle: 'NET SÜRE BAKİYESİ EN İYİ 10 PERSONEL (EK MESAİ − GECİKME)',
                summaryHeaders: ['Sıra', 'Sicil No', 'Ad Soyad', 'Departman', 'Toplam Ek Mesai (dk)', 'Toplam Gecikme (dk)', 'Net Bakiye (dk)'],
                summaryRows: lb.bestNet.slice(0, 10).map((a, i) => [i + 1, a.emp.sicil, a.emp.name, a.emp.dept, a.totalOvertimeMin, a.totalLateMin, (a.netBalanceMin >= 0 ? '+' : '') + a.netBalanceMin + ' dk']),
                headers: ['Sicil No', 'Ad Soyad', 'Departman', 'Şube', 'Ek Mesai (dk)', 'Gecikme (dk)', 'Net Bakiye (dk)', 'Net Süre Özeti', 'En Çok Mesai Günü', 'En Çok Geç Kalınan Gün', 'Değerlendirme'],
                rows: lb.all.slice().sort((a, b) => b.netBalanceMin - a.netBalanceMin).map(a => [
                    a.emp.sicil, a.emp.name, a.emp.dept, brName(a.emp.branch),
                    a.totalOvertimeMin, a.totalLateMin, a.netBalanceMin,
                    fmtMinSigned(a.netBalanceMin),
                    `${a.mostOvertimeDay.dowName} (+${a.mostOvertimeDay.totalOvertimeMin} dk)`,
                    a.mostLateDay.totalLateMin > 0 ? `${a.mostLateDay.dowName} (${a.mostLateDay.totalLateMin} dk)` : 'Gecikme Yok',
                    a.netBalanceMin >= 0 ? 'Zamanında / Pozitif Bakiye' : 'Geç / Negatif Bakiye'
                ])
            };
        }

        if (reportId === 'analytics') {
            const belowTargetDays = d.filter(x => (x.onTime * 100) < 92).length;
            return {
                fileName: 'Albayrak_IK_Analitik_Raporu_' + dateIso,
                title: 'İNSAN KAYNAKLARI PERFORMANS, FAZLA MESAİ VE ANALİTİK RAPORU',
                subtitle: `Departman Karşılaştırma Matrisi ve Günlük Katılım Eğilimleri · ${periodStr}`,
                period: periodStr,
                scope: subeAdi,
                actionTitle: `İncelenen ${d.length} iş gününün ${d.length - belowTargetDays} gününde zamanında katılım %92 eşiğinin üzerinde gerçekleşmiş; birim bazında toplam +${A.numText(st.totalOvertimeH)} saat fazla mesai üretilmiştir.`,
                scqa: [
                    ['DURUM (SITUATION)', `${ds.length} departman ve ${d.length} iş günü boyunca günlük devam, ortalama çalışma saati ve fazla mesai eğilimleri analiz edilmiştir.`],
                    ['KARMAŞIKLIK (COMPLICATION)', `Toplam ${belowTargetDays} iş gününde günlük zamanında geliş oranı %92 operasyonel eşiğinin altına gerilemiştir.`],
                    ['ANA BULGU (KEY FINDING)', `Hafta başı giriş gecikmeleri ortalama çalışma süresini baskılarken, hafta ortası yapılan ek mesailer toplam iş gücü kapasitesini dengelemektedir.`],
                    ['ÖNERİLEN AKSİYON', `Eşik altı kalan günlerde şube bazlı vardiya başlangıç kontrolleri sıkılaştırılmalı ve birim iş yükü dağılımı dengelenmelidir.`]
                ],
                meta: [
                    ['Dönem', periodStr],
                    ['Şube', subeAdi],
                    ['Hazırlayan', hazirlayan]
                ],
                kpis: [
                    { label: 'Zamanında Katılım Oranı', value: '%' + A.pctText(st.onTimePct), target: 'Hedef: %95,0', color: '#0B7A53' },
                    { label: 'Toplam Fazla Mesai (sa)', value: A.numText(st.totalOvertimeH) + ' sa', target: periodStr, color: '#0B7A53' },
                    { label: 'Toplam Gecikme (dk)', value: Math.round(st.totalLateMin) + ' dk', target: st.late + ' personel geç kaldı', color: '#C8191E' },
                    { label: 'Net Süre Bakiyesi (dk)', value: (st.netBalanceMin >= 0 ? '+' : '') + st.netBalanceMin + ' dk', target: 'Ek mesai − gecikme', color: '#2855AE' },
                    { label: 'Ortalama Gecikme (dk)', value: Math.round(st.avgLate) + ' dk', target: 'Geç kalan personel ort.', color: '#B4690E' },
                    { label: 'Devamsız Personel', value: String(st.absent), target: 'Hedef: 0 kayıt', color: '#C8191E' }
                ],
                exhibits: [
                    {
                        figNo: 'SERGİ 1 · GÜNLÜK ZAMANINDA KATILIM EĞİLİMİ',
                        title: 'İş günü bazında zamanında katılım oranı (%) ve %92 kritik eşik çizgisi',
                        subtitle: 'Kırmızı işaretli noktalar %92 günlük hedef eşiğinin altında kalan iş günlerini gösterir',
                        unit: 'Birim: % Katılım',
                        kind: 'trend',
                        target: 92,
                        targetLabel: 'Eşik: %92',
                        suffix: '%',
                        data: d.slice(-14).map(x => ({ label: x.label || x.fullDate.slice(0, 5), value: +(x.onTime * 100).toFixed(1) }))
                    },
                    {
                        figNo: 'SERGİ 2 · DEPARTMAN ORTALAMA FİİLİ ÇALIŞMA SÜRESİ',
                        title: 'Birimlere göre günlük kişi başı ortalama çalışma saati (Hedef: 8,5 saat)',
                        subtitle: '1 saat öğle molası düşüldükten sonraki net fiili çalışma ortalaması',
                        unit: 'Birim: Saat / Gün',
                        kind: 'hbar',
                        target: 8.5,
                        targetLabel: 'Hedef: 8,5 sa',
                        max: 10,
                        suffix: ' sa',
                        data: ds.map(x => ({
                            label: x.d,
                            value: +Number(x.avgWorkH).toFixed(1),
                            display: String(x.avgWorkH).replace('.', ',') + ' sa',
                            color: +Number(x.avgWorkH) >= 8.5 ? '#1E293B' : '#B4690E'
                        }))
                    }
                ],
                preparedBy: hazirlayan,
                approvedBy: 'İnsan Kaynakları Müdürlüğü',
                summaryTitle: 'DEPARTMAN PERFORMANS, EK MESAİ VE NET BAKİYE MATRİSİ',
                summaryHeaders: ['Departman', 'Kadro', 'Ortalama Giriş', 'Top. Ek Mesai (dk)', 'Top. Gecikme (dk)', 'Net Bakiye (dk)', 'Uyum Oranı (%)'],
                summaryRows: ds.map(x => [x.d, x.n, x.avgIn, '+' + x.totalOvertimeMin + ' dk', '-' + x.totalLateMin + ' dk', (x.netMin >= 0 ? '+' : '') + x.netMin + ' dk', '%' + A.pctText(x.pct)]),
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
            };
        }

        if (reportId === 'late') {
            const list = lb.mostLate.filter(a => a.totalLateMin > 0);
            const totLate = list.reduce((s, x) => s + x.totalLateMin, 0);
            const dowTotals = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'].map(dn => ({
                label: dn,
                value: list.reduce((s, a) => s + (a.mostLateDay && a.mostLateDay.dowName === dn ? a.mostLateDay.totalLateMin : 0), 0)
            }));
            const peakDow = dowTotals.slice().sort((a, b) => b.value - a.value)[0] || { label: 'Pazartesi', value: 0 };
            return {
                fileName: 'Albayrak_Gec_Kalanlar_Raporu_' + dateIso,
                title: 'GECİKME VE NET SÜRE BAKİYESİ DENETİM RAPORU',
                subtitle: `Dönem: ${periodStr} · En Çok Gecikilen Günler ve Net Mesai Farkları`,
                period: periodStr,
                scope: subeAdi,
                actionTitle: `Dönem içinde ${list.length} personelde toplam ${totLate} dk gecikme tespit edilmiş olup gecikme zirveleri ${peakDow.label} günlerinde (${peakDow.value} dk) yoğunlaşmaktadır.`,
                scqa: [
                    ['DURUM (SITUATION)', `Vardiya başlangıç saati + hoşgörü süresi (tolerans) aşımı bulunan ${list.length} personelin giriş kayıtları denetlenmiştir.`],
                    ['KARMAŞIKLIK (COMPLICATION)', `Geç kalan personel başına ortalama gecikme ${Math.round(st.avgLate)} dk olup iş günü kaybı oluşturmaktadır.`],
                    ['ANA BULGU (KEY FINDING)', `Gecikmelerin büyük kısmı belirli gün (${peakDow.label}) ve birimlerde toplanmakta; personelin bir kısmı ek mesai ile kaybı telafi etmektedir.`],
                    ['ÖNERİLEN AKSİYON', `Kronik gecikme gösteren ilk 10 personel için birim yöneticisi uyarısı tetiklenmeli ve saatlik izin mahsupları kontrol edilmelidir.`]
                ],
                meta: [
                    ['Dönem', periodStr],
                    ['Şube Kapsamı', subeAdi],
                    ['Denetim Birimi', hazirlayan]
                ],
                kpis: [
                    { label: 'Gecikme Kaydı Olan Personel', value: String(list.length), target: 'Hedef: 0 personel', color: '#C8191E' },
                    { label: 'Toplam Gecikme Süresi (dk)', value: totLate + ' dk', target: 'Dönem toplamı', color: '#C8191E' },
                    { label: 'Ortalama Gecikme (dk)', value: Math.round(st.avgLate) + ' dk', target: '08:30 vardiya + tolerans bazlı', color: '#B4690E' },
                    { label: '30m Geofence Denetimi', value: '30m Aktif', target: 'Şube sınırı kontrolü', color: '#0B7A53' }
                ],
                exhibits: [
                    {
                        figNo: 'SERGİ 1 · HAFTANIN GÜNLERİNE GÖRE GECİKME YOĞUNLUĞU',
                        title: 'Personellerin en sık geç kaldığı iş günlerine göre gecikme yükü (dk)',
                        subtitle: 'Pazartesi – Cuma dağılımı ve zirve gecikme günü vurgusu',
                        unit: 'Birim: Dakika (dk)',
                        kind: 'vbar',
                        suffix: ' dk',
                        data: dowTotals
                    },
                    {
                        figNo: 'SERGİ 2 · BİRİM BAZLI TOPLAM GECİKME PARETO ANALİZİ',
                        title: 'Departmanlara göre toplam gecikme dakikası kırılımı',
                        subtitle: 'En yüksek gecikme üreten birimlerden en düşüğe sıralı',
                        unit: 'Birim: Dakika (dk)',
                        kind: 'hbar',
                        lowerIsBetter: true,
                        target: Math.round(totLate / Math.max(1, ds.length)),
                        targetLabel: 'Birim Ort.',
                        suffix: ' dk',
                        data: ds.slice().sort((a, b) => b.totalLateMin - a.totalLateMin).map(x => ({ label: x.d, value: x.totalLateMin, display: x.totalLateMin + ' dk' }))
                    }
                ],
                preparedBy: hazirlayan,
                approvedBy: 'İnsan Kaynakları Müdürlüğü',
                summaryTitle: 'DEPARTMAN BAZLI GECİKME VE NET BAKİYE ÖZETİ',
                summaryHeaders: ['Departman', 'Kadro', 'Toplam Gecikme (dk)', 'Toplam Ek Mesai (dk)', 'Net Bakiye (dk)', 'Uyum Oranı (%)'],
                summaryRows: ds.slice().sort((a, b) => b.totalLateMin - a.totalLateMin).map(x => [x.d, x.n, '-' + x.totalLateMin + ' dk', '+' + x.totalOvertimeMin + ' dk', (x.netMin >= 0 ? '+' : '') + x.netMin + ' dk', '%' + A.pctText(x.pct)]),
                headers: ['Sicil No', 'Ad Soyad', 'Departman', 'Şube', 'Toplam Gecikme (dk)', 'Gecikme Gün Sayısı', 'En Çok Geç Kaldığı Gün', 'Toplam Ek Mesai (dk)', 'Net Süre Bakiyesi (dk)'],
                rows: list.map(a => [
                    a.emp.sicil, a.emp.name, a.emp.dept, brName(a.emp.branch),
                    a.totalLateMin,
                    a.lateDays,
                    `${a.mostLateDay.dowName} (${a.mostLateDay.totalLateMin} dk)`,
                    a.totalOvertimeMin,
                    (a.netBalanceMin >= 0 ? '+' : '') + a.netBalanceMin + ' dk'
                ])
            };
        }

        if (reportId === 'leaves') {
            const tone = { pending: 'Bekliyor', approved: 'Onaylandı', rejected: 'Reddedildi' };
            const branchLeaves = D.LEAVES.filter(l => {
                if (S.branch === 'ALL') return true;
                const e = emp(l.empId);
                return e && e.branch === S.branch;
            });
            const pendCnt = branchLeaves.filter(l => l.status === 'pending').length;
            const apprCnt = branchLeaves.filter(l => l.status === 'approved').length;
            const rejCnt = branchLeaves.filter(l => l.status === 'rejected').length;
            const hourlyCnt = branchLeaves.filter(l => l.isHourly).length;

            const types = Array.from(new Set(branchLeaves.map(l => l.type || 'Yıllık İzin')));
            const byType = types.map(t => {
                const sub = branchLeaves.filter(l => (l.type || 'Yıllık İzin') === t);
                return {
                    label: t,
                    ok: sub.filter(l => l.status === 'approved').length,
                    warn: sub.filter(l => l.status === 'pending').length,
                    bad: sub.filter(l => l.status === 'rejected').length,
                    total: sub.length
                };
            });

            const byDept = D.DEPTS.map(dp => {
                const cnt = branchLeaves.filter(l => { const e = emp(l.empId); return e && e.dept === dp; }).length;
                return { label: dp, value: cnt, display: cnt + ' talep' };
            }).sort((a, b) => b.value - a.value);

            return {
                fileName: 'Albayrak_Izin_Mazeret_Raporu_' + dateIso,
                title: 'KURUMSAL İZİN, SAATLİK İZİN VE MAZERET TALEPLERİ RAPORU',
                subtitle: 'Personel Yıllık İzin, Saatlik İzin, Sağlık Raporu ve Mazeret İzni Kayıtları',
                period: periodStr,
                scope: subeAdi,
                actionTitle: `Dönem içinde kaydedilen ${branchLeaves.length} izin talebinin ${apprCnt} adedi onaylanmış, ${hourlyCnt} adet saatlik izin gecikme süresinden otomatik mahsup edilmiş; ${pendCnt} talep İK onayı beklemektedir.`,
                scqa: [
                    ['DURUM (SITUATION)', `PostgreSQL leave_requests tablosundaki tam gün ve saatlik izin talepleri onay statülerine göre incelenmiştir.`],
                    ['KARMAŞIKLIK (COMPLICATION)', `Bekleyen ${pendCnt} izin talebi puantaj kapanışı öncesinde İK SLA onayı gerektirmektedir.`],
                    ['ANA BULGU (KEY FINDING)', `Toplam taleplerin ${hourlyCnt} adedi saatlik izin olup onaylandığında ilgili günün gecikme dakikasından otomatik düşülmektedir.`],
                    ['ÖNERİLEN AKSİYON', `Onay bekleyen ${pendCnt} talep ay sonu bordro/puantaj kesiminden önce sonuçlandırılmalıdır.`]
                ],
                meta: [
                    ['Dönem', periodStr],
                    ['Şube Kapsamı', subeAdi],
                    ['Hazırlayan', hazirlayan]
                ],
                kpis: [
                    { label: 'Toplam İzin Talebi', value: String(branchLeaves.length), target: 'PostgreSQL leave_requests', color: '#0B7A53' },
                    { label: 'Onay Bekleyen Talep', value: String(pendCnt), target: 'Hedef: 0 bekleyen (SLA)', color: pendCnt > 0 ? '#B4690E' : '#0B7A53' },
                    { label: 'Onaylanan Talep', value: String(apprCnt), target: 'Puantaja işlendi', color: '#0B7A53' },
                    { label: 'Reddedilen Talep', value: String(rejCnt), target: 'Gerekçesiyle kapatıldı', color: '#C8191E' },
                    { label: 'Saatlik İzin Kaydı', value: String(hourlyCnt), target: 'Gecikmeden mahsup edilen', color: '#0B7A53' },
                    { label: 'Bugün İzinli Personel', value: String(st.leave), target: 'Aktif izinli kadro', color: '#2855AE' }
                ],
                exhibits: [
                    {
                        figNo: 'SERGİ 1 · İZİN TÜRLERİNE GÖRE ONAY STATÜSÜ DAĞILIMI',
                        title: 'İzin kategorisi bazında Onaylanan, Bekleyen ve Reddedilen talep kırılımı',
                        subtitle: 'Her çubuk ilgili izin türündeki karar dağılımını ve toplam talep sayısını gösterir',
                        unit: 'Birim: Talep Adedi',
                        kind: 'stacked100',
                        data: byType
                    },
                    {
                        figNo: 'SERGİ 2 · DEPARTMAN BAZLI İZİN TALEBİ YÜKÜ',
                        title: 'Birimlere göre oluşturulan toplam tam gün ve saatlik izin talepleri',
                        subtitle: 'Departman bazlı izin kullanım yoğunluğu sıralaması',
                        unit: 'Birim: Talep',
                        kind: 'hbar',
                        suffix: ' talep',
                        data: byDept
                    }
                ],
                preparedBy: hazirlayan,
                approvedBy: 'İnsan Kaynakları Müdürlüğü',
                summaryTitle: 'İZİN TÜRLERİNE GÖRE ONAY VE BEKLEYEN TALEP ÖZETİ',
                summaryHeaders: ['İzin Türü', 'Onaylanan', 'Bekleyen', 'Reddedilen', 'Toplam Talep'],
                summaryRows: byType.map(t => [t.label, t.ok, t.warn, t.bad, t.total]),
                headers: ['Talep No', 'Sicil No', 'Personel Adı', 'Departman', 'İzin Türü', 'Süre (Gün)', 'Başlangıç Tarihi', 'Açıklama', 'Durum'],
                rows: branchLeaves.map(l => {
                    const e = emp(l.empId) || { sicil: '—', name: 'Bilinmeyen Personel', dept: '—' };
                    return [l.code || ('LV-' + l.id), e.sicil, e.name, e.dept, l.type, l.days, l.from, l.reason, tone[l.status] || l.status];
                })
            };
        }

        // reportId === 'it'
        const branchAlerts = D.ALERTS.filter(a => S.branch === 'ALL' || a.branch === S.branch);
        const branchDevices = D.DEVICES.filter(dv => {
            if (S.branch === 'ALL') return true;
            const e = emp(dv.empId);
            return e && e.branch === S.branch;
        });
        const boundCnt = branchDevices.filter(dv => dv.status === 'BOUND').length;
        const openAlCnt = branchAlerts.filter(a => !a.resolved).length;
        const mockCnt = branchAlerts.filter(a => a.type === 'MOCK_GPS').length;
        const geoCnt = branchAlerts.filter(a => a.type === 'GEOFENCE').length;

        const alertByType = Object.keys(D.ALERT_TYPES).map(k => ({
            label: D.ALERT_TYPES[k],
            value: branchAlerts.filter(a => a.type === k).length
        })).filter(x => x.value > 0).sort((a, b) => b.value - a.value);

        const distBands = [
            { label: '0–15m (Merkez)', value: branchAlerts.filter(a => (a.dist || 0) <= 15).length, color: '#0B7A53' },
            { label: '16–30m (Sınır İçi)', value: branchAlerts.filter(a => (a.dist || 0) > 15 && (a.dist || 0) <= 30).length, color: '#0B7A53' },
            { label: '31–60m (İhlal)', value: branchAlerts.filter(a => (a.dist || 0) > 30 && (a.dist || 0) <= 60).length, color: '#B4690E' },
            { label: '60m+ (Kritik İhlal)', value: branchAlerts.filter(a => (a.dist || 0) > 60).length, color: '#C8191E' }
        ];

        return {
            fileName: 'Albayrak_BT_Guvenlik_Denetim_' + dateIso,
            title: 'BT SİBER GÜVENLİK, CİHAZ EŞLEME VE DENETİM RAPORU',
            subtitle: 'Sahte GPS, 30m Geofence İhlali, Cihaz Bütünlüğü ve Yönetici İşlem Kayıtları',
            period: periodStr,
            scope: subeAdi,
            actionTitle: `Kapsamdaki ${branchDevices.length} cihazın ${boundCnt} adedi tekil eşlenmiş durumda olup, ${mockCnt} Sahte GPS ve ${geoCnt} adet 30m sınır aşımı denemesi otomatik bloke edilmiştir (${openAlCnt} açık uyarı).`,
            scqa: [
                ['DURUM (SITUATION)', `30m Haversine şube geofence sınırı, Android sahte konum (Mock GPS) algılayıcısı ve tekil cihaz eşleme politikaları denetlenmiştir.`],
                ['KARMAŞIKLIK (COMPLICATION)', `Toplam ${branchAlerts.length} güvenlik kaydının ${openAlCnt} adedi halen açık statüde olup BT incelemesi beklemektedir.`],
                ['ANA BULGU (KEY FINDING)', `Sahte konum (${mockCnt} olay) ve 30m geofence dışı (${geoCnt} olay) girişimler sunucu doğrulama katmanında reddedilerek puantaj bütünlüğü korunmuştur.`],
                ['ÖNERİLEN AKSİYON', `Açık güvenlik uyarıları kapatılmalı ve eşleme bekleyen cihazlar için kimlik doğrulaması tamamlanmalıdır.`]
            ],
            meta: [
                ['Dönem', periodStr],
                ['Şube Kapsamı', subeAdi],
                ['Hazırlayan Birim', hazirlayan]
            ],
            kpis: [
                { label: 'Tekil Eşlenmiş Cihaz', value: String(boundCnt), target: branchDevices.length + ' toplam kayıtlı cihaz', color: '#0B7A53' },
                { label: 'Açık Güvenlik Uyarısı', value: String(openAlCnt), target: 'Hedef: 0 açık uyarı', color: openAlCnt > 0 ? '#C8191E' : '#0B7A53' },
                { label: 'Sahte GPS Blokajı', value: String(mockCnt), target: 'Anında reddedilen deneme', color: '#C8191E' },
                { label: '30m Geofence İhlali', value: String(geoCnt), target: 'Sınır dışı deneme', color: '#B4690E' },
                { label: 'Denetim Günlüğü (Audit)', value: String(D.AUDIT.length), target: 'Değiştirilemez iz kaydı', color: '#0B7A53' }
            ],
            exhibits: [
                {
                    figNo: 'SERGİ 1 · GÜVENLİK İHLAL VE UYARI TÜRLERİ PARETO ANALİZİ',
                    title: 'Olay kategorisine göre tespit ve bloke edilen güvenlik uyarıları',
                    subtitle: 'PostgreSQL security_alerts tablosundaki kayıtların tür dağılımı',
                    unit: 'Birim: Olay Sayısı',
                    kind: 'hbar',
                    suffix: ' olay',
                    data: alertByType.length ? alertByType : [{ label: 'Güvenlik İhlali Yok', value: 0, display: '0 olay' }]
                },
                {
                    figNo: 'SERGİ 2 · 30m GEOFENCE MESAFE BANTLARI ANALİZİ',
                    title: 'Uyarı kayıtlarının şube merkezine olan Haversine mesafesine göre dağılımı',
                    subtitle: '30 metre üzeri işlemler sistem tarafından otomatik reddedilir',
                    unit: 'Birim: Kayıt Adedi',
                    kind: 'vbar',
                    suffix: ' kayıt',
                    data: distBands
                }
            ],
            preparedBy: hazirlayan,
            approvedBy: 'Bilgi Teknolojileri Müdürlüğü',
            summaryTitle: 'SON YÖNETİCİ DENETİM GÜNLÜĞÜ (AUDIT LOG)',
            summaryHeaders: ['Saat', 'İşlemi Yapan', 'İşlem Açıklaması', 'Hedef Kayıt', 'Kategori'],
            summaryRows: D.AUDIT.slice(0, 12).map(a => [a.t, a.who, a.act, a.target, a.cat]),
            headers: ['Uyarı No', 'Zaman', 'Sicil No', 'Personel', 'Şube', 'Güvenlik Olayı', 'Önem Derecesi', 'Durum'],
            rows: branchAlerts.map(a => {
                const e = emp(a.empId) || { sicil: '—', name: 'Bilinmeyen Personel' };
                return [a.code || ('AL-' + a.id), a.ago + ' önce', e.sicil, e.name, brName(a.branch), D.ALERT_TYPES[a.type] || a.type, a.sev === 'HIGH' ? 'Yüksek' : a.sev === 'MED' ? 'Orta' : 'Düşük', a.resolved ? 'Çözüldü' : 'Bekliyor'];
            })
        };
    }

    function exportEmpsExcel() {
        A.excelReport(buildExecutiveReportModel('emps'));
        A.toast('Kurumsal Puantaj Excel (.xlsx) raporu indirildi');
    }

    function exportLeaderboardsExcel() {
        A.excelReport(buildExecutiveReportModel('leaderboards'));
        A.toast('Mesai ve Net Bakiye Ligi (.xlsx) raporu indirildi');
    }

    function exportAnalyticsExcel() {
        A.excelReport(buildExecutiveReportModel('analytics'));
        A.toast('İK Analitik Raporu (.xlsx) indirildi');
    }

    function exportLateExcel() {
        A.excelReport(buildExecutiveReportModel('late'));
        A.toast('Gecikme denetim raporu (.xlsx) indirildi');
    }

    function exportLeavesExcel() {
        A.excelReport(buildExecutiveReportModel('leaves'));
        A.toast('İzin & mazeret Excel (.xlsx) raporu indirildi');
    }

    function exportItExcel() {
        A.excelReport(buildExecutiveReportModel('it'));
        A.toast('BT Güvenlik ve Denetim Raporu (.xlsx) indirildi');
    }

    function exportOneExcel(empId) {
        const e = emp(empId), opts = filterOpts(), an = D.empAnalytics(e.id, opts);
        const br = D.BRANCHES.find(b => b.code === e.branch) || D.BRANCHES[0];
        const dev = D.DEVICES.find(d => d.empId === e.id);
        const empLeaves = D.LEAVES.filter(l => l.empId === e.id);
        const empAlerts = D.ALERTS.filter(a => a.empId === e.id);
        const deptPeers = D.EMPLOYEES.filter(x => x.dept === e.dept);
        const deptLb = D.computeLeaderboards(deptPeers, opts);
        const deptCount = deptLb.all.length || 1;
        const deptAvgOt = Math.round(deptLb.all.reduce((s, x) => s + x.totalOvertimeMin, 0) / deptCount);
        const deptAvgLate = Math.round(deptLb.all.reduce((s, x) => s + x.totalLateMin, 0) / deptCount);
        const deptRankIdx = deptLb.bestNet.findIndex(x => x.empId === e.id);
        const deptRank = deptRankIdx >= 0 ? (deptRankIdx + 1) : 1;
        const attRatePct = an.totalDays > 0 ? (an.attendedDays / an.totalDays * 100) : 100;
        const leaveTone = { pending: 'Onay Bekliyor', approved: 'Onaylandı', rejected: 'Reddedildi' };
        const devStatusLabel = dev
            ? (dev.status === 'BOUND' ? 'Eşlendi (Aktif)' : dev.status === 'PENDING' ? 'Eşleme Bekliyor' : 'Engellendi')
            : 'Eşlendi (Aktif)';

        const extraSections = [];
        if (empLeaves.length || empAlerts.length) {
            const eventRows = [];
            empLeaves.forEach(l => {
                eventRows.push([
                    'LV-' + l.id,
                    'İzin / Mazeret',
                    l.type,
                    l.from,
                    l.days + ' gün',
                    l.reason,
                    l.ago,
                    leaveTone[l.status] || l.status
                ]);
            });
            empAlerts.forEach(a => {
                eventRows.push([
                    'AL-' + a.id,
                    'Güvenlik / Cihaz',
                    D.ALERT_TYPES[a.type] || a.type,
                    a.ago + ' önce',
                    a.dist != null ? a.dist + ' m' : '—',
                    brName(a.branch),
                    a.sev === 'HIGH' ? 'Yüksek' : a.sev === 'MED' ? 'Orta' : 'Düşük',
                    a.resolved ? 'Çözüldü' : 'Bekliyor'
                ]);
            });
            extraSections.push({
                title: 'DÖNEM İZİN, MAZERET VE GÜVENLİK KAYITLARI ÖZETİ',
                headers: ['Kayıt No', 'Kategori', 'Tür / Olay', 'Tarih / Zaman', 'Süre / Mesafe', 'Açıklama / Şube', 'Detay', 'Durum'],
                rows: eventRows
            });
        }

        const dailyLogsRev = an.logs.slice().reverse();
        extraSections.push({
            title: `GÜN GÜN PDKS GİRİŞ-ÇIKIŞ VE PUANTAJ CETVELİ (${dailyLogsRev.length} İŞ GÜNÜ)`,
            headers: ['Tarih', 'Gün', 'İlk Giriş', 'Son Çıkış', 'Mesai & Net Bakiye', 'Gecikme', 'Ek Mesai', 'Yoklama Durumu & Mesafe'],
            rows: dailyLogsRev.map(l => [
                l.fullDate,
                l.dowName,
                l.checkIn || '—',
                l.checkOut || '—',
                `${l.workH ? A.numText(l.workH) + ' sa' : '0 sa'} (${fmtMinSigned(l.netMin)})`,
                l.lateMin > 0 ? '−' + l.lateMin + ' dk' : '0 dk',
                l.overtimeMin > 0 ? '+' + l.overtimeMin + ' dk' : '0 dk',
                `${STATUS[l.status][0]}${l.dist != null ? ' (' + A.numText(l.dist) + 'm)' : ''}`
            ])
        });

        A.excelReport({
            orientation: 'portrait',
            fileName: 'PDKS_Puantaj_Karnesi_' + e.sicil + '_' + new Date().toISOString().slice(0, 10),
            title: e.name.toLocaleUpperCase('tr-TR') + ' (' + e.sicil + ') — BİREYSEL PDKS PUANTAJ CETVELİ VE PERFORMANS KARNESİ',
            subtitle: e.title + ' · ' + e.dept + ' · ' + br.name + ' · Dönem: ' + rangeLabel(),
            actionTitle: `${e.name} (${e.sicil}), incelenen ${an.totalDays} iş gününde %${A.pctText(an.onTimePct)} zamanında giriş uyumu ve ${fmtMinSigned(an.netBalanceMin)} net süre bakiyesi ile ${e.dept} biriminde ${deptRank}/${deptCount}. sırada yer almıştır.`,
            scqa: [
                ['DURUM (SITUATION)', `${e.dept} birimi personeli ${e.name} (${e.sicil}) için ${an.totalDays} iş günlük giriş-çıkış, mesai ve 30m geofence kayıtları derlenmiştir.`],
                ['KARMAŞIKLIK (COMPLICATION)', `Dönem içinde ${an.lateDays} iş gününde toplam ${an.totalLateMin} dk gecikme oluşmuştur (Birim ortalaması: ${deptAvgLate} dk).`],
                ['ANA BULGU (KEY FINDING)', `Personel ${an.overtimeDays} iş gününde toplam +${an.totalOvertimeMin} dk ek mesai yaparak dönem net bakiyesini ${fmtMinSigned(an.netBalanceMin)} seviyesinde tamamlamıştır.`],
                ['ÖNERİLEN AKSİYON', an.netBalanceMin >= 0 ? 'Pozitif süre dengesi ve geofence uyumu korunmalıdır.' : 'Gecikme yoğunlaşan günlerde vardiya başlangıç uyumu takip edilmelidir.']
            ],
            exhibits: [
                {
                    figNo: 'SERGİ 1 · HAFTANIN GÜNLERİNE GÖRE NET SÜRE BAKİYESİ',
                    title: 'Pazartesi – Cuma bazında kümülatif net süre dengesi (Ek Mesai − Gecikme)',
                    subtitle: 'Personelin haftanın hangi günlerinde artı veya eksi bakiye ürettiğini gösterir',
                    unit: 'Birim: Dakika (dk)',
                    kind: 'diverging',
                    data: an.weekdayList.map(w => ({ label: w.dowName, value: w.netMin, display: (w.netMin >= 0 ? '+' : '') + w.netMin + ' dk' }))
                },
                {
                    figNo: 'SERGİ 2 · PERSONEL VS. DEPARTMAN ORTALAMASI KIYASLAMASI',
                    title: 'Personelin ek mesai, gecikme ve net bakiyesinin birim ortalamasıyla karşılaştırması',
                    subtitle: `${e.dept} birimi ortalamasına (${deptCount} personel) göre performans karşılaştırması`,
                    unit: 'Birim: Dakika (dk)',
                    kind: 'hbar',
                    suffix: ' dk',
                    data: [
                        { label: 'Personel Ek Mesai', value: an.totalOvertimeMin, display: '+' + an.totalOvertimeMin + ' dk', color: '#0B7A53' },
                        { label: 'Birim Ort. Ek Mesai', value: deptAvgOt, display: '+' + deptAvgOt + ' dk', color: '#64748B' },
                        { label: 'Personel Gecikme', value: an.totalLateMin, display: '−' + an.totalLateMin + ' dk', color: '#C8191E' },
                        { label: 'Birim Ort. Gecikme', value: deptAvgLate, display: '−' + deptAvgLate + ' dk', color: '#64748B' }
                    ]
                }
            ],
            meta: [
                ['Personel', e.name + ' (' + e.sicil + ')'],
                ['Şube', br.name],
                ['Dönem', an.periodLabel + ' (' + an.totalDays + ' İş Günü)']
            ],
            kvSections: [
                {
                    title: 'Personel Özlük, Kadro, Şube Geofence ve Mobil Cihaz Sicil Kartı',
                    rows: [
                        ['Sicil Numarası', e.sicil, 'Ad Soyad', e.name],
                        ['Departman / Birim', e.dept, 'Unvan / Görev', e.title],
                        ['Bağlı Olduğu Şube', `${br.name} (${br.city})`, 'Koordinat & Sınır', `${br.lat.toFixed(4)}, ${br.lng.toFixed(4)} · ${br.radius}m Sınır`],
                        ['Kurumsal Wi-Fi', br.wifi, 'Atanmış Vardiya', `${D.shiftOf(e).name} · ${D.hhmm(D.shiftOf(e).startMin)} – ${D.hhmm(D.shiftOf(e).endMin)} (Tolerans ${D.shiftOf(e).graceMin} dk)`],
                        ['Eşlenmiş Cihaz', dev ? `${dev.model} (${dev.os})` : 'Kurumsal Mobil Cihaz · Android 14', 'Cihaz & Sürüm', dev ? `${devStatusLabel} · v${dev.ver} (${dev.mask})` : 'Eşlendi (Aktif) · v2.4.1'],
                        ['Yoklama Durumu', STATUS[e.status][0], 'Rapor Dönemi', `${an.periodLabel} (${an.totalDays} İş Günü)`]
                    ]
                },
                {
                    title: 'Dönem Puantaj, Mesai ve Devam Tahakkuk Cetveli (Detaylı PDKS Özeti)',
                    rows: [
                        ['Takvim İş Günü', `${an.totalDays} iş günü`, 'Fiili Çalışılan Gün', `${an.attendedDays} gün (%${A.pctText(attRatePct)} devam)`],
                        ['Zamanında Giriş', `${an.presentDays} gün (%${A.pctText(an.onTimePct)} uyum)`, 'Geç Kalınan Gün', `${an.lateDays} gün`],
                        ['İzinli / Raporlu', `${an.leaveDays} gün`, 'Devamsız İş Günü', `${an.absentDays} gün`],
                        ['Toplam Fiili Mesai', `${A.numText(an.totalWorkH)} saat (${Math.round(an.totalWorkH * 60)} dk)`, 'Günlük Ort. Mesai', `${A.numText(an.avgWorkH)} saat / gün (Hedef: 8,5 sa)`],
                        ['Toplam Ek Mesai', `+${fmtMinDur(an.totalOvertimeMin)} (${an.overtimeDays} gün · ${an.totalOvertimeMin} dk)`, 'Toplam Gecikme', `${an.totalLateMin > 0 ? '−' + fmtMinDur(an.totalLateMin) : '0 dk'} (${an.lateDays} gün · ${an.totalLateMin} dk)`],
                        ['Net Süre Bakiyesi', `${fmtMinSigned(an.netBalanceMin)} (${an.netBalanceMin >= 0 ? 'Pozitif Bakiye' : 'Negatif Bakiye'})`, 'Birim Sıralaması', `${deptRank} / ${deptCount}. sıra (${e.dept})`],
                        ['Ort. Giriş / Çıkış', `${an.avgCheckIn} → ${an.avgCheckOut}`, 'Erken / Geç Saat', `Giriş: ${an.earliestCheckIn}–${an.latestCheckIn} · Çıkış: ${an.latestCheckOut}`],
                        ['En Çok Gecikilen', an.mostLateDay.totalLateMin > 0 ? `${an.mostLateDay.dowName} (−${an.mostLateDay.totalLateMin} dk · ${an.mostLateDay.lateCount} kez)` : 'Gecikme Yok (Tam Uyum)', 'Zirve Gecikme', an.peakLateRec && an.peakLateRec.lateMin > 0 ? `${an.peakLateRec.fullDate} ${an.peakLateRec.dowShort} (−${an.peakLateRec.lateMin} dk · Giriş ${an.peakLateRec.checkIn})` : 'Dönem İçinde Gecikme Yok'],
                        ['En Çok Ek Mesai', an.mostOvertimeDay.totalOvertimeMin > 0 ? `${an.mostOvertimeDay.dowName} (+${an.mostOvertimeDay.totalOvertimeMin} dk · ${an.mostOvertimeDay.otCount} kez)` : 'Ek Mesai Kaydı Yok', 'Zirve Ek Mesai', an.peakOtRec && an.peakOtRec.overtimeMin > 0 ? `${an.peakOtRec.fullDate} ${an.peakOtRec.dowShort} (+${an.peakOtRec.overtimeMin} dk · Çıkış ${an.peakOtRec.checkOut})` : 'Ek Mesai Kaydı Yok'],
                        ['En Verimli Gün', `${an.bestNetDay.dowName} (Net ${fmtMinSigned(an.bestNetDay.netMin)} · Ort. ${A.numText(an.bestNetDay.avgWorkH)} sa)`, 'Birim Ortalaması', `Ort. Mesai: +${fmtMinDur(deptAvgOt)} · Ort. Geç: −${fmtMinDur(deptAvgLate)}`],
                        ['30m Geofence Uyum', `%${A.pctText(an.geofenceRate)} Uyum (Ort. ${A.numText(an.avgDist)}m · Maks. ${A.numText(an.maxDist)}m)`, 'İzin & Güvenlik', `${empLeaves.length} izin talebi · ${empAlerts.length ? empAlerts.length + ' güvenlik uyarısı' : 'İhlal yok (Temiz)'}`]
                    ]
                }
            ],
            kpis: [
                { label: 'Net Süre Bakiyesi', value: fmtMinSigned(an.netBalanceMin), sub: 'Toplam ek mesai − toplam gecikme', color: an.netBalanceMin >= 0 ? '#0B7A53' : '#C8191E' },
                { label: 'Toplam Ek Mesai', value: '+' + fmtMinDur(an.totalOvertimeMin), sub: an.overtimeDays + ' iş günü fazla çalışma', color: '#0B7A53' },
                { label: 'Toplam Gecikme', value: an.totalLateMin > 0 ? '−' + fmtMinDur(an.totalLateMin) : '0 dk', sub: an.lateDays + ' iş günü gecikme', color: '#B4690E' },
                { label: 'Fiili Çalışma Süresi', value: A.numText(an.totalWorkH) + ' sa', sub: `${an.attendedDays}/${an.totalDays} gün · Günlük ort. ${A.numText(an.avgWorkH)} sa`, color: '#2855AE' },
                { label: 'Zamanında Giriş Oranı', value: '%' + A.pctText(an.onTimePct), sub: `Ort. giriş ${an.avgCheckIn} · çıkış ${an.avgCheckOut}`, color: '#0B7A53' },
                { label: '30m Geofence Uyum', value: '%' + A.pctText(an.geofenceRate), sub: `Ort. ${A.numText(an.avgDist)} m · Maks. ${A.numText(an.maxDist)} m`, color: '#0B7A53' }
            ],
            preparedBy: S.user ? S.user.name + ' — ' + S.user.title : 'İnsan Kaynakları Yönetimi',
            approvedBy: 'İnsan Kaynakları Müdürlüğü',
            summaryTitle: 'HAFTANIN GÜNLERİNE GÖRE (PAZARTESİ – CUMA) DAVRANIŞ VE MESAİ ANALİZİ',
            summaryHeaders: ['Haftanın Günü', 'Katılım', 'Ort. Giriş', 'Ort. Çıkış', 'Ort. Mesai', 'Gecikme', 'Ek Mesai', 'Net Süre Bakiyesi'],
            summaryRows: an.weekdayList.map(w => [
                w.dowName,
                w.attended + ' gün',
                w.avgIn,
                w.avgOut,
                A.numText(w.avgWorkH) + ' sa',
                w.totalLateMin > 0 ? '−' + w.totalLateMin + ' dk (' + w.lateCount + 'x)' : '0 dk',
                w.totalOvertimeMin > 0 ? '+' + w.totalOvertimeMin + ' dk (' + w.otCount + 'x)' : '0 dk',
                fmtMinSigned(w.netMin)
            ]),
            extraSections,
            headers: ['Tarih', 'Gün', 'Sicil No', 'Ad Soyad', 'Şube', 'İlk Giriş', 'Son Çıkış', 'Mesai (Sa)', 'Gecikme', 'Ek Mesai', 'Net Bakiye', 'Durum & Mesafe'],
            rows: dailyLogsRev.map(l => [
                l.fullDate,
                l.dowName,
                e.sicil,
                e.name,
                br.name,
                l.checkIn || '—',
                l.checkOut || '—',
                l.workH ? A.numText(l.workH) + ' sa' : '0 sa',
                l.lateMin > 0 ? '−' + l.lateMin + ' dk' : '0 dk',
                l.overtimeMin > 0 ? '+' + l.overtimeMin + ' dk' : '0 dk',
                fmtMinSigned(l.netMin),
                `${STATUS[l.status][0]}${l.dist != null ? ' (' + A.numText(l.dist) + 'm)' : ''}`
            ])
        });
        A.toast(e.name + ' dikey PDKS puantaj karnesi (.xlsx) indirildi');
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
        // Açık menünün bulunduğu kartı normal katmana geri indir
        $$('.card.has-open-cselect').forEach(card => {
            if (!except || !card.contains(except)) card.classList.remove('has-open-cselect');
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
            // Açık menü alttaki kartın arkasında kalmasın: kartı öne al
            const card = wrap.closest('.card');
            if (card) card.classList.toggle('has-open-cselect', open);
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
        'w-sec': el => {
            const k = S.page + ':' + el.dataset.v;
            S.ui.secClosed = Object.assign({}, S.ui.secClosed, { [k]: !(S.ui.secClosed && S.ui.secClosed[k]) });
            draw(false);
            const b = $('[data-act="w-sec"][data-v="' + CSS.escape(el.dataset.v) + '"]');
            if (b) try { b.focus({ preventScroll: true }); } catch (_) { }
        },
        'an-jump': el => {
            const t = $('#sec-' + CSS.escape(el.dataset.v));
            if (t) t.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        },
        'ov-see-list': el => { Object.assign(S.ui.emp, { status: el.dataset.v, page: 1, openId: null }); go('employees'); },
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
        'prof-log-sort': el => {
            const u = S.ui.profLog || (S.ui.profLog = { sort: 'date', dir: -1, status: 'ALL' });
            u.dir = u.sort === el.dataset.v ? -u.dir : -1;
            u.sort = el.dataset.v;
            draw(false);
        },
        'prof-log-status': el => {
            const u = S.ui.profLog || (S.ui.profLog = { sort: 'date', dir: -1, status: 'ALL' });
            u.status = el.dataset.v;
            draw(false);
        },
        'leave-filter': el => { S.ui.leave.f = el.dataset.v; draw(false); },
        'leave-act': syncGuard(async el => {
            const l = D.LEAVES.find(x => x.id === +el.dataset.id); if (!l) return;
            const status = el.dataset.v === 'approved' ? 'APPROVED' : 'REJECTED';
            el.disabled = true;
            if (l.code) {
                try {
                    await postJson('/api/v1/leaves', { code: l.code, status }, 'PATCH');
                } catch (err) {
                    A.toast(String((err && err.message) || err), 'err');
                    el.disabled = false;
                    return;
                }
            }
            l.status = el.dataset.v;
            audit(l.status === 'approved' ? 'İzin talebi onaylandı' : 'İzin talebi reddedildi', l.code || ('LV-' + l.id), 'HR');
            A.toast(l.status === 'approved' ? 'Talep onaylandı' : 'Talep reddedildi');
            const synced = await D.syncAllFromPostgres({ force: true });
            if (!synced) draw(false);
        }),
        'dnd-reset': () => A.resetDragLayout(dndKey(), () => draw(true)),
        'w-panel': () => {
            openDrawer('Düzeni özelleştir · ' + (NAV_LABEL[S.page] || ''), wPanelHtml());
            $('#drawer').dataset.wpanel = '1';
            const first = $('#drawerBody .w-switch');
            if (first) try { first.focus({ preventScroll: true }); } catch (_) { }
        },
        'w-toggle': el => {
            const r = WREG.find(x => x.id === el.dataset.id); if (!r) return;
            wSetVisible(r.id, !r.on);
            draw(false);
            wRefreshPanel('#wsw-' + CSS.escape(r.id));
            A.toast(r.on ? `“${r.title}” kartı gizlendi` : `“${r.title}” kartı eklendi`);
        },
        'w-hide': el => {
            const r = WREG.find(x => x.id === el.dataset.id); if (!r) return;
            const card = el.closest('.card');
            let finished = false;
            const done = () => { if (finished) return; finished = true; wSetVisible(r.id, false); draw(false); wRefreshPanel(); A.toast(`“${r.title}” gizlendi · Düzeni özelleştir'den geri ekleyebilirsiniz`); };
            const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (card && !reduce && card.animate) {
                /* Çıkış animasyonu (opacity + scale); sekme arka plandaysa animasyon beklenmeden tamamlanır */
                card.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.96)' }], { duration: 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' });
                setTimeout(done, 190);
            } else done();
        },
        'w-move': el => {
            const card = $('#page .card[data-wid="' + CSS.escape(el.dataset.id) + '"]');
            if (!card || !card.parentElement) return;
            const grid = card.parentElement, sibs = Array.from(grid.children).filter(c => c.classList.contains('card'));
            const i = sibs.indexOf(card), j = i + (+el.dataset.v);
            if (j < 0 || j >= sibs.length) { A.toast('Kart zaten satırın ' + (j < 0 ? 'başında' : 'sonunda')); return; }
            if (+el.dataset.v < 0) grid.insertBefore(card, sibs[j]); else grid.insertBefore(card, sibs[j].nextSibling);
            wPersistOrder();
            draw(false);
            wRefreshPanel('[data-act="w-move"][data-id="' + CSS.escape(el.dataset.id) + '"][data-v="' + el.dataset.v + '"]');
        },
        'w-reset': () => {
            try { localStorage.removeItem(wKey()); localStorage.removeItem(dndKey()); } catch (_) { }
            draw(true);
            wRefreshPanel();
            A.toast('Varsayılan düzene dönüldü');
        },
        'export-emps': el => A.runDownload(el, exportEmpsExcel),
        'export-leaderboards': el => A.runDownload(el, exportLeaderboardsExcel),
        'export-analytics': el => A.runDownload(el, exportAnalyticsExcel),
        'export-late': el => A.runDownload(el, exportLateExcel),
        'export-leaves': el => A.runDownload(el, exportLeavesExcel),
        'export-it': el => A.runDownload(el, exportItExcel),
        'export-one': el => A.runDownload(el, () => exportOneExcel(+el.dataset.id)),
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
        'al-resolve': syncGuard(async el => {
            const a = D.ALERTS.find(x => x.id === +el.dataset.id);
            if (!a) return;
            a.resolved = true;
            if (a.code) {
                try { await postJson('/api/v1/alerts', { code: a.code }, 'PATCH'); } catch (_) {}
            }
            audit('Güvenlik uyarısı kapatıldı', a.code || ('AL-' + a.id), 'SECURITY');
            A.toast('Uyarı çözüldü olarak işaretlendi');
            const synced = await D.syncAllFromPostgres({ force: true });
            if (!synced) draw(false);
        }),
        'al-block': syncGuard(async el => {
            const a = D.ALERTS.find(x => x.id === +el.dataset.id);
            if (!a) return;
            const d = D.DEVICES.find(x => x.empId === a.empId);
            a.resolved = true;
            if (d) d.status = 'BLOCKED';
            if (a.code) {
                try { await postJson('/api/v1/alerts', { code: a.code }, 'PATCH'); } catch (_) {}
            }
            audit('Cihaz engellendi', emp(a.empId) ? emp(a.empId).sicil : ('AL-' + a.id), 'SECURITY');
            A.toast('Cihaz engellendi ve uyarı kapatıldı');
            const synced = await D.syncAllFromPostgres({ force: true });
            if (!synced) draw(false);
        }),
        'dv-unbind': el => { const d = D.DEVICES.find(x => x.id === el.dataset.id); d.status = 'PENDING'; audit('Cihaz eşlemesi sıfırlandı', d.id, 'DEVICE'); A.toast('Eşleme sıfırlandı'); draw(false); },
        'dv-unblock': el => { const d = D.DEVICES.find(x => x.id === el.dataset.id); d.status = 'BOUND'; audit('Cihaz engeli kaldırıldı', d.id, 'DEVICE'); A.toast('Engel kaldırıldı'); draw(false); },
        'au-cat': el => { S.ui.audit.cat = el.dataset.v; draw(false); },
        'br-map': el => {
            const code = el.dataset.code || 'ŞB-001';
            const b = D.BRANCHES.find(x => x.code === code) || D.BRANCHES[0];
            S.ui.simBranch = b.code;
            const bbox = `${(b.lng - 0.0045).toFixed(5)}%2C${(b.lat - 0.0032).toFixed(5)}%2C${(b.lng + 0.0045).toFixed(5)}%2C${(b.lat + 0.0032).toFixed(5)}`;
            const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${b.lat.toFixed(5)}%2C${b.lng.toFixed(5)}`;
            const gmapsUrl = (b.googleMapUrl && b.googleMapUrl.startsWith('https://')) ? b.googleMapUrl : `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`;
            openModal(
                b.name + ' · Harita & Açık Adres',
                `<div style="display:grid;gap:14px">
                    <div style="padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:var(--surface-2);display:grid;gap:6px">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                            <b style="font-size:14px;color:var(--ink)">${esc(b.name)}</b>
                            ${pill(b.city + (b.district ? ' / ' + b.district : ''), 'ok')}
                        </div>
                        <div style="font-size:12.5px;color:var(--ink-2);line-height:1.45">${esc(b.address || (b.name + ' · ' + b.city))}</div>
                        <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:11.5px;margin-top:4px" class="mono muted">
                            <span>Telefon: <b>${esc(b.phone || '0850 222 0 252')}</b></span>
                            <span>Koordinat: <b>${b.lat.toFixed(4)}, ${b.lng.toFixed(4)}</b></span>
                            <span>Geofence: <b>${b.radius}m Sınır</b></span>
                            <span>Wi-Fi: <b>${esc(b.wifi)}</b></span>
                        </div>
                    </div>
                    <div style="position:relative;border-radius:14px;overflow:hidden;border:1px solid var(--line);height:290px;background:var(--surface-2)">
                        <iframe title="${esc(b.name)} Harita" src="${osmEmbedUrl}" style="width:100%;height:100%;border:0" loading="lazy"></iframe>
                    </div>
                </div>`,
                `<button class="btn btn-soft" data-act="modal-close">Kapat</button><a href="${esc(gmapsUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="text-decoration:none">${ic('pin')}Google Haritalar'da Aç ↗</a>`
            );
            draw(false);
        },
        'br-add': () => openModal('Yeni şube', branchFormHtml(null),
            '<button class="btn btn-soft" data-act="modal-close">Vazgeç</button><button class="btn btn-primary" data-act="br-save">PostgreSQL\'e Kaydet</button>'),
        'br-save': syncGuard(async el => {
            const d = branchFormValues();
            d.code = d.code || nextBranchCode();
            const bad = branchFormError(d);
            if (bad) { showBranchError(bad); return; }
            if (el) el.disabled = true;
            try {
                const res = await postJson('/api/v1/branches', {
                    code: d.code, name: d.name, city: d.city, district: d.district,
                    address: d.address, phone: d.phone, googleMapUrl: d.googleMapUrl || undefined,
                    lat: d.lat, lng: d.lng, radius: d.radius, wifi: d.wifi,
                    wifiBssid: d.wifiBssid, backupWifiBssids: d.backupWifiBssids,
                    wifiEnforcementMode: d.wifiEnforcementMode
                });
                closeModal();
                A.toast(res.message || 'Şube PostgreSQL branches tablosuna kaydedildi.', 'ok');
                await refreshBranches();
            } catch (err) {
                showBranchError(String((err && err.message) || err));
                if (el) el.disabled = false;
            }
        }),
        'br-edit': el => {
            const b = D.BRANCHES.find(x => x.code === el.dataset.code);
            if (!b) return;
            openModal(b.name + ' · Şubeyi düzenle', branchFormHtml(b),
                '<button class="btn btn-soft" data-act="modal-close">Vazgeç</button>' +
                `<button class="btn btn-primary" data-act="br-update" data-code="${esc(b.code)}">Değişiklikleri Kaydet</button>`);
        },
        'br-update': syncGuard(async el => {
            const code = el.dataset.code;
            const d = branchFormValues();
            const bad = branchFormError(d);
            if (bad) { showBranchError(bad); return; }
            if (el) el.disabled = true;
            try {
                const res = await postJson('/api/v1/branches/' + encodeURIComponent(code), {
                    name: d.name, city: d.city, district: d.district, address: d.address,
                    phone: d.phone, googleMapUrl: d.googleMapUrl || '',
                    lat: d.lat, lng: d.lng, radius: d.radius, wifi: d.wifi,
                    wifiBssid: d.wifiBssid, backupWifiBssids: d.backupWifiBssids,
                    wifiEnforcementMode: d.wifiEnforcementMode
                }, 'PATCH');
                closeModal();
                A.toast(res.message || 'Şube güncellendi.', 'ok');
                await refreshBranches();
            } catch (err) {
                showBranchError(String((err && err.message) || err));
                if (el) el.disabled = false;
            }
        }),
        'br-delete': el => {
            const b = D.BRANCHES.find(x => x.code === el.dataset.code);
            if (!b) return;
            const empCount = D.EMPLOYEES.filter(e => e.branch === b.code).length;
            openModal('Şubeyi sil', `
                <p><b>${esc(b.name)}</b> (<span class="mono">${esc(b.code)}</span>) şubesini silmek üzeresiniz.</p>
                ${empCount
                    ? `<p class="shifts-feedback bad" style="margin-top:12px">${ic('alert')}<span>Bu şubede <b>${empCount} personel</b> kayıtlı. Personeli başka bir şubeye aktarmadan silme işlemi PostgreSQL tarafından reddedilir.</span></p>`
                    : '<p class="muted" style="margin-top:8px;font-size:12.5px">Bu işlem geri alınamaz ve denetim günlüğüne yazılır.</p>'}`,
                `<button class="btn btn-soft" data-act="modal-close">Vazgeç</button><button class="btn btn-bad" data-act="br-delete-confirm" data-code="${esc(b.code)}">${ic('x')}Kalıcı Olarak Sil</button>`);
        },
        'br-delete-confirm': syncGuard(async el => {
            const code = el.dataset.code;
            if (el) el.disabled = true;
            try {
                const res = await postJson('/api/v1/branches/' + encodeURIComponent(code), null, 'DELETE');
                closeModal();
                A.toast(res.message || 'Şube silindi.', 'ok');
                await refreshBranches();
            } catch (err) {
                A.toast(String((err && err.message) || err), 'err');
                if (el) el.disabled = false;
            }
        }),
        'br-sync-web': syncGuard(async el => {
            if (el) el.disabled = true;
            A.toast('albayrakfinans.com.tr üzerinden canlı şube verisi çekiliyor…', 'info');
            try {
                const res = await postJson('/api/v1/branches/sync', {});
                const added = res.added || [], updated = res.updated || [];
                openModal('Canlı şube senkronizasyonu tamamlandı', `
                    <p><b>${res.total || 0} şube</b> canlı kaynaktan alındı.</p>
                    <div class="grid g-3 mt">
                        <div class="hi-card ok"><small>Yeni eklenen</small><b>${added.length}</b><span>PostgreSQL branches</span></div>
                        <div class="hi-card warn"><small>Güncellenen</small><b>${updated.length}</b><span>adres / telefon / koordinat</span></div>
                        <div class="hi-card"><small>Değişmeyen</small><b>${res.unchanged || 0}</b><span>zaten güncel</span></div>
                    </div>
                    ${added.length ? `<h4 style="margin:16px 0 6px;font-size:13px">Eklenen şubeler</h4><div class="list">${added.map(x => `<div class="list-item"><span class="ico-sq ok">${ic('plus')}</span><div class="grow"><b>${esc(x)}</b></div></div>`).join('')}</div>` : ''}
                    ${updated.length ? `<h4 style="margin:16px 0 6px;font-size:13px">Güncellenen şubeler</h4><div class="list">${updated.map(x => `<div class="list-item"><span class="ico-sq warn">${ic('refresh')}</span><div class="grow"><b>${esc(x)}</b></div></div>`).join('')}</div>` : ''}`,
                    '<button class="btn btn-primary" data-act="modal-close">Tamam</button>');
                await refreshBranches();
            } catch (err) {
                A.toast(String((err && err.message) || err), 'err');
            } finally {
                if (el) el.disabled = false;
            }
        }),
        'wifi-disc-filter': el => {
            S.ui.wifiDiscFilter = el.dataset.v || 'ALL';
            draw(false);
        },
        'wifi-assign': syncGuard(async el => {
            const branchCode = el.dataset.branch || '';
            const bssid = (el.dataset.bssid || '').toLowerCase();
            const ssid = el.dataset.ssid || '';
            const role = el.dataset.role || 'PRIMARY';
            if (!branchCode || !bssid) return;
            if (el) el.disabled = true;
            try {
                const res = await postJson('/api/v1/branches/wifi-discovery', {
                    branchCode,
                    bssid,
                    ssid,
                    role
                });
                const bObj = D.BRANCHES.find(b => b.code === branchCode);
                if (bObj) {
                    if (role === 'PRIMARY') bObj.wifiBssid = bssid;
                    else if (role === 'BACKUP') {
                        const cur = bObj.backupWifiBssids ? bObj.backupWifiBssids.split(',').map(x => x.trim()).filter(Boolean) : [];
                        if (!cur.includes(bssid)) cur.push(bssid);
                        bObj.backupWifiBssids = cur.join(', ');
                    } else if (role === 'REMOVE') {
                        if (bObj.wifiBssid === bssid) bObj.wifiBssid = '';
                        const cur = bObj.backupWifiBssids ? bObj.backupWifiBssids.split(',').map(x => x.trim()).filter(x => x && x !== bssid) : [];
                        bObj.backupWifiBssids = cur.join(', ');
                    }
                }
                const cObj = (D.WIFI_DISCOVERY || []).find(c => c.branchCode === branchCode && c.bssid === bssid);
                if (cObj) cObj.assignmentStatus = role === 'REMOVE' ? 'UNASSIGNED' : role;
                audit((role === 'PRIMARY' ? 'Ana Şube Modemi BSSID atandı' : role === 'BACKUP' ? 'Yedek (Yan Dükkan) Modem BSSID eklendi' : 'Modem BSSID kaldırıldı') + ' (' + bssid + ')', branchCode, 'SECURITY');
                A.toast(res.message || (branchCode + ' şubesine ' + bssid + ' atandı.'), 'ok');
                await refreshBranches();
            } catch (err) {
                A.toast(String((err && err.message) || err), 'err');
                if (el) el.disabled = false;
            }
        }),
        'wifi-assign-all-top': syncGuard(async el => {
            const topUnassigned = (D.WIFI_DISCOVERY || []).filter(c => c.assignmentStatus === 'UNASSIGNED' && c.recommendedRole === 'PRIMARY');
            if (!topUnassigned.length) {
                A.toast('Tüm şubelerde birincil ortak modemler zaten atanmış durumda.', 'info');
                return;
            }
            if (el) el.disabled = true;
            try {
                let assigned = 0;
                for (const item of topUnassigned) {
                    await postJson('/api/v1/branches/wifi-discovery', {
                        branchCode: item.branchCode,
                        bssid: item.bssid,
                        ssid: item.ssid,
                        role: 'PRIMARY'
                    });
                    assigned++;
                }
                audit(assigned + ' şubeye ortak görülen ana modem BSSID adresleri toplu atandı', 'TÜM ŞUBELER', 'SECURITY');
                A.toast(assigned + ' şubenin ortak Wi-Fi BSSID adresi tek tıkla tanımlandı!', 'ok');
                await refreshBranches();
            } catch (err) {
                A.toast(String((err && err.message) || err), 'err');
            } finally {
                if (el) el.disabled = false;
            }
        }),
        'br-toggle-mode': syncGuard(async el => {
            const code = el.dataset.code || '';
            const nextMode = el.dataset.mode || 'LEARNING';
            const b = D.BRANCHES.find(x => x.code === code);
            if (!b) return;
            if (nextMode === 'STRICT' && !b.wifiBssid && !b.backupWifiBssids) {
                A.toast('Zorunlu BSSID moduna geçmeden önce üstteki listeden tek tıkla en az bir BSSID atayın.', 'err');
                return;
            }
            if (el) el.disabled = true;
            try {
                const res = await postJson('/api/v1/branches/' + encodeURIComponent(code), {
                    wifiEnforcementMode: nextMode
                }, 'PATCH');
                b.wifiEnforcementMode = nextMode;
                audit(code + ' şubesi Wi-Fi doğrulama modu güncellendi (' + nextMode + ')', code, 'SECURITY');
                A.toast(res.message || (b.name + ' Wi-Fi modu: ' + (nextMode === 'STRICT' ? 'Zorunlu BSSID' : 'Öğrenme Modu')), 'ok');
                await refreshBranches();
            } catch (err) {
                A.toast(String((err && err.message) || err), 'err');
                if (el) el.disabled = false;
            }
        }),
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
            }, () => draw(false));
            audit('Yeni personel işe giriş kaydı oluşturuldu (' + created.name + ')', created.sicil, 'HR');
            u.name = '';
            u.email = '';
            A.toast(created.name + ' (' + created.sicil + ') PDKS sistemine eklendi');
            draw(false);
        },
        'emp-edit': el => {
            const e = emp(+el.dataset.id);
            if (!e) return;
            const corpEmail = e.email || (e.name.toLocaleLowerCase('tr-TR')
                .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
                .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
                .replace(/[^a-z0-9]+/g, '.') + '@albayrakfinans.com.tr');
            const startDateVal = (e.startDate && /^\d{4}-\d{2}-\d{2}$/.test(e.startDate)) ? e.startDate : '2026-10-20';
            openModal(
                'Personel Bilgilerini Düzenle · ' + e.sicil,
                `<form class="form-grid" id="empEditForm" onsubmit="return false" novalidate>
                    <div class="grid g-2">
                        <label class="field"><span>Ad Soyad *</span><div class="input"><input id="editEmpName" value="${esc(e.name)}" maxlength="80" required></div></label>
                        <label class="field"><span>Sicil No (Sabit)</span><div class="input" style="background:var(--surface-2)"><input value="${esc(e.sicil)}" readonly class="mono"></div></label>
                    </div>
                    <div class="grid g-2">
                        <label class="field"><span>Departman / Birim</span><div class="select" style="width:100%"><select id="editEmpDept" style="width:100%;max-width:none">${D.DEPTS.map(d => `<option value="${esc(d)}"${d === e.dept ? ' selected' : ''}>${esc(d)}</option>`).join('')}</select></div></label>
                        <label class="field"><span>Ünvan / Görev</span><div class="select" style="width:100%"><select id="editEmpTitle" style="width:100%;max-width:none">${(D.TITLES || ['Finans Uzmanı', 'Müşteri Temsilcisi', 'Operasyon Uzmanı', 'Takım Lideri', 'Uzman Yardımcısı', 'Şube Müdür Yrd.', 'Analist']).map(t => `<option value="${esc(t)}"${t === e.title ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div></label>
                    </div>
                    <div class="grid g-2">
                        <label class="field"><span>Atandığı Şube (30m Geofence)</span><div class="select" style="width:100%"><select id="editEmpBranch" style="width:100%;max-width:none">${D.BRANCHES.map(b => `<option value="${esc(b.code)}"${b.code === e.branch ? ' selected' : ''}>${esc(b.name)} (${esc(b.city)})</option>`).join('')}</select></div></label>
                        <label class="field"><span>Güncel Yoklama Durumu</span><div class="select" style="width:100%"><select id="editEmpStatus" style="width:100%;max-width:none">
                            <option value="PRESENT"${e.status === 'PRESENT' ? ' selected' : ''}>Ofiste (Zamanında)</option>
                            <option value="LATE"${e.status === 'LATE' ? ' selected' : ''}>Geç Kaldı</option>
                            <option value="LEAVE"${e.status === 'LEAVE' ? ' selected' : ''}>İzinli / Raporlu</option>
                            <option value="ABSENT"${e.status === 'ABSENT' ? ' selected' : ''}>Devamsız</option>
                        </select></div></label>
                    </div>
                    <div class="grid g-2">
                        <label class="field"><span>Kurumsal E-posta</span><div class="input"><input id="editEmpEmail" type="email" value="${esc(corpEmail)}"></div></label>
                        <label class="field"><span>İşe Başlama Tarihi</span><div class="input"><input id="editEmpStart" type="date" value="${esc(startDateVal)}"></div></label>
                    </div>
                    <p class="form-error" id="editEmpErr" hidden></p>
                </form>`,
                `<button class="btn btn-soft" data-act="modal-close">Vazgeç</button><button class="btn btn-primary" data-act="emp-edit-save" data-id="${e.id}">${ic('check')} Değişiklikleri Kaydet</button>`
            );
        },
        'emp-edit-save': el => {
            const id = +el.dataset.id;
            const e = emp(id);
            if (!e) return;
            const name = ($('#editEmpName').value || '').trim();
            const dept = $('#editEmpDept').value;
            const title = $('#editEmpTitle').value;
            const branch = $('#editEmpBranch').value;
            const status = $('#editEmpStatus').value;
            const email = ($('#editEmpEmail').value || '').trim();
            const startDate = ($('#editEmpStart').value || '').trim();
            const err = $('#editEmpErr');
            if (name.length < 3 || !name.includes(' ')) {
                err.textContent = 'Personel ad ve soyadı en az 3 karakter olmalı ve boşluk içermelidir.';
                err.hidden = false;
                return;
            }
            const updated = D.updateEmployee(id, { name, dept, title, branch, status, email, startDate }, () => draw(false));
            if (updated) {
                audit('Personel bilgileri güncellendi (' + updated.name + ')', updated.sicil, 'HR');
                closeModal();
                A.toast(updated.name + ' (' + updated.sicil + ') bilgileri güncellendi');
                draw(false);
            }
        },
        'emp-delete': el => {
            const e = emp(+el.dataset.id);
            if (!e) return;
            openModal(
                'Personel Kaydını Sil · ' + e.sicil,
                `<p><b>${esc(e.name)}</b> (<span class="mono">${esc(e.sicil)}</span> · ${esc(e.dept)}) personelini PDKS veritabanından kalıcı olarak silmek istediğinize emin misiniz?</p>
                <p class="muted" style="font-size:12.5px">Bu işlem personelin aktif kadro kaydını ve cihaz eşlemesini kaldırır ve denetim günlüğüne (Audit Log) kaydedilir.</p>`,
                `<button class="btn btn-soft" data-act="modal-close">Vazgeç</button><button class="btn btn-bad" data-act="emp-delete-confirm" data-id="${e.id}">${ic('x')} Evet, Personeli Sil</button>`
            );
        },
        'emp-delete-confirm': el => {
            const id = +el.dataset.id;
            const e = emp(id);
            if (!e) return;
            const removed = D.deleteEmployee(id, () => draw(false));
            if (removed) {
                audit('Personel PDKS kaydı silindi (' + removed.name + ')', removed.sicil, 'HR');
                if (S.ui.emp.openId === id) S.ui.emp.openId = null;
                closeModal();
                A.toast(removed.name + ' (' + removed.sicil + ') kaydı silindi');
                if (S.page === 'profile' && S.openEmpId === id) {
                    S.openEmpId = D.EMPLOYEES[0] ? D.EMPLOYEES[0].id : null;
                    go('employees');
                } else {
                    draw(false);
                }
            }
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
        'adm-create-user': async () => {
            const u = S.ui.adm;
            const name = (u.name || '').trim();
            const title = (u.title || '').trim() || (u.role === 'HR' ? 'İK Uzmanı' : 'BT Sistem Uzmanı');
            const email = (u.email || '').trim().toLowerCase();
            const pass = (u.pass || '').trim();
            if (name.length < 3) { A.toast('Lütfen kullanıcının ad ve soyadını girin.', 'err'); return; }
            if (!email || !email.includes('@')) { A.toast('Geçerli bir kurumsal e-posta adresi girin.', 'err'); return; }
            if (ACCOUNTS.some(a => a.email === email)) { A.toast('Bu e-posta adresiyle kayıtlı bir kullanıcı zaten var.', 'err'); return; }
            if (pass.length < 8) { A.toast('Parola en az 8 karakter olmalıdır.', 'err'); return; }
            if (!u.perms.length) { A.toast('En az 1 modül yetkisi seçmelisiniz.', 'err'); return; }

            const payload = { email, name, title, role: u.role, branch: u.branch || 'ALL', password: pass, perms: u.perms.slice() };
            let res = null;
            try {
                res = await fetch('/api/v1/accounts', {
                    method: 'POST', credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify(payload)
                });
            } catch (_) { res = null; }
            if (res && !res.ok) {
                const d = await res.json().catch(() => null);
                A.toast((d && d.message) || 'Kullanıcı sunucuya kaydedilemedi.', 'err');
                return;
            }
            // Parola yerel depoya YAZILMAZ; doğrulama sunucuda yapılır.
            const newAcc = { email, role: u.role, name, title, branch: payload.branch, active: true, perms: payload.perms };
            ACCOUNTS.push(newAcc);
            saveAccounts();
            audit('Yeni ' + (u.role === 'HR' ? 'İK' : 'BT') + ' portal kullanıcısı oluşturuldu (' + name + ')', email, 'ACCOUNT');
            u.name = '';
            u.title = '';
            u.email = '';
            u.pass = tempPassword();
            A.toast(name + ' (' + (u.role === 'HR' ? 'İK' : 'BT') + ') kullanıcısı ve yetkileri kaydedildi' + (res ? '' : ' · sunucuya ulaşılamadı, yalnızca bu tarayıcıda'), res ? undefined : 'err');
            draw(false);
        },
        'adm-toggle-active': async el => {
            const acc = ACCOUNTS.find(a => a.email === el.dataset.email);
            if (!acc) return;
            const nextActive = acc.active === false;
            const ok = await patchAccount({ email: acc.email, active: nextActive });
            if (!ok) return;
            acc.active = nextActive;
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
                        return `<div class="list-item clickable" style="padding:10px 14px" data-act="adm-perm-modal-toggle" data-email="${esc(acc.email)}" data-k="${esc(pm.k)}" tabindex="0" role="button">
                            <span class="ico-sq ${has ? 'ok' : ''}" style="width:28px;height:28px;border-radius:8px">${ic(has ? 'check' : 'lock')}</span>
                            <div class="grow"><b>${esc(pm.l)}</b><small style="display:block;color:var(--muted)">${esc(pm.d)}</small></div>
                            <button type="button" class="switch ${has ? 'on' : ''}"><span></span></button>
                        </div>`;
                    }).join('')}
                </div>`;
            openModal('Yetkileri Düzenle · ' + acc.name, renderModalPerms(), '<button class="btn btn-primary" data-act="modal-close">Kaydet ve Kapat</button>');
        },
        'adm-perm-modal-toggle': async el => {
            const acc = ACCOUNTS.find(a => a.email === el.dataset.email);
            if (!acc) return;
            const k = el.dataset.k;
            const current = acc.perms || [];
            const nextPerms = current.includes(k) ? current.filter(p => p !== k) : current.concat(k);
            const ok = await patchAccount({ email: acc.email, perms: nextPerms });
            if (!ok) return;
            acc.perms = nextPerms;
            saveAccounts();
            audit('Kullanıcı yetkileri güncellendi (' + acc.perms.length + ' yetki)', acc.email, 'ACCOUNT');
            acts['adm-edit-perms'](el);
            draw(false);
        },
        'shifts-refresh': syncGuard(async () => {
            A.toast('PostgreSQL verileri yenileniyor…', 'info');
            await D.syncAllFromPostgres({ force: true });
            if (D.SYNC.ok) A.toast('PostgreSQL 18 verileri güncellendi.', 'ok');
            else A.toast('Veri alınamadı: ' + (D.SYNC.error || 'bilinmeyen hata'), 'err');
            if (onShiftsPage()) draw(false);
        }),
        'shifts-sim': syncGuard(async el => {
            const val = id => { const n = $('#' + id); return n ? n.value : ''; };
            const u = S.ui.shifts;
            Object.assign(u, {
                empId: +val('shEmp') || null,
                event: val('shEvent') || 'CHECK_IN',
                source: val('shSource') || 'MOBILE_GEOFENCE',
                clock: val('shClock') || '08:28',
                dist: +val('shDist') || 8,
                accuracy: val('shAccuracy') || '3.4521',
                wifiScanMode: val('shWifiMode') || 'MATCH_PRIMARY',
                mock: !!($('#shMock') && $('#shMock').checked)
            });
            if (!u.empId) { A.toast('Önce bir personel seçin.', 'err'); return; }
            const simEmp = D.EMPLOYEES.find(e => e.id === u.empId);
            const branchCode = (simEmp && simEmp.branch) || 'ŞB-001';
            const brObj = D.BRANCHES.find(b => b.code === branchCode);
            const discForBranch = (D.WIFI_DISCOVERY || []).filter(c => c.branchCode === branchCode);
            const primaryBssid = (brObj && brObj.wifiBssid) || (discForBranch[0] && discForBranch[0].bssid) || 'a4:2b:8c:1d:e5:9f';
            const backupBssid = (brObj && brObj.backupWifiBssids && brObj.backupWifiBssids.split(',')[0].trim()) || (discForBranch[1] && discForBranch[1].bssid) || 'c8:3a:35:91:02:11';

            let nearbyWifis = [];
            if (u.wifiScanMode === 'MATCH_PRIMARY') {
                nearbyWifis = [
                    { bssid: primaryBssid, ssid: (brObj && brObj.wifi) || 'ALBAYRAK_SUBE_WIFI', rssi: -49 },
                    { bssid: backupBssid, ssid: 'TurkTelekom_Fiber_Esnaf', rssi: -68 }
                ];
            } else if (u.wifiScanMode === 'MATCH_BACKUP') {
                nearbyWifis = [
                    { bssid: backupBssid, ssid: 'TurkTelekom_Fiber_Esnaf', rssi: -64 }
                ];
            } else {
                // Evden Fake GPS senaryosu: sadece evdeki yabancı modem görülür
                nearbyWifis = [
                    { bssid: 'f0:9f:c2:11:22:33', ssid: 'Ev_Superonline_Home', rssi: -42 }
                ];
            }

            if (el) el.disabled = true;
            try {
                const res = await postJson('/api/v1/access-logs', {
                    employeeId: u.empId, eventType: u.event, source: u.source,
                    branchCode,
                    distanceMeters: u.dist,
                    accuracyMeters: parseFloat(String(u.accuracy).replace(',', '.')),
                    locationAgeMs: 0,
                    isMockGps: u.mock,
                    locationMocked: u.mock,
                    nearbyWifis,
                    clockHhmm: u.clock
                });
                u.feedback = { tone: 'ok', text: res.message || 'Geçiş PostgreSQL access_logs tablosuna kaydedildi.' };
                A.toast(u.feedback.text, 'ok');
            } catch (err) {
                u.feedback = { tone: 'bad', text: String((err && err.message) || err) };
                A.toast(u.feedback.text, 'err');
            } finally {
                const synced = await D.syncAllFromPostgres({ force: true });
                if (!synced && onShiftsPage()) draw(false);
            }
        }),
        'shifts-edit': el => {
            const id = +(el && el.dataset.id);
            const s = (D.SHIFTS || []).find(x => +x.id === id);
            if (!s) return;
            const sm = s.startMin != null ? s.startMin : 510;
            const em = s.endMin != null ? s.endMin : 1050;
            Object.assign(S.ui.shifts, {
                editId: id,
                shCode: s.code || '',
                shName: s.name || '',
                shStart: A.pad(Math.floor(sm / 60)) + ':' + A.pad(sm % 60),
                shEnd: A.pad(Math.floor(em / 60)) + ':' + A.pad(em % 60),
                shGrace: s.graceMin != null ? s.graceMin : 5,
                shBreak: s.breakMin != null ? s.breakMin : 60,
                asgScope: 'none',
                feedback: null
            });
            draw(false);
            const box = document.getElementById('shName');
            if (box) box.focus();
        },
        'shifts-cancel': () => {
            Object.assign(S.ui.shifts, {
                editId: null, shCode: '', shName: '', shStart: '08:30', shEnd: '17:30',
                shGrace: 5, shBreak: 60, asgScope: 'none', feedback: null
            });
            draw(false);
        },
        'shifts-update': syncGuard(async el => {
            const val = id => { const n = $('#' + id); return n ? n.value : ''; };
            const u = S.ui.shifts;
            Object.assign(u, { shCode: val('shCode'), shName: val('shName'), shStart: val('shStart'), shEnd: val('shEnd'), shGrace: +val('shGrace') || 0, shBreak: +val('shBreak') || 0 });
            if (!u.editId) return;
            if (!u.shStart || !u.shEnd) { A.toast('Başlangıç ve bitiş saati zorunludur.', 'err'); return; }
            if (el) el.disabled = true;
            try {
                const res = await postJson('/api/v1/shifts/' + u.editId, {
                    code: u.shCode || undefined,
                    name: u.shName || undefined,
                    startClock: u.shStart, endClock: u.shEnd,
                    graceMin: u.shGrace, breakMin: u.shBreak,
                    assignment: buildShiftAssignment()
                }, 'PATCH');
                u.feedback = { tone: 'ok', text: res.message || 'Vardiya şablonu güncellendi.' };
                Object.assign(u, { editId: null, asgScope: 'none' });
                A.toast(u.feedback.text, 'ok');
            } catch (err) {
                u.feedback = { tone: 'bad', text: String((err && err.message) || err) };
                A.toast(u.feedback.text, 'err');
                if (el) el.disabled = false;
            } finally {
                const synced = await D.syncAllFromPostgres({ force: true });
                if (!synced && onShiftsPage()) draw(false);
            }
        }),
        'shifts-del': syncGuard(async el => {
            const id = +(el && el.dataset.id);
            const name = (el && el.dataset.name) || 'Vardiya';
            const s = (D.SHIFTS || []).find(x => +x.id === id);
            if (!s) return;
            const cnt = (D.EMPLOYEES || []).filter(x => +x.shiftId === id).length;
            const alt = (D.SHIFTS || []).find(x => +x.id !== id);
            if (!alt) { A.toast('Son vardiya şablonu silinemez.', 'err'); return; }
            const ok = window.confirm(`${name} şablonu silinsin mi?\n\n${cnt ? cnt + ' personel "' + alt.name + '" vardiyasına aktarılacak.' : 'Bu şablona atanmış personel yok.'}`);
            if (!ok) return;
            if (el) el.disabled = true;
            try {
                const res = await postJson('/api/v1/shifts/' + id + '?reassignTo=' + alt.id, {}, 'DELETE');
                S.ui.shifts.feedback = { tone: 'ok', text: res.message || 'Vardiya silindi.' };
                A.toast(S.ui.shifts.feedback.text, 'ok');
            } catch (err) {
                S.ui.shifts.feedback = { tone: 'bad', text: String((err && err.message) || err) };
                A.toast(S.ui.shifts.feedback.text, 'err');
                if (el) el.disabled = false;
            } finally {
                const synced = await D.syncAllFromPostgres({ force: true });
                if (!synced && onShiftsPage()) draw(false);
            }
        }),
        'shifts-add': syncGuard(async el => {
            const val = id => { const n = $('#' + id); return n ? n.value : ''; };
            const u = S.ui.shifts;
            Object.assign(u, { shCode: val('shCode'), shName: val('shName'), shStart: val('shStart'), shEnd: val('shEnd'), shGrace: +val('shGrace') || 0, shBreak: +val('shBreak') || 0 });
            if (!u.shStart || !u.shEnd) { A.toast('Başlangıç ve bitiş saati zorunludur.', 'err'); return; }
            if (el) el.disabled = true;
            try {
                const res = await postJson('/api/v1/shifts', {
                    code: u.shCode || ('SH-' + Math.floor(100 + Math.random() * 900)),
                    name: u.shName || 'Özel şube vardiyası',
                    startClock: u.shStart, endClock: u.shEnd,
                    graceMin: u.shGrace, breakMin: u.shBreak,
                    assignment: buildShiftAssignment()
                });
                u.feedback = { tone: 'ok', text: res.message || 'Vardiya şablonu PostgreSQL shifts tablosuna eklendi.' };
                Object.assign(u, { shCode: '', shName: '', asgScope: 'none' });
                A.toast(u.feedback.text, 'ok');
            } catch (err) {
                u.feedback = { tone: 'bad', text: String((err && err.message) || err) };
                A.toast(u.feedback.text, 'err');
            } finally {
                const synced = await D.syncAllFromPostgres({ force: true });
                if (!synced && onShiftsPage()) draw(false);
            }
        }),
        'shifts-leave-create': syncGuard(async el => {
            const val = id => { const n = $('#' + id); return n ? n.value : ''; };
            const u = S.ui.shifts;
            Object.assign(u, {
                empId: +val('shLvEmp') || u.empId, lvType: val('shLvType') || 'Saatlik izin',
                lvDate: val('shLvDate'), lvStart: val('shLvStart'), lvEnd: val('shLvEnd'),
                lvDays: +val('shLvDays') || 1, lvNote: val('shLvNote')
            });
            if (!u.empId || !u.lvDate) { A.toast('Personel ve tarih zorunludur.', 'err'); return; }
            const isHourly = u.lvType === 'Saatlik izin';
            if (el) el.disabled = true;
            try {
                const res = await postJson('/api/v1/leaves', {
                    employeeId: u.empId, leaveType: u.lvType, isHourly,
                    startDate: u.lvDate, endDate: u.lvDate,
                    startClock: isHourly ? u.lvStart : null, endClock: isHourly ? u.lvEnd : null,
                    days: isHourly ? 0.2 : u.lvDays, note: u.lvNote
                });
                u.feedback = { tone: 'ok', text: res.message || 'İzin talebi PostgreSQL leave_requests tablosuna kaydedildi.' };
                A.toast(u.feedback.text, 'ok');
            } catch (err) {
                u.feedback = { tone: 'bad', text: String((err && err.message) || err) };
                A.toast(u.feedback.text, 'err');
            } finally {
                const synced = await D.syncAllFromPostgres({ force: true });
                if (!synced && onShiftsPage()) draw(false);
            }
        }),
        'shifts-leave-decide': syncGuard(async el => {
            const code = el.dataset.code, status = el.dataset.v === 'approved' ? 'APPROVED' : 'REJECTED';
            if (!code) return;
            el.disabled = true;
            try {
                const res = await postJson('/api/v1/leaves', { code, status }, 'PATCH');
                A.toast(res.message || 'İzin durumu güncellendi.', 'ok');
            } catch (err) {
                A.toast(String((err && err.message) || err), 'err');
            } finally {
                const synced = await D.syncAllFromPostgres({ force: true });
                if (!synced) draw(false);
            }
        }),
        'late-reason-open': el => {
            const id = +(el && el.dataset.id);
            const r = (D.LATE_REASONS || []).find(x => +x.id === id);
            if (!r) { A.toast('Gecikme kaydı bulunamadı.', 'err'); return; }
            const net = Math.max(0, (r.lateMin || 0) - (r.excusedMin || 0));
            openModal('Gecikme gerekçesi · ' + (r.name || ''), `
                <div class="list-item" style="margin-bottom:12px">
                    <div class="grow">
                        <b>${esc(r.name || '')} <span class="muted" style="font-weight:500">· ${esc(r.dept || '')} · ${esc(r.workDateTr || r.workDate)}</span></b>
                        <small>Giriş saati: <b>${esc(r.checkIn || '—')}</b> · Gecikme: <b>${r.lateMin} dk</b>${r.excusedMin ? ` · Düşülen: <b>${r.excusedMin} dk</b> · Kalan: <b>${net} dk</b>` : ''}</small>
                        <small>Gerekçe: <b>${esc(lateReasonLabel(r.reasonCode))}</b>${r.reasonNote ? ' — “' + esc(r.reasonNote) + '”' : ''}</small>
                    </div>
                    ${pill(r.status === 'APPROVED' ? 'Haklı bulundu' : r.status === 'REJECTED' ? 'Reddedildi' : 'Bekliyor', r.status === 'APPROVED' ? 'ok' : r.status === 'REJECTED' ? 'bad' : 'warn')}
                </div>
                <p class="muted" style="font-size:12px;margin-bottom:10px">Haklı bulursanız gecikme dakikasından düşülür. <b>Giriş kaydı ve giriş saati değişmez</b>; yalnızca gecikme hesabı azalır.</p>
                <div class="shift-form">
                    <label class="field"><span>Gecikmeden düşülecek dakika (0 – ${r.lateMin})</span>
                        <div class="input"><input id="lrMin" type="number" min="0" max="${r.lateMin}" step="1" value="${r.excusedMin || r.lateMin}"></div>
                    </label>
                </div>`,
                `<button class="btn btn-soft" data-act="modal-close">Vazgeç</button>
                 <button class="btn btn-bad" data-act="late-reason-reject" data-id="${r.id}">${ic('x')} Reddet</button>
                 <button class="btn btn-ok" data-act="late-reason-apply" data-id="${r.id}">${ic('check')} Haklı bul ve düş</button>`);
        },
        'late-reason-apply': syncGuard(async el => {
            const id = +(el && el.dataset.id);
            const minEl = document.getElementById('lrMin');
            const excusedMinutes = minEl ? Math.max(0, parseInt(minEl.value, 10) || 0) : undefined;
            if (el) el.disabled = true;
            try {
                const res = await postJson('/api/v1/late-reasons/' + id, { action: 'approve', excusedMinutes }, 'PATCH');
                closeModal();
                A.toast(res.message || 'Gerekçe haklı bulundu.', 'ok');
            } catch (err) {
                A.toast(String((err && err.message) || err), 'err');
                if (el) el.disabled = false;
            } finally {
                const synced = await D.syncAllFromPostgres({ force: true });
                if (!synced) draw(false);
            }
        }),
        'late-reason-reject': syncGuard(async el => {
            const id = +(el && el.dataset.id);
            if (el) el.disabled = true;
            try {
                const res = await postJson('/api/v1/late-reasons/' + id, { action: 'reject' }, 'PATCH');
                closeModal();
                A.toast(res.message || 'Gerekçe reddedildi.', 'ok');
            } catch (err) {
                A.toast(String((err && err.message) || err), 'err');
                if (el) el.disabled = false;
            } finally {
                const synced = await D.syncAllFromPostgres({ force: true });
                if (!synced) draw(false);
            }
        }),
        'leave-hourly-open': () => {
            const opts = D.EMPLOYEES.slice().sort((a, b) => a.sicil.localeCompare(b.sicil, 'tr'))
                .map(e => `<option value="${e.id}">${esc(e.sicil)} · ${esc(e.name)} (${esc(e.dept)})</option>`).join('');
            const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
            const templates = [
                ['Yıllık izin', 'Yıllık izin kullanımı.', 'day'],
                ['Mazeret izni', 'Ailevi / acil mazeret nedeniyle izin talebi.', 'day'],
                ['Sağlık raporu', 'Sağlık raporu / istirahat nedeniyle izin talebi.', 'day'],
                ['Saha görevi', 'Şube dışı saha görevi / müşteri ziyareti.', 'day'],
                ['Saatlik izin', 'Resmi kurum işlemi için saatlik izin talebi.', 'hourly'],
                ['Saatlik izin', 'Doktor randevusu nedeniyle saatlik izin talebi.', 'hourly']
            ];
            openModal('İzin talebi oluştur', `
                <p class="muted" style="font-size:12.5px;margin-bottom:12px">Talebi <b>saatlik</b> veya <b>günlük</b> oluşturabilirsiniz. Onaylanan saatlik izin personelin o günkü gecikme dakikasından otomatik düşülür.</p>
                <div class="shift-form">
                    <label class="field"><span>Personel</span><div class="input"><select id="mhEmp">${opts}</select></div></label>
                    <div class="shift-form-row">
                        <label class="field"><span>Talep modu</span><div class="input"><select id="mhMode">
                            <option value="hourly">Saatlik izin</option>
                            <option value="day">Günlük izin</option>
                        </select></div></label>
                        <label class="field"><span>İzin türü</span><div class="input"><select id="mhType">
                            ${D.LEAVE_TYPES.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}
                        </select></div></label>
                    </div>
                    <label class="field"><span>Tarih</span><div class="input"><input id="mhDate" type="date" value="${today}"></div></label>
                    <div class="shift-form-row">
                        <label class="field"><span>Başlangıç saati (saatlik mod)</span><div class="input"><input id="mhStart" type="time" value="08:30"></div></label>
                        <label class="field"><span>Bitiş saati (saatlik mod)</span><div class="input"><input id="mhEnd" type="time" value="10:00"></div></label>
                    </div>
                    <label class="field"><span>Gün sayısı (günlük mod)</span><div class="input"><input id="mhDays" type="number" min="1" max="30" step="1" value="1"></div></label>
                    <div class="field"><span>Hazır izin taslakları</span>
                        <div class="row-actions" style="flex-wrap:wrap;margin-top:6px">
                            ${templates.map(([t, n, m], i) => `<button type="button" class="btn btn-soft btn-sm" data-act="leave-tpl" data-type="${esc(t)}" data-note="${esc(n)}" data-mode="${m}">${esc(t === 'Saatlik izin' && i === 5 ? 'Saatlik · Doktor' : t)}</button>`).join('')}
                        </div>
                    </div>
                    <label class="field"><span>Mazeret / açıklama</span><div class="input"><input id="mhNote" value="Resmi kurum işlemi için saatlik izin talebi."></div></label>
                </div>`, '<button class="btn btn-soft" data-act="modal-close">Vazgeç</button><button class="btn btn-primary" data-act="leave-hourly-create">Talebi Kaydet</button>');
        },
        'leave-tpl': el => {
            const type = el.dataset.type || '';
            const note = el.dataset.note || '';
            const mode = el.dataset.mode || 'day';
            const modeEl = document.getElementById('mhMode');
            const typeEl = document.getElementById('mhType');
            const noteEl = document.getElementById('mhNote');
            if (modeEl) modeEl.value = mode;
            if (typeEl && type) typeEl.value = type;
            if (noteEl) noteEl.value = note;
        },
        'leave-hourly-create': syncGuard(async el => {
            const val = id => { const n = $('#' + id); return n ? n.value : ''; };
            const employeeId = +val('mhEmp');
            if (!employeeId) { A.toast('Personel seçin.', 'err'); return; }
            const isHourly = (val('mhMode') || 'hourly') === 'hourly';
            el.disabled = true;
            try {
                const res = await postJson('/api/v1/leaves', {
                    employeeId,
                    leaveType: val('mhType') || (isHourly ? 'Saatlik izin' : 'Yıllık izin'),
                    isHourly,
                    startDate: val('mhDate'),
                    endDate: val('mhDate'),
                    startClock: isHourly ? val('mhStart') : null,
                    endClock: isHourly ? val('mhEnd') : null,
                    days: isHourly ? 0.2 : Math.max(1, parseInt(val('mhDays'), 10) || 1),
                    note: val('mhNote')
                });
                closeModal();
                A.toast(res.message || 'İzin talebi kaydedildi.', 'ok');
                const synced = await D.syncAllFromPostgres({ force: true });
                if (!synced) draw(false);
            } catch (err) {
                A.toast(String((err && err.message) || err), 'err');
                el.disabled = false;
            }
        }),
        'rpt-open': el => {
            if (el.target && el.target.closest && el.target.closest('[data-act^="export-"]')) return;
            S.ui.reportId = el.dataset.id || null;
            draw(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        'rpt-close': () => {
            S.ui.reportId = null;
            draw(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        'rpt-print': () => {
            const rptId = S.ui.reportId || 'emps';
            if (typeof A.printExecutiveReport === 'function') {
                A.printExecutiveReport(buildExecutiveReportModel(rptId));
            } else {
                window.print();
            }
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
            'late-sort': () => U.leave.lateSort = v,
            'tk-q': () => U.tk.q = v,
            'tk-type': () => U.tk.type = v,
            'al-type': () => U.alert.type = v,
            'al-show': () => U.alert.show = v,
            'dv-q': () => U.dev.q = v,
            'dv-status': () => U.dev.status = v,
            'dv-ver': () => U.dev.ver = v,
            'sim-branch': () => U.simBranch = v,
            'sim-dist': () => U.simDist = +v,
            'br-q': () => U.brQ = v,
            'wifi-disc-q': () => U.wifiDiscQ = v,
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
            'adm-branch': () => U.adm.branch = v,
            'shifts-scope': () => {
                const g = id => { const n = document.getElementById(id); return n ? n.value : ''; };
                Object.assign(U.shifts, {
                    shCode: g('shCode'), shName: g('shName'), shStart: g('shStart'), shEnd: g('shEnd'),
                    shGrace: +g('shGrace') || 0, shBreak: +g('shBreak') || 0,
                    asgScope: v || 'none'
                });
            }
        }[id] || (() => { }))();
        draw(false);
    }

    function onClick(e) {
        if (!e.target.closest('.cselect')) closeAllCustomSelects();
        const go_ = e.target.closest('[data-go]'); if (go_) { go(go_.dataset.go); return; }
        const el = e.target.closest('[data-act]'); if (el && acts[el.dataset.act]) acts[el.dataset.act](el);
    }
    let bindDebounceTimer = null;
    const DEBOUNCED_BINDS = { 'emp-q': 1, 'tk-q': 1, 'dv-q': 1, 'br-q': 1, 'wifi-disc-q': 1 };
    function onBind(e) {
        const t = e.target, id = t.dataset.bind; if (!id) return;
        const val = t.value;
        if (DEBOUNCED_BINDS[id]) {
            clearTimeout(bindDebounceTimer);
            bindDebounceTimer = setTimeout(() => applyBind(id, val), 180);
            return;
        }
        applyBind(id, val);
    }

    /* ======================= Oturum ======================= */
    const ROLE_PORTAL_NAME = { HR: 'İK Portalı', IT: 'BT Portalı', ADMIN: 'Admin Portalı' };
    const ROLE_FULL_NAME = { HR: 'İnsan Kaynakları', IT: 'Bilgi Teknolojileri', ADMIN: 'Sistem Yöneticisi (Admin)' };

    function syncTheme() {
        const activeTheme = S.user ? (localStorage.getItem('atf_theme') || 'light') : 'light';
        document.documentElement.dataset.theme = activeTheme;
        const tb = $('#themeBtn');
        if (tb) tb.innerHTML = ic(activeTheme === 'dark' ? 'sun' : 'moon');
        const sl = $('#sideLogo');
        if (sl) sl.style.color = activeTheme === 'dark' ? '#fff' : 'var(--charcoal)';
    }

    /* Giriş/çıkışta ani görünüm değişimi yerine kısa kurumsal sönümleme */
    function viewEnter(el) {
        if (!el) return;
        el.classList.remove('view-enter');
        void el.offsetWidth;
        el.classList.add('view-enter');
    }

    function startApp() {
        syncTheme();
        $('#authView').hidden = true; $('#appView').hidden = false; window.scrollTo({ top: 0 });
        viewEnter($('#appView'));
        const u = S.user; S.page = 'overview'; S.range = 30; S.fromDate = ''; S.toDate = ''; S.branch = u.branch && u.branch !== 'ALL' ? u.branch : 'ALL';
        $('#sidePortal').textContent = ROLE_PORTAL_NAME[u.role] || 'Yönetim Portalı'; $('#userName').textContent = u.name; $('#userTitle').textContent = u.title; $('#userAvatar').textContent = A.initials(u.name);
        renderBranchMenu();
        syncDateInputs();
        const h = location.hash.replace('#/', ''); if (PAGES[u.role][h]) S.page = h;
        // Profil sayfasi yenilenirse secili personeli geri yukle
        if (S.page === 'profile') {
            const kayitli = +sessionStorage.getItem('atf_emp') || 0;
            S.openEmpId = kayitli || null;
            if (!S.openEmpId || !emp(S.openEmpId)) S.page = 'employees';
        }
        buildNav(); draw(true); placeNav(); armIdle(); setTimeout(() => { placeNav(); A.placeSeg($('#rangeSeg')); }, 60);
        // PostgreSQL 18 + Prisma canlı veri ve SSE akışını başlat
        D.syncAllFromPostgres();
        D.startRealtimeStream();
        ensureLivePolling();
    }
    function logout(msg) {
        // Sunucu tarafındaki httpOnly JWT çerezini de sil
        try { fetch('/api/v1/auth', { method: 'DELETE', credentials: 'same-origin' }).catch(() => {}); } catch (_) {}
        if (A.closeCardPopover) A.closeCardPopover(true);
        document.documentElement.classList.remove('has-saved-session');
        sessionStorage.removeItem('atf_session'); sessionStorage.removeItem('atf_emp'); S.user = null; S.openEmpId = null; clearTimeout(idleTimer); closeDrawer(); closeModal();
        // Bayat DOM'a tiklanirsa JS hatasi olusmasin: icerigi temizle
        const pg = $('#page'); if (pg) pg.innerHTML = '';
        const drawerGovde = $('#drawerBody'); if (drawerGovde) drawerGovde.innerHTML = '';
        const modalGovde = $('#modalBody'); if (modalGovde) modalGovde.innerHTML = '';
        closeSide();
        syncTheme();
        $('#appView').hidden = true; $('#authView').hidden = false; $('#loginPassword').value = ''; history.replaceState(null, '', location.pathname);
        viewEnter($('#authView'));
        window.scrollTo({ top: 0, behavior: 'instant' });
        setTimeout(() => A.placeSeg($('#portalSeg')), 30); if (msg) A.toast(msg);
    }
    function armIdle() { clearTimeout(idleTimer); idleTimer = setTimeout(() => logout('Hareketsizlik nedeniyle oturum kapatıldı.'), 15 * 60 * 1000); }
    /* Sunucu rolü → arayüz portalı (Departman Müdürü İK portalını kullanır) */
    const uiRoleOf = role => (role === 'DEPT_MANAGER' ? 'HR' : role);

    function enterApp(u, offline) {
        const role = uiRoleOf(u.role);
        S.user = { email: u.email, role, name: u.name, title: u.title, branch: u.branch || 'ALL', perms: u.perms || [] };
        sessionStorage.setItem('atf_session', JSON.stringify({ email: u.email, role, name: u.name, title: u.title, branch: S.user.branch, server: !offline }));
        startApp();
        A.toast('Hoş geldiniz, ' + u.name.split(' ')[0] + (offline ? ' · sunucuya ulaşılamadı, çevrimdışı demo modu' : ''));
    }

    /* Giriş: önce PostgreSQL sunucusu (/api/v1/auth, httpOnly JWT çerezi) doğrular.
       Sunucuya hiç ulaşılamıyorsa (ağ hatası / 5xx) yalnızca yerel demo hesaplarıyla çevrimdışı demo açılır;
       bu durumda API çağrıları oturumsuz olduğundan gerçek veri döndürmez. */
    async function login(e) {
        e.preventDefault(); const err = $('#loginError'), btn = $('#loginBtn'); err.hidden = true;
        const showErr = msg => { err.textContent = msg; err.hidden = false; err.style.animation = 'none'; void err.offsetWidth; err.style.animation = ''; };
        if (Date.now() < lockUntil) { showErr('Çok fazla hatalı deneme. ' + Math.ceil((lockUntil - Date.now()) / 1000) + ' sn sonra tekrar deneyin.'); return; }
        const email = $('#loginEmail').value.trim().toLowerCase(), pass = $('#loginPassword').value;
        if (!email || !pass) { showErr('E-posta ve parolanızı girin.'); return; }

        btn.disabled = true; btn.classList.add('is-busy'); btn.setAttribute('aria-busy', 'true');
        btn.querySelector('span').textContent = 'Giriş yapılıyor…';
        const resetBtn = () => { btn.disabled = false; btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy'); btn.querySelector('span').textContent = 'Giriş yap'; };
        const registerFail = () => { fails++; if (fails >= 5) { lockUntil = Date.now() + 60000; fails = 0; } };

        let res = null;
        try {
            res = await fetch('/api/v1/auth', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ email, password: pass, portal: S.portal })
            });
        } catch (_) { res = null; }

        if (res && res.ok) {
            const data = await res.json().catch(() => null);
            resetBtn();
            if (!data || !data.user) { showErr('Sunucu yanıtı okunamadı. Lütfen tekrar deneyin.'); return; }
            fails = 0;
            enterApp(data.user, false);
            return;
        }

        if (res && res.status < 500) {
            const data = await res.json().catch(() => null);
            resetBtn(); registerFail();
            showErr((data && data.message) || 'E-posta veya parola hatalı.');
            return;
        }

        // Sunucu / veritabanı erişilemiyor → çevrimdışı demo (yerel demo hesapları)
        resetBtn();
        const acc = ACCOUNTS.find(a => a.email === email && a.pass && a.pass === pass && a.role === S.portal);
        if (!acc) {
            registerFail();
            showErr('Sunucuya ulaşılamadı ve bu bilgiler çevrimdışı demo hesaplarıyla eşleşmedi.');
            return;
        }
        if (acc.active === false) { showErr('Bu kullanıcı hesabı Sistem Yöneticisi tarafından askıya alınmıştır.'); return; }
        fails = 0;
        enterApp(acc, true);
    }

    /* ======================= Başlangıç ======================= */
    function init() {
        A.hydrate(document);
        /* Logo artık HTML/JSX içine SSR olarak gömülü gelir (ilk karede görünür).
           Yalnızca boşsa enjekte edilir; aksi hâlde React hidrasyonu ile
           çakışmaması için mevcut SVG korunur. */
        ['authLogo', 'sideLogo'].forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.querySelector('svg')) el.innerHTML = A.LOGO;
        });
        $('#authLogo').style.color = '#fff'; $('#sideLogo').style.color = 'var(--charcoal)';
        syncTheme();
        // Veri, oturum açıldıktan sonra startApp() içinde PostgreSQL'den çekilir (giriş öncesi veri sızıntısı yok).
        $('#themeBtn').onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('atf_theme', t); syncTheme(); if (S.user) draw(false); };

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
        $('#bellBtn').onclick = () => { const items = S.user.role === 'HR' ? [[`${D.LEAVES.filter(l => l.status === 'pending').length} izin talebi onay bekliyor`, 'leaves'], [`Bugün ${D.EMPLOYEES.filter(e => e.status === 'LATE').length} kişi geç kaldı`, 'employees']] : S.user.role === 'ADMIN' ? [[`${ACCOUNTS.length} portal kullanıcısı aktif`, 'overview'], [`RBAC rol ve yetki matrisi güncel`, 'permissions']] : [[`${openAlerts().length} açık güvenlik uyarısı`, 'security'], [`${openTickets().length} destek talebi bekliyor`, 'support']]; openDrawer('Bildirimler', `<div class="list">${items.map(i => `<div class="list-item" data-go="${i[1]}" tabindex="0" role="button"><span class="ico-sq red">${ic('bell')}</span><div class="grow"><b>${i[0]}</b><small>Şimdi</small></div>${ic('chevron')}</div>`).join('')}</div>`, false); };
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

            /* Klavye ile erisilebilir tiklanabilir ogeler:
               tabindex="0" + role="button" olan [data-act] / [data-go] elemanlari
               Enter veya Space ile calisir (AGENTS.md erisilebilirlik standardi). */
            if (e.key === 'Enter' || e.key === ' ') {
                const aktif = document.activeElement;
                if (aktif && aktif !== document.body && !aktif.closest('.cselect.is-open')) {
                    const isButton = aktif.getAttribute('role') === 'button' || aktif.getAttribute('role') === 'link';
                    const etiket = aktif.tagName;
                    const dogalButon = etiket === 'BUTTON' || etiket === 'A';
                    if (isButton && !dogalButon) {
                        if (aktif.hasAttribute('data-go')) {
                            e.preventDefault();
                            go(aktif.getAttribute('data-go'));
                            return;
                        }
                        if (aktif.dataset.act && acts[aktif.dataset.act]) {
                            e.preventDefault();
                            acts[aktif.dataset.act](aktif);
                            return;
                        }
                    }
                }
            }
            if (S.user) armIdle();
        });
        ['pointerdown', 'scroll'].forEach(ev => addEventListener(ev, () => { if (S.user) armIdle(); }, { passive: true }));
        addEventListener('scroll', () => $('.top').classList.toggle('is-stuck', scrollY > 4), { passive: true });
        addEventListener('resize', () => { placeNav(); A.placeSeg($('#rangeSeg')); A.placeSeg($('#portalSeg')); });
        addEventListener('hashchange', () => { if (!S.user) return; const h = location.hash.replace('#/', ''); if (h && h !== S.page) go(h); });
        addEventListener('atf:sync', scheduleShiftsSyncDraw);

        try {
            const s = JSON.parse(sessionStorage.getItem('atf_session') || 'null');
            const a = s && (s.server ? s : ACCOUNTS.find(x => x.email === s.email && x.role === s.role));
            if (a && a.name && PAGES[a.role]) {
                document.documentElement.classList.add('has-saved-session');
                S.user = { email: a.email, role: a.role, name: a.name, title: a.title, branch: a.branch || 'ALL', perms: a.perms || [] }; S.portal = a.role; startApp();
                // F5 sonrası sunucu oturumunu (JWT çerezi) doğrula; süresi dolmuşsa çıkış yap
                if (s.server) {
                    fetch('/api/v1/auth', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
                        .then(r => (r.ok ? r.json() : null))
                        .then(d => { if (d && !d.user && S.user) logout('Oturum süresi doldu, lütfen tekrar giriş yapın.'); })
                        .catch(() => {});
                }
                return;
            }
        } catch (e) { sessionStorage.removeItem('atf_session'); }
        requestAnimationFrame(() => A.placeSeg($('#portalSeg'))); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => A.placeSeg($('#portalSeg')));
    }
    function closeSide() { $('#side').classList.remove('on'); $('#scrim').classList.remove('on'); }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
