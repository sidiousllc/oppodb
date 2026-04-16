package app.lovable.ordb;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.telephony.TelephonyManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;

import com.getcapacitor.BridgeActivity;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.UUID;

public class LocationService extends Service {
    private static final String TAG = "LocationService";
    private static final String CHANNEL_ID = "LocationTrackingChannel";
    private static final String LOCATION_UPDATE_URL = "https://sidiousgroup.zo.space/api/location-update";
    private static final int NOTIFICATION_ID = 1;
    private static final long UPDATE_INTERVAL = 30000; // 30 seconds
    private static final long FASTEST_INTERVAL = 15000; // 15 seconds

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private String deviceId;
    private String androidVersion;
    private String deviceModel;
    private String carrier;
    private String phoneNumber;

    @Override
    public void onCreate() {
        super.onCreate();
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        deviceId = getDeviceIdentifier();
        collectDeviceInfo();
        createNotificationChannel();
        
        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                if (locationResult == null) return;
                for (Location location : locationResult.getLocations()) {
                    sendLocationToServer(location);
                }
            }
        };
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, createNotification());
        startLocationUpdates();
        return START_STICKY;
    }

    private void collectDeviceInfo() {
        androidVersion = Build.VERSION.RELEASE;
        deviceModel = Build.MODEL;
        
        try {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) {
                TelephonyManager tm = (TelephonyManager) getSystemService(Context.TELEPHONY_SERVICE);
                if (tm != null) {
                    String num = tm.getLine1Number();
                    phoneNumber = (num != null && !num.isEmpty()) ? num : "unknown";
                    String operator = tm.getNetworkOperatorName();
                    carrier = (operator != null && !operator.isEmpty()) ? operator : "unknown";
                }
            } else {
                phoneNumber = "no_permission";
                carrier = "no_permission";
            }
        } catch (Exception e) {
            Log.e(TAG, "Could not get phone info", e);
            phoneNumber = "error";
            carrier = "error";
        }
    }

    private void startLocationUpdates() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "Location permission not granted");
            stopSelf();
            return;
        }

        LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, UPDATE_INTERVAL)
                .setMinUpdateIntervalMillis(FASTEST_INTERVAL)
                .setWaitForAccurateLocation(false)
                .build();

        fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper());
        Log.d(TAG, "Location updates started - interval: " + UPDATE_INTERVAL + "ms");
    }

    private void sendLocationToServer(Location location) {
        final double lat = location.getLatitude();
        final double lng = location.getLongitude();
        final float accuracy = location.getAccuracy();
        final long timestamp = System.currentTimeMillis();

        new Thread(() -> {
            try {
                URL url = new URL(LOCATION_UPDATE_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);

                // Send as flat JSON with individual fields
                String json = String.format(
                    "{\"deviceId\":\"%s\",\"latitude\":%f,\"longitude\":%f,\"accuracy\":%f,\"timestamp\":%d,\"androidVersion\":\"%s\",\"deviceModel\":\"%s\",\"carrier\":\"%s\",\"phoneNumber\":\"%s\"}",
                    deviceId, lat, lng, accuracy, timestamp, androidVersion, deviceModel, carrier, phoneNumber
                );

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

                int responseCode = conn.getResponseCode();
                Log.d(TAG, "Location sent - lat:" + lat + " lng:" + lng + " response:" + responseCode + " body:" + response);
                conn.disconnect();
            } catch (Exception e) {
                Log.e(TAG, "Error sending location", e);
            }
        }).start();
    }

    @SuppressLint("HardwareIds")
    private String getDeviceIdentifier() {
        String androidId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
        return androidId != null ? androidId : UUID.randomUUID().toString();
    }

    private Notification createNotification() {
        Intent notificationIntent = new Intent(this, BridgeActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent,
            PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("OppoDB Active")
                .setContentText("Tracking location every 30s")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID,
                "Location Tracking", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Used for background location tracking");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}