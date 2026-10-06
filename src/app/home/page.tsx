"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getStoredEmployee, clearEmployee, storeEmployee } from "@/lib/auth";
import { useToast } from "@/components/Toast";
import { Employee, Attendance, Settings, Announcement } from "@/lib/types";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  MapPin,
  Calendar,
  LayoutGrid,
  Megaphone,
  ChevronRight,
  Bell,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import BottomNav from "@/components/BottomNav";
import { getEffectiveWorkHours } from "@/lib/workHours";
import { canAccessTasks } from "@/lib/permissions";

export default function HomePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [todayRecord, setTodayRecord] = useState<Attendance | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [monthlyHours, setMonthlyHours] = useState(0);
  const [monthlyDays, setMonthlyDays] = useState(0);
  const [monthlyLate, setMonthlyLate] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const fetchData = useCallback(async (empId: string) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const startOfMonth = format(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      "yyyy-MM-dd"
    );

    const [attRes, setRes, monthRes, annRes] = await Promise.all([
      supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", empId)
        .eq("date", today)
        .maybeSingle(),
      supabase.from("settings").select("*").single(),
      supabase
        .from("attendance")
        .select("clock_in, clock_out, status")
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

    let totalMins = 0;
    let presentDays = 0;
    let lateDays = 0;
    for (const r of monthRes.data || []) {
      if (r.clock_in) presentDays++;
      if (r.status === "late") lateDays++;
      if (r.clock_in && r.clock_out) {
        totalMins +=
          (new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) /
          60000;
      }
    }
    setMonthlyHours(Math.round(totalMins / 60));
    setMonthlyDays(presentDays);
    setMonthlyLate(lateDays);
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
            toast("Akun Anda dinonaktifkan.", "error");
            clearEmployee();
            router.push("/");
          }
        }
      });
  }, [router, fetchData, toast]);

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

  if (!employee) return <HomeSkeleton />;

  const hour = new Date().getHours();
  const greeting =
    hour < 11
      ? "Selamat pagi"
      : hour < 15
        ? "Selamat siang"
        : hour < 18
          ? "Selamat sore"
          : "Selamat malam";

  const effHours = settings ? getEffectiveWorkHours(employee, settings) : null;
  const isOffDay = effHours?.off === true;
  const alreadyClockedIn = !!todayRecord?.clock_in;
  const alreadyClockedOut = !!todayRecord?.clock_out;

  const clockInTime = todayRecord?.clock_in
    ? format(new Date(todayRecord.clock_in), "HH:mm")
    : null;
  const clockOutTime = todayRecord?.clock_out
    ? format(new Date(todayRecord.clock_out), "HH:mm")
    : null;

  const isLate =
    alreadyClockedIn && effHours && !isOffDay
      ? new Date(todayRecord!.clock_in!).getHours() * 60 +
          new Date(todayRecord!.clock_in!).getMinutes() >
        parseInt(effHours.start.split(":")[0]) * 60 +
          parseInt(effHours.start.split(":")[1]) +
          5
      : false;

  const statusKey = isOffDay
    ? "libur"
    : !alreadyClockedIn
      ? "belum"
      : isLate
        ? "terlambat"
        : "hadir";

  const BADGE_MAP: Record<string, { cls: string; label: string }> = {
    hadir: { cls: "rw-badge--success", label: "Hadir" },
    terlambat: { cls: "rw-badge--danger", label: "Terlambat" },
    belum: { cls: "rw-badge--warning", label: "Belum" },
    libur: { cls: "rw-badge--neutral", label: "Libur" },
  };
  const badge = BADGE_MAP[statusKey];

  const todayFormatted = format(new Date(), "EEEE, d MMMM", {
    locale: idLocale,
  });
  const monthName = format(new Date(), "MMMM", { locale: idLocale });
  const firstName = employee.name.split(" ")[0];

  return (
    <div className="min-h-screen" style={{ background: "var(--surface-100)" }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between"
        style={{ padding: "20px 16px 0" }}
      >
        <div className="flex items-center gap-3">
          <Avatar name={employee.name} photoUrl={employee.photo_url} size="md" />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                lineHeight: "18px",
                color: "var(--ink)",
              }}
              className="truncate"
            >
              {employee.name}
            </div>
            <div
              style={{
                fontSize: 12,
                lineHeight: "16px",
                color: "var(--ink-muted)",
              }}
            >
              {employee.position || "Staff"} · Thamrin City
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push("/inbox")}
          className="relative"
          style={{
            all: "unset",
            cursor: "pointer",
            width: 44,
            height: 44,
            display: "grid",
            placeItems: "center",
            borderRadius: "var(--radius-md)",
            color: "var(--ink)",
            flexShrink: 0,
          }}
          aria-label="Inbox"
        >
          <Bell size={20} />
        </button>
      </div>

      {/* Hero greeting */}
      <div style={{ padding: "32px 16px 24px" }}>
        <p className="rw-micro" style={{ color: "var(--gold-text)", marginBottom: 6 }}>
          {todayFormatted}
        </p>
        <h1 className="rw-display">
          {greeting},
          <br />
          {firstName}
        </h1>
        {!alreadyClockedIn && (
          <p style={{ color: "var(--ink-muted)", fontSize: 15, marginTop: 8 }}>
            Kamu belum clock in hari ini.
          </p>
        )}
        {alreadyClockedIn && alreadyClockedOut && (
          <p style={{ color: "var(--ink-muted)", fontSize: 15, marginTop: 8 }}>
            Shift selesai. Terima kasih untuk hari ini.
          </p>
        )}
      </div>

      {/* Staggered content */}
      <div className="flex flex-col gap-6" style={{ padding: "0 16px" }}>
        {/* Shift card */}
        {isOffDay ? (
          <div className="rw-shift">
            <div
              style={{ padding: "20px 20px 16px" }}
              className="flex items-center justify-between"
            >
              <div>
                <p className="rw-micro">Hari ini</p>
                <p
                  style={{
                    fontWeight: 600,
                    fontSize: 24,
                    lineHeight: "28px",
                    marginTop: 4,
                    color: "var(--ink-muted)",
                  }}
                >
                  Hari Libur
                </p>
              </div>
              <span className={`rw-badge ${badge.cls}`}>{badge.label}</span>
            </div>
          </div>
        ) : (
          <div className="rw-shift">
            <div
              style={{ padding: "20px 20px 16px" }}
              className="flex items-start justify-between gap-3"
            >
              <div>
                <p className="rw-micro">
                  Shift hari ini · {format(new Date(), "EEE, d MMM", { locale: idLocale })}
                </p>
                <p
                  style={{
                    fontWeight: 600,
                    fontSize: 32,
                    lineHeight: "36px",
                    letterSpacing: "-0.02em",
                    fontVariantNumeric: "tabular-nums",
                    marginTop: 4,
                  }}
                >
                  {effHours?.start.slice(0, 5)}{" "}
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 400,
                      color: "var(--ink-muted)",
                      letterSpacing: 0,
                    }}
                  >
                    – {effHours?.end.slice(0, 5)}
                  </span>
                </p>
              </div>
              <span className={`rw-badge ${badge.cls}`}>{badge.label}</span>
            </div>

            {/* GPS line */}
            <div
              className="flex items-center gap-1.5"
              style={{
                padding: "0 20px 16px",
                fontSize: 12,
                lineHeight: "16px",
                color: "var(--ink-muted)",
              }}
            >
              <MapPin size={14} />
              Thamrin City
            </div>

            {/* Clock in / out split */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1px 1fr",
                borderTop: "1px solid var(--line)",
              }}
            >
              <button
                onClick={() => router.push("/absen")}
                disabled={alreadyClockedIn}
                style={{
                  all: "unset",
                  cursor: alreadyClockedIn ? "default" : "pointer",
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  textAlign: "center",
                }}
              >
                <b
                  style={{
                    fontWeight: 500,
                    fontSize: 14,
                    lineHeight: "20px",
                    color: alreadyClockedIn ? "var(--ink-muted)" : "var(--wine)",
                  }}
                >
                  Clock In
                </b>
                <span
                  style={{
                    fontSize: 12,
                    lineHeight: "16px",
                    color: "var(--ink-muted)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {clockInTime || "Belum"}
                </span>
              </button>
              <div style={{ background: "var(--line)" }} />
              <button
                onClick={() => router.push("/absen")}
                disabled={!alreadyClockedIn || alreadyClockedOut}
                style={{
                  all: "unset",
                  cursor:
                    !alreadyClockedIn || alreadyClockedOut ? "default" : "pointer",
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  textAlign: "center",
                }}
              >
                <b
                  style={{
                    fontWeight: 500,
                    fontSize: 14,
                    lineHeight: "20px",
                    color:
                      !alreadyClockedIn || alreadyClockedOut
                        ? "var(--ink-muted)"
                        : "var(--wine)",
                  }}
                >
                  Clock Out
                </b>
                <span
                  style={{
                    fontSize: 12,
                    lineHeight: "16px",
                    color: "var(--ink-muted)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {clockOutTime || "Belum"}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Monthly stats */}
        <div className="flex flex-col gap-2">
          <p className="rw-micro">{monthName} · rekap kamu</p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            <div className="rw-stat" style={{ padding: 12 }}>
              <p className="rw-micro">Hadir</p>
              <p
                className="rw-stat__value"
                style={{ fontSize: 24, lineHeight: "28px" }}
              >
                {monthlyDays}
              </p>
            </div>
            <div className="rw-stat" style={{ padding: 12 }}>
              <p className="rw-micro">Telat</p>
              <p
                className="rw-stat__value"
                style={{ fontSize: 24, lineHeight: "28px" }}
              >
                {monthlyLate}
              </p>
            </div>
            <div className="rw-stat" style={{ padding: 12 }}>
              <p className="rw-micro">Jam</p>
              <p
                className="rw-stat__value"
                style={{ fontSize: 24, lineHeight: "28px" }}
              >
                {monthlyHours}
              </p>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div
          style={{
            background: "var(--surface-200)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-hairline)",
            overflow: "hidden",
          }}
        >
          <button
            className="rw-li"
            onClick={() => router.push("/riwayat")}
            style={{ width: "100%" }}
          >
            <span className="ico-circ">
              <Calendar size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 15, lineHeight: "20px" }}>
                Riwayat absen
              </div>
              <div
                style={{
                  fontSize: 12,
                  lineHeight: "16px",
                  color: "var(--ink-muted)",
                  marginTop: 2,
                }}
              >
                Foto, jam, dan lokasi tiap hari
              </div>
            </div>
            <ChevronRight size={18} style={{ color: "var(--ink-muted)" }} />
          </button>

          {canAccessTasks(employee) && (
            <button
              className="rw-li"
              onClick={() => router.push("/tasks")}
              style={{ width: "100%", borderTop: "1px solid var(--line)" }}
            >
              <span className="ico-circ">
                <LayoutGrid size={18} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 15, lineHeight: "20px" }}>
                  Task Board
                </div>
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: "16px",
                    color: "var(--ink-muted)",
                    marginTop: 2,
                  }}
                >
                  Tugas aktif untuk kamu
                </div>
              </div>
              <ChevronRight size={18} style={{ color: "var(--ink-muted)" }} />
            </button>
          )}
        </div>

        {/* Announcements */}
        <div>
          <div
            className="flex items-baseline justify-between gap-3"
            style={{ marginBottom: 12 }}
          >
            <h2 className="rw-title">Pengumuman</h2>
          </div>

          {announcements.length === 0 ? (
            <div className="rw-card" style={{ textAlign: "center", padding: "32px 20px" }}>
              <Megaphone
                size={28}
                style={{ color: "var(--ink-muted)", margin: "0 auto 8px" }}
              />
              <p style={{ fontSize: 14, color: "var(--ink-muted)" }}>
                Belum ada pengumuman
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {announcements.slice(0, 3).map((a) => {
                const priorityLabel =
                  a.priority === "urgent"
                    ? "Penting"
                    : a.priority === "important"
                      ? "Info"
                      : "Info";
                const priorityColor =
                  a.priority === "urgent"
                    ? "var(--wine)"
                    : "var(--ink-muted)";
                return (
                  <div key={a.id} className="rw-card">
                    <p
                      className="rw-micro"
                      style={{ color: priorityColor, marginBottom: 4 }}
                    >
                      {priorityLabel}
                    </p>
                    <h3
                      style={{
                        fontWeight: 600,
                        fontSize: 17,
                        lineHeight: "24px",
                        margin: 0,
                      }}
                    >
                      {a.title}
                    </h3>
                    <p
                      style={{
                        color: "var(--ink-muted)",
                        fontSize: 14,
                        lineHeight: "20px",
                        marginTop: 6,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {a.body}
                    </p>
                    <hr
                      style={{
                        height: 1,
                        background: "var(--line)",
                        border: 0,
                        margin: "16px 0",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        lineHeight: "16px",
                        color: "var(--ink-muted)",
                      }}
                    >
                      {format(new Date(a.created_at), "d MMM yyyy", {
                        locale: idLocale,
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="min-h-screen pb-28" style={{ background: "var(--surface-100)" }}>
      <div className="max-w-lg mx-auto" style={{ padding: "20px 16px" }}>
        <div className="flex items-center gap-3">
          <div
            className="rw-skel"
            style={{ width: 40, height: 40, borderRadius: "50%" }}
          />
          <div className="flex-1 flex flex-col gap-2">
            <div className="rw-skel" style={{ height: 14, width: "60%" }} />
            <div className="rw-skel" style={{ height: 10, width: "35%" }} />
          </div>
        </div>
        <div style={{ marginTop: 32 }}>
          <div className="rw-skel" style={{ height: 20, width: "40%", marginBottom: 8 }} />
          <div className="rw-skel" style={{ height: 36, width: "70%" }} />
        </div>
        <div className="rw-skel" style={{ height: 160, width: "100%", marginTop: 24, borderRadius: "var(--radius-lg)" }} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            marginTop: 16,
          }}
        >
          <div className="rw-skel" style={{ height: 80, borderRadius: "var(--radius-lg)" }} />
          <div className="rw-skel" style={{ height: 80, borderRadius: "var(--radius-lg)" }} />
          <div className="rw-skel" style={{ height: 80, borderRadius: "var(--radius-lg)" }} />
        </div>
      </div>
    </div>
  );
}
