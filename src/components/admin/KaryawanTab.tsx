"use client";

import type { FormEvent } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  UserPlus,
  Plus,
  CheckCircle,
  Users,
  Eye,
  EyeOff,
  Shield,
  UserCircle2,
  Download,
  Loader2,
  Key,
  Clock3,
  Bell,
  Trash2,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import { getEffectiveWorkHours } from "@/lib/workHours";
import { getPositionColor } from "@/lib/positions";
import type { Employee, Settings } from "@/lib/types";

interface Props {
  employees: Employee[];
  settings: Settings | null;
  effHoursMap: Map<string, ReturnType<typeof getEffectiveWorkHours>>;
  month: string;
  showPins: boolean;
  setShowPins: (v: boolean) => void;
  newEmployee: { name: string; pin: string };
  setNewEmployee: (v: { name: string; pin: string }) => void;
  empMsg: string;
  onAddEmployee: (e: FormEvent) => void;
  reportLoadingId: string | null;
  onExportEmployeeReport: (emp: Employee) => void;
  onOpenEmployee: (id: string) => void;
  onOpenResetPin: (emp: Employee) => void;
  onOpenEditProfile: (emp: Employee) => void;
  onOpenEditHours: (emp: Employee) => void;
  onTestNotif: (id: string, name: string) => void;
  onDeleteEmployee: (emp: Employee) => void;
}

