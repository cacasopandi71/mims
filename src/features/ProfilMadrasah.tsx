import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function ProfilMadrasah() {
  const navigate = useNavigate();
  const { user, isAdmin, isKepala } = useAuth();

  const [profil, setProfil] = useState({
    nsm: "",
    npsn: "",
    nama: "",
    alamat: "",
    kabKota: "", // Added Kab/Kota state
    kepalaMadrasah: "",
    akreditasi: "A",
    visi: "",
    logoUrl: "",
  });

  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Ambil data profil dari Firestore berdasarkan user.madrasahId
  useEffect(() => {
    const fetchProfil = async () => {
      if (!user?.madrasahId) {
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db, "madrasahs", user.madrasahId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfil({
            nsm: data.nsm || "",
            npsn: data.npsn || "",
            nama: data.nama || user?.namaMadrasah || "",
            alamat: data.alamat || "",
            kabKota: data.kabKota || data.kabupaten || data.kota || "", // Ambil data Kab/Kota
            kepalaMadrasah: data.namaKepala || "",
            akreditasi: data.akreditasi || "A",
            visi: data.visi || "Terwujudnya madrasah yang islami, unggul dalam prestasi, dan berwawasan lingkungan.",
            logoUrl: data.logoUrl || "",
          });
        }
      } catch (error) {
        console.error("Gagal mengambil data profil dari Firestore:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfil();
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProfil((prev) => ({ ...prev, [name]: value }));
  };

  // 2. Simpan perbaharuan profil langsung ke Firestore
  const handleSimpan = async () => {
    if (!user?.madrasahId) return;

    setIsSaving(true);
    try {
      const docRef = doc(db, "madrasahs", user.madrasahId);
      await updateDoc(docRef, {
        nsm: profil.nsm,
        npsn: profil.npsn,
        nama: profil.nama,
        alamat: profil.alamat,
        kabKota: profil.kabKota, // Simpan Kab/Kota ke Firestore
        namaKepala: profil.kepalaMadrasah,
        akreditasi: profil.akreditasi,
        visi: profil.visi,
        logoUrl: profil.logoUrl,
      });

      setIsEditing(false);
      alert("Profil madrasah berhasil diperbarui di Cloud Database!");
    } catch (error) {
      console.error("Gagal menyimpan perubahan profil:", error);
      alert("Terjadi kesalahan saat menyimpan perubahan profil.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-center text-slate-500">
        Memuat data profil madrasah...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto w-full min-h-screen bg-slate-50">
      
      {/* HEADER MODUL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Profil Lembaga</h1>
          <p className="text-slate-500 text-sm">
            Informasi identitas resmi madrasah (ID: <span className="font-mono font-semibold">{user?.madrasahId || "N/A"}</span>)
          </p>
        </div>
        
        {/* Kontainer Tombol Aksi */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-5 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-2"
          >
            ← Kembali
          </button>

          {isAdmin && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-lg font-semibold shadow-sm transition flex items-center gap-2"
            >
              ✏️ Edit Profil
            </button>
          )}
        </div>
      </div>

      {/* Peringatan Read-Only Kepala Madrasah */}
      {isKepala && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-lg">
          <p className="text-sm text-blue-700">
            <strong>Mode Pemantauan:</strong> Anda masuk sebagai Kepala Madrasah. Anda dapat melihat informasi profil, namun modifikasi data hanya dapat dilakukan oleh Admin/Operator.
          </p>
        </div>
      )}

      {/* KONTEN FORM PROFIL */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 md:p-8 space-y-6">
          
          {/* Preview logo */}
          {profil.logoUrl && !isEditing && (
             <div className="flex justify-center mb-4">
               <img 
                 src={profil.logoUrl} 
                 alt="Logo Madrasah" 
                 className="h-24 w-24 object-contain rounded border border-slate-200 p-1"
                 onError={(e) => { e.currentTarget.style.display = 'none'; }} 
               />
             </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nomor Statistik Madrasah (NSM)</label>
              <input
                type="text"
                name="nsm"
                value={profil.nsm}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`w-full p-3 rounded-lg border ${isEditing ? 'border-teal-500 bg-white' : 'border-slate-200 bg-slate-50 text-slate-600'} outline-none transition`}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">NPSN</label>
              <input
                type="text"
                name="npsn"
                value={profil.npsn}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`w-full p-3 rounded-lg border ${isEditing ? 'border-teal-500 bg-white' : 'border-slate-200 bg-slate-50 text-slate-600'} outline-none transition`}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Nama Madrasah</label>
            <input
              type="text"
              name="nama"
              value={profil.nama}
              onChange={handleInputChange}
              disabled={!isEditing}
              className={`w-full p-3 rounded-lg border ${isEditing ? 'border-teal-500 bg-white' : 'border-slate-200 bg-slate-50 text-slate-600'} outline-none transition font-bold`}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nama Kepala Madrasah</label>
              <input
                type="text"
                name="kepalaMadrasah"
                value={profil.kepalaMadrasah}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`w-full p-3 rounded-lg border ${isEditing ? 'border-teal-500 bg-white' : 'border-slate-200 bg-slate-50 text-slate-600'} outline-none transition`}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Akreditasi</label>
              <select
                name="akreditasi"
                value={profil.akreditasi}
                onChange={handleInputChange}
                disabled={!isEditing}
                className={`w-full p-3 rounded-lg border ${isEditing ? 'border-teal-500 bg-white' : 'border-slate-200 bg-slate-50 text-slate-600'} outline-none transition`}
              >
                <option value="A">A (Unggul)</option>
                <option value="B">B (Baik)</option>
                <option value="C">C (Cukup)</option>
                <option value="Belum">Belum Terakreditasi</option>
              </select>
            </div>
          </div>

          {/* Grid Alamat & Kab/Kota */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Alamat Lengkap</label>
              <textarea
                name="alamat"
                rows={2}
                value={profil.alamat}
                onChange={handleInputChange}
                disabled={!isEditing}
                placeholder="Jalan, RT/RW, Desa/Kelurahan, Kecamatan"
                className={`w-full p-3 rounded-lg border ${isEditing ? 'border-teal-500 bg-white' : 'border-slate-200 bg-slate-50 text-slate-600'} outline-none transition resize-none`}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Kabupaten / Kota</label>
              <input
                type="text"
                name="kabKota"
                value={profil.kabKota}
                onChange={handleInputChange}
                disabled={!isEditing}
                placeholder="Contoh: Kab. Bandung / Kota Cirebon"
                className={`w-full p-3 rounded-lg border ${isEditing ? 'border-teal-500 bg-white' : 'border-slate-200 bg-slate-50 text-slate-600'} outline-none transition`}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Visi Madrasah</label>
            <textarea
              name="visi"
              rows={3}
              value={profil.visi}
              onChange={handleInputChange}
              disabled={!isEditing}
              className={`w-full p-3 rounded-lg border ${isEditing ? 'border-teal-500 bg-white' : 'border-slate-200 bg-slate-50 text-slate-600'} outline-none transition resize-none`}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Link Logo Madrasah (URL)</label>
            <input
              type="text"
              name="logoUrl"
              value={profil.logoUrl}
              onChange={handleInputChange}
              disabled={!isEditing}
              placeholder="Contoh: https://i.imgur.com/contoh.png"
              className={`w-full p-3 rounded-lg border ${isEditing ? 'border-teal-500 bg-white' : 'border-slate-200 bg-slate-50 text-slate-600'} outline-none transition`}
            />
            {isEditing && (
              <p className="text-xs text-slate-500 mt-1">
                Masukkan URL gambar (akhiri dengan .png, .jpg, atau .jpeg). Pastikan link tersebut dapat diakses secara publik.
              </p>
            )}
          </div>

        </div>

        {/* TOMBOL AKSI SIMPAN/BATAL */}
        {isEditing && (
          <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end gap-3">
            <button
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-lg font-semibold text-slate-600 hover:bg-slate-200 transition disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleSimpan}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-lg font-semibold text-white bg-teal-600 hover:bg-teal-700 shadow-sm transition disabled:opacity-50"
            >
              {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}