'use strict';

let express = require('express')

module.exports = class Http {
    constructor(config, ta) {
        this.config = config
        this.ta = ta
    }

    start() {
        let periods = ['15m', '1h'];

        let app = express()

        app.set('twig options', {
            allow_async: true,
            strict_variables: false
        });

        app.use(express.static(__dirname + '/../web/static'))

        let ta = this.ta
        app.get('/', (req, res) => {
            ta.getTaForPeriods(periods).then((result) => {
                res.render('../templates/base.html.twig', result);
            })
        });

        let port = this.config.webserver.port || 8080;

        app.listen(port);

        console.log('Webserver listening on: ' + port)
    }
};