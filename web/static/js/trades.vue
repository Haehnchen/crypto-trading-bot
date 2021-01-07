<template>
  <div class="vue-root">
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Positions</h3> <span class="text-muted float-right"><transition name="slide-fade" mode="out-in"><div :key="positionsUpdatedAt">{{ positionsUpdatedAt }}</div></transition></span>
      </div>
      <!-- /.card-header -->
      <div class="card-body">
        <table class="table table-bordered table-sm table-hover">
          <thead>
          <tr>
            <th scope="col" title="Exchange">E</th>
            <th scope="col">Symbol</th>
            <th scope="col">Amount</th>
            <th scope="col">Currency</th>
            <th scope="col">Profit</th>
            <th scope="col">Entry</th>
            <th scope="col">Updated</th>
            <th scope="col">Created</th>
            <th scope="col" title="Side">S</th>
            <th scope="col" title="Action">A</th>
          </tr>

          </thead>
          <tbody>
          <tr v-for='position in positions' :key="`${position.exchange}-${position.position.symbol}`">
            <td><img :src="`/img/exchanges/${position.exchange}.png`" :alt="position.exchange" :title="position.exchange" width="16px" height="16px"></td>
            <td><a target="blank" :href="'/tradingview/' + position.exchange + ':' + position.position.symbol">{{ position.position.symbol }}</a></td>
            <td v-bind:class="{ 'text-success': position.position.amount > 0, 'text-danger': position.position.amount < 0 }">
              {{ position.position.amount }}
            </td>
            <td>
              <template v-if="!!position.currency">
                {{ position.currency|filter_price }}
              </template>
              <template v-if="!!position.currencyProfit">
                <span class="text-muted"> / {{ position.currencyProfit|filter_price }}</span>
              </template>
            </td>
            <td>
            <span v-if="typeof position.position.profit !== 'undefined'" v-bind:class="{ 'text-success': position.position.profit >= 0, 'text-danger': position.position.profit < 0 }">
              {{ position.position.profit|round(2) }} %
            </span>
            </td>
            <td>
              <template v-if="!!position.position.entry">
                {{ position.position.entry|filter_price }}
              </template>
            </td>
            <td>
              <template v-if="!!position.position.updatedAt">
                {{ position.position.updatedAt|date('d.m.y H:i') }}
              </template>
            </td>
            <td>
              <template v-if="!!position.position.createdAt">
                {{ position.position.createdAt|date('d.m.y H:i') }}
              </template>
            </td>
            <td>
              <i v-if="position.position.side === 'short'" class="fas fa-chevron-circle-down text-danger" title="short"></i>
              <i v-if="position.position.side === 'long'" class="fas fa-chevron-circle-up text-success" title="long"></i>
            </td>
            <td style="white-space: nowrap;padding: 0;">
              <form :action="'/pairs/' + position.exchange + '-' + position.position.symbol" method="post">
                <button style="padding: 0 0 0 3px;" name="action" value="close" data-toggle="tooltip"
                        title="Limit Close" class="btn btn-link">
                  <i class="fas fa-window-close text-dark" style="font-size: 0.9rem"></i>
                </button>
              </form>
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Orders</h3> <span class="text-muted float-right"><transition name="slide-fade" mode="out-in"><div :key="positionsUpdatedAt">{{ ordersUpdatedAt }}</div></transition></span>
      </div>
      <div class="card-body">
        <div class="table-responsive">
          <table class="table table-bordered table-sm table-hover">
            <thead>
            <tr>
              <th scope="col" title="Exchange">E</th>
              <th scope="col">Symbol</th>
              <th scope="col">Type</th>
              <th scope="col">Id</th>
              <th scope="col">Price</th>
              <th scope="col">Amount</th>
              <th scope="col">Retry</th>
              <th scope="col">OurId</th>
              <th scope="col">Created</th>
              <th scope="col">Updated</th>
              <th scope="col">Status</th>
              <th scope="col" title="Side">S</th>
              <th scope="col" title="Action">A</th>
            </tr>

            </thead>
            <tbody>
            <tr v-for='order in orders' :key="`${order.exchange}-${order.order.symbol}-${order.order.id}`">
              <td><img :src="`/img/exchanges/${order.exchange}.png`" :alt="order.exchange" :title="order.exchange" width="16px" height="16px"></td>
              <td><a target="blank" :href="'/tradingview/' + order.exchange + ':' + order.order.symbol">{{ order.order.symbol }}</a></td>
              <td>{{ order.order.type }}</td>
              <td>{{ order.order.id }}</td>
              <td>{{ order.order.price }}<span class="text-muted" v-if="order.percent_to_price" title="Percent to current price"> {{ order.percent_to_price|round(1) }} %</span></td>
              <td v-bind:class="{ 'text-success': order.order.amount > 0, 'text-danger': order.order.amount < 0 }">{{ order.order.amount }}</td>
              <td>{{ order.order.retry }}</td>
              <td>{{ order.order.ourId }}</td>
              <td>{{ order.order.createdAt|date('d.m.y H:i') }}</td>
              <td>{{ order.order.updatedAt|date('d.m.y H:i') }}</td>
              <td>{{ order.order.status }}</td>
              <td>
                <i v-if="order.order.side === 'sell'" class="fas fa-chevron-circle-down text-danger" title="short"></i>
                <i v-if="order.order.side === 'buy'" class="fas fa-chevron-circle-up text-success" title="long"></i>
              </td>
              <td>
                <a title="cancel" :href="'/order/' + order.exchange + '/' + order.order.id"><i class="fas fa-window-close text-dark"></i></a>
              </td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
module.exports = {
  data: function() {
    return {
      positions: [],
      orders: [],
      positionsUpdatedAt: '',
      ordersUpdatedAt: ''
    }
  },
  created: function() {
    this.fetchPageAsJson();
    this.timer = setInterval(this.fetchPageAsJson, 3000);
  },
  methods: {
    async fetchPageAsJson() {
      const res = await fetch('/trades.json');
      const data = await res.json();

      if (!('positions' in data && 'orders' in data)) {
        return;
      }

      this.positions = data.positions || [];
      this.orders = data.orders || [];

      this.positionsUpdatedAt = new Date().toLocaleTimeString();
      this.ordersUpdatedAt = new Date().toLocaleTimeString();
    },
    cancelAutoUpdate() {
      clearInterval(this.timer);
    }
  },
  beforeDestroy() {
    clearInterval(this.timer);
  },
}
</script>

<style>
.slide-fade-enter-active {
  transition: all .3s ease;
}
.slide-fade-leave-active {
  transition: all .6s cubic-bezier(1.0, 0.5, 0.8, 1.0);
}
.slide-fade-enter, .slide-fade-leave-to {
  opacity: 0.3;
}
</style>
