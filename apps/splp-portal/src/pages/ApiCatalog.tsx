import { useState, useEffect, useCallback } from 'react'
import { Search, ExternalLink, Lock, Zap, Copy, Loader2, CheckCircle2, XCircle, Plus, Bell, RefreshCw, MessageSquare, FlaskConical } from 'lucide-react'
import { MOCK_APIS, deriveBackendUrl, deriveApiGwUrl, deriveApimUiUrl, deriveKafkaBootstrap } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'

const BACKEND = deriveBackendUrl()

type LifeCycle = 'CREATED' | 'PUBLISHED' | 'DEPRECATED' | 'active' | 'maintenance' | 'created'
interface CatalogApi {
  id: string; name: string; version: string; description: string; agency: string
  category: string; status: string; lifeCycleStatus: LifeCycle; endpoint: string
  method: string; auth: string; rateLimit: string; latency: number; sla: number
  source?: string; icon?: string; sampleRequest?: Record<string, unknown>
}
interface KafkaTopic {
  id: string; name: string; agency: string; description: string
  partitions: number; retention: string; status: string; created: string
}
interface Subscription {
  id: string; itemId: string; itemName: string; itemType: string
  agency: string; agencyName: string; status: 'pending' | 'approved' | 'rejected'
  createdAt: string; updatedAt: string
}

const APIM_URL = deriveApimUiUrl()
const API_GW   = deriveApiGwUrl()
const KAFKA_BS = deriveKafkaBootstrap()

const TAGS = ['Semua', 'Kependudukan', 'Kesehatan', 'Perpajakan', 'Ketenagakerjaan', 'Keamanan', 'Sosial', 'Umum']
const METHODS = ['GET', 'POST', 'PUT', 'DELETE']

const MOCK_ICONS: Record<string, string> = {
  Dukcapil: '🏛️', 'BPJS Kesehatan': '🏥', 'BPJS Ketenagakerjaan': '👷',
  DJP: '💰', POLRI: '🚔', Kemensos: '🤝', Kemenkes: '⚕️', Kemenkumham: '⚖️', Kemendagri: '🏠', SPLP: '🔗',
}

