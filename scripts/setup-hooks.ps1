# Cai pre-commit hook de chan commit file nhay cam (.env, *.key, ...)
# Chay: .\scripts\setup-hooks.ps1   hoac   powershell -ExecutionPolicy Bypass -File scripts\setup-hooks.ps1

$src = "scripts\git-hooks\pre-commit"
$dst = ".git\hooks\pre-commit"

if (-not (Test-Path $src)) {
  Write-Host "Khong tim thay $src. Chay tu thu muc goc repo." -ForegroundColor Red
  exit 1
}

Copy-Item -Path $src -Destination $dst -Force
Write-Host "Da cai pre-commit hook. Cac file .env, *.pem, *.key, secrets/ se khong duoc commit." -ForegroundColor Green
exit 0
