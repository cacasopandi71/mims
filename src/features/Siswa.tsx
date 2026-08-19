import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../config/firebase";
import { 
  collection, 
  query, 
  where, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot,
  writeBatch
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

interface SiswaItem {
  id: string;
  nisn: string;
  nama: string;
  kelas: string;
  jenisKelamin: string;
  madrasahId: string;
}

interface KelasItem {
  id: string;
  namaKelas: string;
}

export default function Siswa() {
  const navigate = useNavigate();
  
  // Context Autentikasi
  const { user, isAdmin, isSuperAdmin, isKepala } = useAuth();
  const canManage = isAdmin || isSuperAdmin || isKepala;

  // Data State
  const [siswaList, setSiswaList] = useState<SiswaItem[]>([]);
  const [kelasList, setKelasList] = useState<KelasItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nisn, setNisn] = useState("");
  const [nama, setNama] = useState("");
  const [kelas, setKelas] = useState("");
  const [jenisKelamin, setJenisKelamin] = useState("L");
  const [saving, setSaving] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterKelas, setFilterKelas] = useState("Semua");

  // Alert/Toast State
  const [alertMessage, setAlertMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const showAlert = (text: string, type: "success" | "error" | "info" = "success") => {
    setAlertMessage({ type, text });
    setTimeout(() => {
      setAlertMessage(null);
    }, 3500);
  };

  // Synchronize Data Real-time (Siswa & Kelas)
  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    setLoading(true);

    // 1. Query & Listener Real-time Siswa
    const qSiswa = user.madrasahId 
      ? query(collection(db, "siswa"), where("madrasahId", "==", user.madrasahId))
      : collection(db, "siswa");

    const unsubSiswa = onSnapshot(
      qSiswa, 
      (snapshot) => {
        const listSiswa: SiswaItem[] = [];
        snapshot.forEach((docItem) => {
          listSiswa.push({ id: docItem.id, ...docItem.data() } as SiswaItem);
        });
        setSiswaList(listSiswa);
        setLoading(false);
      },
      (err) => {
        console.error("Gagal mengambil data siswa:", err);
        showAlert("Gagal mengambil data siswa dari server.", "error");
        setLoading(false);
      }
    );

    // 2. Query & Listener Real-time Kelas
    const qKelas = user.madrasahId 
      ? query(collection(db, "kelas"), where("madrasahId", "==", user.madrasahId))
      : collection(db, "kelas");

    const unsubKelas = onSnapshot(
      qKelas, 
      (snapshot) => {
        const listKelas: KelasItem[] = [];
        snapshot.forEach((docItem) => {
          const data = docItem.data();
          const namaKelas = data.namaKelas || data.nama || "Tanpa Nama";
          listKelas.push({ id: docItem.id, namaKelas });
        });

        listKelas.sort((a, b) => a.namaKelas.localeCompare(b.namaKelas));
        setKelasList(listKelas);

        setKelas((prevKelas) => {
          if (!prevKelas && listKelas.length > 0) {
            return listKelas[0].namaKelas;
          }
          return prevKelas;
        });
      },
      (err) => {
        console.error("Gagal mengambil data kelas:", err);
      }
    );

    return () => {
      unsubSiswa();
      unsubKelas();
    };
  }, [user, navigate]);

  const resetForm = () => {
    setEditingId(null);
    setNisn("");
    setNama("");
    setKelas(kelasList.length > 0 ? kelasList[0].namaKelas : "");
    setJenisKelamin("L");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim() || !user?.madrasahId) {
      showAlert("Nama Siswa wajib diisi dan sesi harus valid!", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nisn: nisn.trim(),
        nama: nama.trim(),
        kelas: kelas,
        jenisKelamin: jenisKelamin,
        madrasahId: user.madrasahId,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await setDoc(doc(db, "siswa", editingId), payload, { merge: true });
      } else {
        const newDocRef = doc(collection(db, "siswa"));
        await setDoc(newDocRef, payload);
      }

      showAlert(editingId ? "Data siswa berhasil diperbarui!" : "Siswa berhasil ditambahkan!");
      resetForm();
    } catch (err) {
      console.error("Gagal menyimpan data siswa:", err);
      showAlert("Terjadi kesalahan saat menyimpan data.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: SiswaItem) => {
    setEditingId(item.id);
    setNisn(item.nisn || "");
    setNama(item.nama);
    setKelas(item.kelas || (kelasList.length > 0 ? kelasList[0].namaKelas : ""));
    setJenisKelamin(item.jenisKelamin || "L");
  };

  const handleDelete = async (id: string, namaSiswa: string) => {
    if (window.confirm(`Yakin ingin menghapus data siswa "${namaSiswa}"?`)) {
      try {
        await deleteDoc(doc(db, "siswa", id));
        showAlert(`Data siswa "${namaSiswa}" berhasil dihapus.`, "info");
      } catch (err) {
        console.error("Gagal menghapus:", err);
        showAlert("Gagal menghapus data siswa.", "error");
      }
    }
  };

  // --- FITUR Unduh Template CSV ---
  const handleDownloadTemplate = () => {
    const csvHeader = "sep=,\nNISN,Nama Lengkap,Kelas,L/P\n";
    const csvExample1 = "0012345678,Ahmad Dahlan,7A,L\n";
    const csvExample2 = "0012345679,Siti Aisyah,7B,P\n";
    
    const blob = new Blob(["\uFEFF" + csvHeader + csvExample1 + csvExample2], { 
      type: "text/csv;charset=utf-8;" 
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Template_Import_Siswa.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showAlert("Template CSV berhasil diunduh.");
  };

  // --- FITUR Upload Data CSV ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.madrasahId) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && !line.startsWith("sep="));
        
        if (lines.length <= 1) {
          showAlert("File kosong atau tidak memiliki baris data (hanya header)!", "error");
          return;
        }

        setIsUploading(true);
        const delimiter = lines[0].includes(";") ? ";" : ",";
        
        let batch = writeBatch(db);
        let count = 0;
        let totalImported = 0;

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
          
          if (cols.length >= 2 && cols[1]) {
            const newSiswa = {
              nisn: cols[0] || "",
              nama: cols[1],
              kelas: cols[2] || (kelasList.length > 0 ? kelasList[0].namaKelas : ""),
              jenisKelamin: cols[3]?.toUpperCase() === "P" ? "P" : "L",
              madrasahId: user.madrasahId,
              updatedAt: new Date().toISOString()
            };

            const newDocRef = doc(collection(db, "siswa"));
            batch.set(newDocRef, newSiswa);
            count++;
            totalImported++;

            if (count === 500) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }
        }

        if (count > 0) {
          await batch.commit();
        }

        if (totalImported > 0) {
          showAlert(`Berhasil mengimpor ${totalImported} data siswa baru.`);
        } else {
          showAlert("Gagal memproses file. Pastikan format sesuai template.", "error");
        }
      } catch (err) {
        console.error(err);
        showAlert("Terjadi kesalahan saat membaca atau menyimpan file import.", "error");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // --- FILTER & SORTING DATA ---
  const filteredAndSortedSiswa = useMemo(() => {
    let filtered = siswaList.filter((item) => {
      const matchSearch = item.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.nisn && item.nisn.includes(searchTerm));
      const matchKelas = filterKelas === "Semua" || item.kelas === filterKelas;
      return matchSearch && matchKelas;
    });

    return filtered.sort((a, b) => {
      const kelasA = a.kelas || "";
      const kelasB = b.kelas || "";
      const nameA = a.nama || "";
      const nameB = b.nama || "";
      
      if (kelasA !== kelasB) {
        return kelasA.localeCompare(kelasB);
      }
      return nameA.localeCompare(nameB);
    });
  }, [siswaList, searchTerm, filterKelas]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* HEADER KONSISTEN */}
      <header className="bg-teal-700 text-white p-4 shadow-md flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-teal-800 hover:bg-teal-900 text-white px-3 py-1.5 rounded-lg text-sm transition flex items-center space-x-1"
          >
            <span>←</span>
            <span>Dashboard</span>
          </button>
          <div>
            <h1 className="text-xl font-bold">Modul Data Siswa</h1>
            <p className="text-xs text-teal-100">
              {user?.namaMadrasah || "Madrasah"} | Pengelola: {user?.nama || "Admin"}
            </p>
          </div>
        </div>
        <div className="text-right text-xs bg-teal-800 px-3 py-1.5 rounded-lg border border-teal-600">
          <span className="font-semibold block">{user?.role?.toUpperCase()}</span>
          <span className="opacity-80">Hak Akses Manajemen</span>
        </div>
      </header>

      {/* ALERT / TOAST */}
      {alertMessage && (
        <div className="max-w-7xl mx-auto w-full px-4 md:px-8 pt-4">
          <div
            className={`p-4 rounded-lg shadow-sm border flex justify-between items-center text-sm font-medium ${
              alertMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : alertMessage.type === "error"
                ? "bg-rose-50 text-rose-800 border-rose-200"
                : "bg-sky-50 text-sky-800 border-sky-200"
            }`}
          >
            <div className="flex items-center space-x-2">
              <span>{alertMessage.type === "success" ? "✅" : alertMessage.type === "error" ? "⚠️" : "ℹ️"}</span>
              <span>{alertMessage.text}</span>
            </div>
            <button onClick={() => setAlertMessage(null)} className="text-xs font-bold opacity-60 hover:opacity-100">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="p-4 md:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* FORM INPUT SISWA */}
        {canManage && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
            <h2 className="text-lg font-bold text-slate-800 mb-4">{editingId ? "Edit Data Siswa" : "Tambah Siswa Baru"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">NISN / NIK</label>
                <input 
                  type="text" 
                  value={nisn} 
                  onChange={(e) => setNisn(e.target.value)} 
                  placeholder="0012345678" 
                  className="w-full text-sm border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap Siswa <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={nama} 
                  onChange={(e) => setNama(e.target.value)} 
                  placeholder="Nama Lengkap" 
                  required 
                  className="w-full text-sm border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none" 
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kelas</label>
                  <select 
                    value={kelas} 
                    onChange={(e) => setKelas(e.target.value)}
                    className="w-full text-sm border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                    required
                  >
                    <option value="" disabled>Pilih Kelas</option>
                    {kelasList.map((k) => (
                      <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>
                    ))}
                    {kelasList.length === 0 && (
                      <option value="" disabled>Data Kelas Kosong</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">L/P</label>
                  <select 
                    value={jenisKelamin} 
                    onChange={(e) => setJenisKelamin(e.target.value)}
                    className="w-full text-sm border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-2.5 rounded-lg transition disabled:bg-slate-400 shadow-sm"
                >
                  {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan Siswa"}
                </button>
                {editingId && (
                  <button type="button" onClick={resetForm} className="bg-slate-100 text-slate-600 border border-slate-300 text-xs font-bold px-4 py-2.5 rounded-lg hover:bg-slate-200 transition">
                    Batal
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* TABEL DATA SISWA */}
        <div className={`${canManage ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white p-6 rounded-xl shadow-sm border border-slate-200`}>
          
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Daftar Siswa Madrasah</h2>
              <p className="text-slate-500 text-xs">Total Terdaftar: {filteredAndSortedSiswa.length} Siswa</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleDownloadTemplate}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
              >
                <span>📥</span>
                <span>Unduh Template</span>
              </button>
              
              {canManage && (
                <label className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 border ${
                  isUploading || loading 
                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" 
                    : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm"
                }`}>
                  <span>📤</span>
                  <span>{isUploading ? "Memproses..." : "Upload CSV"}</span>
                  <input 
                    type="file" 
                    accept=".csv, .txt" 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    disabled={loading || isUploading}
                  />
                </label>
              )}
            </div>
          </div>

          {/* FILTER & PENCARIAN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
            <div>
              <input
                type="text"
                placeholder="Cari Nama atau NISN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <select
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              >
                <option value="Semua">Semua Kelas</option>
                {kelasList.map(k => (
                  <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* TABEL */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-500 text-sm">Memuat data siswa...</p>
            </div>
          ) : filteredAndSortedSiswa.length === 0 ? (
            <div className="text-center py-10 text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
              <div className="text-3xl mb-2">🧑‍🎓</div>
              <div className="text-sm">Tidak ada data siswa yang ditemukan.</div>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                    <th className="p-3 font-bold">Data Siswa</th>
                    <th className="p-3 font-bold">Kelas</th>
                    <th className="p-3 font-bold text-center">L/P</th>
                    {canManage && <th className="p-3 font-bold text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredAndSortedSiswa.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{item.nama}</div>
                        <div className="text-slate-400 font-mono text-[11px] mt-0.5">NISN: {item.nisn || "-"}</div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-1 bg-teal-50 text-teal-700 rounded text-xs font-semibold border border-teal-100">
                          {item.kelas || "-"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                         <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${item.jenisKelamin === 'L' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-pink-50 text-pink-700 border border-pink-100'}`}>
                           {item.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                         </span>
                      </td>
                      {canManage && (
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <button 
                              onClick={() => handleEdit(item)} 
                              className="text-sky-600 hover:text-sky-800 font-semibold text-xs bg-sky-50 px-2 py-1 rounded border border-sky-100 transition"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDelete(item.id, item.nama)} 
                              className="text-rose-600 hover:text-rose-800 font-semibold text-xs bg-rose-50 px-2 py-1 rounded border border-rose-100 transition"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}