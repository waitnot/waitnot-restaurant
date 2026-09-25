package com.waitnot.captain;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.messaging.FirebaseMessaging;

/**
 * Exposes FCM token to JavaScript so it can be sent to the server.
 */
@CapacitorPlugin(name = "FcmToken")
public class FcmPlugin extends Plugin {

    @PluginMethod
    public void getToken(PluginCall call) {
        // Try cached token first
        SharedPreferences prefs = getContext().getSharedPreferences("waitnot_prefs", Context.MODE_PRIVATE);
        String cached = prefs.getString("fcm_token", null);
        if (cached != null && !cached.isEmpty()) {
            JSObject r = new JSObject();
            r.put("token", cached);
            call.resolve(r);
            return;
        }

        // Fetch fresh token
        call.setKeepAlive(true);
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful()) {
                call.reject("FCM token fetch failed: " + (task.getException() != null ? task.getException().getMessage() : "unknown"));
                return;
            }
            String token = task.getResult();
            prefs.edit().putString("fcm_token", token).apply();
            JSObject r = new JSObject();
            r.put("token", token);
            call.resolve(r);
        });
    }
}
