/**
 * Order notification utility for WaitNot Captain APK.
 * Shows local push notifications when new orders arrive.
 * Works in background (app minimized).
 */

let _notifPlugin = null;
let _permissionGranted = false;

async function getNotifPlugin() {
  if (_notifPlugin) return _notifPlugin;
  if (window.Capacitor?.Plugins?.OrderNotification) {
    _notifPlugin = window.Capacitor.Plugins.OrderNotification;
    return _notifPlugin;
  }
  const { registerPlugin } = await import('@capacitor/core');
  _notifPlugin = registerPlugin('OrderNotification');
  return _notifPlugin;
}

/** Call once after login to request notification permission */
export async function requestNotificationPermission() {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  try {
    const p = await getNotifPlugin();
    const r = await p.requestPermission();
    _permissionGranted = r.granted;
    console.log('Notification permission:', r.granted);
  } catch (e) {
    console.warn('Notification permission error:', e);
  }
}

/** Show a notification for a new order */
export async function showNewOrderNotification(order) {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  try {
    const p = await getNotifPlugin();

    const slot = order.orderType === 'room'
      ? `Room ${order.roomNumber}`
      : order.tableNumber
        ? `Table ${order.tableNumber}`
        : order.orderType === 'takeaway' ? 'Takeaway'
        : order.orderType === 'delivery' ? 'Delivery'
        : 'New Order';

    const itemCount = (order.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
    const itemNames = (order.items || []).slice(0, 3).map(i => i.name).join(', ');
    const more = (order.items || []).length > 3 ? ` +${order.items.length - 3} more` : '';

    await p.showOrderNotification({
      title: `🍽 New Order — ${slot}`,
      body: `${itemCount} item${itemCount !== 1 ? 's' : ''}: ${itemNames}${more}`,
      tableInfo: `Rs. ${order.totalAmount || 0} · ${order.customerName || 'Guest'}`,
    });
  } catch (e) {
    console.warn('Show notification error:', e);
  }
}

/** Play in-app sound for new orders (when app is in foreground) */
export function playOrderSound() {
  try {
    const audio = new Audio('/sounds/new-order.wav');
    audio.volume = 0.8;
    audio.play().catch(() => {});
  } catch (_) {}
}
