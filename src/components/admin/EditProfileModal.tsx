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
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-5 w-full max-w-md my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Avatar name={employee.name} size="md" />
            <div>
              <h3 className="font-bold text-gray-800">{employee.name}</h3>
              <p className="text-xs text-gray-500">Profile Karyawan</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={onSave} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1 flex items-center gap-1">
              <Briefcase size={12} /> Posisi / Role
            </label>
            <input
              type="text"
              value={profileForm.position}
              onChange={(e) => setProfileForm({ ...profileForm, position: e.target.value })}
              placeholder="Pilih atau ketik custom..."
              list="position-suggestions"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <datalist id="position-suggestions">
              {POSITIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <p className="text-[10px] text-gray-400 mt-1">
              Pilih dari daftar atau ketik role baru
            </p>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1 flex items-center gap-1">
              <Phone size={12} /> Nomor HP
            </label>
            <input
              type="tel"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              placeholder="+62..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1 flex items-center gap-1">
              <Mail size={12} /> Email
            </label>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              placeholder="nama@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Alamat</label>
            <textarea
              value={profileForm.address}
              onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Tanggal Bergabung</label>
            <input
              type="date"
              value={profileForm.join_date}
              onChange={(e) => setProfileForm({ ...profileForm, join_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {profileMsg && (
            <p className={`text-sm ${profileMsg.includes("Gagal") ? "text-red-600" : "text-green-600"}`}>
              {profileMsg}
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
