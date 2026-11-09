"use client";

import React, { useEffect } from "react";
import { AlbayrakLogo } from "@/components/brand/AlbayrakLogo";
import { ThreeStudioEnhancer } from "@/components/three/ThreeStudioEnhancer";

/**
 * Albayrak Finans PDKS — Ana Portal Kabuğu
 * - Giriş ekranında Three.js WebGL 3D sahnesi (ThreeStudioEnhancer) + 3D Anahtar Teslim
 *   ve Parola Gizlilik (scroll_frames & privacy_frames) deneyimini sunar.
 * - İçeride PostgreSQL 18 + Prisma + Zod + SSE canlı akış, 22 metriklik derin
 *   personel karnesi, sıralanabilir günlük PDKS cetveli, büyütülebilir interaktif
 *   KPI grafikleri ve dokunulmamış OOXML + gömülü logo Excel motorunu
 *   (/core-xlsx.js) eksiksiz çalıştırır. Canlı akış artık sağ altta yüzen bir
 *   çekmece değil, sol menüdeki "Vardiya & canlı akış" sekmesidir.
 */

const PDKS_SCRIPTS = [
  "/core-xlsx.js?v=9.12",
  "/legacy/data.js?v=9.12",
  "/legacy/app.js?v=9.12",
  "/legacy/landing.js?v=9.12"
] as const;

/** Her script tamamlandığında ince kırmızı boot çizgisinin ulaşacağı ilerleme. */
const BOOT_PROGRESS_STEPS = [0.34, 0.58, 0.8, 0.95];

let pdksScriptsPromise: Promise<void> | null = null;

function applyBootProgress(value: number): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--boot-progress", String(value));
}

/** Boot perdesini kapatır (idempotent). landing.js de aynı sinyali verir. */
function finishBoot(): void {
  if (typeof document === "undefined") return;
  applyBootProgress(1);
  window.setTimeout(() => document.body.classList.add("is-booted"), 160);
}

/**
 * Legacy script'leri sırayla ve tek sefer yükler.
 * Modül seviyesinde tek Promise tutulduğu için React StrictMode'un çift
 * mount'unda script'ler ikinci kez eklenmez veya yarıda kalmaz.
 */
function loadPdksScripts(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (pdksScriptsPromise) return pdksScriptsPromise;

  pdksScriptsPromise = PDKS_SCRIPTS.reduce<Promise<void>>(
    (chain, src, index) =>
      chain.then(
        () =>
          new Promise<void>((resolve) => {
            const settle = (el?: HTMLScriptElement) => {
              if (el) el.dataset.loaded = "true";
              applyBootProgress(BOOT_PROGRESS_STEPS[index] ?? 0.95);
              resolve();
            };

            const existing = document.querySelector(
              `script[data-pdks-src="${src}"]`
            ) as HTMLScriptElement | null;

            if (existing) {
              if (existing.dataset.loaded === "true") {
                settle(existing);
                return;
              }
              existing.addEventListener("load", () => settle(existing), {
                once: true
              });
              existing.addEventListener("error", () => settle(existing), {
                once: true
              });
              return;
            }

            const script = document.createElement("script");
            script.src = src;
            script.async = false;
            script.dataset.pdksSrc = src;
            script.onload = () => settle(script);
            script.onerror = () => settle(script);
            document.body.appendChild(script);
          })
      ),
    Promise.resolve()
  );

  return pdksScriptsPromise;
}

