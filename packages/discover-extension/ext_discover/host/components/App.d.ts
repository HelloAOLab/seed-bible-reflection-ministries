import "./app.css";
import type { SeedBibleState } from "@packages/seed-bible/seed-bible/managers";
import type { DiscoverState } from "../managers/discoverManager";
interface DiscoverProps {
  state: DiscoverState;
  context: SeedBibleState;
}
export declare function DiscoverContent({
  state,
  context,
}: DiscoverProps): import("preact").JSX.Element;
export {};
