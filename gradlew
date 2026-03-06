#!/bin/sh
# Wrapper so ./gradlew works from repo root (gradlew lives in android/)
DIR="$(cd "$(dirname "$0")" && pwd)"
exec sh "$DIR/android/gradlew" "$@"
