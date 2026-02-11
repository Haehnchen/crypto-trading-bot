import Transport from 'winston-transport';

interface WinstonSqliteTransportOptions extends Transport.TransportStreamOptions {
  database_connection: any;
  table: string;
}

interface LogInfo {
  level: string;
  message: string;
  [key: string]: any;
}

export class WinstonSqliteTransport extends Transport {
  private db: any;
  private table: string;

  constructor(opts: WinstonSqliteTransportOptions) {
    super(opts);

    if (!opts.database_connection) {
      throw new Error('database_connection is needed');
    }

    if (!opts.table) {
      throw new Error('table is needed');
    }

    this.db = opts.database_connection;
    this.table = opts.table;
  }

  log(info: LogInfo, callback: () => void): void {
    setImmediate(() => {
      this.emit('logged', info);
    });

    const parameters = {
      uuid: WinstonSqliteTransport.createUUID(),
      level: info.level,
      message: info.message,
      created_at: Math.floor(Date.now() / 1000)
    };

    this.db.prepare(`INSERT INTO ${this.table}(uuid, level, message, created_at) VALUES ($uuid, $level, $message, $created_at)`).run(parameters);

    callback();
  }

  static createUUID(): string {
    let dt = new Date().getTime();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (dt + Math.random() * 16) % 16 | 0;
      dt = Math.floor(dt / 16);
      return (c == 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}

export default WinstonSqliteTransport;
