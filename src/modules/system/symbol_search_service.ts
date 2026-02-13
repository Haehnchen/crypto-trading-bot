import https from 'https';

interface SymbolSearchResult {
  value: string;
  text: string;
  description: string;
}

export class SymbolSearchService {
  async searchSymbols(query: string): Promise<SymbolSearchResult[]> {
    if (!query || query.length < 1) {
      return [];
    }

    const url = `https://symbol-search.tradingview.com/symbol_search/?text=${encodeURIComponent(query)}&exchange=&hl=true&lang=en&type=&domain=production`;

    try {
      const data = await this.fetchJSON(url);
      // API returns an array directly, not {symbols: []}
      const symbols = Array.isArray(data) ? data : [];

      return symbols
        .slice(0, 20)
        .map((s: any) => ({
          // Strip HTML tags from symbol (e.g., <em>BTC</em> -> BTC)
          value: s.exchange ? `${s.exchange}:${this.stripHtml(s.symbol)}` : this.stripHtml(s.symbol),
          text: s.exchange ? `${s.exchange}:${this.stripHtml(s.symbol)}` : this.stripHtml(s.symbol),
          description: this.stripHtml(s.description || '')
        }));
    } catch (e) {
      console.error('Error fetching TradingView symbols:', e);
      return [];
    }
  }

  private fetchJSON(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://www.tradingview.com'
        }
      }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }
}
