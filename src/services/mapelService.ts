import { db } from "../config/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

export interface Mapel {
  id?: string;
  namaMapel: string;
  kodeMapel?: string;
}

export interface MapelWithGuru extends Mapel {
  pengampu: string[];
}

const mapelCollectionRef = collection(db, "mapel");
const guruCollectionRef = collection(db, "guru");

// 1. Ambil Semua Data Mapel Polos
export const getMapelList = async (): Promise<Mapel[]> => {
  try {
    const data = await getDocs(mapelCollectionRef);
    return data.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Mapel[];
  } catch (error) {
    console.error("Error in getMapelList:", error);
    return [];
  }
};

// 2. Ambil Data Mapel + Otomatis Petakan Guru Pengampu (Aman dari Circular Dependency)
export const getMapelWithGuruList = async (): Promise<MapelWithGuru[]> => {
  try {
    const [mapelDocs, guruDocs] = await Promise.all([
      getDocs(mapelCollectionRef),
      getDocs(guruCollectionRef).catch(() => ({ docs: [] })),
    ]);

    const mapelList = mapelDocs.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Mapel[];

    const guruList = guruDocs.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as any[];

    return mapelList.map((m) => {
      const namaMapelClean = String(m.namaMapel || "").trim().toLowerCase();

      // Cari guru yang mengampu mapel ini
      const pengampu = (guruList || [])
        .filter((g) => {
          if (!g || !g.mapel || typeof g.mapel !== "string") return false;
          const listMapelGuru = g.mapel
            .split(",")
            .map((item: string) => item.trim().toLowerCase())
            .filter(Boolean);
          return listMapelGuru.includes(namaMapelClean);
        })
        .map((g) => g.nama || "Guru Tanpa Nama");

      return {
        ...m,
        namaMapel: m.namaMapel || "Tanpa Nama Mapel",
        kodeMapel: m.kodeMapel || "",
        pengampu: pengampu || [],
      };
    });
  } catch (error) {
    console.error("Error in getMapelWithGuruList:", error);
    return [];
  }
};

// 3. Tambah Mapel Baru
export const addMapel = async (mapel: Omit<Mapel, "id">) => {
  return await addDoc(mapelCollectionRef, mapel);
};

// 4. Update Data Mapel
export const updateMapel = async (id: string, mapel: Partial<Mapel>) => {
  const mapelDoc = doc(db, "mapel", id);
  return await updateDoc(mapelDoc, mapel);
};

// 5. Hapus Mapel
export const deleteMapel = async (id: string) => {
  const mapelDoc = doc(db, "mapel", id);
  return await deleteDoc(mapelDoc);
};

// 6. Sinkronisasi Otomatis Mapel (Bisa dipanggil oleh guruService tanpa crash)
export const syncMapelFromGuruList = async (input?: any) => {
  try {
    const [mapelDocs, guruDocs] = await Promise.all([
      getDocs(mapelCollectionRef),
      getDocs(guruCollectionRef).catch(() => ({ docs: [] })),
    ]);

    const existingMapelNames = mapelDocs.docs.map(
      (doc) => String(doc.data().namaMapel || "").trim().toLowerCase()
    );

    const guruList = guruDocs.docs.map((d) => d.data()) as any[];
    const mapelToCreate = new Set<string>();

    if (typeof input === "string") {
      input.split(",").forEach((item) => {
        const trimmed = item.trim();
        if (trimmed && !existingMapelNames.includes(trimmed.toLowerCase())) {
          mapelToCreate.add(trimmed);
        }
      });
    } else if (Array.isArray(input)) {
      input.forEach((item) => {
        if (typeof item === "string") {
          item.split(",").forEach((subItem) => {
            const trimmed = subItem.trim();
            if (trimmed && !existingMapelNames.includes(trimmed.toLowerCase())) {
              mapelToCreate.add(trimmed);
            }
          });
        } else if (item && typeof item.mapel === "string") {
          item.mapel.split(",").forEach((subItem: string) => {
            const trimmed = subItem.trim();
            if (trimmed && !existingMapelNames.includes(trimmed.toLowerCase())) {
              mapelToCreate.add(trimmed);
            }
          });
        }
      });
    }

    (guruList || []).forEach((guru) => {
      if (guru && guru.mapel && typeof guru.mapel === "string") {
        const items = guru.mapel.split(",");
        items.forEach((item: string) => {
          const trimmed = item.trim();
          if (trimmed && !existingMapelNames.includes(trimmed.toLowerCase())) {
            mapelToCreate.add(trimmed);
          }
        });
      }
    });

    for (const namaMapel of Array.from(mapelToCreate)) {
      await addDoc(mapelCollectionRef, {
        namaMapel,
        kodeMapel: namaMapel.substring(0, 3).toUpperCase(),
      });
    }
  } catch (error) {
    console.error("Error in syncMapelFromGuruList:", error);
  }
};