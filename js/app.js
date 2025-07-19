// QRScanner
class QRScanner {
  constructor(regionId, onSuccess, onFailure, timeoutMs = 30000) {
    this.regionId = regionId;
    this.onSuccess = onSuccess;
    this.onFailure = onFailure;
    this.timeoutMs = timeoutMs;

    this.qrCodeScanner = null;
    this.qrTimeout = null;
    this._countdownInterval = null;
    this.scanning = false;

    this.failedScans = 0;
    this.maxFailedScans = 15;
  }

  async start() {
    try {
      const region = document.getElementById(this.regionId);
      if (!region || region.offsetParent === null) {
        console.warn("QRScanner: Region tidak terlihat, batal start.");
        return;
      }

      if (this.qrCodeScanner) {
        await this.clear();
      }

      // Reset UI
      this.failedScans = 0;
      document.getElementById("restart-scan-btn")?.classList.add("dis-none");
      document.getElementById("cams-timeout-counter")?.classList.remove("dis-none");
      document.getElementById("btn-manual-code")?.classList.add("dis-none");

      this.qrCodeScanner = new Html5Qrcode(this.regionId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
      });

      this.scanning = true;
      ToastManager.show("Membuka kamera...", "info");

      await this.qrCodeScanner.start(
        { facingMode: "environment" },
        { fps: 30 },
        async (decodedText) => {
          if (!this.scanning) return;

          this.resetTimeout();
          this.onSuccess(decodedText);
        },
        () => {
          // abaikan decoding errors
        }
      );

      this.resetTimeout();
      this.startCountdown();

    } catch (err) {
      console.error("QRScanner: Gagal inisialisasi kamera", err);
      ToastManager.show("Gagal membuka kamera", "error");
      this.onFailure("camera-error");
    }
  }

  handleFailedScan() {
    this.failedScans++;
    console.warn(`Scan gagal ke-${this.failedScans}`);

    if (this.failedScans >= this.maxFailedScans) {
      this.stop();
      const manualBtn = document.getElementById("btn-manual-code");
      if (manualBtn) manualBtn.classList.remove("dis-none");
    }
  }

  resetTimeout() {
    if (this.qrTimeout) clearTimeout(this.qrTimeout);

    this.qrTimeout = setTimeout(async () => {
      if (!this.scanning) return;

      await this.stop();
      await this.clear();

      const counterEl = document.getElementById("cams-timeout-counter");
      if (counterEl) counterEl.classList.add("dis-none");

      ToastManager.show("Waktu habis.<br>Tekan &nbsp; <i class='fas fa-qrcode'></i> &nbsp; untuk ulangi.", "warning");
      document.getElementById("restart-scan-btn")?.classList.remove("dis-none");
      this.onFailure("timeout");
    }, this.timeoutMs);

    this.startCountdown();
  }

  async stop() {
    this.scanning = false;

    if (this.qrTimeout) {
      clearTimeout(this.qrTimeout);
      this.qrTimeout = null;
    }

    if (this._countdownInterval) {
      clearInterval(this._countdownInterval);
      this._countdownInterval = null;
    }

    const counterEl = document.getElementById("cams-timeout-counter");
    if (counterEl) counterEl.classList.add("dis-none");

    if (this.qrCodeScanner) {
      try {
        await this.qrCodeScanner.stop();
      } catch (err) {
        console.warn("QRScanner: Error saat stop", err);
      }
    }
  }

  async clear() {
    if (this.qrCodeScanner) {
      try {
        await this.qrCodeScanner.clear();
      } catch (err) {
        console.warn("QRScanner: Error saat clear", err);
      }
      this.qrCodeScanner = null;
    }
  }

  startCountdown() {
    const counterEl = document.getElementById("cams-timeout-counter");
    if (!counterEl) return;

    if (this._countdownInterval) clearInterval(this._countdownInterval);

    let remaining = Math.floor(this.timeoutMs / 1000);
    counterEl.innerText = remaining;

    this._countdownInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(this._countdownInterval);
        this._countdownInterval = null;
        counterEl.classList.add("dis-none");
      } else {
        counterEl.innerText = remaining + "s";
      }
    }, 1000);
  }
}




class AppController {
  constructor(serverUrl = "", enableOffline = false) {
    this.serverUrl = serverUrl;
    this.state = null;
    this.retryLimit = 3;
    this.retryCount = 0;

    this.qrScanner = new QRScanner(
      "qr-reader",
      this.handleQRScan.bind(this),
      this.handleQRFail.bind(this),
      15000 // timeout 15 detik misalnya
    );

    this.faceRecognizer = new FaceRecognizer("video", "canvas");
    this.request = new RequestManager(enableOffline);

    this.init();
  }

  init() {
    document.getElementById("restart-scan-btn").addEventListener("click", () => {
      document.getElementById("restart-scan-btn").classList.add("dis-none");
      this.qrScanner.start();
    });

    this.changeContent("camera");
  }

  changeContent(id) {
    document.querySelectorAll(".content").forEach(el => el.classList.add("hidden"));
    const content = document.getElementById(id);
    if (content) content.classList.remove("hidden");
    this.state = id;

    if (id === "camera") {
      document.getElementById("camera-content")?.classList.remove("hidden");
      this.qrScanner.start();
    } else {
      this.qrScanner.stop();
      this.faceRecognizer.stop();
    }
  }

