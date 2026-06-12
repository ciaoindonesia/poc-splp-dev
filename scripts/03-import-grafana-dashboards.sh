#!/usr/bin/env bash
## Import SPLP dashboards ke Grafana via API
set -euo pipefail

GRAFANA="${1:-http://localhost:3000}"
AUTH="admin:splp-grafana-2026"

echo "==> Importing SPLP dashboards ke $GRAFANA ..."

# Ensure TestData datasource exists and get its UID
TESTDATA_UID=$(curl -sf -u "$AUTH" "$GRAFANA/api/datasources/name/TestData" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['uid'])" 2>/dev/null || true)
if [ -z "$TESTDATA_UID" ]; then
  echo "  Adding TestData datasource..."
  TESTDATA_UID=$(curl -sf -u "$AUTH" -X POST "$GRAFANA/api/datasources" \
    -H "Content-Type: application/json" \
    -d '{"name":"TestData","type":"testdata","access":"proxy","isDefault":true}' \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['datasource']['uid'])")
fi
echo "  TestData UID: $TESTDATA_UID"

DS_REF="{\"type\":\"testdata\",\"uid\":\"$TESTDATA_UID\"}"

post_dashboard() {
  local title=$1 uid=$2 json=$3
  # Substitute __DS__ placeholder with actual datasource ref
  local resolved="${json//__DS__/$DS_REF}"
  curl -sf -u "$AUTH" -X POST "$GRAFANA/api/dashboards/import" \
    -H "Content-Type: application/json" \
    -d "{\"dashboard\":$resolved,\"overwrite\":true,\"folderId\":0}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  ✅ {d.get(\"title\",\"$title\")} → /d/$uid')" \
    || echo "  ❌ Gagal import $title"
}

## 1. Traffic Overview
post_dashboard "SPLP Traffic Overview" "splp-traffic" '{
  "uid":"splp-traffic","title":"SPLP Traffic Overview","tags":["splp"],"timezone":"browser",
  "schemaVersion":38,"refresh":"5s","time":{"from":"now-1h","to":"now"},
  "panels":[
    {"id":1,"type":"timeseries","title":"API Requests/sec","gridPos":{"x":0,"y":0,"w":16,"h":8},
     "datasource":__DS__,"targets":[
       {"scenarioId":"random_walk","alias":"Total Requests","refId":"A"},
       {"scenarioId":"random_walk","alias":"Success","refId":"B"}]},
    {"id":2,"type":"stat","title":"Total API Calls Today","gridPos":{"x":16,"y":0,"w":4,"h":4},
     "datasource":__DS__,
     "options":{"reduceOptions":{"calcs":["last"]},"colorMode":"background"},
     "fieldConfig":{"defaults":{"unit":"short"}},
     "targets":[{"scenarioId":"csv_metric_values","stringInput":"168230","refId":"A"}]},
    {"id":3,"type":"stat","title":"Success Rate","gridPos":{"x":20,"y":0,"w":4,"h":4},
     "datasource":__DS__,
     "options":{"reduceOptions":{"calcs":["last"]},"colorMode":"background"},
     "fieldConfig":{"defaults":{"unit":"percent","min":90,"max":100,"thresholds":{"mode":"absolute","steps":[{"value":0,"color":"red"},{"value":95,"color":"yellow"},{"value":99,"color":"green"}]}}},
     "targets":[{"scenarioId":"csv_metric_values","stringInput":"99.6","refId":"A"}]},
    {"id":4,"type":"gauge","title":"Active Connections","gridPos":{"x":16,"y":4,"w":4,"h":4},
     "datasource":__DS__,
     "fieldConfig":{"defaults":{"min":0,"max":1000,"thresholds":{"mode":"absolute","steps":[{"value":0,"color":"green"},{"value":700,"color":"yellow"},{"value":900,"color":"red"}]}}},
     "targets":[{"scenarioId":"csv_metric_values","stringInput":"342","refId":"A"}]},
    {"id":5,"type":"gauge","title":"Avg Latency (ms)","gridPos":{"x":20,"y":4,"w":4,"h":4},
     "datasource":__DS__,
     "fieldConfig":{"defaults":{"unit":"ms","min":0,"max":500,"thresholds":{"mode":"absolute","steps":[{"value":0,"color":"green"},{"value":200,"color":"yellow"},{"value":400,"color":"red"}]}}},
     "targets":[{"scenarioId":"csv_metric_values","stringInput":"165","refId":"A"}]},
    {"id":6,"type":"timeseries","title":"API Calls per Instansi (live)","gridPos":{"x":0,"y":8,"w":12,"h":8},
     "datasource":__DS__,"targets":[
       {"scenarioId":"random_walk","alias":"Dukcapil","refId":"A"},
       {"scenarioId":"random_walk","alias":"BPJS Kesehatan","refId":"B"},
       {"scenarioId":"random_walk","alias":"DJP","refId":"C"},
       {"scenarioId":"random_walk","alias":"POLRI","refId":"D"}]},
    {"id":7,"type":"timeseries","title":"Traffic by Category (live)","gridPos":{"x":12,"y":8,"w":12,"h":8},
     "datasource":__DS__,"targets":[
       {"scenarioId":"random_walk","alias":"Kependudukan","refId":"A"},
       {"scenarioId":"random_walk","alias":"Kesehatan","refId":"B"},
       {"scenarioId":"random_walk","alias":"Perpajakan","refId":"C"},
       {"scenarioId":"random_walk","alias":"Keamanan","refId":"D"}]}
  ]
}'