export function PdksPortalShell() {
  useEffect(() => {
    const onFormSubmit = async (e: Event) => {
      const form = e.target as HTMLFormElement | null;
      if (!form || form.id !== "loginForm") return;
      const emailEl = document.getElementById("loginEmail") as HTMLInputElement | null;
      const passEl = document.getElementById("loginPassword") as HTMLInputElement | null;
      const activePortalBtn = document.querySelector("#portalSeg .seg-btn.is-active") as HTMLElement | null;
      if (!emailEl?.value || !passEl?.value) return;

      try {
        await fetch("/api/v1/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: emailEl.value.trim(),
            password: passEl.value,
            portal: activePortalBtn?.dataset.portal || "HR"
          })
        });
      } catch {
        // İstemci oturumu devam eder
      }
    };

    document.addEventListener("submit", onFormSubmit, true);
    return () => document.removeEventListener("submit", onFormSubmit, true);
  }, []);

  useEffect(() => {
    applyBootProgress(0.12);
    const failsafe = window.setTimeout(finishBoot, 2800);
    void loadPdksScripts();

    return () => {
      window.clearTimeout(failsafe);
    };
  }, []);

  return (
    <>
      <div className="toasts" id="toasts" aria-live="polite" />

      {/* Three.js WebGL 3D Sahne Güçlendirici (#authView aktifken çalışır) */}
      <ThreeStudioEnhancer />

      {/* ============ GİRİŞ & SCROLL-DRIVEN 3D ANAHTAR TESLİM SAHNESİ (#FFFFFF) ============ */}
      <main className="auth-scroll-shell" id="authView">
        <div className="landing-brand-floating" id="landingBrandPill">
          <div className="landing-brand-row">
            <span className="brand-mark" id="authLogo">
              <AlbayrakLogo />
            </span>
            <span className="brand-word">
              Albayrak <b>Finans</b> <em className="brand-pdks-badge">PDKS</em>
            </span>
          </div>
          <div className="landing-intro-sub" id="landingIntroSub">
            <span className="landing-intro-line" />
            <span>PERSONEL DEVAM KONTROL SİSTEMİ</span>
            <span className="landing-intro-line" />
          </div>
          <div
            className="landing-boot-loader"
            id="landingBootLoader"
            role="status"
            aria-live="polite"
          >
            <span className="landing-boot-track" aria-hidden="true">
              <span className="landing-boot-bar" />
            </span>
            <span className="sr-only">Arayüz hazırlanıyor</span>
          </div>
        </div>

        <div className="landing-topbar-right">
          <button type="button" className="landing-skip-btn" id="landingSkipBtn">
            <span>Portal Seçimine Geç</span>
            <svg className="ic" viewBox="0 0 24 24" data-i="arrow" />
          </button>
        </div>

        <div className="landing-progress-rail" aria-hidden="true">
          <div className="landing-progress-bar" id="landingProgressBar" />
        </div>

        <div className="auth-ScrollStage">
          <div
            className="landing-stage-wrap"
            id="landingStageWrap"
            aria-hidden="true"
          >
            <canvas
              id="landingCanvas"
              className="landing-canvas"
              width={1920}
              height={1080}
            />
            <img
              id="landingFrameImg"
              className="landing-frame-img"
              src="/assets/landing/scroll_frames/frame_000.webp"
              alt=""
              decoding="sync"
              fetchPriority="high"
            />
          </div>

          <button type="button" className="landing-scroll-cue" id="landingScrollCue">
            <span className="scroll-mouse" aria-hidden="true" />
            <span>Aşağı kaydırın</span>
          </button>

          <section className="landing-auth-dock" id="landingAuthDock">
            <div className="auth-card" id="authCardShell">
              <div className="portal-choice-view" id="portalChoiceView">
                <header>
                  <div className="auth-card-eyebrow">Albayrak Finans PDKS</div>
                  <h2>Giriş birimini seçin</h2>
                  <p className="muted">
                    Personel Devam Kontrol Sistemi üzerinde işlem yapacağınız
                    yetkili yönetim portalını seçin.
                  </p>
                </header>

                <div className="portal-role-cards" role="list">
                  <button
                    type="button"
                    className="portal-role-card"
                    data-choose-portal="HR"
                  >
                    <span className="prc-ic red">
                      <svg className="ic" viewBox="0 0 24 24" data-i="users" />
                    </span>
                    <span className="prc-body">
                      <b>İnsan Kaynakları (İK)</b>
                      <small>
                        Personel ekleme (işe giriş), puantaj, ek mesai ve izin
                        yönetimi
                      </small>
                    </span>
                    <svg
                      className="ic prc-arr"
                      viewBox="0 0 24 24"
                      data-i="arrow"
                    />
                  </button>

                  <button
                    type="button"
                    className="portal-role-card"
                    data-choose-portal="IT"
                  >
                    <span className="prc-ic dark">
                      <svg className="ic" viewBox="0 0 24 24" data-i="shield" />
                    </span>
                    <span className="prc-body">
                      <b>Bilgi Teknolojileri (BT)</b>
                      <small>
                        30m geofence güvenlik radarı, cihaz eşleme ve parola
                        destek
                      </small>
                    </span>
                    <svg
                      className="ic prc-arr"
                      viewBox="0 0 24 24"
                      data-i="arrow"
                    />
                  </button>

                  <button
                    type="button"
                    className="portal-role-card"
                    data-choose-portal="ADMIN"
                  >
                    <span className="prc-ic info">
                      <svg className="ic" viewBox="0 0 24 24" data-i="key" />
                    </span>
                    <span className="prc-body">
                      <b>Sistem Yöneticisi (Admin)</b>
                      <small>
                        İK ve BT kullanıcıları oluşturma, modül ve rol
                        yetkilerini seçme
                      </small>
                    </span>
                    <svg
                      className="ic prc-arr"
                      viewBox="0 0 24 24"
                      data-i="arrow"
                    />
                  </button>
                </div>

                <footer className="auth-legal">
                  Yetkisiz erişim denemeleri 5651 sayılı Kanun kapsamında kayıt
                  altına alınır.
                </footer>
              </div>

              <form
                className="login-credentials-view"
                id="loginForm"
                autoComplete="on"
                noValidate
                hidden
              >
                <header>
                  <div className="login-step-top">
                    <div
                      className="auth-card-eyebrow"
                      id="selectedPortalEyebrow"
                    >
                      Albayrak Finans PDKS
                    </div>
                    <button
                      type="button"
                      className="portal-back-btn"
                      id="portalBackBtn"
                      title="Birim seçimine dön"
                    >
                      ← Birim değiştir
                    </button>
                  </div>
                  <h2 id="selectedPortalTitle">Yönetim Portalına Giriş</h2>
                  <p className="muted" id="selectedPortalSub">
                    Yetkili kullanıcı adı (kurumsal e-posta) ve parolanızla
                    giriş yapın.
                  </p>
                </header>

                <div
                  className="seg seg-lg"
                  id="portalSeg"
                  role="tablist"
                  aria-label="Portal seçimi"
                >
                  <span className="seg-thumb" />
                  <button
                    type="button"
                    role="tab"
                    className="seg-btn is-active"
                    data-portal="HR"
                    aria-selected="true"
                  >
                    <svg className="ic" viewBox="0 0 24 24" data-i="users" />
                    İK
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className="seg-btn"
                    data-portal="IT"
                    aria-selected="false"
                  >
                    <svg className="ic" viewBox="0 0 24 24" data-i="shield" />
                    BT
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className="seg-btn"
                    data-portal="ADMIN"
                    aria-selected="false"
                  >
                    <svg className="ic" viewBox="0 0 24 24" data-i="key" />
                    Admin
                  </button>
                </div>

                <label className="field">
                  <span>Kullanıcı adı / Kurumsal e-posta</span>
                  <div className="input">
                    <svg className="ic" viewBox="0 0 24 24" data-i="mail" />
                    <input
                      id="loginEmail"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="username"
                      placeholder="ad.soyad@albayrakfinans.com.tr"
                      required
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Parola</span>
                  <div className="input">
                    <svg className="ic" viewBox="0 0 24 24" data-i="lock" />
                    <input
                      id="loginPassword"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      className="input-eye"
                      id="togglePass"
                      title="Parolayı göster"
                      aria-label="Parolayı göster"
                    >
                      <svg className="ic" viewBox="0 0 24 24" data-i="eye" />
                    </button>
                  </div>
                </label>

                <p className="form-error" id="loginError" role="alert" hidden />

                <button
                  type="submit"
                  className="btn btn-primary btn-block"
                  id="loginBtn"
                >
                  <span>Giriş yap</span>
                  <svg className="ic" viewBox="0 0 24 24" data-i="arrow" />
                </button>

                <button type="button" className="link-btn" id="demoFill">
                  Demo bilgilerini doldur
                </button>

                <footer className="auth-legal">
                  Yetkisiz erişim denemeleri 5651 sayılı Kanun kapsamında kayıt
                  altına alınır.{" "}
                  <a href="#" id="authKvkk">
                    KVKK Aydınlatma Metni
                  </a>
                </footer>
              </form>
            </div>
          </section>
        </div>
      </main>

      {/* ============ UYGULAMA ============ */}
      <div className="shell" id="appView" hidden>
        <aside className="side" id="side">
          <div className="side-brand">
            <span className="brand-mark" id="sideLogo">
              <AlbayrakLogo />
            </span>
            <div>
              <b>Albayrak Finans PDKS</b>
              <small id="sidePortal">İK Portalı</small>
            </div>
          </div>
          <nav className="nav" id="nav" aria-label="Ana menü">
            <span className="nav-thumb" />
          </nav>
          <div className="side-foot">
            <button className="side-user" id="userBtn" type="button">
              <span className="avatar" id="userAvatar">
                ZY
              </span>
              <span className="side-user-txt">
                <b id="userName">—</b>
                <small id="userTitle">—</small>
              </span>
            </button>
            <button
              className="btn btn-ghost btn-block"
              id="logoutBtn"
              type="button"
            >
              <svg className="ic" viewBox="0 0 24 24" data-i="logout" />
              <span>Çıkış yap</span>
            </button>
          </div>
        </aside>
        <div className="scrim" id="scrim" />

        <div className="main">
          <header className="top">
            <button
              className="icon-btn only-mobile"
              id="menuBtn"
              aria-label="Menü"
            >
              <svg className="ic" viewBox="0 0 24 24" data-i="menu" />
            </button>
            <div className="top-title">
              <h1 id="pageTitle">Genel bakış</h1>
              <p id="pageSub" className="muted" />
            </div>
            <div className="top-tools">
              <div
                className="seg"
                id="rangeSeg"
                role="group"
                aria-label="Tarih aralığı"
              >
                <span className="seg-thumb" />
                <button className="seg-btn is-active" data-range="1">
                  Bugün
                </button>
                <button className="seg-btn" data-range="7">
                  7 gün
                </button>
                <button className="seg-btn" data-range="30">
                  30 gün
                </button>
                <button className="seg-btn" data-range="60">
                  60 gün
                </button>
              </div>
              <div
                className="date-filter"
                id="dateFilterWrap"
                title="Özel tarih aralığı seçin"
              >
                <svg className="ic" viewBox="0 0 24 24" data-i="calendar" />
                <input
                  type="date"
                  id="dateFrom"
                  aria-label="Başlangıç tarihi"
                />
                <span className="date-sep">–</span>
                <input type="date" id="dateTo" aria-label="Bitiş tarihi" />
                <button
                  type="button"
                  className="date-clear"
                  id="dateClearBtn"
                  title="Tarih filtresini sıfırla"
                  hidden
                >
                  <svg className="ic" viewBox="0 0 24 24" data-i="x" />
                </button>
              </div>
              <div className="cselect" id="branchWrap">
                <button
                  type="button"
                  className="cselect-btn"
                  id="branchBtn"
                  data-act="cselect-toggle"
                  aria-haspopup="listbox"
                  aria-expanded="false"
                >
                  <svg className="ic" viewBox="0 0 24 24" data-i="building" />
                  <span className="cselect-label" id="branchLabel">
                    Tüm şubeler
                  </span>
                  <svg
                    className="ic cselect-caret"
                    viewBox="0 0 24 24"
                    data-i="chevron"
                  />
                </button>
                <div
                  className="cselect-menu"
                  id="branchMenu"
                  role="listbox"
                  aria-label="Şube seçimi"
                />
              </div>
              <button className="icon-btn" id="themeBtn" aria-label="Tema">
                <svg className="ic" viewBox="0 0 24 24" data-i="moon" />
              </button>
              <button
                className="icon-btn"
                id="kvkkBtn"
                aria-label="KVKK ve veri erişimi"
              >
                <svg className="ic" viewBox="0 0 24 24" data-i="lock" />
              </button>
              <button
                className="icon-btn has-dot"
                id="bellBtn"
                aria-label="Bildirimler"
              >
                <svg className="ic" viewBox="0 0 24 24" data-i="bell" />
              </button>
            </div>
          </header>
          <div className="page" id="page" tabIndex={-1} />
        </div>
      </div>

      {/* Çekmece (personel / talep detayı) */}
      <aside className="drawer" id="drawer" aria-hidden="true">
        <div className="drawer-head">
          <h3 id="drawerTitle">Detay</h3>
          <button className="icon-btn" id="drawerClose" aria-label="Kapat">
            <svg className="ic" viewBox="0 0 24 24" data-i="x" />
          </button>
        </div>
        <div className="drawer-body" id="drawerBody" />
      </aside>

      {/* Modal */}
      <div className="modal" id="modal" aria-hidden="true">
        <div
          className="modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modalTitle"
        >
          <div className="modal-head">
            <h3 id="modalTitle" />
            <button className="icon-btn" id="modalClose" aria-label="Kapat">
              <svg className="ic" viewBox="0 0 24 24" data-i="x" />
            </button>
          </div>
          <div className="modal-body" id="modalBody" />
          <div className="modal-foot" id="modalFoot" />
        </div>
      </div>
    </>
  );
}
