"use client";

import dynamic from "next/dynamic";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { AlertTriangle, Award, Timer, TrendingUp } from "lucide-react";
import type { Employee, Attendance } from "@/lib/types";

// Lazy-load recharts only when analytics tab is viewed (~400KB bundle)
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });

interface Props {
  employees: Employee[];
  records: Attendance[];
  getMonthlyHours: (empId: string) => number;
  month: string;
}

export default function AnalyticsTab({ employees, records, getMonthlyHours, month }: Props) {
  return (
    <div className="space-y-6">
      {records.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
          <TrendingUp size={32} className="text-amber-500 mx-auto mb-2" />
          <p className="font-semibold text-amber-800">Belum ada data absensi</p>
          <p className="text-xs text-amber-700 mt-1">
            Grafik akan muncul setelah karyawan mulai absen. Pilih bulan lain di Dashboard jika perlu.
          </p>
        </div>
      )}
      {/* Ranking Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(() => {
          const empStats = employees
            .filter((e) => e.role === "employee")
            .map((emp) => {
              const empRecs = records.filter((r) => r.employee_id === emp.id);
              const lateCount = empRecs.filter((r) => r.status === "late").length;
              const presentCount = empRecs.filter((r) => r.clock_in).length;
              const hours = getMonthlyHours(emp.id);
              return { name: emp.name, lateCount, presentCount, hours };
            });

          const mostLate = [...empStats].sort((a, b) => b.lateCount - a.lateCount)[0];
          const mostPresent = [...empStats].sort((a, b) => b.presentCount - a.presentCount)[0];
          const longestHours = [...empStats].sort((a, b) => b.hours - a.hours)[0];

          return (
            <>
              <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-red-500">
                <div className="flex items-center gap-2 text-red-600 mb-2">
                  <AlertTriangle size={18} />
                  <p className="text-xs font-semibold">Paling Sering Terlambat</p>
                </div>
                <p className="text-lg font-bold">{mostLate?.name || "-"}</p>
                <p className="text-xs text-gray-500">
                  {mostLate?.lateCount || 0}x terlambat bulan ini
                </p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-green-500">
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <Award size={18} />
                  <p className="text-xs font-semibold">Paling Rajin</p>
                </div>
                <p className="text-lg font-bold">{mostPresent?.name || "-"}</p>
                <p className="text-xs text-gray-500">
                  {mostPresent?.presentCount || 0} hari hadir
                </p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-blue-500">
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <Timer size={18} />
                  <p className="text-xs font-semibold">Paling Lama di Kantor</p>
                </div>
                <p className="text-lg font-bold">{longestHours?.name || "-"}</p>
                <p className="text-xs text-gray-500">
                  {longestHours?.hours || 0} jam total
                </p>
              </div>
            </>
          );
        })()}
      </div>

      {/* Chart: Monthly Hours per Employee */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-4">
          Total Jam Kerja per Karyawan
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={employees
              .filter((e) => e.role === "employee")
              .map((emp) => ({
                name: emp.name,
                jam: getMonthlyHours(emp.id),
              }))}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="jam" fill="#8B1A1A" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart: Hadir vs Terlambat */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-4">
          Kehadiran vs Keterlambatan
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={employees
              .filter((e) => e.role === "employee")
              .map((emp) => {
                const empRecs = records.filter((r) => r.employee_id === emp.id);
                return {
                  name: emp.name,
                  Hadir: empRecs.filter((r) => r.clock_in).length,
                  Terlambat: empRecs.filter((r) => r.status === "late").length,
                };
              })}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Hadir" fill="#22c55e" radius={[6, 6, 0, 0]} />
            <Bar dataKey="Terlambat" fill="#ef4444" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Chart: Line chart daily attendance trend */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-4">
          Tren Kehadiran Harian
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={(() => {
              // Group by date
              const dateMap = new Map<string, { hadir: number; terlambat: number }>();
              records.forEach((r) => {
                const cur = dateMap.get(r.date) || { hadir: 0, terlambat: 0 };
                if (r.clock_in) cur.hadir += 1;
                if (r.status === "late") cur.terlambat += 1;
                dateMap.set(r.date, cur);
              });
              return Array.from(dateMap.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, v]) => ({
                  date: format(new Date(date), "dd/MM"),
                  Hadir: v.hadir,
                  Terlambat: v.terlambat,
                }));
            })()}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Hadir" stroke="#22c55e" strokeWidth={2} />
            <Line type="monotone" dataKey="Terlambat" stroke="#ef4444" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Ranking Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Late Ranking */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" /> Ranking Keterlambatan
          </h3>
          <div className="space-y-2">
            {employees
              .filter((e) => e.role === "employee")
              .map((emp) => ({
                name: emp.name,
                lateCount: records.filter((r) => r.employee_id === emp.id && r.status === "late").length,
              }))
              .sort((a, b) => b.lateCount - a.lateCount)
              .map((s, i) => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-5 text-xs text-gray-400">#{i + 1}</span>
                    {s.name}
                  </span>
                  <span className={`font-semibold ${s.lateCount > 0 ? "text-red-600" : "text-gray-400"}`}>
                    {s.lateCount}x
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Hours Ranking */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Timer size={16} className="text-blue-500" /> Ranking Jam Kerja
          </h3>
          <div className="space-y-2">
            {employees
              .filter((e) => e.role === "employee")
              .map((emp) => ({ name: emp.name, hours: getMonthlyHours(emp.id) }))
              .sort((a, b) => b.hours - a.hours)
              .map((s, i) => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-5 text-xs text-gray-400">#{i + 1}</span>
                    {s.name}
                  </span>
                  <span className="font-semibold text-primary">{s.hours} jam</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500 text-center">
        Data bulan {format(new Date(month + "-01"), "MMMM yyyy", { locale: idLocale })}
      </p>
    </div>
  );
}
