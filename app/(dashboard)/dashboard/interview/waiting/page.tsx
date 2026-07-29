'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Mic, Volume2, Wifi, Bot, VideoOff } from 'lucide-react';

export default function WaitingRoomPage() {
  const router = useRouter();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-muted/10 h-full">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Waiting Room</h2>
        <p className="text-muted-foreground mt-2">
          Check your equipment before joining the interview.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 w-full max-w-5xl">
        <div className="md:col-span-2">
          <Card className="overflow-hidden bg-black aspect-video flex items-center justify-center border-muted">
            <div className="text-center text-muted-foreground flex flex-col items-center">
              <VideoOff className="h-12 w-12 mb-4 opacity-50" />
              <p>Camera is off</p>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">Status</h3>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Camera</span>
                </div>
                <Badge variant="outline" className="text-yellow-500 bg-yellow-500/10">Disabled</Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Microphone</span>
                </div>
                <Badge variant="outline" className="text-emerald-500 bg-emerald-500/10">Ready</Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Speaker</span>
                </div>
                <Badge variant="outline" className="text-emerald-500 bg-emerald-500/10">Ready</Badge>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Connection</span>
                </div>
                <Badge variant="outline" className="text-emerald-500 bg-emerald-500/10">Excellent</Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">AI Agent</span>
                </div>
                <Badge variant="outline" className="text-blue-500 bg-blue-500/10">Initializing</Badge>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => router.push('/dashboard')}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1"
              onClick={() => router.push('/dashboard/interview/demo')}
            >
              Join Interview
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
