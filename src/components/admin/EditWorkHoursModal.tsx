"use client";

import { FormEvent } from "react";
import { Employee, Settings, DayKey, Schedule } from "@/lib/types";
import { X, Clock3 } from "lucide-react";
import { DAY_ORDER, DAY_LABELS } from "@/lib/workHours";

interface Props {
  employee: Employee;
  editStart: string;
  setEditStart: (v: string) => void;
  editEnd: string;
  setEditEnd: (v: string) => void;
  editHoursMsg: string;
  useCustomSchedule: boolean;
  setUseCustomSchedule: (v: boolean) => void;
  editSchedule: Schedule;
  updateDaySchedule: (day: DayKey, field: "start" | "end" | "off", value: string | boolean) => void;
  setEditSchedule: (s: Schedule) => void;
  settings: Settings | null;
  onSave: (e: FormEvent) => void;
  onClose: () => void;
}

export default function EditWorkHoursModal({
  employee,
  editStart,
  setEditStart,
  editEnd,
  setEditEnd,
  editHoursMsg,
  useCustomSchedule,
  setUseCustomSchedule,
  editSchedule,
  updateDaySchedule,
  setEditSchedule,
  settings,
  onSave,
  onClose,
}: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-5 w-full max-w-md my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Clock3 size={18} /> Jam Kerja - {employee.name}
          </h3>
          <button onClick={onClose} className="text-gray-400">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={onSave} className="space-y-4">
          {/* Toggle custom schedule */}
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
            <div>
              <p className="text-sm font-medium">Jadwal Per Hari</p>
              <p className="text-xs text-gray-500">
                Atur jam masuk berbeda setiap hari & hari libur
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useCustomSchedule}
                onChange={(e) => setUseCustomSchedule(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-checked:bg-primary rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
          </div>

          {!useCustomSchedule ? (
            <>
              <p className="text-xs text-gray-500 bg-amber-50 rounded-lg p-2">
                Jam kerja tunggal berlaku semua hari. Default:{" "}
                <strong>
                  {settings?.work_start} - {settings?.work_end}
                </strong>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Jam Masuk</label>
                  <input
                    type="time"
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Jam Pulang</label>
                  <input
                    type="time"
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                Centang libur untuk hari tidak masuk. Kosong = pakai default.
              </p>
              {DAY_ORDER.map((day) => {
                const ds = editSchedule[day] || {};
                return (
                  <div key={day} className="grid grid-cols-[70px_1fr_1fr_auto] gap-2 items-center text-sm">
                    <span className="font-medium">{DAY_LABELS[day]}</span>
                    <input
                      type="time"
                      value={ds.start || ""}
                      disabled={ds.off}
                      onChange={(e) => updateDaySchedule(day, "start", e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded-md text-xs outline-none focus:ring-1 focus:ring-primary disabled:bg-gray-100"
                    />
                    <input
                      type="time"
                      value={ds.end || ""}
                      disabled={ds.off}
                      onChange={(e) => updateDaySchedule(day, "end", e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded-md text-xs outline-none focus:ring-1 focus:ring-primary disabled:bg-gray-100"
                    />
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!ds.off}
                        onChange={(e) => updateDaySchedule(day, "off", e.target.checked)}
                        className="accent-red-500"
                      />
                      Libur
                    </label>
                  </div>
                );
              })}
            </div>
          )}

          {editHoursMsg && (
            <p
              className={`text-sm ${
                editHoursMsg.includes("Gagal") ? "text-red-600" : "text-green-600"
              }`}
            >
              {editHoursMsg}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setEditStart("");
                setEditEnd("");
                setEditSchedule({});
                setUseCustomSchedule(false);
              }}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              title="Pakai default"
            >
              Reset Default
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark"
            >
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
