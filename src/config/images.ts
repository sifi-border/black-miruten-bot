import path from "node:path";
import { messages } from "../messages";

export interface BubbleImageConfig {
  id: string;
  label: string;
  /** リポジトリルートからの相対パス */
  path: string;
}

// src/config/images.ts から見てリポジトリルートは2階層上
const REPO_ROOT = path.resolve(__dirname, "..", "..");

export const DEFAULT_IMAGE_ID = "default";

export const BUBBLE_IMAGES: BubbleImageConfig[] = [
  { id: "default", label: messages.images.defaultLabel, path: "assets/images/character.png" },
];

export function getImageById(id: string): BubbleImageConfig | undefined {
  return BUBBLE_IMAGES.find((image) => image.id === id);
}

export function resolveImageAbsolutePath(image: BubbleImageConfig): string {
  return path.resolve(REPO_ROOT, image.path);
}
