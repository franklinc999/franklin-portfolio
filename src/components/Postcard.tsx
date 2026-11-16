"use client";

import { useId, useState } from "react";

const PAPER = "#fffdf6"; // the stamp is a shade whiter than the card it sits on

/**
 * A postcard to write on. Sending it opens the visitor's own mail app with
 * the message already written out, so nothing is stored or sent from here.
 */
export function Postcard({ email }: { email: string }) {
  const id = useId();
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");

  const from = name.trim();
  const subject = from ? `A postcard from ${from}` : "A postcard from your site";
  const body = [message.trim(), from].filter(Boolean).join("\n\n");
  const href = `mailto:${email}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ""}`;

  return (
    <form
      className="postcard"
      onSubmit={(e) => {
        e.preventDefault();
        window.location.href = href;
      }}
    >
      <div className="postcard-message">
        <label htmlFor={`${id}-message`} className="postcard-label">
          Write me a postcard
        </label>
        <textarea
          id={`${id}-message`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={600}
          placeholder="What are you building? What should I play next?"
        />
      </div>

      <div className="postcard-side">
        <svg className="postcard-stamp" viewBox="0 0 168 96" aria-hidden="true" focusable="false">
          {/* Postmark */}
          <g fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.5">
            <circle cx="42" cy="50" r="30" />
            <circle cx="42" cy="50" r="19" />
            <path d="M70 34q10-6 20 0t20 0M72 46q10-6 20 0t20 0M72 58q10-6 20 0t20 0M70 70q10-6 20 0t20 0" />
          </g>
          <text x="42" y="55" textAnchor="middle" fontSize="15" fill="currentColor" opacity="0.6" style={{ fontFamily: "var(--font-archivo), sans-serif", fontStretch: "125%", fontWeight: 800 }}>
            LA
          </text>
          {/* Stamp: the last zone of the page, in miniature */}
          <g transform="rotate(3 132 48)">
            <rect x="102" y="8" width="60" height="78" fill={PAPER} />
            <rect x="107" y="13" width="50" height="68" fill="#ffb45e" />
            <circle cx="140" cy="38" r="11" fill="#fff1c9" />
            <path d="M107 50q12-9 25-2t25-4v37h-50Z" fill="#c2521f" />
            <path d="M107 61q14-8 26-1t24-5v26h-50Z" fill="#8a2c16" />
            <path d="M107 72q11-6 24-1t26-3v13h-50Z" fill="#4d110d" />
            <rect x="102" y="8" width="60" height="78" fill="none" stroke="var(--postcard-paper)" strokeWidth="5" strokeDasharray="0.1 6.9" strokeLinecap="round" />
            <rect x="102" y="8" width="60" height="78" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.18" />
          </g>
        </svg>

        <p className="postcard-to">
          <span>To</span>
          Franklin Cheng
          <br />
          Los Angeles, California
        </p>

        <label className="postcard-from">
          <span>From</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" maxLength={80} />
        </label>

        <div className="postcard-send">
          {/* A real link, so it works before scripts load and the address can be copied. */}
          <a className="btn btn-solid" href={href}>
            Send it
          </a>
          <p>Opens your mail app with this written out.</p>
        </div>
      </div>
    </form>
  );
}
