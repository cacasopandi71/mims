import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Memuat data...</div>;
  }

  // Jika belum login, lempar ke halaman Login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Jika halaman ini mensyaratkan role tertentu, dan role user tidak ada di daftar, kembalikan ke Dashboard
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Jika lolos semua pemeriksaan, izinkan akses ke komponen/halaman yang dituju
  return <Outlet />;
}