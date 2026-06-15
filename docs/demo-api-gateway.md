# Demo: Invoke API via WSO2 API Gateway

Panduan untuk mendemokan pemanggilan API melalui WSO2 API Gateway SPLP menggunakan `curl`.

- **Gateway URL**: `https://api.dev-indonesia.com`
- **Format**: `https://api.dev-indonesia.com{context}{resource}`
- **Auth**: Bearer Token (OAuth2). Untuk PoC, security level API di-set agar token tidak divalidasi ketat — token dummy pun diterima.

---

## 1. Persiapan

### 1.1 Pastikan domain ter-resolve

Jika dijalankan dari laptop, tambahkan ke `/etc/hosts` (jika belum):

```bash
echo '127.0.0.1 api.dev-indonesia.com apim.dev-indonesia.com' | sudo tee -a /etc/hosts
```

> Atau gunakan VPN NetBird agar domain ter-resolve otomatis ke server.

### 1.2 (Opsional) Dapatkan Bearer Token asli

Untuk demo dengan token nyata, ambil token via DevPortal atau client credentials:

```bash
# Ganti CLIENT_ID dan CLIENT_SECRET dari aplikasi di DevPortal
curl -k -X POST 'https://apim.dev-indonesia.com/oauth2/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials' \
  --user '<CLIENT_ID>:<CLIENT_SECRET>'
```

Simpan token ke variable agar mudah dipakai:

```bash
export TOKEN="<access_token>"
```

> **Untuk demo cepat**, token dummy sudah cukup: `export TOKEN="demo-token"`

---

## 2. Format Response

Semua endpoint mengembalikan format JSON terbungkus (envelope) yang konsisten:

```json
{
  "request_id": "bae32bf3-f54d-407c-85fa-4d32e68cdf04",
  "timestamp": "2026-06-15T04:24:44.122Z",
  "status": "SUCCESS",
  "source": "SPLP-MOCK",
  "gateway": "WSO2 API Manager 4.3.0",
  "trace_id": "73D9600CB034454E",
  "data": { ... }
}
```

Field `data` berisi payload spesifik per layanan.

---

## 3. Daftar Endpoint & Contoh `curl`

### 3.1 Verifikasi NIK (Dukcapil)

```bash
curl -k -X POST 'https://api.dev-indonesia.com/dukcapil/v2/verify-nik' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"nik":"3201234567890001","nama":"Ahmad Fauzi"}'
```

### 3.2 Data Kependudukan (Dukcapil)

```bash
curl -k -X GET 'https://api.dev-indonesia.com/dukcapil/v2/data/data-kependudukan' \
  -H "Authorization: Bearer $TOKEN"
```

### 3.3 Status Kepesertaan BPJS Kesehatan

```bash
curl -k -X POST 'https://api.dev-indonesia.com/bpjs-kes/v1/kepesertaan' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"nik":"3201234567890001","jenis":"JKN"}'
```

### 3.4 Tagihan BPJS Kesehatan

```bash
curl -k -X GET 'https://api.dev-indonesia.com/bpjs-kes/v1/tagihan/tagihan' \
  -H "Authorization: Bearer $TOKEN"
```

### 3.5 Verifikasi NPWP (DJP)

```bash
curl -k -X POST 'https://api.dev-indonesia.com/djp/v3/verify-npwp' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"npwp":"12.345.678.9-012.345"}'
```

### 3.6 Status Pajak Badan (DJP)

```bash
curl -k -X GET 'https://api.dev-indonesia.com/djp/v2/status-badan' \
  -H "Authorization: Bearer $TOKEN"
```

### 3.7 Verifikasi JHT (BPJS Ketenagakerjaan)

```bash
curl -k -X POST 'https://api.dev-indonesia.com/bpjs-tk/v1/kepesertaan-jht' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"nik":"3201234567890001","kpj":"TK12345678"}'
```

### 3.8 Data STNK/BPKB (POLRI)

```bash
curl -k -X POST 'https://api.dev-indonesia.com/polri/v1/kendaraan' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"no_polisi":"B1234ABC","no_rangka":"MHFXX3BE3AJ000001"}'
```

### 3.9 Data Bansos Penerima (Kemensos)

```bash
curl -k -X GET 'https://api.dev-indonesia.com/kemensos/v1/bansos' \
  -H "Authorization: Bearer $TOKEN"
```

### 3.10 Rekam Medis Elektronik (Kemenkes)

```bash
curl -k -X GET 'https://api.dev-indonesia.com/kemenkes/v2/rekam-medis' \
  -H "Authorization: Bearer $TOKEN"
```

