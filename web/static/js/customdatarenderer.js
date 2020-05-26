jQuery.fn.dataTable.render.greenRed = function(format = {}) {
  return function(d, type, row) {
    // Order, search and type get the original data
    if (type !== 'display') {
      return d;
    }

    if (typeof d !== 'number' && typeof d !== 'string') {
      return d;
    }
    const dd = format.style === 'percent' ? parseFloat(d) / 100 : parseFloat(d);
    return `<span class="${dd < 0 ? 'text-danger' : 'text-success'}">${dd.toLocaleString(undefined, format)}</span>`;
  };
};

jQuery.fn.dataTable.render.tradingviewLink = function(exchangeColumn) {
  return function(d, type, row) {
    // Order, search and type get the original data
    if (type !== 'display') {
      return d;
    }

    if (typeof d !== 'string' || !exchangeColumn) {
      return d;
    }

    return `<a target="blank" href="/tradingview/${row[exchangeColumn]}:${d}">${d}</a>`;
  };
};

jQuery.fn.dataTable.render.highlightProfit = function() {
  return function(data, type, row) {
    // Order, search and type get the original data
    if (type !== 'display') {
      return data;
    }

    if (typeof data !== 'string') {
      return data;
    }
    
    const profit = data.match(/(?<=profit":)(-?\d+.\d+)/);
    if (!profit) {
      return data;
    }

    return data.replace(profit[0], '<span class="'+ (profit[0] < 0 ? 'text-danger' : 'text-success') + '">' + profit[0]+ '</span>')
  };
};


jQuery.fn.dataTable.render.highlightProfit = function() {
  return function(data, type, row) {
    // Order, search and type get the original data
    if (type !== 'display') {
      return data;
    }

    if (typeof data !== 'string') {
      return data;
    }
    
    const profit = data.match(/(?<=profit":)(-?\d+.\d+)/);
    if (!profit) {
      return data;
    }

    return data.replace(profit[0], '<span class="'+ (profit[0] < 0 ? 'text-danger' : 'text-success') + '">' + profit[0]+ '</span>')
  };
};

// Renders arrow: green up if data == 'long', else red down.
jQuery.fn.dataTable.render.arrows = function() {
  return function(data, type, row) {
    // Order, search and type get the original data
    if (type !== 'display') {
      return data;
    }

    if (typeof data !== 'string') {
      return data;
    }

    return (data === 'short' ? `<i class="fas fa-chevron-circle-down text-danger"></i>` : 
      `<i class="fas fa-chevron-circle-up text-success"></i>`)
  };
};

jQuery.fn.dataTable.render.JSON = function() {
  return function(data, type, row) {
    // Order, search and type get the original data
    if (type !== 'display') {
      return data;
    }

    return JSON.stringify(data);
  };
};

// Renders buttons for actions
// Parameters:
//    assetType - controller name to handle action
//    buttonss - an object containing { action : `ActionTitle`, action2 ....}
//        or string value to reference row column containing actions JSON objec.
jQuery.fn.dataTable.render.actionButtons = function(showLable = false) {
  return function(data, type, row) {
    // Order, search and type get the original data
    if (type !== 'display') {
      return data;
    }

    const btnConfig = {
        short: { title: `Limit Short`, btnClass:  `btn-danger`, iClass: `fa-shopping-cart` },
        long: { title: `Limit Long`, btnClass:  `btn-success`, iClass: `fa-cart-plus` },
        short_market: { title: `Market Short`, btnClass:  `btn-danger`, iClass: `fa-shopping-cart` },
        long_market: { title: `Market Long`, btnClass:  `btn-success`, iClass: `fa-cart-plus` },
        close: { title: `Limit Close`, btnClass:  ``, iClass: `fa-window-close` },
        close_market: { title: `Market Close`, btnClass:  ``, iClass: `fa-window-close` },
        cancel: { title: `Close`, btnClass: ``, iClass: `fas fa-window-close text-dark` }
      };
    const actions = typeof data == 'string' ? [data] : data;
    let results = actions.map(action => 
      `<button name="action" value="${action}" data-toggle="tooltip" title="${btnConfig[action].title}" class="btn btn-xs ${btnConfig[action].btnClass}"><i class="fas ${btnConfig[action].iClass}"></i>${showLable ? btnConfig[action].title : ''}</button>`
    );
    return `<div class="btn-group btn-group-sm text-nowrap" role="group" aria-label="Row actions">` + results.join('') + `</div>`
  };
};
