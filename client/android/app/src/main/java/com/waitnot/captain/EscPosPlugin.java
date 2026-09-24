package com.waitnot.captain;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.util.UUID;

/**
 * EscPosPlugin — accepts hex-encoded ESC/POS bytes from JS and sends them
 * directly to a Bluetooth SPP printer. Bypasses the JSON string encoding issue
 * that corrupts binary bytes in the standard BluetoothSerial write() method.
 */
@CapacitorPlugin(name = "EscPos")
public class EscPosPlugin extends Plugin {

    private static final String TAG = "EscPosPlugin";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void printHex(PluginCall call) {
        String address = call.getString("address");
        String hex = call.getString("hex");

        if (address == null || address.isEmpty()) {
            call.reject("address required");
            return;
        }
        if (hex == null || hex.isEmpty()) {
            call.reject("hex required");
            return;
        }

        // Decode hex string to bytes
        byte[] data;
        try {
            data = hexToBytes(hex);
        } catch (Exception e) {
            call.reject("Invalid hex string: " + e.getMessage());
            return;
        }

        // Connect and print on a background thread
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

                // Try secure connection first, then insecure
                try {
                    socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                    adapter.cancelDiscovery();
                    socket.connect();
                } catch (Exception e1) {
                    Log.w(TAG, "Secure connect failed, trying insecure: " + e1.getMessage());
                    try {
                        if (socket != null) socket.close();
                    } catch (Exception ignored) {}
                    try {
                        socket = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
                        adapter.cancelDiscovery();
                        socket.connect();
                    } catch (Exception e2) {
                        call.reject("Connection failed: " + e2.getMessage());
                        return;
                    }
                }

                OutputStream out = socket.getOutputStream();

                // Write in 200-byte chunks
                int offset = 0;
                while (offset < finalData.length) {
                    int len = Math.min(200, finalData.length - offset);
                    out.write(finalData, offset, len);
                    out.flush();
                    offset += len;
                    Thread.sleep(80);
                }

                Thread.sleep(1200);
                out.close();

                JSObject result = new JSObject();
                result.put("success", true);
                call.resolve(result);

            } catch (Exception e) {
                Log.e(TAG, "Print failed: " + e.getMessage(), e);
                call.reject("Print failed: " + e.getMessage());
            } finally {
                try {
                    if (socket != null) socket.close();
                } catch (Exception ignored) {}
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
