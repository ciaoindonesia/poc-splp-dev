import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function deriveApiGwUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:8280'
  const h = window.location.hostname
  const p = window.location.port ? `:${window.location.port}` : ''
  if (h === 'localhost' || h === '127.0.0.1') return `http://localhost:8280`
  return `http://api.${h}${p}`
}

export function deriveApimUiUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:8080/publisher'
  const h = window.location.hostname
  const p = window.location.port ? `:${window.location.port}` : ''
  if (h === 'localhost' || h === '127.0.0.1') return `http://localhost:8080/publisher`
  return `http://apim.${h}${p}/publisher`
}

export function deriveKafkaBootstrap(): string {
  if (typeof window === 'undefined') return 'localhost:9092'
  const h = window.location.hostname
  if (h === 'localhost' || h === '127.0.0.1') return 'localhost:9092'
  return `api.${h}:9092`
}

export function deriveBackendUrl(): string {
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL
  if (typeof window === 'undefined') return 'http://localhost:3002'
  const h = window.location.hostname
  const p = window.location.port ? `:${window.location.port}` : ''
  if (h === 'localhost' || h === '127.0.0.1') return `http://localhost:3002`
  return `http://api-backend.${h}${p}`
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} MB`
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`
  return `${bytes} B`
}

export function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9).toUpperCase()
}

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function formatTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const AGENCIES = [
  { id: 'dukcapil',   name: 'Dukcapil',              fullName: 'Ditjen Kependudukan & Pencatatan Sipil', ministry: 'Kemendagri',    color: '#3b82f6', icon: '🏛️' },
  { id: 'bpjs-kes',   name: 'BPJS Kesehatan',         fullName: 'Badan Penyelenggara Jaminan Sosial Kesehatan', ministry: 'Kemenkes', color: '#10b981', icon: '🏥' },
  { id: 'bpjs-tk',    name: 'BPJS Ketenagakerjaan',   fullName: 'Badan Penyelenggara Jaminan Sosial Ketenagakerjaan', ministry: 'Kemnaker', color: '#6366f1', icon: '👷' },
  { id: 'djp',        name: 'DJP',                    fullName: 'Direktorat Jenderal Pajak', ministry: 'Kemenkeu',   color: '#f59e0b', icon: '💰' },
  { id: 'kemendagri', name: 'Kemendagri',              fullName: 'Kementerian Dalam Negeri', ministry: 'Kemendagri',  color: '#8b5cf6', icon: '🏠' },
  { id: 'kemenkes',   name: 'Kemenkes',                fullName: 'Kementerian Kesehatan', ministry: 'Kemenkes',   color: '#ec4899', icon: '⚕️' },
  { id: 'kemensos',   name: 'Kemensos',                fullName: 'Kementerian Sosial', ministry: 'Kemensos',   color: '#f97316', icon: '🤝' },
  { id: 'polri',      name: 'POLRI',                   fullName: 'Kepolisian Negara Republik Indonesia', ministry: 'Polri', color: '#14b8a6', icon: '🚔' },
  { id: 'kemenkumham',name: 'Kemenkumham',             fullName: 'Kementerian Hukum dan HAM', ministry: 'Kemenkumham', color: '#6b7280', icon: '⚖️' },
  { id: 'ppatk',      name: 'PPATK',                   fullName: 'Pusat Pelaporan dan Analisis Transaksi Keuangan', ministry: 'PPATK', color: '#ef4444', icon: '🔍' },
]

// Computed once at module load — picks up current hostname automatically
const _gw = deriveApiGwUrl()

