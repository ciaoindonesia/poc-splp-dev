# SPLP 2026 — Proof of Concept

Platform Pertukaran Data Pemerintah (SPLP) — PoC untuk demo integrasi layanan antar instansi.

## Stack

| Komponen | Teknologi |
|----------|-----------|
| Frontend Portal | React + Vite + TailwindCSS |
| Backend API | Node.js + Express |
| API Management | WSO2 API Manager 4.3 |
| Identity | WSO2 Identity Server |
| Streaming | Apache Kafka |
| Analytics DB | ClickHouse |
| Monitoring | Grafana |
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
BASE_DOMAIN=pocsplp.com

# Untuk server production
BASE_DOMAIN=splp.go.id
```

### 2. Recreate cluster

```bash
bash scripts/recreate-cluster.sh
```

### 3. Ganti domain di kemudian hari

```bash
bash scripts/set-domain.sh splp.go.id
```

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
│   └── monitoring/      # Grafana & Prometheus
├── scripts/
│   ├── recreate-cluster.sh    # Setup cluster dari nol
│   ├── set-domain.sh          # Ganti domain
│   └── 04-register-apim-apis.sh  # Daftar APIs ke WSO2 APIM
└── domain.conf          # Konfigurasi domain (single source of truth)
```

## Catatan Keamanan

> **PoC only** — password dan credentials di repo ini hanya untuk demo lokal.
> Untuk production, gunakan Kubernetes Secrets atau Vault.
