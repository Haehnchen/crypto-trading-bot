let assert = require('assert')
let SystemUtil = require('../../modules/system/system_util')

describe('#system util test', function() {
    it('test configuration extraction', () => {
        let systemUtil = new SystemUtil({
            'root': 'test123',
            'root2': undefined,
            'webserver': {
                'test': 8080,
            }
        })

        assert.equal(systemUtil.getConfig('webserver.test'), 8080)
        assert.equal(systemUtil.getConfig('root'), 'test123')
        assert.equal(systemUtil.getConfig('UNKONWN', 'test'), 'test')
        assert.equal(systemUtil.getConfig('UNKONWN'), undefined)
        assert.equal(systemUtil.getConfig('root2', 'test'), 'test')
    })
})
