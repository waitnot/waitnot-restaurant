package com.waitnot.captain;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
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

import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

/**
 * EscPosPlugin — safe Bluetooth printer plugin.
 * - getPairedDevices: safely wrapped with permission checks
 * - printHex: accepts hex-encoded ESC/POS bytes, bypasses JSON binary corruption
 */
@CapacitorPlugin(
    name = "EscPos",
    permissions = {
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "bluetoothConnect"),
        @Permission(strings = { Manifest.permission.BLUETOOTH, Manifest.permission.BLUETOOTH_ADMIN }, alias = "bluetooth")
    }
)
public class EscPosPlugin extends Plugin {

    private static final String TAG = "EscPosPlugin";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void getPairedDevices(PluginCall call) {
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) { call.reject("Bluetooth not supported"); return; }
            if (!adapter.isEnabled()) { call.reject("Bluetooth is disabled"); return; }

            // Check permission on Android 12+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissionForAlias("bluetoothConnect", call, "permissionCallback");
                    return;
                }
            }

            Set<BluetoothDevice> paired = adapter.getBondedDevices();
            JSArray arr = new JSArray();
            if (paired != null) {
                for (BluetoothDevice d : paired) {
                    JSObject obj = new JSObject();
                    obj.put("name", d.getName() != null ? d.getName() : "Unknown");
                    obj.put("address", d.getAddress());
                    arr.put(obj);
                }
            }
            JSObject result = new JSObject();
            result.put("devices", arr);
            call.resolve(result);
        } catch (SecurityException e) {
            call.reject("Bluetooth permission denied: " + e.getMessage());
        } catch (Exception e) {
            call.reject("Failed to get devices: " + e.getMessage());
        }
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (call == null) return;
        // Re-call the original method after permission grant
        if ("getPairedDevices".equals(call.getMethodName())) {
            getPairedDevices(call);
        } else if ("printHex".equals(call.getMethodName())) {
            printHex(call);
        } else {
            call.reject("Permission denied");
        }
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void printHex(PluginCall call) {
        String address = call.getString("address");
        String hex = call.getString("hex");

        if (address == null || address.isEmpty()) { call.reject("address required"); return; }
        if (hex == null || hex.isEmpty()) { call.reject("hex required"); return; }

        // Check permission on Android 12+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                requestPermissionForAlias("bluetoothConnect", call, "permissionCallback");
                return;
            }
        }

        byte[] data;
        try {
            data = hexToBytes(hex);
        } catch (Exception e) {
            call.reject("Invalid hex: " + e.getMessage());
            return;
        }

        // Keep call alive across background thread
        call.setKeepAlive(true);

        final byte[] finalData = data;
        new Thread(() -> {
            BluetoothSocket socket = null;
            try {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null || !adapter.isEnabled()) {
                    call.reject("Bluetooth not available or disabled");
                    return;
                }
                BluetoothDevice device = adapter.getRemoteDevice(address);
                adapter.cancelDiscovery();

                BluetoothSocket[] socketHolder = new BluetoothSocket[1];
                Exception[] errorHolder = new Exception[1];

                Thread connectThread = new Thread(() -> {
                    try {
                        socketHolder[0] = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
                        socketHolder[0].connect();
                    } catch (Exception e1) {
                        Log.w(TAG, "Insecure connect failed: " + e1.getMessage());
                        try { if (socketHolder[0] != null) socketHolder[0].close(); } catch (Exception ignored) {}
                        socketHolder[0] = null;
                        try {
                            socketHolder[0] = device.createRfcommSocketToServiceRecord(SPP_UUID);
                            socketHolder[0].connect();
                        } catch (Exception e2) {
                            errorHolder[0] = e2;
                            try { if (socketHolder[0] != null) socketHolder[0].close(); } catch (Exception ignored) {}
                            socketHolder[0] = null;
                        }
                    }
                });
                connectThread.start();
                connectThread.join(10000);

                if (connectThread.isAlive()) {
                    connectThread.interrupt();
                    call.reject("Connection timeout — is the printer on and in range?");
                    return;
                }
                if (socketHolder[0] == null) {
                    String err = errorHolder[0] != null ? errorHolder[0].getMessage() : "Unknown connection error";
                    call.reject("Connection failed: " + err);
                    return;
                }
                socket = socketHolder[0];

                OutputStream out = socket.getOutputStream();
                if (finalData.length <= 512) {
                    out.write(finalData);
                    out.flush();
                } else {
                    int offset = 0;
                    while (offset < finalData.length) {
                        int len = Math.min(512, finalData.length - offset);
                        out.write(finalData, offset, len);
                        out.flush();
                        offset += len;
                        Thread.sleep(50);
                    }
                }
                Thread.sleep(800);
                out.close();

                JSObject result = new JSObject();
                result.put("success", true);
                call.resolve(result);
            } catch (Exception e) {
                Log.e(TAG, "Print failed: " + e.getMessage(), e);
                call.reject("Print failed: " + e.getMessage());
            } finally {
                try { if (socket != null) socket.close(); } catch (Exception ignored) {}
            }
        }).start();
    }

    private static byte[] hexToBytes(String hex) {
        hex = hex.replaceAll("\\s", "");
        if (hex.length() % 2 != 0) throw new IllegalArgumentException("Odd hex length");
        byte[] out = new byte[hex.length() / 2];
        for (int i = 0; i < out.length; i++) {
            out[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        }
        return out;
    }
}
