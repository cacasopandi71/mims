import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getUserList,
  addUser,
  updateUser,
  deleteUser,
  type UserItem,
} from "../services/userService";
import { db } from "../config/firebase";
import { doc, updateDoc } from "firebase/firestore";

export default function UsersPage() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");

  // Form states
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [nama, setNama] = useState<string>("");
  const [role, setRole] = useState<string>("Guru");
  const [jabatan, setJabatan] = useState<string>("");
  const [pangkatGolongan, setPangkatGolongan] = useState<string>("");
  const [refId, setRefId] = useState<string | undefined>(undefined);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getUserList();
      setUsers(data);
    } catch (err) {
      console.error("Gagal mengambil data user:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      alert("Akses ditolak. Halaman ini hanya untuk Admin.");
      navigate("/dashboard");
      return;
    }
    loadUsers();
  }, [isAdmin, navigate]);

  const resetForm = () => {
    setUsername("");
    setPassword("");
    setNama("");
    setRole("Guru");
    setJabatan("");
    setPangkatGolongan("");
    setRefId(undefined);
    setIsEditing(false);
    setSelectedId(null);
  };

  // Helper untuk memperbarui dokumen Guru jika user terhubung dengan refId
  const syncUserToGuruCollection = async (guruRefId: string, payload: any) => {
    try {
      const guruRef = doc(db, "guru", guruRefId);
      await updateDoc(guruRef, {
        nama: payload.nama,
        nip: payload.username,
        jabatan: payload.jabatan || "",
        pangkatGolongan: payload.pangkatGolongan || payload.golongan || "",
        golongan: payload.pangkatGolongan || payload.golongan || "",
      });
    } catch (err) {
      console.error("Gagal sinkronkan data ke koleksi guru:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !nama.trim()) {
      return alert("Username / NIP dan Nama Wajib diisi!");
    }

    const payload: Omit<UserItem, "id"> = {
      username: username.trim(),
      password: password || "123456",
      nama: nama.trim(),
      role: role as any,
      roles: [role],
      jabatan: jabatan.trim(),
      pangkatGolongan: pangkatGolongan.trim(),
      golongan: pangkatGolongan.trim(),
      refId: refId || "",
      status: "Aktif",
      madrasahId: user?.madrasahId || "",
      namaMadrasah: user?.namaMadrasah || "",
    };

    try {
      setLoading(true);
      if (isEditing && selectedId) {
        await updateUser(selectedId, payload);

        // Jika terhubung dengan koleksi guru, sinkronkan ke dokumen guru
        if (refId) {
          await syncUserToGuruCollection(refId, payload);
        }

        alert("Data user dan profil guru terintegrasi berhasil diperbarui!");
      } else {
        await addUser(payload);
        alert("User baru berhasil ditambahkan!");
      }
      resetForm();
      loadUsers();
    } catch (err: any) {
      alert(err?.message || "Gagal menyimpan data user.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: UserItem) => {
    setIsEditing(true);
    setSelectedId(item.id || null);
    setUsername(item.username || "");
    setPassword(item.password || "");
    setNama(item.nama || "");
    setRole(item.role || "Guru");
    setJabatan(item.jabatan || "");
    setPangkatGolongan(item.pangkatGolongan || item.golongan || "");
    setRefId(item.refId);
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (window.confirm("Apakah Anda yakin ingin menghapus user ini?")) {
      try {
        await deleteUser(id);
        loadUsers();
      } catch (err) {
        alert("Gagal menghapus user.");
      }
    }
  };

  const filteredUsers = users.filter((u) => {
    const s = search.toLowerCase();
    return (
      (u.username || "").toLowerCase().includes(s) ||
      (u.nama || "").toLowerCase().includes(s) ||
      (u.role || "").toLowerCase().includes(s) ||
      (u.jabatan || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <nav className="bg-teal-700 p-4 text-white flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-xl font-bold">MIMS - Manajemen User</h1>
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
        {/* FORM TAMBAH / EDIT USER */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-4">
            {isEditing ? "✏️ Edit User & Hak Akses" : "➕ Tambah User Baru"}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Username / NIP
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="NIP / Username"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Password
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kata Sandi"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Nama Lengkap
              </label>
              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Nama Lengkap"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Jabatan
              </label>
              <input
                type="text"
                value={jabatan}
                onChange={(e) => setJabatan(e.target.value)}
                placeholder="misal: Ahli Pertama Guru"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Pangkat / Golongan
              </label>
              <input
                type="text"
                value={pangkatGolongan}
                onChange={(e) => setPangkatGolongan(e.target.value)}
                placeholder="misal: Penata Muda / III/a"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Role System
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white"
              >
                <option value="Guru">Guru</option>
                <option value="Wali Kelas">Wali Kelas</option>
                <option value="Kepala Madrasah">Kepala Madrasah</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            <div className="md:col-span-3 lg:col-span-6 flex justify-end gap-2 pt-2">
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition"
                >
                  Batal
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
              >
                {isEditing ? "Simpan Perubahan User" : "Tambah User"}
              </button>
            </div>
          </form>
        </div>

        {/* TABEL LIST USER */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-lg font-bold text-slate-800">Daftar Pengguna Sistem</h2>
            <input
              type="text"
              placeholder="🔍 Cari User/Nama/Role/Jabatan"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500 w-full sm:w-64"
            />
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-100 text-xs font-bold text-slate-600 uppercase border-b border-slate-200">
                  <th className="p-3">Username / NIP</th>
                  <th className="p-3">Nama Lengkap</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Jabatan & Golongan</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400">
                      Memuat data user...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                      Tidak ada user ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono text-slate-600">{item.username}</td>
                      <td className="p-3 font-semibold text-slate-800">{item.nama}</td>
                      <td className="p-3">
                        <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-md text-xs font-semibold">
                          {item.role}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-slate-600">
                        <div className="font-medium text-slate-800">{item.jabatan || "-"}</div>
                        <div className="text-slate-500">{item.pangkatGolongan || item.golongan || "-"}</div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-3">
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <footer className="mt-auto py-4 bg-white border-t border-slate-200 text-center text-xs text-slate-500">
        <p>© Hak Cipta CacaSpd. All rights reserved.</p>
      </footer>
    </div>
  );
}