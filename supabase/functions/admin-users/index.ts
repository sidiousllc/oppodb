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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, ...params } = await req.json();

    // === Public actions (no auth required) ===

    if (action === 'validate_invite') {
      const { token } = params;
      if (!token) throw new Error('token required');

      const { data: invite, error } = await supabaseAdmin
        .from('user_invitations')
        .select('id, email, role, expires_at, used_at')
        .eq('token', token)
        .single();

      if (error || !invite) {
        return new Response(JSON.stringify({ valid: false, error: 'Invalid invite token' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (invite.used_at) {
        return new Response(JSON.stringify({ valid: false, error: 'Invite already used' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (new Date(invite.expires_at) < new Date()) {
        return new Response(JSON.stringify({ valid: false, error: 'Invite has expired' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ valid: true, email: invite.email, role: invite.role }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'submit_access_request') {
      const { email, display_name, reason } = params;
      if (!email) throw new Error('email required');

      // Check if there's already a pending request
      const { data: existing } = await supabaseAdmin
        .from('access_requests')
        .select('id')
        .eq('email', email)
        .eq('status', 'pending')
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ success: true, message: 'Your request is already pending review.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabaseAdmin
        .from('access_requests')
        .insert({ email, display_name: display_name || null, reason: reason || null });

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, message: 'Access request submitted. An administrator will review it shortly.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'use_invite') {
      const { token, user_id } = params;
      if (!token || !user_id) throw new Error('token and user_id required');

      const { data: invite } = await supabaseAdmin
        .from('user_invitations')
        .select('id, role, used_at, expires_at')
        .eq('token', token)
        .single();

      if (!invite || invite.used_at || new Date(invite.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'Invalid or expired invite' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Mark invite as used
      await supabaseAdmin
        .from('user_invitations')
        .update({ used_at: new Date().toISOString() })
        .eq('id', invite.id);

      // Grant role if not 'user'
      if (invite.role && invite.role !== 'user') {
        await supabaseAdmin
          .from('user_roles')
          .upsert({ user_id, role: invite.role }, { onConflict: 'user_id,role' });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === Authenticated actions ===

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // search_users is available to all authenticated users
    if (action === 'search_users') {
      const { query: searchQuery } = params;
      if (!searchQuery || searchQuery.length < 3) {
        return new Response(JSON.stringify({ users: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, display_name');
      const profileMap: Record<string, string> = {};
      for (const p of profiles || []) {
        if (p.display_name) profileMap[p.id] = p.display_name;
      }

      const lowerQ = searchQuery.toLowerCase();
      const matches = Object.entries(profileMap)
        .filter(([id]) => id !== caller.id)
        .filter(([, name]) => (name || '').toLowerCase().includes(lowerQ))
        .slice(0, 10)
        .map(([id, name]) => ({
          user_id: id,
          display_name: name || id,
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
      // === Invitation management ===
      case 'send_invite': {
        const { email, role } = params;
        if (!email) throw new Error('email required');

        const { data: invite, error } = await supabaseAdmin
          .from('user_invitations')
          .insert({
            email,
            invited_by: caller.id,
            role: role || 'user',
          })
          .select('id, token, email, role, expires_at')
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, invite }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'list_invitations': {
        const { data, error } = await supabaseAdmin
          .from('user_invitations')
          .select('id, email, role, token, used_at, expires_at, created_at, invited_by')
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ invitations: data || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'revoke_invite': {
        const { invite_id } = params;
        if (!invite_id) throw new Error('invite_id required');

        const { error } = await supabaseAdmin
          .from('user_invitations')
          .delete()
          .eq('id', invite_id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // === Access request management ===
      case 'list_access_requests': {
        const { status: filterStatus } = params;
        let query = supabaseAdmin
          .from('access_requests')
          .select('*')
          .order('created_at', { ascending: false });

        if (filterStatus) {
          query = query.eq('status', filterStatus);
        }

        const { data, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify({ requests: data || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'approve_access_request': {
        const { request_id, role } = params;
        if (!request_id) throw new Error('request_id required');

        // Get the request
        const { data: request, error: reqErr } = await supabaseAdmin
          .from('access_requests')
          .select('*')
          .eq('id', request_id)
          .single();

        if (reqErr || !request) throw new Error('Request not found');
        if (request.status !== 'pending') throw new Error('Request already reviewed');

        // Create the user account with a random password (they'll need to reset)
        const tempPassword = crypto.randomUUID() + '!Aa1';
        const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: request.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { display_name: request.display_name || request.email },
        });

        if (createErr) throw createErr;

        // Grant role if specified
        const assignRole = role || 'user';
        if (assignRole !== 'user') {
          await supabaseAdmin
            .from('user_roles')
            .upsert({ user_id: newUser.user.id, role: assignRole }, { onConflict: 'user_id,role' });
        }

        // Mark request as approved
        await supabaseAdmin
          .from('access_requests')
          .update({
            status: 'approved',
            reviewed_by: caller.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', request_id);

        // Send password reset email so user can set their own password
        await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: request.email,
        });

        return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'deny_access_request': {
        const { request_id } = params;
        if (!request_id) throw new Error('request_id required');

        const { error } = await supabaseAdmin
          .from('access_requests')
          .update({
            status: 'denied',
            reviewed_by: caller.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', request_id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // === Existing actions ===
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
          await supabaseAdmin.from('user_roles').delete().eq('user_id', user_id).eq('role', role);
        } else {
          await supabaseAdmin.from('user_roles').upsert({ user_id, role }, { onConflict: 'user_id,role' });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update_user': {
        const { user_id, email, display_name } = params;
        if (!user_id) throw new Error('user_id required');

        if (email) {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { email });
          if (error) throw error;
        }

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

        const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password: new_password });
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
          email, password, email_confirm: true,
        });
        if (createError) throw createError;

        if (newUserRole && newUserRole !== 'user') {
          await supabaseAdmin.from('user_roles').upsert({ user_id: newUser.user.id, role: newUserRole }, { onConflict: 'user_id,role' });
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

        const ban_duration = duration === 'none' ? 'none' : (duration || '876000h');
        const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration });
        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'add_group_member': {
        const { group_id, user_id } = params;
        if (!group_id || !user_id) throw new Error('group_id and user_id required');

        const { data: group, error: groupErr } = await supabaseAdmin
          .from('role_groups').select('roles').eq('id', group_id).single();
        if (groupErr) throw groupErr;

        const { error: memberErr } = await supabaseAdmin
          .from('role_group_members').insert({ group_id, user_id });
        if (memberErr) {
          if (memberErr.message.includes('duplicate')) throw new Error('User already in this group');
          throw memberErr;
        }

        for (const role of (group.roles || [])) {
          await supabaseAdmin.from('user_roles').upsert({ user_id, role }, { onConflict: 'user_id,role' });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'remove_group_member': {
        const { member_id, user_id, group_id } = params;
        if (!member_id || !user_id || !group_id) throw new Error('member_id, user_id, and group_id required');

        const { data: removedGroup } = await supabaseAdmin
          .from('role_groups').select('roles').eq('id', group_id).single();

        const { error: delErr } = await supabaseAdmin
          .from('role_group_members').delete().eq('id', member_id);
        if (delErr) throw delErr;

        const { data: remainingMemberships } = await supabaseAdmin
          .from('role_group_members').select('group_id').eq('user_id', user_id);

        const protectedRoles = new Set<string>();
        if (remainingMemberships && remainingMemberships.length > 0) {
          const otherGroupIds = remainingMemberships.map(m => m.group_id);
          const { data: otherGroups } = await supabaseAdmin
            .from('role_groups').select('roles').in('id', otherGroupIds);
          for (const g of otherGroups || []) {
            for (const r of g.roles || []) protectedRoles.add(r);
          }
        }

        const rolesToRevoke = (removedGroup?.roles || []).filter((r: string) => !protectedRoles.has(r));
        for (const role of rolesToRevoke) {
          await supabaseAdmin.from('user_roles').delete().eq('user_id', user_id).eq('role', role);
        }

        return new Response(JSON.stringify({ success: true, revoked_roles: rolesToRevoke }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'sync_group_roles': {
        const { group_id } = params;
        if (!group_id) throw new Error('group_id required');

        const { data: grp, error: grpErr } = await supabaseAdmin
          .from('role_groups').select('roles').eq('id', group_id).single();
        if (grpErr) throw grpErr;
        const groupRoles: string[] = grp.roles || [];

        const { data: grpMembers } = await supabaseAdmin
          .from('role_group_members').select('user_id').eq('group_id', group_id);
        const memberUserIds = (grpMembers || []).map((m: any) => m.user_id);
        if (memberUserIds.length === 0) {
          return new Response(JSON.stringify({ success: true, synced: 0 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        for (const uid of memberUserIds) {
          const { data: userMemberships } = await supabaseAdmin
            .from('role_group_members').select('group_id').eq('user_id', uid);
          const userGroupIds = (userMemberships || []).map((m: any) => m.group_id);

          const { data: userGroups } = await supabaseAdmin
            .from('role_groups').select('roles').in('id', userGroupIds);
          const expectedRoles = new Set<string>();
          for (const g of userGroups || []) {
            for (const r of g.roles || []) expectedRoles.add(r);
          }

          const { data: currentRoles } = await supabaseAdmin
            .from('user_roles').select('role').eq('user_id', uid);
          const currentSet = new Set((currentRoles || []).map((r: any) => r.role));

          for (const role of expectedRoles) {
            if (!currentSet.has(role)) {
              await supabaseAdmin.from('user_roles').upsert({ user_id: uid, role }, { onConflict: 'user_id,role' });
            }
          }

          const allPossibleGroupRoles = new Set<string>();
          const { data: allGroups } = await supabaseAdmin.from('role_groups').select('roles');
          for (const g of allGroups || []) {
            for (const r of g.roles || []) allPossibleGroupRoles.add(r);
          }

          for (const cr of currentSet) {
            if (allPossibleGroupRoles.has(cr) && !expectedRoles.has(cr)) {
              await supabaseAdmin.from('user_roles').delete().eq('user_id', uid).eq('role', cr);
            }
          }
        }

        return new Response(JSON.stringify({ success: true, synced: memberUserIds.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete_access_request': {
        const { request_id } = params;
        if (!request_id) throw new Error('request_id required');

        const { data: req, error: reqErr } = await supabaseAdmin
          .from('access_requests')
          .select('status')
          .eq('id', request_id)
          .single();

        if (reqErr || !req) throw new Error('Request not found');
        if (req.status === 'pending') throw new Error('Cannot delete pending requests — approve or deny first');

        const { error } = await supabaseAdmin
          .from('access_requests')
          .delete()
          .eq('id', request_id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
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
