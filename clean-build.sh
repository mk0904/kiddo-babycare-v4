#!/bin/bash

echo "🧹 Cleaning iOS build cache..."

# Clean iOS build directory
if [ -d "ios/build" ]; then
  rm -rf ios/build
  echo "✅ Removed ios/build"
fi

# Clean node cache
if [ -d "node_modules/.cache" ]; then
  rm -rf node_modules/.cache
  echo "✅ Removed node_modules/.cache"
fi

# Clean Expo cache
if [ -d ".expo" ]; then
  rm -rf .expo
  echo "✅ Removed .expo"
fi

# Clean Xcode derived data (optional but thorough)
if [ -d ~/Library/Developer/Xcode/DerivedData/Kiddo-* ]; then
  rm -rf ~/Library/Developer/Xcode/DerivedData/Kiddo-*
  echo "✅ Removed Xcode DerivedData for Kiddo"
fi

echo ""
echo "✨ Cleanup complete! You can now rebuild in Xcode."
echo ""
echo "Next steps:"
echo "1. Open Xcode"
echo "2. Product → Clean Build Folder (Shift+Cmd+K)"
echo "3. Product → Build (Cmd+B)"

