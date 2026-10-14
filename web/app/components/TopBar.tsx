"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The seat switcher and Reset demo (S20). There is no building switcher:
 * Building B is a card, not a seat (S2).
 */
const SEATS = [
  { id: "tenant", label: "Tenant" },
  { id: "technician", label: "Technician" },
  { id: "senior-manager", label: "Senior manager" },
  { id: "hq", label: "HQ" },
  { id: "aom-tower-a", label: "AOM Tower A" },
] as const;

export function TopBar() {
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
      <button className="reset-btn" onClick={resetDemo}>
        Reset demo
      </button>
    </header>
  );
}
