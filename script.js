const header = document.querySelector('.header');
const menu = document.querySelector('.menu-toggle');
menu.addEventListener('click', () => { const open = header.classList.toggle('open'); menu.setAttribute('aria-expanded', open); });
document.querySelectorAll('.nav a').forEach(a => a.addEventListener('click', () => header.classList.remove('open')));
document.querySelectorAll('.heart').forEach(button => button.addEventListener('click', () => { button.classList.toggle('saved'); button.textContent = button.classList.contains('saved') ? '♥' : '♡'; }));
const form = document.querySelector('form'); form.addEventListener('submit', e => { e.preventDefault(); const button = form.querySelector('button'); button.innerHTML = 'تم الاشتراك ✓'; form.querySelector('input').value = ''; });
