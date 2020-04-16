const assert = require('assert');
const RequestClient = require('../../src/utils/request_client');

describe('#request client', function() {
  it('test that retry is running with a final result', async () => {
    const client = new RequestClient({ error: () => {} });

    const responses = [];

    for (let retry = 0; retry < 2; retry++) {
      responses.push({
        error: undefined,
        response: { statusCode: 503 },
        body: retry
      });
    }

    responses.push({
      error: undefined,
      response: { statusCode: 200 },
      body: 'yes'
    });

    let i = 0;
    client.executeRequest = () => {
      return new Promise(resolve => {
        resolve(responses[i++]);
      });
    };

    const result = await client.executeRequestRetry(
      {},
      result => {
        return result && result.response && result.response.statusCode === 503;
      },
      5
    );

    assert.equal(i, 3);
    assert.equal(result.body, 'yes');
  });

  it('test that retry limit is reached', async () => {
    const client = new RequestClient({ error: () => {} });

    const responses = [];

    for (let retry = 0; retry < 15; retry++) {
      responses.push({
        error: undefined,
        response: { statusCode: 503 },
        body: retry
      });
    }

    let i = 0;
    client.executeRequest = () => {
      return new Promise(resolve => {
        resolve(responses[i++]);
      });
    };

    const result = await client.executeRequestRetry(
      { url: 'http://test.de' },
      result => {
        return result && result.response && result.response.statusCode === 503;
      },
      5
    );

    assert.equal(i, 10);
    assert.equal(result.body, '9');
    assert.equal(result.response.statusCode, 503);
  });
});
