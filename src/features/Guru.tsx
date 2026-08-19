import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getGuruList,
  addGuru,
  updateGuru,
  deleteGuru,
  type Guru,
} from "../services/guruService";
import { getMapelList, type Mapel } from "../services/mapelService";
import { addUser, syncUsersOtomatis } from "../services/userService";
import { db } from "../config/firebase";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";

interface DuplicateItem {
  newGuru: Omit<Guru, "id">;
  existingId: string;
  nama: string;
  nip: string;
}

export default function GuruPage() {
  const navigate = useNavigate();

  // Mengambil data sesi dari AuthContext
  const { user, isAdmin, isWaliKelas } = useAuth();
  const canEdit = isAdmin || isWaliKelas;

  // State Data
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [mapelList, setMapelList] = useState<Mapel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");

  // State Form Input / Edit
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nip, setNip] = useState<string>("");
  const [nama, setNama] = useState<string>("");
  const [mapel, setMapel] = useState<string>("");
  const [jabatan, setJabatan] = useState<string>("");
  const [pangkatGolongan, setPangkatGolongan] = useState<string>("");

  // State Notifikasi & Modal Data Ganda
  const [showDuplicateModal, setShowDuplicateModal] = useState<boolean>(false);
  const [duplicateList, setDuplicateList] = useState<DuplicateItem[]>([]);
  const [uniqueNewList, setUniqueNewList] = useState<Omit<Guru, "id">[]>([]);
  const [isProcessingUpload, setIsProcessingUpload] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dataGuru, dataMapel] = await Promise.all([
        getGuruList().catch(() => []),
        getMapelList().catch(() => []),
      ]);
      setGuruList(Array.isArray(dataGuru) ? dataGuru : []);
      setMapelList(Array.isArray(dataMapel) ? dataMapel : []);
    } catch (err) {
      console.error("Gagal memuat data guru/mapel:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setNip("");
    setNama("");
    setMapel("");
    setJabatan("");
    setPangkatGolongan("");
    setIsEditing(false);
    setSelectedId(null);
  };

  // Helper untuk sinkronkan perubahan data guru ke koleksi users
  const syncGuruToUserCollection = async (guruId: string, updatedData: any) => {
    try {
      let qUser = query(collection(db, "users"), where("refId", "==", guruId));
      let snapUser = await getDocs(qUser);

      if (snapUser.empty && updatedData.nip) {
        qUser = query(collection(db, "users"), where("username", "==", updatedData.nip));
        snapUser = await getDocs(qUser);
      }

      snapUser.forEach(async (uDoc) => {
        const uRef = doc(db, "users", uDoc.id);
        const payload: any = {
          nama: updatedData.nama,
          jabatan: updatedData.jabatan || "",
          pangkatGolongan: updatedData.pangkatGolongan || updatedData.golongan || "",
          golongan: updatedData.pangkatGolongan || updatedData.golongan || "",
        };
        if (updatedData.nip) {
          payload.username = updatedData.nip;
        }
        await updateDoc(uRef, payload);
      });
    } catch (err) {
      console.error("Gagal sinkronkan guru ke koleksi users:", err);
    }
  };

  // --- SUBMIT FORM MANUAL ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return alert("Anda tidak memiliki izin untuk mengubah data.");
    if (!nama.trim()) return alert("Nama Lengkap Guru wajib diisi!");

    const cleanNip = nip.trim();
    const cleanNama = nama.trim();

    const payloadGuru = {
      nip: cleanNip,
      nama: cleanNama,
      mapel,
      jabatan,
      pangkatGolongan,
      golongan: pangkatGolongan,
    };

    try {
      if (isEditing && selectedId) {
        await updateGuru(selectedId, payloadGuru);
        await syncGuruToUserCollection(selectedId, payloadGuru);
        alert("Data guru dan akun terintegrasi berhasil diperbarui!");
      } else {
        const existingGuru = guruList.find((g) => {
          const matchNip = cleanNip && g.nip && g.nip.trim() === cleanNip;
          const matchNama = g.nama.trim().toLowerCase() === cleanNama.toLowerCase();
          return matchNip || matchNama;
        });

        if (existingGuru) {
          const confirmOverwrite = window.confirm(
            `Data ganda terdeteksi!\n\nGuru "${existingGuru.nama}" (${existingGuru.nip || "Tanpa NIP"}) sudah ada di database.\n\nApakah Anda ingin menimpa / meng-update data lama tersebut?`
          );
          if (!confirmOverwrite) return;

          if (existingGuru.id) {
            await updateGuru(existingGuru.id, payloadGuru);
            await syncGuruToUserCollection(existingGuru.id, payloadGuru);
            alert("Data guru dan akun terintegrasi berhasil diperbarui!");
          }
        } else {
          await addGuru(payloadGuru);
          alert("Guru baru berhasil ditambahkan!");
        }
      }
      resetForm();
      loadData();
    } catch (err) {
      alert("Gagal menyimpan data guru.");
    }
  };

  const handleEdit = (item: Guru) => {
    if (!canEdit) return;
    setIsEditing(true);
    setSelectedId(item.id || null);
    setNip(item.nip || "");
    setNama(item.nama || "");
    setMapel(item.mapel || "");
    setJabatan(item.jabatan || "");
    setPangkatGolongan(item.pangkatGolongan || item.golongan || "");
  };

  const handleDelete = async (id?: string) => {
    if (!canEdit) return;
    if (!id) return;
    if (window.confirm("Apakah Anda yakin ingin menghapus data guru ini?")) {
      try {
        await deleteGuru(id);
        loadData();
      } catch (err) {
        alert("Gagal menghapus data guru.");
      }
    }
  };

  // --- FITUR: Auto Generate Akun User Individual ---
  const handleGenerateSingleUser = async (guru: Guru) => {
    if (!canEdit) return;

    const username =
      guru.nip && guru.nip.trim() !== ""
        ? guru.nip.trim()
        : guru.nama.toLowerCase().replace(/\s+/g, "").substring(0, 10) + "123";
    const defaultPassword = username;

    if (
      !window.confirm(
        `Generate akun user untuk ${guru.nama}?\nUsername: ${username}\nPassword Default: ${defaultPassword}`
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      await addUser({
        username,
        password: defaultPassword,
        nama: guru.nama,
        role: "Guru",
        roles: ["Guru"],
        refId: guru.id,
        status: "Aktif",
        madrasahId: user?.madrasahId || "",
        namaMadrasah: user?.namaMadrasah || "",
        isGeneratedFromGuru: true,
        hasAccount: false,
        jabatan: guru.jabatan || "Ahli Pertama Guru",
        pangkatGolongan: guru.pangkatGolongan || guru.golongan || "",
        golongan: guru.pangkatGolongan || guru.golongan || "",
      });
      alert(`Akun user untuk ${guru.nama} berhasil dibuat!\nUsername: ${username}`);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Gagal membuat akun user. Kemungkinan username sudah digunakan.");
    } finally {
      setLoading(false);
    }
  };

  // --- FITUR: Auto Generate Akun User Massal ---
  const handleGenerateAllUsers = async () => {
    if (!canEdit) return;
    if (guruList.length === 0) return alert("Tidak ada data guru untuk dibuatkan akun.");

    if (
      !window.confirm(
        `Apakah Anda yakin ingin membuatkan/menyinkronkan akun user secara otomatis untuk seluruh guru?`
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      await syncUsersOtomatis({
        madrasahId: user?.madrasahId || undefined,
        namaMadrasah: user?.namaMadrasah || undefined,
      });

      alert("Proses sinkronisasi dan pembuatan akun guru berhasil dilakukan!");
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat menyinkronkan akun user.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvHeader = "sep=,\nNIP,Nama Lengkap,Mata Pelajaran,Jabatan,Pangkat/Golongan\n";
    const csvExample1 = "198001012005011001,Budi Santoso S.Pd.,Matematika,Ahli Muda Guru,Penata / III/c\n";
    const csvExample2 = "198203152008012003,Siti Aminah M.Pd.,Bahasa Indonesia,Ahli Pertama Guru,Penata Muda / III/a\n";

    const blob = new Blob(["\uFEFF" + csvHeader + csvExample1 + csvExample2], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Template_Import_Guru.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- FITUR UPLOAD CSV DENGAN PENGECEKAN DATA GANDA ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canEdit) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && !line.startsWith("sep="));

        if (lines.length <= 1) {
          alert("File kosong atau tidak memiliki baris data (hanya header)!");
          return;
        }

        const firstLine = lines[0];
        const delimiter = firstLine.includes(";") ? ";" : ",";

        const parsedItems: Omit<Guru, "id">[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));

          if (cols.length >= 2 && cols[1]) {
            parsedItems.push({
              nip: cols[0] || "",
              nama: cols[1] || "",
              mapel: cols[2] || "",
              jabatan: cols[3] || "Ahli Pertama Guru",
              pangkatGolongan: cols[4] || "",
              golongan: cols[4] || "",
            });
          }
        }

        if (parsedItems.length === 0) {
          alert("Gagal memproses file. Pastikan format kolom sesuai dengan template.");
          return;
        }

        const duplicates: DuplicateItem[] = [];
        const uniques: Omit<Guru, "id">[] = [];

        parsedItems.forEach((item) => {
          const cleanItemNip = (item.nip || "").trim();
          const cleanItemNama = item.nama.trim().toLowerCase();

          const existing = guruList.find((g) => {
            const matchNip = cleanItemNip && g.nip && g.nip.trim() === cleanItemNip;
            const matchNama = g.nama.trim().toLowerCase() === cleanItemNama;
            return matchNip || matchNama;
          });

          if (existing && existing.id) {
            duplicates.push({
              newGuru: item,
              existingId: existing.id,
              nama: item.nama,
              nip: item.nip || "", // Menghindari TS error (ts(18048) / ts(2322))
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
          setLoading(true);
          await Promise.all(uniques.map((item) => addGuru(item)));
          alert(`Berhasil mengimpor ${uniques.length} data guru baru.`);
          loadData();
        }
      } catch (err) {
        console.error(err);
        alert("Terjadi kesalahan saat membaca atau menyimpan file import.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleConfirmOverwrite = async () => {
    try {
      setIsProcessingUpload(true);

      const createPromises = uniqueNewList.map((item) => addGuru(item));
      const updatePromises = duplicateList.map(async (item) => {
        await updateGuru(item.existingId, item.newGuru);
        await syncGuruToUserCollection(item.existingId, item.newGuru);
      });

      await Promise.all([...createPromises, ...updatePromises]);

      alert(
        `Proses Upload Selesai!\n• Data Baru Ditambahkan: ${uniqueNewList.length}\n• Data Ditimpa/Diperbarui: ${duplicateList.length}`
      );

      setShowDuplicateModal(false);
      setDuplicateList([]);
      setUniqueNewList([]);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Gagal memperbarui data ganda saat import.");
    } finally {
      setIsProcessingUpload(false);
    }
  };

  const handleCancelUpload = () => {
    setShowDuplicateModal(false);
    setDuplicateList([]);
    setUniqueNewList([]);
  };

  const safeSearch = (search || "").toLowerCase();
  const filteredGuru = guruList
    .filter((item) => {
      const safeNip = String(item.nip || "").toLowerCase();
      const safeNama = String(item.nama || "").toLowerCase();
      const safeMapel = String(item.mapel || "").toLowerCase();
      const safeJabatan = String(item.jabatan || "").toLowerCase();
      return (
        safeNip.includes(safeSearch) ||
        safeNama.includes(safeSearch) ||
        safeMapel.includes(safeSearch) ||
        safeJabatan.includes(safeSearch)
      );
    })
    .sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <nav className="bg-teal-700 p-4 text-white flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-xl font-bold">MIMS - Guru</h1>
          <p className="text-xs text-teal-100">{user?.namaMadrasah}</p>
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          className="bg-teal-800 hover:bg-teal-900 px-4 py-2 rounded-lg text-sm font-semibold transition"
        >
          Kembali ke Dashboard
        </button>
      </nav>

      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6 flex-1 w-full">
        {!canEdit && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
            <p className="text-sm text-blue-700">
              <strong>Mode Pemantauan:</strong> Anda masuk sebagai <strong>{user?.role}</strong>. Anda
              dapat melihat daftar guru, namun penambahan dan modifikasi data hanya dapat dilakukan
              oleh Admin/Wali Kelas.
            </p>
          </div>
        )}

        {canEdit && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              {isEditing ? "✏️ Edit Data Guru" : "Tambah Guru Baru"}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  NIP / NUPTK
                </label>
                <input
                  type="text"
                  placeholder="NIP / NUPTK"
                  value={nip}
                  onChange={(e) => setNip(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  placeholder="Nama Lengkap"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Mata Pelajaran
                </label>
                <input
                  type="text"
                  list="mapel-options"
                  placeholder="Pilih/Ketik Mapel"
                  value={mapel}
                  onChange={(e) => setMapel(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                />
                <datalist id="mapel-options">
                  {mapelList.map((m) => (
                    <option key={m.id || m.namaMapel} value={m.namaMapel}>
                      {m.namaMapel} {m.kodeMapel ? `(${m.kodeMapel})` : ""}
                    </option>
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Jabatan
                </label>
                <input
                  type="text"
                  placeholder="misal: Ahli Pertama Guru"
                  value={jabatan}
                  onChange={(e) => setJabatan(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Pangkat / Golongan
                </label>
                <input
                  type="text"
                  placeholder="misal: Penata Muda / III/a"
                  value={pangkatGolongan}
                  onChange={(e) => setPangkatGolongan(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 rounded-lg text-sm transition disabled:opacity-50"
                >
                  {isEditing ? "Simpan" : "Tambah"}
                </button>
                {isEditing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-semibold transition"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-lg font-bold text-slate-800">Daftar Tenaga Pendidik</h2>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <input
                type="text"
                placeholder="🔍 Cari NIP/Nama/Mapel/Jabatan"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500 w-full sm:w-56"
              />

              {canEdit && (
                <button
                  onClick={handleGenerateAllUsers}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-1 shadow-sm"
                  title="Generate Akun User untuk seluruh Guru"
                >
                  ⚡ Auto Generate Akun (Semua)
                </button>
              )}

              <button
                onClick={handleDownloadTemplate}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-1"
              >
                📥 Template CSV
              </button>

              {canEdit && (
                <label className="bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer transition flex items-center gap-1">
                  📤 Upload CSV
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={loading}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-100 text-xs font-bold text-slate-600 uppercase border-b border-slate-200">
                  <th className="p-3">NIP / NUPTK</th>
                  <th className="p-3">Nama Lengkap</th>
                  <th className="p-3">Mata Pelajaran</th>
                  <th className="p-3">Jabatan & Golongan</th>
                  {canEdit && <th className="p-3 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={canEdit ? 5 : 4} className="p-6 text-center text-slate-400">
                      Memuat / memproses data guru...
                    </td>
                  </tr>
                ) : filteredGuru.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 5 : 4} className="p-6 text-center text-slate-400 italic">
                      Tidak ada data guru yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredGuru.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono text-slate-600">{item.nip || "-"}</td>
                      <td className="p-3 font-semibold text-slate-800">{item.nama}</td>
                      <td className="p-3">
                        <span className="bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-1 rounded-md text-xs font-medium">
                          {item.mapel || "Belum diatur"}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-slate-600">
                        <div className="font-medium text-slate-800">{item.jabatan || "-"}</div>
                        <div className="text-slate-500">{item.pangkatGolongan || item.golongan || "-"}</div>
                      </td>
                      {canEdit && (
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleGenerateSingleUser(item)}
                              className="text-purple-600 hover:text-purple-800 font-semibold text-xs bg-purple-50 border border-purple-200 px-2 py-1 rounded-md transition"
                              title="Buat Akun User Guru"
                            >
                              🔑 Buat Akun
                            </button>
                            <button
                              onClick={() => handleEdit(item)}
                              className="text-blue-600 hover:text-blue-800 font-semibold text-xs"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="text-rose-600 hover:text-rose-800 font-semibold text-xs"
                            >
                              🗑️ Hapus
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL NOTIFIKASI & KONFIRMASI DATA GANDA */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-amber-600">
              <div className="p-2.5 bg-amber-100 rounded-full text-xl">⚠️</div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Data Ganda Terdeteksi!</h3>
                <p className="text-xs text-slate-500">Konfirmasi Upload Data Guru</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Ditemukan <span className="font-bold text-amber-700">{duplicateList.length} data guru</span> yang sudah terdaftar di database.
            </p>

            <div className="max-h-36 overflow-y-auto bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-1">
              <p className="font-semibold text-slate-500 mb-1">Daftar Data Sama:</p>
              {duplicateList.map((dup, idx) => (
                <div key={idx} className="truncate text-slate-700 font-medium">
                  • {dup.nama} {dup.nip ? `(NIP: ${dup.nip})` : ""}
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
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-semibold transition disabled:opacity-50"
              >
                Batal Upload
              </button>
              <button
                type="button"
                onClick={handleConfirmOverwrite}
                disabled={isProcessingUpload}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition shadow-sm disabled:opacity-50"
              >
                {isProcessingUpload ? "Memproses..." : "Ya, Timpa Data"}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-auto py-4 bg-white border-t border-slate-200 text-center text-xs text-slate-500">
        <p>© Hak Cipta CacaSpd. All rights reserved.</p>
      </footer>
    </div>
  );
}