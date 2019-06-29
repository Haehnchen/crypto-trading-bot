let assert = require('assert');
let CoinbasePro = require('../../exchange/coinbase_pro');

describe('#coinbase pro exchange implementation', function() {
    it('profits are calculated', () => {
        let fills = [
            {
                "created_at": "2019-06-27T12:20:30.319Z",
                "product_id": "LTC-EUR",
                "price": "101.50000000",
                "size": "1.00000000",
                "fee": "0.1522500000000000",
                "side": "buy",
            },
            {
                "created_at": "2019-06-27T09:10:16.86Z",
                "price": "96.38000000",
                "size": "4.00000000",
                "fee": "0.5782800000000000",
                "side": "buy",
            },
            {
                "created_at": "2019-04-26T20:58:21.274Z",
                "price": "63.30000000",
                "size": "1.41362565",
                "fee": "0.1342237554675000",
                "side": "sell",
            },
        ]

        let result = CoinbasePro.calculateEntryOnFills(fills, 5)

        assert.equal(result.average_price.toFixed(2), 97.90)
        assert.equal(result.created_at.includes("2019"), true)
        assert.equal(result.size, 5)
    })
})
