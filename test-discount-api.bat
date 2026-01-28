@echo off
echo Testing Discount System API...

echo.
echo 1. Login as restaurant...
curl -X POST http://localhost:5000/api/auth/restaurant/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"king@gmail.com\",\"password\":\"password123\"}" ^
  -o login_response.json

echo.
echo 2. Check if server is running...
curl -X GET http://localhost:5000/api/health

echo.
echo Login completed. Check login_response.json for token.
echo Use the token to create discounts in the restaurant dashboard.

pause