package com.waitnot.captain;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * SecureStoragePlugin — persists key-value pairs in Android SharedPreferences.
 * Survives app cache clears (unlike WebView localStorage).
 * Used to persist staff login credentials across sessions.
 */
@CapacitorPlugin(name = "SecureStorage")
public class SecureStoragePlugin extends Plugin {

    private static final String PREFS_NAME = "waitnot_secure_prefs";

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");
        if (key == null) { call.reject("key required"); return; }
        getPrefs().edit().putString(key, value).apply();
        call.resolve();
    }

    @PluginMethod
    public void get(PluginCall call) {
        String key = call.getString("key");
        if (key == null) { call.reject("key required"); return; }
        String value = getPrefs().getString(key, null);
        JSObject r = new JSObject();
        r.put("value", value);
        call.resolve(r);
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String key = call.getString("key");
        if (key == null) { call.reject("key required"); return; }
        getPrefs().edit().remove(key).apply();
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        getPrefs().edit().clear().apply();
        call.resolve();
    }
}
