import { randomBetween, generateId } from './utils'

export interface ExchangeEvent {
  id: string
  timestamp: string
  type: 'sync' | 'async'
  source: string
  target: string
  api: string
  status: 'success' | 'error' | 'pending'
  latency: number
  dataSize: number
  transactionId: string
  topic?: string
}

export interface KafkaMessage {
  id: string
  timestamp: string
  topic: string
  partition: number
  offset: number
  source: string
  target: string
  type: string
  payloadSize: number
  status: 'delivered' | 'pending' | 'failed'
}

const SOURCES = ['Kemensos', 'DJP', 'BPJS Kesehatan', 'Kemendikbud', 'Kemenhub', 'Kemenaker', 'POLRI', 'PPATK']
const TARGETS = ['Dukcapil', 'Kemendagri', 'BPJS Ketenagakerjaan', 'DJP', 'Kemenkes']
const APIS = ['Verifikasi NIK', 'Data Kependudukan', 'Status BPJS', 'Verifikasi NPWP', 'Data Bansos', 'Data STNK']
const TOPICS = ['splp.data.exchange', 'dukcapil.nik.verify', 'bpjs.kepesertaan', 'djp.npwp.verify', 'kemensos.bansos', 'splp.audit.logs']

export function generateExchangeEvent(): ExchangeEvent {
  const status = Math.random() > 0.05 ? 'success' : (Math.random() > 0.5 ? 'error' : 'pending')
  return {
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: Math.random() > 0.4 ? 'sync' : 'async',
    source: SOURCES[randomBetween(0, SOURCES.length - 1)],
    target: TARGETS[randomBetween(0, TARGETS.length - 1)],
    api: APIS[randomBetween(0, APIS.length - 1)],
    status,
    latency: status === 'success' ? randomBetween(50, 450) : randomBetween(500, 3000),
    dataSize: randomBetween(128, 8192),
    transactionId: `TXN-${generateId()}`,
    topic: Math.random() > 0.5 ? TOPICS[randomBetween(0, TOPICS.length - 1)] : undefined,
  }
}

export function generateKafkaMessage(): KafkaMessage {
  return {
    id: generateId(),
    timestamp: new Date().toISOString(),
    topic: TOPICS[randomBetween(0, TOPICS.length - 1)],
    partition: randomBetween(0, 2),
    offset: randomBetween(10000, 999999),
    source: SOURCES[randomBetween(0, SOURCES.length - 1)],
    target: TARGETS[randomBetween(0, TARGETS.length - 1)],
    type: ['DATA_REQUEST', 'DATA_RESPONSE', 'NOTIFICATION', 'AUDIT_LOG'][randomBetween(0, 3)],
    payloadSize: randomBetween(256, 4096),
    status: Math.random() > 0.03 ? 'delivered' : 'failed',
  }
}

export function generateHourlyData() {
  const hours = []
  const now = new Date()
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now)
    d.setHours(d.getHours() - i, 0, 0, 0)
    hours.push({
      time: d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      sync: randomBetween(200, 2000),
      async: randomBetween(100, 1500),
      error: randomBetween(0, 50),
    })
  }
  return hours
}

export function generateDailyData() {
  const days = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    days.push({
      date: d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
      total: randomBetween(5000, 25000),
      success: randomBetween(4800, 24500),
      error: randomBetween(10, 200),
    })
  }
  return days
}

export function generateAgencyTrafficData() {
  return SOURCES.map(s => ({
    name: s,
    value: randomBetween(1000, 15000),
    fill: `hsl(${randomBetween(0, 360)}, 70%, 55%)`,
  }))
}

export function generateLatencyData() {
  return [
    { range: '0-50ms', count: randomBetween(200, 800) },
    { range: '50-100ms', count: randomBetween(1000, 3000) },
    { range: '100-200ms', count: randomBetween(2000, 5000) },
    { range: '200-500ms', count: randomBetween(500, 2000) },
    { range: '500ms+', count: randomBetween(10, 100) },
  ]
}

export const INITIAL_EVENTS: ExchangeEvent[] = Array.from({ length: 20 }, generateExchangeEvent)
  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
