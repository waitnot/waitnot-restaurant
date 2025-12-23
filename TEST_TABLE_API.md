# Test Table Add/Delete API

## Quick Test

### 1. Check if server is running:
Open browser and go to:
```
http://localhost:5000/api/restaurants
```

Should show list of restaurants (not error).

### 2. Test the endpoint directly:

**Windows PowerShell:**
```powershell
$body = @{
    tables = 15
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:5000/api/restaurants/YOUR_RESTAURANT_ID/tables" -Method PATCH -Body $body -ContentType "application/json"
```

**Or use browser console:**
```javascript
// Open browser console (F12) and run:
fetch('/api/restaurants/YOUR_RESTAURANT_ID/tables', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tables: 15 })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

Replace `YOUR_RESTAURANT_ID` with actual ID from localStorage:
```javascript
localStorage.getItem('restaurantId')
```

### 3. Check what's in the console:

**Browser Console (F12):**
- Look for "Adding table:" log
- Look for any red errors
- Copy the error message

**Server Terminal:**
- Look for "Updating table count for restaurant:"
- Look for any errors
- Copy the error message

### 4. Common Issues:

**Issue: "Failed to add table"**
- Check if server is running (should see logs in terminal)
- Check if you're logged in (localStorage has restaurantId)
- Check browser console for network errors

**Issue: "Restaurant not found"**
- Your restaurantId might be invalid
- Try logging out and logging back in
- Check: `localStorage.getItem('restaurantId')`

**Issue: "Network Error"**
- Server not running
- Wrong port
- CORS issue

### 5. Manual Fix:

If API doesn't work, you can manually edit the database:

1. Open: `server/data/restaurants.json`
2. Find your restaurant
3. Change `"tables": 10` to desired number
4. Save file
5. Refresh browser

### 6. Restart Everything:

Sometimes a fresh start helps:

```bash
# Stop both servers (Ctrl+C)

# Terminal 1 - Server
cd server
npm run dev

# Terminal 2 - Client  
cd client
npm run dev
```

Then try again!
