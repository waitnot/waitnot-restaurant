package com.waitnot.captain;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * EscPosPlugin — Bluetooth printer management for WaitNot Captain.
 * Supports multiple simultaneous connections to different printers.
 */
@CapacitorPlugin(
    name = "EscPos",
    permissions = {
        @Permission(strings = {
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_CONNECT
        }, alias = "bluetooth12"),
        @Permission(strings = {
            Manifest.permission.BLUETOOTH,
            Manifest.permission.BLUETOOTH_ADMIN
        }, alias = "bluetoothLegacy")
    }
)
public class EscPosPlugin extends Plugin {

    private static final String TAG = "EscPosPlugin";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final int SCAN_TIMEOUT_MS = 12000;
    private static final int CONNECT_TIMEOUT_MS = 10000;

    // ConcurrentHashMap for thread-safe multi-device connections
    private final ConcurrentHashMap<String, BluetoothSocket> connections = new ConcurrentHashMap<>();
    // Lock per address to prevent concurrent connects to the same device
    private final ConcurrentHashMap<String, Object> connectLocks = new ConcurrentHashMap<>();

    private BroadcastReceiver scanReceiver = null;
    private PluginCall pendingScanCall = null;
    private final List<JSObject> scannedDevices = new ArrayList<>();

    // ── Permission helpers ────────────────────────────────────────────────────

