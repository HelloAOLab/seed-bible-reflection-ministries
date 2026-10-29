import { Signal } from "@preact/signals";
import type { DiscoverState } from "../managers";
interface MinistriesTabProps {
  state: DiscoverState;
  cameFromDiscovery: Signal<boolean>;
}
export declare function MinistriesTab({
  state,
}: MinistriesTabProps): import("preact").JSX.Element;
export {};
