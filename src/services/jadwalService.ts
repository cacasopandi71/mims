import { db } from "../config/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

export interface Jadwal {
  id?: string;
  hari: string;
  jamMulai: string;
  jamSelesai: string;
  kelas: string;
  mapel: string;
  guru: string;
}

const jadwalCollectionRef = collection(db, "jadwal");

// 1. Ambil semua data jadwal
export const getJadwalList = async (): Promise<Jadwal[]> => {
  const data = await getDocs(jadwalCollectionRef);
  return data.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Jadwal[];
};

// 2. Tambah jadwal baru
export const addJadwal = async (jadwal: Omit<Jadwal, "id">) => {
  return await addDoc(jadwalCollectionRef, jadwal);
};

// 3. Update jadwal
export const updateJadwal = async (id: string, jadwal: Partial<Jadwal>) => {
  const jadwalDoc = doc(db, "jadwal", id);
  return await updateDoc(jadwalDoc, jadwal);
};

// 4. Hapus jadwal
export const deleteJadwal = async (id: string) => {
  const jadwalDoc = doc(db, "jadwal", id);
  return await deleteDoc(jadwalDoc);
};