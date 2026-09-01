// Test script to verify server connection
import https from 'https';

console.log('🔍 Testing WaitNot Server Connection...');
console.log('=====================================');

const testUrl = 'https://waitnot-restaurant.onrender.com/restaurant-login';

https.get(testUrl, (res) => {
  console.log('✅ Server Response:');
  console.log(`   Status Code: ${res.statusCode}`);
  console.log(`   Status Message: ${res.statusMessage}`);
  console.log(`   Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Server is accessible and responding');
      console.log(`   Response size: ${data.length} bytes`);
      
      if (data.includes('WaitNot') || data.includes('restaurant')) {
        console.log('✅ Response contains expected content');
      } else {
        console.log('⚠️  Response may not contain expected content');
      }
    } else {
      console.log('❌ Server returned error status');
    }
  });
  
}).on('error', (err) => {
  console.log('❌ Connection Error:');
  console.log(`   ${err.message}`);
  console.log('');
  console.log('🔧 Possible solutions:');
  console.log('   1. Check internet connection');
  console.log('   2. Verify server is running');
  console.log('   3. Check firewall settings');
  console.log('   4. Try accessing in browser first');
});

// Also test the API endpoint
setTimeout(() => {
  console.log('');
  console.log('🔍 Testing API Endpoint...');
  
  const apiUrl = 'https://waitnot-restaurant.onrender.com/api/restaurants';
  
  https.get(apiUrl, (res) => {
    console.log('✅ API Response:');
    console.log(`   Status Code: ${res.statusCode}`);
    
    if (res.statusCode === 200 || res.statusCode === 401) {
      console.log('✅ API is accessible');
    } else {
      console.log('❌ API may have issues');
    }
  }).on('error', (err) => {
    console.log('❌ API Connection Error:', err.message);
  });
}, 2000);