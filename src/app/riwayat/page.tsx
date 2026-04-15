"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee } from "@/lib/auth";
import { Employee, Attendance } from "@/lib/types";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { ArrowLeft, Clock, MapPin, FileText } from "lucide-react";
import Logo from "@/components/Logo";

export default function RiwayatPage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const emp = getStoredEmployee();
    if (!emp) {
      router.push("/");
      return;
    }
    setEmployee(emp);
  }, [router]);

  useEffect(() => {
    if (!employee) return;

    async function fetchRecords() {
      setLoading(true);
      const date = new Date(month + "-01");
      const start = format(startOfMonth(date), "yyyy-MM-dd");
      const end = format(endOfMonth(date), "yyyy-MM-dd");

      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", employee!.id)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false });

      const list = data || [];
      setRecords(list);

      // Calculate total hours
      let total = 0;
      for (const r of list) {
        if (r.clock_in && r.clock_out) {
          const diff =
            new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime();
          total += diff / (1000 * 60 * 60);
        }
      }
      setTotalHours(Math.round(total * 10) / 10);
      setLoading(false);
    }

    fetchRecords();
  }, [employee, month]);

  const statusLabel: Record<string, { text: string; color: string }> = {
    present: { text: "Hadir", color: "bg-green-100 text-green-700" },
    late: { text: "Terlambat", color: "bg-red-100 text-red-700" },
    early_leave: { text: "Pulang Awal", color: "bg-yellow-100 text-yellow-700" },
    absent: { text: "Tidak Hadir", color: "bg-gray-100 text-gray-700" },
  };

  if (!employee) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-500 hover:text-primary">
              <ArrowLeft size={20} />
            </button>
            <h1 className="font-bold text-gray-800">Riwayat Absensi</h1>
          </div>
          <Logo size="sm" showSubtitle={false} />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Month Picker */}
        <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="text-right">
            <p className="text-xs text-gray-500">Total Jam Kerja</p>
            <p className="text-lg font-bold text-primary">{totalHours} jam</p>
          </div>
        </div>

        {/* Records */}
        {loading ? (
          <div className="text-center py-8 text-gray-400">Memuat...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            Belum ada data absensi bulan ini
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-gray-700">
                    {format(new Date(r.date), "EEEE, dd MMM", { locale: idLocale })}
                  </p>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      statusLabel[r.status]?.color || ""
                    }`}
                  >
                    {statusLabel[r.status]?.text || r.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-1.5 text-green-600">
                    <Clock size={14} />
                    <span>Masuk: {r.clock_in ? format(new Date(r.clock_in), "HH:mm") : "-"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-orange-600">
                    <Clock size={14} />
                    <span>Keluar: {r.clock_out ? format(new Date(r.clock_out), "HH:mm") : "-"}</span>
                  </div>
                </div>

                {r.clock_in_lat && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-2">
                    <MapPin size={12} />
                    <span>
                      {r.clock_in_lat.toFixed(4)}, {r.clock_in_lng?.toFixed(4)}
                    </span>
                  </div>
                )}

                {r.notes && (
                  <div className="flex items-start gap-1.5 text-xs text-gray-500 mt-2">
                    <FileText size={12} className="mt-0.5 shrink-0" />
                    <span>{r.notes}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
