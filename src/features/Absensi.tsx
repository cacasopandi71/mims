import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../config/firebase";
import { collection, getDocs, query, where, addDoc, doc, getDoc, limit, setDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

// ==========================================
// INTERFACES & TYPES
// ==========================================
interface DropdownItem {
  id: string;
  nama: string;
}

interface SiswaItem {
  id: string;
  namaSiswa: string;
  nis: string;
}

interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

type StatusAbsen = "Hadir" | "Sakit" | "Izin" | "Alfa";

interface AbsenRecord {
  id?: string;
  tanggal: string;
  mapel: string;
  kelas: string;
  data: {
    siswaId: string;
    namaSiswa: string;
    nis: string;
    status: StatusAbsen;
  }[];
}

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
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selectedOpt = options.find((opt) => opt.value === value);
    if (selectedOpt) {
      setSearchTerm(selectedOpt.label);
    } else {
      setSearchTerm(value || "");
    }
  }, [value, options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        const selectedOpt = options.find((opt) => opt.value === value);
        setSearchTerm(selectedOpt ? selectedOpt.label : value || "");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, options]);

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
          className="w-full text-sm border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white transition disabled:bg-slate-100 disabled:cursor-not-allowed"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
          ▼
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="p-3 text-xs text-slate-400 text-center">{emptyMessage}</div>
          ) : (
            filteredOptions.map((opt, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectOption(opt.value, opt.label)}
                className={`p-2.5 text-sm cursor-pointer hover:bg-teal-50 hover:text-teal-900 border-b border-slate-50 last:border-none flex justify-between items-center transition ${
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
// UTAMA: ABSENSI COMPONENT
// ==========================================
export default function Absensi() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"input" | "rekap">("input");
  const [rekapMode, setRekapMode] = useState<"mapel" | "bulanan">("mapel");

  // Master Data State
  const [kelasList, setKelasList] = useState<DropdownItem[]>([]);
  const [mapelList, setMapelList] = useState<DropdownItem[]>([]);
  const [siswaList, setSiswaList] = useState<SiswaItem[]>([]);

  // Form State Input Absen
  const [tanggal, setTanggal] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedMapel, setSelectedMapel] = useState<string>("");
  const [selectedKelas, setSelectedKelas] = useState<string>("");

  // Form State Rekap
  const [rekapBulan, setRekapBulan] = useState<string>(new Date().toISOString().slice(0, 7));
  const [rekapKelas, setRekapKelas] = useState<string>("");
  const [rekapMapel, setRekapMapel] = useState<string>("");
  const [rekapRecords, setRekapRecords] = useState<AbsenRecord[]>([]);

  // State simpan status absen siswa
  const [absensiData, setAbsensiData] = useState<Record<string, StatusAbsen>>({});

  // Profil Pengesahan & Header
  const [namaMadrasah, setNamaMadrasah] = useState("-");
  const [tempatTtd, setTempatTtd] = useState("Karawang");
  const [namaKamad, setNamaKamad] = useState("-");
  const [nipKamad, setNipKamad] = useState("-");
  const [namaGuru, setNamaGuru] = useState("-");
  const [nipGuru, setNipGuru] = useState("-");

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingSiswa, setLoadingSiswa] = useState<boolean>(false);
  const [loadingRekap, setLoadingRekap] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [alertMessage, setAlertMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const isWaliKelas = useMemo(() => {
    const role = (user as any)?.role || (user as any)?.jabatan || "";
    return role.toLowerCase().includes("wali") || (user as any)?.isWaliKelas === true;
  }, [user]);

  const showAlert = (text: string, type: "success" | "error" | "info" = "success") => {
    setAlertMessage({ type, text });
    setTimeout(() => setAlertMessage(null), 4000);
  };

  // 1. LOAD PROFIL MADRASAH & PENGESAHAN
  useEffect(() => {
    async function fetchProfileAndUser() {
      if (!user) return;

      try {
        let gNama = (user as any).nama || (user as any).displayName || (user as any).namaLengkap || "";
        let gNip = (user as any).nip || (user as any).nipGuru || "";
        let targetMadrasahId = (user as any).madrasahId || (user as any).idMadrasah || "";

        if (user.uid) {
          try {
            const userDocSnap = await getDoc(doc(db, "users", user.uid));
            if (userDocSnap.exists()) {
              const uData = userDocSnap.data();
              gNama = gNama || uData.nama || uData.namaLengkap || uData.displayName || "";
              gNip = gNip || uData.nip || uData.nipGuru || uData.nip_guru || "-";
              targetMadrasahId = targetMadrasahId || uData.madrasahId || uData.idMadrasah || uData.sekolahId || "";
            }
          } catch (e) {
            console.warn("Gagal fetch user doc:", e);
          }
        }

        setNamaGuru(gNama || "-");
        setNipGuru(gNip || "-");

        let profData: any = null;

        if (targetMadrasahId) {
          const directSnap = await getDoc(doc(db, "madrasahs", targetMadrasahId));
          if (directSnap.exists()) {
            profData = directSnap.data();
          }
        }

        if (!profData) {
          const snapAll = await getDocs(query(collection(db, "madrasahs"), limit(1)));
          if (!snapAll.empty) {
            profData = snapAll.docs[0].data();
          }
        }

        if (profData) {
          setNamaMadrasah(profData.nama || profData.namaMadrasah || "-");
          setTempatTtd(profData.kabKota || profData.kabupaten || profData.kota || "Karawang");
          setNamaKamad(profData.namaKepala || profData.namaKamad || "-");
          setNipKamad(profData.nipKepala || profData.nipKamad || profData.nip || "-");
        }
      } catch (err) {
        console.error("Gagal memuat profil madrasah:", err);
      }
    }

    fetchProfileAndUser();
  }, [user]);

  // 2. LOAD DATA MASTER (KELAS & MAPEL)
  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    const loadMasterData = async () => {
      setLoading(true);
      try {
        const mId = user.madrasahId || (user as any).idMadrasah;
        if (!mId) return;

        // Fetch Kelas
        const qKelas = query(collection(db, "kelas"), where("madrasahId", "==", mId));
        const snapKelas = await getDocs(qKelas);
        let klsData: DropdownItem[] = snapKelas.docs.map((d) => ({
          id: d.id,
          nama: d.data().namaKelas || d.data().nama || "Tanpa Nama",
        }));
        klsData = klsData.filter((item, index, self) => index === self.findIndex((t) => t.nama === item.nama));
        klsData.sort((a, b) => a.nama.localeCompare(b.nama));
        setKelasList(klsData);

        // Fetch Mapel
        const qMapel = query(collection(db, "mapel"), where("madrasahId", "==", mId));
        const snapMapel = await getDocs(qMapel);
        let mplData: DropdownItem[] = snapMapel.docs.map((d) => ({
          id: d.id,
          nama: d.data().namaMapel || d.data().nama || "Tanpa Nama",
        }));
        mplData = mplData.filter((item, index, self) => index === self.findIndex((t) => t.nama === item.nama));
        mplData.sort((a, b) => a.nama.localeCompare(b.nama));
        setMapelList(mplData);
      } catch (error) {
        console.error("Gagal memuat data master:", error);
        showAlert("Gagal memuat data Kelas dan Mata Pelajaran.", "error");
      } finally {
        setLoading(false);
      }
    };

    loadMasterData();
  }, [user, navigate]);

  const mapelOptions = useMemo<SelectOption[]>(() => mapelList.map((m) => ({ value: m.nama, label: m.nama })), [mapelList]);
  const kelasOptions = useMemo<SelectOption[]>(() => kelasList.map((k) => ({ value: k.nama, label: k.nama })), [kelasList]);

  // 3. LOAD SISWA KETIKA KELAS DIPILIH ATAU MEMUAT ABSENSI TERPINDAH JIKA SUDAH ADA
  useEffect(() => {
    const targetKelas = activeTab === "input" ? selectedKelas : rekapKelas;
    const mId = user?.madrasahId || (user as any)?.idMadrasah;

    const loadSiswa = async () => {
      if (!targetKelas || !mId) {
        setSiswaList([]);
        return;
      }

      setLoadingSiswa(true);
      try {
        const qSiswa = query(
          collection(db, "siswa"),
          where("madrasahId", "==", mId),
          where("kelas", "==", targetKelas)
        );
        const snapSiswa = await getDocs(qSiswa);

        const dataSiswa: SiswaItem[] = snapSiswa.docs.map((d) => ({
          id: d.id,
          namaSiswa: d.data().nama || d.data().namaSiswa || "-",
          nis: d.data().nis || d.data().nisn || "-",
        }));

        dataSiswa.sort((a, b) => a.namaSiswa.localeCompare(b.namaSiswa));
        setSiswaList(dataSiswa);

        if (activeTab === "input") {
          // Default ke "Hadir"
          const initialAbsensi: Record<string, StatusAbsen> = {};
          dataSiswa.forEach((siswa) => {
            initialAbsensi[siswa.id] = "Hadir";
          });

          // Cek jika sudah pernah melakukan absensi di tanggal, kelas, dan mapel ini
          if (tanggal && selectedMapel && targetKelas) {
            const qExisting = query(
              collection(db, "absensi"),
              where("madrasahId", "==", mId),
              where("tanggal", "==", tanggal),
              where("kelas", "==", targetKelas),
              where("mapel", "==", selectedMapel)
            );
            const snapExisting = await getDocs(qExisting);
            if (!snapExisting.empty) {
              const existingData = snapExisting.docs[0].data() as AbsenRecord;
              if (Array.isArray(existingData.data)) {
                existingData.data.forEach((item) => {
                  initialAbsensi[item.siswaId] = item.status;
                });
              }
            }
          }
          setAbsensiData(initialAbsensi);
        }
      } catch (error) {
        console.error("Gagal memuat siswa:", error);
        showAlert("Gagal memuat daftar siswa untuk kelas ini.", "error");
      } finally {
        setLoadingSiswa(false);
      }
    };

    loadSiswa();
  }, [selectedKelas, rekapKelas, selectedMapel, tanggal, activeTab, user]);

  // 4. FETCH DATA REKAP ABSENSI
  const handleFetchRekap = async () => {
    if (!rekapKelas) {
      showAlert("Pilih Kelas terlebih dahulu untuk menampilkan rekap!", "error");
      return;
    }

    if (rekapMode === "mapel" && !rekapMapel) {
      showAlert("Pilih Mata Pelajaran terlebih dahulu!", "error");
      return;
    }

    setLoadingRekap(true);
    try {
      const mId = user?.madrasahId || (user as any)?.idMadrasah;
      const qAbsen = query(
        collection(db, "absensi"),
        where("madrasahId", "==", mId),
        where("kelas", "==", rekapKelas)
      );

      const snap = await getDocs(qAbsen);
      let list: AbsenRecord[] = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as AbsenRecord),
      }));

      if (rekapBulan) {
        list = list.filter((item) => item.tanggal && item.tanggal.startsWith(rekapBulan));
      }

      if (rekapMode === "mapel" && rekapMapel) {
        list = list.filter((item) => item.mapel === rekapMapel);
      }

      list.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
      setRekapRecords(list);

      if (list.length === 0) {
        showAlert("Tidak ditemukan data absensi untuk filter terpilih.", "info");
      }
    } catch (err) {
      console.error("Gagal memuat rekap absensi:", err);
      showAlert("Terjadi kesalahan saat memuat rekap absensi.", "error");
    } finally {
      setLoadingRekap(false);
    }
  };

  const handleStatusChange = (siswaId: string, status: StatusAbsen) => {
    setAbsensiData((prev) => ({
      ...prev,
      [siswaId]: status,
    }));
  };

  // 5. PENYIMPANAN ABSENSI (OTOMATIS MENIMPA DATA LAMA JIKA MAPEL, KELAS & TANGGAL SAMA)
  const handleSimpan = async () => {
    if (!tanggal || !selectedMapel || !selectedKelas) {
      showAlert("Mohon lengkapi Tanggal, Mata Pelajaran, dan Kelas terlebih dahulu!", "error");
      return;
    }

    if (siswaList.length === 0) {
      showAlert("Tidak ada siswa di kelas ini yang bisa diabsen.", "error");
      return;
    }

    setSaving(true);
    try {
      const mId = user?.madrasahId || (user as any)?.idMadrasah;
      const detailAbsensi = siswaList.map((siswa) => ({
        siswaId: siswa.id,
        namaSiswa: siswa.namaSiswa,
        nis: siswa.nis,
        status: absensiData[siswa.id] || "Hadir",
      }));

      const payload = {
        tanggal: tanggal,
        mapel: selectedMapel,
        kelas: selectedKelas,
        madrasahId: mId,
        penginput: namaGuru || "Admin",
        createdAt: new Date().toISOString(),
        data: detailAbsensi,
      };

      // Query ke Firestore untuk mengecek apakah sudah pernah diabsen sebelumnya pada kelas, tanggal, dan mapel yang sama
      const qExisting = query(
        collection(db, "absensi"),
        where("madrasahId", "==", mId),
        where("tanggal", "==", tanggal),
        where("kelas", "==", selectedKelas),
        where("mapel", "==", selectedMapel)
      );

      const snapExisting = await getDocs(qExisting);

      if (!snapExisting.empty) {
        // Jika sudah ada, TIMPA (update) data dokumen lama secara otomatis
        const docId = snapExisting.docs[0].id;
        await setDoc(doc(db, "absensi", docId), payload, { merge: true });
        showAlert(`Data absensi Kelas ${selectedKelas} (${selectedMapel}) tanggal ${tanggal} berhasil ditimpa/diperbarui!`, "success");
      } else {
        // Jika belum ada, buat dokumen baru
        await addDoc(collection(db, "absensi"), payload);
        showAlert(`Absensi Kelas ${selectedKelas} (${selectedMapel}) pada ${tanggal} berhasil disimpan!`, "success");
      }
    } catch (error) {
      console.error("Gagal menyimpan absensi:", error);
      showAlert("Terjadi kesalahan saat menyimpan absensi.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // 6. PERHITUNGAN REKAP BULANAN SISWA (PER HARI = MAX 1 PENCATATAN KELAS)
  const rekapBulananSiswa = useMemo(() => {
    const summary: Record<string, { hadir: number; sakit: number; izin: number; alfa: number }> = {};

    siswaList.forEach((s) => {
      summary[s.id] = { hadir: 0, sakit: 0, izin: 0, alfa: 0 };
    });

    const dailyMap: Record<string, Record<string, StatusAbsen[]>> = {};

    rekapRecords.forEach((rec) => {
      if (Array.isArray(rec.data) && rec.tanggal) {
        rec.data.forEach((item) => {
          if (!dailyMap[item.siswaId]) {
            dailyMap[item.siswaId] = {};
          }
          if (!dailyMap[item.siswaId][rec.tanggal]) {
            dailyMap[item.siswaId][rec.tanggal] = [];
          }
          dailyMap[item.siswaId][rec.tanggal].push(item.status);
        });
      }
    });

    Object.keys(dailyMap).forEach((siswaId) => {
      if (!summary[siswaId]) {
        summary[siswaId] = { hadir: 0, sakit: 0, izin: 0, alfa: 0 };
      }

      Object.keys(dailyMap[siswaId]).forEach((tgl) => {
        const statuses = dailyMap[siswaId][tgl];

        let finalStatus: StatusAbsen = "Alfa";
        if (statuses.includes("Hadir")) {
          finalStatus = "Hadir";
        } else if (statuses.includes("Izin")) {
          finalStatus = "Izin";
        } else if (statuses.includes("Sakit")) {
          finalStatus = "Sakit";
        } else {
          finalStatus = "Alfa";
        }

        if (finalStatus === "Hadir") summary[siswaId].hadir++;
        else if (finalStatus === "Sakit") summary[siswaId].sakit++;
        else if (finalStatus === "Izin") summary[siswaId].izin++;
        else if (finalStatus === "Alfa") summary[siswaId].alfa++;
      });
    });

    return summary;
  }, [siswaList, rekapRecords]);

  const StatusButton = ({ siswaId, status, label, colorClass }: { siswaId: string; status: StatusAbsen; label: string; colorClass: string }) => {
    const isSelected = absensiData[siswaId] === status;
    return (
      <button
        onClick={() => handleStatusChange(siswaId, status)}
        className={`px-3 py-1.5 text-xs font-bold rounded border transition-all ${
          isSelected ? colorClass : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
        }`}
      >
        {label}
      </button>
    );
  };

  const todayStr = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-area {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          .print-header {
            display: block !important;
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid black;
            padding-bottom: 10px;
          }
          .print-pengesahan {
            display: flex !important;
            justify-content: space-between;
            margin-top: 40px;
            page-break-inside: avoid;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #000 !important;
            padding: 6px 8px !important;
            font-size: 10pt !important;
          }
        }
        .print-header, .print-pengesahan {
          display: none;
        }
      `}</style>

      {/* HEADER NAVBAR */}
      <header className="bg-teal-700 text-white p-4 shadow-md flex justify-between items-center no-print">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-teal-800 hover:bg-teal-900 text-white px-3 py-1.5 rounded-lg text-sm transition flex items-center space-x-1"
          >
            <span>←</span>
            <span>Dashboard</span>
          </button>
          <div>
            <h1 className="text-xl font-bold">Modul Kehadiran & Rekap Absensi</h1>
            <p className="text-xs text-teal-100">
              {namaMadrasah} | Pengelola: {namaGuru}
            </p>
          </div>
        </div>

        <div className="flex bg-teal-800 p-1 rounded-xl space-x-1">
          <button
            onClick={() => setActiveTab("input")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "input" ? "bg-white text-teal-800 shadow" : "text-teal-100 hover:bg-teal-700"
            }`}
          >
            ✍️ Input Absen
          </button>
          <button
            onClick={() => setActiveTab("rekap")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === "rekap" ? "bg-white text-teal-800 shadow" : "text-teal-100 hover:bg-teal-700"
            }`}
          >
            📊 Rekap & Cetak
          </button>
        </div>
      </header>

      {/* TOAST NOTIFICATION */}
      {alertMessage && (
        <div className="max-w-5xl mx-auto w-full px-4 pt-4 no-print">
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
      <div className="p-4 md:p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* ========================================================= */}
        {/* TAB 1: INPUT ABSENSI                                      */}
        {/* ========================================================= */}
        {activeTab === "input" && (
          <>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 no-print">
              <h2 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">
                Konfigurasi Absensi Harian
              </h2>

              {loading ? (
                <p className="text-sm text-slate-500 animate-pulse">Memuat data master...</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Absen</label>
                    <input
                      type="date"
                      value={tanggal}
                      onChange={(e) => setTanggal(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mata Pelajaran <span className="text-rose-500">*</span>
                    </label>
                    <SearchableSelect
                      options={mapelOptions}
                      value={selectedMapel}
                      onChange={(val) => setSelectedMapel(val)}
                      placeholder="Ketik / pilih mapel..."
                      emptyMessage="Mata pelajaran tidak ditemukan"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kelas <span className="text-rose-500">*</span>
                    </label>
                    <SearchableSelect
                      options={kelasOptions}
                      value={selectedKelas}
                      onChange={(val) => setSelectedKelas(val)}
                      placeholder="Ketik / pilih kelas..."
                      emptyMessage="Kelas tidak ditemukan"
                    />
                  </div>
                </div>
              )}
            </div>

            {selectedKelas && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 no-print">
                <div className="flex justify-between items-end mb-4 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">
                      Daftar Siswa Kelas {selectedKelas} {selectedMapel ? `— (${selectedMapel})` : ""}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {siswaList.length} Siswa Terdaftar | Default status adalah "Hadir"
                    </p>
                  </div>
                </div>

                {loadingSiswa ? (
                  <div className="flex justify-center py-10">
                    <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : siswaList.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                    <p className="text-sm">Tidak ada data siswa di kelas ini.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="hidden md:flex bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                      <div className="w-12 text-center">No</div>
                      <div className="flex-1">Nama Siswa / NIS</div>
                      <div className="w-72 text-center">Status Kehadiran</div>
                    </div>

                    {siswaList.map((siswa, index) => (
                      <div
                        key={siswa.id}
                        className="flex flex-col md:flex-row md:items-center p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition gap-3"
                      >
                        <div className="flex-1 flex items-center gap-3">
                          <div className="hidden md:flex w-8 h-8 rounded-full bg-teal-100 text-teal-700 font-bold items-center justify-center text-xs">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{siswa.namaSiswa}</p>
                            <p className="text-xs text-slate-500 font-mono">NIS: {siswa.nis}</p>
                          </div>
                        </div>

                        <div className="flex justify-between md:justify-center w-full md:w-72 gap-1.5 bg-slate-100 p-1 rounded-md border border-slate-200">
                          <StatusButton siswaId={siswa.id} status="Hadir" label="Hadir" colorClass="bg-emerald-500 text-white border-emerald-600 shadow-sm" />
                          <StatusButton siswaId={siswa.id} status="Sakit" label="Sakit" colorClass="bg-sky-500 text-white border-sky-600 shadow-sm" />
                          <StatusButton siswaId={siswa.id} status="Izin" label="Izin" colorClass="bg-amber-500 text-white border-amber-600 shadow-sm" />
                          <StatusButton siswaId={siswa.id} status="Alfa" label="Alfa" colorClass="bg-rose-500 text-white border-rose-600 shadow-sm" />
                        </div>
                      </div>
                    ))}

                    <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={handleSimpan}
                        disabled={saving}
                        className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-md transition disabled:bg-slate-400 flex items-center gap-2"
                      >
                        {saving ? "Menyimpan Data..." : "💾 Simpan Absensi Kelas"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ========================================================= */}
        {/* TAB 2: REKAP & CETAK ABSENSI                              */}
        {/* ========================================================= */}
        {activeTab === "rekap" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 no-print space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h2 className="text-lg font-bold text-slate-800">Filter & Mode Rekapitulasi</h2>

                {isWaliKelas && (
                  <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button
                      onClick={() => setRekapMode("mapel")}
                      className={`px-3 py-1 rounded text-xs font-bold transition ${
                        rekapMode === "mapel" ? "bg-teal-600 text-white shadow" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Rekap Per Mapel (Guru)
                    </button>
                    <button
                      onClick={() => setRekapMode("bulanan")}
                      className={`px-3 py-1 rounded text-xs font-bold transition ${
                        rekapMode === "bulanan" ? "bg-teal-600 text-white shadow" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Rekap Bulanan Wali Kelas
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bulan & Tahun</label>
                  <input
                    type="month"
                    value={rekapBulan}
                    onChange={(e) => setRekapBulan(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kelas *</label>
                  <SearchableSelect
                    options={kelasOptions}
                    value={rekapKelas}
                    onChange={(val) => setRekapKelas(val)}
                    placeholder="Pilih kelas..."
                  />
                </div>

                {rekapMode === "mapel" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mata Pelajaran *</label>
                    <SearchableSelect
                      options={mapelOptions}
                      value={rekapMapel}
                      onChange={(val) => setRekapMapel(val)}
                      placeholder="Pilih mapel..."
                    />
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <button
                    onClick={handleFetchRekap}
                    disabled={loadingRekap}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition shadow"
                  >
                    {loadingRekap ? "Memuat..." : "🔍 Tampilkan Rekap"}
                  </button>
                  {rekapRecords.length > 0 && (
                    <button
                      onClick={handlePrint}
                      className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-2 px-3 rounded-lg text-sm transition shadow"
                      title="Cetak PDF / Print"
                    >
                      🖨️
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* HASIL LAPORAN REKAP ABSENSI */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 print-area">
              {/* PRINT HEADER HEADER LAPORAN (Hanya muncul saat print) */}
              <div className="print-header">
                <h1 className="text-xl font-bold uppercase">{namaMadrasah}</h1>
                <p className="text-sm">LAPORAN REKAPITULASI KEHADIRAN SISWA</p>
                <p className="text-xs">
                  {rekapMode === "mapel" ? `MATA PELAJARAN: ${rekapMapel || "-"}` : "REKAPITULASI BULANAN WALI KELAS"} | KELAS: {rekapKelas || "-"} | PERIODE: {rekapBulan}
                </p>
              </div>

              {/* TAMPILAN MODE 1: REKAP PER MAPEL (GURU) */}
              {rekapMode === "mapel" && (
                <div>
                  <h3 className="text-md font-bold text-slate-800 mb-3 no-print">
                    Rekap Harian Mata Pelajaran: {rekapMapel || "-"} (Kelas {rekapKelas})
                  </h3>

                  {rekapRecords.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                      Klik "Tampilkan Rekap" untuk memuat data.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse border border-slate-200">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 text-xs uppercase font-bold border-b border-slate-200">
                            <th className="p-2 border border-slate-200 text-center w-12">No</th>
                            <th className="p-2 border border-slate-200 text-center w-32">Tanggal</th>
                            <th className="p-2 border border-slate-200 text-center w-24">Hadir (Jml)</th>
                            <th className="p-2 border border-slate-200">Sakit (Nama Siswa)</th>
                            <th className="p-2 border border-slate-200">Izin (Nama Siswa)</th>
                            <th className="p-2 border border-slate-200">Alfa (Nama Siswa)</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs divide-y divide-slate-200">
                          {rekapRecords.map((rec, idx) => {
                            const dataArr = rec.data || [];
                            const totalHadir = dataArr.filter((s) => s.status === "Hadir").length;
                            const daftarSakit = dataArr.filter((s) => s.status === "Sakit").map((s) => s.namaSiswa);
                            const daftarIzin = dataArr.filter((s) => s.status === "Izin").map((s) => s.namaSiswa);
                            const daftarAlfa = dataArr.filter((s) => s.status === "Alfa").map((s) => s.namaSiswa);

                            return (
                              <tr key={rec.id || idx} className="hover:bg-slate-50">
                                <td className="p-2 border border-slate-200 text-center font-bold">{idx + 1}</td>
                                <td className="p-2 border border-slate-200 text-center font-medium">{rec.tanggal}</td>
                                <td className="p-2 border border-slate-200 text-center font-bold text-emerald-600">
                                  {totalHadir} Siswa
                                </td>
                                {/* Mencantumkan nama-nama siswa Sakit, Izin, Alfa */}
                                <td className="p-2 border border-slate-200 text-sky-700 font-medium">
                                  {daftarSakit.length > 0 ? (
                                    <ul className="list-disc list-inside space-y-0.5">
                                      {daftarSakit.map((nama, i) => (
                                        <li key={i}>{nama}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>
                                <td className="p-2 border border-slate-200 text-amber-700 font-medium">
                                  {daftarIzin.length > 0 ? (
                                    <ul className="list-disc list-inside space-y-0.5">
                                      {daftarIzin.map((nama, i) => (
                                        <li key={i}>{nama}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>
                                <td className="p-2 border border-slate-200 text-rose-700 font-medium">
                                  {daftarAlfa.length > 0 ? (
                                    <ul className="list-disc list-inside space-y-0.5">
                                      {daftarAlfa.map((nama, i) => (
                                        <li key={i}>{nama}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAMPILAN MODE 2: REKAP BULANAN WALI KELAS */}
              {rekapMode === "bulanan" && (
                <div>
                  <h3 className="text-md font-bold text-slate-800 mb-3 no-print">
                    Rekapitulasi Kehadiran Akumulatif Bulanan Siswa (Kelas {rekapKelas})
                  </h3>

                  {siswaList.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                      Tidak ada daftar siswa untuk ditampilkan.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse border border-slate-200">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 text-xs uppercase font-bold border-b border-slate-200">
                            <th className="p-2 border border-slate-200 text-center w-12">No</th>
                            <th className="p-2 border border-slate-200 w-32">NIS</th>
                            <th className="p-2 border border-slate-200">Nama Siswa</th>
                            <th className="p-2 border border-slate-200 text-center w-20">Hadir</th>
                            <th className="p-2 border border-slate-200 text-center w-20">Sakit</th>
                            <th className="p-2 border border-slate-200 text-center w-20">Izin</th>
                            <th className="p-2 border border-slate-200 text-center w-20">Alfa</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs divide-y divide-slate-200">
                          {siswaList.map((siswa, idx) => {
                            const recSummary = rekapBulananSiswa[siswa.id] || { hadir: 0, sakit: 0, izin: 0, alfa: 0 };
                            return (
                              <tr key={siswa.id} className="hover:bg-slate-50">
                                <td className="p-2 border border-slate-200 text-center font-bold">{idx + 1}</td>
                                <td className="p-2 border border-slate-200 font-mono text-slate-600">{siswa.nis}</td>
                                <td className="p-2 border border-slate-200 font-bold text-slate-800">{siswa.namaSiswa}</td>
                                <td className="p-2 border border-slate-200 text-center font-bold text-emerald-600">{recSummary.hadir}</td>
                                <td className="p-2 border border-slate-200 text-center font-bold text-sky-600">{recSummary.sakit}</td>
                                <td className="p-2 border border-slate-200 text-center font-bold text-amber-600">{recSummary.izin}</td>
                                <td className="p-2 border border-slate-200 text-center font-bold text-rose-600">{recSummary.alfa}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* AREA PENGESAHAN TANDA TANGAN (HANYA PRINT) */}
              <div className="print-pengesahan">
                <div className="text-center w-64">
                  <p className="text-xs">Mengetahui,</p>
                  <p className="text-xs font-bold mb-14">Kepala Madrasah</p>
                  <p className="text-xs font-bold underline">{namaKamad}</p>
                  <p className="text-xs">NIP. {nipKamad}</p>
                </div>

                <div className="text-center w-64">
                  <p className="text-xs">{tempatTtd}, {todayStr}</p>
                  <p className="text-xs font-bold mb-14">Guru / Wali Kelas</p>
                  <p className="text-xs font-bold underline">{namaGuru}</p>
                  <p className="text-xs">NIP. {nipGuru}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}