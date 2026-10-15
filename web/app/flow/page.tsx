import { FlowView } from "../components/flow/FlowView";
import { flowView } from "../../lib/flow";

export const dynamic = "force-dynamic";

export const metadata = { title: "How a job flows · Pill Desk" };

/**
 * How a job flows (D4): the one-page flow diagram as a page in the app's own
 * look. The 6-minute video lives on home only (YY, 16 Oct).
 */
export default function Flow() {
  return <FlowView flow={flowView()} />;
}
