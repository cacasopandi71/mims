import { db } from "../config/firebase";
import { collection, getDocs, doc, setDoc, addDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { getGuruList } from "./guruService";
import { getKelasList } from "./kelasService";

export interface User {
  id?: string;
  username: string;
  nama: string;
  email?: string;
  password?: string;
  roles?: string[];
  role?: string;
  refId?: string; // Menyimpan ID dokumen Guru aslinya
  madrasahId?: string;
  namaMadrasah?: string;
  status?: string;
  jabatan?: string;
  pangkatGolongan?: string;
  golongan?: string;
  isGeneratedFromGuru?: boolean;
  hasAccount?: boolean;
}

// Alias untuk menghindari error impor 'UserItem' di User.tsx
export type UserItem = User;

export interface AddUserData {
  username: string;
  password?: string;
  nama: string;
  email?: string;
  role?: string;
  roles?: string[];
  madrasahId?: string;
  namaMadrasah?: string;
  refId?: string;
  status?: string;
  jabatan?: string;
  pangkatGolongan?: string;
  golongan?: string;
  isGeneratedFromGuru?: boolean;
  hasAccount?: boolean;
}

const userCollectionRef = collection(db, "users");

// 1. Ambil Data Semua User
export const getUserList = async (): Promise<User[]> => {
  try {
    const data = await getDocs(userCollectionRef);
    return data.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as User[];
  } catch (error) {
    console.error("Error in getUserList:", error);
    return [];
  }
};

// 2. Tambah User Baru (Manual / Dipanggil dari Guru.tsx)
export const addUser = async (userData: AddUserData) => {
  try {
    const rolesArray = userData.roles
      ? userData.roles
      : userData.role
        ? [userData.role]
        : ["Guru"];

    const payload = {
      username: userData.username,
      password: userData.password || "123456",
      nama: userData.nama,
      email: userData.email || `${userData.username}@madrasah.id`,
      role: userData.role || rolesArray[0] || "Guru",
      roles: rolesArray,
      madrasahId: userData.madrasahId || "",
      namaMadrasah: userData.namaMadrasah || "",
      status: userData.status || "Aktif",
      jabatan: userData.jabatan || "",
      pangkatGolongan: userData.pangkatGolongan || "",
      golongan: userData.golongan || "",
      isGeneratedFromGuru: userData.isGeneratedFromGuru ?? true,
      hasAccount: userData.hasAccount ?? true,
      ...(userData.refId ? { refId: userData.refId } : {}),
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(userCollectionRef, payload);
    return { id: docRef.id, ...payload };
  } catch (error) {
    console.error("Error in addUser:", error);
    throw error;
  }
};

// 3. Update Data User
export const updateUser = async (id: string, userData: Partial<User>) => {
  try {
    const userDocRef = doc(db, "users", id);
    await updateDoc(userDocRef, userData);
  } catch (error) {
    console.error("Error in updateUser:", error);
    throw error;
  }
};

// 4. Hapus User
export const deleteUser = async (id: string) => {
  try {
    const userDocRef = doc(db, "users", id);
    await deleteDoc(userDocRef);
  } catch (error) {
    console.error("Error in deleteUser:", error);
    throw error;
  }
};

// 5. Sinkronisasi Otomatis Generate Akun User dari Guru & Wali Kelas
export const syncUsersOtomatis = async (currentUser?: { madrasahId?: string; namaMadrasah?: string }) => {
  try {
    const [guruList, kelasList, userDocs] = await Promise.all([
      getGuruList().catch(() => []),
      getKelasList().catch(() => []),
      getDocs(userCollectionRef).catch(() => ({ docs: [] })),
    ]);

    const existingUsers = ("docs" in userDocs ? userDocs.docs : []).map((d) => ({
      id: d.id,
      ...d.data(),
    })) as User[];

    const daftarWaliKelas = (kelasList || []).map((k) =>
      String(k.waliKelasId || "").trim().toLowerCase()
    );

    for (const guru of guruList) {
      if (!guru.id || !guru.nama) continue;

      const namaClean = guru.nama.trim().toLowerCase();
      const isWaliKelas = daftarWaliKelas.includes(namaClean);

      const roles = ["Guru"];
      if (isWaliKelas) {
        roles.push("Wali Kelas");
      }

      const username =
        guru.nip && guru.nip.trim() !== ""
          ? guru.nip.trim()
          : guru.nama.toLowerCase().replace(/\s+/g, "").substring(0, 10) + "123";

      const existingUser = existingUsers.find((u) => u.refId === guru.id);

      if (existingUser) {
        const userDocRef = doc(db, "users", existingUser.id!);
        await setDoc(
          userDocRef,
          {
            ...existingUser,
            nama: guru.nama,
            roles: roles,
            role: roles[0],
            jabatan: guru.jabatan || existingUser.jabatan || "",
            pangkatGolongan: guru.pangkatGolongan || existingUser.pangkatGolongan || "",
            golongan: guru.golongan || existingUser.golongan || "",
            email: existingUser.email || `${username}@madrasah.id`,
            status: existingUser.status || "Aktif",
            madrasahId: existingUser.madrasahId || currentUser?.madrasahId || "",
            namaMadrasah: existingUser.namaMadrasah || currentUser?.namaMadrasah || "",
          },
          { merge: true }
        );
      } else {
        const newUserRef = doc(userCollectionRef);
        await setDoc(newUserRef, {
          username: username,
          password: username,
          nama: guru.nama,
          email: `${username}@madrasah.id`,
          role: roles[0],
          roles: roles,
          refId: guru.id,
          status: "Aktif",
          jabatan: guru.jabatan || "",
          pangkatGolongan: guru.pangkatGolongan || "",
          golongan: guru.golongan || "",
          madrasahId: currentUser?.madrasahId || "",
          namaMadrasah: currentUser?.namaMadrasah || "",
          isGeneratedFromGuru: true,
          hasAccount: true,
          createdAt: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    console.error("Error in syncUsersOtomatis:", error);
    throw error;
  }
};