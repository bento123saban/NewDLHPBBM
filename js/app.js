class STATIC {
    static verifyController(data){
        
        const denied     = document.querySelector("#denied")
        const granted    = document.querySelector("#granted")
        const deniedText = document.querySelector("#denied-text")
        const grantedText= document.querySelector("#granted-text")

        if(!changeContent("verify")) return console.warn(`Verify content not found.`)
        return {
            show : () => {
                if (data.status == 'denied') {
                    denied.classList.remove("dis-none")
                    granted.classList.add("dis-none")
                    grantedText    = "..."
                    deniedText     = data.text
                } else if (data.status == "granted") {
                    denied.classList.add("dis-none")
                    granted.classList.remove("dis-none")
                    deniedText     = "..."
                    grantedText    = data.text
                }
            },
            clear : () => {
                this.changeContent('scan')
                denied.classList.add("dis-none")
                granted.classList.add("dis-none")
                grantedText    = "..."
                deniedText     = "..."
            }
        }
    }
    static changeContent(targetId) {
        const allSections = document.querySelectorAll(".content");
        allSections.forEach(el => el.classList.add("dis-none"));
        const target = document.getElementById(targetId);
        if (!target) return undefined
        target.classList.remove("dis-none");
        return true
    }
}


class TTS {
    static unlocked = false;

    static unlock() {
        if (!TTS.unlocked) {
        const dummy = new SpeechSynthesisUtterance(" ");
        window.speechSynthesis.speak(dummy);
        TTS.unlocked = true;
        }
    }

    static speak(text, onEnd) {
        TTS.unlock();

        if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "id-ID";
        utterance.pitch = 1;
        utterance.rate = 1.2;
        utterance.volume = 1;

        utterance.onend = () => typeof onEnd === "function" ? onEnd() : "";

        window.speechSynthesis.speak(utterance);
    }

    static stop() {
        return window.speechSynthesis.speaking ? window.speechSynthesis.cancel() : "";
    }
}

class QRScanner {
    constructor(onSuccess, onFailed, timeoutMs = 30000) {
        this.onSuccess  = onSuccess;
        this.onFailed   = onFailed;
        this.timeoutMs  = timeoutMs;
        this.falseCount = 0

        this.qrCodeScanner = null;
        this.timeoutCounter = Math.floor(this.timeoutMs / 1000);
        this.countdownInterval = null;

        this.isScanning = false;
        this.isRunning = false;
        this.isPaused   = false;

        // DOM
        this.regionEl = document.getElementById("qr-reader");
        this.restartBtn = document.getElementById("restart-scan-btn");
        //this.manualBtn = document.getElementById("code-manual-btn");
        this.toastEl = document.getElementById("scan-toast");
        this.counterEl = document.getElementById("cams-timeout-counter");
        this.scanGuide = document.querySelector(".scan-guide-line");

        this._bindUI();
    }

    _bindUI() {
        if (this.restartBtn) this.restartBtn.onclick = () => this.start();
        /* if (this.manualBtn) {
            this.manualBtn.onclick = () => {
                this.stop();
                if (typeof this.onFailure === "function") this.onFailure("manual-input");
            };
        } */
    }

    async start() {
        if (this.isScanning || this.isRunning || this.isVerify) return;
        if (typeof Html5Qrcode === "undefined") return this._showToast("Library QR belum dimuat : html5qrcode-not-found", "error")
        
        TTS.speak("Memulai kamera. Silakan scan QR kode Anda. Posisikan QR code di tengah kotak. Pastikan tak ada yang menghalangi")
        
        this._showToast("Memulai kamera...");
        this._showElement(this.regionEl);
        this._hideElement(this.restartBtn);
        this._showElement(this.scanGuide);
        //this._showElement(this.manualBtn);

        this.isScanning = true;
        this.timeoutCounter = Math.floor(this.timeoutMs / 1000);
        this._startCountdown();

        try {
            this.qrCodeScanner = new Html5Qrcode("qr-reader", {
                formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
            });

            const devices = await Html5Qrcode.getCameras();
            const camId = devices.find(d => d.label.toLowerCase().includes("front"))?.id || devices[0]?.id;
            if (!camId) throw new Error("Tidak ada kamera ditemukan.");
            await this.qrCodeScanner.start(
                camId, // ✅ Gunakan langsung string ID, bukan object
                {
                    fps: 50,
                    rememberLastUsedCamera: true,
                },
                (decodedText) => {
                    this.pause()
                    this._QRVerify(decodedText)
                },
                () => {console.log("x")} // Ignore decoding errors
            )
            this.isRunning = true;
        } catch (err) {
            this._showToast("Gagal membuka kamera", "error");
        }
    }

