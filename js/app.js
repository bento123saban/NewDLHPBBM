
class AppController {
    constructor() {
        this.connect    = new connection(this);
        this.request    = new RequestManager(this);
        this.qrScanner  = new QRScanner(this, this._handleQRSuccess.bind(this), this._handleQRFailed.bind(this));
        this.face       = new FaceRecognizer(this, this._handleFaceSuccess.bind(this), this._handleFaceFailed.bind(this));
        this.DB         = new IndexedDBController();
        this.isStarting = true
        this.startAll   = false;
        this.baseURL    = "https://bbmctrl.dlhpambon2025.workers.dev?";
    }
    async _init () {
        this.isStarting = true
        try {
            STATIC.loaderRun("... Bendhard16 ...");
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
            
            await STATIC.delay(1500, async () => { await this.face._init()})
            await STATIC.delay(500, async () => { await this.connect.start()})
            /* await this.DB.init({
                drivers : {
                    options : {keyPath : 'ID'},
                    indexes : [
                            { keyPath : 'NAMA',     unique : true}, // basic
                            { keyPath : 'NOLAMBUNG',unique : true}, // basic
                            { keyPath : 'BIDANG'} , // basic
                            { keyPath : 'CODE'}, // basic
                            { keyPath : 'LITER'} // basic
                        ]
                },
                trx : {
                    options : { keyPath : 'TRXID'},
                    indexes : [
                            { keyPath : 'TRXID',    unique : true}, // basic
                            { keyPath : 'BIDANG'}, // basic
                            { keyPath : 'DATE'} // basic
                        ]
                },
                config : {
                    options : { keyPath : 'TYPE'},
                    indexes : [
                            { keyPath : 'TYPE'}
                        ]
                }
            }); */
            
            STATIC.delay(500, async() => {
                STATIC.loaderStop(() => {
                    STATIC.isOnlineUI(async () => {
                        await STATIC.delay(3000, () => {
                            document.querySelector("#network").classList.add("dis-none")
                            document.querySelector("#network i").className = ""
                            STATIC.changeContent("home")
                        })
                    })
                })
                this.connect.pause()
                this.isStarting = false
            })

            let ttsUnlocked = false;
            document.querySelector("#start").onclick = () => {
                if (this.begin) return
                if (ttsUnlocked) {
                    this.begin = true
                    return this.start()
                }
                const dummy = new SpeechSynthesisUtterance(" ");
                window.speechSynthesis.speak(dummy);
                ttsUnlocked = true;
            }
        } catch (err) {
            console.error("Error in AppController init:", err);
            STATIC.toast("Gagal memulai aplikasi: " + err.message, "error");
            this.isStarting = false
        }
    }
    async start() {
        this.startAll = true
        //STATIC.changeContent("scan")
        //await this.qrScanner.start()
        await this.qrScanner._requestData("A-001");
    }
    stop() {
        this.qrScanner.stop();
        this.face.stop()
        this.connect.pause()
    }
    _handleFaceSuccess() {
        
    }
    _handleFaceFailed(data) {
        STATIC.verifyController({
            status      : "denied",
            head        : data.head,
            text        : data.text,
            callback    : data.callback
        })
    }
    async _handleQRSuccess(param) {
        const data = param.data
        console.log("QR Success : ", data)
        STATIC.loaderRun("Write Data")
        document.querySelector("img#compare-photo").src         = "./driver/" + data.PATH
        document.querySelector("#nama-driver").textContent      = data.NAMA
        document.querySelector("#nopol-driver").textContent     = data.NOPOL
        document.querySelector("#nolambung-driver").textContent = data.NOLAMBUNG
        document.querySelector("#kendaraan-driver").textContent = data.KENDARAAN
        document.querySelector("#data-confirm").classList.remove('dis-none')
        document.querySelector("#face-guide-line").classList.add('dis-none')
        document.querySelector("#face-vid-box").classList.add('dis-none')
        await STATIC.delay(2500, () => {
            STATIC.loaderStop()
            STATIC.changeContent('face')
        })
        document.querySelector("#data-confirm").onclick         = ()=> {
            document.querySelector("#data-confirm").classList.add('dis-none')
            document.querySelector("#face-guide-line").classList.remove('dis-none')
            document.querySelector("#face-vid-box").classList.remove('dis-none')
            document.querySelector("#data-driver").classList.add("shrink")
            this.face.start()
        }
    }
    _handleQRFailed(data) {
        console.log("QR Failed")
        const verify = STATIC.verifyController({
            status  : "denied",
            head    : data.head,
            text    : data.text
        })
        verify.show(() => STATIC.delay(10000, () => {
            verify.clear("scan")
            this.qrScanner.start()
        }))
    }
}

class connection {
    constructor(main) {
        this.appCTRL    = main
        this.apiURL     = "https://script.google.com/macros/s/AKfycbzS1dSps41xcQ8Utf2IS0CgHg06wgkk5Pbh-NwXx2i41fdEZr1eFUOJZ3QaaFeCAM04IA/exec";
        this.url        = "https://bbmctrl.dlhpambon2025.workers.dev?url=" + encodeURIComponent(this.apiURL);
        this.isRunning  = false;
        this.standart   = 5000;

        this.pingText   = document.querySelector('#ping-text')
        this.pingLoader = document.querySelector('.ping-text')
        this.pingCount  = document.querySelector('#ping-counter')

        this.pingCycle  = 5
        this.maxCycle   = 5
        this.checker    = []
        
        this.state      = navigator.onLine;
        
        this.networkBox = document.querySelector('#network')
        this.connecting = document.querySelector('#connecting')
    }

