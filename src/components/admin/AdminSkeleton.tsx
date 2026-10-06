"use client";

function SkelBar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gradient-to-r from-gray-200/70 via-gray-100 to-gray-200/70 rounded-md ${className}`} />;
}

export default function AdminSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <SkelBar className="h-6 w-48" />
            <SkelBar className="h-3 w-32" />
          </div>
          <SkelBar className="h-9 w-24 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[0,1,2,3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <SkelBar className="h-3 w-20 mb-3" />
              <SkelBar className="h-8 w-24 mb-1" />
              <SkelBar className="h-2.5 w-16" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
            <SkelBar className="h-4 w-32" />
            {[0,1,2,3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <SkelBar className="w-10 h-10 rounded-full" />
                <SkelBar className="h-3 flex-1" />
                <SkelBar className="h-5 w-14 rounded-full" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <SkelBar className="h-4 w-40 mb-3" />
            <SkelBar className="h-48 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
