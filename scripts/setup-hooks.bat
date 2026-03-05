@echo off
REM Cai pre-commit hook (chan commit file nhay cam). Chay tu thu muc goc repo.
set SRC=scripts\git-hooks\pre-commit
set DST=.git\hooks\pre-commit

if not exist "%SRC%" (
  echo Khong tim thay %SRC%. Chay tu thu muc goc repo.
  exit /b 1
)

copy /Y "%SRC%" "%DST%" >nul
echo Da cai pre-commit hook. Cac file .env, *.pem, *.key se khong duoc commit.
exit /b 0
