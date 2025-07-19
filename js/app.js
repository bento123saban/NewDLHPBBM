// QRScanner
class QRScanner {
  constructor(regionId, onSuccess, onFail, timeoutMs = 30000, maxAttempts = 15) {
    this.regionId = regionId;
    this.onSuccess = onSuccess;
    this.onFail = onFail;
    this.timeoutMs = timeoutMs;
    this.maxAttempts = maxAttempts;

    this.qr = null;
    this.scanning = false;
    this.timeoutHandle = null;
    this.counterHandle = null;
    this.countdownEl = document.getElementById("cams-timeout-counter");
    this.restartBtn = document.getElementById("restart-scan-btn");
    this.manualBtn = document.getElementById("btn-manual");
    this.attemptCount = 0;
    this.isVerifying = false;
  }

  async start() {
    if (this.scanning) return;
    const region = document.getElementById(this.regionId);
    if (!region) {
      ToastManager.show("Elemen region QR tidak ditemukan", "error");
      return;
    }

    this.qr = new Html5Qrcode(this.regionId);
    this.scanning = true;
    this.attemptCount = 0;
    this.isVerifying = false;

    // Tampilkan counter
    this.showCountdown(this.timeoutMs / 1000);

    try {
      await this.qr.start(
        { facingMode: "user" },
        { fps: 40, qrbox: 290 },
        (decodedText) => this._handleScan(decodedText),
        (err) => { /* optional: handle error per frame */ }
      );

      // Timeout global
      this.timeoutHandle = setTimeout(() => this.stop(), this.timeoutMs);
    } catch (e) {
      ToastManager.show("Gagal mengakses kamera: " + e.message, "error");
      this.stop();
    }
  }

  async stop() {
    this.scanning = false;
    this.clearCountdown();
    if (this.qr && this.qr.getState() === Html5QrcodeScannerState.SCANNING) {
      await this.qr.stop();
      this.qr.clear();
    }
    this.qr = null;
  }

  async _handleScan(decodedText) {
    if (this.isVerifying) return;

    this.attemptCount++;
    let data;

    try {
      data = JSON.parse(atob(decodedText));
    } catch (e) {
      ToastManager.show("QR tidak valid (bukan base64 JSON)", "warning");
      return;
    }

    this.isVerifying = true;
    const result = await this.onSuccess(data, decodedText);

    if (!result) {
      this.isVerifying = false;
      if (this.attemptCount >= this.maxAttempts) {
        this.showManualButton();
        this.stop();
      }
    } else {
      this.clearCountdown();
    }
  }

  showManualButton() {
    if (this.manualBtn) {
      this.manualBtn.classList.remove("dis-none");
    }
  }

  showCountdown(seconds) {
    if (!this.countdownEl) return;

    this.countdownEl.classList.remove("dis-none");
    this.countdownEl.textContent = seconds;

    this.counterHandle = setInterval(() => {
      seconds--;
      this.countdownEl.textContent = seconds;
      if (seconds <= 0) {
        this.clearCountdown();
        this.stop();
      }
    }, 1000);
  }

  clearCountdown() {
    if (this.counterHandle) {
      clearInterval(this.counterHandle);
      this.counterHandle = null;
    }
    if (this.countdownEl) {
      this.countdownEl.classList.add("dis-none");
    }
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }
}





class AppController {
  constructor(serverUrl = "") {
    this.serverUrl = serverUrl;
    this.qrScanner = new QRScanner("qr-reader", this.handleQRScan.bind(this), this.handleQRFail.bind(this));
    this.state = null;

    // Tombol manual
    const btnManual = document.getElementById("btn-manual");
    if (btnManual) {
      btnManual.addEventListener("click", () => this.goToManualInput());
    }

    this.init();
  }

  init() {
    this.startScan();
  }

  async startScan() {
    try {
      ToastManager.show("Memulai pemindaian QR...", "info");
      await this.qrScanner.start();
    } catch (e) {
      ToastManager.show("Gagal memulai scanner: " + e.message, "error");
    }
  }

  async handleQRScan(data, rawQR) {
    try {
      ToastManager.show("Verifikasi QR...", "info");
      const isValid = await this.verifyQRData(data);

      if (isValid) {
        ToastManager.show("QR Valid! Lanjut...", "success");
        this.qrScanner.stop();
        // Next step: face recognition or redirect
        return true;
      } else {
        ToastManager.show("QR tidak dikenal", "warning");
        return false;
      }
    } catch (e) {
      ToastManager.show("Error saat verifikasi QR", "error");
      return false;
    }
  }

  async handleQRFail() {
    ToastManager.show("QR gagal dipindai", "error");
  }

  async verifyQRData(data) {
    // Contoh validasi sederhana
    return data && data.nama && data.id;
  }

  goToManualInput() {
    ToastManager.show("Berpindah ke input manual", "info");
    // Navigasi atau tampilkan form input kode
  }
}



class ToastManager {
  static currentToast = null;
  static hideTimeout = null;

  static show(message, type = "info", duration = 3000) {
    // Hapus toast sebelumnya jika masih ada
    this.clear();

    // Buat elemen toast baru
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = message;

    // Append ke body (belum tampil)
    document.body.appendChild(toast);
    this.currentToast = toast;

    // Trigger CSS animasi show (opacity/fade)
    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    // Set timeout untuk hide
    this.hideTimeout = setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        if (toast && toast.parentNode) {
          toast.remove();
        }
        this.currentToast = null;
        this.hideTimeout = null;
      }, 300); // waktu animasi hide
    }, duration);
  }

  static clear() {
    // Hapus timeout sebelumnya
    if (this.hideTimeout) clearTimeout(this.hideTimeout);

    // Hapus elemen toast yang masih ada
    if (this.currentToast && this.currentToast.parentNode) {
      this.currentToast.remove();
    }

    this.currentToast = null;
    this.hideTimeout = null;
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