### 3.11 Status WNI/WNA (Imigrasi/Kemenkumham)

```bash
curl -k -X POST 'https://api.dev-indonesia.com/imigrasi/v1/status-wni' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"nik":"3201234567890001","jenis":"WNI"}'
```

### 3.12 Data Perizinan Usaha (Kemendagri)

```bash
curl -k -X GET 'https://api.dev-indonesia.com/kemendagri/v1/perizinan' \
  -H "Authorization: Bearer $TOKEN"
```

---

## 4. Skrip Demo (Jalankan Semua Sekaligus)

Salin dan jalankan blok berikut untuk mendemokan **seluruh 12 endpoint** secara berurutan:

```bash
#!/usr/bin/env bash
TOKEN="${TOKEN:-demo-token}"
GW="https://api.dev-indonesia.com"

call() {
  local label="$1" method="$2" url="$3" body="$4"
  echo ""
  echo "=================================================="
  echo " $label  [$method]"
  echo " $url"
  echo "=================================================="
  if [ "$method" = "GET" ]; then
    curl -sk -X GET "$url" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
  else
    curl -sk -X "$method" "$url" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d "$body" | python3 -m json.tool
  fi
}

call "Verifikasi NIK"            POST "$GW/dukcapil/v2/verify-nik"            '{"nik":"3201234567890001","nama":"Ahmad Fauzi"}'
call "Data Kependudukan"         GET  "$GW/dukcapil/v2/data/data-kependudukan" ''
call "Status Kepesertaan BPJS"   POST "$GW/bpjs-kes/v1/kepesertaan"           '{"nik":"3201234567890001","jenis":"JKN"}'
call "Tagihan BPJS Kesehatan"    GET  "$GW/bpjs-kes/v1/tagihan/tagihan"       ''
call "Verifikasi NPWP"           POST "$GW/djp/v3/verify-npwp"                '{"npwp":"12.345.678.9-012.345"}'
call "Status Pajak Badan"        GET  "$GW/djp/v2/status-badan"               ''
call "Verifikasi JHT"            POST "$GW/bpjs-tk/v1/kepesertaan-jht"        '{"nik":"3201234567890001","kpj":"TK12345678"}'
call "Data STNK/BPKB"            POST "$GW/polri/v1/kendaraan"                '{"no_polisi":"B1234ABC","no_rangka":"MHFXX3BE3AJ000001"}'
call "Data Bansos Penerima"      GET  "$GW/kemensos/v1/bansos"                ''
call "Rekam Medis Elektronik"    GET  "$GW/kemenkes/v2/rekam-medis"           ''
call "Status WNI/WNA"            POST "$GW/imigrasi/v1/status-wni"            '{"nik":"3201234567890001","jenis":"WNI"}'
call "Data Perizinan Usaha"      GET  "$GW/kemendagri/v1/perizinan"           ''

echo ""
echo "✅ Demo selesai — 12 endpoint diuji."
```

Simpan sebagai `demo-curl.sh` lalu jalankan:

```bash
chmod +x demo-curl.sh
TOKEN="demo-token" ./demo-curl.sh
```

---

## 5. Troubleshooting

| Gejala | Penyebab | Solusi |
|--------|----------|--------|
| `404 Not Found` | API belum di-deploy ke gateway, atau baru saja deploy (sync asinkron) | Jalankan `scripts/05b-deploy-apim-gateway.sh`, tunggu ~60 detik |
| `404 Not Found` (URL pakai versi) | API sudah default version | Gunakan URL tanpa versi: `/dukcapil/v2/verify-nik` |
| `308 Permanent Redirect` | Memakai `http://` | Gunakan `https://` |
| `502 Bad Gateway` | Ingress salah port | Pastikan ingress `api.dev-indonesia.com` → port `8243` |
| Semua API hilang setelah restart | Database H2 ephemeral | Register + deploy ulang (lihat README §API Gateway) |

---

## 6. Catatan Arsitektur

```
Client (curl)
   │  HTTPS
   ▼
nginx ingress  (TLS termination, Host: api.dev-indonesia.com)
   │  HTTPS (backend-protocol: HTTPS) → port 8243
   ▼
WSO2 APIM Gateway (Synapse, vhost: api.dev-indonesia.com)
   │  HTTP
   ▼
splp-backend (mock)  http://splp-backend.splp.svc.cluster.local:3002
```

Gateway mem-validasi routing berdasarkan **vhost** (`host = api.dev-indonesia.com` di `deployment.toml`)
dan **context path**. Backend mengembalikan data mock dengan envelope `SPLP-MOCK`.
