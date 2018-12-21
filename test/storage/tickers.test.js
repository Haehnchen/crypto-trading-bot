let assert = require('assert')
let Tickers = require('../../storage/tickers')
let Ticker = require('../../dict/ticker')
const moment = require('moment')

describe('#tickers', function() {
    it('test getting update tickers', () => {
        let tickers = new Tickers()
        let ticker = new Ticker('foobar', 'BTCUSD', 1234, 1337, 1338)

        tickers.set(ticker)
        ticker.createdAt = moment().subtract(5000, 'ms').toDate()

        assert.equal(tickers.get('foobar', 'BTCUSD').ask, 1338)
        assert.equal(tickers.getIfUpToDate('foobar', 'BTCUSD', 1000), undefined)

        assert.equal(tickers.getIfUpToDate('foobar', 'BTCUSD', 7000).ask, 1338)
    })
})
