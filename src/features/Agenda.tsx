import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../config/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

// ==========================================
// INTERFACES & TYPES
// ==========================================
interface DropdownItem {
  id: string;
  nama: string;
}

interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface AgendaItem {
  id: string;
  madrasahId: string;
  userId?: string;
  guruId: string;
  namaGuru: string;
  tanggal: string;
  jenisAgenda: "Mengajar" | "Kegiatan";
  kelasId?: string;
  namaKelas?: string;
  mapelId?: string;
  namaMapel?: string;
  materi?: string;
  catatanKendala?: string;
  catatanKegiatan?: string;
  createdAt?: string;
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

  // Sync input pencarian dengan opsi terpilih
  useEffect(() => {
    const selectedOpt = options.find((opt) => opt.value === value);
    if (selectedOpt) {
      setSearchTerm(selectedOpt.label);
    } else {
      setSearchTerm(value || "");
    }
  }, [value, options]);

  // Event listener klik luar untuk menutup dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        const selectedOpt = options.find((opt) => opt.value === value);
        setSearchTerm(selectedOpt ? selectedOpt.label : value || "");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, options]);

  // Filter opsi secara real-time
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
            <div className="p-3 text-xs text-slate-400 text-center">
              {emptyMessage}
            </div>
          ) : (
            filteredOptions.map((opt, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectOption(opt.value, opt.label)}
                className={`p-2.5 text-sm cursor-pointer hover:bg-teal-50 hover:text-teal-900 border-b border-slate-50 last:border-none flex justify-between items-center transition ${
                  value === opt.value
                    ? "bg-teal-50 font-bold text-teal-800"
                    : "text-slate-700"
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
// UTAMA: AGENDA COMPONENT
// ==========================================
export default function Agenda() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // State Form Basics
  const [tanggal] = useState<string>(new Date().toISOString().split("T")[0]);
  const [jenisAgenda, setJenisAgenda] = useState<"Mengajar" | "Kegiatan">(
    "Mengajar"
  );

  // Data Dropdown Master
  const [kelasList, setKelasList] = useState<DropdownItem[]>([]);
  const [mapelList, setMapelList] = useState<DropdownItem[]>([]);
  const [guruList, setGuruList] = useState<DropdownItem[]>([]);

  // State Form Isian Input
  const [selectedGuru, setSelectedGuru] = useState("");
  const [selectedKelas, setSelectedKelas] = useState("");
  const [selectedMapel, setSelectedMapel] = useState("");
  const [materi, setMateri] = useState("");
  const [catatanKendala, setCatatanKendala] = useState("");
  const [catatanKegiatan, setCatatanKegiatan] = useState("");

  // State Riwayat & Modal Edit
  const [historyAgenda, setHistoryAgenda] = useState<AgendaItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<AgendaItem | null>(null);

  // Loading & Alert State
  const [loading, setLoading] = useState(false);
  const [loadingDropdown, setLoadingDropdown] = useState(true);
  const [pesan, setPesan] = useState<{
    tipe: "sukses" | "error";
    teks: string;
  } | null>(null);

  // Load Master Data (Kelas, Mapel, Guru)
  useEffect(() => {
    async function fetchMasterData() {
      if (!user?.madrasahId) return;
      try {
        setLoadingDropdown(true);

        // 1. Fetch Data Kelas dari Modul Kelas & Filter Unik
        const qKelas = query(
          collection(db, "kelas"),
          where("madrasahId", "==", user.madrasahId)
        );
        const snapKelas = await getDocs(qKelas);
        let dataKelas: DropdownItem[] = snapKelas.docs.map((doc) => ({
          id: doc.id,
          nama: doc.data().namaKelas || doc.data().nama || "Tanpa Nama",
        }));
        dataKelas = dataKelas.filter(
          (item, index, self) =>
            index === self.findIndex((t) => t.nama === item.nama)
        );
        dataKelas.sort((a, b) =>
          a.nama.localeCompare(b.nama, "id", { sensitivity: "base" })
        );
        setKelasList(dataKelas);

        // 2. Fetch Data Mapel dari Modul Mata Pelajaran & Filter Unik
        const qMapel = query(
          collection(db, "mapel"),
          where("madrasahId", "==", user.madrasahId)
        );
        const snapMapel = await getDocs(qMapel);
        let dataMapel: DropdownItem[] = snapMapel.docs.map((doc) => ({
          id: doc.id,
          nama: doc.data().namaMapel || doc.data().nama || "Tanpa Nama",
        }));
        dataMapel = dataMapel.filter(
          (item, index, self) =>
            index === self.findIndex((t) => t.nama === item.nama)
        );
        dataMapel.sort((a, b) =>
          a.nama.localeCompare(b.nama, "id", { sensitivity: "base" })
        );
        setMapelList(dataMapel);

        // 3. Fetch Data Guru dari Modul Guru & Filter Unik
        const qGuru = query(
          collection(db, "guru"),
          where("madrasahId", "==", user.madrasahId)
        );
        const snapGuru = await getDocs(qGuru);
        let dataGuru: DropdownItem[] = snapGuru.docs.map((doc) => ({
          id: doc.id,
          nama:
            doc.data().nama ||
            doc.data().namaLengkap ||
            doc.data().namaGuru ||
            "Tanpa Nama",
        }));
        dataGuru = dataGuru.filter(
          (item, index, self) =>
            index === self.findIndex((t) => t.nama === item.nama)
        );
        dataGuru.sort((a, b) =>
          a.nama.localeCompare(b.nama, "id", { sensitivity: "base" })
        );
        setGuruList(dataGuru);

        // Auto select guru login jika ada match
        const matchingGuru = dataGuru.find(
          (g) => g.nama.toLowerCase() === (user?.nama || "").toLowerCase()
        );
        if (matchingGuru) {
          setSelectedGuru(matchingGuru.id);
        }
      } catch (error) {
        console.error("Gagal memuat master data:", error);
      } finally {
        setLoadingDropdown(false);
      }
    }

    fetchMasterData();
  }, [user?.madrasahId, user?.nama]);

  // Load Riwayat Agenda
  const fetchHistory = async () => {
    if (!user?.madrasahId) return;
    try {
      setLoadingHistory(true);
      const qAgenda = query(
        collection(db, "agenda"),
        where("madrasahId", "==", user.madrasahId)
      );
      const snapAgenda = await getDocs(qAgenda);
      const listAgenda: AgendaItem[] = snapAgenda.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<AgendaItem, "id">),
      }));

      // Urutkan berdasarkan tanggal / createdAt secara descending (terbaru di atas)
      listAgenda.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.tanggal).getTime();
        const timeB = new Date(b.createdAt || b.tanggal).getTime();
        return timeB - timeA;
      });

      setHistoryAgenda(listAgenda);
    } catch (error) {
      console.error("Gagal memuat riwayat agenda:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user?.madrasahId]);

  // Format Opsi untuk SearchableSelect
  const kelasOptions = useMemo<SelectOption[]>(
    () => kelasList.map((k) => ({ value: k.id, label: k.nama })),
    [kelasList]
  );

  const mapelOptions = useMemo<SelectOption[]>(
    () => mapelList.map((m) => ({ value: m.id, label: m.nama })),
    [mapelList]
  );

  const guruOptions = useMemo<SelectOption[]>(
    () => guruList.map((g) => ({ value: g.id, label: g.nama })),
    [guruList]
  );

  // Simpan Agenda ke Firestore
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPesan(null);

    if (jenisAgenda === "Mengajar" && (!selectedKelas || !selectedMapel || !materi)) {
      setPesan({
        tipe: "error",
        teks: "Harap lengkapi Kelas, Mata Pelajaran, dan Materi!",
      });
      return;
    }

    if (jenisAgenda === "Kegiatan" && !catatanKegiatan) {
      setPesan({ tipe: "error", teks: "Harap isi Catatan Kegiatan!" });
      return;
    }

    try {
      setLoading(true);

      const namaGuruTerpilih =
        guruList.find((g) => g.id === selectedGuru)?.nama || user?.nama || "Guru";

      const payload = {
        madrasahId: user?.madrasahId,
        userId: user?.uid,
        guruId: selectedGuru || "",
        namaGuru: namaGuruTerpilih,
        tanggal: tanggal,
        jenisAgenda: jenisAgenda,
        createdAt: new Date().toISOString(),
        ...(jenisAgenda === "Mengajar"
          ? {
              kelasId: selectedKelas,
              namaKelas:
                kelasList.find((k) => k.id === selectedKelas)?.nama || "",
              mapelId: selectedMapel,
              namaMapel:
                mapelList.find((m) => m.id === selectedMapel)?.nama || "",
              materi: materi,
              catatanKendala: catatanKendala,
            }
          : {
              catatanKegiatan: catatanKegiatan,
            }),
      };

      await addDoc(collection(db, "agenda"), payload);

      setPesan({
        tipe: "sukses",
        teks: "Agenda berhasil disimpan untuk Laporan Kinerja!",
      });

      // Reset Isian Form
      setMateri("");
      setCatatanKendala("");
      setCatatanKegiatan("");

      // Refresh Riwayat
      fetchHistory();
    } catch (err: unknown) {
      console.error(err);
      setPesan({ tipe: "error", teks: "Gagal menyimpan agenda ke database." });
    } finally {
      setLoading(false);
    }
  };

  // Fungsi Hapus Agenda
  const handleDeleteAgenda = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus agenda ini?")) return;
    try {
      await deleteDoc(doc(db, "agenda", id));
      setPesan({ tipe: "sukses", teks: "Agenda berhasil dihapus." });
      fetchHistory();
    } catch (error) {
      console.error("Gagal menghapus agenda:", error);
      setPesan({ tipe: "error", teks: "Gagal menghapus agenda." });
    }
  };

  // Fungsi Simpan Perubahan Edit
  const handleUpdateAgenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgenda) return;

    try {
      setLoading(true);
      const docRef = doc(db, "agenda", editingAgenda.id);

      const namaGuruTerpilih =
        guruList.find((g) => g.id === editingAgenda.guruId)?.nama ||
        editingAgenda.namaGuru;
      const namaKelasTerpilih =
        kelasList.find((k) => k.id === editingAgenda.kelasId)?.nama ||
        editingAgenda.namaKelas;
      const namaMapelTerpilih =
        mapelList.find((m) => m.id === editingAgenda.mapelId)?.nama ||
        editingAgenda.namaMapel;

      const payload = {
        ...editingAgenda,
        namaGuru: namaGuruTerpilih,
        ...(editingAgenda.jenisAgenda === "Mengajar"
          ? {
              namaKelas: namaKelasTerpilih,
              namaMapel: namaMapelTerpilih,
            }
          : {}),
      };

      await updateDoc(docRef, payload);
      setPesan({ tipe: "sukses", teks: "Agenda berhasil diperbarui!" });
      setEditingAgenda(null);
      fetchHistory();
    } catch (error) {
      console.error("Gagal mengupdate agenda:", error);
      setPesan({ tipe: "error", teks: "Gagal memperbarui agenda." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">📓 Agenda Guru</h1>
            <p className="text-sm text-slate-500 mt-1">
              Pencatatan jurnal KBM dan aktivitas harian sebagai bahan Laporan Kinerja.
            </p>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            Kembali
          </button>
        </div>

        {/* ALERT STATUS */}
        {pesan && (
          <div
            className={`p-4 rounded-xl border ${
              pesan.tipe === "sukses"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-rose-50 border-rose-200 text-rose-700"
            }`}
          >
            {pesan.teks}
          </div>
        )}

        {/* FORM INPUT AGENDA */}
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-5"
        >
          {/* BARIS TANGGAL & GURU */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Tanggal
              </label>
              <input
                type="date"
                value={tanggal}
                disabled
                className="w-full p-2.5 bg-slate-100 border border-slate-300 rounded-lg text-slate-600 cursor-not-allowed font-medium"
              />
            </div>

            {/* SEARCHABLE DROPDOWN GURU */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Guru / Pengampu
              </label>
              <SearchableSelect
                options={guruOptions}
                value={selectedGuru}
                onChange={(val) => setSelectedGuru(val)}
                placeholder="Cari / pilih guru..."
                disabled={loadingDropdown}
                emptyMessage="Data guru tidak ditemukan"
              />
            </div>
          </div>

          {/* JENIS AGENDA */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Jenis Agenda
            </label>
            <select
              value={jenisAgenda}
              onChange={(e) =>
                setJenisAgenda(e.target.value as "Mengajar" | "Kegiatan")
              }
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="Mengajar">Agenda Mengajar (KBM)</option>
              <option value="Kegiatan">Agenda Kegiatan (Lainnya)</option>
            </select>
          </div>

          <hr className="border-slate-100" />

          {/* FORM DYNAMIC: AGENDA MENGAJAR */}
          {jenisAgenda === "Mengajar" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SEARCHABLE DROPDOWN KELAS */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Kelas <span className="text-rose-500">*</span>
                  </label>
                  <SearchableSelect
                    options={kelasOptions}
                    value={selectedKelas}
                    onChange={(val) => setSelectedKelas(val)}
                    placeholder="Cari / pilih kelas..."
                    disabled={loadingDropdown}
                    emptyMessage="Data kelas tidak ditemukan"
                  />
                </div>

                {/* SEARCHABLE DROPDOWN MAPEL */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Mata Pelajaran <span className="text-rose-500">*</span>
                  </label>
                  <SearchableSelect
                    options={mapelOptions}
                    value={selectedMapel}
                    onChange={(val) => setSelectedMapel(val)}
                    placeholder="Cari / pilih mata pelajaran..."
                    disabled={loadingDropdown}
                    emptyMessage="Data mapel tidak ditemukan"
                  />
                </div>
              </div>

              {/* MATERI / BAHASAN */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Materi / Bahasan Pembelajaran <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={materi}
                  onChange={(e) => setMateri(e.target.value)}
                  placeholder="Contoh: Pembahasan Bab 2 Teks Eksplanasi dan Latihan Soal"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              {/* CATATAN / KENDALA SISWA */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Catatan / Kendala Siswa <span className="text-xs text-slate-400">(Opsional)</span>
                </label>
                <textarea
                  rows={2}
                  value={catatanKendala}
                  onChange={(e) => setCatatanKendala(e.target.value)}
                  placeholder="Contoh: 2 siswa tidak membawa buku paket, kelas tenang dan kondusif"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* FORM DYNAMIC: AGENDA KEGIATAN */}
          {jenisAgenda === "Kegiatan" && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Catatan Kegiatan <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={catatanKegiatan}
                onChange={(e) => setCatatanKegiatan(e.target.value)}
                placeholder="Contoh: Mengikuti Rapat Koordinasi Guru dan Persiapan Penilaian Akhir Semester"
                className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          )}

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-lg font-bold transition shadow-sm disabled:bg-slate-400"
          >
            {loading ? "Menyimpan Data..." : "Simpan Agenda Hari Ini"}
          </button>
        </form>

        {/* ========================================== */}
        {/* BAGIAN RIWAYAT AGENDA GURU                */}
        {/* ========================================== */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex justify-between items-center border-b pb-3 border-slate-200">
            <h2 className="text-lg font-bold text-slate-800">📜 Riwayat Agenda Guru</h2>
            <button
              onClick={fetchHistory}
              className="text-xs text-teal-600 hover:text-teal-800 font-semibold flex items-center gap-1"
            >
              🔄 Refresh
            </button>
          </div>

          {loadingHistory ? (
            <div className="text-center py-6 text-slate-500 text-sm">
              Memuat data riwayat agenda...
            </div>
          ) : historyAgenda.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">
              Belum ada riwayat agenda yang tercatat.
            </div>
          ) : (
            <div className="space-y-3">
              {historyAgenda.map((item) => (
                <div
                  key={item.id}
                  className="p-4 border border-slate-200 rounded-lg hover:border-teal-300 transition bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                        {item.tanggal}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          item.jenisAgenda === "Mengajar"
                            ? "bg-teal-100 text-teal-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {item.jenisAgenda}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">
                        👤 {item.namaGuru}
                      </span>
                    </div>

                    {item.jenisAgenda === "Mengajar" ? (
                      <div className="text-sm text-slate-800">
                        <p className="font-semibold text-teal-900">
                          {item.namaKelas} - {item.namaMapel}
                        </p>
                        <p className="text-slate-700">
                          <span className="font-medium">Materi:</span> {item.materi}
                        </p>
                        {item.catatanKendala && (
                          <p className="text-xs text-slate-500 italic mt-0.5">
                            Kendala: {item.catatanKendala}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-800">
                        <p className="text-slate-700">{item.catatanKegiatan}</p>
                      </div>
                    )}
                  </div>

                  {/* AKSI EDIT & HAPUS */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => setEditingAgenda(item)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-md transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteAgenda(item.id)}
                      className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-md transition"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ========================================== */}
      {/* MODAL EDIT AGENDA                         */}
      {/* ========================================== */}
      {editingAgenda && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3 border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">✏️ Edit Agenda</h3>
              <button
                onClick={() => setEditingAgenda(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateAgenda} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={editingAgenda.tanggal}
                  onChange={(e) =>
                    setEditingAgenda({ ...editingAgenda, tanggal: e.target.value })
                  }
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Guru
                </label>
                <SearchableSelect
                  options={guruOptions}
                  value={editingAgenda.guruId}
                  onChange={(val) =>
                    setEditingAgenda({ ...editingAgenda, guruId: val })
                  }
                  placeholder="Pilih Guru..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jenis Agenda
                </label>
                <select
                  value={editingAgenda.jenisAgenda}
                  onChange={(e) =>
                    setEditingAgenda({
                      ...editingAgenda,
                      jenisAgenda: e.target.value as "Mengajar" | "Kegiatan",
                    })
                  }
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="Mengajar">Agenda Mengajar (KBM)</option>
                  <option value="Kegiatan">Agenda Kegiatan (Lainnya)</option>
                </select>
              </div>

              {editingAgenda.jenisAgenda === "Mengajar" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Kelas
                      </label>
                      <SearchableSelect
                        options={kelasOptions}
                        value={editingAgenda.kelasId || ""}
                        onChange={(val) =>
                          setEditingAgenda({ ...editingAgenda, kelasId: val })
                        }
                        placeholder="Pilih Kelas..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Mapel
                      </label>
                      <SearchableSelect
                        options={mapelOptions}
                        value={editingAgenda.mapelId || ""}
                        onChange={(val) =>
                          setEditingAgenda({ ...editingAgenda, mapelId: val })
                        }
                        placeholder="Pilih Mapel..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Materi
                    </label>
                    <textarea
                      rows={3}
                      value={editingAgenda.materi || ""}
                      onChange={(e) =>
                        setEditingAgenda({ ...editingAgenda, materi: e.target.value })
                      }
                      className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Catatan Kendala
                    </label>
                    <textarea
                      rows={2}
                      value={editingAgenda.catatanKendala || ""}
                      onChange={(e) =>
                        setEditingAgenda({
                          ...editingAgenda,
                          catatanKendala: e.target.value,
                        })
                      }
                      className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan Kegiatan
                  </label>
                  <textarea
                    rows={4}
                    value={editingAgenda.catatanKegiatan || ""}
                    onChange={(e) =>
                      setEditingAgenda({
                        ...editingAgenda,
                        catatanKegiatan: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingAgenda(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition"
                >
                  {loading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}