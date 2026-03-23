import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "stoqk",
  signingKey: process.env.INNGEST_SIGNING_KEY,
  eventKey: process.env.INNGEST_EVENT_KEY,
});
