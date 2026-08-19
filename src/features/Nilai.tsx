import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../config/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
  getDoc,
  limit,
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

// ==========================================
// INTERFACES
// ==========================================
interface KelasItem {
  id: string;
  namaKelas: string;
}

interface MapelItem {
  id: string;
  namaMapel: string;
}

interface SiswaItem {
  id: string;
  namaSiswa: string;
  nisn?: string;
}

interface NilaiEntry {
  siswaId: string;
  namaSiswa: string;
  nilai: number | "";
  existingDocId?: string;
}

interface RekapRow {
  siswaId: string;
  namaSiswa: string;
  scores: { [namaAsesmen: string]: number | "-" };
  rataRata: number | "-";
}

export default function Nilai() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Mode Tampilan
  const [activeTab, setActiveTab] = useState<"input" | "rekap">("input");

  // Master Dropdown State
  const [kelasList, setKelasList] = useState<KelasItem[]>([]);
  const [mapelList, setMapelList] = useState<MapelItem[]>([]);

  // Form Filter & Parameter
  const [selectedKelas, setSelectedKelas] = useState("");
  const [selectedMapel, setSelectedMapel] = useState("");
  const [namaAsesmen, setNamaAsesmen] = useState("Formatif 1");
  const [kkm, setKkm] = useState<number>(75);
  const [quickNilaiVal, setQuickNilaiVal] = useState<string>("");
  const [tanggal, setTanggal] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Data State
  const [nilaiList, setNilaiList] = useState<NilaiEntry[]>([]);
  const [rekapColumns, setRekapColumns] = useState<string[]>([]);
  const [rekapRows, setRekapRows] = useState<RekapRow[]>([]);

  // Parameter Pengesahan & Header Madrasah (Auto-Loaded)
  const [namaMadrasah, setNamaMadrasah] = useState("-");
  const [tempatTtd, setTempatTtd] = useState("Tangerang");
  const [namaKamad, setNamaKamad] = useState("-");
  const [nipKamad, setNipKamad] = useState("-");
  const [namaGuru, setNamaGuru] = useState("-");
  const [nipGuru, setNipGuru] = useState("-");

  // UI State
  const [loadingMaster, setLoadingMaster] = useState(true);
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [loadingRekap, setLoadingRekap] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pesan, setPesan] = useState<{ tipe: "sukses" | "error"; teks: string } | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setNilaiList([]);
    setPesan(null);
  }, [selectedKelas, selectedMapel, namaAsesmen]);

  // =========================================================
  // 1. CARI SEMUA DATA PROFILE MADRASAH & DATA GURU SECARA OTOMATIS
  // =========================================================
  useEffect(() => {
    async function fetchProfileAndUser() {
      if (!user) return;

      try {
        setLoadingMaster(true);

        // -------------------------------------------------------------
        // A. AMBIL DATA GURU & MADRASAH ID DARI FIRESTORE ('users')
        // -------------------------------------------------------------
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

        // -------------------------------------------------------------
        // B. AMBIL DATA PROFILE MADRASAH (Sesuai Koleksi 'madrasahs')
        // -------------------------------------------------------------
        let profData: any = null;

        // 1. Cari berdasarkan targetMadrasahId di koleksi 'madrasahs'
        if (targetMadrasahId) {
          const directSnap = await getDoc(doc(db, "madrasahs", targetMadrasahId));
          if (directSnap.exists()) {
            profData = directSnap.data();
          }
        }

        // 2. Fallback: Jika ID tidak cocok/kosong, ambil dokumen pertama dari 'madrasahs'
        if (!profData) {
          const snapAll = await getDocs(query(collection(db, "madrasahs"), limit(1)));
          if (!snapAll.empty) {
            profData = snapAll.docs[0].data();
          }
        }

        // -------------------------------------------------------------
        // C. MAPPING DATA KE STATE (Disesuaikan dengan Field Firestore)
        // -------------------------------------------------------------
        if (profData) {
          setNamaMadrasah(profData.nama || profData.namaMadrasah || "-");
          setTempatTtd(profData.kabKota || profData.kabupaten || profData.kota || "Tangerang");
          setNamaKamad(profData.namaKepala || profData.namaKamad || "-");
          setNipKamad(profData.nipKepala || profData.nipKamad || profData.nip || "-");
        }

        // -------------------------------------------------------------
        // D. FETCH MASTER KELAS
        // -------------------------------------------------------------
        const qKelas = targetMadrasahId
          ? query(collection(db, "kelas"), where("madrasahId", "==", targetMadrasahId))
          : query(collection(db, "kelas"));
        const snapKelas = await getDocs(qKelas);
        let dataKelas: KelasItem[] = snapKelas.docs.map((d) => ({
          id: d.id,
          namaKelas: d.data().namaKelas || d.data().nama || "Tanpa Nama",
        }));
        dataKelas = dataKelas.filter((item, index, self) =>
          index === self.findIndex((t) => t.namaKelas === item.namaKelas)
        );
        dataKelas.sort((a, b) => a.namaKelas.localeCompare(b.namaKelas, "id"));
        setKelasList(dataKelas);

        // -------------------------------------------------------------
        // E. FETCH MASTER MAPEL
        // -------------------------------------------------------------
        const qMapel = targetMadrasahId
          ? query(collection(db, "mapel"), where("madrasahId", "==", targetMadrasahId))
          : query(collection(db, "mapel"));
        const snapMapel = await getDocs(qMapel);
        let dataMapel: MapelItem[] = snapMapel.docs.map((d) => ({
          id: d.id,
          namaMapel: d.data().namaMapel || d.data().nama || "Tanpa Nama",
        }));
        dataMapel = dataMapel.filter((item, index, self) =>
          index === self.findIndex((t) => t.namaMapel === item.namaMapel)
        );
        dataMapel.sort((a, b) => a.namaMapel.localeCompare(b.namaMapel, "id"));
        setMapelList(dataMapel);

      } catch (err) {
        console.error("Gagal sinkronisasi data master dan profil:", err);
      } finally {
        setLoadingMaster(false);
      }
    }

    fetchProfileAndUser();
  }, [user]);

  // =========================================================
  // 2. LOAD SISWA & EXISTING NILAI
  // =========================================================
  const handleLoadSiswa = async () => {
    if (!selectedKelas || !selectedMapel || !namaAsesmen.trim()) {
      setPesan({
        tipe: "error",
        teks: "Lengkapi pilihan Kelas, Mata Pelajaran, dan Nama Asesmen terlebih dahulu!",
      });
      return;
    }

    setPesan(null);
    setLoadingSiswa(true);

    try {
      const qSiswa = user?.madrasahId
        ? query(collection(db, "siswa"), where("madrasahId", "==", user.madrasahId), where("kelas", "==", selectedKelas))
        : query(collection(db, "siswa"), where("kelas", "==", selectedKelas));
        
      const snapSiswa = await getDocs(qSiswa);

      if (snapSiswa.empty) {
        setPesan({ tipe: "error", teks: "Data siswa di kelas ini kosong atau tidak ditemukan." });
        setNilaiList([]);
        setLoadingSiswa(false);
        return;
      }

      const dataSiswa: SiswaItem[] = snapSiswa.docs.map((d) => ({
        id: d.id,
        namaSiswa: d.data().namaSiswa || d.data().nama || "Tanpa Nama",
        nisn: d.data().nisn || "-",
      }));

      dataSiswa.sort((a, b) => a.namaSiswa.localeCompare(b.namaSiswa, "id"));

      const qNilai = user?.madrasahId
        ? query(
            collection(db, "nilai"),
            where("madrasahId", "==", user.madrasahId),
            where("kelasId", "==", selectedKelas),
            where("mapelId", "==", selectedMapel),
            where("namaAsesmen", "==", namaAsesmen.trim())
          )
        : query(
            collection(db, "nilai"),
            where("kelasId", "==", selectedKelas),
            where("mapelId", "==", selectedMapel),
            where("namaAsesmen", "==", namaAsesmen.trim())
          );

      const snapNilai = await getDocs(qNilai);

      const existingNilaiMap = new Map<string, { docId: string; nilai: number }>();
      snapNilai.docs.forEach((d) => {
        const data = d.data();
        existingNilaiMap.set(data.siswaId, { docId: d.id, nilai: data.nilai });
      });

      const initialNilai: NilaiEntry[] = dataSiswa.map((s) => {
        const match = existingNilaiMap.get(s.id);
        return {
          siswaId: s.id,
          namaSiswa: s.namaSiswa,
          nilai: match !== undefined ? match.nilai : "",
          existingDocId: match?.docId,
        };
      });

      setNilaiList(initialNilai);
      inputRefs.current = inputRefs.current.slice(0, initialNilai.length);
    } catch (err: any) {
      console.error("Gagal memuat data siswa:", err);
      setPesan({ tipe: "error", teks: "Gagal mengambil daftar siswa dari database." });
    } finally {
      setLoadingSiswa(false);
    }
  };

  // =========================================================
  // 3. LOAD REKAPITULASI NILAI MATRIX
  // =========================================================
  const handleLoadRekap = async () => {
    if (!selectedKelas || !selectedMapel) {
      setPesan({
        tipe: "error",
        teks: "Silakan pilih Kelas dan Mata Pelajaran terlebih dahulu untuk melihat rekap!",
      });
      return;
    }

    setLoadingRekap(true);
    setPesan(null);

    try {
      const qSiswa = user?.madrasahId
        ? query(collection(db, "siswa"), where("madrasahId", "==", user.madrasahId), where("kelas", "==", selectedKelas))
        : query(collection(db, "siswa"), where("kelas", "==", selectedKelas));

      const snapSiswa = await getDocs(qSiswa);
      const dataSiswa: SiswaItem[] = snapSiswa.docs.map((d) => ({
        id: d.id,
        namaSiswa: d.data().namaSiswa || d.data().nama || "Tanpa Nama",
      }));
      dataSiswa.sort((a, b) => a.namaSiswa.localeCompare(b.namaSiswa, "id"));

      const qNilai = user?.madrasahId
        ? query(
            collection(db, "nilai"),
            where("madrasahId", "==", user.madrasahId),
            where("kelasId", "==", selectedKelas),
            where("mapelId", "==", selectedMapel)
          )
        : query(
            collection(db, "nilai"),
            where("kelasId", "==", selectedKelas),
            where("mapelId", "==", selectedMapel)
          );

      const snapNilai = await getDocs(qNilai);

      const setAsesmen = new Set<string>();
      const scoreMap = new Map<string, { [namaAsesmen: string]: number }>();

      snapNilai.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.namaAsesmen) setAsesmen.add(data.namaAsesmen);

        if (!scoreMap.has(data.siswaId)) {
          scoreMap.set(data.siswaId, {});
        }
        scoreMap.get(data.siswaId)![data.namaAsesmen] = Number(data.nilai);
      });

      const cols = Array.from(setAsesmen).sort();
      setRekapColumns(cols);

      const rows: RekapRow[] = dataSiswa.map((s) => {
        const siswaScores = scoreMap.get(s.id) || {};
        const scoresObj: { [key: string]: number | "-" } = {};
        let total = 0;
        let count = 0;

        cols.forEach((col) => {
          if (siswaScores[col] !== undefined) {
            scoresObj[col] = siswaScores[col];
            total += siswaScores[col];
            count++;
          } else {
            scoresObj[col] = "-";
          }
        });

        const rataRata = count > 0 ? Number((total / count).toFixed(1)) : "-";

        return {
          siswaId: s.id,
          namaSiswa: s.namaSiswa,
          scores: scoresObj,
          rataRata: rataRata,
        };
      });

      setRekapRows(rows);
      setActiveTab("rekap");
    } catch (err) {
      console.error("Gagal memuat rekap nilai:", err);
      setPesan({ tipe: "error", teks: "Gagal memuat data rekapitulasi nilai." });
    } finally {
      setLoadingRekap(false);
    }
  };

  // Handlers
  const handleNilaiChange = (index: number, val: string) => {
    const updated = [...nilaiList];
    if (val === "") {
      updated[index].nilai = "";
    } else {
      const num = Number(val);
      if (!isNaN(num) && num >= 0 && num <= 100) {
        updated[index].nilai = num;
      }
    }
    setNilaiList(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      if (index + 1 < nilaiList.length) {
        inputRefs.current[index + 1]?.focus();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleApplyQuickFill = (onlyEmpty: boolean = true) => {
    if (quickNilaiVal === "") return;
    const num = Number(quickNilaiVal);
    if (isNaN(num) || num < 0 || num > 100) return;

    const updated = nilaiList.map((item) => {
      if (onlyEmpty) {
        return item.nilai === "" ? { ...item, nilai: num } : item;
      }
      return { ...item, nilai: num };
    });
    setNilaiList(updated);
  };

  // Statistik
  const filledEntries = nilaiList.filter((item) => item.nilai !== "" && typeof item.nilai === "number");
  const totalNilai = filledEntries.reduce((acc, curr) => acc + (curr.nilai as number), 0);
  const rataRata = filledEntries.length > 0 ? (totalNilai / filledEntries.length).toFixed(1) : 0;
  const dibawahKKM = filledEntries.filter((item) => (item.nilai as number) < kkm).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nilaiList.length === 0) return;

    try {
      setSubmitting(true);
      setPesan(null);

      const batch = writeBatch(db);

      nilaiList.forEach((item) => {
        if (item.nilai === "") return;

        const payload = {
          madrasahId: user?.madrasahId || "",
          kelasId: selectedKelas,
          mapelId: selectedMapel,
          namaAsesmen: namaAsesmen.trim(),
          tanggal: tanggal,
          siswaId: item.siswaId,
          namaSiswa: item.namaSiswa,
          nilai: Number(item.nilai),
          updatedAt: new Date().toISOString(),
          updatedBy: (user as any)?.nama || "Sistem",
        };

        if (item.existingDocId) {
          const docRef = doc(db, "nilai", item.existingDocId);
          batch.update(docRef, payload);
        } else {
          const newDocRef = doc(collection(db, "nilai"));
          batch.set(newDocRef, payload);
        }
      });

      await batch.commit();
      setPesan({ tipe: "sukses", teks: "Berhasil menyimpan semua nilai asesmen!" });
      await handleLoadSiswa();
    } catch (err) {
      console.error("Gagal menyimpan nilai:", err);
      setPesan({ tipe: "error", teks: "Terjadi kesalahan saat menyimpan data nilai." });
    } finally {
      setSubmitting(false);
    }
  };

  const getNamaMapel = () => {
    return mapelList.find((m) => m.id === selectedMapel)?.namaMapel || selectedMapel;
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 print:bg-white print:p-0">
      <div className="max-w-6xl mx-auto space-y-6 print:max-w-none print:w-full print:space-y-4">
        
        {/* HEADER */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">📝 Modul Nilai & Rekapitulasi</h1>
            <p className="text-sm text-slate-500 mt-1">
              Input nilai harian dan cetak rekapitulasi nilai per mata pelajaran.
            </p>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            Kembali
          </button>
        </div>

        {/* ALERT */}
        {pesan && (
          <div
            className={`p-4 rounded-xl border font-medium text-sm print:hidden ${
              pesan.tipe === "sukses"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {pesan.teks}
          </div>
        )}

        {/* FILTER PARAMETER */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4 print:hidden">
          <h2 className="font-bold text-slate-800 text-lg">1. Pilih Parameter</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Kelas</label>
              <select
                value={selectedKelas}
                onChange={(e) => setSelectedKelas(e.target.value)}
                disabled={loadingMaster}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none disabled:bg-slate-100"
              >
                <option value="">-- Pilih Kelas --</option>
                {kelasList.map((k) => (
                  <option key={k.id} value={k.namaKelas}>
                    {k.namaKelas}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Mata Pelajaran</label>
              <select
                value={selectedMapel}
                onChange={(e) => setSelectedMapel(e.target.value)}
                disabled={loadingMaster}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none disabled:bg-slate-100"
              >
                <option value="">-- Pilih Mapel --</option>
                {mapelList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.namaMapel}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Asesmen</label>
              <input
                type="text"
                value={namaAsesmen}
                onChange={(e) => setNamaAsesmen(e.target.value)}
                placeholder="Contoh: Formatif 1 / UH 1"
                className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Batas KKM</label>
              <input
                type="number"
                min="0"
                max="100"
                value={kkm}
                onChange={(e) => setKkm(Number(e.target.value))}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Tanggal</label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => {
                setActiveTab("input");
                handleLoadSiswa();
              }}
              disabled={loadingSiswa}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition ${
                activeTab === "input"
                  ? "bg-teal-600 text-white shadow"
                  : "bg-slate-200 hover:bg-slate-300 text-slate-700"
              }`}
            >
              {loadingSiswa ? "Memuat..." : "✏️ Input Nilai"}
            </button>

            <button
              onClick={handleLoadRekap}
              disabled={loadingRekap}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition ${
                activeTab === "rekap"
                  ? "bg-sky-600 text-white shadow"
                  : "bg-slate-200 hover:bg-slate-300 text-slate-700"
              }`}
            >
              {loadingRekap ? "Penyusunan..." : "📊 Rekapitulasi & Cetak"}
            </button>
          </div>
        </div>

        {/* TAB 1: FORM INPUT NILAI */}
        {activeTab === "input" && nilaiList.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4 print:hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                <span className="bg-teal-100 text-teal-800 px-3 py-1.5 rounded-lg">
                  Terisi: {filledEntries.length} / {nilaiList.length}
                </span>
                <span className="bg-sky-100 text-sky-800 px-3 py-1.5 rounded-lg">
                  Rata-rata: {rataRata}
                </span>
                <span className={`px-3 py-1.5 rounded-lg ${dibawahKKM > 0 ? "bg-rose-100 text-rose-800 font-bold" : "bg-emerald-100 text-emerald-800"}`}>
                  Di Bawah KKM ({kkm}): {dibawahKKM} Siswa
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  placeholder="Nilai Batch"
                  value={quickNilaiVal}
                  onChange={(e) => setQuickNilaiVal(e.target.value)}
                  className="w-24 p-1.5 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <button
                  type="button"
                  onClick={() => handleApplyQuickFill(true)}
                  className="bg-slate-700 hover:bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded transition"
                >
                  Isi Kosong
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-16 text-center">No</th>
                      <th className="p-3">Nama Siswa</th>
                      <th className="p-3 w-40 text-center">Nilai (0-100)</th>
                      <th className="p-3 w-28 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nilaiList.map((siswa, index) => {
                      const isUnderKkm = siswa.nilai !== "" && Number(siswa.nilai) < kkm;
                      return (
                        <tr
                          key={siswa.siswaId}
                          className={`border-b border-slate-100 transition ${
                            isUnderKkm ? "bg-rose-50/50 hover:bg-rose-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="p-3 text-center font-medium">{index + 1}</td>
                          <td className="p-3 font-medium text-slate-800">{siswa.namaSiswa}</td>
                          <td className="p-3">
                            <input
                              ref={(el) => { inputRefs.current[index] = el; }}
                              type="number"
                              min="0"
                              max="100"
                              value={siswa.nilai}
                              onChange={(e) => handleNilaiChange(index, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index)}
                              className={`w-full p-2 border rounded text-center font-bold focus:ring-2 focus:ring-teal-500 focus:outline-none ${
                                isUnderKkm ? "border-rose-300 text-rose-700 bg-white" : "border-slate-300"
                              }`}
                              placeholder="0"
                            />
                          </td>
                          <td className="p-3 text-center">
                            {siswa.nilai === "" ? (
                              <span className="text-xs text-slate-400 font-medium">-</span>
                            ) : isUnderKkm ? (
                              <span className="text-xs font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded">Remedial</span>
                            ) : (
                              <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">Tuntas</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                <span className="text-xs text-slate-500">
                  💡 <b>Tips Guru:</b> Tekan <b>Enter</b> atau <b>Panah Bawah</b> untuk pindah ke baris berikutnya.
                </span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-md transition disabled:bg-slate-400 w-full sm:w-auto"
                >
                  {submitting ? "Menyimpan..." : "💾 Simpan Nilai"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: REKAPITULASI & DOKUMEN CETAK MATRIX */}
        {activeTab === "rekap" && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 space-y-6 print:shadow-none print:border-none print:p-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 print:hidden">
              <div className="space-y-1">
                <h3 className="font-bold text-slate-800 text-sm">Pengaturan Pengesahan Cetak</h3>
                <p className="text-xs text-slate-500">
                  Data otomatis terisi dari Database. Anda masih dapat mengubahnya jika diperlukan.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-sky-600 hover:bg-sky-700 text-white text-xs px-4 py-2 rounded-lg font-bold transition flex items-center gap-1.5 shadow"
                >
                  🖨️ Cetak Rekap Nilai
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs print:hidden">
              <div className="space-y-2">
                <span className="font-bold text-slate-700">Madrasah & Kota:</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={namaMadrasah}
                    onChange={(e) => setNamaMadrasah(e.target.value)}
                    placeholder="Nama Madrasah"
                    className="p-2 border rounded bg-white"
                  />
                  <input
                    type="text"
                    value={tempatTtd}
                    onChange={(e) => setTempatTtd(e.target.value)}
                    placeholder="Kota / Kabupaten"
                    className="p-2 border rounded bg-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-slate-700">Kepala Madrasah:</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={namaKamad}
                    onChange={(e) => setNamaKamad(e.target.value)}
                    placeholder="Nama Kepala"
                    className="p-2 border rounded bg-white"
                  />
                  <input
                    type="text"
                    value={nipKamad}
                    onChange={(e) => setNipKamad(e.target.value)}
                    placeholder="NIP Kepala"
                    className="p-2 border rounded bg-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-slate-700">Guru Mata Pelajaran:</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={namaGuru}
                    onChange={(e) => setNamaGuru(e.target.value)}
                    placeholder="Nama Guru"
                    className="p-2 border rounded bg-white"
                  />
                  <input
                    type="text"
                    value={nipGuru}
                    onChange={(e) => setNipGuru(e.target.value)}
                    placeholder="NIP Guru"
                    className="p-2 border rounded bg-white"
                  />
                </div>
              </div>
            </div>

            {/* AREA DOKUMEN CETAK */}
            <div className="space-y-6 text-slate-900 font-serif">
              {/* HEADER CETAK */}
              <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                <h2 className="text-xl font-bold uppercase tracking-wide">
                  REKAPITULASI NILAI ASESMEN
                </h2>
                <h3 className="text-lg font-bold uppercase">{namaMadrasah}</h3>
                <p className="text-xs font-sans text-slate-600">
                  Mata Pelajaran: <b>{getNamaMapel()}</b> | Kelas: <b>{selectedKelas}</b>
                </p>
              </div>

              {/* TABEL REKAP CETAK */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse border border-slate-900 font-sans">
                  <thead className="bg-slate-100 text-slate-900 font-bold uppercase">
                    <tr>
                      <th className="border border-slate-900 p-2 text-center w-10">No</th>
                      <th className="border border-slate-900 p-2 text-left min-w-[150px]">Nama Siswa</th>
                      {rekapColumns.map((col) => (
                        <th key={col} className="border border-slate-900 p-2 text-center">
                          {col}
                        </th>
                      ))}
                      <th className="border border-slate-900 p-2 text-center bg-slate-200 w-16">
                        Rata-Rata
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekapRows.map((row, idx) => (
                      <tr key={row.siswaId} className="hover:bg-slate-50">
                        <td className="border border-slate-900 p-2 text-center">{idx + 1}</td>
                        <td className="border border-slate-900 p-2 font-medium">{row.namaSiswa}</td>
                        {rekapColumns.map((col) => (
                          <td key={col} className="border border-slate-900 p-2 text-center">
                            {row.scores[col]}
                          </td>
                        ))}
                        <td className="border border-slate-900 p-2 text-center font-bold bg-slate-50">
                          {row.rataRata}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* TANDA TANGAN CETAK */}
              <div className="pt-8 grid grid-cols-2 text-xs font-sans break-inside-avoid">
                <div className="text-center space-y-12">
                  <div>
                    <p>Mengetahui,</p>
                    <p className="font-bold">Kepala {namaMadrasah}</p>
                  </div>
                  <div>
                    <p className="font-bold underline">{namaKamad}</p>
                    <p>NIP. {nipKamad}</p>
                  </div>
                </div>

                <div className="text-center space-y-12">
                  <div>
                    <p>{tempatTtd}, {new Date(tanggal).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    <p className="font-bold">Guru Mata Pelajaran</p>
                  </div>
                  <div>
                    <p className="font-bold underline">{namaGuru}</p>
                    <p>NIP. {nipGuru}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}