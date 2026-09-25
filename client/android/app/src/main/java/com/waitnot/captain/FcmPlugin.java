package com.waitnot.captain;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.messaging.FirebaseMessaging;

/**
 * Exposes FCM token to JavaScript so it can be sent to the server.
 * Also handles direct Java-to-server registration as a fallback.
 */
@CapacitorPlugin(name = "FcmToken")
public class FcmPlugin extends Plugin {

    private static final String TAG = "FcmPlugin";

    @PluginMethod
    public void getToken(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences("waitnot_prefs", Context.MODE_PRIVATE);

        // Save restaurantId if provided — used for Java-side re-registration on token refresh
        String restaurantId = call.getString("restaurantId", null);
        if (restaurantId != null && !restaurantId.isEmpty()) {
            prefs.edit().putString("restaurant_id", restaurantId).apply();
        }

        // Try cached token first for speed
        String cached = prefs.getString("fcm_token", null);
        if (cached != null && !cached.isEmpty()) {
            Log.i(TAG, "Returning cached FCM token");
            JSObject r = new JSObject();
            r.put("token", cached);
            call.resolve(r);
            return;
        }

        // Fetch fresh token from Firebase
        call.setKeepAlive(true);
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful()) {
                String err = task.getException() != null ? task.getException().getMessage() : "unknown";
                Log.e(TAG, "FCM token fetch failed: " + err);
                call.reject("FCM token fetch failed: " + err);
                return;
            }
            String token = task.getResult();
            Log.i(TAG, "FCM token fetched: " + token.substring(0, Math.min(20, token.length())) + "...");
            prefs.edit().putString("fcm_token", token).apply();

            JSObject r = new JSObject();
            r.put("token", token);
            call.resolve(r);
        });
    }

    /**
     * JS calls this to trigger Java-side server registration.
     * More reliable than doing it in JS because it doesn't depend on axios.
     */
    @PluginMethod
    public void registerWithServer(PluginCall call) {
        String restaurantId = call.getString("restaurantId");
        if (restaurantId == null || restaurantId.isEmpty()) {
            call.reject("restaurantId required");
            return;
        }

        SharedPreferences prefs = getContext().getSharedPreferences("waitnot_prefs", Context.MODE_PRIVATE);
        prefs.edit().putString("restaurant_id", restaurantId).apply();

        String cachedToken = prefs.getString("fcm_token", null);

        if (cachedToken != null && !cachedToken.isEmpty()) {
            WaitNotFirebaseService.registerTokenWithServer(cachedToken, restaurantId);
            JSObject r = new JSObject();
            r.put("success", true);
            r.put("tokenPrefix", cachedToken.substring(0, Math.min(20, cachedToken.length())));
            call.resolve(r);
        } else {
            // Fetch token then register
            call.setKeepAlive(true);
            FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                if (!task.isSuccessful()) {
                    call.reject("Token fetch failed");
                    return;
                }
                String token = task.getResult();
                prefs.edit().putString("fcm_token", token).apply();
                WaitNotFirebaseService.registerTokenWithServer(token, restaurantId);
                JSObject r = new JSObject();
                r.put("success", true);
                r.put("tokenPrefix", token.substring(0, Math.min(20, token.length())));
                call.resolve(r);
            });
        }
    }
}
