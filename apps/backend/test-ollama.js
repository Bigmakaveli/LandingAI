#!/usr/bin/env node

/**
 * Simple test script for Ollama integration
 * Run this after starting the backend server
 */

const baseUrl = 'http://localhost:3001';

async function testOllama() {
  console.log('🧪 Testing Ollama Integration...\n');

  try {
    // Test 1: Get available models
    console.log('1️⃣ Testing GET /api/ollama/models');
    const modelsResponse = await fetch(`${baseUrl}/api/ollama/models`);
    const modelsData = await modelsResponse.json();
    
    if (modelsData.success) {
      console.log('✅ Available models:', modelsData.models);
    } else {
      console.log('❌ Failed to get models:', modelsData.error);
    }
    console.log('');

    // Test 2: Simple chat test
    console.log('2️⃣ Testing POST /api/ollama/test');
    const testResponse = await fetch(`${baseUrl}/api/ollama/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hello! Can you tell me a short joke?',
        model: 'llama2' // or any model you have available
      })
    });
    const testData = await testResponse.json();
    
    if (testData.success) {
      console.log('✅ Test response:', testData.response);
      console.log('📊 Model used:', testData.model);
    } else {
      console.log('❌ Test failed:', testData.error);
    }
    console.log('');

    // Test 3: Advanced chat with system message
    console.log('3️⃣ Testing POST /api/ollama/chat');
    const chatResponse = await fetch(`${baseUrl}/api/ollama/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemMessage: 'You are a helpful coding assistant. Keep responses concise.',
        messages: [
          { role: 'user', content: 'What is TypeScript?' }
        ],
        model: 'llama2'
      })
    });
    const chatData = await chatResponse.json();
    
    if (chatData.success) {
      console.log('✅ Chat response:', chatData.content);
      console.log('📊 Model used:', chatData.model);
    } else {
      console.log('❌ Chat failed:', chatData.error);
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testOllama();
