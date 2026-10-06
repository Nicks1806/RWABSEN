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
    <div className="rw-overlay flex items-center justify-center p-4" onClick={onClose}>
      <div className="rw-card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="rw-heading" style={{ color: "var(--ink)" }}>Reset PIN</h3>
          <button onClick={onClose} className="ico-circ" style={{ color: "var(--ink-muted)" }}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={onSave} className="space-y-3">
          <div>
            <label className="text-xs" style={{ color: "var(--ink-muted)" }}>Karyawan</label>
            <p className="font-semibold" style={{ color: "var(--ink)" }}>{employee.name}</p>
          </div>
          <div>
            <label className="text-xs" style={{ color: "var(--ink-muted)" }}>PIN Sekarang</label>
            <p className="font-mono text-sm" style={{ color: "var(--ink)" }}>{employee.pin}</p>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--ink-muted)" }}>PIN Baru</label>
            <input
              type="text"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="Masukkan PIN baru"
              className="rw-input w-full"
              required
              autoFocus
            />
          </div>
          {resetPinMsg && (
            <p className="text-sm" style={{ color: resetPinMsg.includes("Gagal") ? "var(--danger)" : "var(--success)" }}>
              {resetPinMsg}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="rw-btn rw-btn--outline flex-1">
              Batal
            </button>
            <button type="submit" className="rw-btn rw-btn--primary flex-1">
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
