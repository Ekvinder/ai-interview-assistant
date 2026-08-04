import { WhiteboardScene } from "@/types/whiteboard";

export function serializeScene(
  scene: WhiteboardScene
) {
  return JSON.stringify(scene);
}

export function deserializeScene(
  value: string
): WhiteboardScene {

  return JSON.parse(value);

}