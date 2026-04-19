export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      ai_generation_history: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          feature: string
          id: string
          model: string | null
          output: Json
          prompt_summary: string | null
          status: string
          subject_ref: string | null
          subject_type: string | null
          supersedes: string | null
          token_usage: Json | null
          trigger_source: string
          triggered_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          feature: string
          id?: string
          model?: string | null
          output?: Json
          prompt_summary?: string | null
          status?: string
          subject_ref?: string | null
          subject_type?: string | null
          supersedes?: string | null
          token_usage?: Json | null
          trigger_source?: string
          triggered_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          feature?: string
          id?: string
          model?: string | null
          output?: Json
          prompt_summary?: string | null
          status?: string
          subject_ref?: string | null
          subject_type?: string | null
          supersedes?: string | null
          token_usage?: Json | null
          trigger_source?: string
          triggered_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_generation_history_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "ai_generation_history"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_dispatch_log: {
        Row: {
          alert_rule_id: string | null
          channel: string
          created_at: string
          error: string | null
          id: string
          payload: Json
          status: string
          user_id: string
        }
        Insert: {
          alert_rule_id?: string | null
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json
          status?: string
          user_id: string
        }
        Update: {
          alert_rule_id?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_dispatch_log_alert_rule_id_fkey"
            columns: ["alert_rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          channels: string[]
          created_at: string
          enabled: boolean
          entity_id: string | null
          entity_type: string | null
          event_types: string[]
          id: string
          keywords: string[]
          last_triggered_at: string | null
          name: string
          trigger_count: number
          updated_at: string
          user_id: string
          webhook_endpoint_id: string | null
        }
        Insert: {
          channels?: string[]
          created_at?: string
          enabled?: boolean
          entity_id?: string | null
          entity_type?: string | null
          event_types?: string[]
          id?: string
          keywords?: string[]
          last_triggered_at?: string | null
          name: string
          trigger_count?: number
          updated_at?: string
          user_id: string
          webhook_endpoint_id?: string | null
        }
        Update: {
          channels?: string[]
          created_at?: string
          enabled?: boolean
          entity_id?: string | null
          entity_type?: string | null
          event_types?: string[]
          id?: string
          keywords?: string[]
          last_triggered_at?: string | null
          name?: string
          trigger_count?: number
          updated_at?: string
          user_id?: string
          webhook_endpoint_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_webhook_endpoint_id_fkey"
            columns: ["webhook_endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          request_count: number
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          request_count?: number
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          request_count?: number
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      api_request_logs: {
        Row: {
          api_key_id: string
          created_at: string
          endpoint: string
          id: string
          status_code: number
          user_id: string
        }
        Insert: {
          api_key_id: string
          created_at?: string
          endpoint: string
          id?: string
          status_code?: number
          user_id: string
        }
        Update: {
          api_key_id?: string
          created_at?: string
          endpoint?: string
          id?: string
          status_code?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      app_serial_keys: {
        Row: {
          created_at: string
          device_bound_at: string | null
          device_id: string | null
          id: string
          last_validated_at: string | null
          notes: string | null
          revoked_at: string | null
          serial: string
          updated_at: string
          user_id: string
          validation_count: number
        }
        Insert: {
          created_at?: string
          device_bound_at?: string | null
          device_id?: string | null
          id?: string
          last_validated_at?: string | null
          notes?: string | null
          revoked_at?: string | null
          serial: string
          updated_at?: string
          user_id: string
          validation_count?: number
        }
        Update: {
          created_at?: string
          device_bound_at?: string | null
          device_id?: string | null
          id?: string
          last_validated_at?: string | null
          notes?: string | null
          revoked_at?: string | null
          serial?: string
          updated_at?: string
          user_id?: string
          validation_count?: number
        }
        Relationships: []
      }
      bill_impact_analyses: {
        Row: {
          affected_groups: Json
          bill_id: string
          fiscal_impact: string | null
          generated_at: string
          id: string
          losers: Json
          model: string
          political_impact: string | null
          scope: string
          scope_ref: string | null
          summary: string
          updated_at: string
          winners: Json
        }
        Insert: {
          affected_groups?: Json
          bill_id: string
          fiscal_impact?: string | null
          generated_at?: string
          id?: string
          losers?: Json
          model?: string
          political_impact?: string | null
          scope?: string
          scope_ref?: string | null
          summary?: string
          updated_at?: string
          winners?: Json
        }
        Update: {
          affected_groups?: Json
          bill_id?: string
          fiscal_impact?: string | null
          generated_at?: string
          id?: string
          losers?: Json
          model?: string
          political_impact?: string | null
          scope?: string
          scope_ref?: string | null
          summary?: string
          updated_at?: string
          winners?: Json
        }
        Relationships: []
      }
      campaign_finance: {
        Row: {
          candidate_name: string
          candidate_slug: string | null
          cash_on_hand: number | null
          created_at: string
          cycle: number
          district: string | null
          filing_date: string | null
          id: string
          individual_contributions: number | null
          large_donor_pct: number | null
          office: string
          out_of_state_pct: number | null
          pac_contributions: number | null
          party: string | null
          quarterly_data: Json | null
          raw_data: Json | null
          self_funding: number | null
          small_dollar_pct: number | null
          source: string
          source_url: string | null
          state_abbr: string
          top_contributors: Json | null
          top_industries: Json | null
          total_debt: number | null
          total_raised: number | null
          total_spent: number | null
          updated_at: string
        }
        Insert: {
          candidate_name: string
          candidate_slug?: string | null
          cash_on_hand?: number | null
          created_at?: string
          cycle?: number
          district?: string | null
          filing_date?: string | null
          id?: string
          individual_contributions?: number | null
          large_donor_pct?: number | null
          office?: string
          out_of_state_pct?: number | null
          pac_contributions?: number | null
          party?: string | null
          quarterly_data?: Json | null
          raw_data?: Json | null
          self_funding?: number | null
          small_dollar_pct?: number | null
          source?: string
          source_url?: string | null
          state_abbr: string
          top_contributors?: Json | null
          top_industries?: Json | null
          total_debt?: number | null
          total_raised?: number | null
          total_spent?: number | null
          updated_at?: string
        }
        Update: {
          candidate_name?: string
          candidate_slug?: string | null
          cash_on_hand?: number | null
          created_at?: string
          cycle?: number
          district?: string | null
          filing_date?: string | null
          id?: string
          individual_contributions?: number | null
          large_donor_pct?: number | null
          office?: string
          out_of_state_pct?: number | null
          pac_contributions?: number | null
          party?: string | null
          quarterly_data?: Json | null
          raw_data?: Json | null
          self_funding?: number | null
          small_dollar_pct?: number | null
          source?: string
          source_url?: string | null
          state_abbr?: string
          top_contributors?: Json | null
          top_industries?: Json | null
          total_debt?: number | null
          total_raised?: number | null
          total_spent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      candidate_profiles: {
        Row: {
          content: string
          created_at: string
          github_path: string
          id: string
          is_subpage: boolean
          legiscan_people_id: number | null
          legiscan_state: string | null
          name: string
          parent_slug: string | null
          slug: string
          subpage_title: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          github_path: string
          id?: string
          is_subpage?: boolean
          legiscan_people_id?: number | null
          legiscan_state?: string | null
          name: string
          parent_slug?: string | null
          slug: string
          subpage_title?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          github_path?: string
          id?: string
          is_subpage?: boolean
          legiscan_people_id?: number | null
          legiscan_state?: string | null
          name?: string
          parent_slug?: string | null
          slug?: string
          subpage_title?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      candidate_versions: {
        Row: {
          author: string
          commit_date: string
          commit_message: string
          commit_sha: string
          content: string
          created_at: string
          github_path: string
          id: string
        }
        Insert: {
          author?: string
          commit_date: string
          commit_message?: string
          commit_sha: string
          content?: string
          created_at?: string
          github_path: string
          id?: string
        }
        Update: {
          author?: string
          commit_date?: string
          commit_message?: string
          commit_sha?: string
          content?: string
          created_at?: string
          github_path?: string
          id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      congress_bills: {
        Row: {
          actions: Json | null
          bill_id: string
          bill_number: number
          bill_type: string
          committees: Json | null
          congress: number
          congress_url: string | null
          cosponsor_count: number | null
          cosponsors: Json | null
          created_at: string
          id: string
          introduced_date: string | null
          latest_action_date: string | null
          latest_action_text: string | null
          origin_chamber: string | null
          policy_area: string | null
          raw_data: Json | null
          short_title: string | null
          sponsor_bioguide_id: string | null
          sponsor_name: string | null
          status: string | null
          subjects: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          actions?: Json | null
          bill_id: string
          bill_number: number
          bill_type: string
          committees?: Json | null
          congress: number
          congress_url?: string | null
          cosponsor_count?: number | null
          cosponsors?: Json | null
          created_at?: string
          id?: string
          introduced_date?: string | null
          latest_action_date?: string | null
          latest_action_text?: string | null
          origin_chamber?: string | null
          policy_area?: string | null
          raw_data?: Json | null
          short_title?: string | null
          sponsor_bioguide_id?: string | null
          sponsor_name?: string | null
          status?: string | null
          subjects?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          actions?: Json | null
          bill_id?: string
          bill_number?: number
          bill_type?: string
          committees?: Json | null
          congress?: number
          congress_url?: string | null
          cosponsor_count?: number | null
          cosponsors?: Json | null
          created_at?: string
          id?: string
          introduced_date?: string | null
          latest_action_date?: string | null
          latest_action_text?: string | null
          origin_chamber?: string | null
          policy_area?: string | null
          raw_data?: Json | null
          short_title?: string | null
          sponsor_bioguide_id?: string | null
          sponsor_name?: string | null
          status?: string | null
          subjects?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      congress_committees: {
        Row: {
          chamber: string
          committee_type: string | null
          created_at: string
          id: string
          members: Json | null
          name: string
          parent_system_code: string | null
          raw_data: Json | null
          subcommittees: Json | null
          system_code: string
          updated_at: string
          url: string | null
        }
        Insert: {
          chamber: string
          committee_type?: string | null
          created_at?: string
          id?: string
          members?: Json | null
          name: string
          parent_system_code?: string | null
          raw_data?: Json | null
          subcommittees?: Json | null
          system_code: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          chamber?: string
          committee_type?: string | null
          created_at?: string
          id?: string
          members?: Json | null
          name?: string
          parent_system_code?: string | null
          raw_data?: Json | null
          subcommittees?: Json | null
          system_code?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      congress_members: {
        Row: {
          ballotpedia: string | null
          bioguide_id: string
          candidate_slug: string | null
          chamber: string
          congress: number | null
          contact_form: string | null
          created_at: string
          depiction_url: string | null
          district: string | null
          district_offices: Json | null
          fec_ids: string[] | null
          first_name: string | null
          id: string
          last_name: string | null
          leadership: Json | null
          name: string
          office_address: string | null
          official_url: string | null
          opensecrets_id: string | null
          party: string | null
          phone: string | null
          raw_data: Json | null
          social_media: Json | null
          state: string | null
          terms: Json | null
          updated_at: string
          votesmart_id: number | null
          wikipedia: string | null
        }
        Insert: {
          ballotpedia?: string | null
          bioguide_id: string
          candidate_slug?: string | null
          chamber?: string
          congress?: number | null
          contact_form?: string | null
          created_at?: string
          depiction_url?: string | null
          district?: string | null
          district_offices?: Json | null
          fec_ids?: string[] | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          leadership?: Json | null
          name: string
          office_address?: string | null
          official_url?: string | null
          opensecrets_id?: string | null
          party?: string | null
          phone?: string | null
          raw_data?: Json | null
          social_media?: Json | null
          state?: string | null
          terms?: Json | null
          updated_at?: string
          votesmart_id?: number | null
          wikipedia?: string | null
        }
        Update: {
          ballotpedia?: string | null
          bioguide_id?: string
          candidate_slug?: string | null
          chamber?: string
          congress?: number | null
          contact_form?: string | null
          created_at?: string
          depiction_url?: string | null
          district?: string | null
          district_offices?: Json | null
          fec_ids?: string[] | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          leadership?: Json | null
          name?: string
          office_address?: string | null
          official_url?: string | null
          opensecrets_id?: string | null
          party?: string | null
          phone?: string | null
          raw_data?: Json | null
          social_media?: Json | null
          state?: string | null
          terms?: Json | null
          updated_at?: string
          votesmart_id?: number | null
          wikipedia?: string | null
        }
        Relationships: []
      }
      congress_votes: {
        Row: {
          bill_id: string | null
          chamber: string
          congress: number
          created_at: string
          description: string | null
          id: string
          member_votes: Json | null
          nay_total: number | null
          not_voting_total: number | null
          present_total: number | null
          question: string | null
          raw_data: Json | null
          result: string | null
          roll_number: number
          session: number
          updated_at: string
          vote_date: string | null
          vote_id: string
          yea_total: number | null
        }
        Insert: {
          bill_id?: string | null
          chamber: string
          congress: number
          created_at?: string
          description?: string | null
          id?: string
          member_votes?: Json | null
          nay_total?: number | null
          not_voting_total?: number | null
          present_total?: number | null
          question?: string | null
          raw_data?: Json | null
          result?: string | null
          roll_number: number
          session: number
          updated_at?: string
          vote_date?: string | null
          vote_id: string
          yea_total?: number | null
        }
        Update: {
          bill_id?: string | null
          chamber?: string
          congress?: number
          created_at?: string
          description?: string | null
          id?: string
          member_votes?: Json | null
          nay_total?: number | null
          not_voting_total?: number | null
          present_total?: number | null
          question?: string | null
          raw_data?: Json | null
          result?: string | null
          roll_number?: number
          session?: number
          updated_at?: string
          vote_date?: string | null
          vote_id?: string
          yea_total?: number | null
        }
        Relationships: []
      }
      congressional_election_results: {
        Row: {
          candidate_name: string
          created_at: string
          district_number: string
          election_date: string | null
          election_type: string
          election_year: number
          id: string
          is_incumbent: boolean | null
          is_winner: boolean | null
          is_write_in: boolean | null
          party: string | null
          source: string | null
          state_abbr: string
          total_votes: number | null
          updated_at: string
          vote_pct: number | null
          votes: number | null
        }
        Insert: {
          candidate_name: string
          created_at?: string
          district_number: string
          election_date?: string | null
          election_type?: string
          election_year: number
          id?: string
          is_incumbent?: boolean | null
          is_winner?: boolean | null
          is_write_in?: boolean | null
          party?: string | null
          source?: string | null
          state_abbr: string
          total_votes?: number | null
          updated_at?: string
          vote_pct?: number | null
          votes?: number | null
        }
        Update: {
          candidate_name?: string
          created_at?: string
          district_number?: string
          election_date?: string | null
          election_type?: string
          election_year?: number
          id?: string
          is_incumbent?: boolean | null
          is_winner?: boolean | null
          is_write_in?: boolean | null
          party?: string | null
          source?: string | null
          state_abbr?: string
          total_votes?: number | null
          updated_at?: string
          vote_pct?: number | null
          votes?: number | null
        }
        Relationships: []
      }
      congressional_record: {
        Row: {
          bioguide_id: string | null
          category: string | null
          chamber: string
          congress: number | null
          content: string | null
          created_at: string
          date: string
          id: string
          number: number | null
          pages: string | null
          raw_data: Json | null
          session: number | null
          speaker_name: string
          title: string | null
          updated_at: string
          volume: number | null
        }
        Insert: {
          bioguide_id?: string | null
          category?: string | null
          chamber: string
          congress?: number | null
          content?: string | null
          created_at?: string
          date: string
          id?: string
          number?: number | null
          pages?: string | null
          raw_data?: Json | null
          session?: number | null
          speaker_name: string
          title?: string | null
          updated_at?: string
          volume?: number | null
        }
        Update: {
          bioguide_id?: string | null
          category?: string | null
          chamber?: string
          congress?: number | null
          content?: string | null
          created_at?: string
          date?: string
          id?: string
          number?: number | null
          pages?: string | null
          raw_data?: Json | null
          session?: number | null
          speaker_name?: string
          title?: string | null
          updated_at?: string
          volume?: number | null
        }
        Relationships: []
      }
      court_cases: {
        Row: {
          case_id: string | null
          case_name: string
          case_number: string | null
          closed_date: string | null
          court: string
          created_at: string
          docket_url: string | null
          filed_date: string | null
          id: string
          judge: string | null
          nature_of_suit: string | null
          parties: Json | null
          raw_data: Json | null
          source: string
          status: string | null
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          case_name: string
          case_number?: string | null
          closed_date?: string | null
          court: string
          created_at?: string
          docket_url?: string | null
          filed_date?: string | null
          id?: string
          judge?: string | null
          nature_of_suit?: string | null
          parties?: Json | null
          raw_data?: Json | null
          source?: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          case_name?: string
          case_number?: string | null
          closed_date?: string | null
          court?: string
          created_at?: string
          docket_url?: string | null
          filed_date?: string | null
          id?: string
          judge?: string | null
          nature_of_suit?: string | null
          parties?: Json | null
          raw_data?: Json | null
          source?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      device_locations: {
        Row: {
          accuracy: number | null
          altitude: number | null
          created_at: string
          device_id: string
          heading: number | null
          id: string
          latitude: number
          longitude: number
          recorded_at: string
          speed: number | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          altitude?: number | null
          created_at?: string
          device_id: string
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
          speed?: number | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          altitude?: number | null
          created_at?: string
          device_id?: string
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
          speed?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_locations_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      district_news_cache: {
        Row: {
          articles: Json
          fetched_at: string
          id: string
          member_name: string
        }
        Insert: {
          articles?: Json
          fetched_at?: string
          id?: string
          member_name: string
        }
        Update: {
          articles?: Json
          fetched_at?: string
          id?: string
          member_name?: string
        }
        Relationships: []
      }
      district_profiles: {
        Row: {
          asian_pct: number | null
          avg_household_size: number | null
          black_pct: number | null
          created_at: string
          district_id: string
          education_bachelor_pct: number | null
          foreign_born_pct: number | null
          hispanic_pct: number | null
          id: string
          median_age: number | null
          median_home_value: number | null
          median_income: number | null
          median_rent: number | null
          owner_occupied_pct: number | null
          population: number | null
          poverty_rate: number | null
          raw_data: Json | null
          state: string
          top_issues: string[]
          total_households: number | null
          unemployment_rate: number | null
          uninsured_pct: number | null
          updated_at: string
          veteran_pct: number | null
          voting_patterns: Json | null
          white_pct: number | null
        }
        Insert: {
          asian_pct?: number | null
          avg_household_size?: number | null
          black_pct?: number | null
          created_at?: string
          district_id: string
          education_bachelor_pct?: number | null
          foreign_born_pct?: number | null
          hispanic_pct?: number | null
          id?: string
          median_age?: number | null
          median_home_value?: number | null
          median_income?: number | null
          median_rent?: number | null
          owner_occupied_pct?: number | null
          population?: number | null
          poverty_rate?: number | null
          raw_data?: Json | null
          state?: string
          top_issues?: string[]
          total_households?: number | null
          unemployment_rate?: number | null
          uninsured_pct?: number | null
          updated_at?: string
          veteran_pct?: number | null
          voting_patterns?: Json | null
          white_pct?: number | null
        }
        Update: {
          asian_pct?: number | null
          avg_household_size?: number | null
          black_pct?: number | null
          created_at?: string
          district_id?: string
          education_bachelor_pct?: number | null
          foreign_born_pct?: number | null
          hispanic_pct?: number | null
          id?: string
          median_age?: number | null
          median_home_value?: number | null
          median_income?: number | null
          median_rent?: number | null
          owner_occupied_pct?: number | null
          population?: number | null
          poverty_rate?: number | null
          raw_data?: Json | null
          state?: string
          top_issues?: string[]
          total_households?: number | null
          unemployment_rate?: number | null
          uninsured_pct?: number | null
          updated_at?: string
          veteran_pct?: number | null
          voting_patterns?: Json | null
          white_pct?: number | null
        }
        Relationships: []
      }
      election_forecast_history: {
        Row: {
          changed_at: string
          cycle: number
          district: string | null
          forecast_id: string
          id: string
          new_rating: string | null
          old_rating: string | null
          race_type: string
          source: string
          state_abbr: string
        }
        Insert: {
          changed_at?: string
          cycle?: number
          district?: string | null
          forecast_id: string
          id?: string
          new_rating?: string | null
          old_rating?: string | null
          race_type?: string
          source: string
          state_abbr: string
        }
        Update: {
          changed_at?: string
          cycle?: number
          district?: string | null
          forecast_id?: string
          id?: string
          new_rating?: string | null
          old_rating?: string | null
          race_type?: string
          source?: string
          state_abbr?: string
        }
        Relationships: []
      }
      election_forecasts: {
        Row: {
          created_at: string
          cycle: number
          dem_vote_share: number | null
          dem_win_prob: number | null
          district: string | null
          id: string
          last_updated: string | null
          margin: number | null
          race_type: string
          rating: string | null
          raw_data: Json | null
          rep_vote_share: number | null
          rep_win_prob: number | null
          source: string
          state_abbr: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle?: number
          dem_vote_share?: number | null
          dem_win_prob?: number | null
          district?: string | null
          id?: string
          last_updated?: string | null
          margin?: number | null
          race_type?: string
          rating?: string | null
          raw_data?: Json | null
          rep_vote_share?: number | null
          rep_win_prob?: number | null
          source: string
          state_abbr: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle?: number
          dem_vote_share?: number | null
          dem_win_prob?: number | null
          district?: string | null
          id?: string
          last_updated?: string | null
          margin?: number | null
          race_type?: string
          rating?: string | null
          raw_data?: Json | null
          rep_vote_share?: number | null
          rep_win_prob?: number | null
          source?: string
          state_abbr?: string
          updated_at?: string
        }
        Relationships: []
      }
      election_night_streams: {
        Row: {
          candidate_name: string
          county_fips: string | null
          district: string | null
          election_date: string
          id: string
          is_called: boolean
          party: string | null
          precinct: string | null
          precincts_reporting_pct: number | null
          race_type: string
          raw_data: Json | null
          reported_at: string
          source: string
          state_abbr: string
          vote_pct: number | null
          votes: number | null
        }
        Insert: {
          candidate_name: string
          county_fips?: string | null
          district?: string | null
          election_date: string
          id?: string
          is_called?: boolean
          party?: string | null
          precinct?: string | null
          precincts_reporting_pct?: number | null
          race_type: string
          raw_data?: Json | null
          reported_at?: string
          source?: string
          state_abbr: string
          vote_pct?: number | null
          votes?: number | null
        }
        Update: {
          candidate_name?: string
          county_fips?: string | null
          district?: string | null
          election_date?: string
          id?: string
          is_called?: boolean
          party?: string | null
          precinct?: string | null
          precincts_reporting_pct?: number | null
          race_type?: string
          raw_data?: Json | null
          reported_at?: string
          source?: string
          state_abbr?: string
          vote_pct?: number | null
          votes?: number | null
        }
        Relationships: []
      }
      email_notification_preferences: {
        Row: {
          created_at: string
          digest_frequency: string
          forecast_changes: boolean
          intel_briefings: boolean
          polling_alerts: boolean
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          scheduled_reports: boolean
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digest_frequency?: string
          forecast_changes?: boolean
          intel_briefings?: boolean
          polling_alerts?: boolean
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          scheduled_reports?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          digest_frequency?: string
          forecast_changes?: boolean
          intel_briefings?: boolean
          polling_alerts?: boolean
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          scheduled_reports?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      entity_activity: {
        Row: {
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          summary: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          summary: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          summary?: string
        }
        Relationships: []
      }
      entity_notes: {
        Row: {
          attachments: Json
          body: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          is_shared: boolean
          mentions: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          attachments?: Json
          body?: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          is_shared?: boolean
          mentions?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          attachments?: Json
          body?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          is_shared?: boolean
          mentions?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      entity_relationships: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          metadata: Json | null
          observed_at: string | null
          relationship_type: string
          source: string | null
          source_id: string
          source_label: string
          source_type: string
          target_id: string
          target_label: string
          target_type: string
          weight: number | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          observed_at?: string | null
          relationship_type: string
          source?: string | null
          source_id: string
          source_label: string
          source_type: string
          target_id: string
          target_label: string
          target_type: string
          weight?: number | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          observed_at?: string | null
          relationship_type?: string
          source?: string | null
          source_id?: string
          source_label?: string
          source_type?: string
          target_id?: string
          target_label?: string
          target_type?: string
          weight?: number | null
        }
        Relationships: []
      }
      fara_registrants: {
        Row: {
          address: string | null
          country: string | null
          created_at: string
          documents: Json
          foreign_principals: Json
          id: string
          raw_data: Json | null
          registrant_name: string
          registration_date: string | null
          registration_number: string
          short_form_agents: Json
          source: string
          source_url: string | null
          state: string | null
          status: string
          termination_date: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          country?: string | null
          created_at?: string
          documents?: Json
          foreign_principals?: Json
          id?: string
          raw_data?: Json | null
          registrant_name: string
          registration_date?: string | null
          registration_number: string
          short_form_agents?: Json
          source?: string
          source_url?: string | null
          state?: string | null
          status?: string
          termination_date?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          country?: string | null
          created_at?: string
          documents?: Json
          foreign_principals?: Json
          id?: string
          raw_data?: Json | null
          registrant_name?: string
          registration_date?: string | null
          registration_number?: string
          short_form_agents?: Json
          source?: string
          source_url?: string | null
          state?: string | null
          status?: string
          termination_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      federal_spending: {
        Row: {
          award_amount: number | null
          award_id: string | null
          award_type: string
          awarding_agency: string | null
          cfda_number: string | null
          cfda_title: string | null
          created_at: string
          description: string | null
          fiscal_year: number | null
          funding_agency: string | null
          id: string
          naics_code: string | null
          naics_description: string | null
          period_of_performance_end: string | null
          period_of_performance_start: string | null
          place_of_performance_district: string | null
          place_of_performance_state: string | null
          raw_data: Json | null
          recipient_district: string | null
          recipient_name: string
          recipient_state: string | null
          source: string | null
          source_url: string | null
          total_obligation: number | null
          updated_at: string
        }
        Insert: {
          award_amount?: number | null
          award_id?: string | null
          award_type?: string
          awarding_agency?: string | null
          cfda_number?: string | null
          cfda_title?: string | null
          created_at?: string
          description?: string | null
          fiscal_year?: number | null
          funding_agency?: string | null
          id?: string
          naics_code?: string | null
          naics_description?: string | null
          period_of_performance_end?: string | null
          period_of_performance_start?: string | null
          place_of_performance_district?: string | null
          place_of_performance_state?: string | null
          raw_data?: Json | null
          recipient_district?: string | null
          recipient_name: string
          recipient_state?: string | null
          source?: string | null
          source_url?: string | null
          total_obligation?: number | null
          updated_at?: string
        }
        Update: {
          award_amount?: number | null
          award_id?: string | null
          award_type?: string
          awarding_agency?: string | null
          cfda_number?: string | null
          cfda_title?: string | null
          created_at?: string
          description?: string | null
          fiscal_year?: number | null
          funding_agency?: string | null
          id?: string
          naics_code?: string | null
          naics_description?: string | null
          period_of_performance_end?: string | null
          period_of_performance_start?: string | null
          place_of_performance_district?: string | null
          place_of_performance_state?: string | null
          raw_data?: Json | null
          recipient_district?: string | null
          recipient_name?: string
          recipient_state?: string | null
          source?: string | null
          source_url?: string | null
          total_obligation?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      forecast_scenarios: {
        Row: {
          assumptions: Json
          created_at: string
          cycle: number
          description: string | null
          id: string
          is_shared: boolean
          name: string
          national_swing: number | null
          projected_seats: Json
          race_type: string
          rating_overrides: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          assumptions?: Json
          created_at?: string
          cycle?: number
          description?: string | null
          id?: string
          is_shared?: boolean
          name: string
          national_swing?: number | null
          projected_seats?: Json
          race_type?: string
          rating_overrides?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          assumptions?: Json
          created_at?: string
          cycle?: number
          description?: string | null
          id?: string
          is_shared?: boolean
          name?: string
          national_swing?: number | null
          projected_seats?: Json
          race_type?: string
          rating_overrides?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      forecast_simulations: {
        Row: {
          created_at: string
          dem_win_pct: number | null
          id: string
          iterations: number
          median_dem_seats: number | null
          median_rep_seats: number | null
          rep_win_pct: number | null
          results: Json
          scenario_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          dem_win_pct?: number | null
          id?: string
          iterations?: number
          median_dem_seats?: number | null
          median_rep_seats?: number | null
          rep_win_pct?: number | null
          results?: Json
          scenario_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          dem_win_pct?: number | null
          id?: string
          iterations?: number
          median_dem_seats?: number | null
          median_rep_seats?: number | null
          rep_win_pct?: number | null
          results?: Json
          scenario_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecast_simulations_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "forecast_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      gov_contracts: {
        Row: {
          award_amount: number | null
          award_id: string | null
          award_type: string | null
          awarding_agency: string | null
          created_at: string
          description: string | null
          end_date: string | null
          fiscal_year: number | null
          id: string
          naics_code: string | null
          raw_data: Json | null
          recipient_district: string | null
          recipient_name: string
          recipient_state: string | null
          recipient_uei: string | null
          source: string
          source_url: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          award_amount?: number | null
          award_id?: string | null
          award_type?: string | null
          awarding_agency?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          fiscal_year?: number | null
          id?: string
          naics_code?: string | null
          raw_data?: Json | null
          recipient_district?: string | null
          recipient_name: string
          recipient_state?: string | null
          recipient_uei?: string | null
          source?: string
          source_url?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          award_amount?: number | null
          award_id?: string | null
          award_type?: string | null
          awarding_agency?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          fiscal_year?: number | null
          id?: string
          naics_code?: string | null
          raw_data?: Json | null
          recipient_district?: string | null
          recipient_name?: string
          recipient_state?: string | null
          recipient_uei?: string | null
          source?: string
          source_url?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      graph_snapshots: {
        Row: {
          created_at: string
          description: string | null
          filters: Json | null
          graph_data: Json
          id: string
          is_shared: boolean
          name: string
          root_entity_id: string
          root_entity_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          filters?: Json | null
          graph_data?: Json
          id?: string
          is_shared?: boolean
          name: string
          root_entity_id: string
          root_entity_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          filters?: Json | null
          graph_data?: Json
          id?: string
          is_shared?: boolean
          name?: string
          root_entity_id?: string
          root_entity_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ig_reports: {
        Row: {
          agency: string
          agency_name: string
          created_at: string
          id: string
          inspector: string
          inspector_url: string | null
          landing_url: string | null
          pdf_url: string | null
          published_on: string | null
          raw_data: Json | null
          report_id: string
          summary: string | null
          title: string
          topic: string | null
          type: string | null
          updated_at: string
          url: string | null
          year: number | null
        }
        Insert: {
          agency: string
          agency_name: string
          created_at?: string
          id?: string
          inspector: string
          inspector_url?: string | null
          landing_url?: string | null
          pdf_url?: string | null
          published_on?: string | null
          raw_data?: Json | null
          report_id: string
          summary?: string | null
          title: string
          topic?: string | null
          type?: string | null
          updated_at?: string
          url?: string | null
          year?: number | null
        }
        Update: {
          agency?: string
          agency_name?: string
          created_at?: string
          id?: string
          inspector?: string
          inspector_url?: string | null
          landing_url?: string | null
          pdf_url?: string | null
          published_on?: string | null
          raw_data?: Json | null
          report_id?: string
          summary?: string | null
          title?: string
          topic?: string | null
          type?: string | null
          updated_at?: string
          url?: string | null
          year?: number | null
        }
        Relationships: []
      }
      intel_briefings: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          published_at: string | null
          region: string | null
          scope: string
          source_name: string
          source_url: string | null
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          published_at?: string | null
          region?: string | null
          scope?: string
          source_name?: string
          source_url?: string | null
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          published_at?: string | null
          region?: string | null
          scope?: string
          source_name?: string
          source_url?: string | null
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      international_elections: {
        Row: {
          candidates: Json | null
          country_code: string
          created_at: string
          election_date: string | null
          election_type: string
          election_year: number
          id: string
          raw_data: Json | null
          results: Json | null
          source: string | null
          source_url: string | null
          tags: string[]
          turnout_pct: number | null
          updated_at: string
          winner_name: string | null
          winner_party: string | null
        }
        Insert: {
          candidates?: Json | null
          country_code: string
          created_at?: string
          election_date?: string | null
          election_type?: string
          election_year: number
          id?: string
          raw_data?: Json | null
          results?: Json | null
          source?: string | null
          source_url?: string | null
          tags?: string[]
          turnout_pct?: number | null
          updated_at?: string
          winner_name?: string | null
          winner_party?: string | null
        }
        Update: {
          candidates?: Json | null
          country_code?: string
          created_at?: string
          election_date?: string | null
          election_type?: string
          election_year?: number
          id?: string
          raw_data?: Json | null
          results?: Json | null
          source?: string | null
          source_url?: string | null
          tags?: string[]
          turnout_pct?: number | null
          updated_at?: string
          winner_name?: string | null
          winner_party?: string | null
        }
        Relationships: []
      }
      international_leaders: {
        Row: {
          bio: string | null
          controversies: Json | null
          country_code: string
          created_at: string
          id: string
          image_url: string | null
          in_office_since: string | null
          name: string
          party: string | null
          previous_positions: Json | null
          raw_data: Json | null
          tags: string[]
          term_ends: string | null
          title: string
          updated_at: string
        }
        Insert: {
          bio?: string | null
          controversies?: Json | null
          country_code: string
          created_at?: string
          id?: string
          image_url?: string | null
          in_office_since?: string | null
          name: string
          party?: string | null
          previous_positions?: Json | null
          raw_data?: Json | null
          tags?: string[]
          term_ends?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          bio?: string | null
          controversies?: Json | null
          country_code?: string
          created_at?: string
          id?: string
          image_url?: string | null
          in_office_since?: string | null
          name?: string
          party?: string | null
          previous_positions?: Json | null
          raw_data?: Json | null
          tags?: string[]
          term_ends?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      international_legislation: {
        Row: {
          bill_number: string | null
          bill_type: string
          body: string
          country_code: string
          created_at: string
          enacted_date: string | null
          full_text_url: string | null
          id: string
          introduced_date: string | null
          policy_area: string | null
          raw_data: Json | null
          source: string
          source_url: string | null
          sponsor: string | null
          status: string
          summary: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          bill_number?: string | null
          bill_type?: string
          body?: string
          country_code: string
          created_at?: string
          enacted_date?: string | null
          full_text_url?: string | null
          id?: string
          introduced_date?: string | null
          policy_area?: string | null
          raw_data?: Json | null
          source?: string
          source_url?: string | null
          sponsor?: string | null
          status?: string
          summary?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          bill_number?: string | null
          bill_type?: string
          body?: string
          country_code?: string
          created_at?: string
          enacted_date?: string | null
          full_text_url?: string | null
          id?: string
          introduced_date?: string | null
          policy_area?: string | null
          raw_data?: Json | null
          source?: string
          source_url?: string | null
          sponsor?: string | null
          status?: string
          summary?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      international_policy_issues: {
        Row: {
          affected_regions: string[]
          category: string
          country_code: string
          created_at: string
          description: string
          id: string
          raw_data: Json | null
          resolved_date: string | null
          severity: string
          sources: Json
          started_date: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          affected_regions?: string[]
          category?: string
          country_code: string
          created_at?: string
          description?: string
          id?: string
          raw_data?: Json | null
          resolved_date?: string | null
          severity?: string
          sources?: Json
          started_date?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          affected_regions?: string[]
          category?: string
          country_code?: string
          created_at?: string
          description?: string
          id?: string
          raw_data?: Json | null
          resolved_date?: string | null
          severity?: string
          sources?: Json
          started_date?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      international_polling: {
        Row: {
          approve_pct: number | null
          country_code: string
          created_at: string
          date_conducted: string | null
          disapprove_pct: number | null
          end_date: string | null
          favor_pct: number | null
          id: string
          key_finding: string | null
          margin: number | null
          margin_of_error: number | null
          methodology: string | null
          oppose_pct: number | null
          poll_topic: string
          poll_type: string
          question: string | null
          raw_data: Json | null
          sample_size: number | null
          source: string
          source_url: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          approve_pct?: number | null
          country_code: string
          created_at?: string
          date_conducted?: string | null
          disapprove_pct?: number | null
          end_date?: string | null
          favor_pct?: number | null
          id?: string
          key_finding?: string | null
          margin?: number | null
          margin_of_error?: number | null
          methodology?: string | null
          oppose_pct?: number | null
          poll_topic: string
          poll_type?: string
          question?: string | null
          raw_data?: Json | null
          sample_size?: number | null
          source?: string
          source_url?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          approve_pct?: number | null
          country_code?: string
          created_at?: string
          date_conducted?: string | null
          disapprove_pct?: number | null
          end_date?: string | null
          favor_pct?: number | null
          id?: string
          key_finding?: string | null
          margin?: number | null
          margin_of_error?: number | null
          methodology?: string | null
          oppose_pct?: number | null
          poll_topic?: string
          poll_type?: string
          question?: string | null
          raw_data?: Json | null
          sample_size?: number | null
          source?: string
          source_url?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      international_profiles: {
        Row: {
          area_sq_km: number | null
          building_permits: number | null
          capital: string | null
          consumer_spending: number | null
          continent: string
          corporate_profits: number | null
          corruption_index: number | null
          country_code: string
          country_name: string
          cpi_rate: number | null
          created_at: string
          currency: string | null
          current_account_balance: number | null
          economic_indicators_json: Json | null
          election_results: Json | null
          election_type: string | null
          fdi_inflows: number | null
          gdp: number | null
          gdp_growth_rate: number | null
          gdp_per_capita: number | null
          geopolitics: Json
          geopolitics_generated_at: string | null
          geopolitics_model: string | null
          government_debt_gdp_pct: number | null
          government_type: string | null
          head_of_government: string | null
          head_of_state: string | null
          human_dev_index: number | null
          id: string
          industrial_production_index: number | null
          inflation_rate: number | null
          labor_cost_index: number | null
          labor_force_participation: number | null
          last_election_date: string | null
          major_industries: string[] | null
          manufacturer_new_orders: number | null
          median_age: number | null
          next_election_date: string | null
          nonfarm_payrolls: number | null
          official_languages: string[] | null
          opposition_parties: Json | null
          pce_rate: number | null
          personal_income: number | null
          population: number | null
          poverty_rate: number | null
          press_freedom_rank: number | null
          raw_data: Json | null
          real_gdp: number | null
          region: string | null
          ruling_party: string | null
          stock_market_index: number | null
          stock_market_name: string | null
          tags: string[]
          trade_partners: Json | null
          unemployment_rate: number | null
          updated_at: string
        }
        Insert: {
          area_sq_km?: number | null
          building_permits?: number | null
          capital?: string | null
          consumer_spending?: number | null
          continent: string
          corporate_profits?: number | null
          corruption_index?: number | null
          country_code: string
          country_name: string
          cpi_rate?: number | null
          created_at?: string
          currency?: string | null
          current_account_balance?: number | null
          economic_indicators_json?: Json | null
          election_results?: Json | null
          election_type?: string | null
          fdi_inflows?: number | null
          gdp?: number | null
          gdp_growth_rate?: number | null
          gdp_per_capita?: number | null
          geopolitics?: Json
          geopolitics_generated_at?: string | null
          geopolitics_model?: string | null
          government_debt_gdp_pct?: number | null
          government_type?: string | null
          head_of_government?: string | null
          head_of_state?: string | null
          human_dev_index?: number | null
          id?: string
          industrial_production_index?: number | null
          inflation_rate?: number | null
          labor_cost_index?: number | null
          labor_force_participation?: number | null
          last_election_date?: string | null
          major_industries?: string[] | null
          manufacturer_new_orders?: number | null
          median_age?: number | null
          next_election_date?: string | null
          nonfarm_payrolls?: number | null
          official_languages?: string[] | null
          opposition_parties?: Json | null
          pce_rate?: number | null
          personal_income?: number | null
          population?: number | null
          poverty_rate?: number | null
          press_freedom_rank?: number | null
          raw_data?: Json | null
          real_gdp?: number | null
          region?: string | null
          ruling_party?: string | null
          stock_market_index?: number | null
          stock_market_name?: string | null
          tags?: string[]
          trade_partners?: Json | null
          unemployment_rate?: number | null
          updated_at?: string
        }
        Update: {
          area_sq_km?: number | null
          building_permits?: number | null
          capital?: string | null
          consumer_spending?: number | null
          continent?: string
          corporate_profits?: number | null
          corruption_index?: number | null
          country_code?: string
          country_name?: string
          cpi_rate?: number | null
          created_at?: string
          currency?: string | null
          current_account_balance?: number | null
          economic_indicators_json?: Json | null
          election_results?: Json | null
          election_type?: string | null
          fdi_inflows?: number | null
          gdp?: number | null
          gdp_growth_rate?: number | null
          gdp_per_capita?: number | null
          geopolitics?: Json
          geopolitics_generated_at?: string | null
          geopolitics_model?: string | null
          government_debt_gdp_pct?: number | null
          government_type?: string | null
          head_of_government?: string | null
          head_of_state?: string | null
          human_dev_index?: number | null
          id?: string
          industrial_production_index?: number | null
          inflation_rate?: number | null
          labor_cost_index?: number | null
          labor_force_participation?: number | null
          last_election_date?: string | null
          major_industries?: string[] | null
          manufacturer_new_orders?: number | null
          median_age?: number | null
          next_election_date?: string | null
          nonfarm_payrolls?: number | null
          official_languages?: string[] | null
          opposition_parties?: Json | null
          pce_rate?: number | null
          personal_income?: number | null
          population?: number | null
          poverty_rate?: number | null
          press_freedom_rank?: number | null
          raw_data?: Json | null
          real_gdp?: number | null
          region?: string | null
          ruling_party?: string | null
          stock_market_index?: number | null
          stock_market_name?: string | null
          tags?: string[]
          trade_partners?: Json | null
          unemployment_rate?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      lobbying_disclosures: {
        Row: {
          amount: number | null
          client_name: string | null
          created_at: string
          filing_date: string | null
          filing_period: string | null
          filing_uuid: string | null
          filing_year: number | null
          govt_entities: Json | null
          id: string
          issues: Json | null
          lobbyists: Json | null
          raw_data: Json | null
          registrant_name: string
          source: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          client_name?: string | null
          created_at?: string
          filing_date?: string | null
          filing_period?: string | null
          filing_uuid?: string | null
          filing_year?: number | null
          govt_entities?: Json | null
          id?: string
          issues?: Json | null
          lobbyists?: Json | null
          raw_data?: Json | null
          registrant_name: string
          source?: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          client_name?: string | null
          created_at?: string
          filing_date?: string | null
          filing_period?: string | null
          filing_uuid?: string | null
          filing_year?: number | null
          govt_entities?: Json | null
          id?: string
          issues?: Json | null
          lobbyists?: Json | null
          raw_data?: Json | null
          registrant_name?: string
          source?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      local_impacts: {
        Row: {
          content: string
          created_at: string
          id: string
          slug: string
          state: string
          summary: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          slug: string
          state: string
          summary?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          slug?: string
          state?: string
          summary?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      maga_files: {
        Row: {
          content: string
          created_at: string
          id: string
          name: string
          slug: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          name: string
          slug: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      messaging_audience_analyses: {
        Row: {
          audience_scores: Json
          effectiveness_score: number
          generated_at: string
          id: string
          messaging_slug: string
          model: string
          resonance_factors: Json
          risks: Json
          segment_breakdown: Json
          summary: string
          updated_at: string
        }
        Insert: {
          audience_scores?: Json
          effectiveness_score?: number
          generated_at?: string
          id?: string
          messaging_slug: string
          model?: string
          resonance_factors?: Json
          risks?: Json
          segment_breakdown?: Json
          summary?: string
          updated_at?: string
        }
        Update: {
          audience_scores?: Json
          effectiveness_score?: number
          generated_at?: string
          id?: string
          messaging_slug?: string
          model?: string
          resonance_factors?: Json
          risks?: Json
          segment_breakdown?: Json
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      messaging_guidance: {
        Row: {
          author: string | null
          content: string
          created_at: string
          id: string
          issue_areas: string[]
          published_date: string | null
          research_type: string
          slug: string
          source: string
          source_url: string | null
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          content?: string
          created_at?: string
          id?: string
          issue_areas?: string[]
          published_date?: string | null
          research_type?: string
          slug: string
          source?: string
          source_url?: string | null
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          content?: string
          created_at?: string
          id?: string
          issue_areas?: string[]
          published_date?: string | null
          research_type?: string
          slug?: string
          source?: string
          source_url?: string | null
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      messaging_impact_analyses: {
        Row: {
          affected_groups: Json
          amplifies: Json
          generated_at: string
          id: string
          media_impact: string | null
          messaging_slug: string
          model: string
          political_impact: string | null
          recommended_channels: Json
          scope: string
          scope_ref: string | null
          summary: string
          undermines: Json
          updated_at: string
        }
        Insert: {
          affected_groups?: Json
          amplifies?: Json
          generated_at?: string
          id?: string
          media_impact?: string | null
          messaging_slug: string
          model?: string
          political_impact?: string | null
          recommended_channels?: Json
          scope?: string
          scope_ref?: string | null
          summary?: string
          undermines?: Json
          updated_at?: string
        }
        Update: {
          affected_groups?: Json
          amplifies?: Json
          generated_at?: string
          id?: string
          media_impact?: string | null
          messaging_slug?: string
          model?: string
          political_impact?: string | null
          recommended_channels?: Json
          scope?: string
          scope_ref?: string | null
          summary?: string
          undermines?: Json
          updated_at?: string
        }
        Relationships: []
      }
      mit_election_results: {
        Row: {
          candidate: string
          candidatevotes: number | null
          county_fips: string | null
          county_name: string | null
          created_at: string
          district: string | null
          id: string
          office: string
          party: string | null
          source: string
          special: boolean
          stage: string
          state: string
          state_po: string
          totalvotes: number | null
          updated_at: string
          writein: boolean
          year: number
        }
        Insert: {
          candidate: string
          candidatevotes?: number | null
          county_fips?: string | null
          county_name?: string | null
          created_at?: string
          district?: string | null
          id?: string
          office: string
          party?: string | null
          source?: string
          special?: boolean
          stage?: string
          state: string
          state_po: string
          totalvotes?: number | null
          updated_at?: string
          writein?: boolean
          year: number
        }
        Update: {
          candidate?: string
          candidatevotes?: number | null
          county_fips?: string | null
          county_name?: string | null
          created_at?: string
          district?: string | null
          id?: string
          office?: string
          party?: string | null
          source?: string
          special?: boolean
          stage?: string
          state?: string
          state_po?: string
          totalvotes?: number | null
          updated_at?: string
          writein?: boolean
          year?: number
        }
        Relationships: []
      }
      mn_cfb_candidates: {
        Row: {
          candidate_name: string
          chamber: string
          committee_name: string
          contribution_count: number
          contributor_types: Json
          created_at: string
          expenditure_count: number
          expenditure_types: Json
          id: string
          in_kind_total: number
          last_synced_at: string
          net_cash: number
          reg_num: string
          top_contributors: Json
          top_vendors: Json
          total_contributions: number
          total_expenditures: number
          updated_at: string
          yearly_breakdown: Json
          years_active: string[]
        }
        Insert: {
          candidate_name: string
          chamber?: string
          committee_name: string
          contribution_count?: number
          contributor_types?: Json
          created_at?: string
          expenditure_count?: number
          expenditure_types?: Json
          id?: string
          in_kind_total?: number
          last_synced_at?: string
          net_cash?: number
          reg_num: string
          top_contributors?: Json
          top_vendors?: Json
          total_contributions?: number
          total_expenditures?: number
          updated_at?: string
          yearly_breakdown?: Json
          years_active?: string[]
        }
        Update: {
          candidate_name?: string
          chamber?: string
          committee_name?: string
          contribution_count?: number
          contributor_types?: Json
          created_at?: string
          expenditure_count?: number
          expenditure_types?: Json
          id?: string
          in_kind_total?: number
          last_synced_at?: string
          net_cash?: number
          reg_num?: string
          top_contributors?: Json
          top_vendors?: Json
          total_contributions?: number
          total_expenditures?: number
          updated_at?: string
          yearly_breakdown?: Json
          years_active?: string[]
        }
        Relationships: []
      }
      narrative_reports: {
        Row: {
          content: string
          created_at: string
          id: string
          name: string
          slug: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          name: string
          slug: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      news_source_ratings: {
        Row: {
          bias: string
          confidence: number | null
          country: string | null
          created_at: string
          factuality: string
          id: string
          is_sponsored: boolean
          notes: string | null
          ownership: string | null
          rating_source: string
          source_domain: string | null
          source_name: string
          updated_at: string
        }
        Insert: {
          bias: string
          confidence?: number | null
          country?: string | null
          created_at?: string
          factuality?: string
          id?: string
          is_sponsored?: boolean
          notes?: string | null
          ownership?: string | null
          rating_source?: string
          source_domain?: string | null
          source_name: string
          updated_at?: string
        }
        Update: {
          bias?: string
          confidence?: number | null
          country?: string | null
          created_at?: string
          factuality?: string
          id?: string
          is_sponsored?: boolean
          notes?: string | null
          ownership?: string | null
          rating_source?: string
          source_domain?: string | null
          source_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      news_stories: {
        Row: {
          article_count: number
          blindspot_side: string | null
          category: string | null
          center_count: number
          center_pct: number | null
          created_at: string
          first_seen_at: string
          id: string
          is_blindspot: boolean
          last_updated_at: string
          left_count: number
          left_pct: number | null
          right_count: number
          right_pct: number | null
          scope: string
          summary: string | null
          title: string
          topic_keywords: string[] | null
          unrated_count: number
        }
        Insert: {
          article_count?: number
          blindspot_side?: string | null
          category?: string | null
          center_count?: number
          center_pct?: number | null
          created_at?: string
          first_seen_at?: string
          id?: string
          is_blindspot?: boolean
          last_updated_at?: string
          left_count?: number
          left_pct?: number | null
          right_count?: number
          right_pct?: number | null
          scope?: string
          summary?: string | null
          title: string
          topic_keywords?: string[] | null
          unrated_count?: number
        }
        Update: {
          article_count?: number
          blindspot_side?: string | null
          category?: string | null
          center_count?: number
          center_pct?: number | null
          created_at?: string
          first_seen_at?: string
          id?: string
          is_blindspot?: boolean
          last_updated_at?: string
          left_count?: number
          left_pct?: number | null
          right_count?: number
          right_pct?: number | null
          scope?: string
          summary?: string | null
          title?: string
          topic_keywords?: string[] | null
          unrated_count?: number
        }
        Relationships: []
      }
      news_story_articles: {
        Row: {
          added_at: string
          bias: string | null
          briefing_id: string
          id: string
          source_name: string
          story_id: string
        }
        Insert: {
          added_at?: string
          bias?: string | null
          briefing_id: string
          id?: string
          source_name: string
          story_id: string
        }
        Update: {
          added_at?: string
          bias?: string | null
          briefing_id?: string
          id?: string
          source_name?: string
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_story_articles_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "news_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          link: string | null
          metadata: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      oppo_tracker_items: {
        Row: {
          assignee_id: string | null
          attachments: Json
          body: string
          column_name: string
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          position: number
          priority: string
          source_urls: string[]
          status: string
          tags: string[]
          title: string
          tracker_id: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          attachments?: Json
          body?: string
          column_name?: string
          created_at?: string
          created_by: string
          due_date?: string | null
          id?: string
          position?: number
          priority?: string
          source_urls?: string[]
          status?: string
          tags?: string[]
          title: string
          tracker_id: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          attachments?: Json
          body?: string
          column_name?: string
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          position?: number
          priority?: string
          source_urls?: string[]
          status?: string
          tags?: string[]
          title?: string
          tracker_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oppo_tracker_items_tracker_id_fkey"
            columns: ["tracker_id"]
            isOneToOne: false
            referencedRelation: "oppo_trackers"
            referencedColumns: ["id"]
          },
        ]
      }
      oppo_trackers: {
        Row: {
          columns: Json
          created_at: string
          description: string
          id: string
          is_shared: boolean
          name: string
          owner_id: string
          scope: string
          scope_ref: string | null
          updated_at: string
        }
        Insert: {
          columns?: Json
          created_at?: string
          description?: string
          id?: string
          is_shared?: boolean
          name: string
          owner_id: string
          scope?: string
          scope_ref?: string | null
          updated_at?: string
        }
        Update: {
          columns?: Json
          created_at?: string
          description?: string
          id?: string
          is_shared?: boolean
          name?: string
          owner_id?: string
          scope?: string
          scope_ref?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      polling_aggregates: {
        Row: {
          candidate_a: string | null
          candidate_a_pct: number | null
          candidate_b: string | null
          candidate_b_pct: number | null
          computed_at: string
          cycle: number
          district: string | null
          id: string
          last_poll_date: string | null
          margin: number | null
          poll_count: number
          race_type: string
          raw_data: Json | null
          state_abbr: string
          trend_30d: number | null
          undecided_pct: number | null
          weighted_method: string
        }
        Insert: {
          candidate_a?: string | null
          candidate_a_pct?: number | null
          candidate_b?: string | null
          candidate_b_pct?: number | null
          computed_at?: string
          cycle?: number
          district?: string | null
          id?: string
          last_poll_date?: string | null
          margin?: number | null
          poll_count?: number
          race_type: string
          raw_data?: Json | null
          state_abbr: string
          trend_30d?: number | null
          undecided_pct?: number | null
          weighted_method?: string
        }
        Update: {
          candidate_a?: string | null
          candidate_a_pct?: number | null
          candidate_b?: string | null
          candidate_b_pct?: number | null
          computed_at?: string
          cycle?: number
          district?: string | null
          id?: string
          last_poll_date?: string | null
          margin?: number | null
          poll_count?: number
          race_type?: string
          raw_data?: Json | null
          state_abbr?: string
          trend_30d?: number | null
          undecided_pct?: number | null
          weighted_method?: string
        }
        Relationships: []
      }
      polling_alert_subscriptions: {
        Row: {
          cadence: string
          created_at: string
          email: string
          enabled: boolean
          id: string
          last_sent_at: string | null
          min_margin_change: number | null
          next_run_at: string
          poll_types: string[]
          scope: string
          scope_value: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cadence?: string
          created_at?: string
          email: string
          enabled?: boolean
          id?: string
          last_sent_at?: string | null
          min_margin_change?: number | null
          next_run_at?: string
          poll_types?: string[]
          scope?: string
          scope_value?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cadence?: string
          created_at?: string
          email?: string
          enabled?: boolean
          id?: string
          last_sent_at?: string | null
          min_margin_change?: number | null
          next_run_at?: string
          poll_types?: string[]
          scope?: string
          scope_value?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      polling_data: {
        Row: {
          approve_pct: number | null
          candidate_or_topic: string
          created_at: string
          date_conducted: string
          disapprove_pct: number | null
          end_date: string | null
          favor_pct: number | null
          id: string
          margin: number | null
          margin_of_error: number | null
          methodology: string | null
          oppose_pct: number | null
          partisan_lean: string | null
          poll_type: string
          question: string | null
          raw_data: Json | null
          sample_size: number | null
          sample_type: string | null
          source: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          approve_pct?: number | null
          candidate_or_topic: string
          created_at?: string
          date_conducted: string
          disapprove_pct?: number | null
          end_date?: string | null
          favor_pct?: number | null
          id?: string
          margin?: number | null
          margin_of_error?: number | null
          methodology?: string | null
          oppose_pct?: number | null
          partisan_lean?: string | null
          poll_type?: string
          question?: string | null
          raw_data?: Json | null
          sample_size?: number | null
          sample_type?: string | null
          source: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          approve_pct?: number | null
          candidate_or_topic?: string
          created_at?: string
          date_conducted?: string
          disapprove_pct?: number | null
          end_date?: string | null
          favor_pct?: number | null
          id?: string
          margin?: number | null
          margin_of_error?: number | null
          methodology?: string | null
          oppose_pct?: number | null
          partisan_lean?: string | null
          poll_type?: string
          question?: string | null
          raw_data?: Json | null
          sample_size?: number | null
          sample_type?: string | null
          source?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prediction_markets: {
        Row: {
          candidate_name: string | null
          category: string
          created_at: string
          district: string | null
          id: string
          last_traded_at: string | null
          liquidity: number | null
          market_id: string
          market_url: string | null
          no_price: number | null
          raw_data: Json | null
          source: string
          state_abbr: string | null
          status: string
          title: string
          updated_at: string
          volume: number | null
          yes_price: number | null
        }
        Insert: {
          candidate_name?: string | null
          category?: string
          created_at?: string
          district?: string | null
          id?: string
          last_traded_at?: string | null
          liquidity?: number | null
          market_id: string
          market_url?: string | null
          no_price?: number | null
          raw_data?: Json | null
          source?: string
          state_abbr?: string | null
          status?: string
          title: string
          updated_at?: string
          volume?: number | null
          yes_price?: number | null
        }
        Update: {
          candidate_name?: string | null
          category?: string
          created_at?: string
          district?: string | null
          id?: string
          last_traded_at?: string | null
          liquidity?: number | null
          market_id?: string
          market_url?: string | null
          no_price?: number | null
          raw_data?: Json | null
          source?: string
          state_abbr?: string | null
          status?: string
          title?: string
          updated_at?: string
          volume?: number | null
          yes_price?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          dark_mode: boolean
          display_name: string | null
          id: string
          updated_at: string
          windows_theme: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          dark_mode?: boolean
          display_name?: string | null
          id: string
          updated_at?: string
          windows_theme?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          dark_mode?: boolean
          display_name?: string | null
          id?: string
          updated_at?: string
          windows_theme?: string
        }
        Relationships: []
      }
      report_schedules: {
        Row: {
          cadence: string
          created_at: string
          enabled: boolean
          id: string
          last_sent_at: string | null
          next_run_at: string
          owner_id: string
          recipients: string[]
          report_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          cadence?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_sent_at?: string | null
          next_run_at?: string
          owner_id: string
          recipients?: string[]
          report_id: string
          subject?: string
          updated_at?: string
        }
        Update: {
          cadence?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_sent_at?: string | null
          next_run_at?: string
          owner_id?: string
          recipients?: string[]
          report_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_schedules_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_shares: {
        Row: {
          can_edit: boolean
          created_at: string
          id: string
          report_id: string
          shared_with_user_id: string
        }
        Insert: {
          can_edit?: boolean
          created_at?: string
          id?: string
          report_id: string
          shared_with_user_id: string
        }
        Update: {
          can_edit?: boolean
          created_at?: string
          id?: string
          report_id?: string
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_shares_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          blocks: Json
          created_at: string
          description: string
          id: string
          is_public: boolean
          owner_id: string
          title: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          description?: string
          id?: string
          is_public?: boolean
          owner_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          description?: string
          id?: string
          is_public?: boolean
          owner_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "role_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      role_groups: {
        Row: {
          color: string
          created_at: string
          description: string
          id: string
          name: string
          roles: string[]
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string
          id?: string
          name: string
          roles?: string[]
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          roles?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          alert_enabled: boolean
          created_at: string
          filters: Json
          id: string
          last_run_at: string | null
          name: string
          query: string
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_enabled?: boolean
          created_at?: string
          filters?: Json
          id?: string
          last_run_at?: string | null
          name: string
          query?: string
          scope?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_enabled?: boolean
          created_at?: string
          filters?: Json
          id?: string
          last_run_at?: string | null
          name?: string
          query?: string
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      section_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          section_id: string
          subsection_id: string | null
          updated_at: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          section_id: string
          subsection_id?: string | null
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          section_id?: string
          subsection_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stakeholder_interactions: {
        Row: {
          body: string
          created_at: string
          follow_up_at: string | null
          id: string
          interaction_type: string
          occurred_at: string
          outcome: string | null
          stakeholder_id: string
          subject: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          follow_up_at?: string | null
          id?: string
          interaction_type?: string
          occurred_at?: string
          outcome?: string | null
          stakeholder_id: string
          subject?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          follow_up_at?: string | null
          id?: string
          interaction_type?: string
          occurred_at?: string
          outcome?: string | null
          stakeholder_id?: string
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stakeholder_interactions_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholders: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          influence_score: number | null
          metadata: Json
          name: string
          notes: string
          organization: string | null
          owner_id: string
          party: string | null
          phone: string | null
          social_handles: Json
          state_abbr: string | null
          tags: string[]
          title: string | null
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          influence_score?: number | null
          metadata?: Json
          name: string
          notes?: string
          organization?: string | null
          owner_id: string
          party?: string | null
          phone?: string | null
          social_handles?: Json
          state_abbr?: string | null
          tags?: string[]
          title?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          influence_score?: number | null
          metadata?: Json
          name?: string
          notes?: string
          organization?: string | null
          owner_id?: string
          party?: string | null
          phone?: string | null
          social_handles?: Json
          state_abbr?: string | null
          tags?: string[]
          title?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      state_cfb_candidates: {
        Row: {
          candidate_name: string
          chamber: string
          committee_name: string
          contribution_count: number
          contributor_types: Json
          created_at: string
          expenditure_count: number
          expenditure_types: Json
          id: string
          in_kind_total: number
          last_synced_at: string
          net_cash: number
          office: string | null
          party: string | null
          reg_num: string
          state_abbr: string
          top_contributors: Json
          top_vendors: Json
          total_contributions: number
          total_expenditures: number
          updated_at: string
          yearly_breakdown: Json
          years_active: string[]
        }
        Insert: {
          candidate_name: string
          chamber?: string
          committee_name: string
          contribution_count?: number
          contributor_types?: Json
          created_at?: string
          expenditure_count?: number
          expenditure_types?: Json
          id?: string
          in_kind_total?: number
          last_synced_at?: string
          net_cash?: number
          office?: string | null
          party?: string | null
          reg_num: string
          state_abbr: string
          top_contributors?: Json
          top_vendors?: Json
          total_contributions?: number
          total_expenditures?: number
          updated_at?: string
          yearly_breakdown?: Json
          years_active?: string[]
        }
        Update: {
          candidate_name?: string
          chamber?: string
          committee_name?: string
          contribution_count?: number
          contributor_types?: Json
          created_at?: string
          expenditure_count?: number
          expenditure_types?: Json
          id?: string
          in_kind_total?: number
          last_synced_at?: string
          net_cash?: number
          office?: string | null
          party?: string | null
          reg_num?: string
          state_abbr?: string
          top_contributors?: Json
          top_vendors?: Json
          total_contributions?: number
          total_expenditures?: number
          updated_at?: string
          yearly_breakdown?: Json
          years_active?: string[]
        }
        Relationships: []
      }
      state_leg_election_results: {
        Row: {
          candidate_name: string
          chamber: string
          created_at: string
          district_number: string
          election_date: string | null
          election_type: string
          election_year: number
          id: string
          is_incumbent: boolean | null
          is_winner: boolean | null
          is_write_in: boolean | null
          party: string | null
          raw_data: Json | null
          source: string | null
          state_abbr: string
          total_votes: number | null
          turnout: number | null
          updated_at: string
          vote_pct: number | null
          votes: number | null
        }
        Insert: {
          candidate_name: string
          chamber: string
          created_at?: string
          district_number: string
          election_date?: string | null
          election_type?: string
          election_year: number
          id?: string
          is_incumbent?: boolean | null
          is_winner?: boolean | null
          is_write_in?: boolean | null
          party?: string | null
          raw_data?: Json | null
          source?: string | null
          state_abbr: string
          total_votes?: number | null
          turnout?: number | null
          updated_at?: string
          vote_pct?: number | null
          votes?: number | null
        }
        Update: {
          candidate_name?: string
          chamber?: string
          created_at?: string
          district_number?: string
          election_date?: string | null
          election_type?: string
          election_year?: number
          id?: string
          is_incumbent?: boolean | null
          is_winner?: boolean | null
          is_write_in?: boolean | null
          party?: string | null
          raw_data?: Json | null
          source?: string | null
          state_abbr?: string
          total_votes?: number | null
          turnout?: number | null
          updated_at?: string
          vote_pct?: number | null
          votes?: number | null
        }
        Relationships: []
      }
      state_legislative_bills: {
        Row: {
          classification: string[]
          created_at: string
          first_action_date: string | null
          id: string
          identifier: string
          latest_action_date: string | null
          latest_action_description: string | null
          openstates_id: string
          raw_data: Json | null
          session: string
          source_url: string | null
          sponsor_name: string | null
          sponsor_party: string | null
          state_abbr: string
          status: string | null
          subjects: string[]
          title: string
          updated_at: string
        }
        Insert: {
          classification?: string[]
          created_at?: string
          first_action_date?: string | null
          id?: string
          identifier: string
          latest_action_date?: string | null
          latest_action_description?: string | null
          openstates_id: string
          raw_data?: Json | null
          session: string
          source_url?: string | null
          sponsor_name?: string | null
          sponsor_party?: string | null
          state_abbr: string
          status?: string | null
          subjects?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          classification?: string[]
          created_at?: string
          first_action_date?: string | null
          id?: string
          identifier?: string
          latest_action_date?: string | null
          latest_action_description?: string | null
          openstates_id?: string
          raw_data?: Json | null
          session?: string
          source_url?: string | null
          sponsor_name?: string | null
          sponsor_party?: string | null
          state_abbr?: string
          status?: string | null
          subjects?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      state_legislative_profiles: {
        Row: {
          asian_pct: number | null
          avg_household_size: number | null
          black_pct: number | null
          chamber: string
          created_at: string
          district_id: string
          district_number: string
          education_bachelor_pct: number | null
          foreign_born_pct: number | null
          hispanic_pct: number | null
          id: string
          median_age: number | null
          median_home_value: number | null
          median_income: number | null
          median_rent: number | null
          owner_occupied_pct: number | null
          population: number | null
          poverty_rate: number | null
          raw_data: Json | null
          state: string
          state_abbr: string
          total_households: number | null
          unemployment_rate: number | null
          uninsured_pct: number | null
          updated_at: string
          veteran_pct: number | null
          white_pct: number | null
        }
        Insert: {
          asian_pct?: number | null
          avg_household_size?: number | null
          black_pct?: number | null
          chamber: string
          created_at?: string
          district_id: string
          district_number?: string
          education_bachelor_pct?: number | null
          foreign_born_pct?: number | null
          hispanic_pct?: number | null
          id?: string
          median_age?: number | null
          median_home_value?: number | null
          median_income?: number | null
          median_rent?: number | null
          owner_occupied_pct?: number | null
          population?: number | null
          poverty_rate?: number | null
          raw_data?: Json | null
          state?: string
          state_abbr?: string
          total_households?: number | null
          unemployment_rate?: number | null
          uninsured_pct?: number | null
          updated_at?: string
          veteran_pct?: number | null
          white_pct?: number | null
        }
        Update: {
          asian_pct?: number | null
          avg_household_size?: number | null
          black_pct?: number | null
          chamber?: string
          created_at?: string
          district_id?: string
          district_number?: string
          education_bachelor_pct?: number | null
          foreign_born_pct?: number | null
          hispanic_pct?: number | null
          id?: string
          median_age?: number | null
          median_home_value?: number | null
          median_income?: number | null
          median_rent?: number | null
          owner_occupied_pct?: number | null
          population?: number | null
          poverty_rate?: number | null
          raw_data?: Json | null
          state?: string
          state_abbr?: string
          total_households?: number | null
          unemployment_rate?: number | null
          uninsured_pct?: number | null
          updated_at?: string
          veteran_pct?: number | null
          white_pct?: number | null
        }
        Relationships: []
      }
      state_legislators: {
        Row: {
          capitol_office: Json | null
          chamber: string
          committees: Json | null
          created_at: string
          district: string | null
          email: string | null
          first_name: string | null
          id: string
          image_url: string | null
          last_name: string | null
          name: string
          openstates_id: string
          party: string | null
          raw_data: Json | null
          source_url: string | null
          state_abbr: string
          updated_at: string
        }
        Insert: {
          capitol_office?: Json | null
          chamber?: string
          committees?: Json | null
          created_at?: string
          district?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          image_url?: string | null
          last_name?: string | null
          name: string
          openstates_id: string
          party?: string | null
          raw_data?: Json | null
          source_url?: string | null
          state_abbr: string
          updated_at?: string
        }
        Update: {
          capitol_office?: Json | null
          chamber?: string
          committees?: Json | null
          created_at?: string
          district?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          image_url?: string | null
          last_name?: string | null
          name?: string
          openstates_id?: string
          party?: string | null
          raw_data?: Json | null
          source_url?: string | null
          state_abbr?: string
          updated_at?: string
        }
        Relationships: []
      }
      state_voter_stats: {
        Row: {
          created_at: string
          id: string
          registration_rate: number | null
          source: string | null
          source_url: string | null
          state: string
          total_eligible: number | null
          total_registered: number | null
          turnout_general_2024: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          registration_rate?: number | null
          source?: string | null
          source_url?: string | null
          state: string
          total_eligible?: number | null
          total_registered?: number | null
          turnout_general_2024?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          registration_rate?: number | null
          source?: string | null
          source_url?: string | null
          state?: string
          total_eligible?: number | null
          total_registered?: number | null
          turnout_general_2024?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      subject_audience_analyses: {
        Row: {
          audience_scores: Json
          effectiveness_score: number
          generated_at: string
          id: string
          model: string
          resonance_factors: Json
          risks: Json
          segment_breakdown: Json
          subject_ref: string
          subject_type: string
          summary: string
          updated_at: string
        }
        Insert: {
          audience_scores?: Json
          effectiveness_score?: number
          generated_at?: string
          id?: string
          model?: string
          resonance_factors?: Json
          risks?: Json
          segment_breakdown?: Json
          subject_ref: string
          subject_type: string
          summary?: string
          updated_at?: string
        }
        Update: {
          audience_scores?: Json
          effectiveness_score?: number
          generated_at?: string
          id?: string
          model?: string
          resonance_factors?: Json
          risks?: Json
          segment_breakdown?: Json
          subject_ref?: string
          subject_type?: string
          summary?: string
          updated_at?: string
        }
        Relationships: []
      }
      subject_impact_analyses: {
        Row: {
          affected_groups: Json
          amplifies: Json
          generated_at: string
          id: string
          media_impact: string | null
          model: string
          political_impact: string | null
          recommended_channels: Json
          scope: string
          scope_ref: string | null
          subject_ref: string
          subject_type: string
          summary: string
          undermines: Json
          updated_at: string
        }
        Insert: {
          affected_groups?: Json
          amplifies?: Json
          generated_at?: string
          id?: string
          media_impact?: string | null
          model?: string
          political_impact?: string | null
          recommended_channels?: Json
          scope?: string
          scope_ref?: string | null
          subject_ref: string
          subject_type: string
          summary?: string
          undermines?: Json
          updated_at?: string
        }
        Update: {
          affected_groups?: Json
          amplifies?: Json
          generated_at?: string
          id?: string
          media_impact?: string | null
          model?: string
          political_impact?: string | null
          recommended_channels?: Json
          scope?: string
          scope_ref?: string | null
          subject_ref?: string
          subject_type?: string
          summary?: string
          undermines?: Json
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      sync_metadata: {
        Row: {
          id: number
          last_commit_sha: string | null
          last_synced_at: string | null
        }
        Insert: {
          id?: number
          last_commit_sha?: string | null
          last_synced_at?: string | null
        }
        Update: {
          id?: number
          last_commit_sha?: string | null
          last_synced_at?: string | null
        }
        Relationships: []
      }
      sync_run_log: {
        Row: {
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          rows_synced: number | null
          source: string
          started_at: string
          status: string
        }
        Insert: {
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          rows_synced?: number | null
          source: string
          started_at?: string
          status?: string
        }
        Update: {
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          rows_synced?: number | null
          source?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      talking_points: {
        Row: {
          angle: string
          audience: string
          created_at: string
          evidence: Json
          generated_by: string | null
          id: string
          model: string
          points: Json
          subject_ref: string
          subject_type: string
          updated_at: string
        }
        Insert: {
          angle?: string
          audience?: string
          created_at?: string
          evidence?: Json
          generated_by?: string | null
          id?: string
          model?: string
          points?: Json
          subject_ref: string
          subject_type: string
          updated_at?: string
        }
        Update: {
          angle?: string
          audience?: string
          created_at?: string
          evidence?: Json
          generated_by?: string | null
          id?: string
          model?: string
          points?: Json
          subject_ref?: string
          subject_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      tracked_bills: {
        Row: {
          bill_id: number
          bill_number: string
          created_at: string
          id: string
          last_action: string | null
          last_action_date: string | null
          legiscan_url: string | null
          notes: string | null
          state: string
          status_desc: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bill_id: number
          bill_number: string
          created_at?: string
          id?: string
          last_action?: string | null
          last_action_date?: string | null
          legiscan_url?: string | null
          notes?: string | null
          state?: string
          status_desc?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bill_id?: number
          bill_number?: string
          created_at?: string
          id?: string
          last_action?: string | null
          last_action_date?: string | null
          legiscan_url?: string | null
          notes?: string | null
          state?: string
          status_desc?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_history: {
        Row: {
          created_at: string
          fees: number | null
          id: string
          market_id: string | null
          market_title: string | null
          order_id: string | null
          order_type: string | null
          platform: string
          pnl: number | null
          price: number | null
          quantity: number | null
          raw_response: Json | null
          settled_at: string | null
          side: string
          status: string
          total_cost: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fees?: number | null
          id?: string
          market_id?: string | null
          market_title?: string | null
          order_id?: string | null
          order_type?: string | null
          platform: string
          pnl?: number | null
          price?: number | null
          quantity?: number | null
          raw_response?: Json | null
          settled_at?: string | null
          side: string
          status?: string
          total_cost?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          fees?: number | null
          id?: string
          market_id?: string | null
          market_title?: string | null
          order_id?: string | null
          order_type?: string | null
          platform?: string
          pnl?: number | null
          price?: number | null
          quantity?: number | null
          raw_response?: Json | null
          settled_at?: string | null
          side?: string
          status?: string
          total_cost?: number | null
          user_id?: string
        }
        Relationships: []
      }
      url_bias_checks: {
        Row: {
          ai_model: string | null
          bias: string | null
          checked_by: string | null
          created_at: string
          excerpt: string | null
          expires_at: string | null
          factuality: string | null
          id: string
          reasoning: string | null
          source_name: string | null
          title: string | null
          url: string
          url_hash: string
        }
        Insert: {
          ai_model?: string | null
          bias?: string | null
          checked_by?: string | null
          created_at?: string
          excerpt?: string | null
          expires_at?: string | null
          factuality?: string | null
          id?: string
          reasoning?: string | null
          source_name?: string | null
          title?: string | null
          url: string
          url_hash: string
        }
        Update: {
          ai_model?: string | null
          bias?: string | null
          checked_by?: string | null
          created_at?: string
          excerpt?: string | null
          expires_at?: string | null
          factuality?: string | null
          id?: string
          reasoning?: string | null
          source_name?: string | null
          title?: string | null
          url?: string
          url_hash?: string
        }
        Relationships: []
      }
      user_activity_logs: {
        Row: {
          activity_type: string
          created_at: string
          details: Json | null
          id: string
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_bias_history: {
        Row: {
          bias: string
          briefing_id: string | null
          id: string
          read_at: string
          source_name: string
          user_id: string
        }
        Insert: {
          bias: string
          briefing_id?: string | null
          id?: string
          read_at?: string
          source_name: string
          user_id: string
        }
        Update: {
          bias?: string
          briefing_id?: string | null
          id?: string
          read_at?: string
          source_name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          browser: string | null
          consent_granted: boolean
          consent_granted_at: string | null
          created_at: string
          device_name: string
          id: string
          last_seen_at: string | null
          platform: string | null
          tags: string[]
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          consent_granted?: boolean
          consent_granted_at?: string | null
          created_at?: string
          device_name?: string
          id?: string
          last_seen_at?: string | null
          platform?: string | null
          tags?: string[]
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          consent_granted?: boolean
          consent_granted_at?: string | null
          created_at?: string
          device_name?: string
          id?: string
          last_seen_at?: string | null
          platform?: string | null
          tags?: string[]
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_integrations: {
        Row: {
          api_key: string
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          service: string
          slug: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          service: string
          slug?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          service?: string
          slug?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: string
          token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      user_mail: {
        Row: {
          body: string
          created_at: string
          deleted_by_recipient: boolean
          deleted_by_sender: boolean
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
          subject: string
        }
        Insert: {
          body?: string
          created_at?: string
          deleted_by_recipient?: boolean
          deleted_by_sender?: boolean
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
          subject?: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_by_recipient?: boolean
          deleted_by_sender?: boolean
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
          subject?: string
        }
        Relationships: []
      }
      user_market_credentials: {
        Row: {
          created_at: string
          encrypted_key: string
          encrypted_passphrase: string | null
          encrypted_secret: string | null
          id: string
          is_active: boolean
          label: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_key: string
          encrypted_passphrase?: string | null
          encrypted_secret?: string | null
          id?: string
          is_active?: boolean
          label?: string
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_key?: string
          encrypted_passphrase?: string | null
          encrypted_secret?: string | null
          id?: string
          is_active?: boolean
          label?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_news_preferences: {
        Row: {
          blocked_sources: string[] | null
          created_at: string
          digest_frequency: string | null
          digest_last_sent_at: string | null
          followed_regions: string[] | null
          followed_sources: string[] | null
          followed_topics: string[] | null
          hide_sponsored: boolean
          min_factuality: string | null
          preferred_bias_balance: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          blocked_sources?: string[] | null
          created_at?: string
          digest_frequency?: string | null
          digest_last_sent_at?: string | null
          followed_regions?: string[] | null
          followed_sources?: string[] | null
          followed_topics?: string[] | null
          hide_sponsored?: boolean
          min_factuality?: string | null
          preferred_bias_balance?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          blocked_sources?: string[] | null
          created_at?: string
          digest_frequency?: string | null
          digest_last_sent_at?: string | null
          followed_regions?: string[] | null
          followed_sources?: string[] | null
          followed_topics?: string[] | null
          hide_sponsored?: boolean
          min_factuality?: string | null
          preferred_bias_balance?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          created_at: string
          display_name: string
          id: string
          last_seen_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id?: string
          last_seen_at?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          last_seen_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sync_preferences: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          interval_minutes: number
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          interval_minutes?: number
          source: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          interval_minutes?: number
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vulnerability_scores: {
        Row: {
          candidate_slug: string
          category_scores: Json
          generated_at: string
          id: string
          model: string
          overall_score: number | null
          summary: string
          top_vulnerabilities: Json
          updated_at: string
        }
        Insert: {
          candidate_slug: string
          category_scores?: Json
          generated_at?: string
          id?: string
          model?: string
          overall_score?: number | null
          summary?: string
          top_vulnerabilities?: Json
          updated_at?: string
        }
        Update: {
          candidate_slug?: string
          category_scores?: Json
          generated_at?: string
          id?: string
          model?: string
          overall_score?: number | null
          summary?: string
          top_vulnerabilities?: Json
          updated_at?: string
        }
        Relationships: []
      }
      war_room_members: {
        Row: {
          added_at: string
          id: string
          role: string
          user_id: string
          war_room_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          role?: string
          user_id: string
          war_room_id: string
        }
        Update: {
          added_at?: string
          id?: string
          role?: string
          user_id?: string
          war_room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "war_room_members_war_room_id_fkey"
            columns: ["war_room_id"]
            isOneToOne: false
            referencedRelation: "war_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      war_room_messages: {
        Row: {
          attachments: Json
          body: string
          created_at: string
          id: string
          user_id: string
          war_room_id: string
        }
        Insert: {
          attachments?: Json
          body: string
          created_at?: string
          id?: string
          user_id: string
          war_room_id: string
        }
        Update: {
          attachments?: Json
          body?: string
          created_at?: string
          id?: string
          user_id?: string
          war_room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "war_room_messages_war_room_id_fkey"
            columns: ["war_room_id"]
            isOneToOne: false
            referencedRelation: "war_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      war_rooms: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          owner_id: string
          pinned_entities: Json
          race_scope: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          owner_id?: string
          pinned_entities?: Json
          race_scope?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          owner_id?: string
          pinned_entities?: Json
          race_scope?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      watchlist_items: {
        Row: {
          alert_on_change: boolean
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          label: string | null
          notes: string | null
          user_id: string
        }
        Insert: {
          alert_on_change?: boolean
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          label?: string | null
          notes?: string | null
          user_id: string
        }
        Update: {
          alert_on_change?: boolean
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          label?: string | null
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_endpoints: {
        Row: {
          channel: string
          created_at: string
          enabled: boolean
          id: string
          name: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      wiki_changelog: {
        Row: {
          change_type: string
          created_at: string
          id: string
          new_content: string
          old_content: string
          slug: string
          title: string
          trigger_method: string
          triggered_by: string | null
        }
        Insert: {
          change_type?: string
          created_at?: string
          id?: string
          new_content?: string
          old_content?: string
          slug: string
          title: string
          trigger_method?: string
          triggered_by?: string | null
        }
        Update: {
          change_type?: string
          created_at?: string
          id?: string
          new_content?: string
          old_content?: string
          slug?: string
          title?: string
          trigger_method?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      wiki_pages: {
        Row: {
          content: string
          created_at: string
          id: string
          published: boolean
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          published?: boolean
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          published?: boolean
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      winred_donations: {
        Row: {
          amount: number
          candidate_name: string | null
          committee_name: string | null
          created_at: string
          donor_address: string | null
          donor_city: string | null
          donor_email: string | null
          donor_employer: string | null
          donor_first_name: string | null
          donor_last_name: string | null
          donor_occupation: string | null
          donor_phone: string | null
          donor_state: string | null
          donor_zip: string | null
          id: string
          page_name: string | null
          page_slug: string | null
          raw_data: Json | null
          recurring: boolean | null
          refunded: boolean | null
          transaction_date: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          candidate_name?: string | null
          committee_name?: string | null
          created_at?: string
          donor_address?: string | null
          donor_city?: string | null
          donor_email?: string | null
          donor_employer?: string | null
          donor_first_name?: string | null
          donor_last_name?: string | null
          donor_occupation?: string | null
          donor_phone?: string | null
          donor_state?: string | null
          donor_zip?: string | null
          id?: string
          page_name?: string | null
          page_slug?: string | null
          raw_data?: Json | null
          recurring?: boolean | null
          refunded?: boolean | null
          transaction_date?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          candidate_name?: string | null
          committee_name?: string | null
          created_at?: string
          donor_address?: string | null
          donor_city?: string | null
          donor_email?: string | null
          donor_employer?: string | null
          donor_first_name?: string | null
          donor_last_name?: string | null
          donor_occupation?: string | null
          donor_phone?: string | null
          donor_state?: string | null
          donor_zip?: string | null
          id?: string
          page_name?: string | null
          page_slug?: string | null
          raw_data?: Json | null
          recurring?: boolean | null
          refunded?: boolean | null
          transaction_date?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_section_access: {
        Args: { _section_id: string; _subsection_id?: string; _user_id: string }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_api_key_usage: {
        Args: { p_key_id: string }
        Returns: undefined
      }
      invite_war_room_member_by_email: {
        Args: { _email: string; _role?: string; _room_id: string }
        Returns: {
          role: string
          status: string
          user_id: string
        }[]
      }
      is_war_room_member: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      list_war_room_members: {
        Args: { _room_id: string }
        Returns: {
          added_at: string
          display_name: string
          role: string
          user_id: string
        }[]
      }
      log_api_request: {
        Args: {
          p_endpoint: string
          p_key_id: string
          p_status?: number
          p_user_id: string
        }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      unbind_serial_device: { Args: { p_key_id: string }; Returns: undefined }
      user_has_report_access: {
        Args: { _need_edit?: boolean; _report_id: string; _user_id: string }
        Returns: boolean
      }
      validate_api_key: {
        Args: { p_key_hash: string }
        Returns: {
          key_id: string
          user_id: string
        }[]
      }
      validate_app_serial: {
        Args: { p_device_id: string; p_serial: string }
        Returns: {
          key_id: string
          reason: string
          user_id: string
          valid: boolean
        }[]
      }
      war_room_role: {
        Args: { _room_id: string; _user_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user" | "moderator" | "premium"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "moderator", "premium"],
    },
  },
} as const
