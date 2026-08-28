"use client";

import Chrome from "@/components/Chrome";
import AskChat from "@/components/AskChat";

// Ask Coincide: chat with the community's data, full-page version.
export default function Ask() {
  return (
    <div className="page">
      <Chrome />
      <section className="chatSection">
        <div className="sectionHead">
          <h1 className="display">Ask Coincide</h1>
          <p className="sectionSub">
            Describe the company you’re after. Answers come from real people’s
            real hours, never invented.
          </p>
        </div>
        <AskChat />
      </section>
    </div>
  );
}
