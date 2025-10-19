# 🚀 Production Fix for AI Assistant

## ❌ **The Problem**
Your AI Assistant isn't working in production because the frontend can't communicate with the backend. The frontend is trying to make API calls to relative URLs, but in production, the frontend and backend are on different domains.

## ✅ **The Solution**

### **Step 1: Find Your Backend URL**
You need to find your actual backend domain. Check your deployment platform:

**Railway:**
- Go to your Railway dashboard
- Find your backend service
- Copy the domain (e.g., `https://fsas-backend-production.up.railway.app`)

**Vercel:**
- Go to your Vercel dashboard
- Find your backend project
- Copy the domain (e.g., `https://fsas-backend.vercel.app`)

**Heroku:**
- Go to your Heroku dashboard
- Find your backend app
- Copy the domain (e.g., `https://fsas-backend.herokuapp.com`)

### **Step 2: Set Environment Variable**
In your **frontend** deployment (Railway/Vercel/Heroku), add this environment variable:

```
NEXT_PUBLIC_API_URL=https://your-actual-backend-domain.com
```

**Replace `https://your-actual-backend-domain.com` with your actual backend URL!**

### **Step 3: Redeploy Frontend**
After setting the environment variable, redeploy your frontend. The changes will take effect immediately.

## 🔧 **How It Works**

### **Before (Broken):**
```
Frontend: https://your-frontend.com
Backend:  https://your-backend.com
API Call: /api/classes/123/materials/upload
Result:   ❌ 404 Not Found (frontend tries to call its own domain)
```

### **After (Fixed):**
```
Frontend: https://your-frontend.com
Backend:  https://your-backend.com
API Call: /api/classes/123/materials/upload
Result:   ✅ Next.js rewrites to https://your-backend.com/api/classes/123/materials/upload
```

## 📝 **Example Configuration**

### **Railway Example:**
```
NEXT_PUBLIC_API_URL=https://fsas-backend-production.up.railway.app
```

### **Vercel Example:**
```
NEXT_PUBLIC_API_URL=https://fsas-backend.vercel.app
```

### **Heroku Example:**
```
NEXT_PUBLIC_API_URL=https://fsas-backend.herokuapp.com
```

## 🧪 **Testing**

After setting the environment variable and redeploying:

1. **Upload a PowerPoint file** - Should work and appear in materials list
2. **Delete a file** - Should work and remove from both database and storage
3. **Chat with AI** - Should work and get responses
4. **Check browser console** - Should see successful API calls

## 🚨 **Common Issues**

### **Issue 1: Still getting 404 errors**
- **Cause**: Wrong backend URL
- **Fix**: Double-check your backend domain in the environment variable

### **Issue 2: CORS errors**
- **Cause**: Backend not configured for your frontend domain
- **Fix**: Add your frontend domain to backend CORS settings

### **Issue 3: Environment variable not taking effect**
- **Cause**: Frontend not redeployed after setting env var
- **Fix**: Redeploy your frontend after setting the environment variable

## 🎯 **Quick Fix Commands**

If you're using Railway CLI:
```bash
railway variables set NEXT_PUBLIC_API_URL=https://your-backend-domain.com
railway redeploy
```

If you're using Vercel CLI:
```bash
vercel env add NEXT_PUBLIC_API_URL
# Enter: https://your-backend-domain.com
vercel --prod
```

## ✅ **Expected Result**

After fixing this, your AI Assistant should work perfectly in production:
- ✅ PowerPoint files upload and display
- ✅ Files can be deleted from both database and storage
- ✅ AI chat works with proper responses
- ✅ Dark theme confirmation dialogs work
- ✅ All debugging logs show successful API calls

**The key is setting `NEXT_PUBLIC_API_URL` to your actual backend domain!** 🚀
