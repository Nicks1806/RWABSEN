import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

// Send push notification to employee(s)
// POST body: { employee_id?: string, employee_ids?: string[], title, body, url? }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employee_id, employee_ids, title, body: msgBody, url } = body;

    if (!title || !msgBody) {
      return NextResponse.json({ error: "Missing title or body" }, { status: 400 });
    }

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    let vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@redwine.com";

    if (!vapidPublic || !vapidPrivate) {
      return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
    }

    // Auto-fix VAPID_SUBJECT: must be URL (mailto: or https://)
    if (!vapidSubject.startsWith("mailto:") && !vapidSubject.startsWith("http")) {
      // Looks like plain email → prepend mailto:
      vapidSubject = vapidSubject.includes("@") ? `mailto:${vapidSubject}` : `mailto:admin@redwine.com`;
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get subscriptions for target employees
    const targetIds: string[] = employee_ids || (employee_id ? [employee_id] : []);

    let query = supabase.from("push_subscriptions").select("*");
    if (targetIds.length > 0) {
      query = query.in("employee_id", targetIds);
    }

    const { data: subs, error: fetchErr } = await query;
    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0, reason: "No subscriptions found" });
    }

    const payload = JSON.stringify({
      title,
      body: msgBody,
      url: url || "/absen",
      timestamp: Date.now(),
    });

    // Send in parallel
    const results = await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
          return { ok: true, endpoint: sub.endpoint };
        } catch (err: unknown) {
          const e = err as { statusCode?: number };
          // Remove invalid subscriptions
          if (e.statusCode === 404 || e.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
          return { ok: false, endpoint: sub.endpoint, error: String(err) };
        }
      })
    );

    const sent = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
    const failed = results.length - sent;

    return NextResponse.json({ sent, failed, total: results.length });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
