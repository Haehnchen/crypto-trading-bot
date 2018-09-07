'use strict';

let express = require('express')

module.exports = class Http {
    constructor(config, ta) {
        this.config = config
        this.ta = ta
    }

    start() {
        let periods = ['15m', '1h'];

        var twig = require("twig"),
            express = require('express'),
            app = express();

        twig.extendFilter('price_format', function(value) {
            if (parseFloat(value) < 1) {
                return Intl.NumberFormat('en-US', {useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 6}).format(value)
            }

            return Intl.NumberFormat('en-US', {useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2}).format(value)
        });

        app.set('twig options', {
            allow_async: true,
            strict_variables: true
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