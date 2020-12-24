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

  $('.chosen-select').chosen();

  $('form.backtest-form #form-pair').change(function() {
    // get data as string
    const options = $(this)
      .find('option:selected')
      .attr('data-options');

    if (options) {
      const optionTag = $(this)
        .closest('form')
        .find('#form-candle-period');

      optionTag.html('');
      $.each(JSON.parse(options), function(key, value) {
        optionTag.append($('<option>', { value: value }).text(value));
      });
    }
  });
});
