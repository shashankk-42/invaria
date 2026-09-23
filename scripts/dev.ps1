param([switch]$Setup)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
if ($Setup -or -not (Test-Path '.venv/Scripts/python.exe')) {
    python -m venv .venv
    & '.venv/Scripts/python.exe' -m pip install -r requirements.lock
    & '.venv/Scripts/python.exe' -m pip install --no-deps -e .
    Push-Location frontend
    npm.cmd ci
    Pop-Location
}
$pythonPath = Join-Path $projectRoot '.venv/Scripts/python.exe'
$apiProcess = Start-Process -FilePath $pythonPath -ArgumentList '-m uvicorn invaria.api:app --host 127.0.0.1 --port 8000' -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
Write-Host 'Invaria: http://127.0.0.1:3000  |  API docs: http://127.0.0.1:8000/docs'
try {
    Set-Location -LiteralPath (Join-Path $projectRoot 'frontend')
    npm.cmd run dev
} finally {
    if (-not $apiProcess.HasExited) { Stop-Process -Id $apiProcess.Id }
    Set-Location -LiteralPath $projectRoot
}
