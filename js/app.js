class QRScanner {
  constructor(regionId, onSuccess, onFailure, timeoutMs = 5000) {
    this.regionId = regionId;
    this.onSuccess = onSuccess;
    this.onFailure = onFailure;
    this.timeoutMs = timeoutMs;
    this.qrCodeScanner = null;
    this.qrTimeout = null;
    this.scanning = false;
  }

  async start() {
    try {
      const region = document.getElementById(this.regionId);
      if (!region || region.offsetParent === null) {
        console.warn("QRScanner: Region tidak terlihat, batal start.");
        return;
      }

      if (this.qrCodeScanner) {
        await this.qrCodeScanner.clear();
        this.qrCodeScanner = null;
      }

      this.qrCodeScanner = new Html5Qrcode(this.regionId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
      });

      this.scanning = true;
      ToastManager.show("Membuka kamera...", "info");

      await this.qrCodeScanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox:undefined
        },
        (decodedText) => {
          if (!this.scanning) return;
          this.stop();
          this.onSuccess(decodedText);
        },
        (errorMessage) => {
          // bisa diabaikan atau log
        }
      );

      // Timeout
      this.qrTimeout = setTimeout(() => {
        if (!this.scanning) return;
        this.stop();
        ToastManager.show("Waktu habis. Silakan ulangi.", "warning");
        document.getElementById("restart-scan-btn")?.classList.remove("dis-none");
        this.onFailure("timeout");
      }, this.timeoutMs);
    } catch (err) {
      console.error("QRScanner: Gagal inisialisasi kamera", err);
      ToastManager.show("Gagal membuka kamera", "error");
      this.onFailure("error");
    }
  }

  async stop() {
    try {
      this.scanning = false;
      if (this.qrTimeout) {
        clearTimeout(this.qrTimeout);
        this.qrTimeout = null;
      }
      if (this.qrCodeScanner) {
        await this.qrCodeScanner.stop();
        await this.qrCodeScanner.clear();
        this.qrCodeScanner = null;
      }
    } catch (err) {
      console.warn("QRScanner: Error saat stop", err);
    }
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
class ToastManager {
  static show(message = "", duration = 3000, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerText = message;

    // Styling cepat
    toast.style.position = "fixed";
    toast.style.bottom = "30px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.background = type === "error" ? "#f44336"
                      : type === "success" ? "#4caf50"
                      : type === "warning" ? "#ff9800"
                      : "#333";
    toast.style.color = "#fff";
    toast.style.padding = "12px 20px";
    toast.style.borderRadius = "8px";
    toast.style.zIndex = 9999;
    toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s ease";

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.style.opacity = "1";
    }, 10);

    // Animate out & remove
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, duration);
  }
}


class AppController {
  constructor(serverUrl = "", enableOffline = false) {
    this.serverUrl = serverUrl;
    this.state = null;
    this.retryLimit = 3;
    this.retryCount = 0;

    this.qrScanner = new QRScanner("qr-reader", this.handleQRScan.bind(this), this.handleQRFail.bind(this));
    this.faceRecognizer = new FaceRecognizer("video", "canvas");
    this.request = new RequestManager(enableOffline);
    //ToastManager.show= new ToastManager().init()
    this.init();
  }

  init() {
    document.getElementById("restart-scan-btn").addEventListener("click", () => {
      const btn = document.getElementById("restart-scan-btn");
      if (btn) btn.classList.add("hidden");
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
      const inner = document.getElementById("camera-content");
      inner && inner.classList.remove("hidden");
      this.qrScanner.start();
    } else {
      this.qrScanner.stop();
      this.faceRecognizer.stop();
    }
  }

  async handleQRScan(data) {
    console.log("QR success:", data);
    ToastManager.show("QR berhasil, memuat...", "success");

    try {
      const response = await this.request.get(`${this.serverUrl}/get-data?qr=${encodeURIComponent(data)}`);
      const userData = response.data;

      if (userData && userData.faceImage) {
        this.qrScanner.stop();
        this.faceRecognizer.start(userData.faceImage, () => {
          ToastManager.show("Wajah cocok!", "success");
          // bisa redirect, atau tampilkan halaman success
        }, () => {
          ToastManager.show("Wajah tidak cocok", "error");
        });

        this.changeContent("face");
      } else {
        ToastManager.show("Data tidak ditemukan", "error");
      }
    } catch (err) {
      console.error("Request error:", err);
      ToastManager.show("Gagal ambil data", "error");
    }
  }

  handleQRFail(reason) {
    return
    console.warn("QR gagal:", reason);
    ToastManager.show("QR gagal dibaca", "error");

    this.retryCount++;
    if (this.retryCount < this.retryLimit) {
      setTimeout(() => this.qrScanner.start(), 1500);
    } else {
      this.retryCount = 0;
      ToastManager.show("Silakan coba ulang", "warning");
    }
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













