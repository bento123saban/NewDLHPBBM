

class AppController {
    constructor() {
        this.connection = true
        this.qrScanner  = new QRScanner(this._handleQRSuccess.bind(this), this._handleQRFailed.bind(this), 15000);
        this.reqManage  = new RequestManager("", "")
        this.face       = new FaceRecognizer(() => {
                TTS.speak("MANTAP.")
            }, () => {
                //TTS.speak("Gagal verifikasi wajah. Silakan coba lagi.")

            })
    }

    _bindElement () {
    }

    start() {
        STATIC.changeContent("face");
        this.face.start();
        
        window.addEventListener('offline', () => {
            if (this.reqManage.online = true) STATIC._connection(false)
            this.reqManage.online = false
        })
        window.addEventListener('online', async () => {
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
                if (this.reqManage.online = false) STATIC._connection(true)
                this.reqManage.online = true
            }
            else this.reqManage.online = false
        })
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

class QRScanner {
    constructor(onSuccess, onFailed, timeoutMs = 30000) {
        this.onSuccess          = onSuccess;
        this.onFailed           = onFailed;
        this.timeoutMs          = timeoutMs;
        this.falseCount         = 0

        this.qrCodeScanner      = null;
        this.timeoutCounter     = Math.floor(this.timeoutMs / 1000);
        this.countdownInterval  = null;

        this.isScanning         = false;
        this.isRunning          = false;
        this.isPaused           = false;
        this.hasStarted         = false;
        this.isVerify           = false;

        this.regionEl           = document.getElementById("qr-reader");
        this.restartBtn         = document.getElementById("restart-scan-btn");
        this.counterEl          = document.getElementById("cams-timeout-counter");
        this.scanGuide          = document.querySelector(".scan-guide-line");

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
        if (typeof Html5Qrcode === "undefined") return STATIC.toast("Library QR belum dimuat : html5qrcode-not-found", "error")
        
        TTS.speak("Memulai kamera. Silakan scan QR kode Anda. Posisikan QR code di tengah kotak. Pastikan tak ada yang menghalangi")
        
        STATIC.toast("Memulai kamera...", "info");
        this._showElement(this.regionEl);
        this._hideElement(this.restartBtn);
        this._showElement(this.scanGuide);
        //this._showElement(this.manualBtn);

        this.isScanning = true;
        this.timeoutCounter = Math.floor(this.timeoutMs / 1000);

        try {
            this.qrCodeScanner = new Html5Qrcode("qr-reader", {
                formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
            });

            const devices = await Html5Qrcode.getCameras();
            const camId = devices.find(d => d.label.toLowerCase().includes("front"))?.id || devices[0]?.id;
            if (!camId) throw new Error("Tidak ada kamera ditemukan.");
            
            this.isRunning = true
            this._startCountdown();
            
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
                () => {
                    this.isVerify = false;
                    //console.log(this.isVerify, "QRScanner is running")
                } // Ignore decoding errors
            )
            this.hasStarted = true;
        } catch (err) {
            STATIC.toast("Gagal membuka kamera", "error");
            this.isRunning = false;
            this.stop();
            console.error("QRScanner start error:", err.message);
        }
    }

    async stop() {
        if(this.isVerify) return

        this._clearCountdown();

        this._hideElement(this.scanGuide);
        if(this.hasStarted) this._showElement(this.restartBtn);

        if (this.qrCodeScanner) {
            try {
                await this.qrCodeScanner.stop();
                await this.qrCodeScanner.clear();
            } catch (err) {
                console.warn("QRScanner stop error:", err.message);
            }
        }

        this.qrCodeScanner  = null;
        this.isRunning      = false;
        this.isVerify       = false
        this.hasStarted     = false;
        this.isScanning     = false;
        this.isPaused       = false;
        this.isVerify       = false;
        this.falseCount     = 0
    }

