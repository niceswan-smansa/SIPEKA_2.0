import { SITE_DESCRIPTION, SITE_NAME } from "@/shared/constants";

export default function HomePage() {
  return (
    <main>
      <p className="eyebrow">SMANSA Pamekasan</p>
      <h1>{SITE_NAME}</h1>
      <p>{SITE_DESCRIPTION}</p>
      <p className="status">Fondasi aplikasi siap. Fitur presensi belum diaktifkan.</p>
    </main>
  );
}
