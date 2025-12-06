.PHONY: build build-all install install-all test clean benchmark

# Build the main binary
build:
	@echo "Building claude-hook..."
	go build -o claude-hook -ldflags="-s -w" .
	@echo "✓ Built: ./claude-hook"

# Build all binaries (including status-line)
build-all: build
	@echo "Building status-line..."
	cd ../status-line && go build -o status-line -ldflags="-s -w" .
	@echo "✓ Built: ../status-line/status-line"

# Build optimized release binary
build-release:
	@echo "Building optimized release binary..."
	CGO_ENABLED=0 go build -o claude-hook -ldflags="-s -w -X main.Version=$(shell git describe --tags --always)" -trimpath .
	@echo "✓ Built release: ./claude-hook ($(shell ls -lh claude-hook | awk '{print $$5}'))"
	@echo "Building optimized status-line..."
	cd ../status-line && CGO_ENABLED=0 go build -o status-line -ldflags="-s -w" -trimpath .
	@echo "✓ Built release: ../status-line/status-line"

# Install claude-hook to ~/.claude/bin
install: build
	@echo "Installing to ~/.claude/bin/..."
	mkdir -p ~/.claude/bin
	cp claude-hook ~/.claude/bin/
	chmod +x ~/.claude/bin/claude-hook
	@echo "✓ Installed: ~/.claude/bin/claude-hook"
	@echo ""
	@echo "Add to PATH (if not already):"
	@echo "  export PATH=\"\$$HOME/.claude/bin:\$$PATH\""

# Install all binaries to ~/.claude/bin
install-all: build-all
	@echo "Installing all binaries to ~/.claude/bin/..."
	mkdir -p ~/.claude/bin
	cp claude-hook ~/.claude/bin/
	chmod +x ~/.claude/bin/claude-hook
	cp ../status-line/status-line ~/.claude/bin/
	chmod +x ~/.claude/bin/status-line
	@echo "✓ Installed: ~/.claude/bin/claude-hook"
	@echo "✓ Installed: ~/.claude/bin/status-line"

# Run tests
test:
	@echo "Running tests..."
	go test -v ./...

# Benchmark startup time
benchmark:
	@echo "Benchmarking startup time..."
	@echo ""
	@echo "Python version:"
	@time python3 -c "import sys, json; print(json.dumps({'test': True}))" > /dev/null
	@echo ""
	@echo "Go version:"
	@time ./claude-hook --help > /dev/null || echo "(Build first with 'make build')"
	@echo ""
	@echo "Expected improvement: ~50-100x faster"

# Compare with Python version
compare: build
	@echo "Comparing Python vs Go performance..."
	@echo ""
	@echo "=== Python (send_event.py) ==="
	@/usr/bin/time -p bash -c 'echo "{\"session_id\":\"test\"}" | python3 ../send_event.py --source-app test --event-type PostToolUse --server-url http://localhost:9999 2>&1 | grep real'
	@echo ""
	@echo "=== Go (claude-hook) ==="
	@/usr/bin/time -p bash -c 'echo "{\"session_id\":\"test\"}" | ./claude-hook --source-app test --event-type PostToolUse --server-url http://localhost:9999 2>&1 | grep real'
	@echo ""
	@echo "(Server connection will fail - that's expected. We're measuring startup time.)"

# Clean build artifacts
clean:
	rm -f claude-hook
	rm -f ~/.claude/bin/claude-hook
	@echo "✓ Cleaned"

# Show binary size
size: build
	@echo "Binary size:"
	@ls -lh claude-hook | awk '{print $$5 " - " $$9}'
	@echo ""
	@file claude-hook
