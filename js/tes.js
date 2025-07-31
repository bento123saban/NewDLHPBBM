export default {
  async fetch(request, env, ctx) {
    const target = "https://script.google.com/macros/s/AKfycbzS1dSps41xcQ8Utf2IS0CgHg06wgkk5Pbh-NwXx2i41fdEZr1eFUOJZ3QaaFeCAM04IA/exec"
    if (!target) {
      return new Response("Url taget undefined", { status: 400 });
    }

    // 🔁 Tangani preflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // 🔁 Ambil body dari request (jika ada)
    const contentType = request.headers.get("Content-Type") || "";
    let body = null;

    if (request.method !== "GET" && request.method !== "HEAD") {
      if (contentType.includes("application/json")) {
        body = await request.text(); // kita teruskan mentah sebagai text
      }
    }

    // ⏩ Kirim ke target URL (misalnya: Apps Script)
    const forwarded = await fetch(target, {
      method: request.method,
      headers: request.headers,
      body,
    });

    const resBody = await forwarded.text(); // tetap JSON, tapi kita relai langsung

    return new Response(resBody, {
      status: forwarded.status,
      headers: {
        ...corsHeaders(),
        "Content-Type": forwarded.headers.get("Content-Type") || "application/json",
      },
    });
  },
};

// ✅ Header CORS
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key" // <--- Perubahan di sini
  };
}
