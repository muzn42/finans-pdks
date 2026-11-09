import { AlbayrakLogo } from "@/components/brand/AlbayrakLogo";

/**
 * Next.js App Router rota yükleme ekranı.
 * Giriş sahnesindeki (Sahne 0) kurumsal duruşla aynı dili paylaşır:
 * saf beyaz zemin + merkezde logo + ince kırmızı ilerleme çizgisi.
 */
export default function Loading() {
  return (
    <div className="pdks-route-loader" role="status" aria-live="polite">
      <div className="pdks-route-lockup">
        <AlbayrakLogo className="pdks-route-logo" />
        <span className="pdks-route-word" aria-hidden="true">
          Albayrak <b>Finans</b> <em>PDKS</em>
        </span>
      </div>
      <span className="pdks-route-track" aria-hidden="true">
        <span className="pdks-route-bar" />
      </span>
      <span className="pdks-route-status">Arayüz hazırlanıyor</span>
    </div>
  );
}