package com.daqeeq.app;

import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

/**
 * PrivacyPolicyActivity
 *
 * Required by Google Play Store for Health Connect data access.
 * This Activity is launched when the user taps "See data usage" in
 * the Health Connect permissions screen.
 *
 * Place this file at:
 *   android/app/src/main/java/com/daqeeq/app/PrivacyPolicyActivity.java
 *
 * It loads the privacy policy HTML from the app's assets.
 * Alternatively, redirect to your hosted privacy policy URL.
 */
public class PrivacyPolicyActivity extends AppCompatActivity {

    // Replace with your hosted privacy policy URL if preferred.
    // If using local asset: "file:///android_asset/privacy_policy.html"
    private static final String PRIVACY_URL =
            "file:///android_asset/public/setup/android/privacy_policy.html";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(false); // static page, no JS needed
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Keep navigation inside this WebView
                return false;
            }
        });
        webView.loadUrl(PRIVACY_URL);

        setContentView(webView);
        setTitle(R.string.privacy_policy_title);
    }
}
