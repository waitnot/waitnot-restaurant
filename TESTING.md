# Testing Guide - WaitNot Application

## Test: Restaurant Menu Management

This test verifies that menu items added/edited/deleted by restaurants appear correctly on the customer-facing pages.

### Steps to Test:

1. **Open Two Browser Windows/Tabs:**
   - Window 1: Restaurant Dashboard
   - Window 2: Customer Restaurant Page

2. **Login to Restaurant Dashboard (Window 1):**
   ```
   URL: http://localhost:3000/restaurant-login
   Email: spice@example.com
   Password: password123
   ```

3. **Navigate to Menu Tab:**
   - Click on "Menu" tab in dashboard
   - You'll see existing menu items (if any)

4. **Open Customer Restaurant Page (Window 2):**
   ```
   URL: http://localhost:3000/restaurant/[restaurant-id]
   ```
   - View existing menu items

5. **Test Add Menu Item:**
   - In Window 1 (Dashboard), click "Add Menu Item"
   - Fill in details:
     - Name: `Test Dish`
     - Price: `299`
     - Category: `Main Course`
     - Description: `Delicious test dish`
   - Submit the form
   - **Expected:** Menu item appears in dashboard

6. **Verify on Customer Side:**
   - In Window 2 (Restaurant page), refresh the page
   - **Expected:** New menu item appears in the menu
   - Check that all details are correct

7. **Test Edit Menu Item:**
   - In Window 1, click edit button on the menu item
   - Modify the name to `Updated Test Dish` and price to `349`
   - Save changes
   - **Expected:** Changes saved in dashboard

8. **Verify Edit on Customer Side:**
   - In Window 2, refresh
   - **Expected:** Menu item shows updated name and price

9. **Test Delete Menu Item:**
   - In Window 1, click delete button on the menu item
   - Confirm deletion
   - **Expected:** Menu item removed from dashboard

10. **Verify Delete on Customer Side:**
    - In Window 2, refresh
    - **Expected:** Deleted menu item no longer appears

### Expected Results:

✅ All changes made in restaurant dashboard reflect on customer pages
✅ Add, edit, and delete operations work correctly
✅ Restaurant information displays correctly
✅ Order flow from menu works properly

### Data Flow:

```
Restaurant Dashboard → Local JSON Database → Customer Pages
     (Add/Edit/Delete)      (restaurants.json)    (Fetch & Display)
```

### Notes:

- Changes require page refresh on customer side (no WebSocket for menu currently)
- All menu items are stored in `server/data/restaurants.json`
- Restaurant ID is automatically associated with each menu item

## Other Tests to Run:

### Test Order Flow:
1. Place order from customer side
2. Verify it appears in restaurant dashboard (real-time via Socket.IO)
3. Update order status
4. Verify status changes

### Test QR Table Ordering:
1. Click QR code link in dashboard
2. Place order from QR page
3. Verify order appears in "Table Orders" tab

### Test Delivery Orders:
1. Place delivery order from customer side
2. Verify it appears in "Delivery Orders" tab
3. Test status workflow: pending → preparing → out-for-delivery → delivered → completed

### Test Responsive Design:
1. Resize browser to mobile size (375px)
2. Test all features work on small screens
3. Verify horizontal scrolling tabs work
4. Test modals are scrollable on mobile

### Test QR Code Generation:
1. Add tables in QR Codes tab
2. Test QR code links work
3. Download QR codes and verify they work
4. Delete tables and verify QR codes are removed