#!/bin/bash

echo "════════════════════════════════════════════════════════════"
echo "OneSignal Build Verification"
echo "════════════════════════════════════════════════════════════"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

cd ios

echo "1️⃣ Cleaning previous builds..."
rm -rf build/
rm -rf ~/Library/Developer/Xcode/DerivedData/Kiddo-*
echo -e "${GREEN}✅ Cleaned${NC}"
echo ""

echo "2️⃣ Verifying Pods are up to date..."
pod install --repo-update
echo ""

echo "3️⃣ Checking for OneSignal in Podfile.lock..."
if grep -q "OneSignalXCFramework" Podfile.lock; then
    echo -e "${GREEN}✅ OneSignalXCFramework found in Podfile.lock${NC}"
    grep "OneSignalXCFramework" Podfile.lock | head -3
else
    echo -e "${RED}❌ OneSignalXCFramework NOT in Podfile.lock${NC}"
    exit 1
fi
echo ""

echo "4️⃣ Checking framework files exist..."
# OneSignal v5 uses XCFrameworks in iOS_SDK directory
FRAMEWORK_BASE="Pods/OneSignalXCFramework"
if [ -d "$FRAMEWORK_BASE" ]; then
    echo -e "${GREEN}✅ OneSignalXCFramework directory exists${NC}"
    
    # Check for XCFrameworks (OneSignal v5 structure)
    if [ -d "$FRAMEWORK_BASE/iOS_SDK" ]; then
        echo -e "${GREEN}✅ OneSignal iOS_SDK found${NC}"
        FRAMEWORK_COUNT=$(find "$FRAMEWORK_BASE/iOS_SDK" -name "*.xcframework" -type d 2>/dev/null | wc -l | tr -d ' ')
        if [ "$FRAMEWORK_COUNT" -gt 0 ]; then
            echo -e "${GREEN}✅ Found $FRAMEWORK_COUNT OneSignal XCFrameworks${NC}"
            find "$FRAMEWORK_BASE/iOS_SDK" -name "*.xcframework" -type d 2>/dev/null | head -5 | while read fw; do
                echo "   - $(basename "$fw")"
            done
        else
            echo -e "${YELLOW}⚠️ No XCFrameworks found in iOS_SDK${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ iOS_SDK directory not found${NC}"
    fi
else
    echo -e "${RED}❌ OneSignalXCFramework directory NOT found${NC}"
    echo "   Expected at: $FRAMEWORK_BASE"
    exit 1
fi
echo ""

echo "5️⃣ Checking Xcode project links OneSignal..."
if grep -q "OneSignalFramework.framework" Kiddo.xcodeproj/project.pbxproj; then
    echo -e "${GREEN}✅ OneSignalFramework referenced in Xcode project${NC}"
else
    echo -e "${YELLOW}⚠️ OneSignalFramework may not be linked${NC}"
    echo "   Check manually in Xcode: Build Phases → Link Binary"
fi
echo ""

echo "6️⃣ Attempting to verify with xcodebuild..."
if command -v xcodebuild &> /dev/null; then
    echo "   Building to check for errors..."
    xcodebuild -project Kiddo.xcodeproj \
               -scheme Kiddo \
               -configuration Release \
               -sdk iphoneos \
               CODE_SIGN_IDENTITY="" \
               CODE_SIGNING_REQUIRED=NO \
               CODE_SIGNING_ALLOWED=NO \
               clean build 2>&1 | tee /tmp/onesignal_build.log
    
    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        echo -e "${GREEN}✅ Build succeeded!${NC}"
        
        # Check if OneSignal is mentioned in build log
        if grep -qi "onesignal" /tmp/onesignal_build.log; then
            echo -e "${GREEN}✅ OneSignal found in build log${NC}"
        fi
        
        # Check for linking errors
        if grep -qi "undefined symbol.*OneSignal" /tmp/onesignal_build.log; then
            echo -e "${RED}❌ OneSignal linking errors found!${NC}"
            grep -i "undefined symbol.*OneSignal" /tmp/onesignal_build.log
        else
            echo -e "${GREEN}✅ No OneSignal linking errors${NC}"
        fi
    else
        echo -e "${RED}❌ Build failed!${NC}"
        echo "   Check /tmp/onesignal_build.log for details"
        echo "   Common issues:"
        echo "   - Missing frameworks"
        echo "   - Code signing issues"
        echo "   - Missing dependencies"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️ xcodebuild not available${NC}"
    echo "   Install Xcode Command Line Tools: xcode-select --install"
fi

cd ..

echo ""
echo "════════════════════════════════════════════════════════════"
echo "Build Verification Complete"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "If build succeeded, OneSignal should work in TestFlight"
echo "If build failed, check the errors above and fix them"

