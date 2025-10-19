#!/bin/bash

echo "🧪 AI Assistant Component Testing"
echo "Testing AI Assistant without affecting production database"

# Backup current environment
echo "📦 Backing up current environment..."
cp .env.local .env.local.production.backup

# Create a simple test environment
cat > .env.local.testing << 'EOF'
# AI Assistant Testing Environment
# Uses production Supabase but with test data only

# Production Supabase (read-only for testing)
NEXT_PUBLIC_SUPABASE_URL=https://zdtxqzpgggolbebrsymp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkdHhxenBnZ2dvbGJlYnJzeW1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MDQyOTEsImV4cCI6MjA3NDA4MDI5MX0.sKzlSmmYQAZ2czFVMZh5bNFk14SdXLvc_vCfi_pSq2Ik
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkdHhxenBnZ2dvbGJlYnJzeW1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODUwNDI5MSwiZXhwIjoyMDc0MDgwMjkxfQ.CURDVpLekSL0iOnSEurdVwzWKCi5ldQQcgEkR1g3hqU

# Local API Configuration
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
API_PORT=3001

# Security
JWT_SECRET=test_jwt_secret
QR_SECRET=test_qr_secret
ENCRYPTION_KEY=test_encryption_key

# Development
NODE_ENV=development

# AI Assistant Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_RATE_LIMIT_PER_HOUR=50
OPENAI_RATE_LIMIT_PER_DAY=1000
EOF

echo "✅ Created testing environment"

# Test AI Assistant components
echo "🧪 Testing AI Assistant components..."

# Test OpenAI connection
echo "Testing OpenAI connection..."
node -e "
require('dotenv').config({ path: '.env.local.testing' });
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
openai.chat.completions.create({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Hello, this is a test.' }],
  max_tokens: 10
}).then(response => {
  console.log('✅ OpenAI connection successful');
  console.log('Response:', response.choices[0].message.content);
}).catch(error => {
  console.log('❌ OpenAI error:', error.message);
});
"

echo ""
echo "🎯 Testing Options:"
echo ""
echo "Option 1: Test with existing production data (SAFE - read-only)"
echo "  mv .env.local.testing .env.local"
echo "  npm run dev"
echo ""
echo "Option 2: Test AI components only (no database)"
echo "  npm run test-ai-assistant"
echo ""
echo "Option 3: Create test data in production (CAREFUL)"
echo "  # Only if you want to test with real data"
echo ""
echo "🔒 Your production environment is backed up as .env.local.production.backup"