    async stop() {
        if(this.isVerify) return
        this._clearCountdown();
        this.isScanning = false;
        this.isPaused   = false;
        this.isRunning  = false;
        this.isVerify   = false;
        this.falseCount = 0

        this._hideElement(this.scanGuide);
        this._showElement(this.restartBtn);
        //this._hideElement(this.manualBtn);

        if (this.qrCodeScanner && this.isRunning) {
            try {
                await this.qrCodeScanner.stop();
                await this.qrCodeScanner.clear();
            } catch (err) {
                console.warn("QRScanner stop error:", err.message);
            }
        }

        this.qrCodeScanner = null;
        this.isRunning = false;
        this.isVerify = false
    }

    async pause() {
        if (this.qrCodeScanner && this.isScanning && !this.isPaused) {
            try {
                await this.qrCodeScanner.pause();
                this.isPaused = true;
                console.log("Scanner paused");
                this._clearCountdown()
            } catch (err) {
                console.warn("Pause gagal:", err);
            }
        }
    }

    async resume() {
        if (this.qrCodeScanner && this.isPaused) {
            try {
                await this.qrCodeScanner.resume();
                this.isPaused = false;
                console.log("Scanner resumed");
                this._startCountdown()
            } catch (err) {
                console.warn("Resume gagal:", err);
            }
        }
    }

    _QRVerify(qrText) {
        if (this.isVerify) return;
        if (qrText.length <= 10) return

        this.isVerify = true;

        const blocx = JSON.parse(localStorage.getItem("bnd-blc"))
        if  (blocx.findIndex(i => i == qrText) >= 0) {
            this.stop()
            return this.onFailed({
                status  : "denied",
                text    : 'QR Code Diblokir',
                speak   : 'QR Code telah terblokir. Hubungi admin untuk melepas blokir'
            })
        }
        
        this._showToast("Verifikasi QR", "info");

        try {
            // ⏱️ Timeout handler untuk memastikan tidak stuck
            const timeout = setTimeout(() => {
                this.isVerify = false;
                this._showToast("Timeout verifikasi QR", "error");
                console.warn("QR Verification timeout");
                return
            }, 10000); // 10 detik max proses

            // 🚫 Empty/null/undefined check
            if (!qrText || typeof qrText !== "string") return console.log("QR kosong atau bukan string.");

            // ✅ Validasi Base64 ketat (panjang kelipatan 4 dan regex)
            const base64Regex = /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/;
            if (!base64Regex.test(qrText)) return console.log("QR bukan format Base64 valid.");

            // 🔐 Decode base64 → string
            let decoded = "";
            try { decoded = atob(qrText);}
            catch (err) {return console.log("Gagal decode Base64.");}

            // 🧠 Parse JSON
            let qrData = null;
            try {qrData = JSON.parse(decoded);}
            catch (err) {throw new Error("QR bukan JSON valid.");}
            
            // 📋 Validasi struktur QR
            if (typeof qrData !== "object" || !qrData.auth || qrData.auth !== "Bendhard16") throw new Error("QR tidak memiliki otorisasi atau auth salah.");
            if (!qrData.code) throw new Error('Code tidak ditemukan atau invalid')
            
            this.onSuccess(qrData.code)
            clearTimeout(timeout);
            this.stop(); // stop QRScanner
            return console.log("QR Bendhard16")

        } catch (err) {
            console.error("❌ Error verifikasi QR:", err.message);
            this._showToast(err.message || "QR tidak valid", "error");
            this.falseCount ++
        } finally {
            if(this.falseCount === 15) return TTS.speak("QR Code diblokir. Hubungi admin untuk konfirmasi lebih lanjut.",
                () => {
                    this._blockedQR(qrText)
                    this.resume()
                    this.isVerify = false;
                }
            )
            if(this.falseCount === 5 || this.falseCount === 10) return TTS.speak("QR Code gagal di verifikasi. Posisikan dengan benar, pastikan dapat terlihat dengan jelas di Kamera. jang terlalu jau dan jangan terlalu dekat. Bersihakan kartu QR Code pastikan tidak ada noda. Jika sudah silahkan coba lagi.",
                () => {
                    this.isVerify = false;
                    this.resume()
                })
            if(this.falseCount > 15) return
            this.isVerify = false;
            this.resume()
            clearTimeout(timeout)
        }
    }

    _blockedQR(qrtext) {
        const blockedData = JSON.parse(localStorage.getItem("bnd-blc"))
        blockedData.push(qrtext)
        localStorage.setItem("bnd-blc", JSON.stringify(blockedData))
        return true
    }

