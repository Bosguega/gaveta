param([string]$OutFile)

if (-not $OutFile) {
  Write-Error "Uso: .\gen.ps1 -OutFile <caminho.json>  (ex: .\gen.ps1 -OutFile .\result.json)"
  exit 1
}

$body = @{
  model = "sdxl"
  prompt = "a photorealistic capybara sitting in a coffee shop, warm lighting"
  seed = 12345
  steps = 30
  guidance = 7.0
  width = 1024
  height = 1024
} | ConvertTo-Json
$r = Invoke-RestMethod -Uri http://127.0.0.1:8000/generate -Method Post -ContentType 'application/json' -Body $body
$r | ConvertTo-Json | Out-File $OutFile
