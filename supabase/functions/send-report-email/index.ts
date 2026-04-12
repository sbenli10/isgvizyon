// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const VERIFIED_FROM_EMAIL = "noreply@denetron.me";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendReportEmailRequest {
  recipient_email: string;
  recipient_name: string;
  company_name: string;
  report_type: "risk_assessment" | "dof" | "adep" | "inspection";
  report_url: string;
  report_filename: string;
  sender_name: string;
  sender_email: string;
  custom_message?: string;
  org_id?: string;
  user_id?: string;
}

const reportTypeLabels = {
  risk_assessment: "Risk Değerlendirme Raporu",
  dof: "DÖF (Düzeltici/Önleyici Faaliyet) Raporu",
  adep: "Acil Durum Eylem Planı",
  inspection: "Denetim Raporu",
} as const;

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const log = (...args: unknown[]) =>
    console.log(`[send-report-email][${requestId}]`, ...args);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    log("1) Request alındı", { method: req.method });

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is missing");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    log("2) Payload parse başlıyor");
    const payload: SendReportEmailRequest = await req.json();

    log("3) Payload parse tamam", {
      recipient_email: payload.recipient_email,
      report_type: payload.report_type,
      company_name: payload.company_name,
      has_org_id: !!payload.org_id,
      has_user_id: !!payload.user_id,
    });

    if (!payload.recipient_email || !payload.report_url) {
      throw new Error("recipient_email and report_url are required");
    }
    if (!isValidEmail(payload.recipient_email)) {
      throw new Error("recipient_email is not valid");
    }
    if (!reportTypeLabels[payload.report_type]) {
      throw new Error("invalid report_type");
    }

    const emailSubject = `${reportTypeLabels[payload.report_type]} - ${payload.company_name || "Firma"}`;

const reportType = reportTypeLabels?.[payload?.report_type] || "Rapor";

const emailBody = `
<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${reportTypeLabels?.[payload?.report_type] || "Rapor"} - ${payload?.company_name || "İSGVizyon"}</title>
</head>

<body style="margin:0;padding:0;background-color:#f4f7fb;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0"
style="background:#ffffff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.08);overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">

<tr>
<td style="padding:32px 40px;background:linear-gradient(135deg,#2563eb,#1e3a8a);">
<h1 style="margin:0;font-size:22px;letter-spacing:1.2px;color:#ffffff;">İSGVİZYON</h1>
<p style="margin:6px 0 0;font-size:13px;color:#dbeafe;">Dijital İSG Yönetim Platformu</p>
</td>
</tr>

<tr>
<td style="padding:36px 40px;color:#0f172a;">

<h2 style="margin:0 0 14px;font-size:20px;font-weight:600;">
${reportTypeLabels?.[payload?.report_type] || "Rapor"} Paylaşımı
</h2>

<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#334155;">
Merhaba <strong>${payload?.recipient_name || "Yetkili"}</strong>,
</p>

<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#334155;">
<strong>${payload?.sender_name || "İSGVizyon Kullanıcısı"}</strong> tarafından hazırlanan
<strong>${reportTypeLabels?.[payload?.report_type] || "rapor"}</strong> raporu sizinle paylaşılmıştır.
</p>

<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#334155;">
Firma: <strong>${payload?.company_name || "-"}</strong><br/>
Dosya: <strong>${payload?.report_filename || "-"}</strong><br/>
Gönderim Tarihi: <strong>${new Date().toLocaleDateString("tr-TR",{day:"2-digit",month:"long",year:"numeric"})}</strong>
</p>

${
payload?.custom_message
? `<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#334155;font-style:italic;">
"${payload.custom_message}"
</p>`
: ""
}

<div style="text-align:center;margin:36px 0;">
<a href="${payload?.report_url}"
style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;padding:16px 34px;border-radius:12px;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.3px;box-shadow:0 10px 30px rgba(37,99,235,0.45),inset 0 -2px 0 rgba(255,255,255,0.15);">
Raporu Görüntüle
</a>
</div>

<p style="margin:0 0 10px;font-size:13px;color:#475569;">
🔒 Bu rapor yalnızca yetkili kişiler tarafından görüntülenmelidir.
</p>

<p style="margin:20px 0 0;font-size:13px;color:#64748b;">
Daha güvenli bir çalışma ortamı dileğiyle,<br/>
<strong>İSGVizyon Ekibi</strong>
</p>

</td>
</tr>

<tr>
<td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
<p style="margin:0;font-size:11px;color:#64748b;">
© ${new Date().getFullYear()} İSGVizyon<br/>
ISO 45001 • KVKK • AES-256
</p>
</td>
</tr>

</table>

</td>
</tr>
</table>
</body>
</html>
`;

    log("4) Resend isteği hazırlanıyor", {
      from: `İSGVizyon İSG <${VERIFIED_FROM_EMAIL}>`,
      to: payload.recipient_email,
      subject: emailSubject,
      has_reply_to: !!payload.sender_email,
    });

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `İSGVizyon İSG <${VERIFIED_FROM_EMAIL}>`,
        to: [payload.recipient_email],
        subject: emailSubject,
        html: emailBody,
        reply_to: payload.sender_email || VERIFIED_FROM_EMAIL,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      log("5) Resend hata döndü", {
        status: resendResponse.status,
        errorText,
      });
      throw new Error(`Resend API error (${resendResponse.status}): ${errorText}`);
    }

    const emailResult = await resendResponse.json();
    log("6) Resend başarılı", { email_id: emailResult?.id ?? null });

    // Log insert non-blocking: mail başarılıysa response yine success dönsün.
    try {
      if (payload.org_id && payload.user_id) {
        const { error: logError } = await supabase.from("email_logs").insert({
          org_id: payload.org_id,
          user_id: payload.user_id,
          recipient_email: payload.recipient_email,
          subject: emailSubject,
          report_type: payload.report_type,
          report_url: payload.report_url,
          status: "sent",
          email_id: emailResult?.id ?? null,
        });

        if (logError) {
          log("7) email_logs insert hatası (non-blocking)", logError);
        } else {
          log("7) email_logs insert başarılı");
        }
      } else {
        log("7) email_logs insert atlandı (org_id/user_id eksik)", {
          org_id: payload.org_id,
          user_id: payload.user_id,
        });
      }
    } catch (logInsertError) {
      log("7) email_logs unexpected hata (non-blocking)", logInsertError);
    }

    log("8) Response success dönülüyor");
    return new Response(
      JSON.stringify({ success: true, email_id: emailResult?.id ?? null, request_id: requestId }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error(`[send-report-email][${requestId}] fatal error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || "Unknown error", request_id: requestId }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
