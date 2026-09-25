package com.waitnot.captain;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * NotificationPlugin — shows local push notifications for new orders.
 * Works even when app is in background.
 */
@CapacitorPlugin(
    name = "OrderNotification",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class NotificationPlugin extends Plugin {

    private static final String CHANNEL_ID = "waitnot_orders";
    private static final String CHANNEL_NAME = "New Orders";
    private static final int NOTIFICATION_ID_BASE = 5000;
    private final AtomicInteger notifCounter = new AtomicInteger(0);

    @Override
    public void load() {
        super.load();
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes audioAttr = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notifications for new restaurant orders");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 300, 200, 300});
            channel.setSound(soundUri, audioAttr);
            channel.setShowBadge(true);

            NotificationManager nm = getContext().getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissionForAlias("notifications", call, "onNotifPermission");
                return;
            }
        }
        JSObject r = new JSObject();
        r.put("granted", true);
        call.resolve(r);
    }

    @PermissionCallback
    private void onNotifPermission(PluginCall call) {
        boolean granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
        JSObject r = new JSObject();
        r.put("granted", granted);
        call.resolve(r);
    }

    @PluginMethod
    public void showOrderNotification(PluginCall call) {
        String title = call.getString("title", "🍽 New Order");
        String body = call.getString("body", "A new order has been placed");
        String tableInfo = call.getString("tableInfo", "");

        // Vibrate
        Vibrator vib = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
        if (vib != null && vib.hasVibrator()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vib.vibrate(VibrationEffect.createWaveform(new long[]{0, 300, 200, 300}, -1));
            } else {
                vib.vibrate(new long[]{0, 300, 200, 300}, -1);
            }
        }

        // Check permission (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                // Still vibrated, but can't show notification without permission
                JSObject r = new JSObject(); r.put("shown", false); r.put("reason", "no_permission");
                call.resolve(r); return;
            }
        }

        // Intent to open app when notification tapped
        Intent intent = new Intent(getContext(), MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            getContext(), 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(
                tableInfo.isEmpty() ? body : body + "\n" + tableInfo
            ))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setSound(soundUri)
            .setVibrate(new long[]{0, 300, 200, 300})
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setDefaults(NotificationCompat.DEFAULT_LIGHTS);

        NotificationManagerCompat nm = NotificationManagerCompat.from(getContext());
        int notifId = NOTIFICATION_ID_BASE + notifCounter.incrementAndGet();
        nm.notify(notifId, builder.build());

        JSObject r = new JSObject(); r.put("shown", true); r.put("id", notifId);
        call.resolve(r);
    }

    @PluginMethod
    public void clearAll(PluginCall call) {
        NotificationManagerCompat.from(getContext()).cancelAll();
        call.resolve();
    }
}
