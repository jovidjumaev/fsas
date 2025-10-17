#!/usr/bin/env node

/**
 * QR Code Decoder Script
 * 
 * This script decodes QR codes to see what URL they actually contain
 */

const API_BASE_URL = 'https://fsas-production.up.railway.app';

async function decodeQRCode() {
  console.log('🔍 Decoding QR Code Content');
  console.log('=' .repeat(60));
  
  try {
    // Get QR code from Railway
    console.log('\n1. Fetching QR code from Railway...');
    const response = await fetch(`${API_BASE_URL}/api/sessions/373c3615-24f2-41d9-a55b-b601afc54be7/qr-code`);
    const data = await response.json();
    
    if (!data.success) {
      console.log('❌ Failed to fetch QR code:', data.error);
      return;
    }
    
    console.log('✅ QR code fetched successfully');
    console.log(`📊 QR code type: ${typeof data.qr_code}`);
    console.log(`📊 QR code length: ${data.qr_code?.length || 0}`);
    
    // Check if it's a base64 image
    if (data.qr_code && data.qr_code.startsWith('data:image/png;base64,')) {
      console.log('📷 QR code is a base64 image');
      
      // Extract base64 data
      const base64Data = data.qr_code.split(',')[1];
      console.log(`📊 Base64 data length: ${base64Data.length}`);
      
      // Try to decode the QR code content
      try {
        // This is a simplified approach - in reality we'd need a QR decoder library
        console.log('\n2. Attempting to decode QR code content...');
        console.log('⚠️  Note: This requires a QR decoder library to properly decode the image');
        console.log('📱 The QR code should contain a URL like: https://fsas-frontend.vercel.app/student/scan?data=...');
        
        // Check if the base64 data contains any readable text
        const decoded = Buffer.from(base64Data, 'base64').toString('utf8');
        console.log(`📊 Decoded content preview: ${decoded.substring(0, 100)}...`);
        
        if (decoded.includes('https://fsas-frontend.vercel.app')) {
          console.log('✅ QR code contains Vercel URL!');
        } else if (decoded.includes('localhost') || decoded.includes('156.143.88.239')) {
          console.log('❌ QR code contains localhost/local IP!');
        } else {
          console.log('❓ QR code content unclear - may need proper QR decoder');
        }
        
      } catch (decodeError) {
        console.log('⚠️  Could not decode QR code content:', decodeError.message);
      }
      
    } else {
      console.log('❓ QR code format unknown');
    }
    
    // Check environment variables
    console.log('\n3. Checking if Railway has environment variables...');
    console.log('💡 Railway should have these environment variables:');
    console.log('   - NEXT_PUBLIC_FRONTEND_URL=https://fsas-frontend.vercel.app');
    console.log('   - NEXT_PUBLIC_QR_BASE_URL=https://fsas-frontend.vercel.app');
    
    console.log('\n4. Next Steps:');
    console.log('=' .repeat(60));
    console.log('1. Check Railway deployment logs for any errors');
    console.log('2. Verify Railway has the latest code deployed');
    console.log('3. Check Railway environment variables');
    console.log('4. Test QR code generation with a QR decoder app');
    console.log('5. If still not working, we may need to hardcode the URL');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the decoder
decodeQRCode();
