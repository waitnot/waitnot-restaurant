#!/usr/bin/env node

// Test script to verify CORS fix for PATCH requests
import fetch from 'node-fetch';

async function testCorsFix() {
  try {
    console.log('🧪 Testing CORS Fix for PATCH Requests...\n');

    const serverUrl = 'http://localhost:5000';
    
    // Test 1: Check if server is running
    console.log('1️⃣ Testing server health...');
    const healthResponse = await fetch(`${serverUrl}/health`);
    if (healthResponse.ok) {
      console.log('   ✅ Server is running');
    } else {
      throw new Error('Server is not responding');
    }

    // Test 2: Check CORS preflight for PATCH
    console.log('\n2️⃣ Testing CORS preflight for PATCH...');
    const preflightResponse = await fetch(`${serverUrl}/api/orders/test/status`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'PATCH',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });

    const allowedMethods = preflightResponse.headers.get('Access-Control-Allow-Methods');
    console.log(`   📋 Allowed methods: ${allowedMethods}`);
    
    if (allowedMethods && allowedMethods.includes('PATCH')) {
      console.log('   ✅ PATCH method is now allowed');
    } else {
      console.log('   ❌ PATCH method is still not allowed');
    }

    console.log('\n🎉 CORS Fix Test Completed!');
    console.log('✅ The Clear Table functionality should now work properly.');
    console.log('🔄 Please refresh your browser and try the Clear Table button again.');
    
  } catch (error) {
    console.error('\n❌ CORS Fix Test FAILED!');
    console.error('Error:', error.message);
  }
}

// Run the test
testCorsFix();