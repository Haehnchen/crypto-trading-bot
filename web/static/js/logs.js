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
    processing: true,
    serverSide: true,
    ajax: {
      type: 'POST',
      url: '/logsTable'
    },
    columns: [
      { data: 'level', name: 'Level' },
      {
        data: 'message',
        name: 'Message',
        render: function(data, type, row) {
          const profit = data.match(/(?<=profit":)(-?\d+.\d+)/);
          if (profit && type === 'display') 
            return data.replace(profit[0], '<span class="'+ (profit[0] < 0 ? 'text-danger' : 'text-success') + '">' + profit[0]+ '</span>')
          else return data;
        }
      },
      {
        data: 'createdAt',
        name: 'CreatedAt',
        render: function(data, type, row) {
          return type === 'display' ? moment(data).format('YYYY-MM-DD HH:mm:ss') : data;
        }
      }
    ],
    order: [[2, 'desc']]
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
