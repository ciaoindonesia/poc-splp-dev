# Demo PoC: Saluran Akses Aman (VPN) — NetBird

> **Requirement**: Saluran Akses Aman (VPN)  
> 1. Topologi Akses Jaringan Aman  
> 2. Arsitektur Infrastruktur dan Aplikasi VPN  
> 3. Management akses policy IP (source & destinasi) dan User

---

## Konsep Demo

Skenario yang didemonstrasikan adalah **Scenario B: Machine-to-Machine VPN** — koneksi aman antara server instansi (Dukcapil) dengan platform SPLP untuk pertukaran data.

```
┌─────────────────────┐          ┌─────────────────────────┐
│  Laptop Demo        │          │  Server SPLP            │
│  (sebagai Instansi  │◄────────►│  172.105.122.119        │
│   Dukcapil)         │  WireGuard  NetBird IP: 100.64.x.x │
│  NetBird IP:        │  Encrypted  │                       │
│  100.64.x.x         │  P2P Tunnel │  SPLP Backend :30802  │
└─────────────────────┘          │  SPLP Portal  :443      │
                                 │  WSO2 APIM    :30009    │
                                 └─────────────────────────┘
                                          ▲
                                          │
                                 ┌────────┴────────┐
                                 │ NetBird Mgmt    │
                                 │ netbird.dev-    │
                                 │ indonesia.com   │
                                 │ (Access Policy  │
                                 │  + Audit Log)   │
                                 └─────────────────┘
```

---

## Persiapan (Dilakukan Sebelum Demo)

### A. Deploy NetBird Management Server di Server

```bash
# Di server: 172.105.122.119
cd ~/poc-splp-dev

# Start NetBird Management + Signal + Dashboard
docker compose -f netbird/docker-compose.yml up -d

# Verifikasi
docker compose -f netbird/docker-compose.yml ps
```

**Output yang diharapkan:**
```
NAME         STATUS    PORTS
coturn       running   3478/udp
signal       running   0.0.0.0:10000->10000/tcp
management   running   0.0.0.0:33073->33073/tcp
dashboard    running   0.0.0.0:8088->80/tcp
```

### B. Akses Dashboard NetBird

Buka browser: **https://netbird.dev-indonesia.com** (atau `http://172.105.122.119:8088`)

Login dengan akun admin yang dibuat saat pertama kali setup.

### C. Buat Setup Keys

Di dashboard NetBird → **Setup Keys** → **Create Setup Key**:

| Key Name | Type | Expiry | Groups |
|----------|------|--------|--------|
| `splp-server-key` | One-off | 30 hari | SPLP-Server |
| `instansi-dukcapil-key` | Reusable | 30 hari | Instansi-Dukcapil |
| `instansi-bpjs-key` | Reusable | 30 hari | Instansi-BPJS |

### D. Buat Groups

Di dashboard → **Groups** → **Create Group**:
- `SPLP-Server` — server platform SPLP
- `Instansi-Dukcapil` — peer dari instansi Dukcapil
- `Instansi-BPJS` — peer dari instansi BPJS
- `Admin-SPLP` — administrator

### E. Buat Access Policy

Di dashboard → **Access Control** → **Create Policy**:

**Policy 1: Instansi → SPLP API**
```
Nama    : instansi-to-splp-api
Source  : Instansi-Dukcapil, Instansi-BPJS
Dest    : SPLP-Server
Protocol: TCP
Ports   : 443, 3002, 30802
Action  : Allow
```

**Policy 2: Admin → All**
```
Nama    : admin-full-access
Source  : Admin-SPLP
Dest    : All
Protocol: All
Action  : Allow
```

### F. Enroll Server SPLP sebagai Peer

```bash
# Di server
curl -fsSL https://pkgs.netbird.io/install.sh | sh

netbird up \
  --management-url https://netbird.dev-indonesia.com:33073 \
  --setup-key <splp-server-key> \
  --hostname "splp-server"

# Cek IP NetBird yang didapat
netbird status
```

**Output:**
```
OS: linux/amd64
Daemon version: 0.x.x
CLI version: 0.x.x
Management: Connected to https://netbird.dev-indonesia.com:33073
Signal: Connected
Relays: Connected
NetBird IP: 100.64.0.1/16  ← catat IP ini
Interface type: Kernel WireGuard
```

---

## Langkah Demo (Step-by-Step)

### Step 1 — Tunjukkan Topologi Jaringan

**Buka NetBird Dashboard → Peers**

