#!/usr/bin/env bash
# =============================================================================
# Bootstrap SPLP di server baru (Debian/Ubuntu)
# Jalankan sebagai user non-root dengan sudo access:
#
#   curl -fsSL https://raw.githubusercontent.com/ciaoindonesia/poc-splp-dev/main/scripts/bootstrap-server.sh | bash
#
# Atau setelah clone:
#   bash scripts/bootstrap-server.sh [BASE_DOMAIN] [REPO_URL]
#
# Contoh:
#   bash scripts/bootstrap-server.sh dev-indonesia.com
# =============================================================================
set -euo pipefail

BASE_DOMAIN="${1:-dev-indonesia.com}"
REPO_URL="${2:-https://github.com/ciaoindonesia/poc-splp-dev.git}"
PROJECT_DIR="$HOME/poc-splp-dev"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
section() { echo -e "\n${GREEN}==================================================${NC}"; echo -e "${GREEN} $*${NC}"; echo -e "${GREEN}==================================================${NC}"; }

section "SPLP Bootstrap — $BASE_DOMAIN"
echo "  Server : $(hostname -f 2>/dev/null || hostname)"
echo "  User   : $(whoami)"
echo "  Dir    : $PROJECT_DIR"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# [1] Install dependencies
# ─────────────────────────────────────────────────────────────────────────────
section "1/6  Install dependencies"

info "Update apt..."
sudo apt-get update -qq

info "Install: git, curl, wget, ca-certificates, socat..."
sudo apt-get install -y -qq \
  git curl wget ca-certificates \
  socat apt-transport-https gnupg lsb-release

# Docker
if ! command -v docker &>/dev/null; then
  info "Install Docker..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$(whoami)"
  info "Docker installed — grup docker ditambahkan untuk user $(whoami)"
  warn "Anda perlu re-login agar grup docker aktif. Script akan lanjut dengan sudo docker."
  DOCKER_CMD="sudo docker"
else
  info "Docker sudah terinstall: $(docker --version 2>/dev/null || sudo docker --version)"
  DOCKER_CMD="docker"
  # pastikan user ada di grup docker
  if ! groups | grep -q docker; then
    sudo usermod -aG docker "$(whoami)"
    DOCKER_CMD="sudo docker"
  fi
fi

# kubectl
if ! command -v kubectl &>/dev/null; then
  info "Install kubectl..."
  KUBECTL_VERSION=$(curl -fsSL https://dl.k8s.io/release/stable.txt)
  curl -fsSL "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl" \
    -o /tmp/kubectl
  sudo install -o root -g root -m 0755 /tmp/kubectl /usr/local/bin/kubectl
  info "kubectl installed: $(kubectl version --client --short 2>/dev/null || kubectl version --client)"
else
  info "kubectl sudah terinstall"
fi

# k3d
if ! command -v k3d &>/dev/null; then
  info "Install k3d..."
  curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash
  info "k3d installed: $(k3d version)"
else
  info "k3d sudah terinstall: $(k3d version | head -1)"
fi

# helm
if ! command -v helm &>/dev/null; then
  info "Install helm..."
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
  info "helm installed: $(helm version --short)"
else
  info "helm sudah terinstall: $(helm version --short)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# [2] Clone / update project
# ─────────────────────────────────────────────────────────────────────────────
section "2/6  Clone project"

if [ -d "$PROJECT_DIR/.git" ]; then
  info "Repo sudah ada, pull update..."
  git -C "$PROJECT_DIR" pull --rebase
else
  info "Clone repo: $REPO_URL"
  git clone "$REPO_URL" "$PROJECT_DIR"
fi
info "Project siap di: $PROJECT_DIR"

# ─────────────────────────────────────────────────────────────────────────────
# [3] Set domain
# ─────────────────────────────────────────────────────────────────────────────
section "3/6  Set domain → $BASE_DOMAIN"
sed -i "s|^BASE_DOMAIN=.*|BASE_DOMAIN=$BASE_DOMAIN|" "$PROJECT_DIR/domain.conf"
info "domain.conf → BASE_DOMAIN=$BASE_DOMAIN"

# Generate ingress yaml dari template
sed "s/SPLP_DOMAIN/$BASE_DOMAIN/g" \
  "$PROJECT_DIR/k8s/ingress/ingress-template.yaml" \
  > "$PROJECT_DIR/k8s/ingress/ingress-all.yaml"
info "ingress-all.yaml generated"

# ─────────────────────────────────────────────────────────────────────────────
# [4] Build Docker images
# ─────────────────────────────────────────────────────────────────────────────
section "4/6  Build Docker images"

info "Build splp-backend..."
$DOCKER_CMD build -t splp-backend:latest "$PROJECT_DIR/apps/splp-backend" 2>&1 | tail -3

info "Build splp-portal..."
$DOCKER_CMD build \
  --build-arg VITE_BASE_DOMAIN="$BASE_DOMAIN" \
  -t splp-portal:latest "$PROJECT_DIR/apps/splp-portal" 2>&1 | tail -3

info "Images built ✓"

# ─────────────────────────────────────────────────────────────────────────────
# [5] Deploy cluster
# ─────────────────────────────────────────────────────────────────────────────
section "5/6  Deploy k3d cluster"
cd "$PROJECT_DIR"
bash scripts/recreate-cluster.sh

# ─────────────────────────────────────────────────────────────────────────────
# [6] Selesai
# ─────────────────────────────────────────────────────────────────────────────
section "6/6  Selesai!"
echo ""
echo -e "${GREEN}✅ SPLP berhasil di-deploy!${NC}"
echo ""
echo " Akses Layanan:"
echo "   Portal    : http://portal.$BASE_DOMAIN"
echo "   Backend   : http://api-backend.$BASE_DOMAIN"
echo "   APIM      : http://apim.$BASE_DOMAIN/publisher/  (admin/admin)"
echo "   IS        : http://is.$BASE_DOMAIN/console       (admin/admin)"
echo "   Grafana   : http://grafana.$BASE_DOMAIN          (anonymous)"
echo "   Kafka UI  : http://kafka-ui.$BASE_DOMAIN"
echo ""
echo " ⏳ WSO2 APIM & IS masih pull image (~30-60 menit)."
echo "    Monitor: watch kubectl get pods -A"
echo "    Tunggu semua ready: bash $PROJECT_DIR/scripts/wait-ready.sh"
echo ""
echo " 📋 Setelah WSO2 APIM ready, daftarkan APIs:"
echo "    bash $PROJECT_DIR/scripts/04-register-apim-apis.sh http://apim.$BASE_DOMAIN"
echo ""
