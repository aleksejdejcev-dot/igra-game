#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
REPO=igrahystory/igrahystory.github.io

if [ "$(git branch --show-current)" != "main" ]; then
  echo "Переключитесь на ветку main"; exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "На main есть незакоммиченные изменения: сначала git commit"; exit 1
fi

git checkout public-main
git rm -rf -q .
git checkout main -- .
git add -A
git commit -m "Обновление $(date '+%Y-%m-%d %H:%M')" || echo "Изменений нет"
git push public public-main:main
git checkout main

gh workflow run pages.yml --repo "$REPO"
sleep 5
RUN_ID=$(gh run list --repo "$REPO" --workflow pages.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$RUN_ID" --repo "$REPO" --exit-status
echo "Готово: https://igrahystory.github.io/"
