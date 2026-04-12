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

  [string[]]$Suites = @("incident-management", "osgb-personnel", "osgb-assignments", "osgb-dashboard", "osgb-finance")
)

$ErrorActionPreference = "Stop"

$SupportedSuites = @{
  "incident-management" = ".\load-tests\k6\incident-management.js"
  "osgb-personnel"      = ".\load-tests\k6\osgb-personnel.js"
  "osgb-assignments"    = ".\load-tests\k6\osgb-assignments.js"
  "osgb-dashboard"      = ".\load-tests\k6\osgb-dashboard.js"
  "osgb-finance"        = ".\load-tests\k6\osgb-finance.js"
}

function Invoke-K6([string]$ScriptPath) {
  & $K6Path run $ScriptPath `
    -e "SUPABASE_URL=$SupabaseUrl" `
    -e "SUPABASE_ANON_KEY=$SupabaseAnonKey" `
    -e "TEST_EMAIL=$TestEmail" `
    -e "TEST_PASSWORD=$TestPassword"

  if ($LASTEXITCODE -ne 0) {
    throw "k6 failed for $ScriptPath with exit code $LASTEXITCODE"
  }
}

foreach ($Suite in $Suites) {
  if (-not $SupportedSuites.ContainsKey($Suite)) {
    throw "Unsupported suite: $Suite. Supported: $($SupportedSuites.Keys -join ', ')"
  }

  Invoke-K6 $SupportedSuites[$Suite]
}
