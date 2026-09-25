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

import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Firebase Cloud Messaging service.
 * Handles push notifications when app is in background or killed.
 */
public class WaitNotFirebaseService extends FirebaseMessagingService {

    private static final String TAG = "WaitNotFCM";
    private static final String CHANNEL_ID = "waitnot_orders";
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
        // Store locally so JS can read it on next app open
        getSharedPreferences("waitnot_prefs", Context.MODE_PRIVATE)
            .edit()
            .putString("fcm_token", token)
            .apply();
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        super.onMessageReceived(message);
        Log.i(TAG, "FCM message received from: " + message.getFrom());

        Map<String, String> data = message.getData();
        String title = data.getOrDefault("title", "🍽 New Order");
        String body = data.getOrDefault("body", "A new order has been placed");
        String tableInfo = data.getOrDefault("tableInfo", "");

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
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setSound(soundUri)
            .setVibrate(new long[]{0, 300, 200, 300})
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setDefaults(NotificationCompat.DEFAULT_LIGHTS);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "POST_NOTIFICATIONS permission not granted");
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

            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }
}
