# PS47 Medical Engine — Windows PowerShell Start Script
$ErrorActionPreference = "Stop"

$ROOT = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ROOT

# Activate conda environment if available
if (Get-Command conda -ErrorAction SilentlyContinue) {
    Write-Host "Activating Conda environment 'ai-ml'..." -ForegroundColor Cyan
    conda activate ai-ml
}

# Locate llama-server.exe binary
$LLAMA_BIN = ""
if (Get-Command llama-server.exe -ErrorAction SilentlyContinue) {
    $LLAMA_BIN = (Get-Command llama-server.exe).Source
} elseif (Test-Path "$HOME\.local\bin\llama-server.exe") {
    $LLAMA_BIN = "$HOME\.local\bin\llama-server.exe"
} elseif (Test-Path "$ROOT\repos\llama.cpp\build\bin\Release\llama-server.exe") {
    $LLAMA_BIN = "$ROOT\repos\llama.cpp\build\bin\Release\llama-server.exe"
} elseif (Test-Path "$ROOT\repos\llama.cpp\build\bin\llama-server.exe") {
    $LLAMA_BIN = "$ROOT\repos\llama.cpp\build\bin\llama-server.exe"
}

if (-not $LLAMA_BIN) {
    Write-Host "❌ Error: llama-server.exe binary not found!" -ForegroundColor Red
    Write-Host "Please build or download llama.cpp for Windows according to README.md instructions." -ForegroundColor Yellow
    exit 1
}

New-Item -ItemType Directory -Force -Path "logs" | Out-Null
New-Item -ItemType Directory -Force -Path "data\uploads", "data\patients", "data\manifests", "data\qdrant_db" | Out-Null

# Auto-start Qdrant Docker Desktop container if available
if (Get-Command docker -ErrorAction SilentlyContinue) {
    $running = docker ps --format '{{.Names}}'
    if ($running -notcontains "ps47-qdrant") {
        Write-Host "🐳 Starting Qdrant Docker container..." -ForegroundColor Cyan
        docker start ps47-qdrant 2>$null
        if ($LASTEXITCODE -ne 0) {
            docker run -d --name ps47-qdrant -p 6333:6333 -v ps47_qdrant_data:/qdrant/storage qdrant/qdrant:latest 2>$null
        }
    }
}

Write-Host "🚀 Starting Local Medical LLM Server (Port 38127)..." -ForegroundColor Green
$medProcess = Start-Process -FilePath $LLAMA_BIN -ArgumentList "-m data\models\lingshu-i-8b\Lingshu-I-8B-Q4_K_M.gguf --host 127.0.0.1 --port 38127 -ngl 4 -c 4096 -np 1" -RedirectStandardOutput "logs\llama-medical.log" -RedirectStandardError "logs\llama-medical-err.log" -PassThru

Write-Host "🚀 Starting Local OCR VLM Server (Port 38128)..." -ForegroundColor Green
$ocrProcess = Start-Process -FilePath $LLAMA_BIN -ArgumentList "-m data\models\paddleocr-vl-0.9b\PaddleOCR-VL-0.9B-GGUF.gguf --mmproj data\models\paddleocr-vl-0.9b\PaddleOCR-VL-0.9B-GGUF-mmproj.gguf --host 127.0.0.1 --port 38128 -ngl 8 -c 2048 -np 1" -RedirectStandardOutput "logs\llama-ocr.log" -RedirectStandardError "logs\llama-ocr-err.log" -PassThru

Start-Sleep -Seconds 3

Write-Host "✨ Starting PS47 FastAPI Engine on http://127.0.0.1:8110 ..." -ForegroundColor Cyan

try {
    uvicorn main:app --host 127.0.0.1 --port 8110
} finally {
    Write-Host "Stopping background services..." -ForegroundColor Yellow
    Stop-Process -Id $medProcess.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $ocrProcess.Id -Force -ErrorAction SilentlyContinue
}
