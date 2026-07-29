'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Mic, MicOff, Volume2, PhoneOff, Wifi, Clock, Bot, User, MessageSquare } from 'lucide-react';

export default function InterviewRoomPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  const handleEndInterview = () => {
    router.push(`/dashboard/interview/result/${params.id}`);
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-muted/20">
        <div className="flex items-center gap-4">
          <h1 className="font-semibold">Frontend Engineer Interview</h1>
          <Badge variant="outline" className="gap-2 bg-emerald-500/10 text-emerald-500">
            <Wifi className="w-3 h-3" />
            Connected
          </Badge>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="font-mono">14:59</span>
          </div>
          <Badge className="bg-blue-500 text-white">AI: Ready</Badge>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Center Stage */}
        <div className="flex-1 flex flex-col p-6">
          <div className="flex-1 flex flex-col items-center justify-center gap-12 relative">
            
            {/* AI Avatar */}
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 rounded-full animate-ping bg-primary/20 scale-150" />
                <Avatar className="w-32 h-32 border-4 border-primary/20 shadow-xl relative z-10">
                  <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
                    <Bot className="w-16 h-16" />
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="flex gap-1 h-8 items-center">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-2 bg-primary rounded-full animate-pulse" style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            </div>

            {/* User Avatar */}
            <div className="flex flex-col items-center gap-6 absolute bottom-12 right-12">
              <Avatar className="w-24 h-24 border-2 border-muted shadow-lg">
                <AvatarFallback className="bg-muted text-muted-foreground text-2xl">
                  <User className="w-10 h-10" />
                </AvatarFallback>
              </Avatar>
              <div className="flex gap-1 h-4 items-center">
                <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                <div className="w-1 h-1 bg-muted-foreground rounded-full" />
              </div>
            </div>

          </div>

          {/* Bottom Controls */}
          <div className="h-20 bg-muted/40 rounded-2xl flex items-center justify-center gap-4 border">
            <Button variant="secondary" size="icon" className="w-12 h-12 rounded-full">
              <Mic className="w-5 h-5" />
            </Button>
            <Button variant="secondary" size="icon" className="w-12 h-12 rounded-full">
              <Volume2 className="w-5 h-5" />
            </Button>
            <Button variant="destructive" size="icon" className="w-12 h-12 rounded-full" onClick={handleEndInterview}>
              <PhoneOff className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Right Sidebar - Transcript */}
        <div className="w-96 border-l bg-muted/10 flex flex-col">
          <div className="p-4 border-b flex items-center justify-between bg-background">
            <h3 className="font-semibold flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Live Transcript
            </h3>
            <div className="flex gap-2 text-xs">
              <Badge variant="outline" className="text-muted-foreground">Listening...</Badge>
            </div>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto space-y-6">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">AI Interviewer</span>
              <Card className="p-3 bg-muted border-none rounded-tl-none">
                Hello! I'm your AI interviewer today. Are you ready to begin?
              </Card>
            </div>
            
            <div className="flex flex-col gap-2 items-end">
              <span className="text-xs font-medium text-muted-foreground">You</span>
              <Card className="p-3 bg-primary text-primary-foreground border-none rounded-tr-none">
                Yes, I'm ready. Let's start.
              </Card>
            </div>
            
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">AI Interviewer</span>
              <Card className="p-3 bg-muted border-none rounded-tl-none">
                Great. Let's start with a brief introduction. Could you tell me about your recent experience with React?
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
