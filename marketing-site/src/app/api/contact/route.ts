import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email").max(200),
  phone: z.string().max(20).optional(),
  salonName: z.string().max(100).optional(),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = contactSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, phone, salonName, message } = parsed.data;

    // If RESEND_API_KEY is set, send email
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: "Aura Contact <onboarding@resend.dev>",
        to: process.env.CONTACT_EMAIL || "hello@aurasalon.in",
        replyTo: email,
        subject: `[Aura Contact] ${name} — ${salonName || "Independent"}`,
        text: [
          `Name: ${name}`,
          `Email: ${email}`,
          `Phone: ${phone || "Not provided"}`,
          `Salon: ${salonName || "Not provided"}`,
          "",
          "Message:",
          message,
        ].join("\n"),
      });
    }

    // Always log to console (fallback when no email service configured)
    console.log("[Contact Form]", {
      name,
      email,
      phone: phone || "N/A",
      salonName: salonName || "N/A",
      message,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: "Message sent successfully" });
  } catch (error) {
    console.error("[Contact Form Error]", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
