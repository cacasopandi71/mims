import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

// Import halaman-halaman dari folder features
import Login from "./features/Login";
import Dashboard from "./features/Dashboard";
import DaftarMadrasah from "./features/DaftarMadrasah";
import ProfilMadrasah from "./features/ProfilMadrasah";
import Profile from "./features/Profile";

// Import Modul Master Data
import Guru from "./features/Guru";
import Kelas from "./features/Kelas";
import Mapel from "./features/Mapel";
import Siswa from "./features/Siswa";
import User from "./features/User";

// Import Modul Akademik
import Absensi from "./features/Absensi";
import Jadwal from "./features/Jadwal";
import Nilai from "./features/Nilai";
import Rapor from "./features/Rapor";
import Tahfidz from "./features/Tahfidz";

// Import Modul Tambahan
import Agenda from "./features/Agenda";
import LaporanKinerja from "./features/LaporanKinerja";
import Riwayat from "./features/Riwayat";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ======================================= */}
          {/* RUTE PUBLIK                              */}
          {/* ======================================= */}
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* ======================================= */}
          {/* RUTE UMUM (Wajib Login)                  */}
          {/* ======================================= */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/riwayat" element={<Riwayat />} />
          </Route>

          {/* ======================================= */}
          {/* RUTE MANAJEMEN MADRASAH (TENANT)        */}
          {/* Ditambahkan role Admin agar dapat diakses */}
          {/* ======================================= */}
          <Route element={<ProtectedRoute allowedRoles={["Super Admin", "Admin"]} />}>
            <Route path="/master-madrasah" element={<DaftarMadrasah />} />
            <Route path="/daftar-madrasah" element={<DaftarMadrasah />} />
          </Route>

          {/* ======================================= */}
          {/* RUTE ADMIN & KEPALA MADRASAH            */}
          {/* ======================================= */}
          <Route element={<ProtectedRoute allowedRoles={["Admin", "Kepala Madrasah"]} />}>
            <Route path="/profil-madrasah" element={<ProfilMadrasah />} />
            
            {/* Master Data Utama */}
            <Route path="/data-guru" element={<Guru />} />
            <Route path="/data-kelas" element={<Kelas />} />
            <Route path="/data-mapel" element={<Mapel />} />
            <Route path="/data-user" element={<User />} />
          </Route>

          {/* ======================================= */}
          {/* RUTE AKADEMIK & OPERASIONAL             */}
          {/* ======================================= */}
          <Route element={<ProtectedRoute allowedRoles={["Admin", "Kepala Madrasah", "Wali Kelas", "Guru"]} />}>
            {/* Laporan Kinerja dipindahkan ke sini agar Guru & Wali Kelas bisa akses */}
            <Route path="/laporan-kinerja" element={<LaporanKinerja />} />
            
            <Route path="/data-siswa" element={<Siswa />} />
            <Route path="/jadwal" element={<Jadwal />} />
            <Route path="/absensi" element={<Absensi />} />
            <Route path="/nilai" element={<Nilai />} />
            <Route path="/tahfidz" element={<Tahfidz />} />
          </Route>

          {/* ======================================= */}
          {/* RUTE MANAJEMEN AKHIR SEMESTER           */}
          {/* ======================================= */}
          <Route element={<ProtectedRoute allowedRoles={["Wali Kelas", "Admin", "Kepala Madrasah"]} />}>
            <Route path="/rapor" element={<Rapor />} />
          </Route>

          {/* ======================================= */}
          {/* RUTE ERROR / CATCH-ALL                   */}
          {/* ======================================= */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}