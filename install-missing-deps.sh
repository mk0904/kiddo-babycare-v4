#!/bin/bash
# Install missing exponential-backoff dependency

set -e

cd "$(dirname "$0")"

echo "Installing missing exponential-backoff dependency..."
npm install exponential-backoff@^3.1.1

echo ""
echo "✅ Installation complete!"
echo ""
echo "Please try archiving again in Xcode."

