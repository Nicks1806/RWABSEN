"use client";

import { FormEvent } from "react";
import { Employee } from "@/lib/types";
import { X } from "lucide-react";

interface Props {
  employee: Employee;
  newPin: string;
  setNewPin: (v: string) => void;
  resetPinMsg: string;
  onSave: (e: FormEvent) => void;
  onClose: () => void;
}

export default function ResetPinModal({
  employee,
  newPin,
  setNewPin,
  resetPinMsg,
  onSave,
  onClose,
}: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-5 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">Reset PIN</h3>
          <button onClick={onClose} className="text-gray-400">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={onSave} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Karyawan</label>
            <p className="font-semibold">{employee.name}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">PIN Sekarang</label>
            <p className="font-mono text-sm">{employee.pin}</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">PIN Baru</label>
            <input
              type="text"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="Masukkan PIN baru"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
              required
              autoFocus
            />
          </div>
          {resetPinMsg && (
            <p
              className={`text-sm ${
                resetPinMsg.includes("Gagal") ? "text-red-600" : "text-green-600"
              }`}
            >
              {resetPinMsg}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              Batal
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
