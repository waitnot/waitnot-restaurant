# Running Bill Feature - Implementation Plan

## Concept:
When customers order from the same table multiple times, all orders accumulate into a running bill until the restaurant clicks "Generate Bill" to finalize and close the session.

## How It Works:

### Customer Side (QR Order):
1. Customer scans QR code for Table 5
2. Orders items (e.g., 2 Burgers)
3. Order sent to kitchen
4. Later, same table orders more (e.g., 1 Coke)
5. Both orders appear as separate line items
6. Running total shows cumulative amount

### Restaurant Side (Dashboard):
1. See all orders for Table 5
2. Each order shows as separate entry
3. "Generate Bill" button to finalize
4. Shows running total for the table
5. Once bill generated, table session closes
6. Next order from that table starts new session

## Database Changes:

### Add to Order Model:
- `sessionId` - Groups orders from same table session
- `billGenerated` - Boolean flag
- `billGeneratedAt` - Timestamp when bill was generated

### New Table Sessions Collection:
- Track active sessions per table
- Running total
- Start time
- Items list

## UI Changes:

### Restaurant Dashboard:
- Group orders by table and session
- Show running total per table
- "Generate Bill" button per table
- Print/download bill option

### QR Order Page:
- Show "Previous orders" from current session
- Running total display
- "Add more items" flow

## Implementation:

This is a complex feature that requires:
1. Session management
2. Order grouping logic
3. Bill generation
4. Print functionality

Would you like me to implement this feature now?
