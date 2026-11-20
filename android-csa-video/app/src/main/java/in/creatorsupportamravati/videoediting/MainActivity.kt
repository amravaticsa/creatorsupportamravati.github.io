package com.creatorsupportamravati.videoediting

import android.Manifest
import android.app.Activity
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.view.View
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    private lateinit var root: FrameLayout
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var pendingWebPermission: PermissionRequest? = null
    private var showingError = false
    private val filePickerCode = 4201
    private val permissionCode = 4202
    private val startUrl = "https://creatorsupportamravati.in/video-editing.html"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(12, 37, 56)
        window.navigationBarColor = Color.rgb(12, 37, 56)
        window.decorView.systemUiVisibility = 0

        root = FrameLayout(this)
        webView = WebView(this)
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal)
        progress.max = 100
        progress.setBackgroundColor(Color.TRANSPARENT)
        root.addView(webView, FrameLayout.LayoutParams(-1, -1))
        val progressParams = FrameLayout.LayoutParams(-1, dp(3))
        root.addView(progress, progressParams)
        setContentView(root)

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = true
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(false)
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            safeBrowsingEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = userAgentString.replace(" CSAAndroidApp/1.0", "") + " CSAAndroidApp/1.1"
        }
        webView.setBackgroundColor(Color.WHITE)
        webView.isFocusable = true
        webView.isFocusableInTouchMode = true

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return handleNavigation(view, request.url, request.hasGesture())
            }

            @Suppress("DEPRECATION")
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                return handleNavigation(view, Uri.parse(url), false)
            }

            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                showingError = false
                progress.visibility = View.VISIBLE
                progress.progress = 5
            }

            override fun onPageFinished(view: WebView, url: String) {
                if (!showingError) progress.visibility = View.GONE
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame && !showingError) showLoadError(error.description?.toString() ?: "Network error")
            }

            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: android.webkit.WebResourceResponse) {
                super.onReceivedHttpError(view, request, errorResponse)
                if (request.isForMainFrame && errorResponse.statusCode >= 400 && !showingError) {
                    showLoadError("Website returned error ${errorResponse.statusCode}")
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, newProgress: Int) {
                if (!showingError) {
                    progress.progress = newProgress
                    progress.visibility = if (newProgress >= 100) View.GONE else View.VISIBLE
                }
            }

            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback
                val intent = fileChooserParams.createIntent().apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("video/*", "audio/*", "image/*", "application/zip", "application/pdf", "application/x-rar-compressed"))
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }
                return try {
                    startActivityForResult(intent, filePickerCode)
                    true
                } catch (e: ActivityNotFoundException) {
                    fileChooserCallback = null
                    Toast.makeText(this@MainActivity, "File picker is not available on this device.", Toast.LENGTH_LONG).show()
                    false
                }
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val allowed = request.resources.filter {
                        it == PermissionRequest.RESOURCE_VIDEO_CAPTURE || it == PermissionRequest.RESOURCE_AUDIO_CAPTURE
                    }
                    if (allowed.isEmpty()) {
                        request.deny()
                        return@runOnUiThread
                    }
                    val needed = mutableListOf<String>()
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE in allowed &&
                        ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) needed.add(Manifest.permission.CAMERA)
                    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE in allowed &&
                        ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) needed.add(Manifest.permission.RECORD_AUDIO)
                    if (needed.isEmpty()) request.grant(allowed.toTypedArray())
                    else {
                        pendingWebPermission = request
                        ActivityCompat.requestPermissions(this@MainActivity, needed.toTypedArray(), permissionCode)
                    }
                }
            }
        }

        webView.setDownloadListener(DownloadListener { url, userAgent, _, mimeType, _ ->
            try {
                val request = DownloadManager.Request(Uri.parse(url))
                    .setMimeType(mimeType)
                    .addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url) ?: "")
                    .addRequestHeader("User-Agent", userAgent)
                    .setTitle("CSA download")
                    .setDescription("Downloading your video or project file")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "CSA-" + System.currentTimeMillis())
                (getSystemService(DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
                Toast.makeText(this, "Download started. Check Downloads.", Toast.LENGTH_LONG).show()
            } catch (_: Exception) {
                Toast.makeText(this, "Could not start download.", Toast.LENGTH_LONG).show()
            }
        })

        if (savedInstanceState == null) webView.loadUrl(startUrl) else {
            val restored = webView.restoreState(savedInstanceState)
            if (restored == null) webView.loadUrl(startUrl)
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (showingError) {
                    showingError = false
                    webView.loadUrl(startUrl)
                } else if (webView.canGoBack()) webView.goBack() else finish()
            }
        })
    }

    private fun isCsaHost(host: String): Boolean {
        val normalized = host.lowercase().removePrefix("www.")
        return normalized == "creatorsupportamravati.in" ||
            normalized.endsWith(".creatorsupportamravati.in")
    }

    private fun isPaymentHost(host: String): Boolean {
        val h = host.lowercase()
        return h == "razorpay.com" || h.endsWith(".razorpay.com") ||
            h == "razorpay.in" || h.endsWith(".razorpay.in") ||
            h.endsWith(".workers.dev")
    }

    private fun handleNavigation(view: WebView, uri: Uri, userGesture: Boolean): Boolean {
        val scheme = uri.scheme?.lowercase() ?: return true
        val host = uri.host?.lowercase() ?: ""

        // Keep every CSA page inside the app, including www and HTTP-to-HTTPS redirects.
        if (isCsaHost(host)) {
            if (scheme != "https") {
                val secure = uri.buildUpon().scheme("https").build()
                view.loadUrl(secure.toString())
                return true
            }
            return false
        }

        // Razorpay checkout and CSA API endpoints must remain available to the WebView.
        if (scheme == "https" && isPaymentHost(host)) return false

        // Only a deliberate tap may leave the app. Silent redirects to unrelated
        // hosts are blocked so the app cannot unexpectedly jump to an external browser.
        if (userGesture && (scheme == "https" || scheme == "http" ||
                scheme == "mailto" || scheme == "tel" || scheme == "intent" ||
                scheme == "whatsapp")) {
            return openExternal(uri)
        }
        return true
    }

    private fun showLoadError(message: String) {
        showingError = true
        progress.visibility = View.GONE
        val safe = message.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        val html = """
            <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
            <style>body{font-family:Arial,sans-serif;background:#f4f7fa;color:#173247;margin:0;display:grid;place-items:center;min-height:100vh}
            main{background:white;margin:24px;padding:28px;border-radius:18px;box-shadow:0 8px 30px #17324718;text-align:center}
            button{background:#0f9d8c;color:white;border:0;border-radius:10px;padding:14px 24px;font-size:16px;font-weight:bold}</style></head>
            <body><main><h2>CSA Video Editing</h2><p>Website abhi load nahi ho pa rahi.</p><p style="color:#687987;font-size:13px">$safe</p>
            <button onclick="location.href='$startUrl'">Retry</button><p style="font-size:12px">Internet connection check karke dobara try karein.</p></main></body></html>
        """.trimIndent()
        webView.loadDataWithBaseURL(startUrl, html, "text/html", "UTF-8", null)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun openExternal(uri: Uri): Boolean {
        return try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
            true
        } catch (_: Exception) {
            Toast.makeText(this, "This link cannot be opened on this device.", Toast.LENGTH_SHORT).show()
            true
        }
    }

    @Deprecated("Deprecated in Android")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == filePickerCode) {
            val result = if (resultCode == Activity.RESULT_OK) {
                val clip = data?.clipData
                if (clip != null) Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
                else data?.data?.let { arrayOf(it) }
            } else null
            fileChooserCallback?.onReceiveValue(result)
            fileChooserCallback = null
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == permissionCode) {
            val request = pendingWebPermission
            if (request != null && grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
                request.grant(request.resources)
            } else request?.deny()
            pendingWebPermission = null
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        fileChooserCallback?.onReceiveValue(null)
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.destroy()
        }
        super.onDestroy()
    }
}