export default function ApiCatalog() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [tab,      setTab]      = useState<'api' | 'kafka' | 'subs'>('api')
  const [search,   setSearch]   = useState('')
  const [tag,      setTag]      = useState('Semua')
  const [selected, setSelected] = useState<CatalogApi | KafkaTopic | null>(null)
  const [copied,   setCopied]   = useState('')

  const [apis,       setApis]       = useState<CatalogApi[]>([])
  const [topics,     setTopics]     = useState<KafkaTopic[]>([])
  const [subs,       setSubs]       = useState<Subscription[]>([])
  const [loadingApi, setLoadingApi] = useState(true)
  const [loadingTop, setLoadingTop] = useState(true)
  const [apiWarn,    setApiWarn]    = useState<string | null>(null)

  const [showRegister, setShowRegister] = useState(false)
  const [showTopic,    setShowTopic]    = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [testing,      setTesting]      = useState(false)
  const [testResult,   setTestResult]   = useState<{ ok: boolean; status: number; latency: number; body: unknown; error?: string } | null>(null)

  const [form, setForm] = useState({ name: '', version: 'v1.0', description: '', agency: user?.agency || '', category: 'Umum', endpoint: '', method: 'POST', auth: 'OAuth2/JWT', rateLimit: '1000 req/min' })
  const [topicForm, setTopicForm] = useState({ name: '', agency: user?.agency || '', description: '', partitions: '3', retention: '7d' })

  const loadApis = useCallback(async () => {
    setLoadingApi(true)
    try {
      const r = await fetch(`${BACKEND}/api/catalog/apis`)
      const d = await r.json()
      const merged = [
        ...MOCK_APIS.map(a => ({ ...a, lifeCycleStatus: 'PUBLISHED' as LifeCycle, source: 'mock' })),
        ...(d.apis || []),
      ]
      setApis(merged)
      if (d.warning) setApiWarn(d.warning)
    } catch { setApis(MOCK_APIS.map(a => ({ ...a, lifeCycleStatus: 'PUBLISHED' as LifeCycle, source: 'mock' }))) }
    finally { setLoadingApi(false) }
  }, [])

  const loadTopics = useCallback(async () => {
    setLoadingTop(true)
    try {
      const r = await fetch(`${BACKEND}/api/catalog/topics`)
      const d = await r.json()
      setTopics(d.topics || [])
    } catch { setTopics([]) }
    finally { setLoadingTop(false) }
  }, [])

  const loadSubs = useCallback(async () => {
    const q = isAdmin ? '' : `?agency=${user?.agency}`
    const r = await fetch(`${BACKEND}/api/catalog/subscriptions${q}`)
    const d = await r.json()
    setSubs(d.subscriptions || [])
  }, [isAdmin, user?.agency])

  useEffect(() => { loadApis(); loadTopics(); loadSubs() }, [loadApis, loadTopics, loadSubs])

  const subscribe = async (item: CatalogApi | KafkaTopic, type: 'api' | 'kafka') => {
    const res = await fetch(`${BACKEND}/api/catalog/subscriptions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, itemName: item.name, itemType: type, agency: user?.agency, agencyName: user?.name }),
    })
    if (res.ok || res.status === 409) loadSubs()
    return res.status
  }

  const approveSub = async (id: string, status: 'approved' | 'rejected') => {
    await fetch(`${BACKEND}/api/catalog/subscriptions/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    loadSubs()
  }

  const publishApi = async (id: string) => {
    const r = await fetch(`${BACKEND}/api/catalog/apis/${id}/publish`, { method: 'POST' })
    if (r.ok) loadApis()
  }

  const registerApi = async () => {
    setSubmitting(true)
    try {
      await fetch(`${BACKEND}/api/catalog/apis`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      setShowRegister(false); loadApis()
    } finally { setSubmitting(false) }
  }

  const addTopic = async () => {
    setSubmitting(true)
    try {
      await fetch(`${BACKEND}/api/catalog/topics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...topicForm, partitions: Number(topicForm.partitions) }) })
      setShowTopic(false); loadTopics()
    } finally { setSubmitting(false) }
  }

  const runTest = async (api: CatalogApi) => {
    setTesting(true); setTestResult(null)
    const t0 = Date.now()
    try {
      const backendMockPath = api.endpoint.replace(/^https?:\/\/[^/]+/, '')
      const res = await fetch(`${BACKEND}/api/mock${backendMockPath}`, {
        method: api.method,
        headers: { 'Content-Type': 'application/json' },
        ...(api.method !== 'GET' && api.sampleRequest ? { body: JSON.stringify(api.sampleRequest) } : {}),
      })
      const body = await res.json()
      setTestResult({ ok: res.ok, status: res.status, latency: Date.now() - t0, body })
    } catch (e: unknown) {
      setTestResult({ ok: false, status: 0, latency: Date.now() - t0, body: null, error: e instanceof Error ? e.message : 'Network error' })
    } finally { setTesting(false) }
  }

  const copyToClipboard = (text: string, key: string) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500) }

  const getSubStatus = (itemId: string) => subs.find(s => s.itemId === itemId && s.agency === user?.agency)?.status
  const pendingCount = subs.filter(s => s.status === 'pending').length

  const filteredApis = apis.filter(a =>
    (tag === 'Semua' || (a as CatalogApi).category === tag) &&
    (a.name.toLowerCase().includes(search.toLowerCase()) || (a as CatalogApi).agency?.toLowerCase().includes(search.toLowerCase()))
  ) as CatalogApi[]

  const filteredTopics = topics.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) || t.agency?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">Katalog API</h2>
          <p className="section-subtitle">API & Kafka Topics yang dikelola via WSO2 APIM 4.3 — <span className="text-splp-600 font-semibold">{API_GW.replace('http://','')}</span></p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button onClick={() => setShowRegister(true)} className="btn-primary text-xs"><Plus size={13} /> Daftar API</button>
              <button onClick={() => setShowTopic(true)} className="btn-secondary text-xs"><MessageSquare size={13} /> Tambah Topic</button>
            </>
          )}
          <button onClick={() => { loadApis(); loadTopics(); loadSubs() }} className="btn-secondary text-xs"><RefreshCw size={13} /></button>
          <a href={APIM_URL} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs"><ExternalLink size={13} /> APIM</a>
        </div>
      </div>

      {apiWarn && <div className="px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">⚠️ {apiWarn}</div>}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {([
          { key: 'api',   label: 'REST APIs',    icon: '🔌' },
          { key: 'kafka', label: 'Kafka Topics',  icon: '📨' },
          { key: 'subs',  label: isAdmin ? `Subscribe (${pendingCount} pending)` : 'Subscription Saya', icon: '🔔' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t.key ? 'bg-white shadow-sm text-splp-700' : 'text-slate-500 hover:text-slate-700'}`}>
            <span>{t.icon}</span>{t.label}
            {t.key === 'subs' && pendingCount > 0 && isAdmin && <span className="w-4 h-4 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center">{pendingCount}</span>}
          </button>
        ))}
      </div>

      {/* Search + Filter (only for api/kafka tabs) */}
      {tab !== 'subs' && (
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder={tab === 'api' ? 'Cari API atau instansi...' : 'Cari topic...'} className="form-input pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {tab === 'api' && (
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map(t => (
                <button key={t} onClick={() => setTag(t)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tag === t ? 'bg-splp-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-splp-300'}`}>{t}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── REST APIs tab ── */}
      {tab === 'api' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {loadingApi ? <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={14} className="animate-spin" /> Memuat dari WSO2 APIM...</div>
              : <p className="text-xs text-slate-400">{filteredApis.length} API ditemukan</p>}
            {filteredApis.map(api => {
              const subStatus = getSubStatus(api.id)
              const isPublished = api.lifeCycleStatus === 'PUBLISHED' || api.status === 'active'
              return (
                <div key={api.id} onClick={() => setSelected(api)}
                  className={`card card-hover cursor-pointer transition-all ${(selected as CatalogApi)?.id === api.id ? 'ring-2 ring-splp-500 bg-splp-50/30' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-splp-50 border border-splp-100 flex items-center justify-center text-lg shrink-0">
                      {api.icon || MOCK_ICONS[api.agency] || '🔌'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-semibold text-sm text-slate-900">{api.name}</h4>
                            {api.source === 'wso2' && <span className="badge text-[9px] bg-indigo-50 text-indigo-600 border-indigo-100">WSO2</span>}
                          </div>
                          <p className="text-xs text-slate-500">{api.agency}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`badge text-[10px] ${isPublished ? 'badge-green' : api.lifeCycleStatus === 'CREATED' ? 'badge-yellow' : 'badge-gray'}`}>
                            {isPublished ? '● Published' : api.lifeCycleStatus === 'CREATED' ? '○ Draft' : api.status}
                          </span>
                          <span className="badge-gray text-[10px]">{api.version}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 truncate">{api.description}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                        <span className="flex items-center gap-1 text-slate-500"><Lock size={10} /> {api.auth}</span>
                        <span className="badge text-[10px] bg-slate-100 text-slate-600">{api.category}</span>
                        {subStatus && <span className={`badge text-[10px] ${subStatus === 'approved' ? 'badge-green' : subStatus === 'pending' ? 'badge-yellow' : 'badge-red'}`}>{subStatus === 'approved' ? '✓ Aktif' : subStatus === 'pending' ? '⏳ Menunggu' : '✕ Ditolak'}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-1">
            {selected && 'endpoint' in selected ? (() => {
              const api = selected as CatalogApi
              const subStatus = getSubStatus(api.id)
              const isPublished = api.lifeCycleStatus === 'PUBLISHED' || api.status === 'active'
              return (
                <div className="card sticky top-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-splp-50 border border-splp-100 flex items-center justify-center text-2xl">{api.icon || MOCK_ICONS[api.agency] || '🔌'}</div>
                    <div><h3 className="font-bold text-slate-900">{api.name}</h3><p className="text-xs text-slate-500">{api.agency}</p></div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {[
                      { label: 'Endpoint', value: api.endpoint },
                      { label: 'Method',   value: api.method },
                      { label: 'Auth',     value: api.auth },
                      { label: 'Rate Limit', value: api.rateLimit },
                      { label: 'Versi',    value: api.version },
                      { label: 'Status',   value: isPublished ? 'Published' : api.lifeCycleStatus },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center py-1.5 border-b border-slate-50">
                        <span className="text-slate-500 font-medium">{r.label}</span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-semibold text-slate-700 text-right truncate max-w-40">{r.value}</span>
                          {r.label === 'Endpoint' && <button onClick={() => copyToClipboard(r.value, 'ep')} className="text-slate-400 hover:text-splp-600"><Copy size={10} /></button>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {api.sampleRequest && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Contoh Request</p>
                      <pre className="terminal text-[10px] overflow-auto">{`curl -X ${api.method} \\\n  '${api.endpoint}' \\\n  -H 'Authorization: Bearer <token>' \\\n  -d '${JSON.stringify(api.sampleRequest, null, 2)}'`}</pre>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    {!isAdmin && isPublished && (
                      subStatus ? (
                        <div className={`text-center text-xs font-semibold py-2 rounded-xl ${subStatus === 'approved' ? 'bg-emerald-50 text-emerald-700' : subStatus === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                          {subStatus === 'approved' ? '✓ Sudah Subscribe & Aktif' : subStatus === 'pending' ? '⏳ Menunggu Persetujuan Admin' : '✕ Subscription Ditolak'}
                        </div>
                      ) : (
                        <button onClick={() => subscribe(api, 'api')} className="btn-primary text-xs justify-center"><Bell size={12} /> Subscribe ke API Ini</button>
                      )
                    )}
                    {isAdmin && !isPublished && api.source !== 'mock' && (
                      <button onClick={() => publishApi(api.id)} className="btn-primary text-xs justify-center"><Zap size={12} /> Publish ke APIM</button>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => runTest(api)} disabled={testing}
                        className="btn-secondary text-xs flex-1 justify-center disabled:opacity-60">
                        {testing ? <Loader2 size={12} className="animate-spin" /> : <FlaskConical size={12} />}
                        {testing ? 'Testing...' : 'Test API'}
                      </button>
                      <a href={APIM_URL} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs"><ExternalLink size={12} /></a>
                    </div>
                  </div>
                  {testResult && (
                    <div className={`rounded-xl border text-xs p-3 space-y-2 ${testResult.ok ? 'border-emerald-100 bg-emerald-50' : 'border-red-100 bg-red-50'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold">
                          {testResult.ok ? <CheckCircle2 size={13} className="text-emerald-600" /> : <XCircle size={13} className="text-red-500" />}
                          <span className={testResult.ok ? 'text-emerald-700' : 'text-red-700'}>
                            {testResult.ok ? `HTTP ${testResult.status} OK` : testResult.error ?? `Error ${testResult.status}`}
                          </span>
                        </div>
                        <span className="text-slate-500 font-mono">{testResult.latency}ms</span>
                      </div>
                      {testResult.body != null && (
                        <pre className="terminal text-[10px] max-h-36 overflow-auto">{JSON.stringify(testResult.body, null, 2)}</pre>
                      )}
                    </div>
                  )}
                </div>
              )
            })() : (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-3">🔌</div>
                <p className="text-sm font-semibold text-slate-700">Pilih API</p>
                <p className="text-xs text-slate-400 mt-1">Klik salah satu API untuk melihat detail</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Kafka Topics tab ── */}
      {tab === 'kafka' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {loadingTop ? <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={14} className="animate-spin" /> Memuat topics...</div>
              : <p className="text-xs text-slate-400">{filteredTopics.length} topic ditemukan</p>}
            {filteredTopics.map(topic => {
              const subStatus = getSubStatus(topic.id)
              return (
                <div key={topic.id} onClick={() => setSelected(topic)}
                  className={`card card-hover cursor-pointer ${(selected as KafkaTopic)?.id === topic.id ? 'ring-2 ring-splp-500 bg-splp-50/30' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-lg shrink-0">📨</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div><h4 className="font-semibold text-sm text-slate-900 font-mono">{topic.name}</h4><p className="text-xs text-slate-500">{topic.agency}</p></div>
                        <span className="badge-green text-[10px]">● Active</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{topic.description}</p>
                      <div className="flex gap-3 mt-2 text-xs text-slate-500">
                        <span>Partitions: <b>{topic.partitions}</b></span>
                        <span>Retention: <b>{topic.retention}</b></span>
                        {subStatus && <span className={`badge text-[10px] ${subStatus === 'approved' ? 'badge-green' : subStatus === 'pending' ? 'badge-yellow' : 'badge-red'}`}>{subStatus === 'approved' ? '✓ Subscribed' : subStatus === 'pending' ? '⏳ Pending' : '✕ Ditolak'}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="lg:col-span-1">
            {selected && 'partitions' in selected ? (() => {
              const topic = selected as KafkaTopic
              const subStatus = getSubStatus(topic.id)
              return (
                <div className="card sticky top-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-2xl">📨</div>
                    <div><h3 className="font-bold text-slate-900 font-mono text-sm">{topic.name}</h3><p className="text-xs text-slate-500">{topic.agency}</p></div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {[
                      { label: 'Topic Name', value: topic.name },
                      { label: 'Instansi',   value: topic.agency },
                      { label: 'Partitions', value: String(topic.partitions) },
                      { label: 'Retention',  value: topic.retention },
                      { label: 'Status',     value: topic.status },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center py-1.5 border-b border-slate-50">
                        <span className="text-slate-500 font-medium">{r.label}</span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-semibold text-slate-700">{r.value}</span>
                          {r.label === 'Topic Name' && <button onClick={() => copyToClipboard(r.value, 'topic')} className="text-slate-400 hover:text-splp-600"><Copy size={10} /></button>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <pre className="terminal text-[10px]">{`# Consume topic\nkafka-console-consumer \\\n  --bootstrap-server ${KAFKA_BS} \\\n  --topic ${topic.name} \\\n  --from-beginning`}</pre>
                  {!isAdmin && (
                    subStatus ? (
                      <div className={`text-center text-xs font-semibold py-2 rounded-xl ${subStatus === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {subStatus === 'approved' ? '✓ Sudah Subscribe' : '⏳ Menunggu Persetujuan'}
                      </div>
                    ) : (
                      <button onClick={() => subscribe(topic, 'kafka')} className="btn-primary text-xs justify-center w-full"><Bell size={12} /> Subscribe Topic</button>
                    )
                  )}
                </div>
              )
            })() : (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-3">📨</div>
                <p className="text-sm font-semibold text-slate-700">Pilih Topic</p>
                <p className="text-xs text-slate-400 mt-1">Klik topic untuk melihat detail</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Subscriptions tab ── */}
      {tab === 'subs' && (
        <div className="space-y-4">
          {subs.length === 0 ? (
            <div className="card flex flex-col items-center py-12 text-center"><div className="text-4xl mb-3">🔔</div><p className="text-sm font-semibold text-slate-700">Belum ada subscription</p><p className="text-xs text-slate-400 mt-1">Subscribe API atau Kafka Topic di tab REST APIs / Kafka Topics</p></div>
          ) : (
            <div className="space-y-3">
              {subs.map(sub => (
                <div key={sub.id} className="card flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{sub.itemType === 'kafka' ? '📨' : '🔌'}</span>
                      <h4 className="font-semibold text-sm text-slate-900">{sub.itemName}</h4>
                      <span className="badge-gray text-[10px]">{sub.itemType === 'kafka' ? 'Kafka' : 'REST API'}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{sub.agencyName} — {sub.agency}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Didaftarkan: {new Date(sub.createdAt).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`badge text-[10px] ${sub.status === 'approved' ? 'badge-green' : sub.status === 'pending' ? 'badge-yellow' : 'badge-red'}`}>
                      {sub.status === 'approved' ? '✓ Disetujui' : sub.status === 'pending' ? '⏳ Pending' : '✕ Ditolak'}
                    </span>
                    {isAdmin && sub.status === 'pending' && (
                      <div className="flex gap-1">
                        <button onClick={() => approveSub(sub.id, 'approved')} className="px-2.5 py-1.5 rounded-lg bg-emerald-500 text-white text-[10px] font-bold hover:bg-emerald-600 transition-colors"><CheckCircle2 size={11} className="inline mr-0.5" />Approve</button>
                        <button onClick={() => approveSub(sub.id, 'rejected')} className="px-2.5 py-1.5 rounded-lg bg-red-500 text-white text-[10px] font-bold hover:bg-red-600 transition-colors"><XCircle size={11} className="inline mr-0.5" />Reject</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Register API Modal ── */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between"><h3 className="font-bold text-slate-900">Daftarkan API Baru ke WSO2 APIM</h3><button onClick={() => setShowRegister(false)} className="text-slate-400 hover:text-slate-700 text-xl">✕</button></div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Nama API *', key: 'name', placeholder: 'Verifikasi NIK' },
                { label: 'Versi *', key: 'version', placeholder: 'v1.0' },
                { label: 'Instansi *', key: 'agency', placeholder: 'Dukcapil' },
                { label: 'Rate Limit', key: 'rateLimit', placeholder: '1000 req/min' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                  <input className="form-input text-xs" placeholder={f.placeholder} value={(form as Record<string, string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Endpoint URL *</label>
                <input className="form-input text-xs" placeholder={`${API_GW}/dukcapil/v1/verify`} value={form.endpoint} onChange={e => setForm(p => ({ ...p, endpoint: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Method</label>
                <select className="form-select text-xs" value={form.method} onChange={e => setForm(p => ({ ...p, method: e.target.value }))}>
                  {METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Kategori</label>
                <select className="form-select text-xs" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {TAGS.filter(t => t !== 'Semua').map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Deskripsi</label>
                <textarea className="form-textarea text-xs" rows={2} placeholder="Deskripsi singkat API..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowRegister(false)} className="btn-secondary text-xs">Batal</button>
              <button onClick={registerApi} disabled={submitting || !form.name || !form.version} className="btn-primary text-xs disabled:opacity-60">
                {submitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Daftarkan & Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Kafka Topic Modal ── */}
      {showTopic && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between"><h3 className="font-bold text-slate-900">Tambahkan Kafka Topic</h3><button onClick={() => setShowTopic(false)} className="text-slate-400 hover:text-slate-700 text-xl">✕</button></div>
            <div className="space-y-3">
              {[
                { label: 'Nama Topic *', key: 'name', placeholder: 'splp.namainstansi.event' },
                { label: 'Instansi *', key: 'agency', placeholder: 'Dukcapil' },
                { label: 'Partitions', key: 'partitions', placeholder: '3' },
                { label: 'Retention', key: 'retention', placeholder: '7d' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                  <input className="form-input text-xs" placeholder={f.placeholder} value={(topicForm as Record<string, string>)[f.key]} onChange={e => setTopicForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Deskripsi</label>
                <textarea className="form-textarea text-xs" rows={2} placeholder="Deskripsi topic..." value={topicForm.description} onChange={e => setTopicForm(p => ({ ...p, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowTopic(false)} className="btn-secondary text-xs">Batal</button>
              <button onClick={addTopic} disabled={submitting || !topicForm.name || !topicForm.agency} className="btn-primary text-xs disabled:opacity-60">
                {submitting ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />} Tambahkan Topic
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
