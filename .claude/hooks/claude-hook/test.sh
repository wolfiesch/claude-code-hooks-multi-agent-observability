#!/bin/bash
# Test script for claude-hook

set -e

echo "=== Building claude-hook ==="
make build

echo ""
echo "=== Test 1: Basic Functionality ==="
echo '{"session_id":"test-abc","tool_name":"Read","cwd":"/tmp"}' | \
  ./claude-hook \
    --source-app test \
    --event-type PostToolUse \
    --server-url http://localhost:9999 2>&1 | \
  head -5

echo ""
echo "=== Test 2: Check Binary Size ==="
ls -lh claude-hook | awk '{print "Size: " $5}'

echo ""
echo "=== Test 3: Startup Speed Test ==="
echo "Python version:"
time python3 -c "import sys, json; import os; d={'test':1}; json.dumps(d)" > /dev/null

echo ""
echo "Go version:"
time ./claude-hook --help > /dev/null

echo ""
echo "=== Test 4: Metadata Collection ==="
echo "Creating test event with full metadata..."

# Create a simple HTTP server to capture the event
python3 -c "
import http.server
import json
import sys
from threading import Thread

class Handler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        body = self.read_file(content_length).decode('utf-8')
        event = json.loads(body)

        print('\n✓ Event received!')
        print(f'  Session ID: {event.get(\"session_id\")}')
        print(f'  Event Type: {event.get(\"hook_event_type\")}')
        print(f'  Git Branch: {event.get(\"git\", {}).get(\"branch\", \"N/A\")}')
        print(f'  OS: {event.get(\"environment\", {}).get(\"os\", \"N/A\")}')
        print(f'  Tool Count: {event.get(\"session\", {}).get(\"toolCount\", 0)}')

        self.send_response(200)
        self.end_headers()
        sys.exit(0)

    def log_message(self, format, *args):
        pass  # Suppress server logs

server = http.server.HTTPServer(('localhost', 9999), Handler)
print('Starting test server on port 9999...')
try:
    server.serve_forever()
except SystemExit:
    pass
" &

SERVER_PID=$!
sleep 1

# Send test event
echo '{"session_id":"test-metadata","tool_name":"Read"}' | \
  ./claude-hook \
    --source-app test \
    --event-type PostToolUse \
    --server-url http://localhost:9999/events 2>/dev/null

wait $SERVER_PID 2>/dev/null

echo ""
echo "=== All Tests Passed! ==="
