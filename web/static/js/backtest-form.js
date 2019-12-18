$(function() {
  $('form.backtest-form #form-strategies').change(function() {
    // get data as string
    const options = $(this)
      .find('option:selected')
      .attr('data-options');

    if (options) {
      $(this)
        .closest('form')
        .find('#form-options')
        .val(options);
    }
  });
});