## 2. Kafka Metrics
post_dashboard "Kafka Metrics" "kafka-metrics" '{
  "uid":"kafka-metrics","title":"Kafka Metrics","tags":["splp","kafka"],"timezone":"browser",
  "schemaVersion":38,"refresh":"10s","time":{"from":"now-1h","to":"now"},
  "panels":[
    {"id":1,"type":"timeseries","title":"Messages In/sec","gridPos":{"x":0,"y":0,"w":12,"h":8},
     "datasource":__DS__,
     "targets":[{"scenarioId":"random_walk","alias":"Produce Rate","refId":"A"},{"scenarioId":"random_walk","alias":"Consume Rate","refId":"B"}]},
    {"id":2,"type":"timeseries","title":"Consumer Lag","gridPos":{"x":12,"y":0,"w":12,"h":8},
     "datasource":__DS__,
     "targets":[{"scenarioId":"random_walk","alias":"Consumer Lag","refId":"A"}]},
    {"id":3,"type":"stat","title":"Active Topics","gridPos":{"x":0,"y":8,"w":6,"h":4},
     "datasource":__DS__,
     "options":{"colorMode":"background"},
     "targets":[{"scenarioId":"csv_metric_values","stringInput":"8","refId":"A"}]},
    {"id":4,"type":"stat","title":"Total Messages Today","gridPos":{"x":6,"y":8,"w":6,"h":4},
     "datasource":__DS__,
     "fieldConfig":{"defaults":{"unit":"short"}},
     "targets":[{"scenarioId":"csv_metric_values","stringInput":"1247832","refId":"A"}]},
    {"id":5,"type":"stat","title":"Broker Status","gridPos":{"x":12,"y":8,"w":6,"h":4},
     "datasource":__DS__,
     "options":{"colorMode":"background","reduceOptions":{"calcs":["last"]}},
     "fieldConfig":{"defaults":{"mappings":[{"type":"value","options":{"1":{"text":"UP","color":"green"}}}]}},
     "targets":[{"scenarioId":"csv_metric_values","stringInput":"1","refId":"A"}]},
    {"id":6,"type":"gauge","title":"Disk Usage","gridPos":{"x":18,"y":8,"w":6,"h":4},
     "datasource":__DS__,
     "fieldConfig":{"defaults":{"unit":"percent","min":0,"max":100,"thresholds":{"mode":"absolute","steps":[{"value":0,"color":"green"},{"value":70,"color":"yellow"},{"value":85,"color":"red"}]}}},
     "targets":[{"scenarioId":"csv_metric_values","stringInput":"23","refId":"A"}]}
  ]
}'

## 3. API Latency
post_dashboard "API Latency Heatmap" "api-latency" '{
  "uid":"api-latency","title":"API Latency Heatmap","tags":["splp","latency"],"timezone":"browser",
  "schemaVersion":38,"refresh":"10s","time":{"from":"now-1h","to":"now"},
  "panels":[
    {"id":1,"type":"timeseries","title":"P50/P95/P99 Latency (ms)","gridPos":{"x":0,"y":0,"w":24,"h":8},
     "datasource":__DS__,
     "fieldConfig":{"defaults":{"unit":"ms"}},
     "targets":[
       {"scenarioId":"random_walk","alias":"P50","refId":"A"},
       {"scenarioId":"random_walk","alias":"P95","refId":"B"},
       {"scenarioId":"random_walk","alias":"P99","refId":"C"}]},
    {"id":2,"type":"timeseries","title":"Latency per API","gridPos":{"x":0,"y":8,"w":16,"h":8},
     "datasource":__DS__,
     "fieldConfig":{"defaults":{"unit":"ms"}},
     "targets":[
       {"scenarioId":"random_walk","alias":"Verifikasi NIK","refId":"A"},
       {"scenarioId":"random_walk","alias":"BPJS Status","refId":"B"},
       {"scenarioId":"random_walk","alias":"Verifikasi NPWP","refId":"C"},
       {"scenarioId":"random_walk","alias":"Data STNK","refId":"D"}]},
    {"id":3,"type":"stat","title":"P99 Latency","gridPos":{"x":16,"y":8,"w":4,"h":4},
     "datasource":__DS__,
     "fieldConfig":{"defaults":{"unit":"ms","thresholds":{"mode":"absolute","steps":[{"value":0,"color":"green"},{"value":300,"color":"yellow"},{"value":500,"color":"red"}]}}},
     "targets":[{"scenarioId":"csv_metric_values","stringInput":"287","refId":"A"}]},
    {"id":4,"type":"stat","title":"Timeout Rate","gridPos":{"x":20,"y":8,"w":4,"h":4},
     "datasource":__DS__,
     "fieldConfig":{"defaults":{"unit":"percent","thresholds":{"mode":"absolute","steps":[{"value":0,"color":"green"},{"value":0.5,"color":"yellow"},{"value":1,"color":"red"}]}}},
     "targets":[{"scenarioId":"csv_metric_values","stringInput":"0.12","refId":"A"}]}
  ]
}'

