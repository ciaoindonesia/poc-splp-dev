# SPLP 2026 — Proof of Concept

Platform Pertukaran Data Pemerintah (SPLP) — PoC untuk demo integrasi layanan antar instansi.

## Stack

| Komponen | Teknologi |
|----------|-----------|
| Frontend Portal | React + Vite + TailwindCSS |
| Backend API | Node.js + Express |
| API Management | WSO2 API Manager 4.7.0 |
| Identity | WSO2 Identity Server 7.3.0 |
| Streaming | Apache Kafka |
| Analytics DB | ClickHouse |
| Monitoring | Grafana + Prometheus + Loki |
| VPN / Secure Access | NetBird (WireGuard mesh) |
| Container | k3d (Kubernetes in Docker) |

## Setup Cepat

### Prasyarat
- Docker
- [k3d](https://k3d.io) v5+
- kubectl

### 1. Set domain

Edit `domain.conf`, ganti `BASE_DOMAIN` sesuai kebutuhan:

```bash
# Untuk development lokal
BASE_DOMAIN=localhost

# Untuk server PoC (saat ini aktif)
BASE_DOMAIN=dev-indonesia.com

# Untuk server production
BASE_DOMAIN=splp.go.id
```

### 2. Recreate cluster

```bash
bash scripts/recreate-cluster.sh
```

### 3. Ganti domain di kemudian hari

```bash
bash scripts/set-domain.sh dev-indonesia.com
```

## Akses Layanan

| Layanan | URL | Username | Password |
|---------|-----|----------|----------|
| **SPLP Portal** | https://dev-indonesia.com | lihat Akun Demo | — |
| **Backend API** | https://api-backend.dev-indonesia.com | — | — |
| **WSO2 API Gateway** | https://api.dev-indonesia.com | — | Bearer Token |
| **WSO2 APIM Publisher** | https://apim.dev-indonesia.com/publisher | `admin` | `admin` |
| **WSO2 APIM Developer Portal** | https://apim.dev-indonesia.com/devportal | `admin` | `admin` |
| **WSO2 APIM Admin** | https://apim.dev-indonesia.com/admin | `admin` | `admin` |
| **WSO2 APIM Carbon Console** | https://apim.dev-indonesia.com/carbon | `admin` | `admin` |
| **WSO2 Identity Server** | https://is.dev-indonesia.com/console | `admin` | `admin` |
| **Grafana** | https://grafana.dev-indonesia.com | anonymous | — |
| **Prometheus** | internal (monitoring ns) | — | — |
| **Loki API** | https://loki.dev-indonesia.com | — (no auth) | — |
| **NetBird VPN** | https://netbird.dev-indonesia.com | `admin` | setup saat deploy |
| **ClickHouse** | https://clickhouse.dev-indonesia.com | `splp_user` | `splp_pass_2026` |
| **Kafka UI** | https://kafka-ui.dev-indonesia.com | — | — |

### APIM REST API (internal)

| Endpoint | Keterangan |
|----------|-----------|
| `https://apim.dev-indonesia.com/api/am/publisher/v4` | Publisher API |
| `https://apim.dev-indonesia.com/api/am/devportal/v3` | Developer Portal API |
| `https://apim.dev-indonesia.com/oauth2/token` | OAuth2 Token endpoint |
| `https://api.dev-indonesia.com/{context}/{resource}` | API Gateway — invoke API |

### API Gateway — Daftar Endpoint

Semua API di-deploy sebagai **default version**, sehingga URL **tidak perlu** menyertakan versi.
Format: `https://api.dev-indonesia.com{context}{resource}`

| API | Method | URL |
|-----|--------|-----|
| **VerifikasiNIK** | `POST` | `https://api.dev-indonesia.com/dukcapil/v2/verify-nik` |
| **DataKependudukan** | `GET` | `https://api.dev-indonesia.com/dukcapil/v2/data/data-kependudukan` |
| **StatusKepesertaanBPJS** | `POST` | `https://api.dev-indonesia.com/bpjs-kes/v1/kepesertaan` |
| **TagihanBPJSKesehatan** | `GET` | `https://api.dev-indonesia.com/bpjs-kes/v1/tagihan/tagihan` |
| **VerifikasiNPWP** | `POST` | `https://api.dev-indonesia.com/djp/v3/verify-npwp` |
| **StatusPajakBadan** | `GET` | `https://api.dev-indonesia.com/djp/v2/status-badan` |
| **VerifikasiJHT** | `POST` | `https://api.dev-indonesia.com/bpjs-tk/v1/kepesertaan-jht` |
| **DataSTNKBPKB** | `POST` | `https://api.dev-indonesia.com/polri/v1/kendaraan` |
| **DataBansosPenerima** | `GET` | `https://api.dev-indonesia.com/kemensos/v1/bansos` |
| **RekamMedisElektronik** | `GET` | `https://api.dev-indonesia.com/kemenkes/v2/rekam-medis` |
| **StatusWNIWNA** | `POST` | `https://api.dev-indonesia.com/imigrasi/v1/status-wni` |
| **DataPerizinanUsaha** | `GET` | `https://api.dev-indonesia.com/kemendagri/v1/perizinan` |

**Contoh invoke:**

```bash
curl -X POST 'https://api.dev-indonesia.com/dukcapil/v2/verify-nik' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"nik":"3201234567890001","nama":"Ahmad Fauzi"}'
```

> **Catatan deploy API ke gateway**: Database WSO2 APIM (H2) bersifat *ephemeral* — setiap
> pod restart, API perlu diregister & deploy ulang:
> ```bash
> bash scripts/04-register-apim-apis.sh        # register 12 API
> bash scripts/05b-deploy-apim-gateway.sh      # deploy ke gateway
> ```
> Sinkronisasi gateway berlangsung asinkron (~60 detik) setelah deploy.

## Akun Demo

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Administrator |
| `bpjs` | `instansi123` | Operator BPJS Kesehatan |
| `djp` | `instansi123` | Operator DJP |
| `dukcapil` | `instansi123` | Operator Dukcapil |
| `polri` | `instansi123` | Operator POLRI |
| `kemensos` | `instansi123` | Operator Kemensos |
| `kemenkes` | `instansi123` | Operator Kemenkes |
| `kemendagri` | `instansi123` | Operator Kemendagri |
| `kemenkumham` | `instansi123` | Operator Kemenkumham |

## Struktur Direktori

```
poc-splp-dev/
├── apps/
│   ├── splp-portal/     # React frontend
│   └── splp-backend/    # Node.js backend
├── k8s/
│   ├── ingress/         # Nginx ingress (di-generate dari template)
│   ├── splp-apps/       # Portal & backend deployments
│   ├── wso2-apim/       # WSO2 APIM manifests
│   ├── wso2-is/         # WSO2 Identity Server manifests
│   ├── grafana/         # Grafana helm values
│   ├── kafka/           # Strimzi Kafka + Kafka UI
│   ├── clickhouse/      # ClickHouse + init.sql
│   └── cert-manager/    # ClusterIssuer Let's Encrypt
├── scripts/
│   ├── recreate-cluster.sh      # Setup cluster dari nol
│   ├── set-domain.sh            # Ganti domain (patch semua manifest)
│   ├── 04-register-apim-apis.sh # Daftar 12 APIs ke WSO2 APIM
│   ├── 05-setup-https.sh        # Install cert-manager + TLS
│   ├── 06-deploy-kafka.sh       # Deploy Strimzi Kafka + Kafka UI
│   ├── 07-deploy-observability.sh  # Deploy Prometheus + Loki
│   └── 08-setup-netbird-peer.sh    # Setup NetBird VPN peer
└── domain.conf          # Konfigurasi domain (single source of truth)
```

## Demo VPN (Saluran Akses Aman)

Lihat panduan lengkap: [`docs/demo-vpn-netbird.md`](docs/demo-vpn-netbird.md)

```bash
# Start NetBird Management Server (di host, bukan k3d)
docker compose -f netbird/docker-compose.yml up -d

# Enroll server sebagai peer
bash scripts/08-setup-netbird-peer.sh <SETUP_KEY>
```

## Catatan Keamanan

> **PoC only** — password dan credentials di repo ini hanya untuk demo lokal.
> Untuk production, gunakan Kubernetes Secrets atau Vault.
