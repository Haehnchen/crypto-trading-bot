import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { spawnSync } from 'child_process';
import type { TypedStrategy } from '../../strategy/strategy';
import { StrategyBase } from '../../strategy/strategy';

// Register ts-node and tsconfig-paths for loading .ts strategy files with path aliases
require('ts-node/register');
require('tsconfig-paths/register');

export interface TypeScriptError {
  line: number;
  column: number;
  message: string;
  code: number;
}

export interface ValidationResult {
  success: boolean;
  errors: TypeScriptError[];
  warnings: TypeScriptError[];
  compiledCode?: string;
}

export class SandboxValidatorService {
  private readonly projectDir: string;
  private readonly strategiesDir: string;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
    // Write to var/strategies/ so '../../src/strategy/strategy' import works
    this.strategiesDir = path.join(projectDir, 'var', 'strategies');

    // Ensure directory exists
    if (!fs.existsSync(this.strategiesDir)) {
      fs.mkdirSync(this.strategiesDir, { recursive: true });
    }
  }

  /**
   * Validate TypeScript code using tsc with project context
   */
  async validateTypeScript(code: string): Promise<ValidationResult> {
    const errors: TypeScriptError[] = [];
    const warnings: TypeScriptError[] = [];

    // Create temp file in var/strategies/ so '../../src/strategy/strategy' resolves
    const tempFile = path.join(this.strategiesDir, `_${Date.now()}_${Math.random().toString(36).slice(2)}.ts`);

    try {
      // Write the code to temp file
      fs.writeFileSync(tempFile, code, 'utf-8');
      console.log('[SandboxValidator] Wrote code to:', tempFile);
      console.log('[SandboxValidator] Code length:', code.length, 'chars');

      // Run tsc with project config - this includes all type definitions
      const result = spawnSync('npx', ['tsc', '--noEmit', '--project', 'tsconfig.json'], {
        cwd: this.projectDir,
        encoding: 'utf-8',
        timeout: 60000,
        shell: true,
      });

      console.log('[SandboxValidator] tsc result:', {
        status: result.status,
        stdoutLength: result.stdout?.length || 0,
        stderrLength: result.stderr?.length || 0,
      });

      if (result.stdout) {
        console.log('[SandboxValidator] tsc stdout:', result.stdout.substring(0, 1000));
      }

      if (result.stderr) {
        console.log('[SandboxValidator] tsc stderr:', result.stderr.substring(0, 500));
      }

      // Parse tsc errors
      if (result.stdout) {
        const lines = result.stdout.split('\n');
        for (const line of lines) {
          // Parse error format: "file.ts(L,C): error TS1234: message"
          const match = line.match(/\.ts\((\d+),(\d+)\):\s*(error|warning)\s+TS(\d+):\s*(.+)/);
          if (match) {
            const error: TypeScriptError = {
              line: parseInt(match[1], 10),
              column: parseInt(match[2], 10),
              message: match[5].trim(),
              code: parseInt(match[4], 10),
            };

            if (match[3] === 'warning') {
              warnings.push(error);
            } else {
              errors.push(error);
            }
          }
        }
      }

      // If no errors, return the original code (ts-node will handle compilation)
      // We keep the field name 'compiledCode' for API compatibility
      const compiledCode = errors.length === 0 ? code : undefined;

      return {
        success: errors.length === 0,
        errors,
        warnings,
        compiledCode
      };
    } catch (e: any) {
      console.error('[SandboxValidator] Validation error:', e.message);
      return {
        success: false,
        errors: [{ line: 0, column: 0, message: e.message, code: 0 }],
        warnings: []
      };
    } finally {
      // Cleanup temp file
      try {
        fs.unlinkSync(tempFile);
      } catch {}
    }
  }

  /**
   * Import and instantiate strategy class from TypeScript code
   * Uses ts-node to load the TypeScript directly (no transpilation needed)
   */
  async importStrategy(typescriptCode: string): Promise<{ strategy: TypedStrategy<any>; name: string } | null> {
    // Write to var/strategies/ directory (same as saved strategies)
    const strategiesDir = path.join(this.projectDir, 'var', 'strategies');

    // Ensure directory exists
    if (!fs.existsSync(strategiesDir)) {
      fs.mkdirSync(strategiesDir, { recursive: true });
    }

    const tempFile = path.join(strategiesDir, `strategy_${Date.now()}_${Math.random().toString(36).slice(2)}.ts`);

    console.log('[SandboxValidator] Writing TypeScript to:', tempFile);

    try {
      fs.writeFileSync(tempFile, typescriptCode, 'utf-8');

      // Clear require cache
      delete require.cache[require.resolve(tempFile)];

      // Load the TypeScript file - ts-node handles compilation and imports
      const module = require(tempFile);

      let StrategyClass: any = null;
      let strategyName = '';

      for (const [key, exp] of Object.entries(module)) {
        if (typeof exp === 'function' && exp.prototype && StrategyBase.prototype.isPrototypeOf(exp.prototype)) {
          StrategyClass = exp;
          strategyName = key;
          break;
        }
        if (key === 'default' && typeof exp === 'function' && exp.prototype && StrategyBase.prototype.isPrototypeOf(exp.prototype)) {
          StrategyClass = exp;
          strategyName = exp.name || 'default';
          break;
        }
      }

      if (!StrategyClass) {
        for (const [key, exp] of Object.entries(module)) {
          if (typeof exp === 'function' && exp.prototype && exp.prototype.execute && exp.prototype.defineIndicators) {
            StrategyClass = exp;
            strategyName = key;
            break;
          }
        }
      }

      if (!StrategyClass) {
        console.error('[SandboxValidator] No strategy class found');
        return null;
      }

      const strategy = new StrategyClass() as TypedStrategy<any>;
      console.log('[SandboxValidator] Strategy imported successfully:', strategyName);
      return { strategy, name: strategyName };
    } catch (e: any) {
      console.error('[SandboxValidator] Import failed:', e.message);
      console.error('[SandboxValidator] Stack:', e.stack?.split('\n').slice(0, 5).join('\n'));
      return null;
    } finally {
      try {
        fs.unlinkSync(tempFile);
      } catch {}
    }
  }

  /**
   * Extract strategy name from code
   */
  extractStrategyName(code: string): string {
    const match = code.match(/export\s+class\s+(\w+)\s+extends\s+StrategyBase/);
    if (match) return match[1];

    const classMatch = code.match(/export\s+class\s+(\w+)/);
    if (classMatch) return classMatch[1];

    return 'GeneratedStrategy';
  }

  /**
   * Validate strategy structure
   */
  validateStrategyStructure(strategy: TypedStrategy<any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (typeof strategy.getDescription !== 'function') {
      errors.push('Strategy must have a getDescription() method');
    }
    if (typeof strategy.defineIndicators !== 'function') {
      errors.push('Strategy must have a defineIndicators() method');
    }
    if (typeof strategy.execute !== 'function') {
      errors.push('Strategy must have an execute() method');
    }

    try {
      const indicators = strategy.defineIndicators();
      if (!indicators || typeof indicators !== 'object') {
        errors.push('defineIndicators() must return an object');
      }
    } catch (e: any) {
      errors.push(`defineIndicators() error: ${e.message}`);
    }

    return { valid: errors.length === 0, errors };
  }
}
