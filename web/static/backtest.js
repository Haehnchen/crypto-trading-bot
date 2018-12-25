$(function() {
    var chart = $('.chart');

    if (chart.length > 0) {
        var candles = chart.data('candles')

        var margin = {top: 20, right: 20, bottom: 30, left: 50},
            width = chart.width() - margin.left - margin.right,
            height = 500 - margin.top - margin.bottom;

        var dateFormat = d3.timeFormat("%y-%m-%d %H:%M"),
            valueFormat = d3.format(',.2f');

        var x = techan.scale.financetime()
            .range([0, width]);

        var y = d3.scaleLinear()
            .range([height, 0]);

        var candlestick = techan.plot.candlestick()
            .xScale(x)
            .yScale(y);

        var tradearrow = techan.plot.tradearrow()
            .xScale(x)
            .yScale(y)
            .orient(function(d) {
                switch (d.type) {
                    case 'close':
                        return 'left';
                    case 'short':
                        return 'down';
                    case 'long':
                        return 'up';
                    default:
                        return 'right';
                }
            })
            .on("mouseenter", enter)
            .on("mouseout", out);

        var xAxis = d3.axisBottom()
            .scale(x);

        var yAxis = d3.axisLeft()
            .scale(y);

        var svg = d3.select(".chart").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        var valueText = svg.append('text')
            .style("text-anchor", "end")
            .attr("class", "coords")
            .attr("x", width - 5)
            .attr("y", 15);

        var accessor = candlestick.accessor();

        var trades = []

        var data = candles.map(function(d) {
            if(d.signals && d.signals.length > 0) {
                d.signals.forEach(function(trade) {
                    trades.push({
                        date: new Date(d.date),
                        type: trade.result.signal,
                        price: d.close,
                    })
                })
            }

            return {
                date: new Date(d.date),
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
                volume: d.volume
            };
        }).sort(function(a, b) { return d3.ascending(accessor.d(a), accessor.d(b)); });

        svg.append("g")
            .attr("class", "candlestick");

        svg.append("g")
            .attr("class", "tradearrow");

        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")");

        svg.append("g")
            .attr("class", "y axis")
            .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Price ($)");

        // Data to display initially
        draw(data.slice(), trades);

        function enter(d) {
            valueText.style("display", "inline");
            refreshText(d);
        }

        function out() {
            valueText.style("display", "none");
        }

        function draw(data, trades) {
            x.domain(data.map(candlestick.accessor().d));
            y.domain(techan.scale.plot.ohlc(data, candlestick.accessor()).domain());

            svg.selectAll("g.candlestick").datum(data).call(candlestick);
            svg.selectAll("g.tradearrow").datum(trades).call(tradearrow);

            svg.selectAll("g.x.axis").call(xAxis);
            svg.selectAll("g.y.axis").call(yAxis);
        }

        function refreshText(d) {
            valueText.text("Trade: " + dateFormat(d.date) + ", " + d.type + ", " + valueFormat(d.price));
        }
    }
});


