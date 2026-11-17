param(
    [int]$FrontendPort = 13000,
    [int]$BackendPort = 15080,
    [int]$PostgresPort = 15433
)

$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path -Parent $PSScriptRoot
$testProject = 'mininote-e2e-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$previousFrontendPort = $env:FRONTEND_PORT
$previousBackendPort = $env:BACKEND_PORT
$previousBaseUrl = $env:E2E_BASE_URL
$previousPostgresPort = $env:POSTGRES_PORT
$previousApiUrl = $env:E2E_API_URL
$composeFile = Join-Path $workspacePath 'docker-compose.yaml'
$env:FRONTEND_PORT = "$FrontendPort"
$env:BACKEND_PORT = "$BackendPort"
$env:POSTGRES_PORT = "$PostgresPort"
$env:E2E_BASE_URL = "http://127.0.0.1:$FrontendPort"
$apiUrl = "http://127.0.0.1:$BackendPort"
$env:E2E_API_URL = $apiUrl

function Assert-Command([string]$Description) {
    if ($LASTEXITCODE -ne 0) { throw "$Description failed (exit $LASTEXITCODE)." }
}

function Wait-Api {
    $deadline = [datetime]::UtcNow.AddSeconds(60)
    while ([datetime]::UtcNow -lt $deadline) {
        try {
            $response = Invoke-WebRequest "$apiUrl/health" -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -eq 200) { return }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    throw 'Backend did not become ready.'
}

Push-Location $workspacePath
try {
    docker compose -f $composeFile -p $testProject up --build -d --wait --wait-timeout 120
    Assert-Command 'Compose startup'
    Push-Location (Join-Path $workspacePath 'frontend')
    try {
        npm.cmd run test:e2e
        Assert-Command 'Playwright'
    } finally { Pop-Location }

    $requestKey = [guid]::NewGuid().ToString()
    $payload = @{ title = 'Persistence check'; content = ('Saved text ' * 300) } | ConvertTo-Json -Compress
    $headers = @{ 'Idempotency-Key' = $requestKey }
    $created = Invoke-RestMethod "$apiUrl/api/notes" -Method Post -Headers $headers -ContentType 'application/json' -Body $payload
    $editedPayload = @{
        version = $created.version
        title = 'Edited persistence check'
        content = ('Updated text ' * 300)
        checklist = @(
            @{ id = [guid]::NewGuid().ToString(); text = 'Completed item'; isCompleted = $true },
            @{ id = [guid]::NewGuid().ToString(); text = 'Pending item'; isCompleted = $false }
        )
    } | ConvertTo-Json -Depth 5 -Compress
    $expected = Invoke-RestMethod "$apiUrl/api/notes/$($created.id)" -Method Put -ContentType 'application/json' -Body $editedPayload

    foreach ($service in @('backend', 'postgres')) {
        foreach ($operation in @('restart', 'recreate')) {
            if ($operation -eq 'restart') {
                docker compose -f $composeFile -p $testProject restart $service
            } else {
                docker compose -f $composeFile -p $testProject up -d --force-recreate $service
            }
            Assert-Command "$service $operation"
            Wait-Api
            $restored = Invoke-RestMethod "$apiUrl/api/notes/$($created.id)"
            if ($restored.id -ne $expected.id -or $restored.title -cne $expected.title -or $restored.content -cne $expected.content -or $restored.createdAt -cne $expected.createdAt -or $restored.version -ne $expected.version) {
                throw "Note changed after $service $operation."
            }
            if (($restored.checklist | ConvertTo-Json -Depth 5 -Compress) -cne ($expected.checklist | ConvertTo-Json -Depth 5 -Compress)) {
                throw "Checklist changed after $service $operation."
            }
            $replayed = Invoke-WebRequest "$apiUrl/api/notes" -Method Post -Headers $headers -ContentType 'application/json' -Body $payload -UseBasicParsing
            $replayedNote = $replayed.Content | ConvertFrom-Json
            if ($replayed.StatusCode -ne 200 -or $replayedNote.id -ne $created.id -or $replayedNote.version -ne $expected.version) {
                throw "Creation replay changed after $service $operation."
            }
            Write-Output "PASS: note survives $service $operation."
        }
    }
} finally {
    # This uniquely named project contains only this run's test data.
    docker compose -f $composeFile -p $testProject down -v --remove-orphans
    $env:FRONTEND_PORT = $previousFrontendPort
    $env:BACKEND_PORT = $previousBackendPort
    $env:E2E_BASE_URL = $previousBaseUrl
    $env:POSTGRES_PORT = $previousPostgresPort
    $env:E2E_API_URL = $previousApiUrl
    Pop-Location
}
