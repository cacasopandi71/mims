import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../config/firebase";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

// ==========================================
// INTERFACES & TYPES
// ==========================================
interface AgendaItem {
  id: string;
  tanggal: string;
  namaGuru: string;
  jenisAgenda: "Mengajar" | "Kegiatan";
  namaKelas?: string;
  namaMapel?: string;
  materi?: string;
  catatanKendala?: string;
  catatanKegiatan?: string;
}

interface GuruItem {
  id: string;
  nama: string;
  nip?: string;
  jabatan?: string;
  pangkatGolongan?: string;
  golongan?: string;
  mapelUtama?: string;
}

interface ProfilMadrasahData {
  namaMadrasah?: string;
  alamat?: string;
  telepon?: string;
  email?: string;
  logoUrl?: string;
  kabupaten?: string;
  kota?: string;
  kabupatenKota?: string;
  tempat?: string;
}

interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
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
          className="w-full text-sm border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white transition disabled:bg-slate-100 disabled:cursor-not-allowed"
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
// UTAMA: LAPORAN KINERJA COMPONENT
// ==========================================
export default function LaporanKinerja() {
  const navigate = useNavigate();
  const { user, isAdmin, isSuperAdmin, isKepala } = useAuth();

  const canViewAll = isAdmin || isSuperAdmin || isKepala;

  // State Filter & Tanggal
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [tanggalCetak, setTanggalCetak] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedGuru, setSelectedGuru] = useState<string>("ALL");

  // State Data
  const [agendaList, setAgendaList] = useState<AgendaItem[]>([]);
  const [guruList, setGuruList] = useState<GuruItem[]>([]);
  const [kotaMadrasah, setKotaMadrasah] = useState<string>("Karawang");
  const [loading, setLoading] = useState(false);
  const [loadingGuru, setLoadingGuru] = useState(false);

  // Data Kepala Madrasah
  const [kepalaMadrasah, setKepalaMadrasah] = useState<{ nama: string; nip: string }>({
    nama: "H. SUPARWOTO, M.Pd",
    nip: "197102091999031001",
  });

  useEffect(() => {
    if (user) {
      if (!canViewAll) {
        setSelectedGuru(user.nama || "ALL");
      } else {
        setSelectedGuru("ALL");
      }
    }
  }, [user, canViewAll]);

  // Load Profil Madrasah
  useEffect(() => {
    const fetchProfilMadrasah = async () => {
      if (!user?.madrasahId) return;
      try {
        const docRef = doc(db, "profilMadrasah", user.madrasahId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as ProfilMadrasahData;
          const kota = data.kabupaten || data.kota || data.kabupatenKota || data.tempat || "Karawang";
          const cleanKota = kota.replace(/^(Kabupaten|Kab\.|Kota)\s+/i, "");
          setKotaMadrasah(cleanKota);
        }
      } catch (err) {
        console.error("Gagal mengambil data profil madrasah:", err);
      }
    };

    fetchProfilMadrasah();
  }, [user?.madrasahId]);

  // Load Master Guru & Kepala Madrasah
  useEffect(() => {
    const fetchMasterGuru = async () => {
      if (!user?.madrasahId) return;

      try {
        setLoadingGuru(true);
        const qGuru = query(
          collection(db, "guru"),
          where("madrasahId", "==", user.madrasahId)
        );
        const snapGuru = await getDocs(qGuru);
        const dataGuru: GuruItem[] = snapGuru.docs.map((docItem) => {
          const d = docItem.data();
          return {
            id: docItem.id,
            nama: d.nama || d.namaLengkap || d.namaGuru || "Tanpa Nama",
            nip: d.nip || "",
            jabatan: d.jabatan || "",
            pangkatGolongan: d.pangkatGolongan || d.golongan || "",
            mapelUtama: d.mapel || d.mataPelajaran || d.mapelUtama || "",
          };
        });

        dataGuru.sort((a, b) => a.nama.localeCompare(b.nama, "id", { sensitivity: "base" }));
        setGuruList(dataGuru);

        const kepalaDoc = snapGuru.docs.find(
          (d) => d.data().jabatan === "Kepala Madrasah" || d.data().isKepala === true
        );
        if (kepalaDoc) {
          setKepalaMadrasah({
            nama: kepalaDoc.data().nama || kepalaDoc.data().namaLengkap || "H. SUPARWOTO, M.Pd",
            nip: kepalaDoc.data().nip || "197102091999031001",
          });
        }
      } catch (err) {
        console.error("Gagal memuat data master guru:", err);
      } finally {
        setLoadingGuru(false);
      }
    };

    fetchMasterGuru();
  }, [user?.madrasahId]);

  const guruSelectOptions = useMemo<SelectOption[]>(() => {
    const options = guruList.map((g) => ({
      value: g.nama,
      label: g.nama,
    }));
    return [{ value: "ALL", label: "-- Semua Guru --" }, ...options];
  }, [guruList]);

  // Load Laporan Agenda
  const fetchLaporan = async () => {
    if (!user?.madrasahId) return;

    try {
      setLoading(true);

      let q = query(
        collection(db, "agenda"),
        where("madrasahId", "==", user.madrasahId)
      );

      if (!canViewAll && user?.nama) {
        q = query(
          collection(db, "agenda"),
          where("madrasahId", "==", user.madrasahId),
          where("namaGuru", "==", user.nama)
        );
      }

      const snap = await getDocs(q);
      const allData: AgendaItem[] = snap.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as Omit<AgendaItem, "id">),
      }));

      const filtered = allData.filter((item) => {
        const matchTanggal = item.tanggal >= startDate && item.tanggal <= endDate;
        const matchGuru = selectedGuru === "ALL" || item.namaGuru === selectedGuru;
        return matchTanggal && matchGuru;
      });

      filtered.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
      setAgendaList(filtered);
    } catch (err) {
      console.error("Gagal mengambil data laporan kinerja:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLaporan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.madrasahId, user?.nama, canViewAll]);

  // Data Terpilih Guru Untuk Header LKH Cetak
  const currentGuruData = useMemo(() => {
    if (selectedGuru !== "ALL") {
      const g = guruList.find((item) => item.nama === selectedGuru);
      if (g) return g;
    }
    const session = JSON.parse(localStorage.getItem("mims_session") || "{}");
    return {
      nama: user?.nama || session.nama || "CACA SOPANDI, S.Pd",
      nip: session.username || session.nip || "198711072023211017",
      jabatan: session.jabatan || "Ahli Pertama Guru Matematika",
      pangkatGolongan: session.pangkatGolongan || session.golongan || "Penata Muda III/a",
      mapelUtama: session.mapel || "MATEMATIKA",
    };
  }, [selectedGuru, guruList, user]);

  // Hitung Span Tanggal untuk Merge Baris
  const dateSpanMap = useMemo(() => {
    const map: { [tanggal: string]: number } = {};
    agendaList.forEach((item) => {
      map[item.tanggal] = (map[item.tanggal] || 0) + 1;
    });
    return map;
  }, [agendaList]);

  // Format Bulan Laporan
  const formatBulanTahun = (dateStr: string) => {
    const date = new Date(dateStr);
    const months = [
      "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
      "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
    ];
    return `${months[date.getMonth()]} TAHUN ${date.getFullYear()}`;
  };

  // Format Tanggal Tanda Tangan Cetak
  const formatTanggalIndo = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return dateObj.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const totalAgenda = agendaList.length;
  const totalMengajar = agendaList.filter((a) => a.jenisAgenda === "Mengajar").length;
  const totalKegiatan = agendaList.filter((a) => a.jenisAgenda === "Kegiatan").length;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          @page {
            size: A4 portrait;
            margin: 1.5cm;
          }
        }
        @media screen {
          .print-only {
            display: none;
          }
        }
      `}</style>

      {/* ========================================== */}
      {/* AREA MODUL CETAK LKH HARIAN (TANPA COVER)  */}
      {/* ========================================== */}
      <div className="print-only text-black font-sans pt-2">
        {/* HEADER JUDUL & DATA DIRI GURU */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold uppercase tracking-wide">LAPORAN KINERJA HARIAN</h2>
          <h3 className="text-lg font-bold uppercase tracking-wide">
            BULAN {formatBulanTahun(startDate)}
          </h3>
        </div>

        <table className="mb-6 text-sm font-medium w-full max-w-2xl border-none">
          <tbody>
            <tr>
              <td className="w-40 py-1">Nama</td>
              <td className="w-4 py-1">:</td>
              <td className="py-1 font-semibold">{currentGuruData.nama}</td>
            </tr>
            <tr>
              <td className="py-1">NIP</td>
              <td className="py-1">:</td>
              <td className="py-1">{currentGuruData.nip || "-"}</td>
            </tr>
            <tr>
              <td className="py-1">Jabatan</td>
              <td className="py-1">:</td>
              <td className="py-1">{currentGuruData.jabatan || "-"}</td>
            </tr>
            <tr>
              <td className="py-1">Pangkat/ Golongan</td>
              <td className="py-1">:</td>
              <td className="py-1">{currentGuruData.pangkatGolongan || "-"}</td>
            </tr>
          </tbody>
        </table>

        {/* TABEL LAPORAN (ROWSPAN PADA NO & TANGGAL YANG SAMA) */}
        <table className="w-full border-collapse border border-slate-400 text-sm mb-12">
          <thead>
            <tr className="bg-slate-50 text-slate-900 border-b border-slate-400">
              <th className="border border-slate-400 p-2 w-10 text-center">No</th>
              <th className="border border-slate-400 p-2 w-32 text-left">Tanggal</th>
              <th className="border border-slate-400 p-2 w-28 text-center">Jenis</th>
              <th className="border border-slate-400 p-2 w-40 text-left">Kelas & Mapel</th>
              <th className="border border-slate-400 p-2 text-left">Materi / Detail Kegiatan</th>
            </tr>
          </thead>
          <tbody>
            {agendaList.length > 0 ? (
              (() => {
                const renderedDates: { [key: string]: boolean } = {};
                let dateIndex = 0; // Counter untuk penomoran per kelompok tanggal

                return agendaList.map((item) => {
                  const showDate = !renderedDates[item.tanggal];
                  if (showDate) {
                    renderedDates[item.tanggal] = true;
                    dateIndex += 1;
                  }
                  const rowSpan = dateSpanMap[item.tanggal] || 1;

                  return (
                    <tr key={item.id} className="border-b border-slate-400">
                      {/* ROWSPAN NO & TANGGAL SAAT PERTAMA KALI DIRENDER */}
                      {showDate && (
                        <>
                          <td
                            rowSpan={rowSpan}
                            className="border border-slate-400 p-2 text-center align-middle bg-white font-medium"
                          >
                            {dateIndex}
                          </td>
                          <td
                            rowSpan={rowSpan}
                            className="border border-slate-400 p-2 whitespace-nowrap align-middle font-medium bg-white"
                          >
                            {item.tanggal}
                          </td>
                        </>
                      )}

                      <td className="border border-slate-400 p-2 text-center align-middle">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-medium border ${
                            item.jenisAgenda === "Mengajar"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-indigo-50 text-indigo-800 border-indigo-200"
                          }`}
                        >
                          {item.jenisAgenda}
                        </span>
                      </td>
                      <td className="border border-slate-400 p-2 align-middle">
                        {item.jenisAgenda === "Mengajar" ? (
                          <div>
                            <div className="font-bold">{item.namaKelas}</div>
                            <div className="text-xs text-slate-600">{item.namaMapel}</div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="border border-slate-400 p-2 align-middle">
                        {item.jenisAgenda === "Mengajar" ? item.materi : item.catatanKegiatan}
                      </td>
                    </tr>
                  );
                });
              })()
            ) : (
              <tr>
                <td colSpan={5} className="border border-slate-400 p-4 text-center text-slate-500">
                  Tidak ada agenda harian untuk dicetak.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* LEMBAR PENGESAHAN TANDA TANGAN */}
        <div className="flex justify-between items-start text-sm px-4">
          <div className="text-center">
            <p className="mb-1">Mengetahui,</p>
            <p className="font-bold mb-16">Kepala Madrasah</p>
            <p className="font-bold underline">{kepalaMadrasah.nama}</p>
            <p className="text-xs">NIP. {kepalaMadrasah.nip}</p>
          </div>

          <div className="text-center">
            <p className="mb-1">
              {kotaMadrasah}, {formatTanggalIndo(tanggalCetak)}
            </p>
            <p className="font-bold mb-16">Guru Yang Bersangkutan</p>
            <p className="font-bold underline">{currentGuruData.nama}</p>
            <p className="text-xs">NIP. {currentGuruData.nip || "-"}</p>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* AREA LAYAR UTAMA (TAMPIL DI APLIKASI WEB)  */}
      {/* ========================================== */}
      <div className="max-w-6xl mx-auto space-y-6 no-print">
        
        {/* HEADER */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              📊 Laporan Kinerja {canViewAll ? "Guru" : "Saya"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Rekapitulasi aktivitas KBM harian dan jurnal kegiatan pendidik.
            </p>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            Kembali
          </button>
        </div>

        {/* PANEL FILTER */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="font-bold text-slate-800 text-lg">Filter Laporan Kinerja</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Mulai Tanggal
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Sampai Tanggal
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            {/* TANGGAL PENANDATANGANAN CETAK */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Tanggal Tanda Tangan Cetak
              </label>
              <input
                type="date"
                value={tanggalCetak}
                onChange={(e) => setTanggalCetak(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none bg-amber-50/50"
              />
            </div>

            {/* SEARCHABLE DROPDOWN GURU */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Pilih Guru
              </label>
              {canViewAll ? (
                <SearchableSelect
                  options={guruSelectOptions}
                  value={selectedGuru}
                  onChange={(val) => setSelectedGuru(val)}
                  placeholder="Cari / pilih guru..."
                  disabled={loadingGuru}
                  emptyMessage="Data guru tidak ditemukan"
                />
              ) : (
                <input
                  type="text"
                  value={user?.nama || "Data Guru Tidak Ditemukan"}
                  disabled
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium cursor-not-allowed"
                />
              )}
            </div>
          </div>

          <button
            onClick={fetchLaporan}
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-2.5 rounded-lg transition shadow-sm disabled:opacity-50"
          >
            {loading ? "Memuat Data..." : "Terapkan Filter"}
          </button>
        </div>

        {/* CARD RINGKASAN STATISTIK */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">Total Agenda Input</p>
              <p className="text-3xl font-extrabold text-slate-800 mt-1">{totalAgenda}</p>
            </div>
            <span className="text-3xl">📝</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">Sesi Mengajar (KBM)</p>
              <p className="text-3xl font-extrabold text-teal-600 mt-1">{totalMengajar}</p>
            </div>
            <span className="text-3xl">🏫</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">Agenda Kegiatan Lain</p>
              <p className="text-3xl font-extrabold text-indigo-600 mt-1">{totalKegiatan}</p>
            </div>
            <span className="text-3xl">📌</span>
          </div>
        </div>

        {/* TABEL REKAPITULASI AGENDA WEB */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b pb-3 border-slate-100">
            <h2 className="font-bold text-slate-800 text-lg">
              Detail Jurnal Aktivitas
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="bg-teal-700 hover:bg-teal-800 text-white text-sm px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 shadow-sm"
              >
                <span>🖨️</span> Cetak LKH (Format Resmi)
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-sm">
                  <th className="p-3 w-12 text-center">No</th>
                  <th className="p-3 w-28">Tanggal</th>
                  <th className="p-3">Nama Guru</th>
                  <th className="p-3 w-28">Jenis</th>
                  <th className="p-3">Kelas & Mapel</th>
                  <th className="p-3">Materi / Detail Kegiatan</th>
                  <th className="p-3">Catatan Kendala</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      Memuat data...
                    </td>
                  </tr>
                ) : agendaList.length > 0 ? (
                  agendaList.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 text-center text-slate-500">{idx + 1}</td>
                      <td className="p-3 font-medium text-slate-700 whitespace-nowrap">
                        {item.tanggal}
                      </td>
                      <td className="p-3 font-semibold text-slate-800">
                        {item.namaGuru}
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                            item.jenisAgenda === "Mengajar"
                              ? "bg-teal-100 text-teal-800"
                              : "bg-indigo-100 text-indigo-800"
                          }`}
                        >
                          {item.jenisAgenda}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700">
                        {item.jenisAgenda === "Mengajar" ? (
                          <>
                            <div className="font-semibold">{item.namaKelas}</div>
                            <div className="text-xs text-slate-500">{item.namaMapel}</div>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-3 text-slate-700">
                        {item.jenisAgenda === "Mengajar" ? item.materi : item.catatanKegiatan}
                      </td>
                      <td className="p-3 text-slate-500 italic">
                        {item.catatanKendala || "-"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      Tidak ada data laporan kinerja pada rentang tanggal terpilih.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}