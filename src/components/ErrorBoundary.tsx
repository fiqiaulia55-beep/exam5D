import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let displayMessage = error.message || 'Terjadi kesalahan pada aplikasi.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string; path?: string };
      if (parsed && parsed.error) {
        if (parsed.error.includes('Missing or insufficient permissions')) {
          displayMessage =
            'Akses database Firebase ditolak. Pastikan Anda login menggunakan akun Google Guru yang terdaftar dan email terverifikasi.';
        } else {
          displayMessage = parsed.error;
        }
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, message: displayMessage };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught application error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
            <AlertTriangle className="mx-auto h-10 w-10 text-red-600" />
            <h1 className="mt-3 text-lg font-bold text-slate-900">Terjadi Kendala Koneksi Data</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
