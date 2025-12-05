.PHONY: build install test clean

build:
	@echo "Building unified-notify..."
	go build -o unified-notify -ldflags="-s -w" main.go
	@echo "✓ Built: ./unified-notify"

install: build
	@echo "Installing to ~/.claude/bin/..."
	mkdir -p ~/.claude/bin
	cp unified-notify ~/.claude/bin/
	chmod +x ~/.claude/bin/unified-notify
	@echo "✓ Installed: ~/.claude/bin/unified-notify"

test:
	@echo "Testing unified-notify..."
	@echo '{"session_id":"test-123","hook_event_name":"Stop","cwd":"/tmp","tool_name":"Read"}' | \
		./unified-notify

clean:
	rm -f unified-notify

compare:
	@echo "=== Python (unified-notify.py) ==="
	@time python3 -c "import sys, json, sqlite3, subprocess, logging; d={'test':1}; json.dumps(d)" > /dev/null
	@echo ""
	@echo "=== Go (unified-notify) ==="
	@time ./unified-notify --help > /dev/null || true

benchmark:
	@echo "Benchmarking startup times (10 runs each)..."
	@echo ""
	@echo "Python:"
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
		/usr/bin/time -p python3 -c "import sys, json, sqlite3, subprocess" 2>&1 | grep real; \
	done | awk '{sum+=$$2; count++} END {print "Average:", sum/count "s"}'
	@echo ""
	@echo "Go:"
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
		/usr/bin/time -p ./unified-notify < /dev/null 2>&1 | grep real; \
	done | awk '{sum+=$$2; count++} END {print "Average:", sum/count "s"}'
