let assert = require('assert');
let Bitfinex = require('../../exchange/bitfinex');

let fs = require('fs');

describe('#bitfinex exchange implementation', function() {
    it('position are extracted', () => {
        let pos = Bitfinex.createPositions(createResponse('on-ps.json'))

        assert.equal('IOTUSD', pos[0].symbol)
        assert.equal('short', pos[0].side)
        assert.equal(-80, pos[0].amount)

        assert.equal('IOTUSD', pos[1].symbol)
        assert.equal('long', pos[1].side)
        assert.equal(80, pos[1].amount)
        assert.equal(pos[1].updatedAt instanceof Date, true)
    });

    var createResponse = function(filename) {
        return JSON.parse(fs.readFileSync(__dirname + '/bitfinex/' + filename, 'utf8'));
    }
});
