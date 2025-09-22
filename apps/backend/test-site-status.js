const http = require('http');

// Test the site-status endpoint
function testSiteStatus() {
  const siteId = 'test-site';
  
  // Test 1: Check initial status (should be READY)
  console.log('Test 1: Checking initial status...');
  makeRequest(`/api/${siteId}/site-status`, (data) => {
    console.log('Initial status:', data);
    if (data.status === 'READY') {
      console.log('✅ Initial status is READY');
    } else {
      console.log('❌ Expected READY, got:', data.status);
    }
  });

  // Test 2: Simulate a chat request (should mark as UNDER_DEV)
  console.log('\nTest 2: Simulating chat request...');
  makeRequest(`/api/${siteId}/chat`, 'POST', {
    messages: [{ role: 'user', content: 'Hello, test message' }]
  }, (data) => {
    console.log('Chat response received');
    
    // Test 3: Check status after chat request (should be READY again)
    console.log('\nTest 3: Checking status after chat request...');
    setTimeout(() => {
      makeRequest(`/api/${siteId}/site-status`, (data) => {
        console.log('Status after chat:', data);
        if (data.status === 'READY') {
          console.log('✅ Status returned to READY after chat completion');
        } else {
          console.log('❌ Expected READY, got:', data.status);
        }
      });
    }, 1000); // Wait 1 second for the chat request to complete
  });
}

function makeRequest(path, method = 'GET', data = null, callback) {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: path,
    method: method,
    headers: {
      'Content-Type': 'application/json',
    }
  };

  const req = http.request(options, (res) => {
    let responseData = '';
    
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      try {
        const parsed = JSON.parse(responseData);
        callback(parsed);
      } catch (e) {
        console.error('Error parsing response:', e);
        console.log('Raw response:', responseData);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Request error: ${e.message}`);
  });

  if (data) {
    req.write(JSON.stringify(data));
  }
  
  req.end();
}

// Run the test
console.log('Testing site-status endpoint...');
console.log('Make sure the backend server is running on port 3001');
console.log('');

testSiteStatus();