    private boolean hasPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT)
                == PackageManager.PERMISSION_GRANTED;
        }
        return ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH)
            == PackageManager.PERMISSION_GRANTED;
    }

    private BluetoothAdapter getAdapter() { return BluetoothAdapter.getDefaultAdapter(); }

    private String permAlias() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? "bluetooth12" : "bluetoothLegacy";
    }

    private Object getLockFor(String address) {
        connectLocks.putIfAbsent(address, new Object());
        return connectLocks.get(address);
    }

    /** Check if socket is truly connected (isConnected() can lie on dead sockets). */
    private boolean isSocketAlive(BluetoothSocket socket) {
        if (socket == null || !socket.isConnected()) return false;
        try {
            // Try a zero-byte write to detect dead socket
            socket.getOutputStream().write(new byte[0]);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private void closeSocket(BluetoothSocket socket) {
        if (socket != null) {
            try { socket.close(); } catch (Exception ignored) {}
        }
    }

    // ── getPairedDevices ─────────────────────────────────────────────────────

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void getPairedDevices(PluginCall call) {
        if (!hasPermission()) { requestPermissionForAlias(permAlias(), call, "onPermission"); return; }
        try {
            BluetoothAdapter adapter = getAdapter();
            if (adapter == null) { call.reject("Bluetooth not supported"); return; }
            if (!adapter.isEnabled()) { call.reject("Bluetooth is disabled"); return; }

            Set<BluetoothDevice> paired = adapter.getBondedDevices();
            JSArray arr = new JSArray();
            if (paired != null) {
                for (BluetoothDevice d : paired) {
                    JSObject obj = new JSObject();
                    obj.put("name", d.getName() != null ? d.getName() : "Unknown");
                    obj.put("address", d.getAddress());
                    obj.put("paired", true);
                    obj.put("connected", isSocketAlive(connections.get(d.getAddress())));
                    arr.put(obj);
                }
            }
            JSObject result = new JSObject();
            result.put("devices", arr);
            call.resolve(result);
        } catch (SecurityException e) {
            call.reject("Permission denied: " + e.getMessage());
        } catch (Exception e) {
            call.reject("Error: " + e.getMessage());
        }
    }

    // ── scanDevices ──────────────────────────────────────────────────────────

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void scanDevices(PluginCall call) {
        if (!hasPermission()) { requestPermissionForAlias(permAlias(), call, "onPermission"); return; }
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null) { call.reject("Bluetooth not supported"); return; }
        if (!adapter.isEnabled()) { call.reject("Bluetooth is disabled"); return; }

        if (adapter.isDiscovering()) adapter.cancelDiscovery();
        if (scanReceiver != null) {
            try { getContext().unregisterReceiver(scanReceiver); } catch (Exception ignored) {}
            scanReceiver = null;
        }

        scannedDevices.clear();
        call.setKeepAlive(true);
        pendingScanCall = call;

        scanReceiver = new BroadcastReceiver() {
            @SuppressLint("MissingPermission")
            @Override
            public void onReceive(Context ctx, Intent intent) {
                String action = intent.getAction();
                if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                    BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                    if (device == null) return;
                    boolean exists = scannedDevices.stream()
                        .anyMatch(d -> device.getAddress().equals(d.getString("address")));
                    if (!exists) {
                        JSObject obj = new JSObject();
                        String name = device.getName();
                        obj.put("name", name != null ? name : "Unknown");
                        obj.put("address", device.getAddress());
                        obj.put("paired", device.getBondState() == BluetoothDevice.BOND_BONDED);
                        obj.put("rssi", intent.getShortExtra(BluetoothDevice.EXTRA_RSSI, Short.MIN_VALUE));
                        scannedDevices.add(obj);
                        JSArray arr = new JSArray();
                        for (JSObject d : scannedDevices) arr.put(d);
                        JSObject update = new JSObject();
                        update.put("devices", arr);
                        update.put("scanning", true);
                        notifyListeners("scanResult", update);
                    }
                } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(action)) {
                    JSArray arr = new JSArray();
                    for (JSObject d : scannedDevices) arr.put(d);
                    JSObject result = new JSObject();
                    result.put("devices", arr);
                    result.put("scanning", false);
                    if (pendingScanCall != null) { pendingScanCall.resolve(result); pendingScanCall = null; }
                    try { ctx.unregisterReceiver(this); } catch (Exception ignored) {}
                    scanReceiver = null;
                }
            }
        };

        IntentFilter filter = new IntentFilter();
        filter.addAction(BluetoothDevice.ACTION_FOUND);
        filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
        getContext().registerReceiver(scanReceiver, filter);
        adapter.startDiscovery();

        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            if (adapter.isDiscovering()) adapter.cancelDiscovery();
        }, SCAN_TIMEOUT_MS);
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void stopScan(PluginCall call) {
        BluetoothAdapter adapter = getAdapter();
        if (adapter != null && adapter.isDiscovering()) adapter.cancelDiscovery();
        if (scanReceiver != null) {
            try { getContext().unregisterReceiver(scanReceiver); } catch (Exception ignored) {}
            scanReceiver = null;
        }
        call.resolve();
    }

    // ── requestPairing ───────────────────────────────────────────────────────

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void requestPairing(PluginCall call) {
        if (!hasPermission()) { requestPermissionForAlias(permAlias(), call, "onPermission"); return; }
        String address = call.getString("address");
        if (address == null) { call.reject("address required"); return; }
        try {
            BluetoothAdapter adapter = getAdapter();
            BluetoothDevice device = adapter.getRemoteDevice(address);
            if (device.getBondState() == BluetoothDevice.BOND_BONDED) {
                JSObject r = new JSObject(); r.put("alreadyPaired", true); call.resolve(r); return;
            }
            boolean started = device.createBond();
            JSObject r = new JSObject(); r.put("pairingStarted", started); call.resolve(r);
        } catch (Exception e) { call.reject("Pairing error: " + e.getMessage()); }
    }

    // ── connect ──────────────────────────────────────────────────────────────

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void connect(PluginCall call) {
        if (!hasPermission()) { requestPermissionForAlias(permAlias(), call, "onPermission"); return; }
        String address = call.getString("address");
        if (address == null) { call.reject("address required"); return; }

        // Return immediately if already alive
        if (isSocketAlive(connections.get(address))) {
            JSObject r = new JSObject(); r.put("connected", true); r.put("address", address); call.resolve(r); return;
        }

        call.setKeepAlive(true);
        final String addr = address;

        new Thread(() -> {
            // Per-address lock prevents duplicate concurrent connects to same printer
            synchronized (getLockFor(addr)) {
                // Re-check inside lock
                if (isSocketAlive(connections.get(addr))) {
                    JSObject r = new JSObject(); r.put("connected", true); r.put("address", addr); call.resolve(r); return;
                }

                // Clean up any dead socket
                closeSocket(connections.remove(addr));

                BluetoothSocket socket = openSocket(addr);
                if (socket != null) {
                    connections.put(addr, socket);
                    JSObject r = new JSObject(); r.put("connected", true); r.put("address", addr); call.resolve(r);
                    notifyConnectionState(addr, "connected");
                } else {
                    call.reject("Connection failed to " + addr);
                    notifyConnectionState(addr, "disconnected");
                }
            }
        }).start();
    }

    /** Open a Bluetooth SPP socket with timeout. Tries insecure first, then secure. */
    @SuppressLint("MissingPermission")
    private BluetoothSocket openSocket(String address) {
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null || !adapter.isEnabled()) return null;

        BluetoothDevice device = adapter.getRemoteDevice(address);
        // Note: do NOT call cancelDiscovery() here — it interferes with parallel connects
        // Only cancel if we know a scan is active
        if (adapter.isDiscovering()) adapter.cancelDiscovery();

        // Attempt with timeout using inner thread
        BluetoothSocket[] result = new BluetoothSocket[1];
        Thread t = new Thread(() -> {
            BluetoothSocket s = null;
            try {
                s = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
                s.connect();
                result[0] = s;
            } catch (Exception e1) {
                Log.w(TAG, "Insecure connect failed for " + address + ": " + e1.getMessage());
                closeSocket(s);
                try {
                    s = device.createRfcommSocketToServiceRecord(SPP_UUID);
                    s.connect();
                    result[0] = s;
                } catch (Exception e2) {
                    Log.w(TAG, "Secure connect failed for " + address + ": " + e2.getMessage());
                    closeSocket(s);
                }
            }
        });
        t.start();
        try { t.join(CONNECT_TIMEOUT_MS); } catch (InterruptedException ignored) {}
        if (t.isAlive()) { t.interrupt(); Log.w(TAG, "Connect timeout for " + address); }
        return result[0];
    }

    // ── disconnect ───────────────────────────────────────────────────────────

    @PluginMethod
    public void disconnect(PluginCall call) {
        String address = call.getString("address");
        if (address != null) {
            closeSocket(connections.remove(address));
            notifyConnectionState(address, "disconnected");
        }
        call.resolve();
    }

    // ── getConnectionState ───────────────────────────────────────────────────

    @PluginMethod
    public void getConnectionState(PluginCall call) {
        String address = call.getString("address");
        JSObject result = new JSObject();
        if (address != null) {
            result.put("address", address);
            result.put("state", isSocketAlive(connections.get(address)) ? "connected" : "disconnected");
        } else {
            JSArray arr = new JSArray();
            for (Map.Entry<String, BluetoothSocket> e : connections.entrySet()) {
                JSObject item = new JSObject();
                item.put("address", e.getKey());
                item.put("state", isSocketAlive(e.getValue()) ? "connected" : "disconnected");
                arr.put(item);
            }
            result.put("connections", arr);
        }
        call.resolve(result);
    }

    // ── printHex ─────────────────────────────────────────────────────────────

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void printHex(PluginCall call) {
        if (!hasPermission()) { requestPermissionForAlias(permAlias(), call, "onPermission"); return; }
        String address = call.getString("address");
        String hex = call.getString("hex");
        if (address == null) { call.reject("address required"); return; }
        if (hex == null || hex.isEmpty()) { call.reject("hex required"); return; }

        byte[] data;
        try { data = hexToBytes(hex); }
        catch (Exception e) { call.reject("Invalid hex: " + e.getMessage()); return; }

        call.setKeepAlive(true);
        final byte[] finalData = data;
        final String addr = address;

        new Thread(() -> {
            BluetoothSocket socket;
            boolean ownSocket = false;

            // Use persistent connection if alive
            socket = connections.get(addr);
            if (!isSocketAlive(socket)) {
                // Connect fresh for this print job
                closeSocket(connections.remove(addr));
                socket = openSocket(addr);
                if (socket == null) { call.reject("Cannot connect to printer " + addr); return; }
                connections.put(addr, socket);
                ownSocket = true;
                notifyConnectionState(addr, "connected");
            }

            try {
                OutputStream out = socket.getOutputStream();
                // Write in 512-byte chunks — most BT printers handle this fine
                int offset = 0;
                while (offset < finalData.length) {
                    int len = Math.min(512, finalData.length - offset);
                    out.write(finalData, offset, len);
                    out.flush();
                    offset += len;
                }
                // Small drain delay
                Thread.sleep(400);

                JSObject result = new JSObject();
                result.put("success", true);
                call.resolve(result);
            } catch (Exception e) {
                Log.e(TAG, "Print failed on " + addr + ": " + e.getMessage());
                // Socket is dead — remove it
                closeSocket(connections.remove(addr));
                notifyConnectionState(addr, "disconnected");
                call.reject("Print failed: " + e.getMessage());
            }
        }).start();
    }

    // ── Permission callback ───────────────────────────────────────────────────

    @PermissionCallback
    private void onPermission(PluginCall call) {
        if (call == null) return;
        if (!hasPermission()) { call.reject("Bluetooth permission denied"); return; }
        switch (call.getMethodName()) {
            case "getPairedDevices": getPairedDevices(call); break;
            case "scanDevices":      scanDevices(call); break;
            case "connect":          connect(call); break;
            case "printHex":         printHex(call); break;
            case "requestPairing":   requestPairing(call); break;
            default:                 call.reject("Unknown method"); break;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void notifyConnectionState(String address, String state) {
        JSObject e = new JSObject();
        e.put("address", address);
        e.put("state", state);
        notifyListeners("connectionState", e);
    }

    private static byte[] hexToBytes(String hex) {
        hex = hex.replaceAll("\\s", "");
        if (hex.length() % 2 != 0) throw new IllegalArgumentException("Odd length");
        byte[] out = new byte[hex.length() / 2];
        for (int i = 0; i < out.length; i++)
            out[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        return out;
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        for (BluetoothSocket s : connections.values()) closeSocket(s);
        connections.clear();
        if (scanReceiver != null) {
            try { getContext().unregisterReceiver(scanReceiver); } catch (Exception ignored) {}
        }
    }
}
