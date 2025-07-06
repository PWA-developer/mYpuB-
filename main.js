
// Configuración de IndexedDB
const dbName = 'mYpuBDB';
const dbVersion = 1;
let db;

// Inicializar IndexedDB
const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);

        request.onerror = (event) => reject('Error en la base de datos: ' + event.target.error);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Almacén de usuarios
            if (!db.objectStoreNames.contains('users')) {
                const userStore = db.createObjectStore('users', { keyPath: 'email' });
                userStore.createIndex('fullName', 'fullName', { unique: false });
                userStore.createIndex('isBlocked', 'isBlocked', { unique: false });
            }

            // Almacén de medios
            if (!db.objectStoreNames.contains('media')) {
                const mediaStore = db.createObjectStore('media', { keyPath: 'id', autoIncrement: true });
                mediaStore.createIndex('userId', 'userId', { unique: false });
                mediaStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
    });
};

// Registro del Service Worker para PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js')
        .then(registration => console.log('ServiceWorker registrado'))
        .catch(error => console.log('Error en registro de ServiceWorker:', error));
}

// Sesión de usuario actual
let currentUser = null;

// Elementos del DOM
const authForms = document.getElementById('authForms');
const mainApp = document.getElementById('mainApp');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterBtn = document.getElementById('showRegister');
const showLoginBtn = document.getElementById('showLogin');
const helpButton = document.getElementById('helpButton');

// Elementos de navegación
const uploadNav = document.getElementById('uploadNav');
const galleryNav = document.getElementById('galleryNav');
const userManagementNav = document.getElementById('userManagementNav');
const infoNav = document.getElementById('infoNav');
const logoutBtn = document.getElementById('logoutBtn');

// Secciones de contenido
const sections = ['uploadSection', 'gallerySection', 'userManagementSection', 'infoSection']
    .reduce((acc, id) => ({ ...acc, [id]: document.getElementById(id) }), {});

// Validación de formularios
const validatePassword = (password) => {
    const regex = /^[A-Z][a-zA-Z]{5}[0-9]{4}[@#&]{2}$/;
    return regex.test(password);
};

const validateEmail = (email) => {
    return email.endsWith('@gmail.com');
};

// Autenticación de usuarios
const registerUser = async (event) => {
    event.preventDefault();
    
    const formData = {
        fullName: document.getElementById('fullName').value,
        country: document.getElementById('country').value,
        phone: document.getElementById('phonePrefix').textContent + document.getElementById('phone').value,
        email: document.getElementById('registerEmail').value,
        password: document.getElementById('registerPassword').value,
        isBlocked: false,
        isDeveloper: document.getElementById('registerPassword').value.startsWith('Mpteen')
    };

    if (!validateEmail(formData.email)) {
        alert('Por favor use una dirección de Gmail');
        return;
    }

    if (!validatePassword(formData.password)) {
        alert('La contraseña debe seguir el formato requerido');
        return;
    }

    if (!formData.country) {
        alert('Por favor seleccione un país');
        return;
    }

    try {
        const transaction = db.transaction(['users'], 'readwrite');
        const store = transaction.objectStore('users');
        await store.add(formData);
        alert('¡Registro exitoso! Por favor inicie sesión.');
        showLoginForm();
    } catch (error) {
        alert('Error en registro: ' + error);
    }
};

const loginUser = async (event) => {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const transaction = db.transaction(['users'], 'readonly');
        const store = transaction.objectStore('users');
        const user = await store.get(email);

        if (user && user.password === password && !user.isBlocked) {
            currentUser = user;
            showMainApp();
        } else {
            alert('Credenciales inválidas o cuenta bloqueada');
        }
    } catch (error) {
        alert('Error en inicio de sesión: ' + error);
    }
};

// Navegación de la interfaz
const showLoginForm = () => {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
};

const showRegisterForm = () => {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
};

const showMainApp = () => {
    authForms.classList.add('hidden');
    mainApp.classList.remove('hidden');
    if (currentUser.isDeveloper) {
        userManagementNav.parentElement.classList.remove('hidden');
    }
    showSection('uploadSection');
};

const showSection = (sectionId) => {
    Object.values(sections).forEach(section => section.classList.add('hidden'));
    sections[sectionId].classList.remove('hidden');
};

// Manejo de medios
const uploadMedia = async (event) => {
    event.preventDefault();
    
    const file = document.getElementById('mediaFile').files[0];
    const isPublic = document.getElementById('isPublic').checked;

    if (!file) return;

    try {
        const base64Data = await fileToBase64(file);
        const mediaData = {
            userId: currentUser.email,
            data: base64Data,
            type: file.type,
            isPublic,
            timestamp: new Date().toISOString(),
            likes: 0,
            dislikes: 0,
            comments: []
        };

        const transaction = db.transaction(['media'], 'readwrite');
        const store = transaction.objectStore('media');
        await store.add(mediaData);
        alert('¡Subida exitosa!');
        loadGallery();
    } catch (error) {
        alert('Error en subida: ' + error);
    }
};

