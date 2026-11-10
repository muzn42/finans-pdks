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
        expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
        edit: '<path d="M4 20h4L18.5 9.5a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5V20z"/><path d="M13.5 6.5l4 4"/>',
        tool: '<path d="M4 20h4L18.5 9.5a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5V20z"/><path d="M13.5 6.5l4 4"/>'
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
        host.__chartSpec = { kind: 'area', options: o };
        const W = 640, H = o.h || 250, L = 40, R = 10, T = 14, B = 26, iw = W - L - R, ih = H - T - B, ticks = 4;
        const all = o.series.flatMap(s => s.data), n = o.labels.length;
        const yMin = o.yMin != null ? o.yMin : Math.min(0, ...all);
        const step = niceStep(((o.yMax != null ? o.yMax : Math.max(...all, yMin + 1)) - yMin) / ticks);
        const max = yMin + step * ticks;
        const x = i => L + (n === 1 ? iw / 2 : i * iw / (n - 1));
        const y = v => T + ih - ((v - yMin) / ((max - yMin) || 1)) * ih;
        const id = 'ag' + (++uid), yf = o.yFmt || (v => v), col = o.color || '#E31E24';
        let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${ATF.esc(o.aria || 'Grafik')}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".22"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>`;
        for (let t = 0; t <= ticks; t++) { const v = yMin + step * t, yy = y(v); s += `<line class="grid-line" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text class="ax" x="${L - 8}" y="${yy + 4}" text-anchor="end">${yf(+v.toFixed(2))}</text>`; }
        const every = Math.max(1, Math.ceil(n / 8));
        // Son etiket her zaman görünür olsun; önceki etiketle çakışacaksa (ör. 19.10 + 20.10) aradaki gizlenir.
        const labelIdxs = [];
        for (let i = 0; i < n; i += every) labelIdxs.push(i);
        if (labelIdxs[labelIdxs.length - 1] !== n - 1) {
            if (labelIdxs.length && Math.abs(x(n - 1) - x(labelIdxs[labelIdxs.length - 1])) < 34) labelIdxs.pop();
            labelIdxs.push(n - 1);
        }
        labelIdxs.forEach(i => { s += `<text class="ax" x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${ATF.esc(o.labels[i])}</text>`; });
        o.series.forEach((se, k) => {
            const pts = se.data.map((v, i) => [x(i), y(v)]), d = smooth(pts, T, T + ih);
            if (k === 0) s += `<path class="fade" d="${d} L${x(n - 1)},${T + ih} L${x(0)},${T + ih} Z" fill="url(#${id})"/>`;
            s += `<path class="area-line draw${k ? ' alt' : ''}" d="${d}"${k === 0 && o.color ? ` style="stroke:${col}"` : ''}/>`;
        });
        s += `<line class="hover-line" y1="${T}" y2="${T + ih}"/><circle class="hover-dot" r="5"${o.color ? ` style="stroke:${col}"` : ''}/><rect class="hit" x="${L}" y="0" width="${iw}" height="${H}" fill="transparent"/></svg>`;
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
        host.__chartSpec = { kind: 'bar', options: o };
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
        host.__chartSpec = { kind: 'donut', options: o };
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
        host.__chartSpec = { kind: 'heat', options: o };
        const cols = o.cols.length;
        let h = `<div class="heat" style="--cols:${cols}"><div class="heat-cols"><span></span>${o.cols.map(c => `<span>${ATF.esc(c)}</span>`).join('')}</div>`;
        o.rows.forEach((r, ri) => {
            h += `<div class="heat-row"><span>${ATF.esc(r.label)}</span>${r.cells.map((v, ci) => `<i class="heat-cell" style="--o:${(0.07 + v * 0.93).toFixed(2)};transition-delay:${(ri * cols + ci) * 12}ms" title="${ATF.esc(r.label + ' · ' + o.cols[ci] + ': ' + (o.tip ? o.tip(v) : Math.round(v * 100) + '%'))}"></i>`).join('')}</div>`;
        });
        host.innerHTML = h + '</div>';
    };

    ATF.spark = function (vals, color) {
        const clean = (vals && vals.length ? vals : [0, 1]).map(v => Number.isFinite(+v) ? +(+v).toFixed(2) : 0);
        const W = 84, H = 30, mx = Math.max(...clean), mn = Math.min(...clean), rg = (mx - mn) || 1;
        const pts = clean.map((v, i) => [i * W / Math.max(1, clean.length - 1), H - 3 - ((v - mn) / rg) * (H - 6)]);
        const col = color || '#E31E24';
        return `<svg class="spark" data-vals="${clean.join(',')}" data-color="${ATF.esc(col)}" viewBox="0 0 ${W} ${H}"><path d="${smooth(pts, 0, H)}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round"/></svg>`;
    };

    /**
     * Küçük kutular (KPI veya mini kartlar) büyütüldüğünde (.span-wide),
     * içindeki mini sparkline grafiğini tam genişlikli, eksenli, referans çizgili ve
     * fareyle üzerine gelindiğinde (hover) detaylı veri kutucuğu (tooltip) gösteren
     * interaktif bir alan grafiğine dönüştürür; küçültüldüğünde eski haline döndürür.
     */
    ATF.syncCardExpansion = function (card) {
        if (!card) return;
        const isWide = card.classList.contains('span-wide');
        const isPop = card.classList.contains('is-pop-expanded');
        const existing = card.querySelector('.kpi-expanded-panel');
        if (!card.classList.contains('kpi')) return;

        if (!isWide && !isPop) {
            if (existing) existing.remove();
            return;
        }
        if (existing) return;

        const spk = card.querySelector('.spark[data-vals]');
        const countEl = card.querySelector('[data-count]');
        const baseVal = countEl ? (+countEl.dataset.count || 0) : 0;
        let rawVals = spk
            ? spk.dataset.vals.split(',').map(Number).filter(Number.isFinite)
            : [];
        if (rawVals.length < 2) {
            // Sparkline olmayan KPI kutuları için son 14 iş günü etrafında deterministik seri üret
            rawVals = Array.from({ length: 14 }, (_, i) => +(baseVal * (0.92 + Math.sin(i * 0.9) * 0.06 + (i / 14) * 0.04)).toFixed(1));
        }

        // Eğer değerler 0..1 arası oran ise (örn. HR.overview katılım/gecikme oranı), yüzdeye çevir
        const maxAbs = Math.max(...rawVals.map(Math.abs));
        const unitEl = card.querySelector('.kpi-val small');
        const unitTxt = unitEl ? unitEl.textContent.trim() : '';
        const isFractionRatio = maxAbs <= 1 && baseVal > 1.5;
        const vals = isFractionRatio ? rawVals.map(v => +(v * 100).toFixed(1)) : rawVals;

        const col = (spk && spk.dataset.color) || '#E31E24';
        const titleTxt = (card.querySelector('.kpi-label') && card.querySelector('.kpi-label').textContent.trim()) || 'Gösterge';
        const days = (g.ATF && g.ATF.DATA && Array.isArray(g.ATF.DATA.DAYS)) ? g.ATF.DATA.DAYS.slice(-vals.length) : [];
        const labels = vals.map((_, i) => days[i] ? days[i].label : ('G-' + (vals.length - i)));
        const fullDates = vals.map((_, i) => days[i] ? `${days[i].fullDate} (${days[i].dowName})` : ('Gün ' + (i + 1)));

        const minV = +Math.min(...vals).toFixed(1);
        const maxV = +Math.max(...vals).toFixed(1);
        const avgV = +(vals.reduce((a, b) => a + b, 0) / (vals.length || 1)).toFixed(1);
        const lastV = +vals[vals.length - 1].toFixed(1);
        const fmtV = v => String(+Number(v).toFixed(1)).replace('.', ',') + (isFractionRatio ? '%' : (unitTxt ? ' ' + unitTxt : ''));

        const panel = document.createElement('div');
        panel.className = 'kpi-expanded-panel';
        panel.innerHTML = `
            <div class="kpi-exp-head">
                <div>
                    <b>${ATF.esc(titleTxt)} — İnteraktif Dönem Trendi ve Sapma Analizi</b>
                    <small class="muted">Grafik üzerinde gezinerek gün bazlı değerleri ve dönem ortalamasıyla (${ATF.esc(fmtV(avgV))}) farkını inceleyebilirsiniz</small>
                </div>
                <div class="kpi-exp-stats">
                    <span class="kpi-exp-stat"><small>En Düşük</small><b>${ATF.esc(fmtV(minV))}</b></span>
                    <span class="kpi-exp-stat"><small>Dönem Ort.</small><b>${ATF.esc(fmtV(avgV))}</b></span>
                    <span class="kpi-exp-stat"><small>En Yüksek</small><b>${ATF.esc(fmtV(maxV))}</b></span>
                    <span class="kpi-exp-stat"><small>Son Kayıt</small><b style="color:${ATF.esc(col)}">${ATF.esc(fmtV(lastV))}</b></span>
                </div>
            </div>
            <div class="kpi-exp-chart"></div>
        `;
        card.appendChild(panel);

        const chartHost = panel.querySelector('.kpi-exp-chart');
        const padRange = Math.max(1, (maxV - minV) * 0.2);
        ATF.areaChart(chartHost, {
            labels,
            series: [
                { data: vals },
                { data: vals.map(() => avgV) }
            ],
            yMin: minV >= 0 ? Math.max(0, Math.floor(minV - padRange)) : Math.floor(minV - padRange),
            yMax: Math.ceil(maxV + padRange),
            h: 195,
            color: col,
            yFmt: v => fmtV(v),
            tip: (i, sv) => {
                const diff = +(sv[0] - avgV).toFixed(1);
                const diffStr = (diff > 0 ? '+' : '') + String(diff).replace('.', ',');
                return `<b>${ATF.esc(fullDates[i])}</b>Değer: <b>${ATF.esc(fmtV(sv[0]))}</b> · Ort: ${ATF.esc(fmtV(avgV))} (${diffStr})`;
            }
        });
    };

    /* =========================================================================
       KART ÜSTÜNE TIKLAYINCA "OLDUĞU YERDE ÖNDE BÜYÜME" (In-Place Popover)
       - Sağ üstteki büyütme tuşu (.dnd-span) eskisi gibi kartı grid içinde
         .span-wide ile açar; o davranış korunur.
       - Kartın gövdesine (tuşa değil) tıklanınca diğer kartlar en son halleriyle
         yerlerinde kalır; tıklanan kart kendi konumundan öne doğru büyür.
       ========================================================================= */
    ATF.renderChartSpec = function (host, spec) {
        if (!host || !spec) return;
        if (spec.kind === 'area') ATF.areaChart(host, spec.options);
        else if (spec.kind === 'bar') ATF.barChart(host, spec.options);
        else if (spec.kind === 'donut') ATF.donut(host, spec.options);
        else if (spec.kind === 'heat') ATF.heatmap(host, spec.options);
    };

    /* Hangi kartlar önde büyütülebilir? Yalnızca anlamlı olanlar seçilir. */
    ATF.isCardZoomable = function (card) {
        if (!card || !card.classList || !card.classList.contains('card')) return false;
        if (card.classList.contains('no-zoom') || card.classList.contains('profile-banner')) return false;
        if (card.classList.contains('flush')) return false;
        if (card.querySelector('form, iframe, .rpt-doc, .card-pop-floating')) return false;
        if (card.classList.contains('kpi') || card.classList.contains('profile-exec-card')) return true;
        return !!card.querySelector('.chart, .donut-wrap, .heat, .rank, .health, [id^="ch"], [id^="prChart"]');
    };

    ATF.decorateZoomableCards = function (root) {
        ATF.$$('.card', root || document).forEach(card => {
            if (card.closest('.card-pop-floating')) return;
            const zoomable = ATF.isCardZoomable(card);
            card.classList.toggle('is-zoomable', zoomable);
            if (!zoomable) return;
            const heading = card.querySelector('.card-head h3, .kpi-label');
            const title = heading && heading.textContent ? heading.textContent.trim() : 'Kart';
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');
            card.setAttribute('aria-expanded', 'false');
            card.setAttribute('aria-label', title + ' · detayı önde büyüt');
            card.setAttribute('title', 'Detayı önde büyütmek için karta tıklayın');
        });
    };

    ATF.closeCardPopover = function (instant) {
        const state = ATF.__cardPop;
        if (!state) return;
        ATF.__cardPop = null;
        const backdrop = state.backdrop, floating = state.floating, card = state.card;
        document.removeEventListener('keydown', ATF.onCardPopKey, true);
        window.removeEventListener('resize', ATF.onCardPopResize);

        if (card) {
            card.classList.remove('is-pop-origin');
            card.setAttribute('aria-expanded', 'false');
            if (!instant && card.isConnected) {
                const r = card.getBoundingClientRect();
                if (r.width && r.height) {
                    floating.style.left = r.left + 'px';
                    floating.style.top = r.top + 'px';
                    floating.style.width = r.width + 'px';
                    floating.style.height = r.height + 'px';
                    floating.style.opacity = '0';
                }
            }
        }

        backdrop.classList.remove('on');
        if (instant) {
            if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        } else {
            setTimeout(() => { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); }, 430);
        }

        if (card && card.isConnected) {
            try { card.focus({ preventScroll: true }); } catch (e) { }
        }
    };

    ATF.onCardPopKey = function (e) {
        if (!ATF.__cardPop) return;
        if (e.key === 'Escape') { e.preventDefault(); ATF.closeCardPopover(); }
    };

    ATF.onCardPopResize = function () { ATF.closeCardPopover(true); };

    ATF.openCardPopover = function (card) {
        if (!card || !ATF.isCardZoomable(card)) return;
        if (ATF.__cardPop) {
            if (ATF.__cardPop.card === card) { ATF.closeCardPopover(); return; }
            ATF.closeCardPopover(true);
        }

        const rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const backdrop = document.createElement('div');
        backdrop.className = 'card-pop-backdrop';

        const floating = document.createElement('div');
        floating.className = 'card-pop-floating';
        floating.setAttribute('role', 'dialog');
        floating.setAttribute('aria-modal', 'true');

        const head = document.createElement('div');
        head.className = 'card-pop-head';
        const headTxt = document.createElement('div');
        headTxt.className = 'card-pop-eyebrow';
        const heading = card.querySelector('.card-head h3, .kpi-label');
        headTxt.textContent = ((heading && heading.textContent ? heading.textContent.trim() : 'Kart') + ' · odaklanmış görünüm').toLocaleUpperCase('tr-TR');
        floating.setAttribute('aria-label', headTxt.textContent);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'card-pop-close';
        closeBtn.innerHTML = ATF.ic('x') + '<span>Kapat</span>';
        closeBtn.setAttribute('aria-label', 'Kart büyütmesini kapat (Esc)');
        closeBtn.addEventListener('click', e => { e.stopPropagation(); ATF.closeCardPopover(); });
        head.appendChild(headTxt);
        head.appendChild(closeBtn);

        const body = document.createElement('div');
        body.className = 'card-pop-body';

        /* Orijinal kart grid içinde yerinde kalır; canlı bir kopyası önde açılır. */
        const clone = card.cloneNode(true);
        clone.classList.remove('is-zoomable', 'is-dragging', 'is-drop-target', 'span-wide');
        clone.classList.add('is-pop-expanded');
        ['draggable', 'tabindex', 'role', 'aria-expanded', 'aria-label', 'title'].forEach(a => clone.removeAttribute(a));
        const dndBar = clone.querySelector('.dnd-bar');
        if (dndBar) dndBar.remove();
        const stalePanel = clone.querySelector('.kpi-expanded-panel');
        if (stalePanel) stalePanel.remove();
        ATF.$$('[data-act], [data-go], [data-bind]', clone).forEach(el => {
            el.removeAttribute('data-act');
            el.removeAttribute('data-go');
            el.removeAttribute('data-bind');
        });

        /* Kopyadaki id çakışmalarını önle; grafik konteynerlerini eşle. */
        const idMap = new Map();
        ATF.$$('[id]', clone).forEach(el => {
            const old = el.id;
            if (!old) return;
            idMap.set(old, el);
            el.id = 'pop-' + old;
        });

        body.appendChild(clone);
        floating.appendChild(head);
        floating.appendChild(body);

        floating.style.left = rect.left + 'px';
        floating.style.top = rect.top + 'px';
        floating.style.width = rect.width + 'px';
        floating.style.height = rect.height + 'px';
        floating.style.opacity = '0';

        document.body.appendChild(backdrop);
        backdrop.appendChild(floating);

        /* KPI interaktif grafiği ve grafik kartlarının canlı yeniden çizimi */
        if (clone.classList.contains('kpi')) ATF.syncCardExpansion(clone);
        Array.from(card.querySelectorAll('*')).forEach(orig => {
            if (!orig.__chartSpec) return;
            const target = orig.id ? idMap.get(orig.id) : null;
            if (target) ATF.renderChartSpec(target, orig.__chartSpec);
        });

        const vw = window.innerWidth || document.documentElement.clientWidth;
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const maxW = Math.min(clone.classList.contains('kpi') ? 760 : 940, vw - 32);
        const targetW = Math.max(320, Math.min(maxW, Math.max(640, rect.width)));
        const targetLeft = ATF.clamp(rect.left + rect.width / 2 - targetW / 2, 16, Math.max(16, vw - targetW - 16));
        const targetTopBase = ATF.clamp(rect.top, 16, Math.max(16, vh - 160));

        /* Yüksekliği hedef genişlikte ölç (içerik taşarsa dikey kaydırma devreye girer) */
        floating.style.width = targetW + 'px';
        const contentH = clone.scrollHeight + head.offsetHeight + 26;
        floating.style.width = rect.width + 'px';
        const targetH = Math.max(160, Math.min(Math.max(rect.height, contentH), vh - 48));

        ATF.__cardPop = { card, backdrop, floating };
        document.addEventListener('keydown', ATF.onCardPopKey, true);
        window.addEventListener('resize', ATF.onCardPopResize);

        requestAnimationFrame(() => {
            if (!ATF.__cardPop) return;
            floating.style.left = targetLeft + 'px';
            floating.style.top = targetTopBase + 'px';
            floating.style.width = targetW + 'px';
            floating.style.height = targetH + 'px';
            floating.style.opacity = '1';
            backdrop.classList.add('on');
            card.classList.add('is-pop-origin');
            card.setAttribute('aria-expanded', 'true');
            try { closeBtn.focus({ preventScroll: true }); } catch (e) { }
        });
    };

    /* Kart gövdesine tıklama ve klavye ile önde büyütme (tek sefer bağlanır) */
    ATF.bindCardPopover = function () {
        if (ATF.__cardPopBound) return;
        ATF.__cardPopBound = true;

        document.addEventListener('click', e => {
            if (ATF.__cardPop) {
                if (e.target.closest('.card-pop-floating')) return;
                ATF.closeCardPopover();
                return;
            }
            const card = e.target.closest('.card.is-zoomable');
            if (!card) return;
            /* Kart içi kontroller ve satır/tablo etkileşimleri kendi işini yapar. */
            if (e.target.closest('button, a, input, select, textarea, label, .cselect, .cselect-menu, .dnd-bar, .chips, .chip, .pager, .table-wrap, .list, [data-act], [data-go]')) return;
            e.preventDefault();
            e.stopPropagation();
            ATF.openCardPopover(card);
        }, true);

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && ATF.__cardPop) { e.preventDefault(); ATF.closeCardPopover(); return; }
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const aktif = document.activeElement;
            if (!aktif || !aktif.classList || !aktif.classList.contains('is-zoomable')) return;
            e.preventDefault();
            e.stopPropagation();
            ATF.openCardPopover(aktif);
        }, true);
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

        /* Kart üstüne tıklayarak önde büyütme motorunu hazırla ve kartları işaretle */
        ATF.bindCardPopover();
        ATF.decorateZoomableCards(root);

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
                if (saved.spans && saved.spans[wid]) {
                    card.classList.add('span-wide');
                    ATF.syncCardExpansion(card);
                }

                // Sürükleme tutamacı ve genişletme butonu ekle
                if (!card.querySelector('.dnd-bar')) {
                    const bar = document.createElement('div');
                    bar.className = 'dnd-bar';
                    bar.innerHTML = `
                        <button type="button" class="dnd-btn dnd-span" title="Kartı büyüt / interaktif grafiği aç" aria-label="Boyutlandır">${ATF.ic('expand')}</button>
                        <span class="dnd-handle" title="Sürükleyip yerini değiştirin">${ATF.ic('grip')}</span>
                    `;
                    card.appendChild(bar);
                    bar.querySelector('.dnd-span').addEventListener('click', e => {
                        e.stopPropagation();
                        card.classList.toggle('span-wide');
                        ATF.syncCardExpansion(card);
                        saveState();
                        ATF.toast(card.classList.contains('span-wide') ? 'Kart büyütüldü · İnteraktif grafik aktif' : 'Kart varsayılan boyuta döndü');
                    });
                }
                const spk = card.querySelector('.spark');
                if (spk) {
                    spk.style.cursor = 'zoom-in';
                    spk.setAttribute('title', 'Karta tıklayarak interaktif grafiği önde büyütün');
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
        let lastDropTarget = null;
        const clearDropTarget = () => {
            if (lastDropTarget) {
                lastDropTarget.classList.remove('is-drop-target');
                lastDropTarget = null;
            }
        };

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
            clearDropTarget();
            dragged = null;
        });

        on('dragover', e => {
            if (!dragged) return;
            const over = e.target.closest('.card[draggable="true"]');
            if (!over || over === dragged || over.parentElement !== dragged.parentElement) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (lastDropTarget !== over) {
                if (lastDropTarget) lastDropTarget.classList.remove('is-drop-target');
                over.classList.add('is-drop-target');
                lastDropTarget = over;
            }
        });

        on('dragleave', e => {
            const over = e.target.closest('.card[draggable="true"]');
            // Sadece kartın tamamen dışına çıkıldığında hedef işaretini kaldır (iç elemanlara geçişte titremesin)
            if (over && e.relatedTarget && over.contains(e.relatedTarget)) return;
            if (over) {
                over.classList.remove('is-drop-target');
                if (lastDropTarget === over) lastDropTarget = null;
            }
        });

        on('drop', e => {
            if (!dragged) return;
            const target = e.target.closest('.card[draggable="true"]');
            if (!target || target === dragged || target.parentElement !== dragged.parentElement) return;
            e.preventDefault();
            clearDropTarget();
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

    /* Kurumsal logo (xlsx gömme icin PNG baytlari).
       Base64 olarak dosyaya gomuludur: file:// ile acildiginda da fetch gerektirmeden calisir. */
    const LOGO_ASPECT = 129 / 153; // yukseklik / genislik
    const LOGO_PNG_BASE64 =
        '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';;
    let logoBytesCache;
    function loadLogoBytes() {
        if (logoBytesCache !== undefined) return Promise.resolve(logoBytesCache);
        try {
            let bin;
            if (typeof atob === 'function') bin = atob(LOGO_PNG_BASE64);
            else if (typeof Buffer !== 'undefined') bin = Buffer.from(LOGO_PNG_BASE64, 'base64').toString('binary');
            else throw new Error('base64 cozucu yok');
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            logoBytesCache = bytes.length ? bytes : null;
        } catch (e) {
            logoBytesCache = null;
        }
        return Promise.resolve(logoBytesCache);
    }

    /* Logo ve Exhibit Grafik cizim parcasi (drawing1.xml) */
    function buildDrawingXml(items) {
        const emu = px => Math.round(px * 9525);
        const anchors = (items || []).map((it, idx) => {
            const cx = emu(it.widthPx || 88);
            const cy = emu(it.heightPx || Math.round((it.widthPx || 88) * LOGO_ASPECT));
            const col = it.col || 0;
            const row = it.row || 1;
            const colOff = it.colOff != null ? it.colOff : 95250;
            const rowOff = it.rowOff != null ? it.rowOff : 19050;
            return `  <xdr:oneCellAnchor>
    <xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>${colOff}</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>${rowOff}</xdr:rowOff></xdr:from>
    <xdr:ext cx="${cx}" cy="${cy}"/>
    <xdr:pic>
      <xdr:nvPicPr>
        <xdr:cNvPr id="${idx + 2}" name="${xmlEsc(it.name || ('Resim ' + (idx + 1)))}" descr="${xmlEsc(it.descr || '')}"/>
        <xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>
      </xdr:nvPicPr>
      <xdr:blipFill>
        <a:blip r:embed="${it.rId || ('rId' + (idx + 1))}"/>
        <a:stretch><a:fillRect/></a:stretch>
      </xdr:blipFill>
      <xdr:spPr>
        <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      </xdr:spPr>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:oneCellAnchor>`;
        }).join('\n');
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${anchors}
</xdr:wsDr>`;
    }

    function buildDrawingRelsXml(items) {
        const rels = (items || []).map((it, idx) =>
            `  <Relationship Id="${it.rId || ('rId' + (idx + 1))}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${it.mediaFile || ('image' + (idx + 1) + '.png')}"/>`
        ).join('\n');
        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${rels}
</Relationships>`;
    }

    const sheet1RelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`;

    function xmlEsc(v) {
        let s = String(v == null ? '' : v);
        if (/^[=@]/.test(s)) s = "'" + s;
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    }

    /* =========================================================================
       MCKINSEY / ZELAZNY STANDARDI VEKTÖREL EXHIBIT (GRAFİK) MOTORU
       - Hem A4 Kurumsal Yazdırma (Vektörel SVG) hem de Excel .xlsx (300 DPI PNG)
         tarafından ortak kullanılır.
       - 3D, gölge, gereksiz lejant veya dekoratif gürültü yoktur.
       - Her grafik doğrudan veri etiketli, sıfır taban çizgili ve tek vurgu renklidir.
       ========================================================================= */
    ATF.renderExhibitSvg = function (ex) {
        if (!ex) return '';
        const W = ex.width || 620;
        const H = ex.height || 265;
        const font = "'Plus Jakarta Sans','Segoe UI',Calibri,Arial,sans-serif";
        const esc = ATF.esc;
        const kind = ex.kind || 'hbar';
        const figNo = ex.figNo || 'SERGİ 1';
        const title = ex.title || '';
        const subtitle = ex.subtitle || '';
        const unit = ex.unit || '';
        const source = ex.source || 'Kaynak: Albayrak Finans PDKS (PostgreSQL 18 canlı veri tabanı)';

        // Üst başlık bloğu (McKinsey Exhibit Header: Fig No + Action Headline + Subtitle/Unit)
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="background:#FFFFFF;font-family:${font}">`;
        svg += `<rect x="0" y="0" width="${W}" height="${H}" fill="#FFFFFF"/>`;
        svg += `<line x1="0" y1="1.5" x2="72" y2="1.5" stroke="#E11D24" stroke-width="3"/>`;
        svg += `<line x1="72" y1="1.5" x2="${W}" y2="1.5" stroke="#CBD5E1" stroke-width="1"/>`;
        svg += `<text x="0" y="18" font-size="9.5" font-weight="800" fill="#E11D24" letter-spacing="0.8">${esc(figNo.toLocaleUpperCase('tr-TR'))}</text>`;
        if (unit) {
            svg += `<text x="${W}" y="18" font-size="9" font-weight="600" fill="#64748B" text-anchor="end">${esc(unit)}</text>`;
        }
        svg += `<text x="0" y="34" font-size="12.5" font-weight="800" fill="#0F172A">${esc(title)}</text>`;
        if (subtitle) {
            svg += `<text x="0" y="48" font-size="9.8" font-weight="500" fill="#475569">${esc(subtitle)}</text>`;
        }
        svg += `<line x1="0" y1="55" x2="${W}" y2="55" stroke="#E2E8F0" stroke-width="1"/>`;

        const topY = 64;
        const botY = H - 24;
        const plotH = botY - topY;

        if (kind === 'hbar') {
            // Yatay çubuk grafik + opsiyonel hedef çizgisi (ör. Departman Uyum Oranı vs %95 Hedef)
            const items = (ex.data || []).slice(0, 8);
            const n = Math.max(1, items.length);
            const labelW = ex.labelWidth || 152;
            const rightPad = 76;
            const plotX = labelW;
            const plotW = W - plotX - rightPad;
            const maxVal = ex.max != null ? ex.max : Math.max(100, ...items.map(d => Math.abs(+d.value || 0)), ex.target || 0);
            const rowH = plotH / n;
            const barH = Math.min(18, Math.max(9, rowH * 0.56));
            const xOf = v => plotX + Math.max(0, Math.min(1, (+v || 0) / (maxVal || 1))) * plotW;

            // Sıfır ekseni
            svg += `<line x1="${plotX}" y1="${topY}" x2="${plotX}" y2="${botY}" stroke="#94A3B8" stroke-width="1.2"/>`;

            items.forEach((d, idx) => {
                const cy = topY + (idx + 0.5) * rowH;
                const by = cy - barH / 2;
                const val = +d.value || 0;
                const bw = Math.max(2, xOf(val) - plotX);
                const isBelowTarget = ex.target != null ? (ex.lowerIsBetter ? val > ex.target : val < ex.target) : false;
                const fill = d.color || (isBelowTarget ? '#E11D24' : (d.highlight ? '#0B7A53' : '#1E293B'));
                const valTxt = d.display != null ? d.display : (String(val).replace('.', ',') + (ex.suffix || ''));

                if (idx % 2 === 1) {
                    svg += `<rect x="0" y="${topY + idx * rowH}" width="${W}" height="${rowH}" fill="#F8FAFC"/>`;
                }
                svg += `<text x="${plotX - 10}" y="${cy + 3.5}" font-size="10" font-weight="600" fill="#1E293B" text-anchor="end">${esc(d.label)}</text>`;
                svg += `<rect x="${plotX}" y="${by}" width="${bw.toFixed(1)}" height="${barH.toFixed(1)}" rx="2" fill="${fill}"/>`;
                svg += `<text x="${(plotX + bw + 6).toFixed(1)}" y="${cy + 3.5}" font-size="9.8" font-weight="700" fill="${fill}">${esc(valTxt)}</text>`;
            });

            if (ex.target != null) {
                const tx = xOf(ex.target);
                svg += `<line x1="${tx.toFixed(1)}" y1="${topY - 3}" x2="${tx.toFixed(1)}" y2="${botY + 2}" stroke="#E11D24" stroke-width="1.4" stroke-dasharray="4 3"/>`;
                const tLbl = ex.targetLabel || ('Hedef: ' + String(ex.target).replace('.', ',') + (ex.suffix || ''));
                svg += `<rect x="${Math.min(W - 95, Math.max(plotX, tx - 36)).toFixed(1)}" y="${topY - 9}" width="78" height="13" rx="2" fill="#FEF2F2" stroke="#FCA5A5" stroke-width="0.8"/>`;
                svg += `<text x="${Math.min(W - 56, Math.max(plotX + 39, tx + 3)).toFixed(1)}" y="${topY}" font-size="8.5" font-weight="800" fill="#B91C1C" text-anchor="middle">${esc(tLbl)}</text>`;
            }
        } else if (kind === 'diverging') {
            // Sıfır eksenli çift yönlü yatay bar (Net Süre Bakiyesi + / - dk)
            const items = (ex.data || []).slice(0, 8);
            const n = Math.max(1, items.length);
            const labelW = ex.labelWidth || 156;
            const rightPad = 56;
            const plotX = labelW;
            const plotW = W - plotX - rightPad;
            const maxAbs = Math.max(30, ...items.map(d => Math.abs(+d.value || 0))) * 1.18;
            const zeroX = plotX + plotW / 2;
            const rowH = plotH / n;
            const barH = Math.min(17, Math.max(9, rowH * 0.56));

            svg += `<line x1="${zeroX.toFixed(1)}" y1="${topY}" x2="${zeroX.toFixed(1)}" y2="${botY}" stroke="#475569" stroke-width="1.2"/>`;
            svg += `<text x="${zeroX.toFixed(1)}" y="${topY - 3}" font-size="8.5" font-weight="700" fill="#64748B" text-anchor="middle">0 dk (Denge)</text>`;

            items.forEach((d, idx) => {
                const cy = topY + (idx + 0.5) * rowH;
                const by = cy - barH / 2;
                const val = +d.value || 0;
                const w = Math.max(2, (Math.abs(val) / maxAbs) * (plotW / 2));
                const isPos = val >= 0;
                const bx = isPos ? zeroX : (zeroX - w);
                const fill = isPos ? '#0B7A53' : '#C8191E';
                const valTxt = d.display != null ? d.display : ((val > 0 ? '+' : '') + val + ' dk');

                if (idx % 2 === 1) {
                    svg += `<rect x="0" y="${topY + idx * rowH}" width="${W}" height="${rowH}" fill="#F8FAFC"/>`;
                }
                svg += `<text x="${plotX - 10}" y="${cy + 3.5}" font-size="9.6" font-weight="600" fill="#1E293B" text-anchor="end">${esc(d.label)}</text>`;
                svg += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${w.toFixed(1)}" height="${barH.toFixed(1)}" rx="2" fill="${fill}"/>`;
                const tx = isPos ? (zeroX + w + 5) : (zeroX - w - 5);
                const anchor = isPos ? 'start' : 'end';
                svg += `<text x="${tx.toFixed(1)}" y="${cy + 3.5}" font-size="9.2" font-weight="700" fill="${fill}" text-anchor="${anchor}">${esc(valTxt)}</text>`;
            });
        } else if (kind === 'waterfall') {
            // McKinsey Köprü (Bridge / Waterfall) Grafiği
            const steps = ex.data || [];
            const n = Math.max(1, steps.length);
            const L = 46, R = 24, B = 24;
            const pW = W - L - R;
            const pH = plotH - B;
            let running = 0;
            const computed = steps.map(s => {
                const v = +s.value || 0;
                if (s.isTotal) {
                    const start = 0, end = v;
                    running = v;
                    return Object.assign({}, s, { start, end, v });
                }
                const start = running;
                const end = running + v;
                running = end;
                return Object.assign({}, s, { start, end, v });
            });
            const allVals = [0, ...computed.flatMap(c => [c.start, c.end])];
            const minV = Math.min(0, ...allVals);
            const maxV = Math.max(10, ...allVals);
            const span = (maxV - minV) * 1.18 || 1;
            const yOf = v => topY + pH - ((v - minV) / span) * pH;
            const zeroY = yOf(0);
            const colW = Math.min(72, pW / n * 0.54);

            svg += `<line x1="${L}" y1="${zeroY.toFixed(1)}" x2="${W - R}" y2="${zeroY.toFixed(1)}" stroke="#94A3B8" stroke-width="1.2"/>`;

            computed.forEach((c, i) => {
                const cx = L + (i + 0.5) * (pW / n);
                const x = cx - colW / 2;
                const y1 = yOf(Math.max(c.start, c.end));
                const y2 = yOf(Math.min(c.start, c.end));
                const h = Math.max(3, y2 - y1);
                const fill = c.color || (c.isTotal ? '#1E293B' : (c.v >= 0 ? '#0B7A53' : '#C8191E'));
                svg += `<rect x="${x.toFixed(1)}" y="${y1.toFixed(1)}" width="${colW.toFixed(1)}" height="${h.toFixed(1)}" rx="2.5" fill="${fill}"/>`;
                if (i < computed.length - 1) {
                    const nextX = L + (i + 1.5) * (pW / n) - colW / 2;
                    const connY = yOf(c.end);
                    svg += `<line x1="${(x + colW).toFixed(1)}" y1="${connY.toFixed(1)}" x2="${nextX.toFixed(1)}" y2="${connY.toFixed(1)}" stroke="#94A3B8" stroke-width="1" stroke-dasharray="3 2"/>`;
                }
                const lbl = c.display != null ? c.display : ((c.v > 0 && !c.isTotal ? '+' : '') + String(c.v).replace('.', ','));
                const ly = c.v >= 0 || c.isTotal ? (y1 - 6) : (y2 + 12);
                svg += `<text x="${cx.toFixed(1)}" y="${Math.max(topY + 9, ly).toFixed(1)}" font-size="10" font-weight="800" fill="${fill}" text-anchor="middle">${esc(lbl)}</text>`;
                svg += `<text x="${cx.toFixed(1)}" y="${(topY + pH + 15).toFixed(1)}" font-size="9.5" font-weight="600" fill="#1E293B" text-anchor="middle">${esc(c.label)}</text>`;
            });
        } else if (kind === 'stacked100') {
            // %100 Yığılmış Yatay Bar (örn. İzin Türü x Onay Durumu)
            const rows = (ex.data || []).slice(0, 7);
            const segKeys = ex.segments || [
                { key: 'ok', label: 'Onaylandı', color: '#0B7A53' },
                { key: 'warn', label: 'Bekliyor', color: '#B4690E' },
                { key: 'bad', label: 'Reddedildi', color: '#C8191E' }
            ];
            const labelW = ex.labelWidth || 148;
            const rightPad = 68;
            const plotX = labelW;
            const plotW = W - plotX - rightPad;
            const legH = 16;
            const availH = plotH - legH;
            const n = Math.max(1, rows.length);
            const rowH = availH / n;
            const barH = Math.min(18, Math.max(10, rowH * 0.56));

            // Üst kompakt lejant
            let lx = plotX;
            segKeys.forEach(sk => {
                svg += `<rect x="${lx}" y="${topY - 2}" width="9" height="9" rx="2" fill="${sk.color}"/>`;
                svg += `<text x="${lx + 13}" y="${topY + 6}" font-size="9" font-weight="700" fill="#334155">${esc(sk.label)}</text>`;
                lx += 88;
            });

            rows.forEach((r, idx) => {
                const cy = topY + legH + (idx + 0.5) * rowH;
                const by = cy - barH / 2;
                const tot = segKeys.reduce((s, sk) => s + (+r[sk.key] || 0), 0) || 1;
                svg += `<text x="${plotX - 10}" y="${cy + 3.5}" font-size="9.8" font-weight="600" fill="#1E293B" text-anchor="end">${esc(r.label)}</text>`;
                let curX = plotX;
                segKeys.forEach(sk => {
                    const v = +r[sk.key] || 0;
                    if (v <= 0) return;
                    const sw = (v / tot) * plotW;
                    svg += `<rect x="${curX.toFixed(1)}" y="${by.toFixed(1)}" width="${Math.max(1.5, sw).toFixed(1)}" height="${barH.toFixed(1)}" fill="${sk.color}"/>`;
                    if (sw >= 26) {
                        svg += `<text x="${(curX + sw / 2).toFixed(1)}" y="${cy + 3.5}" font-size="8.8" font-weight="700" fill="#FFFFFF" text-anchor="middle">${v}</text>`;
                    }
                    curX += sw;
                });
                svg += `<text x="${(plotX + plotW + 8).toFixed(1)}" y="${cy + 3.5}" font-size="9.5" font-weight="700" fill="#334155">Top: ${r.total != null ? r.total : tot}</text>`;
            });
        } else if (kind === 'trend') {
            // Zaman Serisi Çizgi + Hedef Eşiği + Nokta Etiketleri
            const pts = ex.data || [];
            const n = Math.max(1, pts.length);
            const L = 42, R = 22, B = 22;
            const pW = W - L - R;
            const pH = plotH - B;
            const vals = pts.map(p => +p.value || 0);
            const minV = ex.min != null ? ex.min : Math.max(0, Math.floor(Math.min(...vals, ex.target || 100) - 6));
            const maxV = ex.max != null ? ex.max : Math.ceil(Math.max(...vals, ex.target || 100) + 4);
            const span = (maxV - minV) || 1;
            const xOf = i => L + (n === 1 ? pW / 2 : (i * pW / (n - 1)));
            const yOf = v => topY + pH - ((v - minV) / span) * pH;

            for (let g = 0; g <= 3; g++) {
                const gv = minV + (span * g / 3);
                const gy = yOf(gv);
                svg += `<line x1="${L}" y1="${gy.toFixed(1)}" x2="${W - R}" y2="${gy.toFixed(1)}" stroke="#E2E8F0" stroke-width="1"/>`;
                svg += `<text x="${L - 6}" y="${(gy + 3).toFixed(1)}" font-size="8.8" fill="#64748B" text-anchor="end">${Math.round(gv)}${esc(ex.suffix || '')}</text>`;
            }

            if (ex.target != null) {
                const ty = yOf(ex.target);
                svg += `<line x1="${L}" y1="${ty.toFixed(1)}" x2="${W - R}" y2="${ty.toFixed(1)}" stroke="#E11D24" stroke-width="1.3" stroke-dasharray="4 3"/>`;
                svg += `<text x="${L + 2}" y="${(ty - 4).toFixed(1)}" font-size="8.5" font-weight="700" fill="#E11D24">${esc(ex.targetLabel || ('Hedef: ' + ex.target + (ex.suffix || '')))}</text>`;
            }

            if (pts.length > 1) {
                const poly = pts.map((p, i) => `${xOf(i).toFixed(1)},${yOf(+p.value || 0).toFixed(1)}`).join(' ');
                const area = `M${xOf(0).toFixed(1)},${(topY + pH).toFixed(1)} L` + pts.map((p, i) => `${xOf(i).toFixed(1)},${yOf(+p.value || 0).toFixed(1)}`).join(' L') + ` L${xOf(n - 1).toFixed(1)},${(topY + pH).toFixed(1)} Z`;
                svg += `<path d="${area}" fill="#1E293B" fill-opacity="0.07"/>`;
                svg += `<polyline fill="none" stroke="#1E293B" stroke-width="2.2" points="${poly}"/>`;
            }

            const stepLbl = Math.max(1, Math.ceil(n / 7));
            pts.forEach((p, i) => {
                const px = xOf(i), py = yOf(+p.value || 0);
                const below = ex.target != null && (+p.value || 0) < ex.target;
                const dotCol = below ? '#E11D24' : '#0B7A53';
                svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${below ? 3.8 : 3}" fill="${dotCol}" stroke="#FFFFFF" stroke-width="1"/>`;
                if (i === 0 || i === n - 1 || i % stepLbl === 0 || below) {
                    svg += `<text x="${px.toFixed(1)}" y="${(py - 6).toFixed(1)}" font-size="8.4" font-weight="700" fill="${below ? '#C8191E' : '#1E293B'}" text-anchor="middle">${String(p.value).replace('.', ',')}${esc(ex.suffix || '')}</text>`;
                }
                if (i === 0 || i === n - 1 || i % stepLbl === 0) {
                    svg += `<text x="${px.toFixed(1)}" y="${(topY + pH + 14).toFixed(1)}" font-size="8.6" fill="#475569" text-anchor="middle">${esc(p.label)}</text>`;
                }
            });
        } else {
            // Dikey Sütun / Pareto Grafiği (vbar)
            const items = (ex.data || []).slice(0, 8);
            const n = Math.max(1, items.length);
            const L = 42, R = 18, B = 24;
            const pW = W - L - R;
            const pH = plotH - B;
            const maxV = Math.max(1, ...items.map(d => +d.value || 0), ex.target || 0) * 1.18;
            const yOf = v => topY + pH - ((+v || 0) / maxV) * pH;
            const bw = Math.min(54, pW / n * 0.56);

            svg += `<line x1="${L}" y1="${(topY + pH).toFixed(1)}" x2="${W - R}" y2="${(topY + pH).toFixed(1)}" stroke="#94A3B8" stroke-width="1.2"/>`;

            const maxItemVal = Math.max(...items.map(d => +d.value || 0));
            items.forEach((d, i) => {
                const cx = L + (i + 0.5) * (pW / n);
                const val = +d.value || 0;
                const by = yOf(val);
                const bh = Math.max(2, topY + pH - by);
                const isPeak = val === maxItemVal && val > 0;
                const fill = d.color || (isPeak ? '#E11D24' : '#1E293B');
                const valTxt = d.display != null ? d.display : (String(val).replace('.', ',') + (ex.suffix || ''));

                svg += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${fill}"/>`;
                svg += `<text x="${cx.toFixed(1)}" y="${(by - 5).toFixed(1)}" font-size="9.2" font-weight="700" fill="${fill}" text-anchor="middle">${esc(valTxt)}</text>`;
                svg += `<text x="${cx.toFixed(1)}" y="${(topY + pH + 14).toFixed(1)}" font-size="9" font-weight="600" fill="#1E293B" text-anchor="middle">${esc(d.label)}</text>`;
            });

            if (ex.target != null && ex.target > 0) {
                const ty = yOf(ex.target);
                svg += `<line x1="${L}" y1="${ty.toFixed(1)}" x2="${W - R}" y2="${ty.toFixed(1)}" stroke="#64748B" stroke-width="1.2" stroke-dasharray="4 3"/>`;
                svg += `<text x="${W - R}" y="${(ty - 4).toFixed(1)}" font-size="8.5" font-weight="700" fill="#475569" text-anchor="end">${esc(ex.targetLabel || ('Ort: ' + ex.target))}</text>`;
            }
        }

        // Alt kaynak şeridi
        svg += `<line x1="0" y1="${H - 15}" x2="${W}" y2="${H - 15}" stroke="#E2E8F0" stroke-width="0.8"/>`;
        svg += `<text x="0" y="${H - 4}" font-size="8.2" fill="#64748B">${esc(source)}</text>`;
        svg += `</svg>`;
        return svg;
    };

    /* SVG dizgesini yüksek çözünürlüklü (300 DPI eşdeğeri) PNG Uint8Array baytlarına çevirir */
    ATF.svgToPngBytes = function (svgMarkup, widthPx, heightPx, scale) {
        if (!svgMarkup || typeof document === 'undefined' || typeof Image === 'undefined') {
            return Promise.resolve(null);
        }
        const w = widthPx || 620;
        const h = heightPx || 265;
        const sc = scale || 2.5;
        return new Promise(resolve => {
            try {
                const img = new Image();
                const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = Math.round(w * sc);
                        canvas.height = Math.round(h * sc);
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        URL.revokeObjectURL(url);
                        const dataUrl = canvas.toDataURL('image/png');
                        const b64 = dataUrl.split(',')[1] || '';
                        const bin = atob(b64);
                        const bytes = new Uint8Array(bin.length);
                        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                        resolve(bytes.length ? bytes : null);
                    } catch (err) {
                        URL.revokeObjectURL(url);
                        resolve(null);
                    }
                };
                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    resolve(null);
                };
                img.src = url;
            } catch (e) {
                resolve(null);
            }
        });
    };

    /* =========================================================================
       KURUMSAL EXCEL (.xlsx) VE A4 YAYIN YARDIMCILARI (Sayısal Ayrıştırıcı & A4 Print)
       ========================================================================= */
    function parseCorporateNumericCell(val, colHeader) {
        if (typeof val === 'number' && Number.isFinite(val)) {
            const h = String(colHeader || '').toLocaleLowerCase('tr-TR');
            if (h.includes('(%)') || h.includes('oran') || h.includes('uyum')) {
                return { num: val > 1 ? +(val / 100).toFixed(4) : +val.toFixed(4), kind: 'pct' };
            }
            if (!Number.isInteger(val)) return { num: +val.toFixed(2), kind: 'dec' };
            return { num: val, kind: 'int' };
        }
        if (typeof val !== 'string') return null;
        const s = val.trim();
        if (!s || s === '—' || s === '-') return null;
        // Sicil, talep kodu, saat aralığı veya tarih formatlarını metin olarak koru
        if (/^(ALB-|LV-|AL-|SH-|TK-|ŞB-)/i.test(s)) return null;
        if (/^\d{2}:\d{2}/.test(s) || /^\d{2}\.\d{2}\.\d{4}/.test(s) || /^\d{4}-\d{2}-\d{2}/.test(s)) return null;

        // "%94,2" veya "% 94.2" -> yüzde
        const pctMatch = s.match(/^%\s*([+-]?\d+(?:[.,]\d+)?)$/) || s.match(/^([+-]?\d+(?:[.,]\d+)?)\s*%$/);
        if (pctMatch) {
            const n = parseFloat(pctMatch[1].replace(',', '.'));
            if (Number.isFinite(n)) return { num: +(n / 100).toFixed(4), kind: 'pct' };
        }

        // "+2 sa 15 dk" veya "−1 sa 10 dk" -> toplam dakika (signed)
        const hrMinMatch = s.match(/^([+−-])?\s*(\d+)\s*sa\s*(\d+)\s*dk$/i);
        if (hrMinMatch) {
            const sign = (hrMinMatch[1] === '-' || hrMinMatch[1] === '−') ? -1 : 1;
            const totalMin = sign * (parseInt(hrMinMatch[2], 10) * 60 + parseInt(hrMinMatch[3], 10));
            return { num: totalMin, kind: hrMinMatch[1] ? 'signed' : 'int' };
        }

        // "+120 dk", "-45 dk", "185 dk", "8,5 sa", "14 gün", "18 m"
        const unitMatch = s.match(/^([+−-])?\s*(\d+(?:[.,]\d+)?)\s*(dk|sa|saat|gün|kişi|kayıt|m)?$/i);
        if (unitMatch) {
            const signStr = unitMatch[1] || '';
            const sign = (signStr === '-' || signStr === '−') ? -1 : 1;
            const raw = parseFloat(unitMatch[2].replace(',', '.'));
            if (!Number.isFinite(raw)) return null;
            const num = sign * raw;
            if (signStr) return { num, kind: 'signed' };
            if (!Number.isInteger(num)) return { num, kind: 'dec' };
            return { num, kind: 'int' };
        }
        return null;
    }

    /* =========================================================================
       A4 KURUMSAL YAYIN MOTORU — Bağımsız belge (kendi CSS'i, iframe ile yazdırır)
       Uygulama stil dosyasından izoledir; koyu zemin/beyaz metin kullanmaz, bu
       yüzden tarayıcı "arka plan grafikleri" kapalı olsa da okunaklı basar.
       ========================================================================= */
    ATF.buildExecutivePrintHtml = function (model) {
        const m = model || {};
        const esc = ATF.esc;
        const nowStr = new Date().toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const reportNo = m.reportNo || ('PDKS-' + new Date().toISOString().slice(0, 10));
        const scqa = m.scqa || [];
        const kpis = m.kpis || [];
        const exhibits = (m.exhibits || []).slice(0, 2);
        const summaryHeaders = m.summaryHeaders || [];
        const summaryRows = m.summaryRows || [];
        const headers = m.headers || [];
        const rows = (m.rows || []).slice(0, 100);
        const notes = m.notes || [];

        const toneOf = k => {
            if (k.tone) return k.tone;
            if (k.color === '#C8191E') return 'bad';
            if (k.color === '#B4690E') return 'warn';
            return 'ok';
        };
        const toneText = t => t === 'bad' ? 'Aksiyon Gerekli' : (t === 'warn' ? 'İzlenmeli' : 'Hedefle Uyumlu');

        const scqaHtml = scqa.map(item => {
            const tag = item.tag || item[0] || 'BULGU';
            const txt = item.text || item[1] || '';
            return `<div class="scqa-row"><span class="scqa-tag">${esc(tag)}</span><p>${esc(txt)}</p></div>`;
        }).join('');

        const scorecard = kpis.length ? `<table class="tbl">
            <thead><tr><th style="width:26%">Performans Göstergesi (KPI)</th><th style="width:18%">Dönem Gerçekleşen</th><th style="width:30%">Kurumsal Hedef / Referans</th><th style="width:26%">Değerlendirme</th></tr></thead>
            <tbody>${kpis.map(k => {
                const t = toneOf(k);
                return `<tr><td><b>${esc(k.label || k.l || '')}</b></td><td class="num"><b>${esc(k.value || k.v || '—')}</b></td><td>${esc(k.target || k.sub || k.s || 'Kurumsal Standart')}</td><td><span class="badge ${t}">${esc(toneText(t))}</span></td></tr>`;
            }).join('')}</tbody></table>` : '';

        const matrix = (summaryHeaders.length && summaryRows.length) ? `<table class="tbl">
            <thead><tr>${summaryHeaders.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
            <tbody>${summaryRows.map(r => `<tr>${r.map((c, ci) => `<td class="${ci === 0 ? '' : 'num'}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';

        const detail = (headers.length && rows.length) ? `<table class="tbl tbl-detail">
            <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(r => `<tr>${r.map((c, ci) => `<td class="${ci <= 3 ? '' : 'num'}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';

        const exhibitHtml = exhibits.map(ex => `<figure class="fig">${ATF.renderExhibitSvg(Object.assign({ width: 520, height: 240 }, ex))}</figure>`).join('');

        const noteList = (notes.length ? notes : [
            'Veriler Albayrak Finans PDKS PostgreSQL 18 veritabanından gerçekleşen puantaj kayıtlarından üretilmiştir.',
            'Gecikme = İlk Giriş − (Personelin atanmış vardiya başlangıcı + tolerans). Onaylı saatlik izinler gecikmeden otomatik mahsup edilir.',
            'Net Süre Bakiyesi = Toplam Onaylı Ek Mesai (dk) − Toplam Gecikme (dk). Şube geofence sınırı Haversine ≤ 30 metredir.'
        ]).map(n => `<li>${esc(n)}</li>`).join('');

        return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>${esc(m.fileName || m.title || 'Albayrak PDKS Raporu')}</title>
<style>
  @page { size: A4 portrait; margin: 12mm 12mm 14mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { color: #0F172A; font-family: "Segoe UI", Calibri, Arial, sans-serif; font-size: 9pt; line-height: 1.42; }
  @media screen { body { width: 210mm; margin: 0 auto; padding: 12mm; } }
  h1, h2, h3, p, ol, ul { margin: 0; }
  /* ---- Masthead ---- */
  .mast { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; padding-bottom: 7px; border-bottom: 2px solid #0F172A; }
  .mast-l { display: flex; gap: 10px; align-items: flex-start; min-width: 0; }
  .logo { width: 42px; height: 36px; flex: 0 0 42px; }
  .logo svg { width: 100%; height: 100%; display: block; }
  .kicker { font-size: 7pt; font-weight: 800; letter-spacing: .09em; color: #C2181D; text-transform: uppercase; }
  .mast h1 { font-size: 13pt; font-weight: 800; line-height: 1.22; margin-top: 2px; letter-spacing: -.01em; }
  .mast .sub { font-size: 8pt; color: #475569; margin-top: 2px; }
  .docbox { border-collapse: collapse; font-size: 7.2pt; width: 200px; flex: 0 0 200px; border: 1px solid #CBD5E1; }
  .docbox th { text-align: left; padding: 2.4px 5px; background: #F1F5F9; color: #475569; font-weight: 800; letter-spacing: .04em; border-bottom: 1px solid #E2E8F0; border-right: 1px solid #E2E8F0; }
  .docbox td { padding: 2.4px 5px; font-weight: 700; border-bottom: 1px solid #E2E8F0; }
  /* ---- Action banner ---- */
  .action { margin-top: 8px; padding: 8px 10px; border: 1px solid #E2E8F0; border-left: 3px solid #C2181D; break-inside: avoid; }
  .action .lab { font-size: 6.8pt; font-weight: 800; letter-spacing: .08em; color: #C2181D; text-transform: uppercase; }
  .action h2 { font-size: 10.2pt; font-weight: 800; line-height: 1.34; margin: 2px 0 5px; }
  .scqa { padding-top: 5px; border-top: 1px solid #E2E8F0; }
  .scqa-row { display: flex; gap: 6px; align-items: baseline; font-size: 7.6pt; padding: 1.5px 0; break-inside: avoid; }
  .scqa-tag { flex: 0 0 132px; font-size: 6.4pt; font-weight: 800; letter-spacing: .04em; color: #0F172A; background: #EEF2F7; border: 1px solid #CBD5E1; padding: 1px 4px; border-radius: 2px; text-transform: uppercase; text-align: center; }
  .scqa-row p { flex: 1 1 auto; min-width: 0; color: #1E293B; }
  /* ---- Sections ---- */
  .sec { margin-top: 11px; }
  .sec-head { display: flex; align-items: baseline; gap: 7px; padding-bottom: 3px; margin-bottom: 5px; border-bottom: 1.2px solid #0F172A; break-after: avoid; }
  .sec-no { font-size: 6.6pt; font-weight: 800; letter-spacing: .07em; color: #C2181D; text-transform: uppercase; }
  .sec-head h3 { font-size: 8.6pt; font-weight: 800; letter-spacing: .02em; text-transform: uppercase; }
  /* ---- Tables ---- */
  .tbl { width: 100%; border-collapse: collapse; font-size: 7.8pt; font-variant-numeric: tabular-nums; }
  .tbl thead { display: table-header-group; }
  .tbl tr { break-inside: avoid; }
  .tbl th { background: #EEF2F7; color: #0F172A; font-size: 6.8pt; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; text-align: left; padding: 3.4px 5px; border: 1px solid #CBD5E1; vertical-align: bottom; }
  .tbl td { padding: 3px 5px; border: 1px solid #E2E8F0; color: #1E293B; }
  .tbl tbody tr:nth-child(even) td { background: #F8FAFC; }
  .tbl .num { text-align: right; white-space: nowrap; }
  .badge { display: inline-block; font-size: 6.6pt; font-weight: 800; padding: 0.5px 4px; border-radius: 2px; border: 1px solid; }
  .badge.ok { background: #EAF8F2; color: #0B7A53; border-color: #B7E3D1; }
  .badge.warn { background: #FEF5E7; color: #9A5A08; border-color: #F3D6A8; }
  .badge.bad { background: #FDECEC; color: #B0161B; border-color: #F4BFBF; }
  /* ---- Exhibits ---- */
  .figs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; break-inside: avoid; }
  .fig { border: 1px solid #CBD5E1; padding: 5px 6px; margin: 0; }
  .fig svg { width: 100%; height: auto; display: block; }
  /* ---- Footer ---- */
  .foot { margin-top: 12px; padding-top: 6px; border-top: 1.2px solid #0F172A; break-inside: avoid; }
  .foot .notes { font-size: 7.2pt; color: #475569; }
  .foot .notes b { color: #0F172A; letter-spacing: .03em; }
  .foot ol { padding-left: 14px; margin-top: 2px; }
  .sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; text-align: center; }
  .sign > div { border-top: 1px solid #64748B; padding-top: 3px; }
  .sign span { display: block; font-size: 6.4pt; font-weight: 800; color: #64748B; letter-spacing: .05em; }
  .sign b { display: block; font-size: 8pt; margin-top: 1px; }
  .sign small { display: block; font-size: 6.6pt; color: #94A3B8; margin-top: 9px; }
  .pbreak { break-before: page; }
  /* Yalnızca ekranda görünen önizleme araç çubuğu; çıktıya girmez */
  .bar { position: sticky; top: 0; z-index: 9; display: flex; align-items: center; gap: 10px; padding: 8px 12px; margin: 0 0 10px; background: #0F172A; color: #fff; font-size: 9pt; border-radius: 4px; }
  .bar b { font-size: 9pt; letter-spacing: .02em; }
  .bar .sp { flex: 1 1 auto; }
  .bar button { font: inherit; font-weight: 700; cursor: pointer; padding: 5px 12px; border-radius: 4px; border: 1px solid transparent; background: #C2181D; color: #fff; }
  .bar button.ghost { background: transparent; border-color: #475569; color: #E2E8F0; }
  @media print { .bar { display: none !important; } }
</style></head><body>
  <div class="bar"><b>A4 Yönetim Raporu Önizlemesi</b><span class="sp"></span><button onclick="window.print()">Yazdır / PDF Kaydet</button><button class="ghost" onclick="window.close()">Kapat</button></div>
  <header class="mast">
    <div class="mast-l">
      <div class="logo">${ATF.LOGO}</div>
      <div>
        <div class="kicker">Albayrak Tasarruf Finansman A.Ş. · Kurumsal Yönetim Raporu</div>
        <h1>${esc(m.title)}</h1>
        <p class="sub">${esc(m.subtitle || '')}</p>
      </div>
    </div>
    <table class="docbox">
      <tr><th>Belge No</th><td>${esc(reportNo)}</td></tr>
      <tr><th>Gizlilik</th><td>HİZMETE ÖZEL</td></tr>
      <tr><th>Dönem</th><td>${esc(m.period || 'Aktif Dönem')}</td></tr>
      <tr><th>Kapsam</th><td>${esc(m.scope || 'Tüm Şubeler')}</td></tr>
      <tr><th>Üretim</th><td>${esc(nowStr)}</td></tr>
    </table>
  </header>

  ${m.actionTitle ? `<section class="action">
    <div class="lab">Yönetici Sonuç Bildirimi (Executive Action Title)</div>
    <h2>${esc(m.actionTitle)}</h2>
    ${scqaHtml ? `<div class="scqa">${scqaHtml}</div>` : ''}
  </section>` : ''}

  ${scorecard ? `<section class="sec">
    <div class="sec-head"><span class="sec-no">Bölüm 01</span><h3>Temel Performans Göstergeleri ve Hedef Karşılaştırması</h3></div>
    ${scorecard}
  </section>` : ''}

  ${exhibitHtml ? `<section class="sec">
    <div class="sec-head"><span class="sec-no">Bölüm 02</span><h3>Kantitatif Yönetim Sergileri (Exhibits)</h3></div>
    <div class="figs">${exhibitHtml}</div>
  </section>` : ''}

  ${matrix ? `<section class="sec">
    <div class="sec-head"><span class="sec-no">Bölüm 03</span><h3>${esc(m.summaryTitle || 'Birim ve Departman Performans Matrisi')}</h3></div>
    ${matrix}
  </section>` : ''}

  ${detail ? `<section class="sec pbreak">
    <div class="sec-head"><span class="sec-no">Bölüm 04</span><h3>Detaylı Puantaj ve Denetim Cetveli · ${rows.length} Kayıt</h3></div>
    ${detail}
  </section>` : ''}

  <footer class="foot">
    <div class="notes"><b>Metodoloji, Veri Kaynağı ve Denetim Notları:</b><ol>${noteList}</ol></div>
    <div class="sign">
      <div><span>Hazırlayan Birim / Yetkili</span><b>${esc(m.preparedBy || 'İnsan Kaynakları Analitik Birimi')}</b><small>İmza / Tarih</small></div>
      <div><span>Kontrol Eden</span><b>PDKS &amp; Operasyon Kontrol</b><small>İmza / Tarih</small></div>
      <div><span>Onaylayan Makam</span><b>${esc(m.approvedBy || 'İnsan Kaynakları Müdürlüğü')}</b><small>Mühür / İmza</small></div>
    </div>
  </footer>
</body></html>`;
    };

    ATF.printExecutiveReport = function (model) {
        const m = model || {};
        if (!m.title) { window.print(); return; }
        if (ATF.__printing) return;
        ATF.__printing = true;

        const html = ATF.buildExecutivePrintHtml(m);
        const release = () => { ATF.__printing = false; };

        // 1) Tercih edilen yol: kendi penceresinde A4 önizleme + yazdırma (uygulama CSS'i devrede değil)
        let win = null;
        try { win = window.open('', 'atfExecutiveReportPrint', 'width=1000,height=1200'); } catch (e) { win = null; }

        if (win && win.document) {
            try {
                win.document.open();
                win.document.write(html);
                win.document.close();
                try {
                    win.addEventListener('afterprint', () => setTimeout(release, 400));
                } catch (e) { }
                setTimeout(() => {
                    try { win.focus(); win.print(); } catch (e) { }
                    setTimeout(release, 2000);
                }, 320);
                return;
            } catch (e) {
                try { win.close(); } catch (e2) { }
            }
        }

        // 2) Açılır pencere engellendiyse: gizli çerçeve ile yazdır
        let frame = document.getElementById('atfPrintFrame');
        if (!frame) {
            frame = document.createElement('iframe');
            frame.id = 'atfPrintFrame';
            frame.setAttribute('aria-hidden', 'true');
            frame.setAttribute('title', 'A4 rapor çıktısı');
            document.body.appendChild(frame);
        }
        frame.setAttribute('style', 'position:fixed;left:-20000px;top:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none');

        try {
            const doc = frame.contentWindow.document;
            doc.open();
            doc.write(html);
            doc.close();
            try { frame.contentWindow.addEventListener('afterprint', release); } catch (e) { }
            setTimeout(() => {
                try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) { window.print(); }
                setTimeout(release, 1500);
            }, 220);
        } catch (e) {
            release();
            window.print();
        }
    };

    ATF.excelReport = async function (opts) {
        const o = opts || {};
        const fileName = (o.fileName || 'albayrak-pdks-rapor').replace(/\.(csv|xls|xlsx)$/i, '') + '.xlsx';
        const title = o.title || 'ALBAYRAK FİNANS KURUMSAL PDKS RAPORU';
        const subtitle = o.subtitle || 'İnsan Kaynakları ve Konum Doğrulama Analitiği';
        const actionTitle = o.actionTitle || '';
        const scqa = o.scqa || [];
        const exhibits = (o.exhibits || []).slice(0, 2);
        const orientation = o.orientation || 'portrait'; // Varsayılan: A4 Dikey (Portrait)
        const meta = o.meta || [];
        const kpis = o.kpis || [];
        const kvSections = o.kvSections || [];
        const summaryTitle = o.summaryTitle || 'DEPARTMAN BAZLI UYUM, EK MESAİ VE NET BAKİYE ÖZETİ';
        const summaryHeaders = o.summaryHeaders || [];
        const summaryRows = o.summaryRows || [];
        const extraSections = o.extraSections || [];
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

        // Varsa McKinsey Exhibit grafiklerini 300 DPI PNG baytlarına çevir
        const exhibitPngs = [];
        for (let ei = 0; ei < exhibits.length; ei++) {
            const exSpec = Object.assign({ width: 620, height: 255 }, exhibits[ei]);
            const svgStr = ATF.renderExhibitSvg(exSpec);
            const pngBytes = await ATF.svgToPngBytes(svgStr, exSpec.width, exSpec.height, 2.5);
            if (pngBytes && pngBytes.length) {
                exhibitPngs.push({ spec: exSpec, bytes: pngBytes });
            }
        }

        const detectStatusStyleIdx = (val, rowIdx) => {
            const s = String(val || '').trim().toLocaleLowerCase('tr-TR');
            if (s.includes('ofiste') || s.includes('zamanında') || s.includes('onaylandı') || s.includes('çözüldü') || s.includes('eşlendi') || s.includes('uygun') || s.includes('hedef üstü') || s.includes('pozitif') || s.includes('temiz') || s.includes('tam uyum')) {
                return 8; // OK (Yeşil Rozet)
            }
            if (s === 'geç' || s.includes('geç kaldı') || s.includes('geç /') || s.includes('bekliyor') || s.includes('orta') || s.includes('işlemde') || s.includes('uyarı') || s.includes('normal') || s.includes('izlenmeli') || s.includes('izinli')) {
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
            if (/^[=@]/.test(s)) s = "'" + s;
            s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
            if (sharedMap.has(s)) return sharedMap.get(s);
            const idx = sharedStrings.length;
            sharedStrings.push(s);
            sharedMap.set(s, idx);
            return idx;
        };

        /* ================= SHEET 1: RAPOR ÖZETİ (A4 DİKEY PDKS FORMATI) ================= */
        const sheet1Rows = [];
        const merges1 = [];
        let r1 = 0;
        const maxExtraCols = extraSections.reduce((m, sec) => Math.max(m, (sec.headers || []).length), 0);
        const colCount1 = Math.max(summaryHeaders.length || 8, maxExtraCols, 8);

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
            addBlank1(10);
            addMergedBanner1(`${sectionNo}. ${String(text).toLocaleUpperCase('tr-TR')}`, 4, 20);
        };

        const addBlank1 = (heightPt = 10) => {
            r1++;
            sheet1Rows.push(`<row r="${r1}" ht="${heightPt}" customHeight="1"/>`);
        };

        /* Dikey Anahtar-Değer (Sicil & Tahakkuk Kartı) Tablosu Üretici (A: Etiket1 [1 sütun] | B:D Değer1 [3 sütun] | E: Etiket2 [1 sütun] | F:H Değer2 [3 sütun]) */
        const renderKvSection1 = (sec) => {
            if (!sec || !sec.rows || !sec.rows.length) return;
            addSectionHeader1(sec.title || 'Bilgi Kartı');
            const half = Math.floor(colCount1 / 2); // 4
            // Etiketler 1'er geniş sütun (A ve E), değerler 3'er birleşik sütun (B:D ve F:H) alır; böylece uzun metinler kesilmez
            const lblSpan1 = 1;
            const lblSpan2 = 1;

            sec.rows.forEach((pairRow, ri) => {
                r1++;
                const l1 = pairRow[0] != null ? String(pairRow[0]) : '';
                const v1 = pairRow[1] != null ? String(pairRow[1]) : '—';
                const l2 = pairRow[2] != null ? String(pairRow[2]) : '';
                const v2 = pairRow[3] != null ? String(pairRow[3]) : (l2 ? '—' : '');

                const pickValStyle = (val) => {
                    const sv = String(val || '').trim();
                    if (sv.startsWith('+')) return 8;
                    if (sv.startsWith('-') || sv.startsWith('−')) return 10;
                    if (sv.length <= 28) return detectStatusStyleIdx(sv, ri);
                    return (ri % 2 === 1) ? 7 : 6;
                };
                const stV1 = pickValStyle(v1);
                const stV2 = l2 ? pickValStyle(v2) : ((ri % 2 === 1) ? 7 : 6);

                const cL1Start = 0, cL1End = lblSpan1 - 1;
                const cV1Start = lblSpan1, cV1End = half - 1;
                const cL2Start = half, cL2End = half + lblSpan2 - 1;
                const cV2Start = half + lblSpan2, cV2End = colCount1 - 1;

                let cells = '';
                for (let c = 0; c < colCount1; c++) {
                    const ref = colRef(c) + r1;
                    if (c === cL1Start) cells += `<c r="${ref}" s="11" t="s"><v>${getSstIdx(l1)}</v></c>`;
                    else if (c <= cL1End) cells += `<c r="${ref}" s="11"/>`;
                    else if (c === cV1Start) cells += `<c r="${ref}" s="${stV1}" t="s"><v>${getSstIdx(v1)}</v></c>`;
                    else if (c <= cV1End) cells += `<c r="${ref}" s="${stV1}"/>`;
                    else if (c === cL2Start) cells += `<c r="${ref}" s="11" t="s"><v>${getSstIdx(l2)}</v></c>`;
                    else if (c <= cL2End) cells += `<c r="${ref}" s="11"/>`;
                    else if (c === cV2Start) cells += `<c r="${ref}" s="${stV2}" t="s"><v>${getSstIdx(v2)}</v></c>`;
                    else cells += `<c r="${ref}" s="${stV2}"/>`;
                }
                sheet1Rows.push(`<row r="${r1}" ht="20" customHeight="1">${cells}</row>`);
                if (cL1End > cL1Start) merges1.push(`${colRef(cL1Start)}${r1}:${colRef(cL1End)}${r1}`);
                if (cV1End > cV1Start) merges1.push(`${colRef(cV1Start)}${r1}:${colRef(cV1End)}${r1}`);
                if (cL2End > cL2Start) merges1.push(`${colRef(cL2Start)}${r1}:${colRef(cL2End)}${r1}`);
                if (cV2End > cV2Start) merges1.push(`${colRef(cV2Start)}${r1}:${colRef(cV2End)}${r1}`);
            });
        };

        /* Sheet 1 Üzerinde Tam Genişlikli Dikey Tablo Üretici (Gerçek Sayısal Hücre + Canlı Toplam/Ortalama Formülleri) */
        const renderTableSection1 = (secTitle, tHeaders, tRows) => {
            if (!tHeaders || !tHeaders.length || !tRows || !tRows.length) return;
            addSectionHeader1(secTitle);

            const hLen = tHeaders.length;
            r1++;
            let sHdrCells = '';
            tHeaders.forEach((h, ci) => {
                sHdrCells += `<c r="${colRef(ci)}${r1}" s="5" t="s"><v>${getSstIdx(h)}</v></c>`;
            });
            for (let c = hLen; c < colCount1; c++) {
                sHdrCells += `<c r="${colRef(c)}${r1}" s="5"/>`;
            }
            sheet1Rows.push(`<row r="${r1}" ht="22" customHeight="1">${sHdrCells}</row>`);
            if (hLen < colCount1) {
                merges1.push(`${colRef(hLen - 1)}${r1}:${colRef(colCount1 - 1)}${r1}`);
            }

            const firstDataRow = r1 + 1;
            const colNumericKinds = new Array(hLen).fill(null);

            tRows.forEach((sr, sri) => {
                r1++;
                let srCells = '';
                let lastStyle = (sri % 2 === 1) ? 7 : 6;
                sr.forEach((val, ci) => {
                    let st = (sri % 2 === 1) ? 7 : 6;
                    const strVal = String(val == null ? '' : val);
                    const parsed = (ci > 0) ? parseCorporateNumericCell(val, tHeaders[ci]) : null;
                    if (ci === sr.length - 1 && !parsed) {
                        st = detectStatusStyleIdx(val, sri);
                    } else if (strVal.startsWith('+')) {
                        st = 8;
                    } else if (strVal.startsWith('-') || strVal.startsWith('−')) {
                        st = 10;
                    }
                    lastStyle = st;
                    if (parsed) {
                        colNumericKinds[ci] = colNumericKinds[ci] || parsed.kind;
                        const numStyle = parsed.kind === 'pct' ? 28 : parsed.kind === 'signed' ? 29 : 27;
                        srCells += `<c r="${colRef(ci)}${r1}" s="${numStyle}"><v>${parsed.num}</v></c>`;
                    } else {
                        srCells += `<c r="${colRef(ci)}${r1}" s="${st}" t="s"><v>${getSstIdx(val)}</v></c>`;
                    }
                });
                for (let c = sr.length; c < colCount1; c++) {
                    srCells += `<c r="${colRef(c)}${r1}" s="${lastStyle}"/>`;
                }
                sheet1Rows.push(`<row r="${r1}" ht="19" customHeight="1">${srCells}</row>`);
                if (sr.length < colCount1) {
                    merges1.push(`${colRef(sr.length - 1)}${r1}:${colRef(colCount1 - 1)}${r1}`);
                }
            });

            const lastDataRow = r1;
            if (tRows.length >= 2 && colNumericKinds.some(Boolean)) {
                r1++;
                let totCells = '';
                for (let ci = 0; ci < hLen; ci++) {
                    const ref = `${colRef(ci)}${r1}`;
                    const kind = colNumericKinds[ci];
                    if (ci === 0) {
                        totCells += `<c r="${ref}" s="30" t="s"><v>${getSstIdx('KURUM TOPLAMI / ORTALAMA')}</v></c>`;
                    } else if (kind) {
                        const rangeRef = `${colRef(ci)}${firstDataRow}:${colRef(ci)}${lastDataRow}`;
                        const fn = kind === 'pct' ? 'AVERAGE' : 'SUM';
                        const fStyle = kind === 'pct' ? 31 : 30;
                        totCells += `<c r="${ref}" s="${fStyle}"><f>${fn}(${rangeRef})</f></c>`;
                    } else {
                        totCells += `<c r="${ref}" s="30" t="s"><v>${getSstIdx('—')}</v></c>`;
                    }
                }
                for (let c = hLen; c < colCount1; c++) {
                    totCells += `<c r="${colRef(c)}${r1}" s="30"/>`;
                }
                sheet1Rows.push(`<row r="${r1}" ht="21" customHeight="1">${totCells}</row>`);
                if (hLen < colCount1) {
                    merges1.push(`${colRef(hLen - 1)}${r1}:${colRef(colCount1 - 1)}${r1}`);
                }
            }
        };

        // ============ 1. KURUMSAL ANTET (logo + unvan + rapor künyesi + belge kontrol) ============
        addBlank1(8);
        addSideBanner1('ALBAYRAK TASARRUF FİNANSMAN A.Ş.', 18, 24, 1);
        addSideBanner1('Personel Devam Kontrol Sistemi (PDKS) · Kurumsal Yönetim ve Denetim Raporu', 19, 16, 1);
        addSideBanner1(`Belge No: ${reportNo}    ·    Üretim: ${nowStr}    ·    Gizlilik: HİZMETE ÖZEL / KURUM İÇİ`, 19, 14, 1);
        addBlank1(6);
        addMergedBanner1('', 20, 4);
        addBlank1(8);
        addMergedBanner1(title, 21, 26);
        addMergedBanner1(subtitle, 22, 18);

        if (meta.length) {
            const metaJoined = meta.map(m => `${m[0]}: ${m[1]}`).join('    ·    ');
            addMergedBanner1(metaJoined, 3, 18);
        }

        // ============ 1B. MCKINSEY ACTION TITLE & SCQA YÖNETİCİ SENTEZİ ============
        if (actionTitle || scqa.length) {
            addSectionHeader1('Yönetici Sonuç Bildirimi ve Stratejik Bulgular (SCQA Sentezi)');
            if (actionTitle) {
                addMergedBanner1('ANA SONUÇ: ' + actionTitle, 17, 24);
            }
            scqa.forEach(item => {
                const tag = item.tag || item[0] || 'BULGU';
                const txt = item.text || item[1] || '';
                r1++;
                let cells = '';
                for (let c = 0; c < colCount1; c++) {
                    const ref = colRef(c) + r1;
                    if (c === 0) cells += `<c r="${ref}" s="11" t="s"><v>${getSstIdx(tag)}</v></c>`;
                    else if (c === 1) cells += `<c r="${ref}" s="6" t="s"><v>${getSstIdx(txt)}</v></c>`;
                    else cells += `<c r="${ref}" s="6"/>`;
                }
                sheet1Rows.push(`<row r="${r1}" ht="21" customHeight="1">${cells}</row>`);
                merges1.push(`B${r1}:${colRef(colCount1 - 1)}${r1}`);
            });
        }

        // ============ 2. PERSONEL / KURUM DİKEY BİLGİ KARTLARI (kvSections - Varsa) ============
        if (kvSections.length) {
            kvSections.forEach(sec => renderKvSection1(sec));
        }

        // ============ 3. TEMEL PERFORMANS KARŞILAŞTIRMA MATRİSİ (SCORECARD TABLOSU) ============
        if (kpis.length) {
            addSectionHeader1('Temel Performans Göstergeleri ve Hedef Karşılaştırma Tablosu (KPI Scorecard)');
            r1++;
            let kHdr = '';
            const scHeaders = ['Performans Göstergesi (KPI)', 'Dönem Gerçekleşen', 'Kurumsal Hedef / Referans', 'Değerlendirme Durumu'];
            for (let c = 0; c < colCount1; c++) {
                const ref = colRef(c) + r1;
                if (c === 0) kHdr += `<c r="${ref}" s="5" t="s"><v>${getSstIdx(scHeaders[0])}</v></c>`;
                else if (c === 2) kHdr += `<c r="${ref}" s="5" t="s"><v>${getSstIdx(scHeaders[1])}</v></c>`;
                else if (c === 4) kHdr += `<c r="${ref}" s="5" t="s"><v>${getSstIdx(scHeaders[2])}</v></c>`;
                else if (c === 6) kHdr += `<c r="${ref}" s="5" t="s"><v>${getSstIdx(scHeaders[3])}</v></c>`;
                else kHdr += `<c r="${ref}" s="5"/>`;
            }
            sheet1Rows.push(`<row r="${r1}" ht="22" customHeight="1">${kHdr}</row>`);
            merges1.push(`A${r1}:B${r1}`, `C${r1}:D${r1}`, `E${r1}:F${r1}`, `G${r1}:${colRef(colCount1 - 1)}${r1}`);

            kpis.forEach((k, idx) => {
                r1++;
                const rowSt = (idx % 2 === 1) ? 7 : 6;
                const vStr = String(k.value || k.v || '0');
                const parsedKpi = parseCorporateNumericCell(vStr, k.label || k.l);
                const statusTxt = k.status || (k.color === '#C8191E' || k.tone === 'bad'
                    ? 'Aksiyon Gerekli / Kritik'
                    : (k.color === '#B4690E' || k.tone === 'warn' ? 'İzlenmeli' : 'Hedefle Uyumlu'));
                const statusSt = detectStatusStyleIdx(statusTxt, idx);
                let cells = '';
                for (let c = 0; c < colCount1; c++) {
                    const ref = colRef(c) + r1;
                    if (c === 0) {
                        cells += `<c r="${ref}" s="${rowSt}" t="s"><v>${getSstIdx(k.label || k.l || '')}</v></c>`;
                    } else if (c === 2) {
                        if (parsedKpi) {
                            const nSt = parsedKpi.kind === 'pct' ? 28 : parsedKpi.kind === 'signed' ? 29 : 27;
                            cells += `<c r="${ref}" s="${nSt}"><v>${parsedKpi.num}</v></c>`;
                        } else {
                            cells += `<c r="${ref}" s="13" t="s"><v>${getSstIdx(vStr)}</v></c>`;
                        }
                    } else if (c === 4) {
                        cells += `<c r="${ref}" s="${rowSt}" t="s"><v>${getSstIdx(k.target || k.sub || k.s || 'Kurumsal Standart')}</v></c>`;
                    } else if (c === 6) {
                        cells += `<c r="${ref}" s="${statusSt}" t="s"><v>${getSstIdx(statusTxt)}</v></c>`;
                    } else if (c === 7 && colCount1 >= 8) {
                        cells += `<c r="${ref}" s="${statusSt}"/>`;
                    } else {
                        cells += `<c r="${ref}" s="${rowSt}"/>`;
                    }
                }
                sheet1Rows.push(`<row r="${r1}" ht="20" customHeight="1">${cells}</row>`);
                merges1.push(`A${r1}:B${r1}`, `C${r1}:D${r1}`, `E${r1}:F${r1}`, `G${r1}:${colRef(colCount1 - 1)}${r1}`);
            });
        }

        // ============ 3B. GÖMÜLÜ 300 DPI MCKINSEY SERGİLERİ (EXHIBIT 1 & EXHIBIT 2) ============
        const exhibitAnchors = [];
        if (exhibitPngs.length) {
            addSectionHeader1('Kantitatif Yönetim Sergileri ve Görsel Analiz (Exhibits)');
            exhibitPngs.forEach((ep, idx) => {
                const startRow0 = r1; // 0-indexed row for drawing anchor
                exhibitAnchors.push({
                    col: 0,
                    row: startRow0,
                    colOff: 45000,
                    rowOff: 25000,
                    widthPx: 610,
                    heightPx: 248,
                    name: ep.spec.figNo || ('Sergi ' + (idx + 1)),
                    descr: ep.spec.title || 'Kurumsal PDKS Grafiği',
                    bytes: ep.bytes
                });
                // Grafik yüksekliği (~250px) kadar satır boşluğu aç (11 satır x 18pt ≈ 264px)
                for (let s = 0; s < 11; s++) {
                    addBlank1(18);
                }
            });
        }

        // ============ 4. ÖZET MATRİSİ & EK DİKEY TABLOLAR ============
        if (summaryHeaders.length && summaryRows.length) {
            renderTableSection1(summaryTitle, summaryHeaders, summaryRows);
        }

        if (extraSections.length) {
            extraSections.forEach(sec => {
                renderTableSection1(sec.title, sec.headers, sec.rows);
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

        // ============ 5. DEĞERLENDİRME VE METODOLOJİ NOTU ============
        addSectionHeader1('Değerlendirme ve Metodoloji Notu');

        const defaultNotes = [
            'Gecikme süresi, standart vardiya başlangıç saatine (08:30, 10 dk tolerans ile 08:40) göre hesaplanan pozitif sapmadır.',
            'Ek mesai süresi, vardiya bitişinden (17:30) sonra gerçekleşen onaylı fazla çalışma süresidir.',
            'Net süre bakiyesi = Toplam ek mesai − Toplam gecikme. Negatif bakiye kayıp süreyi gösterir.',
            'Konum doğrulaması şube merkezine 30 metre yarıçapla sınırlıdır; sahte konum (mock GPS) tespiti blokajla sonuçlanır.',
            `Tüm detaylı kayıtlar bu sayfanın devamında ve "Puantaj Detay" sekmesinde yer alır (${rows.length} satır · A4 Dikey yazdırmaya hazır).`
        ];
        (notes.length ? notes : defaultNotes).forEach((n, i) => {
            addMergedBanner1(`${i + 1})  ${n}`, 26, 15);
        });

        // ============ 6. ONAY VE İMZA BLOĞU ============
        addBlank1(20);
        addTwoColRow1('', '', 25, 22);
        addTwoColRow1('Hazırlayan', 'Onaylayan', 24, 13);
        addTwoColRow1(preparedBy || 'İnsan Kaynakları Yönetimi', approvedBy, 25, 13);

        addBlank1(12);
        addMergedBanner1(
            'Bu belge Albayrak Tasarruf Finansman A.Ş. PDKS sistemi tarafından otomatik üretilmiştir. Yetkisiz çoğaltılması yasaktır.',
            26,
            14
        );

        let cols1Xml = '<cols>';
        const col1Widths = [25, 15, 14, 15, 25, 15, 15, 30];
        for (let c = 1; c <= colCount1; c++) {
            // A4 Dikey (Portrait): A ve E (etiket sütunları) 25 birim, B:D (44 birim) ve F:H (60 birim) değer alanları
            const w = col1Widths[c - 1] || (c === colCount1 ? 26 : 15);
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
  <pageMargins left="0.25" right="0.25" top="0.4" bottom="0.6" header="0.2" footer="0.2"/>
  <pageSetup paperSize="9" scale="100" orientation="${orientation}" fitToWidth="1" fitToHeight="0" horizontalDpi="600" verticalDpi="600"/>
  <headerFooter><oddFooter>&amp;L Albayrak Tasarruf Finansman A.Ş. · PDKS&amp;C Rapor No: ${xmlEsc(reportNo)}&amp;R Sayfa &amp;P / &amp;N</oddFooter></headerFooter>
  ${(hasLogo || exhibitAnchors.length) ? '<drawing r:id="rId1"/>' : ''}
</worksheet>`;

        /* ================= SHEET 2: DETAYLI KAYIT TABLOSU (EK-1 · GERÇEK SAYISAL + SUBTOTAL) ================= */
        const sheet2Rows = [];
        const sheet2Merges = [];
        const colCount2 = headers.length || 1;

        // 1. satır: ek başlık bandı (her sayfada tekrarlanır)
        {
            const ekTitle = `EK-1 · DETAYLI PUANTAJ VE KAYIT CETVELİ (${rows.length} KAYIT) — ${title}`;
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

        const col2NumericKinds = new Array(colCount2).fill(null);

        rows.forEach((r, ri) => {
            const rNum = ri + 3;
            let rCells = '';
            r.forEach((val, ci) => {
                let st = (ri % 2 === 1) ? 7 : 6;
                const strVal = String(val == null ? '' : val);
                const parsed = (ci > 0 && ci < r.length - 1) ? parseCorporateNumericCell(val, headers[ci]) : null;
                if (ci === r.length - 1 || (ci >= r.length - 2 && !parsed)) {
                    st = detectStatusStyleIdx(val, ri);
                } else if (strVal.startsWith('+')) {
                    st = 8;
                } else if (strVal.startsWith('-') || strVal.startsWith('−')) {
                    st = 10;
                }
                if (parsed) {
                    col2NumericKinds[ci] = col2NumericKinds[ci] || parsed.kind;
                    const numStyle = parsed.kind === 'pct' ? 28 : parsed.kind === 'signed' ? 29 : 27;
                    rCells += `<c r="${colRef(ci)}${rNum}" s="${numStyle}"><v>${parsed.num}</v></c>`;
                } else {
                    rCells += `<c r="${colRef(ci)}${rNum}" s="${st}" t="s"><v>${getSstIdx(val)}</v></c>`;
                }
            });
            sheet2Rows.push(`<row r="${rNum}" ht="20" customHeight="1">${rCells}</row>`);
        });

        // Filtreye duyarlı SUBTOTAL satırı (en az 2 veri satırı varsa)
        if (rows.length >= 2 && col2NumericKinds.some(Boolean)) {
            const totRowNum = rows.length + 3;
            const lastDataRow2 = rows.length + 2;
            let totCells2 = '';
            for (let ci = 0; ci < colCount2; ci++) {
                const ref = `${colRef(ci)}${totRowNum}`;
                const kind = col2NumericKinds[ci];
                if (ci === 0) {
                    totCells2 += `<c r="${ref}" s="30" t="s"><v>${getSstIdx('TOPLAM / FİLTRE ÖZETİ')}</v></c>`;
                } else if (kind) {
                    const subFn = kind === 'pct' ? 101 : 109; // 101=AVERAGE, 109=SUM (filtreye duyarlı)
                    const fStyle = kind === 'pct' ? 31 : 30;
                    totCells2 += `<c r="${ref}" s="${fStyle}"><f>SUBTOTAL(${subFn},${colRef(ci)}3:${colRef(ci)}${lastDataRow2})</f></c>`;
                } else {
                    totCells2 += `<c r="${ref}" s="30" t="s"><v>${getSstIdx('—')}</v></c>`;
                }
            }
            sheet2Rows.push(`<row r="${totRowNum}" ht="22" customHeight="1">${totCells2}</row>`);
        }

        let cols2Xml = '<cols>';
        for (let c = 1; c <= colCount2; c++) {
            let maxLen = String(headers[c - 1] || '').length;
            for (let ri = 0; ri < rows.length; ri++) {
                const vLen = String((rows[ri] && rows[ri][c - 1]) != null ? rows[ri][c - 1] : '').length;
                if (vLen > maxLen) maxLen = vLen;
            }
            const w = Math.min(32, Math.max(12, maxLen + 5));
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
  ${autoFilterXml}
  ${merge2Xml}
  <printOptions horizontalCentered="1"/>
  <pageMargins left="0.2" right="0.2" top="0.45" bottom="0.6" header="0.2" footer="0.2"/>
  <pageSetup paperSize="9" scale="100" orientation="${orientation}" fitToWidth="1" fitToHeight="0" horizontalDpi="600" verticalDpi="600"/>
  <headerFooter><oddFooter>&amp;L Albayrak Tasarruf Finansman A.Ş. · PDKS — EK-1&amp;C Rapor No: ${xmlEsc(reportNo)}&amp;R Sayfa &amp;P / &amp;N</oddFooter></headerFooter>
</worksheet>`;

        /* ================= SHEET 3: METODOLOJİ, DENETİM VE BELGE KONTROLÜ ================= */
        const govRows = [
            ['Belge Numarası', reportNo, 'Sürüm & Gizlilik', 'v10.0 · HİZMETE ÖZEL / KURUM İÇİ'],
            ['Rapor Başlığı', title, 'Üretim Zamanı', nowStr],
            ['Hazırlayan Birim', preparedBy || 'İnsan Kaynakları Yönetimi', 'Onaylayan Makam', approvedBy],
            ['Veri Kaynağı', 'PostgreSQL 18 Canlı Veritabanı (Prisma ORM)', 'Kayıt Sayısı', `${rows.length} detay satırı · ${summaryRows.length} özet satırı`],
            ['Vardiya & Tolerans Kuralı', 'Standart 08:30 (+5 dk), Erken 08:00 (+5 dk), GM 09:00 (+10 dk)', 'Saatlik İzin Mahsubu', 'Onaylı saatlik izin süresi o günkü gecikmeden otomatik düşülür'],
            ['Net Süre Bakiyesi Formülü', 'Net Bakiye (dk) = Toplam Ek Mesai (dk) − Toplam Gecikme (dk)', '30m Geofence & Anti-Spoof', 'Haversine ≤ 30,0 m şube sınırı ve Android Mock GPS blokajı']
        ];
        const sheet3Rows = [];
        const sheet3Merges = [];
        let r3 = 1;
        sheet3Rows.push(`<row r="${r3}" ht="25" customHeight="1"><c r="A1" s="21" t="s"><v>${getSstIdx('METODOLOJİ, VERİ SÖZLÜĞÜ VE KURUMSAL DENETİM KÜNYESİ')}</v></c><c r="B1" s="21"/><c r="C1" s="21"/><c r="D1" s="21"/></row>`);
        sheet3Merges.push('A1:D1');
        r3++;
        sheet3Rows.push(`<row r="${r3}" ht="22" customHeight="1"><c r="A2" s="5" t="s"><v>${getSstIdx('Denetim Parametresi')}</v></c><c r="B2" s="5" t="s"><v>${getSstIdx('Değer / Kural Tanımı')}</v></c><c r="C2" s="5" t="s"><v>${getSstIdx('Denetim Parametresi')}</v></c><c r="D2" s="5" t="s"><v>${getSstIdx('Değer / Kural Tanımı')}</v></c></row>`);
        govRows.forEach((gr, gi) => {
            r3++;
            const st = gi % 2 === 1 ? 7 : 6;
            sheet3Rows.push(`<row r="${r3}" ht="21" customHeight="1"><c r="A${r3}" s="11" t="s"><v>${getSstIdx(gr[0])}</v></c><c r="B${r3}" s="${st}" t="s"><v>${getSstIdx(gr[1])}</v></c><c r="C${r3}" s="11" t="s"><v>${getSstIdx(gr[2])}</v></c><c r="D${r3}" s="${st}" t="s"><v>${getSstIdx(gr[3])}</v></c></row>`);
        });
        const sheet3Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <sheetViews><sheetView tabSelected="0" workbookViewId="0" showGridLines="0"/></sheetViews>
  <cols>
    <col min="1" max="1" width="26" customWidth="1"/>
    <col min="2" max="2" width="46" customWidth="1"/>
    <col min="3" max="3" width="26" customWidth="1"/>
    <col min="4" max="4" width="46" customWidth="1"/>
  </cols>
  <sheetData>${sheet3Rows.join('')}</sheetData>
  <mergeCells count="${sheet3Merges.length}">${sheet3Merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>
  <printOptions horizontalCentered="1"/>
  <pageMargins left="0.25" right="0.25" top="0.4" bottom="0.6" header="0.2" footer="0.2"/>
  <pageSetup paperSize="9" scale="100" orientation="portrait" fitToWidth="1" fitToHeight="0" horizontalDpi="600" verticalDpi="600"/>
  <headerFooter><oddFooter>&amp;L Albayrak Tasarruf Finansman A.Ş. · PDKS — Metodoloji&amp;C Rapor No: ${xmlEsc(reportNo)}&amp;R Sayfa &amp;P / &amp;N</oddFooter></headerFooter>
</worksheet>`;

        /* ================= PAYLAŞILAN STILLER & PAKET ================= */
        const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="+#,##0;\-#,##0;0"/>
  </numFmts>
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
  <cellXfs count="32">
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
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" indent="1" shrinkToFit="1"/></xf>
    <!-- 7: Tablo hücresi (zebra) -->
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" indent="1" shrinkToFit="1"/></xf>
    <!-- 8: Durum OK (yeşil) -->
    <xf numFmtId="0" fontId="6" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" shrinkToFit="1"/></xf>
    <!-- 9: Durum UYARI (kehribar) -->
    <xf numFmtId="0" fontId="7" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" shrinkToFit="1"/></xf>
    <!-- 10: Durum KRİTİK (kırmızı) -->
    <xf numFmtId="0" fontId="8" fillId="8" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" shrinkToFit="1"/></xf>
    <!-- 11: KPI / Sicil etiketi -->
    <xf numFmtId="0" fontId="9" fillId="5" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" shrinkToFit="1"/></xf>
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
    <!-- 27: Sayısal hücre (#,##0 sağa hizalı) -->
    <xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 28: Yüzde hücresi (0.0% sağa hizalı) -->
    <xf numFmtId="10" fontId="6" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 29: İşaretli sayı hücresi (+#,##0;-#,##0;0) -->
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 30: Toplam / Formül satırı (#,##0 koyu zemin) -->
    <xf numFmtId="3" fontId="5" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <!-- 31: Toplam / Ortalama yüzde formül satırı (0.0% koyu zemin) -->
    <xf numFmtId="10" fontId="5" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;

        const sstXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">
  ${sharedStrings.map(s => `<si><t xml:space="preserve">${xmlEsc(s)}</t></si>`).join('')}
</sst>`;

        const drawingItems = [];
        if (hasLogo) {
            drawingItems.push({
                rId: 'rId1',
                mediaFile: 'image1.png',
                col: 0,
                row: 1,
                colOff: 95250,
                rowOff: 19050,
                widthPx: 88,
                heightPx: Math.round(88 * LOGO_ASPECT),
                name: 'Albayrak Finans Logosu',
                descr: 'Albayrak Tasarruf Finansman A.Ş. kurumsal logosu',
                bytes: logoBytes
            });
        }
        exhibitAnchors.forEach(ea => {
            const idx = drawingItems.length + 1;
            drawingItems.push(Object.assign({}, ea, {
                rId: 'rId' + idx,
                mediaFile: 'image' + idx + '.png'
            }));
        });
        const hasDrawing = drawingItems.length > 0;

        const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  ${hasDrawing ? '<Default Extension="png" ContentType="image/png"/>\n  <Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : ''}
</Types>`;

        const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

        const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Yonetici Ozeti" sheetId="1" r:id="rId1"/>
    <sheet name="Puantaj Cetveli" sheetId="2" r:id="rId4"/>
    <sheet name="Metodoloji ve Denetim" sheetId="3" r:id="rId5"/>
  </sheets>
  <definedNames>
    <definedName name="_xlnm.Print_Titles" localSheetId="1">'Puantaj Cetveli'!$1:$2</definedName>
  </definedNames>
  <calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`;

        const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
</Relationships>`;

        const zipEntries = [
            { name: '[Content_Types].xml', content: contentTypesXml },
            { name: '_rels/.rels', content: rootRelsXml },
            { name: 'xl/workbook.xml', content: workbookXml },
            { name: 'xl/_rels/workbook.xml.rels', content: workbookRelsXml },
            { name: 'xl/styles.xml', content: stylesXml },
            { name: 'xl/sharedStrings.xml', content: sstXml },
            { name: 'xl/worksheets/sheet1.xml', content: sheet1Xml },
            { name: 'xl/worksheets/sheet2.xml', content: sheet2Xml },
            { name: 'xl/worksheets/sheet3.xml', content: sheet3Xml }
        ];

        // Kurumsal logo + 300 DPI McKinsey Exhibit grafiklerini gömme
        if (hasDrawing) {
            zipEntries.push(
                { name: 'xl/worksheets/_rels/sheet1.xml.rels', content: sheet1RelsXml },
                { name: 'xl/drawings/drawing1.xml', content: buildDrawingXml(drawingItems) },
                { name: 'xl/drawings/_rels/drawing1.xml.rels', content: buildDrawingRelsXml(drawingItems) }
            );
            drawingItems.forEach(di => {
                zipEntries.push({ name: 'xl/media/' + di.mediaFile, content: di.bytes });
            });
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
