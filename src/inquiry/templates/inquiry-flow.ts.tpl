import { defineInquiry } from "@iserlabs/web-kit/inquiry";

/**
 * Example only. Replace every question, option and line of copy with this
 * site's own. The kit holds the logic; the words live here.
 */
export const inquiryFlow = defineInquiry({
  endpoint: "/api/inquiry",
  failureMessage: "We could not send that just now. Please email us at hello@example.com and we will pick it up.",
  steps: [
    {
      kind: "choice",
      id: "interest",
      question: "What are you looking for?",
      help: "Pick the closest one.",
      options: [
        { id: "stay", label: "A place to stay", hint: "A few nights or longer" },
        { id: "group", label: "A place for a group" },
        { id: "other", label: "Something else" },
      ],
      followUp: {
        question: "Anything more specific?",
        help: "Optional.",
        multi: true,
        options: [
          { id: "pets", label: "Traveling with a pet" },
          { id: "work", label: "Working remotely" },
        ],
      },
    },
    {
      kind: "choice",
      id: "size",
      question: "How many people?",
      options: [
        { id: "1-2", label: "1 to 2" },
        { id: "3-5", label: "3 to 5" },
        { id: "6+", label: "6 or more" },
      ],
    },
    {
      kind: "contact",
      id: "contact",
      heading: "How can we reach you?",
      intro: "We reply by email.",
      fields: { phone: true, date: true, message: true },
      labels: {
        name: "Your name",
        email: "Email",
        phone: "Phone (optional)",
        date: "Date you have in mind (optional)",
        message: "Anything else we should know (optional)",
      },
      submitLabel: "Send inquiry",
    },
  ],
});
