#!/bin/bash

echo "🚀 Setting up AI Assistant for FSAS..."

# Install new dependencies
echo "📦 Installing new dependencies..."
npm install

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    echo "   Or visit: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Run the database migration
echo "🗄️  Running database migration..."
echo "Please run the following SQL in your Supabase dashboard:"
echo ""
echo "Copy and paste the contents of database/ai-assistant-schema.sql"
echo "into your Supabase SQL editor and execute it."
echo ""

# Create Supabase Storage bucket for class materials
echo "📁 Creating Supabase Storage bucket..."
echo "Please create a storage bucket named 'class-materials' in your Supabase dashboard:"
echo "1. Go to Storage in your Supabase dashboard"
echo "2. Create a new bucket named 'class-materials'"
echo "3. Set it to public if you want files to be accessible via URL"
echo ""

# Environment setup
echo "🔧 Environment Setup:"
echo "Add these variables to your .env.local file:"
echo ""
echo "# AI Assistant Configuration"
echo "OPENAI_API_KEY=sk-your-openai-api-key-here"
echo "OPENAI_RATE_LIMIT_PER_HOUR=50"
echo "OPENAI_RATE_LIMIT_PER_DAY=1000"
echo ""

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add your OpenAI API key to .env.local"
echo "2. Run the database migration (ai-assistant-schema.sql)"
echo "3. Create the 'class-materials' storage bucket"
echo "4. Start the development server: npm run dev"
echo ""
echo "🎉 You can now use the AI Assistant tab in your professor class pages!"
