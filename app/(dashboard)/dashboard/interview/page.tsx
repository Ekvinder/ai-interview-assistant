"use client";

import { useEffect, useState } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import "@livekit/components-styles";

export default function InterviewPage() {
  const [token, setToken] = useState("");

  useEffect(() => {
    async function getToken() {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomName: "frontend-interview",
          identity: "ekvinder",
        }),
      });

      const data = await res.json();

      setToken(data.token);
    }

    getToken();
  }, []);

  if (!token) {
    return <p>Connecting...</p>;
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL!}
      connect={true}
      audio={true}
      video={false}
    >
      <h1>Connected to LiveKit 🎉</h1>
    </LiveKitRoom>
  );
}