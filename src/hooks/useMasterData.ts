import { useState, useEffect, useMemo } from "react";
import { db } from "../config/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface MasterItem {
  id: string;
  nama: string;
  sublabel?: string;
}

export const useMasterData = () => {
  const { user } = useAuth();
  const [kelasList, setKelasList] = useState<MasterItem[]>([]);
  const [mapelList, setMapelList] = useState<MasterItem[]>([]);
  const [guruList, setGuruList] = useState<MasterItem[]>([]);
  const [loadingMaster, setLoadingMaster] = useState<boolean>(true);

  useEffect(() => {
    if (!user?.madrasahId) {
      setLoadingMaster(false);
      return;
    }

    setLoadingMaster(true);

    // 1. Fetch Real-time Data KELAS dari Modul Kelas
    const qKelas = query(
      collection(db, "kelas"),
      where("madrasahId", "==", user.madrasahId)
    );
    const unsubKelas = onSnapshot(qKelas, (snap) => {
      const list: MasterItem[] = [];
      snap.forEach((doc) => {
        const d = doc.data();
        list.push({
          id: doc.id,
          nama: d.namaKelas || d.nama || "Tanpa Nama"
        });
      });
      list.sort((a, b) => a.nama.localeCompare(b.nama));
      setKelasList(list);
    });

    // 2. Fetch Real-time Data MATA PELAJARAN dari Modul Mapel
    const qMapel = query(
      collection(db, "mapel"),
      where("madrasahId", "==", user.madrasahId)
    );
    const unsubMapel = onSnapshot(qMapel, (snap) => {
      const list: MasterItem[] = [];
      snap.forEach((doc) => {
        const d = doc.data();
        list.push({
          id: doc.id,
          nama: d.namaMapel || d.nama || "Tanpa Nama",
          sublabel: d.kodeMapel || undefined
        });
      });
      list.sort((a, b) => a.nama.localeCompare(b.nama));
      setMapelList(list);
    });

    // 3. Fetch Real-time Data GURU dari Modul Guru
    const qGuru = query(
      collection(db, "guru"),
      where("madrasahId", "==", user.madrasahId)
    );
    const unsubGuru = onSnapshot(qGuru, (snap) => {
      const list: MasterItem[] = [];
      snap.forEach((doc) => {
        const d = doc.data();
        const namaGuru = d.nama || d.namaLengkap || d.namaGuru || "Tanpa Nama";
        const mapelDiampu = d.mapel || d.mataPelajaran || d.mapelDiampu || "";
        list.push({
          id: doc.id,
          nama: namaGuru,
          sublabel: mapelDiampu ? `Ampu: ${mapelDiampu}` : undefined
        });
      });
      list.sort((a, b) => a.nama.localeCompare(b.nama));
      setGuruList(list);
      setLoadingMaster(false);
    });

    return () => {
      unsubKelas();
      unsubMapel();
      unsubGuru();
    };
  }, [user?.madrasahId]);

  // Format Opsi Otomatis untuk SearchableSelect
  const kelasOptions = useMemo<SelectOption[]>(
    () => kelasList.map((k) => ({ value: k.nama, label: k.nama })),
    [kelasList]
  );

  const mapelOptions = useMemo<SelectOption[]>(
    () => mapelList.map((m) => ({ value: m.nama, label: m.nama, sublabel: m.sublabel })),
    [mapelList]
  );

  const guruOptions = useMemo<SelectOption[]>(
    () => guruList.map((g) => ({ value: g.nama, label: g.nama, sublabel: g.sublabel })),
    [guruList]
  );

  return {
    kelasList,
    mapelList,
    guruList,
    kelasOptions,
    mapelOptions,
    guruOptions,
    loadingMaster
  };
};