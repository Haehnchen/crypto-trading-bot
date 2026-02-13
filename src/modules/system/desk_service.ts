import * as fs from 'fs';
import * as path from 'path';
import { SystemUtil } from './system_util';

export class DeskService {
  private desksFilePath: string;

  constructor(private systemUtil: SystemUtil) {
    this.desksFilePath = path.join(process.cwd(), 'var', 'desks.json');
  }

  getDesks(): any[] {
    // Try to read from var/desks.json first
    if (fs.existsSync(this.desksFilePath)) {
      try {
        const content = fs.readFileSync(this.desksFilePath, 'utf8');
        return JSON.parse(content);
      } catch (e) {
        console.error('Error reading desks.json:', e);
      }
    }
    // Fallback to main config
    return this.systemUtil.getConfig('desks', []);
  }

  getDeskNames(): string[] {
    return this.getDesks().map((d: any) => d.name);
  }

  saveDesks(desks: any[]): void {
    // Ensure var directory exists
    const varDir = path.dirname(this.desksFilePath);
    if (!fs.existsSync(varDir)) {
      fs.mkdirSync(varDir, { recursive: true });
    }
    fs.writeFileSync(this.desksFilePath, JSON.stringify(desks, null, 2));
  }
}
