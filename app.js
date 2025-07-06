// --- Service Worker registration for PWA ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js');
    });
}

// --- IndexedDB Setup ---
const DB_NAME = 'mypub-db';
const DB_VERSION = 2; // Actualizado para nuevos campos
let db;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject('Error abriendo IndexedDB');
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        request.onupgradeneeded = (e) => {
            db = e.target.result;
            if (!db.objectStoreNames.contains('users')) {
                db.createObjectStore('users', { keyPath: 'email' });
            }
            if (!db.objectStoreNames.contains('media')) {
                const mediaStore = db.createObjectStore('media', { keyPath: 'id', autoIncrement: true });
                mediaStore.createIndex('owner', 'owner', { unique: false });
                mediaStore.createIndex('privacy', 'privacy', { unique: false });
            } else if (e.oldVersion < 2) {
                let store = e.target.transaction.objectStore('media');
                if (!store.indexNames.contains('privacy'))
                    store.createIndex('privacy', 'privacy', { unique: false });
            }
            if (!db.objectStoreNames.contains('blocks')) {
                db.createObjectStore('blocks', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// --- Helper: Fetch countries, cities, streets ---
async function getCountries() {
    const resp = await fetch('https://restcountries.com/v3.1/all');
    const data = await resp.json();
    return data.map(c => ({
        name: c.name.common,
        code: c.cca2,
        callingCode: c.idd.root ? c.idd.root + (c.idd.suffixes ? c.idd.suffixes[0] : '') : ''
    })).sort((a, b) => a.name.localeCompare(b.name));
}

async function getCities(country) {
    const url = `https://countriesnow.space/api/v0.1/countries/cities`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({country})
    });
    const data = await resp.json();
    return data.data || [];
}

// Mock calles
function getStreets(city) {
    return [
        'Avenida Principal', 'Calle Mayor', 'Boulevard Central', 'Camino Real',
        'Paseo del Parque', 'Avenida de la Paz', 'Calle del Sol'
    ].sort();
}

// --- UI Rendering Helpers ---
function renderAuthForms() {
    const container = document.getElementById('auth-container');
    container.innerHTML = `
    <div class="col-md-6">
        <div class="card mb-3">
            <div class="card-header">Iniciar sesión</div>
            <div class="card-body">
                <form id="login-form">
                    <div class="mb-2">
                        <label>Email (Gmail)</label>
                        <input type="email" class="form-control" name="email" required placeholder="usuario@gmail.com">
                    </div>
                    <div class="mb-2">
                        <label>Contraseña</label>
                        <input type="password" class="form-control" name="password" required>
                    </div>
                    <button class="btn btn-primary w-100" type="submit">Entrar</button>
                </form>
            </div>
        </div>
        <div class="text-center">
            <a href="#" id="show-register">¿No tienes cuenta? Regístrate</a>
        </div>
    </div>
    `;
    document.getElementById('show-register').onclick = () => renderRegisterForm();
    document.getElementById('login-form').onsubmit = handleLogin;
}

async function renderRegisterForm() {
    const countries = await getCountries();
    const countryOptions = countries.map(c => `<option value="${c.name}" data-code="${c.code}" data-calling="${c.callingCode}">${c.name}</option>`).join('');
    const container = document.getElementById('auth-container');
    container.innerHTML = `
    <div class="col-md-8">
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span>Registro de usuario</span>
                <button class="btn btn-sm btn-info" id="help-btn" type="button" title="Ayuda">
                    AYUDA
                </button>
            </div>
            <div class="card-body">
                <form id="register-form" autocomplete="off">
                    <div class="mb-2">
                        <label>Nombre completo</label>
                        <input type="text" class="form-control" name="fullname" required>
                    </div>
                    <div class="mb-2">
                        <label>País</label>
                        <select class="form-select" name="country" id="reg-country" required>
                            <option value="">Selecciona un país</option>
                            ${countryOptions}
                        </select>
                    </div>
                    <div class="mb-2">
                        <label>Ciudad</label>
                        <select class="form-select" name="city" id="reg-city" required disabled>
                            <option value="">Selecciona una ciudad</option>
                        </select>
                    </div>
                    <div class="mb-2">
                        <label>Calle</label>
                        <select class="form-select" name="street" id="reg-street" required disabled>
                            <option value="">Selecciona una calle</option>
                        </select>
                    </div>
                    <div class="mb-2">
                        <label>Teléfono</label>
                        <div class="input-group">
                            <span class="input-group-text" id="reg-phone-prefix"></span>
                            <input type="tel" class="form-control" name="phone" required>
                        </div>
                    </div>
                    <div class="mb-2">
                        <label>Email (Gmail)</label>
                        <input type="email" class="form-control" name="email" required placeholder="usuario@gmail.com">
                    </div>
                    <div class="mb-2">
                        <label>Contraseña</label>
                        <input type="password" class="form-control" name="password" required placeholder="Ej: Abcdef1234@#">
                        <div class="form-text">
                            Mínimo 12 caracteres: 6 letras iniciales (la primera mayúscula), 4 números, 2 símbolos (@, #, &).<br>
                            Para desarrolladores: las 6 letras deben ser <strong>Mpteen</strong>.<br>
                            <strong>Nota</strong>: El rol de desarrollador es interno, no aparece como opción.
                        </div>
                    </div>
                    <button class="btn btn-success w-100" type="submit">Registrar</button>
                </form>
            </div>
        </div>
        <div class="text-center mt-2">
            <a href="#" id="show-login">¿Ya tienes cuenta? Inicia sesión</a>
        </div>
    </div>
    `;
    document.getElementById('show-login').onclick = () => renderAuthForms();

    // --- Dynamic population for Country, City, Street, Phone ---
    document.getElementById('reg-country').onchange = async function() {
        const sel = this.options[this.selectedIndex];
        document.getElementById('reg-phone-prefix').textContent = sel.getAttribute('data-calling') || '';
        const country = this.value;
        if (country) {
            document.getElementById('reg-city').disabled = false;
            document.getElementById('reg-city').innerHTML = '<option value="">Cargando ciudades...</option>';
            const cities = await getCities(country);
            document.getElementById('reg-city').innerHTML = '<option value="">Selecciona una ciudad</option>' +
                cities.map(c => `<option value="${c}">${c}</option>`).join('');
        } else {
            document.getElementById('reg-city').disabled = true;
            document.getElementById('reg-city').innerHTML = '<option value="">Selecciona una ciudad</option>';
            document.getElementById('reg-street').disabled = true;
            document.getElementById('reg-street').innerHTML = '<option value="">Selecciona una calle</option>';
        }
    };
    document.getElementById('reg-city').onchange = function() {
        const city = this.value;
        if (city) {
            document.getElementById('reg-street').disabled = false;
            const streets = getStreets(city);
            document.getElementById('reg-street').innerHTML = '<option value="">Selecciona una calle</option>' +
                streets.map(s => `<option value="${s}">${s}</option>`).join('');
        } else {
            document.getElementById('reg-street').disabled = true;
            document.getElementById('reg-street').innerHTML = '<option value="">Selecciona una calle</option>';
        }
    };

    document.getElementById('register-form').onsubmit = handleRegister;

    // Botón de ayuda
    document.getElementById('help-btn').onclick = () => showHelpPanel();
}

function showHelpPanel() {
    const helpModal = new bootstrap.Modal(document.getElementById('helpModal'));
    document.getElementById('help-modal-content').innerHTML = `
        <div class="modal-header">
            <h5 class="modal-title" id="helpModalLabel">Ayuda para registro</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
        </div>
        <div class="modal-body text-center">
            <button class="btn btn-success mb-3 w-100" id="help-whatsapp">Adquirir instrucciones por WhatsApp</button>
            <button class="btn btn-secondary mb-3 w-100" id="help-consulta">Consultas</button>
            <div id="help-form-area"></div>
        </div>
    `;
    helpModal.show();
    document.getElementById('help-whatsapp').onclick = () => showHelpWhatsAppForm(helpModal);
    document.getElementById('help-consulta').onclick = () => showHelpConsultaForm(helpModal);
}

function showHelpWhatsAppForm(helpModal) {
    document.getElementById('help-form-area').innerHTML = `
        <hr>
        <form id="wa-instruc-form">
            <div class="mb-2">
                <label>Nombre completo</label>
                <input type="text" class="form-control" name="fullname" required>
            </div>
            <div class="mb-2">
                <label>Número de cuenta WhatsApp (ej: +240XXXXXXXXX)</label>
                <input type="tel" class="form-control" name="wa" required>
            </div>
            <button class="btn btn-primary w-100" type="submit">ENVIAR</button>
        </form>
    `;
    document.getElementById('wa-instruc-form').onsubmit = function(e) {
        e.preventDefault();
        const fd = new FormData(this);
        const fullname = fd.get('fullname');
        const wa = fd.get('wa');
        const msg = `Hola Sr. Desarrollador de mYpuB, el usuario ${fullname}, con el siguiente número de cuenta de WhatsApp ${wa}, solicita instrucciones para crear una cuenta de acceso a mYpuB.\\n\\nDígnese en ayudarle con la ayuda solicitada, por favor.\\n\\nGracias!`;
        const url = `https://wa.me/240222084663?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
        helpModal.hide();
    };
}

function showHelpConsultaForm(helpModal) {
    document.getElementById('help-form-area').innerHTML = `
        <hr>
        <form id="wa-consulta-form">
            <div class="mb-2">
                <label>Nombre completo</label>
                <input type="text" class="form-control" name="fullname" required>
            </div>
            <div class="mb-2">
                <label>Número de cuenta WhatsApp (ej: +240XXXXXXXXX)</label>
                <input type="tel" class="form-control" name="wa" required>
            </div>
            <button class="btn btn-primary w-100" type="submit">ACEPTAR</button>
        </form>
    `;
    document.getElementById('wa-consulta-form').onsubmit = function(e) {
        e.preventDefault();
        const fd = new FormData(this);
        const fullname = fd.get('fullname');
        const wa = fd.get('wa');
        const msg = `Hola Sr. Desarrollador de mYpuB, soy ${fullname}, un usuario de la aplicación mYpuB y mi contacto es el siguiente: ${wa}, necesito ayuda y sólo usted puede hacerlo).\\n\\nEspero que me diga algo, gracias!`;
        const url = `https://wa.me/240222084663?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
        helpModal.hide();
    };
}