    _startCountdown() {
        this._updateCountdownDisplay();
        this.countdownInterval = setInterval(() => {
            this.timeoutCounter--;
            this._updateCountdownDisplay();

            if (this.timeoutCounter <= 0) {
                clearInterval(this.countdownInterval);
                this.stop();
                this._showToast("Waktu tunggu habis - tekan <i class='fas fa-qrcode'></i>", "warning");
                TTS.speak(
                    "Waktu tunggu habis. Tekan tombol QR Code untuk memulai ulang",
                    () => {
                        TTS.speak("Waktu tunggu habis. Tekan tombol QR Code untuk memulai ulang")
                        this._showToast("Waktu tunggu habis - tekan <i class='fas fa-qrcode'></i>", "warning")
                    }
                )
            }
        }, 1000);
    }

    _clearCountdown() {
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        if (this.counterEl) this.counterEl.innerText = "";
    }

    _updateCountdownDisplay() {
        if (this.counterEl) this.counterEl.innerText = `${this.timeoutCounter}s`;
    }

    _showToast(msg, type = "info") {
        if (!this.toastEl) return;
        this.toastEl.className = `camera-toast p-5 show ${type}`;
        this.toastEl.innerHTML = msg;
        setTimeout(() => {
            this.toastEl.classList.remove("show");
        }, 3000);
    }

    _showElement(el) {
        if (!el) return;
        el.classList.remove("hidden", "dis-none");
    }

    _hideElement(el) {
        if (!el) return;
        el.classList.add("dis-none");
    }
}

class AppController {
    constructor() {
        this.connection = true
        this.qrScanner  = new QRScanner(this._handleQRSuccess.bind(this), this._handleQRFailed.bind(this), 15000);
        this.reqManage  = new RequestManager()
        this.face       = new FaceRecognizer("", "")
    }

    _bindElement () {
    }

    start() {
        this.changeContent("face");
        this.qrScanner.start();
        
        window.addEventListener('offline', () => {
            if (this.reqManage.online = true) RequestManager._connection(false)
            this.reqManage.online = false
        })
        window.addEventListener('online', () => {
            if (this.reqManage.online = false) RequestManager._connection(true)
            this.reqManage.online = true
        })
        /*window.addEventListener('online', async () => {
            const online = async () => {
                    try {
                        // Ping ke Google favicon atau endpoint server kamu
                        const response = await fetch("https://www.google.com/favicon.ico", {
                            method  : "HEAD",
                            mode    : "no-cors",
                            cache   : "no-store"
                        });
                        // Kalau berhasil sampai sini, artinya request bisa jalan
                        return true;
                    } catch (error) {
                        // Kalau error (gagal koneksi), berarti offline
                        return false;
                    }
                }
            if (await online()) {
                if (this.reqManage.online = false) RequestManager._connection(true)
                this.reqManage.online = true
            }
            else this.reqManage.online = false
        })*/
    }

    stop() {
        this.qrScanner.stop();
    }

    _handleQRSuccess(code) {
       
    }
    
    _handleQRFailed(data) {
        const verify = STATIC.verifyController({status : data.status, text : data.text})
        verify.show()
        TTS.speak(data.speak, verify.clear())
    }

    
    
}

class RequestManager {
    constructor() {
        this.maxRetries = 5;
        this.retryDelay = 1000
        this.apiURL     = "https://script.google.com/macros/s/AKfycbzS1dSps41xcQ8Utf2IS0CgHg06wgkk5Pbh-NwXx2i41fdEZr1eFUOJZ3QaaFeCAM04IA/exec";
        this.baseURL    = "https://bbmctrl.dlhpambon2025.workers.dev?url=" + encodeURIComponent(this.apiURL);
        this.online     = null
        this.networkBox = document.querySelector('#network')
    }
    
    static _connection(state = true) {
        this.networkBox?.classList.toggle('dis-none', state);
    }
    
    static async getDriver(code) {
        const url = this.baseURL
        if (!navigator.onLine) return
    }

    async post(data = {}) {
        if (!navigator.onLine) {
            this._log("🔌 Offline: Tidak bisa kirim request.");
            this._showToast("Tidak ada koneksi internet. Coba lagi nanti.");
            return { success: false, error: "offline" };
        }

        let attempt = 0;
        while (attempt < this.maxRetries) {
            try {
                const response  = await fetch(this.baseURL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(data),
                }),
                    result      = await response.json();
                if (response.ok) {
                    this._log(`✅ POST sukses [${url}]`, result);
                    return { success: true, data: result };
                } else {
                    this._log(`❌ Gagal (Status ${response.status})`, result);
                    return { success: false, error: result };
                }
            } catch (err) {
                attempt++;
                this._log(`⚠️ POST error (Attempt ${attempt}/${this.maxRetries})`, err);
                if (attempt >= this.maxRetries) {
                this._showToast("Request gagal setelah beberapa kali mencoba.");
                return { success: false, error: err.message || err };
                }
                await this._delay(this.retryDelay);
            }
        }
    }

    // Delay helper
    _delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // Log helper (nanti bisa dikirim ke panel debug log juga)
    _log(...args) {
        if (window.DEBUG_MODE) console.log("[RequestManager]", ...args);
    }

    // Toast helper (bisa integrasi ke ToastManager nanti)
    _showToast(message) {
        if (typeof ToastManager !== "undefined") {
        ToastManager.show(message, "error");
        } else {
        console.warn("ToastManager tidak tersedia:", message);
        }
    }
}

