const API_URL = 'api/reservations.php';

let selectedId = null;

const filterDate = document.getElementById('filterDate');
const filterStart = document.getElementById('filterStart');
const filterEnd = document.getElementById('filterEnd');
const officeGrid = document.getElementById('officeGrid');
const reservationsList = document.getElementById('reservationsList');
const themeBtn = document.getElementById('themeBtn');

const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const closeModal = document.getElementById('closeModal');
const cancelModal = document.getElementById('cancelModal');
const bookingForm = document.getElementById('bookingForm');
const resourceIdInput = document.getElementById('resourceId');
const userNameInput = document.getElementById('userName');
const modalDateInput = document.getElementById('modalDate');
const modalStartInput = document.getElementById('modalStart');
const modalEndInput = document.getElementById('modalEnd');
const nameError = document.getElementById('nameError');
const timeError = document.getElementById('timeError');
const toastBox = document.getElementById('toastBox');

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    toastBox.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    themeBtn.textContent = theme === 'dark' ? 'Jasny motyw' : 'Ciemny motyw';
}

themeBtn.addEventListener('click', () => {
    const current = localStorage.getItem('theme') || 'light';
    setTheme(current === 'dark' ? 'light' : 'dark');
});

function pad(num) {
    return String(num).padStart(2, '0');
}

function getToday() {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function initDefaults() {
    const now = new Date();
    const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const today = getToday();
    filterDate.value = today;
    filterDate.min = today;
    modalDateInput.min = today;

    filterStart.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    filterEnd.value = `${pad(later.getHours())}:${pad(later.getMinutes())}`;
}

async function loadData() {
    const today = getToday();
    filterDate.min = today;

    let dateVal = filterDate.value;
    const startVal = filterStart.value;
    const endVal = filterEnd.value;

    if (!dateVal || !startVal || !endVal) return;

    if (dateVal < today) {
        dateVal = today;
        filterDate.value = today;
        showToast('Nie można wybrać daty z przeszłości.');
    }

    const start = encodeURIComponent(`${dateVal} ${startVal}`);
    const end = encodeURIComponent(`${dateVal} ${endVal}`);

    try {
        const res = await fetch(`${API_URL}?start=${start}&end=${end}`);
        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || 'Błąd pobierania danych.');
            return;
        }

        renderOffice(data.resources || []);
        renderReservations(data.reservations || []);
    } catch (e) {
        showToast('Błąd połączenia z serwerem.');
    }
}

function renderOffice(resources) {
    officeGrid.innerHTML = '';

    resources.forEach((res) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tile';

        if (res.type === 'room') {
            btn.classList.add('room');
        }

        if (res.is_occupied) {
            btn.classList.add('busy');
            btn.disabled = true;
        } else if (selectedId === res.id) {
            btn.classList.add('selected');
        } else {
            btn.classList.add('free');
        }

        const typeLabel = res.type === 'room' ? `Sala (${res.capacity} os.)` : 'Biurko';
        const statusLabel = res.is_occupied ? 'Zajęte' : (selectedId === res.id ? 'Wybrane' : 'Wolne');

        const typeSpan = document.createElement('span');
        typeSpan.className = 'tile-type';
        typeSpan.textContent = typeLabel;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'tile-name';
        nameSpan.textContent = res.name;

        const statusSpan = document.createElement('span');
        statusSpan.className = 'tile-status';
        statusSpan.textContent = statusLabel;

        btn.append(typeSpan, nameSpan, statusSpan);

        if (!res.is_occupied) {
            btn.addEventListener('click', () => {
                selectedId = res.id;
                renderOffice(resources);
                openModal(res);
            });
        }

        officeGrid.appendChild(btn);
    });
}

function splitDateAndTime(dtStr) {
    const raw = String(dtStr || '').trim();
    const parts = raw.split(/[T ]/);
    const datePart = parts[0] || '';
    const timePart = (parts[1] || '').slice(0, 5);
    return { datePart, timePart };
}

