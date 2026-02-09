#!/bin/bash

# Script to fix Metro bundler issues by cleaning and reinstalling dependencies

echo "🧹 Cleaning caches and node_modules..."

# Stop Metro bundler if running
pkill -f "expo start" || true
pkill -f "metro" || true

# Remove caches
rm -rf node_modules/.cache
rm -rf .metro
rm -rf .expo/metro
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-map-*

# Remove node_modules
rm -rf node_modules

# Clear npm cache (optional, but helps)
# npm cache clean --force

echo "📦 Reinstalling dependencies..."
npm install

echo "✅ Done! Now restart Metro with: npm start -- --clear"
