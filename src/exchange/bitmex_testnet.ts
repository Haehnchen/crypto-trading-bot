import { Bitmex } from './bitmex';

export class BitmexTestnet extends Bitmex {
  getName(): string {
    return 'bitmex_testnet';
  }

  getBaseUrl(): string {
    return 'https://testnet.bitmex.com';
  }
}

export default BitmexTestnet;
