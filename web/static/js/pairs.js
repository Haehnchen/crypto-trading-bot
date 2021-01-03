// filter pairs
$(function() {
  var filterTimeout = null;
  $(".filter-pairs").keyup(function() {
    var me = $(this);

    if (filterTimeout != null) {
      clearTimeout(filterTimeout);
    }
    filterTimeout = setTimeout(function() {
      var filter = me.val();

      var table = $('.table-pairs');
      if (filter.length === 0) {
        table.find('tbody tr').show();
        return;
      }

      table.find('tbody tr[data-search]').each(function() {
        const me = $(this);

        const search = me.data('search');

        if (search.toLowerCase().includes(filter.toLowerCase())) {
          me.closest('tr').show();
        } else {
          me.closest('tr').hide();
        }
      });
    }, 250);
  });
});
