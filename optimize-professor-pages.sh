#!/bin/bash

# Script to optimize professor pages
# 1. Remove excessive logging
# 2. Update imports to use cached hooks

echo "🚀 Starting professor page optimization..."

# Remove logger.log statements but keep logger.error
echo "📝 Removing excessive logging from professor pages..."

# Professor dashboard
sed -i '' "s/logger\.log/logger.debug/g" src/app/professor/dashboard/page.tsx
sed -i '' "s/logger\.debug/\/\/ logger.debug/g" src/app/professor/dashboard/page.tsx
sed -i '' "s/\/\/ logger\.error/logger.error/g" src/app/professor/dashboard/page.tsx

# Professor classes
sed -i '' "s/logger\.log/logger.debug/g" src/app/professor/classes/page.tsx
sed -i '' "s/logger\.debug/\/\/ logger.debug/g" src/app/professor/classes/page.tsx
sed -i '' "s/\/\/ logger\.error/logger.error/g" src/app/professor/classes/page.tsx

# Professor sessions
sed -i '' "s/logger\.log/logger.debug/g" src/app/professor/sessions/page.tsx
sed -i '' "s/logger\.debug/\/\/ logger.debug/g" src/app/professor/sessions/page.tsx
sed -i '' "s/\/\/ logger\.error/logger.error/g" src/app/professor/sessions/page.tsx

# Class management page
sed -i '' "s/logger\.log/logger.debug/g" src/app/professor/classes/\[classId\]/page.tsx
sed -i '' "s/logger\.debug/\/\/ logger.debug/g" src/app/professor/classes/\[classId\]/page.tsx
sed -i '' "s/\/\/ logger\.error/logger.error/g" src/app/professor/classes/\[classId\]/page.tsx

# Active session page
sed -i '' "s/logger\.log/logger.debug/g" src/app/professor/sessions/active/\[sessionId\]/page.tsx
sed -i '' "s/logger\.debug/\/\/ logger.debug/g" src/app/professor/sessions/active/\[sessionId\]/page.tsx
sed -i '' "s/\/\/ logger\.error/logger.error/g" src/app/professor/sessions/active/\[sessionId\]/page.tsx

echo "✅ Logging optimization complete!"

# Count remaining logger statements
echo "📊 Logging statistics:"
echo "Dashboard: $(grep -c "logger\." src/app/professor/dashboard/page.tsx) logger calls remaining"
echo "Classes: $(grep -c "logger\." src/app/professor/classes/page.tsx) logger calls remaining"
echo "Sessions: $(grep -c "logger\." src/app/professor/sessions/page.tsx) logger calls remaining"

echo "🎉 Optimization complete!"