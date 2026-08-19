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

export interface Siswa {
  id?: string;
  nisn: string;
  nama: string;
  kelas: string;
}

const siswaCollectionRef = collection(db, "siswa");

export const getSiswaList = async (): Promise<Siswa[]> => {
  const querySnapshot = await getDocs(siswaCollectionRef);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Siswa[];
};

export const addSiswa = async (siswa: Omit<Siswa, "id">) => {
  return await addDoc(siswaCollectionRef, siswa);
};

// Tambah Banyak Data Siswa Sekaligus (Bulk Insert)
export const addBulkSiswa = async (siswaList: Omit<Siswa, "id">[]) => {
  const batch = writeBatch(db);
  siswaList.forEach((siswa) => {
    const docRef = doc(siswaCollectionRef);
    batch.set(docRef, siswa);
  });
  await batch.commit();
};

export const updateSiswa = async (id: string, siswa: Partial<Siswa>) => {
  const siswaDoc = doc(db, "siswa", id);
  return await updateDoc(siswaDoc, siswa);
};

export const deleteSiswa = async (id: string) => {
  const siswaDoc = doc(db, "siswa", id);
  return await deleteDoc(siswaDoc);
};