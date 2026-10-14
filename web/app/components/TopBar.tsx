"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AiSwitch } from "./AiSwitch";
import type { AiMode } from "../../lib/ai-mode";

/**
 * The seat switcher, the AI switch (S15) and Reset demo (S20). There is no
 * building switcher: Building B is a card, not a seat (S2).
 */
const SEATS = [
  { id: "tenant", label: "Tenant" },
  { id: "technician", label: "Technician" },
  { id: "senior-manager", label: "Senior manager" },
  { id: "hq", label: "HQ" },
  { id: "aom-tower-a", label: "AOM Tower A" },
] as const;

export function TopBar({ aiMode }: { aiMode: AiMode }) {
  const pathname = usePathname();

  const resetDemo = async () => {
    await fetch("/api/reset", { method: "POST" });
    window.location.reload();
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
      <button className="reset-btn" onClick={resetDemo}>
        Reset demo
      </button>
    </header>
  );
}
