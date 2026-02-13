#!/bin/bash
# Verify that exponential-backoff is installed

cd "$(dirname "$0")"

echo "Checking for exponential-backoff dependency..."

# Check if it exists in node_modules
if [ -d "node_modules/exponential-backoff" ]; then
  echo "✅ exponential-backoff found in node_modules/"
  exit 0
fi

# Check if it exists in metro-cache's node_modules (hoisted)
if [ -d "node_modules/metro-cache/node_modules/exponential-backoff" ]; then
  echo "✅ exponential-backoff found in metro-cache/node_modules/"
  exit 0
fi

# Check if node can resolve it
if node -e "require.resolve('exponential-backoff')" 2>/dev/null; then
  echo "✅ exponential-backoff can be resolved by Node.js"
  exit 0
fi

echo "❌ exponential-backoff NOT FOUND"
echo ""
echo "Installing missing dependency..."
npm install exponential-backoff

if [ $? -eq 0 ]; then
  echo "✅ exponential-backoff installed successfully"
  exit 0
else
  echo "❌ Failed to install exponential-backoff"
  echo "Please run: npm install"
  exit 1
fi

