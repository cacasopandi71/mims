import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../config/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [userSession, setUserSession] = useState<any>(null);

  // State Form Profil
  const [nama, setNama] = useState("");
  const [nip, setNip] = useState("");
  const [password, setPassword] = useState("");
  const [tempatLahir, setTempatLahir] = useState("");
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [email, setEmail] = useState("");
  const [mapel, setMapel] = useState("");
  const [noHp, setNoHp] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [pangkatGolongan, setPangkatGolongan] = useState("");

  useEffect(() => {
    const sessionStr = localStorage.getItem("mims_session");
    if (!sessionStr) {
      navigate("/login");
      return;
    }

    const session = JSON.parse(sessionStr);
    setUserSession(session);
    syncDataFromFirebase(session);
  }, [navigate]);

  // Sync data langsung dari Firestore koleksi 'users' dan 'guru'
  const syncDataFromFirebase = async (session: any) => {
    setLoading(true);
    try {
      let currentNama = session.nama || "";
      let currentNip = session.username || session.nip || "";
      let currentPassword = session.password || "";
      let currentNoHp = session.noHp || "";
      let currentJabatan = session.jabatan || "";
      let currentGolongan = session.pangkatGolongan || session.golongan || "";

      // 1. Ambil data terbaru dari koleksi 'users'
      if (session.id) {
        const userRef = doc(db, "users", session.id);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const u = userSnap.data();
          currentNama = u.nama || currentNama;
          currentNip = u.username || u.nip || currentNip;
          currentPassword = u.password || currentPassword;
          currentNoHp = u.noHp || currentNoHp;
          currentJabatan = u.jabatan || currentJabatan;
          currentGolongan = u.pangkatGolongan || u.golongan || currentGolongan;
        }
      }

      // 2. Ambil data spesifik dari koleksi 'guru' (Menggunakan refId atau ID user)
      const guruDocId = session.refId || session.id;
      if (guruDocId) {
        const guruRef = doc(db, "guru", guruDocId);
        const guruSnap = await getDoc(guruRef);
        if (guruSnap.exists()) {
          const g = guruSnap.data();
          setMapel(g.mapel || "");
          setTempatLahir(g.tempatLahir || "");
          setTanggalLahir(g.tanggalLahir || "");
          setEmail(g.email || "");
          currentNama = g.nama || currentNama;
          currentNip = g.nip || currentNip;
          currentNoHp = g.noHp || currentNoHp;
          currentJabatan = g.jabatan || currentJabatan;
          currentGolongan = g.pangkatGolongan || g.golongan || currentGolongan;
        }
      }

      // Set ke state UI
      setNama(currentNama);
      setNip(currentNip);
      setPassword(currentPassword);
      setNoHp(currentNoHp);
      setJabatan(currentJabatan);
      setPangkatGolongan(currentGolongan);
    } catch (err) {
      console.error("Gagal sinkronisasi profil:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const madrasahId = userSession?.madrasahId || "";
      const namaMadrasah = userSession?.namaMadrasah || "";

      // Payload untuk Koleksi 'guru' (Modul Guru)
      const guruPayload = {
        nama,
        nip,
        tempatLahir,
        tanggalLahir,
        email,
        mapel,
        noHp,
        jabatan,
        pangkatGolongan,
        golongan: pangkatGolongan,
        madrasahId,
        namaMadrasah,
        updatedAt: new Date().toISOString(),
      };

      // Payload untuk Koleksi 'users' (Modul User)
      const userPayload = {
        nama,
        username: nip,
        nip,
        password,
        noHp,
        jabatan,
        pangkatGolongan,
        golongan: pangkatGolongan,
        madrasahId,
        namaMadrasah,
        updatedAt: new Date().toISOString(),
      };

      // 1. Simpan/Update Dokumen Koleksi 'guru'
      const guruDocId = userSession?.refId || userSession?.id;
      if (guruDocId) {
        await setDoc(doc(db, "guru", guruDocId), guruPayload, { merge: true });
      }

      // 2. Simpan/Update Dokumen Koleksi 'users'
      if (userSession?.id) {
        await setDoc(doc(db, "users", userSession.id), userPayload, { merge: true });
      }

      // 3. Perbarui session di localStorage agar tersinkron ke seluruh aplikasi secara instant
      const updatedSession = {
        ...userSession,
        ...userPayload,
        ...guruPayload,
      };
      localStorage.setItem("mims_session", JSON.stringify(updatedSession));
      setUserSession(updatedSession);

      alert("Profil berhasil diperbarui dan tersambung dengan data Guru & User!");
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Gagal menyimpan profil:", err);
      alert(`Terjadi kesalahan: ${err?.message || "Gagal memperbarui profil"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <nav className="bg-teal-700 p-4 text-white flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-xl font-bold">MIMS - Profil Saya</h1>
          {userSession?.namaMadrasah && (
            <p className="text-xs text-teal-100">{userSession.namaMadrasah}</p>
          )}
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          className="bg-teal-800 hover:bg-teal-900 px-4 py-2 rounded-lg text-sm font-semibold transition"
        >
          Kembali ke Dashboard
        </button>
      </nav>

      <div className="p-6 md:p-8 max-w-3xl mx-auto flex-1 w-full">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-4 border-b border-gray-100 pb-6 mb-6">
            <div className="bg-teal-100 text-teal-700 text-4xl w-16 h-16 flex items-center justify-center rounded-full font-bold">
              {nama ? nama.charAt(0).toUpperCase() : "U"}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Pengaturan Akun & Profil Guru</h2>
              <p className="text-sm text-gray-500">
                Data terintegrasi penuh dengan modul Kepegawaian (Guru) & Akun Pengguna (Users).
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">NIP / Username Login</label>
                <input
                  type="text"
                  value={nip}
                  onChange={(e) => setNip(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-blue-50/50"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Password Login</label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-rose-50/50"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Mata Pelajaran Utama</label>
                <input
                  type="text"
                  value={mapel}
                  onChange={(e) => setMapel(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Jabatan</label>
                <input
                  type="text"
                  value={jabatan}
                  onChange={(e) => setJabatan(e.target.value)}
                  placeholder="misal: Ahli Pertama Guru"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Pangkat / Golongan</label>
                <input
                  type="text"
                  value={pangkatGolongan}
                  onChange={(e) => setPangkatGolongan(e.target.value)}
                  placeholder="misal: Penata Muda / III/a"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tempat Lahir</label>
                <input
                  type="text"
                  value={tempatLahir}
                  onChange={(e) => setTempatLahir(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tanggal Lahir</label>
                <input
                  type="date"
                  value={tanggalLahir}
                  onChange={(e) => setTanggalLahir(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">No. WhatsApp / HP</label>
                <input
                  type="text"
                  value={noHp}
                  onChange={(e) => setNoHp(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition shadow-sm disabled:opacity-50"
              >
                {loading ? "Memproses..." : "Simpan Perubahan Profil"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <footer className="mt-auto py-4 bg-white border-t border-slate-200 text-center text-xs text-slate-500">
        <p>© Hak Cipta CacaSpd. All rights reserved.</p>
      </footer>
    </div>
  );
}