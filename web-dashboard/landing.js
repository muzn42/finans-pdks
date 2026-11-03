/* ==========================================================================
   landing.js · Albayrak Finans PDKS #FFFFFF 60 FPS Scroll-Scrubbing +
                Birim Seçimi Tetikli Ara Geçiş Videosu + Parola Gizlilik
   - Sahne 0 (%0 - %10): İlk açılışta tam ortada sadece "Albayrak Finans PDKS —
     PERSONEL DEVAM KONTROL SİSTEMİ" logosu gözükür; kaydırdıkça sol üste yerleşir.
   - Sahne 1-4 (%9 - %85): Scroll ile SADECE 1. Video (scroll_frames/000..238) oynar.
   - Sahne 5A (%84 - %100): 1. Video bitince sağda İK / BT / Admin birim seçim ekranı gelir.
   - Sahne 5B (Birim Seçilince): Kullanıcı İK, BT veya Admin'i seçtiği anda son atılan
     ara geçiş videosu (scroll_frames/238..332) otomatik oynar ve Kullanıcı Adı / Şifre ekranı gelir.
   - Parolayı Göster (showPassword = true/false): privacy_frames/ (000..094) ileri / geri oynar.
   ========================================================================== */
(function () {
    'use strict';

    const VIDEO1_LAST_IDX = 238;      // 1. Video: 000..238 (239 kare)
    const BRIDGE_LAST_IDX = 332;      // Ara Geçiş Videosu: 239..332 (94 kare, toplam 333 kare)
    const TOTAL_SCROLL_FRAMES = 333;
    const PRIVACY_FRAME_COUNT = 95;   // Parola Gizlilik Videosu: 000..094 (95 kare)

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const smoothstep = (e0, e1, x) => {
        const t = clamp((x - e0) / (e1 - e0), 0, 1);
        return t * t * (3 - 2 * t);
    };
    const pad3 = (n) => String(n).padStart(3, '0');

    const PORTAL_META = {
        HR: {
            eyebrow: 'Albayrak Finans PDKS · İK',
            title: 'İnsan Kaynakları Girişi',
            sub: 'Personel ekleme (işe giriş), puantaj, ek mesai ve izin yönetimi için giriş yapın.'
        },
        IT: {
            eyebrow: 'Albayrak Finans PDKS · BT',
            title: 'Bilgi Teknolojileri Girişi',
            sub: '30m geofence güvenlik radarı, cihaz eşleme ve sistem denetimi için giriş yapın.'
        },
        ADMIN: {
            eyebrow: 'Albayrak Finans PDKS · Admin',
            title: 'Sistem Yöneticisi Girişi',
            sub: 'İK ve BT kullanıcı hesapları oluşturma ve modül yetkilerini yönetmek için giriş yapın.'
        }
    };

    function createSpring(initialValue, stiffness = 260, damping = 28, mass = 1) {
        return {
            value: initialValue,
            target: initialValue,
            velocity: 0,
            stiffness,
            damping,
            mass,
            step(dt) {
                const safeDt = Math.min(dt, 0.032);
                const displacement = this.value - this.target;
                const springForce = -this.stiffness * displacement;
                const dampingForce = -this.damping * this.velocity;
                const acceleration = (springForce + dampingForce) / this.mass;
                this.velocity += acceleration * safeDt;
                this.value += this.velocity * safeDt;
                if (Math.abs(this.value - this.target) < 0.0004 && Math.abs(this.velocity) < 0.0004) {
                    this.value = this.target;
                    this.velocity = 0;
                }
                return this.value;
            }
        };
    }

    function initLanding() {
        const shell = document.getElementById('authView');
        if (!shell) return;

        const stageWrap = document.getElementById('landingStageWrap');
        const canvas = document.getElementById('landingCanvas');
        const ctx = canvas ? canvas.getContext('2d', { alpha: false }) : null;
        const frameImg = document.getElementById('landingFrameImg');

        const brandPill = document.getElementById('landingBrandPill');
        const introSub = document.getElementById('landingIntroSub');
        const skipBtn = document.getElementById('landingSkipBtn');
        const scrollCue = document.getElementById('landingScrollCue');
        const progBar = document.getElementById('landingProgressBar');
        const authDock = document.getElementById('landingAuthDock');

        const portalChoiceView = document.getElementById('portalChoiceView');
        const loginForm = document.getElementById('loginForm');
        const portalBackBtn = document.getElementById('portalBackBtn');
        const selectedPortalEyebrow = document.getElementById('selectedPortalEyebrow');
        const selectedPortalTitle = document.getElementById('selectedPortalTitle');
        const selectedPortalSub = document.getElementById('selectedPortalSub');

        const togglePassBtn = document.getElementById('togglePass');
        const passInput = document.getElementById('loginPassword');

        if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, 1920, 1080);
        }

        // Kare Önbellekleri (scroll_frames 0..332 & privacy_frames 0..94)
        const scrollImages = new Array(TOTAL_SCROLL_FRAMES);
        const scrollLoaded = new Array(TOTAL_SCROLL_FRAMES).fill(false);
        const privacyImages = new Array(PRIVACY_FRAME_COUNT);
        const privacyLoaded = new Array(PRIVACY_FRAME_COUNT).fill(false);

        function loadScrollFrame(i) {
            if (scrollImages[i]) return;
            const img = new Image();
            img.decoding = 'async';
            img.onload = () => {
                scrollLoaded[i] = true;
                if (i === 0) drawCurrentState(true);
            };
            img.src = `assets/landing/scroll_frames/frame_${pad3(i)}.webp`;
            scrollImages[i] = img;
        }

        function loadPrivacyFrame(i) {
            if (privacyImages[i]) return;
            const img = new Image();
            img.decoding = 'async';
            img.onload = () => {
                privacyLoaded[i] = true;
            };
            img.src = `assets/landing/privacy_frames/frame_${pad3(i)}.webp`;
            privacyImages[i] = img;
        }

        loadScrollFrame(0);
        loadScrollFrame(VIDEO1_LAST_IDX);
        loadScrollFrame(BRIDGE_LAST_IDX);
        loadPrivacyFrame(0);
        loadPrivacyFrame(PRIVACY_FRAME_COUNT - 1);

        setTimeout(() => {
            for (let i = 0; i <= VIDEO1_LAST_IDX; i += 4) loadScrollFrame(i);
            for (let i = VIDEO1_LAST_IDX + 1; i <= BRIDGE_LAST_IDX; i++) loadScrollFrame(i);
            for (let i = 0; i < PRIVACY_FRAME_COUNT; i++) loadPrivacyFrame(i);
            setTimeout(() => {
                for (let i = 0; i <= VIDEO1_LAST_IDX; i++) loadScrollFrame(i);
            }, 80);
        }, 16);

        // Spring State'leri (stiffness: 260, damping: 28)
        const scrollSpring = createSpring(0, 260, 28);
        const logoSpring = createSpring(0, 260, 28);
        const dockSpring = createSpring(0, 260, 28);

        // Birim Seçimi (İK / BT / Admin) & Ara Video (238 -> 332) Durumu
        let roleChosen = false;
        let bridgeCursor = VIDEO1_LAST_IDX; // 238 .. 332
        const BRIDGE_FPS = 36;              // 94 kareyi ~2.5 saniyede akıcı oynatır

        // Parola Gizlilik (privacy_frames 0..94) Durumu
        let showPassword = false;
        let privacyCursor = 0;              // 0 .. 94
        const PRIVACY_FPS = 42;

        let lastRenderedKey = '';
        let lastTime = performance.now();

        function applyPortalMeta(role) {
            const meta = PORTAL_META[role] || PORTAL_META.HR;
            if (selectedPortalEyebrow) selectedPortalEyebrow.textContent = meta.eyebrow;
            if (selectedPortalTitle) selectedPortalTitle.textContent = meta.title;
            if (selectedPortalSub) selectedPortalSub.textContent = meta.sub;
            const segBtn = document.querySelector(`#portalSeg .seg-btn[data-portal="${role}"]`);
            if (segBtn) segBtn.click();
        }

        function choosePortalRole(role) {
            roleChosen = true;
            applyPortalMeta(role);
            if (portalChoiceView) portalChoiceView.hidden = true;
            if (loginForm) {
                loginForm.hidden = false;
                loginForm.style.animation = 'none';
                void loginForm.offsetWidth;
                loginForm.style.animation = '';
            }
            setTimeout(() => {
                if (window.ATF && window.ATF.placeSeg) {
                    window.ATF.placeSeg(document.getElementById('portalSeg'));
                }
                const emailInp = document.getElementById('loginEmail');
                if (emailInp) emailInp.focus();
            }, 40);
        }

        function resetToPortalChoice() {
            roleChosen = false;
            if (passInput && passInput.type === 'text') {
                passInput.type = 'password';
                syncPasswordPrivacyState();
            }
            if (loginForm) loginForm.hidden = true;
            if (portalChoiceView) {
                portalChoiceView.hidden = false;
                portalChoiceView.style.animation = 'none';
                void portalChoiceView.offsetWidth;
                portalChoiceView.style.animation = '';
            }
        }

        document.querySelectorAll('[data-choose-portal]').forEach(btn => {
            btn.addEventListener('click', () => {
                choosePortalRole(btn.getAttribute('data-choose-portal'));
            });
        });

        if (portalBackBtn) {
            portalBackBtn.addEventListener('click', resetToPortalChoice);
        }

        // Üstteki #portalSeg içinden sekme değiştirildiğinde başlığı da senkronize et
        const portalSegEl = document.getElementById('portalSeg');
        if (portalSegEl) {
            portalSegEl.addEventListener('click', (e) => {
                const b = e.target.closest('.seg-btn');
                if (!b) return;
                const role = b.getAttribute('data-portal');
                const meta = PORTAL_META[role] || PORTAL_META.HR;
                if (selectedPortalEyebrow) selectedPortalEyebrow.textContent = meta.eyebrow;
                if (selectedPortalTitle) selectedPortalTitle.textContent = meta.title;
                if (selectedPortalSub) selectedPortalSub.textContent = meta.sub;
            });
        }

        function computeTargetScroll() {
            if (shell.hidden) return;
            const maxScroll = Math.max(1, shell.offsetHeight - window.innerHeight);
            const rawP = clamp(window.scrollY / maxScroll, 0, 1);
            scrollSpring.target = rawP;
            logoSpring.target = clamp(rawP / 0.10, 0, 1);
            dockSpring.target = clamp((rawP - 0.83) / 0.13, 0, 1);
        }

        window.addEventListener('scroll', computeTargetScroll, { passive: true });
        window.addEventListener('resize', computeTargetScroll, { passive: true });
        computeTargetScroll();

        function scrollToLogin() {
            const maxScroll = Math.max(1, shell.offsetHeight - window.innerHeight);
            window.scrollTo({ top: maxScroll, behavior: 'smooth' });
        }
        if (skipBtn) skipBtn.addEventListener('click', scrollToLogin);
        if (scrollCue) scrollCue.addEventListener('click', scrollToLogin);

        function syncPasswordPrivacyState() {
            if (!passInput) return;
            showPassword = passInput.type === 'text';
            if (togglePassBtn) {
                togglePassBtn.classList.toggle('is-peeking', showPassword);
                togglePassBtn.setAttribute('aria-label', showPassword ? 'Parolayı gizle' : 'Parolayı göster');
            }
        }

        if (togglePassBtn) {
            togglePassBtn.addEventListener('click', () => {
                setTimeout(syncPasswordPrivacyState, 0);
            });
        }

        if (loginForm) {
            loginForm.addEventListener('submit', () => {
                if (passInput && passInput.type === 'text') {
                    passInput.type = 'password';
                    syncPasswordPrivacyState();
                }
            });
        }

        const appView = document.getElementById('appView');
        if (appView) {
            const obs = new MutationObserver(() => {
                const inApp = !appView.hidden;
                document.body.classList.toggle('in-app', inApp);
                if (inApp) {
                    window.scrollTo({ top: 0, behavior: 'instant' });
                } else {
                    computeTargetScroll();
                    drawCurrentState(true);
                    setTimeout(() => {
                        if (window.ATF && window.ATF.placeSeg) {
                            window.ATF.placeSeg(document.getElementById('portalSeg'));
                        }
                    }, 50);
                }
            });
            obs.observe(appView, { attributes: true, attributeFilter: ['hidden'] });
        }

        function findNearestLoaded(arr, loadedFlags, targetIdx, maxCount) {
            if (loadedFlags[targetIdx]) return arr[targetIdx];
            for (let d = 1; d < maxCount; d++) {
                if (targetIdx - d >= 0 && loadedFlags[targetIdx - d]) return arr[targetIdx - d];
                if (targetIdx + d < maxCount && loadedFlags[targetIdx + d]) return arr[targetIdx + d];
            }
            return null;
        }

        function renderFrameToStage(key, imgObj) {
            if (!imgObj || key === lastRenderedKey) return;
            lastRenderedKey = key;
            if (frameImg && frameImg.src !== imgObj.src) {
                frameImg.src = imgObj.src;
            }
            if (ctx && imgObj.complete && imgObj.naturalWidth > 0) {
                try {
                    ctx.drawImage(imgObj, 0, 0, 1920, 1080);
                } catch (_) {
                    // Ignore transient decode errors
                }
            }
        }

        function drawCurrentState(force = false) {
            if (shell.hidden) return;
            if (force) lastRenderedKey = '';

            const now = performance.now();
            const dt = Math.max(0.001, (now - lastTime) / 1000);
            lastTime = now;

            const p = scrollSpring.step(dt);
            const logoT = logoSpring.step(dt);
            const dockT = dockSpring.step(dt);

            // 1) Birim seçilince oynayan Ara Geçiş Videosu (238 <-> 332)
            const targetBridge = (roleChosen && p >= 0.78) ? BRIDGE_LAST_IDX : VIDEO1_LAST_IDX;
            if (Math.abs(bridgeCursor - targetBridge) > 0.01) {
                const stepB = BRIDGE_FPS * dt;
                if (bridgeCursor < targetBridge) {
                    bridgeCursor = Math.min(targetBridge, bridgeCursor + stepB);
                } else {
                    bridgeCursor = Math.max(targetBridge, bridgeCursor - stepB);
                }
            } else {
                bridgeCursor = targetBridge;
            }

            // 2) Parola gizlilik kare ilerletimi (0 <-> 94)
            const targetPrivFrame = (roleChosen && showPassword) ? (PRIVACY_FRAME_COUNT - 1) : 0;
            if (Math.abs(privacyCursor - targetPrivFrame) > 0.01) {
                const stepP = PRIVACY_FPS * dt;
                if (privacyCursor < targetPrivFrame) {
                    privacyCursor = Math.min(targetPrivFrame, privacyCursor + stepP);
                } else {
                    privacyCursor = Math.max(targetPrivFrame, privacyCursor - stepP);
                }
            } else {
                privacyCursor = targetPrivFrame;
            }

            // SAHNE 0 (Scroll %0 - %10):
            // İlk açılışta ekranın TAM ORTASINDA sadece "Albayrak Finans PDKS — PERSONEL DEVAM KONTROL SİSTEMİ" gözükür.
            if (brandPill) {
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const bw = brandPill.offsetWidth || 540;
                const bh = brandPill.offsetHeight || 130;

                const centerX = (vw - bw) * 0.5;
                const centerY = (vh - bh) * 0.47;
                const cornerX = 48;
                const cornerY = 26;

                const curX = lerp(centerX, cornerX, logoT);
                const curY = lerp(centerY, cornerY, logoT);
                const curScale = lerp(1.0, 0.42, logoT);
                brandPill.style.transform = `translate3d(${curX.toFixed(1)}px, ${curY.toFixed(1)}px, 0) scale(${curScale.toFixed(3)})`;
            }

            if (introSub) {
                const subAlpha = clamp(1 - logoT * 2.2, 0, 1);
                introSub.style.opacity = subAlpha.toFixed(3);
            }

            if (stageWrap) {
                const stageAlpha = smoothstep(0.02, 0.09, p);
                stageWrap.style.opacity = stageAlpha.toFixed(3);
            }

            if (scrollCue) {
                const cueAlpha = clamp(1 - p / 0.07, 0, 1);
                scrollCue.style.opacity = cueAlpha.toFixed(3);
                scrollCue.style.transform = `translate3d(-50%, ${((1 - cueAlpha) * 14).toFixed(1)}px, 0)`;
                scrollCue.style.pointerEvents = cueAlpha > 0.2 ? 'auto' : 'none';
            }

            // KARE SEÇİMİ:
            // - Parolayı Göster aktifse (veya geri dönüyorsa): privacy_frames[0..94]
            // - Scroll >= %84 ve birim seçildiyse: Ara Geçiş Videosu (scroll_frames[238..332])
            // - Scroll %9 - %84: SADECE 1. Video (scroll_frames[0..238])
            if (privacyCursor > 0.5 || (roleChosen && bridgeCursor >= BRIDGE_LAST_IDX - 0.5 && showPassword)) {
                const pIdx = clamp(Math.round(privacyCursor), 0, PRIVACY_FRAME_COUNT - 1);
                loadPrivacyFrame(pIdx);
                const imgObj = findNearestLoaded(privacyImages, privacyLoaded, pIdx, PRIVACY_FRAME_COUNT);
                renderFrameToStage(`priv_${pIdx}`, imgObj);
            } else if (p >= 0.83 && (roleChosen || bridgeCursor > VIDEO1_LAST_IDX + 0.5)) {
                const bIdx = clamp(Math.round(bridgeCursor), VIDEO1_LAST_IDX, BRIDGE_LAST_IDX);
                loadScrollFrame(bIdx);
                const imgObj = findNearestLoaded(scrollImages, scrollLoaded, bIdx, TOTAL_SCROLL_FRAMES);
                renderFrameToStage(`scroll_${bIdx}`, imgObj);
            } else {
                const scrubNorm = clamp((p - 0.09) / (0.84 - 0.09), 0, 1);
                const sIdx = clamp(Math.round(scrubNorm * VIDEO1_LAST_IDX), 0, VIDEO1_LAST_IDX);
                loadScrollFrame(sIdx);
                const imgObj = findNearestLoaded(scrollImages, scrollLoaded, sIdx, TOTAL_SCROLL_FRAMES);
                renderFrameToStage(`scroll_${sIdx}`, imgObj);
            }

            // SAHNE 5 (%83 - %100): Sağ yarıdaki kart (Birim Seçimi -> Kullanıcı Adı / Şifre)
            if (authDock) {
                const dockX = lerp(60, 0, dockT);
                const dockAlpha = clamp(dockT, 0, 1);
                authDock.style.opacity = dockAlpha.toFixed(3);
                authDock.style.transform = `translate3d(${dockX.toFixed(2)}px, -50%, 0)`;
                authDock.classList.toggle('is-interactive', dockAlpha > 0.6);
            }

            if (skipBtn) skipBtn.classList.toggle('is-hidden', p > 0.80);
            if (progBar) progBar.style.transform = `scaleY(${p.toFixed(3)})`;
        }

        function tick() {
            drawCurrentState(false);
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);

        setTimeout(() => {
            if (window.ATF && window.ATF.placeSeg) {
                window.ATF.placeSeg(document.getElementById('portalSeg'));
            }
        }, 120);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLanding);
    } else {
        initLanding();
    }
})();
