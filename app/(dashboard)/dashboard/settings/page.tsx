'use client';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Bell, MonitorSmartphone, Mic, Volume2, Globe } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="flex-1 p-8 pt-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-2">
          Configure your application preferences and device settings.
        </p>
      </div>

      <div className="space-y-6">
        {/* Appearance (Forced Dark Mode) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MonitorSmartphone className="w-5 h-5 text-muted-foreground" />
              Appearance
            </CardTitle>
            <CardDescription>Manage your theme preferences.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">Dark mode is enforced for optimal interview focus.</p>
              </div>
              <div className="px-3 py-1 bg-black text-white text-xs font-medium rounded-full border border-gray-800">
                Dark Mode Active
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-muted-foreground" />
              Notifications
            </CardTitle>
            <CardDescription>Choose what updates you want to receive.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Email Alerts</Label>
                <p className="text-sm text-muted-foreground">Receive interview results and tips via email.</p>
              </div>
              <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Marketing</Label>
                <p className="text-sm text-muted-foreground">Receive offers and platform updates.</p>
              </div>
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
            </div>
          </CardContent>
        </Card>

        {/* Devices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-muted-foreground" />
              Audio Devices
            </CardTitle>
            <CardDescription>Select your default microphone and speaker.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="mic" className="flex items-center gap-2"><Mic className="w-4 h-4"/> Microphone</Label>
              <select id="mic" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <option>Default - MacBook Pro Microphone</option>
                <option>External USB Mic</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="speaker" className="flex items-center gap-2"><Volume2 className="w-4 h-4"/> Speaker</Label>
              <select id="speaker" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <option>Default - MacBook Pro Speakers</option>
                <option>External Headphones</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-muted-foreground" />
              Language & Region
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="language">Interface Language</Label>
              <select id="language" className="flex h-10 w-full md:w-1/2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <option>English (US)</option>
                <option>English (UK)</option>
                <option>Spanish</option>
                <option>French</option>
              </select>
            </div>
          </CardContent>
          <CardFooter className="border-t pt-4 flex justify-end">
            <Button>Save Settings</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
