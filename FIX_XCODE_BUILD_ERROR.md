# Fix for Xcode Build Error: EPERM on expo/bin/autolinking

## Problem
The Xcode build is failing with:
```
Error: EPERM: operation not permitted, open '/Users/farzan/Desktop/kiddo-app/node_modules/expo/bin/autolinking'
```

This is a macOS security/permission issue preventing Node.js from reading files in `node_modules`.

## Solutions (try in order)

### Solution 1: Grant Full Disk Access to Terminal/Xcode

1. Open **System Settings** (or System Preferences on older macOS)
2. Go to **Privacy & Security** → **Full Disk Access**
3. Click the **+** button and add:
   - **Terminal** (or iTerm if you use it)
   - **Xcode** (if it's not already there)
4. Restart Terminal/Xcode
5. Try building again

### Solution 2: Remove Extended Attributes

Run this command in Terminal (outside of Cursor):

```bash
cd /Users/farzan/Desktop/kiddo-app
find node_modules -type f -exec xattr -c {} \; 2>/dev/null
find node_modules -type d -exec xattr -c {} \; 2>/dev/null
```

Or use the provided script:
```bash
cd /Users/farzan/Desktop/kiddo-app
./fix-permissions.sh
```

### Solution 3: Reinstall node_modules

If the above doesn't work, reinstall dependencies:

```bash
cd /Users/farzan/Desktop/kiddo-app
rm -rf node_modules
npm install
# or if you use yarn:
# yarn install
```

### Solution 4: Check File Permissions

Verify the file exists and has correct permissions:

```bash
cd /Users/farzan/Desktop/kiddo-app
ls -la node_modules/expo/bin/autolinking
chmod 755 node_modules/expo/bin/autolinking
```

### Solution 5: Reinstall Expo Package

```bash
cd /Users/farzan/Desktop/kiddo-app
npm uninstall expo
npm install expo@~54.0.30
```

## Most Likely Fix

The most common cause is **Full Disk Access**. Make sure Terminal and Xcode have Full Disk Access enabled in System Settings.

After applying any solution, try building in Xcode again.

