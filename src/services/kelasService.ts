import { db } from "../config/firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  deleteDoc, 
  updateDoc,
  writeBatch
} from "firebase/firestore";

export interface Kelas {
  id?: string;
  namaKelas: string;
  waliKelasId: string;
  waliKelasNama: string;
}

const kelasCollectionRef = collection(db, "kelas");

export const getKelasList = async (): Promise<Kelas[]> => {
  const querySnapshot = await getDocs(kelasCollectionRef);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Kelas[];
};

export const addKelas = async (kelas: Omit<Kelas, "id">) => {
  return await addDoc(kelasCollectionRef, kelas);
};

// Tambah Banyak Data Kelas Sekaligus (Bulk Insert)
export const addBulkKelas = async (kelasList: Omit<Kelas, "id">[]) => {
  const batch = writeBatch(db);
  kelasList.forEach((kelas) => {
    const docRef = doc(kelasCollectionRef);
    batch.set(docRef, kelas);
  });
  await batch.commit();
};

export const updateKelas = async (id: string, kelas: Partial<Kelas>) => {
  const kelasDoc = doc(db, "kelas", id);
  return await updateDoc(kelasDoc, kelas);
};

export const deleteKelas = async (id: string) => {
  const kelasDoc = doc(db, "kelas", id);
  return await deleteDoc(kelasDoc);
};