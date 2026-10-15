"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AiSwitch } from "./AiSwitch";
import { SEAT_WORDS } from "../../lib/plain-words";
import type { AiMode } from "../../lib/ai-mode";

/**
 * The seat switcher, the AI switch (S15) and Reset demo (S20). There is no
 * building switcher: Building B is a card, not a seat (S2).
 *
 * Seats go by their plain names (D1), and Reset demo shows it is working
 * until the page reloads: the button is marked busy and cannot fire twice.
 */
const SEATS = [
  { id: "tenant", label: SEAT_WORDS.tenant },
  { id: "technician", label: SEAT_WORDS.technician },
  { id: "senior-manager", label: SEAT_WORDS["senior-manager"] },
  { id: "hq", label: SEAT_WORDS.hq },
  { id: "aom-tower-a", label: SEAT_WORDS["aom-tower-a"] },
] as const;

export function TopBar({ aiMode }: { aiMode: AiMode }) {
  const pathname = usePathname();
  const [resetting, setResetting] = useState(false);

  const resetDemo = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      await fetch("/api/reset", { method: "POST" });
    } finally {
      window.location.reload();
    }
  };

  return (
    <header className="topbar">
      <div className="brand">
        Pill Desk <small>working name</small>
      </div>
      <nav aria-label="Seat switcher">
        {SEATS.map((seat) => (
          <Link
            key={seat.id}
            href={`/seat/${seat.id}`}
            className={pathname === `/seat/${seat.id}` ? "on" : ""}
          >
            {seat.label}
          </Link>
        ))}
      </nav>
      <AiSwitch mode={aiMode} />
      <button
        className={resetting ? "reset-btn is-pending" : "reset-btn"}
        onClick={resetDemo}
        disabled={resetting}
        aria-busy={resetting || undefined}
      >
        {resetting ? "Resetting" : "Reset demo"}
      </button>
    </header>
  );
}
