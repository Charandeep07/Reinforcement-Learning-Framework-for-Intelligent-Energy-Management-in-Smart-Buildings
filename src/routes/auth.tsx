import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SmartGrid RL" },
      { name: "description", content: "Sign in or create an account to use the SmartGrid RL building energy simulator." },
      { property: "og:title", content: "Sign in — SmartGrid RL" },
      { property: "og:description", content: "Access your simulated smart buildings and RL experiments." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard", replace: true });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + "/dashboard", data: { display_name: name } },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (data.session) navigate({ to: "/dashboard", replace: true });
    else setSent(true);
  };

  return (
    <div className="grid min-h-screen bg-hero place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-card-foreground shadow-card">
        <Link to="/" className="mb-6 flex items-center gap-2 font-display text-lg font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="size-4" />
          </span>
          SmartGrid RL
        </Link>
        {sent ? (
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Check your email</h1>
            <p className="text-sm text-muted-foreground">We sent a confirmation link to {email}. Click it to activate your account, then sign in.</p>
            <Button variant="outline" className="mt-4" onClick={() => setSent(false)}>Back to sign in</Button>
          </div>
        ) : (
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Register</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={signIn} className="mt-4 space-y-4">
                <Field id="e1" label="Email" type="email" value={email} onChange={setEmail} />
                <Field id="p1" label="Password" type="password" value={password} onChange={setPassword} />
                <Button className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Sign in</Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={signUp} className="mt-4 space-y-4">
                <Field id="n2" label="Display name" value={name} onChange={setName} />
                <Field id="e2" label="Email" type="email" value={email} onChange={setEmail} />
                <Field id="p2" label="Password (min 6 chars)" type="password" value={password} onChange={setPassword} />
                <Button className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Create account</Button>
              </form>
            </TabsContent>
          </Tabs>
        )}
        <p className="mt-6 text-xs text-muted-foreground">A demo building with 14 days of simulated history is created on your first login.</p>
      </div>
    </div>
  );
}

function Field({ id, label, type = "text", value, onChange }: { id: string; label: string; type?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} required value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
