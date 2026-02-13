#!/bin/bash

# Build Android Release APK
# This script builds a release APK for the Android app

echo "Building Android Release APK..."
echo ""

cd "$(dirname "$0")/android"

# Make sure gradlew is executable
chmod +x gradlew

# Clean previous build (optional, uncomment if you want a clean build)
# ./gradlew clean

# Build the release APK
./gradlew assembleRelease

# Check if build was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Build successful!"
    echo ""
    echo "APK location:"
    echo "  $(pwd)/app/build/outputs/apk/release/app-release.apk"
    echo ""
    echo "To install on a connected device:"
    echo "  adb install app/build/outputs/apk/release/app-release.apk"
else
    echo ""
    echo "✗ Build failed. Please check the error messages above."
    exit 1
fi

