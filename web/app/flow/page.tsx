import { FlowView } from "../components/flow/FlowView";
import { VideoPlayer } from "../components/VideoPlayer";
import { flowView } from "../../lib/flow";
import { videoOnDisk } from "../../lib/video";

export const dynamic = "force-dynamic";

export const metadata = { title: "How a job flows · Pill Desk" };

/**
 * How a job flows (D4): the one-page flow diagram as a page in the app's own
 * look, with the 6-minute video. Read at request time, so the video line is
 * true for this copy of the demo.
 */
export default function Flow() {
  return <FlowView flow={flowView()} video={<VideoPlayer available={videoOnDisk()} />} />;
}
