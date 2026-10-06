"use client";

import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Bell,
  Users,
  CheckCircle,
  AlertTriangle,
  Clock,
  Clock3,
  Award,
  Search,
  FileText as FileTextIcon,
  Download,
  Filter,
  Image as ImageIcon,
  MapPin,
  Trash2,
} from "lucide-react";
import AdminStatCard from "@/components/admin/AdminStatCard";
import type { Employee, Attendance } from "@/lib/types";

const statusBadge: Record<string, { text: string; color: string }> = {
  present: { text: "Hadir", color: "bg-green-100 text-green-700" },
  late: { text: "Terlambat", color: "bg-red-100 text-red-700" },
  early_leave: { text: "Pulang Awal", color: "bg-yellow-100 text-yellow-700" },
  absent: { text: "Tidak Hadir", color: "bg-gray-100 text-gray-700" },
};

interface RankEntry {
  emp: Employee;
  present: number;
  late: number;
}

interface Props {
  lateClockIn: Employee[];
  missingClockOut: Employee[];
  totalEmployees: number;
  presentToday: number;
  lateToday: number;
  reminderMsg: string;
  reminderSending: boolean;
  onSendClockOutReminder: () => void;
  topRajin: RankEntry[];
  topTelat: RankEntry[];
  month: string;
  setMonth: (m: string) => void;
  globalSearch: string;
  setGlobalSearch: (s: string) => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  employees: Employee[];
  empStatsMap: Map<string, { present: number; late: number }>;
  getMonthlyHours: (empId: string) => number;
  filterEmployee: string;
  setFilterEmployee: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  filteredRecords: Attendance[];
  recordsEmpty: boolean;
  setPhotoModal: (url: string) => void;
  onDeleteAttendance: (id: string) => void;
}

