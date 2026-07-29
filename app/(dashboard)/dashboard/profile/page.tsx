'use client';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Mail, Shield, BarChart2 } from 'lucide-react';

export default function ProfilePage() {
  return (
    <div className="flex-1 p-8 pt-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Profile</h2>
        <p className="text-muted-foreground mt-2">
          Manage your personal information and account security.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Column - Avatar & Stats */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <Avatar className="w-24 h-24 mb-4">
                <AvatarImage src="" />
                <AvatarFallback className="text-3xl bg-primary/10 text-primary">JD</AvatarFallback>
              </Avatar>
              <h3 className="font-semibold text-lg">Jane Doe</h3>
              <p className="text-sm text-muted-foreground">jane@example.com</p>
              <Button variant="outline" className="mt-4 w-full">Change Picture</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-md flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-muted-foreground" />
                Your Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Interviews</span>
                <span className="font-semibold">12</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg Score</span>
                <span className="font-semibold">84%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Forms */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-muted-foreground" />
                Personal Information
              </CardTitle>
              <CardDescription>Update your basic profile details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" defaultValue="Jane Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" defaultValue="jane@example.com" disabled className="bg-muted/50" />
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email cannot be changed.
                </p>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button>Save Changes</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-muted-foreground" />
                Security
              </CardTitle>
              <CardDescription>Change your password.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">Current Password</Label>
                <Input id="current" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new">New Password</Label>
                <Input id="new" type="password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm New Password</Label>
                <Input id="confirm" type="password" />
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button variant="secondary">Update Password</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
