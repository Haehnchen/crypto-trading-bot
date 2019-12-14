$(function() {
  $('table.backtest-table').on('click', 'a.button-debug-toggle', function(e) {
    e.preventDefault();
    $(this)
      .closest('.debug-toggle')
      .toggleClass('hide');
  });

  $('table.backtest-table').on('click', 'a.button-debug-toggle-all', function(e) {
    e.preventDefault();

    $(this)
      .closest('table.backtest-table')
      .find('td .debug-toggle')
      .toggleClass('hide');
  });

  const chart = $('.chart');

  if (chart.length > 0) {
    const candles = chart.data('candles');

    const dim = {
      width: chart.width(),
      height: 500,
      margin: { top: 20, right: 60, bottom: 30, left: 60 },
      ohlc: { height: 450 },
      indicator: { height: 0, padding: 0 }
    };

    dim.plot = {
      width: dim.width - dim.margin.left - dim.margin.right,
      height: dim.height - dim.margin.top - dim.margin.bottom
    };

    dim.indicator.top = dim.ohlc.height + dim.indicator.padding;
    dim.indicator.bottom = dim.indicator.top + dim.indicator.height + dim.indicator.padding;

    const indicatorTop = d3.scaleLinear().range([dim.indicator.top, dim.indicator.bottom]);

    const zoom = d3.zoom().on('zoom', zoomed);

    const x = techan.scale.financetime().range([0, dim.plot.width]);

    const y = d3.scaleLinear().range([dim.ohlc.height, 0]);

    const yPercent = y.copy(); // Same as y at this stage, will get a different domain later

    let yInit;
    let yPercentInit;
    let zoomableInit;

    const yVolume = d3.scaleLinear().range([y(0), y(0.4)]);

    const candlestick = techan.plot
      .candlestick()
      .xScale(x)
      .yScale(y);

    const tradearrow = techan.plot
      .tradearrow()
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
      .on('mouseenter', function enter(d) {
        valueText.style('display', 'inline');
        valueText.text(`Trade: ${d3.timeFormat('%y-%m-%d %H:%M')(d.date)}, ${d.type}, ${d3.format(',.2f')(d.price)}`);
      })
      .on('mouseout', function out() {
        valueText.style('display', 'none');
      });

    const volume = techan.plot
      .volume()
      .accessor(candlestick.accessor()) // Set the accessor to a ohlc accessor so we get highlighted bars
      .xScale(x)
      .yScale(yVolume);

    const xAxis = d3.axisBottom(x);

    const timeAnnotation = techan.plot
      .axisannotation()
      .axis(xAxis)
      .orient('bottom')
      .format(d3.timeFormat('%Y-%m-%d %H:%M'))
      .width(120)
      .translate([0, dim.plot.height]);

    const yAxis = d3.axisRight(y);

    const ohlcAnnotation = techan.plot
      .axisannotation()
      .axis(yAxis)
      .orient('right')
      .format(d3.format(',.2f'))
      .translate([x(1), 0]);

    const closeAnnotation = techan.plot
      .axisannotation()
      .axis(yAxis)
      .orient('right')
      .accessor(candlestick.accessor())
      .format(d3.format(',.2f'))
      .translate([x(1), 0]);

    const percentAxis = d3.axisLeft(yPercent).tickFormat(d3.format('+.1%'));

    const percentAnnotation = techan.plot
      .axisannotation()
      .axis(percentAxis)
      .orient('left');

    const volumeAxis = d3
      .axisRight(yVolume)
      .ticks(3)
      .tickFormat(d3.format(',.3s'));

    const volumeAnnotation = techan.plot
      .axisannotation()
      .axis(volumeAxis)
      .orient('right')
      .width(35);

    const ohlcCrosshair = techan.plot
      .crosshair()
      .xScale(timeAnnotation.axis().scale())
      .yScale(ohlcAnnotation.axis().scale())
      .xAnnotation(timeAnnotation)
      .yAnnotation([ohlcAnnotation, percentAnnotation, volumeAnnotation])
      .verticalWireRange([0, dim.plot.height]);

    let svg = d3
      .select('.chart')
      .append('svg')
      .attr('width', dim.width)
      .attr('height', dim.height);

    var valueText = svg
      .append('text')
      .style('text-anchor', 'end')
      .attr('class', 'coords')
      .attr('x', dim.width - 25)
      .attr('y', 15);

    const defs = svg.append('defs');

    defs
      .append('clipPath')
      .attr('id', 'ohlcClip')
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', dim.plot.width)
      .attr('height', dim.ohlc.height);

    defs
      .selectAll('indicatorClip')
      .data([0, 1])
      .enter()
      .append('clipPath')
      .attr('id', function(d, i) {
        return `indicatorClip-${i}`;
      })
      .append('rect')
      .attr('x', 0)
      .attr('y', function(d, i) {
        return indicatorTop(i);
      })
      .attr('width', dim.plot.width)
      .attr('height', dim.indicator.height);

    svg = svg.append('g').attr('transform', `translate(${dim.margin.left},${dim.margin.top})`);

    const title = chart.data('title');
    if (title) {
      svg
        .append('text')
        .attr('class', 'symbol')
        .attr('x', 20)
        .text(title);
    }

    svg
      .append('g')
      .attr('class', 'x axis')
      .attr('transform', `translate(0,${dim.plot.height})`);

    const ohlcSelection = svg
      .append('g')
      .attr('class', 'ohlc')
      .attr('transform', 'translate(0,0)');

    ohlcSelection
      .append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(${x(1)},0)`)
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -12)
      .attr('dy', '.71em')
      .style('text-anchor', 'end')
      .text('Price ($)');

    ohlcSelection.append('g').attr('class', 'close annotation up');

    ohlcSelection
      .append('g')
      .attr('class', 'volume')
      .attr('clip-path', 'url(#ohlcClip)');

    ohlcSelection
      .append('g')
      .attr('class', 'candlestick')
      .attr('clip-path', 'url(#ohlcClip)');

    ohlcSelection.append('g').attr('class', 'percent axis');

    ohlcSelection.append('g').attr('class', 'volume axis');

    // Add trendlines and other interactions last to be above zoom pane
    svg.append('g').attr('class', 'crosshair ohlc');

    svg
      .append('g')
      .attr('class', 'tradearrow')
      .attr('clip-path', 'url(#ohlcClip)');

    const accessor = candlestick.accessor();

    const trades = [];

    const data = candles
      .map(function(d) {
        if (d.signals && d.signals.length > 0) {
          d.signals.forEach(function(trade) {
            trades.push({
              date: new Date(d.date),
              type: trade.signal,
              price: d.close
            });
          });
        }

        return {
          date: new Date(d.date),
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume
        };
      })
      .sort(function(a, b) {
        return d3.ascending(accessor.d(a), accessor.d(b));
      });

    x.domain(techan.scale.plot.time(data).domain());
    y.domain(techan.scale.plot.ohlc(data.slice()).domain());
    yPercent.domain(techan.scale.plot.percent(y, accessor(data[0])).domain());
    yVolume.domain(techan.scale.plot.volume(data).domain());

    svg
      .select('g.candlestick')
      .datum(data)
      .call(candlestick);
    svg
      .select('g.close.annotation')
      .datum([data[data.length - 1]])
      .call(closeAnnotation);
    svg
      .select('g.volume')
      .datum(data)
      .call(volume);

    svg
      .select('g.crosshair.ohlc')
      .call(ohlcCrosshair)
      .call(zoom);

    svg
      .select('g.tradearrow')
      .datum(trades)
      .call(tradearrow);

    // Stash for zooming
    zoomableInit = x
      .zoomable()
      .domain([0, data.length])
      .copy(); // Zoom in a little to hide indicator preroll
    yInit = y.copy();
    yPercentInit = yPercent.copy();

    draw();

    function reset() {
      zoom.scale(1);
      zoom.translate([0, 0]);
      draw();
    }

    function zoomed() {
      x.zoomable().domain(d3.event.transform.rescaleX(zoomableInit).domain());
      y.domain(d3.event.transform.rescaleY(yInit).domain());
      yPercent.domain(d3.event.transform.rescaleY(yPercentInit).domain());

      draw();
    }

    function draw() {
      svg.select('g.x.axis').call(xAxis);
      svg.select('g.ohlc .axis').call(yAxis);
      svg.select('g.volume.axis').call(volumeAxis);
      svg.select('g.percent.axis').call(percentAxis);

      // We know the data does not change, a simple refresh that does not perform data joins will suffice.
      svg.select('g.candlestick').call(candlestick.refresh);
      svg.select('g.close.annotation').call(closeAnnotation.refresh);
      svg.select('g.volume').call(volume.refresh);
      svg.select('g.tradearrow').call(tradearrow.refresh);
    }
  }
});
