# FSAS - Furman Student Attendance System

A comprehensive attendance tracking system built with Next.js, Express.js, and Supabase.

## 🚀 Quick Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/fsas)

## 📋 Features

- **Real-time Attendance Tracking** with QR codes
- **Professor Dashboard** with analytics and session management
- **Student Portal** with attendance history and class enrollment
- **WebSocket Integration** for live updates
- **Role-based Authentication** (Professor/Student)
- **Mobile-responsive Design**
- **Geofencing Support** for location-based attendance

## 🛠 Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Express.js, Socket.io
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Deployment**: Railway

## 🚀 Deployment Instructions

### Prerequisites

1. **Supabase Account**: Create a project at [supabase.com](https://supabase.com)
2. **Railway Account**: Sign up at [railway.app](https://railway.app)
3. **GitHub Repository**: Your code should be pushed to GitHub

### Step 1: Setup Supabase

1. Create a new Supabase project
2. Run the database schema: `database/final-optimized-schema.sql`
3. Get your project URL and API keys

### Step 2: Deploy to Railway

1. **Connect GitHub**: Link your Railway account to GitHub
2. **Create New Project**: Click "New Project" → "Deploy from GitHub repo"
3. **Select Repository**: Choose your `fsas` repository
4. **Configure Services**: Railway will detect both frontend and backend

### Step 3: Environment Variables

Set these environment variables in Railway:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# API Configuration
NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
NEXT_PUBLIC_FRONTEND_URL=https://your-frontend-url.railway.app
NEXT_PUBLIC_QR_BASE_URL=https://your-frontend-url.railway.app
API_PORT=3001

# Security
JWT_SECRET=your_jwt_secret
QR_SECRET=your_qr_secret
ENCRYPTION_KEY=your_encryption_key

# Geofencing (Furman University coordinates)
CLASSROOM_LAT=34.9224
CLASSROOM_LNG=-82.4365
GEOFENCE_RADIUS=100

# Node Environment
NODE_ENV=production
```

### Step 4: Custom Domains (Optional)

1. **Add Custom Domain**: In Railway dashboard → Settings → Domains
2. **SSL Certificate**: Automatically provided by Railway
3. **Update Environment Variables**: Use your custom domain URLs

## 🏗 Local Development

```bash
# Install dependencies
npm install

# Setup environment variables
cp env.example .env.local
# Edit .env.local with your values

# Start development servers
npm run dev
```

## 📁 Project Structure

```
fsas/
├── src/                    # Next.js frontend
│   ├── app/               # App router pages
│   ├── components/        # React components
│   ├── lib/               # Utilities and services
│   └── types/             # TypeScript definitions
├── backend/               # Express.js backend
│   ├── optimized-server.js
│   └── qr-code-generator.js
├── database/              # SQL schema
└── public/               # Static assets
```

## 🔧 Configuration Files

- `railway.toml` - Railway deployment configuration
- `nixpacks.toml` - Build configuration
- `env.production.template` - Production environment template
- `DEPLOYMENT_GUIDE.md` - Detailed deployment instructions

## 📱 Mobile Support

The system is fully responsive and works on:
- Desktop browsers
- Mobile browsers
- QR code scanning for attendance

## 🔒 Security Features

- JWT-based authentication
- Role-based access control
- Encrypted QR codes
- Rate limiting
- CORS protection
- Input validation

## 📊 Monitoring

Railway provides built-in monitoring for:
- Application logs
- Performance metrics
- Error tracking
- Resource usage

## 🆘 Troubleshooting

### Common Issues

1. **Environment Variables**: Ensure all required variables are set
2. **Database Connection**: Verify Supabase credentials
3. **CORS Issues**: Check `NEXT_PUBLIC_FRONTEND_URL` setting
4. **Build Failures**: Check Node.js version compatibility

### Support

- Check Railway logs in the dashboard
- Review Supabase logs in the project dashboard
- Verify environment variables are correctly set

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

---

**Built with ❤️ for Furman University**