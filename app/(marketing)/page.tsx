'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function MarketingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="bg-muted/30 py-20 text-center px-4">
        <h1 className="text-5xl font-extrabold mb-4 text-primary">MeetSpace</h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Professional Video Meetings for Teams, Businesses & Collaboration. Secure, HD, and easy to use.
        </p>
        <div className="flex justify-center space-x-4">
          <Link href="/signup">
            <Button size="lg">Start Meeting</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg">Join Meeting</Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 md:px-8 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12 text-primary">Why Choose MeetSpace?</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">HD Video Meetings</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Crystal clear video and audio for seamless communication.</CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Secure Authentication</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Enterprise-grade security to keep your meetings private.</CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Screen Sharing</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Share your work instantly with all participants.</CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Live Chat</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">In-meeting messaging for links, notes, and quick chats.</CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Meeting History</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Easily track and revisit past meetings from your dashboard.</CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Shareable Links</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Invite participants with a simple click-to-join URL.</CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Multi-Participant</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Host large team syncs or one-on-one sessions.</CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Cross Device</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Join from desktop, tablet, or mobile seamlessly.</CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-muted/30 py-16">
        <div className="max-w-4xl mx-auto px-4 md:px-8">
          <h2 className="text-3xl font-bold text-center mb-12 text-primary">How It Works</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 text-center">
            <div>
              <div className="bg-accent text-accent-foreground rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 font-bold">1</div>
              <p className="font-medium">Sign up or log in</p>
            </div>
            <div>
              <div className="bg-accent text-accent-foreground rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 font-bold">2</div>
              <p className="font-medium">Create a new meeting</p>
            </div>
            <div>
              <div className="bg-accent text-accent-foreground rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 font-bold">3</div>
              <p className="font-medium">Share the meeting link</p>
            </div>
            <div>
              <div className="bg-accent text-accent-foreground rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 font-bold">4</div>
              <p className="font-medium">Participants join instantly</p>
            </div>
            <div>
              <div className="bg-accent text-accent-foreground rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 font-bold">5</div>
              <p className="font-medium">Collaborate seamlessly</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-4 md:px-8 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8 text-primary">Trusted by Teams</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <p className="italic text-muted-foreground">"MeetSpace is the most reliable video platform we&apos;ve used for our daily standups."</p>
              <p className="mt-4 font-medium text-right text-foreground">— Alex, Engineering Manager</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <p className="italic text-muted-foreground">&quot;The UI is clean and sharing links is effortless. Perfect for remote teams.&quot;</p>
              <p className="mt-4 font-medium text-right text-foreground">— Maya, Product Designer</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pricing (UI only) */}
      <section className="bg-muted/20 py-16">
        <div className="max-w-4xl mx-auto px-4 md:px-8 text-center">
          <h2 className="text-3xl font-bold mb-8 text-primary">Simple Pricing</h2>
          <div className="flex flex-col sm:flex-row justify-center items-center space-y-6 sm:space-y-0 sm:space-x-6">
            <Card className="w-72 border-border bg-card">
              <CardHeader>
                <CardTitle>Basic</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold mb-4">$0</p>
                <ul className="text-left space-y-2 mb-6 text-muted-foreground text-sm">
                  <li>• Unlimited 1-on-1 meetings</li>
                  <li>• 40-minute group limit</li>
                  <li>• Screen sharing</li>
                </ul>
                <Button variant="outline" className="w-full" disabled>
                  Current Plan
                </Button>
              </CardContent>
            </Card>
            <Card className="w-72 border-primary bg-primary/5 shadow-md">
              <CardHeader>
                <CardTitle className="text-primary">Pro</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold mb-4">$15<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                <ul className="text-left space-y-2 mb-6 text-muted-foreground text-sm">
                  <li>• Unlimited group meetings</li>
                  <li>• Cloud recording</li>
                  <li>• Priority support</li>
                </ul>
                <Link href="/signup">
                  <Button className="w-full">Upgrade</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 md:px-8 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8 text-primary">FAQ</h2>
        <dl className="space-y-6">
          <div>
            <dt className="font-semibold text-lg">Do I need to download an app?</dt>
            <dd className="text-muted-foreground mt-1">No, MeetSpace runs completely in your browser without requiring any downloads or extensions.</dd>
          </div>
          <div>
            <dt className="font-semibold text-lg">Is it secure?</dt>
            <dd className="text-muted-foreground mt-1">Yes, all meetings use enterprise-grade encryption to ensure your data stays private.</dd>
          </div>
        </dl>
      </section>

      {/* CTA */}
      <section className="bg-primary/10 py-20 text-center border-t border-primary/20">
        <h2 className="text-4xl font-bold mb-6 text-primary">Ready to collaborate?</h2>
        <Link href="/signup">
          <Button size="lg" className="px-8 shadow-lg">Start Free Trial</Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t border-border py-8 mt-auto">
        <div className="max-w-6xl mx-auto px-4 md:px-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} MeetSpace. All rights reserved.
        </div>
      </footer>
    </div>
  );
}