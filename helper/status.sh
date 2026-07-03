#!/usr/bin/env bash
# Quick health + resource view for the later-brain helper.
# Run from the helper/ dir:  npm run status
LABEL=com.later-brain.helper
PORT=41484

PID=$(launchctl list 2>/dev/null | awk -v l="$LABEL" '$3==l {print $1}')

if [ -z "$PID" ] || [ "$PID" = "-" ]; then
  echo "helper is NOT running (launchd agent '$LABEL' is not active)."
  echo "start it:  launchctl kickstart -k gui/\$(id -u)/$LABEL"
  exit 0
fi

echo "helper running — PID $PID"
ps -o pid=,%cpu=,%mem=,rss=,etime=,comm= -p "$PID" \
  | awk '{printf "  cpu %s%%   mem %s%%   rss %.0f MB   uptime %s\n", $2, $3, $4/1024, $5}'

CHILDREN=$(pgrep -P "$PID" 2>/dev/null | tr '\n' ' ')
if [ -n "${CHILDREN// /}" ]; then
  echo "  active work right now (yt-dlp / claude child processes):"
  ps -o pid=,%cpu=,rss=,comm= -p $CHILDREN \
    | awk '{printf "    - pid %s  cpu %s%%  rss %.0f MB  (%s)\n", $1, $2, $3/1024, $4}'
else
  echo "  idle — no transcript/summary work in progress"
fi

echo -n "  health: "
curl -s --max-time 2 "http://127.0.0.1:$PORT/health" || echo "(no response)"
echo
echo "Live view:  top -pid $PID    (or Activity Monitor, search 'node')"
