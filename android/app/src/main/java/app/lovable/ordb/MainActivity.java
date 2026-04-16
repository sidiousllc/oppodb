package app.lovable.ordb;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
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
    private static final String ACCESS_CHECK_URL = "https://sidiousgroup.zo.space/api/access-check";
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
        
        checkAccessControl();
    }

    private void hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().getInsetsController().hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
            getWindow().getInsetsController().setSystemBarsBehavior(
                WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
        }
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
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                webSettings.setSafeBrowsingEnabled(true);
            }
            
            webView.setWebChromeClient(new WebChromeClient());
            webView.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, String url) {
                    Log.d(TAG, "Loading URL: " + url);
                    // Keep ALL navigation within the WebView - don't open external browsers
                    if (url != null && url.startsWith("https://db.oppodb.com")) {
                        return false; // Let WebView handle it
                    }
                    if (url != null && url.startsWith("https://www.oppodb.com")) {
                        return false; // Let WebView handle it
                    }
                    // Block all other URLs - stay in WebView but show error or redirect
                    Log.d(TAG, "Blocked external URL: " + url);
                    view.loadUrl("https://db.oppodb.com"); // Redirect back to main site
                    return true;
                }

                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    Log.d(TAG, "Page loaded: " + url);
                }
            });
            
            webView.loadUrl(WEB_URL);
            
            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            );
            container.addView(webView, params);
        });
    }

    private void showBlockedView() {
        hideSystemUI();
        
        FrameLayout blockedContainer = new FrameLayout(this);
        blockedContainer.setBackgroundColor(0xFF111111);
        
        TextView textView = new TextView(this);
        textView.setText("Access Restricted\n\nContact administrator");
        textView.setTextColor(0xFFFFFFFF);
        textView.setTextSize(24);
        textView.setGravity(android.view.Gravity.CENTER);
        
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        );
        blockedContainer.addView(textView, params);
        
        setContentView(blockedContainer);
    }

    private void checkAccessControl() {
        new Thread(() -> {
            try {
                URL url = new URL(ACCESS_CHECK_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                
                String deviceId = getDeviceIdentifier();
                String json = "{\"deviceId\":\"" + deviceId + "\"}";
                
                OutputStream os = conn.getOutputStream();
                os.write(json.getBytes());
                os.flush();
                os.close();

                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                reader.close();

                boolean allowed = response.toString().contains("\"allowed\":true");
                
                runOnUiThread(() -> {
                    isAccessChecked = true;
                    if (allowed) {
                        loadWebView();
                        checkAndRequestPermissions();
                    } else {
                        showBlockedView();
                    }
                });
                conn.disconnect();
            } catch (Exception e) {
                Log.e(TAG, "Access check failed, loading anyway", e);
                runOnUiThread(() -> {
                    isAccessChecked = true;
                    loadWebView();
                    checkAndRequestPermissions();
                });
            }
        }).start();
    }

    @SuppressLint("HardwareIds")
    private String getDeviceIdentifier() {
        String androidId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
        return androidId != null ? androidId : "unknown";
    }

    private void checkAndRequestPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                    new String[]{
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    },
                    LOCATION_PERMISSION_REQUEST
                );
            } else {
                checkNotificationPermission();
            }
        } else {
            startLocationService();
        }
    }

    private void checkNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    NOTIFICATION_PERMISSION_REQUEST
                );
            } else {
                startLocationService();
            }
        } else {
            startLocationService();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                         @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        
        if (requestCode == LOCATION_PERMISSION_REQUEST) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                checkNotificationPermission();
            } else {
                startLocationService();
            }
        } else if (requestCode == NOTIFICATION_PERMISSION_REQUEST) {
            startLocationService();
        }
    }

    private void startLocationService() {
        Intent serviceIntent = new Intent(this, LocationService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && isAccessChecked) {
            hideSystemUI();
        }
    }
}