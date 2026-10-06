"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-800">Terjadi Kesalahan</h2>
          <p className="text-sm text-gray-500">
            {this.props.fallbackMessage || "Halaman mengalami error. Coba muat ulang."}
          </p>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre className="text-xs text-left bg-gray-100 rounded-lg p-3 overflow-auto max-h-32 text-red-600">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-full text-sm font-semibold hover:bg-primary-dark transition"
            >
              <RefreshCw size={16} /> Coba Lagi
            </button>
            <button
              onClick={() => (window.location.href = "/home")}
              className="px-5 py-2.5 border border-gray-200 rounded-full text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
            >
              Ke Home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
