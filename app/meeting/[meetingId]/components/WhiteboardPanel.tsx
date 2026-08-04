"use client";

import { X, Lock, Unlock } from "lucide-react";

import { Button } from "@/components/ui/button";

import WhiteboardCanvas from "./WhiteboardCanvas";

import { WhiteboardPanelProps,} from "@/types/whiteboard";
import { getReadOnlyState } from "@/utils/whiteboard";

export default function WhiteboardPanel({
  meetingId,
  isHost,
  whiteboardLocked,
  onToggleLock,
  onClose,
}: WhiteboardPanelProps) {

  const readOnly = getReadOnlyState(
    isHost,
    whiteboardLocked
  );

  return (
    <aside
      className="
        fixed
        inset-y-0
        right-0
        z-30
        w-full
        bg-background
        border-l
        flex
        flex-col
        sm:static
      "
    >
      <div className="flex items-center justify-between border-b px-4 py-3">

        <div>

          <h2 className="font-semibold">
            Whiteboard
          </h2>

          <p className="text-xs text-muted-foreground">
            Meeting ID : {meetingId}
          </p>

        </div>

        <div className="flex gap-2">

          {isHost && (

            <Button
              variant="outline"
              size="icon"
              onClick={onToggleLock}
            >
              {whiteboardLocked
                ? <Lock className="w-4 h-4" />
                : <Unlock className="w-4 h-4" />}
            </Button>

          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>

        </div>

      </div>

      <div className="flex-1 overflow-hidden">

        <WhiteboardCanvas
          readOnly={readOnly}
        />

      </div>

    </aside>
  );
}