import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { getGuruList, type Guru } from "../services/guruService";
import { useAuth } from "../context/AuthContext";

export interface KelasItem {
  id: string;
  kodeKelas: string;
  namaKelas: string;
  tingkat: string;
  jurusan: string;
  waliKelas: string;
  tahunAjaran: string;
  madrasahId?: string;
}

interface DuplicateKelasItem {
  newKelas: Omit<KelasItem, "id">;
  existingId: string;
  namaKelas: string;
  tahunAjaran: string;
}

export default function Kelas() {
  const navigate = useNavigate();

  // Hook autentikasi
  const { user, isAdmin, isSuperAdmin, isKepala } = useAuth();

  // State Data Guru & Kelas
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [kelasList, setKelasList] = useState<KelasItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // State Pencarian & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTingkat, setFilterTingkat] = useState("Semua");
  const [filterTahunAjaran, setFilterTahunAjaran] = useState("Semua");

  // State Modal Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // State Form Field Input
  const [formData, setFormData] = useState<Omit<KelasItem, "id" | "madrasahId">>({
    kodeKelas: "",
    namaKelas: "",
    tingkat: "7",
    jurusan: "Umum",
    waliKelas: "",
    tahunAjaran: "",
  });

  // State Notifikasi & Modal Data Ganda CSV
  const [alertMessage, setAlertMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState<boolean>(false);
  const [duplicateList, setDuplicateList] = useState<DuplicateKelasItem[]>([]);
  const [uniqueNewList, setUniqueNewList] = useState<Omit<KelasItem, "id">[]>([]);
  const [isProcessingUpload, setIsProcessingUpload] = useState<boolean>(false);

  const showAlert = (text: string, type: "success" | "error" | "info" = "success") => {
    setAlertMessage({ type, text });
    setTimeout(() => {
      setAlertMessage(null);
    }, 3500);
  };

  // 1. Load Data Guru
  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    const loadGuru = async () => {
      try {
        const data = await getGuruList();
        setGuruList(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Gagal mengambil data guru:", error);
      }
    };
    loadGuru();
  }, [user, navigate]);

  // 2. Sync Real-time Data Kelas dari Firestore
  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const kelasRef = collection(db, "kelas");

    const q = user?.madrasahId
      ? query(kelasRef, where("madrasahId", "==", user.madrasahId))
      : query(kelasRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: KelasItem[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<KelasItem, "id">),
        }));
        setKelasList(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching data kelas dari Firestore:", error);
        showAlert("Gagal mengambil data kelas dari database.", "error");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, user?.madrasahId]);

  // Hak Akses
  const canManage = isAdmin || isSuperAdmin || isKepala;

  // Daftar tahun ajaran unik untuk filter
  const uniqueTahunAjaran = useMemo(() => {
    const years = new Set(kelasList.map((k) => k.tahunAjaran).filter(Boolean));
    return Array.from(years);
  }, [kelasList]);

  // Filter, Search, & Sorting
  const filteredKelas = useMemo(() => {
    const filtered = kelasList.filter((item) => {
      const matchSearch =
        (item.namaKelas && item.namaKelas.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.kodeKelas && item.kodeKelas.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.waliKelas && item.waliKelas.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchTingkat = filterTingkat === "Semua" || item.tingkat === filterTingkat;
      const matchTahun = filterTahunAjaran === "Semua" || item.tahunAjaran === filterTahunAjaran;

      return matchSearch && matchTingkat && matchTahun;
    });

    return filtered.sort((a, b) => (a.namaKelas || "").localeCompare(b.namaKelas || ""));
  }, [kelasList, searchTerm, filterTingkat, filterTahunAjaran]);

  // Modal Tambah
  const handleOpenCreateModal = () => {
    setEditingId(null);
    const date = new Date();
    const year = date.getFullYear();
    const randomNum = Math.floor(100 + Math.random() * 900);
    const generatedKode = `KLS-${year}-${randomNum}`;

    setFormData({
      kodeKelas: generatedKode,
      namaKelas: "",
      tingkat: "7",
      jurusan: "Umum",
      waliKelas: "",
      tahunAjaran: `${year}/${year + 1}`,
    });
    setIsModalOpen(true);
  };

  // Modal Edit
  const handleOpenEditModal = (item: KelasItem) => {
    setEditingId(item.id);
    setFormData({
      kodeKelas: item.kodeKelas || "",
      namaKelas: item.namaKelas || "",
      tingkat: item.tingkat || "7",
      jurusan: item.jurusan || "Umum",
      waliKelas: item.waliKelas || "",
      tahunAjaran: item.tahunAjaran || "",
    });
    setIsModalOpen(true);
  };

  // --- SIMPAN FORM MANUAL (DENGAN PENGECEKAN DATA GANDA) ---
  const handleSaveKelas = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanNama = formData.namaKelas.trim();
    const cleanTahun = formData.tahunAjaran.trim();

    if (!cleanNama) return showAlert("Nama Kelas / Rombel wajib diisi!", "error");
    if (!cleanTahun) return showAlert("Tahun Ajaran wajib diisi!", "error");

    if (!user?.madrasahId && !isSuperAdmin) {
      showAlert("ID Madrasah tidak terdeteksi. Silakan login kembali.", "error");
      return;
    }

    try {
      const dataToSave = {
        kodeKelas: formData.kodeKelas,
        namaKelas: cleanNama,
        tingkat: formData.tingkat,
        jurusan: formData.jurusan.trim(),
        waliKelas: formData.waliKelas,
        tahunAjaran: cleanTahun,
        madrasahId: user?.madrasahId || "",
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        const docRef = doc(db, "kelas", editingId);
        await updateDoc(docRef, dataToSave);
        showAlert(`Data kelas "${cleanNama}" berhasil diperbarui.`);
      } else {
        // Cek apakah kelas dengan Nama & Tahun Ajaran yang sama sudah ada
        const existing = kelasList.find(
          (k) =>
            k.namaKelas.trim().toLowerCase() === cleanNama.toLowerCase() &&
            k.tahunAjaran.trim() === cleanTahun
        );

        if (existing) {
          const confirmOverwrite = window.confirm(
            `Data ganda terdeteksi!\n\nKelas "${existing.namaKelas}" untuk Tahun Ajaran "${existing.tahunAjaran}" sudah ada.\n\nApakah Anda ingin memperbarui / menimpa data lama tersebut?`
          );
          if (!confirmOverwrite) return;

          const docRef = doc(db, "kelas", existing.id);
          await updateDoc(docRef, dataToSave);
          showAlert(`Data kelas "${cleanNama}" berhasil diperbarui.`);
        } else {
          await addDoc(collection(db, "kelas"), {
            ...dataToSave,
            createdAt: serverTimestamp(),
          });
          showAlert(`Kelas baru "${cleanNama}" berhasil ditambahkan.`);
        }
      }

      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving kelas to Firestore:", error);
      showAlert("Gagal menyimpan data ke Firestore.", "error");
    }
  };

  // Hapus Data
  const handleDeleteKelas = async (id: string, nama: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus Rombel/Kelas "${nama}"?`)) {
      try {
        await deleteDoc(doc(db, "kelas", id));
        showAlert(`Kelas "${nama}" berhasil dihapus.`, "info");
      } catch (error) {
        console.error("Error deleting kelas:", error);
        showAlert("Gagal menghapus kelas dari database.", "error");
      }
    }
  };

  // Unduh Template CSV
  const handleDownloadTemplate = () => {
    const csvHeader = "sep=,\nNama Kelas,Tingkat,Jurusan,Wali Kelas,Tahun Ajaran\n";
    const csvExample1 = "7C,7,Umum,Budi Santoso S.Pd.,2025/2026\n";
    const csvExample2 = "8B,8,Umum,Dewi Sartika S.Ag.,2025/2026\n";

    const blob = new Blob(["\uFEFF" + csvHeader + csvExample1 + csvExample2], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Template_Import_Data_Kelas.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showAlert("Template Excel/CSV Data Kelas berhasil diunduh.");
  };

  // --- UPLOAD CSV DENGAN MODAL KONFIRMASI DATA GANDA ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user?.madrasahId && !isSuperAdmin) {
      showAlert("ID Madrasah tidak ditemukan. Pastikan sesi Anda terhubung.", "error");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && !line.startsWith("sep="));

        if (lines.length <= 1) {
          showAlert("File kosong atau tidak memiliki baris data!", "error");
          return;
        }

        const currentYear = new Date().getFullYear();
        const targetMadrasahId = user?.madrasahId || "";
        const delimiter = lines[0].includes(";") ? ";" : ",";

        const parsedItems: Omit<KelasItem, "id">[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));

          if (cols.length >= 2 && cols[0]) {
            const randomNum = Math.floor(100 + Math.random() * 900);
            parsedItems.push({
              kodeKelas: `KLS-${currentYear}-${randomNum}`,
              namaKelas: cols[0] || "Kelas Baru",
              tingkat: cols[1] || "7",
              jurusan: cols[2] || "Umum",
              waliKelas: cols[3] || "",
              tahunAjaran: cols[4] || `${currentYear}/${currentYear + 1}`,
              madrasahId: targetMadrasahId,
            });
          }
        }

        if (parsedItems.length === 0) {
          showAlert("Format data tidak valid. Silakan gunakan template CSV yang benar.", "error");
          return;
        }

        // Cek data ganda terhadap Firestore (berdasarkan Nama Kelas & Tahun Ajaran)
        const duplicates: DuplicateKelasItem[] = [];
        const uniques: Omit<KelasItem, "id">[] = [];

        parsedItems.forEach((item) => {
          const cleanNama = item.namaKelas.trim().toLowerCase();
          const cleanTahun = item.tahunAjaran.trim();

          const existing = kelasList.find(
            (k) => k.namaKelas.trim().toLowerCase() === cleanNama && k.tahunAjaran.trim() === cleanTahun
          );

          if (existing && existing.id) {
            duplicates.push({
              newKelas: item,
              existingId: existing.id,
              namaKelas: item.namaKelas,
              tahunAjaran: item.tahunAjaran,
            });
          } else {
            uniques.push(item);
          }
        });

        if (duplicates.length > 0) {
          setDuplicateList(duplicates);
          setUniqueNewList(uniques);
          setShowDuplicateModal(true);
        } else {
          // Jika murni data baru semua
          const batch = writeBatch(db);
          uniques.forEach((item) => {
            const docRef = doc(collection(db, "kelas"));
            batch.set(docRef, {
              ...item,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
          await batch.commit();
          showAlert(`Berhasil mengimpor ${uniques.length} kelas baru.`);
        }
      } catch (err) {
        console.error("Error importing kelas:", err);
        showAlert("Terjadi kesalahan saat membaca atau menyimpan file import.", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Handler "Ya, Timpa Data" dari Modal
  const handleConfirmOverwrite = async () => {
    try {
      setIsProcessingUpload(true);
      const batch = writeBatch(db);

      // 1. Tambah data baru yang unik
      uniqueNewList.forEach((item) => {
        const docRef = doc(collection(db, "kelas"));
        batch.set(docRef, {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      // 2. Timpa (update) data lama yang ganda
      duplicateList.forEach((item) => {
        const docRef = doc(db, "kelas", item.existingId);
        batch.update(docRef, {
          tingkat: item.newKelas.tingkat,
          jurusan: item.newKelas.jurusan,
          waliKelas: item.newKelas.waliKelas,
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      showAlert(
        `Import Selesai: ${uniqueNewList.length} ditambahkan, ${duplicateList.length} diperbarui.`
      );

      setShowDuplicateModal(false);
      setDuplicateList([]);
      setUniqueNewList([]);
    } catch (err) {
      console.error(err);
      showAlert("Gagal memproses update data ganda.", "error");
    } finally {
      setIsProcessingUpload(false);
    }
  };

  // Handler "Batal Upload"
  const handleCancelUpload = () => {
    setShowDuplicateModal(false);
    setDuplicateList([]);
    setUniqueNewList([]);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* HEADER */}
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
            <h1 className="text-xl font-bold">Modul Kelola Kelas & Rombel</h1>
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
        <div className="max-w-6xl mx-auto w-full px-6 pt-4">
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
              <span>
                {alertMessage.type === "success" ? "✅" : alertMessage.type === "error" ? "⚠️" : "ℹ️"}
              </span>
              <span>{alertMessage.text}</span>
            </div>
            <button
              onClick={() => setAlertMessage(null)}
              className="text-xs font-bold opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* PENCARIAN & ACTION BAR */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Daftar Rombongan Belajar (Rombel)</h2>
              <p className="text-slate-500 text-xs">Total Terdaftar: {filteredKelas.length} Kelas</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleDownloadTemplate}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
              >
                <span>📥</span>
                <span>Unduh Template</span>
              </button>

              {canManage && (
                <label className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition">
                  <span>📤</span>
                  <span>Upload / Import</span>
                  <input
                    type="file"
                    accept=".csv, .txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}

              {canManage && (
                <button
                  onClick={handleOpenCreateModal}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
                >
                  <span>➕</span>
                  <span>Tambah Kelas Baru</span>
                </button>
              )}
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* FILTER BARIS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">
                Cari Kelas / Wali
              </label>
              <input
                type="text"
                placeholder="Cari nama, wali, kode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Tingkat Kelas</label>
              <select
                value={filterTingkat}
                onChange={(e) => setFilterTingkat(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              >
                <option value="Semua">Semua Tingkat</option>
                <option value="7">Tingkat 7 (VII)</option>
                <option value="8">Tingkat 8 (VIII)</option>
                <option value="9">Tingkat 9 (IX)</option>
                <option value="10">Tingkat 10 (X)</option>
                <option value="11">Tingkat 11 (XI)</option>
                <option value="12">Tingkat 12 (XII)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Tahun Ajaran</label>
              <select
                value={filterTahunAjaran}
                onChange={(e) => setFilterTahunAjaran(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              >
                <option value="Semua">Semua Tahun Ajaran</option>
                {uniqueTahunAjaran.map((tahun) => (
                  <option key={tahun} value={tahun}>
                    {tahun}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* TABEL KELAS */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-bold tracking-wider">
                  <th className="p-4">Kode & Nama Kelas</th>
                  <th className="p-4">Tingkat / Jurusan</th>
                  <th className="p-4">Wali Kelas</th>
                  <th className="p-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="text-center p-8 text-slate-500">
                      🔄 Memuat data kelas dari Firestore...
                    </td>
                  </tr>
                ) : filteredKelas.length > 0 ? (
                  filteredKelas.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4">
                        <div className="font-bold text-slate-800 text-sm">{item.namaKelas}</div>
                        <div className="text-slate-400 font-mono text-[11px]">
                          {item.kodeKelas} • TA {item.tahunAjaran}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-block bg-teal-50 text-teal-700 font-semibold px-2 py-0.5 rounded border border-teal-200">
                          Kelas {item.tingkat}
                        </span>
                        <div className="text-slate-400 mt-0.5">{item.jurusan || "-"}</div>
                      </td>
                      <td className="p-4 font-medium text-slate-800">
                        {item.waliKelas || <span className="text-rose-400 italic">Belum dipilih</span>}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 px-2.5 py-1 rounded text-xs font-semibold transition"
                            title="Edit Kelas"
                          >
                            ✏️ Edit
                          </button>
                          {canManage && (
                            <button
                              onClick={() => handleDeleteKelas(item.id, item.namaKelas)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded text-xs font-semibold transition"
                              title="Hapus Kelas"
                            >
                              🗑️ Hapus
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center p-8 text-slate-400">
                      <div className="text-2xl mb-1">🔍</div>
                      <div>Tidak ada data rombel/kelas yang sesuai dengan filter.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL FORM TAMBAH / EDIT */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="bg-teal-700 text-white px-5 py-4 flex justify-between items-center">
              <h3 className="font-bold text-base">
                {editingId ? "Edit Data Rombongan Belajar" : "Tambah Rombel / Kelas Baru"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-teal-200 hover:text-white font-bold text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveKelas} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Kode Kelas <span className="text-teal-600 font-normal italic">(Otomatis)</span>
                  </label>
                  <input
                    type="text"
                    disabled
                    value={formData.kodeKelas}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 bg-slate-100 text-slate-500 font-mono cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Nama Kelas / Rombel <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.namaKelas}
                    onChange={(e) => setFormData({ ...formData, namaKelas: e.target.value })}
                    placeholder="Contoh: Kelas VII - A"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">Tingkat</label>
                  <select
                    value={formData.tingkat}
                    onChange={(e) => setFormData({ ...formData, tingkat: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  >
                    <option value="7">7 (Tujuh / VII)</option>
                    <option value="8">8 (Delapan / VIII)</option>
                    <option value="9">9 (Sembilan / IX)</option>
                    <option value="10">10 (Sepuluh / X)</option>
                    <option value="11">11 (Sebelas / XI)</option>
                    <option value="12">12 (Dua Belas / XII)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Jurusan / Program
                  </label>
                  <input
                    list="jurusan-options"
                    value={formData.jurusan}
                    onChange={(e) => setFormData({ ...formData, jurusan: e.target.value })}
                    placeholder="Pilih atau ketik manual..."
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  />
                  <datalist id="jurusan-options">
                    <option value="Umum" />
                    <option value="IPA" />
                    <option value="IPS" />
                    <option value="Keagamaan" />
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">Wali Kelas</label>
                  <select
                    value={formData.waliKelas}
                    onChange={(e) => setFormData({ ...formData, waliKelas: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                  >
                    <option value="">-- Pilih Wali Kelas --</option>
                    {guruList.length > 0 ? (
                      guruList.map((guru) => (
                        <option key={guru.id || guru.nama} value={guru.nama}>
                          {guru.nama}
                        </option>
                      ))
                    ) : (
                      <option disabled value="">
                        Belum ada data guru (Tambahkan di Modul Guru)
                      </option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Tahun Ajaran <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.tahunAjaran}
                    onChange={(e) => setFormData({ ...formData, tahunAjaran: e.target.value })}
                    placeholder="Contoh: 2025/2026"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition"
                >
                  {editingId ? "Simpan Perubahan" : "Simpan Kelas Baru"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOTIFIKASI DATA GANDA (IMPORT CSV) */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-amber-600">
              <div className="p-2.5 bg-amber-100 rounded-full text-xl">⚠️</div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Data Kelas Ganda Terdeteksi!</h3>
                <p className="text-xs text-slate-500">Konfirmasi Upload Data Kelas</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Ditemukan <span className="font-bold text-amber-700">{duplicateList.length} kelas</span> yang sudah terdaftar untuk tahun ajaran yang sama.
            </p>

            <div className="max-h-36 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-1">
              <p className="font-semibold text-slate-500 mb-1">Daftar Kelas Sama:</p>
              {duplicateList.map((dup, idx) => (
                <div key={idx} className="truncate text-slate-700 font-medium">
                  • {dup.namaKelas} (TA: {dup.tahunAjaran})
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-500 italic">
              Apakah Anda ingin menimpa (memperbarui) data lama dengan data baru ini, atau membatalkan seluruh upload?
            </p>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={handleCancelUpload}
                disabled={isProcessingUpload}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition disabled:opacity-50"
              >
                Batal Upload
              </button>
              <button
                type="button"
                onClick={handleConfirmOverwrite}
                disabled={isProcessingUpload}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition shadow-sm disabled:opacity-50"
              >
                {isProcessingUpload ? "Memproses..." : "Ya, Timpa Data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}