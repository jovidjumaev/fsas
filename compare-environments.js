#!/usr/bin/env node

/**
 * Production vs Development Environment Comparison
 * 
 * This script helps identify the difference between what the API returns
 * and what Vercel is actually calling.
 */

const API_BASE_URL = 'http://156.143.88.239:3001';

async function compareEnvironments() {
  console.log('🔍 Comparing Production vs Development Environments');
  console.log('=' .repeat(60));
  
  try {
    // 1. Test the exact API call that Vercel should be making
    console.log('\n1. Testing API Call for prof@furman.edu...');
    
    const professorId = '4dabb92c-bd05-4451-a452-492890529210'; // prof@furman.edu
    const apiUrl = `${API_BASE_URL}/api/professors/${professorId}/dashboard`;
    
    console.log(`API URL: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    const data = await response.json();
    
    console.log(`Response Status: ${response.status}`);
    console.log(`Response Headers:`, Object.fromEntries(response.headers.entries()));
    console.log(`Response Data:`, JSON.stringify(data, null, 2));
    
    // 2. Check if there are any CORS issues
    console.log('\n2. Checking CORS Headers...');
    const corsResponse = await fetch(apiUrl, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://your-vercel-app.vercel.app',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    console.log(`CORS Response Status: ${corsResponse.status}`);
    console.log(`CORS Headers:`, Object.fromEntries(corsResponse.headers.entries()));
    
    // 3. Test with different user agents
    console.log('\n3. Testing with Different User Agents...');
    
    const userAgents = [
      'Mozilla/5.0 (compatible; VercelBot/1.0)',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Next.js/14.0.0'
    ];
    
    for (const userAgent of userAgents) {
      const testResponse = await fetch(apiUrl, {
        headers: {
          'User-Agent': userAgent
        }
      });
      
      const testData = await testResponse.json();
      console.log(`User-Agent: ${userAgent}`);
      console.log(`Status: ${testResponse.status}`);
      console.log(`Students: ${testData.data?.stats?.totalStudents || 'N/A'}`);
    }
    
    // 4. Check for potential issues
    console.log('\n4. Potential Issues Analysis...');
    console.log('\n🔍 Possible Causes:');
    console.log('1. **Different API URL**: Vercel might be calling a different backend');
    console.log('2. **Different Database**: Vercel might be using different Supabase project');
    console.log('3. **Authentication Issue**: User ID might be different in production');
    console.log('4. **Caching Issue**: Vercel might be caching old responses');
    console.log('5. **Environment Variables**: Wrong NEXT_PUBLIC_API_URL in Vercel');
    
    console.log('\n💡 Debugging Steps:');
    console.log('1. Open browser dev tools on Vercel deployment');
    console.log('2. Check Network tab for API calls');
    console.log('3. Verify the API URL being called');
    console.log('4. Check for any error responses');
    console.log('5. Compare user ID in production vs development');
    
    console.log('\n🔧 Quick Fixes to Try:');
    console.log('1. Check Vercel environment variables');
    console.log('2. Clear Vercel cache and redeploy');
    console.log('3. Verify Railway backend URL');
    console.log('4. Check browser console for errors');
    
  } catch (error) {
    console.error('❌ Comparison failed:', error.message);
  }
}

// Run the comparison
compareEnvironments();
