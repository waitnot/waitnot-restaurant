package com.waitnot.captain;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(EscPosPlugin.class);
        registerPlugin(NotificationPlugin.class);
        registerPlugin(FcmPlugin.class);
        registerPlugin(SecureStoragePlugin.class);
        super.onCreate(savedInstanceState);

        // On every app start, ensure FCM token is registered with server
        ensureFcmTokenRegistered();
    }

    private void ensureFcmTokenRegistered() {
        SharedPreferences prefs = getSharedPreferences("waitnot_prefs", MODE_PRIVATE);
        String restaurantId = prefs.getString("restaurant_id", null);

        // Fetch fresh FCM token and register with server
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful()) {
                Log.w(TAG, "FCM token fetch failed: " +
                    (task.getException() != null ? task.getException().getMessage() : "unknown"));
                return;
            }
            String token = task.getResult();
            if (token == null || token.isEmpty()) return;

            // Cache the token
            prefs.edit().putString("fcm_token", token).apply();
            Log.i(TAG, "FCM token ready: " + token.substring(0, Math.min(20, token.length())) + "...");

            // Register with server if we know the restaurant
            if (restaurantId != null && !restaurantId.isEmpty()) {
                Log.i(TAG, "Auto-registering FCM token for restaurant: " + restaurantId);
                WaitNotFirebaseService.registerTokenWithServer(token, restaurantId);
            } else {
                Log.i(TAG, "No restaurant_id saved yet — will register after login");
            }
        });
    }
}