## 4. System Resources
post_dashboard "System Resources" "k8s-resources" '{
  "uid":"k8s-resources","title":"System Resources","tags":["splp","k8s"],"timezone":"browser",
  "schemaVersion":38,"refresh":"30s","time":{"from":"now-1h","to":"now"},
  "panels":[
    {"id":1,"type":"timeseries","title":"CPU Usage (%)","gridPos":{"x":0,"y":0,"w":12,"h":8},
     "datasource":__DS__,
     "fieldConfig":{"defaults":{"unit":"percent","min":0,"max":100}},
     "targets":[
       {"scenarioId":"random_walk","alias":"WSO2 APIM","refId":"A"},
       {"scenarioId":"random_walk","alias":"WSO2 IS","refId":"B"},
       {"scenarioId":"random_walk","alias":"ClickHouse","refId":"C"},
       {"scenarioId":"random_walk","alias":"Kafka","refId":"D"}]},
    {"id":2,"type":"timeseries","title":"Memory Usage (MB)","gridPos":{"x":12,"y":0,"w":12,"h":8},
     "datasource":__DS__,
     "fieldConfig":{"defaults":{"unit":"mbytes"}},
     "targets":[
       {"scenarioId":"random_walk","alias":"WSO2 APIM","refId":"A"},
       {"scenarioId":"random_walk","alias":"WSO2 IS","refId":"B"},
       {"scenarioId":"random_walk","alias":"ClickHouse","refId":"C"}]},
    {"id":3,"type":"stat","title":"Total Pods Running","gridPos":{"x":0,"y":8,"w":4,"h":4},
     "datasource":__DS__,
     "options":{"colorMode":"background"},
     "targets":[{"scenarioId":"csv_metric_values","stringInput":"8","refId":"A"}]},
    {"id":4,"type":"stat","title":"CPU Total","gridPos":{"x":4,"y":8,"w":4,"h":4},
     "datasource":__DS__,
     "fieldConfig":{"defaults":{"unit":"percent"}},
     "targets":[{"scenarioId":"csv_metric_values","stringInput":"34","refId":"A"}]},
    {"id":5,"type":"stat","title":"Memory Total","gridPos":{"x":8,"y":8,"w":4,"h":4},
     "datasource":__DS__,
     "fieldConfig":{"defaults":{"unit":"gbytes"}},
     "targets":[{"scenarioId":"csv_metric_values","stringInput":"12.4","refId":"A"}]},
    {"id":6,"type":"gauge","title":"Disk Usage","gridPos":{"x":12,"y":8,"w":6,"h":4},
     "datasource":__DS__,
     "fieldConfig":{"defaults":{"unit":"percent","min":0,"max":100,"thresholds":{"mode":"absolute","steps":[{"value":0,"color":"green"},{"value":60,"color":"yellow"},{"value":80,"color":"red"}]}}},
     "targets":[{"scenarioId":"csv_metric_values","stringInput":"38","refId":"A"}]},
    {"id":7,"type":"gauge","title":"Network I/O (Mbps)","gridPos":{"x":18,"y":8,"w":6,"h":4},
     "datasource":__DS__,
     "fieldConfig":{"defaults":{"unit":"Mbps","min":0,"max":100}},
     "targets":[{"scenarioId":"csv_metric_values","stringInput":"24","refId":"A"}]}
  ]
}'

echo ""
echo "✅ Selesai! Dashboards tersedia di:"
echo "  http://grafana.pocsplp.com:8080/d/splp-traffic"
echo "  http://grafana.pocsplp.com:8080/d/kafka-metrics"
echo "  http://grafana.pocsplp.com:8080/d/api-latency"
echo "  http://grafana.pocsplp.com:8080/d/k8s-resources"
