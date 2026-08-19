import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { db } from "../firebase"; // Pastikan path impor firebase sudah sesuai
import { collection, getDocs, query, where } from "firebase/firestore";

// Mendefinisikan tipe data untuk User berdasarkan rancangan sistem
export interface UserSession {
  uid: string;
  email: string;
  nama: string;
  username?: string;
  role: "Super Admin" | "Admin" | "Kepala Madrasah" | "Wali Kelas" | "Guru";
  madrasahId: string | null; // Super Admin = null atau 'GLOBAL'
  namaMadrasah?: string;
}

// Interface properti Context beserta fungsi Authenticate (Async)
interface AuthContextProps {
  user: UserSession | null;
  isLoading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isKepala: boolean;
  isWaliKelas: boolean;
  authenticate: (usernameInput: string, passwordInput: string) => Promise<boolean>;
  login: (userData: UserSession) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Pengecekan sesi lokal saat aplikasi dimuat
  useEffect(() => {
    const checkSession = () => {
      try {
        const sessionStr = localStorage.getItem("mims_session");
        if (sessionStr) {
          const sessionData = JSON.parse(sessionStr);
          setUser(sessionData);
        }
      } catch (error) {
        console.error("Gagal membaca sesi:", error);
        localStorage.removeItem("mims_session");
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  // 2. Fungsi Login Manual/Direct
  const login = (userData: UserSession) => {
    localStorage.setItem("mims_session", JSON.stringify(userData));
    setUser(userData);
  };

  // 3. Logika Verifikasi Otentikasi Terhubung ke Firebase Firestore (Async)
  const authenticate = async (usernameInput: string, passwordInput: string): Promise<boolean> => {
    const cleanUser = usernameInput.trim();
    const cleanPass = passwordInput.trim();

    // A. KREDENSIAL SUPER ADMIN
    if (cleanUser === "cacasopandi71@guru.smp.belajar.id" && cleanPass === "admin123") {
      const superAdminUser: UserSession = {
        uid: "SA-001",
        email: "cacasopandi71@guru.smp.belajar.id",
        nama: "Super Admin Pusat",
        username: "cacasopandi71@guru.smp.belajar.id",
        role: "Super Admin",
        madrasahId: null,
        namaMadrasah: "Sistem Pusat",
      };
      login(superAdminUser);
      return true;
    }

    // B. KREDENSIAL PENGGUNA (GURU, WALI KELAS, DLL) DARI KOLEKSI 'users'
    // Mengecek dari data modul Manajemen Pengguna
    try {
      const usersRef = collection(db, "users");
      
      // Pencarian paralel: Cek apakah input cocok dengan email ATAU nip
      const qEmail = query(usersRef, where("email", "==", cleanUser), where("password", "==", cleanPass), where("status", "==", "Aktif"));
      const qNip = query(usersRef, where("nip", "==", cleanUser), where("password", "==", cleanPass), where("status", "==", "Aktif"));

      const [snapEmail, snapNip] = await Promise.all([
        getDocs(qEmail),
        getDocs(qNip)
      ]);

      // Gabungkan hasil (kalau ada)
      const userDocs = [...snapEmail.docs, ...snapNip.docs];

      if (userDocs.length > 0) {
        const docSnap = userDocs[0];
        const userData = docSnap.data();

        const loggedInUser: UserSession = {
          uid: docSnap.id,
          email: userData.email || cleanUser,
          nama: userData.nama || "Pengguna",
          username: userData.nip || userData.email,
          role: userData.role as UserSession["role"],
          madrasahId: userData.madrasahId || null,
          namaMadrasah: userData.namaMadrasah || "",
        };

        login(loggedInUser);
        return true;
      }
    } catch (err) {
      console.error("Gagal melakukan autentikasi ke koleksi users:", err);
    }

    // C. KREDENSIAL TENANT (ADMIN & KEPALA MADRASAH DEFAULT DARI KOLEKSI 'madrasahs')
    // Ini dieksekusi jika user tidak ditemukan di koleksi 'users'
    try {
      const querySnapshot = await getDocs(collection(db, "madrasahs"));
      
      for (const docSnap of querySnapshot.docs) {
        const mdr = docSnap.data();
        const docId = docSnap.id;

        // Check Admin Madrasah (Default Username & Password = NPSN)
        if (mdr.npsn && mdr.npsn === cleanUser && cleanPass === mdr.npsn) {
          const adminUser: UserSession = {
            uid: `ADM-${mdr.npsn}`,
            email: `${mdr.npsn}@madrasah.id`,
            nama: `Admin ${mdr.nama}`,
            username: mdr.npsn,
            role: "Admin",
            madrasahId: docId,
            namaMadrasah: mdr.nama,
          };
          login(adminUser);
          return true;
        }

        // Check Kepala Madrasah (Default Username & Password = NIP)
        if (mdr.nipKepala && mdr.nipKepala === cleanUser && cleanPass === mdr.nipKepala) {
          const kepalaUser: UserSession = {
            uid: `KPL-${mdr.nipKepala}`,
            email: `${mdr.nipKepala}@madrasah.id`,
            nama: mdr.namaKepala || "Kepala Madrasah",
            username: mdr.nipKepala,
            role: "Kepala Madrasah",
            madrasahId: docId,
            namaMadrasah: mdr.nama,
          };
          login(kepalaUser);
          return true;
        }
      }
    } catch (err) {
      console.error("Gagal melakukan autentikasi dari Firestore madrasahs:", err);
    }

    return false; // Gagal jika sama sekali tidak ditemukan
  };

  // 4. Fungsi Logout
  const logout = () => {
    localStorage.removeItem("mims_session");
    setUser(null);
  };

  // Helper flags untuk kemudahan pengecekan role
  const isSuperAdmin = user?.role === "Super Admin";
  const isAdmin = user?.role === "Admin";
  const isKepala = user?.role === "Kepala Madrasah";
  const isWaliKelas = user?.role === "Wali Kelas";

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isSuperAdmin,
        isAdmin,
        isKepala,
        isWaliKelas,
        authenticate,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom Hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth harus digunakan di dalam AuthProvider");
  }
  return context;
};