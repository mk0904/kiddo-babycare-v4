#!/bin/bash

echo "════════════════════════════════════════════════════════════"
echo "OneSignal Pre-Flight Check"
echo "════════════════════════════════════════════════════════════"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Node modules
echo "1️⃣ Checking node_modules..."
if [ -d "node_modules/react-native-onesignal" ]; then
    echo -e "${GREEN}✅ react-native-onesignal found in node_modules${NC}"
    VERSION=$(cat node_modules/react-native-onesignal/package.json | grep '"version"' | head -1 | awk -F: '{ print $2 }' | sed 's/[", ]//g')
    echo "   Version: $VERSION"
else
    echo -e "${RED}❌ react-native-onesignal NOT found in node_modules${NC}"
    echo "   Run: npm install or yarn install"
    exit 1
fi
echo ""

# Check 2: iOS Pods
echo "2️⃣ Checking iOS Pods..."
if [ -d "ios/Pods" ]; then
    if [ -d "ios/Pods/OneSignalXCFramework" ]; then
        echo -e "${GREEN}✅ OneSignalXCFramework found in Pods${NC}"
    else
        echo -e "${RED}❌ OneSignalXCFramework NOT found in Pods${NC}"
        echo "   Run: cd ios && pod install"
        exit 1
    fi
    
    # Check Podfile.lock
    if grep -q "OneSignalXCFramework" ios/Podfile.lock; then
        echo -e "${GREEN}✅ OneSignalXCFramework in Podfile.lock${NC}"
        VERSION=$(grep -A 1 "OneSignalXCFramework (" ios/Podfile.lock | head -1 | sed 's/.*(\(.*\))/\1/')
        echo "   Version: $VERSION"
    else
        echo -e "${RED}❌ OneSignalXCFramework NOT in Podfile.lock${NC}"
        echo "   Run: cd ios && pod install"
        exit 1
    fi
else
    echo -e "${RED}❌ Pods directory not found${NC}"
    echo "   Run: cd ios && pod install"
    exit 1
fi
echo ""

# Check 3: Xcode project - Check if frameworks are linked
echo "3️⃣ Checking Xcode project configuration..."
if [ -f "ios/Kiddo.xcodeproj/project.pbxproj" ]; then
    if grep -q "OneSignalFramework" ios/Kiddo.xcodeproj/project.pbxproj; then
        echo -e "${GREEN}✅ OneSignal frameworks found in Xcode project${NC}"
    else
        echo -e "${YELLOW}⚠️ OneSignal frameworks may not be linked in Xcode project${NC}"
        echo "   Check: Xcode → Build Phases → Link Binary With Libraries"
    fi
else
    echo -e "${RED}❌ Xcode project not found${NC}"
    exit 1
fi
echo ""

# Check 4: Entitlements
echo "4️⃣ Checking entitlements..."
if [ -f "ios/Kiddo/Kiddo.entitlements" ]; then
    if grep -q "aps-environment" ios/Kiddo/Kiddo.entitlements; then
        APS_ENV=$(grep -A 1 "aps-environment" ios/Kiddo/Kiddo.entitlements | tail -1 | sed 's/.*<string>\(.*\)<\/string>.*/\1/')
        if [ "$APS_ENV" = "production" ]; then
            echo -e "${GREEN}✅ aps-environment set to: production (correct for TestFlight)${NC}"
        else
            echo -e "${YELLOW}⚠️ aps-environment set to: $APS_ENV${NC}"
            echo "   For TestFlight, should be 'production'"
        fi
    else
        echo -e "${RED}❌ aps-environment not found in entitlements${NC}"
    fi
else
    echo -e "${RED}❌ Entitlements file not found${NC}"
fi
echo ""

# Check 5: Info.plist
echo "5️⃣ Checking Info.plist..."
if [ -f "ios/Kiddo/Info.plist" ]; then
    if grep -q "UIBackgroundModes" ios/Kiddo/Info.plist; then
        if grep -q "remote-notification" ios/Kiddo/Info.plist; then
            echo -e "${GREEN}✅ remote-notification in UIBackgroundModes${NC}"
        else
            echo -e "${RED}❌ remote-notification NOT in UIBackgroundModes${NC}"
        fi
    else
        echo -e "${RED}❌ UIBackgroundModes not found${NC}"
    fi
else
    echo -e "${RED}❌ Info.plist not found${NC}"
fi
echo ""

# Check 6: Service file
echo "6️⃣ Checking OneSignal service file..."
if [ -f "services/oneSignalService.ts" ]; then
    if grep -q "ONESIGNAL_APP_ID" services/oneSignalService.ts; then
        APP_ID=$(grep "ONESIGNAL_APP_ID" services/oneSignalService.ts | head -1 | sed "s/.*= '\(.*\)';/\1/")
        echo -e "${GREEN}✅ OneSignal service file found${NC}"
        echo "   App ID: $APP_ID"
    else
        echo -e "${RED}❌ ONESIGNAL_APP_ID not found in service file${NC}"
    fi
else
    echo -e "${RED}❌ oneSignalService.ts not found${NC}"
fi
echo ""

# Check 7: Try to build (if xcodebuild is available)
echo "7️⃣ Checking if we can verify build configuration..."
if command -v xcodebuild &> /dev/null; then
    echo "   Attempting to check build settings..."
    cd ios
    if xcodebuild -project Kiddo.xcodeproj -scheme Kiddo -configuration Release -showBuildSettings 2>/dev/null | grep -q "OneSignal"; then
        echo -e "${GREEN}✅ OneSignal found in build settings${NC}"
    else
        echo -e "${YELLOW}⚠️ Could not verify OneSignal in build settings${NC}"
        echo "   This might be normal - check manually in Xcode"
    fi
    cd ..
else
    echo "   xcodebuild not available (this is okay)"
fi
echo ""

# Summary
echo "════════════════════════════════════════════════════════════"
echo "Summary"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. If any checks failed above, fix them first"
echo "2. Run: cd ios && pod install"
echo "3. Open Xcode: open ios/Kiddo.xcodeproj"
echo "4. Check: Build Phases → Link Binary With Libraries"
echo "5. Verify OneSignal frameworks are listed"
echo "6. Clean build: Product → Clean Build Folder"
echo "7. Build: Product → Build (Cmd+B)"
echo "8. Check for any red errors in Xcode"
echo ""
echo "If build succeeds, then archive for TestFlight"
echo "════════════════════════════════════════════════════════════"