export const MOCK_APIS = [
  { id: 'api-001', icon: '🏛️', name: 'Verifikasi NIK', agency: 'Dukcapil', version: 'v2.1', category: 'Kependudukan', calls: 45230, latency: 145, status: 'active', sla: 99.8, auth: 'OAuth2/JWT', method: 'POST', endpoint: `${_gw}/dukcapil/v2/verify-nik`, rateLimit: '1000 req/min', description: 'Verifikasi keaslian Nomor Induk Kependudukan (NIK) warga negara Indonesia via Dukcapil.', sampleRequest: { nik: '3201234567890001', nama: 'Ahmad Fauzi' } },
  { id: 'api-002', icon: '📋', name: 'Data Kependudukan', agency: 'Dukcapil', version: 'v2.0', category: 'Kependudukan', calls: 23100, latency: 210, status: 'active', sla: 99.5, auth: 'OAuth2/JWT', method: 'GET', endpoint: `${_gw}/dukcapil/v2/data-kependudukan`, rateLimit: '500 req/min', description: 'Mengambil data kependudukan lengkap berdasarkan NIK dari basis data Dukcapil.', sampleRequest: { nik: '3201234567890001', fields: ['nama', 'alamat', 'status'] } },
  { id: 'api-003', icon: '🏥', name: 'Status Kepesertaan BPJS', agency: 'BPJS Kesehatan', version: 'v1.5', category: 'Kesehatan', calls: 38900, latency: 180, status: 'active', sla: 99.2, auth: 'API Key + OAuth2', method: 'POST', endpoint: `${_gw}/bpjs-kes/v1/kepesertaan`, rateLimit: '800 req/min', description: 'Cek status kepesertaan dan kelayakan jaminan kesehatan nasional (JKN) BPJS Kesehatan.', sampleRequest: { nik: '3201234567890001', jenis: 'JKN' } },
  { id: 'api-004', icon: '💊', name: 'Tagihan BPJS Kesehatan', agency: 'BPJS Kesehatan', version: 'v1.3', category: 'Kesehatan', calls: 12400, latency: 220, status: 'active', sla: 98.9, auth: 'API Key + OAuth2', method: 'GET', endpoint: `${_gw}/bpjs-kes/v1/tagihan`, rateLimit: '400 req/min', description: 'Mendapatkan informasi tagihan iuran BPJS Kesehatan peserta mandiri.', sampleRequest: { no_peserta: 'BPJ001234567', bulan: '2026-01' } },
  { id: 'api-005', icon: '💰', name: 'Verifikasi NPWP', agency: 'DJP', version: 'v3.0', category: 'Perpajakan', calls: 29800, latency: 165, status: 'active', sla: 99.6, auth: 'OAuth2/JWT', method: 'POST', endpoint: `${_gw}/djp/v3/verify-npwp`, rateLimit: '600 req/min', description: 'Verifikasi keabsahan Nomor Pokok Wajib Pajak (NPWP) orang pribadi atau badan usaha.', sampleRequest: { npwp: '12.345.678.9-012.345' } },
  { id: 'api-006', icon: '📊', name: 'Status Pajak Badan', agency: 'DJP', version: 'v2.2', category: 'Perpajakan', calls: 8700, latency: 195, status: 'active', sla: 99.1, auth: 'OAuth2/JWT', method: 'GET', endpoint: `${_gw}/djp/v2/status-badan`, rateLimit: '300 req/min', description: 'Cek status kepatuhan pajak badan usaha dan riwayat pelaporan SPT.', sampleRequest: { npwp: '12.345.678.9-012.345', tahun: 2025 } },
  { id: 'api-007', icon: '👷', name: 'Verifikasi JHT', agency: 'BPJS Ketenagakerjaan', version: 'v1.4', category: 'Ketenagakerjaan', calls: 18200, latency: 175, status: 'active', sla: 99.3, auth: 'OAuth2/JWT', method: 'POST', endpoint: `${_gw}/bpjs-tk/v1/kepesertaan-jht`, rateLimit: '500 req/min', description: 'Verifikasi kepesertaan Jaminan Hari Tua (JHT) dan Jaminan Kecelakaan Kerja (JKK) BPJS TK.', sampleRequest: { nik: '3201234567890001', kpj: 'TK12345678' } },
  { id: 'api-008', icon: '🚔', name: 'Data STNK/BPKB', agency: 'POLRI', version: 'v1.0', category: 'Keamanan', calls: 15600, latency: 190, status: 'active', sla: 99.4, auth: 'OAuth2/JWT + Signature', method: 'POST', endpoint: `${_gw}/polri/v1/kendaraan`, rateLimit: '400 req/min', description: 'Verifikasi data kendaraan bermotor berdasarkan nomor polisi atau nomor rangka.', sampleRequest: { no_polisi: 'B1234ABC', no_rangka: 'MHFXX3BE3AJ000001' } },
  { id: 'api-009', icon: '🤝', name: 'Data Bansos Penerima', agency: 'Kemensos', version: 'v1.2', category: 'Sosial', calls: 7800, latency: 320, status: 'active', sla: 98.8, auth: 'OAuth2/JWT', method: 'GET', endpoint: `${_gw}/kemensos/v1/bansos`, rateLimit: '200 req/min', description: 'Mengambil data penerima bantuan sosial (PKH, BPNT, BLT) berdasarkan NIK.', sampleRequest: { nik: '3201234567890001', program: 'PKH' } },
  { id: 'api-010', icon: '⚕️', name: 'Rekam Medis Elektronik', agency: 'Kemenkes', version: 'v2.0', category: 'Kesehatan', calls: 3200, latency: 430, status: 'maintenance', sla: 97.2, auth: 'OAuth2/JWT + MFA', method: 'GET', endpoint: `${_gw}/kemenkes/v2/rekam-medis`, rateLimit: '100 req/min', description: 'Akses rekam medis elektronik pasien. Memerlukan consent pasien dan autentikasi multi-faktor.', sampleRequest: { nik: '3201234567890001', faskes_id: 'RS001' } },
  { id: 'api-011', icon: '⚖️', name: 'Status WNI/WNA', agency: 'Kemenkumham', version: 'v1.5', category: 'Kependudukan', calls: 9100, latency: 240, status: 'active', sla: 99.0, auth: 'OAuth2/JWT', method: 'POST', endpoint: `${_gw}/ditjen-imigrasi/v1/status-wni`, rateLimit: '300 req/min', description: 'Verifikasi status kewarganegaraan dan informasi paspor/visa WNI/WNA.', sampleRequest: { nik: '3201234567890001', jenis: 'WNI' } },
  { id: 'api-012', icon: '🏠', name: 'Data Perizinan Usaha', agency: 'Kemendagri', version: 'v1.1', category: 'Sosial', calls: 5600, latency: 280, status: 'active', sla: 98.5, auth: 'OAuth2/JWT', method: 'GET', endpoint: `${_gw}/kemendagri/v1/perizinan`, rateLimit: '200 req/min', description: 'Cek status dan detail perizinan usaha yang diterbitkan oleh pemerintah daerah.', sampleRequest: { nib: '9120105382735' } },
]
