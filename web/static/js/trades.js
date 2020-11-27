Vue.filter('filter_price', function(value) {
  if (parseFloat(value) < 1) {
    return Intl.NumberFormat('en-US', {
      useGrouping: false,
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(value);
  }

  return Intl.NumberFormat('en-US', {
    useGrouping: false,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
});

Vue.filter('round', function(value, decimalPlaces = 0) {
  return value.toFixed(decimalPlaces);
});

Vue.filter('date', function(value) {
  return new Date(value).toLocaleString();
});

new Vue({
  el: '#vue-trades',
  components: {
    'trades': httpVueLoader('js/trades.vue')
  }
});
