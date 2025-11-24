#!/bin/bash

# Test Scripts cho Locket Backend API
# Usage: ./test-scripts.sh

BASE_URL="http://localhost:4000"
TOKEN=""

echo "=== Locket Backend API Testing ==="
echo ""

# 1. Health Check
echo "1. Health Check..."
curl -X GET "$BASE_URL/api/health"
echo -e "\n"

# 2. Register
echo "2. Register User..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser_'$(date +%s)'",
    "password": "password123",
    "email": "test_'$(date +%s)'@example.com"
  }')
echo $REGISTER_RESPONSE | jq '.'
TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.data.token')
echo "Token: $TOKEN"
echo ""

# 3. Login
echo "3. Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "testuser",
    "password": "password123"
  }')
echo $LOGIN_RESPONSE | jq '.'
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token // empty')
if [ -z "$TOKEN" ]; then
  echo "Login failed or user not found. Using seed data..."
  echo "Please login manually and set TOKEN variable"
  exit 1
fi
echo "Token: $TOKEN"
echo ""

# 4. Send OTP (Email)
echo "4. Send OTP (Email)..."
curl -X POST "$BASE_URL/api/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "test@example.com"
  }'
echo -e "\n"

# 5. Get Feed
echo "5. Get Feed..."
curl -X GET "$BASE_URL/api/feed?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
echo -e "\n"

# 6. Add Reaction
echo "6. Add Reaction..."
curl -X POST "$BASE_URL/api/posts/656000000000000000000001/react" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "heart"
  }'
echo -e "\n"

# 7. Create Comment
echo "7. Create Comment..."
curl -X POST "$BASE_URL/api/posts/656000000000000000000001/comment" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Đẹp quá!",
    "mentions": []
  }'
echo -e "\n"

# 8. Get Comments
echo "8. Get Comments..."
curl -X GET "$BASE_URL/api/posts/656000000000000000000001/comments?page=1&limit=20"
echo -e "\n"

echo "=== Testing Complete ==="

