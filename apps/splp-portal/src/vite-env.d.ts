/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GRAFANA_URL: string
  readonly VITE_WSO2_APIM_URL: string
  readonly VITE_WSO2_IS_URL: string
  readonly VITE_BACKEND_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
