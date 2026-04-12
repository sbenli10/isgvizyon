param(
  [Parameter(Mandatory = $true)]
  [string]$K6Path,

  [Parameter(Mandatory = $true)]
  [string]$SupabaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$SupabaseAnonKey,

  [Parameter(Mandatory = $true)]
  [string]$TestEmail,

  [Parameter(Mandatory = $true)]
  [string]$TestPassword,

  [string]$BaseUrl = "http://localhost:4173"
)

$ErrorActionPreference = "Stop"

function Invoke-K6([string]$ScriptPath, [string[]]$Args) {
  & $K6Path run $ScriptPath @Args
  if ($LASTEXITCODE -ne 0) {
    throw "k6 failed for $ScriptPath with exit code $LASTEXITCODE"
  }
}

Invoke-K6 ".\load-tests\k6\routes-smoke.js" @(
  "-e", "BASE_URL=$BaseUrl"
)

Invoke-K6 ".\load-tests\k6\supabase-authenticated.js" @(
  "-e", "SUPABASE_URL=$SupabaseUrl",
  "-e", "SUPABASE_ANON_KEY=$SupabaseAnonKey",
  "-e", "TEST_EMAIL=$TestEmail",
  "-e", "TEST_PASSWORD=$TestPassword"
)
