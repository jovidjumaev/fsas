#!/bin/bash

# Student AI Assistant Setup Script
# This script sets up the database schema for the student AI assistant features

echo "🚀 Setting up Student AI Assistant..."

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ Error: .env.local file not found!"
    echo "Please create .env.local with your Supabase credentials"
    exit 1
fi

# Load environment variables
source .env.local

# Check if required environment variables are set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Error: Missing required environment variables!"
    echo "Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local"
    exit 1
fi

echo "✅ Environment variables loaded"

# Run the database migration
echo "📊 Running database migration..."

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql command not found!"
    echo "Please install PostgreSQL client tools"
    exit 1
fi

# Extract database connection details from Supabase URL
# Supabase URL format: https://[project-id].supabase.co
PROJECT_ID=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed 's/.*\/\/\([^.]*\)\.supabase\.co.*/\1/')
DB_HOST="db.$PROJECT_ID.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"

echo "🔗 Connecting to Supabase database..."

# Run the SQL migration
psql "postgresql://$DB_USER:$SUPABASE_SERVICE_ROLE_KEY@$DB_HOST:$DB_PORT/$DB_NAME" -f database/student-ai-assistant-schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Database migration completed successfully!"
    echo ""
    echo "🎉 Student AI Assistant is ready!"
    echo ""
    echo "📋 What was created:"
    echo "   • student_chat_sessions - For AI chat sessions"
    echo "   • student_chat_messages - For chat message history"
    echo "   • student_flashcards - For generated flashcards"
    echo "   • student_quiz_questions - For quiz questions"
    echo "   • student_quiz_sessions - For quiz session tracking"
    echo ""
    echo "🔐 Security features:"
    echo "   • Row Level Security (RLS) enabled"
    echo "   • Students can only access their own data"
    echo "   • Enrollment verification for all operations"
    echo ""
    echo "🚀 Next steps:"
    echo "   1. Start your development server: npm run dev"
    echo "   2. Navigate to a student class detail page"
    echo "   3. Click on the 'AI Assistant' tab"
    echo "   4. Start using the AI features!"
else
    echo "❌ Database migration failed!"
    echo "Please check your Supabase credentials and try again"
    exit 1
fi
