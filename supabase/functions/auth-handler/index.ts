import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getErrorMessage } from "../_shared/errors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, email, password } = await req.json();

    if (action === "login") {
      const { data: users } = await supabase
        .from("auth_users")
        .select("*")
        .eq("email", email.toLowerCase())
        .eq("active", true)
        .limit(1);

      const user = users?.[0];
      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid credentials" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const passwordHash = await hashPassword(password);
      if (passwordHash !== user.password_hash) {
        return new Response(JSON.stringify({ error: "Invalid credentials" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("auth_users")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", user.id);

      const sessionToken = crypto.randomUUID();

      await supabase.from("user_sessions").insert({
        user_id: user.id,
        token: sessionToken,
      });

      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id, user_groups(name, color, permissions)")
        .eq("user_id", user.id);

      const groups = (memberships || []).map((m: any) => ({
        id: m.group_id,
        name: m.user_groups?.name,
        color: m.user_groups?.color,
        permissions: m.user_groups?.permissions || [],
      }));

      return new Response(
        JSON.stringify({
          user: { id: user.id, email: user.email, role: user.role },
          groups,
          sessionToken,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "register") {
      const { data: existing } = await supabase
        .from("auth_users")
        .select("id")
        .eq("email", email.toLowerCase())
        .limit(1);

      if ((existing?.length ?? 0) > 0) {
        return new Response(JSON.stringify({ error: "Email already registered" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const passwordHash = await hashPassword(password);

      const { data: newUser } = await supabase
        .from("auth_users")
        .insert({ email: email.toLowerCase(), password_hash: passwordHash })
        .select()
        .single();

      const { data: viewersGroup } = await supabase
        .from("user_groups")
        .select("id")
        .eq("name", "Viewers")
        .single();

      if (viewersGroup) {
        await supabase.from("group_members").insert({
          user_id: newUser.id,
          group_id: viewersGroup.id,
        });
      }

      return new Response(
        JSON.stringify({ user: { id: newUser.id, email: newUser.email, role: newUser.role } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "validate-session") {
      const { sessionToken } = await req.json();

      const { data: session } = await supabase
        .from("user_sessions")
        .select("user_id, auth_users(id, email, role)")
        .eq("token", sessionToken)
        .single();

      if (!session) {
        return new Response(JSON.stringify({ valid: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          valid: true,
          user: session.auth_users,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
