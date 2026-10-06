"use client";

import type { FormEvent } from "react";
import type { DayKey } from "@/lib/types";
import { DAY_ORDER, DAY_LABELS } from "@/lib/workHours";
import { QrCode, FileText as FileTextIcon } from "lucide-react";

interface SettingsForm {
  office_lat: string;
  office_lng: string;
  radius_meters: string;
  work_start: string;
  work_end: string;
}

interface Props {
  settingsForm: SettingsForm;
  setSettingsForm: (f: SettingsForm) => void;
  workDays: DayKey[];
  setWorkDays: (d: DayKey[] | ((prev: DayKey[]) => DayKey[])) => void;
  qrRequired: boolean;
  setQrRequired: (v: boolean) => void;
  onSave: (e: FormEvent) => void;
  settingsMsg: string;
  month: string;
}

export default function SettingsTab({
  settingsForm, setSettingsForm, workDays, setWorkDays,
  qrRequired, setQrRequired, onSave, settingsMsg, month,
}: Props) {
  return (
    <>
      <form onSubmit={onSave} className="bg-white rounded-2xl p-5 shadow-sm space-y-4 max-w-lg">
        <h3 className="font-semibold text-gray-700">Pengaturan Absensi</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Latitude Kantor</label>
            <input
              type="text"
              value={settingsForm.office_lat}
              onChange={(e) => setSettingsForm({ ...settingsForm, office_lat: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Longitude Kantor</label>
            <input
              type="text"
              value={settingsForm.office_lng}
              onChange={(e) => setSettingsForm({ ...settingsForm, office_lng: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Radius (meter)</label>
          <input
            type="number"
            value={settingsForm.radius_meters}
            onChange={(e) => setSettingsForm({ ...settingsForm, radius_meters: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Jam Masuk</label>
            <input
              type="time"
              value={settingsForm.work_start}
              onChange={(e) => setSettingsForm({ ...settingsForm, work_start: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Jam Pulang</label>
            <input
              type="time"
              value={settingsForm.work_end}
              onChange={(e) => setSettingsForm({ ...settingsForm, work_end: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">
            Hari Kerja Default
          </label>
          <p className="text-[11px] text-gray-400 mb-2">
            Hari yang tidak dicentang = hari libur (karyawan tidak perlu absen)
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {DAY_ORDER.map((day) => {
              const active = workDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setWorkDays((prev: DayKey[]) =>
                      active ? prev.filter((d: DayKey) => d !== day) : [...prev, day]
                    );
                  }}
                  className={`py-2 rounded-lg text-xs font-medium transition ${
                    active
                      ? "bg-primary text-white shadow-sm"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }`}
                >
                  {DAY_LABELS[day].slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between bg-gradient-to-r from-primary/5 to-amber-50 rounded-xl p-3 border border-amber-200">
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <QrCode size={14} /> Wajib Scan QR Code
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Karyawan harus scan QR di kantor sebelum bisa clock-in
            </p>
            <p className="text-[10px] text-primary mt-1">
              Tampilkan QR di <strong>Menu QR Code</strong> (pojok kanan atas)
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={qrRequired}
              onChange={(e) => setQrRequired(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 peer-checked:bg-primary rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>

        <button
          type="submit"
          className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition text-sm"
        >
          Simpan Pengaturan
        </button>
        {settingsMsg && (
          <p className="text-sm text-green-600">{settingsMsg}</p>
        )}
      </form>

      <div className="bg-white rounded-2xl p-5 shadow-sm mt-4 max-w-lg">
        <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <FileTextIcon size={16} /> Google Sheets Live Sync
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Sinkronkan data absensi ke Google Sheets pakai formula <code className="bg-gray-100 px-1 rounded text-[10px]">=IMPORTDATA()</code>.
          Data auto-update setiap 1 jam.
        </p>
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-600">Langkah:</p>
          <ol className="text-xs text-gray-600 list-decimal list-inside space-y-1">
            <li>Set env <code className="bg-white px-1 rounded">CSV_EXPORT_KEY</code> di Vercel (nilai bebas, jadikan password)</li>
            <li>Di Google Sheets, cell A1 ketik formula:</li>
          </ol>
          <div className="bg-gray-900 text-green-400 text-[10px] p-2 rounded font-mono break-all">
            =IMPORTDATA(&quot;https://absensiredwine.vercel.app/api/attendance-csv?month={month}&amp;key=YOUR_SECRET&quot;)
          </div>
          <p className="text-[10px] text-gray-400">
            Ganti YOUR_SECRET dengan nilai env, dan {"{month}"} dengan format yyyy-MM (misal: 2026-04)
          </p>
        </div>
      </div>
    </>
  );
}