Tunjukkan:
- `splp-server` sudah terdaftar dengan IP `100.64.0.1`
- Status: 🟢 Connected
- OS, versi WireGuard, last seen

**Kalimat demo:**
> "Ini adalah NetBird Management Server yang kami self-host. Setiap instansi yang ingin mengakses API SPLP harus terdaftar sebagai peer di sini. Komunikasi menggunakan WireGuard — protokol VPN modern yang lebih ringan dari OpenVPN namun lebih aman."

---

### Step 2 — Enroll Laptop sebagai Peer "Dukcapil"

**Di laptop demo (bukan server):**

```bash
# Install NetBird client di laptop
curl -fsSL https://pkgs.netbird.io/install.sh | sh

# Connect sebagai "instansi-dukcapil"
netbird up \
  --management-url https://netbird.dev-indonesia.com:33073 \
  --setup-key <instansi-dukcapil-key> \
  --hostname "dukcapil-server"

# Cek status
netbird status
```

**Output di laptop:**
```
NetBird IP: 100.64.0.2/16
Peers:
  splp-server    100.64.0.1   ✓ Connected
```

**Buka NetBird Dashboard** — tunjukkan kedua peer sudah terhubung dan terlihat di peta jaringan.

**Kalimat demo:**
> "Server Dukcapil sekarang sudah masuk ke jaringan SPLP. Koneksi ini terenkripsi end-to-end menggunakan WireGuard, langsung P2P antara dua server tanpa melewati server perantara."

---

### Step 3 — Demonstrasi Akses API via VPN

#### 3a. Tanpa VPN — Akses Langsung (Public Internet)

```bash
# Di laptop — SEBELUM connect VPN (jalankan dengan netbird down)
netbird down

# Coba akses API SPLP langsung via public IP
curl -v --connect-timeout 5 \
  "http://172.105.122.119:30802/health"

# → Berhasil (karena NodePort public) tapi tidak terenkripsi
# → Identitas caller tidak diketahui
```

#### 3b. Dengan VPN — Akses via Encrypted Tunnel

```bash
# Connect VPN kembali
netbird up --setup-key <instansi-dukcapil-key>

# Akses API via NetBird virtual IP (BUKAN public IP)
SPLP_VPN_IP="100.64.0.1"  # IP NetBird server

# Health check
curl "http://${SPLP_VPN_IP}:30802/health"
```

**Output:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-06-13T12:00:00.000Z"
}
```

```bash
# Query data exchange (simulasi Dukcapil → SPLP)
curl -X GET \
  "http://${SPLP_VPN_IP}:30802/api/exchange/messages?limit=5" \
  -H "Content-Type: application/json"
```

**Kalimat demo:**
> "Perhatikan — saya menggunakan IP `100.64.0.1` bukan IP publik server. Traffic ini mengalir melalui tunnel WireGuard yang terenkripsi. Dari perspektif jaringan, Dukcapil dan SPLP berada dalam satu network private yang aman."

---

### Step 4 — Tunjukkan Access Policy Management

**Buka NetBird Dashboard → Access Control**

Tunjukkan policy yang sudah dibuat:

```
┌────────────────────────────────────────────────────────────┐
│ Policy: instansi-to-splp-api                  ● ENABLED    │
├────────────────────────────────────────────────────────────┤
│ Source Groups  : Instansi-Dukcapil, Instansi-BPJS          │
│ Destination    : SPLP-Server                               │
│ Protocol       : TCP                                       │
│ Ports          : 443, 3002, 30802                          │
│ Action         : ✅ Allow                                  │
└────────────────────────────────────────────────────────────┘
```

#### Demo: Blokir Akses (Disable Policy)

```bash
# Di dashboard: Disable policy "instansi-to-splp-api"
# Atau hapus peer "dukcapil-server" dari group Instansi-Dukcapil
```

```bash
# Di laptop — coba akses lagi
curl --connect-timeout 5 "http://${SPLP_VPN_IP}:30802/health"
# → Connection timeout ← akses diblokir!
```

```bash
# Di dashboard: Re-enable policy
# Di laptop — akses kembali berhasil
curl "http://${SPLP_VPN_IP}:30802/health"
# → {"status":"ok",...} ✅
```

**Kalimat demo:**
> "Ini adalah management policy berbasis group. Jika Dukcapil melanggar SLA atau ada insiden keamanan, akses bisa dicabut dalam hitungan detik — tanpa harus mengubah konfigurasi firewall atau server."

---

### Step 5 — Tunjukkan Audit Log

**Buka NetBird Dashboard → Activity / Audit Log**

```
╔══════════════════════════════════════════════════════════════╗
║ ACTIVITY LOG                                                 ║
╠══════════════════════════════════════════════════════════════╣
║ 12:05:23 │ peer.login    │ dukcapil-server  │ 100.64.0.2    ║
║ 12:05:25 │ peer.connect  │ splp-server      │ ✓ established ║
║ 12:08:11 │ policy.update │ admin@splp.go.id │ disabled      ║
║ 12:08:45 │ peer.timeout  │ dukcapil-server  │ blocked       ║
║ 12:09:02 │ policy.update │ admin@splp.go.id │ re-enabled    ║
╚══════════════════════════════════════════════════════════════╝
```

**Kalimat demo:**
> "Semua aktivitas tercatat — siapa yang connect, kapan, perubahan policy apa yang dilakukan dan oleh siapa. Ini memenuhi requirement audit trail untuk sistem pertukaran data pemerintah."

---

### Step 6 — Tunjukkan Multi-Instansi

**Di dashboard → Peers** — tambahkan peer instansi lain:

```bash
# Laptop/server kedua — simulasi BPJS Kesehatan
netbird up \
  --management-url https://netbird.dev-indonesia.com:33073 \
  --setup-key <instansi-bpjs-key> \
  --hostname "bpjs-server"
