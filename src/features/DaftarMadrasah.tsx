import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase"; // Impor database Firestore
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from "firebase/firestore";

interface MadrasahTenant {
  id: string; // Document ID Firestore
  nsm: string;
  npsn: string;
  nama: string;
  alamat: string;
  namaKepala: string;
  nipKepala: string;
  status: "Aktif" | "Suspend";
  tanggalDaftar: string;
}

export default function DaftarMadrasah() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Verifikasi Super Admin
  const isSuperAdminAuthorized = user?.email === "cacasopandi71@guru.smp.belajar.id";

  const [madrasahs, setMadrasahs] = useState<MadrasahTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCreds, setSelectedCreds] = useState<MadrasahTenant | null>(null);
  const [formData, setFormData] = useState({
    nsm: "",
    npsn: "",
    nama: "",
    alamat: "",
    namaKepala: "",
    nipKepala: "",
  });

  // 1. FETCH DATA DARI FIREBASE FIRESTORE
  const fetchMadrasahs = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "madrasahs"));
      const list: MadrasahTenant[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          nsm: data.nsm || "",
          npsn: data.npsn || "",
          nama: data.nama || "",
          alamat: data.alamat || "",
          namaKepala: data.namaKepala || "",
          nipKepala: data.nipKepala || "",
          status: data.status || "Aktif",
          tanggalDaftar: data.tanggalDaftar || "",
        });
      });
      setMadrasahs(list);
    } catch (error) {
      console.error("Gagal mengambil data dari Firebase:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdminAuthorized) {
      fetchMadrasahs();
    }
  }, [isSuperAdminAuthorized]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 2. SIMPAN DATA BARU KE FIREBASE FIRESTORE
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const today = new Date().toISOString().slice(0, 10);
      const newMadrasahData = {
        nsm: formData.nsm,
        npsn: formData.npsn,
        nama: formData.nama,
        alamat: formData.alamat,
        namaKepala: formData.namaKepala,
        nipKepala: formData.nipKepala,
        status: "Aktif",
        tanggalDaftar: today,
        createdAt: serverTimestamp(),
      };

      // Tambahkan dokumen baru ke Firestore
      await addDoc(collection(db, "madrasahs"), newMadrasahData);
      
      // Reset Form & Reload Data
      setFormData({ nsm: "", npsn: "", nama: "", alamat: "", namaKepala: "", nipKepala: "" });
      setIsModalOpen(false);
      fetchMadrasahs(); // Ambil ulang data terbaru dari cloud
      alert("Data Madrasah berhasil disimpan ke Firebase!");
    } catch (error) {
      console.error("Gagal menyimpan ke Firebase:", error);
      alert("Terjadi kesalahan saat menyimpan data ke Firebase.");
    }
  };

  // 3. UBAH STATUS (AKTIF/SUSPEND) DI FIREBASE
  const toggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "Aktif" ? "Suspend" : "Aktif";
    try {
      const docRef = doc(db, "madrasahs", id);
      await updateDoc(docRef, { status: nextStatus });
      fetchMadrasahs();
    } catch (error) {
      console.error("Gagal mengupdate status:", error);
    }
  };

  // 4. HAPUS DATA DARI FIREBASE
  const handleDelete = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus data madrasah ini dari database cloud?")) {
      try {
        await deleteDoc(doc(db, "madrasahs", id));
        fetchMadrasahs();
      } catch (error) {
        console.error("Gagal menghapus data:", error);
      }
    }
  };

  if (!isSuperAdminAuthorized) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-6 rounded-2xl shadow-sm">
          <h2 className="text-xl font-bold mb-2">Akses Ditolak</h2>
          <p className="text-sm mb-4">
            Modul Manajemen Madrasah Pusat hanya dapat diakses oleh akun Super Admin resmi (<strong>cacasopandi71@guru.smp.belajar.id</strong>).
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-slate-700 hover:bg-slate-800 text-white text-xs px-4 py-2 rounded-lg font-medium transition"
          >
            ← Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto w-full min-h-screen bg-slate-50">
      {/* HEADER MODUL DENGAN TOMBOL KEMBALI */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm font-semibold text-teal-700 hover:text-teal-900 mb-2 flex items-center gap-1 transition"
          >
            ← Kembali ke Dashboard
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Manajemen Madrasah (Tenant Cloud)</h1>
          <p className="text-slate-500 text-sm">Kelola pendaftaran lembaga & akun default terhubung dengan Firebase Database.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm transition flex items-center gap-2"
        >
          <span>+ Tambah Madrasah</span>
        </button>
      </div>

      {/* TABEL DATA */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">ID Firestore</th>
                <th className="p-4">NSM / NPSN</th>
                <th className="p-4">Nama Lembaga</th>
                <th className="p-4">Kepala Madrasah</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Memuat data dari Firebase...
                  </td>
                </tr>
              ) : madrasahs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Belum ada data madrasah di database Firebase. Klik "+ Tambah Madrasah".
                  </td>
                </tr>
              ) : (
                madrasahs.map((mdr) => (
                  <tr key={mdr.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="p-4 font-mono text-xs text-teal-700 font-semibold truncate max-w-[120px]" title={mdr.id}>
                      {mdr.id}
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-slate-800">NSM: {mdr.nsm}</div>
                      <div className="text-xs text-slate-500">NPSN: {mdr.npsn}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{mdr.nama}</div>
                      <div className="text-xs text-slate-500 truncate max-w-xs">{mdr.alamat}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-slate-800">{mdr.namaKepala || "-"}</div>
                      <div className="text-xs text-slate-500">NIP: {mdr.nipKepala || "-"}</div>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => toggleStatus(mdr.id, mdr.status)}
                        title="Klik untuk mengubah status"
                        className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                          mdr.status === "Aktif"
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "bg-rose-100 text-rose-700 hover:bg-rose-200"
                        }`}
                      >
                        {mdr.status}
                      </button>
                    </td>
                    <td className="p-4 text-center space-x-3">
                      <button 
                        onClick={() => setSelectedCreds(mdr)} 
                        className="text-teal-600 hover:text-teal-800 font-semibold text-xs"
                      >
                        Info Login
                      </button>
                      <button 
                        onClick={() => handleDelete(mdr.id)} 
                        className="text-rose-500 hover:text-rose-700 font-semibold text-xs"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL FORM TAMBAH MADRASAH */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-teal-700 p-4 text-white flex justify-between items-center">
              <h2 className="font-bold text-lg">Pendaftaran Madrasah (Cloud DB)</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-teal-200 hover:text-white transition text-xl font-bold"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">NSM</label>
                  <input
                    type="number"
                    name="nsm"
                    required
                    value={formData.nsm}
                    onChange={handleInputChange}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 outline-none transition"
                    placeholder="1211..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">NPSN (User Admin)</label>
                  <input
                    type="number"
                    name="npsn"
                    required
                    value={formData.npsn}
                    onChange={handleInputChange}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 outline-none transition"
                    placeholder="2021..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nama Madrasah</label>
                <input
                  type="text"
                  name="nama"
                  required
                  value={formData.nama}
                  onChange={handleInputChange}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 outline-none transition"
                  placeholder="MTs Negeri 1 Jakarta"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Alamat Lengkap</label>
                <textarea
                  name="alamat"
                  required
                  rows={2}
                  value={formData.alamat}
                  onChange={handleInputChange}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 outline-none transition resize-none"
                  placeholder="Jalan, RT/RW, Desa/Kelurahan..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nama Kepala Madrasah</label>
                  <input
                    type="text"
                    name="namaKepala"
                    required
                    value={formData.namaKepala}
                    onChange={handleInputChange}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 outline-none transition"
                    placeholder="Nama beserta gelar"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">NIP Kepala (User Default)</label>
                  <input
                    type="number"
                    name="nipKepala"
                    required
                    value={formData.nipKepala}
                    onChange={handleInputChange}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-teal-500 outline-none transition"
                    placeholder="197508..."
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 rounded-lg shadow-sm transition"
                >
                  Simpan ke Firebase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL INFO KREDENSIAL */}
      {selectedCreds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">
              Kredensial Default Login: {selectedCreds.nama}
            </h3>
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div>
                <span className="text-xs font-bold text-teal-700 uppercase tracking-wider block">Akun Admin Madrasah</span>
                <p className="text-sm">Username: <strong className="font-mono">{selectedCreds.npsn}</strong></p>
                <p className="text-sm">Password Default: <strong className="font-mono">{selectedCreds.npsn}</strong></p>
              </div>
              <hr className="border-slate-200" />
              <div>
                <span className="text-xs font-bold text-teal-700 uppercase tracking-wider block">Akun Kepala Madrasah ({selectedCreds.namaKepala})</span>
                <p className="text-sm">Username: <strong className="font-mono">{selectedCreds.nipKepala}</strong></p>
                <p className="text-sm">Password Default: <strong className="font-mono">{selectedCreds.nipKepala}</strong></p>
              </div>
            </div>

            <button
              onClick={() => setSelectedCreds(null)}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 rounded-lg transition"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}