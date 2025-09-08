// Client-side script for search functionality and form handling

document.addEventListener('DOMContentLoaded', () => {
  /**
   * Build a flat array of menu items for search. Each object contains the
   * Hebrew name of the dish and its category. When the user types into
   * the search box, we filter this array and display matching results.
   */
  const menuItems = [
    { name: 'פנקייקים עם דבש', category: 'ארוחות בוקר' },
    { name: 'חביתה ירקות טרייה', category: 'ארוחות בוקר' },
    { name: 'שקשוקה ביתית', category: 'ארוחות בוקר' },
    { name: 'סלט קיסר עם רוטב לימון', category: 'סלטים' },
    { name: 'סלט יווני עם גבינה בולגרית', category: 'סלטים' },
    { name: 'סלט ירוק עם אגוזים ורימונים', category: 'סלטים' },
    { name: 'פיצה מרגריטה בטאבון', category: 'מהטאבון' },
    { name: 'מאפה זעתר מסורתי', category: 'מהטאבון' },
    { name: 'פוקאצ׳ה עם שמן זית ורוזמרין', category: 'מהטאבון' },
    { name: 'סמבוסק גבינות וזיתים', category: 'סמבוסק' },
    { name: 'סמבוסק תרד ופטריות', category: 'סמבוסק' },
    { name: 'סמבוסק תפוחי אדמה', category: 'סמבוסק' },
    { name: 'קפה הפוך', category: 'משקאות' },
    { name: 'תה עם נענע', category: 'משקאות' },
    { name: 'מיץ תפוזים טרי', category: 'משקאות' }
  ];

  /**
   * If the search input exists on the page, set up an input listener
   * that filters the menu items by name. Results are shown below the
   * search field. When no query is typed, the results box is hidden.
   */
  const searchInput = document.getElementById('searchInput');
  const resultsContainer = document.getElementById('searchResults');
  if (searchInput && resultsContainer) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim();
      // If the input is empty, hide results and do nothing
      if (query === '') {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('hidden');
        return;
      }
      // Filter the items by inclusion of the query string
      const matches = menuItems.filter(item => item.name.includes(query));
      // Build the list markup
      if (matches.length > 0) {
        const list = document.createElement('ul');
        matches.forEach(match => {
          const li = document.createElement('li');
          li.textContent = `${match.name} – ${match.category}`;
          list.appendChild(li);
        });
        resultsContainer.innerHTML = '';
        resultsContainer.appendChild(list);
      } else {
        resultsContainer.innerHTML = '<p>לא נמצאו תוצאות</p>';
      }
      resultsContainer.classList.remove('hidden');
    });
  }

  /**
   * Contact form submission: prevent the default form submission,
   * display a success message, and reset the form fields. This is a
   * front‑end mockup and does not send data to a server.
   */
  const contactForm = document.getElementById('contactForm');
  const contactStatus = document.getElementById('contactMessageStatus');
  if (contactForm && contactStatus) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      // Gather trimmed values from the form fields
      const name = document.getElementById('contactName').value.trim();
      const phone = document.getElementById('contactPhone').value.trim();
      const email = document.getElementById('contactEmail').value.trim();
      const message = document.getElementById('contactMessage').value.trim();
      // Basic validation
      if (!name || !phone || !email || !message) {
        contactStatus.style.color = '#c75232';
        contactStatus.textContent = 'אנא מלאו את כל הפרטים הנדרשים.';
        return;
      }
      // Display success message
      contactStatus.style.color = '#008000';
      contactStatus.textContent = 'תודה! ההודעה נשלחה, נחזור אליכם בקרוב.';
      // Reset the form
      contactForm.reset();
    });
  }

  /**
   * Accessibility toggle: clicking the button toggles a high‑contrast
   * class on the body element. This improves contrast and increases
   * font size for users with low vision or other accessibility needs.
   */
  const accessibilityToggle = document.getElementById('accessibilityToggle');
  if (accessibilityToggle) {
    accessibilityToggle.addEventListener('click', () => {
      document.body.classList.toggle('high-contrast');
    });
  }
});