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
| **WSO2 APIM Publisher** | https://apim.dev-indonesia.com/publisher | `admin` | `admin` |
| **WSO2 APIM Developer Portal** | https://apim.dev-indonesia.com/devportal | `admin` | `admin` |
| **WSO2 APIM Admin** | https://apim.dev-indonesia.com/admin | `admin` | `admin` |
| **WSO2 APIM Carbon Console** | https://apim.dev-indonesia.com/carbon | `admin` | `admin` |
| **WSO2 Identity Server** | https://is.dev-indonesia.com/console | `admin` | `admin` |
| **Grafana** | https://grafana.dev-indonesia.com | anonymous | — |
| **Prometheus** | internal (monitoring ns) | — | — |
| **Loki API** | https://loki.dev-indonesia.com | — (no auth) | — |
| **ClickHouse** | https://clickhouse.dev-indonesia.com | `splp_user` | `splp_pass_2026` |
| **Kafka UI** | https://kafka-ui.dev-indonesia.com | — | — |

### APIM REST API (internal)

| Endpoint | Keterangan |
|----------|-----------|
| `https://apim.dev-indonesia.com/api/am/publisher/v4` | Publisher API |
| `https://apim.dev-indonesia.com/api/am/devportal/v3` | Developer Portal API |
| `https://apim.dev-indonesia.com/oauth2/token` | OAuth2 Token endpoint |
| `https://apim.dev-indonesia.com/{context}` | API Gateway (via ingress) |

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
│   └── 07-deploy-observability.sh  # Deploy Prometheus + Loki
└── domain.conf          # Konfigurasi domain (single source of truth)
```

## Catatan Keamanan

> **PoC only** — password dan credentials di repo ini hanya untuk demo lokal.
> Untuk production, gunakan Kubernetes Secrets atau Vault.
