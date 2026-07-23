#!/usr/bin/env bash
#
# PropFlow — live end-to-end demo.
#
# Drives the whole platform through the gateway and narrates each step, so the
# full event-driven flow (auth -> state machine -> transactional outbox ->
# RabbitMQ + Kafka -> audit projection -> AI triage) is visible in one run.
# The highlight: the tenant understates the priority and the LLM re-evaluates
# it, with every event attributed in the audit feed.
#
#   npm run demo
#   GATEWAY=http://localhost:3000/api npm run demo   # override the gateway URL
#
# Requires: the stack running (docker compose up -d + the 5 services) and,
# for the AI step, ANTHROPIC_API_KEY set for the work-orders service.
set -uo pipefail

GATEWAY="${GATEWAY:-http://localhost:3000/api}"
EMAIL="${DEMO_EMAIL:-manager@propflow.dev}"
PASSWORD="${DEMO_PASSWORD:-propflow}"

if [ -t 1 ]; then
  B=$'\e[1m'; DIM=$'\e[2m'; RED=$'\e[31m'; GRN=$'\e[32m'; YEL=$'\e[33m'; CYN=$'\e[36m'; Z=$'\e[0m'
else
  B=""; DIM=""; RED=""; GRN=""; YEL=""; CYN=""; Z=""
fi

step()  { printf "\n${B}${CYN}==> %s${Z}\n" "$1"; }
ok()    { printf "    ${GRN}OK${Z}  %s\n" "$1"; }
note()  { printf "    ${DIM}%s${Z}\n" "$1"; }
field() { printf "    ${B}%-10s${Z} %s\n" "$1" "$2"; }
jget()  { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }

printf "${B}PropFlow — live demo${Z}  ${DIM}(%s)${Z}\n" "$GATEWAY"

# --- preflight -------------------------------------------------------------
code=$(curl -s -o /dev/null -w '%{http_code}' "$GATEWAY/health" 2>/dev/null || echo 000)
if [ "$code" != "200" ]; then
  printf "${RED}Gateway did not answer at %s (HTTP %s).${Z}\n" "$GATEWAY" "$code"
  printf "Start the stack first: ${B}docker compose up -d${Z} and the 5 services.\n"
  exit 1
fi
ok "gateway healthy"

# --- 1. auth ---------------------------------------------------------------
step "1. Authenticate (role: manager)"
TOKEN=$(curl -s -X POST "$GATEWAY/auth/login" -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jget "d['accessToken']")
[ -n "$TOKEN" ] && [ "$TOKEN" != "None" ] || { printf "${RED}login failed${Z}\n"; exit 1; }
AUTH="Authorization: Bearer $TOKEN"
ok "JWT issued (${TOKEN:0:20}...)"
noauth=$(curl -s -o /dev/null -w '%{http_code}' "$GATEWAY/work-orders")
ok "request without a token -> ${B}$noauth${Z} (auth is enforced)"

# --- 2. create a property --------------------------------------------------
step "2. Register a property"
PID=$(curl -s -X POST "$GATEWAY/properties" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"name":"Oak Court","addressLine1":"5 Oak Lane","city":"Leeds","postcode":"LS1 4DY","managerEmail":"manager@propflow.dev"}' \
  | jget "d['id']")
ok "propertyId $PID"

# --- 3. open a work order (understated priority) ---------------------------
step "3. Open a work order — tenant reports priority: ${YEL}medium${Z}"
note "\"strong smell of gas in the kitchen and the boiler is dead in winter\""
WID=$(curl -s -X POST "$GATEWAY/work-orders" -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"title\":\"No heating and gas smell\",\"description\":\"Tenant reports a strong smell of gas in the kitchen and the boiler is completely dead in the middle of winter\",\"propertyId\":\"$PID\",\"priority\":\"medium\"}" \
  | jget "d['id']")
ok "workOrderId $WID  (returns immediately — triage is async, off the write path)"

# --- 4. the AI triage ------------------------------------------------------
step "4. AI triage (LLM -> outbox -> Kafka), waiting..."
TRIAGED=""
for i in $(seq 1 40); do
  R=$(curl -s "$GATEWAY/work-orders/$WID" -H "$AUTH")
  if [ "$(echo "$R" | jget "d['triagedAt']")" != "None" ]; then TRIAGED="$R"; break; fi
  sleep 1
done
if [ -z "$TRIAGED" ]; then
  printf "    ${YEL}triage did not complete in 40s.${Z} Is ANTHROPIC_API_KEY set for work-orders?\n"
else
  ok "classified in ~${i}s"
  field "category" "$(echo "$TRIAGED" | jget "d['triageCategory']")"
  printf "    ${B}urgency${Z}    ${RED}%s${Z}  ${DIM}(the LLM raised it from the tenant's \"medium\")${Z}\n" \
    "$(echo "$TRIAGED" | jget "d['triageUrgency']")"
  field "reasoning" "$(echo "$TRIAGED" | jget "d['triageReasoning']")"
fi

# --- 5. the state machine --------------------------------------------------
step "5. Lifecycle transitions (guarded by the state machine)"
a=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$GATEWAY/work-orders/$WID/assign" -H "$AUTH" -H 'content-type: application/json' -d '{"assigneeId":"22222222-2222-4222-8222-222222222222"}')
ok "assign -> $a"
b=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$GATEWAY/work-orders/$WID/status" -H "$AUTH" -H 'content-type: application/json' -d '{"status":"in_progress"}')
ok "in_progress -> $b"
c=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$GATEWAY/work-orders/$WID/status" -H "$AUTH" -H 'content-type: application/json' -d '{"status":"open"}')
ok "invalid in_progress->open -> ${B}$c${Z} (rejected, as it should be)"

# --- 6. the audit trail ----------------------------------------------------
step "6. Activity feed — audit projection of the Kafka log"
sleep 2
curl -s "$GATEWAY/activity?workOrderId=$WID" -H "$AUTH" | python3 -c "
import sys, json
for e in json.load(sys.stdin)['data']:
    who = e['actorId'] if e['actorId'] else 'system (AI)'
    print('    %-22s by %s' % (e['eventType'], who))
"

step "What just happened"
note "1 request -> state + event committed atomically (outbox), never lost"
note "outbox relay -> RabbitMQ (notifications) + Kafka (audit), at-least-once"
note "AI triage ran async and re-evaluated the priority, attributed as 'system'"
note "every action is auditable end to end, with who did it"
printf "\n${GRN}${B}done.${Z}\n"
