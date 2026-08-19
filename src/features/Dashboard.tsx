import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const navigate = useNavigate();
  
  // Mengambil data sesi dan fungsi logout dari AuthContext
  const { user, logout } = useAuth();

  // Mempermudah pengecekan role
  const role = user?.role;
  const isSuperAdmin = role === "Super Admin";
  const isAdmin = role === "Admin";
  const isKepala = role === "Kepala Madrasah";
  const isWaliKelas = role === "Wali Kelas";
  const isGuru = role === "Guru";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased selection:bg-teal-500 selection:text-white">
      
      {/* NAVBAR MOBILE FRIENDLY */}
      <header className="sticky top-0 z-40 bg-teal-800/95 backdrop-blur-md text-white border-b border-teal-700/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex justify-between items-center gap-2">
          
          {/* Brand Info */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-600 border border-teal-500 flex items-center justify-center text-base sm:text-lg font-black shadow-inner flex-shrink-0">
              M
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold leading-tight tracking-tight truncate">
                MIMS (Madrasah Information Management System) <span className="text-[10px] sm:text-xs font-normal text-teal-300">v0.1</span>
              </h1>
              <p className="text-[11px] sm:text-xs text-teal-200/90 truncate">
                {isSuperAdmin ? "Sistem Pusat" : user?.namaMadrasah || "Madrasah"}
              </p>
            </div>
          </div>

          {/* User Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {!isSuperAdmin && (
              <button
                onClick={() => navigate("/profile")}
                className="inline-flex items-center gap-1.5 bg-teal-700/80 hover:bg-teal-600 text-teal-100 active:scale-95 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition border border-teal-600"
              >
                <span>👤</span>
                <span className="hidden sm:inline">Profil</span>
              </button>
            )}
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white active:scale-95 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <span>🚪</span>
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
          
        </div>
      </header>

      {/* KONTEN UTAMA */}
      <main className="flex-1 px-3 sm:px-6 py-4 sm:py-6 max-w-7xl mx-auto w-full space-y-4 sm:space-y-5">
        
        {/* WELCOME BANNER / CARD */}
        <div className="relative overflow-hidden bg-gradient-to-br from-teal-700 via-teal-800 to-slate-900 rounded-2xl p-4 sm:p-6 text-white shadow-md border border-teal-600/30">
          <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3">
            <div>
              <div className="inline-block px-2.5 py-0.5 sm:py-1 rounded-full bg-teal-500/20 text-teal-200 text-[11px] sm:text-xs font-semibold mb-1.5 sm:mb-2 border border-teal-400/20">
                {user?.role || "Pengguna"}
              </div>
              <h2 className="text-lg sm:text-2xl font-bold tracking-tight">
                Selamat Datang, {user?.nama || "Pengguna"}!
              </h2>
              <p className="text-teal-100/80 text-xs sm:text-sm mt-0.5 sm:mt-1 max-w-xl">
                Silakan pilih modul operasional di bawah ini sesuai dengan akses akun Anda.
              </p>
            </div>
          </div>
          {/* Background Decorative Element */}
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
        </div>

          {/* GRID MENU MODUL RESPONSIVE 2 KOLOM DI HP */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
          
          {/* 1. DAFTAR MADRASAH (SUPER ADMIN) */}
          {isSuperAdmin && (
            <div
              onClick={() => navigate("/master-madrasah")}
              className="group bg-white rounded-xl p-3 sm:p-5 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-teal-500/60 active:scale-[0.98] cursor-pointer transition flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 group-hover:bg-teal-600 group-hover:text-white transition">
                🏢
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-xs sm:text-base group-hover:text-teal-700 transition line-clamp-1">
                  Daftar Madrasah
                </h3>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 sm:mt-1 leading-tight sm:leading-relaxed line-clamp-2">
                  Kelola data tenant madrasah & akun operator pusat.
                </p>
              </div>
            </div>
          )}

          {/* 2. PROFIL MADRASAH / SEKOLAH */}
          {(isAdmin || isKepala) && (
            <div
              onClick={() => navigate("/profil-madrasah")}
              className="group bg-white rounded-xl p-3 sm:p-5 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-teal-500/60 active:scale-[0.98] cursor-pointer transition flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 group-hover:bg-amber-500 group-hover:text-white transition">
                🏛️
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-xs sm:text-base group-hover:text-teal-700 transition line-clamp-1">
                  Profil Madrasah/Sekolah
                </h3>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 sm:mt-1 leading-tight sm:leading-relaxed line-clamp-2">
                  Pengaturan identitas lembaga, NSM, NPSN, & logo.
                </p>
              </div>
            </div>
          )}

          {/* USER */}
          {(isAdmin || isKepala) && (
            <div 
              onClick={() => navigate("/data-user")}
              className="group bg-white rounded-xl p-3 sm:p-5 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-teal-500/60 active:scale-[0.98] cursor-pointer transition flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition">
                👤
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-xs sm:text-base group-hover:text-teal-700 transition line-clamp-1">
                  User
                </h3>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 sm:mt-1 leading-tight sm:leading-relaxed line-clamp-2">
                  Kelola akun pengguna, hak akses, dan role.
                </p>
              </div>
            </div>
          )}

          {/* GURU */}
          {(isAdmin || isKepala) && (
            <div 
              onClick={() => navigate("/data-guru")}
              className="group bg-white rounded-xl p-3 sm:p-5 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-teal-500/60 active:scale-[0.98] cursor-pointer transition flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition">
                👩‍🏫
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-xs sm:text-base group-hover:text-teal-700 transition line-clamp-1">
                  Guru
                </h3>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 sm:mt-1 leading-tight sm:leading-relaxed line-clamp-2">
                  Manajemen pendidik dan tenaga kependidikan.
                </p>
              </div>
            </div>
          )}

          {/* KELAS */}
          {(isAdmin || isKepala) && (
            <div 
              onClick={() => navigate("/data-kelas")}
              className="group bg-white rounded-xl p-3 sm:p-5 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-teal-500/60 active:scale-[0.98] cursor-pointer transition flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition">
                🏫
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-xs sm:text-base group-hover:text-teal-700 transition line-clamp-1">
                  Kelas
                </h3>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 sm:mt-1 leading-tight sm:leading-relaxed line-clamp-2">
                  Atur rombongan belajar dan wali kelas.
                </p>
              </div>
            </div>
          )}

          {/* MURID */}
          {(isAdmin || isKepala || isWaliKelas || isGuru) && (
            <div 
              onClick={() => navigate("/data-siswa")}
              className="group bg-white rounded-xl p-3 sm:p-5 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-teal-500/60 active:scale-[0.98] cursor-pointer transition flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 group-hover:bg-purple-600 group-hover:text-white transition">
                👨‍🎓
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-xs sm:text-base group-hover:text-teal-700 transition line-clamp-1">
                  Murid
                </h3>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 sm:mt-1 leading-tight sm:leading-relaxed line-clamp-2">
                  Kelola data entri peserta didik per kelas.
                </p>
              </div>
            </div>
          )}

          {/* MATA PELAJARAN */}
          {(isAdmin || isKepala) && (
            <div 
              onClick={() => navigate("/data-mapel")}
              className="group bg-white rounded-xl p-3 sm:p-5 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-teal-500/60 active:scale-[0.98] cursor-pointer transition flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 group-hover:bg-cyan-600 group-hover:text-white transition">
                📚
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-xs sm:text-base group-hover:text-teal-700 transition line-clamp-1">
                  Mata Pelajaran
                </h3>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 sm:mt-1 leading-tight sm:leading-relaxed line-clamp-2">
                  Daftar mapel sesuai kurikulum madrasah.
                </p>
              </div>
            </div>
          )}

          {/* JADWAL PELAJARAN */}
          {(isAdmin || isKepala || isWaliKelas || isGuru) && (
            <div 
              onClick={() => navigate("/jadwal")}
              className="group bg-white rounded-xl p-3 sm:p-5 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-teal-500/60 active:scale-[0.98] cursor-pointer transition flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 group-hover:bg-orange-500 group-hover:text-white transition">
                🕒
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-xs sm:text-base group-hover:text-teal-700 transition line-clamp-1">
                  Jadwal Pelajaran
                </h3>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 sm:mt-1 leading-tight sm:leading-relaxed line-clamp-2">
                  Penataan alokasi jam dan guru pengampu.
                </p>
              </div>
            </div>
          )}

          {/* ABSENSI */}
          {(isAdmin || isWaliKelas || isGuru) && (
            <div 
              onClick={() => navigate("/absensi")}
              className="group bg-white rounded-xl p-3 sm:p-5 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-teal-500/60 active:scale-[0.98] cursor-pointer transition flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 group-hover:bg-rose-600 group-hover:text-white transition">
                📅
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-xs sm:text-base group-hover:text-teal-700 transition line-clamp-1">
                  Absensi
                </h3>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 sm:mt-1 leading-tight sm:leading-relaxed line-clamp-2">
                  Pencatatan kehadiran harian siswa di kelas.
                </p>
              </div>
            </div>
          )}

          {/* NILAI */}
          {(isAdmin || isWaliKelas || isGuru) && (
            <div 
              onClick={() => navigate("/nilai")}
              className="group bg-white rounded-xl p-3 sm:p-5 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-teal-500/60 active:scale-[0.98] cursor-pointer transition flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 group-hover:bg-sky-600 group-hover:text-white transition">
                📝
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-xs sm:text-base group-hover:text-teal-700 transition line-clamp-1">
                  Nilai
                </h3>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 sm:mt-1 leading-tight sm:leading-relaxed line-clamp-2">
                  Entri nilai asesmen formatif/sumatif.
                </p>
              </div>
            </div>
          )}

          {/* AGENDA */}
          {(!isSuperAdmin) && (
            <div 
              onClick={() => navigate("/agenda")}
              className="group bg-white rounded-xl p-3 sm:p-5 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-teal-500/60 active:scale-[0.98] cursor-pointer transition flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 group-hover:bg-teal-600 group-hover:text-white transition">
                📓
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-xs sm:text-base group-hover:text-teal-700 transition line-clamp-1">
                  Agenda
                </h3>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 sm:mt-1 leading-tight sm:leading-relaxed line-clamp-2">
                  Jurnal KBM harian & catatan agenda guru.
                </p>
              </div>
            </div>
          )}

          {/* RAPOR */}
          {(isAdmin || isKepala || isWaliKelas) && (
            <div 
              onClick={() => navigate("/rapor")}
              className="group bg-white rounded-xl p-3 sm:p-5 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-teal-500/60 active:scale-[0.98] cursor-pointer transition flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 group-hover:bg-violet-600 group-hover:text-white transition">
                🖨️
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-xs sm:text-base group-hover:text-teal-700 transition line-clamp-1">
                  Rapor
                </h3>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 sm:mt-1 leading-tight sm:leading-relaxed line-clamp-2">
                  Generate dan cetak hasil belajar (rapor) siswa.
                </p>
              </div>
            </div>
          )}

          {/* TAHFIDZ */}
          {(isAdmin || isKepala || isWaliKelas || isGuru) && (
            <div 
              onClick={() => navigate("/tahfidz")}
              className="group bg-white rounded-xl p-3 sm:p-5 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-teal-500/60 active:scale-[0.98] cursor-pointer transition flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 group-hover:bg-emerald-700 group-hover:text-white transition">
                📖
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-xs sm:text-base group-hover:text-teal-700 transition line-clamp-1">
                  Tahfidz
                </h3>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 sm:mt-1 leading-tight sm:leading-relaxed line-clamp-2">
                  Input setoran ziyadah & muroja'ah hafalan.
                </p>
              </div>
            </div>
          )}

          {/* LAPORAN KINERJA */}
          {(isAdmin || isKepala || isWaliKelas || isGuru) && (
            <div 
              onClick={() => navigate("/laporan-kinerja")}
              className="group bg-white rounded-xl p-3 sm:p-5 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-teal-500/60 active:scale-[0.98] cursor-pointer transition flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-2 sm:gap-4"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 group-hover:bg-slate-700 group-hover:text-white transition">
                📊
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-xs sm:text-base group-hover:text-teal-700 transition line-clamp-1">
                  Laporan Kinerja
                </h3>
                <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5 sm:mt-1 leading-tight sm:leading-relaxed line-clamp-2">
                  Rekapitulasi aktivitas dan pantau kinerja guru.
                </p>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* FOOTER HAK CIPTA */}
      <footer className="mt-auto py-4 bg-white border-t border-slate-200 text-center text-xs text-slate-500">
        <p>© Hak Cipta CacaSpd. All rights reserved.</p>
      </footer>

    </div>
  );
}