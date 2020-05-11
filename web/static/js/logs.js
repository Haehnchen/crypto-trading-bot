$(function() {
  const t = $('#logsTable').DataTable({
    paging: true,
    pageLength: 10,
    processing: true,
    serverSide: true,
    ajax: {
      type: 'POST',
      url: '/logsTable'
    },
    // data: [{"level":"info","message":"Ticker out of range stop loss (long): {\"symbol\":\"BTCUSD\",\"side\":\"long\",\"amount\":0.15,\"profit\":0.6820223348452448,\"updatedAt\":\"2020-05-06T09:46:55.903Z\",\"entry\":9017.3,\"createdAt\":\"2020-05-06T09:46:55.903Z\"}{\"exchange\":\"bitfinex\",\"symbol\":\"BTCUSD\",\"time\":\"1588758406\",\"bid\":9078.8,\"ask\":9078.9,\"createdAt\":\"2020-05-06T09:46:46.151Z\"}","created_at":1588758423,"profit":"0.6820223348452448"},{"level":"info","message":"Ticker out of range stop loss (long): {\"symbol\":\"BTCUSD\",\"side\":\"long\",\"amount\":0.15,\"profit\":0.6820223348452448,\"updatedAt\":\"2020-05-06T09:46:25.905Z\",\"entry\":9017.3,\"createdAt\":\"2020-05-06T09:46:25.905Z\"}{\"exchange\":\"bitfinex\",\"symbol\":\"BTCUSD\",\"time\":\"1588758376\",\"bid\":9078.8,\"ask\":9078.9,\"createdAt\":\"2020-05-06T09:46:16.119Z\"}","created_at":1588758393,"profit":"0.6820223348452448"},{"level":"info","message":"Ticker out of range stop loss (long): {\"symbol\":\"BTCUSD\",\"side\":\"long\",\"amount\":0.15,\"profit\":0.6565158085014344,\"updatedAt\":\"2020-05-06T09:45:55.912Z\",\"entry\":9017.3,\"createdAt\":\"2020-05-06T09:45:55.912Z\"}{\"exchange\":\"bitfinex\",\"symbol\":\"BTCUSD\",\"time\":\"1588758356\",\"bid\":9076.5,\"ask\":9077,\"createdAt\":\"2020-05-06T09:45:56.173Z\"}","created_at":1588758362,"profit":"0.6565158085014344"},{"level":"info","message":"Ticker out of range stop loss (long): {\"symbol\":\"BTCUSD\",\"side\":\"long\",\"amount\":0.15,\"profit\":0.6609517261264575,\"updatedAt\":\"2020-05-06T09:45:25.900Z\",\"entry\":9017.3,\"createdAt\":\"2020-05-06T09:45:25.900Z\"}{\"exchange\":\"bitfinex\",\"symbol\":\"BTCUSD\",\"time\":\"1588758326\",\"bid\":9076.9,\"ask\":9077,\"createdAt\":\"2020-05-06T09:45:26.161Z\"}","created_at":1588758331,"profit":"0.6609517261264575"},{"level":"info","message":"Ticker out of range stop loss (long): {\"symbol\":\"BTCUSD\",\"side\":\"long\",\"amount\":0.15,\"profit\":0.6110476528450981,\"updatedAt\":\"2020-05-06T09:44:55.900Z\",\"entry\":9017.3,\"createdAt\":\"2020-05-06T09:44:55.900Z\"}{\"exchange\":\"bitfinex\",\"symbol\":\"BTCUSD\",\"time\":\"1588758296\",\"bid\":9072.4,\"ask\":9072.5,\"createdAt\":\"2020-05-06T09:44:56.121Z\"}","created_at":1588758300,"profit":"0.6110476528450981"},{"level":"info","message":"Ticker out of range stop loss (long): {\"symbol\":\"BTCUSD\",\"side\":\"long\",\"amount\":0.15,\"profit\":0.5811052088762869,\"updatedAt\":\"2020-05-06T09:44:25.906Z\",\"entry\":9017.3,\"createdAt\":\"2020-05-06T09:44:25.906Z\"}{\"exchange\":\"bitfinex\",\"symbol\":\"BTCUSD\",\"time\":\"1588758266\",\"bid\":9069.7,\"ask\":9069.8,\"createdAt\":\"2020-05-06T09:44:26.124Z\"}","created_at":1588758269,"profit":"0.5811052088762869"},{"level":"info","message":"Ticker out of range stop loss (long): {\"symbol\":\"BTCUSD\",\"side\":\"long\",\"amount\":0.15,\"profit\":0.5633615383762391,\"updatedAt\":\"2020-05-06T09:43:55.905Z\",\"entry\":9017.3,\"createdAt\":\"2020-05-06T09:43:55.905Z\"}{\"exchange\":\"bitfinex\",\"symbol\":\"BTCUSD\",\"time\":\"1588758236\",\"bid\":9068.1,\"ask\":9069.7,\"createdAt\":\"2020-05-06T09:43:56.171Z\"}","created_at":1588758239,"profit":"0.5633615383762391"},{"level":"info","message":"Ticker out of range stop loss (long): {\"symbol\":\"BTCUSD\",\"side\":\"long\",\"amount\":0.15,\"profit\":0.5844321470950264,\"updatedAt\":\"2020-05-06T09:43:25.896Z\",\"entry\":9017.3,\"createdAt\":\"2020-05-06T09:43:25.896Z\"}{\"exchange\":\"bitfinex\",\"symbol\":\"BTCUSD\",\"time\":\"1588758196\",\"bid\":9070,\"ask\":9070.1,\"createdAt\":\"2020-05-06T09:43:16.121Z\"}","created_at":1588758208,"profit":"0.5844321470950264"},{"level":"info","message":"Ticker out of range stop loss (long): {\"symbol\":\"BTCUSD\",\"side\":\"long\",\"amount\":0.15,\"profit\":0.6032847970013355,\"updatedAt\":\"2020-05-06T09:42:55.897Z\",\"entry\":9017.3,\"createdAt\":\"2020-05-06T09:42:55.897Z\"}{\"exchange\":\"bitfinex\",\"symbol\":\"BTCUSD\",\"time\":\"1588758146\",\"bid\":9071.7,\"ask\":9071.8,\"createdAt\":\"2020-05-06T09:42:26.187Z\"}","created_at":1588758177,"profit":"0.6032847970013355"},{"level":"info","message":"Ticker out of range stop loss (long): {\"symbol\":\"BTCUSD\",\"side\":\"long\",\"amount\":0.15,\"profit\":0.6032847970013355,\"updatedAt\":\"2020-05-06T09:42:25.894Z\",\"entry\":9017.3,\"createdAt\":\"2020-05-06T09:42:25.894Z\"}{\"exchange\":\"bitfinex\",\"symbol\":\"BTCUSD\",\"time\":\"1588758146\",\"bid\":9071.7,\"ask\":9071.8,\"createdAt\":\"2020-05-06T09:42:26.187Z\"}","created_at":1588758146,"profit":"0.6032847970013355"}],
    columns: [
      { data: 'level', name: 'Level' },
      { data: 'message', name: 'Message' },
      {
        data: 'created_at',
        name: 'CreatedAt'
        /* ,
        formatter: function($d, $row) {
          return date('jS M y', strtotime($d)); 
        } */
      }
    ],
    columnDefs: [
      {
        searchable: true,
        orderable: true,
        targets: 0
      }
    ]
  });
});
