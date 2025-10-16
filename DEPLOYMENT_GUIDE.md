# FSAS Deployment Guide - Railway

## Step-by-Step Deployment Instructions

### Prerequisites
1. GitHub account with your FSAS repository
2. Railway account (free at railway.app)
3. Supabase project (already configured)

### Step 1: Prepare Your Repository
- [x] Create production environment template
- [x] Add Railway configuration files
- [x] Update package.json scripts

### Step 2: Deploy Backend to Railway

1. **Go to Railway.app** and sign up/login
2. **Create New Project** → "Deploy from GitHub repo"
3. **Select your FSAS repository**
4. **Configure Backend Service:**
   - Service Name: `fsas-backend`
   - Root Directory: `/` (root of repo)
   - Build Command: `npm run build:backend`
   - Start Command: `npm run start:backend`
   - Port: `3001`

5. **Set Environment Variables:**
   ```
   NODE_ENV=production
   PORT=3001
   NEXT_PUBLIC_SUPABASE_URL=https://zdtxqzpgggolbebrsymp.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkdHhxenBnZ2dvbGJlYnJzeW1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MDQyOTEsImV4cCI6MjA3NDA4MDI5MX0.sKzlSmmYQAZ2czFVMZh5bNFk14SdXLvc_vCfi_pSq2Ik
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkdHhxenBnZ2dvbGJlYnJzeW1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODUwNDI5MSwiZXhwIjoyMDc0MDgwMjkxfQ.CURDVpLekSL0iOnSEurdVwzWKCi5ldQQcgEkR1g3hqU
   JWT_SECRET=fsas_jwt_secret_key_2024_production_secure
   QR_SECRET=fsas_qr_secret_key_2024_production_secure
   ENCRYPTION_KEY=fsas_encryption_key_2024_production_secure
   ```

6. **Deploy** and wait for completion
7. **Copy the generated URL** (e.g., `https://fsas-backend-production-xxxx.up.railway.app`)

### Step 3: Deploy Frontend to Railway

1. **Add New Service** to the same Railway project
2. **Configure Frontend Service:**
   - Service Name: `fsas-frontend`
   - Root Directory: `/` (root of repo)
   - Build Command: `npm run build:frontend`
   - Start Command: `npm run start:frontend`
   - Port: `3000`

3. **Set Environment Variables:**
   ```
   NODE_ENV=production
   PORT=3000
   NEXT_PUBLIC_SUPABASE_URL=https://zdtxqzpgggolbebrsymp.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkdHhxenBnZ2dvbGJlYnJzeW1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MDQyOTEsImV4cCI6MjA3NDA4MDI5MX0.sKzlSmmYQAZ2czFVMZh5bNFk14SdXLvc_vCfi_pSq2Ik
   NEXT_PUBLIC_API_URL=https://fsas-backend-production-xxxx.up.railway.app
   NEXT_PUBLIC_FRONTEND_URL=https://fsas-frontend-production-yyyy.up.railway.app
   NEXT_PUBLIC_QR_BASE_URL=https://fsas-frontend-production-yyyy.up.railway.app
   ```

4. **Deploy** and wait for completion
5. **Copy the generated URL** (e.g., `https://fsas-frontend-production-yyyy.up.railway.app`)

### Step 4: Update Backend Environment Variables

1. **Go back to Backend Service** in Railway
2. **Update Environment Variables:**
   ```
   NEXT_PUBLIC_FRONTEND_URL=https://fsas-frontend-production-yyyy.up.railway.app
   ```

### Step 5: Test Your Deployment

1. **Visit your frontend URL**
2. **Test login functionality**
3. **Test QR code generation**
4. **Test real-time features**

### Step 6: Custom Domain (Optional)

1. **In Railway dashboard**, go to your service
2. **Settings** → **Domains**
3. **Add custom domain** (e.g., `fsas.yourdomain.com`)
4. **Update DNS records** as instructed
5. **Update environment variables** with new domain

## Important Notes

- **Free Tier Limits**: Railway gives $5 credit/month (about 500 hours)
- **Environment Variables**: Make sure all URLs use HTTPS in production
- **Database**: Your Supabase database will work as-is
- **Real-time Features**: Socket.io will work perfectly on Railway
- **SSL**: Railway provides automatic SSL certificates

## Troubleshooting

- **Build Failures**: Check Railway logs for specific errors
- **Environment Variables**: Ensure all required variables are set
- **CORS Issues**: Update CORS settings in backend
- **Database Connection**: Verify Supabase credentials

## Next Steps After Deployment

1. Test all functionality
2. Set up monitoring
3. Configure custom domain
4. Set up automated backups
5. Monitor usage and costs
