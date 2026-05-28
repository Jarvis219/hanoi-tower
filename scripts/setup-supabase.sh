#!/usr/bin/env bash
# Supabase setup helper. Runs the parts the CLI can automate; tells you which
# bits need the web dashboard (Google OAuth secret, project creation).
#
# Usage:  ./scripts/setup-supabase.sh <project-ref>
# Where <project-ref> is the 20-char identifier from the project URL
# (https://<project-ref>.supabase.co). If you do not have a project yet,
# create one at https://supabase.com/dashboard/new — the free tier requires
# NO credit card.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PROJECT_REF="${1:-}"
if [[ -z "$PROJECT_REF" ]]; then
  echo "Usage: $0 <project-ref>"
  echo "Get the ref from your Supabase project URL: https://<ref>.supabase.co"
  exit 1
fi

echo "==> 1/5 Checking Supabase CLI…"
if ! command -v supabase >/dev/null 2>&1; then
  echo "    supabase CLI not found. Install with: brew install supabase/tap/supabase"
  echo "    or:  npm i -g supabase"
  exit 1
fi

echo "==> 2/5 Logging in (opens browser if not already authenticated)…"
supabase login || true

echo "==> 3/5 Linking this repo to project '$PROJECT_REF'…"
supabase link --project-ref "$PROJECT_REF"

echo "==> 4/5 Pulling URL + anon key into .env.local…"
# `supabase status` is for local stack; for a remote project we use the API ref.
URL="https://${PROJECT_REF}.supabase.co"
echo ""
echo "    Open https://supabase.com/dashboard/project/$PROJECT_REF/settings/api"
echo "    Copy the 'anon' public key and paste it below:"
read -r -p "    Paste anon key: " ANON_KEY

cat > .env.local <<EOF
# Supabase project URL + anon key.
VITE_SUPABASE_URL=$URL
VITE_SUPABASE_ANON_KEY=$ANON_KEY

# Google AdSense — leave blank to disable ads.
VITE_ADSENSE_PUBLISHER_ID=
VITE_ADSENSE_BANNER_SLOT=
VITE_ADSENSE_INTERSTITIAL_SLOT=

VITE_DEV_UNLOCK_ALL=true
EOF
echo "    Wrote .env.local"

echo "==> 5/5 Pushing migrations to the remote database…"
supabase db push

cat <<EOF

==> MANUAL STEPS (CLI cannot do these — open the dashboard):

  Dashboard: https://supabase.com/dashboard/project/$PROJECT_REF

  1. Authentication → Providers → Anonymous
       Toggle "Enable anonymous sign-ins" ON.

  2. Authentication → Providers → Google
       Get OAuth credentials from https://console.cloud.google.com/apis/credentials
         - Create OAuth 2.0 Client ID → Web application
         - Authorized redirect URI: https://${PROJECT_REF}.supabase.co/auth/v1/callback
       Paste Client ID + Client Secret here. Save.

  3. (Optional) Authentication → URL Configuration → Site URL
       Add http://localhost:5173 (dev) + your Vercel domain (prod).

  4. Vercel — sync env vars to production:
       vercel env add VITE_SUPABASE_URL production
       vercel env add VITE_SUPABASE_ANON_KEY production

Local sanity check:
  npm run dev
  Open DevTools → Application → Local Storage — you should see
  'sb-${PROJECT_REF}-auth-token' after the page loads.

Done.
EOF
