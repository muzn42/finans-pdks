/* ==========================================================================
   core.js · ikonlar, yardımcılar, grafik çizicileri, animasyonlu indirme,
             rapor tipi Excel (.xls) üretici ve sürükle-bırak panel motoru
   ========================================================================== */
(function (g) {
    'use strict';
    const ATF = g.ATF = g.ATF || {};

    /* ---------- Küçük yardımcılar ---------- */
    ATF.$ = (s, r) => (r || document).querySelector(s);
    ATF.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
    ATF.pad = n => String(n).padStart(2, '0');
    ATF.fmt = n => Number(n).toLocaleString('tr-TR');
    ATF.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    // NaN / Infinity güvenli sınırlama: geçersiz değer gelirse alt sınır döner (ekranlarda "NaN" görünmesini engeller)
    ATF.clamp = (v, a, b) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : a);
    // Geçersiz sayıları güvenli bir varsayılana çeker
    ATF.num = (v, fb) => (Number.isFinite(+v) ? +v : (fb == null ? 0 : fb));
    // Yüzde metni: 91.4 -> "91,4"  ·  geçersiz değer -> "—"
    ATF.pctText = (v, dec) => (Number.isFinite(+v) ? (+v).toFixed(dec == null ? 1 : dec).replace('.', ',') : '—');
    // Sayı metni: geçersiz değer -> "—"
    ATF.numText = (v, dec) => (Number.isFinite(+v) ? (+v).toFixed(dec == null ? 1 : dec).replace('.', ',') : '—');
    ATF.rng = function (seed) {
        let t = seed >>> 0;
        return function () {
            t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t);
            r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
            return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
        };
    };
    ATF.hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
    ATF.initials = n => n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toLocaleUpperCase('tr-TR');

    /* ---------- Simge seti (çizgi, 24px) ---------- */
    const I = {
        grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
        users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.8 20c0-3.5 2.8-5.8 6.2-5.8s6.2 2.3 6.2 5.8"/><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18.2 14.5c2 .7 3.2 2.5 3.2 5.5"/>',
        calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
        chart: '<path d="M5 20v-7M12 20V5M19 20V10"/>',
        shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.1 8-7.5 9.5-4.4-1.5-7.5-4.9-7.5-9.5V6L12 3z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
        pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
        phone: '<rect x="7" y="2.5" width="10" height="19" rx="3"/><path d="M11 18.5h2"/>',
        key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
        inbox: '<path d="M3 13l2.5-8h13L21 13v6H3z"/><path d="M3 13h5l1 2h6l1-2h5"/>',
        file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
        search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>',
        bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z"/><path d="M10 21h4"/>',
        logout: '<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
        moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
        download: '<path d="M12 4v11M7 11l5 5 5-5M4 20h16"/>',
        check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
        x: '<path d="M6 6l12 12M18 6L6 18"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        alert: '<path d="M12 3.5l9.5 16.5h-19L12 3.5z"/><path d="M12 10v4.5M12 17.5v.01"/>',
        building: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-4h4v4"/>',
        refresh: '<path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4"/>',
        menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
        lock: '<rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
        activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
        chevron: '<path d="M9 6l6 6-6 6"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7.5l8.5 6 8.5-6"/>',
        eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
        arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
        up: '<path d="M7 17L17 7M9 7h8v8"/>',
        down: '<path d="M7 7l10 10M17 9v8H9"/>',
        flat: '<path d="M5 12h14"/>',
        copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/>',
        unlink: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/><path d="M4 4l16 16"/>',
        wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 16a5 5 0 0 1 6.4 0M12 19.5v.01"/>',
        list: '<path d="M8 6h12M8 12h12M8 18h12M4 6v.01M4 12v.01M4 18v.01"/>',
        server: '<rect x="3.5" y="4" width="17" height="6.5" rx="2.5"/><rect x="3.5" y="13.5" width="17" height="6.5" rx="2.5"/><path d="M7.5 7.25v.01M7.5 16.75v.01"/>',
        filter: '<path d="M3.5 5h17l-6.5 7.5V19l-4-2v-4.5L3.5 5z"/>',
        grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
        expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'
    };
    ATF.ICONS = I;
    ATF.ic = (n, c) => `<svg class="ic${c ? ' ' + c : ''}" viewBox="0 0 24 24">${I[n] || ''}</svg>`;
    ATF.hydrate = root => ATF.$$('svg[data-i]', root).forEach(s => { s.innerHTML = I[s.dataset.i] || ''; });

    ATF.LOGO = '<svg viewBox="0 0 153 129" fill="none" xmlns="http://www.w3.org/2000/svg"><g transform="translate(-145, 363) scale(1, -1)"><g transform="translate(197.405, 269.5309)"><path fill="#5F6366" d="M 17.5,-17.24 L 31.726,-31.262 c 2.511,-2.542 5.763,-3.943 9.158,-3.943 3.395,0 6.647,1.401 9.157,3.943 l 44.358,43.655 c 5.438,5.507 5.955,15.036 1.153,21.241 -2.44,3.153 -5.841,5.014 -9.575,5.239 -3.659,0.213 -7.179,-1.171 -9.893,-3.919 L 46.277,5.838 c -2.8,-2.73 -7.1,-2.9 -10.2,-0.55 Q 34.6,6.4 33.5,4.8 L 17.5,-17.24 Z"/></g><g transform="translate(199.7247, 239.8713)"><path fill="#E11D24" fill-rule="evenodd" d="m 0,0 -28.313,28.313 c -2.046,2.046 -5.545,0.597 -5.545,-2.297 V -2.297 c 0,-1.794 1.455,-3.248 3.249,-3.248 H -2.297 C 0.597,-5.545 2.046,-2.046 0,0"/></g><g transform="translate(239.0149, 336.7379)"><path fill="#E11D24" d="m 0,0 -0.127,-0.126 -18.945,19.182 c -6.788,6.874 -17.885,6.874 -24.673,0 l -34.858,-35.039 -10.58,-10.624 c -0.018,-0.018 -0.03,-0.036 -0.048,-0.054 -3.045,-2.998 -4.767,-7.336 -4.191,-12.063 0.805,-6.608 6.241,-11.887 12.867,-12.526 4.142,-0.4 7.956,0.968 10.807,3.423 0.621,0.448 1.22,0.94 1.778,1.505 l 28.399,28.755 c 4.491,4.548 11.833,4.548 16.325,0 l 23.119,-23.409 20.537,20.31 z"/></g></g><path fill="#E11D24" fill-rule="evenodd" d="M 47.36 83.08 A 20.75 20.75 0 1 1 82.40 83.08 Q 75.70 96.30 64.88 110.69 Q 54.06 96.30 47.36 83.08 Z M 55.58 71.96 A 9.30 9.30 0 1 0 74.18 71.96 A 9.30 9.30 0 1 0 55.58 71.96 Z"/></svg>';

    /* ---------- Animasyonlu İndirme Butonu (Reel Mikro-Etkileşimli) ---------- */
    ATF.dlBtn = function (act, label, opts) {
        const o = opts || {};
        const cls = o.cls || 'btn-dark btn-sm';
        const extra = o.id != null ? ` data-id="${ATF.esc(o.id)}"` : '';
        return `<button class="btn ${cls} dl-btn" data-act="${ATF.esc(act)}"${extra} data-label="${ATF.esc(label || 'Excel Rapor')}">
            <span class="dl-fill"></span>
            <span class="dl-ic-wrap">
                <svg class="dl-svg-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path class="dl-arrow-stem" d="M12 4v11M7.5 11.5L12 16l4.5-4.5"/>
                    <path class="dl-tray" d="M4 19.5h16"/>
                </svg>
                <svg class="dl-svg-ring" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-opacity=".22" stroke-width="2.4"/>
                    <circle class="dl-ring-prog" cx="12" cy="12" r="8.5" stroke="#E31E24" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="53.4" stroke-dashoffset="53.4" transform="rotate(-90 12 12)"/>
                </svg>
                <svg class="dl-svg-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path class="dl-check-path" d="M5 12.5l4.5 4.5L19 7.5"/>
                </svg>
            </span>
            <span class="dl-txt">${ATF.esc(label || 'Excel Rapor')}</span>
        </button>`;
    };

    ATF.runDownload = function (btn, taskFn) {
        if (!btn || !btn.classList.contains('dl-btn')) { taskFn && taskFn(); return; }
        if (btn.classList.contains('is-loading') || btn.classList.contains('is-done')) return;
        const txtEl = btn.querySelector('.dl-txt'), ringEl = btn.querySelector('.dl-ring-prog'), fillEl = btn.querySelector('.dl-fill');
        const origLabel = btn.dataset.label || (txtEl ? txtEl.textContent : 'İndir');
        btn.classList.add('is-loading');
        const t0 = performance.now(), dur = 920;
        const step = now => {
            const p = Math.min(1, (now - t0) / dur);
            const ease = 1 - Math.pow(1 - p, 3);
            const pct = Math.round(ease * 100);
            if (txtEl) txtEl.textContent = pct + '%';
            if (ringEl) ringEl.style.strokeDashoffset = (53.4 * (1 - ease)).toFixed(1);
            if (fillEl) fillEl.style.transform = `scaleX(${ease.toFixed(3)})`;
            if (p < 1) {
                requestAnimationFrame(step);
            } else {
                btn.classList.remove('is-loading');
                btn.classList.add('is-done');
                if (txtEl) txtEl.textContent = 'İndirildi';
                try { taskFn && taskFn(); } catch (e) { console.error(e); }
                setTimeout(() => {
                    btn.classList.remove('is-done');
                    if (txtEl) txtEl.textContent = origLabel;
                    if (ringEl) ringEl.style.strokeDashoffset = '53.4';
                    if (fillEl) fillEl.style.transform = 'scaleX(0)';
                }, 1700);
            }
        };
        requestAnimationFrame(step);
    };

    /* ---------- Sayaç animasyonu ---------- */
    ATF.countUp = function (root) {
        const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        ATF.$$('[data-count]', root).forEach(el => {
            const to = parseFloat(el.dataset.count), dec = parseInt(el.dataset.dec || '0', 10);
            const out = v => v.toLocaleString('tr-TR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
            if (reduce || isNaN(to)) { el.textContent = out(to); return; }
            const t0 = performance.now(), dur = 1100;
            const step = now => {
                const p = Math.min(1, (now - t0) / dur), e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
                el.textContent = out(to * e);
                if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        });
    };

    /* ---------- Grafik yardımcıları ---------- */
    let uid = 0;
    const niceStep = x => { const p = Math.pow(10, Math.floor(Math.log10(x || 1))), m = x / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; };
    const smooth = (pts, top, bot) => {
        if (pts.length < 2) return '';
        const cl = v => Math.min(bot, Math.max(top, v));
        let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = 0.17;
            d += ` C${(p1[0] + (p2[0] - p0[0]) * t).toFixed(1)},${cl(p1[1] + (p2[1] - p0[1]) * t).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) * t).toFixed(1)},${cl(p2[1] - (p3[1] - p1[1]) * t).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
        }
        return d;
    };
    const tipBox = host => { let t = host.querySelector('.tip'); if (!t) { t = document.createElement('div'); t.className = 'tip'; host.appendChild(t); } return t; };

    /** Alan grafiği. series[0] ana seri (dolgulu), diğerleri kesikli çizgi. */
    ATF.areaChart = function (host, o) {
        if (!host) return;
        const W = 640, H = o.h || 250, L = 40, R = 10, T = 14, B = 26, iw = W - L - R, ih = H - T - B, ticks = 4;
        const all = o.series.flatMap(s => s.data), n = o.labels.length;
        const yMin = o.yMin != null ? o.yMin : 0;
        const step = niceStep(((o.yMax != null ? o.yMax : Math.max(...all)) - yMin) / ticks);
        const max = yMin + step * ticks;
        const x = i => L + (n === 1 ? iw / 2 : i * iw / (n - 1));
        const y = v => T + ih - ((v - yMin) / (max - yMin)) * ih;
        const id = 'ag' + (++uid), yf = o.yFmt || (v => v);
        let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${ATF.esc(o.aria || 'Grafik')}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E31E24" stop-opacity=".22"/><stop offset="1" stop-color="#E31E24" stop-opacity="0"/></linearGradient></defs>`;
        for (let t = 0; t <= ticks; t++) { const v = yMin + step * t, yy = y(v); s += `<line class="grid-line" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text class="ax" x="${L - 8}" y="${yy + 4}" text-anchor="end">${yf(+v.toFixed(2))}</text>`; }
        const every = Math.ceil(n / 8);
        o.labels.forEach((l, i) => { if (i % every === 0 || i === n - 1) s += `<text class="ax" x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${ATF.esc(l)}</text>`; });
        o.series.forEach((se, k) => {
            const pts = se.data.map((v, i) => [x(i), y(v)]), d = smooth(pts, T, T + ih);
            if (k === 0) s += `<path class="fade" d="${d} L${x(n - 1)},${T + ih} L${x(0)},${T + ih} Z" fill="url(#${id})"/>`;
            s += `<path class="area-line draw${k ? ' alt' : ''}" d="${d}"/>`;
        });
        s += `<line class="hover-line" y1="${T}" y2="${T + ih}"/><circle class="hover-dot" r="5"/><rect class="hit" x="${L}" y="0" width="${iw}" height="${H}" fill="transparent"/></svg>`;
        host.classList.add('chart'); host.innerHTML = s;
        const svg = host.querySelector('svg'), dot = svg.querySelector('.hover-dot'), line = svg.querySelector('.hover-line'), tip = tipBox(host);
        svg.querySelectorAll('.draw').forEach(p => p.style.setProperty('--len', Math.ceil(typeof p.getTotalLength === 'function' ? p.getTotalLength() : 640)));
        const move = e => {
            const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W;
            const i = ATF.clamp(Math.round((px - L) / iw * (n - 1)), 0, n - 1), v = o.series[0].data[i];
            dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(v)); line.setAttribute('x1', x(i)); line.setAttribute('x2', x(i));
            dot.style.opacity = line.style.opacity = 1;
            tip.innerHTML = o.tip ? o.tip(i, o.series.map(q => q.data[i])) : `<b>${ATF.esc(o.labels[i])}</b>${yf(v)}`;
            tip.style.left = (x(i) / W * r.width) + 'px'; tip.style.top = (y(v) / H * r.height) + 'px'; tip.classList.add('on');
        };
        svg.addEventListener('pointermove', move);
        svg.addEventListener('pointerleave', () => { dot.style.opacity = line.style.opacity = 0; tip.classList.remove('on'); });
    };

    /** Dikey çubuk grafiği. data: [{label, value, color?}] */
    ATF.barChart = function (host, o) {
        if (!host) return;
        const W = 640, H = o.h || 230, L = 36, R = 8, T = 12, B = 26, iw = W - L - R, ih = H - T - B, ticks = 4, n = o.data.length;
        const step = niceStep((o.yMax != null ? o.yMax : Math.max(...o.data.map(d => d.value), 1)) / ticks), max = step * ticks;
        const bw = Math.min(46, iw / n * 0.58), y = v => T + ih - (v / max) * ih, yf = o.yFmt || (v => v);
        let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${ATF.esc(o.aria || 'Grafik')}">`;
        for (let t = 0; t <= ticks; t++) { const v = step * t, yy = y(v); s += `<line class="grid-line" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text class="ax" x="${L - 8}" y="${yy + 4}" text-anchor="end">${yf(+v.toFixed(2))}</text>`; }
        const every = Math.ceil(n / 12);
        o.data.forEach((d, i) => {
            const cx = L + (i + .5) * iw / n, hh = Math.max(2, ih - (y(d.value) - T));
            s += `<rect class="bar" data-i="${i}" style="--k:${i}" x="${cx - bw / 2}" y="${T + ih - hh}" width="${bw}" height="${hh}" rx="6" fill="${d.color || (i === n - 1 && o.accentLast ? '#E31E24' : (o.color || '#1C1D1F'))}"/>`;
            if (i % every === 0) s += `<text class="ax" x="${cx}" y="${H - 6}" text-anchor="middle">${ATF.esc(d.label)}</text>`;
        });
        s += '</svg>';
        host.classList.add('chart'); host.innerHTML = s;
        const svg = host.querySelector('svg'), tip = tipBox(host);
        svg.addEventListener('pointermove', e => {
            const b = e.target.closest('.bar'); if (!b) { tip.classList.remove('on'); return; }
            const d = o.data[+b.dataset.i], bb = b.getBoundingClientRect(), hr = host.getBoundingClientRect();
            tip.innerHTML = o.tip ? o.tip(d) : `<b>${ATF.esc(d.label)}</b>${yf(d.value)}`;
            tip.style.left = (bb.left - hr.left + bb.width / 2) + 'px'; tip.style.top = (bb.top - hr.top) + 'px'; tip.classList.add('on');
        });
        svg.addEventListener('pointerleave', () => tip.classList.remove('on'));
    };

    /** Halka grafiği. items: [{label,value,color}] */
    ATF.donut = function (host, o) {
        if (!host) return;
        const R = 62, C = 2 * Math.PI * R, total = o.items.reduce((a, b) => a + b.value, 0) || 1;
        let acc = 0, segs = '';
        o.items.forEach((it, i) => {
            const len = Math.max(0, it.value / total * C - 3);
            segs += `<circle class="donut-seg" data-i="${i}" cx="80" cy="80" r="${R}" fill="none" stroke="${it.color}" stroke-width="16" stroke-linecap="round" stroke-dasharray="0 ${C}" data-len="${len}" stroke-dashoffset="${-acc}" transform="rotate(-90 80 80)"/>`;
            acc += it.value / total * C;
        });
        host.innerHTML = `<div class="donut-wrap"><div style="position:relative;width:170px;height:170px"><svg viewBox="0 0 160 160" width="170" height="170" role="img" aria-label="${ATF.esc(o.aria || 'Dağılım')}"><circle cx="80" cy="80" r="${R}" fill="none" stroke="var(--line-2)" stroke-width="16"/>${segs}</svg><div class="donut-center"><b>${o.centerTop}</b><small>${ATF.esc(o.centerSub || '')}</small></div></div><div class="legend">${o.items.map((it, i) => `<div class="legend-row" data-i="${i}"><i style="background:${it.color}"></i><span>${ATF.esc(it.label)}</span><b>${ATF.fmt(it.value)}</b></div>`).join('')}</div></div>`;
        const segEls = host.querySelectorAll('.donut-seg');
        requestAnimationFrame(() => requestAnimationFrame(() => segEls.forEach((c, i) => { c.style.transition = `stroke-dasharray 1s var(--ease) ${i * 90}ms`; c.setAttribute('stroke-dasharray', `${c.dataset.len} ${C}`); })));
        host.querySelectorAll('.legend-row').forEach(r => {
            r.addEventListener('pointerenter', () => segEls.forEach(c => { c.style.opacity = c.dataset.i === r.dataset.i ? 1 : .25; c.setAttribute('stroke-width', c.dataset.i === r.dataset.i ? 20 : 16); }));
            r.addEventListener('pointerleave', () => segEls.forEach(c => { c.style.opacity = 1; c.setAttribute('stroke-width', 16); }));
        });
    };

    /** Isı haritası. rows: [{label, cells:[0..1]}] */
    ATF.heatmap = function (host, o) {
        if (!host) return;
        const cols = o.cols.length;
        let h = `<div class="heat" style="--cols:${cols}"><div class="heat-cols"><span></span>${o.cols.map(c => `<span>${ATF.esc(c)}</span>`).join('')}</div>`;
        o.rows.forEach((r, ri) => {
            h += `<div class="heat-row"><span>${ATF.esc(r.label)}</span>${r.cells.map((v, ci) => `<i class="heat-cell" style="--o:${(0.07 + v * 0.93).toFixed(2)};transition-delay:${(ri * cols + ci) * 12}ms" title="${ATF.esc(r.label + ' · ' + o.cols[ci] + ': ' + (o.tip ? o.tip(v) : Math.round(v * 100) + '%'))}"></i>`).join('')}</div>`;
        });
        host.innerHTML = h + '</div>';
    };

    ATF.spark = function (vals, color) {
        const W = 84, H = 30, mx = Math.max(...vals), mn = Math.min(...vals), rg = (mx - mn) || 1;
        const pts = vals.map((v, i) => [i * W / (vals.length - 1), H - 3 - ((v - mn) / rg) * (H - 6)]);
        return `<svg class="spark" viewBox="0 0 ${W} ${H}"><path d="${smooth(pts, 0, H)}" fill="none" stroke="${color || '#E31E24'}" stroke-width="2" stroke-linecap="round"/></svg>`;
    };

    /* ---------- Segment kontrol göstergesi ---------- */
    ATF.placeSeg = function (seg) {
        if (!seg) return;
        const th = seg.querySelector('.seg-thumb'), b = seg.querySelector('.seg-btn.is-active');
        if (!th || !b || !b.offsetWidth) return;
        th.style.width = b.offsetWidth + 'px'; th.style.transform = `translateX(${b.offsetLeft}px)`;
    };

    /* ---------- Bildirim (toast) ---------- */
    ATF.toast = function (msg, kind) {
        const host = ATF.$('#toasts');
        if (!host) return;

        // Aynı mesaj kısa süre içinde tekrar tetiklenirse yeni kutu açmak yerine mevcut bildirimi tazele
        const same = Array.from(host.children).find(t => t.dataset.msg === msg && !t.classList.contains('out'));
        if (same) {
            clearTimeout(+same.dataset.timer);
            same.dataset.timer = setTimeout(() => { same.classList.add('out'); setTimeout(() => same.remove(), 320); }, 3200);
            return;
        }

        // Üst üste yığılmayı engelle: ekranda en fazla 3 bildirim dursun
        while (host.children.length >= 3) host.firstElementChild.remove();

        const t = document.createElement('div');
        t.className = 'toast' + (kind === 'err' ? ' err' : '');
        t.dataset.msg = msg;
        t.innerHTML = ATF.ic(kind === 'err' ? 'alert' : 'check') + '<span></span>';
        t.querySelector('span').textContent = msg;
        host.appendChild(t);
        t.dataset.timer = setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 3200);
    };

    /* ---------- Sürükle-Bırak (Drag & Drop) Kişiselleştirilebilir Panel Motoru ---------- */
    ATF.enableDragGrid = function (root, storageKey) {
        if (!root) return;

        /* Sayfa her yeniden çizildiğinde (draw) aynı köke yeniden dinleyici eklenmesini engelle.
           Aksi halde tek bir bırakma işlemi N kez çalışır: kart bir ileri bir geri taşınır
           (yer değiştirmiyor gibi görünür) ve N adet "Panel düzeni kaydedildi" bildirimi çıkar. */
        if (root.__dndAbort) { try { root.__dndAbort.abort(); } catch (e) { } }
        const ac = new AbortController();
        root.__dndAbort = ac;
        const on = (type, fn) => root.addEventListener(type, fn, { signal: ac.signal });

        const grids = ATF.$$('.grid', root);
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (e) { saved = {}; }

        grids.forEach((grid, gi) => {
            const gKey = 'g' + gi;
            const cards = Array.from(grid.children).filter(el => el.classList.contains('card'));
            if (cards.length < 2) return;
            grid.classList.add('dnd-grid');

            cards.forEach((card, ci) => {
                if (!card.dataset.wid) card.dataset.wid = gKey + '-w' + ci;
                const wid = card.dataset.wid;
                if (saved.spans && saved.spans[wid]) card.classList.add('span-wide');

                // Sürükleme tutamacı ve genişletme butonu ekle
                if (!card.querySelector('.dnd-bar')) {
                    const bar = document.createElement('div');
                    bar.className = 'dnd-bar';
                    bar.innerHTML = `
                        <button type="button" class="dnd-btn dnd-span" title="Kart genişliğini değiştir" aria-label="Boyutlandır">${ATF.ic('expand')}</button>
                        <span class="dnd-handle" title="Sürükleyip yerini değiştirin">${ATF.ic('grip')}</span>
                    `;
                    card.appendChild(bar);
                    bar.querySelector('.dnd-span').addEventListener('click', e => {
                        e.stopPropagation();
                        card.classList.toggle('span-wide');
                        saveState();
                        ATF.toast(card.classList.contains('span-wide') ? 'Kart genişletildi' : 'Kart varsayılan boyuta döndü');
                    });
                }
                card.setAttribute('draggable', 'true');
            });

            // Kayıtlı sıralamayı uygula
            if (saved.order && Array.isArray(saved.order[gKey])) {
                const map = new Map(cards.map(c => [c.dataset.wid, c]));
                saved.order[gKey].forEach(id => { if (map.has(id)) grid.appendChild(map.get(id)); });
            }
        });

        function saveState() {
            const order = {}, spans = {};
            grids.forEach((grid, gi) => {
                const cs = Array.from(grid.children).filter(el => el.classList.contains('card'));
                order['g' + gi] = cs.map(c => c.dataset.wid);
                cs.forEach(c => { if (c.classList.contains('span-wide')) spans[c.dataset.wid] = 1; });
            });
            try { localStorage.setItem(storageKey, JSON.stringify({ order, spans })); } catch (e) { }
        }

        let dragged = null;
        on('dragstart', e => {
            const card = e.target.closest('.card[draggable="true"]');
            if (!card) return;
            dragged = card;
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', card.dataset.wid || ''); } catch (err) { }
            requestAnimationFrame(() => card.classList.add('is-dragging'));
        });

        on('dragend', () => {
            if (dragged) dragged.classList.remove('is-dragging');
            ATF.$$('.is-drop-target', root).forEach(el => el.classList.remove('is-drop-target'));
            dragged = null;
        });

        on('dragover', e => {
            if (!dragged) return;
            const over = e.target.closest('.card[draggable="true"]');
            if (!over || over === dragged || over.parentElement !== dragged.parentElement) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            ATF.$$('.is-drop-target', root).forEach(el => { if (el !== over) el.classList.remove('is-drop-target'); });
            over.classList.add('is-drop-target');
        });

        on('dragleave', e => {
            const over = e.target.closest('.card[draggable="true"]');
            // Sadece kartın tamamen dışına çıkıldığında hedef işaretini kaldır (iç elemanlara geçişte titremesin)
            if (over && e.relatedTarget && over.contains(e.relatedTarget)) return;
            if (over) over.classList.remove('is-drop-target');
        });

        on('drop', e => {
            if (!dragged) return;
            const target = e.target.closest('.card[draggable="true"]');
            if (!target || target === dragged || target.parentElement !== dragged.parentElement) return;
            e.preventDefault();
            target.classList.remove('is-drop-target');

            const parent = target.parentElement;
            const children = Array.from(parent.children);
            const dragIdx = children.indexOf(dragged);
            const targetIdx = children.indexOf(target);
            if (dragIdx < targetIdx) {
                parent.insertBefore(dragged, target.nextSibling);
            } else {
                parent.insertBefore(dragged, target);
            }
            dragged.classList.remove('is-dragging');
            dragged = null;
            saveState();
            ATF.toast('Panel düzeni kaydedildi');
        });
    };

    ATF.resetDragLayout = function (storageKey, onDone) {
        try { localStorage.removeItem(storageKey); } catch (e) { }
        ATF.toast('Panel düzeni varsayılana sıfırlandı');
        if (onDone) onDone();
    };

    /* ---------- Gerçek OpenXML (.xlsx) Kurumsal Rapor Üretici (PC & Mobil Office Uyumlu) ---------- */
    const crcTable = (() => {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[n] = c >>> 0;
        }
        return t;
    })();

    function crc32Bytes(u8) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < u8.length; i++) {
            crc = (crc >>> 8) ^ crcTable[(crc ^ u8[i]) & 0xFF];
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function createZipBlob(files) {
        const enc = new TextEncoder();
        const entries = files.map(f => {
            const nameBytes = enc.encode(f.name);
            // content: string (XML) veya Uint8Array (PNG gibi ikili dosyalar)
            const dataBytes = (f.content instanceof Uint8Array) ? f.content : enc.encode(f.content);
            const crc = crc32Bytes(dataBytes);
            return { nameBytes, dataBytes, crc, offset: 0 };
        });

        let totalLocal = 0;
        let totalCentral = 0;
        entries.forEach(e => {
            e.offset = totalLocal;
            totalLocal += 30 + e.nameBytes.length + e.dataBytes.length;
            totalCentral += 46 + e.nameBytes.length;
        });

        const out = new Uint8Array(totalLocal + totalCentral + 22);
        const dv = new DataView(out.buffer);
        let p = 0;

        entries.forEach(e => {
            dv.setUint32(p, 0x04034b50, true);
            dv.setUint16(p + 4, 20, true);
            dv.setUint16(p + 6, 0x0800, true); // UTF-8
            dv.setUint16(p + 8, 0, true);      // STORED (0)
            dv.setUint16(p + 10, 0, true);
            dv.setUint16(p + 12, 0x5421, true);
            dv.setUint32(p + 14, e.crc, true);
            dv.setUint32(p + 18, e.dataBytes.length, true);
            dv.setUint32(p + 22, e.dataBytes.length, true);
            dv.setUint16(p + 26, e.nameBytes.length, true);
            dv.setUint16(p + 28, 0, true);
            out.set(e.nameBytes, p + 30);
            out.set(e.dataBytes, p + 30 + e.nameBytes.length);
            p += 30 + e.nameBytes.length + e.dataBytes.length;
        });

        const cdStart = p;
        entries.forEach(e => {
            dv.setUint32(p, 0x02014b50, true);
            dv.setUint16(p + 4, 20, true);
            dv.setUint16(p + 6, 20, true);
            dv.setUint16(p + 8, 0x0800, true);
            dv.setUint16(p + 10, 0, true);
            dv.setUint16(p + 12, 0, true);
            dv.setUint16(p + 14, 0x5421, true);
            dv.setUint32(p + 16, e.crc, true);
            dv.setUint32(p + 20, e.dataBytes.length, true);
            dv.setUint32(p + 24, e.dataBytes.length, true);
            dv.setUint16(p + 28, e.nameBytes.length, true);
            dv.setUint16(p + 30, 0, true);
            dv.setUint16(p + 32, 0, true);
            dv.setUint16(p + 34, 0, true);
            dv.setUint16(p + 36, 0, true);
            dv.setUint32(p + 38, 0, true);
            dv.setUint32(p + 42, e.offset, true);
            out.set(e.nameBytes, p + 46);
            p += 46 + e.nameBytes.length;
        });

        const cdSize = p - cdStart;
        dv.setUint32(p, 0x06054b50, true);
        dv.setUint16(p + 4, 0, true);
        dv.setUint16(p + 6, 0, true);
        dv.setUint16(p + 8, entries.length, true);
        dv.setUint16(p + 10, entries.length, true);
        dv.setUint32(p + 12, cdSize, true);
        dv.setUint32(p + 16, cdStart, true);
        dv.setUint16(p + 20, 0, true);

        return new Blob([out], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
    }

    function colRef(idx) {
        let s = '';
        let n = idx + 1;
        while (n > 0) {
            const m = (n - 1) % 26;
            s = String.fromCharCode(65 + m) + s;
            n = Math.floor((n - 1) / 26);
        }
        return s;
    }

    /* Kurumsal logo (xlsx gömme icin PNG baytlari). Tek sefer yuklenir, hata olursa null. */
    const LOGO_ASSET = 'assets/branding/albayrak_pdks_logo.png';
    const LOGO_ASPECT = 129 / 153; // yukseklik / genislik
    let logoBytesPromise = null;
    function loadLogoBytes() {
        if (!logoBytesPromise) {
            if (typeof fetch !== 'function') { logoBytesPromise = Promise.resolve(null); return logoBytesPromise; }
            logoBytesPromise = fetch(LOGO_ASSET)
                .then(r => (r.ok ? r.arrayBuffer() : null))
                .then(buf => (buf ? new Uint8Array(buf) : null))
                .catch(() => null);
        }
        return logoBytesPromise;
    }

    /* Logo cizim parcasi (drawing1.xml) */
    function logoDrawingXml(widthPx) {
        const emu = px => Math.round(px * 9525);
        const cx = emu(widthPx);
        const cy = emu(Math.round(widthPx * LOGO_ASPECT));
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <xdr:oneCellAnchor>
    <xdr:from><xdr:col>0</xdr:col><xdr:colOff>76200</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>28575</xdr:rowOff></xdr:from>
    <xdr:ext cx="${cx}" cy="${cy}"/>
    <xdr:pic>
      <xdr:nvPicPr>
        <xdr:cNvPr id="2" name="Albayrak Finans Logosu" descr="Albayrak Tasarruf Finansman A.Ş. kurumsal logosu"/>
        <xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>
      </xdr:nvPicPr>
      <xdr:blipFill>
        <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/>
        <a:stretch><a:fillRect/></a:stretch>
      </xdr:blipFill>
      <xdr:spPr>
        <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      </xdr:spPr>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:oneCellAnchor>
</xdr:wsDr>`;
    }

    const drawingRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>`;

    const sheet1RelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`;

    function xmlEsc(v) {
        let s = String(v == null ? '' : v);
        if (/^[=+\-@]/.test(s)) s = "'" + s;
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    }

    ATF.excelReport = async function (opts) {
        const o = opts || {};
        const fileName = (o.fileName || 'albayrak-pdks-rapor').replace(/\.(csv|xls|xlsx)$/i, '') + '.xlsx';
        const title = o.title || 'ALBAYRAK FİNANS KURUMSAL PDKS RAPORU';
        const subtitle = o.subtitle || 'İnsan Kaynakları ve Konum Doğrulama Analitiği';
        const meta = o.meta || [];
        const kpis = o.kpis || [];
        const summaryTitle = o.summaryTitle || 'DEPARTMAN BAZLI UYUM, EK MESAİ VE NET BAKİYE ÖZETİ';
        const summaryHeaders = o.summaryHeaders || [];
        const summaryRows = o.summaryRows || [];
        const headers = o.headers || [];
        const rows = o.rows || [];
        const notes = o.notes || [];
        const preparedBy = o.preparedBy || '';
        const approvedBy = o.approvedBy || 'İnsan Kaynakları Müdürlüğü';
        const nowDate = new Date();
        const nowStr = nowDate.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const reportNo = o.reportNo || `PDKS-${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}${String(nowDate.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
        const logoBytes = await loadLogoBytes();
        const hasLogo = !!(logoBytes && logoBytes.length);

        const detectStatusStyleIdx = (val, rowIdx) => {
            const s = String(val || '').toLocaleLowerCase('tr-TR');
            if (s.includes('ofiste') || s.includes('zamanında') || s.includes('onaylandı') || s.includes('çözüldü') || s.includes('eşlendi') || s.includes('uygun') || s.includes('hedef üstü') || s.includes('pozitif')) {
                return 8; // OK (Yeşil Rozet)
            }
            if (s.includes('geç') || s.includes('bekliyor') || s.includes('orta') || s.includes('işlemde') || s.includes('uyarı') || s.includes('normal') || s.includes('izlenmeli')) {
                return 9; // WARN (Kehribar Rozet)
            }
            if (s.includes('devamsız') || s.includes('reddedildi') || s.includes('yüksek') || s.includes('engelli') || s.includes('ihlal') || s.includes('alan dışı') || s.includes('kritik') || s.includes('negatif')) {
                return 10; // BAD (Kırmızı Rozet)
            }
            return (rowIdx % 2 === 1) ? 7 : 6;
        };

        const sharedStrings = [];
        const sharedMap = new Map();
        const getSstIdx = (val) => {
            let s = String(val == null ? '' : val);
            if (/^[=+\-@]/.test(s)) s = "'" + s;
            s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
            if (sharedMap.has(s)) return sharedMap.get(s);
            const idx = sharedStrings.length;
            sharedStrings.push(s);
            sharedMap.set(s, idx);
            return idx;
        };

        /* ================= SHEET 1: RAPOR ÖZETİ ================= */
        const sheet1Rows = [];
        const merges1 = [];
        let r1 = 0;
        const colCount1 = Math.max(summaryHeaders.length || 8, kpis.length ? kpis.length * 2 : 8, 8);

        const addMergedBanner1 = (text, styleIdx, heightPt) => {
            r1++;
            let cells = '';
            const sstIdx = getSstIdx(text);
            for (let c = 0; c < colCount1; c++) {
                const ref = colRef(c) + r1;
                cells += (c === 0)
                    ? `<c r="${ref}" s="${styleIdx}" t="s"><v>${sstIdx}</v></c>`
                    : `<c r="${ref}" s="${styleIdx}"/>`;
            }
            sheet1Rows.push(`<row r="${r1}" ht="${heightPt}" customHeight="1">${cells}</row>`);
            merges1.push(`A${r1}:${colRef(colCount1 - 1)}${r1}`);
        };

        /* Belirli sütundan başlayıp son sütuna kadar birleşik satır (logo yanındaki unvan blokları) */
        const addSideBanner1 = (text, styleIdx, heightPt, startCol) => {
            r1++;
            let cells = '';
            const sstIdx = getSstIdx(text);
            for (let c = 0; c < colCount1; c++) {
                const ref = colRef(c) + r1;
                if (c < startCol) cells += `<c r="${ref}" s="0"/>`;
                else if (c === startCol) cells += `<c r="${ref}" s="${styleIdx}" t="s"><v>${sstIdx}</v></c>`;
                else cells += `<c r="${ref}" s="${styleIdx}"/>`;
            }
            sheet1Rows.push(`<row r="${r1}" ht="${heightPt}" customHeight="1">${cells}</row>`);
            if (colCount1 - 1 > startCol) merges1.push(`${colRef(startCol)}${r1}:${colRef(colCount1 - 1)}${r1}`);
        };

        /* Numaralı bölüm başlığı (ör. "1. YÖNETİCİ ÖZETİ") */
        let sectionNo = 0;
        const addSectionHeader1 = (text) => {
            sectionNo++;
            addBlank1(12);
            addMergedBanner1(`${sectionNo}. ${String(text).toLocaleUpperCase('tr-TR')}`, 4, 20);
        };

        const addBlank1 = (heightPt = 10) => {
            r1++;
            sheet1Rows.push(`<row r="${r1}" ht="${heightPt}" customHeight="1"/>`);
        };

        // ============ 1. KURUMSAL ANTET (logo + unvan + rapor künyesi) ============
        addBlank1(8);                                                                        // 1. boşluk
        addSideBanner1('ALBAYRAK TASARRUF FİNANSMAN A.Ş.', 18, 22, 1);                       // 2. unvan (logo hizası)
        addSideBanner1('Personel Devam Kontrol Sistemi (PDKS) · İnsan Kaynakları Müdürlüğü', 19, 15, 1); // 3. birim
        addSideBanner1(`Rapor No: ${reportNo}    ·    Üretim Tarihi: ${nowStr}`, 19, 13, 1);  // 4. künye
        addBlank1(6);                                                                        // 5. boşluk
        addMergedBanner1('', 20, 4);                                                          // 6. kırmızı ayraç
        addBlank1(10);                                                                        // 7. boşluk
        addMergedBanner1(title, 21, 26);                                                      // 8. rapor başlığı (bant)
        addMergedBanner1(subtitle, 22, 17);                                                   // 9. alt başlık (bant)

        if (meta.length) {
            const metaJoined = meta.map(m => `${m[0]}: ${m[1]}`).join('    ·    ');
            addMergedBanner1(metaJoined, 3, 18);                                              // 10. filtre künyesi
        }

        // ============ 2. YÖNETİCİ ÖZETİ GÖSTERGELERİ (KPI KARTLARI) ============
        if (kpis.length) {
            addSectionHeader1('Yönetici Özeti Göstergeleri');

            const kpiItems = kpis.slice(0, 6);
            const perRow = kpiItems.length <= 4 ? kpiItems.length : 3;
            const kpiCardCols = Math.max(1, Math.floor(colCount1 / perRow));

            const addKpiStrip = (chunk, styleOf, textOf, heightPt, emptyStyle) => {
                r1++;
                let cells = '';
                chunk.forEach((k, idx) => {
                    const c1 = idx * kpiCardCols;
                    const c2 = c1 + kpiCardCols - 1;
                    const ref1 = colRef(c1) + r1;
                    const ref2 = colRef(c2) + r1;
                    const st = styleOf(k);
                    cells += `<c r="${ref1}" s="${st}" t="s"><v>${getSstIdx(textOf(k))}</v></c>`;
                    for (let cc = c1 + 1; cc <= c2; cc++) {
                        cells += `<c r="${colRef(cc)}${r1}" s="${st}"/>`;
                    }
                    if (c2 > c1) merges1.push(`${ref1}:${ref2}`);
                });
                for (let c = chunk.length * kpiCardCols; c < colCount1; c++) {
                    cells += `<c r="${colRef(c)}${r1}" s="${emptyStyle}"/>`;
                }
                sheet1Rows.push(`<row r="${r1}" ht="${heightPt}" customHeight="1">${cells}</row>`);
            };

            for (let i = 0; i < kpiItems.length; i += perRow) {
                const chunk = kpiItems.slice(i, i + perRow);
                if (i > 0) addBlank1(8);
                // Etiket
                addKpiStrip(chunk, () => 11, k => String(k.label || '').toLocaleUpperCase('tr-TR'), 16, 11);
                // Değer
                addKpiStrip(
                    chunk,
                    k => {
                        const v = String(k.value || '0');
                        if (v.includes('+') || v.includes('%')) return 12;
                        if (v.includes('-') || v.includes('−')) return 15;
                        return k.tone === 'warn' ? 14 : 13;
                    },
                    k => String(k.value || '0'),
                    24,
                    13
                );
                // Alt açıklama
                addKpiStrip(chunk, () => 16, k => (k.sub ? String(k.sub) : '—'), 15, 16);
            }
        }

        // ============ 3. DEPARTMAN / BİRİM ÖZET MATRİSİ ============
        if (summaryHeaders.length && summaryRows.length) {
            addSectionHeader1(summaryTitle);

            r1++;
            let sHdrCells = '';
            summaryHeaders.forEach((h, ci) => {
                sHdrCells += `<c r="${colRef(ci)}${r1}" s="5" t="s"><v>${getSstIdx(h)}</v></c>`;
            });
            for (let c = summaryHeaders.length; c < colCount1; c++) {
                sHdrCells += `<c r="${colRef(c)}${r1}" s="5"/>`;
            }
            sheet1Rows.push(`<row r="${r1}" ht="22" customHeight="1">${sHdrCells}</row>`);

            summaryRows.forEach((sr, sri) => {
                r1++;
                let srCells = '';
                sr.forEach((val, ci) => {
                    let st = (sri % 2 === 1) ? 7 : 6;
                    const strVal = String(val || '');
                    if (ci === sr.length - 1) {
                        st = detectStatusStyleIdx(val, sri);
                    } else if (strVal.startsWith('+')) {
                        st = 8;
                    } else if (strVal.startsWith('-') || strVal.startsWith('−')) {
                        st = 10;
                    }
                    srCells += `<c r="${colRef(ci)}${r1}" s="${st}" t="s"><v>${getSstIdx(val)}</v></c>`;
                });
                for (let c = sr.length; c < colCount1; c++) {
                    srCells += `<c r="${colRef(c)}${r1}" s="${(sri % 2 === 1) ? 7 : 6}"/>`;
                }
                sheet1Rows.push(`<row r="${r1}" ht="20" customHeight="1">${srCells}</row>`);
            });
        }

        /* İki eşit sütuna bölünmüş satır (imza bloğu için) */
        const addTwoColRow1 = (leftText, rightText, styleIdx, heightPt) => {
            r1++;
            const half = Math.floor(colCount1 / 2);
            let cells = '';
            for (let c = 0; c < colCount1; c++) {
                if (c === 0) cells += `<c r="${colRef(c)}${r1}" s="${styleIdx}" t="s"><v>${getSstIdx(leftText)}</v></c>`;
                else if (c === half) cells += `<c r="${colRef(c)}${r1}" s="${styleIdx}" t="s"><v>${getSstIdx(rightText)}</v></c>`;
                else cells += `<c r="${colRef(c)}${r1}" s="${styleIdx}"/>`;
            }
            sheet1Rows.push(`<row r="${r1}" ht="${heightPt}" customHeight="1">${cells}</row>`);
            if (half - 1 > 0) merges1.push(`A${r1}:${colRef(half - 1)}${r1}`);
            if (colCount1 - 1 > half) merges1.push(`${colRef(half)}${r1}:${colRef(colCount1 - 1)}${r1}`);
        };

        // ============ 4. DEĞERLENDİRME VE METODOLOJİ NOTU ============
        addSectionHeader1('Değerlendirme ve Metodoloji Notu');

        const defaultNotes = [
            'Gecikme süresi, vardiya başlangıç saatine göre hesaplanan pozitif sapmadır.',
            'Ek mesai süresi, vardiya bitişinden sonra gerçekleşen onaylı çalışma süresidir.',
            'Net süre bakiyesi = Toplam ek mesai − Toplam gecikme. Negatif bakiye kayıp süreyi gösterir.',
            'Konum doğrulaması şube merkezine 30 metre yarıçapla sınırlıdır; sahte konum (mock GPS) tespiti blokajla sonuçlanır.',
            `Ham kayıtların tamamı "Puantaj Detay" sekmesinde yer alır (${rows.length} satır · AutoFilter açık · başlık satırı her sayfada tekrar eder).`
        ];
        (notes.length ? notes : defaultNotes).forEach((n, i) => {
            addMergedBanner1(`${i + 1})  ${n}`, 26, 15);
        });

        // ============ 5. ONAY VE İMZA BLOĞU ============
        addBlank1(22);
        addTwoColRow1('', '', 25, 22);
        addTwoColRow1('Hazırlayan', 'Onaylayan', 24, 13);
        addTwoColRow1(preparedBy || 'İnsan Kaynakları Yönetimi', approvedBy, 25, 13);

        addBlank1(12);
        addMergedBanner1(
            'Bu belge Albayrak Tasarruf Finansman A.Ş. Personel Devam Kontrol Sistemi tarafından otomatik üretilmiştir. Yetkisiz kopyalanması ve dağıtılması yasaktır.',
            26,
            14
        );

        let cols1Xml = '<cols>';
        for (let c = 1; c <= colCount1; c++) {
            // A4 yatay yazdırma için toplam genişlik ~146 karakter birimi ile sınırlandı
            const w = c === 1 ? 20 : (c === 2 ? 24 : (c === colCount1 ? 22 : 16));
            cols1Xml += `<col min="${c}" max="${c}" width="${w}" customWidth="1"/>`;
        }
        cols1Xml += '</cols>';

        const merge1Xml = merges1.length
            ? `<mergeCells count="${merges1.length}">${merges1.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
            : '';

        const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <sheetViews><sheetView tabSelected="1" workbookViewId="0" showGridLines="0"/></sheetViews>
  ${cols1Xml}
  <sheetData>${sheet1Rows.join('')}</sheetData>
  ${merge1Xml}
  <printOptions horizontalCentered="1"/>
  <pageMargins left="0.3" right="0.3" top="0.45" bottom="0.65" header="0.25" footer="0.25"/>
  <pageSetup paperSize="9" scale="100" orientation="landscape" fitToWidth="1" fitToHeight="0" horizontalDpi="600" verticalDpi="600"/>
  <headerFooter><oddFooter>&amp;L Albayrak Tasarruf Finansman A.Ş. · PDKS&amp;C Rapor No: ${xmlEsc(reportNo)}&amp;R Sayfa &amp;P / &amp;N</oddFooter></headerFooter>
  ${logoBytes ? '<drawing r:id="rId1"/>' : ''}
</worksheet>`;

        /* ================= SHEET 2: DETAYLI KAYIT TABLOSU (EK-1) ================= */
        const sheet2Rows = [];
        const sheet2Merges = [];
        const colCount2 = headers.length || 1;

        // 1. satır: ek başlık bandı (her sayfada tekrarlanır)
        {
            const ekTitle = `EK-1 · DETAY KAYIT LİSTESİ (${rows.length} KAYIT) — ${title}`;
            let tCells = '';
            for (let c = 0; c < colCount2; c++) {
                const ref = colRef(c) + '1';
                tCells += (c === 0)
                    ? `<c r="${ref}" s="23" t="s"><v>${getSstIdx(ekTitle)}</v></c>`
                    : `<c r="${ref}" s="23"/>`;
            }
            sheet2Rows.push(`<row r="1" ht="24" customHeight="1">${tCells}</row>`);
            sheet2Merges.push(`A1:${colRef(colCount2 - 1)}1`);
        }

        if (headers.length) {
            let hCells = '';
            headers.forEach((h, ci) => {
                hCells += `<c r="${colRef(ci)}2" s="5" t="s"><v>${getSstIdx(h)}</v></c>`;
            });
            sheet2Rows.push(`<row r="2" ht="26" customHeight="1">${hCells}</row>`);
        }

        rows.forEach((r, ri) => {
            const rNum = ri + 3;
            let rCells = '';
            r.forEach((val, ci) => {
                let st = (ri % 2 === 1) ? 7 : 6;
                const strVal = String(val || '');
                if (ci === r.length - 1 || ci >= r.length - 2) {
                    st = detectStatusStyleIdx(val, ri);
                } else if (strVal.startsWith('+')) {
                    st = 8;
                } else if (strVal.startsWith('-') || strVal.startsWith('−')) {
                    st = 10;
                }
                rCells += `<c r="${colRef(ci)}${rNum}" s="${st}" t="s"><v>${getSstIdx(val)}</v></c>`;
            });
            sheet2Rows.push(`<row r="${rNum}" ht="20" customHeight="1">${rCells}</row>`);
        });

        let cols2Xml = '<cols>';
        for (let c = 1; c <= colCount2; c++) {
            // A4 yatay yazdırma için sütun genişlikleri içeriğe göre daraltıldı (~162 birim)
            const w = c === 1 ? 12
                : c === 2 ? 21
                : (c === 3 || c === 4) ? 15
                : c <= 9 ? 11
                : c <= 11 ? 16
                : 12;
            cols2Xml += `<col min="${c}" max="${c}" width="${w}" customWidth="1"/>`;
        }
        cols2Xml += '</cols>';

        const lastColRef2 = colRef(Math.max(0, colCount2 - 1));
        const autoFilterXml = headers.length
            ? `<autoFilter ref="A2:${lastColRef2}${Math.max(3, rows.length + 2)}"/>`
            : '';

        const merge2Xml = sheet2Merges.length
            ? `<mergeCells count="${sheet2Merges.length}">${sheet2Merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
            : '';

        const sheet2Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <sheetViews>
    <sheetView tabSelected="0" workbookViewId="0" showGridLines="0">
      <pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  ${cols2Xml}
  <sheetData>${sheet2Rows.join('')}</sheetData>
  ${merge2Xml}
  ${autoFilterXml}
  <printOptions horizontalCentered="1"/>
  <pageMargins left="0.2" right="0.2" top="0.5" bottom="0.65" header="0.25" footer="0.25"/>
  <pageSetup paperSize="9" scale="100" orientation="landscape" fitToWidth="1" fitToHeight="0" horizontalDpi="600" verticalDpi="600"/>
  <headerFooter><oddFooter>&amp;L Albayrak Tasarruf Finansman A.Ş. · PDKS — EK-1&amp;C Rapor No: ${xmlEsc(reportNo)}&amp;R Sayfa &amp;P / &amp;N</oddFooter></headerFooter>
</worksheet>`;

        /* ================= PAYLAŞILAN STILLER & PAKET ================= */
        const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="17">
    <font><sz val="10"/><color rgb="FF141517"/><name val="Calibri"/></font>
    <font><b/><sz val="13"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><sz val="9.5"/><color rgb="FFE5E7EB"/><name val="Calibri"/></font>
    <font><b/><sz val="9"/><color rgb="FF6E737D"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF0B7A53"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFB4690E"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFC8191E"/><name val="Calibri"/></font>
    <font><b/><sz val="8.5"/><color rgb="FF64748B"/><name val="Calibri"/></font>
    <font><b/><sz val="16"/><color rgb="FF0B7A53"/><name val="Calibri"/></font>
    <font><sz val="9.5"/><color rgb="FF0B7A53"/><name val="Calibri"/></font>
    <font><b/><sz val="16"/><color rgb="FF141517"/><name val="Calibri"/></font>
    <font><b/><sz val="15"/><color rgb="FF141517"/><name val="Calibri"/></font>
    <font><sz val="9"/><color rgb="FF6E737D"/><name val="Calibri"/></font>
    <font><b/><sz val="9.5"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><sz val="10"/><color rgb="FF141517"/><name val="Calibri"/></font>
  </fonts>
  <fills count="11">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF141517"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E2024"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8F9FB"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F3F5"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEAF8F2"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF5E7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFDECEC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEDFDF5"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE31E24"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="6">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE2E5EC"/></left>
      <right style="thin"><color rgb="FFE2E5EC"/></right>
      <top style="thin"><color rgb="FFE2E5EC"/></top>
      <bottom style="thin"><color rgb="FFE2E5EC"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left/><right/><top/>
      <bottom style="medium"><color rgb="FFC8191E"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFB9E6D3"/></left>
      <right style="thin"><color rgb="FFB9E6D3"/></right>
      <top style="thin"><color rgb="FFB9E6D3"/></top>
      <bottom style="thin"><color rgb="FFB9E6D3"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left/><right/><top/>
      <bottom style="thin"><color rgb="FF94A3B8"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="27">
    <!-- 0: Normal -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <!-- 1: Başlık bandı (eski) -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <!-- 2: Alt başlık bandı (eski) -->
    <xf numFmtId="0" fontId="2" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <!-- 3: Künye / meta satırı -->
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
    <!-- 4: Bölüm başlığı -->
    <xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
    <!-- 5: Tablo başlığı -->
    <xf numFmtId="0" fontId="5" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <!-- 6: Tablo hücresi -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
    <!-- 7: Tablo hücresi (zebra) -->
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
    <!-- 8: Durum OK (yeşil) -->
    <xf numFmtId="0" fontId="6" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 9: Durum UYARI (kehribar) -->
    <xf numFmtId="0" fontId="7" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 10: Durum KRİTİK (kırmızı) -->
    <xf numFmtId="0" fontId="8" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 11: KPI etiketi -->
    <xf numFmtId="0" fontId="9" fillId="5" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <!-- 12: KPI değeri (pozitif / yüzde) -->
    <xf numFmtId="0" fontId="10" fillId="0" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 13: KPI değeri (nötr, KOYU) -->
    <xf numFmtId="0" fontId="12" fillId="0" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 14: KPI değeri (uyarı) -->
    <xf numFmtId="0" fontId="7" fillId="0" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 15: KPI değeri (kritik) -->
    <xf numFmtId="0" fontId="8" fillId="0" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <!-- 16: KPI alt açıklama -->
    <xf numFmtId="0" fontId="3" fillId="4" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <!-- 17: Bilgi kutusu -->
    <xf numFmtId="0" fontId="11" fillId="9" borderId="4" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
    <!-- 18: Şirket unvanı -->
    <xf numFmtId="0" fontId="13" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
    <!-- 19: Şirket alt bilgisi -->
    <xf numFmtId="0" fontId="14" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
    <!-- 20: Kırmızı ayraç -->
    <xf numFmtId="0" fontId="0" fillId="10" borderId="0" xfId="0" applyFill="1"/>
    <!-- 21: Rapor başlık bandı -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
    <!-- 22: Rapor alt başlık bandı -->
    <xf numFmtId="0" fontId="14" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
    <!-- 23: EK sekme başlık bandı -->
    <xf numFmtId="0" fontId="15" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
    <!-- 24: İmza etiketi -->
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <!-- 25: İmza çizgisi / ad soyad -->
    <xf numFmtId="0" fontId="16" fillId="0" borderId="5" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center"/></xf>
    <!-- 26: Dipnot -->
    <xf numFmtId="0" fontId="14" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;

        const sstXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">
  ${sharedStrings.map(s => `<si><t xml:space="preserve">${xmlEsc(s)}</t></si>`).join('')}
</sst>`;

        const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  ${hasLogo ? '<Default Extension="png" ContentType="image/png"/>\n  <Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : ''}
</Types>`;

        const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

        const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Rapor Ozeti" sheetId="1" r:id="rId1"/>
    <sheet name="Puantaj Detay" sheetId="2" r:id="rId4"/>
  </sheets>
  <definedNames>
    <definedName name="_xlnm.Print_Titles" localSheetId="1">'Puantaj Detay'!$1:$2</definedName>
  </definedNames>
</workbook>`;

        const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
</Relationships>`;

        const zipEntries = [
            { name: '[Content_Types].xml', content: contentTypesXml },
            { name: '_rels/.rels', content: rootRelsXml },
            { name: 'xl/workbook.xml', content: workbookXml },
            { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
            { name: 'xl/styles.xml', content: stylesXml },
            { name: 'xl/sharedStrings.xml', content: sstXml },
            { name: 'xl/worksheets/sheet1.xml', content: sheet1Xml },
            { name: 'xl/worksheets/sheet2.xml', content: sheet2Xml }
        ];

        // Kurumsal logo gömme (Excel çizim + medya parçaları)
        if (hasLogo) {
            zipEntries.push(
                { name: 'xl/worksheets/_rels/sheet1.xml.rels', content: sheet1RelsXml },
                { name: 'xl/drawings/drawing1.xml', content: logoDrawingXml(104) },
                { name: 'xl/drawings/_rels/drawing1.xml.rels', content: drawingRelsXml },
                { name: 'xl/media/image1.png', content: logoBytes }
            );
        }

        const blob = createZipBlob(zipEntries);

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 600);
    };

    /* Eski CSV çağrılarını da otomatik olarak zengin Excel raporuna yönlendir */
    ATF.csv = function (name, header, rows, extraOpts) {
        ATF.excelReport(Object.assign({
            fileName: name,
            title: 'ALBAYRAK FİNANS PDKS PUANTAJ VE YOKLAMA RAPORU',
            subtitle: 'Kurumsal Personel Takip ve 30m Geofence Doğrulama Kayıtları',
            headers: header,
            rows: rows
        }, extraOpts || {}));
    };
})(window);
