#!/bin/bash
# 清理并重新安装 npm 依赖，用于修复 ENOTEMPTY 等安装失败
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[1/4] 清理根目录 node_modules 并重新安装..."
rm -rf node_modules package-lock.json
npm install

echo "[2/4] 清理 cloudfunctions/arkText 并安装..."
cd "$ROOT/cloudfunctions/arkText"
rm -rf node_modules package-lock.json
npm install

echo "[3/4] 清理 cloudfunctions/arkImage 并安装..."
cd "$ROOT/cloudfunctions/arkImage"
rm -rf node_modules package-lock.json
npm install

echo "[4/4] 完成。"
echo "若仍失败，可尝试: npm config set registry https://registry.npmmirror.com"
cd "$ROOT"
