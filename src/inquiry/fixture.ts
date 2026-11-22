import { defineInquiry } from "./core";

export const fixture = defineInquiry({
  endpoint: "/api/inquiry",
  failureMessage: "Could not send. Email help@example.com.",
  minFillMs: 1000,
  steps: [
    {
      kind: "choice",
      id: "kind",
      question: "What are you planning?",
      options: [
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
      ],
      followUp: {
        question: "Anything more specific?",
        multi: true,
        options: [
          { id: "x", label: "Ex" },
          { id: "y", label: "Why" },
        ],
      },
    },
    {
      kind: "choice",
      id: "size",
      question: "How many?",
      options: [
        { id: "s", label: "Small" },
        { id: "m", label: "Medium" },
      ],
    },
    {
      kind: "choice",
      id: "extras",
      question: "Extras?",
      multi: true,
      optional: true,
      options: [
        { id: "p", label: "Pets" },
        { id: "q", label: "Parking" },
      ],
    },
    {
      kind: "contact",
      id: "contact",
      heading: "Contact",
      fields: { phone: true, date: true, message: true },
      labels: { name: "Name", email: "Email", phone: "Phone", date: "Date", message: "Message" },
      submitLabel: "Send",
    },
  ],
});
