"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee, clearEmployee, storeEmployee } from "@/lib/auth";
import { Employee, Attendance, Settings, Announcement } from "@/lib/types";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  LogIn,
  LogOut,
  CalendarDays,
  LayoutGrid,
  Megaphone,
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
  const [monthlyHours, setMonthlyHours] = useState(0);
  const [monthlyDays, setMonthlyDays] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const fetchData = useCallback(async (empId: string) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const startOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");

    const [attRes, setRes, pendingRes, monthRes, annRes] = await Promise.all([
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
      supabase
        .from("attendance")
        .select("clock_in, clock_out")
        .eq("employee_id", empId)
        .gte("date", startOfMonth)
        .lte("date", today),
      supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    setTodayRecord(attRes.data || null);
    if (setRes.data) setSettings(setRes.data);
    setPendingLeaves(pendingRes.count || 0);

    // Calc monthly hours
    let totalMins = 0;
    let presentDays = 0;
    for (const r of monthRes.data || []) {
      if (r.clock_in) presentDays++;
      if (r.clock_in && r.clock_out) {
        totalMins += (new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) / 60000;
      }
    }
    setMonthlyHours(Math.round((totalMins / 60) * 10) / 10);
    setMonthlyDays(presentDays);
    setAnnouncements(annRes.data || []);
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

    // Refresh profile
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
            alert("Akun Anda dinonaktifkan.");
            clearEmployee();
            router.push("/");
          }
        }
      });

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [router, fetchData]);

  // Realtime
  useEffect(() => {
    if (!employee) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const triggerRefetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fetchData(employee.id), 500);
    };

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
        triggerRefetch
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        triggerRefetch
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
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
      {/* Status bar-like header */}
      <div className="bg-gray-50">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-2 flex items-center justify-between">
          <Logo size="sm" />
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 pb-4 space-y-4">
        {/* Greeting */}
        <div className="flex items-center gap-3 pt-2">
          <Avatar name={employee.name} photoUrl={employee.photo_url} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500">{greeting},</p>
            <p className="font-bold text-gray-800 truncate">{employee.name}</p>
          </div>
        </div>

        {/* Shift Card - Talenta-style */}
        <div className="bg-primary rounded-3xl overflow-hidden shadow-lg">
          <div className="px-5 py-3 text-center text-white text-sm font-medium">
            Jadwal shift untuk {format(currentTime, "EEE, dd MMM yyyy", { locale: idLocale })}
          </div>
          <div className="bg-red-50 pt-5 pb-5 px-5 rounded-t-3xl">
            {isOffDay ? (
              <div className="text-center py-3">
                <CalendarDays size={36} className="text-purple-500 mx-auto mb-2" />
                <p className="font-bold text-lg text-purple-700">Hari Libur</p>
                <p className="text-xs text-gray-500 mt-1">Bukan jadwal kerja Anda hari ini</p>
              </div>
            ) : (
              <>
                <p className="text-center text-gray-700 font-semibold">HO</p>
                <p className="text-center text-2xl font-bold text-gray-900 mt-1">
                  {effHours?.start.slice(0, 5)} - {effHours?.end.slice(0, 5)}
                </p>

                {/* Clock in / out buttons - side by side with divider */}
                <div className="mt-5 bg-white rounded-full border border-gray-200 flex items-center overflow-hidden shadow-sm">
                  <button
                    onClick={() => router.push("/absen")}
                    disabled={alreadyClockedIn}
                    className={`flex-1 py-3 flex items-center justify-center gap-2 font-semibold text-sm transition ${
                      alreadyClockedIn ? "text-gray-300 cursor-not-allowed" : "text-primary hover:bg-red-50"
                    }`}
                  >
                    <LogIn size={18} /> Clock in
                  </button>
                  <div className="w-px h-6 bg-gray-200" />
                  <button
                    onClick={() => router.push("/absen")}
                    disabled={!alreadyClockedIn || alreadyClockedOut}
                    className={`flex-1 py-3 flex items-center justify-center gap-2 font-semibold text-sm transition ${
                      !alreadyClockedIn || alreadyClockedOut
                        ? "text-gray-300 cursor-not-allowed"
                        : "text-red-600 hover:bg-red-50"
                    }`}
                  >
                    <LogOut size={18} /> Clock out
                  </button>
                </div>

                {/* Status text - show clock in + clock out times */}
                {alreadyClockedIn && (
                  <div className="mt-3 space-y-1">
                    <p className="text-center text-sm text-gray-600">
                      Anda telah berhasil clock in pada pukul{" "}
                      <span className="font-semibold text-green-600">
                        {format(new Date(todayRecord!.clock_in!), "HH:mm")}
                      </span>
                    </p>
                    {alreadyClockedOut && (
                      <p className="text-center text-sm text-gray-600">
                        Clock out pada pukul{" "}
                        <span className="font-semibold text-red-600">
                          {format(new Date(todayRecord!.clock_out!), "HH:mm")}
                        </span>
                      </p>
                    )}
                  </div>
                )}

                {/* Belum clock in info */}
                {!alreadyClockedIn && (
                  <p className="text-center text-sm text-gray-500 mt-3">
                    Anda belum clock in hari ini
                  </p>
                )}
              </>
            )}
          </div>
        </div>


        {/* Monthly Stats Banner */}
        <div className="bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <LayoutGrid size={100} />
          </div>
          <p className="text-xs text-white/80 mb-1">Rangkuman Bulan Ini</p>
          <div className="flex items-end gap-6 mt-2">
            <div>
              <p className="text-3xl font-bold">{monthlyDays}</p>
              <p className="text-xs text-white/80">Hari hadir</p>
            </div>
            <div className="h-10 w-px bg-white/30" />
            <div>
              <p className="text-3xl font-bold">{monthlyHours}</p>
              <p className="text-xs text-white/80">Jam kerja</p>
            </div>
          </div>
        </div>

        {/* Pengumuman */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Megaphone size={16} className="text-primary" /> Pengumuman
            </h3>
            {announcements.length > 3 && (
              <button className="text-xs text-primary font-medium">Lihat semua</button>
            )}
          </div>
          {announcements.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
              <Megaphone size={28} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Belum ada pengumuman</p>
              <p className="text-xs text-gray-400 mt-1">
                Pengumuman dari admin akan muncul di sini
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {announcements.slice(0, 3).map((a) => {
                const colors = {
                  normal: "border-l-blue-400 bg-white",
                  important: "border-l-amber-500 bg-amber-50",
                  urgent: "border-l-red-500 bg-red-50",
                }[a.priority || "normal"];
                return (
                  <div
                    key={a.id}
                    className={`rounded-2xl shadow-sm border-l-4 p-4 ${colors}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-semibold text-sm text-gray-800">{a.title}</p>
                      {a.priority === "urgent" && (
                        <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                          PENTING
                        </span>
                      )}
                      {a.priority === "important" && (
                        <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                          INFO
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 whitespace-pre-wrap">{a.body}</p>
                    <p className="text-[10px] text-gray-400 mt-2">
                      {format(new Date(a.created_at), "dd MMM yyyy • HH:mm", { locale: idLocale })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>

      <BottomNav />
    </div>
  );
}

