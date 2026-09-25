package com.waitnot.captain;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(EscPosPlugin.class);
        registerPlugin(NotificationPlugin.class);
        registerPlugin(FcmPlugin.class);
        registerPlugin(SecureStoragePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
