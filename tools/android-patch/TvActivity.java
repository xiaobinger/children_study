package com.children.study;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.fragment.app.FragmentActivity;

import java.util.ArrayList;
import java.util.List;

public class TvActivity extends FragmentActivity {

    private WebView webView;
    private CsAudio csAudio;
    private final List<WebView> popupViews = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        // 弹窗（window.open / target=_blank）统一拦截给系统浏览器，WebView 不被劫持
        settings.setSupportMultipleWindows(true);

        // 注册音频桥
        csAudio = new CsAudio(this);
        webView.addJavascriptInterface(csAudio, "CsAudio");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleExternalUrl(url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                return handleExternalUrl(String.valueOf(request.getUrl()));
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                WebView tmp = new WebView(TvActivity.this);
                tmp.getSettings().setJavaScriptEnabled(true);
                tmp.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, String u) {
                        openInBrowser(u);
                        return true;
                    }
                });
                popupViews.add(tmp);
                android.webkit.WebView.WebViewTransport transport =
                        (android.webkit.WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(tmp);
                resultMsg.sendToTarget();
                return true;
            }
        });
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    /* 应用内部地址正常加载；http/https 一律交给系统浏览器 */
    private boolean handleExternalUrl(String url) {
        if (url == null) return false;
        if (url.startsWith("http://") || url.startsWith("https://")) {
            openInBrowser(url);
            return true;
        }
        return false;
    }

    private void openInBrowser(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Exception e) {
            Toast.makeText(this, "无法打开链接", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (csAudio != null) csAudio.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (csAudio != null) csAudio.onResume();
    }

    @Override
    protected void onDestroy() {
        if (csAudio != null) csAudio.onDestroy();
        for (WebView w : popupViews) {
            try { w.destroy(); } catch (Exception ignored) { }
        }
        popupViews.clear();
        super.onDestroy();
    }
}
