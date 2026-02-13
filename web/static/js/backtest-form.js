document.addEventListener('DOMContentLoaded', function () {
  // Strategy change handler
  const strategySelect = document.querySelector('form.backtest-form #form-strategies');
  if (strategySelect) {
    strategySelect.addEventListener('change', function () {
      const selectedOption = this.options[this.selectedIndex];
      if (!selectedOption) return;

      const options = selectedOption.getAttribute('data-options');

      if (options) {
        const form = this.closest('form');
        const optionsInput = form.querySelector('#form-options');
        if (optionsInput) {
          optionsInput.value = options;
        }
      }
    });
  }

  // Pair change handler
  const pairSelect = document.querySelector('form.backtest-form #form-pair');
  if (pairSelect) {
    // Initialize Tom Select for pair (multi-select with search)
    if (typeof TomSelect !== 'undefined') {
      new TomSelect(pairSelect, {
        plugins: ['remove_button', 'clear_button'],
        persist: false,
        create: false,
        placeholder: pairSelect.dataset.placeholder || 'Select pairs...',
        render: {
          option: function(data, escape) {
            return '<div class="py-1">' + escape(data.text) + '</div>';
          }
        },
        onInitialize: function() {
          this.wrapper.classList.add('border', 'border-gray-300', 'rounded', 'text-sm');
        },
        onChange: function() {
          // Trigger original change handler for candle period update
          const selectedItems = this.getValue();
          if (selectedItems.length > 0) {
            const lastValue = Array.isArray(selectedItems) ? selectedItems[selectedItems.length - 1] : selectedItems;
            const option = pairSelect.querySelector('option[value="' + lastValue + '"]') ||
                           pairSelect.querySelector('option:contains("' + lastValue + '")');
            if (option) {
              const options = option.getAttribute('data-options');
              if (options) {
                const form = pairSelect.closest('form');
                const optionTag = form.querySelector('#form-candle-period');
                if (optionTag) {
                  optionTag.innerHTML = '';
                  const periods = JSON.parse(options);
                  periods.forEach(function (period) {
                    const opt = document.createElement('option');
                    opt.value = period;
                    opt.textContent = period;
                    optionTag.appendChild(opt);
                  });
                }
              }
            }
          }
        }
      });
    }
  }
});
