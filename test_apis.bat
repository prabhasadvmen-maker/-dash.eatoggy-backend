@echo off
set TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZXN0YXVyYW50Ijp7ImlkIjoiNmFiM2NjNmY5NmQxMThjNmI4NzA0ZWI5Iiwicm9sZSI6IlJlc3RhdXJhbnQifSwidXNlciI6eyJpZCI6IjZhYjNjYzZmOTZkMTE4YzZiODcwNGViOSIsInJvbGUiOiJSZXN0YXVyYW50In0sImlhdCI6MTc5MDkzMzY4MiwiZXhwIjoxNzkxNTM4NDgyfQ.nIDfCqawMF8Svs7H9DCGCrY5zGciLtmzKn-EzRXDsfQ
set BASE=http://localhost:5000
set AUTH=Authorization: Bearer %TOKEN%

echo ============================================
echo API 1: POST /api/restaurant-auth/resend-otp
echo ============================================
curl -s -X POST %BASE%/api/restaurant-auth/resend-otp -H "Content-Type: application/json" -d "{\"mobile\":\"9999999999\"}"
echo.

echo ============================================
echo API 2: GET /api/restaurants/dashboard
echo ============================================
curl -s %BASE%/api/restaurants/dashboard -H "%AUTH%"
echo.

echo ============================================
echo API 3: POST /api/restaurants/orders/:orderId/accept
echo ============================================
curl -s -X POST %BASE%/api/restaurants/orders/FAKE_ORDER_ID/accept -H "%AUTH%" -H "Content-Type: application/json" -d "{\"estimatedPrepTime\":20}"
echo.

echo ============================================
echo API 4: POST /api/restaurants/orders/:orderId/reject
echo ============================================
curl -s -X POST %BASE%/api/restaurants/orders/FAKE_ORDER_ID/reject -H "%AUTH%" -H "Content-Type: application/json" -d "{\"reasonCode\":\"OUT_OF_STOCK\",\"reasonNote\":\"Item not available\"}"
echo.

echo ============================================
echo API 5: POST /api/restaurants/menu/categories
echo ============================================
curl -s -X POST %BASE%/api/restaurants/menu/categories -H "%AUTH%" -H "Content-Type: application/json" -d "{\"name\":\"Test Category\",\"emoji\":\"🍕\",\"displayOrder\":1}"
echo.

echo ============================================
echo API 6: GET /api/restaurants/wallet
echo ============================================
curl -s %BASE%/api/restaurants/wallet -H "%AUTH%"
echo.

echo ============================================
echo API 7: GET /api/restaurants/wallet/transactions
echo ============================================
curl -s %BASE%/api/restaurants/wallet/transactions -H "%AUTH%"
echo.

echo ============================================
echo API 8: GET /api/restaurants/notifications
echo ============================================
curl -s %BASE%/api/restaurants/notifications -H "%AUTH%"
echo.

echo ============================================
echo API 9: POST /api/restaurants/notifications/device-token
echo ============================================
curl -s -X POST %BASE%/api/restaurants/notifications/device-token -H "%AUTH%" -H "Content-Type: application/json" -d "{\"fcmToken\":\"test_fcm_token_12345\",\"devicePlatform\":\"ANDROID\",\"appVersion\":\"1.0.0\"}"
echo.

echo ============================================
echo API 10: GET /api/restaurants/profile
echo ============================================
curl -s %BASE%/api/restaurants/profile -H "%AUTH%"
echo.

echo ============================================
echo ALL APIS TESTED
echo ============================================
