import React, { useState, useEffect, useMemo, useRef } from "react";
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

// ==========================================
// INTERFACES
// ==========================================
interface JadwalItem {
  id: string;
  hari: string;
  kelas: string;
  jamMulai: string;
  jamSelesai: string;
  mapel: string;
  guru: string;
  madrasahId: string;
}

interface KelasItem {
  id: string;
  namaKelas: string;
}

interface MapelItem {
  id: string;
  nama: string;
  guruPengampu?: string[];
}

interface GuruItem {
  id: string;
  nama: string;
  mapel?: string;
}

interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

const HARI_LIST = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

// ==========================================
// KOMPONEN SEARCHABLE DROPDOWN (AUTOCOMPLETE)
// ==========================================
interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Cari / pilih...",
  emptyMessage = "Data tidak ditemukan",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm(value);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(term))
    );
  }, [options, searchTerm]);

  const handleSelectOption = (optValue: string, optLabel: string) => {
    onChange(optValue);
    setSearchTerm(optLabel);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          disabled={disabled}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if (!e.target.value) {
              onChange("");
            }
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full text-sm border border-slate-300 p-2.5 pr-8 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
          ▼
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="p-3 text-xs text-slate-400 text-center">{emptyMessage}</div>
          ) : (
            filteredOptions.map((opt) => (
              <div
                key={opt.value}
                onClick={() => handleSelectOption(opt.value, opt.label)}
                className={`p-2.5 text-sm cursor-pointer hover:bg-teal-50 hover:text-teal-900 border-b border-slate-50 last:border-none flex justify-between items-center ${
                  value === opt.value ? "bg-teal-50 font-bold text-teal-800" : "text-slate-700"
                }`}
              >
                <span>{opt.label}</span>
                {opt.sublabel && (
                  <span className="text-xs text-slate-400 font-normal ml-2">
                    ({opt.sublabel})
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ==========================================
// UTAMA: JADWAL PELAJARAN COMPONENT
// ==========================================
export default function JadwalPelajaran() {
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user;

  // Deteksi role secara mandiri
  const roleLower = (user?.role || "").toLowerCase();
  const isUserGuru = roleLower.includes("guru");
  const isUserWali = roleLower.includes("wali");
  const isUserAdmin = auth?.isAdmin || auth?.isSuperAdmin || roleLower.includes("admin");
  const isUserKepala = auth?.isKepala || roleLower.includes("kepala");

  // Hak kelola penuh
  const canManage = Boolean(
    isUserAdmin || 
    isUserKepala || 
    isUserWali || 
    isUserGuru ||
    auth?.isWaliKelas
  );

  // Data State
  const [jadwalList, setJadwalList] = useState<JadwalItem[]>([]);
  const [kelasList, setKelasList] = useState<KelasItem[]>([]);
  const [mapelList, setMapelList] = useState<MapelItem[]>([]);
  const [guruList, setGuruList] = useState<GuruItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hari, setHari] = useState("Senin");
  const [kelas, setKelas] = useState("");
  const [jamMulai, setJamMulai] = useState("07:00");
  const [jamSelesai, setJamSelesai] = useState("08:30");
  
  const [mapel, setMapel] = useState("");
  const [guru, setGuru] = useState("");
  const [saving, setSaving] = useState(false);

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterHari, setFilterHari] = useState("Semua Hari");
  const [filterKelas, setFilterKelas] = useState("Semua Kelas");

  // Alert State
  const [alertMessage, setAlertMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const showAlert = (text: string, type: "success" | "error" | "info" = "success") => {
    setAlertMessage({ type, text });
    setTimeout(() => setAlertMessage(null), 3500);
  };

  // Synchronize Data Real-time (Jadwal, Kelas, Mapel, Guru)
  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    setLoading(true);

    const qJadwal = user.madrasahId 
      ? query(collection(db, "jadwal"), where("madrasahId", "==", user.madrasahId))
      : collection(db, "jadwal");

    const unsubJadwal = onSnapshot(qJadwal, (snapshot) => {
      const list: JadwalItem[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as JadwalItem));
      setJadwalList(list);
      setLoading(false);
    }, (err) => {
      console.error("Gagal mengambil data jadwal:", err);
      showAlert("Gagal memuat data jadwal.", "error");
      setLoading(false);
    });

    const qKelas = user.madrasahId 
      ? query(collection(db, "kelas"), where("madrasahId", "==", user.madrasahId))
      : collection(db, "kelas");

    const unsubKelas = onSnapshot(qKelas, (snapshot) => {
      const list: KelasItem[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({ id: d.id, namaKelas: data.namaKelas || data.nama || "Tanpa Nama" });
      });
      list.sort((a, b) => a.namaKelas.localeCompare(b.namaKelas));
      setKelasList(list);
    });

    const qMapel = user.madrasahId 
      ? query(collection(db, "mapel"), where("madrasahId", "==", user.madrasahId))
      : collection(db, "mapel");

    const unsubMapel = onSnapshot(qMapel, (snapshot) => {
      const list: MapelItem[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        const namaMapel = data.nama || data.namaMapel || data.mapel || "";
        if (namaMapel) {
          list.push({ 
            id: d.id, 
            nama: namaMapel, 
            guruPengampu: data.guruPengampu || [] 
          });
        }
      });
      list.sort((a, b) => a.nama.localeCompare(b.nama));
      setMapelList(list);
    });

    const qGuru = user.madrasahId 
      ? query(collection(db, "guru"), where("madrasahId", "==", user.madrasahId))
      : collection(db, "guru");

    const unsubGuru = onSnapshot(qGuru, (snapshot) => {
      const list: GuruItem[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        const namaGuru = data.nama || data.namaLengkap || data.namaGuru || "";
        const mapelGuru = data.mapel || data.mataPelajaran || data.mapelDiampu || "";
        if (namaGuru) {
          list.push({ id: d.id, nama: namaGuru, mapel: mapelGuru });
        }
      });
      list.sort((a, b) => a.nama.localeCompare(b.nama));
      setGuruList(list);
    });

    return () => {
      unsubJadwal();
      unsubKelas();
      unsubMapel();
      unsubGuru();
    };
  }, [user, navigate]);

  const mapelOptions = useMemo<SelectOption[]>(() => {
    const uniqueMapelNames = Array.from(new Set(mapelList.map((m) => m.nama).filter(Boolean)));
    return uniqueMapelNames
      .sort((a, b) => a.localeCompare(b))
      .map((nama) => ({ value: nama, label: nama }));
  }, [mapelList]);

  const guruOptions = useMemo<SelectOption[]>(() => {
    return guruList.map((g) => ({
      value: g.nama,
      label: g.nama,
      sublabel: g.mapel ? `Pengampu: ${g.mapel}` : undefined
    }));
  }, [guruList]);

  // Perbaikan: Ubah Mapel tanpa merusak atau memperbarui Guru secara paksa
  const handleMapelChange = (selectedMapelNama: string) => {
    setMapel(selectedMapelNama);
    if (!selectedMapelNama) return;

    // Jika guru belum dipilih, bantu pilihkan guru pengampu pertama
    if (!guru) {
      const guruMatch = guruList.find((g) => {
        if (!g.mapel) return false;
        const listMapelGuru = g.mapel.split(",").map((item) => item.trim().toLowerCase());
        return listMapelGuru.includes(selectedMapelNama.toLowerCase());
      });

      if (guruMatch) {
        setGuru(guruMatch.nama);
        return;
      }

      const selectedObj = mapelList.find((m) => m.nama === selectedMapelNama);
      if (selectedObj && selectedObj.guruPengampu && selectedObj.guruPengampu.length > 0) {
        setGuru(selectedObj.guruPengampu[0]);
      }
    }
  };

  // Perbaikan: Ubah Guru TANPA menimpa nilai Mapel yang sudah dipilih
  const handleGuruChange = (selectedGuruNama: string) => {
    setGuru(selectedGuruNama);
  };

  const resetForm = () => {
    setEditingId(null);
    setHari("Senin");
    setKelas("");
    setJamMulai("07:00");
    setJamSelesai("08:30");
    setMapel("");
    setGuru("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapel.trim() || !user?.madrasahId) {
      showAlert("Mata Pelajaran dan Sesi Madrasah wajib diisi!", "error");
      return;
    }
    if (!guru.trim()) {
      showAlert("Guru Pengampu wajib dipilih!", "error");
      return;
    }

    setSaving(true);
    try {
      const docId = editingId || `jadwal_${Date.now()}`;
      const payload = {
        hari,
        kelas,
        jamMulai,
        jamSelesai,
        mapel: mapel.trim(),
        guru: guru.trim(),
        madrasahId: user.madrasahId,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, "jadwal", docId), payload, { merge: true });
      showAlert(editingId ? "Jadwal pelajaran berhasil diperbarui!" : "Jadwal baru berhasil ditambahkan!");
      resetForm();
    } catch (err) {
      console.error("Gagal menyimpan jadwal:", err);
      showAlert("Terjadi kesalahan saat menyimpan jadwal.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: JadwalItem) => {
    setEditingId(item.id);
    setHari(item.hari || "Senin");
    setKelas(item.kelas || "");
    setJamMulai(item.jamMulai || "07:00");
    setJamSelesai(item.jamSelesai || "08:30");
    setMapel(item.mapel || "");
    setGuru(item.guru || "");
  };

  const handleDelete = async (id: string, detail: string) => {
    if (window.confirm(`Yakin ingin menghapus jadwal "${detail}"?`)) {
      try {
        await deleteDoc(doc(db, "jadwal", id));
        showAlert("Jadwal pelajaran berhasil dihapus.", "info");
      } catch (err) {
        console.error("Gagal menghapus jadwal:", err);
        showAlert("Gagal menghapus jadwal pelajaran.", "error");
      }
    }
  };

  const handleDownloadTemplate = () => {
    const csvHeader = "sep=,\nHari,Kelas,Jam Mulai,Jam Selesai,Mata Pelajaran,Guru Pengampu\n";
    const csvExample1 = "Senin,7A,07:00,08:30,Akidah Akhlak,H. SURAHMAN S.Ag\n";
    const csvExample2 = "Senin,7B,08:30,10:00,Bahasa Arab,FACHRI ABDUL HAKIM S.Hum.\n";

    const blob = new Blob(["\uFEFF" + csvHeader + csvExample1 + csvExample2], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Template_Jadwal_Pelajaran.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showAlert("Template CSV Jadwal berhasil diunduh.");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.madrasahId) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !l.startsWith("sep="));

        if (lines.length <= 1) {
          showAlert("File kosong atau tidak berisi data jadwal!", "error");
          return;
        }

        setIsUploading(true);
        const delimiter = lines[0].includes(";") ? ";" : ",";
        
        const batch = writeBatch(db);
        let importCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
          if (cols.length >= 5) {
            const docId = `jadwal_${Date.now()}_${i}`;
            const newJadwal = {
              hari: cols[0] || "Senin",
              kelas: cols[1] || "",
              jamMulai: cols[2] || "07:00",
              jamSelesai: cols[3] || "08:30",
              mapel: cols[4] || "",
              guru: cols[5] || "",
              madrasahId: user.madrasahId,
              updatedAt: new Date().toISOString()
            };

            if (newJadwal.mapel) {
              const docRef = doc(db, "jadwal", docId);
              batch.set(docRef, newJadwal, { merge: true });
              importCount++;
            }
          }
        }

        if (importCount > 0) {
          await batch.commit();
          showAlert(`Berhasil mengimpor ${importCount} jadwal pelajaran.`);
        } else {
          showAlert("Gagal memproses file. Pastikan format kolom sesuai template.", "error");
        }
      } catch (err) {
        console.error(err);
        showAlert("Gagal membaca atau mengunggah file CSV.", "error");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const filteredJadwal = useMemo(() => {
    return jadwalList.filter((item) => {
      const matchSearch =
        (item.mapel || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.guru || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchHari = filterHari === "Semua Hari" || item.hari === filterHari;
      const matchKelas = filterKelas === "Semua Kelas" || item.kelas === filterKelas;

      return matchSearch && matchHari && matchKelas;
    });
  }, [jadwalList, searchTerm, filterHari, filterKelas]);

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
            <h1 className="text-xl font-bold">Modul Jadwal Pelajaran</h1>
            <p className="text-xs text-teal-100">
              {user?.namaMadrasah || "MTs Negeri 1 Karawang"} | Pengelola: {user?.nama || "Pengguna"}
            </p>
          </div>
        </div>
        <div className="text-right text-xs bg-teal-800 px-3 py-1.5 rounded-lg border border-teal-600">
          <span className="font-semibold block">{user?.role?.toUpperCase() || "USER"}</span>
          <span className="opacity-80">Hak Akses Management</span>
        </div>
      </header>

      {/* ALERT */}
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

        {/* FORM INPUT */}
        {canManage && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              {editingId ? "Edit Jadwal Pelajaran" : "Buat Jadwal Baru"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hari</label>
                  <select
                    value={hari}
                    onChange={(e) => setHari(e.target.value)}
                    className="w-full text-sm border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                  >
                    {HARI_LIST.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kelas</label>
                  <select
                    value={kelas}
                    onChange={(e) => setKelas(e.target.value)}
                    className="w-full text-sm border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                  >
                    <option value="">Pilih Kelas</option>
                    {kelasList.map((k) => (
                      <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jam Mulai</label>
                  <input
                    type="time"
                    value={jamMulai}
                    onChange={(e) => setJamMulai(e.target.value)}
                    className="w-full text-sm border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jam Selesai</label>
                  <input
                    type="time"
                    value={jamSelesai}
                    onChange={(e) => setJamSelesai(e.target.value)}
                    className="w-full text-sm border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                    required
                  />
                </div>
              </div>

              {/* MATA PELAJARAN */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mata Pelajaran <span className="text-rose-500">*</span>
                </label>
                <SearchableSelect
                  options={mapelOptions}
                  value={mapel}
                  onChange={handleMapelChange}
                  placeholder="Ketik / pilih mata pelajaran..."
                  emptyMessage="Mapel tidak ditemukan di Modul Mapel"
                />
              </div>

              {/* GURU PENGAMPU */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Guru Pengampu <span className="text-rose-500">*</span>
                </label>
                <SearchableSelect
                  options={guruOptions}
                  value={guru}
                  onChange={handleGuruChange}
                  placeholder="Ketik / pilih nama guru..."
                  emptyMessage="Guru tidak ditemukan di Modul Guru"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-lg transition disabled:bg-slate-400 shadow-sm text-sm"
                >
                  {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan Jadwal"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="bg-slate-100 text-slate-600 border border-slate-300 font-bold px-4 py-2.5 rounded-lg text-xs hover:bg-slate-200 transition"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* DAFTAR JADWAL */}
        <div className={`${canManage ? "lg:col-span-2" : "lg:col-span-3"} bg-white p-6 rounded-xl shadow-sm border border-slate-200`}>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Daftar Jadwal Mengajar</h2>
              <p className="text-slate-500 text-xs">Total Jadwal: {filteredJadwal.length} sesi</p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleDownloadTemplate}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5"
              >
                <span>📥</span>
                <span>Unduh Template</span>
              </button>

              {canManage && (
                <label className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center space-x-1.5 border ${
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

          {/* FILTER BAR */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <input
              type="text"
              placeholder="Cari Mapel atau Guru..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            />
            <select
              value={filterHari}
              onChange={(e) => setFilterHari(e.target.value)}
              className="text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            >
              <option value="Semua Hari">Semua Hari</option>
              {HARI_LIST.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            >
              <option value="Semua Kelas">Semua Kelas</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>
              ))}
            </select>
          </div>

          {/* TABEL */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-500 text-xs">Memuat daftar jadwal...</p>
            </div>
          ) : filteredJadwal.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <div className="text-4xl mb-3">📅</div>
              <p className="text-sm font-medium text-slate-500">Tidak ada jadwal yang sesuai dengan filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                    <th className="p-3 font-bold">Waktu & Kelas</th>
                    <th className="p-3 font-bold">Mata Pelajaran</th>
                    <th className="p-3 font-bold">Guru Pengampu</th>
                    {canManage && <th className="p-3 font-bold text-center">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredJadwal.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded font-bold text-xs">
                            {item.hari}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold border">
                            {item.kelas || "-"}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          ⏱️ {item.jamMulai} - {item.jamSelesai}
                        </div>
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        {item.mapel}
                      </td>
                      <td className="p-3 text-slate-600 text-xs">
                        {item.guru ? `👤 ${item.guru}` : "-"}
                      </td>
                      {canManage && (
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="text-sky-600 hover:text-sky-800 font-semibold text-xs bg-sky-50 px-2.5 py-1 rounded border border-sky-100 transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(item.id, `${item.hari} - ${item.mapel} (${item.kelas})`)}
                              className="text-rose-600 hover:text-rose-800 font-semibold text-xs bg-rose-50 px-2.5 py-1 rounded border border-rose-100 transition"
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