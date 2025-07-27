if(!localStorage.getItem("bnd-blc")) localStorage.setItem("bnd-blc", JSON.stringify([]))

window.addEventListener("load", () => {
    
});


    /*

async faceMatch(embeddingLive, embeddingTarget, threshold = 0.55) {
    if (!embeddingLive || !embeddingTarget) {
        this._log("Embedding tidak tersedia");
        return { matched: false, score: 0 };
    }

    try {
        const result = await this.human.match(embeddingLive, [embeddingTarget]);
        if (!result || result.length === 0) {
            this._log("Match kosong");
            return { matched: false, score: 0 };
        }

        const similarity = result[0].similarity || 0;
        const matched = similarity >= threshold;

        this._log(`Similarity: ${similarity.toFixed(4)} | Match: ${matched ? "✅" : "❌"}`);
        return { matched, score: similarity };

    } catch (err) {
        this._log("FaceMatch error: " + err.message);
        return { matched: false, score: 0 };
    }
}



    verifyFace(canvas) {
        try {

            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            const input = ctx.getImageData(0, 0, canvas.width, canvas.height);

            if(this.verifyRetry >= 3) return TTS.speak("Gagal Verifikasi Wajah setelah 3 kali percobaan", () => {
                STATIC.toast("[verifyFace] : Wajah tidak cocok", "error")
            })

            this.human.detect(input).then(result => {
                console.log("[FaceRecognizer] Hasil deteksi:", result);

                if (!result.face || result.face.length === 0) {
                    STATIC.toast("Wajah tidak terdeteksi", "error");
                    TTS.speak("Wajah tidak terdeteksi", () => {
                        this.prviewBox.classList.add("dis-none");
                    });
                    return;
                }

                const detected = result.face[0];
                if (!detected.embedding || detected.embedding.length === 0) {
                    console.warn("Embedding tidak valid:", detected.embedding);
                    STATIC.toast("Data wajah tidak valid", "error");
                    TTS.speak("Data wajah tidak valid", () => {
                        setTimeout(() => this.prviewBox.classList.add("dis-none"), 500);
                    });
                    return;
                }

                const similarity = this.human.similarity(detected.embedding, this.targetEmbedd);
                console.log("[FaceRecognizer] Similarity:", similarity);
                console.log(similarity, "similarity")

                if (similarity >= 0.50) {
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
                    this.prviewBox.classList.add("dis-none");
                });
            });

        } catch (error) {
            console.error("[FaceRecognizer] Fatal error di verifyFace:", error);
            STATIC.toast("Terjadi kesalahan saat verifikasi wajah", "error");
            TTS.speak("Terjadi kesalahan saat verifikasi wajah", () => {
                this.prviewBox.classList.add("dis-none");
            });
        }
    }

    */