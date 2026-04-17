"use client";

import { useEffect } from "react";

export default function TasksError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Tasks page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50/30 to-indigo-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">⚠️</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Ada kendala</h2>
        <p className="text-sm text-gray-600 mb-4">
          Task Board sedang error. Coba muat ulang atau kembali ke beranda.
        </p>
        {error.message && (
          <p className="text-xs text-gray-400 mb-4 break-words font-mono bg-gray-50 p-2 rounded-lg">
            {error.message.slice(0, 200)}
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-dark transition"
          >
            Coba Lagi
          </button>
          <a
            href="/home"
            className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition"
          >
            Beranda
          </a>
        </div>
      </div>
    </div>
  );
}
