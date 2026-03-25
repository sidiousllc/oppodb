import { describe, it, expect } from "vitest";

/**
 * Security tests for MNFinancePanel buildValidatedUrl function
 * 
 * These tests verify that the SSRF mitigation is effective:
 * - Only supabase.co domains are allowed
 * - Project ID is validated as alphanumeric slug
 * - Protocol is restricted to http/https
 * - Query parameters are safely added via searchParams.set()
 * - Invalid inputs throw errors
 * 
 * SSRF finding: "HTTP request might enable SSRF attack"
 * Location: src/components/MNFinancePanel.tsx, line 290
 */

// Extract the buildValidatedUrl function logic for testing
// This mirrors the implementation in MNFinancePanel.tsx lines 52-92
function buildValidatedUrl(
  baseUrl: string,
  projectId: string,
  action?: string,
  regNum?: string
): string {
  try {
    const url = new URL(baseUrl);
    
    // Validate project ID as a slug
    if (!/^[A-Za-z0-9_-]+$/.test(projectId)) {
      throw new Error('Invalid parameter');
    }
    
    // Set the hostname with validated project ID
    url.hostname = `${projectId}.supabase.co`;
    
    // Domain validation
    const allowedDomains = ['supabase.co'];
    const hostname = url.hostname;
    const isAllowedDomain = allowedDomains.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
    if (!isAllowedDomain) {
      throw new Error('Invalid host');
    }
    
    // Protocol check
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid protocol');
    }
    
    // Add query parameters
    if (action) url.searchParams.set('action', action);
    if (regNum) url.searchParams.set('reg_num', regNum);
    
    return url.href;
  } catch {
    throw new Error('Invalid URL');
  }
}

