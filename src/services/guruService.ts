import { db } from "../config/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
} from "firebase/firestore";
import { syncMapelFromGuruList } from "./mapelService";

export interface Guru {
  id?: string;
  nip?: string;
  nama: string;
  mapel?: string;
  jabatan?: string;
  pangkatGolongan?: string;
  golongan?: string;
  tempatLahir?: string;
  tanggalLahir?: string;
}

const guruCollectionRef = collection(db, "guru");

// 1. Ambil Semua Data Guru
export const getGuruList = async (): Promise<Guru[]> => {
  const data = await getDocs(guruCollectionRef);
  return data.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Guru[];
};

// 2. Tambah 1 Guru (Auto-Sync Mapel)
export const addGuru = async (guru: Omit<Guru, "id">) => {
  if (guru.mapel) {
    await syncMapelFromGuruList([guru.mapel]);
  }
  return await addDoc(guruCollectionRef, guru);
};

// 3. Update Data Guru (Auto-Sync Mapel)
export const updateGuru = async (id: string, guru: Partial<Guru>) => {
  if (guru.mapel) {
    await syncMapelFromGuruList([guru.mapel]);
  }
  const guruDoc = doc(db, "guru", id);
  return await updateDoc(guruDoc, guru);
};

// 4. Hapus Data Guru
export const deleteGuru = async (id: string) => {
  const guruDoc = doc(db, "guru", id);
  return await deleteDoc(guruDoc);
};

// 5. Tambah/Upload Banyak Data Guru (Bulk Add / CSV Import) (Auto-Sync Mapel)
export const addBulkGuru = async (dataGuru: Omit<Guru, "id">[]) => {
  const mapelList = dataGuru.map((g) => g.mapel).filter(Boolean);

  if (mapelList.length > 0) {
    await syncMapelFromGuruList(mapelList);
  }

  const batch = writeBatch(db);

  dataGuru.forEach((item) => {
    const newDocRef = doc(guruCollectionRef);
    batch.set(newDocRef, item);
  });

  await batch.commit();
};

// Alias nama fungsi jika dibutuhkan
export const uploadGuruBatch = addBulkGuru;