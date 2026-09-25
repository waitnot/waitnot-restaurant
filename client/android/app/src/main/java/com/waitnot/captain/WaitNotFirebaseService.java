package com.waitnot.captain;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Firebase Cloud Messaging service.
 * Handles push notifications when app is in background or killed.
 * Also auto-registers FCM token with WaitNot server.
 */
public class WaitNotFirebaseService extends FirebaseMessagingService {

    private static final String TAG = "WaitNotFCM";
    private static final String CHANNEL_ID = "waitnot_orders";
    private static final String SERVER_URL = "https://waitnot-restaurant.onrender.com";
    private static final AtomicInteger counter = new AtomicInteger(0);

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.i(TAG, "FCM token refreshed: " + token);

        // Store token locally
        SharedPreferences prefs = getSharedPreferences("waitnot_prefs", Context.MODE_PRIVATE);
        prefs.edit().putString("fcm_token", token).apply();

        // Register with server in background thread
        String restaurantId = prefs.getString("restaurant_id", null);
        if (restaurantId != null) {
            registerTokenWithServer(token, restaurantId);
        } else {
            Log.w(TAG, "No restaurant_id saved yet — token will be registered on next login");
        }
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        super.onMessageReceived(message);
        Log.i(TAG, "FCM message received");

        Map<String, String> data = message.getData();

        // Use data payload fields (sent even when app is killed)
        String title = data.containsKey("title") ? data.get("title") : "🍽 New Order";
        String body  = data.containsKey("body")  ? data.get("body")  : "A new order has been placed";
        String tableInfo = data.containsKey("tableInfo") ? data.get("tableInfo") : "";

        // Also check notification payload as fallback
        if (message.getNotification() != null) {
            if (title.isEmpty() && message.getNotification().getTitle() != null)
                title = message.getNotification().getTitle();
            if (body.isEmpty() && message.getNotification().getBody() != null)
                body = message.getNotification().getBody();
        }

        showNotification(title, body, tableInfo);
    }

    private void showNotification(String title, String body, String tableInfo) {
        createNotificationChannel();

        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        String fullBody = (tableInfo == null || tableInfo.isEmpty()) ? body : body + "\n" + tableInfo;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(fullBody))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setSound(soundUri)
            .setVibrate(new long[]{0, 300, 200, 300})
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setDefaults(NotificationCompat.DEFAULT_LIGHTS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "POST_NOTIFICATIONS permission not granted — cannot show notification");
                return;
            }
        }

        NotificationManagerCompat nm = NotificationManagerCompat.from(this);
        nm.notify(5000 + counter.incrementAndGet(), builder.build());
        Log.i(TAG, "Notification shown: " + title);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes audioAttr = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "New Orders", NotificationManager.IMPORTANCE_HIGH
            );
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 300, 200, 300});
            channel.setSound(soundUri, audioAttr);
            channel.setShowBadge(true);
            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    /**
     * Register FCM token with WaitNot server via plain HTTP POST.
     * Runs in a background thread — never blocks UI.
     */
    public static void registerTokenWithServer(String token, String restaurantId) {
        new Thread(() -> {
            try {
                URL url = new URL(SERVER_URL + "/api/devices/register-direct");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);

                JSONObject body = new JSONObject();
                body.put("fcmToken", token);
                body.put("restaurantId", restaurantId);
                body.put("platform", "android");

                OutputStream os = conn.getOutputStream();
                os.write(body.toString().getBytes("UTF-8"));
                os.close();

                int code = conn.getResponseCode();
                Log.i(TAG, "Token registered with server, HTTP " + code);
                conn.disconnect();
            } catch (Exception e) {
                Log.e(TAG, "Failed to register token: " + e.getMessage());
            }
        }).start();
    }
}
