// Test script for health endpoint
import fetch from 'node-fetch';

async function testHealthEndpoint() {
  try {
    console.log('🧪 Testing health endpoint...');
    
    const response = await fetch('http://localhost:5000/health');
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Health endpoint working!');
      console.log('Response:', data);
    } else {
      console.log('❌ Health endpoint failed:', response.status);
    }
    
    // Test API status endpoint
    const apiResponse = await fetch('http://localhost:5000/api/status');
    const apiData = await apiResponse.json();
    
    if (apiResponse.ok) {
      console.log('✅ API status endpoint working!');
      console.log('Response:', apiData);
    } else {
      console.log('❌ API status endpoint failed:', apiResponse.status);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testHealthEndpoint();