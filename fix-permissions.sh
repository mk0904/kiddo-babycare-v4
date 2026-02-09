#!/bin/bash

# Script to fix permission issues with node_modules
# This script removes extended attributes that may be blocking Node.js access

echo "Fixing permissions on node_modules..."

# Remove extended attributes from node_modules
find node_modules -type f -exec xattr -c {} \; 2>/dev/null
find node_modules -type d -exec xattr -c {} \; 2>/dev/null

# Also fix expo package specifically
if [ -d "node_modules/expo" ]; then
    echo "Fixing expo package permissions..."
    find node_modules/expo -type f -exec chmod 644 {} \; 2>/dev/null
    find node_modules/expo -type d -exec chmod 755 {} \; 2>/dev/null
    find node_modules/expo/bin -type f -exec chmod 755 {} \; 2>/dev/null
fi

echo "Done! Try building again in Xcode."