const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
};

// Integración con WhatsApp
const sendWhatsAppMessage = async (name, number, isInstructions) => {
    const message = isInstructions
        ? `Hola Sr. Desarrollador de mYpuB, el usuario ${name}, con el siguiente número de cuenta de WhatsApp ${number}, solicita instrucciones para crear una cuenta de acceso a mYpuB.\n\nDígnese en ayudarle con la ayuda solicitada, por favor.\n\nGracias!`
        : `Hola Sr. Desarrollador de mYpuB, soy ${name}, un usuario de la aplicación mYpuB y mi contacto es el siguiente: ${number}, necesito ayuda y sólo usted puede hacerlo.\n\nEspero que me diga algo, gracias!`;

    const whatsappNumber = '240222084663';
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`);
};

// Cargar países desde la API de RestCountries
const loadCountries = async () => {
    try {
        const response = await fetch('https://restcountries.com/v3.1/all');
        const countries = await response.json();
        
        // Ordenar países alfabéticamente
        countries.sort((a, b) => {
            return a.name.common.localeCompare(b.name.common);
        });

        const countrySelect = document.getElementById('country');
        countrySelect.innerHTML = '<option value="">Seleccione un país</option>';
        
        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country.name.common;
            option.textContent = country.name.common;
            
            // Obtener el código de llamada (prefijo telefónico)
            if (country.idd && country.idd.root) {
                let phoneCode = country.idd.root;
                if (country.idd.suffixes && country.idd.suffixes.length === 1) {
                    phoneCode += country.idd.suffixes[0];
                }
                option.dataset.phoneCode = phoneCode;
            } else {
                option.dataset.phoneCode = '+';
            }
            
            countrySelect.appendChild(option);
        });

        // Configurar evento para actualizar prefijo telefónico
        countrySelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            document.getElementById('phonePrefix').textContent = selectedOption.dataset.phoneCode || '+';
        });

    } catch (error) {
        console.error('Error al cargar países:', error);
        
        // Datos de respaldo en caso de fallo en la API
        const backupCountries = [
            { name: { common: 'España' }, idd: { root: '+3', suffixes: ['4'] } },
            { name: { common: 'México' }, idd: { root: '+5', suffixes: ['2'] } },
            { name: { common: 'Colombia' }, idd: { root: '+5', suffixes: ['7'] } },
            { name: { common: 'Argentina' }, idd: { root: '+5', suffixes: ['4'] } },
            { name: { common: 'Estados Unidos' }, idd: { root: '+1', suffixes: [] } }
        ];
        
        const countrySelect = document.getElementById('country');
        countrySelect.innerHTML = '<option value="">Seleccione un país</option>';
        
        backupCountries.forEach(country => {
            const option = document.createElement('option');
            option.value = country.name.common;
            option.textContent = country.name.common;
            option.dataset.phoneCode = country.idd.root + (country.idd.suffixes?.[0] || '');
            countrySelect.appendChild(option);
        });
    }
};

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        await loadCountries();
        
        // Navegación de autenticación
        showRegisterBtn.addEventListener('click', showRegisterForm);  // Cambiado aquí - eliminado el preventDefault y el wrapper function

        showLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginForm();
        });
        
        // Envío de formularios
        document.getElementById('register').addEventListener('submit', registerUser);
        document.getElementById('login').addEventListener('submit', loginUser);
        document.getElementById('uploadForm').addEventListener('submit', uploadMedia);
        
        // Navegación principal
        uploadNav.addEventListener('click', () => showSection('uploadSection'));
        galleryNav.addEventListener('click', () => showSection('gallerySection'));
        userManagementNav.addEventListener('click', () => showSection('userManagementSection'));
        infoNav.addEventListener('click', () => showSection('infoSection'));
        
        // Ayuda de WhatsApp
        helpButton.addEventListener('click', () => {
            const helpModal = new bootstrap.Modal(document.getElementById('helpModal'));
            helpModal.show();
        });
        
        document.getElementById('whatsappInstructions').addEventListener('click', () => {
            const whatsappModal = new bootstrap.Modal(document.getElementById('whatsappModal'));
            document.getElementById('whatsappModalTitle').textContent = 'Obtener instrucciones';
            document.getElementById('whatsappForm').onsubmit = (e) => {
                e.preventDefault();
                const name = document.getElementById('whatsappName').value;
                const number = document.getElementById('whatsappNumber').value;
                sendWhatsAppMessage(name, number, true);
                whatsappModal.hide();
            };
            whatsappModal.show();
        });
        
        document.getElementById('whatsappConsultation').addEventListener('click', () => {
            const whatsappModal = new bootstrap.Modal(document.getElementById('whatsappModal'));
            document.getElementById('whatsappModalTitle').textContent = 'Solicitar consulta';
            document.getElementById('whatsappForm').onsubmit = (e) => {
                e.preventDefault();
                const name = document.getElementById('whatsappName').value;
                const number = document.getElementById('whatsappNumber').value;
                sendWhatsAppMessage(name, number, false);
                whatsappModal.hide();
            };
            whatsappModal.show();
        });
        
        logoutBtn.addEventListener('click', () => {
            currentUser = null;
            mainApp.classList.add('hidden');
            authForms.classList.remove('hidden');
            showLoginForm();
        });
    } catch (error) {
        console.error('Error en inicialización:', error);
    }
});

// Funciones de la galería
const loadGallery = async () => {
    try {
        const transaction = db.transaction(['media'], 'readonly');
        const store = transaction.objectStore('media');
        const mediaGrid = document.getElementById('mediaGrid');
        mediaGrid.innerHTML = '';

        store.openCursor().onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const media = cursor.value;
                if (media.isPublic || media.userId === currentUser.email) {
                    const card = createMediaCard(media);
                    mediaGrid.appendChild(card);
                }
                cursor.continue();
            }
        };
    } catch (error) {
        console.error('Error al cargar galería:', error);
    }
};

const createMediaCard = (media) => {
    const col = document.createElement('div');
    col.className = 'col-md-4';
    
    const card = document.createElement('div');
    card.className = 'card media-card';
    
    const mediaElement = media.type.startsWith('image/')
        ? createImageElement(media.data)
        : createVideoElement(media.data);
    
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';
    cardBody.innerHTML = `
        <p>Subido por: ${media.userId}</p>
        <p>Fecha: ${new Date(media.timestamp).toLocaleString()}</p>
        <div class="btn-group">
            <button class="btn btn-sm btn-outline-primary like-btn">👍 ${media.likes}</button>
            <button class="btn btn-sm btn-outline-danger dislike-btn">👎 ${media.dislikes}</button>
        </div>
    `;

    if (currentUser.email === media.userId || currentUser.isDeveloper) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-danger ms-2';
        deleteBtn.textContent = 'Eliminar';
        deleteBtn.onclick = () => deleteMedia(media.id);
        cardBody.appendChild(deleteBtn);
    }

    card.appendChild(mediaElement);
    card.appendChild(cardBody);
    col.appendChild(card);
    
    return col;
};

const createImageElement = (data) => {
    const img = document.createElement('img');
    img.className = 'card-img-top media-preview';
    img.src = data;
    return img;
};

const createVideoElement = (data) => {
    const video = document.createElement('video');
    video.className = 'card-img-top media-preview';
    video.controls = true;
    video.src = data;
    return video;
};

const deleteMedia = async (mediaId) => {
    if (!confirm('¿Está seguro que desea eliminar este medio?')) return;
    
    try {
        const transaction = db.transaction(['media'], 'readwrite');
        const store = transaction.objectStore('media');
        await store.delete(mediaId);
        loadGallery();
    } catch (error) {
        alert('Error al eliminar medio: ' + error);
    }
};

// Funciones de gestión de usuarios
const loadUserManagement = async () => {
    if (!currentUser.isDeveloper) return;
    
    try {
        const transaction = db.transaction(['users'], 'readonly');
        const store = transaction.objectStore('users');
        const userList = document.getElementById('userList');
        userList.innerHTML = '';

        store.openCursor().onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const user = cursor.value;
                const item = createUserListItem(user);
                userList.appendChild(item);
                cursor.continue();
            }
        };
    } catch (error) {
        console.error('Error al cargar gestión de usuarios:', error);
    }
};

const createUserListItem = (user) => {
    const item = document.createElement('div');
    item.className = 'list-group-item';
    item.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <div>
                <h5>${user.fullName}</h5>
                <p class="mb-1">${user.email}</p>
                <small>${user.country}</small>
            </div>
            <div>
                <button class="btn btn-sm ${user.isBlocked ? 'btn-success' : 'btn-danger'}"
                        onclick="toggleUserBlock('${user.email}')">
                    ${user.isBlocked ? 'Desbloquear' : 'Bloquear'}
                </button>
            </div>
        </div>
    `;
    return item;
};

const toggleUserBlock = async (email) => {
    try {
        const transaction = db.transaction(['users'], 'readwrite');
        const store = transaction.objectStore('users');
        const user = await store.get(email);
        user.isBlocked = !user.isBlocked;
        await store.put(user);
        loadUserManagement();
    } catch (error) {
        alert('Error al cambiar estado de bloqueo: ' + error);
    }
};
