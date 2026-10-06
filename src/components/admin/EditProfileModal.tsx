"use client";

import { FormEvent } from "react";
import { Employee } from "@/lib/types";
import Avatar from "@/components/Avatar";
import { X, Briefcase, Phone, Mail } from "lucide-react";
import { POSITIONS } from "@/lib/positions";

interface Props {
  employee: Employee;
  profileForm: { phone: string; email: string; position: string; address: string; join_date: string };
  setProfileForm: (f: Props["profileForm"]) => void;
  profileMsg: string;
  onSave: (e: FormEvent) => void;
  onClose: () => void;
}

export default function EditProfileModal({
  employee,
  profileForm,
  setProfileForm,
  profileMsg,
  onSave,
  onClose,
}: Props) {
  return (
    <div className="rw-overlay flex items-start md:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="rw-card w-full max-w-md my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Avatar name={employee.name} size="md" />
            <div>
              <h3 className="rw-heading" style={{ color: "var(--ink)" }}>{employee.name}</h3>
              <p className="text-xs" style={{ color: "var(--ink-muted)" }}>Profile Karyawan</p>
            </div>
          </div>
          <button onClick={onClose} className="ico-circ" style={{ color: "var(--ink-muted)" }}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={onSave} className="space-y-3">
          <div>
            <label className="block text-xs mb-1 flex items-center gap-1" style={{ color: "var(--ink-muted)" }}>
              <Briefcase size={12} /> Posisi / Role
            </label>
            <input
              type="text"
              value={profileForm.position}
              onChange={(e) => setProfileForm({ ...profileForm, position: e.target.value })}
              placeholder="Pilih atau ketik custom..."
              list="position-suggestions"
              className="rw-input w-full"
            />
            <datalist id="position-suggestions">
              {POSITIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <p className="text-[10px] mt-1" style={{ color: "var(--ink-muted)" }}>
              Pilih dari daftar atau ketik role baru
            </p>
          </div>
          <div>
            <label className="block text-xs mb-1 flex items-center gap-1" style={{ color: "var(--ink-muted)" }}>
              <Phone size={12} /> Nomor HP
            </label>
            <input
              type="tel"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              placeholder="+62..."
              className="rw-input w-full"
            />
          </div>
          <div>
            <label className="block text-xs mb-1 flex items-center gap-1" style={{ color: "var(--ink-muted)" }}>
              <Mail size={12} /> Email
            </label>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              placeholder="nama@email.com"
              className="rw-input w-full"
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--ink-muted)" }}>Alamat</label>
            <textarea
              value={profileForm.address}
              onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
              rows={2}
              className="rw-input w-full"
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--ink-muted)" }}>Tanggal Bergabung</label>
            <input
              type="date"
              value={profileForm.join_date}
              onChange={(e) => setProfileForm({ ...profileForm, join_date: e.target.value })}
              className="rw-input w-full"
            />
          </div>
          {profileMsg && (
            <p className="text-sm" style={{ color: profileMsg.includes("Gagal") ? "var(--danger)" : "var(--success)" }}>
              {profileMsg}
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
