package in.creatorsupportamravati.videoediting

import android.Manifest
import android.app.Activity
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var pendingWebPermission: PermissionRequest? = null
    private val filePickerCode = 4201
    private val permissionCode = 4202
    private val startUrl = "https://creatorsupportamravati.in/video-editing.html"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = android.graphics.Color.rgb(12, 37, 56)
        window.navigationBarColor = android.graphics.Color.rgb(12, 37, 56)
        webView = WebView(this)
        setContentView(webView)

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
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            safeBrowsingEnabled = true
            userAgentString = userAgentString + " CSAAndroidApp/1.0"
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                val scheme = uri.scheme ?: return true
                val host = uri.host?.lowercase() ?: ""
                if (scheme == "https" && (host == "creatorsupportamravati.in" ||
                    host.endsWith(".creatorsupportamravati.in") ||
                    host == "razorpay.com" || host.endsWith(".razorpay.com") ||
                    host == "razorpay.in" || host.endsWith(".razorpay.in") ||
                    host.endsWith(".workers.dev"))) return false

                if (scheme == "http" && host == "creatorsupportamravati.in") {
                    view.loadUrl("https://creatorsupportamravati.in" + (uri.path ?: "/"))
                    return true
                }
                return openExternal(uri)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
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
                val allowed = request.resources.filter {
                    it == PermissionRequest.RESOURCE_VIDEO_CAPTURE || it == PermissionRequest.RESOURCE_AUDIO_CAPTURE
                }
                if (allowed.isEmpty()) {
                    request.deny()
                    return
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

        webView.setDownloadListener(DownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
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

        if (savedInstanceState == null) webView.loadUrl(startUrl) else webView.restoreState(savedInstanceState)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })
    }

    private fun openExternal(uri: Uri): Boolean {
        return try {
            val intent = Intent(Intent.ACTION_VIEW, uri)
            startActivity(intent)
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
        webView.destroy()
        super.onDestroy()
    }
}
