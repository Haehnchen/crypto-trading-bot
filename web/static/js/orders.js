document.addEventListener('DOMContentLoaded', function () {
  function getPrecision(numberAsString) {
    const n = numberAsString.toString().split('.');
    return n.length > 1 ? n[1].length : 0;
  }

  // Percent input group buttons
  document.querySelectorAll('.percent-input-group').forEach(function (group) {
    group.addEventListener('click', function (e) {
      if (e.target.tagName === 'BUTTON') {
        e.preventDefault();

        const button = e.target;
        const form = button.closest('form');
        const input = form.querySelector('#price');

        const percentageChange = parseFloat(button.value);
        const price = parseFloat(input.value);

        if (!isNaN(price)) {
          input.value = (price + (price * percentageChange) / 100).toFixed(getPrecision(price));
        }
      }
    });
  });

  // Amount input fields
  document.querySelectorAll('.form-group-amount input').forEach(function (input) {
    input.addEventListener('keyup', function (e) {
      const value = this.value;

      if (!value || Number.isNaN(parseFloat(value))) {
        return;
      }

      const id = this.id;
      const form = this.closest('form');
      const assetPrice = form.querySelector('#price').value;

      if (!assetPrice) {
        return;
      }

      const priceValue = parseFloat(assetPrice);
      const amountValue = parseFloat(value);

      if (id === 'amount') {
        form.querySelector('#amount_currency').value = (amountValue * priceValue).toFixed(getPrecision(priceValue));
      } else {
        form.querySelector('#amount').value = (amountValue / priceValue).toFixed(8);
      }
    });
  });

  // Filter pairs
  const filterInput = document.getElementById('filter-pairs');
  if (filterInput) {
    filterInput.addEventListener('keyup', function () {
      const filter = this.value.toLowerCase();
      document.querySelectorAll('.pair-link').forEach(function (link) {
        const pair = link.dataset.pair;
        if (pair.includes(filter)) {
          link.style.display = 'block';
        } else {
          link.style.display = 'none';
        }
      });
    });
  }
});