    async start() {
        if (this.isRunning) return;
        STATIC.loaderRun("Connecting...");
        this.isRunning = true;
        console.log("[PingSimple] Ping started.");
        this.pingText.classList.remove('dis-none')
        this.loop();
    }
    
    pause () {
        this.isRunning = false;
        this.pingText.classList.add('dis-none')
        console.log("[PingSimple] Ping paused.");
    }

    resume() {
        this.isRunning = true;
        this.pingText.classList.remove('dis-none')
        console.log("[PingSimple] Ping resumed.");
    }

    async loop() {
        while (this.isRunning) {
            this.pingCycle --

            let latency = 0,
                status  = null

            const start = performance.now(),
                intv    = setInterval(() => {
                    const ltx = Math.round(performance.now() - start);
                    this.pingText.textContent  = ltx.toLocaleString() + " ms";
                    this.pingText.style.color  = ltx < this.standart ? 'limegreen' : 'red';
                }, 500)
            try {
                const res   = await fetch(this.url, {cache: "no-store"})
                latency     = Math.round(performance.now() - start);
                if (!res.ok) throw new Error("HTTP " + res.status);
                status = (latency < this.standart) ? 'good' : 'bad'
            } catch (err) {
                console.warn('Error : ' + err)
                latency     = Math.round(performance.now() - start);
                status      = 'failed'
            }
            this.checker.push(status)
            latency = latency.toLocaleString() + " ms"
            this.pingText.textContent   = status == 'failed' ? 'Request timeout' : latency;
            this.pingText.style.color   = status == 'good' ? 'limegreen' : 'red';
            clearInterval(intv)            
            this.controller(this.checker)
            if(this.pingCycle == 0) {
                this.pingCycle = this.maxCycle
                this.checker = []
            }
        }
    }
    
    controller(array) {
        if(STATIC.count(array, 'failed') >= 1) this.state = false
        else if (STATIC.count(array, 'bad') >= 3 && !this.state) this.connecting.classList.remove('dis-none')
        else this.state = true
        localStorage.setItem('connection', JSON.stringify(this.state))
    }

    isOnLine() {
        return JSON.parse(localStorage.getItem("connection"))
    }
}

