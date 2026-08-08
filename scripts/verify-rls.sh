#!/usr/bin/env bash
# =============================================================
# RLS / RPC のローカル検証
# =============================================================
# Supabase プロジェクトへ接続せずに、素の PostgreSQL 上で
# supabase/migrations/*.sql の RLS ポリシーと RPC を検証します。
#
#   ./scripts/verify-rls.sh                      # 一時データベースを作って検証
#   DATABASE_URL=postgres://... ./scripts/verify-rls.sh
#
# 必要なもの: psql と、接続できる PostgreSQL 16 以上
# =============================================================
set -euo pipefail

cd "$(dirname "$0")/.."

DB_NAME="${DB_NAME:-odekake_rls_check}"
PSQL_BASE="${DATABASE_URL:-}"

if [ -n "$PSQL_BASE" ]; then
  # 接続先が指定されている場合はそのデータベースをそのまま使う
  PSQL=(psql "$PSQL_BASE")
else
  HOST="${PGHOST:-/tmp}"
  PORT="${PGPORT:-5432}"
  USER="${PGUSER:-postgres}"
  ADMIN=(psql -h "$HOST" -p "$PORT" -U "$USER" -d postgres -v ON_ERROR_STOP=1 -q)
  "${ADMIN[@]}" -c "drop database if exists ${DB_NAME};" >/dev/null
  "${ADMIN[@]}" -c "create database ${DB_NAME};" >/dev/null
  PSQL=(psql -h "$HOST" -p "$PORT" -U "$USER" -d "$DB_NAME")
fi

run() {
  "${PSQL[@]}" -v ON_ERROR_STOP=1 -q -f "$1" 2>&1 \
    | grep -vE 'does not exist, skipping|already exists, skipping' || true
}

echo "== Supabase 相当のスタブを作成 =="
run supabase/tests/00_supabase_stub.sql

echo "== マイグレーションを適用 =="
for file in supabase/migrations/*.sql; do
  echo "   $file"
  run "$file"
done

# 0008 は共有旅の列とテーブルを落とすため、そのあとで 0001 / 0002 を
# もう一度流すことはできない（存在しない列を参照する関数の作成で失敗する）。
# Supabase は適用済みのマイグレーションを再実行しないので、ここでは
# 「最後のマイグレーションを二度流しても壊れない」ことだけを確かめる。
LAST_MIGRATION="$(ls supabase/migrations/*.sql | tail -1)"
echo "== 冪等性の確認（${LAST_MIGRATION} をもう一度適用） =="
run "$LAST_MIGRATION"

echo "== RLS テスト =="
"${PSQL[@]}" -v ON_ERROR_STOP=1 -f supabase/tests/01_rls.test.sql
