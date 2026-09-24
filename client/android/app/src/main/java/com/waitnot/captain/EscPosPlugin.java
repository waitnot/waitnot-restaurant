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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * EscPosPlugin — full Bluetooth printer management for WaitNot Captain.
 *
 * Methods exposed to JS:
 *   getPairedDevices()     — list already-paired devices
 *   scanDevices()          — scan for nearby BT devices (needs BLUETOOTH_SCAN)
 *   stopScan()             — stop active scan
 *   connect({address})     — connect and keep socket open
 *   disconnect({address})  — close socket
 *   getConnectionState()   — returns { address, state: 'connected'|'disconnected' }
 *   printHex({address, hex}) — send ESC/POS bytes (hex-encoded) to connected printer
 *   requestPairing({address}) — initiate system pairing dialog for discovered device
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

    // Keep persistent connections by address
    private final Map<String, BluetoothSocket> connections = new HashMap<>();
    private BroadcastReceiver scanReceiver = null;
    private PluginCall pendingScanCall = null;
    private final List<JSObject> scannedDevices = new ArrayList<>();

    // ── Helpers ──────────────────────────────────────────────────────────────

    private boolean hasPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT)
                == PackageManager.PERMISSION_GRANTED;
        }
        return ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH)
            == PackageManager.PERMISSION_GRANTED;
    }

    private BluetoothAdapter getAdapter() {
        return BluetoothAdapter.getDefaultAdapter();
    }

    private String permAlias() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? "bluetooth12" : "bluetoothLegacy";
    }

    // ── getPairedDevices ─────────────────────────────────────────────────────

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void getPairedDevices(PluginCall call) {
        if (!hasPermission()) {
            requestPermissionForAlias(permAlias(), call, "onPermission");
            return;
        }
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
                    obj.put("connected", connections.containsKey(d.getAddress())
                        && connections.get(d.getAddress()).isConnected());
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
        if (!hasPermission()) {
            requestPermissionForAlias(permAlias(), call, "onPermission");
            return;
        }
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null) { call.reject("Bluetooth not supported"); return; }
        if (!adapter.isEnabled()) { call.reject("Bluetooth is disabled"); return; }

        // Stop previous scan
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
                    if (device != null) {
                        JSObject obj = new JSObject();
                        String name = device.getName();
                        obj.put("name", name != null ? name : "Unknown");
                        obj.put("address", device.getAddress());
                        obj.put("paired", device.getBondState() == BluetoothDevice.BOND_BONDED);
                        obj.put("rssi", intent.getShortExtra(BluetoothDevice.EXTRA_RSSI, Short.MIN_VALUE));

                        // Avoid duplicates
                        boolean exists = false;
                        for (JSObject d : scannedDevices) {
                            if (device.getAddress().equals(d.getString("address"))) { exists = true; break; }
                        }
                        if (!exists) {
                            scannedDevices.add(obj);
                            // Emit incremental update
                            JSObject update = new JSObject();
                            JSArray arr = new JSArray();
                            for (JSObject d : scannedDevices) arr.put(d);
                            update.put("devices", arr);
                            update.put("scanning", true);
                            notifyListeners("scanResult", update);
                        }
                    }
                } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(action)) {
                    JSArray arr = new JSArray();
                    for (JSObject d : scannedDevices) arr.put(d);
                    JSObject result = new JSObject();
                    result.put("devices", arr);
                    result.put("scanning", false);
                    if (pendingScanCall != null) {
                        pendingScanCall.resolve(result);
                        pendingScanCall = null;
                    }
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

        // Auto-stop after timeout
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
        if (!hasPermission()) {
            requestPermissionForAlias(permAlias(), call, "onPermission");
            return;
        }
        String address = call.getString("address");
        if (address == null) { call.reject("address required"); return; }
        try {
            BluetoothAdapter adapter = getAdapter();
            BluetoothDevice device = adapter.getRemoteDevice(address);
            if (device.getBondState() == BluetoothDevice.BOND_BONDED) {
                JSObject r = new JSObject();
                r.put("alreadyPaired", true);
                call.resolve(r);
                return;
            }
            // This shows the system pairing dialog
            boolean started = device.createBond();
            JSObject r = new JSObject();
            r.put("pairingStarted", started);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Pairing error: " + e.getMessage());
        }
    }

    // ── connect ──────────────────────────────────────────────────────────────

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void connect(PluginCall call) {
        if (!hasPermission()) {
            requestPermissionForAlias(permAlias(), call, "onPermission");
            return;
        }
        String address = call.getString("address");
        if (address == null) { call.reject("address required"); return; }

        // Already connected?
        BluetoothSocket existing = connections.get(address);
        if (existing != null && existing.isConnected()) {
            JSObject r = new JSObject();
            r.put("connected", true);
            r.put("address", address);
            call.resolve(r);
            return;
        }

        call.setKeepAlive(true);
        final String addr = address;

        new Thread(() -> {
            BluetoothSocket socket = null;
            try {
                BluetoothAdapter adapter = getAdapter();
                if (adapter == null || !adapter.isEnabled()) {
                    call.reject("Bluetooth disabled"); return;
                }
                BluetoothDevice device = adapter.getRemoteDevice(addr);
                adapter.cancelDiscovery();

                // Try insecure SPP first (works with most cheap thermal printers)
                try {
                    socket = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
                    socket.connect();
                } catch (Exception e1) {
                    Log.w(TAG, "Insecure failed, trying secure: " + e1.getMessage());
                    try { if (socket != null) socket.close(); } catch (Exception ignored) {}
                    socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                    socket.connect();
                }

                connections.put(addr, socket);

                JSObject r = new JSObject();
                r.put("connected", true);
                r.put("address", addr);
                call.resolve(r);

                // Notify connection state change
                notifyConnectionState(addr, "connected");

            } catch (Exception e) {
                Log.e(TAG, "Connect failed: " + e.getMessage());
                try { if (socket != null) socket.close(); } catch (Exception ignored) {}
                connections.remove(addr);
                call.reject("Connection failed: " + e.getMessage());
                notifyConnectionState(addr, "disconnected");
            }
        }).start();
    }

    // ── disconnect ───────────────────────────────────────────────────────────

    @PluginMethod
    public void disconnect(PluginCall call) {
        String address = call.getString("address");
        if (address != null) {
            BluetoothSocket s = connections.remove(address);
            if (s != null) {
                try { s.close(); } catch (Exception ignored) {}
            }
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
            BluetoothSocket s = connections.get(address);
            result.put("address", address);
            result.put("state", (s != null && s.isConnected()) ? "connected" : "disconnected");
        } else {
            // Return all
            JSArray arr = new JSArray();
            for (Map.Entry<String, BluetoothSocket> e : connections.entrySet()) {
                JSObject item = new JSObject();
                item.put("address", e.getKey());
                item.put("state", e.getValue().isConnected() ? "connected" : "disconnected");
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
        if (!hasPermission()) {
            requestPermissionForAlias(permAlias(), call, "onPermission");
            return;
        }
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
            try {
                // Use persistent connection if available, else connect fresh
                BluetoothSocket socket = connections.get(addr);
                boolean tempSocket = false;

                if (socket == null || !socket.isConnected()) {
                    tempSocket = true;
                    BluetoothAdapter adapter = getAdapter();
                    if (adapter == null || !adapter.isEnabled()) {
                        call.reject("Bluetooth disabled"); return;
                    }
                    BluetoothDevice device = adapter.getRemoteDevice(addr);
                    adapter.cancelDiscovery();

                    // Connect with 10s timeout
                    BluetoothSocket[] holder = new BluetoothSocket[1];
                    Exception[] err = new Exception[1];
                    Thread ct = new Thread(() -> {
                        try {
                            holder[0] = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
                            holder[0].connect();
                        } catch (Exception e1) {
                            try { if (holder[0] != null) holder[0].close(); } catch (Exception ignored) {}
                            holder[0] = null;
                            try {
                                holder[0] = device.createRfcommSocketToServiceRecord(SPP_UUID);
                                holder[0].connect();
                            } catch (Exception e2) {
                                err[0] = e2;
                                try { if (holder[0] != null) holder[0].close(); } catch (Exception ignored) {}
                                holder[0] = null;
                            }
                        }
                    });
                    ct.start();
                    ct.join(10000);
                    if (ct.isAlive()) { ct.interrupt(); call.reject("Connection timeout"); return; }
                    if (holder[0] == null) {
                        call.reject("Connection failed: " + (err[0] != null ? err[0].getMessage() : "unknown"));
                        return;
                    }
                    socket = holder[0];
                    if (!tempSocket) connections.put(addr, socket);
                }

                OutputStream out = socket.getOutputStream();
                // Write in 512-byte chunks
                int offset = 0;
                while (offset < finalData.length) {
                    int len = Math.min(512, finalData.length - offset);
                    out.write(finalData, offset, len);
                    out.flush();
                    offset += len;
                    if (finalData.length > 512) Thread.sleep(30);
                }
                Thread.sleep(600);

                if (tempSocket) {
                    try { socket.close(); } catch (Exception ignored) {}
                }

                JSObject result = new JSObject();
                result.put("success", true);
                call.resolve(result);

            } catch (Exception e) {
                Log.e(TAG, "Print failed: " + e.getMessage(), e);
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
            default:                 call.reject("Unknown method after permission"); break;
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
        for (BluetoothSocket s : connections.values()) {
            try { s.close(); } catch (Exception ignored) {}
        }
        connections.clear();
        if (scanReceiver != null) {
            try { getContext().unregisterReceiver(scanReceiver); } catch (Exception ignored) {}
        }
    }
}
