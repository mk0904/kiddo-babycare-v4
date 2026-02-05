#!/bin/bash
# Fix missing exponential-backoff dependency

echo "Fixing missing dependencies..."

cd "$(dirname "$0")"

# Remove node_modules and package-lock.json
echo "Removing node_modules and package-lock.json..."
rm -rf node_modules
rm -f package-lock.json

# Reinstall dependencies
echo "Reinstalling dependencies..."
npm install

echo "✅ Dependencies reinstalled. Please try archiving again in Xcode."

