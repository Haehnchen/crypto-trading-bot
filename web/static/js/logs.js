$(function() {
  function getExcludeFilter() {
    // build a regex filter string with an or(|) condition
    const positions = $('input:checkbox[name="logExcludeLevels"]:checked')
      .map(function() {
        return this.value;
      })
      .get()
      .join('|');

    return positions ? `^((?!${positions}).*)$` : '';
  }

  const logsTable = $('#logsTable').DataTable({
    paging: true,
    pageLength: 10,
    responsive: true,
    serverSide: true,
    ajax: {
      type: 'POST',
      url: '/logsTable'
    },
    columns: [
      { data: 'level', title: 'Level' },
      { data: 'message', title: 'Message' },
      { data: 'createdAt', title: 'CreatedAt' }
    ],
    order: [[2, 'desc']],
    columnDefs: [
      {
        targets: [1],
        render: $.fn.dataTable.render.highlightProfit()
      },
      {
        targets: [2],
        render: $.fn.dataTable.render.moment('YYYY-MM-DDTHH:mm:ss.SSSZ', 'YYYY-MM-DD HH:mm:ss')    // 2020-05-21T20:38:11.462Z
      }
    ]
  });

  $('input:checkbox').on('change', function() {
    // filter in column 1 by removing checked items, with an regex, no smart filtering, not case sensitive
    // Example: ^((?!word1|word2).*)$
    logsTable
      .column(0)
      .search(getExcludeFilter(), true, false, false)
      .draw(false);
  });
});