```

**Tunjukkan di dashboard:**
- `splp-server` — 100.64.0.1 — Group: SPLP-Server
- `dukcapil-server` — 100.64.0.2 — Group: Instansi-Dukcapil
- `bpjs-server` — 100.64.0.3 — Group: Instansi-BPJS

Tunjukkan **Network Map** di dashboard — visualisasi peer-to-peer mesh.

**Kalimat demo:**
> "Setiap instansi punya tunnel tersendiri. Dukcapil tidak bisa mengakses jaringan BPJS, dan sebaliknya. Isolasi jaringan antar instansi terjamin secara kriptografis."

---

## Ringkasan Poin Penilaian

| Requirement | Yang Didemonstrasikan | Status |
|-------------|----------------------|--------|
| **Topologi Akses Jaringan Aman** | WireGuard P2P mesh, setiap instansi isolated | ✅ |
| **Arsitektur Infrastruktur VPN** | NetBird self-hosted: Management + Signal + TURN | ✅ |
| **Management Policy IP Source** | Access Control by source group (Dukcapil/BPJS) | ✅ |
| **Management Policy IP Dest** | Restrict destination ke SPLP-Server ports 443/3002 | ✅ |
| **Management User** | User/peer enrollment via setup key + group | ✅ |
| **Audit Trail** | Activity log semua koneksi dan perubahan policy | ✅ |
| **Revoke Access** | Disable policy → immediate block (demo langsung) | ✅ |

---

## Catatan Teknis

### Perbedaan PoC vs Production

| Aspek | PoC (sekarang) | Production |
|-------|----------------|-----------|
| IdP | Built-in / simple token | WSO2 IS (SSO/OIDC) |
| TURN server | Coturn di server yang sama | Dedicated coturn cluster |
| HA | Single instance | Multi-region management |
| PKI | Self-signed | Enterprise CA |
| Enrollment | Manual setup key | Automated via API |

### Integrasi dengan WSO2 IS (untuk Production)

NetBird bisa dikonfigurasi menggunakan WSO2 IS sebagai IdP (OIDC):

```json
// management.json - tambahkan
"HttpConfig": {
  "OIDCConfigEndpoint": "https://is.dev-indonesia.com/oauth2/oidcdiscovery/.well-known/openid-configuration",
  "AuthAudience": "netbird-client-id",
  "AuthIssuer": "https://is.dev-indonesia.com/oauth2/token"
}
```

Dengan ini, user login ke NetBird menggunakan akun WSO2 IS yang sama dengan portal SPLP.

---

## Troubleshooting

### Peer tidak bisa connect

```bash
# Cek status NetBird
netbird status

# Cek apakah signal server reachable
nc -vz netbird.dev-indonesia.com 10000

# Cek firewall — buka port yang diperlukan
# UDP 51820 (WireGuard)
# TCP 10000 (signal)
# TCP/UDP 33073 (management)
# UDP 3478 (STUN/TURN)
```

### Tunnel terbentuk tapi traffic tidak mengalir

```bash
# Cek routing tabel WireGuard
wg show

# Ping via NetBird IP
ping 100.64.0.1

# Cek policy di dashboard — pastikan policy "Allow" sudah aktif
```
