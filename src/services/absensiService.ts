import { db } from "../config/firebase";
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  writeBatch 
} from "firebase/firestore";

export type StatusAbsensi = "Hadir" | "Izin" | "Sakit" | "Alpa";

export interface RecordAbsensi {
  id?: string;
  nisn: string;
  namaSiswa: string;
  kelas: string;
  tanggal: string;
  status: StatusAbsensi;
}

const absensiCollectionRef = collection(db, "absensi");

// 1. Ambil Data Absensi berdasarkan Tanggal dan Kelas
export const getAbsensiByTanggalAndKelas = async (
  tanggal: string, 
  kelas: string
): Promise<RecordAbsensi[]> => {
  const q = query(
    absensiCollectionRef, 
    where("tanggal", "==", tanggal), 
    where("kelas", "==", kelas)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as RecordAbsensi[];
};

// Alias jika dipanggil dengan nama getAbsensiByTanggalDanKelas
export const getAbsensiByTanggalDanKelas = getAbsensiByTanggalAndKelas;

// 2. Simpan / Update Absensi Massal (Batch)
export const saveAbsensiBatch = async (dataAbsensi: Omit<RecordAbsensi, "id">[]) => {
  const batch = writeBatch(db);

  for (const item of dataAbsensi) {
    const q = query(
      absensiCollectionRef, 
      where("tanggal", "==", item.tanggal), 
      where("kelas", "==", item.kelas),
      where("nisn", "==", item.nisn)
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      // Update data jika sudah ada
      const existingDocId = snapshot.docs[0].id;
      const docRef = doc(absensiCollectionRef, existingDocId);
      batch.update(docRef, { 
        status: item.status,
        namaSiswa: item.namaSiswa,
      });
    } else {
      // Tambah data baru
      const docRef = doc(absensiCollectionRef);
      batch.set(docRef, item);
    }
  }

  await batch.commit();
};