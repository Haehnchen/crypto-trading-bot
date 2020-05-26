$(function() {
  const pairsTable = $('#pairsTable').DataTable({
    bFilter: false,
    paging: false,
    info: false,
    serverSide: true,
    ajax: {
      type: 'GET',
      url: '/pairs/trade'
    },
    columns: [
      { data: 'exchange', title: 'Exchange' },
      { data: 'symbol', title: 'Symbol' },
      { data: 'state', title: 'State' },
      { data: 'capital', title: 'Capital' },
      { data: 'strategies', title: 'Strategies' },
      { data: 'watchdogs', title: 'Options' },
      { data: 'process', title: 'Process', defaultContent: '' },
      { data: 'actions', title: 'Actions' }
      // { data: 'actions', visible: false }
    ],
    order: [[1, 'desc']],
    columnDefs: [
      {
        targets: 1,
        render: $.fn.dataTable.render.tradingviewLink('exchange')
      },
      {
        targets: [4, 5],
        render: $.fn.dataTable.render.JSON()
      },
      {
        targets: 7,
        render: $.fn.dataTable.render.actionButtons()
      }
    ]
  });

  $('#pairsTable tbody').on('click', 'button', function() {
    const data = pairsTable.row($(this).parents('tr')).data();
    $.get(`/pairs/${data.exchange}/${data.symbol}/${this.value}`);
  });
});