export default function KaryawanTab({
  employees, settings, effHoursMap, month, showPins, setShowPins,
  newEmployee, setNewEmployee, empMsg, onAddEmployee,
  reportLoadingId, onExportEmployeeReport, onOpenEmployee,
  onOpenResetPin, onOpenEditProfile, onOpenEditHours, onTestNotif, onDeleteEmployee,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Add Employee */}
      <form onSubmit={onAddEmployee} className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <UserPlus size={18} className="text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Tambah Karyawan Baru</h3>
            <p className="text-xs text-gray-400">Karyawan bisa langsung login dengan nama & PIN</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
          <input
            type="text"
            placeholder="Nama karyawan"
            value={newEmployee.name}
            onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
            className="px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            required
          />
          <input
            type="text"
            placeholder="PIN (min 4 digit)"
            value={newEmployee.pin}
            onChange={(e) => setNewEmployee({ ...newEmployee, pin: e.target.value })}
            className="px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-mono"
            required
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition text-sm inline-flex items-center gap-1.5 justify-center"
          >
            <Plus size={16} /> Tambah
          </button>
        </div>
        {empMsg && (
          <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
            <CheckCircle size={14} /> {empMsg}
          </p>
        )}
      </form>

      {/* Employee List */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-gray-500" />
            <h3 className="font-semibold text-gray-800">Daftar Karyawan</h3>
            <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full border">
              {employees.length}
            </span>
          </div>
          <button
            onClick={() => setShowPins(!showPins)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary bg-white px-3 py-1.5 rounded-lg border hover:border-primary transition"
          >
            {showPins ? <EyeOff size={14} /> : <Eye size={14} />}
            {showPins ? "Sembunyikan PIN" : "Tampilkan PIN"}
          </button>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nama</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">PIN</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Jam Kerja</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Role</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map((emp) => {
                const hasSchedule = !!emp.schedule && Object.keys(emp.schedule).length > 0;
                const hasCustomHours = !!emp.work_start && !!emp.work_end;
                const isDefault = !hasSchedule && !hasCustomHours;
                const eff = effHoursMap.get(emp.id) || getEffectiveWorkHours(emp, settings);
                return (
                <tr key={emp.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onOpenEmployee(emp.id)}
                      className="flex items-center gap-3 hover:opacity-80 text-left w-full"
                    >
                      <Avatar name={emp.name} photoUrl={emp.photo_url} size="md" />
                      <div>
                        <p className="font-semibold text-gray-800 hover:text-primary">{emp.name}</p>
                        <p className="text-[10px] text-gray-400 capitalize">{emp.role}</p>
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-sm tracking-wider text-gray-600">
                    {showPins ? emp.pin : "••••••"}
                  </td>
                  <td className="px-4 py-3 text-center text-xs">
                    {emp.role === "admin" ? (
                      <span className="text-gray-300">-</span>
                    ) : eff.off ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 font-medium text-[11px]">
                        Libur Hari Ini
                      </span>
                    ) : (
                      <>
                        <span className={isDefault ? "text-gray-700" : "text-primary font-semibold"}>
                          {eff.start.slice(0, 5)} - {eff.end.slice(0, 5)}
                        </span>
                        {isDefault && (
                          <span className="text-gray-400 block text-[10px]">(default)</span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {emp.role === "admin" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
                        <Shield size={11} /> Admin
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium ${getPositionColor(emp.position)}`}>
                        <UserCircle2 size={11} /> {emp.position || "Karyawan"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-medium ${
                        emp.is_active
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${emp.is_active ? "bg-green-500" : "bg-red-500"}`}></span>
                      {emp.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onExportEmployeeReport(emp)}
                        disabled={reportLoadingId === emp.id}
                        className="group w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition flex items-center justify-center disabled:opacity-50"
                        title={`Download laporan bulanan ${format(new Date(month + "-01"), "MMMM yyyy", { locale: idLocale })}`}
                      >
                        {reportLoadingId === emp.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      </button>
                      <button
                        onClick={() => onOpenResetPin(emp)}
                        className="group w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition flex items-center justify-center"
                        title="Reset PIN"
                      >
                        <Key size={14} />
                      </button>
                      {emp.role !== "admin" && (
                        <>
                          <button
                            onClick={() => onOpenEditProfile(emp)}
                            className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 hover:bg-cyan-600 hover:text-white transition flex items-center justify-center"
                            title="Profile"
                          >
                            <UserCircle2 size={14} />
                          </button>
                          <button
                            onClick={() => onOpenEditHours(emp)}
                            className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white transition flex items-center justify-center"
                            title="Atur Jam Kerja"
                          >
                            <Clock3 size={14} />
                          </button>
                          <button
                            onClick={() => onTestNotif(emp.id, emp.name)}
                            className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white transition flex items-center justify-center"
                            title="Test Notifikasi"
                          >
                            <Bell size={14} />
                          </button>
                          <button
                            onClick={() => onDeleteEmployee(emp)}
                            className="w-8 h-8 rounded-lg transition flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-600 hover:text-white"
                            title="Hapus Karyawan"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y">
          {employees.map((emp) => {
            const hasSchedule = !!emp.schedule && Object.keys(emp.schedule).length > 0;
            const hasCustomHours = !!emp.work_start && !!emp.work_end;
            const isDefault = !hasSchedule && !hasCustomHours;
            const eff = effHoursMap.get(emp.id) || getEffectiveWorkHours(emp, settings);
            return (
              <div key={emp.id} className="p-4">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <button
                    onClick={() => onOpenEmployee(emp.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <Avatar name={emp.name} photoUrl={emp.photo_url} size="md" />
                    <div className="min-w-0">
                      <p className="font-semibold">{emp.name}</p>
                      <p className="text-xs text-gray-500 capitalize">
                        {emp.role} • PIN: {showPins ? emp.pin : "••••••"}
                      </p>
                      {emp.role !== "admin" && (
                        <p className="text-xs mt-0.5">
                          {eff.off ? (
                            <span className="text-gray-400 italic">Libur Hari Ini</span>
                          ) : (
                            <>
                              Jam:{" "}
                              <span className={isDefault ? "text-gray-600" : "text-primary font-medium"}>
                                {eff.start.slice(0, 5)} - {eff.end.slice(0, 5)}
                              </span>
                              {isDefault && <span className="text-gray-400"> (default)</span>}
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  </button>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      emp.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {emp.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => onExportEmployeeReport(emp)}
                    disabled={reportLoadingId === emp.id}
                    className="text-xs px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center gap-1 disabled:opacity-50 col-span-2"
                  >
                    {reportLoadingId === emp.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                    Download Laporan {format(new Date(month + "-01"), "MMM yyyy", { locale: idLocale })}
                  </button>
                  <button
                    onClick={() => onOpenResetPin(emp)}
                    className="text-xs px-3 py-2 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center gap-1"
                  >
                    <Key size={12} /> PIN
                  </button>
                  {emp.role !== "admin" && (
                    <>
                      <button
                        onClick={() => onOpenEditHours(emp)}
                        className="text-xs px-3 py-2 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center gap-1"
                      >
                        <Clock3 size={12} /> Jam
                      </button>
                      <button
                        onClick={() => onDeleteEmployee(emp)}
                        className="col-span-2 text-xs px-3 py-2 rounded-lg bg-red-50 text-red-600 flex items-center justify-center gap-1"
                      >
                        <Trash2 size={12} /> Hapus
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