// --- Auth Logic ---
function validatePassword(pw) {
    const devRegex = /^Mpteen[0-9]{4}[@#&]{2}$/;
    const userRegex = /^[A-Z][a-zA-Z]{5}[0-9]{4}[@#&]{2}$/;
    return devRegex.test(pw) || userRegex.test(pw);
}
function isDevPassword(pw) {
    return /^Mpteen[0-9]{4}[@#&]{2}$/.test(pw);
}
function validateGmail(email) {
    return /^[\w.+-]+@gmail\.com$/.test(email);
}
async function handleRegister(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const user = Object.fromEntries(fd.entries());
    user.phone = document.getElementById('reg-phone-prefix').textContent + user.phone;
    user.blocked = false;
    user.isDev = isDevPassword(user.password) ? true : false; // solo para lógica interna
    if (!validateGmail(user.email)) {
        alert('El correo debe ser @gmail.com');
        return;
    }
    if (!validatePassword(user.password)) {
        alert('Contraseña inválida.\nDebe tener 12 caracteres: 6 letras (primera mayúscula), 4 números, 2 símbolos (@#&).\nPara desarrollador: las 6 letras deben ser Mpteen.');
        return;
    }
    await openDB();
    const tx = db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');
    const req = store.get(user.email);
    req.onsuccess = function() {
        if (req.result) {
            alert('Ya existe un usuario con ese correo.');
        } else {
            store.add(user);
            tx.oncomplete = () => {
                alert('Usuario registrado. Ahora puedes iniciar sesión.');
                renderAuthForms();
            };
        }
    };
    req.onerror = () => alert('Error al registrar usuario.');
}
async function handleLogin(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = fd.get('email');
    const password = fd.get('password');
    if (!validateGmail(email)) {
        alert('El correo debe ser @gmail.com');
        return;
    }
    await openDB();
    const tx = db.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    const req = store.get(email);
    req.onsuccess = function() {
        const user = req.result;
        if (user && user.password === password) {
            if (user.blocked) {
                alert('Tu acceso está bloqueado. Contacta con el desarrollador.');
                return;
            }
            localStorage.setItem('mypub-user', JSON.stringify(user));
            showApp();
        } else {
            alert('Credenciales incorrectas.');
        }
    };
    req.onerror = () => alert('Error al iniciar sesión.');
}

// --- Main App Logic ---
function showApp() {
    document.getElementById('auth-container').innerHTML = '';
    document.getElementById('app-container').classList.remove('d-none');
    document.getElementById('nav-auth').classList.add('d-none');
    document.getElementById('nav-logged').classList.remove('d-none');
    const user = JSON.parse(localStorage.getItem('mypub-user'));
    document.getElementById('nav-user').textContent = user ? user.fullname : '';
    // Tabs: por defecto mostrar "SUBIR TU"
    setTimeout(() => {
        document.getElementById('tab-upload').classList.add('active');
        document.getElementById('panel-upload').classList.add('show', 'active');
        document.getElementById('tab-gallery').classList.remove('active');
        document.getElementById('panel-gallery').classList.remove('show', 'active');
        document.getElementById('tab-users').classList.remove('active');
        document.getElementById('panel-users').classList.remove('show', 'active');
        document.getElementById('tab-info').classList.remove('active');
        document.getElementById('panel-info').classList.remove('show', 'active');
    }, 100);
    // Cargar galería y gestión
    loadGalleryList();
    if (user.isDev) {
        document.getElementById('tab-users').parentElement.classList.remove('d-none');
        loadUserManagement();
    } else {
        document.getElementById('tab-users').parentElement.classList.add('d-none');
    }
}

function logout() {
    localStorage.removeItem('mypub-user');
    document.getElementById('app-container').classList.add('d-none');
    document.getElementById('nav-auth').classList.remove('d-none');
    document.getElementById('nav-logged').classList.add('d-none');
    renderAuthForms();
}

// --- Media Upload (SUBIR TU) ---
document.addEventListener('DOMContentLoaded', async () => {
    await openDB();
    document.getElementById('nav-login').onclick = () => renderAuthForms();
    document.getElementById('nav-register').onclick = () => renderRegisterForm();
    document.getElementById('nav-logout').onclick = () => logout();

    if (localStorage.getItem('mypub-user')) showApp();
    else renderAuthForms();

    document.getElementById('upload-form').onsubmit = async function(e) {
        e.preventDefault();
        const user = JSON.parse(localStorage.getItem('mypub-user'));
        const files = document.getElementById('media-file').files;
        const privacy = document.getElementById('media-privacy').value;
        if (!files.length) return;
        await openDB();
        const tx = db.transaction('media', 'readwrite');
        const store = tx.objectStore('media');
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = async function(ev) {
                const mediaObj = {
                    owner: user.email,
                    ownerName: user.fullname,
                    name: file.name,
                    type: file.type,
                    added: new Date().toISOString(),
                    privacy: privacy,
                    comments: [],
                    likes: [],
                    dislikes: [],
                    details: '',
                    data: file.size > 1024 * 1024 * 2 ? ev.target.result : file
                };
                store.add(mediaObj);
            }
            if (file.size > 1024 * 1024 * 2) {
                reader.readAsDataURL(file);
            } else {
                store.add({
                    owner: user.email,
                    ownerName: user.fullname,
                    name: file.name,
                    type: file.type,
                    added: new Date().toISOString(),
                    privacy: privacy,
                    comments: [],
                    likes: [],
                    dislikes: [],
                    details: '',
                    data: file
                });
            }
        }
        tx.oncomplete = () => {
            alert('¡Subido con éxito!');
            loadGalleryList();
        };
    };

    // Cambiar de tab
    document.getElementById('tab-upload').onclick = () => {
        document.getElementById('panel-upload').classList.add('show', 'active');
        document.getElementById('panel-gallery').classList.remove('show', 'active');
        document.getElementById('panel-users').classList.remove('show', 'active');
        document.getElementById('panel-info').classList.remove('show', 'active');
    };
    document.getElementById('tab-gallery').onclick = () => {
        loadGalleryList();
        document.getElementById('panel-gallery').classList.add('show', 'active');
        document.getElementById('panel-upload').classList.remove('show', 'active');
        document.getElementById('panel-users').classList.remove('show', 'active');
        document.getElementById('panel-info').classList.remove('show', 'active');
    };
    document.getElementById('tab-users').onclick = () => {
        loadUserManagement();
        document.getElementById('panel-users').classList.add('show', 'active');
        document.getElementById('panel-gallery').classList.remove('show', 'active');
        document.getElementById('panel-upload').classList.remove('show', 'active');
        document.getElementById('panel-info').classList.remove('show', 'active');
    };
    document.getElementById('tab-info').onclick = () => {
        document.getElementById('panel-info').classList.add('show', 'active');
        document.getElementById('panel-users').classList.remove('show', 'active');
        document.getElementById('panel-gallery').classList.remove('show', 'active');
        document.getElementById('panel-upload').classList.remove('show', 'active');
    };
});

// --- GALERÍA GLOBAL ---
async function loadGalleryList() {
    await openDB();
    const user = JSON.parse(localStorage.getItem('mypub-user'));
    const tx = db.transaction('media', 'readonly');
    const store = tx.objectStore('media');
    store.getAll().onsuccess = function(e) {
        let list = e.target.result || [];
        // Solo mostrar los públicos y los privados del propio usuario
        list = list.filter(media =>
            media.privacy === 'public' || (user && media.owner === user.email)
        );
        renderGalleryList(list, user);
    };
}

function getMediaURL(media) {
    if (typeof media.data === 'string' && media.data.startsWith('data:')) {
        return media.data; // base64
    }
    return URL.createObjectURL(media.data);
}

function renderGalleryList(list, user) {
    const container = document.getElementById('gallery-list');
    container.innerHTML = '';
    list.forEach(media => {
        const card = document.createElement('div');
        card.className = 'col-md-4';
        card.innerHTML = `
            <div class="card shadow-sm">
                <div class="card-body text-center">
                    ${media.type.startsWith('image')
                        ? `<img src="${getMediaURL(media)}" class="mb-2">`
                        : `<video controls src="${getMediaURL(media)}" class="mb-2"></video>`
                    }
                    <div><b>${media.name}</b></div>
                    <div>
                        <span class="badge ${media.privacy === 'public' ? 'bg-success' : 'bg-warning'}">${media.privacy === 'public' ? 'Público' : 'Privado'}</span>
                    </div>
                    <div class="text-muted fst-italic">Subido por: ${media.ownerName || media.owner}</div>
                    <div><small class="text-muted">${media.added.slice(0, 16).replace('T',' ')}</small></div>
                    <div class="mb-2">
                        <span class="media-detail-like-btn" title="Me gusta" data-action="like" data-id="${media.id}">👍 ${media.likes?.length||0}</span>
                        <span class="media-detail-dislike-btn" title="No me gusta" data-action="dislike" data-id="${media.id}">👎 ${media.dislikes?.length||0}</span>
                    </div>
                    <button class="btn btn-sm btn-primary mt-2" data-action="details" data-id="${media.id}">Detalles</button>
                    ${media.privacy === 'public' ? `<a href="${getMediaURL(media)}" download="${media.name}" class="btn btn-sm btn-outline-secondary mt-2">Descargar</a>` : ''}
                </div>
            </div>
        `;
        container.appendChild(card);
        // Like/dislike/detalles
        card.querySelector('[data-action="like"]').onclick = () => toggleLike(media, user, true, null, true);
        card.querySelector('[data-action="dislike"]').onclick = () => toggleLike(media, user, false, null, true);
        card.querySelector('[data-action="details"]').onclick = () => showMediaDetails(media, user, true);
    });
}

// --- Media Details, Likes/Dislikes, Comments ---
function isOwnerOrDev(media, user) {
    return user && (media.owner === user.email || user.isDev);
}

function showMediaDetails(media, user, forceReload) {
    let modalDiv = document.getElementById('mediaDetailModal');
    if (!modalDiv) {
        modalDiv = document.createElement('div');
        modalDiv.className = "modal fade";
        modalDiv.id = "mediaDetailModal";
        modalDiv.tabIndex = -1;
        modalDiv.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content" id="media-detail-modal-content"></div>
            </div>
        `;
        document.body.appendChild(modalDiv);
    }
    const likes = media.likes || [];
    const dislikes = media.dislikes || [];
    const comments = media.comments || [];
    document.getElementById('media-detail-modal-content').innerHTML = `
        <div class="modal-header">
            <h5 class="modal-title">${media.name}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
        </div>
        <div class="modal-body">
            <div class="row mb-3">
                <div class="col-md-6 text-center">
                    ${media.type.startsWith('image')
                        ? `<img src="${getMediaURL(media)}" class="mb-2">`
                        : `<video controls src="${getMediaURL(media)}" class="mb-2"></video>`
                    }
                </div>
                <div class="col-md-6">
                    <div>
                        <span class="badge ${media.privacy === 'public' ? 'bg-success' : 'bg-warning'}">${media.privacy === 'public' ? 'Público' : 'Privado'}</span>
                    </div>
                    <div class="mb-2"><small class="text-muted">${media.added.slice(0, 16).replace('T',' ')}</small></div>
                    <div><b>Subido por:</b> ${media.ownerName || media.owner}</div>
                    <div class="mb-2">
                        <span class="media-detail-like-btn" id="likeBtn" title="Me gusta">👍 ${likes.length}</span>
                        <span class="media-detail-dislike-btn" id="dislikeBtn" title="No me gusta">👎 ${dislikes.length}</span>
                    </div>
                    <div class="mb-2">
                        <strong>Detalles:</strong>
                        <span id="media-details-txt">${media.details || '(Sin detalles)'}</span>
                        ${isOwnerOrDev(media, user) ? `<span class="media-detail-edit ms-2" id="editDetailsBtn">(Editar)</span>` : ''}
                    </div>
                    <div>
                        <strong>Comentarios</strong>
                        <div class="media-detail-comments border rounded p-2 mb-2" id="media-comments-area">
                            ${(comments.map(c => `<div><b>${c.user}</b>: ${c.text}</div>`).join('')) || '(Sin comentarios)'}
                        </div>
                        <form id="media-comment-form" class="d-flex mt-2">
                            <input type="text" class="form-control" id="media-comment-input" placeholder="Escribe tu comentario..." required>
                            <button class="btn btn-primary ms-2" type="submit">Comentar</button>
                        </form>
                    </div>
                    ${isOwnerOrDev(media, user) ? `<button class="btn btn-danger mt-3" id="deleteMediaBtn">Eliminar</button>` : ''}
                </div>
            </div>
        </div>
    `;
    const modal = new bootstrap.Modal(modalDiv);
    modal.show();

    document.getElementById('likeBtn').onclick = () => toggleLike(media, user, true, modal, false, true);
    document.getElementById('dislikeBtn').onclick = () => toggleLike(media, user, false, modal, false, true);

    document.getElementById('media-comment-form').onsubmit = function(e) {
        e.preventDefault();
        addComment(media, user, modal, true);
    };

    if (isOwnerOrDev(media, user)) {
        document.getElementById('editDetailsBtn').onclick = function() {
            editDetails(media, user, modal, true);
        };
        document.getElementById('deleteMediaBtn').onclick = function() {
            deleteMedia(media.id, true);
            modal.hide();
        };
    }
}

async function toggleLike(media, user, isLike, modal, reloadGallery, reloadDetails) {
    await openDB();
    const tx = db.transaction('media', 'readwrite');
    const store = tx.objectStore('media');
    const req = store.get(media.id);
    req.onsuccess = function() {
        const m = req.result;
        if (!m.likes) m.likes = [];
        if (!m.dislikes) m.dislikes = [];
        if (isLike) {
            if (!m.likes.includes(user.email)) m.likes.push(user.email);
            m.dislikes = m.dislikes.filter(e => e !== user.email);
        } else {
            if (!m.dislikes.includes(user.email)) m.dislikes.push(user.email);
            m.likes = m.likes.filter(e => e !== user.email);
        }
        store.put(m);
        tx.oncomplete = () => {
            if (reloadDetails) showMediaDetails(m, user);
            if (reloadGallery) loadGalleryList();
        };
    };
}

async function addComment(media, user, modal, reloadDetails) {
    const commentInput = document.getElementById('media-comment-input');
    const text = commentInput.value.trim();
    if (!text) return;
    await openDB();
    const tx = db.transaction('media', 'readwrite');
    const store = tx.objectStore('media');
    const req = store.get(media.id);
    req.onsuccess = function() {
        const m = req.result;
        if (!m.comments) m.comments = [];
        m.comments.push({
            user: user.fullname,
            text: text
        });
        store.put(m);
        tx.oncomplete = () => {
            if (reloadDetails) showMediaDetails(m, user);
        };
    };
}

async function editDetails(media, user, modal, reloadDetails) {
    const details = prompt("Editar detalles:", media.details || "");
    if (details !== null) {
        await openDB();
        const tx = db.transaction('media', 'readwrite');
        const store = tx.objectStore('media');
        const req = store.get(media.id);
        req.onsuccess = function() {
            const m = req.result;
            m.details = details;
            store.put(m);
            tx.oncomplete = () => {
                if (reloadDetails) showMediaDetails(m, user);
            };
        };
    }
}

async function deleteMedia(id, reloadGallery) {
    await openDB();
    const tx = db.transaction('media', 'readwrite');
    tx.objectStore('media').delete(id);
    tx.oncomplete = () => {
        if (reloadGallery) loadGalleryList();
    };
}

// --- GESTIÓN DE USUARIOS (Sólo desarrollador) ---
async function loadUserManagement() {
    await openDB();
    const tx = db.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    const req = store.getAll();
    req.onsuccess = function() {
        const users = req.result || [];
        renderUserManagement(users);
    };
}

function renderUserManagement(users) {
    const container = document.getElementById('users-list');
    container.innerHTML = `<table class="table table-bordered table-striped">
        <thead>
            <tr>
                <th>Email</th>
                <th>Nombre</th>
                <th>País</th>
                <th>Ciudad</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th>Acciones</th>
            </tr>
        </thead>
        <tbody>
            ${users.map(u => `
                <tr>
                    <td>${u.email}</td>
                    <td>${u.fullname}</td>
                    <td>${u.country}</td>
                    <td>${u.city}</td>
                    <td>${u.phone}</td>
                    <td>${u.blocked ? '<span class="blocked-user">Bloqueado</span>' : 'Activo'}</td>
                    <td>
                        <button class="btn btn-sm btn-warning" data-action="block" data-email="${u.email}">${u.blocked ? 'Desbloquear' : 'Bloquear'}</button>
                        <button class="btn btn-sm btn-secondary" data-action="edit" data-email="${u.email}">Editar</button>
                        <button class="btn btn-sm btn-danger" data-action="delete" data-email="${u.email}">Eliminar</button>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    </table>`;
    // Botones
    container.querySelectorAll('[data-action="block"]').forEach(btn => {
        btn.onclick = () => toggleBlockUser(btn.getAttribute('data-email'));
    });
    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.onclick = () => editUser(btn.getAttribute('data-email'));
    });
    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.onclick = () => deleteUser(btn.getAttribute('data-email'));
    });
}

async function toggleBlockUser(email) {
    await openDB();
    const tx = db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');
    store.get(email).onsuccess = function(e) {
        const user = e.target.result;
        user.blocked = !user.blocked;
        store.put(user);
        tx.oncomplete = loadUserManagement;
    };
}

async function editUser(email) {
    await openDB();
    const tx = db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');
    store.get(email).onsuccess = function(e) {
        const user = e.target.result;
        const fullname = prompt("Editar nombre completo:", user.fullname);
        if (fullname !== null && fullname.trim() !== "") {
            user.fullname = fullname.trim();
            store.put(user);
            tx.oncomplete = loadUserManagement;
        }
    };
}

async function deleteUser(email) {
    if (!confirm('¿Seguro que deseas eliminar este usuario?')) return;
    await openDB();
    const tx = db.transaction(['users', 'media'], 'readwrite');
    tx.objectStore('users').delete(email);
    // Eliminar también sus archivos media
    const mstore = tx.objectStore('media');
    mstore.openCursor().onsuccess = function(e) {
        const cursor = e.target.result;
        if (cursor) {
            if (cursor.value.owner === email) cursor.delete();
            cursor.continue();
        }
    };
    tx.oncomplete = loadUserManagement;
}
