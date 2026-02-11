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
    pairSelect.addEventListener('change', function () {
      const selectedOption = this.options[this.selectedIndex];
      if (!selectedOption) return;

      const options = selectedOption.getAttribute('data-options');

      if (options) {
        const form = this.closest('form');
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
    });
  }

  // Initialize custom multi-select for chosen-select elements
  document.querySelectorAll('.chosen-select').forEach(function (select) {
    initializeCustomSelect(select);
  });
});

function initializeCustomSelect(select) {
  // Skip if already initialized
  if (select.dataset.customSelectInitialized) return;
  select.dataset.customSelectInitialized = 'true';

  const isMultiple = select.multiple;
  const placeholder = select.dataset.placeholder || 'Select an option';

  // Create wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-select-wrapper relative';
  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);

  // Hide original select but keep it functional
  select.style.display = 'none';

  // Create custom display
  const display = document.createElement('div');
  display.className = 'custom-select-display w-full border border-gray-300 rounded px-3 py-2 bg-white cursor-pointer flex items-center justify-between';
  display.innerHTML = `<span class="placeholder text-gray-500">${placeholder}</span><i class="fas fa-chevron-down text-gray-400 text-xs"></i>`;
  wrapper.appendChild(display);

  // Create dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'custom-select-dropdown hidden absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto';
  wrapper.appendChild(dropdown);

  // Add search input for multiple select
  if (isMultiple) {
    const searchContainer = document.createElement('div');
    searchContainer.className = 'p-2 border-b border-gray-200';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'w-full border border-gray-300 rounded px-2 py-1 text-sm';
    searchInput.placeholder = 'Search...';
    searchContainer.appendChild(searchInput);
    dropdown.appendChild(searchContainer);

    searchInput.addEventListener('input', function () {
      const filter = this.value.toLowerCase();
      dropdown.querySelectorAll('.custom-option').forEach(function (option) {
        const text = option.textContent.toLowerCase();
        option.style.display = text.includes(filter) ? '' : 'none';
      });
    });
  }

  // Add options
  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'options-container';
  dropdown.appendChild(optionsContainer);

  Array.from(select.options).forEach(function (option, index) {
    if (option.disabled) return;

    const customOption = document.createElement('div');
    customOption.className = 'custom-option px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm';
    customOption.textContent = option.textContent;
    customOption.dataset.value = option.value || option.textContent;
    customOption.dataset.index = index;

    if (option.selected) {
      customOption.classList.add('bg-blue-50', 'text-blue-700');
    }

    customOption.addEventListener('click', function (e) {
      e.stopPropagation();

      if (isMultiple) {
        option.selected = !option.selected;
        this.classList.toggle('bg-blue-50');
        this.classList.toggle('text-blue-700');
        updateMultipleDisplay();
      } else {
        // Single select
        Array.from(select.options).forEach(function (opt) {
          opt.selected = false;
        });
        option.selected = true;

        dropdown.querySelectorAll('.custom-option').forEach(function (opt) {
          opt.classList.remove('bg-blue-50', 'text-blue-700');
        });
        this.classList.add('bg-blue-50', 'text-blue-700');

        display.innerHTML = `<span>${option.textContent}</span><i class="fas fa-chevron-down text-gray-400 text-xs"></i>`;
        dropdown.classList.add('hidden');

        // Trigger change event
        select.dispatchEvent(new Event('change'));
      }
    });

    optionsContainer.appendChild(customOption);
  });

  function updateMultipleDisplay() {
    const selected = Array.from(select.options).filter(function (opt) {
      return opt.selected;
    });

    if (selected.length === 0) {
      display.innerHTML = `<span class="placeholder text-gray-500">${placeholder}</span><i class="fas fa-chevron-down text-gray-400 text-xs"></i>`;
    } else {
      const text = selected
        .map(function (opt) {
          return opt.textContent;
        })
        .join(', ');
      display.innerHTML = `<span class="truncate">${text}</span><i class="fas fa-chevron-down text-gray-400 text-xs"></i>`;
    }

    // Trigger change event
    select.dispatchEvent(new Event('change'));
  }

  // Toggle dropdown
  display.addEventListener('click', function (e) {
    e.stopPropagation();
    const isHidden = dropdown.classList.contains('hidden');

    // Close all other dropdowns
    document.querySelectorAll('.custom-select-dropdown').forEach(function (d) {
      d.classList.add('hidden');
    });

    if (isHidden) {
      dropdown.classList.remove('hidden');
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', function () {
    dropdown.classList.add('hidden');
  });

  // Initial display update for multiple
  if (isMultiple) {
    updateMultipleDisplay();
  } else {
    const selected = select.options[select.selectedIndex];
    if (selected && !selected.disabled) {
      display.innerHTML = `<span>${selected.textContent}</span><i class="fas fa-chevron-down text-gray-400 text-xs"></i>`;
    }
  }
}
