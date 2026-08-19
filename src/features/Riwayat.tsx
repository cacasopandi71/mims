import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../config/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

interface LogItem {
  id: string;
  waktu: string;
  user: string;
  aktivitas: string;
  modul: string;
  madrasahId: string;
}

export default function Riwayat() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionStr = localStorage.getItem("mims_session");
    if (!sessionStr) { navigate("/login"); return; }

    try {
      const session = JSON.parse(sessionStr);
      if (session.madrasahId) {
        fetchRiwayat(session.madrasahId);
      } else {
        setLoading(false);
      }
    } catch {
      navigate("/login");
    }
  }, [navigate]);

  const fetchRiwayat = async (madrasahId: string) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "logs"),
        where("madrasahId", "==", madrasahId)
      );
      const snap = await getDocs(q);
      const list: LogItem[] = [];
      snap.forEach((docItem) => {
        list.push({ id: docItem.id, ...docItem.data() } as LogItem);
      });
      setLogs(list);
    } catch (err) {
      console.error("Gagal mengambil log aktivitas:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-teal-700 p-4 text-white flex justify-between items-center shadow-md">
        <h1 className="text-xl font-bold">MIMS - Log Audit Aktivitas</h1>
        <button onClick={() => navigate("/dashboard")} className="bg-teal-800 hover:bg-teal-900 px-4 py-2 rounded-lg text-sm font-semibold transition">
          Kembali ke Dashboard
        </button>
      </nav>

      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Riwayat Perubahan Data</h2>
          <p className="text-slate-500 text-sm">Catatan histori aksi penting yang dilakukan oleh pengelola di sistem madrasah ini.</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          {loading ? (
            <p className="text-slate-500 text-sm">Memuat catatan aktivitas...</p>
          ) : logs.length === 0 ? (
            <p className="text-slate-500 text-sm">Belum ada riwayat aktivitas tercatat.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-600 text-sm">
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Pengguna</th>
                    <th className="p-3">Modul</th>
                    <th className="p-3">Aktivitas</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {logs.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-500 font-mono text-xs">{item.waktu || "-"}</td>
                      <td className="p-3 font-semibold text-slate-800">{item.user || "Sistem"}</td>
                      <td className="p-3"><span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-bold">{item.modul}</span></td>
                      <td className="p-3 text-slate-700">{item.aktivitas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}