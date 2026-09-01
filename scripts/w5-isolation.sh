#!/usr/bin/env bash
# W5 walkthrough isolation: Woodley never sees Envoy; Envoy never sees Woodley.
set -euo pipefail
BFF_URL="${CRM_BFF_URL:-http://127.0.0.1:8787}"
WILLOW="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

get() {
  curl -sf -H "x-ardley-customer-id: $1" "$2"
}

woodley_contacts="$(get 100004 "${BFF_URL}/contacts")"
envoy_contacts="$(get 100081 "${BFF_URL}/contacts")"
woodley_views="$(get 100004 "${BFF_URL}/saved-views")"
envoy_views="$(get 100081 "${BFF_URL}/saved-views")"
woodley_search="$(get 100004 "${BFF_URL}/contacts?q=Ellis")"
envoy_search="$(get 100081 "${BFF_URL}/contacts?q=Willow")"
envoy_willow="$(curl -s -o /tmp/w5-envoy-willow.json -w '%{http_code}' -H 'x-ardley-customer-id: 100081' "${BFF_URL}/contacts/${WILLOW}")"
woodley_nmls="$(get 100004 "${BFF_URL}/contacts?q=999001")"
envoy_nmls="$(get 100081 "${BFF_URL}/contacts?q=999001")"

python3 - "$woodley_contacts" "$envoy_contacts" "$woodley_views" "$envoy_views" \
  "$woodley_search" "$envoy_search" "$envoy_willow" "$woodley_nmls" "$envoy_nmls" <<'PY'
import json, sys

def names(payload):
    return {f"{r['first_name']} {r['last_name']}" for r in payload["data"]}

woodley = json.loads(sys.argv[1])
envoy = json.loads(sys.argv[2])
woodley_views = json.loads(sys.argv[3])
envoy_views = json.loads(sys.argv[4])
woodley_search = json.loads(sys.argv[5])
envoy_search = json.loads(sys.argv[6])
envoy_willow_status = sys.argv[7]
woodley_nmls = json.loads(sys.argv[8])
envoy_nmls = json.loads(sys.argv[9])

w_names = names(woodley)
e_names = names(envoy)
if "Ellis Envoy" in w_names:
    raise SystemExit("Woodley list leaked Ellis Envoy")
if "Willow Woodley" in e_names:
    raise SystemExit("Envoy list leaked Willow Woodley")
if "Willow Woodley" not in w_names:
    raise SystemExit("Woodley missing Willow")
if "Ellis Envoy" not in e_names:
    raise SystemExit("Envoy missing Ellis")

by_name = {v["name"]: v for v in woodley_views["data"]}
borrowers = {r["label"] for r in by_name["My Borrowers"]["results"]}
if "Ellis Envoy" in borrowers:
    raise SystemExit("Woodley saved view leaked Ellis")
if "Willow Woodley" not in borrowers:
    raise SystemExit("Woodley saved view missing Willow")
if envoy_views["total"] != 0:
    raise SystemExit(f"Envoy should have no saved views: {envoy_views}")

if names(woodley_search):
    raise SystemExit(f"Woodley search for Ellis returned {names(woodley_search)}")
if names(envoy_search):
    raise SystemExit(f"Envoy search for Willow returned {names(envoy_search)}")
if envoy_willow_status != "404":
    raise SystemExit(f"Envoy could read Willow: {envoy_willow_status}")

nmls_names = names(woodley_nmls)
if nmls_names != {"Avery Agent"}:
    raise SystemExit(f"Woodley NMLS search: {nmls_names}")
if names(envoy_nmls):
    raise SystemExit(f"Envoy saw Woodley NMLS: {names(envoy_nmls)}")

print("W5 isolation passed: Woodley and Envoy stay on their own tenants.")
PY
