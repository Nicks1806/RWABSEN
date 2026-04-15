"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee, clearEmployee, storeEmployee } from "@/lib/auth";
import { Employee, Attendance, Settings } from "@/lib/types";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Clock,
  LogIn,
  LogOut,
  CalendarDays,
  History,
  FileText,
  User as UserIcon,
  QrCode,
  Megaphone,
  Bell,
} from "lucide-react";
import Logo from "@/components/Logo";
import Avatar from "@/components/Avatar";
import BottomNav from "@/components/BottomNav";
import { getEffectiveWorkHours } from "@/lib/workHours";

export default function HomePage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [todayRecord, setTodayRecord] = useState<Attendance | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pendingLeaves, setPendingLeaves] = useState(0);

  const fetchData = useCallback(async (empId: string) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const [attRes, setRes, pendingRes] = await Promise.all([
      supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", empId)
        .eq("date", today)
        .maybeSingle(),
      supabase.from("settings").select("*").single(),
      supabase
        .from("leaves")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", empId)
        .eq("status", "pending"),
    ]);

    setTodayRecord(attRes.data || null);
    if (setRes.data) setSettings(setRes.data);
    setPendingLeaves(pendingRes.count || 0);
  }, []);

  useEffect(() => {
    const emp = getStoredEmployee();
    if (!emp) {
      router.push("/");
      return;
    }
    if (emp.role === "admin") {
      router.push("/admin");
      return;
    }

    setEmployee(emp);
    fetchData(emp.id);

    // Refresh employee profile from DB (in case admin updated)
    supabase
      .from("employees")
      .select("*")
      .eq("id", emp.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setEmployee(data);
          storeEmployee(data);
          if (!data.is_active) {
            alert("Akun Anda sudah dinonaktifkan. Hubungi admin.");
            clearEmployee();
            router.push("/");
          }
        }
      });

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [router, fetchData]);

  // Realtime attendance updates
  useEffect(() => {
    if (!employee) return;
    const channel = supabase
      .channel("home-attendance")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance",
          filter: `employee_id=eq.${employee.id}`,
        },
        () => fetchData(employee.id)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [employee, fetchData]);

  if (!employee) return null;

  const hour = currentTime.getHours();
  const greeting =
    hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";

  const effHours = settings ? getEffectiveWorkHours(employee, settings) : null;
  const isOffDay = effHours?.off === true;
  const alreadyClockedIn = !!todayRecord?.clock_in;
  const alreadyClockedOut = !!todayRecord?.clock_out;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Logo size="sm" />
          <button
            onClick={() => router.push("/inbox")}
            className="relative p-2 text-gray-500"
          >
            <Bell size={22} />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-2 pb-4 space-y-4">
        {/* Greeting */}
        <div className="flex items-center gap-3 py-2">
          <Avatar name={employee.name} size="lg" />
          <div>
            <p className="text-sm text-gray-500">{greeting},</p>
            <p className="text-lg font-bold text-gray-800">{employee.name}</p>
          </div>
        </div>

        {/* Shift Card */}
        <div className="bg-gradient-to-br from-primary to-primary-dark rounded-3xl overflow-hidden shadow-lg text-white">
          <div className="px-5 py-3 bg-black/10 backdrop-blur-sm text-center text-sm font-medium">
            Jadwal shift {format(currentTime, "EEEE, dd MMM yyyy", { locale: idLocale })}
          </div>
          <div className="bg-white/95 text-gray-800 p-5">
            {isOffDay ? (
              <div className="text-center py-3">
                <CalendarDays size={32} className="text-purple-500 mx-auto mb-2" />
                <p className="font-bold text-lg text-purple-700">Hari Libur</p>
                <p className="text-xs text-gray-500 mt-1">Hari ini bukan jadwal kerja Anda</p>
              </div>
            ) : (
              <>
                <div className="text-center mb-4">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                    RedWine Office
                  </p>
                  <p className="text-2xl font-bold text-primary mt-1">
                    {effHours?.start.slice(0, 5)} - {effHours?.end.slice(0, 5)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => router.push("/absen")}
                    disabled={alreadyClockedIn}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition ${
                      alreadyClockedIn
                        ? "bg-gray-100 text-gray-400"
                        : "bg-white border-2 border-primary text-primary hover:bg-primary hover:text-white"
                    }`}
                  >
                    <LogIn size={18} /> Clock in
                  </button>
                  <button
                    onClick={() => router.push("/absen")}
                    disabled={!alreadyClockedIn || alreadyClockedOut}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition ${
                      !alreadyClockedIn || alreadyClockedOut
                        ? "bg-gray-100 text-gray-400"
                        : "bg-white border-2 border-red-500 text-red-600 hover:bg-red-500 hover:text-white"
                    }`}
                  >
                    <LogOut size={18} /> Clock out
                  </button>
                </div>
                {(alreadyClockedIn || alreadyClockedOut) && (
                  <div className="mt-3 text-center text-xs text-gray-500">
                    {alreadyClockedIn && (
                      <p>
                        Clock in:{" "}
                        <span className="font-semibold text-green-600">
                          {format(new Date(todayRecord!.clock_in!), "HH:mm")}
                        </span>
                      </p>
                    )}
                    {alreadyClockedOut && (
                      <p>
                        Clock out:{" "}
                        <span className="font-semibold text-orange-600">
                          {format(new Date(todayRecord!.clock_out!), "HH:mm")}
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Quick Menu Grid */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="grid grid-cols-4 gap-3">
            <MenuIcon
              label="Absen"
              icon={<Clock size={22} className="text-white" />}
              bg="bg-blue-500"
              onClick={() => router.push("/absen")}
            />
            <MenuIcon
              label="Pengajuan"
              icon={<FileText size={22} className="text-white" />}
              bg="bg-purple-500"
              onClick={() => router.push("/pengajuan")}
              badge={pendingLeaves}
            />
            <MenuIcon
              label="Riwayat"
              icon={<History size={22} className="text-white" />}
              bg="bg-orange-500"
              onClick={() => router.push("/riwayat")}
            />
            <MenuIcon
              label="Profil"
              icon={<UserIcon size={22} className="text-white" />}
              bg="bg-pink-500"
              onClick={() => router.push("/profile")}
            />
          </div>
        </div>

        {/* Info Card - Jam Kerja */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <QrCode size={16} className="text-primary" />
            <h3 className="font-semibold text-sm text-gray-700">Info Kantor</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Lokasi</span>
              <span className="font-medium text-gray-700">Thamrin City</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Radius absen</span>
              <span className="font-medium text-gray-700">
                {settings?.radius_meters || 100}m
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Jam kerja Anda</span>
              <span className="font-medium text-primary">
                {effHours?.off
                  ? "Libur hari ini"
                  : `${effHours?.start.slice(0, 5)} - ${effHours?.end.slice(0, 5)}`}
              </span>
            </div>
          </div>
        </div>

        {/* Announcement placeholder */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Megaphone size={16} className="text-primary" />
            <h3 className="font-semibold text-sm text-gray-700">Pengumuman</h3>
          </div>
          <div className="text-center py-4 text-xs text-gray-400">
            Belum ada pengumuman
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

function MenuIcon({
  label,
  icon,
  bg,
  onClick,
  badge,
}: {
  label: string;
  icon: React.ReactNode;
  bg: string;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 group">
      <div
        className={`${bg} w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-105 transition relative`}
      >
        {icon}
        {badge && badge > 0 ? (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1 rounded-full min-w-[16px] h-[16px] flex items-center justify-center">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </div>
      <span className="text-[11px] text-gray-600 text-center font-medium">{label}</span>
    </button>
  );
}
