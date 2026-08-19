import { db } from "../config/firebase";
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  writeBatch 
} from "firebase/firestore";

export interface RecordNilai {
  id?: string;
  nisn: string;
  namaSiswa: string;
  kelas: string;
  mapel: string;
  semester: string; // Genap / Ganjil
  nilaiTugas: number;
  nilaiUTS: number;
  nilaiUAS: number;
  nilaiAkhir: number;
  predikat: string;
}

const nilaiCollectionRef = collection(db, "nilai");

// Hitung Nilai Akhir & Predikat
export const hitungNilaiDanPredikat = (tugas: number, uts: number, uas: number) => {
  const nilaiAkhir = Math.round(tugas * 0.3 + uts * 0.35 + uas * 0.35);
  let predikat = "D";

  if (nilaiAkhir >= 90) predikat = "A (Sangat Baik)";
  else if (nilaiAkhir >= 80) predikat = "B (Baik)";
  else if (nilaiAkhir >= 70) predikat = "C (Cukup)";
  else predikat = "D (Kurang)";

  return { nilaiAkhir, predikat };
};

// 1. Ambil Data Nilai berdasarkan Kelas, Mapel, dan Semester
export const getNilaiByFilter = async (kelas: string, mapel: string, semester: string): Promise<RecordNilai[]> => {
  const q = query(
    nilaiCollectionRef, 
    where("kelas", "==", kelas), 
    where("mapel", "==", mapel),
    where("semester", "==", semester)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as RecordNilai[];
};

// 2. Simpan / Update Nilai Massal (Batch)
export const saveNilaiBatch = async (dataNilai: Omit<RecordNilai, "id">[]) => {
  const batch = writeBatch(db);

  for (const item of dataNilai) {
    const q = query(
      nilaiCollectionRef, 
      where("kelas", "==", item.kelas), 
      where("mapel", "==", item.mapel),
      where("semester", "==", item.semester),
      where("nisn", "==", item.nisn)
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      // Update data jika sudah ada
      const existingDocId = snapshot.docs[0].id;
      const docRef = doc(nilaiCollectionRef, existingDocId);
      batch.update(docRef, { 
        nilaiTugas: item.nilaiTugas,
        nilaiUTS: item.nilaiUTS,
        nilaiUAS: item.nilaiUAS,
        nilaiAkhir: item.nilaiAkhir,
        predikat: item.predikat,
      });
    } else {
      // Tambah data baru
      const docRef = doc(nilaiCollectionRef);
      batch.set(docRef, item);
    }
  }

  await batch.commit();
};