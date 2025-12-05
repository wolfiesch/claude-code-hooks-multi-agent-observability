#!/bin/bash
#
# One-command global installation for Codex observability tracking
# Usage: ./scripts/install-global-tracking.sh
#

set -e

echo "🚀 Installing Codex Observability Tracking..."

# Configuration
INSTALL_DIR="$HOME/.local/bin/codex-observability"
BIN_DIR="$HOME/.local/bin"
SHELL_CONFIG="$HOME/.zshrc"

# Detect shell config file
if [ -f "$HOME/.bashrc" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_CONFIG="$HOME/.bash_profile"
fi

# Get the directory where this script lives
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Create installation directory
echo "📁 Creating installation directory..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"

# Copy files
echo "📋 Copying files..."
cp "$PROJECT_DIR/.claude/hooks/codex-tracked" "$INSTALL_DIR/"
cp "$PROJECT_DIR/.claude/hooks/codex_wrapper.ts" "$INSTALL_DIR/"
cp "$PROJECT_DIR/.claude/hooks/send_event.py" "$INSTALL_DIR/"
cp -r "$PROJECT_DIR/.claude/hooks/utils" "$INSTALL_DIR/"

# Make executable
chmod +x "$INSTALL_DIR/codex-tracked"

# Create symlink
echo "🔗 Creating symlink..."
ln -sf "$INSTALL_DIR/codex-tracked" "$BIN_DIR/codex-tracked"

# Add to PATH if not already present
if ! grep -q 'export PATH="$HOME/.local/bin:$PATH"' "$SHELL_CONFIG"; then
    echo "" >> "$SHELL_CONFIG"
    echo '# Codex Observability Tracking' >> "$SHELL_CONFIG"
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_CONFIG"
    echo "✅ Added $BIN_DIR to PATH in $SHELL_CONFIG"
fi

# Offer to create alias
echo ""
read -p "❓ Create alias 'codex=codex-tracked' for automatic tracking? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if ! grep -q 'alias codex="codex-tracked"' "$SHELL_CONFIG"; then
        echo 'alias codex="codex-tracked"' >> "$SHELL_CONFIG"
        echo "✅ Created alias in $SHELL_CONFIG"
    else
        echo "ℹ️  Alias already exists"
    fi
fi

# Validation
echo ""
echo "🔍 Validating installation..."

if [ -x "$BIN_DIR/codex-tracked" ]; then
    echo "✅ codex-tracked is executable"
else
    echo "❌ ERROR: codex-tracked is not executable"
    exit 1
fi

if [ -f "$INSTALL_DIR/codex_wrapper.ts" ]; then
    echo "✅ codex_wrapper.ts found"
else
    echo "❌ ERROR: codex_wrapper.ts missing"
    exit 1
fi

if [ -f "$INSTALL_DIR/send_event.py" ]; then
    echo "✅ send_event.py found"
else
    echo "❌ ERROR: send_event.py missing"
    exit 1
fi

if [ -d "$INSTALL_DIR/utils" ]; then
    echo "✅ utils directory found"
else
    echo "❌ ERROR: utils directory missing"
    exit 1
fi

# Success message
echo ""
echo "✅ Installation complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Reload your shell: source $SHELL_CONFIG"
echo "   2. Start the observability server: cd $PROJECT_DIR && ./scripts/start-system.sh"
echo "   3. Test tracking: codex-tracked exec -m gpt-5.1-codex-max 'echo test'"
echo "   4. View dashboard: http://localhost:5174"
echo ""
echo "🎉 You can now track Codex from ANY repository!"
