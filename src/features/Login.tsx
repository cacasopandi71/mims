import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { authenticate } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Penanganan submit form dibuat async untuk mendukung Firestore
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsSubmitting(true);

    try {
      // PERBAIKAN: Gunakan .trim() untuk menghapus spasi yang tidak disengaja di awal/akhir input
      const cleanUsername = username.trim();
      const cleanPassword = password.trim();

      // Menunggu hasil verifikasi async dari AuthContext/Firestore
      const isSuccess = await authenticate(cleanUsername, cleanPassword);

      if (isSuccess) {
        navigate("/dashboard", { replace: true });
      } else {
        setErrorMsg("Username/NPSN/NIP atau Password salah. Silakan periksa kembali!");
      }
    } catch (err) {
      console.error("Terjadi kesalahan saat proses login:", err);
      setErrorMsg("Gagal terhubung ke server database. Periksa koneksi internet Anda.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full border border-slate-200 space-y-6">
        
        {/* LOGO & HEADER */}
        <div className="text-center">
          <div className="text-5xl mb-3">🎓</div>
          <h1 className="text-2xl font-bold text-slate-800">MIMS Multi-Tenant</h1>
          <p className="text-slate-500 text-sm mt-1">Madrasah Information Management System</p>
        </div>

        {/* PESAN ERROR AUTENTIKASI */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg text-center font-medium animate-in fade-in">
            {errorMsg}
          </div>
        )}

        {/* FORM LOGIN PROD RIIL */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Username / Email / NPSN / NIP
            </label>
            <input
              type="text"
              required
              disabled={isSubmitting}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan Email, NPSN, atau NIP"
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              disabled={isSubmitting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan Password"
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition disabled:bg-slate-100"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-bold py-3 rounded-lg transition shadow-md mt-2 flex items-center justify-center"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Memverifikasi...
              </span>
            ) : (
              "Masuk / Login"
            )}
          </button>
        </form>

        {/* INTEGRASI BANTUAN KREDENSIAL */}
        <div className="border-t border-slate-100 pt-4 text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-600 mb-1">Petunjuk Login Riil:</p>
          <p>• <strong>Guru</strong> Dapatkan akun dari Admin Madrasah</p>
          <p>• <strong>Admin Madrasah:</strong> NPSN (User & Pass Default)</p>
          <p>• <strong>Kepala Madrasah:</strong> NIP Kepala (User & Pass Default)</p>
          <p>• <strong>Jika Madrasah/Sekolah belum punya akses aplikasi ini</strong> dapat menghubungi admin wa 081221831489</p>
        </div>

      </div>
    </div>
  );
}