export default function DashboardTab({
  lateClockIn, missingClockOut, totalEmployees, presentToday, lateToday,
  reminderMsg, reminderSending, onSendClockOutReminder, topRajin, topTelat,
  month, setMonth, globalSearch, setGlobalSearch, onExportPDF, onExportExcel,
  employees, empStatsMap, getMonthlyHours,
  filterEmployee, setFilterEmployee, filterStatus, setFilterStatus,
  filteredRecords, recordsEmpty, setPhotoModal, onDeleteAttendance,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Late Clock-In Notification */}
      {lateClockIn.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-red-700 mb-2">
            <Bell size={18} />
            <h3 className="font-semibold">
              Belum Clock In ({lateClockIn.length})
            </h3>
          </div>
          <p className="text-xs text-red-600 mb-2">
            Karyawan yang belum absen hari ini setelah jam kerja dimulai
          </p>
          <div className="flex flex-wrap gap-2">
            {lateClockIn.map((emp) => (
              <span
                key={emp.id}
                className="bg-white text-red-700 text-xs px-3 py-1 rounded-full border border-red-300"
              >
                {emp.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <AdminStatCard
          icon={<Users size={18} />}
          label="Total Karyawan"
          value={totalEmployees}
          gradient="from-blue-500 to-indigo-500"
          bg="from-blue-50 via-white to-indigo-50"
          textColor="text-blue-700"
        />
        <AdminStatCard
          icon={<CheckCircle size={18} />}
          label="Hadir Hari Ini"
          value={presentToday}
          gradient="from-emerald-500 to-green-500"
          bg="from-emerald-50 via-white to-green-50"
          textColor="text-emerald-700"
          liveBadge={`${totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0}%`}
        />
        <AdminStatCard
          icon={<AlertTriangle size={18} />}
          label="Terlambat"
          value={lateToday}
          gradient="from-amber-500 to-orange-500"
          bg="from-amber-50 via-white to-orange-50"
          textColor="text-amber-700"
        />
        <AdminStatCard
          icon={<Clock size={18} />}
          label="Belum Hadir"
          value={totalEmployees - presentToday}
          gradient="from-rose-500 to-red-500"
          bg="from-rose-50 via-white to-red-50"
          textColor="text-rose-700"
        />
      </div>

      {/* Clock-Out Reminder Banner */}
      {missingClockOut.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-[200px]">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <Clock3 size={20} />
            </div>
            <div>
              <p className="font-bold text-amber-900 text-sm">{missingClockOut.length} karyawan belum clock-out</p>
              <p className="text-xs text-amber-700">{missingClockOut.slice(0, 3).map((e) => e.name).join(", ")}{missingClockOut.length > 3 ? ` +${missingClockOut.length - 3} lainnya` : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {reminderMsg && <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">{reminderMsg}</span>}
            <button
              onClick={onSendClockOutReminder}
              disabled={reminderSending}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition disabled:opacity-60"
            >
              <Bell size={14} />
              {reminderSending ? "Mengirim..." : "Kirim Reminder"}
            </button>
          </div>
        </div>
      )}

      {/* Top Performer Ranking */}
      {(topRajin.length > 0 || topTelat.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 animate-fade-in">
          {/* Top Rajin */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-green-50 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 text-white flex items-center justify-center">
                <Award size={14} />
              </div>
              <h3 className="font-bold text-sm text-emerald-900">Top Rajin Bulan Ini</h3>
            </div>
            <ul className="divide-y divide-gray-100">
              {topRajin.map((r, idx) => (
                <li key={r.emp.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    idx === 0 ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-white" :
                    idx === 1 ? "bg-gradient-to-br from-gray-300 to-gray-400 text-white" :
                    "bg-gradient-to-br from-orange-400 to-orange-500 text-white"
                  }`}>
                    {idx + 1}
                  </span>
                  <p className="flex-1 text-sm font-semibold text-gray-800 truncate">{r.emp.name}</p>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full tabular-nums">{r.present} hari</span>
                </li>
              ))}
              {topRajin.length === 0 && <li className="px-4 py-6 text-center text-xs text-gray-400">Belum ada data</li>}
            </ul>
          </div>

          {/* Top Telat */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-rose-50 to-red-50 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-red-500 text-white flex items-center justify-center">
                <AlertTriangle size={14} />
              </div>
              <h3 className="font-bold text-sm text-rose-900">Paling Sering Terlambat</h3>
            </div>
            <ul className="divide-y divide-gray-100">
              {topTelat.map((r, idx) => (
                <li key={r.emp.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </span>
                  <p className="flex-1 text-sm font-semibold text-gray-800 truncate">{r.emp.name}</p>
                  <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full tabular-nums">{r.late}x</span>
                </li>
              ))}
              {topTelat.length === 0 && <li className="px-4 py-6 text-center text-xs text-gray-400">Tidak ada yang terlambat 🎉</li>}
            </ul>
          </div>
        </div>
      )}

      {/* Month Selector + Export + Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:justify-between">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex-1 relative md:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nama karyawan..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={onExportPDF}
            className="flex-1 md:flex-none flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-dark transition"
          >
            <FileTextIcon size={16} /> PDF
          </button>
          <button
            onClick={onExportExcel}
            className="flex-1 md:flex-none flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
          >
            <Download size={16} /> Excel
          </button>
        </div>
      </div>

      {/* Monthly Hours Summary */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-700">
            Jam Kerja Bulan {format(new Date(month + "-01"), "MMMM yyyy", { locale: idLocale })}
          </h3>
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Hadir</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Terlambat</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Total Jam</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees
                .filter((e) => e.role === "employee")
                .map((emp) => {
                  const stats = empStatsMap.get(emp.id) || { present: 0, late: 0 };
                  return (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{emp.name}</td>
                      <td className="px-4 py-3 text-center">{stats.present}</td>
                      <td className="px-4 py-3 text-center text-red-600">{stats.late}</td>
                      <td className="px-4 py-3 text-center font-semibold text-primary">
                        {getMonthlyHours(emp.id)} jam
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {/* Mobile Cards for Monthly Hours */}
        <div className="md:hidden divide-y">
          {employees
            .filter((e) => e.role === "employee")
            .map((emp) => {
              const stats = empStatsMap.get(emp.id) || { present: 0, late: 0 };
              return (
                <div key={emp.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{emp.name}</p>
                    <p className="text-xs text-gray-500">
                      Hadir: {stats.present} •{" "}
                      <span className="text-red-600">Terlambat: {stats.late}</span>
                    </p>
                  </div>
                  <p className="font-bold text-primary">
                    {getMonthlyHours(emp.id)} jam
                  </p>
                </div>
              );
            })}
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <Filter size={16} /> Detail Absensi
          </h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Semua Karyawan</option>
              {employees
                .filter((e) => e.role === "employee")
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Semua Status</option>
              <option value="present">Hadir</option>
              <option value="late">Terlambat</option>
              <option value="early_leave">Pulang Awal</option>
            </select>
          </div>
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tanggal</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Masuk</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Keluar</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Foto</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Lokasi</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Ket</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Hapus</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRecords.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {format(new Date(r.date), "dd/MM")}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {(r as Attendance & { employees?: { name: string } }).employees?.name || "-"}
                  </td>
                  <td className="px-4 py-3 text-center text-green-600">
                    {r.clock_in ? format(new Date(r.clock_in), "HH:mm") : "-"}
                  </td>
                  <td className="px-4 py-3 text-center text-orange-600">
                    {r.clock_out ? format(new Date(r.clock_out), "HH:mm") : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        statusBadge[r.status]?.color || ""
                      }`}
                    >
                      {statusBadge[r.status]?.text || r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="inline-flex items-center gap-1">
                      {r.clock_in_photo && (
                        <button
                          onClick={() => setPhotoModal(r.clock_in_photo!)}
                          className="inline-flex items-center gap-0.5 text-[10px] text-green-600 hover:text-green-800 bg-green-50 px-2 py-1 rounded-lg"
                          title="Foto Clock In"
                        >
                          <ImageIcon size={12} /> In
                        </button>
                      )}
                      {r.clock_out_photo && (
                        <button
                          onClick={() => setPhotoModal(r.clock_out_photo!)}
                          className="inline-flex items-center gap-0.5 text-[10px] text-orange-600 hover:text-orange-800 bg-orange-50 px-2 py-1 rounded-lg"
                          title="Foto Clock Out"
                        >
                          <ImageIcon size={12} /> Out
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.clock_in_lat && (
                      <a
                        href={`https://www.google.com/maps?q=${r.clock_in_lat},${r.clock_in_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700"
                        title="Lihat lokasi"
                      >
                        <MapPin size={16} className="inline" />
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[150px] truncate">
                    {r.notes || "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onDeleteAttendance(r.id)}
                      className="text-red-400 hover:text-red-600 transition"
                      title="Hapus"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile Cards for Detail Absensi */}
        <div className="md:hidden divide-y">
          {filteredRecords.map((r) => {
            const rec = r as Attendance & { employees?: { name: string } };
            return (
              <div key={r.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{rec.employees?.name || "-"}</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(r.date), "EEE, dd MMM", { locale: idLocale })}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      statusBadge[r.status]?.color || ""
                    }`}
                  >
                    {statusBadge[r.status]?.text || r.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-green-50 rounded-lg px-2 py-1 text-green-700">
                    Masuk: {r.clock_in ? format(new Date(r.clock_in), "HH:mm") : "-"}
                  </div>
                  <div className="bg-orange-50 rounded-lg px-2 py-1 text-orange-700">
                    Keluar: {r.clock_out ? format(new Date(r.clock_out), "HH:mm") : "-"}
                  </div>
                </div>
                {r.notes && (
                  <p className="text-xs text-gray-500">Ket: {r.notes}</p>
                )}
                <div className="flex items-center gap-3 text-xs pt-1">
                  {r.clock_in_photo && (
                    <button
                      onClick={() => setPhotoModal(r.clock_in_photo!)}
                      className="flex items-center gap-1 text-blue-600"
                    >
                      <ImageIcon size={14} /> Foto
                    </button>
                  )}
                  {r.clock_in_lat && (
                    <a
                      href={`https://www.google.com/maps?q=${r.clock_in_lat},${r.clock_in_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600"
                    >
                      <MapPin size={14} /> Lokasi
                    </a>
                  )}
                  <button
                    onClick={() => onDeleteAttendance(r.id)}
                    className="flex items-center gap-1 text-red-500 ml-auto"
                  >
                    <Trash2 size={14} /> Hapus
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredRecords.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            {recordsEmpty ? "Belum ada data" : "Tidak ada data sesuai filter"}
          </div>
        )}
      </div>
    </div>
  );
}
