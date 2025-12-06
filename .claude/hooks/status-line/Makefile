.PHONY: build install clean

# Build the binary
build:
	@echo "Building status-line..."
	go build -o status-line -ldflags="-s -w" .
	@echo "✓ Built: ./status-line"

# Build optimized release binary
build-release:
	@echo "Building optimized release binary..."
	CGO_ENABLED=0 go build -o status-line -ldflags="-s -w" -trimpath .
	@echo "✓ Built release: ./status-line ($(shell ls -lh status-line | awk '{print $$5}'))"

# Install to ~/.claude/bin
install: build
	@echo "Installing to ~/.claude/bin/..."
	mkdir -p ~/.claude/bin
	cp status-line ~/.claude/bin/
	chmod +x ~/.claude/bin/status-line
	@echo "✓ Installed: ~/.claude/bin/status-line"

# Clean build artifacts
clean:
	rm -f status-line
	rm -f ~/.claude/bin/status-line
	@echo "✓ Cleaned"
