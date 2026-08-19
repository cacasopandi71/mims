import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../config/firebase";
import { collection, getDocs, query, where, setDoc, doc, getDoc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

// Daftar 38 Surah dalam Juz 30
const JUZ_30_SURAHS = [
  { no: 78, nama: "An-Naba'" },
  { no: 79, nama: "An-Nazi'at" },
  { no: 80, nama: "'Abasa" },
  { no: 81, nama: "At-Takwir" },
  { no: 82, nama: "Al-Infitar" },
  { no: 83, nama: "Al-Mutaffifin" },
  { no: 84, nama: "Al-Inshiqaq" },
  { no: 85, nama: "Al-Buruj" },
  { no: 86, nama: "At-Tariq" },
  { no: 87, nama: "Al-A'la" },
  { no: 88, nama: "Al-Ghashiyah" },
  { no: 89, nama: "Al-Fajr" },
  { no: 90, nama: "Al-Balad" },
  { no: 91, nama: "Ash-Shams" },
  { no: 92, nama: "Al-Lail" },
  { no: 93, nama: "Ad-Duha" },
  { no: 94, nama: "Ash-Sharh" },
  { no: 95, nama: "At-Tin" },
  { no: 96, nama: "Al-'Alaq" },
  { no: 97, nama: "Al-Qadr" },
  { no: 98, nama: "Al-Bayyinah" },
  { no: 99, nama: "Az-Zalzalah" },
  { no: 100, nama: "Al-'Adiyat" },
  { no: 101, nama: "Al-Qari'ah" },
  { no: 102, nama: "At-Takathur" },
  { no: 103, nama: "Al-'Asr" },
  { no: 104, nama: "Al-Humazah" },
  { no: 105, nama: "Al-Fil" },
  { no: 106, nama: "Quraish" },
  { no: 107, nama: "Al-Ma'un" },
  { no: 108, nama: "Al-Kautsar" },
  { no: 109, nama: "Al-Kafirun" },
  { no: 110, nama: "An-Nasr" },
  { no: 111, nama: "Al-Lahab" },
  { no: 112, nama: "Al-Ikhlas" },
  { no: 113, nama: "Al-Falaq" },
  { no: 114, nama: "An-Nas" },
];

interface KelasItem {
  id: string;
  namaKelas: string;
  waliKelas: string;
  waliKelasId?: string;
}

interface SiswaItem {
  id: string;
  namaSiswa: string;
  nisn?: string;
}

interface DetailHafalanSurah {
  hafal: boolean;
  tanggal: string;
  nilai: "Mumtaz" | "Jayyid Jiddan" | "Jayyid" | "Maqbul";
  catatan?: string;
}

type HafalanFormState = Record<number, DetailHafalanSurah>;
type LaporanKelasMap = Record<string, HafalanFormState>;

interface PejabatInfo {
  nama: string;
  nip: string;
}

export default function Tahfidz() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"input" | "laporan">("input");
  const [kelasList, setKelasList] = useState<KelasItem[]>([]);
  const [siswaList, setSiswaList] = useState<SiswaItem[]>([]);
  const [selectedKelas, setSelectedKelas] = useState("");
  const [selectedSiswa, setSelectedSiswa] = useState("");

  const [hafalanData, setHafalanData] = useState<HafalanFormState>({});
  const [laporanKelasData, setLaporanKelasData] = useState<LaporanKelasMap>({});

  const [namaMadrasah, setNamaMadrasah] = useState<string>("");
  const [kepalaMadrasah, setKepalaMadrasah] = useState<PejabatInfo>({ nama: "-", nip: "-" });
  const [waliKelasInfo, setWaliKelasInfo] = useState<PejabatInfo>({ nama: "-", nip: "-" });
  const [kabKotaMadrasah, setKabKotaMadrasah] = useState<string>("");

  const [loadingKelas, setLoadingKelas] = useState(true);
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [loadingHafalan, setLoadingHafalan] = useState(false);
  const [loadingLaporan, setLoadingLaporan] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [pesan, setPesan] = useState<{ tipe: "sukses" | "error"; teks: string } | null>(null);
  const [pesanError, setPesanError] = useState<string | null>(null);

  // 1. Fetch Master Kelas
  useEffect(() => {
    async function fetchKelas() {
      if (!user?.madrasahId) return;
      try {
        setLoadingKelas(true);
        setPesanError(null);

        const qKelas = query(
          collection(db, "kelas"),
          where("madrasahId", "==", user.madrasahId)
        );
        const snap = await getDocs(qKelas);
        let list: KelasItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            namaKelas: data.namaKelas || data.nama || "Tanpa Nama",
            waliKelas: data.waliKelas || data.namaWaliKelas || data.namaWali || data.waliKelasNama || data.namaGuru || "",
            waliKelasId: data.waliKelasId || data.guruId || "",
          };
        });

        if (user.role === "Wali Kelas") {
          list = list.filter(
            (k) =>
              (k.waliKelasId && k.waliKelasId === user.uid) ||
              (k.waliKelas && k.waliKelas.trim().toLowerCase() === (user.nama || "").trim().toLowerCase())
          );
        }

        list.sort((a, b) => a.namaKelas.localeCompare(b.namaKelas, "id"));
        setKelasList(list);

        if (list.length === 1) {
          setSelectedKelas(list[0].id);
        }
      } catch (err) {
        console.error("Gagal memuat kelas:", err);
        setPesanError("Gagal memuat daftar kelas.");
      } finally {
        setLoadingKelas(false);
      }
    }
    fetchKelas();
  }, [user?.madrasahId, user?.role, user?.uid, user?.nama]);

  // 2. Fetch Profil Madrasah (Nama Madrasah, Kepala, & Kab/Kota)
  useEffect(() => {
    async function fetchProfilMadrasah() {
      if (!user?.madrasahId) return;
      try {
        let docRef = doc(db, "madrasahs", user.madrasahId);
        let docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          docRef = doc(db, "profil_madrasah", user.madrasahId);
          docSnap = await getDoc(docRef);
        }

        if (docSnap.exists()) {
          const d = docSnap.data();
          setNamaMadrasah(d.namaMadrasah || d.nama || d.namaSekolah || "");
          setKepalaMadrasah({
            nama: d.namaKepala || d.kepalaMadrasah || d.namaKepalaMadrasah || "-",
            nip: d.nipKepala || d.nipKepalaMadrasah || d.nip || "-",
          });
          setKabKotaMadrasah(d.kabKota || d.kabupaten || d.kota || "");
        }
      } catch (err) {
        console.error("Gagal mengambil data profil madrasah:", err);
      }
    }
    fetchProfilMadrasah();
  }, [user?.madrasahId]);

  // 3. Fetch Siswa & Wali Kelas (Case Preserved)
  useEffect(() => {
    async function fetchSiswaAndWali() {
      setSiswaList([]);
      setSelectedSiswa("");
      setWaliKelasInfo({ nama: "-", nip: "-" });

      if (!selectedKelas || !user?.madrasahId) return;

      try {
        setLoadingSiswa(true);
        setPesanError(null);
        setPesan(null);

        const targetKelas = kelasList.find((k) => k.id === selectedKelas);
        const namaKelasTarget = targetKelas?.namaKelas || "";
        const namaWaliDariKelas = targetKelas?.waliKelas?.trim() || "";

        // Fetch Siswa
        const qSiswa = query(
          collection(db, "siswa"),
          where("madrasahId", "==", user.madrasahId)
        );
        const snap = await getDocs(qSiswa);

        const listFiltered: SiswaItem[] = [];
        snap.docs.forEach((d) => {
          const data = d.data();
          const matchesKelasId = data.kelasId === selectedKelas;
          const matchesNamaKelas = data.kelas === namaKelasTarget || data.namaKelas === namaKelasTarget;

          if (matchesKelasId || matchesNamaKelas) {
            listFiltered.push({
              id: d.id,
              namaSiswa: data.namaSiswa || data.nama || "Tanpa Nama",
              nisn: data.nisn || data.nis || "-",
            });
          }
        });

        if (listFiltered.length === 0) {
          setPesanError("Data siswa di kelas ini kosong atau belum ditambahkan.");
        } else {
          listFiltered.sort((a, b) => a.namaSiswa.localeCompare(b.namaSiswa, "id"));
          setSiswaList(listFiltered);
        }

        // Cari Data Guru (Nama & NIP)
        let namaWaliFinal = namaWaliDariKelas || "-";
        let nipWaliFinal = "-";

        const qGuru = query(
          collection(db, "guru"),
          where("madrasahId", "==", user.madrasahId)
        );
        const snapGuru = await getDocs(qGuru);

        snapGuru.docs.forEach((gDoc) => {
          const gData = gDoc.data();
          const namaGuruExact = gData.namaGuru || gData.nama || gData.namaLengkap || "";
          const nipGuru = gData.nip || gData.nipGuru || "-";

          if (targetKelas?.waliKelasId && gDoc.id === targetKelas.waliKelasId) {
            if (!namaWaliFinal || namaWaliFinal === "-") namaWaliFinal = namaGuruExact;
            nipWaliFinal = nipGuru;
          }

          if (
            namaWaliDariKelas &&
            namaGuruExact &&
            namaGuruExact.trim().toLowerCase() === namaWaliDariKelas.toLowerCase()
          ) {
            namaWaliFinal = namaGuruExact;
            nipWaliFinal = nipGuru;
          }
        });

        setWaliKelasInfo({
          nama: namaWaliFinal !== "" ? namaWaliFinal : "-",
          nip: nipWaliFinal,
        });

      } catch (err: any) {
        console.error("Gagal memuat data:", err);
        setPesanError("Gagal memuat data kelas. Pastikan koneksi internet stabil.");
      } finally {
        setLoadingSiswa(false);
      }
    }
    fetchSiswaAndWali();
  }, [selectedKelas, user?.madrasahId, kelasList]);

  // 4. Fetch Master Hafalan Siswa
  useEffect(() => {
    async function fetchHafalanSiswa() {
      if (!selectedSiswa || activeTab !== "input") {
        setHafalanData({});
        return;
      }
      try {
        setLoadingHafalan(true);
        const docRef = doc(db, "tahfidz_juz30", selectedSiswa);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setHafalanData(docSnap.data().daftarSurah || {});
        } else {
          setHafalanData({});
        }
      } catch (err) {
        console.error("Gagal mengambil data hafalan:", err);
        setPesanError("Gagal memuat detail hafalan siswa.");
      } finally {
        setLoadingHafalan(false);
      }
    }
    fetchHafalanSiswa();
  }, [selectedSiswa, activeTab]);

  // 5. Fetch Laporan Hafalan Kelas
  useEffect(() => {
    async function fetchLaporanKelas() {
      if (!selectedKelas || !user?.madrasahId || activeTab !== "laporan") {
        setLaporanKelasData({});
        return;
      }
      try {
        setLoadingLaporan(true);
        setPesanError(null);

        const qHafalan = query(
          collection(db, "tahfidz_juz30"),
          where("madrasahId", "==", user.madrasahId)
        );
        const snap = await getDocs(qHafalan);
        const mapRes: LaporanKelasMap = {};

        snap.docs.forEach((d) => {
          mapRes[d.id] = d.data().daftarSurah || {};
        });

        setLaporanKelasData(mapRes);
      } catch (err: any) {
        console.error("Gagal mengambil laporan kelas:", err);
        setPesanError("Terjadi kesalahan saat memuat laporan kelas.");
      } finally {
        setLoadingLaporan(false);
      }
    }
    fetchLaporanKelas();
  }, [selectedKelas, user?.madrasahId, activeTab]);

  const handleToggleCheck = (noSurah: number) => {
    const today = new Date().toISOString().split("T")[0];
    setHafalanData((prev) => {
      const current = prev[noSurah] || { hafal: false, tanggal: today, nilai: "Mumtaz", catatan: "" };
      return {
        ...prev,
        [noSurah]: {
          ...current,
          hafal: !current.hafal,
          tanggal: current.tanggal || today,
        },
      };
    });
  };

  const handleFieldChange = <K extends keyof DetailHafalanSurah>(
    noSurah: number,
    field: K,
    value: DetailHafalanSurah[K]
  ) => {
    setHafalanData((prev) => ({
      ...prev,
      [noSurah]: {
        ...(prev[noSurah] || {
          hafal: true,
          tanggal: new Date().toISOString().split("T")[0],
          nilai: "Mumtaz",
          catatan: "",
        }),
        [field]: value,
      },
    }));
  };

  const handleSaveHafalan = async () => {
    if (!selectedSiswa) {
      setPesan({ tipe: "error", teks: "Silakan pilih siswa terlebih dahulu!" });
      return;
    }

    try {
      setSubmitting(true);
      setPesan(null);
      setPesanError(null);

      const targetSiswa = siswaList.find((s) => s.id === selectedSiswa);

      const payload = {
        madrasahId: user?.madrasahId,
        kelasId: selectedKelas,
        siswaId: selectedSiswa,
        namaSiswa: targetSiswa?.namaSiswa || "-",
        daftarSurah: hafalanData,
        updatedBy: user?.nama || "Penguji",
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "tahfidz_juz30", selectedSiswa), payload, { merge: true });
      setPesan({ tipe: "sukses", teks: `Berhasil memperbarui hafalan Juz 30 ${targetSiswa?.namaSiswa}!` });
    } catch (err) {
      console.error("Gagal menyimpan hafalan:", err);
      setPesan({ tipe: "error", teks: "Gagal menyimpan data hafalan. Pastikan koneksi internet stabil." });
    } finally {
      setSubmitting(false);
    }
  };

  const namaKelasAktif = kelasList.find((k) => k.id === selectedKelas)?.namaKelas || "";

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 print:bg-white print:p-0">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">📖 Monitoring & Laporan Tahfidz (Juz 30)</h1>
            <p className="text-sm text-slate-500 mt-1">
              Pencatatan hafalan harian dan rekapitulasi laporan per kelas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "laporan" && selectedKelas && (
              <button
                onClick={() => window.print()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-1.5"
              >
                🖨️ Cetak Laporan
              </button>
            )}
            <button
              onClick={() => navigate("/dashboard")}
              className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              Kembali
            </button>
          </div>
        </div>

        {/* TAB NAVIGASI */}
        <div className="bg-white p-2 rounded-xl border border-slate-200 flex gap-2 print:hidden">
          <button
            onClick={() => {
              setActiveTab("input");
              setPesan(null);
            }}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition ${
              activeTab === "input"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            ✏️ Input Setoran Hafalan
          </button>
          <button
            onClick={() => {
              setActiveTab("laporan");
              setPesan(null);
            }}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition ${
              activeTab === "laporan"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            📊 Laporan Tahfidz Per Kelas
          </button>
        </div>

        {/* PESAN ERROR */}
        {pesanError && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium rounded-xl print:hidden">
            {pesanError}
          </div>
        )}

        {/* PESAN SUKSES/GAGAL */}
        {pesan && (
          <div
            className={`p-4 rounded-xl border print:hidden font-medium text-sm ${
              pesan.tipe === "sukses"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {pesan.teks}
          </div>
        )}

        {/* FILTER KELAS & SISWA */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Pilih Kelas {user?.role === "Wali Kelas" && "(Kelas Ampuan Anda)"}
            </label>
            <select
              value={selectedKelas}
              onChange={(e) => {
                setSelectedKelas(e.target.value);
                setSelectedSiswa("");
              }}
              disabled={loadingKelas}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="">-- Pilih Kelas --</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>{k.namaKelas}</option>
              ))}
            </select>
          </div>

          {activeTab === "input" && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                {loadingSiswa ? "Memuat Siswa..." : "Pilih Siswa"}
              </label>
              <select
                value={selectedSiswa}
                onChange={(e) => setSelectedSiswa(e.target.value)}
                disabled={!selectedKelas || loadingSiswa || siswaList.length === 0}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">
                  {siswaList.length === 0 && selectedKelas && !loadingSiswa 
                    ? "-- Siswa Kosong --" 
                    : "-- Pilih Nama Siswa --"}
                </option>
                {siswaList.map((s) => (
                  <option key={s.id} value={s.id}>{s.namaSiswa}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* TAB 1: INPUT SETORAN HAFALAN */}
        {activeTab === "input" && (
          selectedSiswa ? (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex justify-between items-center border-b pb-4 border-slate-200">
                <div>
                  <h2 className="font-bold text-slate-800 text-lg">Checklist Surah Juz 30</h2>
                  <p className="text-xs text-slate-500">
                    Tandai surah yang telah dihafal dan diperiksa oleh pembimbing.
                  </p>
                </div>
                <button
                  onClick={handleSaveHafalan}
                  disabled={submitting || loadingHafalan}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-5 py-2.5 rounded-lg transition shadow-sm disabled:bg-slate-300"
                >
                  {submitting ? "Menyimpan..." : "Simpan Hafalan"}
                </button>
              </div>

              {loadingHafalan ? (
                <div className="p-8 text-center text-slate-400">Memuat data hafalan siswa...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-sm">
                        <th className="p-3 w-16 text-center">Status</th>
                        <th className="p-3 w-16 text-center">No</th>
                        <th className="p-3 w-48">Nama Surah</th>
                        <th className="p-3 w-36">Tanggal Setor</th>
                        <th className="p-3 w-44">Predikat Nilai</th>
                        <th className="p-3">Catatan / Evaluasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {JUZ_30_SURAHS.map((surah) => {
                        const detail = hafalanData[surah.no] || {
                          hafal: false,
                          tanggal: new Date().toISOString().split("T")[0],
                          nilai: "Mumtaz",
                          catatan: "",
                        };

                        return (
                          <tr
                            key={surah.no}
                            className={`transition ${
                              detail.hafal ? "bg-teal-50/40 hover:bg-teal-50/80" : "hover:bg-slate-50"
                            }`}
                          >
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={detail.hafal}
                                onChange={() => handleToggleCheck(surah.no)}
                                className="w-5 h-5 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                              />
                            </td>
                            <td className="p-3 text-center font-medium text-slate-500">{surah.no}</td>
                            <td className="p-3 font-semibold text-slate-800">{surah.nama}</td>
                            <td className="p-3">
                              <input
                                type="date"
                                disabled={!detail.hafal}
                                value={detail.tanggal || ""}
                                onChange={(e) => handleFieldChange(surah.no, "tanggal", e.target.value)}
                                className="w-full p-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100 disabled:text-slate-400"
                              />
                            </td>
                            <td className="p-3">
                              <select
                                disabled={!detail.hafal}
                                value={detail.nilai || "Mumtaz"}
                                onChange={(e) => handleFieldChange(surah.no, "nilai", e.target.value as DetailHafalanSurah["nilai"])}
                                className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100 disabled:text-slate-400"
                              >
                                <option value="Mumtaz">Mumtaz (Sangat Baik)</option>
                                <option value="Jayyid Jiddan">Jayyid Jiddan (Baik)</option>
                                <option value="Jayyid">Jayyid (Cukup)</option>
                                <option value="Maqbul">Maqbul (Kurang)</option>
                              </select>
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                placeholder="Catatan tajwid/makhraj..."
                                disabled={!detail.hafal}
                                value={detail.catatan || ""}
                                onChange={(e) => handleFieldChange(surah.no, "catatan", e.target.value)}
                                className="w-full p-1.5 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100 disabled:text-slate-400"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-slate-200">
                <button
                  onClick={handleSaveHafalan}
                  disabled={submitting || loadingHafalan}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-2.5 rounded-lg transition shadow-sm disabled:bg-slate-300"
                >
                  {submitting ? "Menyimpan..." : "Simpan Hafalan"}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
              <span className="text-4xl block mb-2">📋</span>
              Silakan pilih <strong className="text-slate-600">Kelas</strong> dan <strong className="text-slate-600">Nama Siswa</strong> di atas untuk menginput checklist hafalan.
            </div>
          )
        )}

        {/* TAB 2: LAPORAN TAHFIDZ PER KELAS */}
        {activeTab === "laporan" && (
          selectedKelas ? (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6 print:border-none print:p-0 print:shadow-none">
              
              {/* KOP LAPORAN PROPORSIONAL */}
              <div className="text-center border-b pb-5 border-slate-200 print:border-black space-y-1">
                <h2 className="text-lg md:text-xl font-extrabold uppercase text-slate-800 print:text-black tracking-wide">
                  LAPORAN CAPAIAN HAFALAN TAHFIDZ (JUZ 30)
                </h2>
                {namaMadrasah && (
                  <p className="text-base font-bold text-slate-700 print:text-black uppercase">
                    {namaMadrasah}
                  </p>
                )}
                <p className="text-sm font-semibold text-slate-600 print:text-black uppercase">
                  KELAS: {namaKelasAktif}
                </p>
              </div>

              {loadingLaporan || loadingSiswa ? (
                <div className="p-8 text-center text-slate-400 print:hidden">Memuat laporan kelas...</div>
              ) : siswaList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 print:hidden">
                  Tidak ada data siswa ditemukan di kelas ini.
                </div>
              ) : (
                <>
                  {/* TABEL LAPORAN */}
                  <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                      <thead>
                        <tr className="bg-slate-100 print:bg-slate-200 text-slate-800 font-bold border-b border-slate-300 text-center">
                          <th className="border border-slate-300 p-2 w-8" rowSpan={2}>No</th>
                          <th className="border border-slate-300 p-2 min-w-[160px] text-left" rowSpan={2}>Nama Siswa</th>
                          <th className="border border-slate-300 p-1" colSpan={JUZ_30_SURAHS.length}>
                            Nomor Surat Juz 30 (78 - 114)
                          </th>
                        </tr>
                        <tr className="bg-slate-50 print:bg-slate-100 text-slate-700 text-[10px] text-center">
                          {JUZ_30_SURAHS.map((surah) => (
                            <th key={surah.no} className="border border-slate-300 p-1 w-6" title={surah.nama}>
                              {surah.no}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {siswaList.map((siswa, idx) => {
                          const userHafalan = laporanKelasData[siswa.id] || {};
                          return (
                            <tr key={siswa.id} className="hover:bg-slate-50 text-center">
                              <td className="border border-slate-300 p-1 font-medium">{idx + 1}</td>
                              <td className="border border-slate-300 p-1.5 text-left font-semibold text-slate-800">
                                {siswa.namaSiswa}
                              </td>
                              {JUZ_30_SURAHS.map((surah) => {
                                const isHafal = userHafalan[surah.no]?.hafal;
                                return (
                                  <td
                                    key={surah.no}
                                    className={`border border-slate-300 p-1 ${
                                      isHafal ? "text-emerald-700 font-bold bg-emerald-50/50" : "text-slate-300"
                                    }`}
                                  >
                                    {isHafal ? "✓" : "-"}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* TANDA TANGAN */}
                  <div className="pt-8 mt-6 border-t border-slate-200 print:border-none print:mt-10">
                    <div className="grid grid-cols-2 gap-8 text-sm text-slate-800 font-medium text-center">
                      
                      {/* KEPALA MADRASAH */}
                      <div className="flex flex-col items-center justify-between h-40">
                        <div>
                          <p>Mengetahui,</p>
                          <p className="font-bold">Kepala Madrasah</p>
                        </div>
                        <div className="w-full text-center">
                          <p className="font-bold underline">{kepalaMadrasah.nama}</p>
                          <p className="text-xs text-slate-600 mt-0.5">NIP. {kepalaMadrasah.nip}</p>
                        </div>
                      </div>

                      {/* WALI KELAS */}
                      <div className="flex flex-col items-center justify-between h-40">
                        <div>
                          <p>
                            {kabKotaMadrasah ? `${kabKotaMadrasah}, ` : ""}
                            {new Date().toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                          <p className="font-bold">Wali Kelas {namaKelasAktif}</p>
                        </div>
                        <div className="w-full text-center">
                          <p className="font-bold underline">{waliKelasInfo.nama}</p>
                          <p className="text-xs text-slate-600 mt-0.5">NIP. {waliKelasInfo.nip}</p>
                        </div>
                      </div>

                    </div>
                  </div>
                </>
              )}

            </div>
          ) : (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
              <span className="text-4xl block mb-2">📊</span>
              Silakan pilih <strong className="text-slate-600">Kelas</strong> terlebih dahulu di atas untuk melihat Laporan Tahfidz Per Kelas.
            </div>
          )
        )}

      </div>
    </div>
  );
}