

    async startScanner() {
        if (this.state.scanning || this.state.transitioning || this.state.stopping) return;

        if (this.cameras.length === 0) await this.initCameras();
        if (this.cameras.length === 0) return;

        this.state.transitioning = true;
        this.state.scanning = true;
        //this.toggleScanUI(true);

        const config = { fps: 60, qrbox: { width: 300, height: 500 } };
        const onScanSuccess = async (decodedText) => {
            const now = Date.now();
            if (decodedText === this.state.lastScan.text && now - this.state.lastScan.time < 5000) return;

            this.state.lastScan = { text: decodedText, time: now };
            const checks = await this.encodeCheck(decodedText);
            if (!checks.status) return;
            await this.main.dataCtrl.run(checks.data);
        };

        try {
            await this.html5QrCode.start(
                { deviceId: { exact: this.cameras[this.currentCamIndex].id } },
                config,
                onScanSuccess
            );
        } catch {
            try {
                await this.safeStop();
                this.html5QrCode = new Html5Qrcode("reader");
                await this.html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess);
            } catch (fallbackErr) {
                console.error("[QRScanner] Start gagal total:", fallbackErr);
                this.state.scanning = false;
                this.state.transitioning = false;
            }
        }

        this.state.transitioning = false;
    }







        this.dom.switchCameraBtn?.addEventListener("click", async () => {
            if (this.cameras.length < 2 || this.state.switchingCamera) return;

            this.state.switchingCamera = true;
            this.dom.switchCameraBtn.classList.add("off");

            this.currentCamIndex = (this.currentCamIndex + 1) % this.cameras.length;

            try {
                if (this.state.scanning) {
                    await this.stopScanner();
                    await this.startScanner();
                }
            } catch (e) {
                console.warn("[QRScanner] Switch error:", e);
            }

            this.dom.switchCameraBtn.classList.remove("off");
            this.state.switchingCamera = false;
        });