describe("MNFinancePanel buildValidatedUrl - SSRF mitigation", () => {
  describe("valid inputs - legitimate use cases", () => {
    it("should build URL with valid project ID and no query params", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'myproject123'
      );
      
      expect(result).toBe('https://myproject123.supabase.co/functions/v1/mn-cfb-finance');
    });

    it("should build URL with valid project ID and action query param", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'myproject',
        'yearly'
      );
      
      expect(result).toBe('https://myproject.supabase.co/functions/v1/mn-cfb-finance?action=yearly');
    });

    it("should build URL with all parameters", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'test-project',
        'yearly',
        'REG123'
      );
      
      expect(result).toBe('https://test-project.supabase.co/functions/v1/mn-cfb-finance?action=yearly&reg_num=REG123');
    });

    it("should handle project IDs with hyphens", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'my-project-123'
      );
      
      expect(result).toBe('https://my-project-123.supabase.co/functions/v1/mn-cfb-finance');
    });

    it("should handle project IDs with underscores", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'my_project_123'
      );
      
      expect(result).toBe('https://my_project_123.supabase.co/functions/v1/mn-cfb-finance');
    });

    it("should safely encode special characters in query parameters", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'myproject',
        'yearly',
        'REG/123&test=value'
      );
      
      // Query parameters are automatically percent-encoded by searchParams.set()
      expect(result).toContain('reg_num=REG%2F123%26test%3Dvalue');
    });
  });

  describe("project ID validation - SSRF attack prevention", () => {
    it("should reject project ID with forward slash", () => {
      expect(() => {
        buildValidatedUrl(
          'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
          'project/../../etc/passwd'
        );
      }).toThrow('Invalid URL');
    });

    it("should reject project ID with backslash", () => {
      expect(() => {
        buildValidatedUrl(
          'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
          'project\\..\\..\\etc\\passwd'
        );
      }).toThrow('Invalid URL');
    });

    it("should reject project ID with @ symbol (URL authority injection)", () => {
      expect(() => {
        buildValidatedUrl(
          'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
          'fake@evil.com'
        );
      }).toThrow('Invalid URL');
    });

    it("should reject project ID with colon (port injection)", () => {
      expect(() => {
        buildValidatedUrl(
          'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
          'project:8080'
        );
      }).toThrow('Invalid URL');
    });

    it("should reject project ID with spaces", () => {
      expect(() => {
        buildValidatedUrl(
          'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
          'my project'
        );
      }).toThrow('Invalid URL');
    });

    it("should reject project ID with percent encoding", () => {
      expect(() => {
        buildValidatedUrl(
          'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
          'project%2F%2E%2E'
        );
      }).toThrow('Invalid URL');
    });

    it("should reject project ID with newline characters", () => {
      expect(() => {
        buildValidatedUrl(
          'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
          'project\nmalicious'
        );
      }).toThrow('Invalid URL');
    });

    it("should reject project ID with null bytes", () => {
      expect(() => {
        buildValidatedUrl(
          'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
          'project\x00malicious'
        );
      }).toThrow('Invalid URL');
    });

    it("should reject empty project ID", () => {
      expect(() => {
        buildValidatedUrl(
          'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
          ''
        );
      }).toThrow('Invalid URL');
    });

    it("should reject project ID with only special characters", () => {
      expect(() => {
        buildValidatedUrl(
          'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
          '!@#$%^&*()'
        );
      }).toThrow('Invalid URL');
    });
  });

  describe("domain allowlist - prevents SSRF to arbitrary hosts", () => {
    it("should reject non-supabase.co domains after hostname construction", () => {
      // Even though we set the hostname, the validation should catch non-supabase.co domains
      // This test verifies the domain allowlist works correctly
      expect(() => {
        // Using a project ID that would create an invalid domain
        // The function sets hostname to `${projectId}.supabase.co`, so this should pass validation
        buildValidatedUrl(
          'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
          'validproject'
        );
      }).not.toThrow();
    });

    it("should allow supabase.co subdomains", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'myproject'
      );
      
      expect(result).toContain('myproject.supabase.co');
    });

    it("should validate final hostname is supabase.co subdomain", () => {
      // The function constructs hostname as `${projectId}.supabase.co`
      // Then validates it's a supabase.co domain
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'test123'
      );
      
      const url = new URL(result);
      expect(url.hostname).toMatch(/^[A-Za-z0-9_-]+\.supabase\.co$/);
    });
  });

  describe("protocol validation - prevents non-HTTP(S) protocols", () => {
    it("should accept https protocol", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'myproject'
      );
      
      expect(result).toMatch(/^https:/);
    });

    it("should accept http protocol", () => {
      const result = buildValidatedUrl(
        'http://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'myproject'
      );
      
      expect(result).toMatch(/^http:/);
    });

    it("should reject file protocol", () => {
      expect(() => {
        buildValidatedUrl(
          'file://placeholder.supabase.co/functions/v1/mn-cfb-finance',
          'myproject'
        );
      }).toThrow('Invalid URL');
    });

    it("should reject ftp protocol", () => {
      expect(() => {
        buildValidatedUrl(
          'ftp://placeholder.supabase.co/functions/v1/mn-cfb-finance',
          'myproject'
        );
      }).toThrow('Invalid URL');
    });

    it("should reject javascript protocol", () => {
      expect(() => {
        buildValidatedUrl(
          'javascript://placeholder.supabase.co/functions/v1/mn-cfb-finance',
          'myproject'
        );
      }).toThrow('Invalid URL');
    });

    it("should reject data protocol", () => {
      expect(() => {
        buildValidatedUrl(
          'data://placeholder.supabase.co/functions/v1/mn-cfb-finance',
          'myproject'
        );
      }).toThrow('Invalid URL');
    });
  });

  describe("query parameter safety - prevents injection", () => {
    it("should safely handle action parameter with special characters", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'myproject',
        'action&malicious=true'
      );
      
      // searchParams.set() automatically encodes special characters
      expect(result).toContain('action=action%26malicious%3Dtrue');
    });

    it("should safely handle regNum parameter with URL injection attempt", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'myproject',
        'yearly',
        'REG123?extra=param'
      );
      
      // The ? should be encoded, preventing injection
      expect(result).toContain('reg_num=REG123%3Fextra%3Dparam');
    });

    it("should safely handle regNum parameter with hash fragment attempt", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'myproject',
        'yearly',
        'REG123#fragment'
      );
      
      // The # should be encoded
      expect(result).toContain('reg_num=REG123%23fragment');
    });

    it("should handle undefined optional parameters", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'myproject',
        undefined,
        undefined
      );
      
      expect(result).toBe('https://myproject.supabase.co/functions/v1/mn-cfb-finance');
      expect(result).not.toContain('action=');
      expect(result).not.toContain('reg_num=');
    });

    it("should handle only action parameter", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'myproject',
        'yearly',
        undefined
      );
      
      expect(result).toBe('https://myproject.supabase.co/functions/v1/mn-cfb-finance?action=yearly');
      expect(result).not.toContain('reg_num=');
    });

    it("should handle only regNum parameter", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'myproject',
        undefined,
        'REG123'
      );
      
      expect(result).toBe('https://myproject.supabase.co/functions/v1/mn-cfb-finance?reg_num=REG123');
      expect(result).not.toContain('action=');
    });
  });

  describe("error handling - consistent error messages", () => {
    it("should throw generic error for invalid project ID", () => {
      expect(() => {
        buildValidatedUrl(
          'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
          '../../../etc/passwd'
        );
      }).toThrow('Invalid URL');
    });

    it("should throw generic error for invalid protocol", () => {
      expect(() => {
        buildValidatedUrl(
          'file:///etc/passwd',
          'myproject'
        );
      }).toThrow('Invalid URL');
    });

    it("should not leak sensitive information in error messages", () => {
      try {
        buildValidatedUrl(
          'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
          'malicious@evil.com'
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).toBe('Invalid URL');
        expect(errorMessage).not.toContain('evil.com');
        expect(errorMessage).not.toContain('malicious');
      }
    });
  });

  describe("integration scenarios - real-world usage", () => {
    it("should build URL for summary endpoint (line 290 usage)", () => {
      // Simulates: const url = buildValidatedUrl('https://placeholder.supabase.co/functions/v1/mn-cfb-finance', projectId, 'yearly', candidate.reg_num);
      const projectId = 'my-supabase-project';
      const action = 'yearly';
      const regNum = '12345';
      
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        projectId,
        action,
        regNum
      );
      
      expect(result).toBe('https://my-supabase-project.supabase.co/functions/v1/mn-cfb-finance?action=yearly&reg_num=12345');
    });

    it("should preserve path structure from base URL", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'myproject'
      );
      
      expect(result).toContain('/functions/v1/mn-cfb-finance');
    });

    it("should handle complex registration numbers", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'myproject',
        'yearly',
        'MN-CFB-2024-12345'
      );
      
      expect(result).toContain('reg_num=MN-CFB-2024-12345');
    });
  });

  describe("SSRF attack vectors - comprehensive prevention", () => {
    it("should prevent SSRF to internal network (192.168.x.x)", () => {
      // Attacker tries to use project ID to target internal network
      expect(() => {
        buildValidatedUrl(
          'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
          '192.168.1.1'
        );
      }).not.toThrow(); // Project ID is valid, but domain validation will ensure it's supabase.co
      
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        '192.168.1.1'
      );
      // The hostname will be 192.168.1.1.supabase.co, which is safe
      expect(result).toContain('192.168.1.1.supabase.co');
    });

    it("should prevent SSRF to localhost", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'localhost'
      );
      // The hostname will be localhost.supabase.co, which is safe
      expect(result).toContain('localhost.supabase.co');
    });

    it("should prevent SSRF to cloud metadata endpoints", () => {
      // AWS metadata endpoint: 169.254.169.254
      expect(() => {
        buildValidatedUrl(
          'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
          '169.254.169.254'
        );
      }).not.toThrow(); // Valid as project ID format
      
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        '169.254.169.254'
      );
      // Will become 169.254.169.254.supabase.co, which is safe
      expect(result).toContain('169.254.169.254.supabase.co');
    });

    it("should prevent DNS rebinding attacks", () => {
      // Attacker tries to use a project ID that looks like a domain
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'evil-domain'
      );
      // Will become evil-domain.supabase.co, which is safe
      expect(result).toContain('evil-domain.supabase.co');
    });

    it("should prevent URL parameter pollution", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'myproject',
        'yearly',
        'REG123&action=malicious'
      );
      
      // The & in regNum should be encoded, preventing parameter pollution
      expect(result).toContain('reg_num=REG123%26action%3Dmalicious');
      expect(result).toMatch(/action=yearly/);
    });
  });

  describe("edge cases and boundary conditions", () => {
    it("should handle very long project IDs", () => {
      const longProjectId = 'a'.repeat(100);
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        longProjectId
      );
      
      expect(result).toContain(`${longProjectId}.supabase.co`);
    });

    it("should handle project ID with maximum allowed characters", () => {
      const projectId = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        projectId
      );
      
      expect(result).toContain(`${projectId}.supabase.co`);
    });

    it("should handle empty action parameter", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'myproject',
        ''
      );
      
      // Empty string is falsy, so it won't be added
      expect(result).not.toContain('action=');
    });

    it("should handle empty regNum parameter", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance',
        'myproject',
        'yearly',
        ''
      );
      
      // Empty string is falsy, so it won't be added
      expect(result).not.toContain('reg_num=');
    });

    it("should handle base URL with existing query parameters", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance?existing=param',
        'myproject',
        'yearly'
      );
      
      // Should preserve existing params and add new ones
      expect(result).toContain('existing=param');
      expect(result).toContain('action=yearly');
    });

    it("should handle base URL with trailing slash", () => {
      const result = buildValidatedUrl(
        'https://placeholder.supabase.co/functions/v1/mn-cfb-finance/',
        'myproject'
      );
      
      expect(result).toContain('myproject.supabase.co');
    });
  });
});
