import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller } } = await supabaseUser.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, ...params } = await req.json();

    // search_users is available to all authenticated users
    if (action === 'search_users') {
      const { query: searchQuery } = params;
      if (!searchQuery || searchQuery.length < 1) {
        return new Response(JSON.stringify({ users: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 100 });
      if (error) throw error;

      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, display_name');
      const profileMap: Record<string, string> = {};
      for (const p of profiles || []) {
        if (p.display_name) profileMap[p.id] = p.display_name;
      }

      const lowerQ = searchQuery.toLowerCase();
      const matches = users
        .filter(u => u.id !== caller.id)
        .filter(u => {
          const email = (u.email || '').toLowerCase();
          const name = (profileMap[u.id] || '').toLowerCase();
          return email.includes(lowerQ) || name.includes(lowerQ);
        })
        .slice(0, 10)
        .map(u => ({
          user_id: u.id,
          display_name: profileMap[u.id] || u.email?.split('@')[0] || u.id,
          email: u.email,
        }));

      return new Response(JSON.stringify({ users: matches }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // All other actions require admin
    const { data: callerRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id);

    const isAdmin = callerRoles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    switch (action) {
      case 'list_users': {
        const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({
          perPage: 100,
        });
        if (error) throw error;

        const { data: allRoles } = await supabaseAdmin
          .from('user_roles')
          .select('user_id, role');

        const roleMap: Record<string, string[]> = {};
        for (const r of allRoles || []) {
          if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
          roleMap[r.user_id].push(r.role);
        }

        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id, display_name, avatar_url');

        const profileMap: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
        for (const p of profiles || []) {
          profileMap[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
        }

        const result = users.map(u => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          roles: roleMap[u.id] || ['user'],
          display_name: profileMap[u.id]?.display_name || null,
          avatar_url: profileMap[u.id]?.avatar_url || null,
          banned_until: u.banned_until || null,
        }));

        return new Response(JSON.stringify({ users: result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'set_role': {
        const { user_id, role, remove } = params;
        if (!user_id || !role) throw new Error('user_id and role required');

        if (remove) {
          await supabaseAdmin
            .from('user_roles')
            .delete()
            .eq('user_id', user_id)
            .eq('role', role);
        } else {
          await supabaseAdmin
            .from('user_roles')
            .upsert({ user_id, role }, { onConflict: 'user_id,role' });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update_user': {
        const { user_id, email, display_name } = params;
        if (!user_id) throw new Error('user_id required');

        // Update email in auth if provided
        if (email) {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { email });
          if (error) throw error;
        }

        // Update display name in profiles if provided
        if (display_name !== undefined) {
          const { error } = await supabaseAdmin
            .from('profiles')
            .update({ display_name, updated_at: new Date().toISOString() })
            .eq('id', user_id);
          if (error) throw error;
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'reset_password': {
        const { user_id, new_password } = params;
        if (!user_id || !new_password) throw new Error('user_id and new_password required');
        if (new_password.length < 6) throw new Error('Password must be at least 6 characters');

        const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
          password: new_password,
        });
        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'create_user': {
        const { email, password, role: newUserRole } = params;
        if (!email || !password) throw new Error('email and password required');
        if (password.length < 6) throw new Error('Password must be at least 6 characters');

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (createError) throw createError;

        if (newUserRole && newUserRole !== 'user') {
          await supabaseAdmin
            .from('user_roles')
            .upsert({ user_id: newUser.user.id, role: newUserRole }, { onConflict: 'user_id,role' });
        }

        return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete_user': {
        const { user_id } = params;
        if (!user_id) throw new Error('user_id required');
        if (user_id === caller.id) throw new Error('Cannot delete yourself');

        const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'ban_user': {
        const { user_id, duration } = params;
        if (!user_id) throw new Error('user_id required');
        if (user_id === caller.id) throw new Error('Cannot ban yourself');

        // duration: e.g. "24h", "7d", "none" to unban
        const ban_duration = duration === 'none' ? 'none' : (duration || '876000h');
        const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
          ban_duration,
        });
        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'add_group_member': {
        const { group_id, user_id } = params;
        if (!group_id || !user_id) throw new Error('group_id and user_id required');

        // Get the group's roles
        const { data: group, error: groupErr } = await supabaseAdmin
          .from('role_groups')
          .select('roles')
          .eq('id', group_id)
          .single();
        if (groupErr) throw groupErr;

        // Insert membership
        const { error: memberErr } = await supabaseAdmin
          .from('role_group_members')
          .insert({ group_id, user_id });
        if (memberErr) {
          if (memberErr.message.includes('duplicate')) throw new Error('User already in this group');
          throw memberErr;
        }

        // Sync all group roles to user_roles
        for (const role of (group.roles || [])) {
          await supabaseAdmin
            .from('user_roles')
            .upsert({ user_id, role }, { onConflict: 'user_id,role' });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'remove_group_member': {
        const { member_id, user_id, group_id } = params;
        if (!member_id || !user_id || !group_id) throw new Error('member_id, user_id, and group_id required');

        // Get the roles of the group being removed from
        const { data: removedGroup } = await supabaseAdmin
          .from('role_groups')
          .select('roles')
          .eq('id', group_id)
          .single();

        // Delete the membership
        const { error: delErr } = await supabaseAdmin
          .from('role_group_members')
          .delete()
          .eq('id', member_id);
        if (delErr) throw delErr;

        // Get all OTHER groups the user still belongs to
        const { data: remainingMemberships } = await supabaseAdmin
          .from('role_group_members')
          .select('group_id')
          .eq('user_id', user_id);

        // Collect all roles the user should still have from other groups
        const protectedRoles = new Set<string>();
        if (remainingMemberships && remainingMemberships.length > 0) {
          const otherGroupIds = remainingMemberships.map(m => m.group_id);
          const { data: otherGroups } = await supabaseAdmin
            .from('role_groups')
            .select('roles')
            .in('id', otherGroupIds);
          for (const g of otherGroups || []) {
            for (const r of g.roles || []) protectedRoles.add(r);
          }
        }

        // Revoke roles from the removed group that aren't protected by other groups
        const rolesToRevoke = (removedGroup?.roles || []).filter((r: string) => !protectedRoles.has(r));
        for (const role of rolesToRevoke) {
          await supabaseAdmin
            .from('user_roles')
            .delete()
            .eq('user_id', user_id)
            .eq('role', role);
        }

        return new Response(JSON.stringify({ success: true, revoked_roles: rolesToRevoke }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'sync_group_roles': {
        const { group_id } = params;
        if (!group_id) throw new Error('group_id required');

        // Get the group's current roles
        const { data: grp, error: grpErr } = await supabaseAdmin
          .from('role_groups')
          .select('roles')
          .eq('id', group_id)
          .single();
        if (grpErr) throw grpErr;
        const groupRoles: string[] = grp.roles || [];

        // Get all members of this group
        const { data: grpMembers } = await supabaseAdmin
          .from('role_group_members')
          .select('user_id')
          .eq('group_id', group_id);
        const memberUserIds = (grpMembers || []).map((m: any) => m.user_id);
        if (memberUserIds.length === 0) {
          return new Response(JSON.stringify({ success: true, synced: 0 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // For each member, get all their group memberships to compute the full set of roles they should have
        for (const uid of memberUserIds) {
          // Get all groups this user belongs to
          const { data: userMemberships } = await supabaseAdmin
            .from('role_group_members')
            .select('group_id')
            .eq('user_id', uid);
          const userGroupIds = (userMemberships || []).map((m: any) => m.group_id);

          // Get all roles from all groups
          const { data: userGroups } = await supabaseAdmin
            .from('role_groups')
            .select('roles')
            .in('id', userGroupIds);
          const expectedRoles = new Set<string>();
          for (const g of userGroups || []) {
            for (const r of g.roles || []) expectedRoles.add(r);
          }

          // Get current user_roles
          const { data: currentRoles } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', uid);
          const currentSet = new Set((currentRoles || []).map((r: any) => r.role));

          // Add missing roles
          for (const role of expectedRoles) {
            if (!currentSet.has(role)) {
              await supabaseAdmin
                .from('user_roles')
                .upsert({ user_id: uid, role }, { onConflict: 'user_id,role' });
            }
          }

          // Remove roles that no group grants (only roles that were part of any group)
          // We only revoke roles that are NOT in expectedRoles but ARE granted by some group
          // To be safe, we only remove roles that the OLD version of this group had but no group now grants
          // Since we don't know the old roles, we simply ensure expectedRoles are present
          // and remove roles not in expectedRoles that this specific group previously granted
          // For simplicity: reconcile all group-sourced roles
          const allPossibleGroupRoles = new Set<string>();
          const { data: allGroups } = await supabaseAdmin.from('role_groups').select('roles');
          for (const g of allGroups || []) {
            for (const r of g.roles || []) allPossibleGroupRoles.add(r);
          }

          for (const cr of currentSet) {
            if (allPossibleGroupRoles.has(cr) && !expectedRoles.has(cr)) {
              // This role is a "group role" but no group grants it to this user anymore
              await supabaseAdmin
                .from('user_roles')
                .delete()
                .eq('user_id', uid)
                .eq('role', cr);
            }
          }
        }

        return new Response(JSON.stringify({ success: true, synced: memberUserIds.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