class STATIC {
    static verifyController(data){
        return {
            show : (callback = "") => {
                STATIC.changeContent("verify")
                document.querySelector("#verify h4").textContent        = data.head
                document.querySelector("#verify span").textContent      = data.text
                if (data.status == 'denied') {
                    document.querySelector("#verify i").className       = "fas fa-x fz-30 grid-center m-auto"
                    document.querySelector("#verify-data").className    = "red align-center"
                }
                else {
                    document.querySelector("#verify i").className       = "fas fa-check fz-30 grid-center m-auto"
                    document.querySelector("#verify-data").className    = "green align-center"
                }
                if(typeof callback === "function") callback()
            },
            clear : (callback = "") => {
                document.querySelector("#verify").classList.add("dis-none")
                document.querySelector("#verify h4").textContent = ""
                document.querySelector("#verify span").textContent = ""
                document.querySelector("#verify i").className = ""
                
                if(typeof callback === "function") callback()
                else if (typeof callback === "string") this.changeContent(callback)
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
    static async delay (ms, callback = "") {
        await new Promise(resolve => setTimeout(resolve, ms))
        if(typeof callback === "function") return callback()
    }
    static loaderRun(text = 'Sending Request', speak = false) {
        try {
            if (typeof speak === 'string') TTS.speak(speak);
            document.querySelector("#loader").classList.remove("dis-none");
            document.querySelector("#the-loader").classList.remove("dis-none");
            document.querySelector("#loader-icon").classList.add("dis-none");
            document.querySelector("#loader-text").textContent = text;
        } catch (err) {
            console.error("[loaderRun] Gagal menampilkan loader :", err);
        }
    }
    static loaderStop(callback = "") {
        document.querySelector("#loader").classList.add("dis-none")
        document.querySelector('#loader-text').textContent = ""
        if (typeof callback === "function") return callback()
    }
    static count (arr, val) {
        return arr.filter(v => v == val).length
    }
    static isOnlineUI(callback = ""){
        const online = localStorage.getItem("connection")
        console.log(online)
        document.querySelector("#network").classList.remove("dis-none")
        if(online == "true") {
            document.querySelector("#network i").className = "fas fa-wifi fz-40 relative network-icon clr-green br-green online-icon"
            document.querySelector("#network span").textContent = "ONLINE"
            document.querySelector("#network span").className = "dis-block align-center clr-green mt-3 bolder"
        } else {
            document.querySelector("#network i").className = "fas fa-wifi fz-40 relative network-icon clr-red br-red offline-icon"
            document.querySelector("#network span").textContent = "OFFLINE"
            document.querySelector("#network span").className = "dis-block align-center clr-red mt-3 bolder"
        }
        if (typeof callback === "function") return callback()
        return setTimeout(() => {
            document.querySelector("#network").classList.add("dis-none")
            document.querySelector("#network i").className = ""
        }, 1000)
    }
    static alert(parent, color,  _head = 'Alert', _text = 'Lorem ipsum dolor sit amet.', callback = ""){
        if (!parent) return
        const div   = document.createElement('div'),
            box     = document.createElement('div'),
            head    = document.createElement('h3'),
            text    = document.createElement('p')
            
        head.textContent    = _head
        text.textContent    = _text
        div.className       = 'alert'
        box.className       = 'alert-box grey'
        head.className      = 'alert-head p-10 ' + color
        text.className      = 'alert-text bolder clr-black'
        
        box.appendChild(head)
        box.appendChild(text)
        div.appendChild(box)
        
        document.querySelector(parent).appendChild(div)
        
        if (typeof callback === 'function') callback()
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

    static speak(text, onStart, onEnd) {
        TTS.unlock();

        if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "id-ID";
        utterance.pitch = 1;
        utterance.rate = 1.2;
        utterance.volume = 1;

        utterance.onend = () => typeof onEnd === "function" ? onEnd() : "";
        utterance.onstart = () => typeof onStart === "function" ? onStart() : "";
        window.speechSynthesis.speak(utterance);
    }

    static stop() {
        return window.speechSynthesis.speaking ? window.speechSynthesis.cancel() : "";
    }
}

class RequestManager {
    constructor(main) {
        this.maxRetries         = 3;
        this.retryDelay         = 1000;      // ms
        this.timeoutMs          = 15000;    // ms
        this.deferWhenHidden    = false;
        this.maxHiddenDeferMs   = 4000; 
        this.appCTRL            = main || null;
        this.baseURL            = (typeof STATIC !== "undefined" && STATIC.URL) ? STATIC.URL : "";
        var self = this;
        if (!Object.getOwnPropertyDescriptor(this, "URL")) {
            Object.defineProperty(this, "URL", {
                enumerable   : true,
                configurable : false,
                get          : function () {
                    var raw = (self.appCTRL && self.appCTRL.baseURL) ? self.appCTRL.baseURL : self.baseURL;
                    return self._normalizeBaseURL(raw);
                }
            });
        }
    }

    // ====== PUBLIC ======
    isOnline() {
        return true
        this.appCTRL.connect.isOnLine();
    }

    _log() { 
        try { 
            var args = Array.prototype.slice.call(arguments);
            console.log.apply(console, ["[RequestManager]"].concat(args)); 
        } catch(_) {}
    }

    async post(pathOrData, dataArg, optionsArg) {
        var path = "", data = {}, options = {};
        if (typeof pathOrData === "string") {
            path = pathOrData || "";
            data = dataArg || {};
            options = optionsArg || {};
        } else {
            data = pathOrData || {};
            options = dataArg || {};
        }

        var base = this._requireBaseURL();                 // <- perbaikan utama
        var url  = this._joinURL(base, path);

        if (!this.isOnline()) {
            var offlineRes = this._makeResult(false, "OFFLINE", null, {
                code: "OFFLINE",
                message: "Tidak ada koneksi internet."
            }, url, 0, 0, false);
            this._log("📴 OFFLINE:", offlineRes);
            this._safeToast("error", "Perangkat sedang offline!");
            return offlineRes;
        }

        if (this.deferWhenHidden && typeof document !== "undefined" && document.hidden) {
            this._log("⏸️ Menunda POST karena tab hidden");
            await this._waitUntilVisible(this.maxHiddenDeferMs);
        }

        var requestId = this._makeUUID();
        var headers = Object.assign({
            "Accept": "application/json, text/plain;q=0.9, */*;q=0.8",
            "Idempotency-Key": requestId
        }, options.headers || {});

        var body = null;
        var isFormData = (typeof FormData !== "undefined") && (data instanceof FormData);
        if (isFormData) {
            body = data;
            delete headers["Content-Type"];
        } else {
            headers["Content-Type"] = headers["Content-Type"] || "application/json";
            body = headers["Content-Type"].indexOf("application/json") >= 0 ? JSON.stringify(data || {}) : (data || "");
        }

        var attempt = 0;
        var retried = false;
        var startAll = this._nowMs();

        while (attempt < this.maxRetries) {
            attempt++;
            var controller = new AbortController();
            var to = setTimeout(function () { try{ controller.abort("TIMEOUT"); }catch(_){}} , this.timeoutMs);

            try {
                this._log("📤 POST attempt " + attempt + "/" + this.maxRetries, { url: url });
                var res = await fetch(url, {
                    method: "POST",
                    headers: headers,
                    body: body,
                    signal: controller.signal
                });
                clearTimeout(to);

                var parsed = await this._smartParseResponse(res);

                if (res.ok) {
                    var okRes = this._makeResult(true, "SUCCESS", res.status, null, url, attempt, this._nowMs() - startAll, retried, requestId, parsed.data);
                    this._log("✅ Sukses:", okRes);
                    return okRes;
                }

                if (!this._shouldRetryHTTP(res) || attempt >= this.maxRetries) {
                    var failRes = this._makeResult(false, this._statusFromHttp(res.status), res.status, {
                        code: parsed.errorCode || "ERROR",
                        message: parsed.errorMessage || ("Gagal (status " + res.status + ")")
                    }, url, attempt, this._nowMs() - startAll, retried, requestId, parsed.data);
                    this._safeToast("error", failRes.error.message);
                    return failRes;
                }

                retried = true;
                await this._delay(this._computeBackoff(attempt, this.retryDelay, res));

            } catch (err) {
                clearTimeout(to);

                var code = this._classifyFetchError(err);
                if (code === "ABORTED") {
                    return this._makeResult(false, "ABORTED", null, { code: code, message: "Dibatalkan." }, url, attempt, this._nowMs() - startAll, retried, requestId);
                }

                if (attempt >= this.maxRetries) {
                    var fail = this._makeResult(false, code, null, {
                        code: code,
                        message: this._readableFetchError(err, code)
                    }, url, attempt, this._nowMs() - startAll, retried, requestId);
                    this._safeToast("error", fail.error.message);
                    return fail;
                }

                retried = true;
                await this._delay(this._computeBackoff(attempt, this.retryDelay));
            }
        }

        return this._makeResult(false, "FAILED", null, {
            code: "UNKNOWN",
            message: "Gagal tanpa alasan yang diketahui."
        }, url, attempt, this._nowMs() - startAll, retried, requestId);
    }

    // ====== PRIVATE UTILS ======
    _normalizeBaseURL(u) {
        if (typeof u !== "string") return "";
        var s = u.trim();
        if (!s) return "";
        if (/^\/\//.test(s)) s = "https:" + s;
        if (!/^https?:\/\//i.test(s)) s = "https://" + s;
        s = s.replace(/\/+$/, "");
        return s;
    }
    _requireBaseURL() {
        var u = this.URL;
        if (!u) throw new Error("RequestManager.baseURL belum diset (AppController/baseURL kosong).");
        return u;
    }
    _nowMs() {
        try { return (typeof performance !== "undefined" && typeof performance.now === "function") ? performance.now() : Date.now(); }
        catch(_) { return Date.now(); }
    }
    _delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    _makeUUID() {
        try { return (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + "-" + Math.random().toString(16).slice(2)); }
        catch(_) { return (Date.now() + "-" + Math.random().toString(16).slice(2)); }
    }
    _joinURL(base, p) {
        if (!p) return base;
        if (base.endsWith("/") && p.startsWith("/")) return base + p.slice(1);
        if (!base.endsWith("/") && !p.startsWith("/")) return base + "/" + p;
        return base + p;
    }
    _makeResult(confirm, status, httpStatus, errorObj, url, attempt, durationMs, retried, requestId, data) {
        return {
            confirm: !!confirm,
            status : status,
            httpStatus: (typeof httpStatus === "number") ? httpStatus : null,
            data   : data || null,
            error  : errorObj || null,
            meta   : {
                requestId : requestId || this._makeUUID(),
                attempt   : attempt || 0,
                retried   : !!retried,
                durationMs: Math.max(0, Math.round(durationMs || 0)),
                url       : url
            }
        };
    }
    async _smartParseResponse(res) {
        var ct = (res.headers.get("Content-Type") || "").toLowerCase();
        var out = { data: null, errorMessage: null, errorCode: null, raw: null };
        try {
            if (ct.indexOf("application/json") >= 0) {
                out.data = await res.json();
                if (!res.ok) {
                    out.errorMessage = (out.data && (out.data.message || out.data.error || out.data.msg)) || null;
                    out.errorCode    = (out.data && (out.data.code    || out.data.errorCode)) || null;
                }
            } else if (ct.indexOf("text/") >= 0) {
                var txt = await res.text();
                out.raw = txt;
                try { out.data = JSON.parse(txt); } catch(_) { out.data = txt; }
                if (!res.ok) out.errorMessage = (typeof out.data === "string") ? out.data.slice(0, 300) : null;
            } else {
                // blob/unknown
                try { out.raw = await res.blob(); } catch(_) { out.raw = null; }
                out.data = out.raw;
            }
        } catch(_) {
            out.errorMessage = "Gagal mem-parse respons server.";
            out.errorCode = "PARSE_ERROR";
        }
        return out;
    }
    _shouldRetryHTTP(res) {
        var s = res.status;
        return (s === 408 || s === 425 || s === 429 || (s >= 500 && s <= 599));
    }
    _statusFromHttp(s) {
        if (s === 429) return "THROTTLED";
        if (s === 408) return "TIMEOUT";
        if (s >= 500) return "SERVER_ERROR";
        if (s >= 400) return "CLIENT_ERROR";
        return "FAILED";
    }
    _computeBackoff(attempt, baseDelay, res) {
        var retryAfterMs = 0;
        try {
            var ra = res && res.headers && res.headers.get && res.headers.get("Retry-After");
            if (ra) {
                var sec = parseInt(ra, 10);
                if (!isNaN(sec)) retryAfterMs = sec * 1000;
            }
        } catch(_) {}
        var expo   = Math.min(30000, Math.round(baseDelay * Math.pow(2, Math.max(0, attempt - 1))));
        var jitter = Math.floor(Math.random() * Math.min(1000, baseDelay));
        return Math.max(retryAfterMs, expo + jitter);
    }
    _classifyFetchError(err) {
        var msg = (err && (err.message || "")) || "";
        var name = (err && err.name) || "";
        if (name === "AbortError" || msg === "ABORTED") return "ABORTED";
        if (msg === "TIMEOUT") return "TIMEOUT";
        // Heuristik: kalau online tapi gagal, kemungkinan CORS; kalau offline, network error
        return (typeof navigator !== "undefined" && navigator.onLine) ? "CORS" : "NETWORK_ERROR";
    }
    _readableFetchError(err, code) {
        if (code === "TIMEOUT") return "Timeout! Periksa koneksi.";
        if (code === "CORS")    return "Permintaan diblokir oleh kebijakan CORS.";
        if (code === "NETWORK_ERROR") return "Jaringan error. Cek koneksi.";
        if (code === "ABORTED") return "Permintaan dibatalkan.";
        return (err && err.message) || "Terjadi kesalahan jaringan.";
    }
    async _waitUntilVisible(ms) {
        if (typeof document === "undefined" || !document.hidden) return;
        return new Promise(function (resolve) {
            var t = setTimeout(function () { resolve(); }, Math.max(0, ms || 0));
            function onVis() {
                if (!document.hidden) { clearTimeout(t); resolve(); }
            }
            document.addEventListener("visibilitychange", onVis, { once: true });
        });
    }
    _safeToast(type, msg) {
        try {
            if (!msg) return;
            if (typeof STATIC !== "undefined" && typeof STATIC.toast === "function") {
                STATIC.toast(msg, type || "info");
            }
        } catch(_) {}
    }
}

class QRScanner {
    constructor(main, onSuccess, onFailed) {

        this.appCTRL            = main
        this.onSuccess          = onSuccess;
        this.onFailed           = onFailed;

        this.maxRequest         = 3
        this.falseCount         = 0;
        this.maxFalse           = 15;
        this.counter            = 60; // 60 detik timeout

        this.qrCodeScanner      = null;
        this.countdownInterval  = null;
        this.timeoutCounter     = this.counter;

        this.regionEl           = document.getElementById("qr-reader");
        this.restartBtn         = document.getElementById("restart-scan-btn");
        this.counterEl          = document.getElementById("cams-timeout-counter");
        this.scanGuide          = document.querySelector(".scan-guide-line");
        this.scanWarn           = document.querySelector('#scan-warn');
    }
    async _init() {
        let error = "";
        //STATIC.loaderRun("Load Scanner...");
        try {
            if (typeof Html5Qrcode === "undefined") throw new Error("Library QR belum dimuat : html5qrcode-not-found", "error")
            this.qrCodeScanner = new Html5Qrcode("qr-reader", {
                formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
            });
            if (!this.regionEl || !this.restartBtn || !this.counterEl || !this.scanGuide) throw new Error("QR Elemen tidak ditemukan. Pastikan semua elemen ada di halaman.");
            
            this._hideElement(this.regionEl);
            this._hideElement(this.restartBtn);
            this._hideElement(this.scanGuide);
            this._hideElement(this.scanWarn);
            this._clearCountdown();

            this.isScanning = false;
            this.isRunning  = false;
            this.isPaused   = false;
            this.hasStarted = false;
            this.isVerify   = false;
        
            return true
        } catch (err) {
            STATIC.alert("#camera-content","Init error", err.message)
            return false
        }
    }
    async start() {
        if (!this._init()) return

        if (this.isScanning || this.isRunning || this.isVerify) return;
        
        TTS.speak("Memulai kamera. Silakan scan QR kode Anda. Posisikan QR code di tengah kotak. Pastikan tak ada yang menghalangi")
        
        STATIC.toast("Memulai kamera...", "info");
        this._showElement(this.regionEl);
        this._hideElement(this.restartBtn);
        this._showElement(this.scanGuide);

        this.isScanning = true;
        this.timeoutCounter = this.counter; // Reset timeout counter

        try {
            const devices = await Html5Qrcode.getCameras();
            const camId = devices.find(d => d.label.toLowerCase().includes("front"))?.id || devices[0]?.id;
            if (!camId) throw new Error("Tidak ada kamera ditemukan.");
            
            this.isRunning = true
            this._startCountdown();
            
            await this.qrCodeScanner.start(
                camId, // ✅ Gunakan langsung string ID, bukan object
                {
                    fps: 60,
                    rememberLastUsedCamera: true,
                },
                async (decodedText) => {
                    this.pause()
                    this._clearCountdown()
                    await this._QRVerify(decodedText)
                },
                () => {
                    console.log("_")
                    this.isVerify = false
                }
            )
            this.hasStarted = true;
        } catch (err) {
            STATIC.alert('#camera-content', 'red', 'Scanner Error', err.message || "Gagal membuka kamera")
            this.isRunning = false;
            this.stop();
            console.error("QRScanner start error:", err.message);
        } finally {
            this.restartBtn.onclick = async () => await this.start();
        }
    }
    async stop() {
        console.log('QR Stop')
        this._clearCountdown();
        this._hideElement(this.scanGuide);
        if(this.hasStarted) this._showElement(this.restartBtn);

        if (this.qrCodeScanner) {
            try {
                await this.qrCodeScanner.stop();
                await this.qrCodeScanner.clear();
            } catch (err) {
                STATIC.alert('#camera-conent', 'red', 'Scanner Error', err.message)
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
                STATIC.alert('#camera-content', 'red', 'Scanner Error', err.message || 'Qr Scanner pause Gagal')
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
                STATIC.alert('#camera-content', 'red', 'Scanner Error', err.message || 'Qr Scanner resume Gagal')
                console.warn("Resume gagal:", err);
            }
        }
    }
    async _QRVerify(qrText) {
        if (this.isVerify || !qrText || qrText.length <= 10) return;
        this.isVerify = true;
        /*
        const blockedQR = JSON.parse(localStorage.getItem("bnd-blc"))
        if  (blockedQR.includes(qrText)) {
            this.stop()
            return this.onFailed({
                status  : "denied",
                text    : 'QR Code Diblokir',
                speak   : 'QR Code telah terblokir. Hubungi admin untuk melepas blokir'
            })
        } */
        STATIC.toast("Verifikasi QR", "info")
        let timeout = null;
        try {
            timeout = setTimeout(() => {
                return TTS.speak("Timeout verifikasi, silahkan coba lagi", () => {
                    this.isVerify = false;
                    throw new Error("Timeout verifikasi, silahkan coba lagi")
                });
            }, 5000); // 10 detik max proses

            // 🚫 Empty/null/undefined check
            if (!qrText || typeof qrText !== "string") return console.warn("QR kosong atau bukan string.");

            // ✅ Validasi Base64 ketat (panjang kelipatan 4 dan regex)
            const base64Regex = /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/;
            if (!base64Regex.test(qrText)) return console.warn("QR bukan format Base64 valid.");
            
            // 🔐 Decode base64 → string
            let decoded = "";
            try { decoded = atob(qrText);}
            catch (err) {return console.error("Gagal decode Base64.");}

            // 🧠 Parse JSON
            let qrData = null;
            try {qrData = JSON.parse(decoded);}
            catch (err) {
                this.falseCount ++
                return console.error("QR bukan JSON valid.");
            }
            
            // 📋 Validasi struktur QR
            if (typeof qrData !== "object" || !qrData.auth || qrData.auth !== "Bendhard16") {
                this.falseCount ++
                return console.error("QR tidak memiliki otorisasi atau auth salah.");
            }
            if (!qrData.code) {
                this.falseCount ++
                return console.error('Code tidak ditemukan atau invalid')
            }
            this.isVerify = false
            clearTimeout(timeout);
            this.resume()
            const success = await this._requestData(qrData.code)
        } catch (err) {
            STATIC.alert("#camera-content", "red", "Error verifikasi QR", err.message || "QR tidak valid")
            this.falseCount ++
            this.resume()
            this._startCountdown() 
            this.isVerify = false;
        } finally {
            /*
            if(this.falseCount === 15) return TTS.speak("QR Code diblokir. Hubungi admin untuk konfirmasi lebih lanjut.",
                () => {
                    this._blockedQR(qrText)
                    this.resume()
                    this.isVerify = false;
                    STATIC.verifyController()
                }
            ) *
            if (this.falseCount % 5 === 0) return TTS.speak("QR Code gagal di verifikasi. Posisikan dengan benar, pastikan dapat terlihat dengan jelas di Kamera. jang terlalu jau dan jangan terlalu dekat. Bersihakan kartu QR Code pastikan tidak ada noda. Jika sudah silahkan coba lagi.",
                "",
                () => {
                    this.isVerify = false;
                    this.resume()
                })
            this.isVerify = false;*/
        }
    }
    async _requestData(code) {
        STATIC.loaderRun('Request Data')
        this.stop()
        const post =  await this.appCTRL.request.post({
            type    : 'getDriver',
            code    : code
        })
        STATIC.loaderStop()
        if (post.data.confirm) return this.onSuccess(post.data)
        if (!post.confirm) return await this._scanWarn({
            head    : post.error.code,
            text    : post.error.message
        }, 5000)
        if (!post.data.confirm) return this.onFailed({
            head    : post.data.status,
            text    : post.data.msg,
            data    : post
        })
    }
    async _scanWarn(data, timeout = 2500) {
        TTS.speak(data.text, () => {
            this._showElement(this.scanWarn)
            document.querySelector("#scan-warn h5").textContent = data.head
            document.querySelector("#scan-warn p").textContent = data.text
        }, async () => await STATIC.delay(timeout, () => this.start()))
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
    _errorUI(head, text, ) {
        
    }
}

class FaceRecognizer {
    constructor (main, onSuccess, onFailure) {
        this.appCTRL        = main
        this.videoElement   = document.querySelector("#face-video");
        this.previewBox     = document.querySelector('#face-prev-box');
        this.previewer      = document.querySelector('#face-preview');
        this.captureBtn     = document.querySelector("#capture-face");
        this.targetImage    = document.querySelector("#compare-photo");
        this.unmatchedBox   = document.querySelector("#unmatched-box");
        this.matchedBox     = document.querySelector("#matched-box");
        this.success        = onSuccess;
        this.failed         = onFailure;

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
    }
    async _init() {
        STATIC.loaderRun("Load Human JS...")
        let error = ""
        try {
            const HumanLib = window.Human?.Human || window.Human;
            if (!HumanLib) throw new Error("Human.js belum dimuat");
            
            this.human = new HumanLib({
                backend         : 'webgl',
                modelBasePath   : './models/',
                cacheSensitivity: 0.9,
                chaceModels     : true,
                warmup          : "face",
                async           : true,
                filter          : { enabled: true },
                face            : {
                    enabled         : true,
                    detector        : { enabled: true, maxDetected: 1 },
                    mesh            : false,
                    iris            : false,
                    emotion         : false,
                    description     : {enabled : true },
                    embedding       : {enabled : true }
                },
                body            : { enabled: false },
                hand            : { enabled: false },
                object          : { enabled: false },
                gesture         : { enabled: false }
            });

            try {
                await this.human.load();
                this.modelLoaded = true;
            } catch (err) {
                this.modelLoaded = false;
                throw new Error("[Human init]", err)
            }

            await this.human.warmup();
            this.humanReady = true
            return true
        } catch (err) {
            this._log("Init error: " + err.message);
            error = "[Human] Init : Error " + err.message
        }
        if(error.length >= 5) throw new Error(err)
    }
    async start() {
        this.captureBtn.classList.add('dis-none');
        this.captureBtn.onclick = () => {};
        await this.loadTargetEmbedd()
        await this._setupCamera();
        //return
        if(this.readyState()) {
            this.captureBtn.classList.remove('dis-none');
            this.captureBtn.onclick = () => this._startCountdown();
            STATIC.toast("Silakan posisikan wajah Anda di dalam garis bantu.", "info")
            TTS.speak("Kamera siap. Silakan posisikan wajah Anda di dalam garis bantu. Kemudian tekan untuk mengambil gamba.")
        } else {
            if(this.setupRetry >= 3) return typeof this.onFailure === "function" && this.onFailure({
                status  : "denied",
                head    : "Head",
                text    : "Gagal inisiasi Face Verify setelah 3 kali percobaan"
            });
            setTimeout(() => this.start(), 1000)
            return this.setupRetry ++
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
        STATIC.loaderRun('Get target embedding...')
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
        } finally {
            await STATIC.delay(2500)
        }
    }
    async _setupCamera() {
        STATIC.loaderRun("Memulai setup kamera...")
        this._log("Memulai setup kamera...");
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
        } finally {
            await STATIC.delay(2500, ()=> STATIC.loaderStop())
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
            this.captureAndVerify();
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
            STATIC.toast("Sedang verifikasi wajah...", "info");
            TTS.speak("Silakan menunggu, sedang verifikasi wajah", "", () => {
                return this.verifyFace(imageData);
            });
        } catch (error) {
            this.captureRetry ++
            if (this.captureRetry >= 3) return typeof this.onFailure === "function" && this.onFailure({
                status : "capture failed",
                text   : "Gagal capture face setelah 3 kali percobaan"
            });
            return TTS.speak("Terjadi kesalahan saat mengambil gambar. Silahkan Coba lagi.", () => {
                this.previewBox.classList.add('dis-none');
                STATIC.toast("Terjadi kesalahan saat mengambil gambar", "error");
                console.error("[FaceRecognizer] Error saat capture:", error);
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
            this.human.detect(imageData).then(result => {
                //this._log("[FaceRecognizer] Hasil deteksi:", result);

                if (!result.face || result.face.length === 0) return TTS.speak("Wajah tidak terdeteksi", () => {
                    STATIC.toast("Wajah tidak terdeteksi", "error");
                    this.captureBtn.classList.remove('dis-none');
                    setTimeout(() => this.previewBox.classList.add("dis-none"), 500);
                });

                const detected = result.face[0];
                if (!detected.embedding || detected.embedding.length === 0) return TTS.speak("Data wajah tidak valid", () => {
                    console.warn("Embedding tidak valid:", detected.embedding);
                    STATIC.toast("Data embedding wajah tidak valid", "error");
                    this.captureBtn.classList.remove('dis-none');
                    setTimeout(() => this.previewBox.classList.add("dis-none"), 500);
                });

                const distance = this.cosineSimilarity(detected.embedding, this.targetEmbedd);
                this._log("Distance antara wajah: " + distance);

                if (distance >= 0.55) return TTS.speak("Verifikasi wajah berhasil", () => {
                    //STATIC.toast("Wajah cocok ✅", "success");
                    this.matchedBox.classList.remove("dis-none");
                    this.stop();
                    this.previewBox.classList.add("dis-none");
                    this.captureBtn.classList.add('dis-none');
                    setTimeout(() => this.success(), 500)    
                });
                else if (distance < 0.55) TTS.speak(
                    "Wajah tidak cocok" + 
                        ((this.verifyRetry == 0) ? 
                            ", silahkan coba lagi. Maksimal 3 kali. Tersisa 2 kesempatan" :
                            (this.verifyRetry == 1) ? 
                                ", silahkan coba lagi. Tersisa 1 kesempatan." :
                                ". Kesempatan telah habis."),
                    () => {
                        this.unmatchedBox.classList.remove("dis-none");
                        this.previewBox.classList.add("dis-none");
                        this.verifyRetry++
                        console.log("VerifyRetry : ", this.verifyRetry)
                        setTimeout(() => {
                            this.captureBtn.classList.remove('dis-none');
                            this.unmatchedBox.classList.add("dis-none")
                        }, 5000);
                    });
            }).catch(err => this.verifyRetry ++ <= 1 && TTS.speak("Terjadi kesalahan saat verifikasi wajah", () => {
                    this.previewBox.classList.add("dis-none");
                    console.error("[FaceRecognizer] Gagal deteksi wajah:", err);
                    STATIC.toast("Terjadi kesalahan saat verifikasi wajah", "error");
                })
            );

        } catch (error) {
            return this.verifyRetry ++ <= 1 && TTS.speak("Terjadi kesalahan saat verifikasi wajah", () => {
                this.previewBox.classList.add("dis-none");
                this.verifyRetry ++
                console.error("[FaceRecognizer] Fatal error di verifyFace:", error);
                STATIC.toast("Terjadi kesalahan saat verifikasi wajah", "error");
            });
        } finally {
            return this.verifyRetry >= 3 && TTS.speak("Gagal verifikasi wajah setelah 3 kali percobaan", () => {
                this.captureBtn.classList.add('dis-none');
                this.previewBox.classList.add('dis-none');
                this._log("Verifikasi gagal setelah 3 kali percobaan");
                this.stop();
                typeof this.onFailure === "function" && this.onFailure({
                    status : "verify failed",
                    text   : "Gagal verifikasi wajah setelah 3 kali percobaan"
                });
            })
        }
    }
    async stop() {
        try {
            if (this.human) {
                // Stop semua proses Human.js (misalnya face detection, body tracking, dll)
                this.human.reset(); // stop inference loop
                // Hentikan stream kamera
                if (this.videoElement && this.videoElement.srcObject) {
                    const tracks = this.videoElement.srcObject.getTracks();
                    tracks.forEach(track => track.stop());
                    this.videoElement.srcObject = null;
                }
                // Clear canvas preview atau apapun yang sedang ditampilkan
                const canvas = document.querySelector("canvas");
                if (canvas) canvas.remove();
                    
            }
        } catch (err) {
            console.error("❌ Gagal stop Human.js:", err);
        }
    }
    _log(msg) {console.log("[FaceRecognizer]", msg);}
    errorHandle(data) {
        
    }
}

class IndexedDBController {
    constructor(version = 1) {
        this.dbName     = 'BBM';
        this.version    = version;
        this.db         = null;
        this.schema     = {};
    }

    async init(schema = {}) {
        this.schema = schema;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = (e) => {
                console.error("[IndexedDB] Gagal buka DB:", e);
                STATIC.toast("Gagal buka database", "error");
                reject(e);
            };

            request.onsuccess = (e) => {
                this.db = e.target.result;
                STATIC.toast("Database siap ✅", "success");
                resolve(this);
            };
            request.onupgradeneeded = (e) => {
                this.db = e.target.result;
                for (const storeName in schema) {
                    if (!this.db.objectStoreNames.contains(storeName)) {
                        const def = schema[storeName];
                        const store = this.db.createObjectStore(storeName, def.options || { keyPath: 'id' });
                        if (def.indexes && Array.isArray(def.indexes)) {
                            for (const idx of def.indexes) {
                                store.createIndex(idx.name, idx.keyPath, idx.options || {});
                            }
                        }
                        console.log(`[IndexedDB] Store '${storeName}' dibuat.`);
                    }
                }
            };
        });
    }

    async add(storeName, keyPath, data) {
        try {
            const existing = await this.get(storeName, keyPath);
            if (existing) {
                STATIC.toast("Data sudah ada", "warning");
                return false;
            }

            return await this._run(storeName, "readwrite", store => {
                const request = store.add(data);
                return this._handleRequest(request, "Data ditambahkan", "Gagal menambah data");
            });
        } catch (err) {
            console.error("[IndexedDB][add]", err);
            STATIC.toast("Error saat menambah", "error");
        }
    }

    async put(storeName, data) {
        try {
            return await this._run(storeName, "readwrite", store => {
                const request = store.put(data);
                return this._handleRequest(request, "Data disimpan", "Gagal menyimpan data");
            });
        } catch (err) {
            console.error("[IndexedDB][put]", err);
            STATIC.toast("Error saat menyimpan", "error");
        }
    }

    async update(storeName, id, updater) {
        try {
            const item = await this.get(storeName, id);
            if (!item) {
                STATIC.toast("Data tidak ditemukan", "error");
                return false;
            }

            const updated = updater(item);
            return await this.put(storeName, updated);
        } catch (err) {
            console.error("[IndexedDB][update]", err);
            STATIC.toast("Error saat update", "error");
        }
    }

    async delete(storeName, key) {
        try {
            return await this._run(storeName, "readwrite", store => {
                const request = store.delete(key);
                return this._handleRequest(request, "Data dihapus", "Gagal menghapus");
            });
        } catch (err) {
            console.error("[IndexedDB][delete]", err);
            STATIC.toast("Error saat menghapus", "error");
        }
    }

    async get(storeName, key) {
        return await this._run(storeName, "readonly", store => {
            return new Promise((resolve, reject) => {
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => reject(e);
            });
        });
    }

    async getAll(storeName) {
        return await this._run(storeName, "readonly", store => {
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => reject(e);
            });
        });
    }

    _run(storeName, mode, callback) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                STATIC.toast("Database belum siap", "error");
                reject("DB not ready");
                return;
            }

            const tx     = this.db.transaction(storeName, mode);
            const store  = tx.objectStore(storeName);

            let result;
            try { result = callback(store);}
            catch (err) {reject(err);}

            tx.onerror   = (e) => reject(e);
            tx.oncomplete = () => resolve(result);
        });
    }