function renderReservations(list) {
    reservationsList.innerHTML = '';

    if (!Array.isArray(list) || list.length === 0) {
        reservationsList.innerHTML = '<tr><td colspan="7">Brak rezerwacji w bazie.</td></tr>';
        return;
    }

    list.forEach((item) => {
        const tr = document.createElement('tr');
        const typ = item.resource_type === 'room' ? 'Sala' : 'Biurko';
        const startInfo = splitDateAndTime(item.start_time);
        const endInfo = splitDateAndTime(item.end_time);

        const tdRes = document.createElement('td');
        tdRes.textContent = item.resource_name;

        const tdType = document.createElement('td');
        tdType.textContent = typ;

        const tdUser = document.createElement('td');
        tdUser.textContent = item.user_name;

        const tdDate = document.createElement('td');
        tdDate.textContent = startInfo.datePart;

        const tdStart = document.createElement('td');
        tdStart.textContent = startInfo.timePart;

        const tdEnd = document.createElement('td');
        tdEnd.textContent = endInfo.timePart;

        const tdAction = document.createElement('td');
        const btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.className = 'btn-del';
        btnDel.textContent = 'Anuluj';

        btnDel.addEventListener('click', async () => {
            if (!confirm(`Anulować rezerwację dla ${item.user_name}?`)) return;

            try {
                const res = await fetch(`${API_URL}?id=${item.id}`, { method: 'DELETE' });
                const data = await res.json();

                if (!res.ok) {
                    showToast(data.error || 'Nie udało się usunąć rezerwacji.');
                    return;
                }

                showToast(data.message || 'Usunięto rezerwację.');
                loadData();
            } catch (e) {
                showToast('Błąd podczas usuwania.');
            }
        });

        tdAction.appendChild(btnDel);
        tr.append(tdRes, tdType, tdUser, tdDate, tdStart, tdEnd, tdAction);
        reservationsList.appendChild(tr);
    });
}

function openModal(res) {
    nameError.textContent = '';
    timeError.textContent = '';
    modalDateInput.min = getToday();

    modalTitle.textContent = `Rezerwacja: ${res.name}`;
    resourceIdInput.value = res.id;
    userNameInput.value = '';
    modalDateInput.value = filterDate.value || getToday();
    modalStartInput.value = filterStart.value || '09:00';
    modalEndInput.value = filterEnd.value || '10:00';

    modal.classList.remove('hidden');
    userNameInput.focus();
}

function hideModal() {
    modal.classList.add('hidden');
    selectedId = null;
    loadData();
}

closeModal.addEventListener('click', hideModal);
cancelModal.addEventListener('click', hideModal);

bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    nameError.textContent = '';
    timeError.textContent = '';

    const nameVal = userNameInput.value.trim();
    const dateVal = modalDateInput.value;
    const startVal = modalStartInput.value;
    const endVal = modalEndInput.value;
    const today = getToday();

    let valid = true;

    if (nameVal.length < 3) {
        nameError.textContent = 'Wpisz minimum 3 znaki.';
        valid = false;
    }

    if (!dateVal || dateVal < today) {
        timeError.textContent = 'Data nie może być z przeszłości.';
        valid = false;
    } else if (!startVal || !endVal || endVal <= startVal) {
        timeError.textContent = 'Godzina zakończenia musi być późniejsza niż rozpoczęcia.';
        valid = false;
    }

    if (!valid) return;

    const body = {
        resource_id: Number(resourceIdInput.value),
        user_name: nameVal,
        start_time: `${dateVal} ${startVal}`,
        end_time: `${dateVal} ${endVal}`
    };

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || 'Błąd zapisu rezerwacji.');
            if (res.status === 409) {
                timeError.textContent = data.error;
            }
            return;
        }

        showToast(data.message || 'Zarezerwowano.');
        modal.classList.add('hidden');
        selectedId = null;
        filterDate.value = dateVal;
        loadData();
    } catch (e) {
        showToast('Błąd połączenia z serwerem.');
    }
});

filterDate.addEventListener('change', loadData);
filterStart.addEventListener('change', loadData);
filterEnd.addEventListener('change', loadData);

setTheme(localStorage.getItem('theme') || 'light');
initDefaults();
loadData();