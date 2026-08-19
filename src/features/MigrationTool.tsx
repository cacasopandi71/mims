import { useState } from "react";
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";

// Daftar semua nama koleksi di Firestore yang ingin disuntikkan madrasahId
const KOLEKSI_TARGET = [
  "guru",
  "mapel",
  "jadwal",
  "absensi",
  "nilai",
  "agenda",
  "tahfidz"
];

export default function MigrationTool() {
  const { user } = useAuth();
  const [isMigrating, setIsMigrating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, message]);
  };

  const handleMigration = async () => {
    if (!user?.madrasahId) {
      alert("Akses Ditolak: Anda tidak memiliki madrasahId yang valid.");
      return;
    }

    const konfirmasi = window.confirm(
      `Peringatan: Aksi ini akan menambahkan madrasahId "${user.madrasahId}" ke semua data lama yang belum memilikinya. Lanjutkan?`
    );
    if (!konfirmasi) return;

    setIsMigrating(true);
    setLogs([]);
    addLog(`🚀 Memulai migrasi untuk madrasahId: ${user.madrasahId}`);

    for (const namaKoleksi of KOLEKSI_TARGET) {
      try {
        addLog(`⏳ Membaca data dari koleksi [${namaKoleksi}]...`);
        const querySnapshot = await getDocs(collection(db, namaKoleksi));
        
        let batch = writeBatch(db);
        let batchCount = 0;
        let totalDiperbarui = 0;

        for (const document of querySnapshot.docs) {
          const data = document.data();
          
          // Hanya update jika dokumen belum memiliki madrasahId
          if (!data.madrasahId) {
            const docRef = doc(db, namaKoleksi, document.id);
            batch.update(docRef, { madrasahId: user.madrasahId });
            
            batchCount++;
            totalDiperbarui++;

            // Proteksi Limit Firestore: Eksekusi batch setiap 400 dokumen
            if (batchCount === 400) {
              await batch.commit();
              batch = writeBatch(db); // Buat batch baru setelah dieksekusi
              batchCount = 0;
            }
          }
        }

        // Eksekusi sisa dokumen yang belum ter-commit (jika ada)
        if (batchCount > 0) {
          await batch.commit();
        }

        if (totalDiperbarui > 0) {
          addLog(`✅ [${namaKoleksi}] Berhasil memperbarui ${totalDiperbarui} dokumen.`);
        } else {
          addLog(`ℹ️ [${namaKoleksi}] Data sudah aman (Tidak ada yang perlu diupdate).`);
        }

      } catch (error: any) {
        console.error(`Error pada koleksi ${namaKoleksi}:`, error);
        addLog(`❌ [${namaKoleksi}] Gagal diperbarui: ${error.message}`);
      }
    }

    addLog("🎉 PROSES MIGRASI SELESAI!");
    setIsMigrating(false);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto mt-8 bg-white border-2 border-indigo-200 rounded-xl shadow-sm font-sans">
      <div className="flex items-center space-x-3 mb-4">
        <span className="text-3xl">🛠️</span>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Alat Perbaikan Database (Migrasi)</h2>
          <p className="text-sm text-slate-500">
            Menyuntikkan <code className="bg-slate-100 text-rose-600 px-1 rounded">madrasahId</code> secara massal ke data lama.
          </p>
        </div>
      </div>

      <button
        onClick={handleMigration}
        disabled={isMigrating}
        className={`w-full font-bold py-3 px-4 rounded-lg text-white transition-all shadow-sm ${
          isMigrating
            ? "bg-indigo-400 cursor-not-allowed animate-pulse"
            : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-md"
        }`}
      >
        {isMigrating ? "Proses Migrasi Berjalan..." : "Mulai Migrasi Data"}
      </button>

      {/* Terminal Log Output */}
      {logs.length > 0 && (
        <div className="mt-6 bg-slate-900 rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs shadow-inner">
          <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
            <span className="text-slate-400 font-bold uppercase tracking-wider">Terminal Output</span>
            {isMigrating && (
              <span className="flex space-x-1">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-75"></span>
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-150"></span>
              </span>
            )}
          </div>
          <ul className="space-y-1.5">
            {logs.map((log, index) => (
              <li 
                key={index} 
                className={`${
                  log.includes("✅") ? "text-emerald-400" : 
                  log.includes("❌") ? "text-rose-400" : 
                  log.includes("🎉") ? "text-amber-400 font-bold text-sm mt-3" : 
                  "text-slate-300"
                }`}
              >
                <span className="opacity-50 mr-2 text-slate-500">{">"}</span>
                {log}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}