class FaceRecognizer {
  constructor(targetFaceBase64, onSuccess, onFailure, maxAttempts = 5) {
    this.video = document.getElementById("face-video");
    this.targetFaceBase64 = targetFaceBase64;
    this.onSuccess = onSuccess;
    this.onFailure = onFailure;
    this.maxAttempts = maxAttempts;

    this.human = null;
    this.attempts = 0;
    this.ready = false;
    this.active = false;
    this.stream = null;
  }

  async start() {
    try {
      this.attempts = 0;
      this.active = true;
      this.human = new Human({
        cacheSensitivity: 0.95,
        filter: { enabled: true },
        face: {
          enabled: true,
          detector: { maxDetected: 1 },
          mesh: false,
          iris: false,
          emotion: false,
        },
      });

      await this._retryUntilReady();
      await this._startCamera();
      this._detectLoop();
      
    } catch (err) {
      this._fail(`Gagal start: ${err.message}`);
    }
  }

  async _retryUntilReady(retries = 5) {
    let count = 0;
    while (!this.ready && count < retries) {
      try {
        await this.human.load();
        await this.human.warmup();
        this.ready = true;
      } catch (err) {
        console.warn("Retry load Human.js", count + 1, err.message);
        await this._delay(1000);
        count++;
      }
    }
    if (!this.ready) throw new Error("Human.js gagal ready");
  }

  async _startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera tidak tersedia");

    const constraints = {
      video: { facingMode: "user", width: 640, height: 480 },
      audio: false,
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.video.srcObject = this.stream;

    await this.video.play();
  }

  async _detectLoop() {
    if (!this.active) return;
    try {
      const result = await this.human.detect(this.video);
      if (result?.face?.length > 0) {
        const face = result.face[0];
        if (face.score < 0.7 || face.boxScore < 0.7) {
          // Skip wajah blur
          return requestAnimationFrame(this._detectLoop.bind(this));
        }

        const matchScore = await this._compareWithTarget(face.embedding);
        if (matchScore >= 0.9) {
          this._succeed();
          return;
        }
      }

      this.attempts++;
      if (this.attempts >= this.maxAttempts) {
        this._fail("Wajah tidak cocok setelah 5x");
        return;
      }

    } catch (err) {
      console.error("Error saat face detection:", err.message);
    }

    requestAnimationFrame(this._detectLoop.bind(this));
  }

  async _compareWithTarget(liveEmbedding) {
    const targetImg = await this._base64ToImage(this.targetFaceBase64);
    const targetResult = await this.human.detect(targetImg);
    const targetFace = targetResult.face?.[0];
    if (!targetFace?.embedding) throw new Error("Wajah target tidak valid");

    return this.human.similarity(liveEmbedding, targetFace.embedding);
  }

  async _base64ToImage(base64) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error("Gagal load gambar target"));
      img.src = base64;
    });
  }

  stop() {
    this.active = false;
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    this.video.pause();
    this.video.srcObject = null;
  }

  _succeed() {
    this.stop();
    if (this.onSuccess) this.onSuccess();
  }

  _fail(msg) {
    this.stop();
    if (this.onFailure) this.onFailure(msg);
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}








window.addEventListener("DOMContentLoaded", () => { 
    let ttsUnlocked = false;
    console.log(btoa(JSON.stringify({
        auth : "Bendhard16",
        code : btoa("A-001")
    })))
    document.querySelector("#start").onclick = () => {
        console.log("Start button clicked");
        if (!ttsUnlocked) {
            const dummy = new SpeechSynthesisUtterance(" ");
            window.speechSynthesis.speak(dummy);
            ttsUnlocked = true;
            return console.log("TTS unlocked");
        }
        const qrScanner = new FaceRecognizer().start();
    }
    console.log(JSON.parse(atob("eyJhdXRoIjoiQmVuZGhhcmQxNiIsImNvZGUiOiJRUzB3TURFPSJ9")))
});