    _handleRequest(request, successMsg, errorMsg) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                if (successMsg) STATIC.toast(successMsg, "success");
                resolve(true);
            };
            request.onerror = (e) => {
                console.error("[IndexedDB][Request Error]", e);
                if (errorMsg) STATIC.toast(errorMsg, "error");
                reject(false);
            };
        });
    }
}


window.addEventListener("DOMContentLoaded", async () => {
    //STATIC.loaderRun('Connecting...')
    
    var app = new AppController()
    await app._init();
    
    const videos = document.querySelectorAll("video");
    /*await fetch("https://bbmctrl.dlhpambon2025.workers.dev?url=",{// + encodeURIComponent("https://script.google.com/macros/s/AKfycbzS1dSps41xcQ8Utf2IS0CgHg06wgkk5Pbh-NwXx2i41fdEZr1eFUOJZ3QaaFeCAM04IA/exec"),{
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            type : "getDriver",
            code : "A-001"
        })
    })*/
    videos.forEach(video => {
        const stream = video.srcObject;
        if (stream && stream.getTracks) {
            stream.getTracks().forEach(track => {
                if (track.readyState === "live") track.stop();
            });
            video.srcObject = null;
        }
    });
    const encript = btoa(JSON.stringify({
        auth : "Bendhard16",
        code : 'X-016'
    }))
    console.log(encript)
    console.log(JSON.parse(atob(encript)))
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