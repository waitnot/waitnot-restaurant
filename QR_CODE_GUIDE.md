# QR Code Table Ordering Guide

## Overview

The QR Code feature allows customers to scan a code at their table and order directly without waiting for a waiter. Each table has a unique QR code that links to the ordering page.

## How It Works

### For Restaurants:

1. **Generate QR Codes:**
   - Login to restaurant dashboard
   - Go to "QR Codes" tab
   - See QR codes for all your tables

2. **Download QR Codes:**
   - Click "Download QR" button on any table
   - High-quality PNG image downloads
   - Includes restaurant name and table number

3. **Print & Display:**
   - Print the QR code images
   - Laminate for durability
   - Place on each table (tent card, sticker, or frame)

### For Customers:

1. **Scan QR Code:**
   - Open phone camera
   - Point at QR code
   - Tap the notification to open link

2. **Browse Menu:**
   - See full restaurant menu
   - Add items to cart
   - Adjust quantities

3. **Place Order:**
   - Enter name and phone
   - Select payment method
   - Submit order

4. **Order Sent to Kitchen:**
   - Order appears in restaurant dashboard
   - Kitchen starts preparing
   - Food delivered to table

## QR Code Features

### Real Scannable QR Codes:
- ✅ Generated using industry-standard QR library
- ✅ High error correction level (Level H)
- ✅ Works with any QR scanner app
- ✅ Works with phone cameras (iOS/Android)

### Downloadable:
- ✅ High-resolution PNG format
- ✅ Includes restaurant name
- ✅ Includes table number
- ✅ White background for printing

### Unique Per Table:
- ✅ Each table has unique QR code
- ✅ Auto-detects table number
- ✅ Orders tagged with table number

## Printing Guide

### Recommended Sizes:

**Table Tent Cards:**
- Size: 4" x 6" (10cm x 15cm)
- Print QR code at 3" x 3" (7.5cm x 7.5cm)
- Add text: "Scan to Order"

**Table Stickers:**
- Size: 3" x 3" (7.5cm x 7.5cm)
- Waterproof vinyl stickers
- Place on table surface

**Acrylic Stands:**
- Size: 5" x 7" (12.5cm x 18cm)
- Professional look
- Reusable

### Printing Tips:

1. **Use High Quality:**
   - Print at 300 DPI or higher
   - Use glossy or matte cardstock
   - Avoid inkjet if possible (laser better)

2. **Laminate:**
   - Protects from spills
   - Increases durability
   - Easy to clean

3. **Test Before Mass Printing:**
   - Print one QR code
   - Test scanning with multiple phones
   - Verify it opens correct page

## Testing QR Codes

### Before Printing:

1. **Click "Test Link":**
   - Opens ordering page in new tab
   - Verify correct table number
   - Check menu loads properly

2. **Scan on Phone:**
   - Display QR code on computer screen
   - Scan with phone camera
   - Verify it opens correctly

3. **Test Full Flow:**
   - Scan QR code
   - Add items to cart
   - Place test order
   - Check order appears in dashboard

## Troubleshooting

### QR Code Won't Scan:

**Problem:** Phone camera doesn't recognize QR code
**Solutions:**
- Ensure good lighting
- Hold phone steady
- Try different distance (6-12 inches)
- Clean camera lens
- Update phone OS

**Problem:** QR code scans but link doesn't open
**Solutions:**
- Check internet connection
- Verify server is running
- Test the "Test Link" button first

### Wrong Table Number:

**Problem:** Order shows wrong table
**Solutions:**
- Verify correct QR code on table
- Re-download and print correct QR code
- Check QR code URL in dashboard

### Download Not Working:

**Problem:** Download button doesn't work
**Solutions:**
- Try different browser (Chrome recommended)
- Check browser download settings
- Allow pop-ups for the site
- Right-click QR code → Save Image As

## Best Practices

### Placement:

✅ **Do:**
- Place QR code in center of table
- Ensure good visibility
- Keep clean and unobstructed
- Use protective covering

❌ **Don't:**
- Hide behind condiments
- Place in direct sunlight (fading)
- Use damaged/torn prints
- Place where it can get wet

### Customer Experience:

1. **Add Instructions:**
   - "Scan to Order"
   - "No Waiter Needed"
   - "Fast & Easy"

2. **Staff Training:**
   - Explain QR ordering to customers
   - Help customers who need assistance
   - Monitor orders from QR system

3. **Backup Plan:**
   - Keep traditional menus available
   - Staff ready to take orders manually
   - Help customers with technical issues

## Advanced Features

### Analytics (Future):
- Track which tables order most
- Popular items per table
- Average order time
- Customer preferences

### Customization (Future):
- Add restaurant logo to QR code
- Custom colors
- Branded design
- Special offers per table

## URL Format

Each QR code contains a URL in this format:
```
https://your-domain.com/qr/{restaurantId}/{tableNumber}
```

Example:
```
https://waitnot.com/qr/abc123/5
```

This URL:
- Opens the ordering page
- Auto-detects Table 5
- Shows restaurant menu
- Tags order with table number

## Security

- QR codes are public (anyone can scan)
- No authentication required for ordering
- Orders tracked by table number
- Restaurant verifies orders in dashboard

## Cost Savings

### Benefits of QR Ordering:

💰 **Reduced Labor:**
- Less staff needed for order taking
- Faster table turnover
- Staff focus on service

📈 **Increased Orders:**
- Customers order at their pace
- No waiting for waiter
- Easy to add more items

⚡ **Faster Service:**
- Orders go directly to kitchen
- No miscommunication
- Real-time order tracking

😊 **Better Experience:**
- Contactless ordering
- See full menu with photos
- Easy to customize orders

## Support

For issues or questions:
1. Check this guide first
2. Test the "Test Link" button
3. Verify server is running
4. Check browser console for errors

Happy ordering! 🍽️
