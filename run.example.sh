#!/bin/bash

# ============================================================
# 설정 옵션 - 본인 환경에 맞게 수정하세요
# ============================================================
NAME="my-docs"
SOURCE_DIR="/path/to/your/docs"
ADMIN_EMAIL="your@email.com"
PORT=3000
# ============================================================

APP_DIR="/path/to/git-docs-app"
TMP_DIR="/tmp/git-docs/$NAME"
DIST_DIR="$TMP_DIR/dist"
PID_FILE="$TMP_DIR/app.pid"
LOG_FILE="$TMP_DIR/app.log"

cmd_start() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "이미 실행 중입니다. (PID: $(cat "$PID_FILE"))"
    exit 1
  fi

  if [ ! -d "$APP_DIR" ]; then
    echo "오류: git-docs-app 디렉토리를 찾을 수 없습니다: $APP_DIR"
    exit 1
  fi

  if [ ! -d "$SOURCE_DIR" ]; then
    echo "오류: source 디렉토리를 찾을 수 없습니다: $SOURCE_DIR"
    exit 1
  fi

  mkdir -p "$TMP_DIR" "$DIST_DIR"

  echo "git-docs-app 시작"
  echo "  source : $SOURCE_DIR"
  echo "  dist   : $DIST_DIR"
  echo "  admin  : $ADMIN_EMAIL"
  echo "  port   : $PORT"
  echo "  log    : $LOG_FILE"
  echo ""

  cd "$APP_DIR"

  SOURCE_DIR="$SOURCE_DIR" \
  DIST_DIR="$DIST_DIR" \
  ADMIN_EMAIL="$ADMIN_EMAIL" \
  PORT="$PORT" \
  DEV_MODE=true \
  npm run dev >> "$LOG_FILE" 2>&1 &

  echo $! > "$PID_FILE"
  echo "시작됨 (PID: $!, http://localhost:$PORT)"
}

cmd_stop() {
  if [ ! -f "$PID_FILE" ]; then
    echo "실행 중인 프로세스가 없습니다."
    exit 0
  fi

  PID=$(cat "$PID_FILE")

  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    rm -f "$PID_FILE"
    echo "중지됨 (PID: $PID)"
  else
    echo "프로세스가 이미 종료되어 있습니다. (PID: $PID)"
    rm -f "$PID_FILE"
  fi
}

case "$1" in
  start)
    cmd_start
    ;;
  stop)
    cmd_stop
    ;;
  restart)
    cmd_stop
    sleep 1
    cmd_start
    ;;
  status)
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "실행 중 (PID: $(cat "$PID_FILE"), http://localhost:$PORT)"
    else
      echo "중지됨"
    fi
    ;;
  log)
    if [ ! -f "$LOG_FILE" ]; then
      echo "로그 파일이 없습니다: $LOG_FILE"
      exit 1
    fi
    tail -f "$LOG_FILE"
    ;;
  *)
    echo "사용법: $0 {start|stop|restart|status|log}"
    exit 1
    ;;
esac
