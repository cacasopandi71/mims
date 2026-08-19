import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../config/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

// ==========================================
// INTERFACES & TYPES
// ==========================================
interface KelasItem {
  id: string;
  namaKelas: string;
}

interface SiswaItem {
  id: string;
  namaSiswa: string;
  nisn?: string;
  nis?: string;
}

interface RekapNilai {
  mapelId: string;
  namaMapel: string;
  nilaiFormatif: number[];
  rataRata: number;
}

interface RekapAbsensi {
  hadir: number;
  sakit: number;
  izin: number;
  alpha: number;
}

// ==========================================
// UTAMA: COMPONENT CETAK RAPOR
// ==========================================
export default function Rapor() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // State Filter Periode
  const currentYear = new Date().getFullYear();
  const [tahunAjaran, setTahunAjaran] = useState<string>(
    `${currentYear}/${currentYear + 1}`
  );
  const [semester, setSemester] = useState<string>("Ganjil");

  // State Dropdown & Filter
  const [kelasList, setKelasList] = useState<KelasItem[]>([]);
  const [siswaList, setSiswaList] = useState<SiswaItem[]>([]);
  const [selectedKelas, setSelectedKelas] = useState("");
  const [selectedSiswa, setSelectedSiswa] = useState("");

  // State Data Rapor
  const [dataSiswaDetail, setDataSiswaDetail] = useState<SiswaItem | null>(null);
  const [nilaiRapor, setNilaiRapor] = useState<RekapNilai[]>([]);
  const [absensiRapor, setAbsensiRapor] = useState<RekapAbsensi>({
    hadir: 0,
    sakit: 0,
    izin: 0,
    alpha: 0,
  });
  const [catatanWali, setCatatanWali] = useState<string>(
    "Ananda menunjukkan perkembangan belajar yang baik. Pertahankan kedisiplinan dan tingkatkan prestasi di semester berikutnya."
  );

  // Loading & UI State
  const [loadingMaster, setLoadingMaster] = useState(true);
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [loadingRapor, setLoadingRapor] = useState(false);
  const [pesanError, setPesanError] = useState<string | null>(null);

  // 1. Fetch Master Kelas (Filter Unik & Diurutkan A-Z)
  useEffect(() => {
    async function fetchKelas() {
      if (!user?.madrasahId) return;
      try {
        setLoadingMaster(true);
        setPesanError(null);

        const qKelas = query(
          collection(db, "kelas"),
          where("madrasahId", "==", user.madrasahId)
        );
        const snap = await getDocs(qKelas);
        let list: KelasItem[] = snap.docs.map((d) => ({
          id: d.id,
          namaKelas: d.data().namaKelas || d.data().nama || "Tanpa Nama",
        }));

        // Filter duplikat berdasarkan namaKelas
        list = list.filter(
          (item, index, self) =>
            index === self.findIndex((t) => t.namaKelas === item.namaKelas)
        );

        // Urutkan Kelas A-Z
        list.sort((a, b) => a.namaKelas.localeCompare(b.namaKelas, "id"));
        setKelasList(list);
      } catch (err) {
        console.error("Gagal mengambil data kelas:", err);
        setPesanError("Gagal memuat daftar kelas.");
      } finally {
        setLoadingMaster(false);
      }
    }
    fetchKelas();
  }, [user?.madrasahId]);

  // 2. Fetch Siswa saat Kelas Dipilih
  useEffect(() => {
    async function fetchSiswa() {
      setSiswaList([]);
      setSelectedSiswa("");
      setDataSiswaDetail(null);
      setNilaiRapor([]);

      if (!selectedKelas || !user?.madrasahId) return;

      try {
        setLoadingSiswa(true);
        setPesanError(null);

        const qSiswa = query(
          collection(db, "siswa"),
          where("madrasahId", "==", user.madrasahId),
          where("kelas", "==", selectedKelas)
        );
        const snap = await getDocs(qSiswa);

        if (snap.empty) {
          setPesanError("Data siswa di kelas ini kosong atau belum ditambahkan.");
          setLoadingSiswa(false);
          return;
        }

        let list: SiswaItem[] = snap.docs.map((d) => ({
          id: d.id,
          namaSiswa: d.data().namaSiswa || d.data().nama || "Tanpa Nama",
          nisn: d.data().nisn || "-",
          nis: d.data().nis || "-",
        }));

        list = list.filter(
          (item, index, self) =>
            index === self.findIndex((t) => t.namaSiswa === item.namaSiswa)
        );

        list.sort((a, b) => a.namaSiswa.localeCompare(b.namaSiswa, "id"));
        setSiswaList(list);
      } catch (err: any) {
        console.error("Gagal mengambil data siswa:", err);
        if (err.message && err.message.includes("index")) {
          setPesanError(
            "Missing Index Firestore! Buka Console Browser (F12) dan klik link yang muncul untuk membuat index di Firebase."
          );
        } else {
          setPesanError("Gagal memuat daftar siswa. Pastikan koneksi stabil.");
        }
      } finally {
        setLoadingSiswa(false);
      }
    }
    fetchSiswa();
  }, [selectedKelas, user?.madrasahId]);

  // Reset data rapor jika pilihan siswa / periode berubah
  useEffect(() => {
    setDataSiswaDetail(null);
    setNilaiRapor([]);
  }, [selectedSiswa, semester, tahunAjaran]);

  // 3. Generate Data Rapor (Nilai + Absensi)
  const handleGenerateRapor = async () => {
    if (!selectedSiswa || !user?.madrasahId) return;

    try {
      setLoadingRapor(true);
      setPesanError(null);

      // Detail Siswa Target
      const targetSiswa = siswaList.find((s) => s.id === selectedSiswa) || null;
      setDataSiswaDetail(targetSiswa);

      // Fetch Nilai Siswa (Disaring sesuai Semester & Tahun Ajaran)
      const qNilai = query(
        collection(db, "nilai"),
        where("madrasahId", "==", user.madrasahId),
        where("siswaId", "==", selectedSiswa),
        where("semester", "==", semester),
        where("tahunAjaran", "==", tahunAjaran)
      );
      const snapNilai = await getDocs(qNilai);

      const mapelMap = new Map<
        string,
        { namaMapel: string; nilaiList: number[] }
      >();

      snapNilai.docs.forEach((d) => {
        const data = d.data();
        const mapelId = data.mapelId || data.namaMapel || "Mapel";
        const namaMapel = data.namaMapel || data.mapel || "Mata Pelajaran";
        const val = Number(data.nilai) || 0;

        if (!mapelMap.has(mapelId)) {
          mapelMap.set(mapelId, { namaMapel, nilaiList: [val] });
        } else {
          mapelMap.get(mapelId)?.nilaiList.push(val);
        }
      });

      const rekapNilaiList: RekapNilai[] = Array.from(mapelMap.entries()).map(
        ([mapelId, item]) => {
          const total = item.nilaiList.reduce((acc, curr) => acc + curr, 0);
          const avg =
            item.nilaiList.length > 0 ? total / item.nilaiList.length : 0;
          return {
            mapelId,
            namaMapel: item.namaMapel,
            nilaiFormatif: item.nilaiList,
            // Pembulatan ke 2 desimal
            rataRata: Math.round(avg * 100) / 100,
          };
        }
      );

      rekapNilaiList.sort((a, b) => a.namaMapel.localeCompare(b.namaMapel, "id"));
      setNilaiRapor(rekapNilaiList);

      // Fetch Absensi Siswa
      const qAbsensi = query(
        collection(db, "absensi"),
        where("madrasahId", "==", user.madrasahId),
        where("siswaId", "==", selectedSiswa),
        where("semester", "==", semester),
        where("tahunAjaran", "==", tahunAjaran)
      );
      const snapAbsensi = await getDocs(qAbsensi);

      let hadir = 0,
        sakit = 0,
        izin = 0,
        alpha = 0;

      snapAbsensi.docs.forEach((d) => {
        const st = d.data().status;
        if (st === "Hadir") hadir++;
        else if (st === "Sakit") sakit++;
        else if (st === "Izin") izin++;
        else if (st === "Alpha") alpha++;
      });

      setAbsensiRapor({ hadir, sakit, izin, alpha });
    } catch (err: any) {
      console.error("Gagal generate rapor:", err);
      if (err.message && err.message.includes("index")) {
        setPesanError(
          "Gagal memproses rapor (Missing Index). Buka Console Browser (F12) untuk melihat link pembuatan Index."
        );
      } else {
        setPesanError("Terjadi kesalahan saat memproses data rapor.");
      }
    } finally {
      setLoadingRapor(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 print:bg-white print:p-0">
      {/* STYLE CSS KHUSUS PRINT */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm 15mm;
          }
          body {
            background-color: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="max-w-4xl mx-auto space-y-6 print:max-w-none print:w-full print:space-y-4">
        {/* HEADER (Sembunyi saat dicetak) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">🖨️ Cetak Rapor Siswa</h1>
            <p className="text-sm text-slate-500 mt-1">
              Rekapitulasi otomatis nilai asesmen dan tingkat kehadiran siswa.
            </p>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            Kembali
          </button>
        </div>

        {/* PESAN ERROR */}
        {pesanError && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium rounded-xl print:hidden">
            {pesanError}
          </div>
        )}

        {/* PANEL FILTER (Sembunyi saat dicetak) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4 print:hidden">
          <h2 className="font-bold text-slate-800 text-lg">Parameter Filter Rapor</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* TAHUN AJARAN */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Tahun Ajaran
              </label>
              <select
                value={tahunAjaran}
                onChange={(e) => setTahunAjaran(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                <option value={`${currentYear - 1}/${currentYear}`}>
                  {currentYear - 1}/{currentYear}
                </option>
                <option value={`${currentYear}/${currentYear + 1}`}>
                  {currentYear}/{currentYear + 1}
                </option>
                <option value={`${currentYear + 1}/${currentYear + 2}`}>
                  {currentYear + 1}/{currentYear + 2}
                </option>
              </select>
            </div>

            {/* SEMESTER */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Semester
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
            </div>

            {/* KELAS */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Kelas
              </label>
              <select
                value={selectedKelas}
                onChange={(e) => setSelectedKelas(e.target.value)}
                disabled={loadingMaster}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none disabled:bg-slate-50"
              >
                <option value="">-- Pilih Kelas --</option>
                {kelasList.map((k) => (
                  <option key={k.id} value={k.namaKelas}>
                    {k.namaKelas}
                  </option>
                ))}
              </select>
            </div>

            {/* SISWA */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                {loadingSiswa ? "Memuat Siswa..." : "Nama Siswa"}
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
                    : "-- Pilih Siswa --"}
                </option>
                {siswaList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.namaSiswa}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerateRapor}
            disabled={!selectedSiswa || loadingRapor}
            className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-2.5 rounded-lg transition shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {loadingRapor ? "Memproses Data..." : "Tampilkan Rapor"}
          </button>
        </div>

        {/* TAMPILAN LEMBAR RAPOR */}
        {dataSiswaDetail && (
          <div className="bg-white p-8 rounded-xl shadow-md border border-slate-200 space-y-6 print:shadow-none print:border-none print:p-0 print:m-0 print:space-y-4">
            
            {/* ACTION BAR (Sembunyi saat dicetak) */}
            <div className="flex justify-between items-center border-b pb-4 print:hidden">
              <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-3 py-1 rounded-full">
                Pratinjau Cetak
              </span>
              <button
                onClick={() => window.print()}
                className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-sm transition"
              >
                🖨️ Cetak / Download PDF
              </button>
            </div>

            {/* KOP RAPOR */}
            <div className="text-center border-b-2 border-slate-900 pb-4 relative flex items-center justify-center">
              <div>
                <h2 className="text-xl font-bold uppercase text-slate-900 tracking-wide">
                  LAPORAN HASIL BELAJAR SISWA (RAPOR)
                </h2>
                <p className="text-base font-semibold text-slate-800 mt-1">
                  {user?.namaMadrasah || "MADRASAH ALIYAH / TSANAWIYAH"}
                </p>
              </div>
            </div>

            {/* BIODATA SISWA */}
            <div className="grid grid-cols-2 gap-4 text-sm text-slate-800 font-medium">
              <div className="space-y-1">
                <p><span className="text-slate-500">Nama Siswa:</span> <strong className="text-slate-900">{dataSiswaDetail.namaSiswa}</strong></p>
                <p><span className="text-slate-500">NIS / NISN:</span> {dataSiswaDetail.nis} / {dataSiswaDetail.nisn}</p>
              </div>
              <div className="text-right space-y-1">
                <p><span className="text-slate-500">Kelas:</span> {selectedKelas}</p>
                <p><span className="text-slate-500">Semester / TA:</span> {semester} ({tahunAjaran})</p>
              </div>
            </div>

            {/* TABEL NILAI CAPAIAN */}
            <div className="space-y-2">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                A. Capaian Asesmen Akademik
              </h3>
              <table className="w-full text-left border-collapse border border-slate-400 text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-400">
                    <th className="border border-slate-400 p-2 text-center w-12">No</th>
                    <th className="border border-slate-400 p-2">Mata Pelajaran</th>
                    <th className="border border-slate-400 p-2 text-center w-32">Rata-rata Nilai</th>
                    <th className="border border-slate-400 p-2 text-center w-36">Predikat / Kategori</th>
                  </tr>
                </thead>
                <tbody>
                  {nilaiRapor.length > 0 ? (
                    nilaiRapor.map((item, idx) => (
                      <tr key={item.mapelId} className="border-b border-slate-300">
                        <td className="border border-slate-400 p-2 text-center">{idx + 1}</td>
                        <td className="border border-slate-400 p-2 font-medium">{item.namaMapel}</td>
                        <td className="border border-slate-400 p-2 text-center font-bold text-slate-900">
                          {item.rataRata.toFixed(2)}
                        </td>
                        <td className="border border-slate-400 p-2 text-center font-medium">
                          {item.rataRata >= 85
                            ? "Sangat Baik"
                            : item.rataRata >= 75
                            ? "Baik"
                            : item.rataRata >= 60
                            ? "Cukup"
                            : "Perlu Bimbingan"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                        Belum ada data nilai pada semester dan tahun ajaran ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* TABEL ABSENSI */}
            <div className="space-y-2">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                B. Kehadiran / Absensi
              </h3>
              <table className="w-72 text-left border-collapse border border-slate-400 text-sm">
                <tbody>
                  <tr className="border-b border-slate-300">
                    <td className="border border-slate-400 p-2 font-medium">Sakit</td>
                    <td className="border border-slate-400 p-2 text-center font-bold">{absensiRapor.sakit} Hari</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="border border-slate-400 p-2 font-medium">Izin</td>
                    <td className="border border-slate-400 p-2 text-center font-bold">{absensiRapor.izin} Hari</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-400 p-2 font-medium">Tanpa Keterangan (Alpha)</td>
                    <td className="border border-slate-400 p-2 text-center font-bold">{absensiRapor.alpha} Hari</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* CATATAN WALI KELAS */}
            <div className="space-y-2">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                C. Catatan Wali Kelas
              </h3>
              <div className="p-3 border border-slate-400 rounded-lg bg-slate-50 print:bg-white text-sm text-slate-800">
                <textarea
                  value={catatanWali}
                  onChange={(e) => setCatatanWali(e.target.value)}
                  className="w-full bg-transparent border-none focus:outline-none resize-none print:hidden"
                  rows={2}
                />
                <p className="hidden print:block whitespace-pre-wrap">{catatanWali}</p>
              </div>
            </div>

            {/* TANDA TANGAN */}
            <div className="pt-8 grid grid-cols-2 text-center text-sm font-medium text-slate-900 break-inside-avoid">
              <div>
                <p>Orang Tua / Wali Siswa</p>
                <div className="h-20"></div>
                <p className="underline font-bold">( ........................................ )</p>
              </div>
              <div>
                <p>Wali Kelas / Kepala Madrasah</p>
                <div className="h-20"></div>
                <p className="underline font-bold">{user?.nama || "Wali Kelas"}</p>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}