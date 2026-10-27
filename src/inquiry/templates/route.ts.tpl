// src/app/api/inquiry/route.ts
import { createInquiryRoute } from "@iserlabs/web-kit/inquiry";
import { inquiryFlow } from "@/content/inquiry-flow";
import { sender } from "@/lib/mail"; // your existing { send({ to, from, subject, text }) } sender

export const POST = createInquiryRoute({
  config: inquiryFlow,
  to: process.env.LEAD_TO_EMAIL ?? "",
  from: process.env.LEAD_FROM_EMAIL ?? "",
  sender,
});