  async handleQRScan(data) {
    // QR discan => reset timeout di QRScanner sudah dilakukan
    console.log("QR scanned:", data);
    ToastManager.show("Memvalidasi QR...", "info");

    try {
      const response = await this.request.get(`${this.serverUrl}/get-data?qr=${encodeURIComponent(data)}`);
      const userData = response.data;

      if (userData && userData.faceImage) {
        this.changeContent("face");
        this.faceRecognizer.start(
          userData.faceImage,
          () => ToastManager.show("Wajah cocok!", "success"),
          () => ToastManager.show("Wajah tidak cocok", "error")
        );
      } else {
        ToastManager.show("QR tidak valid", "error");
        // Scanner tetap lanjut, timeout tetap berjalan
      }
    } catch (err) {
      console.error("Request error:", err);
      ToastManager.show("Gagal ambil data", "error");
    }
  }

  handleQRFail(reason) {
    return console.warn("QR gagal:", reason);

    if (reason === "timeout") {
      this.retryCount++;
      if (this.retryCount < this.retryLimit) {
        ToastManager.show("Waktu habis, ulangi...", "warning");
      } else {
        ToastManager.show("Terlalu banyak kegagalan. Hubungi admin.", "error");
      }
    }

    if (reason === "camera-error") {
      ToastManager.show("Gagal membuka kamera", "error");
    }
  }
}


class ToastManager {
  static show(message, type = "info", duration = 3000) {
    // Buat elemen toast
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = message;

    // Append dulu dengan state awal (opacity 0)
    document.body.appendChild(toast);

    // Trigger reflow biar CSS transition bisa jalan
    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    // Timer untuk hilangkan toast
    setTimeout(() => {
      toast.classList.remove("show");

      // Tunggu animasi keluar selesai baru remove
      setTimeout(() => {
        if (toast && toast.parentNode) {
          toast.remove();
        }
      }, 300); // waktu animasi di CSS
    }, duration);
  }
}





// Jangan lupa pastikan ToastManager.show.init() dipanggil sebelum pemakaian
// Biasanya cukup sekali saat load awal di AppController atau index.html

// CodeHandler
class CodeHandler {
  constructor(appController) {
    this.app = appController;
    this.inputs = document.querySelectorAll(".code-inputer");
    this.loaderBox = document.querySelector(".code-loader-box");
    this.validChars = /^[A-Z0-9-]$/i;
    this.init();
  }

  init() {
    this.inputs.forEach((input, idx) => {
      input.addEventListener("input", e => this.onInput(e, idx));
      input.addEventListener("keydown", e => this.onKeyDown(e, idx));
      input.addEventListener("focus", () => input.classList.add("active"));
      input.addEventListener("blur", () => input.classList.remove("active"));
    });
  }

  onInput(e, idx) {
    const value = e.target.value.toUpperCase();
    if (!this.validChars.test(value) && value !== "-") {
      e.target.classList.add("input-error");
      e.target.value = "";
      return;
    }

    e.target.classList.remove("input-error");
    e.target.value = value;

    if (idx < this.inputs.length - 1 && value) {
      this.inputs[idx + 1].focus();
    }

    const code = this.getCode();
    if (code.length === 5 && code.includes("-")) {
      this.submitCode(code);
    }
  }

  onKeyDown(e, idx) {
    if (e.key === "Backspace" && !e.target.value && idx > 0) {
      this.inputs[idx - 1].focus();
    }
  }

  getCode() {
    return Array.from(this.inputs).map(i => i.value).join;
  }

  async submitCode(code) {
    this.setLoading(true);
    try {
      const response = await this.app.request.post(this.app.serverUrl + "/check-code", { code });
      if (response?.valid) {
        this.app.ToastManager.show("✅ Kode valid, memulai face scan...");
        this.app.changeContent("camera");
      } else {
        this.app.ToastManager.show("❌ Kode tidak ditemukan!");
        this.clearInputs();
      }
    } catch (err) {
      this.app.ToastManager.show("⚠️ Gagal kirim kode. Coba lagi.");
    } finally {
      this.setLoading(false);
    }
  }

  setLoading(show) {
    this.loaderBox?.classList.toggle("hidden", !show);
  }

  clearInputs() {
    this.inputs.forEach(i => (i.value = ""));
    this.inputs[0]?.focus();
  }
}
// RequestManager
class RequestManager {
  constructor(enableOffline = false) {
    this.enableOffline = enableOffline;
    this.retryLimit = 3;
  }

  async post(url, data) {
    let attempt = 0;
    while (attempt < this.retryLimit) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        DebugPanel.log("POST", data, json);
        return json;
      } catch (err) {
        attempt++;
        if (attempt >= this.retryLimit) throw err;
        await new Promise(res => setTimeout(res, 1000));
      }
    }
  }
}
// FaceRecognizer
class FaceRecognizer {
  constructor(videoId, canvasId) {
    this.video = document.getElementById(videoId);
    this.canvas = document.getElementById(canvasId);
    this.model = null;
  }

  async loadModel() {
    this.model = await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
    await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
    await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
  }

  async start() {
    if (!this.model) await this.loadModel();
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
    this.video.srcObject = stream;
    await this.video.play();
  }

  async match(targetDescriptor) {
    const detection = await faceapi.detectSingleFace(this.video).withFaceLandmarks().withFaceDescriptor();
    if (!detection) return false;
    const distance = faceapi.euclideanDistance(detection.descriptor, targetDescriptor);
    return distance < 0.6;
  }

  stop() {
    const stream = this.video.srcObject;
    if (stream) stream.getTracks().forEach(track => track.stop());
    this.video.srcObject = null;
  }
}

// DebugPanel
class DebugPanel {
  log(title, request, response) {
    try {
      console.groupCollapsed(`[${title}]`);
      console.log("Request:", request);
      console.log("Response:", response);
      console.groupEnd();
    } catch (err) {
      console.error("DebugPanel Error:", err);
    }
  }
}
// CryptoHelper
class CryptoHelper {
  async hash(data) {
    const encoder = new TextEncoder();
    const buffer = encoder.encode(data);
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, "0"))
      .join;
  }
}













