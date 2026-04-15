import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Public CSV endpoint - can be imported via Google Sheets IMPORTDATA formula
// Usage: =IMPORTDATA("https://absensiredwine.vercel.app/api/attendance-csv?month=2026-04&key=SECRET")
// Data is protected by a simple secret key

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const month = url.searchParams.get("month"); // "yyyy-MM"
  const key = url.searchParams.get("key");
  const secret = process.env.CSV_EXPORT_KEY;

  // Simple auth
  if (!secret || key !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid month (use yyyy-MM)" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const start = `${month}-01`;
  const [year, m] = month.split("-").map(Number);
  const lastDay = new Date(year, m, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("attendance")
    .select("date, clock_in, clock_out, status, notes, clock_in_lat, clock_in_lng, employees(name)")
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build CSV
  const headers = [
    "Tanggal",
    "Nama",
    "Clock In",
    "Clock Out",
    "Status",
    "Durasi (jam)",
    "Latitude",
    "Longitude",
    "Keterangan",
  ];

  const rows = (data || []).map((r: Record<string, unknown>) => {
    const emp = r.employees as { name?: string } | null;
    const clockIn = r.clock_in ? new Date(r.clock_in as string) : null;
    const clockOut = r.clock_out ? new Date(r.clock_out as string) : null;
    const durationHours =
      clockIn && clockOut
        ? ((clockOut.getTime() - clockIn.getTime()) / 3_600_000).toFixed(2)
        : "";
    const statusLabel =
      r.status === "present"
        ? "Hadir"
        : r.status === "late"
        ? "Terlambat"
        : r.status === "early_leave"
        ? "Pulang Awal"
        : "Tidak Hadir";
    return [
      r.date,
      emp?.name || "",
      clockIn ? clockIn.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "",
      clockOut ? clockOut.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "",
      statusLabel,
      durationHours,
      r.clock_in_lat || "",
      r.clock_in_lng || "",
      (r.notes as string)?.replace(/"/g, '""') || "",
    ];
  });

  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const csv = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "public, max-age=60", // Cache 1 min
    },
  });
}
