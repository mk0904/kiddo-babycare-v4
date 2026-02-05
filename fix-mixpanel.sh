#!/bin/bash

echo "🔧 Fixing Mixpanel Native Module Linking..."
echo ""

# Navigate to project root
cd "$(dirname "$0")"

# Step 1: Verify package is installed
echo "📦 Step 1: Verifying mixpanel-react-native is installed..."
if ! grep -q "mixpanel-react-native" package.json; then
    echo "❌ mixpanel-react-native not found in package.json"
    echo "Installing..."
    npm install mixpanel-react-native@^2.1.0
else
    echo "✅ mixpanel-react-native found in package.json"
fi

# Step 2: Clean everything
echo ""
echo "🧹 Step 2: Cleaning build artifacts..."
rm -rf ios/build
rm -rf ios/Pods
rm -rf ios/Podfile.lock
rm -rf node_modules/.cache
rm -rf .expo

# Step 3: Reinstall node modules
echo ""
echo "📥 Step 3: Reinstalling node modules..."
npm install

# Step 4: Regenerate native code
echo ""
echo "🔄 Step 4: Regenerating native code..."
npx expo prebuild --clean --platform ios

# Step 5: Install pods
echo ""
echo "🍎 Step 5: Installing CocoaPods dependencies..."
cd ios
pod deintegrate 2>/dev/null || true
pod install
cd ..

# Step 6: Verify Mixpanel pod
echo ""
echo "✅ Step 6: Verifying Mixpanel pod installation..."
if grep -q "Mixpanel" ios/Podfile.lock 2>/dev/null; then
    echo "✅ Mixpanel pod found in Podfile.lock"
else
    echo "⚠️  Mixpanel pod not found - may need manual linking"
fi

echo ""
echo "✅ Fix complete! Next steps:"
echo "1. Open Xcode: open ios/Kiddo.xcworkspace"
echo "2. Clean build folder: Cmd+Shift+K"
echo "3. Build: Cmd+B"
echo "4. Run on device/simulator"
echo ""
echo "Note: You should see '✅ Mixpanel initialized successfully' in logs"

