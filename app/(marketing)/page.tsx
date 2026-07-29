'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function MarketingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="bg-muted/30 py-20 text-center">
        <h1 className="text-5xl font-extrabold mb-4">AI Interview Assistant</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Practice, evaluate, and improve your interview skills with AI.
        </p>
        <div className="flex justify-center space-x-4">
          <Link href="/login">
            <Button variant="ghost">Login</Button>
          </Link>
          <Link href="/signup">
            <Button>Get Started</Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 md:px-8 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">Features</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-muted/20 border-none">
            <CardHeader>
              <CardTitle>Live AI Coaching</CardTitle>
            </CardHeader>
            <CardContent>Real‑time feedback powered by Gemini Live.</CardContent>
          </Card>
          <Card className="bg-muted/20 border-none">
            <CardHeader>
              <CardTitle>Instant Scoring</CardTitle>
            </CardHeader>
            <CardContent>Automatic evaluation and detailed report.</CardContent>
          </Card>
          <Card className="bg-muted/20 border-none">
            <CardHeader>
              <CardTitle>Collaborative Sessions</CardTitle>
            </CardHeader>
            <CardContent>Practice with peers via LiveKit rooms.</CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-muted/30 py-16">
        <div className="max-w-4xl mx-auto px-4 md:px-8">
          <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
          <ol className="list-decimal list-inside space-y-4 text-lg">
            <li>Create an interview scenario that matches your target role.</li>
            <li>Enter the waiting room – AI prepares the interview.</li>
            <li>Answer questions in real time; AI evaluates your responses.</li>
            <li>Receive a detailed score report and actionable feedback.</li>
          </ol>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-4 md:px-8 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">What Our Users Say</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-none bg-muted/20">
            <CardContent className="pt-6">
              <p className="italic">"The AI feedback helped me land my dream job!"</p>
              <p className="mt-4 font-medium text-right">— Alex, Frontend Engineer</p>
            </CardContent>
          </Card>
          <Card className="border-none bg-muted/20">
            <CardContent className="pt-6">
              <p className="italic">"Practicing with the platform boosted my confidence dramatically."</p>
              <p className="mt-4 font-medium text-right">— Maya, Backend Engineer</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pricing (UI only) */}
      <section className="bg-muted/20 py-16">
        <div className="max-w-4xl mx-auto px-4 md:px-8 text-center">
          <h2 className="text-3xl font-bold mb-8">Pricing</h2>
          <div className="flex justify-center space-x-6">
            <Card className="w-72 border-none bg-muted/30">
              <CardHeader>
                <CardTitle>Free</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold mb-4">$0</p>
                <ul className="text-left space-y-2 mb-4">
                  <li>• Basic interview sessions</li>
                  <li>• Limited AI feedback</li>
                </ul>
                <Button variant="outline" disabled>
                  Current Plan
                </Button>
              </CardContent>
            </Card>
            <Card className="w-72 border-none bg-muted/30">
              <CardHeader>
                <CardTitle>Pro</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold mb-4">$19/mo</p>
                <ul className="text-left space-y-2 mb-4">
                  <li>• Unlimited interviews</li>
                  <li>• Detailed reports</li>
                  <li>• Priority support</li>
                </ul>
                <Link href="/signup">
                  <Button>Upgrade</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 md:px-8 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">FAQ</h2>
        <dl className="space-y-4">
          <div>
            <dt className="font-medium">Is my data stored?</dt>
            <dd className="text-muted-foreground">Only anonymized metrics are kept for improvement.</dd>
          </div>
          <div>
            <dt className="font-medium">Can I try it for free?</dt>
            <dd className="text-muted-foreground">Yes, the free tier offers unlimited practice sessions.</dd>
          </div>
        </dl>
      </section>

      {/* CTA */}
      <section className="bg-primary/10 py-20 text-center">
        <h2 className="text-4xl font-bold mb-6">Ready to ace your next interview?</h2>
        <Link href="/signup">
          <Button size="lg">Start Now</Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="bg-muted/30 py-6">
        <div className="max-w-6xl mx-auto px-4 md:px-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} AI Interview Assistant. All rights reserved.
        </div>
      </footer>
    </div>
  );
}