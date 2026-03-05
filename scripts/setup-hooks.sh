#!/bin/sh
# Cài pre-commit hook để chặn commit file nhạy cảm (.env, *.key, ...)
# Chạy: sh scripts/setup-hooks.sh

HOOK_SRC="scripts/git-hooks/pre-commit"
HOOK_DST=".git/hooks/pre-commit"

if [ ! -f "$HOOK_SRC" ]; then
  echo "Khong tim thay $HOOK_SRC. Chay tu thu muc goc repo."
  exit 1
fi
cp "$HOOK_SRC" "$HOOK_DST"
chmod +x "$HOOK_DST"
echo "Da cai pre-commit hook. Cac file .env, *.pem, *.key, secrets/ se khong duoc commit."
exit 0
