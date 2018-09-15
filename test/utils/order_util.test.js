let assert = require('assert');
let orderUtil = require('../../utils/order_util');

describe('#order util', function() {
    it('calculate order amount', () => {
        assert.equal(0.01540120, orderUtil.calculateOrderAmount(6493, 100).toFixed(8))
    });
});
