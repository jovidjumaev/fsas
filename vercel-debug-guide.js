#!/usr/bin/env node

/**
 * Vercel Production Debugging Script
 * 
 * This script helps debug what's happening in your Vercel deployment
 * when the professor dashboard shows 0s despite having data.
 */

console.log('🔍 Vercel Production Debugging Guide');
console.log('=' .repeat(60));

console.log('\n📋 Step-by-Step Debugging Process:');
console.log('=' .repeat(60));

console.log('\n1. 🌐 Check Your Vercel Domain');
console.log('   - What is your actual Vercel URL?');
console.log('   - Is it something like: https://your-app-name.vercel.app');
console.log('   - Or a custom domain?');

console.log('\n2. 🔧 Verify Railway Environment Variables');
console.log('   Go to your Railway backend project and check:');
console.log('   - NEXT_PUBLIC_FRONTEND_URL should be set to your Vercel URL');
console.log('   - Example: https://your-app-name.vercel.app');
console.log('   - Make sure there are no trailing slashes');

console.log('\n3. 🔄 Force Railway Redeploy');
console.log('   - After setting environment variables, Railway should auto-redeploy');
console.log('   - If not, manually trigger a redeploy');
console.log('   - Wait for deployment to complete');

console.log('\n4. 🌍 Test CORS from Browser');
console.log('   Open browser dev tools on your Vercel site and run:');
console.log(`
   fetch('http://156.143.88.239:3001/api/professors/4dabb92c-bd05-4451-a452-492890529210/dashboard', {
     method: 'GET',
     headers: {
       'Content-Type': 'application/json'
     }
   })
   .then(response => response.json())
   .then(data => console.log('API Response:', data))
   .catch(error => console.error('Error:', error));
`);

console.log('\n5. 🔍 Check Browser Network Tab');
console.log('   - Open DevTools → Network tab');
console.log('   - Refresh the professor dashboard page');
console.log('   - Look for API calls to your backend');
console.log('   - Check if requests are being made');
console.log('   - Check if requests are failing');
console.log('   - Look for CORS errors (red text)');

console.log('\n6. 🆔 Verify User Authentication');
console.log('   - Check if you\'re actually signed in as prof@furman.edu');
console.log('   - Look at the user ID in the API calls');
console.log('   - Should be: 4dabb92c-bd05-4451-a452-492890529210');

console.log('\n7. 🔗 Check API URL Configuration');
console.log('   - Verify NEXT_PUBLIC_API_URL in Vercel environment variables');
console.log('   - Should be: http://156.143.88.239:3001');
console.log('   - Or your Railway backend URL if different');

console.log('\n8. 🗄️ Check Database Connection');
console.log('   - Verify Vercel is using the same Supabase project');
console.log('   - Check NEXT_PUBLIC_SUPABASE_URL matches your backend');
console.log('   - Check NEXT_PUBLIC_SUPABASE_ANON_KEY matches your backend');

console.log('\n9. 🧹 Clear Cache');
console.log('   - Clear browser cache');
console.log('   - Try incognito/private browsing');
console.log('   - Clear Vercel cache (redeploy)');

console.log('\n10. 📊 Check Console Errors');
console.log('   - Look for JavaScript errors in browser console');
console.log('   - Look for network errors');
console.log('   - Look for authentication errors');

console.log('\n🔍 Common Issues and Solutions:');
console.log('=' .repeat(60));

console.log('\n❌ Issue: CORS Error');
console.log('   Solution: Set NEXT_PUBLIC_FRONTEND_URL in Railway to your Vercel URL');

console.log('\n❌ Issue: Wrong API URL');
console.log('   Solution: Check NEXT_PUBLIC_API_URL in Vercel environment variables');

console.log('\n❌ Issue: Different Database');
console.log('   Solution: Verify Supabase credentials match between Vercel and Railway');

console.log('\n❌ Issue: Authentication Problem');
console.log('   Solution: Check if user is actually signed in as prof@furman.edu');

console.log('\n❌ Issue: Caching');
console.log('   Solution: Clear all caches and try incognito mode');

console.log('\n🚀 Quick Test Commands:');
console.log('=' .repeat(60));

console.log('\nTest 1: Check if API is accessible from Vercel domain');
console.log('Run this in your Vercel site\'s browser console:');
console.log(`
   fetch('http://156.143.88.239:3001/api/health')
   .then(response => response.text())
   .then(data => console.log('Health check:', data))
   .catch(error => console.error('Health check failed:', error));
`);

console.log('\nTest 2: Check professor dashboard API');
console.log('Run this in your Vercel site\'s browser console:');
console.log(`
   fetch('http://156.143.88.239:3001/api/professors/4dabb92c-bd05-4451-a452-492890529210/dashboard')
   .then(response => response.json())
   .then(data => console.log('Dashboard data:', data))
   .catch(error => console.error('Dashboard API failed:', error));
`);

console.log('\nTest 3: Check current user');
console.log('Run this in your Vercel site\'s browser console:');
console.log(`
   // Check if user is signed in
   console.log('Current user:', window.localStorage.getItem('supabase.auth.token'));
   
   // Or check Supabase auth
   import { supabase } from './lib/supabase';
   supabase.auth.getUser().then(({ data: { user } }) => {
     console.log('Current user:', user);
   });
`);

console.log('\n📞 Next Steps:');
console.log('=' .repeat(60));
console.log('1. Run the test commands above in your Vercel site');
console.log('2. Share the results with me');
console.log('3. Check the browser console for any errors');
console.log('4. Verify all environment variables are set correctly');

console.log('\n💡 If still not working:');
console.log('- Share your actual Vercel URL');
console.log('- Share any error messages from browser console');
console.log('- Share your Railway environment variables (without sensitive data)');
console.log('- Try the browser console tests above');
