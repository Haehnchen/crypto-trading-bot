document.addEventListener('DOMContentLoaded', function () {
  var filterTimeout = null;

  document.querySelectorAll('.filter-pairs').forEach(function (input) {
    input.addEventListener('keyup', function () {
      var me = this;

      if (filterTimeout != null) {
        clearTimeout(filterTimeout);
      }

      filterTimeout = setTimeout(function () {
        var filter = me.value;

        var table = document.querySelector('.table-pairs');
        if (!table) return;

        if (filter.length === 0) {
          table.querySelectorAll('tbody tr').forEach(function (row) {
            row.style.display = '';
          });
          return;
        }

        table.querySelectorAll('tbody tr[data-search]').forEach(function (row) {
          const search = row.dataset.search;

          if (search.toLowerCase().includes(filter.toLowerCase())) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });
      }, 250);
    });
  });
});
