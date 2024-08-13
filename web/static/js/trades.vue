<template>
  <div class="vue-root">
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Positions</h3> <span class="text-muted float-right"><transition name="slide-fade" mode="out-in"><div :key="positionsUpdatedAt">{{ positionsUpdatedAt }}</div></transition></span>
      </div>

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
                {{ formatPrice(position.currency) }}
              </template>
              <template v-if="!!position.currencyProfit">
                <span class="text-muted"> / {{ formatPrice(position.currencyProfit) }}</span>
              </template>
            </td>
            <td>
            <span v-if="typeof position.position.profit !== 'undefined'" v-bind:class="{ 'text-success': position.position.profit >= 0, 'text-danger': position.position.profit < 0 }">
              {{ round(position.position.profit, 2) }} %
            </span>
            </td>
            <td>
              <template v-if="!!position.position.entry">
                {{ formatPrice(position.position.entry) }}
              </template>
            </td>
            <td>
              <template v-if="!!position.position.updatedAt">
                {{ date(position.position.updatedAt, 'd.m.y H:i') }}
              </template>
            </td>
            <td>
              <template v-if="!!position.position.createdAt">
                {{ date(position.position.createdAt, 'd.m.y H:i') }}
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
        <h3 class="card-title">Orders</h3> <span class="text-muted float-right"><transition name="slide-fade" mode="out-in"><div :key="ordersUpdatedAt">{{ ordersUpdatedAt }}</div></transition></span>
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
              <td>{{ order.order.price }}<span class="text-muted" v-if="order.percent_to_price" title="Percent to current price"> {{ round(order.percent_to_price, 1) }} %</span></td>
              <td v-bind:class="{ 'text-success': order.order.amount > 0, 'text-danger': order.order.amount < 0 }">{{ order.order.amount }}</td>
              <td>{{ order.order.retry }}</td>
              <td>{{ order.order.ourId }}</td>
              <td>{{ date(order.order.createdAt, 'd.m.y H:i') }}</td>
              <td>{{ date(order.order.updatedAt, 'd.m.y H:i') }}</td>
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
import { ref } from 'vue'

export default {
  data() {
    const positionsUpdatedAt = ref(null);
    const ordersUpdatedAt = ref(null);
    const orders = ref([]);
    const positions = ref([]);

    return {
      positionsUpdatedAt,
      ordersUpdatedAt,
      orders,
      positions
    }
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

      this.positions = [
        {
          'currency': 12.12,
          'currencyProfit': 12,
          'exchange': 'binance',
          'position': {
            'type': 'long',
            'amount': 12.12,
            'profit': 12,
            'entry': 13.23,
            'updatedAt' : new Date(),
            'createdAt': new Date(),
          }
        }
      ]

      this.orders = [
        {
          'currency': 12.12,
          'currencyProfit': 12,
          'exchange': 'binance',
          'order': {
            'type': 'ggg',
            'id': 'aaa',
            'price': 12.12,
            'percent_to_price': 4,
            'ourId': '12',
            'entry': 13.23,
            'side': 'buy',
            'updatedAt': new Date(),
            'createdAt': new Date(),
            'status': 'aaaa',
          }
        }
      ];

      this.positionsUpdatedAt = new Date().toLocaleTimeString();
      this.ordersUpdatedAt = new Date().toLocaleTimeString();
    },
    formatPrice(value) {
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
    },
    round(value, decimalPlaces = 0) {
      return value.toFixed(decimalPlaces);
    },
    date(value) {
      return new Date(value).toLocaleString();
    }
  },
  mounted() {
    this.fetchPageAsJson();
    this.timer = setInterval(this.fetchPageAsJson, 3000);
  }
}

</script>

<style scoped>
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

