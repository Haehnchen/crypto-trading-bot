<template>
  <div>
    <div class="bg-white overflow-x-auto mb-4">
      <!-- Header -->
      <div class="px-4 py-3 border-b-2 border-gray-300 flex justify-between items-center">
        <span class="text-lg font-semibold">Positions</span>
        <span class="text-gray-500 text-[13px]">{{ positionsUpdatedAt }}</span>
      </div>

      <!-- Table -->
      <table class="w-full border-collapse text-[13px]">
        <thead>
        <tr>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2" title="Exchange">E</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2">Symbol</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2">Amount</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2">Currency</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2">Profit</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2">Entry</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2">Updated</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2">Created</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2" title="Side">S</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2" title="Action">A</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for='position in positions' :key="`${position.exchange}-${position.position.symbol}`" class="hover:bg-gray-100">
          <td class="border border-gray-200 px-3 py-2"><img :src="`/img/exchanges/${position.exchange}.png`" :alt="position.exchange" :title="position.exchange" width="16" height="16"></td>
          <td class="border border-gray-200 px-3 py-2"><a target="blank" :href="'/tradingview/' + position.exchange + ':' + urlEncode(position.position.symbol)" class="text-blue-600 hover:underline">{{ position.position.symbol }}</a></td>
          <td class="border border-gray-200 px-3 py-2" :class="{ 'text-green-600': position.position.amount > 0, 'text-red-600': position.position.amount < 0 }">
            {{ position.position.amount }}
          </td>
          <td class="border border-gray-200 px-3 py-2">
            <template v-if="!!position.currency">
              {{ formatPrice(position.currency) }}
            </template>
            <template v-if="!!position.currencyProfit">
              <span class="text-gray-500"> / {{ formatPrice(position.currencyProfit) }}</span>
            </template>
          </td>
          <td class="border border-gray-200 px-3 py-2">
          <span v-if="typeof position.position.profit !== 'undefined'" :class="{ 'text-green-600': position.position.profit >= 0, 'text-red-600': position.position.profit < 0 }">
            {{ round(position.position.profit, 2) }} %
          </span>
          </td>
          <td class="border border-gray-200 px-3 py-2">
            <template v-if="!!position.position.entry">
              {{ formatPrice(position.position.entry) }}
            </template>
          </td>
          <td class="border border-gray-200 px-3 py-2">
            <template v-if="!!position.position.updatedAt">
              {{ date(position.position.updatedAt, 'd.m.y H:i') }}
            </template>
          </td>
          <td class="border border-gray-200 px-3 py-2">
            <template v-if="!!position.position.createdAt">
              {{ date(position.position.createdAt, 'd.m.y H:i') }}
            </template>
          </td>
          <td class="border border-gray-200 px-3 py-2">
            <i v-if="position.position.side === 'short'" class="fas fa-chevron-circle-down text-red-600" title="short"></i>
            <i v-if="position.position.side === 'long'" class="fas fa-chevron-circle-up text-green-600" title="long"></i>
          </td>
          <td class="border border-gray-200 px-3 py-2 p-0">
            <form :action="'/pairs/' + position.exchange + '-' + position.position.symbol" method="post">
              <button class="text-gray-600 hover:text-red-600 px-1 py-1" name="action" value="close" title="Limit Close">
                <i class="fas fa-window-close" style="font-size: 0.9rem"></i>
              </button>
            </form>
          </td>
        </tr>
        </tbody>
      </table>
    </div>

    <div class="bg-white overflow-x-auto">
      <!-- Header -->
      <div class="px-4 py-3 border-b-2 border-gray-300 flex justify-between items-center">
        <span class="text-lg font-semibold">Orders</span>
        <span class="text-gray-500 text-[13px]">{{ ordersUpdatedAt }}</span>
      </div>

      <!-- Table -->
      <table class="w-full border-collapse text-[13px]">
        <thead>
        <tr>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2" title="Exchange">E</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2">Symbol</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2">Type</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2">Id</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2">Price</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2">Amount</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2">Retry</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2">OurId</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2">Created</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2">Updated</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2">Status</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2" title="Side">S</th>
          <th class="border border-gray-200 bg-gray-50 font-semibold px-3 py-2" title="Action">A</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for='order in orders' :key="`${order.exchange}-${order.order.symbol}-${order.order.id}`" class="hover:bg-gray-100">
          <td class="border border-gray-200 px-3 py-2"><img :src="`/img/exchanges/${order.exchange}.png`" :alt="order.exchange" :title="order.exchange" width="16" height="16"></td>
          <td class="border border-gray-200 px-3 py-2"><a target="blank" :href="'/tradingview/' + order.exchange + ':' + order.order.symbol" class="text-blue-600 hover:underline">{{ order.order.symbol }}</a></td>
          <td class="border border-gray-200 px-3 py-2">{{ order.order.type }}</td>
          <td class="border border-gray-200 px-3 py-2">{{ order.order.id }}</td>
          <td class="border border-gray-200 px-3 py-2">{{ order.order.price }} <span class="text-gray-500" v-if="order.percent_to_price" title="Percent to current price"> {{ round(order.percent_to_price, 1) }} %</span></td>
          <td class="border border-gray-200 px-3 py-2" :class="{ 'text-green-600': order.order.amount > 0, 'text-red-600': order.order.amount < 0 }">{{ order.order.amount }}</td>
          <td class="border border-gray-200 px-3 py-2">{{ order.order.retry }}</td>
          <td class="border border-gray-200 px-3 py-2">{{ order.order.ourId }}</td>
          <td class="border border-gray-200 px-3 py-2">{{ date(order.order.createdAt, 'd.m.y H:i') }}</td>
          <td class="border border-gray-200 px-3 py-2">{{ date(order.order.updatedAt, 'd.m.y H:i') }}</td>
          <td class="border border-gray-200 px-3 py-2">{{ order.order.status }}</td>
          <td class="border border-gray-200 px-3 py-2">
            <i v-if="order.order.side === 'sell'" class="fas fa-chevron-circle-down text-red-600" title="short"></i>
            <i v-if="order.order.side === 'buy'" class="fas fa-chevron-circle-up text-green-600" title="long"></i>
          </td>
          <td class="border border-gray-200 px-3 py-2">
            <a title="cancel" :href="'/order/' + order.exchange + '/' + order.order.id" class="text-gray-600 hover:text-red-600"><i class="fas fa-window-close"></i></a>
          </td>
        </tr>
        </tbody>
      </table>
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
    },
    urlEncode(value) {
      return encodeURIComponent(value);
    }
  },
  mounted() {
    this.fetchPageAsJson();
    this.timer = setInterval(this.fetchPageAsJson, 3000);
  }
}

</script>
