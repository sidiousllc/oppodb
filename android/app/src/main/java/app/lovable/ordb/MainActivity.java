package app.lovable.ordb;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final String WEB_URL = "https://db.oppodb.com";
    private static final String SERIAL_VALIDATE_URL = "https://yysbtxpupmwkxovgkama.supabase.co/functions/v1/validate-serial";
    private static final String PREFS = "ordb_prefs";
    private static final String PREF_SERIAL = "serial_key";
    private static final int LOCATION_PERMISSION_REQUEST = 1001;
    private static final int NOTIFICATION_PERMISSION_REQUEST = 1002;

    private FrameLayout container;
    private WebView webView;
    private boolean isAccessChecked = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        hideSystemUI();
        container = new FrameLayout(this);
        setContentView(container);

        SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String savedSerial = prefs.getString(PREF_SERIAL, null);
        if (savedSerial == null || savedSerial.isEmpty()) {
            promptForSerial(null);
        } else {
            validateSerial(savedSerial, false);
        }
    }

    private void hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().getInsetsController().hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
            getWindow().getInsetsController().setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    private void promptForSerial(String errorMessage) {
        runOnUiThread(() -> {
            LinearLayout layout = new LinearLayout(this);
            layout.setOrientation(LinearLayout.VERTICAL);
            layout.setPadding(48, 96, 48, 48);
            layout.setBackgroundColor(0xFF111111);
            layout.setGravity(Gravity.CENTER);

            TextView title = new TextView(this);
            title.setText("Enter Your Serial Key");
            title.setTextColor(0xFFFFFFFF);
            title.setTextSize(22);
            title.setGravity(Gravity.CENTER);
            layout.addView(title);

            TextView subtitle = new TextView(this);
            subtitle.setText("Find or create one in Profile → Android on db.oppodb.com");
            subtitle.setTextColor(0xFFAAAAAA);
            subtitle.setTextSize(12);
            subtitle.setGravity(Gravity.CENTER);
            subtitle.setPadding(0, 12, 0, 24);
            layout.addView(subtitle);

            if (errorMessage != null) {
                TextView err = new TextView(this);
                err.setText(errorMessage);
                err.setTextColor(0xFFFF6666);
                err.setTextSize(12);
                err.setGravity(Gravity.CENTER);
                err.setPadding(0, 0, 0, 16);
                layout.addView(err);
            }

            EditText input = new EditText(this);
            input.setHint("XXXXX-XXXXX-XXXXX-XXXXX-XXXXX");
            input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);
            input.setTextColor(0xFFFFFFFF);
            input.setHintTextColor(0xFF666666);
            input.setBackgroundColor(0xFF222222);
            input.setPadding(24, 24, 24, 24);
            layout.addView(input);

            Button submit = new Button(this);
            submit.setText("Activate");
            submit.setOnClickListener(v -> {
                String s = input.getText().toString().trim().toUpperCase();
                if (s.length() < 6) return;
                validateSerial(s, true);
            });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            lp.topMargin = 24;
            layout.addView(submit, lp);

            setContentView(layout);
        });
    }

    private void validateSerial(String serial, boolean saveOnSuccess) {
        new Thread(() -> {
            try {
                URL url = new URL(SERIAL_VALIDATE_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);

                String deviceId = getDeviceIdentifier();
                String json = "{\"serial\":\"" + serial.replace("\"", "") + "\",\"deviceId\":\"" + deviceId + "\"}";
                OutputStream os = conn.getOutputStream();
                os.write(json.getBytes());
                os.flush();
                os.close();

                int code = conn.getResponseCode();
                BufferedReader reader = new BufferedReader(new InputStreamReader(
                    code >= 400 ? conn.getErrorStream() : conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) response.append(line);
                reader.close();
                String body = response.toString();
                boolean valid = body.contains("\"valid\":true");
                conn.disconnect();

                runOnUiThread(() -> {
                    isAccessChecked = true;
                    if (valid) {
                        if (saveOnSuccess) {
                            getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                                .edit().putString(PREF_SERIAL, serial).apply();
                        }
                        setContentView(container);
                        loadWebView();
                        checkAndRequestPermissions();
                    } else {
                        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(PREF_SERIAL).apply();
                        String reason = "Invalid serial key.";
                        if (body.contains("\"reason\":\"revoked\"")) reason = "This serial has been revoked.";
                        else if (body.contains("\"reason\":\"device_mismatch\"")) reason = "This serial is bound to a different device.";
                        else if (body.contains("\"reason\":\"not_found\"")) reason = "Serial not found.";
                        promptForSerial(reason);
                    }
                });
            } catch (Exception e) {
                Log.e(TAG, "Serial validation failed", e);
                runOnUiThread(() -> promptForSerial("Network error. Check your connection and try again."));
            }
        }).start();
    }

    private void loadWebView() {
        runOnUiThread(() -> {
            webView = new WebView(MainActivity.this);
            WebSettings webSettings = webView.getSettings();
            webSettings.setJavaScriptEnabled(true);
            webSettings.setDomStorageEnabled(true);
            webSettings.setDatabaseEnabled(true);
            webSettings.setUseWideViewPort(true);
            webSettings.setLoadWithOverviewMode(true);
            webSettings.setSupportZoom(false);
            webSettings.setAllowFileAccess(false);
            webSettings.setAllowContentAccess(false);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) webSettings.setSafeBrowsingEnabled(true);

            webView.setWebChromeClient(new WebChromeClient());
            webView.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, String url) {
                    if (url != null && (url.startsWith("https://db.oppodb.com") || url.startsWith("https://www.oppodb.com"))) return false;
                    view.loadUrl("https://db.oppodb.com");
                    return true;
                }
            });
            webView.loadUrl(WEB_URL);
            container.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        });
    }

    @SuppressLint("HardwareIds")
    private String getDeviceIdentifier() {
        String androidId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
        return androidId != null ? androidId : "unknown";
    }

    private void checkAndRequestPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION},
                    LOCATION_PERMISSION_REQUEST);
            } else checkNotificationPermission();
        } else startLocationService();
    }

    private void checkNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST);
            } else startLocationService();
        } else startLocationService();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION_REQUEST) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) checkNotificationPermission();
            else startLocationService();
        } else if (requestCode == NOTIFICATION_PERMISSION_REQUEST) startLocationService();
    }

    private void startLocationService() {
        Intent serviceIntent = new Intent(this, LocationService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(serviceIntent);
        else startService(serviceIntent);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && isAccessChecked) hideSystemUI();
    }
}
