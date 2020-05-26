$(function() {
  function getPrecision(numberAsString) {
    const n = numberAsString.toString().split('.');
    return n.length > 1 ? n[1].length : 0;
  }

  $('.percent-input-group').on('click', 'button', function(e) {
    e.preventDefault();

    const input = $(this)
      .closest('.input-group')
      .find('input');

    const percentageChange = parseFloat($(this).val());

    const price = parseFloat(input.val());
    input.val((price + price / percentageChange / 100).toFixed(getPrecision(price)));
  });

  $('.form-group-amount').on('keyup', 'input', function(e) {
    const value = $(this).val();

    if (!value || Number.isNaN(value)) {
      return;
    }

    const id = $(this).attr('id');

    const scope = $(this).closest('form');
    const assetPrice = scope.find('#price').val();

    if (!assetPrice) {
      return;
    }

    if (id === 'amount') {
      scope.find('#amount_currency').val((value * assetPrice).toFixed(getPrecision(parseFloat(assetPrice))));
    } else {
      scope.find('#amount').val((value / assetPrice).toFixed(8)); // precision (tick / lot size?)
    }
  });

  const ordersTable = $('#ordersTable').DataTable({
    bFilter: false,
    paging: false,
    info: false,
    columnDefs: [
      {
        targets: [5, 6],
        visible: false,
        searchable: false
      }
    ]
  });

  // bind button actions
  $('#ordersTable tbody').on('click', 'button', function() {
    const data = ordersTable.row($(this).parents('tr')).data();
    $.ajax({
      url: `/orders/${data[5]}/${data[6]}`,
      type: 'DELETE',
      success: function(result) {
        // ordersTable.ajax.reload();
        location.reload();
      }
    });
  });

  $('button.cancel-all').on('click', 'button', function() {
    const data = ordersTable.rows(0).data();
    $.ajax({
      url: `/orders/${data[5]}`,
      type: 'DELETE',
      success: function(result) {
        // ordersTable.ajax.reload();
        location.reload();
      }
    });
  });

});