    async pause() {
        if (this.qrCodeScanner && this.isScanning && !this.isPaused) {
            try {
                await this.qrCodeScanner.pause();
                this.isPaused = true;
                this._clearCountdown()
                console.log("Scanner paused");
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
        if (this.isVerify || !qrText || qrText.length <= 10) return;

        this.isVerify = true;

        const blockedQR = JSON.parse(localStorage.getItem("bnd-blc"))
        if  (blockedQR.includes(qrText)) {
            this.stop()
            return this.onFailed({
                status  : "denied",
                text    : 'QR Code Diblokir',
                speak   : 'QR Code telah terblokir. Hubungi admin untuk melepas blokir'
            })
        }
        
        STATIC.toast("Verifikasi QR", "info");

        let timeout = null;

        try {
            // ⏱️ Timeout handler untuk memastikan tidak stuck
            timeout = setTimeout(() => {
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
            STATIC.toast(err.message || "QR tidak valid", "error");
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
        const blockedData = JSON.parse(localStorage.getItem("bnd-blc") || "[]");
        if (blockedData.includes(qrtext)) return console.warn("QR Code sudah diblokir sebelumnya:", qrtext);
        blockedData.push(qrtext)
        localStorage.setItem("bnd-blc", JSON.stringify(blockedData))
        //return true
    }

    _startCountdown() {
        this._updateCountdownDisplay();
        if (this.countdownInterval) clearInterval(this.countdownInterval);

        this.countdownInterval = setInterval(() => {
            this.timeoutCounter--;
            this._updateCountdownDisplay();

            if (this.timeoutCounter <= 0) {
                clearInterval(this.countdownInterval);
                this.stop();
                STATIC.toast("Waktu tunggu habis - tekan <i class='fas fa-qrcode'></i>", "warning");
                TTS.speak(
                    "Waktu tunggu habis. Tekan tombol QR Code untuk memulai ulang",
                    () => {
                        TTS.speak("Waktu tunggu habis. Tekan tombol QR Code untuk memulai ulang")
                        STATIC.toast("Waktu tunggu habis - tekan <i class='fas fa-qrcode'></i>", "warning")
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

    _showElement(el) {
        if (!el) return;
        el.classList.remove("hidden", "dis-none");
    }

    _hideElement(el) {
        if (!el) return;
        el.classList.add("dis-none");
    }
}

class STATIC {
    static verifyController(data){
        const denied     = document.querySelector("#denied")
        const granted    = document.querySelector("#granted")
        const deniedText = document.querySelector("#denied-text")
        const grantedText= document.querySelector("#granted-text")

        if(!STATIC.changeContent("verify")) return console.warn(`Verify content not found.`)
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
                STATIC.changeContent('scan')
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
    static toast(msg, type = "info") {
        const toastEl = document.getElementById("toast");
        if (!toastEl) return console.warn("Toast element not found");
        toastEl.className = `show ${type}`;
        toastEl.innerHTML = msg;
        setTimeout(() => {
            toastEl.classList.remove(`show`, `${type}`);
        }, 3000);
    }
    static delay (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    static _connection(state = true) {
        document.querySelector('#network')?.classList.toggle('dis-none', state);
    }
    static loader(speak = '', text = 'Sending Request') {
        return {
            run : () => {
                TTS.speak(speak)
                document.querySelector("#loader").classList.remove('dis-none')
                document.querySelector('#loader-text').textContent = text
            },
            stop : () => {
                document.querySelector("#loader").classList.add('dis-none')
                document.querySelector('#loader-text').textContent = ''
                TTS.stop()
            }
        }
    }
}

class TTS {
    static unlocked = false;

    static unlock() {
        if (TTS.unlocked) return 
        const dummy = new SpeechSynthesisUtterance(" ");
        window.speechSynthesis.speak(dummy);
        TTS.unlocked = true;
    }

    static speak(text, onEnd) {
        TTS.unlock();

        if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();

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

class RequestManager {
    constructor() {
        this.maxRetries = 5;
        this.retryDelay = 1000
        this.apiURL     = "https://script.google.com/macros/s/AKfycbzS1dSps41xcQ8Utf2IS0CgHg06wgkk5Pbh-NwXx2i41fdEZr1eFUOJZ3QaaFeCAM04IA/exec";
        this.baseURL    = "https://bbmctrl.dlhpambon2025.workers.dev?url=" + encodeURIComponent(this.apiURL);
        this.online     = null
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
    constructor(onSuccess = "", onFailure = "") {
        this.videoElement   = document.querySelector("#face-video");
        this.previewBox     = document.querySelector('#face-prev-box');
        this.previewer      = document.querySelector('#face-preview');
        this.captureBtn     = document.querySelector("#capture-face");
        this.targetImage    = document.querySelector("#compare-photo");
        this.onSuccess      = onSuccess;
        this.onFailure      = onFailure;
    }

    async start() {
        this.targetEmbedd   = null;
        this.targetReady    = false;
        this.human          = null;
        this._isRunning     = false;
        this._stream        = null;
        this.modelLoaded    = false;
        this.humanReady     = false;
        this.cameraReady    = false;
        this.setupRetry     = 0;
        this.verifyRetry    = 0;
        this.captureRetry   = 0

        await this._init();
    }

    async _init() {
        try {
            const HumanLib = window.Human?.Human || window.Human;
            if (!HumanLib) throw new Error("Human.js belum dimuat");
        
            this.human = new HumanLib({
                backend: 'webgl',
                modelBasePath: './models/',
                cacheSensitivity: 0.9,
                warmup: "face",
                async: true,
                filter: { enabled: true },
                face: {
                    enabled: true,
                    detector: { enabled: true, maxDetected: 1 },
                    mesh: false,
                    iris: false,
                    emotion: false,
                    description: {enabled : true },
                    embedding: {enabled : true }
                },
            });

            this.captureBtn.classList.add('dis-none');
            this.captureBtn.onclick = () => {};

            await this.human.load();
            this.modelLoaded = true
            await this.human.warmup();
            this.humanReady = true
            await this.loadTargetEmbedd()
            await this._setupCamera();

            if(this.readyState()) {
                this.captureBtn.classList.remove('dis-none');
                TTS.speak("Kamera siap. Silakan posisikan wajah Anda di dalam garis bantu.", () => {
                    STATIC.toast("Kamera siap. Silakan posisikan wajah Anda di dalam garis bantu.", "info")
                    TTS.speak("Tekan tombol untuk mengambil gambar.")
                    this.captureBtn.onclick = () => this._startCountdown(() => this.captureAndVerify());
                })
            } else {
                if(this.setupRetry >= 3) return typeof this.onFailure === "function" && this.onFailure({
                    status : "init failed",
                    text   : "Gagal inisiasi Face Verify setelah 3 kali percobaan"
                });
                setTimeout(() => this._init(), 1000)
                return this.setupRetry ++
            }

        } catch (err) {
            this._log("Init error: " + err.message);
            return typeof this.onFailure === "function" && this.onFailure({
                status : "init failed",
                text   : "Error inisiasi Face Verify."
            });
        }
    }

    readyState () {
        let text    = "",
            param   = true

        if (!this.human) {
            text += "Human JS tidak tersedia. "
            param = false
        } else if (!this.modelLoaded) {
            text += "Model belum dimuat. "
            param = false
        } else if (!this.humanReady) {
            text += "HUman JS belum siap. "
            param = false
        } else if (!this.cameraReady) {
            text += "Kamera gagal dimuat. "
            param = false
        } else if (!this.targetReady) {
            text += "Gagal inisiasi foto target. "
            param = false
        }
        this._log("readyState - " + param )
        if(text == "") return param
        TTS.speak(text)
        this._log(text)
        STATIC.toast(text)
        return param
    }

    async loadTargetEmbedd() {
        if (!this.targetImage || !this.human) {
            this._log("Target image atau Human belum siap");
            return this.targetReady = false;
        }

        try {
            const result = await this.human.detect(this.targetImage);
            if (!result.face || result.face.length === 0) {
                this._log("Tidak ditemukan wajah pada foto target");
                return this.targetReady = false;;
            }

            const face = result.face[0];
            if (!face.embedding || face.embedding.length === 0) {
                this._log("Embedding target kosong");
                return this.targetReady = false;;
            }

            this.targetEmbedd = face.embedding;
            this._log("Target embedding berhasil dimuat");
            return this.targetReady = true;

        } catch (err) {
            this._log("Gagal mengambil embedding target: " + err.message);
            return this.targetReady = false;;
        }
    }

    async _setupCamera() {
        this._log("Memulai setup kamera depan...");
        try {
            const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
            if (!hasMediaDevices) {
                this.cameraReady = false
                throw new Error("Perangkat tidak mendukung kamera.");
            }
    
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user" },
                audio: false
            }).catch(err => {
                this.cameraReady = false
                throw new Error("Akses kamera ditolak atau tidak tersedia: " + err.message);
            });
    
            if (!stream) {
                this.cameraReady = false;
                throw new Error("Stream kamera tidak tersedia.");
            }
    
            this._stream = stream;
            this.videoElement.srcObject = stream;
    
            await this.videoElement.play().catch(err => {
                this.cameraReady = false
                throw new Error("Gagal memutar video kamera: " + err.message);
            });

            if (!this.videoElement || this.videoElement.readyState < 3) {
                this.cameraReady = false
                throw new Error("Kamera belum siap, mohon tunggu sebentar.");
            }
            
            this._log("Kamera depan ready...");
            return this.cameraReady = true;
        } catch (err) {
            this._log("Setup kamera gagal: " + err.message);
            STATIC.toast("Kamera gagal dinyalakan: " + err.message, 'error');            
            return this.cameraReady = false;
        }
    }

    _startCountdown(callback) {
        TTS.stop()
        let counter         = 3;
        const overlay       = document.createElement("div");
        overlay.className   = "countdown-overlay";
        overlay.textContent = counter;
        document.body.appendChild(overlay);
        this.captureBtn.classList.add('dis-none');

        const interval = setInterval(() => {
            counter--;
            if( counter > 0) return overlay.textContent = counter;
            clearInterval(interval);
            overlay.remove();
            callback();
        }, 1000);
    }

    captureAndVerify() {
        try {
            const canvas    = document.createElement("canvas"),
                context     = canvas.getContext("2d", { willReadFrequently: true }),
                video       = this.videoElement

            canvas.width    = video.videoWidth;
            canvas.height   = video.videoHeight;

            if (!canvas.width || !canvas.height) return TTS.speak("Gagal mengambil gambar dari kamera. Silahkan ulangi", () => {
                this.previewBox.classList.add('dis-none');
                this.captureBtn.classList.remove('dis-none');
                STATIC.toast("Gagal mengambil gambar dari kamera. Silahkan ulangi", "error");
            });

            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

            const isBlur = this.isImageBlurred(imageData);
            if (isBlur) return TTS.speak("Gambar buram, silakan ulangi", () => {
                this.previewBox.classList.add('dis-none');
                this.captureBtn.classList.remove('dis-none');
                STATIC.toast("Gambar buram, silakan ulangi", "error");
            });
            
            // Tampilkan preview
            this.previewer.src = canvas.toDataURL("image/jpeg");
            this.previewBox.classList.remove('dis-none');
            TTS.speak("Silakan menunggu, sedang verifikasi wajah", () => {
                return this.verifyFace(imageData);
            });
        } catch (error) {
            if (this.captureRetry >= 3) return typeof this.onFailure === "function" && this.onFailure({
                status : "capture failed",
                text   : "Gagal capture face setelah 3 kali percobaan"
            });
            return TTS.speak("Terjadi kesalahan saat mengambil gambar. Silahkan Coba lagi.", () => {
                this.previewBox.classList.add('dis-none');
                STATIC.toast("Terjadi kesalahan saat mengambil gambar", "error");
                console.error("[FaceRecognizer] Error saat capture:", error);
                this.captureRetry ++
            });
        }
    }

    cosineSimilarity(a, b) {
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    verifyFace(imageData) {
        try {

            if(this.verifyRetry >= 3) return TTS.speak("Gagal Verifikasi Wajah setelah 3 kali percobaan", () => {
                STATIC.toast("[verifyFace] : Wajah tidak cocok", "error")
            })

            this.human.detect(imageData).then(result => {
                console.log("[FaceRecognizer] Hasil deteksi:", result);

                if (!result.face || result.face.length === 0) {
                    STATIC.toast("Wajah tidak terdeteksi", "error");
                    TTS.speak("Wajah tidak terdeteksi", () => {
                        this.previewBox.classList.add("dis-none");
                    });
                    return;
                }

                const detected = result.face[0];
                if (!detected.embedding || detected.embedding.length === 0) {
                    console.warn("Embedding tidak valid:", detected.embedding);
                    STATIC.toast("Data wajah tidak valid", "error");
                    TTS.speak("Data wajah tidak valid", () => {
                        setTimeout(() => this.previewBox.classList.add("dis-none"), 500);
                    });
                    return;
                }

                const distance = this.cosineSimilarity(detected.embedding, this.targetEmbedd);
                this._log("Distance antara wajah: " + distance);
                //const similarity = 1 - distance; // Ubah jarak ke kesamaan (0-1)

                if (distance >= 0.75) {
                    STATIC.toast("Wajah cocok ✅", "success");
                    TTS.speak("Verifikasi wajah berhasil", () => {
                        if (typeof this.onSuccess === "function") this.onSuccess();
                    });
                } else {
                    this.verifyRetry ++
                    STATIC.toast("Wajah tidak cocok", "error");
                    TTS.speak("Wajah tidak cocok", () => {
                        if (typeof this.onFailure === "function") this.onFailure();
                    });
                }
            }).catch(err => {
                this.verifyRetry ++
                console.error("[FaceRecognizer] Gagal deteksi:", err);
                STATIC.toast("Terjadi kesalahan saat verifikasi wajah", "error");
                TTS.speak("Terjadi kesalahan saat verifikasi wajah", () => {
                    this.previewBox.classList.add("dis-none");
                });
            });

        } catch (error) {
            console.error("[FaceRecognizer] Fatal error di verifyFace:", error);
            STATIC.toast("Terjadi kesalahan saat verifikasi wajah", "error");
            TTS.speak("Terjadi kesalahan saat verifikasi wajah", () => {
                this.previewBox.classList.add("dis-none");
            });
        }
    }

    isImageBlurred(imageData) {
          // Konversi grayscale
        const gray = [];
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            gray.push(brightness);
        }

        // Hitung gradient (laplacian kasar)
        let sum = 0, sumSq = 0, count = 0;
        const width = imageData.width;
        const height = imageData.height;
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const center = gray[y * width + x];
                const laplacian = -gray[(y - 1) * width + x] - gray[(y + 1) * width + x] - gray[y * width + (x - 1)] - gray[y * width + (x + 1)] + 4 * center;

                sum += laplacian;
                sumSq += laplacian * laplacian;
                count++;
            }
        }

        const mean = sum / count;
        const variance = (sumSq / count) - (mean * mean);

        return variance < 20; // Threshold bisa disesuaikan
    }


    async stop() {
        try {
            if (this.human) {
            // Stop semua proses Human.js (misalnya face detection, body tracking, dll)
            this.human.stop(); // stop inference loop

            // Hentikan stream kamera
            if (this.videoElement && this.videoElement.srcObject) {
                const tracks = this.videoElement.srcObject.getTracks();
                tracks.forEach(track => track.stop());
                this.videoElement.srcObject = null;
            }

            // Clear canvas preview atau apapun yang sedang ditampilkan
            const canvas = document.querySelector("canvas");
            if (canvas) canvas.remove();

            // Optional: buang instance kalau ingin benar-benar terminate
            this.human = null;

            console.log("🛑 Human.js terminated cleanly.");
            }
        } catch (err) {
            console.error("❌ Gagal stop Human.js:", err);
        }
    }

    _log(msg) {console.log("[FaceRecognizer]", msg);}
    
        
}













window.addEventListener("DOMContentLoaded", () => { 
    const videos = document.querySelectorAll("video");
    videos.forEach(video => {
        const stream = video.srcObject;
        if (stream && stream.getTracks) {
            stream.getTracks().forEach(track => {
                if (track.readyState === "live") track.stop();
            });
            video.srcObject = null;
        }
    });
    
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
        const qrScanner = new AppController().start();
    }
    console.log(JSON.parse(atob("eyJhdXRoIjoiQmVuZGhhcmQxNiIsImNvZGUiOiJRUzB3TURFPSJ9")))
});

window.addEventListener('beforeunload', () => {
    const videos = document.querySelectorAll("video");
    videos.forEach(video => {
        const stream = video.srcObject;
        if (stream && stream.getTracks) {
            stream.getTracks().forEach(track => {
                if (track.readyState === "live") track.stop();
            });
            video.srcObject = null;
        }
    });
})